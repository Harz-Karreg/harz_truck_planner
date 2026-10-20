(function () {
  const collectionNames = Object.freeze([
    "conducteurs",
    "camions",
    "bennes",
    "remorques",
    "tournees",
    "disponibilites",
    "matieres",
    "adresses",
    "configuration"
  ]);

  function storage() {
    if (!window.HKStorage) {
      throw new Error("HKStorage doit etre initialise avant les repositories.");
    }
    return window.HKStorage;
  }

  function createLegacyRepository(collection) {
    if (!collectionNames.includes(collection)) {
      throw new Error(`Collection inconnue: ${collection}`);
    }

    return Object.freeze({
      collection,
      list() {
        return storage().load(collection);
      },
      getById(id) {
        return storage().getById(collection, id);
      },
      create(entity) {
        return storage().save(collection, entity);
      },
      update(id, patch) {
        return storage().update(collection, id, patch);
      },
      remove(id) {
        return storage().remove(collection, id);
      }
    });
  }

  const repositories = Object.fromEntries(
    collectionNames.map((collection) => [collection, createLegacyRepository(collection)])
  );

  window.HKRepositories = Object.freeze({
    adapter: "legacy-local-storage",
    collections: collectionNames,
    ...repositories,
    get(collection) {
      const repository = repositories[collection];
      if (!repository) throw new Error(`Repository inconnu: ${collection}`);
      return repository;
    }
  });
})();
