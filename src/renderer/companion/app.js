(function () {
  const preferencesKey = "harz-karreg:companion-preferences";
  const dayNames = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
  let weekOffset = 0;
  const elements = {
    grid: document.querySelector("#planning-grid"), empty: document.querySelector("#empty-state"),
    range: document.querySelector("#week-range"), sync: document.querySelector("#sync-status"),
    departure: document.querySelector("#departure-filter"), driver: document.querySelector("#driver-filter"), truck: document.querySelector("#truck-filter")
  };

  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }
  function localIso(date) {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  }
  function weekDays(offset) {
    const today = new Date();
    const weekday = today.getDay() || 7;
    const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - weekday + 1 + offset * 7);
    return dayNames.map((name, index) => {
      const date = new Date(monday); date.setDate(monday.getDate() + index);
      return { name, date, iso: localIso(date) };
    });
  }
  function formatDate(date, options) { return new Intl.DateTimeFormat("fr-FR", options).format(date); }
  function loadPreferences() {
    try { return JSON.parse(window.localStorage.getItem(preferencesKey) || "{}") || {}; } catch { return {}; }
  }
  function savePreferences() {
    const visibleColumns = [...document.querySelectorAll(".column-picker input:checked")].map((input) => input.value);
    window.localStorage.setItem(preferencesKey, JSON.stringify({ departure: elements.departure.value, driver: elements.driver.value, truck: elements.truck.value, visibleColumns }));
  }
  function indexById(items) { return Object.fromEntries(items.map((item) => [item.id, item])); }
  function fillSelect(select, items, value, label) {
    const firstOption = select.options[0]; select.replaceChildren(firstOption);
    items.forEach((item) => { const option = document.createElement("option"); option.value = value(item); option.textContent = label(item); select.append(option); });
  }
  function hydrateFilters(data, preferences) {
    const departures = [...new Set(data.tours.map((tour) => tour.depart).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
    fillSelect(elements.departure, departures, (item) => item, (item) => item);
    fillSelect(elements.driver, data.drivers, (item) => item.id, (item) => `${item.prenom} ${item.nom}`);
    fillSelect(elements.truck, data.trucks, (item) => item.id, (item) => `${item.immatriculation} · ${item.marque || ""} ${item.modele || ""}`.trim());
    elements.departure.value = preferences.departure || ""; elements.driver.value = preferences.driver || ""; elements.truck.value = preferences.truck || "";
    if (Array.isArray(preferences.visibleColumns)) document.querySelectorAll(".column-picker input").forEach((input) => { input.checked = preferences.visibleColumns.includes(input.value); });
  }
  function readData() {
    const service = window.HKCompanionData;
    return { tours: service.publishedTours(), drivers: service.list("conducteurs"), trucks: service.list("camions"), trailers: service.list("remorques"), bins: service.list("bennes"), materials: service.list("matieres") };
  }
  function routeDetail(tour, data) {
    const driver = indexById(data.drivers)[tour.conducteurId]; const truck = indexById(data.trucks)[tour.camionId];
    const trailer = indexById(data.trailers)[tour.remorqueId] || indexById(data.bins)[tour.benneId]; const material = indexById(data.materials)[tour.matiereId];
    return {
      driver: driver ? `${driver.prenom} ${driver.nom}` : "Non affecté",
      vehicle: truck ? `${truck.immatriculation} · ${truck.marque || ""} ${truck.modele || ""}`.trim() : "Sans véhicule",
      trailer: trailer ? (trailer.immatriculation || trailer.nom) : "Sans remorque",
      material: material ? `${material.code ? `${material.code} · ` : ""}${material.nom}` : (tour.description || "Matière non renseignée")
    };
  }
  function routeCard(tour, data, visibleColumns) {
    const detail = routeDetail(tour, data);
    const field = (column, label, value) => visibleColumns.includes(column) ? `<div class="route-field route-${column}"><span>${label}</span><strong>${escapeHtml(value)}</strong></div>` : "";
    return `<article class="route-card"><div class="route-time"><strong>${escapeHtml(tour.heure || "—")}</strong><span>${tour.heureFin ? `– ${escapeHtml(tour.heureFin)}` : ""}</span></div><div class="route-main">${field("driver", "CHAUFFEUR", detail.driver)}${field("route", "TOURNÉE", tour.nom || "Tournée")}${field("material", "MATIÈRE", detail.material)}${field("vehicle", "VÉHICULE", detail.vehicle)}${field("trailer", "ÉQUIPEMENT", detail.trailer)}${tour.consignes ? `<div class="route-field route-instructions"><span>CONSIGNES</span><strong>${escapeHtml(tour.consignes)}</strong></div>` : ""}</div><div class="route-path"><span>${escapeHtml(tour.depart || "Départ non renseigné")}</span><b>→</b><span>${escapeHtml(tour.arrivee || "Arrivée non renseignée")}</span></div></article>`;
  }
  function render(options = {}) {
    const data = readData(); const preferences = loadPreferences(); if (options.hydrateFilters) hydrateFilters(data, preferences);
    const days = weekDays(weekOffset); const dates = new Set(days.map((day) => day.iso));
    const visibleColumns = [...document.querySelectorAll(".column-picker input:checked")].map((input) => input.value);
    const tours = data.tours.filter((tour) => dates.has(tour.date)).filter((tour) => !elements.departure.value || tour.depart === elements.departure.value).filter((tour) => !elements.driver.value || tour.conducteurId === elements.driver.value).filter((tour) => !elements.truck.value || tour.camionId === elements.truck.value).sort((a, b) => `${a.date} ${a.heure || ""}`.localeCompare(`${b.date} ${b.heure || ""}`));
    elements.range.textContent = `${formatDate(days[0].date, { day: "2-digit", month: "short" })} — ${formatDate(days[6].date, { day: "2-digit", month: "short", year: "numeric" })}`;
    elements.grid.innerHTML = days.map((day) => {
      const dayTours = tours.filter((tour) => tour.date === day.iso);
      return `<section class="day-column ${day.iso === localIso(new Date()) ? "is-today" : ""}"><header><div><span>${escapeHtml(day.name)}</span><strong>${formatDate(day.date, { day: "2-digit", month: "short" })}</strong></div><b>${dayTours.length}</b></header><div class="day-routes">${dayTours.map((tour) => routeCard(tour, data, visibleColumns)).join("") || '<p class="day-empty">Aucune tournée</p>'}</div></section>`;
    }).join("");
    elements.empty.hidden = tours.length > 0; elements.grid.hidden = tours.length === 0;
    elements.sync.textContent = `Actualisé à ${new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date())}`;
  }
  function bindEvents() {
    document.querySelector("#previous-week").addEventListener("click", () => { weekOffset -= 1; render(); });
    document.querySelector("#next-week").addEventListener("click", () => { weekOffset += 1; render(); });
    document.querySelector("#current-week").addEventListener("click", () => { weekOffset = 0; render(); });
    document.querySelector("#refresh-button").addEventListener("click", () => render({ hydrateFilters: true }));
    document.querySelector("#fullscreen-button").addEventListener("click", async () => { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); });
    document.addEventListener("fullscreenchange", () => { document.querySelector("#fullscreen-button").textContent = document.fullscreenElement ? "Quitter le plein écran" : "Plein écran"; });
    [elements.departure, elements.driver, elements.truck].forEach((select) => select.addEventListener("change", () => { savePreferences(); render(); }));
    document.querySelectorAll(".column-picker input").forEach((input) => input.addEventListener("change", () => { savePreferences(); render(); }));
    window.addEventListener("storage", () => render({ hydrateFilters: true }));
  }
  bindEvents(); render({ hydrateFilters: true }); window.setInterval(() => render({ hydrateFilters: true }), 30_000);
})();
