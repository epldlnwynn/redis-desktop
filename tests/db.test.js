const {findServerById} = require("../handles/servers");
const Redis = require("../lib/redis-ssh");
const {TYPES, DEFAULT_DB_NUMBER} = require("../lib/redis-ssh");





async function main() {
    const server = findServerById("faa0814a-1e39-4db5-96e7-908822774d10")
    const redis = await Redis.buildConnect(server)

    for await (const keyList of redis.scanIterator({MATCH:"account:info:*",COUNT:1000})) {
        console.log(keyList)
    }

    redis.destroyAll()
}


main().catch(er => {
    console.log('\n\nMain.Error:')
    console.error(er.innerError ? er.innerError : er);
    process.exitCode = 1;
})
