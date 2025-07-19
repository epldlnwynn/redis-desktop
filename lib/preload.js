const {ipcRenderer, contextBridge} = require('electron')

contextBridge.exposeInMainWorld('bridgeApi', {
    prompt(label, _default, title) {
        return ipcRenderer.invoke('prompt', label, _default, title)
    }
})
