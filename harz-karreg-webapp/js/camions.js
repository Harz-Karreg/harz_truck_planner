(function () {
  const typeOptions = ["Tracteur", "Porteur"].map((value) => ({ value, label: value }));

  function fields(truck = {}) {
    return [
      { name: "marque", label: "Marque", value: truck.marque, required: true },
      { name: "modele", label: "Modèle", value: truck.modele, required: true },
      { name: "immatriculation", label: "Immatriculation", value: truck.immatriculation, required: true },
      { name: "type", label: "Type de camion", type: "select", value: truck.type || "Tracteur", options: typeOptions, required: true }
    ];
  }

  function openForm(truck) {
    window.HKModal.open({
      title: truck ? "Modifier le camion" : "Ajouter un camion",
      fields: fields(truck),
      onSubmit(data) {
        if (truck) {
          window.HKStorage.update("camions", truck.id, data);
        } else {
          window.HKStorage.save("camions", data);
        }
        window.HKUI.notify("Camion enregistré.");
        render();
      }
    });
  }

  function removeTruck(id) {
    if (!confirm("Supprimer ce camion ?")) return;
    window.HKStorage.remove("camions", id);
    window.HKUI.notify("Camion supprimé.");
    render();
  }

  function render() {
    if (document.body.dataset.page !== "camions") return;
    const workspace = document.querySelector("#workspace");
    const trucks = window.HKStorage.load("camions");

    workspace.innerHTML = `
      <div class="resource-grid">
        ${trucks.map((truck) => `
          <article class="card resource-card">
            <div class="resource-media">
              <span class="resource-icon">C</span>
              <span class="badge info">${truck.immatriculation}</span>
            </div>
            <div>
              <h2 class="resource-title">${truck.marque}</h2>
              <p class="resource-detail">${truck.modele}</p>
              <p class="resource-detail">${truck.immatriculation}</p>
              <p class="resource-detail"><span class="badge info">${truck.type || "Tracteur"}</span></p>
            </div>
            <div class="actions">
              <button class="button ghost" data-edit="${truck.id}">Modifier</button>
              <button class="button danger" data-delete="${truck.id}">Supprimer</button>
            </div>
          </article>
        `).join("")}
      </div>
    `;

    document.querySelectorAll("[data-edit]").forEach((button) => {
      button.addEventListener("click", () => openForm(trucks.find((truck) => truck.id === button.dataset.edit)));
    });
    document.querySelectorAll("[data-delete]").forEach((button) => {
      button.addEventListener("click", () => removeTruck(button.dataset.delete));
    });
  }

  window.HKTrucks = { openForm, render };
})();
