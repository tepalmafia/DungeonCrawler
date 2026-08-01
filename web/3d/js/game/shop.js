// 상점 — 「재의 행상」. 던전 안에, 문으로 봉한 방에 있다.
//
// 왜 안전지대가 아닌가 (docs/ITEM-ECONOMY.md §4-2):
// 상점이 공짜 편의 시설이 되면 「돈이 있으면 무조건 이득」이 된다.
// 스위치를 찾아 문을 열고, 함정을 밟아 가며 들어가야 하면
// **갈지 말지가 판단거리**가 된다. 랜턴 연료가 간당간당할 때 상점을 들를지 말지 —
// 그 갈등이 이 게임의 감정이다.
//
// 재고는 층에 들어올 때 한 번 굴린다. 떠나면 다시 안 산다.

import * as THREE from 'three';
import { rollItem, RARITIES, SLOTS, SLOT_NAME, priceOf } from './items.js';
import { makeLantern } from './lantern.js';
import { gridToWorld } from '../world/dungeon.js';

// 층별 주력 속성을 이기는 속성 (docs/ELEMENTS.md §4 의 FLOOR_MIX 를 뒤집은 것).
//   1층 혼 30% → 뇌가 혼을 이긴다
//   2층 빙 50% → 화가 빙을 이긴다
//   3층 뇌·혼  → 빙이 뇌를 이긴다
const COUNTER_BY_FLOOR = ['bolt', 'fire', 'ice'];

// 파는 값 대비 사는 값.
//
// 기획안(§4-2)은 3.5 를 적어 뒀지만, 실제로 굴려 보니 그 값에서는 장비 하나가
// 154 였고 층당 영혼 조각이 약 140 이었다 — **한 층이면 하나 산다.** 그러면
// 상점이 자판기가 되고 「모을 이유」가 사라진다. 목표는 3~4층치다.
//
// 이 숫자는 여전히 **출발점**이다. 층당 조각은 완전 소탕 기준 추정이고,
// 실제 플레이는 그보다 적게 잡을 수 있다. 벤치로 다시 잰다.
const BUY_MULT = 5.5;
export const SELL_MULT = 1;   // 되팔 때는 priceOf 그대로

/**
 * 재고 6칸 (§4-3)
 *   1칸 소모품 · 1칸 랜턴/연료 · 3칸 장비 · 1칸 「오늘의 물건」
 * 「오늘의 물건」이 있어야 **돈을 모을 이유**가 생긴다. 전부 싼 물건이면
 * 돈이 남아돌고 화폐가 의미를 잃는다.
 */
export function rollStock(rnd, floorNo, tier, player) {
  const stock = [];

  stock.push({ kind: 'potion', which: 'hp', name: '체력 물약 ×3', icon: '🧪', count: 3, price: 40 + floorNo * 12 });
  stock.push({ kind: 'lantern', item: makeLantern(floorNo >= 2 && rnd.chance(0.4) ? 1 : 0),
    name: '랜턴', icon: '🏮', price: 0 });

  const prefer = SLOTS.filter((s) => player?.equipped?.[s]);
  for (let i = 0; i < 3; i++) {
    const it = rollItem(rnd, floorNo, tier, { prefer, find: player?.find || 0 });
    stock.push({ kind: 'gear', item: it, name: it.name, icon: it.icon, price: 0 });
  }
  // 「오늘의 물건」은 **그 층의 주력 속성에 강한 속성**으로 고정한다 (§6-3).
  // 값이 비싼 이유가 「등급이 높아서」가 아니라 **「지금 필요한 것이라서」**가 된다.
  // 2층(빙 특화)에 화염 무기가 놓이는 것이 이 시스템의 교육 지점이다.
  const counter = COUNTER_BY_FLOOR[Math.min(2, floorNo - 1)];
  const today = rollItem(rnd, floorNo, tier, {
    minRarity: 2, prefer, find: player?.find || 0, slot: 'weapon', element: counter,
  });
  stock.push({ kind: 'today', item: today, name: today.name, icon: today.icon, price: 0 });

  // 가격은 마지막에 한 번에 매긴다 — 종류마다 따로 계산하면 어긋난다
  for (const s of stock) {
    if (s.kind === 'gear' || s.kind === 'today') s.price = Math.round(priceOf(s.item) * BUY_MULT);
    else if (s.kind === 'lantern') s.price = Math.round(60 + s.item.def.fuelMax * 0.35);
  }
  // 「오늘의 물건」은 등급이 높아 priceOf 가 이미 3배쯤 매긴다.
  // 거기에 조금만 더 얹는다 — 1.35 까지 올리면 한 판으로는 손도 못 댄다.
  stock[5].price = Math.round(stock[5].price * 1.15);
  return stock;
}

