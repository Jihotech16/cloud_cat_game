// 배경음악(BGM) — 장면마다 다른 곡을 반복 재생한다.
// - 로비(시작 화면): assets/audio/bgm-lobby.m4a  ("Cloudlike Bounce", Suno 유료 플랜 제작)
// - 게임 중(플레이·일시정지·게임오버): assets/audio/bgm-game.m4a  ("Cloud Hopper", Suno 유료 플랜 제작)
// 음소거 설정은 localStorage 에 저장. 첫 사용자 입력 이후에만 재생(모바일 정책).

const MUTE_KEY = 'cloudCat_bgmMuted';

// 두 곡 모두 꽉 찬 음량(평균 약 -18dB)이다. 효과음은 짧게 -25~-16dB 로 튀는 소리라,
// 음악이 계속 깔리면 쉽게 덮인다. 음악 평균이 효과음보다 10dB 정도 낮도록(약 -38dB) 0.1 로 둔다.
const TRACKS = {
  lobby: { src: 'assets/audio/bgm-lobby.m4a', volume: 0.1 },
  game: { src: 'assets/audio/bgm-game.m4a', volume: 0.1 },
};
const FADE_IN = 1.2;
const FADE_OUT = 0.6;

let ctx = null;
let playing = false;   // BGM 이 켜져 있는지(장면과 무관)
let scene = 'lobby';   // 'lobby' | 'game'
const players = {};    // 장면별 { el, gain, pauseTimer }

function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function fade(gainNode, to, seconds) {
  const now = ctx.currentTime;
  gainNode.gain.cancelScheduledValues(now);
  gainNode.gain.setValueAtTime(Math.max(0.0001, gainNode.gain.value), now);
  gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0001, to), now + seconds);
}

// iOS 는 <audio> 의 volume 을 무시하므로, 요소를 WebAudio 에 연결해 게인으로 음량·페이드를 준다.
function playerFor(name) {
  if (!players[name]) {
    const el = new Audio(TRACKS[name].src);
    el.loop = true;
    el.preload = 'auto';
    el.setAttribute('playsinline', '');
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    ctx.createMediaElementSource(el).connect(gain);
    gain.connect(ctx.destination);
    players[name] = { el, gain, pauseTimer: null };
  }
  return players[name];
}

function startTrack(name) {
  const p = playerFor(name);
  if (p.pauseTimer) { clearTimeout(p.pauseTimer); p.pauseTimer = null; }
  p.el.play().catch((err) => console.warn(`BGM(${name}) 재생 실패:`, err));
  fade(p.gain, TRACKS[name].volume, FADE_IN);
}

function stopTrack(name) {
  const p = players[name];
  if (!p) return;
  fade(p.gain, 0, FADE_OUT);
  // 페이드가 끝난 뒤 멈춘다. 멈춘 위치에서 다음에 이어서 재생된다.
  if (p.pauseTimer) clearTimeout(p.pauseTimer);
  p.pauseTimer = setTimeout(() => {
    p.pauseTimer = null;
    p.el.pause();
  }, FADE_OUT * 1000 + 50);
}

function applyScene() {
  for (const name of Object.keys(TRACKS)) {
    if (name === scene) startTrack(name);
    else stopTrack(name);
  }
}

export function isBgmMuted() {
  return localStorage.getItem(MUTE_KEY) === '1';
}

export function startBgm() {
  if (playing || isBgmMuted()) return;
  if (!getCtx()) return;
  playing = true;
  applyScene();
}

export function stopBgm() {
  if (!playing) return;
  playing = false;
  if (!ctx) return;
  for (const name of Object.keys(TRACKS)) stopTrack(name);
}

// 장면 전환: 'lobby'(시작 화면) 또는 'game'(플레이 중). 켜져 있으면 곡을 교차 페이드한다.
export function setBgmScene(next) {
  if (next === scene || !TRACKS[next]) return;
  scene = next;
  if (playing && getCtx()) applyScene();
}

// 음소거 토글. 켜면 재생 시작, 끄면 정지 + 설정 저장. 반환값 = 음소거 여부.
export function toggleBgm() {
  const muted = !isBgmMuted();
  localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  if (muted) stopBgm();
  else startBgm();
  return muted;
}

// 앱이 백그라운드로 가면 곡을 멈추고, 돌아오면 이어서 튼다.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    const p = players[scene];
    if (!p || !playing) return;
    if (document.hidden) p.el.pause();
    else p.el.play().catch(() => {});
  });
}
