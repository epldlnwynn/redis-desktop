const svr = require("./servers");


const handleValue = async (req,res) => {
    const {id,database,op,name} = req.params, D = req.body
    const server = svr.findServerById(id)

    if (!server)
        return res.json({code: 404})

    server.database = database
    const redis = await svr.redisConnection(server)


    if (op === "set" || op === "add")
        await redis.set(D.key, D.value)

    if (op === "del")
        await redis.del(D.key)

    if (op === "get" && name) {
        res.setEventStreamHeader(req)

        const ttl = await redis.ttl(name)
        const info = {full:name,ttl}, ar = name.split(server?.advancedSettings?.namespaceSeparator || ":")
        info.name = ar.reverse()[0];
        info.size = await redis.strLen(name)
        res.stream("info", info)

        const val = await redis.get(name)
        res.stream(val)

        return res.stream()
    }

    res.json({})
}

module.exports = { handleValue }
