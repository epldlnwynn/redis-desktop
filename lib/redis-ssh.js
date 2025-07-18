const {createTunnel} = require("tunnel-ssh");
const {createClient, RESP_TYPES } = require("redis");
const logger = require("./logger");

const DEFAULT_PORT = 6379
const DEFAULT_USER_NAME = "default"
const DEFAULT_DB_NUMBER = 16
const TYPES = ["string","hash","list","set","zset"]

const tunnelOptions = {
    autoClose:true
}

const serverOptions = null; // 按操作系统自动分配端口


const connect = async function(redisConfig, sshConfig = undefined) {
    // 请注意，转发选项在这里没有定义srcAddr和srcPort。 使用服务器配置。
    const forwardOptions = { dstAddr: '127.0.0.1', dstPort: DEFAULT_PORT }


    return new Promise(async (resolve, reject) => {
        const url = new URL(redisConfig.url || "redis://")
        if (!url.host) {
            url.host = redisConfig.host
            url.port = redisConfig.port || (redisConfig.port = DEFAULT_PORT).toString()

            if (redisConfig.password)
                url.password = redisConfig.password

            if (redisConfig.username)
                url.username = redisConfig.username // || (redisConfig.port = DEFAULT_USER_NAME)
        }

        console.log(sshConfig)
        let server, client;
        if (sshConfig && "host" in sshConfig) {
            if (forwardOptions.dstPort != url.port)
                forwardOptions.dstPort = parseInt(url.port)

            try {
                [server, client] = await createTunnel(tunnelOptions, serverOptions, sshConfig, forwardOptions);
            } catch (e) {
                logger.error('redis-ss.createTunnel.error', e)
                return reject(e);
            }

            url.port = server.address().port
        } else {
            server = {close:() => {}}
            client = {destroy:() => Promise.resolve()}
        }

        redisConfig.url = url.toString()
        // redisConfig.commandOptions = {
        //     typeMapping: {
        //         [RESP_TYPES.BLOB_STRING]: Buffer
        //     }
        // }
        const redis = createClient({...redisConfig})

        try {
            logger.debug('开始连接 redis server', redisConfig.url)
            await redis.connect()

        } catch (e) {
            logger.error('redis-ss.connect.error', e)
            console.log('redis-ss.connect.error', e)

            if (server) server.close()
            if (client) await client.destroy()

            return reject(e)
        }


        redis.destroyAll = async function() {
            try {
                await redis.disconnect()

                if (server) server.close()
                if (client) await client.destroy()
            } catch (e) {
                logger.warn('redis-ss.destroyAll.error', e)
                console.error(e)
            }
        }

        resolve(redis)
    })

}
const buildConnect = async function(server) {
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
    return connect(redisConfig, sshConfig)
}

module.exports = {
    TYPES,
    DEFAULT_PORT, DEFAULT_USER_NAME, DEFAULT_DB_NUMBER,
    connect, buildConnect
}
