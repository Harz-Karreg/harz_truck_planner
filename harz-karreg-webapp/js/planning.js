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

  function repository(collection) {
    return window.HKRepositories.get(collection);
  }

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
    const material = repository("matieres").list().find((item) => item.id === route.matiereId);
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
      ...(repository("configuration").list()[0] || {})
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
    const existing = repository("disponibilites").list().find((item) => item.driverId === driver.id && item.weekStart === weekStart);

    if (existing) {
      return { ...defaultAvailability(driver, days), ...existing.days };
    }

    return defaultAvailability(driver, days);
  }

  function setAvailability(driver, days, dayIso, available) {
    const weekStart = days[0].iso;
    const existing = repository("disponibilites").list().find((item) => item.driverId === driver.id && item.weekStart === weekStart);
    const nextDays = {
      ...getAvailability(driver, days),
      [dayIso]: available
    };

    if (existing) {
      repository("disponibilites").update(existing.id, { days: nextDays });
      return;
    }

    repository("disponibilites").create({
      id: availabilityId(driver.id, weekStart),
      driverId: driver.id,
      weekStart,
      days: nextDays
    });
  }

  function duplicateRoute(routeId) {
    const route = repository("tournees").getById(routeId);
    if (!route) return;

    repository("tournees").create({
      ...route,
      id: undefined,
      nom: `${route.nom} copie`,
      statut: "Planifiee",
      publicationStatut: "Brouillon"
    });
    window.HKUI.notify("Tournée dupliquée.");
    render();
  }

  function publicationStatus(route) {
    return route.publicationStatut || "Publiee";
  }

  function publishWeek(days) {
    const dates = days.map((day) => day.iso);
    const drafts = repository("tournees").list().filter((route) => dates.includes(route.date) && publicationStatus(route) === "Brouillon");
    if (!drafts.length) {
      window.HKUI.notify("Toutes les tournées de cette semaine sont déjà publiées.");
      return;
    }
    if (!confirm(`Publier ${drafts.length} tournée${drafts.length === 1 ? "" : "s"} de cette semaine ?`)) return;
    drafts.forEach((route) => repository("tournees").update(route.id, { publicationStatut: "Publiee" }));
    window.HKUI.notify(`${drafts.length} tournée${drafts.length === 1 ? " publiée" : "s publiées"}.`);
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

  function asciiText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[–—]/g, "-")
      .replace(/→/g, "->")
      .replace(/[^\x20-\x7E]/g, "");
  }

  function safeFileName(value) {
    return asciiText(value).replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "planning";
  }

  function downloadBlob(data, fileName) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: fileName.endsWith(".zip") ? "application/zip" : "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function wrapPdfLine(value, limit = 88) {
    const words = asciiText(value).split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";
    words.forEach((word) => {
      if (`${line} ${word}`.trim().length > limit && line) {
        lines.push(line);
        line = word;
      } else {
        line = `${line} ${word}`.trim();
      }
    });
    if (line || !lines.length) lines.push(line);
    return lines;
  }

  function createPdf(lines) {
    const escapedLines = lines.flatMap((line) => wrapPdfLine(line));
    const pages = [];
    for (let index = 0; index < escapedLines.length; index += 48) pages.push(escapedLines.slice(index, index + 48));
    if (!pages.length) pages.push(["Aucune donnee."]);

    const objects = [];
    const pageRefs = pages.map((_, index) => `${4 + (index * 2)} 0 R`).join(" ");
    objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
    objects[2] = `<< /Type /Pages /Kids [${pageRefs}] /Count ${pages.length} >>`;
    objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
    pages.forEach((pageLines, index) => {
      const pageId = 4 + (index * 2);
      const contentId = pageId + 1;
      const commands = pageLines.map((line) => {
        const escaped = asciiText(line).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
        return `(${escaped}) Tj 0 -15 Td`;
      }).join("\n");
      const stream = `BT /F1 10 Tf 42 800 Td\n${commands}\nET`;
      objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
      objects[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
    });

    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    for (let id = 1; id < objects.length; id += 1) {
      offsets[id] = pdf.length;
      pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
    }
    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
    for (let id = 1; id < objects.length; id += 1) pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
    pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return new TextEncoder().encode(pdf).buffer;
  }

  function createRoutesPdf(title, routes, drivers, trailers, trucks, bins) {
    const lines = [title, `${routes.length} tournee(s)`, ""];
    routes.forEach((route, index) => {
      const driver = drivers.find((item) => item.id === route.conducteurId);
      const trailer = trailers.find((item) => item.id === route.remorqueId);
      const truck = trucks.find((item) => item.id === route.camionId);
      const bin = bins.find((item) => item.id === route.benneId);
      lines.push(`${index + 1}. ${route.nom} | ${routeMaterialLabel(route) || "Matiere non renseignee"}`);
      lines.push(`${route.date} ${routeTimeLabel(route)} | Chauffeur: ${driverName(driver)}`);
      lines.push(`Trajet: ${route.depart} -> ${route.arrivee}`);
      lines.push(`Camion: ${truckName(truck)} | Semi-remorque: ${trailerName(trailer)} | Benne: ${binName(bin)}`);
      lines.push(`Statut: ${window.HKUI.routeStatusLabel(route.statut)}`, "");
    });
    if (!routes.length) lines.push("Aucune tournee enregistree.");
    return createPdf(lines);
  }

  function weekNumberFromDate(isoDate) {
    const date = new Date(`${isoDate}T12:00:00Z`);
    const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const day = target.getUTCDay() || 7;
    target.setUTCDate(target.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
    return Math.ceil((((target - yearStart) / 86400000) + 1) / 7);
  }

  function crc32(data) {
    let crc = 0xFFFFFFFF;
    for (let index = 0; index < data.length; index += 1) {
      crc ^= data[index];
      for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xEDB88320 : 0);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function zipHeader(values) {
    const bytes = new Uint8Array(values.length * 2);
    const view = new DataView(bytes.buffer);
    values.forEach((value, index) => view.setUint16(index * 2, value, true));
    return bytes;
  }

  function uint32(value) {
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setUint32(0, value >>> 0, true);
    return bytes;
  }

  function concatBytes(parts) {
    const output = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
    let offset = 0;
    parts.forEach((part) => { output.set(part, offset); offset += part.length; });
    return output;
  }

  function createZip(files) {
    const encoder = new TextEncoder();
    const localParts = [];
    const centralParts = [];
    let localOffset = 0;
    files.forEach((file) => {
      const name = encoder.encode(file.name);
      const data = file.data;
      const crc = crc32(data);
      const local = concatBytes([
        uint32(0x04034B50), zipHeader([20, 0, 0, 0, 0]), uint32(crc), uint32(data.length), uint32(data.length), zipHeader([name.length, 0]), name, data
      ]);
      const central = concatBytes([
        uint32(0x02014B50), zipHeader([20, 20, 0, 0, 0, 0]), uint32(crc), uint32(data.length), uint32(data.length), zipHeader([name.length, 0, 0, 0, 0]), uint32(0), uint32(localOffset), name
      ]);
      localParts.push(local);
      centralParts.push(central);
      localOffset += local.length;
    });
    const central = concatBytes(centralParts);
    const end = concatBytes([
      uint32(0x06054B50), zipHeader([0, 0, files.length, files.length]), uint32(central.length), uint32(localOffset), zipHeader([0])
    ]);
    return new Blob([...localParts, central, end], { type: "application/zip" });
  }

  function exportRoutesPdf(title, routes) {
    const drivers = repository("conducteurs").list();
    const trailers = repository("remorques").list();
    const trucks = repository("camions").list();
    const bins = repository("bennes").list();
    const sortedRoutes = routes.slice().sort((a, b) => `${a.date} ${a.heure}`.localeCompare(`${b.date} ${b.heure}`));
    const pdf = createRoutesPdf(title, sortedRoutes, drivers, trailers, trucks, bins);
    downloadBlob(pdf, `${safeFileName(title)}.pdf`);
    window.HKUI.notify("PDF téléchargé.");
  }

  function exportArchivedWeeksPdf(offsets) {
    const drivers = repository("conducteurs").list();
    const trailers = repository("remorques").list();
    const trucks = repository("camions").list();
    const bins = repository("bennes").list();
    const allRoutes = repository("tournees").list();
    const files = offsets.map((offset) => {
      const days = window.HKCalendar.currentWeek(offset);
      const dates = days.map((day) => day.iso);
      const routes = allRoutes
        .filter((route) => dates.includes(route.date))
        .sort((a, b) => `${a.date} ${a.heure}`.localeCompare(`${b.date} ${b.heure}`));
      const year = new Date(`${days[0].iso}T12:00:00`).getFullYear();
      const title = `Planning S${String(weekNumberFromDate(days[0].iso)).padStart(2, "0")} ${year} - ${days[0].label} au ${days[6].label}`;
      return {
        name: `${safeFileName(title)}.pdf`,
        data: new Uint8Array(createRoutesPdf(title, routes, drivers, trailers, trucks, bins))
      };
    });
    if (files.length === 1) {
      downloadBlob(files[0].data.buffer, files[0].name);
      window.HKUI.notify("PDF téléchargé.");
      return;
    }
    downloadBlob(createZip(files), `archives-plannings-${new Date().toISOString().slice(0, 10)}.zip`);
    window.HKUI.notify(`${files.length} PDF téléchargés dans une archive ZIP.`);
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
      <article class="route-card ${statusClass} ${publicationStatus(route) === "Brouillon" ? "route-draft" : ""} ${isAssignable ? "" : "route-alert"}" draggable="true" data-route-id="${route.id}" ${style}>
        <div class="route-window-actions">
          ${isAssignable ? "" : `<span class="route-alert-badge" title="Chauffeur indisponible">!</span>`}
          <button class="route-icon-action" type="button" data-duplicate-route="${route.id}" aria-label="Dupliquer la tournée">+</button>
          <button class="route-icon-action danger" type="button" data-delete-route="${route.id}" aria-label="Supprimer la tournée">-</button>
        </div>
        <div class="route-scroll">
          <h3 class="route-title">${driver ? driverName(driver) : "Non assigné"}</h3>
          <div class="route-week-name">${route.nom}</div>
          ${publicationStatus(route) === "Brouillon" ? '<span class="route-publication-badge">Brouillon</span>' : ""}
          ${routeMaterialLabel(route) ? `<div class="route-material">${escapeHtml(routeMaterialLabel(route))}</div>` : ""}
          ${route.consignes ? `<div class="route-meta">Consigne : ${escapeHtml(route.consignes)}</div>` : ""}
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
    const routes = repository("tournees").list().filter((route) => route.date === day.iso);
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
            const route = repository("tournees").getById(button.dataset.dayRoute);
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
      repository("configuration").update(configuration.id, { planningVue: requestedMode });
      configuration = planningConfiguration();
    }
    const availableModes = enabledPlanningModes(configuration);
    const mode = availableModes.some((item) => item.value === configuration.planningVue)
      ? configuration.planningVue
      : availableModes[0].value;
    if (mode !== configuration.planningVue) {
      repository("configuration").update(configuration.id, { planningVue: mode });
      configuration = planningConfiguration();
    }
    const modeLabel = planningModes.find((item) => item.value === mode)?.label || "Planning";
    document.querySelectorAll("[data-planning-mode]").forEach((button) => {
      button.classList.toggle("active", button.dataset.planningMode === mode);
    });
    const routes = repository("tournees").list().filter((route) => dates.includes(route.date) && routeMatchesPlanningMode(route, mode, trucks));
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
            <button class="week-screen-lock-button" type="button" data-week-screen-lock aria-label="Verrouiller l’écran" title="Verrouiller l’écran">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.8"/></svg>
            </button>
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
          repository("configuration").update(configuration.id, { planningVerrouille: !configuration.planningVerrouille });
          openWeekView(days, drivers, trailers, trucks, bins, mode);
        });
        node.querySelector("[data-week-screen-lock]")?.addEventListener("click", () => {
          document.querySelector("#screen-lock-button")?.click();
        });
        node.querySelectorAll("[data-week-route]").forEach((button) => {
          button.addEventListener("click", () => {
            const route = repository("tournees").getById(button.dataset.weekRoute);
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
        const route = repository("tournees").getById(id);
        const days = window.HKCalendar.currentWeek(selectedWeekOffset);
        const drivers = repository("conducteurs").list();
        const driver = route ? drivers.find((item) => item.id === route.conducteurId) : null;

        if (driver && !getAvailability(driver, days)[column.dataset.date]) {
          window.HKUI.notify("Chauffeur indisponible sur cette journée.");
          return;
        }

        repository("tournees").update(id, {
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

        repository("tournees").update(route.id, {
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
        const route = repository("tournees").getById(card.dataset.routeId);
        if (!route) return;
        openRouteEditor(route, days, drivers, trailers, trucks, bins);
      });
    });
  }

  function bindRouteActions() {
    document.querySelectorAll("[data-route-status-select]").forEach((select) => {
      select.addEventListener("pointerdown", (event) => event.stopPropagation());
      select.addEventListener("change", () => {
        repository("tournees").update(select.dataset.routeStatusSelect, { statut: select.value });
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
        repository("tournees").remove(button.dataset.deleteRoute);
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
        const routes = repository("tournees").list().filter((route) => dates.includes(route.date));
        exportRoutesPdf(`Résumé semaine ${button.dataset.weekNumber} · ${weekDays[0].label} - ${weekDays[6].label}`, routes);
      });
    });

    document.querySelectorAll("[data-export-day]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const day = days.find((item) => item.iso === button.dataset.exportDay);
        const routes = repository("tournees").list().filter((route) => route.date === button.dataset.exportDay);
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

  function openWeekArchives() {
    const archives = window.HKCalendar.pastWeeks(52);
    const routes = repository("tournees").list();
    const years = [...new Set(archives.map((week) => week.year))];
    window.HKModal.openContent({
      title: "Archives des plannings",
      eyebrow: "52 dernières semaines",
      className: "week-archives-modal",
      content: `
        <div class="week-archive-toolbar">
          <label>Année
            <select class="select" data-archive-year>
              <option value="all">Toutes</option>
              ${years.map((year) => `<option value="${year}">${year}</option>`).join("")}
            </select>
          </label>
          <label class="archive-select-all"><input type="checkbox" data-archive-select-all> Tout sélectionner</label>
          <button class="button primary" type="button" data-export-archives>Exporter <span data-archive-selection-count>0</span> semaine(s)</button>
        </div>
        <div class="week-archive-list">
          ${archives.map((week) => {
            const days = window.HKCalendar.currentWeek(week.offset);
            const dates = days.map((day) => day.iso);
            const routeCount = routes.filter((route) => dates.includes(route.date)).length;
            return `
              <div class="week-archive-row ${week.offset === selectedWeekOffset ? "active" : ""}" data-archive-row data-archive-year-value="${week.year}">
                <input class="archive-week-checkbox" type="checkbox" value="${week.offset}" aria-label="Sélectionner la semaine ${week.number} de ${week.year}">
                <button type="button" data-archive-week="${week.offset}">
                  <strong>S${String(week.number).padStart(2, "0")} · ${week.year}</strong>
                  <span>${week.range}</span>
                  <small>${routeCount} tournée${routeCount === 1 ? "" : "s"}</small>
                </button>
                <button class="pdf-icon-button" type="button" data-archive-pdf="${week.offset}" aria-label="Exporter cette semaine en PDF">PDF</button>
              </div>
            `;
          }).join("")}
        </div>
      `,
      onOpen(node) {
        const rows = [...node.querySelectorAll("[data-archive-row]")];
        const selectAll = node.querySelector("[data-archive-select-all]");
        const updateCount = () => {
          const count = node.querySelectorAll(".archive-week-checkbox:checked").length;
          node.querySelector("[data-archive-selection-count]").textContent = count;
        };
        node.querySelector("[data-archive-year]").addEventListener("change", (event) => {
          rows.forEach((row) => {
            row.hidden = event.target.value !== "all" && row.dataset.archiveYearValue !== event.target.value;
          });
          selectAll.checked = false;
        });
        selectAll.addEventListener("change", () => {
          rows.filter((row) => !row.hidden).forEach((row) => {
            row.querySelector(".archive-week-checkbox").checked = selectAll.checked;
          });
          updateCount();
        });
        node.querySelectorAll(".archive-week-checkbox").forEach((checkbox) => checkbox.addEventListener("change", updateCount));
        node.querySelector("[data-export-archives]").addEventListener("click", () => {
          const offsets = [...node.querySelectorAll(".archive-week-checkbox:checked")].map((checkbox) => Number(checkbox.value));
          if (!offsets.length) {
            window.HKUI.notify("Sélectionnez au moins une semaine à exporter.");
            return;
          }
          exportArchivedWeeksPdf(offsets);
        });
        node.querySelectorAll("[data-archive-week]").forEach((button) => {
          button.addEventListener("click", () => {
            selectedWeekOffset = Number(button.dataset.archiveWeek);
            window.HKModal.close();
            render();
          });
        });
        node.querySelectorAll("[data-archive-pdf]").forEach((button) => {
          button.addEventListener("click", () => {
            const offset = Number(button.dataset.archivePdf);
            const days = window.HKCalendar.currentWeek(offset);
            const dates = days.map((day) => day.iso);
            const weekRoutes = routes.filter((route) => dates.includes(route.date));
            exportRoutesPdf(`Archive · ${days[0].label} - ${days[6].label}`, weekRoutes);
          });
        });
      }
    });
  }

  function bindWeekArchives() {
    document.querySelector("[data-open-archives]")?.addEventListener("click", openWeekArchives);
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
    const archiveOptions = window.HKCalendar.pastWeeks(52);
    const days = window.HKCalendar.currentWeek(selectedWeekOffset);
    const currentOption = weekOptions.find((week) => week.offset === selectedWeekOffset)
      || archiveOptions.find((week) => week.offset === selectedWeekOffset)
      || weekOptions[1];
    const drivers = repository("conducteurs").list();
    const trailers = repository("remorques").list();
    const trucks = repository("camions").list();
    const bins = repository("bennes").list();
    const configuration = planningConfiguration();
    const routes = repository("tournees").list();

    workspace.querySelector(".week-board")?._topScrollObserver?.disconnect();
    workspace.innerHTML = "";
    workspace.insertAdjacentHTML("beforeend", `
      <div class="section-header">
        <div>
          <h2>${currentOption.label}</h2>
          <span class="tag">${days[0].label} - ${days[6].label}</span>
        </div>
        <div class="actions">
          <button class="button ghost" type="button" data-open-archives>Archives</button>
          <button class="button primary" type="button" data-publish-week>Publier la semaine</button>
          <button class="button ghost" type="button" data-open-week>Vue semaine</button>
        </div>
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
    workspace.querySelector("[data-publish-week]").addEventListener("click", () => publishWeek(days));
    bindAvailabilityControls(days, drivers);
    bindRouteActions();
    bindRouteOpen(days, drivers, trailers, trucks, bins);
    bindCreateSlots();
    bindExportControls(days);
    bindDayViews(days, drivers, trailers, trucks, bins);
    bindWeekView(days, drivers, trailers, trucks, bins);
    bindWeekArchives();
    bindDrag();
    bindBoardScrollbars();
    bindPlanningModeControls(configuration, days, drivers, trailers, trucks, bins);
  }

  window.HKPlanning = { render };
})();
