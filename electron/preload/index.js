const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("harzKarregDesktop", {
  runtime: Object.freeze({
    electron: process.versions.electron,
    platform: process.platform
  }),
  updates: Object.freeze({
    check: () => ipcRenderer.invoke("updates:check")
  })
});
