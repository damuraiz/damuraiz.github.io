'use strict';
const audio = document.querySelector('#audio');
const play = document.querySelector('#play');
const seek = document.querySelector('#seek');
const formatTime = n => `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}`;
function syncPlay() { const paused = audio.paused; play.setAttribute('aria-label', paused ? 'Воспроизвести трек' : 'Пауза'); play.innerHTML = paused ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4l13 8-13 8z"/></svg>' : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>'; const hero = document.querySelector('#hero-play'); hero.querySelector('span').textContent = paused ? 'Включить трек' : 'Пауза'; hero.querySelector('svg').innerHTML = play.querySelector('svg').innerHTML; }
play.addEventListener('click', async () => { if (!audio.paused) { audio.pause(); return; } try { await audio.play(); document.querySelector('#player-status').textContent = ''; } catch { document.querySelector('#player-status').textContent = 'Не удалось включить трек. Попробуй ещё раз или скачай MP3 ниже.'; } });
audio.addEventListener('play', syncPlay); audio.addEventListener('pause', syncPlay); audio.addEventListener('ended', syncPlay);
audio.addEventListener('loadedmetadata', () => { seek.max = audio.duration; document.querySelector('#duration').textContent = formatTime(audio.duration); });
audio.addEventListener('timeupdate', () => { seek.value = audio.currentTime; seek.setAttribute('aria-valuetext', formatTime(audio.currentTime)); document.querySelector('#current').textContent = formatTime(audio.currentTime); document.querySelector('#wave-highlight').style.width = `${Number.isFinite(audio.duration) ? audio.currentTime/audio.duration*100 : 0}%`; });
seek.addEventListener('input', () => { if(Number.isFinite(audio.duration)) audio.currentTime = Number(seek.value); });
audio.addEventListener('error', () => { document.querySelector('#player-status').textContent = 'Аудио недоступно. Попробуй скачать файл ниже.'; });
document.querySelector('#hero-play').addEventListener('click', () => play.click());
const waveform = document.querySelector('.waveform');
const sizeWaveform = () => waveform.style.setProperty('--wave-width', `${waveform.clientWidth}px`);
new ResizeObserver(sizeWaveform).observe(waveform);
sizeWaveform();
