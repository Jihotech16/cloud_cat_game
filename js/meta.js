// 코인 & 영구 업그레이드(메타 성장) — localStorage에 저장.
const COINS_KEY = 'cloudCat_coins';
const UPG_KEY = 'cloudCat_upgrades';

// 상점 업그레이드 정의. cost(level)=현재 레벨에서 다음 레벨 구매 비용.
export const UPGRADES = [
  { id: 'startJump', icon: '🚀', label: '시작 점프 레벨', desc: '매 판 점프력 보너스를 갖고 시작', max: 5, cost: (l) => 40 * (l + 1) },
  { id: 'startScore', icon: '📈', label: '시작 점수 배율', desc: '매 판 점수 배율을 갖고 시작', max: 5, cost: (l) => 50 * (l + 1) },
  { id: 'startGauge', icon: '⭐', label: '시작 게이지', desc: '매 판 게이지를 일부 채우고 시작', max: 4, cost: (l) => 35 * (l + 1) },
  { id: 'startShield', icon: '🛡️', label: '시작 보호막', desc: '매 판 보호막을 갖고 시작', max: 1, cost: () => 200 },
];

function readInt(key) {
  const n = parseInt(localStorage.getItem(key) ?? '0', 10);
  return Number.isFinite(n) ? n : 0;
}

export function getCoins() {
  return readInt(COINS_KEY);
}

export function addCoins(n) {
  const total = Math.max(0, getCoins() + Math.floor(n));
  localStorage.setItem(COINS_KEY, String(total));
  return total;
}

function readUpgrades() {
  try {
    return JSON.parse(localStorage.getItem(UPG_KEY) ?? '{}') || {};
  } catch {
    return {};
  }
}

function writeUpgrades(obj) {
  localStorage.setItem(UPG_KEY, JSON.stringify(obj));
}

export function getUpgradeLevel(id) {
  return readUpgrades()[id] ?? 0;
}

// 구매 시도. 성공하면 코인 차감 후 { ok:true, coins, level } 반환.
export function buyUpgrade(id) {
  const def = UPGRADES.find((u) => u.id === id);
  if (!def) return { ok: false };
  const level = getUpgradeLevel(id);
  if (level >= def.max) return { ok: false, reason: 'max', coins: getCoins(), level };
  const price = def.cost(level);
  const coins = getCoins();
  if (coins < price) return { ok: false, reason: 'coins', coins, level };

  addCoins(-price);
  const ups = readUpgrades();
  ups[id] = level + 1;
  writeUpgrades(ups);
  return { ok: true, coins: getCoins(), level: level + 1 };
}

export function nextCost(id) {
  const def = UPGRADES.find((u) => u.id === id);
  const level = getUpgradeLevel(id);
  if (!def || level >= def.max) return null;
  return def.cost(level);
}

// 게임 시작 시 적용할 메타 보너스.
export function getStartBonuses() {
  return {
    jumpLevel: getUpgradeLevel('startJump'),
    scoreLevel: getUpgradeLevel('startScore'),
    gaugeFill: getUpgradeLevel('startGauge') * 15, // 레벨당 게이지 15%
    shield: getUpgradeLevel('startShield') > 0,
  };
}
