const {findServerById} = require("../handles/servers");
const Redis = require("../lib/redis-ssh");
const {TYPES, DEFAULT_DB_NUMBER} = require("../lib/redis-ssh");


async function main() {
    const server = findServerById("faa0814a-1e39-4db5-96e7-908822774d10")
    const redis = await Redis.buildConnect(server)

    const info = await redis.info("Keyspace")

    const dbs = [], keyspaces = info.toString().split("\n").filter(s => s.startsWith("db"))
    for(let i = 0; i < DEFAULT_DB_NUMBER; i++) dbs.push({index: i, count: 0, children: []})
    for (const s of keyspaces) {
        const [strDb, strCount] = s.match(/(\d+)/g).slice(0, 2)
        const db = parseInt(strDb), count = parseInt(strCount)
        dbs[db] = {index: db, count, children: []}
    }

    console.log(JSON.stringify(dbs, null, 4))
    redis.destroyAll()
}


main().catch(er => {
    console.log('\n\nMain.Error:')
    console.error(er.innerError ? er.innerError : er);
    process.exitCode = 1;
})
