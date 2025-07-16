const { app, ipcMain, BrowserWindow, Menu, screen, shell } = require("electron");
const logger = require("./lib/logger")
const server = require("./server")
const { windowState } = require("./lib/utils");



let mainWin;

app.commandLine.appendSwitch('disable-web-security');
const createWindow = (url) => {
    const display = screen.getPrimaryDisplay();
    logger.info(`${app.name} screen(width=${display.workAreaSize.width}, height=${display.workAreaSize.height})`)

    const width = 1400, height = 800
    const state = Object.assign({}, {width, height, minWidth: width, minHeight: height}, windowState())

    mainWin = new BrowserWindow({
        ...state,
        autoHideMenuBar: true,
        webPreferences: {
            devTools: app.isPackaged ? false : true,
            nodeIntegration: false, // like here
            nodeIntegrationInWorker: false,
            webSecurity: true,
            contextIsolation: true,
        }
    });


    const menu = Menu.buildFromTemplate([Menu.getApplicationMenu().items[0]]);
    Menu.setApplicationMenu(menu);
    mainWin.setMenu(null)


    ipcMain.on('window-close', function () {
        mainWin.hide();
    })
    ipcMain.on('window-minimize', function () {
        mainWin.minimize();
    })
    ipcMain.on('window-maximizeOrRestore', function () {
        if (mainWin.isMaximized()) {
            mainWin.unmaximize();
            return
        }
        mainWin.maximize();
    })

    mainWin.on("resized", () => {
        const [width, height] = mainWin.getSize()
        logger.info("resize.resized", width, height)
        windowState({width, height})
    })

    mainWin.loadURL(url)
};


app.whenReady().then(async () => {
    await server.startServer()
    const url = server.getUrl() + "?_v=" + Math.random()

    createWindow(url);

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow(url);
        }
    });
});


app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});


app.on("web-contents-created", (e, webContents) => {
    webContents.setWindowOpenHandler(info => {
        logger.info("web-contents-created", info)
        shell.openExternal(info.url)
        return {action: "dey"}
    })

})
