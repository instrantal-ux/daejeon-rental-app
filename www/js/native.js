// 캐패시터 플러그인 등록 (앱 안에서만 의미 있음). 파일이 없거나 웹이면 조용히 넘어간다.
export async function loadNative() {
  if (!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())) return false;
  const names = ["@capacitor/app", "@capacitor/browser", "@capacitor/filesystem", "@capacitor/share"];
  const r = await Promise.allSettled(names.map(n => import(n)));
  r.forEach((x, i) => { if (x.status === "rejected") console.warn("플러그인 로드 실패", names[i], x.reason && x.reason.message); });
  return true;
}
