// 배경음악(BGM) — 외부 파일 없이 WebAudio 로 합성하는 잔잔한 루프.
// 음소거 설정은 localStorage 에 저장. 첫 사용자 입력 이후에만 재생(모바일 정책).

const MUTE_KEY = 'cloudCat_bgmMuted';
const BPM = 90;
const BEAT = 60 / BPM;
const STEP = BEAT / 2;      // 8분음표 단위
const LOOKAHEAD = 0.12;     // 스케줄 선반영(초)
const TICK = 25;            // 스케줄러 주기(ms)
const VOLUME = 0.16;        // BGM 전체 볼륨(작게, 효과음보다 낮게)

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
let master = null;
let playing = false;
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

export function startBgm() {
  if (playing || isBgmMuted()) return;
  const c = getCtx();
  if (!c) return;
  playing = true;
  step = 0;
  nextTime = c.currentTime + 0.1;
  master.gain.cancelScheduledValues(c.currentTime);
  master.gain.setValueAtTime(0.0001, c.currentTime);
  master.gain.exponentialRampToValueAtTime(VOLUME, c.currentTime + 1.2); // 부드럽게 페이드인
  timerId = setInterval(scheduler, TICK);
}

export function stopBgm() {
  if (!playing) return;
  playing = false;
  if (timerId) { clearInterval(timerId); timerId = null; }
  if (ctx && master) {
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), now);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.4); // 부드럽게 페이드아웃
  }
}

// 음소거 토글. 켜면 재생 시작, 끄면 정지 + 설정 저장. 반환값 = 음소거 여부.
export function toggleBgm() {
  const muted = !isBgmMuted();
  localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  if (muted) stopBgm();
  else startBgm();
  return muted;
}
