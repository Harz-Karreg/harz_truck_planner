const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const webapp = path.join(root, "harz-karreg-webapp");
const repositorySource = fs.readFileSync(path.join(webapp, "js", "repositories.js"), "utf8");

function createContext() {
  const calls = [];
  const storage = {
    load(collection) {
      calls.push(["load", collection]);
      return [{ id: "entity-1", nom: "Exemple" }];
    },
    getById(collection, id) {
      calls.push(["getById", collection, id]);
      return { id };
    },
    save(collection, entity) {
      calls.push(["save", collection, entity]);
      return { ...entity, id: entity.id || "created-1" };
    },
    update(collection, id, patch) {
      calls.push(["update", collection, id, patch]);
      return { ...patch, id };
    },
    remove(collection, id) {
      calls.push(["remove", collection, id]);
    }
  };
  const context = vm.createContext({ window: { HKStorage: storage } });
  vm.runInContext(repositorySource, context, { filename: "repositories.js" });
  return { calls, repositories: context.window.HKRepositories };
}

test("les repositories exposent toutes les collections historiques", () => {
  const { repositories } = createContext();
  const expected = [
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

  assert.deepEqual(Array.from(repositories.collections), expected);
  expected.forEach((collection) => assert.equal(repositories.get(collection).collection, collection));
});

test("le repository legacy delegue le CRUD sans transformer les donnees", () => {
  const { calls, repositories } = createContext();
  const routes = repositories.tournees;
  const entity = { nom: "Tournee test" };
  const patch = { statut: "En cours" };

  routes.list();
  routes.getById("route-1");
  routes.create(entity);
  routes.update("route-1", patch);
  routes.remove("route-1");

  assert.deepEqual(calls, [
    ["load", "tournees"],
    ["getById", "tournees", "route-1"],
    ["save", "tournees", entity],
    ["update", "tournees", "route-1", patch],
    ["remove", "tournees", "route-1"]
  ]);
});

test("chaque page charge les repositories apres le stockage", () => {
  const pages = fs.readdirSync(webapp).filter((filename) => path.extname(filename) === ".html");

  pages.forEach((page) => {
    const html = fs.readFileSync(path.join(webapp, page), "utf8");
    const storageIndex = html.indexOf('src="js/storage.js"');
    const repositoriesIndex = html.indexOf('src="js/repositories.js"');

    assert.notEqual(storageIndex, -1, `${page} ne charge pas storage.js`);
    assert.ok(repositoriesIndex > storageIndex, `${page} doit charger repositories.js apres storage.js`);
  });
});

test("le module Tournees n'accede plus directement a HKStorage", () => {
  const routes = fs.readFileSync(path.join(webapp, "js", "tournees.js"), "utf8");

  assert.doesNotMatch(routes, /HKStorage/);
  assert.match(routes, /HKRepositories/);
});
