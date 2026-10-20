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

test("Companion est presente comme une structure en lecture seule sans donnees", () => {
  const companion = read(path.join("companion", "index.html"));

  assert.match(companion, /lecture seule/i);
  assert.match(companion, /Aucune donnée métier fictive/i);
  assert.doesNotMatch(companion, /localStorage/);
});

test("Driver est presente comme une structure soumise aux permissions", () => {
  const driver = read(path.join("driver", "index.html"));

  assert.match(driver, /autoris/i);
  assert.match(driver, /Aucune donnée métier fictive/i);
  assert.doesNotMatch(driver, /localStorage/);
});
