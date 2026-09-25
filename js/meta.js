// 코인 & 영구 업그레이드(메타 성장) — localStorage에 저장.
const COINS_KEY = 'cloudCat_coins';
const UPG_KEY = 'cloudCat_upgrades';

// 상점 업그레이드 정의. cost(level)=현재 레벨에서 다음 레벨 구매 비용.
// 능력치는 레벨 10까지, 비용은 레벨이 오를수록 제곱으로 크게 증가한다.
// modes: 이 강화가 효과 있는 모드. 시작 게이지는 오브로 차는 게이지·보상 카드가 있는
// 어드벤처에서만 의미가 있어 일반 모드 상점에는 내보내지 않는다.
// perCat: 고양이마다 따로 올리는 강화(고양이 메뉴에서 산다). 레벨은 '<id>@<고양이 id>' 로 저장한다.
// perCat 이 없는 강화는 모든 고양이 공통이고 상점에서 산다.
export const UPGRADES = [
  { id: 'startJump', icon: 'assets/rocket.png', label: '시작 점프 레벨', desc: '매 판 점프력 보너스를 갖고 시작', max: 10, cost: (l) => 100 * (l + 1) ** 2, modes: ['classic', 'adventure'], perCat: true },
  { id: 'startScore', icon: '📈', label: '시작 점수 배율', desc: '매 판 점수 배율을 갖고 시작', max: 10, cost: (l) => 120 * (l + 1) ** 2, modes: ['classic', 'adventure'], perCat: true },
  { id: 'coinBonus', icon: 'assets/coin-paw.png', max: 5, cost: (l) => 150 * (l + 1) ** 2, modes: ['classic', 'adventure'], perCat: true },
  { id: 'perfectZone', icon: 'assets/star.png', max: 5, cost: (l) => 150 * (l + 1) ** 2, modes: ['classic', 'adventure'], perCat: true },
  { id: 'startGauge', icon: 'assets/star.png', label: '시작 게이지', desc: '매 판 게이지를 일부 채우고 시작', max: 10, cost: (l) => 80 * (l + 1) ** 2, modes: ['adventure'] },
];

// 소모품(판당 1회용). 상점에서 사서 시작 화면에서 켜고 시작하면 한 개 소모된다.
export const CONSUMABLES = [
  { id: 'booster', icon: 'assets/rocket.png', price: 120 },
  { id: 'shieldItem', icon: '🛡️', price: 200 },
];

const CONSUM_KEY = 'cloudCat_consumables';

function readConsumables() {
  try {
    const obj = JSON.parse(localStorage.getItem(CONSUM_KEY) ?? '{}');
    return obj && typeof obj === 'object' ? obj : {};
  } catch {
    return {};
  }
}

function writeConsumables(obj) {
  try {
    localStorage.setItem(CONSUM_KEY, JSON.stringify(obj));
  } catch {
    // 저장이 막혀 있으면 이번 실행 동안만 유지된다.
  }
}

export function getConsumableCount(id) {
  const n = readConsumables()[id];
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function buyConsumable(id) {
  const item = CONSUMABLES.find((c) => c.id === id);
  if (!item) return { ok: false, reason: 'unknown' };
  if (getCoins() < item.price) return { ok: false, reason: 'notEnoughCoins' };
  addCoins(-item.price);
  const owned = readConsumables();
  owned[id] = getConsumableCount(id) + 1;
  writeConsumables(owned);
  return { ok: true, count: owned[id] };
}

// 한 개 쓴다. 갖고 있지 않으면 false.
export function useConsumable(id) {
  const count = getConsumableCount(id);
  if (count <= 0) return false;
  const owned = readConsumables();
  owned[id] = count - 1;
  writeConsumables(owned);
  return true;
}

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

// perCat 강화는 고양이별 키, 공통 강화는 id 그대로.
function levelKey(def, cat) {
  return def.perCat ? `${def.id}@${cat}` : def.id;
}

export function getUpgradeLevel(id, cat) {
  const def = UPGRADES.find((u) => u.id === id);
  if (!def) return 0;
  return readUpgrades()[levelKey(def, cat)] ?? 0;
}

// 구매 시도. 성공하면 코인 차감 후 { ok:true, coins, level } 반환. perCat 강화는 cat 필수.
export function buyUpgrade(id, cat) {
  const def = UPGRADES.find((u) => u.id === id);
  if (!def) return { ok: false };
  const level = getUpgradeLevel(id, cat);
  if (level >= def.max) return { ok: false, reason: 'max', coins: getCoins(), level };
  const price = def.cost(level);
  const coins = getCoins();
  if (coins < price) return { ok: false, reason: 'coins', coins, level };

  addCoins(-price);
  const ups = readUpgrades();
  ups[levelKey(def, cat)] = level + 1;
  writeUpgrades(ups);
  return { ok: true, coins: getCoins(), level: level + 1 };
}

export function nextCost(id, cat) {
  const def = UPGRADES.find((u) => u.id === id);
  const level = getUpgradeLevel(id, cat);
  if (!def || level >= def.max) return null;
  return def.cost(level);
}

// 1.7 까지는 점프·점수 강화가 공통이었다. 한 번만, 그 레벨을 기본 고양이에게 옮긴다.
// 다른 고양이는 각자 0 부터 따로 올린다.
const PER_CAT_MIGRATED_KEY = 'cloudCat_upgradesPerCatV1';
export function migratePerCatUpgrades() {
  try {
    if (localStorage.getItem(PER_CAT_MIGRATED_KEY)) return;
    const ups = readUpgrades();
    for (const def of UPGRADES.filter((u) => u.perCat)) {
      const legacy = ups[def.id] ?? 0;
      if (legacy > 0) {
        const key = levelKey(def, 'default');
        ups[key] = Math.max(ups[key] ?? 0, legacy);
      }
      delete ups[def.id];
    }
    writeUpgrades(ups);
    localStorage.setItem(PER_CAT_MIGRATED_KEY, '1');
  } catch {
    // 저장이 막혀 있으면 다음 실행 때 다시 시도한다.
  }
}

// 게임 시작 시 적용할 메타 보너스.
// cat: 이번 판에 입은 고양이(점프·점수 강화는 고양이별).
export function getStartBonuses(cat) {
  return {
    jumpLevel: getUpgradeLevel('startJump', cat),
    scoreLevel: getUpgradeLevel('startScore', cat),
    coinLevel: getUpgradeLevel('coinBonus', cat),
    perfectLevel: getUpgradeLevel('perfectZone', cat),
    gaugeFill: getUpgradeLevel('startGauge') * 9, // 레벨당 게이지 9% (최대 10레벨 = 90%)
  };
}
