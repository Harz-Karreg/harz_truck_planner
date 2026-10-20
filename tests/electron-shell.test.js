const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const packageJson = require(path.join(root, "package.json"));
const mainSource = fs.readFileSync(path.join(root, "electron", "main", "main.js"), "utf8");
const preloadSource = fs.readFileSync(path.join(root, "electron", "preload", "index.js"), "utf8");

test("les scripts Electron et le packaging Windows sont configures", () => {
  assert.equal(packageJson.main, "electron/main/main.js");
  assert.equal(packageJson.scripts.start, "electron .");
  assert.match(packageJson.scripts["dist:win"], /electron-builder --win nsis/);
  assert.equal(packageJson.build.win.target[0].target, "nsis");
});

test("la fenetre Electron isole le renderer", () => {
  assert.match(mainSource, /contextIsolation:\s*true/);
  assert.match(mainSource, /nodeIntegration:\s*false/);
  assert.match(mainSource, /sandbox:\s*true/);
  assert.match(mainSource, /webSecurity:\s*true/);
  assert.match(mainSource, /setWindowOpenHandler\(\(\) => \(\{ action: "deny" \}\)\)/);
});

test("le preload n'expose qu'une API de runtime en lecture seule", () => {
  assert.match(preloadSource, /contextBridge\.exposeInMainWorld/);
  assert.match(preloadSource, /Object\.freeze/);
  assert.doesNotMatch(preloadSource, /ipcRenderer/);
});
