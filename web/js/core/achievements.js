// 도전과제 (스팀 스프린트 1차) — 웹에선 기록+배너, 데스크톱에선 스팀워크스로 전달
// id는 스팀 파트너 사이트의 API Name과 일치시킨다
const ACHIEVEMENTS = [
  { id: 'FIRST_VENGEANCE', name: '첫 복수', desc: '1막을 정복한다', test: (g, v) => v },
  { id: 'GATE_BREAKER', name: '관문 파쇄', desc: '2막을 정복한다', test: (g, v) => v && g.act >= 2 },
  { id: 'VERDICT_OVERTURNED', name: '판결 파기', desc: '3막을 정복한다', test: (g, v) => v && g.act >= 3 },
  { id: 'FAITH_ASHES', name: '재가 된 신앙', desc: '4막을 정복한다', test: (g, v) => v && g.act >= 4 },
  { id: 'THRONE_FALLS', name: '왕좌는 비었다', desc: '왕좌를 정복한다', test: (g, v) => v && g.act >= 5 && Dungeon.floor >= 50 },
  { id: 'KINGS_WRATH', name: '진노를 꺾다', desc: '왕의 진노(현상금 8)로 승리한다', test: (g, v) => v && g.heat >= 8 },
  { id: 'WHOLE_TRUTH', name: '온전한 진실', desc: '단서 21개를 전부 모은다', test: () => typeof CLUES !== 'undefined' && Meta.clueCount && Meta.clueCount() >= CLUES.length },
  { id: 'FIFTH_HAND', name: '다섯 번째 손', desc: '진실의 끝을 본다', test: () => Meta.data.fifthHand && Meta.data.fifthHand.stage >= 3 },
];

const Achieve = {
  // 런 정산·주요 순간에 호출 — 조건 충족분을 일괄 지급 (중복 지급 없음)
  evaluate(game, victory) {
    if (!Meta.data.achv) Meta.data.achv = {};
    for (const a of ACHIEVEMENTS) {
      if (Meta.data.achv[a.id]) continue;
      let ok = false;
      try { ok = a.test(game, victory); } catch (e) { ok = false; }
      if (!ok) continue;
      Meta.data.achv[a.id] = true;
      Meta.save();
      game.banner = { text: `🏆 도전과제 — ${a.name}`, life: 2.6, maxLife: 2.6, color: '#f7b32b' };
      if (window.desktop && window.desktop.unlockAchievement) window.desktop.unlockAchievement(a.id);
    }
  },
};
