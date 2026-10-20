(function () {
  const statusOptions = [
    { value: "Planifiee", label: "Planifiée" },
    { value: "En cours", label: "En cours" },
    { value: "Terminee", label: "Terminée" },
    { value: "Annulee", label: "Annulée" }
  ];
  const publicationOptions = [
    { value: "Brouillon", label: "Brouillon" },
    { value: "Publiee", label: "Publiée" }
  ];

  function repository(collection) {
    return window.HKRepositories.get(collection);
  }

  function driverOptions() {
    return [
      { value: "", label: "Non affecté" },
      ...repository("conducteurs").list().map((driver) => ({ value: driver.id, label: `${driver.prenom} ${driver.nom}` }))
    ];
  }

  function trailerOptions() {
    return repository("remorques").list().map((trailer) => ({ value: trailer.id, label: `${trailer.immatriculation} - ${trailer.type}` }));
  }

  function truckOptions() {
    return [
      { value: "", label: "Sans camion" },
      ...repository("camions").list().map((truck) => ({ value: truck.id, label: `${truck.marque} ${truck.modele} - ${truck.immatriculation}` }))
    ];
  }

  function binOptions() {
    return [
      { value: "", label: "Sans benne" },
      ...repository("bennes").list().map((bin) => ({ value: bin.id, label: `${bin.nom} - ${bin.statut}` }))
    ];
  }

  function materialDisplay(material) {
    return material.code ? `${material.code} — ${material.nom}` : material.nom;
  }

  function materialOptions(route = {}) {
    const options = repository("matieres").list()
      .slice()
      .sort((a, b) => materialDisplay(a).localeCompare(materialDisplay(b), "fr"))
      .map((material) => ({ value: material.id, label: materialDisplay(material) }));

    if (!route.matiereId && route.description) {
      options.unshift({ value: "__legacy__", label: `Ancienne saisie — ${route.description}` });
    }

    return [
      { value: "", label: "Sélectionner une matière" },
      ...options
    ];
  }

  function routeMaterialDisplay(route, materials) {
    const material = materials.find((item) => item.id === route.matiereId);
    return material ? materialDisplay(material) : (route.description || "-");
  }

  function addressOptions(currentValue, includeEmpty = true) {
    const addresses = repository("adresses").list()
      .map((address, index) => ({ ...address, _position: index }))
      .sort((a, b) => (a.ordre ?? a._position) - (b.ordre ?? b._position));
    const options = addresses.map((address) => ({
      value: address.adresse,
      label: `${address.nom} — ${address.adresse}`
    }));

    if (currentValue && !addresses.some((address) => address.adresse === currentValue)) {
      options.unshift({ value: currentValue, label: `Adresse existante — ${currentValue}` });
    }

    return includeEmpty ? [{ value: "", label: "Sélectionner une adresse" }, ...options] : options;
  }

  function fields(route = {}) {
    return [
      { name: "nom", label: "Nom", value: route.nom, required: true },
      { name: "depart", label: "Départ", type: "select", value: route.depart || "9 Boulevard Monge, 69330 Meyzieu", options: addressOptions(route.depart || "9 Boulevard Monge, 69330 Meyzieu"), required: true },
      { name: "arrivee", label: "Arrivée", type: "select", value: route.arrivee || "", options: addressOptions(route.arrivee), required: true },
      { name: "date", label: "Date", type: "date", value: route.date || new Date().toISOString().slice(0, 10), required: true },
      { name: "heure", label: "Heure de début", type: "time", value: route.heure || "08:00", required: true },
      { name: "heureFin", label: "Heure de fin", type: "time", value: route.heureFin || "" },
      { name: "journeeEntiere", label: "Planification", type: "checkbox", value: Boolean(route.journeeEntiere), help: "Journée entière (07:00 - 17:00)", full: true },
      { name: "conducteurId", label: "Conducteur", type: "select", value: route.conducteurId, options: driverOptions() },
      { name: "remorqueId", label: "Semi-remorque", type: "select", value: route.remorqueId, options: trailerOptions() },
      { name: "camionId", label: "Camion", type: "select", value: route.camionId, options: truckOptions() },
      { name: "benneId", label: "Benne", type: "select", value: route.benneId, options: binOptions() },
      { name: "statut", label: "Statut", type: "select", value: route.statut || "Planifiee", options: statusOptions },
      { name: "publicationStatut", label: "Publication", type: "select", value: route.publicationStatut || (route.id ? "Publiee" : "Brouillon"), options: publicationOptions },
      { name: "matiereId", label: "Matière", type: "select", value: route.matiereId || (route.description ? "__legacy__" : ""), options: materialOptions(route), full: true }
    ];
  }

  function openForm(route, defaults = {}) {
    const isExisting = Boolean(route && route.id);
    const initialRoute = { ...defaults, ...(route || {}) };

    window.HKModal.open({
      title: isExisting ? "Modifier la tournée" : "Ajouter une tournée",
      fields: fields(initialRoute),
      onSubmit(data) {
        if (data.journeeEntiere) {
          data.heure = "07:00";
          data.heureFin = "17:00";
        }
        const selectedMaterial = repository("matieres").list().find((material) => material.id === data.matiereId);
        if (data.matiereId === "__legacy__") {
          data.matiereId = "";
          data.description = initialRoute.description || "";
        } else {
          data.description = selectedMaterial ? selectedMaterial.nom : "";
        }
        if (isExisting) {
          repository("tournees").update(initialRoute.id, data);
        } else {
          repository("tournees").create(data);
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
    repository("tournees").remove(id);
    window.HKUI.notify("Tournée supprimée.");
    render();
  }

  function render() {
    if (document.body.dataset.page !== "tournees") return;
    const workspace = document.querySelector("#workspace");
    const routes = repository("tournees").list();
    const drivers = repository("conducteurs").list();
    const trailers = repository("remorques").list();
    const trucks = repository("camions").list();
    const bins = repository("bennes").list();
    const materials = repository("matieres").list();

    workspace.innerHTML = `
      <div class="table-wrap">
        <table class="routes-table">
          <thead>
            <tr>
              <th>Conducteur</th>
              <th>Société / tournée</th>
              <th>Matières</th>
              <th>Départ</th>
              <th>Arrivée</th>
              <th>Date / horaires</th>
              <th>Remorque</th>
              <th>Camion</th>
              <th>Benne</th>
              <th>Statut</th>
              <th>Publication</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${routes.map((route) => {
              const driver = drivers.find((item) => item.id === route.conducteurId);
              const trailer = trailers.find((item) => item.id === route.remorqueId);
              const truck = trucks.find((item) => item.id === route.camionId);
              const bin = bins.find((item) => item.id === route.benneId);
              return `
                <tr>
                  <td><strong>${driver ? `${driver.prenom} ${driver.nom}` : "Non assigné"}</strong></td>
                  <td><strong>${route.nom}</strong></td>
                  <td><strong>${routeMaterialDisplay(route, materials)}</strong></td>
                  <td>${route.depart}</td>
                  <td>${route.arrivee}</td>
                  <td>${route.date} · ${route.journeeEntiere ? "Journée entière · 07:00 - 17:00" : `${route.heure}${route.heureFin ? ` - ${route.heureFin}` : ""}`}</td>
                  <td>${trailer ? trailer.immatriculation : "Sans remorque"}</td>
                  <td>${truck ? truck.immatriculation : "Sans camion"}</td>
                  <td>${bin ? bin.nom : "Sans benne"}</td>
                  <td><span class="badge">${window.HKUI.routeStatusLabel(route.statut)}</span></td>
                  <td><span class="badge ${route.publicationStatut === "Brouillon" ? "warning" : "success"}">${route.publicationStatut || "Publiée"}</span></td>
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
