const fs = require("fs")
const path = require("path")
const pk = require("../package.json")
const ROOT = path.join(process.env.HOME, "." +  pk.name)
const ROOT_CONTENT = path.join(ROOT, "content")


const PRODUCT_NAME = pk.productName, NAME = pk.name


const uuid = function (format) {
    let d = new Date().getTime(), tmp = format || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
    return tmp.replace(/[xy]/g, function (c) {
        let r = (d + Math.random() * 16) % 16 | 0;
        d = Math.floor(d / 16);
        return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    })
};

const readFileToJSON = function (file, defaultValue = {}) {
    const root = file.startsWith("/") ? file : path.join(ROOT, file)
    const dir = path.dirname(root)

    if (!fs.existsSync(dir))
        return defaultValue

    const data = fs.readFileSync(root, {encoding: "utf-8", flag:'r'})
    if (!data)
        return defaultValue

    return JSON.parse(data)
}

const writeFile = function (file, data, append = false) {
    const root = file.startsWith("/") ? file : path.join(ROOT, file)
    const dir = path.dirname(root)

    if (!fs.existsSync(dir))
        fs.mkdirSync(dir, {recursive:true})

    const content = typeof(data) === "string" ? data : JSON.stringify(data)
    if (append) {
        fs.appendFileSync(root, content, {encoding: "utf-8", flag: 'w'})
    } else {
        fs.writeFileSync(root, content, {encoding: 'utf-8', flag: 'w'})
    }
}

const windowState = function(state = undefined) {
    const file = path.join(ROOT_CONTENT, "window-state.json")
    if (state) {
        writeFile(file, state)
        return state
    }

    const ws = readFileToJSON(file, {})
    return ws
}

module.exports = {
    ROOT, PRODUCT_NAME, NAME,
    windowState, uuid, writeFile, readFileToJSON
}
