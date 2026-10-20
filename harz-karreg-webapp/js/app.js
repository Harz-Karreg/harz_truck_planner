(function () {
  function initActions(page) {
    if (page === "dashboard") {
      window.HKUI.setActions('<a class="button ghost" href="conducteurs.html">Conducteurs</a><a class="button ghost" href="camions.html">Camions</a><a class="button ghost" href="bennes.html">Bennes</a><a class="button primary" href="tournees.html">Tournées</a>');
    }

    if (page === "conducteurs") {
      window.HKUI.setActions('<button class="button primary" id="add-driver">+ Ajouter</button>');
      document.querySelector("#add-driver").addEventListener("click", () => window.HKDrivers.openForm());
    }

    if (page === "camions") {
      window.HKUI.setActions('<button class="button primary" id="add-truck">+ Ajouter</button>');
      document.querySelector("#add-truck").addEventListener("click", () => window.HKTrucks.openForm());
    }

    if (page === "bennes") {
      window.HKUI.setActions('<button class="button primary" id="add-bin">+ Ajouter</button>');
      document.querySelector("#add-bin").addEventListener("click", () => window.HKBins.openForm());
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
    window.HKDashboard.render();
    window.HKPlanning.render();
    window.HKDrivers.render();
    window.HKTrucks.render();
    window.HKBins.render();
    window.HKTrailers.render();
    window.HKRoutes.render();
    window.HKSettings?.render();
    initActions(page);
  }

  document.addEventListener("DOMContentLoaded", () => {
    const page = document.body.dataset.page || "dashboard";
    window.HKStorage.seedIfEmpty();
    document.querySelector("#app-shell").innerHTML = window.HKUI.shell(page);
    window.HKUI.initSidebar();
    window.HKUI.initDisplayControls();
    window.HKUI.initScreenLock();
    renderPage(page);
  });
})();
