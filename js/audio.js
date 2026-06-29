// 효과음 — 외부 오디오 파일 없이 WebAudio 로 합성한다.
// (이전엔 점프만 assets/Jump.wav 였으나, 합성음으로 교체)

let audioCtx = null;
let master = null;

function getCtx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
    master = audioCtx.createGain();
    master.gain.value = 0.9;
    master.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  return audioCtx;
}

// 단일 보이스: 주파수 글라이드 + 부드러운 엔벨로프 + (선택)로우패스.
function voice({
  freq,
  glideTo = null,
  type = 'sine',
  t0 = 0,
  dur = 0.15,
  gain = 0.15,
  attack = 0.008,
  filterHz = null,
  detune = 0,
}) {
  const ctx = getCtx();
  if (!ctx) return;
  const start = ctx.currentTime + t0;
  const osc = ctx.createOscillator();
  osc.type = type;
  if (detune) osc.detune.setValueAtTime(detune, start);
  osc.frequency.setValueAtTime(freq, start);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, start + dur * 0.9);

  let node = osc;
  if (filterHz) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(filterHz, start);
    osc.connect(f);
    node = f;
  }

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  node.connect(g);
  g.connect(master);

  osc.start(start);
  osc.stop(start + dur + 0.04);
}

// 모바일 자동재생 정책: 첫 입력에서 컨텍스트를 깨운다.
function unlock() {
  getCtx();
  window.removeEventListener('touchstart', unlock);
  window.removeEventListener('pointerdown', unlock);
}
if (typeof window !== 'undefined') {
  window.addEventListener('touchstart', unlock, { passive: true });
  window.addEventListener('pointerdown', unlock, { passive: true });
}

export function preloadSounds() {
  // 컨텍스트만 미리 준비(사운드 파일 없음).
  getCtx();
}

// 점프: 살짝 통통 튀는 느낌의 상승 "보잉".
// power(0~1): 점프 파워가 클수록 음이 조금 높아진다.
export function playJumpSound(power = 0.5) {
  const p = Math.max(0, Math.min(1, power));
  const base = 300 + p * 170; // 300~470
  voice({
    freq: base,
    glideTo: base * 1.9,
    type: 'triangle',
    dur: 0.14,
    gain: 0.16,
    attack: 0.005,
    filterHz: 2600,
  });
  // 살짝의 두께감(옥타브 아래, 짧게)
  voice({ freq: base * 0.5, glideTo: base * 0.95, type: 'sine', dur: 0.1, gain: 0.06 });
}

// 오브 수집: 맑은 종소리 "팅".
export function playCollectSound() {
  voice({ freq: 1318, type: 'sine', dur: 0.13, gain: 0.13, attack: 0.004, filterHz: 4000 });
  voice({ freq: 2637, type: 'sine', dur: 0.1, gain: 0.05, attack: 0.004 }); // 옥타브 반짝
}

// 레인보우 오브: 위로 올라가는 반짝 아르페지오.
export function playRainbowSound() {
  const notes = [784, 988, 1319, 1568, 2093]; // G5 B5 E6 G6 C7
  notes.forEach((f, i) => {
    voice({ freq: f, type: 'triangle', t0: i * 0.045, dur: 0.16, gain: 0.12, attack: 0.004, filterHz: 5000 });
  });
}

// 보상 획득: 짧은 아르페지오 + 따뜻한 메이저 화음.
export function playRewardSound() {
  const lead = [523, 659, 784]; // C5 E5 G5
  lead.forEach((f, i) => {
    voice({ freq: f, type: 'triangle', t0: i * 0.06, dur: 0.18, gain: 0.12, attack: 0.005, filterHz: 4000 });
  });
  // 지속되는 화음(살짝 디튠으로 풍성하게)
  const chord = [523, 659, 784, 1046];
  chord.forEach((f) => {
    voice({ freq: f, type: 'sine', t0: 0.18, dur: 0.5, gain: 0.07, attack: 0.02, filterHz: 3000, detune: 4 });
  });
}

preloadSounds();
