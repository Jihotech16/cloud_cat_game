const JUMP_SRC = 'assets/Jump.wav';

let jumpTemplate = null;

function getJumpTemplate() {
  if (!jumpTemplate) {
    jumpTemplate = new Audio(JUMP_SRC);
    jumpTemplate.preload = 'auto';
  }
  return jumpTemplate;
}

export function preloadSounds() {
  getJumpTemplate().load();
}

export function playJumpSound() {
  const sound = getJumpTemplate().cloneNode();
  sound.volume = 0.55;
  sound.play().catch(() => {});
}

// 간단한 합성음(오브 수집 등) — 별도 에셋 없이 WebAudio로 생성.
let audioCtx = null;
function getCtx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  return audioCtx;
}

function blip(freqs, { duration = 0.12, type = 'sine', gain = 0.18 } = {}) {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  const now = ctx.currentTime;
  freqs.forEach((f, i) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const t = now + i * 0.05;
    osc.type = type;
    osc.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  });
}

// 오브 수집: 짧고 밝은 "팅"
export function playCollectSound() {
  blip([880], { duration: 0.1, type: 'triangle', gain: 0.14 });
}

// 레인보우 오브: 위로 올라가는 아르페지오
export function playRainbowSound() {
  blip([660, 880, 1175, 1568], { duration: 0.16, type: 'triangle', gain: 0.16 });
}

// 보상 획득: 살짝 화려한 화음
export function playRewardSound() {
  blip([523, 659, 784], { duration: 0.22, type: 'sine', gain: 0.16 });
}

preloadSounds();
