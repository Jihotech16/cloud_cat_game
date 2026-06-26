export function isMobileDevice() {
  const ua = navigator.userAgent;
  const mobileUa = /Android|iPhone|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const tabletAsMobile = /iPad|Android(?!.*Mobile)/i.test(ua) && navigator.maxTouchPoints > 0;
  const touchCoarse = window.matchMedia('(pointer: coarse)').matches;
  const narrowTouch = navigator.maxTouchPoints > 0 && window.innerWidth <= 820;

  return mobileUa || tabletAsMobile || (touchCoarse && narrowTouch);
}

export function isPortrait() {
  return window.innerHeight >= window.innerWidth;
}
