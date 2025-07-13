const svr = require("./servers")



const handleHash = async (req, res) => {
    const {id,database,op,name} = req.params, D = req.body
    const server = svr.findServerById(id)

    if (!server)
        return res.json({code: 404})

    server.database = database
    const redis = await svr.redisConnection(server)

    if (op === "set")
        await redis.hSet(D.key, D.field, D.value)

    if (op === "del")
        await redis.hDel(D.key, D.field)

    if (op === "rename") {
        let {key, oldField, newField, force} = D
        if (force !== 1) {
            const exists = redis.hExists(key, newField)
            if (exists == true)
                return res.json({code:505, exists})

            force = 1
        }

        if (force === 1) {
            const val = D.value || await redis.hGet(key, oldField)
            await redis.hSet(key, newField, val)
            await redis.hDel(key, oldField)
        }

    }


    if (op === "get") {
        res.setEventStreamHeader(req)
        const ttl = await redis.ttl(name)
        const info = {full:name,ttl}, ar = name.split(server?.advancedSettings?.namespaceSeparator || ":")
        info.name = ar.reverse()[0];

        info.size = await redis.hLen(name)
        res.stream("info", info)

        let cursor = '0'
        do {
            const scan = await redis.hScan(name, cursor, {COUNT:10})
            cursor = scan.cursor
            res.stream(scan.entries)
        } while (cursor !== '0')

        return res.stream()
    }

    return res.json({})
}


module.exports = {
    handleHash
}
