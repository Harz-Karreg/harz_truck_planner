(function () {
  function driverName(driver) {
    return driver ? `${driver.prenom} ${driver.nom}` : "Non assigne";
  }

  function trailerName(trailer) {
    return trailer ? `${trailer.immatriculation} - ${trailer.type}` : "Sans remorque";
  }

  function routeCard(route, drivers, trailers) {
    const driver = drivers.find((item) => item.id === route.conducteurId);
    const trailer = trailers.find((item) => item.id === route.remorqueId);
    return `
      <article class="route-card" draggable="true" data-route-id="${route.id}">
        <h3 class="route-title">${route.nom}</h3>
        <div class="route-meta">${route.heure} · ${route.depart} → ${route.arrivee}</div>
        <div class="route-meta">${driverName(driver)}</div>
        <div class="route-meta">${trailerName(trailer)}</div>
        <span class="badge">${window.HKUI.routeStatusLabel(route.statut)}</span>
      </article>
    `;
  }

  function bindDrag() {
    document.querySelectorAll(".route-card").forEach((card) => {
      card.addEventListener("dragstart", (event) => {
        card.classList.add("dragging");
        event.dataTransfer.setData("text/plain", card.dataset.routeId);
      });
      card.addEventListener("dragend", () => card.classList.remove("dragging"));
    });
    document.querySelectorAll(".day-column").forEach((column) => {
      column.addEventListener("dragover", (event) => {
        event.preventDefault();
        column.classList.add("drag-over");
      });
      column.addEventListener("dragleave", () => column.classList.remove("drag-over"));
      column.addEventListener("drop", (event) => {
        event.preventDefault();
        column.classList.remove("drag-over");
        const id = event.dataTransfer.getData("text/plain");
        window.HKStorage.update("tournees", id, { date: column.dataset.date });
        window.HKUI.notify("Tournée déplacée dans le planning.");
        render();
      });
    });
  }

  function renderDrivers(drivers) {
    return drivers.map((driver) => `
      <div class="driver-chip">
        <div class="avatar">${window.HKUI.initials([driver.prenom, driver.nom])}</div>
        <div>
          <strong>${driver.prenom} ${driver.nom}</strong>
          <span>${driver.statut} · Eco ${driver.ecoScore}</span>
        </div>
      </div>
    `).join("");
  }

  function render() {
    if (document.body.dataset.page !== "planning") return;
    const workspace = document.querySelector("#workspace");
    const stats = document.createElement("div");
    window.HKUI.renderStats(stats);
    const days = window.HKCalendar.currentWeek();
    const drivers = window.HKStorage.load("conducteurs");
    const trailers = window.HKStorage.load("remorques");
    const routes = window.HKStorage.load("tournees");

    workspace.innerHTML = "";
    workspace.appendChild(stats);
    workspace.insertAdjacentHTML("beforeend", `
      <div class="section-header">
        <h2>Semaine en cours</h2>
        <span class="tag">${days[0].label} - ${days[6].label}</span>
      </div>
      <div class="planning-shell">
        <aside class="card driver-rail">
          ${renderDrivers(drivers)}
        </aside>
        <div class="card week-board">
          <div class="week-grid">
            ${days.map((day) => {
              const dayRoutes = routes.filter((route) => route.date === day.iso);
              return `
                <section class="day-column" data-date="${day.iso}">
                  <header class="day-head">
                    <div>
                      <p class="day-name">${day.name}</p>
                      <span class="day-date">${day.label}</span>
                    </div>
                    <span class="badge">${dayRoutes.length}</span>
                  </header>
                  ${dayRoutes.length ? dayRoutes.map((route) => routeCard(route, drivers, trailers)).join("") : `<div class="empty-day">Déposer une tournée</div>`}
                </section>
              `;
            }).join("")}
          </div>
        </div>
      </div>
    `);
    bindDrag();
  }

  window.HKPlanning = { render };
})();
