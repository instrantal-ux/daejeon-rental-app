// 빌드 때 Poly Haven(CC0) 에서 지형 텍스처·HDRI 를 받아 www/assets 에 넣는다.
// 하나라도 못 받으면 건너뛰고 manifest 에 기록 → 게임은 있는 것만 쓰고 없으면 단색으로 그린다.
import fs from "node:fs"; import path from "node:path";
const ROOT = path.resolve(new URL("..", import.meta.url).pathname), OUT = path.join(ROOT, "www/assets");
fs.mkdirSync(OUT, { recursive: true });
const TEX = "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/", HDR = "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/";
// 역할별 후보 (앞에서부터 되는 걸 씀)
const ROLES = {
  grass: ["aerial_grass_rock", "coast_sand_rocks_02", "forest_leaves_03"],
  rock: ["rock_face_03", "cliff_side", "rock_pitted_mossy"],
  sand: ["coast_sand_04", "sand_03"],
  snow: ["snow_02", "snow_field_aerial"],
  desert: ["cliff_side", "rock_pitted_mossy"],
  bark: ["bark_willow_02", "bark_brown_02", "pine_bark"],
};
const HDRIS = {
  day: ["kloofendal_48d_partly_cloudy_puresky", "autumn_field_puresky", "kiara_1_dawn"],
  desert: ["syferfontein_1d_clear_puresky", "noon_grass", "kiara_1_dawn"],
  snow: ["snowy_park_01", "kloofendal_48d_partly_cloudy_puresky"],
  night: ["moonless_golf", "dikhololo_night", "satara_night"],
};
const manifest = { textures: {}, hdri: {} };
async function get(url, dest) {
  try {
    const r = await fetch(url, { redirect: "follow" });
    if (!r.ok) return false;
    const buf = Buffer.from(await r.arrayBuffer()); if (buf.length < 10000) return false;
    fs.writeFileSync(dest, buf); return true;
  } catch (e) { return false; }
}
for (const role of Object.keys(ROLES)) {
  for (const slug of ROLES[role]) {
    const d = path.join(OUT, role + "_diff.jpg"), n = path.join(OUT, role + "_nor.jpg");
    const okD = await get(`${TEX}${slug}/${slug}_diff_1k.jpg`, d);
    if (!okD) { console.log("✗", role, slug); continue; }
    const okN = await get(`${TEX}${slug}/${slug}_nor_gl_1k.jpg`, n);
    manifest.textures[role] = { slug, diff: "assets/" + role + "_diff.jpg", nor: okN ? "assets/" + role + "_nor.jpg" : null, license: "CC0 polyhaven.com" };
    console.log("✓", role, slug, okN ? "(+normal)" : ""); break;
  }
}
for (const role of Object.keys(HDRIS)) {
  for (const slug of HDRIS[role]) {
    const d = path.join(OUT, role + ".hdr");
    if (await get(`${HDR}${slug}_1k.hdr`, d)) { manifest.hdri[role] = { slug, file: "assets/" + role + ".hdr", license: "CC0 polyhaven.com" }; console.log("✓ hdri", role, slug); break; }
    console.log("✗ hdri", role, slug);
  }
}
fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 1));
fs.writeFileSync(path.join(OUT, "CREDITS.txt"), "지형 텍스처·HDRI: Poly Haven (polyhaven.com) CC0\n" + JSON.stringify(manifest, null, 1));
console.log("assets:", Object.keys(manifest.textures).length, "textures,", Object.keys(manifest.hdri).length, "hdri");
