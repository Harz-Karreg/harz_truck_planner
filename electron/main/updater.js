const { app, dialog, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;
const INITIAL_CHECK_DELAY_MS = 10 * 1000;

let currentCheck = null;

async function checkForUpdates() {
  if (process.platform !== "win32") {
    return { status: "unsupported-platform", currentVersion: app.getVersion() };
  }
  if (!app.isPackaged) {
    return { status: "development", currentVersion: app.getVersion() };
  }
  if (currentCheck) return currentCheck;

  currentCheck = autoUpdater.checkForUpdates()
    .then((result) => ({
      status: result?.updateInfo?.version && result.updateInfo.version !== app.getVersion() ? "available" : "up-to-date",
      currentVersion: app.getVersion(),
      availableVersion: result?.updateInfo?.version || app.getVersion()
    }))
    .catch((error) => {
    console.error("Echec de la verification des mises a jour :", error.message);
      return { status: "error", currentVersion: app.getVersion(), message: error.message };
    })
    .finally(() => {
      currentCheck = null;
    });

  return currentCheck;
}

function setupAutoUpdates(getMainWindow) {
  ipcMain.removeHandler("updates:check");
  ipcMain.handle("updates:check", () => checkForUpdates());

  if (process.platform !== "win32") {
    console.info("Mises a jour automatiques gerees separement sur cette plateforme.");
    return;
  }

  if (!app.isPackaged) {
    console.info("Mises a jour automatiques desactivees en mode developpement.");
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("error", (error) => {
    console.error("Erreur de mise a jour :", error.message);
  });

  autoUpdater.on("update-downloaded", async (info) => {
    const options = {
      type: "info",
      title: "Mise à jour HARZ KARREG",
      message: `La version ${info.version} est prête à être installée.`,
      detail: "Redémarrez maintenant pour appliquer la mise à jour, ou choisissez Plus tard pour l’installer à la fermeture de l’application.",
      buttons: ["Redémarrer maintenant", "Plus tard"],
      defaultId: 0,
      cancelId: 1,
      noLink: true
    };
    const owner = getMainWindow();
    const result = owner
      ? await dialog.showMessageBox(owner, options)
      : await dialog.showMessageBox(options);

    if (result.response === 0) autoUpdater.quitAndInstall(false, true);
  });

  const initialCheck = setTimeout(() => void checkForUpdates(), INITIAL_CHECK_DELAY_MS);
  const recurringCheck = setInterval(() => void checkForUpdates(), CHECK_INTERVAL_MS);
  initialCheck.unref();
  recurringCheck.unref();
}

module.exports = { setupAutoUpdates };
