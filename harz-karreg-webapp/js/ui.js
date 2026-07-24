(function () {
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

  function shell(page) {
    const copy = pageCopy[page] || pageCopy.planning;
    const currentFile = location.pathname.split("/").pop() || "index.html";
    return `
      <div class="app-layout">
        <aside class="sidebar">
          <a class="brand" href="index.html" aria-label="Harz Karreg">
            <span class="brand-mark">HK</span>
            <span>
              <strong class="brand-title">Harz Karreg</strong>
              <span class="brand-subtitle">Local fleet intelligence</span>
            </span>
          </a>
          <nav class="nav" aria-label="Navigation principale">
            ${nav.map((item) => `
              <a class="nav-link ${item.href === currentFile || (currentFile === "" && item.href === "index.html") ? "active" : ""}" href="${item.href}">
                <span class="nav-icon" aria-hidden="true"></span>
                <span>${item.label}</span>
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

  window.HKUI = { avatar, badge, el, initials, notify, renderStats, routeStatusLabel, setActions, shell };
})();
