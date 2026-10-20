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

  function materialOptions() {
    const options = repository("matieres").list()
      .slice()
      .sort((a, b) => materialDisplay(a).localeCompare(materialDisplay(b), "fr"))
      .map((material) => ({ value: material.id, label: materialDisplay(material) }));

    return [
      { value: "", label: "Choisir une matière enregistrée" },
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
    const defaultDeparture = route.depart || "9 Boulevard Monge, 69330 Meyzieu";
    const addresses = repository("adresses").list();
    return [
      { name: "nom", label: "Nom", value: route.nom, required: true },
      { name: "departCarnet", label: "Départ enregistré", type: "select", value: addresses.some((item) => item.adresse === defaultDeparture) ? defaultDeparture : "", options: addressOptions(""), helpText: "Choisissez dans le carnet ou saisissez l’adresse ci-dessous." },
      { name: "depart", label: "Adresse de départ", value: defaultDeparture, placeholder: "Saisir une adresse", required: true },
      { name: "arriveeCarnet", label: "Arrivée enregistrée", type: "select", value: addresses.some((item) => item.adresse === route.arrivee) ? route.arrivee : "", options: addressOptions(""), helpText: "Choisissez dans le carnet ou saisissez l’adresse ci-dessous." },
      { name: "arrivee", label: "Adresse d’arrivée", value: route.arrivee || "", placeholder: "Saisir une adresse", required: true },
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
      { name: "matiereId", label: "Matière enregistrée", type: "select", value: route.matiereId || "", options: materialOptions() },
      { name: "matiereLibre", label: "Matière libre", value: route.matiereId ? "" : (route.description || ""), placeholder: "Ex. cuivre, laiton, aluminium" },
      { name: "consignes", label: "Consignes", value: route.consignes || "", maxlength: 80, placeholder: "Consignes courtes pour la tournée", helpText: "80 caractères maximum.", full: true }
    ];
  }

  function openForm(route, defaults = {}) {
    const isExisting = Boolean(route && route.id);
    const initialRoute = { ...defaults, ...(route || {}) };

    window.HKModal.open({
      title: isExisting ? "Modifier la tournée" : "Ajouter une tournée",
      fields: fields(initialRoute),
      onOpen(node) {
        [["departCarnet", "depart"], ["arriveeCarnet", "arrivee"]].forEach(([selectName, inputName]) => {
          const select = node.querySelector(`[name="${selectName}"]`);
          const input = node.querySelector(`[name="${inputName}"]`);
          select.addEventListener("change", () => { if (select.value) input.value = select.value; });
          input.addEventListener("input", () => { if (input.value !== select.value) select.value = ""; });
        });
        const materialSelect = node.querySelector('[name="matiereId"]');
        const materialInput = node.querySelector('[name="matiereLibre"]');
        materialSelect.addEventListener("change", () => { if (materialSelect.value) materialInput.value = ""; });
        materialInput.addEventListener("input", () => { if (materialInput.value.trim()) materialSelect.value = ""; });
      },
      onSubmit(data) {
        if (data.journeeEntiere) {
          data.heure = "07:00";
          data.heureFin = "17:00";
        }
        const selectedMaterial = repository("matieres").list().find((material) => material.id === data.matiereId);
        data.description = data.matiereLibre.trim() || (selectedMaterial ? selectedMaterial.nom : "");
        data.consignes = data.consignes.trim().slice(0, 80);
        delete data.departCarnet;
        delete data.arriveeCarnet;
        delete data.matiereLibre;
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
              <th>Consignes</th>
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
                  <td>${route.consignes || "-"}</td>
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
