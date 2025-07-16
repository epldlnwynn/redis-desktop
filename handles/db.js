const svr = require("./servers");
const { connectAndKeyspace, connectAndDbs } = require("../lib/redis-ssh");


const handleDb = async (req,res) => {
    const {id,database} = req.params
    const server = svr.findServerById(id)

    if (!server)
        return res.json({code: 404})


    server.database = database
    const {redisConfig, sshConfig} = svr.buildRedisConnection(server)

    res.setEventStreamHeader(req)

    let index = 1;
    const listener = (type, data) => {
        if (!type && !data) {
            res.stream()
            return;
        }

        res.stream(index, type, data)

        index = index + 1;
    }

    if (database != undefined) {
        await connectAndKeyspace(listener, redisConfig, sshConfig)
        return;
    }

    await connectAndDbs(listener, redisConfig, sshConfig)
}

const handleInvoke = async (req, res) => {
    const {id,database,method} = req.params
    const server = svr.findServerById(id)

    if (!server)
        return res.json({code: 404})

    server.database = database
    const redis = await svr.redisConnection(server)
    const D = req.body,R = {}

    if (method === "expire")
        await redis.expire(D.key, D.value, D.mode)

    if (method === "delete")
        await redis.del(D.key)

    if (method === "rename") {
        let {oldKey,key,force} = D

        if (force !== 1) {
            const exists = await redis.exists(key)
            if (exists == true)
                return res.json({code:505, exists})

            force = 1
        }

        if (force === 1) {
            const ttl = await redis.ttl(oldKey)
            const dump = await redis.get(oldKey)

            await redis.set(key, dump)
            await redis.del(oldKey)
            if (ttl > 0) await redis.expire(key, ttl)
        }

    }

    res.json(R)
}


module.exports = {
    handleDb, handleInvoke
}

