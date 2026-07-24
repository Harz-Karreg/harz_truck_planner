(function () {
  let selectedWeekOffset = 0;

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
        <td><strong>${escapeHtml(route.nom)}</strong><br><span>${escapeHtml(route.description)}</span></td>
        <td>${escapeHtml(route.date)}<br>${escapeHtml(route.heure)}${route.heureFin ? ` - ${escapeHtml(route.heureFin)}` : ""}</td>
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
          <h3 class="route-title">${route.nom}</h3>
          <div class="route-meta">${route.heure}${route.heureFin ? ` - ${route.heureFin}` : ""} · ${route.depart} -> ${route.arrivee}</div>
          ${driver ? `<div class="route-meta">${driverName(driver)}</div>` : ""}
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
          heure: dropTimeFromEvent(event, column)
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
        const selectedDriver = drivers.find((driver) => driver.id === data.conducteurId);
        if (selectedDriver && !getAvailability(selectedDriver, days)[route.date]) {
          window.HKUI.notify("Chauffeur indisponible sur cette journée.");
          return;
        }

        window.HKStorage.update("tournees", route.id, {
          conducteurId: data.conducteurId,
          heure: data.heure,
          heureFin: data.heureFin,
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
    const routes = window.HKStorage.load("tournees");

    workspace.innerHTML = "";
    workspace.insertAdjacentHTML("beforeend", `
      <div class="section-header">
        <div>
          <h2>${currentOption.label}</h2>
          <span class="tag">${days[0].label} - ${days[6].label}</span>
        </div>
      </div>
      ${renderWeekCards(weekOptions)}
      <div class="planning-shell">
        <aside class="card driver-rail">
          ${renderDrivers(drivers, days)}
        </aside>
        <div class="card week-board">
          <div class="week-grid">
            ${days.map((day) => renderTimeline(day, routes.filter((route) => route.date === day.iso), drivers, trailers, trucks, bins, days)).join("")}
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
    bindDrag();
  }

  window.HKPlanning = { render };
})();
