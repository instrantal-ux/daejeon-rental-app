// 아이템·제작법 (순수 데이터/로직)
export const ITEMS = {
  wood:   { name: "나무",   icon: "🪵" },
  stone:  { name: "돌",     icon: "🪨" },
  berry:  { name: "열매",   icon: "🍓" },
  fiber:  { name: "풀섬유", icon: "🌾" },
  ore:    { name: "광석",   icon: "⛏️" },
  crystal:{ name: "수정",   icon: "💎" },
  axe:    { name: "도끼",   icon: "🪓", tool: true },
  pick:   { name: "곡괭이", icon: "⚒️", tool: true },
  torch:  { name: "횃불",   icon: "🔥", tool: true },
  campfire:{ name: "모닥불", icon: "🏕️", place: "campfire" },
  shard:  { name: "포탈 조각", icon: "🔮" },
  portal: { name: "포탈",   icon: "🌀", place: "portal" },
  hut:    { name: "오두막", icon: "🛖", place: "hut" },
};
export const RECIPES = [
  { id: "axe",  out: "axe",  n: 1, need: { wood: 3, stone: 2 },  desc: "나무를 3배 빨리 벰" },
  { id: "pick", out: "pick", n: 1, need: { wood: 3, stone: 3 },  desc: "광석을 캘 수 있음" },
  { id: "torch", out: "torch", n: 1, need: { wood: 2, fiber: 2 }, desc: "밤에 주변이 밝음" },
  { id: "campfire", out: "campfire", n: 1, need: { wood: 6, stone: 4 }, desc: "설치하면 밤에 쉼터 · 부활 지점" },
  { id: "hut", out: "hut", n: 1, need: { wood: 20, stone: 10, fiber: 6 }, desc: "내 집. 랭킹 점수 +200" },
  { id: "shard", out: "shard", n: 1, need: { stone: 8, ore: 3, berry: 4 }, desc: "4개 모으면 포탈을 만들 수 있음" },
  { id: "portal", out: "portal", n: 1, need: { shard: 4, wood: 10, crystal: 1 }, desc: "다른 세계로 가는 문" },
];
export function canCraft(inv, r) { return Object.keys(r.need).every(k => (inv[k] || 0) >= r.need[k]); }
export function craft(inv, r) {
  if (!canCraft(inv, r)) return false;
  Object.keys(r.need).forEach(k => { inv[k] -= r.need[k]; if (inv[k] <= 0) delete inv[k]; });
  inv[r.out] = (inv[r.out] || 0) + r.n; return true;
}
export function add(inv, k, n) { inv[k] = (inv[k] || 0) + (n || 1); }
export function has(inv, k, n) { return (inv[k] || 0) >= (n || 1); }
// 레벨: 점수 기반
export function levelFor(score) { let L = 1; while (score >= 60 * L * (L + 1) && L < 99) L++; return L; }
export function levelNext(L) { return 60 * L * (L + 1); }
export function levelPrev(L) { return L <= 1 ? 0 : 60 * (L - 1) * L; }
