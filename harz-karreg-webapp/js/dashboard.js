(function () {
  function countBy(items, field, value) {
    return items.filter((item) => item[field] === value).length;
  }

  function renderRecentRoutes(routes, drivers) {
    if (!routes.length) {
      return '<tr><td colspan="5" class="muted">Aucune tournée enregistrée.</td></tr>';
    }

    return routes.slice(0, 5).map((route) => {
      const driver = drivers.find((item) => item.id === route.conducteurId);
      const driverName = driver ? `${driver.prenom} ${driver.nom}` : "Non assigné";
      return `
        <tr>
          <td><strong>${route.nom}</strong></td>
          <td>${route.depart} -> ${route.arrivee}</td>
          <td>${route.date} · ${route.heure}</td>
          <td>${driverName}</td>
          <td><span class="badge">${window.HKUI.routeStatusLabel(route.statut)}</span></td>
        </tr>
      `;
    }).join("");
  }

  function render() {
    if (document.body.dataset.page !== "dashboard") return;

    const workspace = document.querySelector("#workspace");
    const drivers = window.HKStorage.load("conducteurs");
    const trucks = window.HKStorage.load("camions");
    const bins = window.HKStorage.load("bennes");
    const trailers = window.HKStorage.load("remorques");
    const routes = window.HKStorage.load("tournees");
    const activeRoutes = routes.filter((route) => route.statut === "Planifiee" || route.statut === "En cours");

    workspace.innerHTML = `
      <div class="stat-grid">
        <article class="card stat-card">
          <p class="stat-label">Chauffeurs</p>
          <p class="stat-value">${drivers.length}</p>
          <p class="stat-meta">${countBy(drivers, "statut", "Disponible")} disponibles</p>
        </article>
        <article class="card stat-card">
          <p class="stat-label">Camions</p>
          <p class="stat-value">${trucks.length}</p>
          <p class="stat-meta">tracteurs référencés</p>
        </article>
        <article class="card stat-card">
          <p class="stat-label">Bennes</p>
          <p class="stat-value">${bins.length}</p>
          <p class="stat-meta">${countBy(bins, "statut", "Grande")} grandes</p>
        </article>
        <article class="card stat-card">
          <p class="stat-label">Tournées</p>
          <p class="stat-value">${routes.length}</p>
          <p class="stat-meta">${activeRoutes.length} actives ou planifiées</p>
        </article>
      </div>
      <div class="resource-grid">
        <article class="card resource-card">
          <div class="resource-media">
            <span class="resource-icon">C</span>
            <span class="badge success">${countBy(drivers, "statut", "Disponible")}</span>
          </div>
          <div>
            <h2 class="resource-title">Chauffeurs disponibles</h2>
            <p class="resource-detail">Capacité humaine immédiatement mobilisable.</p>
          </div>
          <a class="button ghost" href="conducteurs.html">Voir</a>
        </article>
        <article class="card resource-card">
          <div class="resource-media">
            <span class="resource-icon">C</span>
            <span class="badge info">${trucks.length}</span>
          </div>
          <div>
            <h2 class="resource-title">Camions</h2>
            <p class="resource-detail">Marque, modèle et immatriculation des tracteurs.</p>
          </div>
          <a class="button ghost" href="camions.html">Voir</a>
        </article>
        <article class="card resource-card">
          <div class="resource-media">
            <span class="resource-icon">B</span>
            <span class="badge warning">${bins.length}</span>
          </div>
          <div>
            <h2 class="resource-title">Bennes</h2>
            <p class="resource-detail">Petites, moyennes et grandes bennes disponibles.</p>
          </div>
          <a class="button ghost" href="bennes.html">Voir</a>
        </article>
      </div>
      <div class="section-header">
        <h2>Dernières tournées</h2>
        <a class="tag" href="planning.html">Ouvrir planning</a>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Tournée</th>
              <th>Trajet</th>
              <th>Date</th>
              <th>Chauffeur</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            ${renderRecentRoutes(routes, drivers)}
          </tbody>
        </table>
      </div>
    `;
  }

  window.HKDashboard = { render };
})();
