const { app, BrowserWindow } = require("electron");
const path = require("node:path");
const { fileURLToPath } = require("node:url");
const { setupAutoUpdates } = require("./updater");

const applicationRoot = path.resolve(__dirname, "..", "..");
const startupPage = path.join(applicationRoot, "src", "renderer", "startup", "index.html");
const companionPage = path.join(applicationRoot, "src", "renderer", "companion", "index.html");
const preloadScript = path.join(applicationRoot, "electron", "preload", "index.js");

let mainWindow = null;

function hasCommandLineFlag(flag) {
  return process.argv.includes(flag);
}

function resolveLaunchMode() {
  return hasCommandLineFlag("--companion") ? "companion" : "startup";
}

function shouldUseKiosk(mode) {
  return mode === "companion" && (process.platform === "linux" || hasCommandLineFlag("--kiosk"));
}

function isInsideApplication(targetPath) {
  const relative = path.relative(applicationRoot, targetPath);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function isAllowedNavigation(targetUrl) {
  try {
    if (!targetUrl.startsWith("file:")) return false;
    return isInsideApplication(fileURLToPath(targetUrl));
  } catch {
    return false;
  }
}

function createMainWindow() {
  const launchMode = resolveLaunchMode();
  const kiosk = shouldUseKiosk(launchMode);

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: "#090b10",
    show: false,
    autoHideMenuBar: true,
    title: "HARZ KARREG",
    kiosk,
    fullscreen: kiosk,
    webPreferences: {
      preload: preloadScript,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: false
    }
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, targetUrl) => {
    if (!isAllowedNavigation(targetUrl)) event.preventDefault();
  });
  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.loadFile(launchMode === "companion" ? companionPage : startupPage);
}

const hasApplicationLock = app.requestSingleInstanceLock();

if (!hasApplicationLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    app.setAppUserModelId("com.harzkarreg.planner");
    createMainWindow();
    setupAutoUpdates(() => mainWindow);
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
