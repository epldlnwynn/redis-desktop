const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const path = require("path")
const logger = require("./lib/logger")
const svr = require("./handles/servers")
const hash = require("./handles/hash")
const zset = require("./handles/zset")
const sset = require("./handles/sset")
const list = require("./handles/list")
const value = require("./handles/value")
const db = require("./handles/db")


function registerRouter(app) {
    const PREFIX = "/api/redis/"

    app.get(PREFIX + "list", svr.handleConnectionList)
    app.post(PREFIX + "test", svr.handleTestConnection)
    app.post(PREFIX + "save", svr.handleSaveConnection)
    app.get(PREFIX + "delete/:id", svr.handleDeleteConnection)


    app.get(PREFIX + ":id", db.handleDb)
    app.get(PREFIX + ":id/:database", db.handleDb)
    app.post(PREFIX + ":id/:database/:method", db.handleInvoke)

    app.post(PREFIX + ":id/:database/:op/hash", hash.handleHash)
    app.get(PREFIX + ":id/:database/:op/hash/:name", hash.handleHash)

    app.post(PREFIX + ":id/:database/:op/zset", zset.handleZSet)
    app.get(PREFIX + ":id/:database/:op/zset/:name", zset.handleZSet)

    app.post(PREFIX + ":id/:database/:op/set", sset.handleSSet)
    app.get(PREFIX + ":id/:database/:op/set/:name", sset.handleSSet)

    app.post(PREFIX + ":id/:database/:op/list", list.handleList)
    app.get(PREFIX + ":id/:database/:op/list/:name", list.handleList)


    app.post(PREFIX + ":id/:database/:op/string", value.handleValue)
    app.get(PREFIX + ":id/:database/:op/string/:name", value.handleValue)

}

let serverPort = 63790, serverHost = "127.0.0.1", isTest = (process.env.NODE_ENV === "test")
async function startServer() {
    const app = express()
    const root = path.join(__dirname, 'public')
    const home = path.join(root, "index.html")
    const static = path.join(root, 'static');
    const favicon = path.join(static, 'favicon', 'favicon.ico');
    const toString = (obj) => {
        const t = typeof(obj)
        if (t === "string")
            return obj;
        if (t === "object")
            return JSON.stringify(obj)

        return obj.toString()
    }


    app.response.setEventStreamHeader = function(req) {
        this.writeHead(200, {
            "Content-Type": "text/event-stream;charset=utf-8",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": '*',
        });

        req.connection.addListener("close", () => this.end());
    }
    app.response.stream = function(id, type, data) {
        const a = arguments
        if (a.length == 0) {
            this.write(`event: close\ndata: \n\n`)
            return
        }

        if (a.length == 1) {
            this.write(`event: message\ndata: ${toString(a[0])}\n\n`)
            return;
        }

        if (a.length == 2) {
            this.write(`event: ${a[0]}\ndata: ${toString(a[1])}\n\n`)
            return;
        }

        this.write(`id: ${id}\nevent: ${type}\ndata: ${toString(data)}\n\n`)
    }


    app.use(async (req, res, next) => {
        const accept = req.header("accept")
        console.log('request.log', req.method, req.url, accept)
        logger.info(`request.log ${req.method} ${req.url}`)

        const start = process.hrtime();
        res.on('finish', () => {
            const diff = process.hrtime(start); // 计算耗时
            const time = diff[0] * 1e3 + diff[1] * 1e-6; // 将时间转换为毫秒
            logger.info(`${req.method} ${req.url} - ${time.toFixed(2)}ms`);
        });

        next()
    })
    app.use(cors())
    app.use(bodyParser.json())

    app.use("/favicon.ico", (req, res) => res.sendFile(favicon))
    app.use('/static', express.static(static, {maxAge: 72000}));

    app.get("/", (req, res) => res.sendFile(home))
    app.get("/index.html", (req, res) => res.sendFile(home))


    registerRouter(app)


    app.use(async (err, req, res, next) => {
        console.log("Error:", req.url, err)
        logger.error(`Error:`, req.url, err)

        const accept = req.header("accept")
        if (accept == "text/event-stream") {
            res.stream("error", err.message)
            res.end()
            return;
        }

        res.json({
            message: err.message,
            code: 500,
        })
    })

    const onError = er => {
        if (er) {
            if (er.code === "EADDRINUSE") {
                logger.info(`Port ${serverPort} is in use, trying another one...`);
                app.listen(++serverPort, serverHost, onError);
            } else {
                logger.info(er);
            }
            return;
        }
        logger.info(`服务器启动成功，请访问: http://localhost:${serverPort}`)
    }


    app.listen(serverPort, serverHost, onError)

}


process.on('uncaughtException', function (err) {
    logger.error("uncaughtException.Error:", err)
    console.log("uncaughtException.Error:", err)
})

async function main() {
    await startServer()
}


if (require.main === module) {
    main().catch(er => {
        console.log('\n\nMain.Error:')
        console.error(er.innerError ? er.innerError : er);
        process.exitCode = 1;
    })
} else {
    module.exports = {
        startServer,
        getUrl() {
            return ["http://localhost:", serverPort].join("")
        }
    }
}



