const logger = require("../lib/logger");
const Redis = require("../lib/redis-ssh");
const { readFileToJSON, uuid, writeFile } = require("../lib/utils");


const SERVER_FILE = "assets/server-list.json";


function buildRedisConnection(server) {
    const {host,port,password,username, database, security, advancedSettings} = server
    const {type,tls,tunnel} = security || {}
    const {connectionTimeout,defaultFilter,namespaceSeparator,scanUpperLimit} = advancedSettings || {}

    const redisConfig = {
        host,port,password,username, database,
        defaultFilter,namespaceSeparator,scanUpperLimit,
    }
    const sshConfig = {}

    if (type && type === "tls" && tls) {
        redisConfig.socket = {
            tls: true,
            connectTimeout: connectionTimeout || 60
        }
    }

    if (type && type === "tunnel" && tunnel) {
        sshConfig.host = tunnel.host
        sshConfig.port = tunnel.port || 22
        sshConfig.username = tunnel.username
        sshConfig.password = tunnel.password
        sshConfig.privateKey = tunnel.privateKey
    }

    logger.debug('redis.config ', server.id, redisConfig, sshConfig)
    return {redisConfig, sshConfig}
}

function redisConnection(server) {
    const {redisConfig, sshConfig} = buildRedisConnection(server)
    return Redis.connect(redisConfig, sshConfig)
}

const handleTestConnection = async (req, res) => {
    const server = req.body
    const redis = await redisConnection(server)

    const info = await redis.info("Server");
    logger.debug("Server info ", info)

    const version = info.toString().split("\n")[1].replace("redis_version:","").trim();
    logger.debug("server redis version ", version)

    res.json({
        message: "OK",
        data: {
            state: true,
            version
        }
    })
}

const handleSaveConnection = (req, res) => {
    const server = req.body

    const serverList = readFileToJSON(SERVER_FILE, [])
    server.id = uuid()
    serverList.unshift(server)
    writeFile(SERVER_FILE, serverList)

    res.json({message: "OK", data: server.id})
}

const handleConnectionList = (req,res) => {
    const serverList = readFileToJSON(SERVER_FILE, [])
    res.json({data: serverList})
}

const findServerById = (id) => {
    const [server] = readFileToJSON(SERVER_FILE, []).filter(s => s.id === id)
    return server
}

module.exports = {
    buildRedisConnection, redisConnection, findServerById,
    handleTestConnection, handleSaveConnection, handleConnectionList
}
