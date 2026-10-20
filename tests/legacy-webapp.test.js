const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const webapp = path.join(root, "harz-karreg-webapp");

const legacyPages = [
  "index.html",
  "planning.html",
  "conducteurs.html",
  "camions.html",
  "bennes.html",
  "remorques.html",
  "tournees.html",
  "settings.html"
];

test("les pages Admin historiques restent presentes", () => {
  legacyPages.forEach((page) => {
    assert.equal(fs.existsSync(path.join(webapp, page)), true, `${page} est manquante`);
  });
});

test("le stockage historique conserve toutes les collections metier", () => {
  const storage = fs.readFileSync(path.join(webapp, "js", "storage.js"), "utf8");
  const collections = [
    "conducteurs",
    "camions",
    "bennes",
    "remorques",
    "tournees",
    "disponibilites",
    "matieres",
    "adresses",
    "configuration"
  ];

  collections.forEach((collection) => {
    assert.match(storage, new RegExp(`\\b${collection}\\b`), `${collection} est absente du stockage`);
  });
});

test("le point d'entree web reste utilisable sans Electron", () => {
  const index = fs.readFileSync(path.join(webapp, "index.html"), "utf8");

  assert.match(index, /data-page="dashboard"/);
  assert.match(index, /<script src="js\/app\.js" defer><\/script>/);
});
