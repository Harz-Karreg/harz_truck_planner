const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const renderer = path.join(root, "src", "renderer");

function read(relativePath) {
  return fs.readFileSync(path.join(renderer, relativePath), "utf8");
}

test("l'ecran de demarrage separe les trois modes", () => {
  const startup = read(path.join("startup", "index.html"));

  assert.match(startup, /data-mode="admin"/);
  assert.match(startup, /data-mode="companion"/);
  assert.match(startup, /data-mode="driver"/);
  assert.match(startup, /harz-karreg-webapp\/index\.html/);
});

test("Companion est une vue de planning en lecture seule", () => {
  const companion = read(path.join("companion", "index.html"));

  assert.match(companion, /lecture seule/i);
  assert.match(companion, /planning publié/i);
  assert.doesNotMatch(companion, /localStorage/);
});

test("le logo ramene au choix du mode depuis Admin, Companion et Driver", () => {
  const companion = read(path.join("companion", "index.html"));
  const driver = read(path.join("driver", "index.html"));
  const adminUi = fs.readFileSync(path.join(root, "harz-karreg-webapp", "js", "ui.js"), "utf8");

  assert.match(companion, /href="\.\.\/startup\/index\.html"[^>]+title="Changer de mode"/);
  assert.match(driver, /class="mode-return-logo"[^>]+href="\.\.\/startup\/index\.html"[^>]+title="Changer de mode"/);
  assert.match(adminUi, /href="\.\.\/src\/renderer\/startup\/index\.html"[^>]+title="Changer de mode"/);
});

test("Driver est presente comme une structure soumise aux permissions", () => {
  const driver = read(path.join("driver", "index.html"));

  assert.match(driver, /autoris/i);
  assert.match(driver, /Aucune donnée métier fictive/i);
  assert.doesNotMatch(driver, /localStorage/);
});
