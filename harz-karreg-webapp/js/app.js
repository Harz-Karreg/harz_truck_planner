(function () {
  function initActions(page) {
    if (page === "conducteurs") {
      window.HKUI.setActions('<button class="button primary" id="add-driver">+ Ajouter</button>');
      document.querySelector("#add-driver").addEventListener("click", () => window.HKDrivers.openForm());
    }
    if (page === "remorques") {
      window.HKUI.setActions('<button class="button primary" id="add-trailer">+ Ajouter</button>');
      document.querySelector("#add-trailer").addEventListener("click", () => window.HKTrailers.openForm());
    }
    if (page === "tournees" || page === "planning") {
      window.HKUI.setActions('<a class="button ghost" href="tournees.html">Voir tournées</a><button class="button primary" id="add-route">+ Tournée</button>');
      document.querySelector("#add-route").addEventListener("click", () => window.HKRoutes.openForm());
    }
  }

  function renderPage(page) {
    window.HKPlanning.render();
    window.HKDrivers.render();
    window.HKTrailers.render();
    window.HKRoutes.render();
    initActions(page);
  }

  document.addEventListener("DOMContentLoaded", () => {
    const page = document.body.dataset.page || "planning";
    window.HKStorage.seedIfEmpty();
    document.querySelector("#app-shell").innerHTML = window.HKUI.shell(page);
    renderPage(page);
  });
})();
