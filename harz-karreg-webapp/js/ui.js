(function () {
  const icons = {
    dashboard: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/></svg>',
    planning: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3v3M18 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z"/></svg>',
    conducteurs: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></svg>',
    camions: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
    bennes: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16l-2 10H6L4 7ZM8 7V4h8v3"/><circle cx="8" cy="19" r="1.5"/><circle cx="16" cy="19" r="1.5"/></svg>',
    remorques: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h17v11H3zM20 14h2M6 17v2M17 17v2"/><circle cx="7" cy="19" r="2"/><circle cx="17" cy="19" r="2"/></svg>',
    tournees: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M7.5 16.5 16.5 7.5M7 6h5M12 6l-2-2M12 6l-2 2"/></svg>',
    settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1A7 7 0 0 0 14.8 6L14.5 3h-5L9.2 6a7 7 0 0 0-1.7 1.1l-2.4-1-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1A7 7 0 0 0 9.2 18l.3 3h5l.3-3a7 7 0 0 0 1.7-1.1l2.4 1 2-3.4-2-1.5a7 7 0 0 0 .1-1Z"/></svg>'
  };

  const nav = [
    { page: "dashboard", label: "Dashboard", href: "index.html" },
    { page: "planning", label: "Planning", href: "planning.html" },
    { page: "conducteurs", label: "Conducteurs", href: "conducteurs.html" },
    { page: "camions", label: "Camions", href: "camions.html" },
    { page: "bennes", label: "Bennes", href: "bennes.html" },
    { page: "remorques", label: "Remorques", href: "remorques.html" },
    { page: "tournees", label: "Tournées", href: "tournees.html" },
    { page: "settings", label: "Paramètres", href: "settings.html" }
  ];

  const pageCopy = {
    dashboard: {
      eyebrow: "Vue executive",
      title: "Dashboard",
      subtitle: "Indicateurs clés de l'activité transport locale: chauffeurs, camions, bennes, remorques et tournées."
    },
    planning: {
      eyebrow: "Operations hebdomadaires",
      title: "Planning transport",
      subtitle: "Vue semaine, affectations conducteurs et tournées glissables entre les jours."
    },
    conducteurs: {
      eyebrow: "Capital humain",
      title: "Conducteurs",
      subtitle: "Suivi des disponibilités, permis, contacts et états opérationnels."
    },
    camions: {
      eyebrow: "Parc moteur",
      title: "Camions",
      subtitle: "Gestion des tracteurs avec marque, modèle et immatriculation."
    },
    bennes: {
      eyebrow: "Materiel vrac",
      title: "Bennes",
      subtitle: "Gestion des bennes par nom et capacité petite, moyenne ou grande."
    },
    remorques: {
      eyebrow: "Capacite flotte",
      title: "Remorques",
      subtitle: "Inventaire opérationnel des remorques, statuts de disponibilité et observations."
    },
    tournees: {
      eyebrow: "Execution terrain",
      title: "Tournées",
      subtitle: "Creation et suivi des missions. Chaque tournée datée apparait dans le planning."
    },
    settings: {
      eyebrow: "Référentiels locaux",
      title: "Paramètres",
      subtitle: "Gérez les matières proposées lors de la création des tournées et importez votre référentiel CSV."
    }
  };

  function el(tag, className, content) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.textContent = content;
    return node;
  }

  function initials(parts) {
    return parts.filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  }

  function avatar(photo, label) {
    const node = el("div", "avatar");
    if (photo) {
      const img = document.createElement("img");
      img.src = photo;
      img.alt = label;
      node.appendChild(img);
    } else {
      node.textContent = initials(label.split(" "));
    }
    return node;
  }

  function badge(value) {
    const variants = {
      Disponible: "success",
      "En mission": "info",
      "En repos": "warning",
      Maintenance: "warning",
      Petite: "info",
      Moyenne: "warning",
      Grande: "success",
      Planifiee: "info",
      "En cours": "warning",
      Terminee: "success",
      Annulee: "danger"
    };
    return el("span", `badge ${variants[value] || ""}`.trim(), value);
  }

  function routeStatusLabel(value) {
    const labels = {
      Planifiee: "Planifiée",
      Terminee: "Terminée",
      Annulee: "Annulée"
    };
    return labels[value] || value;
  }

  function notify(message) {
    let root = document.querySelector(".toast-root");
    if (!root) {
      root = el("div", "toast-root");
      document.body.appendChild(root);
    }
    const toast = el("div", "toast", message);
    root.appendChild(toast);
    setTimeout(() => toast.remove(), 2800);
  }

  function sidebarCollapsed() {
    try {
      return localStorage.getItem("hk-sidebar-collapsed") === "true";
    } catch (_error) {
      return false;
    }
  }

  function displaySettings() {
    try {
      const saved = JSON.parse(localStorage.getItem("hk-display-settings") || "{}");
      return {
        zoom: Math.min(Math.max(Number(saved.zoom) || 1, 0.8), 1.2),
        fontSize: Math.min(Math.max(Number(saved.fontSize) || 16, 14), 20)
      };
    } catch (_error) {
      return { zoom: 1, fontSize: 16 };
    }
  }

  function applyDisplaySettings(settings) {
    document.documentElement.style.setProperty("--ui-zoom", String(settings.zoom));
    document.documentElement.style.setProperty("--ui-font-size", `${settings.fontSize}px`);
    document.querySelector("[data-display-value='zoom']")?.replaceChildren(`${Math.round(settings.zoom * 100)}%`);
    document.querySelector("[data-display-value='font']")?.replaceChildren(`${settings.fontSize}px`);
    try {
      localStorage.setItem("hk-display-settings", JSON.stringify(settings));
    } catch (_error) {
      // Les réglages restent actifs pour la session si le stockage est indisponible.
    }
  }

  function initDisplayControls() {
    let settings = displaySettings();
    applyDisplaySettings(settings);
    const menu = document.querySelector(".interface-menu");
    const menuButton = document.querySelector("#interface-settings-button");

    menuButton?.addEventListener("click", (event) => {
      event.stopPropagation();
      const open = menu.classList.toggle("open");
      menuButton.setAttribute("aria-expanded", String(open));
    });
    document.addEventListener("click", (event) => {
      if (!menu?.contains(event.target)) {
        menu?.classList.remove("open");
        menuButton?.setAttribute("aria-expanded", "false");
      }
    });

    document.querySelectorAll("[data-display-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.displayAction;
        if (action === "zoom-out") settings.zoom = Math.max(0.8, Number((settings.zoom - 0.1).toFixed(1)));
        if (action === "zoom-in") settings.zoom = Math.min(1.2, Number((settings.zoom + 0.1).toFixed(1)));
        if (action === "font-down") settings.fontSize = Math.max(14, settings.fontSize - 1);
        if (action === "font-up") settings.fontSize = Math.min(20, settings.fontSize + 1);
        applyDisplaySettings(settings);
      });
    });
  }

  function initSidebar() {
    const layout = document.querySelector(".app-layout");
    const toggle = document.querySelector("#sidebar-toggle");
    if (!layout || !toggle) return;

    function applyState(collapsed) {
      layout.classList.toggle("sidebar-collapsed", collapsed);
      toggle.setAttribute("aria-expanded", String(!collapsed));
      toggle.setAttribute("aria-label", collapsed ? "Déployer la navigation" : "Rétracter la navigation");
      toggle.title = collapsed ? "Déployer la navigation" : "Rétracter la navigation";
      try {
        localStorage.setItem("hk-sidebar-collapsed", String(collapsed));
      } catch (_error) {
        // La navigation reste fonctionnelle si le stockage local est indisponible.
      }
    }

    toggle.addEventListener("click", () => {
      applyState(!layout.classList.contains("sidebar-collapsed"));
    });
  }

  function shell(page) {
    const copy = pageCopy[page] || pageCopy.planning;
    const currentFile = location.pathname.split("/").pop() || "index.html";
    const collapsed = sidebarCollapsed();
    const configuration = window.HKStorage.load("configuration")[0] || {};
    const brandMark = configuration.logo
      ? `<span class="brand-mark brand-mark-image"><img src="${configuration.logo}" alt="Logo Harz Karreg"></span>`
      : '<span class="brand-mark">HK</span>';
    return `
      <div class="app-layout${collapsed ? " sidebar-collapsed" : ""}">
        <aside class="sidebar">
          <a class="brand" href="../src/renderer/startup/index.html" aria-label="Retour au choix du mode" title="Changer de mode">
            ${brandMark}
            <span class="brand-copy">
              <strong class="brand-title">Harz Karreg</strong>
              <span class="brand-subtitle">DRIVE BEYOND.</span>
            </span>
          </a>
          <button class="sidebar-toggle" id="sidebar-toggle" type="button" aria-expanded="${String(!collapsed)}" aria-label="${collapsed ? "Déployer la navigation" : "Rétracter la navigation"}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 7-5 5 5 5"/></svg>
          </button>
          <nav class="nav" aria-label="Navigation principale">
            ${nav.filter((item) => item.page !== "settings").map((item) => `
              <a class="nav-link ${item.href === currentFile || (currentFile === "" && item.href === "index.html") ? "active" : ""}" href="${item.href}" title="${item.label}">
                <span class="nav-icon" aria-hidden="true">${icons[item.page]}</span>
                <span class="nav-label">${item.label}</span>
              </a>`).join("")}
          </nav>
          <div class="sidebar-tools">
            <a class="sidebar-tool-button ${page === "settings" ? "active" : ""}" href="settings.html" title="Paramètres">
              ${icons.settings}<span class="sidebar-tool-label">Paramètres</span>
            </a>
            <button class="sidebar-tool-button sidebar-screen-lock" id="screen-lock-button" type="button" aria-label="Verrouiller l’écran" title="Verrouiller l’écran">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.8"/></svg>
              <span class="sidebar-tool-label">Verrouiller</span>
            </button>
            <div class="interface-menu">
              <button class="sidebar-tool-button" id="interface-settings-button" type="button" aria-expanded="false" aria-label="Réglages de l’interface" title="Réglages de l’interface">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M7 14v6"/></svg>
                <span class="sidebar-tool-label">Interface</span>
              </button>
              <div class="interface-popover">
                <strong>Réglages de l’interface</strong>
                <div class="display-controls" aria-label="Réglages d’affichage">
                  <div class="display-control-row">
                    <span class="display-control-label">Zoom</span>
                    <button type="button" data-display-action="zoom-out" aria-label="Dézoomer" title="Dézoomer">−</button>
                    <output data-display-value="zoom">100%</output>
                    <button type="button" data-display-action="zoom-in" aria-label="Zoomer" title="Zoomer">+</button>
                  </div>
                  <div class="display-control-row">
                    <span class="display-control-label">Texte</span>
                    <button type="button" data-display-action="font-down" aria-label="Réduire la taille du texte" title="Réduire le texte">A−</button>
                    <output data-display-value="font">16px</output>
                    <button type="button" data-display-action="font-up" aria-label="Augmenter la taille du texte" title="Agrandir le texte">A+</button>
                  </div>
                </div>
              </div>
            </div>
            <div class="side-panel side-version">Version 0.1.4</div>
          </div>
        </aside>
        <main class="main-frame">
          <header class="topbar">
            <div>
              <p class="eyebrow">${copy.eyebrow}</p>
              <h1 class="page-title">${copy.title}</h1>
              <p class="page-subtitle">${copy.subtitle}</p>
            </div>
            <div class="toolbar" id="page-actions"></div>
          </header>
          <section class="workspace" id="workspace"></section>
          <footer class="footer">
            <span class="footer-copyright">Harz Karreg 2026</span>
            <div class="footer-signature">
              <strong>DRIVE BEYOND.</strong>
              <span>Augmented Intelligence for Smarter Mobility.</span>
            </div>
          </footer>
        </main>
      </div>
    `;
  }

  function initScreenLock() {
    const button = document.querySelector("#screen-lock-button");
    if (!button) return;

    const showLockScreen = () => {
      const configuration = window.HKStorage.load("configuration")[0] || {};
      if (!configuration.verrouillageMotDePasse) {
        notify("Définissez d’abord un mot de passe dans Paramètres.");
        return;
      }
      sessionStorage.setItem("hk-screen-locked", "true");
      let overlay = document.querySelector(".screen-lock-overlay");
      if (!overlay) {
        overlay = document.createElement("div");
        overlay.className = "screen-lock-overlay";
        document.body.appendChild(overlay);
      }
      overlay.style.setProperty("--lock-background", configuration.verrouillageFond ? `url("${configuration.verrouillageFond}")` : "none");
      overlay.innerHTML = `
        <div class="screen-lock-shade"></div>
        <form class="screen-lock-card">
          <div class="screen-lock-brand">${configuration.logo ? `<img src="${configuration.logo}" alt="Logo Harz Karreg">` : "HK"}</div>
          <span class="modal-eyebrow">Écran verrouillé</span>
          <h2>Harz Karreg</h2>
          <p>Saisissez le mot de passe pour retrouver le planning.</p>
          <input class="input" type="password" name="password" placeholder="Mot de passe" autocomplete="current-password" required>
          <small class="screen-lock-error" aria-live="polite"></small>
          <button class="button primary" type="submit">Déverrouiller</button>
        </form>
      `;
      overlay.classList.add("open");
      const input = overlay.querySelector("input");
      input.focus();
      overlay.querySelector("form").addEventListener("submit", (event) => {
        event.preventDefault();
        if (input.value !== configuration.verrouillageMotDePasse) {
          overlay.querySelector(".screen-lock-error").textContent = "Mot de passe incorrect.";
          input.select();
          return;
        }
        sessionStorage.removeItem("hk-screen-locked");
        overlay.classList.remove("open");
        overlay.innerHTML = "";
      });
    };

    button.addEventListener("click", showLockScreen);
    if (sessionStorage.getItem("hk-screen-locked") === "true") showLockScreen();
  }

  function renderStats(target) {
    const drivers = window.HKStorage.load("conducteurs");
    const trucks = window.HKStorage.load("camions");
    const bins = window.HKStorage.load("bennes");
    const trailers = window.HKStorage.load("remorques");
    const routes = window.HKStorage.load("tournees");
    target.innerHTML = `
      <div class="stat-grid">
        <article class="card stat-card">
          <p class="stat-label">Conducteurs</p>
          <p class="stat-value">${drivers.length}</p>
          <p class="stat-meta">${drivers.filter((item) => item.statut === "Disponible").length} disponibles</p>
        </article>
        <article class="card stat-card">
          <p class="stat-label">Camions</p>
          <p class="stat-value">${trucks.length}</p>
          <p class="stat-meta">${bins.length} bennes référencées</p>
        </article>
        <article class="card stat-card">
          <p class="stat-label">Remorques</p>
          <p class="stat-value">${trailers.length}</p>
          <p class="stat-meta">${trailers.filter((item) => item.statut === "Disponible").length} prêtes</p>
        </article>
        <article class="card stat-card">
          <p class="stat-label">Tournées</p>
          <p class="stat-value">${routes.length}</p>
          <p class="stat-meta">${routes.filter((item) => item.statut === "En cours").length} en cours</p>
        </article>
      </div>
    `;
  }

  function setActions(html) {
    document.querySelector("#page-actions").innerHTML = html;
  }

  window.HKUI = { avatar, badge, el, initials, initDisplayControls, initScreenLock, initSidebar, notify, renderStats, routeStatusLabel, setActions, shell };
})();
