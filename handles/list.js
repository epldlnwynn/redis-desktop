const svr = require("./servers");


const handleList = async (req,res) => {
    const {id,database,op,name} = req.params, D = req.body
    const server = svr.findServerById(id)

    if (!server)
        return res.json({code: 404})

    server.database = database
    const redis = await svr.redisConnection(server)

    if (op === "lpush")
        await redis.lPush(D.key, D.value)

    if (op === "rpush")
        await redis.rPush(D.key, D.value)

    if (op === "set")
        await redis.lSet(D.key, D.index, D.value)

    if (op === "del") {
        const val = "---VALUE_REMOVED_BY_RESP_APP---"
        await redis.lSet(D.key, D.index, val)
        await redis.lRem(D.key, D.count || 0, val)
    }


    if (op === "get") {
        res.setEventStreamHeader(req)
        const ttl = await redis.ttl(name)
        const info = {full:name,ttl}, ar = name.split(server?.advancedSettings?.namespaceSeparator || ":")
        info.name = ar.reverse()[0];

        info.count = await redis.lLen(name)
        res.stream("info", info)

        let offset = 0;
        while (offset < info.count) {
            const list = await redis.lRange(name, offset, offset += 9)
            res.stream(list)
            ++offset
        }

        return res.stream()
    }


    res.json({})
}



module.exports = {
    handleList
}
