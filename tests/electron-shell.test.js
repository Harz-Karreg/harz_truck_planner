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

test("le lancement direct Companion et le packaging Raspberry Pi sont configures", () => {
  assert.equal(packageJson.scripts["start:companion"], "electron . --companion");
  assert.match(packageJson.scripts["dist:pi"], /electron-builder --linux deb --arm64/);
  assert.equal(packageJson.build.linux.target[0].target, "deb");
  assert.deepEqual(packageJson.build.linux.target[0].arch, ["arm64"]);
  assert.equal(packageJson.build.linux.maintainer, "HARZ KARREG");
  assert.match(mainSource, /process\.argv\.includes\(flag\)/);
  assert.match(mainSource, /launchMode === "companion" \? companionPage : startupPage/);
  assert.match(mainSource, /process\.platform === "linux" \|\| hasCommandLineFlag\("--kiosk"\)/);
});

test("la fenetre Electron isole le renderer", () => {
  assert.match(mainSource, /contextIsolation:\s*true/);
  assert.match(mainSource, /nodeIntegration:\s*false/);
  assert.match(mainSource, /sandbox:\s*true/);
  assert.match(mainSource, /webSecurity:\s*true/);
  assert.match(mainSource, /setWindowOpenHandler\(\(\) => \(\{ action: "deny" \}\)\)/);
});

test("le preload expose uniquement le runtime et la verification de mise a jour", () => {
  assert.match(preloadSource, /contextBridge\.exposeInMainWorld/);
  assert.match(preloadSource, /Object\.freeze/);
  assert.match(preloadSource, /ipcRenderer\.invoke\("updates:check"\)/);
  assert.doesNotMatch(preloadSource, /ipcRenderer\.(send|sendSync|on|once)/);
});
