(() => {
  const runtime = window.harzKarregDesktop?.runtime;
  const runtimeInfo = document.querySelector("#runtime-info");

  if (runtime && runtimeInfo) {
    runtimeInfo.textContent = `Electron ${runtime.electron} · ${runtime.platform} · authentification à venir`;
  }
})();
