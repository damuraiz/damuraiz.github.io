(() => {
  "use strict";
  const audio = document.getElementById("single-audio");
  if (!audio) return;
  const play = document.getElementById("single-play");
  const miniPlay = document.getElementById("single-mini-play");
  const mini = document.getElementById("single-mini");
  const seek = document.getElementById("single-seek");
  const status = document.getElementById("single-status");
  let started = false;
  let playerVisible = true;
  let request = 0;
  const format = (seconds) => {
    const n = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
    return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
  };
  function updateMini() {
    const show = started && !audio.ended && !playerVisible;
    mini.hidden = !show;
    document.body.classList.toggle("has-mini", show);
  }
  function updatePlayback() {
    const playing = !audio.paused && !audio.ended;
    [play, miniPlay].forEach((button) => {
      button.querySelector("[data-play-icon]").textContent = playing ? "Ⅱ" : "►";
      button.setAttribute("aria-label", playing ? "Приостановить трек" : "Воспроизвести трек «Горит наш дом»");
    });
    play.querySelector("[data-play-label]").textContent = playing ? "Пауза" : audio.ended ? "Слушать ещё раз" : started ? "Продолжить" : "Слушать трек";
    document.getElementById("playback-label").textContent = playing ? "СЕЙЧАС ИГРАЕТ" : started ? "НА ПАУЗЕ" : "ПОЛНЫЙ ТРЕК";
    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = playing ? "playing" : "paused";
    updateMini();
  }
  function updateTime() {
    const duration = Number.isFinite(audio.duration) ? audio.duration : 222.4;
    seek.max = duration;
    seek.value = audio.currentTime;
    seek.style.setProperty("--progress", `${duration > 0 ? audio.currentTime / duration * 100 : 0}%`);
    seek.setAttribute("aria-valuetext", `${format(audio.currentTime)} из ${format(duration)}`);
    document.getElementById("elapsed").textContent = format(audio.currentTime);
    document.getElementById("duration").textContent = format(duration);
  }
  function pause() { ++request; audio.pause(); status.textContent = ""; }
  async function resume() {
    const current = ++request;
    status.textContent = "Загружаем трек…";
    if (audio.ended) audio.currentTime = 0;
    try {
      await audio.play();
      if (current !== request) return;
      status.textContent = "";
    } catch (error) {
      if (current !== request || error.name === "AbortError") return;
      status.textContent = "Не удалось включить трек. Попробуй ещё раз или скачай MP3.";
    }
  }
  const toggle = () => audio.paused || audio.ended ? void resume() : pause();
  [play, miniPlay].forEach((button) => button.addEventListener("click", toggle));
  audio.addEventListener("play", () => { started = true; updatePlayback(); });
  audio.addEventListener("playing", () => { status.textContent = ""; });
  audio.addEventListener("pause", updatePlayback);
  audio.addEventListener("ended", () => {
    started = false;
    status.textContent = "";
    updatePlayback();
    document.getElementById("playback-label").textContent = "ТРЕК ПРОСЛУШАН";
  });
  audio.addEventListener("error", () => { status.textContent = "Аудио недоступно. Попробуй скачать MP3."; });
  audio.addEventListener("waiting", () => { if (!audio.paused) status.textContent = "Загружаем трек…"; });
  ["timeupdate", "loadedmetadata", "durationchange", "seeked"].forEach((event) => audio.addEventListener(event, updateTime));
  seek.addEventListener("input", () => {
    if (Number.isFinite(audio.duration)) audio.currentTime = Math.min(Number(seek.value), audio.duration);
    updateTime();
  });
  document.addEventListener("keydown", (event) => {
    if (event.code !== "Space" || event.repeat || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey || event.target.closest("button,a,input,select,textarea,audio,[contenteditable]")) return;
    event.preventDefault();
    toggle();
  });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => { playerVisible = entry.isIntersecting; updateMini(); }, { threshold: 0.15 }).observe(play);
  }
  if ("mediaSession" in navigator && "MediaMetadata" in window) {
    navigator.mediaSession.metadata = new MediaMetadata({ title: "Горит наш дом", artist: "Damuraiz", artwork: [{ src: new URL("/assets/gorit-nash-dom/cover.jpg", location.href).href, sizes: "1536x1536", type: "image/jpeg" }] });
    for (const [action, handler] of Object.entries({ play: resume, pause, seekto: ({ seekTime }) => { if (Number.isFinite(seekTime) && Number.isFinite(audio.duration)) audio.currentTime = Math.max(0, Math.min(seekTime, audio.duration)); } })) {
      try { navigator.mediaSession.setActionHandler(action, handler); } catch { /* Optional browser capability. */ }
    }
  }
  // Native controls stay available if initialization fails or JavaScript is off.
  play.hidden = false;
  document.getElementById("single-timeline").hidden = false;
  document.body.classList.add("player-ready");
  updateTime();
})();
