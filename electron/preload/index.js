const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("harzKarregDesktop", {
  runtime: Object.freeze({
    electron: process.versions.electron,
    platform: process.platform
  })
});