// ─────────────────────── 갬블 ───────────────────────
//
// 디아블로2 의 도박과 같은 구조다: **부위만 알고 등급은 모른 채** 산다.
//
// 왜 이게 재미있나 — 이 게임에는 이미 「빈손으로 나가는 판」이 설계돼 있다
// (드랍 9%). 그 판에서 남는 것이 영혼 조각이고, 조각은 상점에서 **정확히
// 원하는 것**을 살 때 쓴다. 갬블은 그 반대편이다: 싸게, 대신 운에 건다.
// 두 출구가 다 있어야 조각이 「모아 두면 뭐든 된다」가 된다.
//
// 등급 분포를 일반 드랍보다 위로 잡는다 (일반 55/30/12/3 → 18/54/24/4).
// 그래야 「사는 값이 아까운데도 누른다」가 성립한다. 다만 전설은 4% 로 둔다 —
// 여기서 전설이 잘 나오면 던전을 돌 이유가 없어진다.
const GAMBLE_W = [18, 54, 24, 4];
const GAMBLE_SLOTS = 3;

function gambleRarity(rnd, find = 0) {
  const w = GAMBLE_W.map((b, i) => b * Math.pow(1 + find / 140, i));
  const total = w.reduce((a, b) => a + b, 0);
  let u = rnd() * total;
  for (let i = 0; i < w.length; i++) { u -= w[i]; if (u <= 0) return i; }
  return 1;
}

/**
 * 갬블 한 칸. 부위와 값만 정하고 **물건은 살 때 굴린다** —
 * 미리 굴려 두면 「가게를 나갔다 들어와서 다시 본다」로 결과를 세탁할 수 있다.
 */
function rollGambleSlot(rnd, floorNo, tier) {
  const slot = rnd.pick(SLOTS);
  // 값은 결과와 무관하게 부위·층으로만 정한다. 그게 도박이다.
  const price = Math.round((78 + floorNo * 52 + tier * 44) * (slot === 'weapon' ? 1.25 : 1));
  return { slot, price, name: `미확인 ${SLOT_NAME[slot]}`, icon: '❔' };
}

