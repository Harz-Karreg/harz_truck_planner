(function () {
  const days = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

  function toISO(date) {
    return date.toISOString().slice(0, 10);
  }

  function startOfWeek(date = new Date()) {
    const copy = new Date(date);
    const day = copy.getDay() === 0 ? 7 : copy.getDay();
    copy.setHours(12, 0, 0, 0);
    copy.setDate(copy.getDate() - day + 1);
    return copy;
  }

  function weekNumber(date) {
    const copy = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNumber = copy.getUTCDay() || 7;
    copy.setUTCDate(copy.getUTCDate() + 4 - dayNumber);
    const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
    return Math.ceil((((copy - yearStart) / 86400000) + 1) / 7);
  }

  function currentWeek(offset = 0) {
    const start = startOfWeek();
    start.setDate(start.getDate() + offset * 7);
    return days.map((name, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return {
        name,
        iso: toISO(date),
        label: date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
      };
    });
  }

  function weeksUntilDecember() {
    const weeks = [];
    const currentStart = startOfWeek();
    const lastDay = new Date(currentStart.getFullYear(), 11, 31, 12);
    const firstOffset = -1;
    const lastOffset = Math.floor((lastDay - currentStart) / (7 * 24 * 60 * 60 * 1000));

    for (let offset = firstOffset; offset <= lastOffset; offset += 1) {
      const week = currentWeek(offset);
      const label = offset === -1 ? "Semaine passée" : offset === 0 ? "Semaine en cours" : `Semaine du ${week[0].label}`;
      weeks.push({
        offset,
        number: weekNumber(new Date(`${week[0].iso}T12:00:00`)),
        label,
        range: `${week[0].label} - ${week[6].label}`,
        weekStart: week[0].iso
      });
    }

    return weeks;
  }

  function pastWeeks(count = 52) {
    const weeks = [];
    for (let offset = -1; offset >= -count; offset -= 1) {
      const week = currentWeek(offset);
      weeks.push({
        offset,
        number: weekNumber(new Date(`${week[0].iso}T12:00:00`)),
        year: new Date(`${week[0].iso}T12:00:00`).getFullYear(),
        label: `Semaine ${String(weekNumber(new Date(`${week[0].iso}T12:00:00`))).padStart(2, "0")}`,
        range: `${week[0].label} - ${week[6].label}`,
        weekStart: week[0].iso
      });
    }
    return weeks;
  }

  window.HKCalendar = { currentWeek, pastWeeks, weeksUntilDecember };
})();
