const logger = require("electron-log/main")
const path = require("path");
const utils = require("./utils")
const date = new Date(), dateString = [date.getFullYear(), date.getMonth() + 1, date.getDate()].join("-")

logger.initialize()

// 设置日志文件位置
logger.transports.file.level = process.env.NODE_ENV === "test" ? "debug" : 'info'; // 设置日志级别
logger.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}] [{level}] {text}'; // 设置日志格式
logger.transports.file.resolvePathFn = () => path.join(utils.ROOT, 'logs', `app.${dateString}.log`); // 设置日志文件位置

logger.info('env.__dirname', __dirname)
logger.info('env.__filename', __filename)
logger.info('env.ROOT', utils.ROOT)

module.exports = logger
