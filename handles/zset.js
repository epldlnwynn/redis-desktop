const svr = require("./servers");


const handleZSet = async (req,res) => {
    const {id,database,op,name} = req.params, D = req.body
    const server = svr.findServerById(id)

    if (!server)
        return res.json({code: 404})

    server.database = database
    const redis = await svr.redisConnection(server)


    if (op === "add") {
        const {value,score} = D
        await redis.zAdd(D.key, {value,score})
    }

    if (op === "set") {
        const {value,score} = D
        await redis.zAdd(D.key, {value,score},{XX:true})
    }

    if (op === "del")
        await redis.zRem(D.key, D.value)

    if (op === "rename") {
        const {key,oldValue,newValue,score} = D
        const value = newValue || await redis.zScore(key, oldValue)
        await redis.zRem(key, oldValue)
        await redis.zAdd(key, {value, score})
    }

    if (op === "get") {
        res.setEventStreamHeader(req)
        const ttl = await redis.ttl(name)
        const info = {full:name,ttl}, ar = name.split(server?.advancedSettings?.namespaceSeparator || ":")
        info.name = ar.reverse()[0];
        info.count = await redis.zCard(name)
        res.stream("info", info)

        const list = []
        const zRevRange = await redis.sendCommand(["ZREVRANGE", name, "0", info.count.toString(), "WITHSCORES"])
        for (let i = 0; i < zRevRange.length; i += 2) {
            list.push({value:zRevRange[i], score:zRevRange[i + 1]})
        }
        res.stream(list)

        return res.stream()
    }

    res.json({})

}


module.exports = {
    handleZSet
}