export class Shop {
  constructor(scene, dg, rnd, player, floorNo, tier) {
    this.dg = dg;
    this.scene = scene;
    this.stock = [];
    this.open = false;
    this.merchant = null;

    const room = dg.vaultRoom;
    if (!room) return;

    this.rnd = rnd;
    this.floorNo = floorNo;
    this.tier = tier;
    this.stock = rollStock(rnd, floorNo, tier, player);
    // 갬블 칸은 재고와 따로 관리한다 — 사면 그 자리에서 다시 채워지므로
    // 「팔림」으로 남는 재고와 수명이 다르다.
    this.gamble = [];
    for (let i = 0; i < GAMBLE_SLOTS; i++) this.gamble.push(rollGambleSlot(rnd, floorNo, tier));
    const [x, z] = gridToWorld(room.cx, room.cy, dg.w, dg.h);
    this.pos = new THREE.Vector3(x, 0, z);

    // 행상 — 후드를 쓴 형체. 얼굴을 만들지 않는다:
    // 「이 아래에서 장사를 하는 자」는 정체를 안 밝히는 편이 낫다.
    const g = new THREE.Group();
    const cloak = new THREE.Mesh(
      new THREE.ConeGeometry(0.52, 1.7, 8),
      new THREE.MeshStandardMaterial({ color: 0x3a3040, roughness: 0.95 }));
    cloak.position.y = 0.85;
    const hood = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x2c2434, roughness: 0.95 }));
    hood.position.y = 1.62;
    // 눈 대신 등불 하나 — 살아 있는지 아닌지 알 수 없게
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffc46a }));
    lamp.position.set(0.34, 1.2, 0.2);
    const light = new THREE.PointLight(0xffc46a, 16, 7, 2);
    light.position.copy(lamp.position);
    g.add(cloak, hood, lamp, light);
    g.position.copy(this.pos);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(g);
    this.merchant = g;
    this.lamp = lamp;

    // 상자 — 행상 옆이 아니라 방 반대편에 둔다. 둘이 붙어 있으면
    // 「상점에 딸린 물건」으로 읽히고, 문을 연 보상이라는 느낌이 안 산다.
    const cx = x + (room.w > 6 ? 3.6 : 2.4), cz = z - 2.2;
    const cg = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a4326, roughness: 0.8, metalness: 0.2 });
    const iron = new THREE.MeshStandardMaterial({
      color: 0xc8a24a, roughness: 0.35, metalness: 0.9,
      emissive: 0xc8a24a, emissiveIntensity: 0.35,
    });
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.62, 0.7), wood);
    box.position.y = 0.31;
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.22, 0.76), wood);
    lid.position.y = 0.72;
    for (const bx of [-0.32, 0.32]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.72, 0.78), iron);
      band.position.set(bx, 0.4, 0);
      cg.add(band);
    }
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.12), iron);
    lock.position.set(0, 0.6, 0.38);
    cg.add(box, lid, lock);
    cg.position.set(cx, 0, cz);
    cg.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(cg);
    this.chest = { group: cg, lid, x: cx, z: cz, opened: false, iron };
  }

  /**
   * 금고 상자 — **문을 연 대가.**
   *
   * 스위치를 찾아 층을 가로지르고, 함정을 뚫고 들어왔는데 안에 상점만 있으면
   * 「돈을 내야 뭘 준다」라서 보상이 아니다. 수고에는 값을 치러야 한다.
   * 희귀 이상 2개 + 조각. 한 번만 열린다.
   */
  openChest(G) {
    if (!this.chest || this.chest.opened) return null;
    this.chest.opened = true;
    const out = [];
    for (let i = 0; i < 2; i++) {
      out.push(rollItem(this.rnd, this.floorNo, this.tier, {
        minRarity: 2, find: G.player.find || 0,
      }));
    }
    const coin = Math.round((60 + this.floorNo * 40 + this.tier * 30) * this.rnd.range(0.85, 1.2));
    return { items: out, coin };
  }

  chestInRange(px, pz, r = 2.2) {
    const c = this.chest;
    return !!c && !c.opened && Math.hypot(c.x - px, c.z - pz) < r;
  }

  inRange(px, pz, r = 2.6) {
    return !!this.merchant && Math.hypot(this.pos.x - px, this.pos.z - pz) < r;
  }

  /** @returns {{ok:boolean, why?:string, item?:object}} */
  buy(G, i) {
    const s = this.stock[i];
    const p = G.player;
    if (!s || s.sold) return { ok: false, why: '이미 팔렸다' };
    if (p.coin < s.price) return { ok: false, why: '영혼 조각이 모자란다' };

    if (s.kind === 'potion') {
      p.potions[s.which] += s.count;
    } else if (s.kind === 'lantern') {
      // 랜턴은 가방을 안 쓴다 — 더 좋으면 바꿔 들고 아니면 기름이 된다
      G.acquireLantern(s.item);
    } else {
      if (p.bag.length >= p.bagMax) return { ok: false, why: '가방이 가득 찼다' };
      p.bag.push(s.item);
    }
    p.coin -= s.price;
    s.sold = true;
    G.metrics?.spend(s.price);
    return { ok: true, item: s };
  }

  /**
   * 갬블 한 칸을 산다. 결과는 **여기서** 굴린다.
   * @returns {{ok:boolean, why?:string, item?:object, rarity?:number}}
   */
  gambleBuy(G, i) {
    const g = this.gamble[i];
    const p = G.player;
    if (!g) return { ok: false, why: '없는 칸' };
    if (p.coin < g.price) return { ok: false, why: '영혼 조각이 모자란다' };
    if (p.bag.length >= p.bagMax) return { ok: false, why: '가방이 가득 찼다' };

    const ri = gambleRarity(this.rnd, p.find || 0);
    // minRarity 가 아니라 rarity 다 — 하한으로 주면 자체 롤과 최댓값을 취해
    // 전설이 설계값보다 3배 나온다 (실측으로 잡았다).
    const item = rollItem(this.rnd, this.floorNo, this.tier, { slot: g.slot, rarity: ri });
    p.coin -= g.price;
    p.bag.push(item);
    G.metrics?.spend(g.price);
    // 산 자리는 곧바로 새 부위로 채운다 — 계속 걸 수 있어야 도박이다
    this.gamble[i] = rollGambleSlot(this.rnd, this.floorNo, this.tier);
    return { ok: true, item, rarity: item.rarity };
  }

  /** 가방의 물건을 판다 */
  sell(G, item) {
    const p = G.player;
    const i = p.bag.indexOf(item);
    if (i < 0) return { ok: false };
    p.bag.splice(i, 1);
    const got = Math.max(1, Math.round(priceOf(item) * SELL_MULT));
    p.coin += got;
    return { ok: true, got };
  }

  update(dt, t) {
    if (!this.merchant) return;
    // 아주 느리게 흔들린다 — 완전히 멈춰 있으면 소품으로 보인다
    this.merchant.rotation.y = Math.sin(t * 0.4) * 0.22;
    if (this.lamp) this.lamp.position.y = 1.2 + Math.sin(t * 1.7) * 0.05;
    if (this.chest) {
      // 안 연 동안만 쇠띠가 맥동한다 — 열고 나서도 반짝이면 시선만 끈다
      this.chest.iron.emissiveIntensity = this.chest.opened ? 0.05 : 0.25 + Math.sin(t * 2.4) * 0.2;
      if (this.chest.opened && this.chest.lid.rotation.x > -1.1) {
        this.chest.lid.rotation.x -= dt * 2.4;
        this.chest.lid.position.z = -0.3 * Math.sin(this.chest.lid.rotation.x);
      }
    }
  }

  dispose() {
    if (!this.merchant) return;
    this.scene.remove(this.merchant);
    this.merchant.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    this.merchant = null;
    if (this.chest) {
      this.scene.remove(this.chest.group);
      this.chest.group.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
      this.chest = null;
    }
  }
}

export { BUY_MULT, RARITIES };
