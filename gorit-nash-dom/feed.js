'use strict';
(() => {
  const audio = document.getElementById('latest-audio');
  const button = document.getElementById('latest-play');
  const status = document.getElementById('latest-status');
  button.style.display = 'inline-flex';
  button.addEventListener('click', async () => {
    if (!audio.paused) { audio.pause(); return; }
    try { await audio.play(); status.textContent = ''; }
    catch { status.textContent = 'Нажми Play в плеере или скачай MP3 ниже.'; }
  });
  const sync = () => { button.textContent = audio.paused ? '► Слушать «Горит наш дом»' : 'Ⅱ Пауза'; };
  ['play', 'pause', 'ended'].forEach(event => audio.addEventListener(event, sync));
  audio.addEventListener('error', () => { status.textContent = 'Не удалось загрузить аудио. Попробуй скачать MP3.'; });
  // Includes the existing album player; retain its controls and state listeners.
  document.addEventListener('play', event => {
    if (event.target.tagName !== 'AUDIO') return;
    document.querySelectorAll('audio').forEach(other => {
      if (other !== event.target && !other.paused) other.pause();
    });
  }, true);
})();
