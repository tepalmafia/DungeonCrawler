// 자동 플레이 (?bot=1) — 장시간 검증·소크 테스트용.
// 사람처럼 잘 하는 게 목적이 아니라 "끝까지 굴러가는지" 확인하는 게 목적이다.

import * as THREE from 'three';
import { SKILLS, trySkill } from '../game/skills.js';
import { power } from '../game/items.js';

const V = new THREE.Vector3();

export class Bot {
  constructor(G) {
    this.G = G;
    this.think = 0;
    this.stuckT = 0;
    this.lastPos = new THREE.Vector3();
    this.wander = null;
  }

  update(dt) {
    const G = this.G, p = G.player;
    if (!p || p.dead || G.state !== 'play') return;

    this.think -= dt;

    // 물약
    if (p.hp / p.maxHp < 0.42 && p.potions.hp > 0 && p.potionCd.hp <= 0) {
      p.potions.hp--; p.potionCd.hp = 8;
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.42);
    }
    if (p.mp / p.maxMp < 0.2 && p.potions.mp > 0 && p.potionCd.mp <= 0) {
      p.potions.mp--; p.potionCd.mp = 8;
      p.mp = Math.min(p.maxMp, p.mp + p.maxMp * 0.5);
    }

    // 더 좋은 장비는 바로 낀다
    for (let i = p.bag.length - 1; i >= 0; i--) {
      const it = p.bag[i];
      if (power(it) > power(p.equipped[it.slot])) p.equip(it);
    }

    // 끼임 감지 — 오래 제자리면 다른 곳으로 크게 우회
    if (p.pos.distanceTo(this.lastPos) < 0.12) this.stuckT += dt;
    else { this.stuckT = 0; this.lastPos.copy(p.pos); }

    if (this.think > 0) return;
    this.think = 0.14;

    const alive = G.enemies.filter((e) => !e.dead);
    // 풀링 규칙에 맞춘 타겟팅:
    //  이미 나에게 붙은 적이 있으면 그놈부터 끝낸다(추가로 끌지 않는다).
    //  아무도 안 붙었을 때만 새로 한 마리를 고르되, 이웃이 가장 적은 놈을 고른다.
    const engaged = alive.filter((e) => e.aggro && e.state !== 'returning');
    let target;
    if (engaged.length) {
      target = this._nearest(engaged, p.pos);
    } else {
      const cands = alive.filter((e) => !e.isBoss);
      target = (cands.length ? cands : alive).reduce((best, e) => {
        const crowd = alive.filter((o) => o !== e && o.pos.distanceTo(e.pos) < 10).length;
        const score = p.pos.distanceTo(e.pos) + crowd * 9;   // 뭉쳐 있는 놈은 뒤로 미룬다
        return !best || score < best.score ? { e, score } : best;
      }, null)?.e || null;
    }
    const dist = target ? p.pos.distanceTo(target.pos) : Infinity;

    // 스킬 — 사거리와 마나가 되면 아낌없이
    if (target && dist < 8) {
      const aim = target.pos.clone();
      const engagedNear = alive.filter((e) => e.aggro && p.pos.distanceTo(e.pos) < 7).length;
      for (const s of SKILLS) {
        if ((G.cooldowns[s.key] || 0) > 0 || p.mp < s.cost) continue;
        // 광역기는 둘 이상 붙었을 때만 아낀다 — 한 마리에 운석을 쓰지 않는다
        if ((s.key === 'meteor' || s.key === 'nova') && engagedNear < 2 && !target.elite && !target.isBoss) continue;
        if (s.key === 'meteor' && dist > 9) continue;
        if (s.key === 'nova' && dist > 5.5) continue;
        if (s.key === 'cleave' && dist > 4) continue;
        if (s.key === 'dash') {
          // 돌진은 체력이 낮을 때 도망용으로만
          if (p.hp / p.maxHp > 0.35 || dist > 6) continue;
          aim.set(p.pos.x * 2 - target.pos.x, 0, p.pos.z * 2 - target.pos.z);
        }
        trySkill(G, s, aim);
        break;
      }
    }

    // 바닥 아이템이 가깝고 안전하면 먼저 줍는다
    const drop = this._nearest(G.drops, p.pos);
    if (drop && p.pos.distanceTo(drop.pos) < 9 && (!target || dist > 6)) {
      p.target = null;
      p.moveTo(G.dungeon, drop.pos.x, drop.pos.z);
      return;
    }

    if (target && dist < 18) {
      p.target = target;
      if (this.stuckT > 1.6) {
        this.stuckT = 0;
        this._wanderTo();
      }
      return;
    }

    // 적이 없으면 출구로
    if (G.level && G.level.exitOpen) {
      p.target = null;
      p.moveTo(G.dungeon, G.level.exitPos.x, G.level.exitPos.z);
      return;
    }

    // 아직 안 죽은 적을 찾아 이동
    if (alive.length) {
      p.target = null;
      const far = alive[0];
      p.moveTo(G.dungeon, far.pos.x, far.pos.z);
      return;
    }

    this._wanderTo();
  }

  _wanderTo() {
    const G = this.G, dg = G.dungeon;
    const room = dg.rooms[Math.floor(Math.random() * dg.rooms.length)];
    const [x, z] = [(room.cx - dg.w / 2 + 0.5) * 2, (room.cy - dg.h / 2 + 0.5) * 2];
    G.player.target = null;
    G.player.moveTo(dg, x, z);
  }

  _nearest(list, pos) {
    let best = null, bd = Infinity;
    for (const o of list) {
      if (o.dead) continue;
      const d = pos.distanceTo(o.pos);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }
}

/** 콘솔에서 상태 확인 */
export function botReport(G) {
  return JSON.stringify({
    floor: G.floorNo, tier: G.tier, level: G.player?.level,
    hp: Math.round(G.player?.hp), kills: G.stats.kills,
    items: G.stats.itemsFound, deaths: G.stats.deaths,
    bossKills: G.stats.bossKills, time: Math.round(G.time),
  });
}
