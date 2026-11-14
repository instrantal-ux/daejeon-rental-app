// 화면 위 UI — 상단 상태, 빠른 아이템, 대상 표시, 토스트, 패널(가방·제작·설치·랭킹·계정)
import * as I from "./items.js";
import * as C from "./cloud.js";

const $ = id => document.getElementById(id);
const el = (t, c, tx) => { const e = document.createElement(t); if (c) e.className = c; if (tx != null) e.textContent = tx; return e; };

export class HUD {
  constructor(game) {
    this.game = game; this.tab = "bag"; this.open = false;
    $("btnBag").addEventListener("click", () => this.togglePanel("bag"));
    $("btnMenu").addEventListener("click", () => this.togglePanel("rank"));
    $("panelClose").addEventListener("click", () => this.togglePanel(null));
    Array.prototype.forEach.call(document.querySelectorAll(".tabs button"), b => b.addEventListener("click", () => { this.tab = b.getAttribute("data-tab"); this.renderPanel(); }));
    this._quickKeys = ["wood", "stone", "fiber", "berry", "ore", "crystal", "shard"];
  }
  toast(text, gold) {
    const box = $("toasts"), t = el("div", "toast" + (gold ? " gold" : ""), text); box.appendChild(t);
    setTimeout(() => { t.style.transition = "opacity .3s"; t.style.opacity = "0"; setTimeout(() => t.remove(), 320); }, 1800);
  }
  hint(text) { $("hint").textContent = text || ""; }
  update(st, target, prog) {
    const L = I.levelFor(st.score), lo = I.levelPrev(L), hi = I.levelNext(L);
    $("lvNum").textContent = L; $("lvFill").style.width = Math.round((st.score - lo) / (hi - lo) * 100) + "%";
    $("scoreTxt").textContent = st.score.toLocaleString("ko-KR");
    const q = $("quick"); q.textContent = "";
    this._quickKeys.forEach(k => { if (st.inv[k]) { const s = el("span", "", I.ITEMS[k].icon + " "); s.appendChild(el("b", "", String(st.inv[k]))); q.appendChild(s); } });
    const tb = $("target");
    if (target) { tb.hidden = false; $("targetTxt").textContent = target.text; $("progFill").style.width = Math.round((prog || 0) * 100) + "%"; }
    else tb.hidden = true;
  }
  setWorld(name) { $("worldName").textContent = name; }
  togglePanel(tab) {
    if (tab && (!this.open || this.tab !== tab)) { this.open = true; this.tab = tab; } else this.open = false;
    $("panel").hidden = !this.open;
    if (this.open) this.renderPanel();
  }
  renderPanel() {
    Array.prototype.forEach.call(document.querySelectorAll(".tabs button"), b => { b.className = b.getAttribute("data-tab") === this.tab ? "on" : ""; });
    const body = $("panelBody"); body.textContent = "";
    const st = this.game.state;
    if (this.tab === "bag") {
      const keys = Object.keys(st.inv).filter(k => st.inv[k] > 0);
      if (!keys.length) body.appendChild(el("p", "note", "아직 비었어. 나무·바위·덤불 가까이 가서 [행동] 버튼을 꾹 눌러봐."));
      const grid = el("div", "grid");
      keys.forEach(k => {
        const it = I.ITEMS[k], s = el("div", "slot" + (it.tool ? " tool" : "") + (st.tool === k ? " on" : ""));
        s.appendChild(el("div", "ic", it.icon)); s.appendChild(el("div", "nm", it.name)); s.appendChild(el("div", "n", "×" + st.inv[k]));
        if (it.tool) s.addEventListener("click", () => { this.game.equip(st.tool === k ? null : k); this.renderPanel(); });
        if (it.place) s.addEventListener("click", () => { this.tab = "build"; this.renderPanel(); });
        grid.appendChild(s);
      });
      body.appendChild(grid);
      body.appendChild(el("p", "note", "도구를 누르면 손에 들어. 도끼: 나무 3배 · 곡괭이: 광석·수정 캘 수 있음 · 횃불: 밤에 밝음"));
      const kv = (k, v) => { const r = el("div", "kv"); r.appendChild(el("span", "", k)); r.appendChild(el("b", "mono", v)); body.appendChild(r); };
      kv("점수", st.score.toLocaleString("ko-KR")); kv("채집", st.stats.gathered + "회"); kv("이동 거리", Math.round(st.stats.distance) + "m"); kv("연 세계", st.unlocked.length + " / 4"); kv("지은 것", st.stats.placed + "개");
    } else if (this.tab === "craft") {
      I.RECIPES.forEach(r => {
        const row = el("div", "recipe"), out = I.ITEMS[r.out];
        row.appendChild(el("div", "ic", out.icon));
        const nm = el("div", "nm", out.name); nm.appendChild(el("small", "", r.desc)); row.appendChild(nm);
        const b = el("button", "", "만들기"); b.disabled = !I.canCraft(st.inv, r);
        b.addEventListener("click", () => { this.game.craft(r); this.renderPanel(); });
        row.appendChild(b);
        const need = el("div", "need");
        Object.keys(r.need).forEach(k => { const have = st.inv[k] || 0; const sp = el("span", have < r.need[k] ? "lack" : "", I.ITEMS[k].icon + " " + have + "/" + r.need[k] + "  "); need.appendChild(sp); });
        row.appendChild(need); body.appendChild(row);
      });
    } else if (this.tab === "build") {
      const kinds = ["campfire", "hut", "portal"];
      let any = false;
      kinds.forEach(k => {
        if (!st.inv[k]) return; any = true;
        const row = el("div", "recipe"), it = I.ITEMS[k];
        row.appendChild(el("div", "ic", it.icon));
        const nm = el("div", "nm", it.name + " ×" + st.inv[k]); nm.appendChild(el("small", "", k === "portal" ? "지금 서 있는 자리에 세워. 세운 뒤 들어가면 다음 세계로" : k === "hut" ? "점수 +200. 내 집 근처에서 부활" : "밤에 주변이 밝아지고 점수 +50")); row.appendChild(nm);
        const b = el("button", "", "여기 설치"); b.addEventListener("click", () => { this.game.placeItem(k); this.renderPanel(); }); row.appendChild(b);
        body.appendChild(row);
      });
      if (!any) body.appendChild(el("p", "note", "설치할 게 없어. 제작 탭에서 모닥불·오두막·포탈을 만들어."));
      const placed = this.game.world.placed;
      if (placed.length) { body.appendChild(el("p", "note", "이 세계에 지은 것: " + placed.map(p => I.ITEMS[p.kind].name).join(", "))); }
    } else if (this.tab === "rank") {
      body.appendChild(el("p", "note", "점수 = 채집·제작·건설·탐험·세계 개방. 로그인하면 내 기록이 올라가."));
      const box = el("div", ""); box.appendChild(el("p", "note", "불러오는 중…")); body.appendChild(box);
      C.leaderboard(30).then(rows => {
        box.textContent = "";
        if (!rows.length) { box.appendChild(el("p", "note", "아직 아무도 없어. 로그인하고 첫 모험가가 되어봐.")); return; }
        const me = C.user();
        rows.forEach((r, i) => {
          const d = el("div", "rankrow" + (me && r.id === me.id ? " me" : ""));
          d.appendChild(el("span", "no" + (i < 3 ? " top" : ""), i < 3 ? ["🥇", "🥈", "🥉"][i] : String(i + 1)));
          const n = el("div", ""); n.appendChild(el("b", "", r.nickname || "모험가")); n.appendChild(el("small", "", "Lv." + r.level + " · 세계 " + r.worlds + "개 · " + Math.round(r.distance || 0) + "m 탐험")); d.appendChild(n);
          d.appendChild(el("span", "sc", (r.score || 0).toLocaleString("ko-KR"))); box.appendChild(d);
        });
      }).catch(e => { box.textContent = ""; box.appendChild(el("p", "note", "랭킹을 못 불러왔어: " + e.message)); });
      if (!C.user()) { const b = el("button", "ghost", "로그인하러 가기"); b.addEventListener("click", () => { this.tab = "acct"; this.renderPanel(); }); body.appendChild(b); }
    } else if (this.tab === "acct") {
      body.className = "panel-body acct";
      const u = C.user();
      if (!u) {
        body.appendChild(el("p", "note", "로그인하면 진행 상황이 서버에 저장되고(폰 바꿔도 이어서), 랭킹에 올라가. 가계부 앱과 같은 계정을 써도 돼."));
        const em = document.createElement("input"); em.type = "email"; em.placeholder = "이메일"; em.autocomplete = "username";
        const pw = document.createElement("input"); pw.type = "password"; pw.placeholder = "비밀번호 (6자 이상)";
        body.appendChild(em); body.appendChild(pw);
        const row = el("div", "row"); const li = el("button", "pri", "로그인"), jo = el("button", "", "가입"); row.appendChild(li); row.appendChild(jo); body.appendChild(row);
        const msg = el("p", "msg", ""); msg.hidden = true; body.appendChild(msg);
        const say = (t, ok) => { msg.hidden = false; msg.className = "msg" + (ok ? " ok" : ""); msg.textContent = t; };
        li.addEventListener("click", async () => { li.disabled = jo.disabled = true; say("로그인 중…", true); try { await C.signIn(em.value.trim(), pw.value); await this.game.afterLogin(); this.renderPanel(); } catch (e) { say(e.message); } finally { li.disabled = jo.disabled = false; } });
        jo.addEventListener("click", async () => { li.disabled = jo.disabled = true; say("가입 중…", true); try { const r = await C.signUp(em.value.trim(), pw.value); if (r.needConfirm) say("메일함에서 확인 링크 누른 뒤 로그인해", true); else { await this.game.afterLogin(); this.renderPanel(); } } catch (e) { say(e.message); } finally { li.disabled = jo.disabled = false; } });
      } else {
        const kv = (k, v) => { const r = el("div", "kv"); r.appendChild(el("span", "", k)); r.appendChild(el("b", "", v)); body.appendChild(r); };
        kv("계정", u.email); kv("모험가 이름", st.nick);
        kv("서버 저장", this.game.cloudSavedAt ? new Date(this.game.cloudSavedAt).toLocaleTimeString("ko-KR") : "아직");
        const row = el("div", "row");
        const sv = el("button", "pri", "지금 저장"); sv.addEventListener("click", async () => { sv.disabled = true; try { await this.game.cloudSave(true); this.toast("서버에 저장했어"); } catch (e) { this.toast("저장 실패: " + e.message); } finally { sv.disabled = false; this.renderPanel(); } });
        const rn = el("button", "", "이름 바꾸기"); rn.addEventListener("click", () => { const n = prompt("모험가 이름", st.nick); if (n && n.trim()) { st.nick = n.trim().slice(0, 12); this.game.save(); this.game.cloudSave(true).catch(() => {}); this.renderPanel(); } });
        const out = el("button", "", "로그아웃"); out.addEventListener("click", async () => { await C.signOut(); this.renderPanel(); });
        row.appendChild(sv); row.appendChild(rn); row.appendChild(out); body.appendChild(row);
      }
      body.appendChild(el("p", "note", "버전 " + (window.APP_VERSION || "dev")));
      const up = el("button", "ghost", "업데이트 확인"); up.addEventListener("click", () => this.game.checkUpdate(true)); body.appendChild(up);
      return;
    }
    body.className = "panel-body";
  }
}
