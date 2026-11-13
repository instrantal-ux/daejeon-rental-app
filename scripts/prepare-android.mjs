// `npx cap add android` 뒤에 실행: 버전 코드·서명 설정을 안드로이드 프로젝트에 넣는다
import fs from "node:fs";
import path from "node:path";
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const gradlePath = path.join(ROOT, "android/app/build.gradle");
let g = fs.readFileSync(gradlePath, "utf8");
const [ma, mi, pa] = pkg.version.split(".").map(n => parseInt(n, 10) || 0);
const versionCode = process.env.VERSION_CODE ? parseInt(process.env.VERSION_CODE, 10) : ma * 10000 + mi * 100 + pa;
g = g.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`).replace(/versionName\s+"[^"]*"/, `versionName "${pkg.version}"`);
const ks = process.env.KEYSTORE_PATH || path.join(ROOT, "android-signing/release.jks");
const pw = process.env.KEYSTORE_PASSWORD || "daejeon-rental-2026";
const alias = process.env.KEY_ALIAS || "ledger";
if (!g.includes("signingConfigs.release")) {
  g += `
// --- 자동 추가: 릴리스 서명 (scripts/prepare-android.mjs) ---
android {
    signingConfigs {
        release {
            storeFile file(${JSON.stringify(ks)})
            storePassword ${JSON.stringify(pw)}
            keyAlias ${JSON.stringify(alias)}
            keyPassword ${JSON.stringify(pw)}
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}
`;
}
fs.writeFileSync(gradlePath, g);
// 앱 이름 (한글) 확인
const strings = path.join(ROOT, "android/app/src/main/res/values/strings.xml");
if (fs.existsSync(strings)) {
  let s = fs.readFileSync(strings, "utf8");
  s = s.replace(/<string name="app_name">[^<]*<\/string>/, '<string name="app_name">석재 가계부</string>').replace(/<string name="title_activity_main">[^<]*<\/string>/, '<string name="title_activity_main">석재 가계부</string>');
  fs.writeFileSync(strings, s);
}
console.log("안드로이드 준비 완료: versionCode", versionCode, "versionName", pkg.version, "keystore", ks);
