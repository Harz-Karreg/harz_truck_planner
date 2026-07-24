(function () {
  const statusOptions = ["Disponible", "En mission", "En repos"].map((value) => ({ value, label: value }));

  function fields(driver = {}) {
    return [
      { name: "prenom", label: "Prénom", value: driver.prenom, required: true },
      { name: "nom", label: "Nom", value: driver.nom, required: true },
      { name: "telephone", label: "Téléphone", value: driver.telephone, required: true },
      { name: "permis", label: "Permis", value: driver.permis || "CE", required: true },
      { name: "validite", label: "Date de validité", type: "date", value: driver.validite, required: true },
      { name: "statut", label: "Statut", type: "select", value: driver.statut || "Disponible", options: statusOptions },
      { name: "photo", label: "Photo URL", value: driver.photo }
    ];
  }

  function openForm(driver) {
    window.HKModal.open({
      title: driver ? "Modifier le conducteur" : "Ajouter un conducteur",
      fields: fields(driver),
      onSubmit(data) {
        if (driver) {
          window.HKStorage.update("conducteurs", driver.id, data);
        } else {
          window.HKStorage.save("conducteurs", data);
        }
        window.HKUI.notify("Conducteur enregistré.");
        render();
      }
    });
  }

  function removeDriver(id) {
    if (!confirm("Supprimer ce conducteur ?")) return;
    window.HKStorage.remove("conducteurs", id);
    window.HKUI.notify("Conducteur supprimé.");
    render();
  }

  function render() {
    if (document.body.dataset.page !== "conducteurs") return;
    const workspace = document.querySelector("#workspace");
    const drivers = window.HKStorage.load("conducteurs");
    workspace.innerHTML = `
      <div class="panel card">
        <div class="section-header">
          <h2>Registre conducteurs</h2>
          <span class="tag">${drivers.length} profils</span>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Conducteur</th>
              <th>Téléphone</th>
              <th>Permis</th>
              <th>Validité</th>
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${drivers.map((driver) => `
              <tr>
                <td>
                  <div class="entity">
                    <span class="avatar">${driver.photo ? `<img src="${driver.photo}" alt="${driver.prenom} ${driver.nom}">` : window.HKUI.initials([driver.prenom, driver.nom])}</span>
                    <strong>${driver.prenom} ${driver.nom}</strong>
                  </div>
                </td>
                <td>${driver.telephone}</td>
                <td>${driver.permis}</td>
                <td>${driver.validite}</td>
                <td><span class="badge">${driver.statut}</span></td>
                <td class="actions">
                  <button class="icon-button" data-edit="${driver.id}" aria-label="Modifier">✎</button>
                  <button class="icon-button" data-delete="${driver.id}" aria-label="Supprimer">×</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
    document.querySelectorAll("[data-edit]").forEach((button) => {
      button.addEventListener("click", () => openForm(drivers.find((driver) => driver.id === button.dataset.edit)));
    });
    document.querySelectorAll("[data-delete]").forEach((button) => {
      button.addEventListener("click", () => removeDriver(button.dataset.delete));
    });
  }

  window.HKDrivers = { openForm, render };
})();
