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

preloadSounds();
