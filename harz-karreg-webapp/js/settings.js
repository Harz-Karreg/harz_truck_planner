(function () {
  const businessCollections = ["conducteurs", "camions", "bennes", "remorques", "tournees", "disponibilites", "matieres", "adresses"];

  function repository(collection) {
    return window.HKRepositories.get(collection);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function fields(material = {}) {
    return [
      { name: "code", label: "Code matière (facultatif)", value: material.code || "" },
      { name: "nom", label: "Nom de la matière", value: material.nom || "", required: true }
    ];
  }

  function openForm(material) {
    window.HKModal.open({
      title: material ? "Modifier la matière" : "Ajouter une matière",
      fields: fields(material),
      onSubmit(data) {
        const payload = { code: data.code.trim(), nom: data.nom.trim() };
        if (material) {
          window.HKStorage.update("matieres", material.id, payload);
        } else {
          window.HKStorage.save("matieres", payload);
        }
        window.HKUI.notify("Matière enregistrée.");
        render();
      }
    });
  }

  function removeMaterial(material) {
    if (!confirm(`Supprimer la matière ${material.nom} ?`)) return;

    window.HKStorage.load("tournees")
      .filter((route) => route.matiereId === material.id)
      .forEach((route) => {
        window.HKStorage.update("tournees", route.id, {
          matiereId: "",
          description: material.nom
        });
      });

    window.HKStorage.remove("matieres", material.id);
    window.HKUI.notify("Matière supprimée. Les tournées existantes conservent son libellé.");
    render();
  }

  function addressFields(address = {}) {
    return [
      { name: "nom", label: "Nom du site ou du client", value: address.nom || "", required: true },
      { name: "adresse", label: "Adresse complète", value: address.adresse || "", required: true, full: true }
    ];
  }

  function openAddressForm(address) {
    window.HKModal.open({
      title: address ? "Modifier l’adresse" : "Ajouter une adresse",
      fields: addressFields(address),
      onSubmit(data) {
        const payload = {
          nom: data.nom.trim(),
          adresse: data.adresse.trim(),
          ordre: address?.ordre ?? window.HKStorage.load("adresses").length
        };
        if (address) {
          window.HKStorage.update("adresses", address.id, payload);
        } else {
          window.HKStorage.save("adresses", payload);
        }
        window.HKUI.notify("Adresse enregistrée.");
        render();
      }
    });
  }

  function removeAddress(address) {
    if (!confirm(`Supprimer l’adresse ${address.nom} ?`)) return;
    window.HKStorage.remove("adresses", address.id);
    window.HKUI.notify("Adresse supprimée. Les tournées existantes restent inchangées.");
    render();
  }

  function bindAddressSorting(workspace) {
    const list = workspace.querySelector("[data-address-list]");
    if (!list) return;
    let draggedRow = null;

    list.querySelectorAll("[data-address-drag]").forEach((handle) => {
      handle.addEventListener("dragstart", (event) => {
        draggedRow = handle.closest("[data-address-row]");
        draggedRow?.classList.add("is-dragging");
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", draggedRow?.dataset.addressRow || "");
      });
      handle.addEventListener("dragend", () => {
        draggedRow?.classList.remove("is-dragging");
        draggedRow = null;
      });
    });

    list.addEventListener("dragover", (event) => {
      if (!draggedRow) return;
      event.preventDefault();
      const target = event.target.closest("[data-address-row]");
      if (!target || target === draggedRow) return;
      const box = target.getBoundingClientRect();
      const insertAfter = event.clientY > box.top + (box.height / 2);
      list.insertBefore(draggedRow, insertAfter ? target.nextSibling : target);
    });

    list.addEventListener("drop", (event) => {
      if (!draggedRow) return;
      event.preventDefault();
      [...list.querySelectorAll("[data-address-row]")].forEach((row, ordre) => {
        window.HKStorage.update("adresses", row.dataset.addressRow, { ordre });
      });
      window.HKUI.notify("Ordre des adresses enregistré.");
      render();
    });
  }

  function saveLogo(file) {
    if (!file) {
      window.HKUI.notify("Sélectionnez une image.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      window.HKUI.notify("Le fichier doit être une image.");
      return;
    }
    if (file.size > 1500000) {
      window.HKUI.notify("Le logo ne doit pas dépasser 1,5 Mo.");
      return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const configuration = window.HKStorage.load("configuration")[0];
      window.HKStorage.update("configuration", configuration.id, { logo: String(reader.result || "") });
      window.location.reload();
    });
    reader.readAsDataURL(file);
  }

  function removeLogo() {
    const configuration = window.HKStorage.load("configuration")[0];
    window.HKStorage.update("configuration", configuration.id, { logo: "" });
    window.location.reload();
  }

  function openSlideshowSettings(configuration) {
    const enabled = Array.isArray(configuration.planningEcrans)
      ? configuration.planningEcrans
      : ["bennes", "semi", "porteurs"];
    window.HKModal.open({
      title: "Paramétrer le diaporama semaine",
      fields: [
        { name: "planningDuree", label: "Durée de chaque écran (secondes)", type: "number", value: configuration.planningDuree || 15, required: true, full: true },
        { name: "ecranBennes", label: "Écrans affichés", type: "checkbox", value: enabled.includes("bennes"), help: "Bennes", full: true },
        { name: "ecranSemi", label: "", type: "checkbox", value: enabled.includes("semi"), help: "Semi-remorques", full: true },
        { name: "ecranPorteurs", label: "", type: "checkbox", value: enabled.includes("porteurs"), help: "Porteurs", full: true }
      ],
      onSubmit(data) {
        const screens = [
          data.ecranBennes ? "bennes" : "",
          data.ecranSemi ? "semi" : "",
          data.ecranPorteurs ? "porteurs" : ""
        ].filter(Boolean);
        if (!screens.length) screens.push("bennes");
        const duration = Math.min(300, Math.max(5, Number(data.planningDuree) || 15));
        const planningVue = screens.includes(configuration.planningVue) ? configuration.planningVue : screens[0];
        window.HKStorage.update("configuration", configuration.id, {
          planningDuree: duration,
          planningEcrans: screens,
          planningVue
        });
        window.HKUI.notify("Paramètres du diaporama enregistrés.");
        render();
      }
    });
  }

  function openLockSettings(configuration) {
    window.HKModal.open({
      title: configuration.verrouillageMotDePasse ? "Modifier le mot de passe" : "Créer le mot de passe",
      fields: [
        { name: "password", label: "Mot de passe", type: "password", value: "", required: true, full: true },
        { name: "confirmation", label: "Confirmer le mot de passe", type: "password", value: "", required: true, full: true }
      ],
      onSubmit(data) {
        if (data.password !== data.confirmation) {
          window.HKUI.notify("Les deux mots de passe ne correspondent pas.");
          return;
        }
        window.HKStorage.update("configuration", configuration.id, { verrouillageMotDePasse: data.password });
        window.HKUI.notify("Mot de passe de verrouillage enregistré.");
        render();
      }
    });
  }

  function saveLockBackground(file) {
    if (!file || !file.type.startsWith("image/")) {
      window.HKUI.notify("Sélectionnez une image valide.");
      return;
    }
    if (file.size > 2500000) {
      window.HKUI.notify("L’image ne doit pas dépasser 2,5 Mo.");
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const configuration = window.HKStorage.load("configuration")[0];
      window.HKStorage.update("configuration", configuration.id, { verrouillageFond: String(reader.result || "") });
      window.HKUI.notify("Fond de verrouillage enregistré.");
      render();
    });
    reader.readAsDataURL(file);
  }

  function removeLockBackground() {
    const configuration = window.HKStorage.load("configuration")[0];
    window.HKStorage.update("configuration", configuration.id, { verrouillageFond: "" });
    window.HKUI.notify("Fond de verrouillage supprimé.");
    render();
  }

  function parseCsvLine(line, delimiter) {
    const values = [];
    let current = "";
    let quoted = false;

    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      if (character === '"' && line[index + 1] === '"' && quoted) {
        current += '"';
        index += 1;
      } else if (character === '"') {
        quoted = !quoted;
      } else if (character === delimiter && !quoted) {
        values.push(current.trim());
        current = "";
      } else {
        current += character;
      }
    }
    values.push(current.trim());
    return values;
  }

  function importCsv(file) {
    if (!file) {
      window.HKUI.notify("Sélectionnez un fichier CSV.");
      return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const text = String(reader.result || "").replace(/^\uFEFF/, "");
      const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      if (!lines.length) {
        window.HKUI.notify("Le fichier CSV est vide.");
        return;
      }

      const delimiter = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ";" : ",";
      const first = parseCsvLine(lines[0], delimiter).map((value) => value.toLowerCase());
      const hasHeader = first.some((value) => ["code", "matiere", "matière", "nom"].includes(value));
      const codeIndex = hasHeader ? first.findIndex((value) => value === "code") : 0;
      const nameIndex = hasHeader ? first.findIndex((value) => ["matiere", "matière", "nom"].includes(value)) : (first.length > 1 ? 1 : 0);
      const existing = window.HKStorage.load("matieres");
      let imported = 0;

      lines.slice(hasHeader ? 1 : 0).forEach((line) => {
        const values = parseCsvLine(line, delimiter);
        const nom = String(values[nameIndex] || "").trim();
        const code = nameIndex === codeIndex ? "" : String(values[codeIndex] || "").trim();
        if (!nom) return;

        const duplicate = existing.some((material) =>
          (code && material.code && material.code.toLowerCase() === code.toLowerCase()) ||
          material.nom.toLowerCase() === nom.toLowerCase()
        );
        if (duplicate) return;

        const saved = window.HKStorage.save("matieres", { code, nom });
        existing.push(saved);
        imported += 1;
      });

      window.HKUI.notify(`${imported} matière${imported === 1 ? "" : "s"} importée${imported === 1 ? "" : "s"}.`);
      render();
    });
    reader.readAsText(file, "utf-8");
  }

  function buildBackup() {
    const collections = Object.fromEntries(
      window.HKRepositories.collections.map((collection) => {
        const values = repository(collection).list();
        if (collection !== "configuration") return [collection, values];
        return [collection, values.map(({ verrouillageMotDePasse, ...configuration }) => configuration)];
      })
    );
    const backup = {
      format: "harz-karreg-backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      collections
    };
    return backup;
  }

  function downloadBackup() {
    const backup = buildBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `harz-karreg-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function validateBackup(candidate) {
    if (!candidate || candidate.format !== "harz-karreg-backup" || candidate.version !== 1) {
      throw new Error("Ce fichier n’est pas une sauvegarde HARZ KARREG compatible.");
    }
    if (!candidate.collections || typeof candidate.collections !== "object") {
      throw new Error("La sauvegarde ne contient aucune collection.");
    }

    const counts = {};
    businessCollections.forEach((collection) => {
      const values = candidate.collections[collection];
      if (!Array.isArray(values)) throw new Error(`Collection manquante ou invalide : ${collection}.`);
      const ids = new Set();
      values.forEach((entity, index) => {
        if (!entity || typeof entity !== "object" || Array.isArray(entity)) {
          throw new Error(`${collection} contient une ligne invalide à la position ${index + 1}.`);
        }
        if (typeof entity.id !== "string" || !entity.id.trim()) {
          throw new Error(`${collection} contient une ligne sans identifiant valide.`);
        }
        if (ids.has(entity.id)) throw new Error(`${collection} contient l’identifiant dupliqué ${entity.id}.`);
        ids.add(entity.id);
      });
      counts[collection] = values.length;
    });

    const lookup = Object.fromEntries(
      ["conducteurs", "camions", "bennes", "remorques", "matieres"].map((collection) => [
        collection,
        new Set(candidate.collections[collection].map((entity) => entity.id))
      ])
    );
    const references = [
      ["conducteurId", "conducteurs", "chauffeur"],
      ["camionId", "camions", "camion"],
      ["benneId", "bennes", "benne"],
      ["remorqueId", "remorques", "remorque"],
      ["matiereId", "matieres", "matière"]
    ];
    const warnings = [];
    candidate.collections.tournees.forEach((route) => {
      references.forEach(([field, collection, label]) => {
        if (route[field] && !lookup[collection].has(route[field])) {
          warnings.push(`${route.nom || route.id} : ${label} introuvable (${route[field]}).`);
        }
      });
    });

    return { backup: candidate, counts, warnings };
  }

  function replaceBusinessData(report) {
    const previous = Object.fromEntries(
      businessCollections.map((collection) => [collection, repository(collection).list()])
    );

    try {
      businessCollections.forEach((collection) => {
        repository(collection).clear();
        report.backup.collections[collection].forEach((entity) => repository(collection).create(entity));
      });
    } catch (error) {
      businessCollections.forEach((collection) => {
        repository(collection).clear();
        previous[collection].forEach((entity) => repository(collection).create(entity));
      });
      throw error;
    }
  }

  function openRestorePreview(report) {
    const collectionLabels = {
      conducteurs: "Chauffeurs",
      camions: "Camions",
      bennes: "Bennes",
      remorques: "Remorques",
      tournees: "Tournées",
      disponibilites: "Disponibilités",
      matieres: "Matières",
      adresses: "Adresses"
    };
    window.HKModal.openContent({
      title: "Aperçu de la restauration",
      eyebrow: "Sauvegarde validée",
      className: "backup-preview-modal",
      content: `
        <div class="backup-count-grid">
          ${businessCollections.map((collection) => `<div><strong>${report.counts[collection]}</strong><span>${collectionLabels[collection]}</span></div>`).join("")}
        </div>
        ${report.warnings.length ? `
          <div class="backup-warning-list">
            <strong>${report.warnings.length} référence${report.warnings.length === 1 ? " à vérifier" : "s à vérifier"}</strong>
            <ul>${report.warnings.slice(0, 8).map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul>
          </div>
        ` : '<p class="backup-validation-ok">Toutes les références de tournées sont cohérentes.</p>'}
        <p class="settings-help">Les données métier actuelles seront remplacées. La configuration de l’interface et le mot de passe local seront conservés.</p>
        <form class="backup-confirm-form" data-backup-confirm-form>
          <label for="backup-confirmation">Saisissez RESTAURER pour confirmer</label>
          <input class="input" id="backup-confirmation" name="confirmation" autocomplete="off" required>
          <div class="actions">
            <button class="button ghost" type="button" data-close>Annuler</button>
            <button class="button danger" type="submit">Restaurer les données</button>
          </div>
        </form>
      `,
      onOpen(root) {
        root.querySelector("[data-backup-confirm-form]").addEventListener("submit", (event) => {
          event.preventDefault();
          const confirmation = new FormData(event.currentTarget).get("confirmation");
          if (String(confirmation || "").trim() !== "RESTAURER") {
            window.HKUI.notify("Confirmation incorrecte. Aucune donnée modifiée.");
            return;
          }
          try {
            replaceBusinessData(report);
            window.HKModal.close();
            window.HKUI.notify("Sauvegarde restaurée avec succès.");
            render();
          } catch (error) {
            window.HKUI.notify(`Restauration annulée : ${error.message}`);
          }
        });
      }
    });
  }

  async function importBackup(file) {
    if (!file) {
      window.HKUI.notify("Sélectionnez une sauvegarde JSON.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      window.HKUI.notify("La sauvegarde ne doit pas dépasser 10 Mo.");
      return;
    }
    try {
      const report = validateBackup(JSON.parse(await file.text()));
      openRestorePreview(report);
    } catch (error) {
      window.HKUI.notify(`Sauvegarde invalide : ${error.message}`);
    }
  }

  function openDataReset() {
    window.HKModal.open({
      title: "Réinitialiser les données métier",
      submitLabel: "Sauvegarder et réinitialiser",
      fields: [
        {
          name: "confirmation",
          label: "Saisissez REINITIALISER pour confirmer",
          value: "",
          required: true,
          full: true
        }
      ],
      onSubmit(data) {
        if (data.confirmation.trim() !== "REINITIALISER") {
          window.HKUI.notify("Confirmation incorrecte. Aucune donnée supprimée.");
          return false;
        }
        downloadBackup();
        businessCollections.forEach((collection) => repository(collection).clear());
        window.HKUI.notify("Les données métier ont été réinitialisées. Une sauvegarde JSON a été téléchargée.");
        render();
        return true;
      }
    });
  }

  function render() {
    if (document.body.dataset.page !== "settings") return;
    const workspace = document.querySelector("#workspace");
    const materials = window.HKStorage.load("matieres")
      .slice()
      .sort((a, b) => `${a.code} ${a.nom}`.localeCompare(`${b.code} ${b.nom}`, "fr"));
    const addresses = window.HKStorage.load("adresses")
      .map((address, index) => ({ ...address, _position: index }))
      .sort((a, b) => (a.ordre ?? a._position) - (b.ordre ?? b._position));
    const configuration = window.HKStorage.load("configuration")[0] || {};

    workspace.innerHTML = `
      <section class="settings-grid">
        <article class="card panel material-panel">
          <div class="section-header">
            <div>
              <h2>Référentiel des matières</h2>
              <p class="settings-help">Le code est facultatif et permet d’identifier rapidement les libellés longs.</p>
            </div>
            <button class="button primary" type="button" data-add-material>+ Matière</button>
          </div>
          <div class="material-list">
            ${materials.length ? materials.map((material) => `
              <div class="material-row">
                <span class="material-code">${escapeHtml(material.code || "—")}</span>
                <strong>${escapeHtml(material.nom)}</strong>
                <div class="actions">
                  <button class="icon-button" type="button" data-edit-material="${material.id}" aria-label="Modifier ${escapeHtml(material.nom)}">✎</button>
                  <button class="icon-button" type="button" data-delete-material="${material.id}" aria-label="Supprimer ${escapeHtml(material.nom)}">×</button>
                </div>
              </div>
            `).join("") : '<div class="settings-empty">Aucune matière enregistrée.</div>'}
          </div>
        </article>

        <article class="card panel csv-panel">
          <span class="day-panel-label">Import en masse</span>
          <h2>Importer un fichier CSV</h2>
          <p class="settings-help">Colonnes acceptées : <strong>code,matiere</strong> ou <strong>code;matiere</strong>. Une ligne correspond à une matière.</p>
          <label class="csv-dropzone">
            <span>Choisir un fichier .csv</span>
            <input type="file" accept=".csv,text/csv" data-material-csv>
          </label>
          <button class="button primary" type="button" data-import-materials>Importer les matières</button>
          <div class="csv-example">
            <strong>Exemple</strong>
            <code>code;matiere<br>CU;Cuivre<br>LAI;Laiton<br>ALU;Aluminium</code>
          </div>
        </article>

        <article class="card panel address-panel">
          <div class="section-header">
            <div>
              <h2>Carnet d’adresses</h2>
              <p class="settings-help">Ces adresses sont proposées dans les champs Départ et Arrivée. Glissez la poignée pour modifier leur ordre.</p>
            </div>
            <button class="button primary" type="button" data-add-address>+ Adresse</button>
          </div>
          <div class="material-list" data-address-list>
            ${addresses.length ? addresses.map((address) => `
              <div class="address-row" data-address-row="${address.id}">
                <button class="address-drag-handle" type="button" draggable="true" data-address-drag aria-label="Déplacer ${escapeHtml(address.nom)}" title="Glisser pour réordonner">⋮⋮</button>
                <div>
                  <strong>${escapeHtml(address.nom)}</strong>
                  <span>${escapeHtml(address.adresse)}</span>
                </div>
                <div class="actions">
                  <button class="icon-button" type="button" data-edit-address="${address.id}" aria-label="Modifier ${escapeHtml(address.nom)}">✎</button>
                  <button class="icon-button" type="button" data-delete-address="${address.id}" aria-label="Supprimer ${escapeHtml(address.nom)}">×</button>
                </div>
              </div>
            `).join("") : '<div class="settings-empty">Aucune adresse enregistrée.</div>'}
          </div>
        </article>

        <article class="card panel logo-panel">
          <div>
            <span class="day-panel-label">Identité visuelle</span>
            <h2>Logo de l’entreprise</h2>
            <p class="settings-help">Le logo remplace le sigle HK dans la navigation et reste enregistré sur cet appareil.</p>
          </div>
          <div class="logo-setting-preview">
            ${configuration.logo ? `<img src="${configuration.logo}" alt="Logo personnalisé">` : '<strong>HK</strong>'}
          </div>
          <label class="csv-dropzone logo-file-field">
            <span>Choisir un logo</span>
            <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" data-logo-file>
          </label>
          <div class="actions">
            <button class="button primary" type="button" data-save-logo>Appliquer le logo</button>
            ${configuration.logo ? '<button class="button ghost" type="button" data-remove-logo>Logo HK par défaut</button>' : ""}
          </div>
        </article>

        <article class="card panel slideshow-settings-panel">
          <div>
            <span class="day-panel-label">Projection sur écran</span>
            <h2>Diaporama semaine</h2>
            <p class="settings-help">Choisissez la durée et les plannings qui défilent dans la modale semaine.</p>
          </div>
          <div class="slideshow-setting-summary">
            <strong>${configuration.planningDuree || 15} secondes</strong>
            <span>${(configuration.planningEcrans || ["bennes", "semi", "porteurs"]).map((value) => ({ bennes: "Bennes", semi: "Semi-remorques", porteurs: "Porteurs" }[value])).join(" · ")}</span>
          </div>
          <button class="button primary" type="button" data-slideshow-settings>Configurer</button>
        </article>

        <article class="card panel lock-settings-panel">
          <div>
            <span class="day-panel-label">Confidentialité de l’écran</span>
            <h2>Écran de verrouillage</h2>
            <p class="settings-help">Définissez le mot de passe et l’image affichée lorsque le planning est masqué.</p>
          </div>
          <div class="lock-background-preview ${configuration.verrouillageFond ? "has-image" : ""}" ${configuration.verrouillageFond ? `style="background-image:url('${configuration.verrouillageFond}')"` : ""}>
            <span>${configuration.verrouillageFond ? "Aperçu" : "Fond par défaut"}</span>
          </div>
          <div class="lock-settings-actions">
            <button class="button primary" type="button" data-lock-password>${configuration.verrouillageMotDePasse ? "Modifier le mot de passe" : "Créer le mot de passe"}</button>
            <label class="button ghost lock-background-file">
              Importer un fond
              <input type="file" accept="image/png,image/jpeg,image/webp" data-lock-background>
            </label>
            ${configuration.verrouillageFond ? '<button class="button ghost" type="button" data-remove-lock-background>Fond par défaut</button>' : ""}
          </div>
          <p class="settings-help lock-status">${configuration.verrouillageMotDePasse ? "Verrouillage prêt à être utilisé." : "Aucun mot de passe défini."}</p>
        </article>

        <article class="card panel reset-data-panel">
          <div>
            <span class="day-panel-label">Administration locale</span>
            <h2>Remise à zéro des données</h2>
            <p class="settings-help">Télécharge une sauvegarde JSON, puis vide les chauffeurs, véhicules, remorques, bennes, tournées, disponibilités, matières et adresses. La configuration de l’interface est conservée.</p>
          </div>
          <button class="button danger" type="button" data-reset-business-data>Réinitialiser les données métier</button>
        </article>

        <article class="card panel backup-data-panel">
          <div>
            <span class="day-panel-label">Continuité des données</span>
            <h2>Sauvegarder et restaurer</h2>
            <p class="settings-help">Exportez les données métier dans un fichier JSON ou contrôlez une sauvegarde avant de la restaurer. Aucun remplacement n’est effectué sans aperçu et confirmation.</p>
          </div>
          <div class="backup-data-actions">
            <button class="button primary" type="button" data-export-backup>Exporter une sauvegarde</button>
            <label class="button ghost backup-file-field">
              Choisir une sauvegarde JSON
              <input type="file" accept="application/json,.json" data-backup-file>
            </label>
            <button class="button ghost" type="button" data-import-backup>Contrôler et restaurer</button>
          </div>
        </article>
      </section>
    `;

    workspace.querySelector("[data-add-material]").addEventListener("click", () => openForm());
    workspace.querySelectorAll("[data-edit-material]").forEach((button) => {
      button.addEventListener("click", () => openForm(materials.find((material) => material.id === button.dataset.editMaterial)));
    });
    workspace.querySelectorAll("[data-delete-material]").forEach((button) => {
      button.addEventListener("click", () => {
        const material = materials.find((item) => item.id === button.dataset.deleteMaterial);
        if (material) removeMaterial(material);
      });
    });
    workspace.querySelector("[data-import-materials]").addEventListener("click", () => {
      importCsv(workspace.querySelector("[data-material-csv]").files[0]);
    });
    workspace.querySelector("[data-add-address]").addEventListener("click", () => openAddressForm());
    workspace.querySelectorAll("[data-edit-address]").forEach((button) => {
      button.addEventListener("click", () => openAddressForm(addresses.find((address) => address.id === button.dataset.editAddress)));
    });
    workspace.querySelectorAll("[data-delete-address]").forEach((button) => {
      button.addEventListener("click", () => {
        const address = addresses.find((item) => item.id === button.dataset.deleteAddress);
        if (address) removeAddress(address);
      });
    });
    bindAddressSorting(workspace);
    workspace.querySelector("[data-save-logo]").addEventListener("click", () => {
      saveLogo(workspace.querySelector("[data-logo-file]").files[0]);
    });
    workspace.querySelector("[data-remove-logo]")?.addEventListener("click", removeLogo);
    workspace.querySelector("[data-slideshow-settings]").addEventListener("click", () => openSlideshowSettings(configuration));
    workspace.querySelector("[data-lock-password]").addEventListener("click", () => openLockSettings(configuration));
    workspace.querySelector("[data-lock-background]").addEventListener("change", (event) => saveLockBackground(event.target.files[0]));
    workspace.querySelector("[data-remove-lock-background]")?.addEventListener("click", removeLockBackground);
    workspace.querySelector("[data-reset-business-data]").addEventListener("click", openDataReset);
    workspace.querySelector("[data-export-backup]").addEventListener("click", downloadBackup);
    workspace.querySelector("[data-import-backup]").addEventListener("click", () => {
      importBackup(workspace.querySelector("[data-backup-file]").files[0]);
    });
  }

  window.HKSettings = { render };
})();
