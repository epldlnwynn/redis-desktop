const svr = require("./servers");
const { DEFAULT_DB_NUMBER, TYPES} = require("../lib/redis-ssh");
const Redis = require("../lib/redis-ssh");
const logger = require("../lib/logger");



const findDb = async function(redis,res) {
    const info = await redis.info("Keyspace")

    const dbs = [], keyspaces = info.toString().split("\n").filter(s => s.startsWith("db"))
    for(let i = 0; i < DEFAULT_DB_NUMBER; i++)
        dbs.push({index: i, count: 0, children: []})

    logger.info(keyspaces)

    if (keyspaces && keyspaces.length > 0) {
        for (const s of keyspaces) {
            const [strDb, strCount] = s.match(/(\d+)/g).slice(0, 2)
            const db = parseInt(strDb), count = parseInt(strCount)
            dbs[db] = {index: db, count, children: []}
        }
    }

    res.stream('redis-db', dbs)
    res.stream()
}

const findKeys = async function(server, redis, filter, l) {
    const
        scanMatch = filter || server?.advancedSettings?.defaultFilter || "*",
        separator = server?.advancedSettings?.namespaceSeparator || ":",
        scanCount = server?.advancedSettings?.scanUpperLimit || 1000,
        findGroup = (n, g) => {
            if (g?.name === n)
                return g

            const m = g.children.filter(x => x.name === n)
            if (m && m.length > 0)
                return m[0].count = m[0].count + 1, m[0];

            const i = g.children.push({name: n, count: 1, children: []})
            g.count = g.children.length
            return g.children[i - 1]
        },
        scan = async (data, TYPE) => {
            for await (const keyList of redis.scanIterator({TYPE, MATCH:scanMatch, COUNT:scanCount})) {
                keyList.sort((a, b) => a.localeCompare(b, 'en-US', {numeric: true}))
                data.count = keyList.length + data.count

                for (const key of keyList) {
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
                            type: TYPE || "none"
                        })

                    } catch (e) {
                        console.error(newData, e)
                    }

                }
                l("keyspace", data)

            }
        }

    let data = {index: server.database, count:0, children:[]}

    if (server.majorVersion >= 6.0) {
        for (const type of TYPES)
            await scan(data, type)
    } else {
        await scan(data)
    }
    l()

}

const handleDb = async (req,res) => {
    const {id,database} = req.params, {filter} = req.query
    const server = svr.findServerById(id)

    if (!server)
        return res.json({code: 404})


    server.database = database
    const redis = await Redis.buildConnect(server)

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
        await findKeys(server, redis, filter, listener)
        return;
    }

    await findDb(redis, res)
}

const handleInvoke = async (req, res) => {
    const {id,database,method} = req.params
    const server = svr.findServerById(id)

    if (!server)
        return res.json({code: 404})

    server.database = database
    const redis = await svr.redisConnection(server)
    const D = req.body,R = {}

    if (method === "type") {
        const data = await redis.type(D.key)
        return res.json({data})
    }

    if (method === "expire")
        await redis.expire(D.key, D.value, D.mode)

    if (method === "delete") {
        if (D?.isGroup == true) {
            const keys = await redis.keys(D.key.endsWith("*") ? D.key : (D.key + '*'))
            for (const k of keys)
                await redis.del(k)
        } else {
            await redis.del(D.key)
        }
    }

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

