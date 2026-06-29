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

// 트램펄린: 크고 탄력 있는 "스프로잉"(올라갔다 살짝 출렁).
export function playBounceSound() {
  voice({ freq: 200, glideTo: 560, type: 'triangle', dur: 0.12, gain: 0.18, attack: 0.004, filterHz: 2400 });
  voice({ freq: 560, glideTo: 340, type: 'triangle', t0: 0.1, dur: 0.12, gain: 0.12, filterHz: 2200 });
}

// 부스트 구름: 위로 솟는 "휘익" 휘파람.
export function playBoostSound() {
  voice({ freq: 320, glideTo: 1300, type: 'sawtooth', dur: 0.26, gain: 0.1, attack: 0.01, filterHz: 2600 });
  voice({ freq: 640, glideTo: 2200, type: 'sine', t0: 0.02, dur: 0.22, gain: 0.06 });
}

// 부서지는 구름: 짧고 둔탁한 "퍽".
export function playBreakSound() {
  voice({ freq: 220, glideTo: 110, type: 'triangle', dur: 0.12, gain: 0.13, attack: 0.003, filterHz: 1400 });
  voice({ freq: 160, glideTo: 90, type: 'square', dur: 0.09, gain: 0.05 });
}

// 게임오버: 풀 죽은 하강 음.
export function playGameOverSound() {
  const notes = [523, 440, 349, 262]; // C5 A4 F4 C4
  notes.forEach((f, i) => {
    voice({ freq: f, type: 'triangle', t0: i * 0.13, dur: 0.34, gain: 0.13, attack: 0.01, filterHz: 2600 });
  });
}

// 보호막 발동(부활/방어): 안심되는 상승 "팅".
export function playShieldSound() {
  voice({ freq: 660, glideTo: 990, type: 'sine', dur: 0.2, gain: 0.13, attack: 0.006, filterHz: 4000 });
  voice({ freq: 1320, type: 'sine', t0: 0.06, dur: 0.18, gain: 0.07 });
}

// 로켓 부스트: 길게 솟구치는 "슈우욱".
export function playRocketSound() {
  voice({ freq: 240, glideTo: 1700, type: 'sawtooth', dur: 0.45, gain: 0.11, attack: 0.02, filterHz: 2800 });
  voice({ freq: 480, glideTo: 2600, type: 'triangle', t0: 0.03, dur: 0.4, gain: 0.06 });
}

// 장애물 충돌: 거친 "지직" 충격.
export function playHazardSound() {
  voice({ freq: 240, glideTo: 80, type: 'sawtooth', dur: 0.16, gain: 0.15, attack: 0.002, filterHz: 1600 });
  voice({ freq: 180, glideTo: 70, type: 'square', dur: 0.12, gain: 0.07 });
}

// UI 버튼: 아주 짧고 부드러운 "톡".
export function playClickSound() {
  voice({ freq: 520, glideTo: 660, type: 'sine', dur: 0.06, gain: 0.07, attack: 0.002, filterHz: 3500 });
}

preloadSounds();
