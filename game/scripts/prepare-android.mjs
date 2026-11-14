// cap add android 뒤: 버전·서명·가로모드·전체화면
import fs from "node:fs"; import path from "node:path";
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const gp = path.join(ROOT, "android/app/build.gradle"); let g = fs.readFileSync(gp, "utf8");
const [ma, mi, pa] = pkg.version.split(".").map(n => parseInt(n, 10) || 0);
const vc = process.env.VERSION_CODE ? parseInt(process.env.VERSION_CODE, 10) : ma * 10000 + mi * 100 + pa;
g = g.replace(/versionCode\s+\d+/, `versionCode ${vc}`).replace(/versionName\s+"[^"]*"/, `versionName "${pkg.version}"`);
const ks = process.env.KEYSTORE_PATH || path.join(ROOT, "..", "android-signing/release.jks"), pw = process.env.KEYSTORE_PASSWORD || "daejeon-rental-2026", alias = process.env.KEY_ALIAS || "ledger";
if (!g.includes("signingConfigs.release")) g += `\nandroid {\n    signingConfigs { release { storeFile file(${JSON.stringify(ks)}); storePassword ${JSON.stringify(pw)}; keyAlias ${JSON.stringify(alias)}; keyPassword ${JSON.stringify(pw)} } }\n    buildTypes { release { signingConfig signingConfigs.release } }\n}\n`;
fs.writeFileSync(gp, g);
// 가로 모드 + 전체 화면
const mp = path.join(ROOT, "android/app/src/main/AndroidManifest.xml"); let m = fs.readFileSync(mp, "utf8");
if (!/android:screenOrientation/.test(m)) m = m.replace(/<activity\b/, '<activity android:screenOrientation="sensorLandscape"');
fs.writeFileSync(mp, m);
const sp = path.join(ROOT, "android/app/src/main/res/values/styles.xml");
if (fs.existsSync(sp)) { let s = fs.readFileSync(sp, "utf8"); if (!s.includes("windowFullscreen")) s = s.replace(/(<style name="AppTheme\.NoActionBar"[^>]*>)/, '$1\n        <item name="android:windowFullscreen">true</item>\n        <item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>'); fs.writeFileSync(sp, s); }
const st = path.join(ROOT, "android/app/src/main/res/values/strings.xml");
if (fs.existsSync(st)) fs.writeFileSync(st, fs.readFileSync(st, "utf8").replace(/<string name="app_name">[^<]*<\/string>/, '<string name="app_name">포탈 월드</string>').replace(/<string name="title_activity_main">[^<]*<\/string>/, '<string name="title_activity_main">포탈 월드</string>'));
console.log("안드로이드 준비: versionCode", vc, pkg.version);
