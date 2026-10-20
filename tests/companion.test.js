const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const companionRoot = path.join(root, "src", "renderer", "companion");
const serviceSource = fs.readFileSync(path.join(root, "src", "renderer", "shared", "legacy-read-service.js"), "utf8");

test("Companion expose un planning publié en lecture seule", () => {
  const html = fs.readFileSync(path.join(companionRoot, "index.html"), "utf8");
  const app = fs.readFileSync(path.join(companionRoot, "app.js"), "utf8");
  assert.match(html, /LECTURE SEULE/i); assert.match(html, /departure-filter/); assert.match(html, /fullscreen-button/); assert.match(app, /publishedTours/);
  assert.doesNotMatch(app, /\.create\(|\.update\(|\.remove\(|\.clear\(/);
});

test("le service Companion ne retourne que les tournées publiées", () => {
  const values = { "harz-karreg:tournees": JSON.stringify([{ id: "published", publicationStatut: "Publiee" }, { id: "legacy" }, { id: "draft", publicationStatut: "Brouillon" }]) };
  const window = { localStorage: { getItem: (key) => values[key] || null } };
  vm.runInNewContext(serviceSource, { window, JSON, Error });
  assert.deepEqual(Array.from(window.HKCompanionData.publishedTours(), (tour) => tour.id), ["published", "legacy"]);
  assert.throws(() => window.HKCompanionData.list("disponibilites"), /non accessible/);
});
