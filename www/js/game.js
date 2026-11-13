// 게임 요소 — 경험치·레벨·연속기록·오늘의 퀘스트. 순수 계산 부분은 화면과 분리.
import { today, addDays } from "./data.js";

export const TITLES = [
  [1, "견습 장부꾼"], [3, "알뜰 사장"], [5, "장부 장인"], [8, "세무 고수"], [12, "대전 거상"], [16, "렌탈 제왕"], [20, "전설의 사장님"],
];
export function levelXp(L) { return 50 * (L - 1) * L; }            // 레벨 L 되는 데 필요한 누적 경험치 (1→0, 2→100, 3→300, 4→600 …)
export function levelFor(xp) { let L = 1; while (levelXp(L + 1) <= xp && L < 99) L++; return L; }
export function titleFor(L) { let t = TITLES[0][1]; TITLES.forEach(x => { if (L >= x[0]) t = x[1]; }); return t; }
export function progress(xp) {
  const L = levelFor(xp), cur = levelXp(L), next = levelXp(L + 1);
  return { level: L, cur, next, have: xp - cur, need: next - cur, pct: Math.min(1, (xp - cur) / (next - cur)) };
}

export const XP = {
  entry: 10, memo: 2, proof: 5, onTime: 5, catchUp: 3, pay: 15, settings: 20, settingsAgain: 5,
  quest1: 20, quest3: 30, backup: 10, exportx: 10, streakPerDay: 5, streakMax: 7,
};
export const QUESTS = [
  { id: "q1", label: "오늘 기록 1건", need: 1, xp: XP.quest1 },
  { id: "q3", label: "오늘 기록 3건", need: 3, xp: XP.quest3 },
];

export function blankGame() {
  return { xp: 0, days: {}, best: 0, log: [], flags: {}, name: "석재", lastBackup: "", lastExport: "", levelSeen: 0 };
}
export function normGame(g) {
  g = g && typeof g === "object" ? g : blankGame();
  const b = blankGame();
  Object.keys(b).forEach(k => { if (g[k] == null) g[k] = b[k]; });
  return g;
}

// 오늘 기준 연속 기록일 (오늘 아직 안 했으면 어제까지 이어진 것으로 봄)
export function streakOf(days, td) {
  td = td || today();
  let d = days[td] ? td : addDays(td, -1);
  let n = 0, guard = 0;
  while (days[d] && guard++ < 3650) { n++; d = addDays(d, -1); }
  return n;
}
export function todayCount(g, td) { return (g.days[td || today()] || 0); }

// 행동 하나 → 경험치 지급. 결과로 {gained, lines, levelUp, g} 돌려줌 (g는 갱신된 상태)
export function award(g, action, ctx) {
  g = normGame(g); ctx = ctx || {};
  const td = ctx.today || today();
  const before = levelFor(g.xp);
  const lines = [];
  let gained = 0;
  function add(n, why) { if (!n) return; gained += n; lines.push({ xp: n, why }); }

  if (action === "entry") {
    add(XP.entry, ctx.edit ? "기록 수정" : "기록");
    if (!ctx.edit) {
      if (ctx.memo) add(XP.memo, "메모까지 꼼꼼히");
      if (ctx.proof) add(XP.proof, "증빙 챙김");
      if (ctx.date === td) add(XP.onTime, "오늘 바로 기록");
      else if (ctx.date && ctx.date < addDays(td, -3)) add(XP.catchUp, "밀린 기록 정리");
    }
  } else if (action === "pay") add(ctx.edit ? XP.entry : XP.pay, ctx.edit ? "지급 기록 수정" : "원천징수 지급 기록");
  else if (action === "settings") { if (!g.flags.settingsOnce) { add(XP.settings, "세무 설정 완료"); g.flags.settingsOnce = true; } else add(XP.settingsAgain, "세무 설정 갱신"); }
  else if (action === "backup") { if (g.lastBackup !== td) { add(XP.backup, "백업"); g.lastBackup = td; } }
  else if (action === "export") { if (g.lastExport !== td) { add(XP.exportx, "엑셀 내보내기"); g.lastExport = td; } }

  // 기록 계열 행동은 '오늘 한 일'로 집계 → 퀘스트·연속기록
  if ((action === "entry" || action === "pay") && !ctx.edit) {
    const prevCount = g.days[td] || 0;
    const prevStreak = streakOf(g.days, td);
    g.days[td] = prevCount + 1;
    const nowCount = g.days[td];
    QUESTS.forEach(q => { if (prevCount < q.need && nowCount >= q.need) add(q.xp, "퀘스트 달성: " + q.label); });
    if (prevCount === 0) {
      const streak = streakOf(g.days, td);
      if (streak >= 2) add(Math.min(streak, XP.streakMax) * XP.streakPerDay, streak + "일 연속 기록");
      if (streak > g.best) g.best = streak;
      void prevStreak;
    }
  }
  g.xp += gained;
  if (gained) {
    g.log.unshift({ t: Date.now(), xp: gained, why: lines.map(l => l.why).join(" · ") });
    if (g.log.length > 60) g.log.length = 60;
  }
  const after = levelFor(g.xp);
  return { g, gained, lines, levelUp: after > before ? after : 0 };
}

