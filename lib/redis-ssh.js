const {createTunnel} = require("tunnel-ssh");
const {createClient, RESP_TYPES } = require("redis");
const logger = require("./logger");

const DEFAULT_PORT = 6379
const DEFAULT_USER_NAME = "default"
const DEFAULT_DB_NUMBER = 16

const tunnelOptions = {
    autoClose:true
}

const serverOptions = null; // 按操作系统自动分配端口


const connect = async function(redisConfig, sshConfig = undefined) {
    // 请注意，转发选项在这里没有定义srcAddr和srcPort。 使用服务器配置。
    const forwardOptions = { dstAddr: '127.0.0.1', dstPort: DEFAULT_PORT }


    return new Promise(async (resolve, reject) => {
        const url = new URL(redisConfig.url || "redis://")
        if (!url.host) {
            url.host = redisConfig.host
            url.port = redisConfig.port || (redisConfig.port = DEFAULT_PORT).toString()

            if (redisConfig.password)
                url.password = redisConfig.password

            if (redisConfig.username)
                url.username = redisConfig.username // || (redisConfig.port = DEFAULT_USER_NAME)
        }

        console.log(sshConfig)
        let server, client;
        if (sshConfig && "host" in sshConfig) {
            if (forwardOptions.dstPort != url.port)
                forwardOptions.dstPort = parseInt(url.port)

            try {
                [server, client] = await createTunnel(tunnelOptions, serverOptions, sshConfig, forwardOptions);
            } catch (e) {
                logger.error('redis-ss.createTunnel.error', e)
                return reject(e);
            }

            url.port = server.address().port
        } else {
            server = {close:() => {}}
            client = {destroy:() => Promise.resolve()}
        }

        redisConfig.url = url.toString()
        // redisConfig.commandOptions = {
        //     typeMapping: {
        //         [RESP_TYPES.BLOB_STRING]: Buffer
        //     }
        // }
        const redis = createClient({...redisConfig})

        try {
            logger.debug('开始连接 redis server', redisConfig.url)
            await redis.connect()

        } catch (e) {
            logger.error('redis-ss.connect.error', e)
            console.log('redis-ss.connect.error', e)

            if (server) server.close()
            if (client) await client.destroy()

            return reject(e)
        }


        redis.destroyAll = async function() {
            try {
                await redis.disconnect()

                if (server) server.close()
                if (client) await client.destroy()
            } catch (e) {
                logger.warn('redis-ss.destroyAll.error', e)
                console.error(e)
            }
        }

        resolve(redis)
    })

}

const connectAndDbs = async function(listener, redisConfig, sshConfig = undefined) {
    const redis = await connect(redisConfig, sshConfig)

    const info = await redis.info("Keyspace")

    redis.destroyAll()

    const keyspaces = info.toString().split("\n").filter(s => s.startsWith("db"))
    if (!keyspaces || keyspaces.length == 0) {
        listener()
        return;
    }
    logger.info(keyspaces)

    let prevDb = 0, rds = []
    for (const s of keyspaces) {
        const [strDb, strCount] = s.match(/(\d+)/g).slice(0, 2)
        const db = parseInt(strDb), count = parseInt(strCount)

        if ((db - prevDb) > 1) {
            for (let l = prevDb + 1; l < db; l++)
                rds[l] = {index: l, count: 0, children: []}
        }

        rds[db] = {index: db, count, children: []}

        prevDb = db;
    }

    if ((DEFAULT_DB_NUMBER - prevDb) > 1) {
        for (let l = prevDb + 1; l < DEFAULT_DB_NUMBER; l++)
            rds[l] = {index: l, count: 0, children: []}
    }

    listener('redis-db', rds)
    listener()
}

const connectAndKeyspace = async function(listener, redisConfig, sshConfig = undefined) {

    try {
        const redis = await connect(redisConfig, sshConfig)

        const
            scanMatch = redisConfig.defaultFilter || "*",
            separator = redisConfig.namespaceSeparator || ":",
            scanCount = redisConfig.scanUpperLimit || 1000,
            findGroup = (n, g) => {
                if (g?.name === n)
                    return g

                const m = g.children.filter(x => x.name === n)
                if (m && m.length > 0)
                    return m[0].count = m[0].count + 1, m[0];

                const i = g.children.push({name: n, count: 1, children: []})
                g.count = g.children.length
                return g.children[i - 1]
            }

        let data = {index: redisConfig.database, count: 0, children: []}
        for await (const keyList of redis.scanIterator({MATCH: scanMatch, COUNT: scanCount})) {
            keyList.sort((a, b) => a.localeCompare(b, 'en-US', {numeric: true}))
            data.count = keyList.length + data.count

            for (const key of keyList) {
                const type = await redis.type(key)

                const groups = key.split(separator)
                let newData = data, k = 0
                for (; k < groups.length - 1; k++) {
                    newData = findGroup(groups[k], newData)
                    newData.full = groups.slice(0, k + 1).join(separator) + separator
                }

                try {
                    if ("type" in newData && !newData.children)
                        newData.children = [];

                    newData.children.push({
                        count: 1,
                        name: groups[k],
                        full: key,
                        type//, size, ttl
                    })

                    listener("keyspace", data)
                } catch (e) {
                    console.error(newData, e)
                }

            }

        }

        listener()
        redis.destroyAll()

    } catch (e) {
        throw e
    }

}

module.exports = {
    DEFAULT_PORT, DEFAULT_USER_NAME, DEFAULT_DB_NUMBER,
    connect, connectAndDbs, connectAndKeyspace
}
