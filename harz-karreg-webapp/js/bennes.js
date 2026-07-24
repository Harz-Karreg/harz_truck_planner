(function () {
  const statusOptions = ["Petite", "Moyenne", "Grande"].map((value) => ({ value, label: value }));

  function fields(bin = {}) {
    return [
      { name: "nom", label: "Nom de la benne", value: bin.nom, required: true },
      { name: "statut", label: "Statut", type: "select", value: bin.statut || "Moyenne", options: statusOptions }
    ];
  }

  function openForm(bin) {
    window.HKModal.open({
      title: bin ? "Modifier la benne" : "Ajouter une benne",
      fields: fields(bin),
      onSubmit(data) {
        if (bin) {
          window.HKStorage.update("bennes", bin.id, data);
        } else {
          window.HKStorage.save("bennes", data);
        }
        window.HKUI.notify("Benne enregistrée.");
        render();
      }
    });
  }

  function removeBin(id) {
    if (!confirm("Supprimer cette benne ?")) return;
    window.HKStorage.remove("bennes", id);
    window.HKUI.notify("Benne supprimée.");
    render();
  }

  function render() {
    if (document.body.dataset.page !== "bennes") return;
    const workspace = document.querySelector("#workspace");
    const bins = window.HKStorage.load("bennes");

    workspace.innerHTML = `
      <div class="resource-grid">
        ${bins.map((bin) => `
          <article class="card resource-card">
            <div class="resource-media">
              <span class="resource-icon">B</span>
              <span class="badge">${bin.statut}</span>
            </div>
            <div>
              <h2 class="resource-title">${bin.nom}</h2>
              <p class="resource-detail">Capacité ${bin.statut.toLowerCase()}</p>
            </div>
            <div class="actions">
              <button class="button ghost" data-edit="${bin.id}">Modifier</button>
              <button class="button danger" data-delete="${bin.id}">Supprimer</button>
            </div>
          </article>
        `).join("")}
      </div>
    `;

    document.querySelectorAll("[data-edit]").forEach((button) => {
      button.addEventListener("click", () => openForm(bins.find((bin) => bin.id === button.dataset.edit)));
    });
    document.querySelectorAll("[data-delete]").forEach((button) => {
      button.addEventListener("click", () => removeBin(button.dataset.delete));
    });
  }

  window.HKBins = { openForm, render };
})();