// 캐릭터 그림 (직접 그린 것). 레벨·기분에 따라 장식이 달라진다.
export function characterSVG(level, mood) {
  const skin = "#F6D7B0", body = "#2F6FB7", accent = "#F2B134";
  const eyes = mood === "sleepy" ? `<path d="M62 70 q6 -4 12 0" stroke="#222" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M88 70 q6 -4 12 0" stroke="#222" stroke-width="3" fill="none" stroke-linecap="round"/>`
    : `<circle cx="68" cy="70" r="4" fill="#222"/><circle cx="94" cy="70" r="4" fill="#222"/><circle cx="69.5" cy="68.5" r="1.3" fill="#fff"/><circle cx="95.5" cy="68.5" r="1.3" fill="#fff"/>`;
  const mouth = mood === "happy" ? `<path d="M70 86 q11 12 22 0" stroke="#B5543C" stroke-width="3" fill="none" stroke-linecap="round"/>`
    : mood === "sleepy" ? `<path d="M76 88 q5 3 10 0" stroke="#B5543C" stroke-width="3" fill="none" stroke-linecap="round"/>`
    : `<path d="M72 86 q9 7 18 0" stroke="#B5543C" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  const hat = level >= 3 ? `<path d="M50 52 q31 -26 62 0 l-4 -14 q-27 -16 -54 0 z" fill="#333"/><rect x="46" y="50" width="70" height="6" rx="3" fill="#333"/>` : "";
  const glasses = level >= 5 ? `<rect x="57" y="63" width="22" height="13" rx="4" fill="#111" opacity=".85"/><rect x="83" y="63" width="22" height="13" rx="4" fill="#111" opacity=".85"/><path d="M79 68 h4" stroke="#111" stroke-width="2"/>` : "";
  const crown = level >= 10 ? `<path d="M56 46 l8 -16 l10 10 l7 -16 l7 16 l10 -10 l8 16 z" fill="${accent}" stroke="#C78A12" stroke-width="2"/>` : "";
  const scarf = level >= 8 ? `<path d="M58 104 q23 10 46 0 l0 10 q-23 10 -46 0 z" fill="#C94F4F"/>` : "";
  const sparkle = mood === "happy" ? `<g fill="${accent}"><path d="M30 40 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z"/><path d="M136 30 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z"/></g>` : "";
  return `<svg viewBox="0 0 162 170" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="캐릭터">
  <ellipse cx="81" cy="160" rx="44" ry="7" fill="rgba(0,0,0,.12)"/>
  <!-- 몸통 -->
  <path d="M46 150 q0 -50 35 -50 q35 0 35 50 z" fill="${body}"/>
  <path d="M62 102 q19 14 38 0 l-4 46 h-30 z" fill="#E9EEF5"/>
  <!-- 팔 -->
  <path d="M50 112 q-16 12 -4 30" stroke="${skin}" stroke-width="10" fill="none" stroke-linecap="round"/>
  <path d="M108 110 q10 12 2 26" stroke="${skin}" stroke-width="10" fill="none" stroke-linecap="round"/>
  <!-- 기타 (몸 앞) -->
  <g transform="rotate(-30 92 128)">
    <ellipse cx="92" cy="136" rx="19" ry="21" fill="#C9792A" stroke="#8C5520" stroke-width="2"/>
    <ellipse cx="94" cy="114" rx="14" ry="13" fill="#C9792A" stroke="#8C5520" stroke-width="2"/>
    <circle cx="93" cy="129" r="6" fill="#4A2A10"/>
    <rect x="86" y="128" width="16" height="4" rx="1" fill="#3B2210"/>
    <rect x="92" y="58" width="5" height="60" fill="#5A3A1A"/>
    <rect x="89" y="48" width="11" height="13" rx="2" fill="#2B1A0C"/>
    <g stroke="#F3E7C8" stroke-width=".8"><path d="M93 60 v70"/><path d="M95 60 v70"/><path d="M97 60 v70"/></g>
  </g>
  <!-- 머리 -->
  <circle cx="81" cy="72" r="34" fill="${skin}"/>
  <path d="M47 66 q6 -30 34 -30 q28 0 34 30 q-14 -12 -34 -12 q-20 0 -34 12z" fill="#2B2B2B"/>
  ${eyes}${mouth}
  <circle cx="60" cy="82" r="4" fill="#F4A6A0" opacity=".7"/><circle cx="102" cy="82" r="4" fill="#F4A6A0" opacity=".7"/>
  ${scarf}${glasses}${hat}${crown}${sparkle}
</svg>`;
}
