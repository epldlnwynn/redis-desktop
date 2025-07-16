const svr = require("./servers");


const handleSSet = async (req,res) => {
    const {id,database,op,name} = req.params, D = req.body
    const server = svr.findServerById(id)

    if (!server)
        return res.json({code: 404})

    server.database = database
    const redis = await svr.redisConnection(server)

    if (op === "add")
        await redis.sAdd(D.key, D.value)

    if (op === "set") {
        await redis.sAdd(D.key, D.value)
        await redis.sRem(D.key, D.oldValue)
    }

    if (op === "del")
        await redis.sRem(D.key, D.value)

    if (op === "get") {
        res.setEventStreamHeader(req)
        const ttl = await redis.ttl(name)
        const info = {full:name,ttl}, ar = name.split(server?.advancedSettings?.namespaceSeparator || ":")
        info.name = ar.reverse()[0];

        info.count = await redis.sCard(name)
        res.stream("info", info)

        for await (const members of redis.sScanIterator(name, {COUNT: 20})) {
            res.stream(members)
        }

        return res.stream()
    }

    res.json({})
}



module.exports = {
    handleSSet
}
