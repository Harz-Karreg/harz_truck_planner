(function () {
  const statusOptions = [
    { value: "Planifiee", label: "Planifiée" },
    { value: "En cours", label: "En cours" },
    { value: "Terminee", label: "Terminée" },
    { value: "Annulee", label: "Annulée" }
  ];

  function driverOptions() {
    return window.HKStorage.load("conducteurs").map((driver) => ({ value: driver.id, label: `${driver.prenom} ${driver.nom}` }));
  }

  function trailerOptions() {
    return window.HKStorage.load("remorques").map((trailer) => ({ value: trailer.id, label: `${trailer.immatriculation} - ${trailer.type}` }));
  }

  function fields(route = {}) {
    return [
      { name: "nom", label: "Nom", value: route.nom, required: true },
      { name: "depart", label: "Départ", value: route.depart, required: true },
      { name: "arrivee", label: "Arrivée", value: route.arrivee, required: true },
      { name: "date", label: "Date", type: "date", value: route.date || new Date().toISOString().slice(0, 10), required: true },
      { name: "heure", label: "Heure", type: "time", value: route.heure || "08:00", required: true },
      { name: "conducteurId", label: "Conducteur", type: "select", value: route.conducteurId, options: driverOptions() },
      { name: "remorqueId", label: "Remorque", type: "select", value: route.remorqueId, options: trailerOptions() },
      { name: "statut", label: "Statut", type: "select", value: route.statut || "Planifiee", options: statusOptions },
      { name: "description", label: "Description", type: "textarea", value: route.description, full: true }
    ];
  }

  function openForm(route) {
    window.HKModal.open({
      title: route ? "Modifier la tournée" : "Ajouter une tournée",
      fields: fields(route),
      onSubmit(data) {
        if (route) {
          window.HKStorage.update("tournees", route.id, data);
        } else {
          window.HKStorage.save("tournees", data);
        }
        window.HKUI.notify("Tournée enregistrée.");
        render();
        if (document.body.dataset.page === "planning") {
          window.HKPlanning.render();
        }
      }
    });
  }

  function removeRoute(id) {
    if (!confirm("Supprimer cette tournée ?")) return;
    window.HKStorage.remove("tournees", id);
    window.HKUI.notify("Tournée supprimée.");
    render();
  }

  function render() {
    if (document.body.dataset.page !== "tournees") return;
    const workspace = document.querySelector("#workspace");
    const routes = window.HKStorage.load("tournees");
    const drivers = window.HKStorage.load("conducteurs");
    const trailers = window.HKStorage.load("remorques");
    workspace.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Tournée</th>
              <th>Trajet</th>
              <th>Date</th>
              <th>Conducteur</th>
              <th>Remorque</th>
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${routes.map((route) => {
              const driver = drivers.find((item) => item.id === route.conducteurId);
              const trailer = trailers.find((item) => item.id === route.remorqueId);
              return `
                <tr>
                  <td><strong>${route.nom}</strong><div class="muted">${route.description || ""}</div></td>
                  <td>${route.depart} → ${route.arrivee}</td>
                  <td>${route.date} · ${route.heure}</td>
                  <td>${driver ? `${driver.prenom} ${driver.nom}` : "Non assigne"}</td>
                  <td>${trailer ? trailer.immatriculation : "Sans remorque"}</td>
                  <td><span class="badge">${window.HKUI.routeStatusLabel(route.statut)}</span></td>
                  <td class="actions">
                    <button class="icon-button" data-edit="${route.id}" aria-label="Modifier">✎</button>
                    <button class="icon-button" data-delete="${route.id}" aria-label="Supprimer">×</button>
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
    document.querySelectorAll("[data-edit]").forEach((button) => {
      button.addEventListener("click", () => openForm(routes.find((route) => route.id === button.dataset.edit)));
    });
    document.querySelectorAll("[data-delete]").forEach((button) => {
      button.addEventListener("click", () => removeRoute(button.dataset.delete));
    });
  }

  window.HKRoutes = { openForm, render };
})();
