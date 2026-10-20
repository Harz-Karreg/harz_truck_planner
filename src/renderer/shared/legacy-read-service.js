(function () {
  const namespace = "harz-karreg";
  const allowedCollections = Object.freeze(["conducteurs", "camions", "bennes", "remorques", "tournees", "matieres", "configuration"]);

  function safeParse(value) {
    try {
      const parsed = JSON.parse(value || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function createReadService(storage) {
    return Object.freeze({
      adapter: "legacy-read-only",
      list(collection) {
        if (!allowedCollections.includes(collection)) throw new Error(`Collection non accessible en lecture: ${collection}`);
        return safeParse(storage.getItem(`${namespace}:${collection}`));
      },
      publishedTours() {
        return this.list("tournees").filter((tour) => (tour.publicationStatut || "Publiee") === "Publiee");
      }
    });
  }

  window.HKCompanionData = createReadService(window.localStorage);
  window.HKCreateReadService = createReadService;
})();
