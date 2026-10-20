(function () {
  let selectedWeekOffset = 0;
  let slideshowTimer = null;
  let countdownTimer = null;

  const planningModes = [
    { value: "bennes", label: "Bennes" },
    { value: "semi", label: "Semi-remorques" },
    { value: "porteurs", label: "Porteurs" }
  ];

  const dayShortLabels = ["L", "M", "M", "J", "V", "S", "D"];
  const routeStatuses = [
    { value: "Planifiee", label: "Planifiée" },
    { value: "En cours", label: "En cours" },
    { value: "Terminee", label: "Terminée" }
  ];
  const timelineStart = 6 * 60;
  const timelineEnd = 20 * 60;
  const hourHeight = 64;
  const laneWidth = 218;
  const laneGap = 10;
  const timeGutter = 42;
  const minimumRouteDuration = 60;

  function driverName(driver) {
    return driver ? `${driver.prenom} ${driver.nom}` : "Non assigné";
  }

  function trailerName(trailer) {
    return trailer ? `${trailer.immatriculation} - ${trailer.type}` : "Sans remorque";
  }

  function truckName(truck) {
    return truck ? `${truck.marque} ${truck.modele} - ${truck.immatriculation}` : "Sans camion";
  }

  function binName(bin) {
    return bin ? `${bin.nom} - ${bin.statut}` : "Sans benne";
  }

  function routeMaterialLabel(route) {
    const material = window.HKStorage.load("matieres").find((item) => item.id === route.matiereId);
    if (!material) return route.description || "";
    return material.code ? `${material.code} — ${material.nom}` : material.nom;
  }

  function formatCountdown(seconds) {
    const safeSeconds = Math.max(0, Number(seconds) || 0);
    return `${String(Math.floor(safeSeconds / 60)).padStart(2, "0")}:${String(safeSeconds % 60).padStart(2, "0")}`;
  }

  function planningConfiguration() {
    return {
      id: "general",
      planningVue: "bennes",
      planningVerrouille: false,
      planningDuree: 15,
      planningEcrans: ["bennes", "semi", "porteurs"],
      ...(window.HKStorage.load("configuration")[0] || {})
    };
  }

  function enabledPlanningModes(configuration) {
    const enabled = Array.isArray(configuration.planningEcrans) && configuration.planningEcrans.length
      ? configuration.planningEcrans
      : planningModes.map((mode) => mode.value);
    return planningModes.filter((mode) => enabled.includes(mode.value));
  }

  function routeMatchesPlanningMode(route, mode, trucks) {
    const truck = trucks.find((item) => item.id === route.camionId);
    if (mode === "porteurs") return truck?.type === "Porteur";
    if (truck?.type === "Porteur") return false;
    if (mode === "semi") return Boolean(route.remorqueId) && !route.benneId;
    return Boolean(route.benneId);
  }

  function planningModeControls(configuration) {
    const availableModes = enabledPlanningModes(configuration);
    return `
      <div class="planning-view-controls">
        <div class="planning-view-tabs" aria-label="Type de planning">
          ${availableModes.map((mode) => `
            <button class="planning-view-tab ${configuration.planningVue === mode.value ? "active" : ""}" type="button" data-planning-mode="${mode.value}">${mode.label}</button>
          `).join("")}
        </div>
      </div>
    `;
  }

  function availabilityId(driverId, weekStart) {
    return `av-${driverId}-${weekStart}`;
  }

  function defaultAvailability(driver, days) {
    return days.reduce((availability, day, index) => {
      availability[day.iso] = driver.statut === "Disponible" && index < 5;
      return availability;
    }, {});
  }

  function getAvailability(driver, days) {
    const weekStart = days[0].iso;
    const existing = window.HKStorage.load("disponibilites").find((item) => item.driverId === driver.id && item.weekStart === weekStart);

    if (existing) {
      return { ...defaultAvailability(driver, days), ...existing.days };
    }

    return defaultAvailability(driver, days);
  }

  function setAvailability(driver, days, dayIso, available) {
    const weekStart = days[0].iso;
    const existing = window.HKStorage.load("disponibilites").find((item) => item.driverId === driver.id && item.weekStart === weekStart);
    const nextDays = {
      ...getAvailability(driver, days),
      [dayIso]: available
    };

    if (existing) {
      window.HKStorage.update("disponibilites", existing.id, { days: nextDays });
      return;
    }

    window.HKStorage.save("disponibilites", {
      id: availabilityId(driver.id, weekStart),
      driverId: driver.id,
      weekStart,
      days: nextDays
    });
  }

  function duplicateRoute(routeId) {
    const route = window.HKStorage.getById("tournees", routeId);
    if (!route) return;

    window.HKStorage.save("tournees", {
      ...route,
      id: undefined,
      nom: `${route.nom} copie`,
      statut: "Planifiee"
    });
    window.HKUI.notify("Tournée dupliquée.");
    render();
  }

  function isDriverAvailableForRoute(route, drivers, days) {
    const driver = drivers.find((item) => item.id === route.conducteurId);
    if (!driver) return false;
    return Boolean(getAvailability(driver, days)[route.date]);
  }

  function timeToMinutes(value) {
    const [hours, minutes] = String(value || "08:00").split(":").map(Number);
    return (hours * 60) + (minutes || 0);
  }

  function clampTime(minutes) {
    return Math.min(Math.max(minutes, timelineStart), timelineEnd - 30);
  }

  function routeLayout(routes) {
    const lanes = [];
    const positioned = routes
      .slice()
      .sort((a, b) => timeToMinutes(a.heure) - timeToMinutes(b.heure))
      .map((route) => {
        const start = clampTime(timeToMinutes(route.heure));
        const endTime = timeToMinutes(route.heureFin || "");
        const logicalEnd = endTime > start ? endTime : start + minimumRouteDuration;
        const end = Math.min(Math.max(logicalEnd, start + minimumRouteDuration), timelineEnd);
        let lane = lanes.findIndex((laneEnd) => laneEnd <= start);

        if (lane === -1) {
          lane = lanes.length;
        }

        lanes[lane] = end;

        return {
          route,
          lane,
          top: ((start - timelineStart) / 60) * hourHeight,
          height: Math.max(64, ((Math.min(logicalEnd, timelineEnd) - start) / 60) * hourHeight)
        };
      });

    return {
      lanes: Math.max(lanes.length, 1),
      routes: positioned
    };
  }

  function timelineHours() {
    const hours = [];
    for (let hour = 6; hour <= 20; hour += 1) {
      hours.push(hour);
    }
    return hours;
  }

  function formatHour(hour) {
    return `${String(hour).padStart(2, "0")}:00`;
  }

  function routeTimeLabel(route) {
    if (route.journeeEntiere) return "Journée entière · 07:00 - 17:00";
    return `${route.heure}${route.heureFin ? ` - ${route.heureFin}` : ""}`;
  }

  function minutesToTime(minutes) {
    const clamped = clampTime(minutes);
    const rounded = Math.round(clamped / 15) * 15;
    const hours = Math.floor(rounded / 60);
    const mins = rounded % 60;
    return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
  }

  function dropTimeFromEvent(event, column) {
    const timeline = column.querySelector(".day-timeline");
    if (!timeline) return "06:00";

    const rect = timeline.getBoundingClientRect();
    const y = Math.min(Math.max(event.clientY - rect.top, 0), rect.height);
    const minutes = timelineStart + ((y / hourHeight) * 60);
    return minutesToTime(minutes);
  }

  function createRouteAt(date, hour) {
    window.HKRoutes.openForm(null, {
      date,
      heure: formatHour(hour),
      statut: "Planifiee"
    });
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function routeSummary(route, drivers, trailers, trucks, bins) {
    const driver = drivers.find((item) => item.id === route.conducteurId);
    const trailer = trailers.find((item) => item.id === route.remorqueId);
    const truck = trucks.find((item) => item.id === route.camionId);
    const bin = bins.find((item) => item.id === route.benneId);

    return `
      <tr>
        <td><strong>${escapeHtml(route.nom)}</strong><br><span>${escapeHtml(routeMaterialLabel(route))}</span></td>
        <td>${escapeHtml(route.date)}<br>${escapeHtml(routeTimeLabel(route))}</td>
        <td>${escapeHtml(route.depart)} -> ${escapeHtml(route.arrivee)}</td>
        <td>${escapeHtml(driverName(driver))}</td>
        <td>${trailer ? escapeHtml(trailerName(trailer)) : "-"}</td>
        <td>${truck ? escapeHtml(truckName(truck)) : "-"}</td>
        <td>${bin ? escapeHtml(binName(bin)) : "-"}</td>
        <td>${escapeHtml(window.HKUI.routeStatusLabel(route.statut))}</td>
      </tr>
    `;
  }

  function exportRoutesPdf(title, routes) {
    const drivers = window.HKStorage.load("conducteurs");
    const trailers = window.HKStorage.load("remorques");
    const trucks = window.HKStorage.load("camions");
    const bins = window.HKStorage.load("bennes");
    const sortedRoutes = routes.slice().sort((a, b) => `${a.date} ${a.heure}`.localeCompare(`${b.date} ${b.heure}`));
    const printWindow = window.open("", "_blank");

    if (!printWindow) {
      window.HKUI.notify("Export bloqué par le navigateur.");
      return;
    }

    printWindow.document.write(`
      <!doctype html>
      <html lang="fr">
        <head>
          <meta charset="utf-8">
          <title>${escapeHtml(title)}</title>
          <style>
            body { margin: 28px; color: #111827; font-family: Inter, Arial, sans-serif; }
            h1 { margin: 0 0 8px; font-size: 24px; }
            p { margin: 0 0 22px; color: #5b6472; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th { padding: 10px 8px; border-bottom: 2px solid #111827; text-align: left; text-transform: uppercase; }
            td { padding: 10px 8px; border-bottom: 1px solid #d8dde6; vertical-align: top; }
            span { color: #647083; }
            @media print { body { margin: 18mm; } }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(title)}</h1>
          <p>${sortedRoutes.length} tournée(s)</p>
          <table>
            <thead>
              <tr>
                <th>Tournée</th>
                <th>Date / heure</th>
                <th>Trajet</th>
                <th>Chauffeur</th>
                <th>Remorque</th>
                <th>Camion</th>
                <th>Benne</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              ${sortedRoutes.length ? sortedRoutes.map((route) => routeSummary(route, drivers, trailers, trucks, bins)).join("") : '<tr><td colspan="8">Aucune tournée.</td></tr>'}
            </tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
  }

  function routeCard(route, drivers, trailers, trucks, bins, days, position = {}) {
    const driver = drivers.find((item) => item.id === route.conducteurId);
    const trailer = trailers.find((item) => item.id === route.remorqueId);
    const truck = trucks.find((item) => item.id === route.camionId);
    const bin = bins.find((item) => item.id === route.benneId);
    const isAssignable = isDriverAvailableForRoute(route, drivers, days);
    const statusClass = `route-status-${route.statut || "Planifiee"}`.replace(/\s+/g, "-").toLowerCase();

    const style = position.top !== undefined
      ? `style="top:${position.top}px;left:${timeGutter + (position.lane * (laneWidth + laneGap))}px;width:${laneWidth}px;height:${position.height}px;"`
      : "";

    return `
      <article class="route-card ${statusClass} ${isAssignable ? "" : "route-alert"}" draggable="true" data-route-id="${route.id}" ${style}>
        <div class="route-window-actions">
          ${isAssignable ? "" : `<span class="route-alert-badge" title="Chauffeur indisponible">!</span>`}
          <button class="route-icon-action" type="button" data-duplicate-route="${route.id}" aria-label="Dupliquer la tournée">+</button>
          <button class="route-icon-action danger" type="button" data-delete-route="${route.id}" aria-label="Supprimer la tournée">-</button>
        </div>
        <div class="route-scroll">
          <h3 class="route-title">${driver ? driverName(driver) : "Non assigné"}</h3>
          <div class="route-week-name">${route.nom}</div>
          ${routeMaterialLabel(route) ? `<div class="route-material">${escapeHtml(routeMaterialLabel(route))}</div>` : ""}
          <div class="route-meta">${escapeHtml(routeTimeLabel(route))} · ${route.depart} -> ${route.arrivee}</div>
          ${trailer ? `<div class="route-meta">${trailerName(trailer)}</div>` : ""}
          ${truck ? `<div class="route-meta">${truckName(truck)}</div>` : ""}
          ${bin ? `<div class="route-meta">${binName(bin)}</div>` : ""}
          <div class="route-actions">
            <select class="route-status-select" data-route-status-select="${route.id}" aria-label="Statut tournée">
              ${routeStatuses.map((status) => `<option value="${status.value}" ${route.statut === status.value ? "selected" : ""}>${status.label}</option>`).join("")}
            </select>
          </div>
        </div>
      </article>
    `;
  }

  function modalRouteCards(routes) {
    if (!routes.length) {
      return '<div class="day-lane-empty">Aucune tournée</div>';
    }

    const layout = routeLayout(routes);
    return layout.routes.map((item) => {
      const width = 100 / layout.lanes;
      const left = item.lane * width;
      const statusClass = `route-status-${item.route.statut || "Planifiee"}`.replace(/\s+/g, "-").toLowerCase();

      return `
        <button
          class="day-route-card ${statusClass}"
          type="button"
          data-day-route="${item.route.id}"
          style="top:${item.top}px;height:${item.height}px;left:calc(${left}% + 6px);width:calc(${width}% - 12px)"
        >
          <strong>${escapeHtml(item.route.nom)}</strong>
          ${routeMaterialLabel(item.route) ? `<em>${escapeHtml(routeMaterialLabel(item.route))}</em>` : ""}
          <span>${escapeHtml(routeTimeLabel(item.route))}</span>
          <small>${escapeHtml(item.route.depart)} → ${escapeHtml(item.route.arrivee)}</small>
        </button>
      `;
    }).join("");
  }

  function dayDriverHeader(driver, routes) {
    return `
      <div class="day-driver-header">
        <div class="avatar">${window.HKUI.initials([driver.prenom, driver.nom])}</div>
        <div>
          <strong>${escapeHtml(driver.prenom)} ${escapeHtml(driver.nom)}</strong>
          <span>${routes.length} tournée${routes.length === 1 ? "" : "s"}</span>
        </div>
      </div>
    `;
  }

  function openDayView(day, days, drivers, trailers, trucks, bins) {
    const routes = window.HKStorage.load("tournees").filter((route) => route.date === day.iso);
    const activeDrivers = drivers.filter((driver) => Boolean(getAvailability(driver, days)[day.iso]));
    const inactiveDrivers = drivers.filter((driver) => !getAvailability(driver, days)[day.iso]);
    const activeIds = new Set(activeDrivers.map((driver) => driver.id));
    const exceptionRoutes = routes.filter((route) => !route.conducteurId || !activeIds.has(route.conducteurId));
    const timelineHeight = ((timelineEnd - timelineStart) / 60) * hourHeight;
    const gridColumns = `62px ${activeDrivers.map(() => "minmax(238px, 1fr)").join(" ")} minmax(270px, 1fr)`;

    const activeList = activeDrivers.length
      ? activeDrivers.map((driver) => {
        const driverRoutes = routes.filter((route) => route.conducteurId === driver.id);
        return `
          <button class="day-active-driver" type="button" data-scroll-driver="${driver.id}">
            <span class="avatar">${window.HKUI.initials([driver.prenom, driver.nom])}</span>
            <span>
              <strong>${escapeHtml(driver.prenom)} ${escapeHtml(driver.nom)}</strong>
              <small>${driverRoutes.length} tournée${driverRoutes.length === 1 ? "" : "s"}</small>
            </span>
          </button>
        `;
      }).join("")
      : '<p class="day-empty-note">Aucun chauffeur actif.</p>';

    const inactiveList = inactiveDrivers.length
      ? inactiveDrivers.map((driver) => `<span class="off-driver">${escapeHtml(driver.prenom)} ${escapeHtml(driver.nom)}</span>`).join("")
      : '<span class="off-driver">Tous les chauffeurs travaillent</span>';

    const driverColumns = activeDrivers.map((driver) => {
      const driverRoutes = routes.filter((route) => route.conducteurId === driver.id);
      return `
        <div class="day-column-header" data-driver-header="${driver.id}">
          ${dayDriverHeader(driver, driverRoutes)}
        </div>
      `;
    }).join("");

    const driverLanes = activeDrivers.map((driver) => {
      const driverRoutes = routes.filter((route) => route.conducteurId === driver.id);
      return `
        <div class="driver-day-lane" data-driver-lane="${driver.id}" style="--day-modal-height:${timelineHeight}px">
          ${modalRouteCards(driverRoutes)}
        </div>
      `;
    }).join("");

    window.HKModal.openContent({
      title: `${day.name} ${day.label}`,
      eyebrow: "Organisation de la journée",
      className: "day-planning-modal",
      rootClass: "day-planning-root",
      content: `
        <div class="day-modal-layout">
          <aside class="day-active-rail">
            <div>
              <span class="day-panel-label">Chauffeurs actifs</span>
              <strong>${activeDrivers.length} disponible${activeDrivers.length === 1 ? "" : "s"}</strong>
            </div>
            <div class="day-active-list">${activeList}</div>
            <button class="button primary day-add-route" type="button" data-day-add-route>+ Tournée</button>
          </aside>
          <div class="day-schedule-scroll">
            <div class="day-schedule-grid" style="grid-template-columns:${gridColumns}">
              <div class="day-time-header">Heure</div>
              ${driverColumns}
              <div class="day-column-header day-off-header">
                <strong>Non affecté / hors service</strong>
                <span>${inactiveDrivers.length} chauffeur${inactiveDrivers.length === 1 ? "" : "s"} indisponible${inactiveDrivers.length === 1 ? "" : "s"}</span>
                <div class="off-driver-list">${inactiveList}</div>
              </div>
              <div class="day-time-axis" style="--day-modal-height:${timelineHeight}px">
                ${timelineHours().map((hour) => `<span style="top:${(hour - 6) * hourHeight}px">${formatHour(hour)}</span>`).join("")}
              </div>
              ${driverLanes}
              <div class="driver-day-lane day-off-lane" style="--day-modal-height:${timelineHeight}px">
                ${modalRouteCards(exceptionRoutes)}
              </div>
            </div>
          </div>
        </div>
      `,
      onOpen(node) {
        node.querySelectorAll("[data-scroll-driver]").forEach((button) => {
          button.addEventListener("click", () => {
            node.querySelector(`[data-driver-header="${button.dataset.scrollDriver}"]`)?.scrollIntoView({
              behavior: "smooth",
              block: "nearest",
              inline: "center"
            });
          });
        });

        node.querySelector("[data-day-add-route]")?.addEventListener("click", () => {
          window.HKRoutes.openForm(null, {
            date: day.iso,
            heure: "08:00",
            conducteurId: activeDrivers[0]?.id || "",
            statut: "Planifiee"
          });
        });

        node.querySelectorAll("[data-day-route]").forEach((button) => {
          button.addEventListener("click", () => {
            const route = window.HKStorage.getById("tournees", button.dataset.dayRoute);
            if (route) openRouteEditor(route, days, drivers, trailers, trucks, bins);
          });
        });
      }
    });
  }

  function weekProjectionRoute(route, drivers, available) {
    const driver = drivers.find((item) => item.id === route.conducteurId);
    const statusClass = `route-status-${route.statut || "Planifiee"}`.replace(/\s+/g, "-").toLowerCase();
    return `
      <button class="week-projection-route ${statusClass} ${available ? "" : "route-alert"}" type="button" data-week-route="${route.id}">
        <strong>${escapeHtml(driver ? driverName(driver) : "Non assigné")}</strong>
        <span>${escapeHtml(route.nom)}</span>
        ${routeMaterialLabel(route) ? `<em>${escapeHtml(routeMaterialLabel(route))}</em>` : ""}
        <small>${escapeHtml(routeTimeLabel(route))}</small>
      </button>
    `;
  }

  function openWeekView(days, drivers, trailers, trucks, bins, requestedMode) {
    const dates = days.map((day) => day.iso);
    let configuration = planningConfiguration();
    if (requestedMode && requestedMode !== configuration.planningVue) {
      window.HKStorage.update("configuration", configuration.id, { planningVue: requestedMode });
      configuration = planningConfiguration();
    }
    const availableModes = enabledPlanningModes(configuration);
    const mode = availableModes.some((item) => item.value === configuration.planningVue)
      ? configuration.planningVue
      : availableModes[0].value;
    if (mode !== configuration.planningVue) {
      window.HKStorage.update("configuration", configuration.id, { planningVue: mode });
      configuration = planningConfiguration();
    }
    const modeLabel = planningModes.find((item) => item.value === mode)?.label || "Planning";
    document.querySelectorAll("[data-planning-mode]").forEach((button) => {
      button.classList.toggle("active", button.dataset.planningMode === mode);
    });
    const routes = window.HKStorage.load("tournees").filter((route) => dates.includes(route.date) && routeMatchesPlanningMode(route, mode, trucks));
    const activeDrivers = drivers.filter((driver) => days.some((day) => getAvailability(driver, days)[day.iso]));

    window.HKModal.openContent({
      title: `${days[0].label} – ${days[6].label}`,
      eyebrow: `Projection de la semaine · ${modeLabel}`,
      className: "week-planning-modal",
      rootClass: "week-planning-root",
      content: `
        <div class="week-modal-toolbar">
          <div class="planning-view-tabs">
            ${availableModes.map((item) => `<button class="planning-view-tab ${item.value === mode ? "active" : ""}" type="button" data-modal-planning-mode="${item.value}">${item.label}</button>`).join("")}
          </div>
          <div class="week-modal-status">
            <span class="slideshow-countdown" data-slideshow-countdown>${configuration.planningVerrouille ? "PAUSE" : formatCountdown(configuration.planningDuree)}</span>
            <button class="planning-lock-button ${configuration.planningVerrouille ? "locked" : ""}" type="button" data-modal-planning-lock>
              ${configuration.planningVerrouille ? "🔒 Vue semaine verrouillée" : "▶ Diaporama semaine actif"}
            </button>
          </div>
        </div>
        <div class="week-projection-layout">
          <aside class="week-projection-drivers">
            <div>
              <span class="day-panel-label">Chauffeurs actifs</span>
              <strong>${activeDrivers.length} sur la semaine</strong>
            </div>
            <div class="week-projection-driver-list">
              ${activeDrivers.length ? activeDrivers.map((driver) => {
                const workingDays = days.filter((day) => getAvailability(driver, days)[day.iso]).length;
                return `
                  <div class="week-projection-driver">
                    <span class="avatar">${window.HKUI.initials([driver.prenom, driver.nom])}</span>
                    <span>
                      <strong>${escapeHtml(driver.prenom)} ${escapeHtml(driver.nom)}</strong>
                      <small>${workingDays} jour${workingDays === 1 ? "" : "s"} actif${workingDays === 1 ? "" : "s"}</small>
                    </span>
                  </div>
                `;
              }).join("") : '<p class="day-empty-note">Aucun chauffeur actif.</p>'}
            </div>
          </aside>
          <div class="week-projection-days">
            ${days.map((day) => {
              const dayRoutes = routes
                .filter((route) => route.date === day.iso)
                .sort((a, b) => timeToMinutes(a.heure) - timeToMinutes(b.heure));
              return `
                <section class="week-projection-day">
                  <header>
                    <strong>${day.name}</strong>
                    <span>${day.label}</span>
                    <small>${dayRoutes.length} tournée${dayRoutes.length === 1 ? "" : "s"}</small>
                  </header>
                  <div class="week-projection-route-list">
                    ${dayRoutes.length
                      ? dayRoutes.map((route) => weekProjectionRoute(route, drivers, isDriverAvailableForRoute(route, drivers, days))).join("")
                      : '<div class="week-projection-empty">Aucune tournée</div>'}
                  </div>
                </section>
              `;
            }).join("")}
          </div>
        </div>
      `,
      onOpen(node) {
        node.querySelectorAll("[data-modal-planning-mode]").forEach((button) => {
          button.addEventListener("click", () => openWeekView(days, drivers, trailers, trucks, bins, button.dataset.modalPlanningMode));
        });
        node.querySelector("[data-modal-planning-lock]")?.addEventListener("click", () => {
          window.HKStorage.update("configuration", configuration.id, { planningVerrouille: !configuration.planningVerrouille });
          openWeekView(days, drivers, trailers, trucks, bins, mode);
        });
        node.querySelectorAll("[data-week-route]").forEach((button) => {
          button.addEventListener("click", () => {
            const route = window.HKStorage.getById("tournees", button.dataset.weekRoute);
            if (route) openRouteEditor(route, days, drivers, trailers, trucks, bins);
          });
        });
      }
    });
    startPlanningSlideshow(configuration, days, drivers, trailers, trucks, bins);
  }

  function renderTimeline(day, dayRoutes, drivers, trailers, trucks, bins, days) {
    if (!dayRoutes.length) {
      return `
        <section class="day-column day-column-empty" data-date="${day.iso}" style="--day-width:220px">
          <header class="day-head">
            <div>
              <p class="day-name">${day.name}</p>
              <span class="day-date">${day.label}</span>
            </div>
            <div class="day-head-actions">
              <span class="badge">0</span>
              <button class="day-view-button" type="button" data-open-day="${day.iso}">Journée</button>
              <button class="pdf-icon-button" type="button" data-export-day="${day.iso}" aria-label="Exporter la journée en PDF">PDF</button>
            </div>
          </header>
          <button class="empty-day" type="button" data-create-route-date="${day.iso}" data-create-route-hour="6">
            Déposer une tournée
          </button>
        </section>
      `;
    }

    const layout = routeLayout(dayRoutes);
    const dayWidth = timeGutter + (layout.lanes * laneWidth) + ((layout.lanes - 1) * laneGap) + 18;

    return `
      <section class="day-column" data-date="${day.iso}" style="--day-width:${dayWidth}px">
        <header class="day-head">
          <div>
            <p class="day-name">${day.name}</p>
            <span class="day-date">${day.label}</span>
          </div>
          <div class="day-head-actions">
            <span class="badge">${dayRoutes.length}</span>
            <button class="day-view-button" type="button" data-open-day="${day.iso}">Journée</button>
            <button class="pdf-icon-button" type="button" data-export-day="${day.iso}" aria-label="Exporter la journée en PDF">PDF</button>
          </div>
        </header>
        <div class="day-timeline" style="--timeline-height:${(timelineEnd - timelineStart) / 60 * hourHeight}px;--day-width:${dayWidth}px">
          <div class="time-axis">
            ${timelineHours().map((hour) => `<span style="top:${(hour - 6) * hourHeight}px">${String(hour).padStart(2, "0")}:00</span>`).join("")}
          </div>
          <div class="time-grid-lines">
            ${timelineHours().map((hour) => `<span style="top:${(hour - 6) * hourHeight}px"></span>`).join("")}
          </div>
          <div class="time-slots">
            ${timelineHours().slice(0, -1).map((hour) => `
              <button class="time-slot" type="button" style="top:${(hour - 6) * hourHeight}px" data-create-route-date="${day.iso}" data-create-route-hour="${hour}">
                <span>${formatHour(hour)}</span>
              </button>
            `).join("")}
          </div>
          ${layout.routes.map((item) => routeCard(item.route, drivers, trailers, trucks, bins, days, item)).join("")}
        </div>
      </section>
    `;
  }

  function bindDrag() {
    document.querySelectorAll(".route-card").forEach((card) => {
      card.addEventListener("dragstart", (event) => {
        if (event.target.closest("button, select")) {
          event.preventDefault();
          return;
        }
        card.classList.add("dragging");
        event.dataTransfer.setData("text/plain", card.dataset.routeId);
      });
      card.addEventListener("dragend", () => card.classList.remove("dragging"));
    });

    document.querySelectorAll(".day-column").forEach((column) => {
      column.addEventListener("dragover", (event) => {
        event.preventDefault();
        column.classList.add("drag-over");
      });
      column.addEventListener("dragleave", () => column.classList.remove("drag-over"));
      column.addEventListener("drop", (event) => {
        event.preventDefault();
        column.classList.remove("drag-over");
        const id = event.dataTransfer.getData("text/plain");
        const route = window.HKStorage.getById("tournees", id);
        const days = window.HKCalendar.currentWeek(selectedWeekOffset);
        const drivers = window.HKStorage.load("conducteurs");
        const driver = route ? drivers.find((item) => item.id === route.conducteurId) : null;

        if (driver && !getAvailability(driver, days)[column.dataset.date]) {
          window.HKUI.notify("Chauffeur indisponible sur cette journée.");
          return;
        }

        window.HKStorage.update("tournees", id, {
          date: column.dataset.date,
          heure: route.journeeEntiere ? "07:00" : dropTimeFromEvent(event, column)
        });
        window.HKUI.notify("Tournée déplacée dans le planning.");
        render();
      });
    });
  }

  function bindWeekControls() {
    document.querySelectorAll("[data-week-card]").forEach((button) => {
      button.addEventListener("click", () => {
        selectedWeekOffset = Number(button.dataset.weekCard);
        render();
      });
    });
  }

  function bindAvailabilityControls(days, drivers) {
    document.querySelectorAll("[data-availability-day]").forEach((button) => {
      button.addEventListener("click", () => {
        const driver = drivers.find((item) => item.id === button.dataset.driverId);
        if (!driver) return;

        const nextState = button.dataset.available !== "true";
        setAvailability(driver, days, button.dataset.availabilityDay, nextState);
        render();
      });
    });
  }

  function driverOptionsForRoute(route, drivers, days) {
    return [
      { value: "", label: "Non assigné" },
      ...drivers.map((driver) => {
        const available = Boolean(getAvailability(driver, days)[route.date]);
        return {
          value: driver.id,
          label: `${driver.prenom} ${driver.nom}${available ? "" : " - indisponible"}`,
          disabled: !available && driver.id !== route.conducteurId
        };
      })
    ];
  }

  function openRouteEditor(route, days, drivers, trailers, trucks, bins) {
    window.HKModal.open({
      title: "Modifier l'affectation",
      fields: [
        {
          name: "conducteurId",
          label: "Chauffeur",
          type: "select",
          value: route.conducteurId || "",
          options: driverOptionsForRoute(route, drivers, days),
          full: true
        },
        {
          name: "heure",
          label: "Heure de début",
          type: "time",
          value: route.heure || "08:00",
          required: true
        },
        {
          name: "heureFin",
          label: "Heure de fin",
          type: "time",
          value: route.heureFin || "",
        },
        {
          name: "journeeEntiere",
          label: "Planification",
          type: "checkbox",
          value: Boolean(route.journeeEntiere),
          help: "Journée entière (07:00 - 17:00)",
          full: true
        },
        {
          name: "remorqueId",
          label: "Remorque",
          type: "select",
          value: route.remorqueId || "",
          options: [
            { value: "", label: "Sans remorque" },
            ...trailers.map((trailer) => ({ value: trailer.id, label: `${trailer.immatriculation} - ${trailer.type}` }))
          ],
          full: true
        },
        {
          name: "camionId",
          label: "Camion",
          type: "select",
          value: route.camionId || "",
          options: [
            { value: "", label: "Sans camion" },
            ...trucks.map((truck) => ({ value: truck.id, label: `${truck.marque} ${truck.modele} - ${truck.immatriculation}` }))
          ],
          full: true
        },
        {
          name: "benneId",
          label: "Benne",
          type: "select",
          value: route.benneId || "",
          options: [
            { value: "", label: "Sans benne" },
            ...bins.map((bin) => ({ value: bin.id, label: `${bin.nom} - ${bin.statut}` }))
          ],
          full: true
        }
      ],
      onSubmit(data) {
        if (data.journeeEntiere) {
          data.heure = "07:00";
          data.heureFin = "17:00";
        }
        const selectedDriver = drivers.find((driver) => driver.id === data.conducteurId);
        if (selectedDriver && !getAvailability(selectedDriver, days)[route.date]) {
          window.HKUI.notify("Chauffeur indisponible sur cette journée.");
          return;
        }

        window.HKStorage.update("tournees", route.id, {
          conducteurId: data.conducteurId,
          heure: data.heure,
          heureFin: data.heureFin,
          journeeEntiere: data.journeeEntiere,
          remorqueId: data.remorqueId,
          camionId: data.camionId,
          benneId: data.benneId
        });
        window.HKUI.notify("Affectation mise à jour.");
        render();
      }
    });
  }

  function bindRouteOpen(days, drivers, trailers, trucks, bins) {
    document.querySelectorAll(".route-card").forEach((card) => {
      card.addEventListener("click", (event) => {
        if (event.target.closest("button, select")) return;
        const route = window.HKStorage.getById("tournees", card.dataset.routeId);
        if (!route) return;
        openRouteEditor(route, days, drivers, trailers, trucks, bins);
      });
    });
  }

  function bindRouteActions() {
    document.querySelectorAll("[data-route-status-select]").forEach((select) => {
      select.addEventListener("pointerdown", (event) => event.stopPropagation());
      select.addEventListener("change", () => {
        window.HKStorage.update("tournees", select.dataset.routeStatusSelect, { statut: select.value });
        window.HKUI.notify("Statut de tournée mis à jour.");
        render();
      });
    });

    document.querySelectorAll("[data-duplicate-route]").forEach((button) => {
      button.addEventListener("pointerdown", (event) => event.stopPropagation());
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        duplicateRoute(button.dataset.duplicateRoute);
      });
    });

    document.querySelectorAll("[data-delete-route]").forEach((button) => {
      button.addEventListener("pointerdown", (event) => event.stopPropagation());
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        window.HKStorage.remove("tournees", button.dataset.deleteRoute);
        window.HKUI.notify("Tournée supprimée.");
        render();
      });
    });
  }

  function bindCreateSlots() {
    document.querySelectorAll("[data-create-route-date]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        createRouteAt(button.dataset.createRouteDate, Number(button.dataset.createRouteHour));
      });
    });
  }

  function bindExportControls(days) {
    document.querySelectorAll("[data-export-week]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const weekOffset = Number(button.dataset.exportWeek);
        const weekDays = window.HKCalendar.currentWeek(weekOffset);
        const dates = weekDays.map((day) => day.iso);
        const routes = window.HKStorage.load("tournees").filter((route) => dates.includes(route.date));
        exportRoutesPdf(`Résumé semaine ${button.dataset.weekNumber} · ${weekDays[0].label} - ${weekDays[6].label}`, routes);
      });
    });

    document.querySelectorAll("[data-export-day]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const day = days.find((item) => item.iso === button.dataset.exportDay);
        const routes = window.HKStorage.load("tournees").filter((route) => route.date === button.dataset.exportDay);
        exportRoutesPdf(`Résumé ${day ? `${day.name} ${day.label}` : button.dataset.exportDay}`, routes);
      });
    });
  }

  function bindDayViews(days, drivers, trailers, trucks, bins) {
    document.querySelectorAll("[data-open-day]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const day = days.find((item) => item.iso === button.dataset.openDay);
        if (day) openDayView(day, days, drivers, trailers, trucks, bins);
      });
    });
  }

  function bindWeekView(days, drivers, trailers, trucks, bins) {
    document.querySelector("[data-open-week]")?.addEventListener("click", () => {
      openWeekView(days, drivers, trailers, trucks, bins);
    });
  }

  function renderWeekCards(weekOptions) {
    return `
      <div class="week-card-grid" aria-label="Semaines du calendrier">
        ${weekOptions.map((week) => `
          <article class="week-card ${week.offset === selectedWeekOffset ? "active" : ""}">
            <button class="week-card-main" type="button" data-week-card="${week.offset}">
              <strong>S${String(week.number).padStart(2, "0")}</strong>
              <span>${week.range}</span>
            </button>
            <button class="pdf-icon-button" type="button" data-export-week="${week.offset}" data-week-number="${String(week.number).padStart(2, "0")}" aria-label="Exporter la semaine en PDF">PDF</button>
          </article>
        `).join("")}
      </div>
    `;
  }

  function renderDrivers(drivers, days) {
    return drivers.map((driver) => {
      const availability = getAvailability(driver, days);

      return `
        <div class="driver-chip">
          <div class="driver-row">
            <div class="avatar">${window.HKUI.initials([driver.prenom, driver.nom])}</div>
            <div>
              <strong>${driver.prenom} ${driver.nom}</strong>
              <span>${driver.statut}</span>
            </div>
          </div>
          <div class="availability-list" aria-label="Disponibilités de ${driver.prenom} ${driver.nom}">
            ${days.map((day, index) => `
              <button class="availability-day ${availability[day.iso] ? "available" : ""}" type="button" data-driver-id="${driver.id}" data-availability-day="${day.iso}" data-available="${availability[day.iso]}">
                <span>${dayShortLabels[index]}</span>
                <small>${availability[day.iso] ? "Dispo" : "Off"}</small>
              </button>
            `).join("")}
          </div>
        </div>
      `;
    }).join("");
  }

  function bindBoardScrollbars() {
    const topScrollbar = document.querySelector("[data-week-scroll-top]");
    const topTrack = topScrollbar?.querySelector(".week-scroll-top-track");
    const board = document.querySelector(".week-board");
    const grid = board?.querySelector(".week-grid");
    if (!topScrollbar || !topTrack || !board || !grid) return;

    let syncing = false;
    const updateTrack = () => {
      topTrack.style.width = `${board.scrollWidth}px`;
      topScrollbar.scrollLeft = board.scrollLeft;
    };
    const syncScroll = (source, target) => {
      if (syncing) return;
      syncing = true;
      target.scrollLeft = source.scrollLeft;
      requestAnimationFrame(() => { syncing = false; });
    };

    topScrollbar.addEventListener("scroll", () => syncScroll(topScrollbar, board));
    board.addEventListener("scroll", () => syncScroll(board, topScrollbar));
    updateTrack();

    if (window.ResizeObserver) {
      const observer = new ResizeObserver(updateTrack);
      observer.observe(board);
      observer.observe(grid);
      board._topScrollObserver = observer;
    }
  }

  function bindPlanningModeControls(configuration, days, drivers, trailers, trucks, bins) {
    document.querySelectorAll("[data-planning-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        openWeekView(days, drivers, trailers, trucks, bins, button.dataset.planningMode);
      });
    });

  }

  function startPlanningSlideshow(configuration, days, drivers, trailers, trucks, bins) {
    clearInterval(slideshowTimer);
    clearInterval(countdownTimer);
    const availableModes = enabledPlanningModes(configuration);
    if (configuration.planningVerrouille || availableModes.length < 2) {
      const counter = document.querySelector("[data-slideshow-countdown]");
      if (counter && availableModes.length < 2 && !configuration.planningVerrouille) counter.textContent = "FIXE";
      return;
    }
    const duration = Math.min(300, Math.max(5, Number(configuration.planningDuree) || 15)) * 1000;
    const deadline = Date.now() + duration;
    const updateCountdown = () => {
      const counter = document.querySelector("[data-slideshow-countdown]");
      if (!counter) {
        clearInterval(countdownTimer);
        return;
      }
      const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      counter.textContent = formatCountdown(seconds);
    };
    updateCountdown();
    countdownTimer = setInterval(updateCountdown, 250);
    slideshowTimer = setInterval(() => {
      if (!document.querySelector(".modal-root.week-planning-root.open")) {
        clearInterval(slideshowTimer);
        clearInterval(countdownTimer);
        return;
      }
      const currentIndex = availableModes.findIndex((mode) => mode.value === planningConfiguration().planningVue);
      const nextMode = availableModes[(currentIndex + 1) % availableModes.length].value;
      openWeekView(days, drivers, trailers, trucks, bins, nextMode);
    }, duration);
  }

  function render() {
    if (document.body.dataset.page !== "planning") return;

    const workspace = document.querySelector("#workspace");
    const weekOptions = window.HKCalendar.weeksUntilDecember();
    const days = window.HKCalendar.currentWeek(selectedWeekOffset);
    const currentOption = weekOptions.find((week) => week.offset === selectedWeekOffset) || weekOptions[1];
    const drivers = window.HKStorage.load("conducteurs");
    const trailers = window.HKStorage.load("remorques");
    const trucks = window.HKStorage.load("camions");
    const bins = window.HKStorage.load("bennes");
    const configuration = planningConfiguration();
    const routes = window.HKStorage.load("tournees");

    workspace.querySelector(".week-board")?._topScrollObserver?.disconnect();
    workspace.innerHTML = "";
    workspace.insertAdjacentHTML("beforeend", `
      <div class="section-header">
        <div>
          <h2>${currentOption.label}</h2>
          <span class="tag">${days[0].label} - ${days[6].label}</span>
        </div>
        <button class="button ghost" type="button" data-open-week>Vue semaine</button>
      </div>
      ${planningModeControls(configuration)}
      ${renderWeekCards(weekOptions)}
      <div class="planning-shell">
        <aside class="card driver-rail">
          ${renderDrivers(drivers, days)}
        </aside>
        <div class="planning-board-stack">
          <div class="week-scroll-top" data-week-scroll-top aria-label="Défilement horizontal du planning">
            <div class="week-scroll-top-track"></div>
          </div>
          <div class="card week-board">
            <div class="week-grid">
              ${days.map((day) => renderTimeline(day, routes.filter((route) => route.date === day.iso), drivers, trailers, trucks, bins, days)).join("")}
            </div>
          </div>
        </div>
      </div>
    `);

    bindWeekControls();
    bindAvailabilityControls(days, drivers);
    bindRouteActions();
    bindRouteOpen(days, drivers, trailers, trucks, bins);
    bindCreateSlots();
    bindExportControls(days);
    bindDayViews(days, drivers, trailers, trucks, bins);
    bindWeekView(days, drivers, trailers, trucks, bins);
    bindDrag();
    bindBoardScrollbars();
    bindPlanningModeControls(configuration, days, drivers, trailers, trucks, bins);
  }

  window.HKPlanning = { render };
})();
