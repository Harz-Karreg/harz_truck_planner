(function () {
  const typeOptions = ["Benne", "Frigo", "Plateau", "Porte-char", "Citerne"].map((value) => ({ value, label: value }));
  const statusOptions = ["Disponible", "Maintenance"].map((value) => ({ value, label: value }));

  function fields(trailer = {}) {
    return [
      { name: "immatriculation", label: "Immatriculation", value: trailer.immatriculation, required: true },
      { name: "type", label: "Type", type: "select", value: trailer.type || "Benne", options: typeOptions },
      { name: "statut", label: "Statut", type: "select", value: trailer.statut || "Disponible", options: statusOptions },
      { name: "photo", label: "Photo URL", value: trailer.photo },
      { name: "observations", label: "Observations", type: "textarea", value: trailer.observations, full: true }
    ];
  }

  function openForm(trailer) {
    window.HKModal.open({
      title: trailer ? "Modifier la remorque" : "Ajouter une remorque",
      fields: fields(trailer),
      onSubmit(data) {
        if (trailer) {
          window.HKStorage.update("remorques", trailer.id, data);
        } else {
          window.HKStorage.save("remorques", data);
        }
        window.HKUI.notify("Remorque enregistrée.");
        render();
      }
    });
  }

  function removeTrailer(id) {
    if (!confirm("Supprimer cette remorque ?")) return;
    window.HKStorage.remove("remorques", id);
    window.HKUI.notify("Remorque supprimée.");
    render();
  }

  function render() {
    if (document.body.dataset.page !== "remorques") return;
    const workspace = document.querySelector("#workspace");
    const trailers = window.HKStorage.load("remorques");
    workspace.innerHTML = `
      <div class="resource-grid">
        ${trailers.map((trailer) => `
          <article class="card resource-card">
            <div class="resource-media">
              <span class="resource-icon">${trailer.photo ? `<img src="${trailer.photo}" alt="${trailer.immatriculation}">` : trailer.type[0]}</span>
              <span class="badge">${trailer.statut}</span>
            </div>
            <div>
              <h2 class="resource-title">${trailer.immatriculation}</h2>
              <p class="resource-detail">${trailer.type}</p>
              <p class="resource-detail">${trailer.observations || "Aucune observation."}</p>
            </div>
            <div class="actions">
              <button class="button ghost" data-edit="${trailer.id}">Modifier</button>
              <button class="button danger" data-delete="${trailer.id}">Supprimer</button>
            </div>
          </article>
        `).join("")}
      </div>
    `;
    document.querySelectorAll("[data-edit]").forEach((button) => {
      button.addEventListener("click", () => openForm(trailers.find((trailer) => trailer.id === button.dataset.edit)));
    });
    document.querySelectorAll("[data-delete]").forEach((button) => {
      button.addEventListener("click", () => removeTrailer(button.dataset.delete));
    });
  }

  window.HKTrailers = { openForm, render };
})();
