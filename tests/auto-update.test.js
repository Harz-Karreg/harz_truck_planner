const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const packageJson = require(path.join(root, "package.json"));
const updater = fs.readFileSync(path.join(root, "electron", "main", "updater.js"), "utf8");
const preload = fs.readFileSync(path.join(root, "electron", "preload", "index.js"), "utf8");
const settings = fs.readFileSync(path.join(root, "harz-karreg-webapp", "js", "settings.js"), "utf8");
const workflow = fs.readFileSync(path.join(root, ".github", "workflows", "release-windows.yml"), "utf8");

test("les builds utilisent le dépôt public de mises à jour", () => {
  const provider = packageJson.build.publish[0];

  assert.equal(provider.provider, "github");
  assert.equal(provider.owner, "Harz-Karreg");
  assert.equal(provider.repo, "harz_truck_planner-releases");
  assert.equal(packageJson.dependencies["electron-updater"], "6.8.9");
});

test("les mises à jour sont désactivées en développement et proposées après téléchargement", () => {
  assert.match(updater, /if \(!app\.isPackaged\)/);
  assert.match(updater, /autoUpdater\.autoDownload = true/);
  assert.match(updater, /update-downloaded/);
  assert.match(updater, /quitAndInstall/);
});

test("le workflow publie uniquement avec un secret GitHub Actions", () => {
  assert.match(workflow, /secrets\.RELEASES_TOKEN/);
  assert.match(workflow, /Harz-Karreg\/harz_truck_planner-releases/);
  assert.doesNotMatch(workflow, /ghp_[A-Za-z0-9]+/);
});

test("le bouton Parametres utilise un canal IPC limite a la verification", () => {
  assert.match(updater, /ipcMain\.handle\("updates:check"/);
  assert.match(preload, /ipcRenderer\.invoke\("updates:check"\)/);
  assert.match(settings, /data-check-updates/);
  assert.match(settings, /Les commits du dépôt source ne sont jamais installés directement/);
});
