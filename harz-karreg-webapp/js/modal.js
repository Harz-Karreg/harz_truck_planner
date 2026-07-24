(function () {
  function root() {
    let node = document.querySelector(".modal-root");
    if (!node) {
      node = document.createElement("div");
      node.className = "modal-root";
      document.body.appendChild(node);
    }
    return node;
  }

  function close() {
    root().classList.remove("open");
    root().innerHTML = "";
  }

  function fieldTemplate(field) {
    const value = field.value ?? "";
    const required = field.required ? "required" : "";
    const full = field.full ? " full" : "";
    if (field.type === "textarea") {
      return `<div class="field${full}"><label>${field.label}</label><textarea class="textarea" name="${field.name}" ${required}>${value}</textarea></div>`;
    }
    if (field.type === "select") {
      return `
        <div class="field${full}">
          <label>${field.label}</label>
          <select class="select" name="${field.name}" ${required}>
            ${(field.options || []).map((option) => `<option value="${option.value}" ${String(option.value) === String(value) ? "selected" : ""} ${option.disabled ? "disabled" : ""}>${option.label}</option>`).join("")}
          </select>
        </div>`;
    }
    if (field.type === "checkbox") {
      return `
        <div class="field${full}">
          <label>${field.label}</label>
          <span class="checkbox-row"><input type="checkbox" name="${field.name}" ${value ? "checked" : ""}> ${field.help || "Actif"}</span>
        </div>`;
    }
    return `<div class="field${full}"><label>${field.label}</label><input class="input" type="${field.type || "text"}" name="${field.name}" value="${value}" ${required}></div>`;
  }

  function collect(form) {
    const data = {};
    [...form.elements].forEach((input) => {
      if (!input.name) return;
      if (input.type === "checkbox") {
        data[input.name] = input.checked;
      } else {
        data[input.name] = input.value;
      }
    });
    return data;
  }

  function open(config) {
    const node = root();
    node.innerHTML = `
      <form class="modal">
        <div class="modal-header">
          <h3>${config.title}</h3>
          <button class="icon-button" type="button" data-close aria-label="Fermer">x</button>
        </div>
        <div class="modal-body">
          ${config.fields.map(fieldTemplate).join("")}
        </div>
        <div class="modal-footer">
          <button class="button ghost" type="button" data-close>Annuler</button>
          <button class="button primary" type="submit">${config.submitLabel || "Enregistrer"}</button>
        </div>
      </form>
    `;
    node.classList.add("open");
    node.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", close));
    node.addEventListener("click", (event) => {
      if (event.target === node) close();
    }, { once: true });
    node.querySelector("form").addEventListener("submit", (event) => {
      event.preventDefault();
      config.onSubmit(collect(event.currentTarget));
      close();
    });
  }

  window.HKModal = { close, open };
})();
