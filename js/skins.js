// 캐릭터 복장(스킨) — 보유·착용 상태는 localStorage 에 저장한다(코인·업그레이드와 같은 방식).
//
// 얻는 방법은 두 가지다.
// - season: 기간 한정 무료 지급(grantSeasonalSkins)
// - price: 상점에서 코인으로 구매(buySkin)
//
// 마녀 고양이는 할로윈 한정: 10월(기기 현지 날짜)에 앱을 켜면 무료로 받고,
// 한 번 받으면 기간이 지나도 계속 쓸 수 있다. 10월이 아닐 때 아직 못 받은 사람은 잠겨 있다.
// 매년 10월마다 다시 받을 수 있는 기간이 열린다.

import { getCoins, addCoins } from './meta.js';

const OWNED_KEY = 'cloudCat_skinsOwned';
const EQUIP_KEY = 'cloudCat_skinEquipped';

export const SKINS = [
  { id: 'default' },
  // 코인은 어드벤처 모드에서 한 판에 대략 25~40개 모인다 → 500코인이면 15판 안팎.
  { id: 'pajamas', price: 500 },
  { id: 'witch', season: 'halloween' },
  // 비눗방울 고양이: 비눗방울물을 모아 큰 비눗방울을 타고 떠오르는 전용 특성(game.js).
  { id: 'bubble', price: 1000 },
];

export function isHalloweenSeason(date = new Date()) {
  return date.getMonth() === 9; // 0 부터 세므로 9 = 10월
}

function readOwned() {
  try {
    const list = JSON.parse(localStorage.getItem(OWNED_KEY) ?? '[]');
    return new Set(Array.isArray(list) ? list : []);
  } catch {
    return new Set();
  }
}

function writeOwned(owned) {
  try {
    localStorage.setItem(OWNED_KEY, JSON.stringify([...owned]));
  } catch {
    // 저장이 막혀 있으면 이번 실행 동안만 적용된다.
  }
}

export function ownsSkin(id) {
  return id === 'default' || readOwned().has(id);
}

// 기간 한정 복장을 지급한다. 이번에 새로 받은 복장 id 목록을 돌려준다(선물 창 표시용).
export function grantSeasonalSkins(date = new Date()) {
  const owned = readOwned();
  const granted = [];
  if (isHalloweenSeason(date) && !owned.has('witch')) {
    owned.add('witch');
    granted.push('witch');
  }
  if (granted.length) writeOwned(owned);
  return granted;
}

// 코인으로 복장을 산다. 산 뒤 착용까지는 호출하는 쪽에서 정한다.
export function buySkin(id) {
  const skin = SKINS.find((sk) => sk.id === id);
  if (!skin || skin.price == null) return { ok: false, reason: 'notForSale' };
  if (ownsSkin(id)) return { ok: true };
  if (getCoins() < skin.price) return { ok: false, reason: 'notEnoughCoins' };
  addCoins(-skin.price);
  const owned = readOwned();
  owned.add(id);
  writeOwned(owned);
  return { ok: true };
}

export function getEquippedSkin() {
  try {
    const id = localStorage.getItem(EQUIP_KEY);
    return id && ownsSkin(id) ? id : 'default';
  } catch {
    return 'default';
  }
}

export function equipSkin(id) {
  if (!ownsSkin(id)) return false;
  try {
    localStorage.setItem(EQUIP_KEY, id);
  } catch {
    // 저장 실패 시에도 이번 실행에서는 입힌다.
  }
  return true;
}
