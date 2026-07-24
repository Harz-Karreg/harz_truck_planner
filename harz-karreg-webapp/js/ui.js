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
    { page: "settings", label: "Paramètres", href: "#" }
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
    return `
      <div class="app-layout${collapsed ? " sidebar-collapsed" : ""}">
        <aside class="sidebar">
          <a class="brand" href="index.html" aria-label="Harz Karreg">
            <span class="brand-mark">HK</span>
            <span class="brand-copy">
              <strong class="brand-title">Harz Karreg</strong>
              <span class="brand-subtitle">Local fleet intelligence</span>
            </span>
          </a>
          <button class="sidebar-toggle" id="sidebar-toggle" type="button" aria-expanded="${String(!collapsed)}" aria-label="${collapsed ? "Déployer la navigation" : "Rétracter la navigation"}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 7-5 5 5 5"/></svg>
          </button>
          <nav class="nav" aria-label="Navigation principale">
            ${nav.map((item) => `
              <a class="nav-link ${item.href === currentFile || (currentFile === "" && item.href === "index.html") ? "active" : ""}" href="${item.href}" title="${item.label}">
                <span class="nav-icon" aria-hidden="true">${icons[item.page]}</span>
                <span class="nav-label">${item.label}</span>
              </a>`).join("")}
          </nav>
          <div class="side-panel">
            <strong>Local first</strong>
            <p>Données persistées dans le navigateur. Aucun serveur, aucune base externe.</p>
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
          <footer class="footer">Harz Karreg MVP - application locale sans backend.</footer>
        </main>
      </div>
    `;
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

  window.HKUI = { avatar, badge, el, initials, initSidebar, notify, renderStats, routeStatusLabel, setActions, shell };
})();
