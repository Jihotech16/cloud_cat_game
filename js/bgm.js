// 배경음악(BGM) — 장면마다 다른 곡을 튼다.
// - 로비(시작 화면): assets/audio/bgm-lobby.m4a 반복 재생
// - 게임 중(플레이·일시정지·게임오버): 외부 파일 없이 WebAudio 로 합성하는 잔잔한 루프
// 음소거 설정은 localStorage 에 저장. 첫 사용자 입력 이후에만 재생(모바일 정책).

const MUTE_KEY = 'cloudCat_bgmMuted';
const BPM = 90;
const BEAT = 60 / BPM;
const STEP = BEAT / 2;      // 8분음표 단위
const LOOKAHEAD = 0.12;     // 스케줄 선반영(초)
const TICK = 25;            // 스케줄러 주기(ms)
const VOLUME = 0.16;        // 합성 BGM 전체 볼륨(작게, 효과음보다 낮게)

// 로비 곡. 파일 자체가 꽉 찬 음량(평균 약 -16dB)이라 합성 BGM 과 비슷하게 들리도록 낮춘다.
const LOBBY_SRC = 'assets/audio/bgm-lobby.m4a';
const LOBBY_VOLUME = 0.3;
const FADE_IN = 1.2;
const FADE_OUT = 0.6;

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 코드 진행: C · G · Am · F (각 4박). 루트 + 트라이어드.
const CHORDS = [
  { root: 48, triad: [60, 64, 67] }, // C
  { root: 43, triad: [59, 62, 67] }, // G
  { root: 45, triad: [60, 64, 69] }, // Am
  { root: 41, triad: [60, 65, 69] }, // F
];
// 멜로디(32스텝 = 4마디, C 메이저 펜타토닉). null = 쉼표.
const MELODY = [
  76, null, 81, null, 79, null, 76, null,
  79, null, 74, null, 72, null, 74, null,
  76, null, 72, null, 69, null, 72, null,
  72, null, 76, null, 79, null, 81, null,
];
const LOOP = 32;

let ctx = null;
let master = null;          // 합성 BGM 출력
let playing = false;        // BGM 이 켜져 있는지(장면과 무관)
let scene = 'lobby';        // 'lobby' | 'game'
let synthRunning = false;
let lobbyEl = null;
let lobbyGain = null;
let lobbyPauseTimer = null;
let timerId = null;
let nextTime = 0;
let step = 0;

function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function note({ freq, type = 'sine', t, dur, gain, attack = 0.01, detune = 0 }) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (detune) osc.detune.setValueAtTime(detune, t);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function scheduleStep(s, t) {
  const chordIdx = Math.floor(s / 8) % CHORDS.length;
  const beatInChord = s % 8;
  const ch = CHORDS[chordIdx];

  // 패드(코드): 각 코드 시작에서 길게 깔아준다.
  if (beatInChord === 0) {
    for (const n of ch.triad) {
      note({ freq: midi(n), type: 'triangle', t, dur: BEAT * 3.6, gain: 0.045, attack: 0.06, detune: 3 });
    }
  }
  // 베이스: 1박·3박.
  if (beatInChord === 0 || beatInChord === 4) {
    note({ freq: midi(ch.root), type: 'sine', t, dur: BEAT * 1.6, gain: 0.11, attack: 0.01 });
  }
  // 멜로디.
  const m = MELODY[s];
  if (m != null) {
    note({ freq: midi(m), type: 'triangle', t, dur: STEP * 1.7, gain: 0.085, attack: 0.008 });
  }
}

function scheduler() {
  const c = getCtx();
  if (!c) return;
  while (nextTime < c.currentTime + LOOKAHEAD) {
    scheduleStep(step % LOOP, nextTime);
    nextTime += STEP;
    step += 1;
  }
}

export function isBgmMuted() {
  return localStorage.getItem(MUTE_KEY) === '1';
}

function fade(gainNode, to, seconds) {
  const now = ctx.currentTime;
  gainNode.gain.cancelScheduledValues(now);
  gainNode.gain.setValueAtTime(Math.max(0.0001, gainNode.gain.value), now);
  gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0001, to), now + seconds);
}

// ── 게임 중: 합성 BGM ──
function startSynth() {
  if (synthRunning) return;
  synthRunning = true;
  step = 0;
  nextTime = ctx.currentTime + 0.1;
  fade(master, VOLUME, FADE_IN);
  timerId = setInterval(scheduler, TICK);
}

function stopSynth() {
  if (!synthRunning) return;
  synthRunning = false;
  if (timerId) { clearInterval(timerId); timerId = null; }
  fade(master, 0, FADE_OUT);
}

// ── 로비: 파일 재생 ──
// iOS 는 <audio> 의 volume 을 무시하므로, 요소를 WebAudio 에 연결해 게인으로 음량·페이드를 준다.
function ensureLobby() {
  if (lobbyEl) return;
  lobbyEl = new Audio(LOBBY_SRC);
  lobbyEl.loop = true;
  lobbyEl.preload = 'auto';
  lobbyEl.setAttribute('playsinline', '');
  lobbyGain = ctx.createGain();
  lobbyGain.gain.value = 0.0001;
  ctx.createMediaElementSource(lobbyEl).connect(lobbyGain);
  lobbyGain.connect(ctx.destination);
}

function startLobby() {
  ensureLobby();
  if (lobbyPauseTimer) { clearTimeout(lobbyPauseTimer); lobbyPauseTimer = null; }
  lobbyEl.play().catch((err) => console.warn('로비 BGM 재생 실패:', err));
  fade(lobbyGain, LOBBY_VOLUME, FADE_IN);
}

function stopLobby() {
  if (!lobbyEl) return;
  fade(lobbyGain, 0, FADE_OUT);
  // 페이드가 끝난 뒤 멈춘다. 멈춘 위치에서 다음에 이어서 재생된다.
  if (lobbyPauseTimer) clearTimeout(lobbyPauseTimer);
  lobbyPauseTimer = setTimeout(() => {
    lobbyPauseTimer = null;
    lobbyEl.pause();
  }, FADE_OUT * 1000 + 50);
}

function applyScene() {
  if (scene === 'lobby') {
    stopSynth();
    startLobby();
  } else {
    stopLobby();
    startSynth();
  }
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
  stopSynth();
  stopLobby();
}

// 장면 전환: 'lobby'(시작 화면) 또는 'game'(플레이 중). 켜져 있으면 곡을 교차 페이드한다.
export function setBgmScene(next) {
  if (next === scene) return;
  scene = next;
  if (playing && getCtx()) applyScene();
}

// 앱이 백그라운드로 가면 로비 곡을 멈추고, 돌아오면 이어서 튼다.
// (합성 BGM 은 타이머가 멈추므로 따로 처리할 필요가 없다)
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!lobbyEl || !playing || scene !== 'lobby') return;
    if (document.hidden) lobbyEl.pause();
    else lobbyEl.play().catch(() => {});
  });
}

// 음소거 토글. 켜면 재생 시작, 끄면 정지 + 설정 저장. 반환값 = 음소거 여부.
export function toggleBgm() {
  const muted = !isBgmMuted();
  localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  if (muted) stopBgm();
  else startBgm();
  return muted;
}
