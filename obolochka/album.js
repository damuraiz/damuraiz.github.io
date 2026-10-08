(() => {
  "use strict";
  const album = window.ALBUM;
  if (!album?.tracks?.length) return;
  const tracks = album.tracks;
  const $ = (id) => document.getElementById(id);
  const audio = $("audio");
  const seek = $("seek");
  const status = $("player-status");
  const buttons = [$("play"), $("mini-play")];
  const sceneImages = [$("scene-a"), $("scene-b")];
  let selected = 0;
  let repeat = false;
  let playerVisible = true;
  let started = false;
  let playRequest = 0;
  let sceneRequest = 0;
  let sceneLayer = 0;
  const format = (seconds, round = false) => {
    const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    const n = round ? Math.round(safe) : Math.floor(safe);
    return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
  };
  const trackDuration = () =>
    Number.isFinite(audio.duration) && audio.duration > 0
      ? audio.duration
      : tracks[selected].duration;
  function updateTime() {
    const duration = trackDuration();
    const time = Math.max(0, Math.min(audio.currentTime || 0, duration));
    seek.max = duration;
    seek.value = time;
    seek.style.setProperty(
      "--progress",
      `${Math.min(100, (time / duration) * 100)}%`,
    );
    seek.setAttribute(
      "aria-valuetext",
      `${format(time)} из ${format(duration, true)}`,
    );
    $("elapsed").textContent = format(time);
    $("duration").textContent = format(duration, true);
  }
  function updateMini() {
    const show = started && !playerVisible;
    $("mini-player").hidden = !show;
    document.body.classList.toggle("has-mini", show);
  }
  function updatePlayback() {
    const playing = !audio.paused && !audio.ended;
    document.body.classList.toggle("playing", playing);
    buttons.forEach((button) => {
      button.setAttribute(
        "aria-label",
        playing ? "Приостановить трек" : "Воспроизвести трек",
      );
      button.firstElementChild
        ? (button.firstElementChild.textContent = playing ? "Ⅱ" : "►")
        : (button.textContent = playing ? "Ⅱ" : "►");
    });
    $("hero-play").querySelector(".play-symbol").textContent = playing
      ? "Ⅱ"
      : "►";
    $("hero-play-label").textContent = playing
      ? "Пауза"
      : started
        ? "Продолжить слушать"
        : selected === 0
          ? "Слушать альбом"
          : "Слушать трек";
    $("playback-label").textContent = playing
      ? "СЕЙЧАС ИГРАЕТ"
      : started
        ? "НА ПАУЗЕ"
        : "ВЫБРАННЫЙ ТРЕК";
    updateMini();
    if ("mediaSession" in navigator)
      navigator.mediaSession.playbackState = playing ? "playing" : "paused";
  }
  function showLyrics(index) {
    tracks.forEach((track, i) => {
      $(`text-${track.id}`).hidden = i !== index;
    });
    document
      .querySelectorAll("[data-lyrics]")
      .forEach((button, i) =>
        button.setAttribute("aria-pressed", String(i === index)),
      );
  }
  async function showScene(track) {
    const request = ++sceneRequest;
    const next = sceneImages[1 - sceneLayer];
    // Decode before crossfading; a failed image never hides the previous scene.
    const image = new Image();
    image.src = track.art;
    try {
      await image.decode();
    } catch {
      return;
    }
    if (request !== sceneRequest) return;
    next.src = track.art;
    next.classList.add("visible");
    sceneImages[sceneLayer].classList.remove("visible");
    sceneLayer = 1 - sceneLayer;
    $("active-scene").src = track.art;
    $("active-scene").alt = track.scene;
    $("active-scene-caption").textContent =
      `${String(selected + 1).padStart(2, "0")} / ${track.title}`;
  }
  function updateMetadata(track) {
    if (!("mediaSession" in navigator) || !("MediaMetadata" in window)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: album.artist,
      album: album.title,
      artwork: [
        {
          src: new URL("/assets/obolochka/cover.webp", document.baseURI).href,
          sizes: "720x720",
          type: "image/webp",
        },
      ],
    });
  }
  function renderTrack() {
    const track = tracks[selected];
    document.documentElement.style.setProperty("--accent", track.accent);
    $("player-title").textContent = track.title;
    $("mini-title").textContent = track.title;
    $("scene-mood").textContent = track.mood.toUpperCase();
    $("scene-number").textContent =
      `${String(selected + 1).padStart(2, "0")} / 04`;
    $("scene-quote").textContent = track.quote;
    $("track-spotify").href = `https://open.spotify.com/track/${track.spotify}`;
    for (const platform of ["youtube", "instagram", "tiktok"]) {
      const link = $(`track-${platform}`);
      const url = window.ALBUM_LINKS?.[`${platform}Tracks`]?.[track.id];
      link.hidden = !url;
      if (url) link.href = url;
      else link.removeAttribute("href");
    }
    document.querySelectorAll("[data-track]").forEach((row, i) => {
      const isSelected = i === selected;
      row.classList.toggle("selected", isSelected);
      const button = row.querySelector("[data-select]");
      if (isSelected) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
    });
    showLyrics(selected);
    void showScene(track);
    updateTime();
    updateMetadata(track);
    updatePlayback();
  }
  async function play() {
    const request = ++playRequest;
    status.textContent = "Загружаем трек…";
    try {
      await audio.play();
      if (request !== playRequest) return;
      started = true;
      status.textContent = "";
      updatePlayback();
    } catch (error) {
      if (request !== playRequest || error.name === "AbortError") return;
      status.textContent =
        error.name === "NotAllowedError"
          ? "Нажми ►, чтобы начать воспроизведение."
          : "Не удалось воспроизвести трек. Попробуй ещё раз или скачай MP3.";
      updatePlayback();
    }
  }
  function pause() {
    ++playRequest;
    audio.pause();
    status.textContent = "";
    updatePlayback();
  }
  function toggle() {
    audio.paused || audio.ended ? void play() : pause();
  }
  function selectTrack(index, autoplay = false, updateURL = true) {
    if (index < 0 || index >= tracks.length) return;
    ++playRequest;
    audio.pause();
    selected = index;
    started = false;
    status.textContent = "";
    audio.src = tracks[index].audio;
    audio.load();
    renderTrack();
    if (updateURL) {
      const url = new URL(location.href);
      url.searchParams.set("track", tracks[index].id);
      try {
        history.replaceState(null, "", url);
      } catch {
        /* Player also works from file:// previews. */
      }
    }
    if (autoplay) void play();
  }
  function step(direction) {
    selectTrack((selected + direction + tracks.length) % tracks.length, true);
  }
  buttons.forEach((button) => button.addEventListener("click", toggle));
  $("hero-play").addEventListener("click", () => {
    if (audio.ended && selected === tracks.length - 1) selectTrack(0, true);
    else toggle();
  });
  $("previous").addEventListener("click", () => step(-1));
  [$("next"), $("mini-next")].forEach((button) =>
    button.addEventListener("click", () => step(1)),
  );
  document.querySelectorAll("[data-select]").forEach((button) =>
    button.addEventListener("click", () => {
      const index = Number(button.dataset.select);
      if (index === selected) toggle();
      else selectTrack(index, true);
    }),
  );
  document
    .querySelectorAll("[data-lyrics]")
    .forEach((button) =>
      button.addEventListener("click", () =>
        showLyrics(Number(button.dataset.lyrics)),
      ),
    );
  $("read-current").addEventListener("click", () => showLyrics(selected));
  seek.addEventListener("input", () => {
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
    audio.currentTime = Math.max(
      0,
      Math.min(Number(seek.value), audio.duration),
    );
    updateTime();
  });
  $("repeat").addEventListener("click", () => {
    repeat = !repeat;
    $("repeat").setAttribute("aria-pressed", String(repeat));
  });
  function updateVolume() {
    const silent = audio.muted || audio.volume === 0;
    $("mute").setAttribute("aria-pressed", String(silent));
    $("mute").setAttribute(
      "aria-label",
      silent ? "Включить звук" : "Выключить звук",
    );
    $("volume").value = audio.volume;
    $("volume").setAttribute(
      "aria-valuetext",
      `${Math.round(audio.volume * 100)}%`,
    );
  }
  $("mute").addEventListener("click", () => {
    if (audio.muted || audio.volume === 0) {
      audio.muted = false;
      if (audio.volume === 0) audio.volume = 1;
    } else audio.muted = true;
    updateVolume();
  });
  $("volume").addEventListener("input", () => {
    audio.volume = Number($("volume").value);
    audio.muted = false;
    updateVolume();
  });
  audio.addEventListener("volumechange", updateVolume);
  ["timeupdate", "loadedmetadata", "durationchange", "seeked"].forEach(
    (event) => audio.addEventListener(event, updateTime),
  );
  audio.addEventListener("play", () => {
    started = true;
    updatePlayback();
  });
  audio.addEventListener("pause", updatePlayback);
  audio.addEventListener("playing", () => {
    status.textContent = "";
    updatePlayback();
  });
  audio.addEventListener("waiting", () => {
    if (!audio.paused) status.textContent = "Загружаем трек…";
  });
  audio.addEventListener("error", () => {
    status.textContent =
      "Не удалось загрузить трек. Попробуй ещё раз или скачай MP3.";
    updatePlayback();
  });
  audio.addEventListener("ended", () => {
    if (selected < tracks.length - 1) selectTrack(selected + 1, true);
    else if (repeat) selectTrack(0, true);
    else {
      started = false;
      updatePlayback();
      $("playback-label").textContent = "АЛЬБОМ ПРОСЛУШАН";
      $("hero-play-label").textContent = "Слушать ещё раз";
      status.textContent = "Альбом закончился. До завтра.";
    }
  });
  document.addEventListener("keydown", (event) => {
    if (
      event.code !== "Space" ||
      event.repeat ||
      event.ctrlKey ||
      event.altKey ||
      event.metaKey ||
      event.shiftKey
    )
      return;
    if (
      event.target.closest("button,a,input,select,textarea,[contenteditable]")
    )
      return;
    event.preventDefault();
    toggle();
  });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      ([entry]) => {
        playerVisible = entry.isIntersecting;
        updateMini();
      },
      { threshold: 0.15 },
    ).observe(document.querySelector(".player"));
  }
  if ("mediaSession" in navigator) {
    const actions = {
      play: () => void play(),
      pause,
      previoustrack: () => step(-1),
      nexttrack: () => step(1),
      seekto: ({ seekTime }) => {
        if (Number.isFinite(seekTime) && Number.isFinite(audio.duration))
          audio.currentTime = Math.max(0, Math.min(seekTime, audio.duration));
      },
    };
    Object.entries(actions).forEach(([action, handler]) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        /* Optional browser capability. */
      }
    });
  }
  document.querySelectorAll("[data-platform]").forEach((link) => {
    const url = window.ALBUM_LINKS?.[link.dataset.platform];
    if (url) link.href = url;
  });
  document.documentElement.classList.add("js");
  const initial = tracks.findIndex(
    (track) => track.id === new URLSearchParams(location.search).get("track"),
  );
  if (initial > 0) selectTrack(initial, false, false);
  else renderTrack();
  updateVolume();
})();
