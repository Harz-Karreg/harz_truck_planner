const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const scripts = path.join(root, "harz-karreg-webapp", "js");

test("une nouvelle tournee est un brouillon et les donnees historiques restent publiees", () => {
  const routes = fs.readFileSync(path.join(scripts, "tournees.js"), "utf8");
  const storage = fs.readFileSync(path.join(scripts, "storage.js"), "utf8");

  assert.match(routes, /route\.id \? "Publiee" : "Brouillon"/);
  assert.match(storage, /publicationStatut: "Publiee"/);
});

test("le planning permet de publier les brouillons de la semaine", () => {
  const planning = fs.readFileSync(path.join(scripts, "planning.js"), "utf8");

  assert.match(planning, /function publishWeek\(days\)/);
  assert.match(planning, /data-publish-week/);
  assert.match(planning, /publicationStatut: "Publiee"/);
});

test("la remise a zero exige une confirmation et sauvegarde avant de vider", () => {
  const settings = fs.readFileSync(path.join(scripts, "settings.js"), "utf8");
  const backupPosition = settings.indexOf("downloadBackup();");
  const clearPosition = settings.indexOf("repository(collection).clear()");

  assert.match(settings, /data\.confirmation\.trim\(\) !== "REINITIALISER"/);
  assert.ok(backupPosition !== -1 && backupPosition < clearPosition);
  assert.doesNotMatch(settings, /businessCollections.*configuration/);
  assert.match(settings, /\{ verrouillageMotDePasse, \.\.\.configuration \}/);
});
