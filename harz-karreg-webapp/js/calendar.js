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

  function currentWeek() {
    const start = startOfWeek();
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

  window.HKCalendar = { currentWeek };
})();
