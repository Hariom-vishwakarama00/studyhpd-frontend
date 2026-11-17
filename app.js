import { ICONS } from "/icons.js";
import { pageMeta } from "/seo.js";

// ---------- tiny helpers ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ic = (n, cls = "") => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ""}</svg>`;
const fmtDate = t => t ? new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
const fmtDT = t => t ? new Date(t).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—";
const rupee = n => "₹" + Number(n || 0).toLocaleString("en-IN");
const fmtSize = b => !b ? "" : b > 1e6 ? (b / 1e6).toFixed(1) + " MB" : Math.round(b / 1e3) + " KB";
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 2600); }

// A page read (GET) started for one page is dropped if the user has already moved to another page,
// so a slow answer for the old page can never draw over the new one (fast taps, Back button).
const STALE = new Promise(() => {});
let seq = 0; // bumped on every page render (router below)
async function api(path, opts = {}) {
  const page = seq, read = !opts.method || opts.method === "GET";
  const o = { credentials: "same-origin", ...opts, headers: { ...(opts.headers || {}) } };
  if (o.body && !(o.body instanceof FormData) && typeof o.body !== "string") { o.body = JSON.stringify(o.body); o.headers["content-type"] = "application/json"; }
  const r = await fetch("/api" + path, o);
  let data = {}; try { data = await r.json(); } catch {}
  if (read && page !== seq) return STALE;
  if (!r.ok) { const e = new Error(data.error || "Something went wrong (" + r.status + ")"); e.status = r.status; e.data = data; throw e; }
  return data;
}
function upload(path, form, onProgress) {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest(); x.open("POST", "/api" + path); x.withCredentials = true;
    x.upload.onprogress = e => e.lengthComputable && onProgress && onProgress(e.loaded / e.total);
    x.onload = () => { let d = {}; try { d = JSON.parse(x.responseText); } catch {} x.status < 300 ? resolve(d) : reject(new Error(d.error || "Upload failed (" + x.status + ")")); };
    x.onerror = () => reject(new Error("Network error — please try again"));
    x.send(form);
  });
}

// ---------- state ----------
const S = { boot: null, me: null };
async function loadBoot() { S.boot = await api("/bootstrap"); S.me = S.boot.me; if (S.me && S.me.theme) { try { localStorage.setItem("shpd-theme", S.me.theme); } catch {} } return S.boot; }
const cat = id => S.boot.categories.find(c => c.id === id);
const subj = id => S.boot.subjects.find(s => s.id === id);
const unit = id => S.boot.units.find(u => u.id === id);
const setting = k => (S.boot.settings || {})[k] || "";
const CAT_STYLE = { premium: ["#fef3c7", "#d97706"], notes: ["#e0e7ff", "#4f46e5"], "question-banks": ["#dcfce7", "#16a34a"], "previous-year-papers": ["#ffedd5", "#ea580c"], "lab-manuals": ["#fce7f3", "#db2777"] };
const catStyle = c => CAT_STYLE[c && c.slug] || ["#ede9fe", "#7c3aed"];
const ICON_ALIASES = { FileText: "file-text", NotebookPen: "notebook-pen", HelpCircle: "circle-help", FlaskConical: "flask-conical" };
const catIcon = c => ICONS[ICON_ALIASES[c.icon] || c.icon] ? (ICON_ALIASES[c.icon] || c.icon) : "folder";
const tint = hex => { const h = (hex || "#6366f1").replace("#", ""); const n = parseInt(h.length === 3 ? h.split("").map(x => x + x).join("") : h, 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},.12)`; };

// ---------- shell ----------
function inApp() { try { return document.documentElement.classList.contains("app-boot") || sessionStorage.getItem("shpd-app") === "1"; } catch { return false; } }
const NAV = [["/", "Home", "house"], ["/search", "Search", "search"], ["/profile", "Profile", "user"]];
function shell() {
  const p = location.pathname;
  applyTheme(themeNow());
  themeButton();
  const on = h => (h === "/" ? p === "/" : p.startsWith(h)) ? "on" : "";
  const top = [...NAV.slice(0, 2), ["/about", "About"], ["/contact", "Contact"], NAV[2]];
  if (S.me && S.me.role === "admin") top.push(["/admin", "Admin"]);
  $("#topnav").innerHTML = top.map(([h, t]) => `<a href="${h}" class="${on(h)}">${t}</a>`).join("");
  $("#tabbar").innerHTML = NAV.map(([h, t, i]) => `<a href="${h}" class="${on(h)}">${ic(i)}<span>${t}</span></a>`).join("");
  const ann = setting("announcement");
  $("#notice").innerHTML = !S.me && !p.startsWith("/login") && !p.startsWith("/register") && !p.startsWith("/admin")
    ? `<div class="notice"><div class="wrap">${ic("lock", "sm")}<span>Login to access notes and PDFs</span><a href="/login?returnTo=${encodeURIComponent(p + location.search)}">Login</a></div></div>`
    : ann ? `<div class="notice info"><div class="wrap">${ic("info", "sm")}<span>${esc(ann)}</span></div></div>` : "";
  $("#footer").innerHTML = `<div class="wrap"><div class="fb"><img src="/img/logo.png" alt="">${esc(setting("site_name") || "StudyHPD")}</div><p>${esc(setting("site_tagline"))}</p>
    <div class="dev-by">Developed by <span>Hariom Vishwakarama</span></div>
    <nav class="legal-links" aria-label="Legal"><a href="/privacy">Privacy Policy</a><a href="/terms">Terms of Service</a></nav>
    <div class="copy">© ${new Date().getFullYear()} ${esc(setting("site_name") || "StudyHPD")}. All rights reserved.</div></div>`;
}
// Title, description and canonical link for the page on screen (the same words the server gives search engines).
function setMeta(kind, ctx = {}) {
  const m = pageMeta(kind, { settings: (S.boot && S.boot.settings) || {}, subjects: (S.boot && S.boot.subjects) || [], plans: (S.boot && S.boot.plans) || [], ...ctx });
  const url = m.path ? location.origin + m.path : "";
  document.title = m.title;
  const put = (sel, make, attr, val) => { let n = document.head.querySelector(sel); if (!val) { if (n) n.remove(); return; } if (!n) { n = make(); document.head.appendChild(n); } n.setAttribute(attr, val); };
  const meta = (k, v, a = "name") => put(`meta[${a}="${k}"]`, () => { const n = document.createElement("meta"); n.setAttribute(a, k); return n; }, "content", v);
  meta("description", m.description); meta("robots", m.robots);
  meta("og:title", m.title, "property"); meta("og:description", m.description, "property"); meta("og:url", url, "property");
  put('link[rel="canonical"]', () => { const n = document.createElement("link"); n.rel = "canonical"; return n; }, "href", url);
}

// ---------- components ----------
function docCard(d) {
  const s = subj(d.subject_id), c = cat(d.category_id), prem = d.access_level === "premium";
  const action = !S.me ? "Login" : prem && !S.me.premium ? "Unlock" : "Open";
  return `<a class="doc" href="/document/${d.id}">
    <div class="th ${prem ? "prem" : ""}">${d.has_thumb ? `<img src="/api/thumb/${d.id}?v=${d.updated_at || 0}" alt="" loading="lazy" decoding="async">` : ic(prem ? "crown" : "file-text", "xl")}
      <span class="badge ${prem ? "premium" : "free"}">${prem ? "★ PREMIUM" : "FREE"}</span></div>
    <div class="bd"><b>${esc(d.title)}</b><span>${esc(s ? s.name : "")}${unit(d.unit_id) && unit(d.unit_id).name !== d.title ? " · " + esc(unit(d.unit_id).name) : ""}</span>
      <div class="ft"><span class="pill">${esc(c ? c.name : "Document")}</span><span class="act">${action === "Open" ? ic("eye", "sm") : ic("lock", "sm")}${action}</span></div></div></a>`;
}
const docGrid = (docs, emptyMsg = "No documents found.") => docs.length ? `<div class="docs">${docs.map(docCard).join("")}</div>` : `<div class="empty">${ic("file-text", "lg")}<p>${emptyMsg}</p></div>`;
function subjRow(s) {
  return `<a class="subj" href="/subject/${s.id}"><div class="em" style="background:${tint(s.color)}">${s.icon ? esc(s.icon) : "📘"}</div>
    <div><b>${esc(s.name)}</b><small>${esc(s.code)}${s.semester ? " · " + esc(s.semester) : ""}</small></div><span class="chev">${ic("chevron-right")}</span></a>`;
}
function needLogin() { go("/login?returnTo=" + encodeURIComponent(location.pathname + location.search)); }

// ---------- pages ----------
// Semester labels: one form everywhere ("Semester 1" … "Semester 8"); older typed values are read the same way.
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8].map(n => "Semester " + n);
const ROMAN_SEM = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8 };
function semLabel(x) {
  const s = String(x == null ? "" : x).trim().toLowerCase(); if (!s) return "";
  let m = s.match(/(?:^|[^0-9])([1-8])(?:st|nd|rd|th)?(?![0-9])/), n = m ? +m[1] : 0;
  if (!n && (m = s.replace(/sem(ester)?/g, " ").match(/(?:^|[^a-z])(viii|vii|vi|iv|v|iii|ii|i)(?![a-z])/))) n = ROMAN_SEM[m[1]];
  return n ? "Semester " + n : String(x).trim();
}
// ---- Phase 1: themes, study choice (branch + semester), study filter, free trial, Read Aloud ----
const THEMES = [["professional", "Professional"], ["dark", "Dark"], ["colorful", "Colorful"]];
const BRANCHES = ["CS", "AIML", "DS", "IoT", "Mechanical", "Civil"];
const themeNow = () => { try { return localStorage.getItem("shpd-theme") || (S.me && S.me.theme) || "professional"; } catch { return (S.me && S.me.theme) || "professional"; } };
function applyTheme(t) {
  if (!THEMES.some(x => x[0] === t)) t = "professional";
  document.documentElement.dataset.theme = t;
  const tc = document.querySelector('meta[name="theme-color"]'); if (tc) tc.setAttribute("content", t === "dark" ? "#0f172a" : t === "colorful" ? "#db2777" : "#4f46e5");
}
// the header button cycles the three themes; the Profile page has the full picker
function themeButton() {
  const bar = $("#topbar .topbar-in"); if (!bar) return;
  let b = $("#themebtn");
  if (!b) { b = document.createElement("button"); b.id = "themebtn"; b.type = "button"; b.className = "theme-btn"; b.onclick = () => { const cur = themeNow(), i = THEMES.findIndex(x => x[0] === cur); setTheme(THEMES[(i + 1) % THEMES.length][0]); }; bar.appendChild(b); }
  const cur = themeNow(), name = (THEMES.find(x => x[0] === cur) || THEMES[0])[1];
  b.setAttribute("aria-label", "Theme: " + name + ". Tap to change"); b.title = "Theme: " + name;
  b.innerHTML = ic("palette", "sm") + `<span>${name}</span>`;
}
async function setTheme(t) {
  applyTheme(t); try { localStorage.setItem("shpd-theme", t); } catch {}
  themeButton();
  if (S.me) { try { const r = await api("/me/prefs", { method: "POST", body: { theme: t } }); S.me = r.me; S.boot.me = r.me; } catch {} }
}
// study filter (Phase 1b): a logged-in student sees only the notes of their own branch and semester. A subject with no branch is for every branch.
// Admins and visitors who are not logged in see everything, as before. The server enforces the same rule (studyFits in the worker).
const studentMode = () => !!(S.me && S.me.role !== "admin");
const studyNeeded = () => studentMode() && (!S.me.branch || !S.me.semester);
const visibleTo = s => {
  if (!s) return false;
  if (!studentMode()) return true;
  if (studyNeeded()) return false;
  return (!s.branch || s.branch === S.me.branch) && semLabel(s.semester) === "Semester " + S.me.semester;
};
const docVisible = d => { const sj = subj(d.subject_id); return sj ? visibleTo(sj) : !studentMode(); };
const visibleDocs = docs => docs.filter(docVisible);
const studyLabel = () => S.me && S.me.branch ? `${S.me.branch}${S.me.semester ? " · Sem " + S.me.semester : ""}` : S.me && S.me.semester ? "Sem " + S.me.semester : "";
// Subscription and trial UI removed; all study material is free.
const trialDays = () => Math.max(1, parseInt(setting("trial_days"), 10) || 3);
const trialOn = () => setting("trial_enabled") !== "0";
const daysLeft = t => Math.max(0, Math.ceil((t - Date.now()) / 864e5));
function trialLine() { return ""; }
const trialButton = () => "";
const trialCard = () => "";
// the study choice box (onboarding on Home, and changes on Profile)
const studyChips = (name, opts, cur) => opts.map(([v, t]) => `<button type="button" class="chip ${String(cur || "") === String(v) ? "on" : ""}" data-${name}="${esc(v)}">${esc(t)}</button>`).join("");
const SEM_OPTS = [[1, "Sem 1"], [2, "Sem 2"], [3, "Sem 3"], [4, "Sem 4"], [5, "Sem 5"], [6, "Sem 6"], [7, "Sem 7"], [8, "Sem 8"]];
const BRANCH_OPTS = BRANCHES.map(b => [b, b]);
// Phase 1b: branch and semester are required for a student. This page replaces every page until both are saved: no skip, no close.
function studyGateHtml() {
  return `<section class="onb card" id="onb"><h3>Pehle apna branch aur semester chuno</h3><p class="small muted">Ye ek baar bharna zaroori hai. Isse aapko sirf apne branch aur semester ke notes dikhenge. Baad me Profile se badal sakte ho.</p>
    <div class="small muted" style="margin:12px 0 4px">Branch</div><div class="chips" id="onbb">${studyChips("ob-branch", BRANCH_OPTS, S.me.branch)}</div>
    <div class="small muted" style="margin:12px 0 4px">Semester</div><div class="chips" id="onbs">${studyChips("ob-sem", SEM_OPTS, S.me.semester)}</div>
    <div class="row mt"><button class="btn" type="button" id="onbsave">Save karo</button></div><div id="onbm"></div>
    <p class="small muted mt">Galat account hai? <a href="#" id="onblo">Logout</a></p></section>`;
}
function wireStudyGate(root) {
  let br = S.me.branch || "", sem = S.me.semester ? String(S.me.semester) : "";
  $$("[data-ob-branch]", root).forEach(b => b.onclick = () => { br = b.dataset.obBranch; $$("[data-ob-branch]", root).forEach(x => x.classList.toggle("on", x === b)); });
  $$("[data-ob-sem]", root).forEach(b => b.onclick = () => { sem = b.dataset.obSem; $$("[data-ob-sem]", root).forEach(x => x.classList.toggle("on", x === b)); });
  $("#onbsave").onclick = async () => {
    if (!br || !sem) return $("#onbm").innerHTML = `<div class="formerr">Branch aur semester dono chuno, phir Save dabao</div>`;
    try { const r = await api("/me/prefs", { method: "POST", body: { branch: br, semester: sem } }); S.me = r.me; S.boot.me = r.me; render(); }
    catch (e) { $("#onbm").innerHTML = `<div class="formerr">${esc(e.message)}</div>`; }
  };
  $("#onblo").onclick = async e => { e.preventDefault(); await api("/auth/logout", { method: "POST" }); await loadBoot(); go("/"); toast("Logged out"); };
}
// a student opening notes of another branch or semester (direct link): a friendly line, not a 404
function studyMismatch(el) {
  setMeta("notfound"); el.innerHTML = `<div class="empty mt2">${ic("lock", "lg")}<h3>Ye notes aapke branch/semester ke nahi hain</h3><p>Aapka chuna hua: ${esc(studyLabel())}. Galat ho to Profile se badlo.</p><p><a class="btn sm" href="/profile">Profile me badlo</a></p></div>`;
}
// Read Aloud: the browser's own voices (SpeechSynthesis), text only. Premium and trial only.
const RA = { on: false, part: "", text: "", cache: {}, pdf: null, pdfPart: "" };
const raSupported = () => "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
const raStatus = m => { const s = $("#ra-st"); if (s) s.textContent = m || ""; };
function raChunks(text) {
  const sents = text.replace(/\s+/g, " ").match(/[^.!?\u0964]+[.!?\u0964]*\s*/g) || [text];
  const out = []; let cur = "";
  for (const s of sents) { if ((cur + s).length > 220 && cur) { out.push(cur.trim()); cur = s; } else cur += s; }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
function raStop(silent) { RA.on = false; try { speechSynthesis.cancel(); } catch {} if (!silent) raStatus(""); }
function raSpeak(text) {
  raStop(true);
  const chunks = raChunks(text), hi = /[\u0900-\u097F]/.test(text);
  let i = 0; RA.on = true;
  const next = () => {
    if (!RA.on) return;
    if (i >= chunks.length) { RA.on = false; raStatus("Ho gaya"); return; }
    const u = new SpeechSynthesisUtterance(chunks[i++]); u.lang = hi ? "hi-IN" : "en-IN"; u.rate = 1;
    u.onend = next; u.onerror = () => { RA.on = false; raStatus("Awaaz is device par chali nahi"); };
    speechSynthesis.speak(u); raStatus(`Padh raha hoon · ${i} / ${chunks.length}`);
  };
  speechSynthesis.cancel(); next();
}
// text of a PDF that has a text layer (a scanned PDF has none, so nothing is read from it)
async function pdfTextOf(pdf) {
  const out = [];
  for (let i = 1; i <= pdf.numPages; i++) { const pg = await pdf.getPage(i); const tc = await pg.getTextContent(); out.push(tc.items.map(x => x.str).join(" ")); }
  return out.join("\n").replace(/[ \t]+/g, " ").trim();
}
function raBar(part, kind) {
  const prem = !!(S.me && S.me.premium);
  if (!raSupported() && kind === "text") return `<div class="rabar"><span class="small muted">Read Aloud is device me available nahi.</span></div>`;
  if (!prem) return `<div class="rabar locked">${ic("lock", "sm")}<span>Read Aloud sabhi logged-in students ke liye available hai.</span>${S.me ? `` : `<a class="btn sm" href="/login?returnTo=${encodeURIComponent(location.pathname)}">Login</a>`}</div>`;
  return `<div class="rabar"><button class="btn sm" type="button" id="ra-play" data-ra="${kind}" data-part="${part}">${ic("volume-2", "sm")}Read aloud</button><button class="btn line sm" type="button" id="ra-stop" aria-label="Stop reading">${ic("square", "sm")}</button><span id="ra-st" class="small muted"></span></div>`;
}
const routes = [];
const route = (re, fn) => routes.push([re, fn]);

route(/^\/$/, async (el) => {
  const { documents } = await api("/documents");
  const subs = S.boot.subjects.filter(visibleTo);
  const sems = [...new Set(subs.map(s => semLabel(s.semester)).filter(Boolean))].sort((x, y) => (parseInt(x.replace(/\D/g, ""), 10) || 99) - (parseInt(y.replace(/\D/g, ""), 10) || 99) || x.localeCompare(y));
  el.innerHTML = `
  <section class="hero"><div class="hero-top"><img src="/img/logo.png" alt="StudyHPD logo"><div><h1>${esc(setting("site_name"))}</h1><p>${esc(setting("site_tagline"))}</p></div></div>
    <p class="hero-tag">Learn • Organize • Succeed</p>
    <button class="searchbar" id="hs">${ic("search")}<span>Search Notes & Questions</span></button></section>
  ${trialCard() ? `<div class="mt">${trialCard()}</div>` : ""}
  <section class="sec"><div class="sec-h"><h2>Browse Categories</h2></div>
    <div class="cats">${S.boot.categories.map(c => { const [bg, fg] = catStyle(c); return `<a class="cat" href="/search?category=${c.id}"><span class="ic" style="background:${bg};color:${fg}">${ic(catIcon(c))}</span>${esc(c.name)}</a>`; }).join("")}</div></section>
  <section class="sec"><div class="sec-h"><h2>Subjects</h2></div>
    ${studentMode() ? `<p class="small muted" style="margin:0 0 10px">Aapke notes: <b>${esc(studyLabel())}</b> · <a href="/profile">Badlo</a></p>` : `<div class="chips" id="semchips"><button class="chip on" data-sem="">All</button>${sems.map(s => `<button class="chip" data-sem="${esc(s)}">${esc(s)}</button>`).join("")}</div>`}
    <div class="subjects" id="sublist">${subs.map(subjRow).join("") || `<div class="empty">${studentMode() ? "Aapke branch aur semester ke subjects abhi nahi hain." : "Subjects will appear here."}</div>`}</div></section>
  <section class="sec"><div class="sec-h"><h2>Study Material</h2><a href="/search">View all</a></div>${docGrid(visibleDocs(documents).slice(0, 12), "Study material will appear here soon.")}</section>`;
  $("#hs").onclick = () => go("/search?focus=1");
  // subjects: for a student only their own branch and semester are on this page; admins and visitors can pick a semester
  let semPick = "";
  const drawSubs = () => {
    const pick = subs.filter(s => !semPick || semLabel(s.semester) === semPick);
    $("#sublist").innerHTML = pick.map(subjRow).join("") || `<div class="empty">${studentMode() ? "Aapke branch aur semester ke subjects abhi nahi hain." : "Is semester ke subjects abhi nahi hain."}</div>`;
  };
  $$("#semchips .chip").forEach(b => b.onclick = () => {
    $$("#semchips .chip").forEach(x => x.classList.toggle("on", x === b));
    semPick = b.dataset.sem; drawSubs();
  });
});
route(/^\/search$/, async (el) => {
  const qs = new URLSearchParams(location.search);
  let q = qs.get("q") || "", category = qs.get("category") || "", access = qs.get("access") || "";
  el.innerHTML = `<h1 class="sr-only" style="position:absolute;left:-9999px">Search</h1>
    <label class="f" style="margin-bottom:10px"><span class="sr-only" style="position:absolute;left:-9999px">Search</span>
    <div style="position:relative"><span style="position:absolute;left:12px;top:12px;color:var(--muted)">${ic("search")}</span>
    <input class="inp" id="q" type="search" placeholder="Search notes, subjects, codes (e.g. BT-104)…" value="${esc(q)}" style="padding-left:42px" autocomplete="off"></div></label>
    <div class="chips" id="cchips"><button class="chip ${!category ? "on" : ""}" data-c="">All</button>${S.boot.categories.map(c => `<button class="chip ${category === c.id ? "on" : ""}" data-c="${c.id}">${esc(c.name)}</button>`).join("")}</div>
    <div class="chips" id="achips"><button class="chip ${!access ? "on" : ""}" data-a="">All study material</button></div>
    <div class="sec-h"><h2 id="cnt">Documents</h2></div><div id="res"><div class="loading-page"><div class="spinner"></div></div></div>`;
  const run = async () => {
    const p = new URLSearchParams(); if (q) p.set("q", q); if (category) p.set("category", category); if (access) p.set("access", access);
    history.replaceState(null, "", "/search" + (p.toString() ? "?" + p : ""));
    const { documents } = await api("/documents?" + p);
    $("#cnt").textContent = `Documents (${documents.length})`;
    $("#res").innerHTML = docGrid(documents);
  };
  let t; $("#q").oninput = e => { q = e.target.value.trim(); clearTimeout(t); t = setTimeout(run, 250); };
  $$("#cchips .chip").forEach(b => b.onclick = () => { category = b.dataset.c; $$("#cchips .chip").forEach(x => x.classList.toggle("on", x === b)); run(); });
  $$("#achips .chip").forEach(b => b.onclick = () => { access = b.dataset.a; $$("#achips .chip").forEach(x => x.classList.toggle("on", x === b)); run(); });
  if (qs.get("focus")) setTimeout(() => $("#q").focus(), 50);
  await run();
});

route(/^\/subject\/([\w-]+)(?:\/unit\/([\w-]+))?$/, async (el, id, uid) => {
  const s = subj(id); if (!s) return notFound(el); if (!visibleTo(s)) return studyMismatch(el);
  const units = S.boot.units.filter(u => u.subject_id === id);
  const one = uid ? units.find(u => u.id === uid) : null; if (uid && !one) return notFound(el);
  const { documents } = await api("/documents?subject=" + id);
  const groups = units.map(u => [u, documents.filter(d => d.unit_id === u.id)]).filter(g => g[1].length);
  const loose = documents.filter(d => !d.unit_id || !units.find(u => u.id === d.unit_id));
  const uurl = u => `/subject/${s.id}/unit/${u.id}`;
  const meta = u => setMeta(u ? "unit" : "subject", { subject: s, unit: u, units, docs: u ? documents.filter(d => d.unit_id === u.id) : documents });
  meta(one);
  el.innerHTML = `<div class="crumb"><a href="/">Home</a> › ${one ? `<a href="/subject/${s.id}">${esc(s.name)}</a> › ${esc(one.name)}` : esc(s.name)}</div>
    <div class="card"><div class="subj-head"><div class="em" style="background:${tint(s.color)}">${esc(s.icon || "📘")}</div>
    <div><h1>${esc(s.name)}${one ? ` <span class="h1-unit">· ${esc(one.name)}</span>` : ""}</h1><div class="meta">${esc([s.code, [s.course, s.year].filter(Boolean).join(" "), s.semester].filter(Boolean).join(" · "))}</div></div></div>
    ${s.description ? `<p class="subj-desc">${esc(s.description)}</p>` : ""}</div>
    ${units.length > 1 ? `<div class="chips mt" id="uchips"><button class="chip ${one ? "" : "on"}" data-u="">All units</button>${units.map(u => `<button class="chip ${one && one.id === u.id ? "on" : ""}" data-u="${u.id}">${esc(u.name)}</button>`).join("")}</div>` : ""}
    <div id="ulist">${groups.map(([u, ds]) => `<div class="ugroup" data-u="${u.id}"${one && one.id !== u.id ? ' style="display:none"' : ""}><div class="unit-h">${ic("layers", "sm")}<a href="${uurl(u)}">${esc(u.name)}</a><span class="n">${ds.length}</span></div>${docGrid(ds)}</div>`).join("")}
    ${loose.length ? `<div class="ugroup" data-u="_"${one ? ' style="display:none"' : ""}><div class="unit-h">${groups.length ? "Other Documents" : "Documents"}<span class="n">${loose.length}</span></div>${docGrid(loose)}</div>` : ""}
    ${!documents.length || (one && !groups.find(g => g[0].id === one.id)) ? `<div class="mt">${docGrid([], one ? "No documents yet for this unit." : "No documents yet for this subject.")}</div>` : ""}</div>`;
  $$("#uchips .chip").forEach(b => b.onclick = () => { $$("#uchips .chip").forEach(x => x.classList.toggle("on", x === b)); $$(".ugroup").forEach(g => g.style.display = !b.dataset.u || g.dataset.u === b.dataset.u ? "" : "none");
    const u = units.find(x => x.id === b.dataset.u); history.replaceState(null, "", u ? uurl(u) : `/subject/${s.id}`); meta(u); });
});

let pdfjsP = null;
const pdfjs = () => pdfjsP || (pdfjsP = import("/vendor/pdf.min.mjs").then(m => { m.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.min.mjs"; return m; }));
route(/^\/document\/([\w-]+)$/, async (el, id) => {
  let data; try { data = await api("/documents/" + id); } catch (e) { return notFound(el); }
  raStop(true);
  if (data.access && (data.access.reason === "study" || data.access.reason === "other_study")) return studyMismatch(el);
  const d = data.document, a = data.access, parts = data.parts || {}, s = subj(d.subject_id), c = cat(d.category_id), u = unit(d.unit_id), prem = false;
  setMeta("document", { doc: d, subject: s, unit: u && s && u.subject_id === s.id ? u : null, category: c });
  const PART_TABS = [["detailed", "Detailed notes"], ["short", "Short notes"], ["important", "Important Topics + PYQs"]];
  const gate = a.reason === "login" || a.reason === "premium";
  const hasPart = p => p === "detailed" ? !!d.has_file : !!(parts[p] && (parts[p].has_file || parts[p].has_text));
  const want = new URLSearchParams(location.search).get("part");
  const start = PART_TABS.some(x => x[0] === want) ? want : (hasPart("detailed") || !PART_TABS.some(x => hasPart(x[0])) ? "detailed" : PART_TABS.find(x => hasPart(x[0]))[0]);
  const sr = secureReaderApp();
  const fileUrl = p => p === "detailed" ? `/api/file/${d.id}` : `/api/part/${d.id}/${p}`;
  const lockBox = a.reason === "login"
    ? `<div class="lockbox"><div class="lk">🔒</div><h3>Login to access ${prem ? "premium notes" : "notes"} and PDFs</h3><p>Sign in to view this document.</p><a class="btn" href="/login?returnTo=${encodeURIComponent(location.pathname)}">Login to View PDF</a><p class="small mt">New here? <a href="/register?returnTo=${encodeURIComponent(location.pathname)}">Create a free account</a></p></div>`
    : `<div class="lockbox"><div class="lk">🔒</div><h3>Login required</h3><p>Please sign in to read this document.</p><a class="btn" href="/login?returnTo=${encodeURIComponent(location.pathname)}">Login</a></div>`;
  const comingBox = label => label
    ? `<div class="lockbox"><div class="lk" style="background:var(--indigo-50);color:var(--indigo)">${ic("clock", "lg")}</div><h3>Coming soon</h3><p>${esc(label)} abhi upload nahi hua hai.</p></div>`
    : `<div class="lockbox"><div class="lk" style="background:var(--indigo-50);color:var(--indigo)">${ic("clock", "lg")}</div><h3>Coming soon</h3><p>This document is being uploaded. Please check back shortly.</p></div>`;
  const partBox = p => {
    let box;
    if (gate) box = lockBox;
    else if (!hasPart(p)) box = comingBox(p === "detailed" ? "" : PART_TABS.find(x => x[0] === p)[1]);
    else if (p !== "detailed" && parts[p].has_text && secureReaderApp()) box = `<div class="lockbox"><div class="lk">${ic("shield-check", "lg")}</div><h3>Website par kholo</h3><p>Ye text wala hissa abhi app ke Secure Reader me nahi khulta.</p></div>`;
    else if (p !== "detailed" && parts[p].has_text) box = `${raBar(p, "text")}<div class="textpart nosel" id="pages"><div class="loading-page"><div class="spinner"></div></div></div>`;
    else if (secureReaderApp()) box = `<div class="lockbox sr-box"><div class="lk">${ic("shield-check", "lg")}</div><button class="btn" id="sropen" type="button">${ic("lock", "sm")}Secure Reader me kholo</button><div class="small mt" id="srmsg"></div>${a.can_download ? `<p class="small mt"><a href="${fileUrl(p)}?dl=1">Download PDF</a></p>` : ""}</div>`;
    else box = `${raBar(p, "pdf")}<div class="pdfbar"><span class="pg" id="pg">Loading…</span><span class="sp"></span>
      <button class="btn line sm" id="zo" aria-label="Zoom out">${ic("zoom-out", "sm")}</button><button class="btn line sm" id="zi" aria-label="Zoom in">${ic("zoom-in", "sm")}</button>
      ${a.can_download ? `<a class="btn sm" href="${fileUrl(p)}?dl=1">${ic("download", "sm")}Download</a>` : ""}</div>
    <div class="print-off">Printing is disabled for StudyHPD notes. Notes sirf website/app me padh sakte ho.</div>
    <div class="pdfpages nosel" id="pages"><div class="loading-page"><div class="spinner"></div></div><div class="shield-msg">${ic("lock", "lg")}<b>Content hidden</b><span>Notes wapas dekhne ke liye is page pe aao</span></div></div>`;
    return box;
  };
  const partText = async p => { const k = id + ":" + p; return RA.cache[k] || (RA.cache[k] = (await api(`/part-text/${id}/${p}`)).text); };
  const wireRa = p => {
    const pb = $("#ra-play");
    if (pb) pb.onclick = async () => {
      try {
        let text;
        if (pb.dataset.ra === "text") text = await partText(p);
        else {
          if (!RA.pdf || RA.pdfKey !== id + ":" + p) return raStatus("PDF abhi khul raha hai, ek second…");
          const k = id + ":pdf:" + p; text = RA.cache[k] || (RA.cache[k] = await pdfTextOf(RA.pdf));
          if (text.length < 40) return raStatus("Is PDF me text nahi hai (scanned image hai), isliye Read Aloud nahi chalega.");
        }
        if (!text) return raStatus("Is hisse me text nahi hai.");
        raSpeak(text);
      } catch (e) { raStatus(e.message || "Read Aloud abhi nahi chala"); }
    };
    const sb = $("#ra-stop"); if (sb) sb.onclick = () => raStop();
  };
  const mount = async (p, byTab) => {
    raStop(true); RA.cur = p;
    $$("#ptabs [data-p]").forEach(b => b.classList.toggle("on", b.dataset.p === p));
    if (byTab) history.replaceState(null, "", location.pathname + (p === "detailed" ? "" : "?part=" + p));
    $("#vbox").innerHTML = partBox(p);
    wireRa(p);
    if (gate || !hasPart(p)) return;
    if (p !== "detailed" && parts[p].has_text) { if (!sr) loadText(p); return; }
    if (sr) { const b = $("#sropen"); if (b) { b.onclick = () => openSecureReader(d.id, p); srPrepare(d.id, !byTab && !new URLSearchParams(location.search).has("tap"), p); } return; }
    renderPdf(d.id, !a.can_download, p);
  };
  const loadText = async p => {
    try { const t = await partText(p); const host = $("#pages"); if (host && RA.cur === p) host.innerHTML = t.split(/\n\s*\n/).map(x => `<p>${esc(x.trim()).replace(/\n/g, "<br>")}</p>`).join(""); }
    catch (e) { const host = $("#pages"); if (host) host.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  };
  RA.cur = start;
  el.innerHTML = `<button class="back" data-back>${ic("arrow-left", "sm")}Back</button>
    <div class="doc-title"><h1>${esc(d.title)}</h1><div class="meta">${esc([s && s.name, s && s.code, u && u.name !== d.title ? u.name : ""].filter(Boolean).join(" · "))}</div></div>
    <div class="tagrow"><span class="badge ${prem ? "premium" : "free"}" style="position:static">${prem ? "★ PREMIUM" : "FREE"}</span>${c ? `<span class="pill">${esc(c.name)}</span>` : ""}${d.file_size ? `<span class="pill" style="background:#f1f5f9;color:var(--ink-2)">${fmtSize(d.file_size)}</span>` : ""}</div>
    ${d.description ? `<p class="muted" style="margin-top:-4px">${esc(d.description)}</p>` : ""}
    <div class="ptabs" id="ptabs" role="tablist">${PART_TABS.map(([p, t]) => `<button type="button" role="tab" class="ptab ${p === start ? "on" : ""}" data-p="${p}">${esc(t)}${p !== "detailed" && hasPart(p) ? '<i class="pdot"></i>' : ""}</button>`).join("")}</div>
    <div class="viewer-shell" id="vbox"></div>
    ${s ? `<div class="sec"><div class="sec-h"><h2>More from ${esc(s.name)}</h2><a href="/subject/${s.id}">View subject</a></div><div id="more"></div></div>` : ""}`;
  $$("#ptabs [data-p]").forEach(b => b.onclick = () => mount(b.dataset.p, true));
  if (s) api("/documents?subject=" + s.id).then(r => { const m = $("#more"); if (m) m.innerHTML = docGrid(visibleDocs(r.documents.filter(x => x.id !== d.id)).slice(0, 4), "No other documents yet."); });
  await mount(start, false);
});
// ---- Android Secure Reader (app v1.0.2+) ----
// The app opens the site with ?sr=1 (boot.js keeps it for this tab). Notes then open in the app's native reader
// (FLAG_SECURE), never drawn in Chrome. The site mints a one-time 5-minute token and hands it over with an intent link;
// if Chrome doesn't hand it over (no tap), its fallback brings the user back to this page with ?tap=1. Never drawn in Chrome.
function secureReaderApp() { try { return sessionStorage.getItem("shpd-sr") === "1"; } catch { return false; } }
// The token is minted as soon as the page opens, so a tap on the button opens the reader straight away (Chrome only
// hands a link to an app when it follows a tap). Opening the page from a note card also tries once on its own; if Chrome
// holds that back, it comes back here with ?tap=1 and the button does it.
let srTok = null;
async function srMint(id, part = "detailed") {
  srTok = null;
  try { const r = await api("/reader-token", { method: "POST", body: { doc: id, part } }); srTok = { id: r.doc, part, t: r.token, at: Date.now() }; return srTok; }
  catch (e) { const m = $("#srmsg"); if (m) m.textContent = (e && e.message) || "Secure Reader nahi khula, dobara try karo"; return null; }
}
function srLaunch(tok) {
  const fb = location.origin + "/document/" + encodeURIComponent(tok.id) + "?" + (tok.part && tok.part !== "detailed" ? "part=" + tok.part + "&" : "") + "tap=1";
  srTok = null; // one token, one open
  location.href = "intent://reader?doc=" + encodeURIComponent(tok.id) + "&t=" + tok.t + "#Intent;scheme=studyhpd;package=com.studyhpd.app;S.browser_fallback_url=" + encodeURIComponent(fb) + ";end";
  const m = $("#srmsg"); if (m) m.textContent = "";
  const id = tok.id, part = tok.part; setTimeout(() => { if ($("#sropen")) srMint(id, part); }, 2000);
}
async function srPrepare(id, auto, part = "detailed") { const tok = await srMint(id, part); if (tok && auto && $("#sropen")) srLaunch(tok); }
async function openSecureReader(id, part = "detailed") {
  if (srTok && srTok.id === id && srTok.part === part && Date.now() - srTok.at < 240000) return srLaunch(srTok);
  const tok = await srMint(id, part); if (tok) srLaunch(tok);
}
async function renderPdf(id, protect, part = "detailed") {
  const host = $("#pages"); if (!host) return;
  try {
    const lib = await pdfjs();
    const pdf = await lib.getDocument({ url: part === "detailed" ? "/api/file/" + id : "/api/part/" + id + "/" + part, withCredentials: true, isEvalSupported: false }).promise;
    RA.pdf = pdf; RA.pdfKey = id + ":" + part;
    let scale = 1, gen = 0; const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const draw = async () => {
      const my = ++gen; // a newer draw (zoom tapped again) stops this one, so pages are never drawn twice
      host.innerHTML = '<div class="shield-msg">' + ic("lock", "lg") + '<b>Content hidden</b><span>Notes wapas dekhne ke liye is page pe aao</span></div>'; host.classList.toggle("zoomed", scale > 1); $("#pg").textContent = pdf.numPages + " page" + (pdf.numPages > 1 ? "s" : "");
      const w = host.clientWidth - 20;
      for (let i = 1; i <= pdf.numPages; i++) {
        if (!document.body.contains(host) || my !== gen) return;
        const page = await pdf.getPage(i); if (my !== gen) return; const v0 = page.getViewport({ scale: 1 });
        const vp = page.getViewport({ scale: (w / v0.width) * scale * dpr });
        const cv = document.createElement("canvas"); cv.width = vp.width; cv.height = vp.height; cv.style.width = (vp.width / dpr) + "px";
        cv.oncontextmenu = e => e.preventDefault(); cv.draggable = false;
        host.appendChild(cv); await page.render({ canvasContext: cv.getContext("2d"), viewport: vp }).promise;
      }
    };
    $("#zi").onclick = () => { scale = Math.min(scale + 0.25, 2.5); draw(); };
    $("#zo").onclick = () => { scale = Math.max(scale - 0.25, 0.75); draw(); };
    await draw();
  } catch (e) { host.innerHTML = protect ? `<div class="empty">Could not open this PDF. <a href="${location.pathname}">Try again</a></div>` : `<div class="empty">Could not open this PDF. <a href="/api/file/${id}?dl=1">Download it instead</a></div>`; }
}

// ---- notes viewer protection ----
// A website can't truly block screenshots or screen recording (no browser allows it). These are deterrents:
// no right-click / select / drag / print / save, and the pages blur when the window loses focus or a
// screenshot / print shortcut is pressed (where the browser can see it).
const inViewer = () => !!document.getElementById("pages");
let shieldT = 0;
function shield(on, ms) {
  clearTimeout(shieldT);
  document.body.classList.toggle("shielded", !!on && inViewer());
  if (on && ms) shieldT = setTimeout(() => shield(false), ms);
}
(function protectViewer() {
  const inShell = t => t && t.closest && t.closest(".viewer-shell");
  document.addEventListener("contextmenu", e => { if (inShell(e.target)) e.preventDefault(); });
  document.addEventListener("dragstart", e => { if (inShell(e.target)) e.preventDefault(); });
  document.addEventListener("selectstart", e => { if (inShell(e.target)) e.preventDefault(); });
  document.addEventListener("copy", e => { if (inViewer() && !/^(INPUT|TEXTAREA)$/.test((document.activeElement || {}).tagName || "")) e.preventDefault(); });
  document.addEventListener("keydown", e => {
    if (!inViewer()) return;
    const k = (e.key || "").toLowerCase(), mod = e.ctrlKey || e.metaKey;
    if (mod && (k === "p" || k === "s")) { e.preventDefault(); toast(k === "p" ? "Print band hai — notes sirf yahin padh sakte ho" : "Save band hai"); return; }
    if (k === "printscreen") { shield(true, 2500); return; }
    if (e.metaKey && e.shiftKey) shield(true); // macOS Cmd+Shift+3/4/5, Windows Win+Shift+S
  }, true);
  document.addEventListener("keyup", e => {
    if (!inViewer()) return;
    if ((e.key || "").toLowerCase() === "printscreen") { shield(true, 2500); try { navigator.clipboard && navigator.clipboard.writeText(""); } catch {} toast("Screenshot allowed nahi hai"); }
    else if (e.key === "Meta" || e.key === "Shift") { if (document.hasFocus()) shield(false); }
  }, true);
  window.addEventListener("blur", () => shield(true));
  window.addEventListener("focus", () => shield(false));
  document.addEventListener("visibilitychange", () => shield(document.visibilityState === "hidden"));
  document.addEventListener("pointerdown", () => { if (document.body.classList.contains("shielded") && document.hasFocus()) shield(false); });
  window.addEventListener("beforeprint", () => shield(true));
  window.addEventListener("afterprint", () => shield(false, 0));
})();

route(/^\/(pricing|my-subscription|purchases)$/, async (el) => { go("/", true); });

route(/^\/profile$/, async (el) => {
  if (!S.me) return needLogin();
  const me = S.me;
  el.innerHTML = `<div class="page-h"><div class="ico">${ic("user", "lg")}</div><h1>${esc(me.name || "Profile")}</h1><p>${esc(me.email)}</p></div>
    ${me.role === "admin" ? `<a class="btn block" href="/admin">${ic("layout-dashboard", "sm")}Open Admin Panel</a>` : ""}
    <div class="card mt"><h3 style="margin:0 0 12px">Your details</h3><form id="pf"><div id="pfm"></div>
      <label class="f"><span>Name</span><input class="inp" name="name" value="${esc(me.name)}" autocomplete="name"></label>
      <label class="f"><span>Phone (optional)</span><input class="inp" name="phone" value="${esc(me.phone)}" inputmode="tel" autocomplete="tel"></label>
      <button class="btn" type="submit">Save</button></form></div>
    ${trialCard() ? `<div class="mt">${trialCard()}</div>` : ""}
    <div class="card mt"><h3 style="margin:0 0 12px">${ic("palette", "sm")} Theme</h3>
      <div class="chips" id="themechips">${THEMES.map(([v, t]) => `<button type="button" class="chip ${themeNow() === v ? "on" : ""}" data-theme-set="${v}">${t}</button>`).join("")}</div>
      <p class="small muted">Ye phone aur account dono me yaad rahega.</p></div>
    ${me.role === "admin" ? "" : `<div class="card mt"><h3 style="margin:0 0 12px">${ic("graduation-cap", "sm")} Branch &amp; semester</h3><form id="stdf"><div id="stdm"></div>
      <div class="grid2"><label class="f"><span>Branch</span><select class="inp" name="branch"><option value="">— Not chosen —</option>${BRANCHES.map(b => `<option value="${b}" ${me.branch === b ? "selected" : ""}>${b}</option>`).join("")}</select></label>
      <label class="f"><span>Semester</span><select class="inp" name="semester"><option value="">— Not chosen —</option>${SEM_OPTS.map(([v, t]) => `<option value="${v}" ${String(me.semester || "") === String(v) ? "selected" : ""}>Semester ${v}</option>`).join("")}</select></label></div>
      <p class="small muted">Sirf isi branch aur semester ke notes dikhenge. Badalne par list turant badal jaayegi.</p>
      <button class="btn" type="submit">Save</button></form></div>`}
    <div class="card mt"><h3 style="margin:0 0 12px">Change password</h3><form id="pwf"><div id="pwm"></div>
      <label class="f"><span>Current password</span><input class="inp" type="password" name="current" autocomplete="current-password" required></label>
      <label class="f"><span>New password</span><input class="inp" type="password" name="password" autocomplete="new-password" required minlength="6"></label>
      <button class="btn" type="submit">Update password</button></form></div>
    <div class="row mt2"><button class="btn red" id="lo">${ic("log-out", "sm")}Log out</button></div>`;
  $("#pf").onsubmit = async e => { e.preventDefault(); try { const r = await api("/me", { method: "POST", body: Object.fromEntries(new FormData(e.target)) }); S.me = r.me; $("#pfm").innerHTML = `<div class="formok">Saved</div>`; } catch (er) { $("#pfm").innerHTML = `<div class="formerr">${esc(er.message)}</div>`; } };
  $("#pwf").onsubmit = async e => { e.preventDefault(); try { await api("/me/password", { method: "POST", body: Object.fromEntries(new FormData(e.target)) }); e.target.reset(); $("#pwm").innerHTML = `<div class="formok">Password updated</div>`; } catch (er) { $("#pwm").innerHTML = `<div class="formerr">${esc(er.message)}</div>`; } };
  $$("[data-theme-set]").forEach(b => b.onclick = async () => { await setTheme(b.dataset.themeSet); $$("[data-theme-set]").forEach(x => x.classList.toggle("on", x === b)); });
  if ($("#stdf")) $("#stdf").onsubmit = async e => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
    try { const r = await api("/me/prefs", { method: "POST", body: { branch: f.branch || null, semester: f.semester || null } }); S.me = r.me; S.boot.me = r.me; $("#stdm").innerHTML = `<div class="formok">Saved. Ab notes isi branch aur semester ke dikhenge.</div>`; }
    catch (er) { $("#stdm").innerHTML = `<div class="formerr">${esc(er.message)}</div>`; } };
  $("#lo").onclick = async () => { await api("/auth/logout", { method: "POST" }); await loadBoot(); go("/"); toast("Logged out"); };
});

// ---------- Google sign-in (Google Identity Services) ----------
const authCfg = () => (S.boot && S.boot.auth) || {};
let gisLoad = null;
function loadGis() {
  return gisLoad || (gisLoad = new Promise((res, rej) => {
    const sc = document.createElement("script"); sc.src = "https://accounts.google.com/gsi/client"; sc.async = true; sc.defer = true;
    sc.onload = () => window.google && google.accounts ? res(google) : rej(new Error("Google sign-in did not load"));
    sc.onerror = () => { gisLoad = null; rej(new Error("Could not load Google sign-in. Check your connection.")); };
    document.head.appendChild(sc);
  }));
}
async function mountGoogle(box, { admin = false, onDone, onError }) {
  const cid = authCfg().google_client_id; if (!cid || !box) return;
  box.hidden = false;
  try {
    const g = await loadGis();
    g.accounts.id.initialize({ client_id: cid, ux_mode: "popup", auto_select: false, cancel_on_tap_outside: true, itp_support: true,
      callback: async r => {
        try { const d = await api("/auth/google", { method: "POST", body: { credential: r.credential, admin } }); await loadBoot(); onDone(d); }
        catch (er) { onError(er.message); }
      } });
    const slot = box.querySelector(".gbtn"); slot.innerHTML = "";
    g.accounts.id.renderButton(slot, { type: "standard", theme: "outline", size: "large", text: "continue_with", shape: "pill", logo_alignment: "center", width: Math.max(200, Math.min(slot.clientWidth || 320, 400)) });
  } catch (er) { box.querySelector(".gbtn").innerHTML = `<div class="small muted center">${esc(er.message)}</div>`; }
}
const googleBlock = () => authCfg().google_client_id ? `<div class="gwrap" id="gbox" hidden><div class="gbtn"></div><div class="or"><span>or</span></div></div>` : "";

// ---------- 6-digit email code screen ----------
function codeScreen(card, { email, purpose, cooldown = 60, sent = true, rt = "/", back }) {
  const reset = purpose === "reset";
  const title = { verify: "Verify your email", login: "Check your email", reset: "Reset your password" }[purpose];
  card.innerHTML = `<img class="logo" src="/img/logo.png" alt="">
    <div class="center"><div class="code-ico">${ic("mail", "lg")}</div><h1 style="margin:0;font-size:22px">${title}</h1>
    <p class="muted" style="margin:6px 0 16px">${sent ? "We sent a 6-digit code to" : "Enter the 6-digit code we sent to"}<br><b class="ink">${esc(email)}</b></p></div>
    <form id="cf" novalidate><div id="cm"></div>
      <label class="f"><span>6-digit code</span><input class="inp code-inp" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" maxlength="6" placeholder="••••••" required autofocus></label>
      ${reset ? `<label class="f"><span>New password</span><input class="inp" name="password" type="password" autocomplete="new-password" minlength="6" required></label>
      <label class="f"><span>Confirm new password</span><input class="inp" name="confirm" type="password" autocomplete="new-password" required></label>` : ""}
      <button class="btn block" type="submit">${reset ? "Set new password" : purpose === "login" ? "Log in" : "Verify & continue"}</button></form>
    <p class="center small muted mt" style="margin-bottom:4px">Code is valid for 10 minutes. Check Spam/Promotions if you don't see it.</p>
    <div class="center"><button class="linkbtn" id="rs" type="button"></button></div>
    <p class="center small mt"><a href="#" id="cb">${ic("arrow-left", "sm")} Use a different email</a></p>`;
  const rs = $("#rs", card), inp = $(".code-inp", card), msg = $("#cm", card);
  let left = cooldown, timer;
  const tick = () => { if (left > 0) { rs.disabled = true; rs.textContent = `Resend code in ${left}s`; left--; } else { rs.disabled = false; rs.textContent = "Resend code"; clearInterval(timer); } };
  const startTimer = n => { left = n; clearInterval(timer); tick(); timer = setInterval(tick, 1000); };
  startTimer(cooldown);
  rs.onclick = async () => {
    rs.disabled = true; msg.innerHTML = "";
    try { const d = await api("/auth/code", { method: "POST", body: { email, purpose } }); toast("New code sent"); startTimer(d.cooldown || 60); }
    catch (er) { msg.innerHTML = `<div class="formerr">${esc(er.message)}</div>`; startTimer((er.data && er.data.retry_after) || 0); }
  };
  inp.oninput = () => { inp.value = inp.value.replace(/\D/g, "").slice(0, 6); if (inp.value.length === 6 && !reset) $("#cf", card).requestSubmit(); };
  $("#cb", card).onclick = e => { e.preventDefault(); clearInterval(timer); back(); };
  $("#cf", card).onsubmit = async e => {
    e.preventDefault(); const b = Object.fromEntries(new FormData(e.target)); const btn = e.target.querySelector("button[type=submit]");
    if (b.code.length !== 6) return msg.innerHTML = `<div class="formerr">Enter the 6-digit code from the email</div>`;
    if (reset && b.password !== b.confirm) return msg.innerHTML = `<div class="formerr">Passwords do not match</div>`;
    btn.disabled = true;
    try {
      await api("/auth/verify", { method: "POST", body: { email, purpose, code: b.code, password: b.password } });
      clearInterval(timer); await loadBoot();
      toast(reset ? "Password changed — you're logged in" : purpose === "verify" ? "Email verified — welcome!" : "Logged in"); go(rt, true);
    } catch (er) { msg.innerHTML = `<div class="formerr">${esc(er.message)}</div>`; btn.disabled = false; inp.select(); if (er.data && er.data.expired) startTimer(0); }
  };
}

// quick in-browser temp-mail check for instant feedback (the server checks ~10k domains + the mail server again)
const TEMP_MAIL_MSG = "Temporary/fake email allowed nahi hai. Apna asli Gmail ya college email use karo.";
const TEMP_MAIL_HINTS = ["mailinator", "minutemail", "10minmail", "temp-mail", "tempmail", "tmpmail", "temp-email", "tempemail", "tempinbox", "temp-inbox", "tempail",
  "guerrillamail", "guerillamail", "sharklasers", "grr.la", "yopmail", "throwawaymail", "trashmail", "trash-mail", "dispostable", "disposablemail", "fakeinbox",
  "fakemail", "fake-mail", "emailfake", "emailondeck", "getnada", "maildrop.cc", "mailnesia", "mohmal", "burnermail", "mintemail", "spamgourmet", "emailnator",
  "1secmail", "dropmail", "inboxkitten", "mailpoof", "harakirimail", "spambox", "crazymailing"];
const TEMP_MAIL_DOMAINS = ["yopmail.fr", "yopmail.net", "mail.tm", "mail.gw", "jetable.fr.nf", "nospam.ze.tc", "nomail.xl.cx", "mega.zik.dj", "speed.1s.fr", "courriel.fr.nf",
  "moncourrier.fr.nf", "monemail.fr.nf", "monmail.fr.nf", "guerrillamailblock.com", "pokemail.net", "spam4.me", "mailcatch.com", "mvrht.com", "mvrht.net",
  "dayrep.com", "armyspy.com", "cuvox.de", "einrot.com", "fleckens.hu", "gustr.com", "jourrapide.com", "rhyta.com", "superrito.com", "teleworm.us",
  "mailsac.com", "inboxbear.com", "discard.email", "discardmail.com", "spamex.com", "mytemp.email", "tempr.email", "byom.de",
  "emltmp.com", "tmpeml.com", "tmpbox.net", "moakt.com", "tmail.ws", "linshiyouxiang.net", "bugfoo.com", "kzccv.com", "qiott.com", "wuuvo.com", "fexpost.com", "fexbox.org"];
function looksTempMail(email) {
  const d = String(email).split("@").pop().toLowerCase().replace(/\.+$/, "");
  if (!d) return false;
  const parts = d.split("."); for (let i = 0; i < parts.length - 1; i++) if (TEMP_MAIL_DOMAINS.includes(parts.slice(i).join("."))) return true;
  return TEMP_MAIL_HINTS.some(h => d.includes(h));
}
function authPage(el, mode) {
  const rt = new URLSearchParams(location.search).get("returnTo") || (mode === "admin" ? "/admin" : "/");
  const isReg = mode === "register", isAdmin = mode === "admin";
  if (S.me && (!isAdmin || S.me.role === "admin")) return go(rt, true);
  const codes = !!authCfg().email_codes;
  el.innerHTML = `<div class="auth card" id="acard"><img class="logo" src="/img/logo.png" alt="">
    <div class="center"><h1 style="margin:0;font-size:22px">${isAdmin ? "Admin Access" : isReg ? "Create your account" : "Welcome back"}</h1>
    <p class="muted" style="margin:4px 0 16px">${isAdmin ? "Authorized personnel only" : isReg ? "Sign up to get started" : "Log in to your account"}</p></div>
    <div id="am"></div>${googleBlock()}
    <form id="af">
      ${isReg ? `<label class="f"><span>Full name</span><input class="inp" name="name" autocomplete="name" required></label>` : ""}
      <label class="f"><span>Email</span><input class="inp" name="email" type="email" autocomplete="email" required></label>
      ${isReg ? `<label class="f"><span>Phone (optional)</span><input class="inp" name="phone" inputmode="tel" autocomplete="tel"></label>` : ""}
      <label class="f"><span>Password</span><input class="inp" name="password" type="password" autocomplete="${isReg ? "new-password" : "current-password"}" required ${isReg ? 'minlength="6"' : ""}></label>
      ${isReg ? `<label class="f"><span>Confirm Password</span><input class="inp" name="confirm" type="password" autocomplete="new-password" required></label>` : ""}
      ${!isReg && !isAdmin ? `<div style="text-align:right;margin:-4px 0 12px"><a class="small" href="/forgot-password">Forgot password?</a></div>` : ""}
      <button class="btn block" type="submit">${isAdmin ? "Sign In" : isReg ? "Create account" : "Log in"}</button></form>
    ${!isReg && codes ? `<a class="btn line block mt" href="/login/code${location.search}">${ic("mail", "sm")}Log in with email code</a>` : ""}
    ${isReg && codes ? `<p class="center small muted" style="margin:10px 0 0">We'll email you a 6-digit code to verify your account.</p>` : ""}
    <p class="center small muted mt">${isAdmin ? "Protected area · All actions are logged" : isReg ? `Already have an account? <a href="/login${location.search}">Log in</a>` : `Don't have an account? <a href="/register${location.search}">Create one</a>`}</p>
    ${isAdmin ? "" : `<p class="center small muted legal-note">${isReg ? "By creating an account, you agree to our" : "By continuing, you agree to our"} <a href="/terms">Terms of Service</a> and <a href="/privacy">Privacy Policy</a>.</p>`}</div>`;
  const card = $("#acard"), showErr = m => { const box = $("#am"); if (box) box.innerHTML = `<div class="formerr">${esc(m)}</div>`; };
  mountGoogle($("#gbox"), { admin: isAdmin, onError: showErr, onDone: d => { toast(d.created ? "Account created with Google" : "Logged in with Google"); go(rt, true); } });
  // temp-mail check: instant local check, then the server's full check (blocklist + mail server lookup) when the field is left
  let emailBad = "";
  if (isReg) {
    const ei = $("#af [name=email]"), hint = document.createElement("div"); hint.className = "field-err"; ei.after(hint);
    const setBad = m => { emailBad = m || ""; hint.textContent = emailBad; ei.classList.toggle("bad", !!emailBad); if (!emailBad) { const box = $("#am"); if (box && box.dataset.email) { box.innerHTML = ""; delete box.dataset.email; } } };
    let seq = 0;
    const check = async () => {
      const v = ei.value.trim().toLowerCase(); const my = ++seq;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return setBad("");
      if (looksTempMail(v)) return setBad(TEMP_MAIL_MSG);
      setBad("");
      try { const r = await api("/auth/email-check", { method: "POST", body: { email: v } }); if (my === seq && ei.value.trim().toLowerCase() === v) setBad(r.ok ? "" : r.error); } catch {}
    };
    ei.addEventListener("input", () => { const v = ei.value.trim().toLowerCase(); setBad(v.includes("@") && looksTempMail(v) ? TEMP_MAIL_MSG : ""); });
    ei.addEventListener("change", check); ei.addEventListener("blur", check);
  }
  $("#af").onsubmit = async e => {
    e.preventDefault(); const b = Object.fromEntries(new FormData(e.target)); const btn = e.target.querySelector("button");
    if (isReg && emailBad) { showErr(emailBad); const box = $("#am"); if (box) box.dataset.email = "1"; return; }
    if (isReg && b.password !== b.confirm) return showErr("Passwords do not match");
    if (isAdmin) b.admin = true;
    btn.disabled = true;
    const toCode = d => codeScreen(card, { email: d.email || b.email, purpose: "verify", cooldown: d.cooldown || 60, sent: d.sent !== false, rt, back: () => authPage(el, mode) });
    try {
      const d = await api(isReg ? "/auth/register" : "/auth/login", { method: "POST", body: b });
      if (d.verify) return toCode(d);
      await loadBoot(); toast(isReg ? "Account created" : "Logged in"); go(rt, true);
    } catch (er) {
      if (er.data && er.data.verify_required) { toast(er.message); return toCode(er.data); }
      showErr(er.message); btn.disabled = false;
    }
  };
}
// email-code login (passwordless) and password reset by code
function emailCodeStart(el, purpose) {
  const rt = new URLSearchParams(location.search).get("returnTo") || "/";
  if (purpose === "login" && S.me) return go(rt, true);
  el.innerHTML = `<div class="auth card" id="acard"><img class="logo" src="/img/logo.png" alt="">
    <div class="center"><h1 style="margin:0;font-size:22px">${purpose === "login" ? "Log in with email code" : "Reset password"}</h1>
    <p class="muted" style="margin:4px 0 16px">${purpose === "login" ? "No password needed. We'll email you a 6-digit code." : "Enter your account email. We'll send a 6-digit code to set a new password."}</p></div>
    <form id="ef"><div id="em"></div><label class="f"><span>Email</span><input class="inp" name="email" type="email" autocomplete="email" required></label>
    <button class="btn block" type="submit">Send code</button></form>
    <p class="center small mt"><a href="/login${location.search}">Back to log in</a></p></div>`;
  $("#ef").onsubmit = async e => {
    e.preventDefault(); const email = new FormData(e.target).get("email").trim().toLowerCase(); const btn = e.target.querySelector("button"); btn.disabled = true;
    try { const d = await api("/auth/code", { method: "POST", body: { email, purpose } }); codeScreen($("#acard"), { email, purpose, cooldown: d.cooldown || 60, rt, back: () => emailCodeStart(el, purpose) }); }
    catch (er) {
      if (er.data && er.data.retry_after) return codeScreen($("#acard"), { email, purpose, cooldown: er.data.retry_after, sent: false, rt, back: () => emailCodeStart(el, purpose) });
      $("#em").innerHTML = `<div class="formerr">${esc(er.message)}</div>`; btn.disabled = false;
    }
  };
}
route(/^\/login$/, el => authPage(el, "login"));
route(/^\/login\/code$/, el => authCfg().email_codes ? emailCodeStart(el, "login") : go("/login", true));
route(/^\/register$/, el => authPage(el, "register"));
route(/^\/admin\/login$/, el => authPage(el, "admin"));
route(/^\/forgot-password$/, el => {
  if (authCfg().email_codes) return emailCodeStart(el, "reset");

  const wa = setting("contact_whatsapp") || setting("contact_phone"), em = setting("contact_email");
  el.innerHTML = `<div class="auth card center"><img class="logo" src="/img/logo.png" alt=""><h1 style="margin:0;font-size:22px">Reset password</h1>
    <p class="muted">Message us from the number or email on your account and we'll reset it for you. You'll get a temporary password, then change it from your Profile.</p>
    <div class="list" style="text-align:left">${wa ? `<a class="li" href="https://wa.me/${esc(wa.replace(/\D/g, "").replace(/^(\d{10})$/, "91$1"))}?text=${encodeURIComponent("Hi, please reset my StudyHPD password. My email: ")}" target="_blank" rel="noopener">${ic("message-circle")}<div class="grow"><b>WhatsApp</b><div class="sub">${esc(wa)}</div></div></a>` : ""}
    ${em ? `<a class="li" href="mailto:${esc(em)}?subject=Reset%20my%20StudyHPD%20password">${ic("mail")}<div class="grow"><b>Email</b><div class="sub">${esc(em)}</div></div></a>` : ""}
    ${!wa && !em ? `<a class="li" href="/contact">${ic("message-circle")}<div class="grow"><b>Contact us</b></div></a>` : ""}</div>
    <p class="mt"><a href="/login">Back to log in</a></p></div>`;
});

route(/^\/about$/, el => {
  setMeta("about");
  el.innerHTML = `<div class="page-h"><img src="/img/logo.png" alt="" style="width:72px;height:72px;margin:0 auto 8px;border-radius:18px"><h1>${esc(setting("site_name"))}</h1><p>${esc(setting("about_text"))}</p></div>
    <div class="card prose"><h2 style="margin-top:0;font-size:18px">About ${esc(setting("site_name"))}</h2>${(setting("about_long") || "").split(/\n\s*\n/).map(p => `<p>${esc(p)}</p>`).join("")}</div>
    <div class="card mt"><h2 style="margin-top:0;font-size:18px">How it works</h2><ol class="how"><li>Browse subjects and notes.</li><li>Create a free account or log in.</li><li>Select your branch and semester.</li><li>Read all available notes and PDFs for free.</li></ol></div>
    <div class="cta"><h3>Have a question?</h3><p>We're happy to help.</p><a class="btn white" href="/contact">Get in touch</a></div>`;
});
route(/^\/contact$/, el => {
  setMeta("contact");
  const items = [["contact_whatsapp", "message-circle", "WhatsApp", v => `https://wa.me/${v.replace(/\D/g, "").replace(/^(\d{10})$/, "91$1")}`], ["contact_phone", "phone", "Phone", v => "tel:" + v.replace(/\s/g, "")], ["contact_email", "mail", "Email", v => "mailto:" + v],
    ["social_instagram", "external-link", "Instagram", v => v], ["social_youtube", "external-link", "YouTube", v => v], ["social_telegram", "send", "Telegram", v => v], ["social_facebook", "external-link", "Facebook", v => v]].filter(x => setting(x[0]));
  el.innerHTML = `<div class="page-h"><div class="ico">${ic("message-circle", "lg")}</div><h1>Contact Us</h1><p>Questions about a document or study material? Reach the ${esc(setting("site_name"))} team using any of the channels below.</p></div>
    <div class="card"><h3 style="margin:0 0 12px">Reach us directly</h3>${items.length ? `<div class="list contact-list">${items.map(([k, i, t, h]) => `<a class="li" href="${esc(h(setting(k)))}" target="_blank" rel="noopener">${ic(i)}<div class="grow"><b>${t}</b><div class="sub">${esc(setting(k))}</div></div>${ic("chevron-right", "sm")}</a>`).join("")}</div>` : `<p class="muted">Contact details will be added soon.</p>`}</div>`;
});

// ---------- legal pages (Privacy Policy, Terms) ----------
// Default text below; Admin → Settings → "Legal pages" can replace either one.
// Markup: "## Heading", "- bullet", blank line between paragraphs. {site_name}, {contact}, {updated} are filled in.
const LEGAL_UPDATED = "30 October 2026";
const LEGAL_DEFAULT = {
  privacy: `{site_name} ("we", "us") is a study-material website for B.Tech students. This policy explains, in plain words, what information we collect, why, and what you can ask us to do with it.

## What we collect
- **Account details:** your name, email address, and phone number (optional) when you register.
- **Password:** if you sign up with email and password, we store only a salted hash of it — never the password itself.
- **Google sign-in:** if you choose "Continue with Google", Google shares your basic profile with us: your name, email address and Google account ID. We do not get your Google password, contacts, Drive or any other Google data.
- **Payment details for premium plans:** you pay through your own UPI app. We receive the UTR / transaction reference you enter, the payment screenshot you upload, and the plan and amount. We do not receive or store your UPI PIN, bank account details or card numbers.
- **Online payments (when offered):** if you choose "Pay with UPI / Card (instant)", the payment is handled by Razorpay, a payment gateway, in its own secure window. We receive only the Razorpay order and payment IDs, the amount and whether it succeeded. Your card, UPI or bank details go to Razorpay, not to us, and are covered by Razorpay's own privacy policy.
- **Premium status:** which plan you have and the date your premium access ends.
- **Basic activity records:** for example when you log in, and admin actions such as approving a payment, so we can keep accounts and payments secure.
- **Technical data:** your IP address is used briefly to stop abuse (for example, too many verification-code requests). We do not use it to track you.

## How we use it
- To create and run your account and let you log in.
- To send you emails you ask for: 6-digit verification codes, login codes and password-reset codes.
- To check your UPI payment and turn on premium access. Manual UPI payments are reviewed by hand by the {site_name} admin, who looks at your UTR and screenshot and approves or rejects the request. Online payments through Razorpay turn on premium access automatically once Razorpay confirms them.
- To answer you when you contact us, and to keep the site safe and working.

We do not sell your information, and we do not show ads.

## Who else handles your data
We only share what is needed with the services that run the site:
- **Hosting and storage:** our cloud hosting provider stores the site's database and uploaded files (notes PDFs and payment screenshots).
- **Payments:** Razorpay, only if you pay online through it (see above).
- **Email delivery:** verification and login codes are sent through an email delivery service, which receives your email address and the message so it can deliver it.
- **Google:** only if you use Google sign-in. Google's own privacy policy applies to your Google account.

We may also share information if the law requires it.

## Cookies
We use one essential cookie, called "sid", to keep you logged in. It lasts up to 30 days, or until you log out. We do not use advertising or analytics cookies. When the Google sign-in button is shown, Google's script loads from Google and may use its own cookies under Google's policy.

## How long we keep it
- Account details: while your account is open.
- Payment records (UTR, screenshot, plan, amount): kept as a record of the purchase, even after the premium period ends.
- Verification codes are stored only as a hash and expire after 10 minutes. Login sessions expire after 30 days.

## Your choices and deleting your data
You can see and update your details on your Profile page. To delete your account and its data, or to get a copy of your data, contact us at {contact}. We will delete your account and the data linked to it, except records we must keep by law.

## Security
Passwords and codes are stored as hashes, the site uses HTTPS, and only the admin can see payment proofs. No website can promise perfect security, but we work to protect your information.

## Children
{site_name} is meant for college students. If you are under 18, please use it with a parent's or guardian's permission.

## Changes
If we change this policy, we will update this page and the date below.

## Contact
Questions about this policy or your data: {contact}.

_Last updated: {updated}_`,
  terms: `These terms are the rules for using {site_name}. By creating an account or using the site, you agree to them. If you don't agree, please don't use the site.

## Your account
- Give correct details when you register, and keep your password safe.
- One account is for one person. Don't share your login or your premium access with others.
- You are responsible for what happens under your account.

## Using the study material
- Notes, question banks, papers and other material on {site_name} are for your personal study only.
- Don't copy, re-upload, sell or share premium material outside the site, and don't try to get around download or access limits.
- If you believe something on the site uses your work without permission, contact us and we will look into it.

## Premium plans and payments
- Plan prices and durations are shown on the Pricing page.
- You pay either online through Razorpay (UPI, card and other methods it offers) when that option is shown, or by UPI from your own UPI app and then submit the UTR / transaction reference and a payment screenshot on the site.
- Online payments activate premium access as soon as Razorpay confirms them. Manual UPI payments are checked by hand by the {site_name} admin, and premium access starts once the payment is approved. Either way, access lasts for the plan's duration from that day. If you already have premium time left, the new plan is added on top.
- Plans do not renew automatically. Nothing is charged unless you pay again.
- Payments with a wrong, reused or fake UTR will be rejected, and accounts that misuse payments may be blocked.
- If something went wrong with a payment, or you have a question about a refund, contact us at {contact}.

## Acceptable use
Don't misuse the site: no hacking or attempts to break security, no fake accounts or fake payments, no automated scraping of material, and nothing illegal.

## Ending your account
You can ask us to delete your account at any time. We may suspend or close an account that breaks these terms.

## Disclaimer
We work hard to keep the material accurate and useful, but it is provided "as is" as a study aid. We can't promise it is error-free, complete, or that it matches your exact syllabus, and we can't guarantee exam results. The site may sometimes be unavailable for maintenance or reasons outside our control.

## Limitation of liability
To the extent the law allows, {site_name} is not responsible for indirect losses from using the site, and our total responsibility for any claim is limited to the amount you paid us for the plan in question.

## Privacy
How we handle your information is explained in our [Privacy Policy](/privacy).

## Changes to these terms
We may update these terms. We will change the date below, and continuing to use the site means you accept the updated terms.

## Governing law
These terms are governed by the laws of India, and any dispute will be handled by the courts of India.

## Contact
Questions about these terms: {contact}.

_Last updated: {updated}_`
};
const legalContact = () => {
  const e = setting("contact_email"), w = setting("contact_whatsapp"), ph = setting("contact_phone");
  if (e) return `[${e}](mailto:${e})`;
  if (w) return `WhatsApp [${w}](https://wa.me/${w.replace(/\D/g, "").replace(/^(\d{10})$/, "91$1")})`;
  if (ph) return `[${ph}](tel:${ph.replace(/\s/g, "")})`;
  return "the details on our [Contact](/contact) page";
};
function legalInline(s) {
  return esc(s).replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:|tel:|\/)[^)\s]*)\)/g, (_, t, h) => `<a href="${h}"${/^https?:/.test(h) ? ' target="_blank" rel="noopener"' : ""}>${t}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/(^|\s)_([^_]+)_(?=\s|$)/g, "$1<i>$2</i>");
}
function legalHtml(src) {
  const fill = String(src).replace(/\r/g, "").replace(/\{site_name\}/g, setting("site_name") || "StudyHPD").replace(/\{updated\}/g, LEGAL_UPDATED).replace(/\{contact\}/g, legalContact());
  const out = []; let list = null, para = [];
  const flushP = () => { if (para.length) out.push(`<p>${legalInline(para.join(" "))}</p>`); para = []; };
  const flushL = () => { if (list) out.push(`<ul>${list.map(x => `<li>${legalInline(x)}</li>`).join("")}</ul>`); list = null; };
  for (const raw of fill.split("\n")) {
    const l = raw.trim();
    if (!l) { flushP(); flushL(); continue; }
    const h = l.match(/^#{1,3}\s+(.*)$/);
    if (h) { flushP(); flushL(); out.push(`<h2>${legalInline(h[1])}</h2>`); continue; }
    const b = l.match(/^[-*•]\s+(.*)$/);
    if (b) { flushP(); (list = list || []).push(b[1]); continue; }
    flushL(); para.push(l);
  }
  flushP(); flushL();
  return out.join("\n");
}
function legalPage(el, kind) {
  const isP = kind === "privacy", custom = setting(isP ? "privacy_text" : "terms_text").trim();
  const title = isP ? "Privacy Policy" : "Terms of Service";
  el.innerHTML = `<div class="page-h"><div class="ico">${ic(isP ? "lock" : "file-text", "lg")}</div><h1>${title}</h1><p>${esc(setting("site_name") || "StudyHPD")}</p></div>
    <article class="card prose legal">${legalHtml(custom || LEGAL_DEFAULT[kind])}</article>
    <p class="center small muted mt legal-x"><a href="${isP ? "/terms" : "/privacy"}">${isP ? "Terms of Service" : "Privacy Policy"}</a> · <a href="/contact">Contact</a></p>`;
  setMeta(kind);
}
route(/^\/(privacy|privacy-policy)$/, el => legalPage(el, "privacy"));
route(/^\/(terms|terms-of-service|terms-and-conditions)$/, el => legalPage(el, "terms"));

route(/^\/admin\/setup$/, el => {
  const token = new URLSearchParams(location.hash.slice(1)).get("t") || new URLSearchParams(location.search).get("t") || "";
  el.innerHTML = `<div class="auth card"><img class="logo" src="/img/logo.png" alt=""><div class="center"><h1 style="margin:0;font-size:22px">Set up your admin account</h1><p class="muted" style="margin:4px 0 16px">This one-time link works once. Choose your own email and password.</p></div>
    <form id="sf"><div id="sm"></div><input type="hidden" name="token" value="${esc(token)}">
    <label class="f"><span>Your name</span><input class="inp" name="name" autocomplete="name" required></label>
    <label class="f"><span>Admin email</span><input class="inp" name="email" type="email" autocomplete="email" required></label>
    <label class="f"><span>Password (min 8 characters)</span><input class="inp" name="password" type="password" autocomplete="new-password" required minlength="8"></label>
    <label class="f"><span>Confirm password</span><input class="inp" name="confirm" type="password" autocomplete="new-password" required></label>
    <button class="btn block" type="submit">Create admin account</button></form></div>`;
  $("#sf").onsubmit = async e => {
    e.preventDefault(); const b = Object.fromEntries(new FormData(e.target));
    if (b.password !== b.confirm) return $("#sm").innerHTML = `<div class="formerr">Passwords do not match</div>`;
    try { await api("/admin/setup", { method: "POST", body: b }); history.replaceState(null, "", "/admin"); await loadBoot(); toast("Admin account ready"); go("/admin", true); }
    catch (er) { $("#sm").innerHTML = `<div class="formerr">${esc(er.message)}</div>`; }
  };
});

// ---------- admin ----------
const ADM = [["", "Dashboard", "layout-dashboard"], ["/documents", "Documents", "file-text"], ["/subjects", "Subjects & Units", "book-open"], ["/categories", "Categories", "folder"], ["/users", "Students", "users"], ["/settings", "Settings", "settings"], ["/logs", "Activity Log", "scroll-text"]];
route(/^\/admin(\/[\w-]+)?(\/[\w-]+)?$/, async (el, sec = "", sub = "") => {
  if (!S.me) return go("/admin/login?returnTo=" + encodeURIComponent(location.pathname), true);
  if (S.me.role !== "admin") { el.innerHTML = `<div class="empty">${ic("shield-check", "lg")}<p>Admin only. <a href="/admin/login">Sign in as admin</a></p></div>`; return; }
  const stats = await api("/admin/stats");
  el.innerHTML = `<div class="adm"><nav class="adm-nav" aria-label="Admin">${ADM.map(([h, t, i]) => `<a href="/admin${h}" class="${sec === h || (h === "" && !sec) ? "on" : ""}">${ic(i, "sm")}${t}${h === "/payments" && stats.pending ? `<span class="cnt">${stats.pending}</span>` : ""}</a>`).join("")}<a href="/">${ic("house", "sm")}View site</a></nav><div id="ab"></div></div>`;
  const ab = $("#ab");
  const fn = { "": admDash, "/documents": admDocs, "/subjects": admSubjects, "/categories": admCats, "/users": admUsers, "/settings": admSettings, "/logs": admLogs }[sec || ""];
  if (!fn) return notFound(ab);
  await fn(ab, stats, (sub || "").slice(1));
});
const reload = () => render();
async function refreshBoot() { await loadBoot(); }

function admDash(el, st) {
  el.innerHTML = `<h2>Dashboard</h2><div class="stats">
    <div class="stat"><b>${st.students}</b><span>Students</span></div>
    <div class="stat"><b>${st.documents}</b><span>Documents</span></div><div class="stat"><b>${st.subjects}</b><span>Subjects</span></div>
    <div class="stat"><b style="color:${st.missing_files ? "var(--red)" : "inherit"}">${st.missing_files}</b><span>Docs missing a PDF</span></div></div>
    <div class="row wrapr mt"><a class="btn" href="/admin/documents/new">${ic("upload", "sm")}Upload notes</a><a class="btn line" href="/admin/subjects">${ic("plus", "sm")}Add subject</a></div>
    ${st.missing_files ? `<div class="formerr mt">${st.missing_files} document(s) have no PDF yet — open Documents and upload the file.</div>` : ""}`;
}

async function admPayments(el) {
  const st = new URLSearchParams(location.search).get("status") || "pending";
  const { payments } = await api("/admin/payments" + (st === "all" ? "" : "?status=" + st));
  el.innerHTML = `<div class="adm-h"><h2>Payments</h2></div>
    <div class="chips">${["pending", "approved", "rejected", "all"].map(s => `<a class="chip ${s === st ? "on" : ""}" href="/admin/payments?status=${s}">${s[0].toUpperCase() + s.slice(1)}</a>`).join("")}</div>
    <p class="small muted">Check your UPI app / bank statement for the UTR and amount before approving. Approving activates premium for the plan's months (added on top of any time left). Razorpay payments are approved automatically and show their payment ID.</p>
    ${payments.length ? `<div class="list tbl">${payments.map(p => `<div class="li"><div class="grow"><b>${esc(p.user_name || "")} · ${rupee(p.amount)} · ${esc(p.plan_name)} (${p.months} mo)</b>
      <div class="sub">${esc(p.user_email)}${p.user_phone ? " · " + esc(p.user_phone) : ""}</div>
      <div class="sub">${p.method === "razorpay" ? `<span class="tag rzp">Razorpay</span> <b style="display:inline;user-select:all">${esc(p.gateway_payment_id || "")}</b>` : `UTR <b style="display:inline;user-select:all">${esc(p.utr)}</b>`} · ${fmtDT(p.created_at)}</div>
      ${p.note ? `<div class="sub">Note: ${esc(p.note)}</div>` : ""}${p.decided_at ? `<div class="sub">${esc(p.status)} ${fmtDT(p.decided_at)}</div>` : ""}
      ${p.method === "razorpay" ? "" : p.has_proof ? `<details class="mt"><summary class="small" style="cursor:pointer;color:var(--indigo)">View screenshot</summary><img class="proof" src="/api/admin/payments/${p.id}/proof" alt="Payment screenshot" loading="lazy"></details>` : `<div class="sub">No screenshot</div>`}
      ${p.status === "pending" ? `<div class="btns mt"><button class="btn green sm" data-ap="${p.id}" data-m="${p.months}">${ic("check", "sm")}Approve</button><button class="btn red sm" data-rj="${p.id}">${ic("x", "sm")}Reject</button></div>` : ""}</div>
      <span class="status ${p.status}">${esc(p.status)}</span></div>`).join("")}</div>` : `<div class="empty">No ${st === "all" ? "" : st} payments.</div>`}`;
  $$("[data-ap]").forEach(b => b.onclick = async () => {
    const months = prompt("Activate premium for how many months? (1–120)", b.dataset.m); if (months === null) return;
    try { const r = await api(`/admin/payments/${b.dataset.ap}/approve`, { method: "POST", body: { months } }); toast("Approved · premium till " + fmtDate(r.premium_until)); reload(); } catch (e) { toast(e.message); }
  });
  $$("[data-rj]").forEach(b => b.onclick = async () => {
    const note = prompt("Reason (shown to the student)", "Payment not found for this UTR"); if (note === null) return;
    try { await api(`/admin/payments/${b.dataset.rj}/reject`, { method: "POST", body: { note } }); toast("Rejected"); reload(); } catch (e) { toast(e.message); }
  });
}

async function admDocs(el, st, sub) {
  if (sub) return admDocForm(el, sub === "new" ? null : sub, st);
  const { documents } = await api("/admin/documents");
  const fs = new URLSearchParams(location.search).get("subject") || "";
  const list = documents.filter(d => !fs || d.subject_id === fs);
  el.innerHTML = `<div class="adm-h"><h2>Documents</h2><a class="btn sm" href="/admin/documents/new">${ic("plus", "sm")}Add document</a></div>
    <div class="chips"><a class="chip ${!fs ? "on" : ""}" href="/admin/documents">All</a>${S.boot.subjects.map(s => `<a class="chip ${fs === s.id ? "on" : ""}" href="/admin/documents?subject=${s.id}">${esc(s.code || s.name)}</a>`).join("")}</div>
    ${list.length ? `<div class="list tbl">${list.map(d => { const s = subj(d.subject_id), c = cat(d.category_id), u = unit(d.unit_id); return `<div class="li"><div class="grow"><b>${esc(d.title)}</b>
      <div class="sub">${esc([s && s.name, u && u.name, c && c.name].filter(Boolean).join(" · "))}</div>
      <div><span class="tag ${d.access_level}">${d.access_level === "free" ? "free for students" : "premium"}</span>${d.has_file ? `<span class="tag">PDF ${fmtSize(d.file_size)}</span>` : `<span class="tag warn">No file — upload</span>`}${["short", "important"].map(p => `<span class="tag ${d.parts && d.parts[p] && (d.parts[p].has_file || d.parts[p].has_text) ? "" : "warn"}">${p === "short" ? "Short" : "Imp+PYQ"}: ${d.parts && d.parts[p] && (d.parts[p].has_file || d.parts[p].has_text) ? "yes" : "coming soon"}</span>`).join("")}${d.download_allowed ? `<span class="tag">download on</span>` : ""}${d.status === "draft" ? `<span class="tag warn">draft</span>` : ""}<span class="tag">${d.views || 0} views</span></div></div>
      <div class="btns"><a class="btn line sm" href="/admin/documents/${d.id}">${ic("pencil", "sm")}Edit</a></div></div>`; }).join("")}</div>` : `<div class="empty">No documents yet.</div>`}`;
}
// Big phone photos as covers made every page heavy (one 1254px PNG cover was 1 MB on the home page).
// Covers are shrunk in the browser to at most 800px JPEG before upload; anything the browser can't read is sent as it is.
async function shrinkCover(file) {
  if (!file || !file.size || !/^image\/(png|jpeg|webp)$/.test(file.type) || file.size < 150e3) return file;
  try {
    const bmp = await createImageBitmap(file); const k = Math.min(1, 800 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, "image/jpeg", 0.85));
    return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
  } catch { return file; }
}
async function admDocForm(el, id, st = {}) {
  const maxMb = st.max_upload_mb || 95;
  let d = { title: "", description: "", subject_id: new URLSearchParams(location.search).get("subject") || "", unit_id: "", category_id: "cat_notes", access_level: "free", download_allowed: false, tags: [], status: "published" };
  if (id) { const r = await api("/admin/documents"); d = r.documents.find(x => x.id === id); if (!d) return notFound(el); }
  const unitOpts = sid => `<option value="">— No unit —</option>` + S.boot.units.filter(u => u.subject_id === sid).map(u => `<option value="${u.id}" ${u.id === d.unit_id ? "selected" : ""}>${esc(u.name)}</option>`).join("") + `<option value="__new">+ New unit…</option>`;
  el.innerHTML = `<a class="back" href="/admin/documents">${ic("arrow-left", "sm")}Documents</a><h2>${id ? "Edit document" : "Add document"}</h2>
   <form class="card" id="df"><div id="dm"></div>
    <label class="filebox" id="fb">${ic("upload", "lg")}<div><b id="fn">${d.has_file ? "Replace PDF" : "Choose PDF file"}</b><small>${d.has_file ? esc(d.file_name || "") + " · " + fmtSize(d.file_size) : `PDF up to ${maxMb} MB`}</small></div><input type="file" name="file" accept="application/pdf,.pdf"></label>
    <div class="prog" id="pr" hidden><i></i></div>
    <label class="f"><span>Title *</span><input class="inp" name="title" value="${esc(d.title)}" required placeholder="e.g. Unit 3 – Thermodynamics"></label>
    <label class="f"><span>Description</span><input class="inp" name="description" value="${esc(d.description)}" placeholder="Short and smart notes"></label>
    <div class="grid2"><label class="f"><span>Subject</span><select class="inp" name="subject_id" id="ss"><option value="">— Select —</option>${S.boot.subjects.map(s => `<option value="${s.id}" ${s.id === d.subject_id ? "selected" : ""}>${esc(s.code + " " + s.name)}</option>`).join("")}</select></label>
    <label class="f"><span>Unit</span><select class="inp" name="unit_id" id="us">${unitOpts(d.subject_id)}</select></label></div>
    <label class="f" id="nu" hidden><span>New unit name</span><input class="inp" name="new_unit" placeholder="e.g. Unit 3"></label>
    <div class="grid2"><label class="f"><span>Category</span><select class="inp" name="category_id">${S.boot.categories.map(c => `<option value="${c.id}" ${c.id === d.category_id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label>
    <label class="check" style="align-self:end"><input type="checkbox" name="free_for_users" value="1" ${d.access_level === "free" ? "checked" : ""}> Free for logged-in students <small class="muted">(off = Premium or trial only)</small></label></div>
    <label class="f"><span>Tags (comma separated)</span><input class="inp" name="tags" value="${esc((d.tags || []).join(", "))}" placeholder="unit 1, handwritten"></label>
    <label class="f"><span>Cover image (optional)</span><input class="inp" type="file" name="thumb" accept="image/*"></label>
    <label class="check"><input type="checkbox" name="download_allowed" value="1" ${d.download_allowed ? "checked" : ""}> Allow students to download the PDF</label>
    <label class="check"><input type="checkbox" name="draft" ${d.status === "draft" ? "checked" : ""}> Save as draft (hidden from students)</label>
    <div class="row wrapr"><button class="btn" type="submit">${ic("check", "sm")}${id ? "Save changes" : "Publish"}</button>${id ? `<a class="btn line" href="/document/${id}">${ic("eye", "sm")}View</a><button class="btn red" type="button" id="del">${ic("trash-2", "sm")}Delete</button>` : ""}</div></form>`;
  $("#ss").onchange = e => { $("#us").innerHTML = unitOpts(e.target.value); $("#nu").hidden = true; };
  $("#us").onchange = e => { $("#nu").hidden = e.target.value !== "__new"; };
  $("#fb input").onchange = e => { const f = e.target.files[0]; if (f) { $("#fn").textContent = f.name; if (!$("[name=title]").value) $("[name=title]").value = f.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " "); } };
  $("#df").onsubmit = async e => {
    e.preventDefault(); const f = e.target, fd = new FormData(f), btn = f.querySelector("button[type=submit]");
    if (fd.get("unit_id") === "__new") fd.set("unit_id", ""); else fd.delete("new_unit");
    fd.set("status", fd.get("draft") ? "draft" : "published"); fd.delete("draft");
    fd.set("access_level", fd.get("free_for_users") ? "free" : "premium"); fd.delete("free_for_users");
    if (!fd.get("download_allowed")) fd.set("download_allowed", "0");
    const pdfFile = fd.get("file");
    if (pdfFile && pdfFile.size > maxMb * 1048576) return $("#dm").innerHTML = `<div class="formerr">This PDF is ${fmtSize(pdfFile.size)}. The most you can upload is ${maxMb} MB — compress the PDF first.</div>`;
    const cover = fd.get("thumb"); if (cover && cover.size) fd.set("thumb", await shrinkCover(cover));
    btn.disabled = true; $("#pr").hidden = false;
    try { const r = await upload(id ? "/admin/documents/" + id : "/admin/documents", fd, p => $("#pr i").style.width = Math.round(p * 100) + "%"); await refreshBoot(); toast("Saved"); go("/admin/documents/" + r.document.id, true); }
    catch (er) { $("#dm").innerHTML = `<div class="formerr">${esc(er.message)}</div>`; btn.disabled = false; $("#pr").hidden = true; }
  };
  if ($("#del")) $("#del").onclick = async () => { if (!confirm("Delete this document and its file?")) return; try { await api("/admin/documents/" + id, { method: "DELETE" }); toast("Deleted"); go("/admin/documents"); } catch (er) { toast(er.message); } };
  if (id) partCards(el, d);
}
// Short notes and Important Topics + PYQs: each gets one PDF or one block of text. Empty parts show "Coming soon" to students.
function partCards(el, d) {
  const PARTS = [["short", "Short notes"], ["important", "Important Topics + PYQs"]];
  const pm = d.parts || {};
  const box = (p, label) => {
    const cur = pm[p] || {};
    const now = cur.has_file ? `PDF: ${esc(cur.file_name || "file")}` : cur.has_text ? "Text saved (students can read it aloud)" : "Nothing yet — students see “Coming soon”";
    return `<div class="card mt" data-part="${p}"><h3 style="margin:0 0 4px">${label}</h3><p class="small muted" style="margin:0 0 10px">${now}</p>
      <form class="partf" data-p="${p}"><div class="pm"></div>
      <label class="filebox">${ic("upload", "lg")}<div><b>Upload a PDF for this part</b><small>Replaces any text in this part</small></div><input type="file" name="file" accept="application/pdf,.pdf"></label>
      <label class="f"><span>…or paste text (for Read Aloud). Replaces any PDF.</span><textarea class="inp" name="text" rows="6" placeholder="Paste the notes text here"></textarea></label>
      <div class="row wrapr"><button class="btn sm" type="submit">${ic("check", "sm")}Save this part</button>${cur.has_file || cur.has_text ? `<button class="btn red sm" type="button" data-clear="${p}">${ic("trash-2", "sm")}Remove</button>` : ""}</div></form></div>`;
  };
  el.insertAdjacentHTML("beforeend", `<h2 class="mt2">Parts of this document</h2><p class="small muted">Detailed notes = the PDF above. Add the other two here.</p>${PARTS.map(([p, l]) => box(p, l)).join("")}`);
  $$(".partf").forEach(f => f.onsubmit = async e => {
    e.preventDefault(); const p = f.dataset.p, fd = new FormData(f), btn = f.querySelector("button[type=submit]");
    const file = fd.get("file"), text = String(fd.get("text") || "").trim();
    if (!(file && file.size) && !text) return f.querySelector(".pm").innerHTML = `<div class="formerr">Choose a PDF or paste some text first</div>`;
    if (file && file.size) fd.delete("text"); else fd.delete("file");
    btn.disabled = true;
    try { await upload(`/admin/documents/${d.id}/parts/${p}`, fd); toast("Part saved"); go("/admin/documents/" + d.id, true); }
    catch (er) { f.querySelector(".pm").innerHTML = `<div class="formerr">${esc(er.message)}</div>`; btn.disabled = false; }
  });
  $$("[data-clear]").forEach(b => b.onclick = async () => { if (!confirm("Remove this part? Its file or text is deleted.")) return; try { await api(`/admin/documents/${d.id}/parts/${b.dataset.clear}`, { method: "DELETE" }); toast("Removed"); go("/admin/documents/" + d.id, true); } catch (er) { toast(er.message); } });
}

async function simpleCrud(el, { table, title, fields, rowView, items }) {
  el.innerHTML = `<div class="adm-h"><h2>${title}</h2><button class="btn sm" id="add">${ic("plus", "sm")}Add</button></div><div id="frm"></div><div class="list tbl">${items.map(it => `<div class="li"><div class="grow">${rowView(it)}</div><div class="btns"><button class="btn line sm" data-ed="${it.id}">${ic("pencil", "sm")}Edit</button><button class="btn red sm" data-dl="${it.id}" aria-label="Delete">${ic("trash-2", "sm")}</button></div></div>`).join("") || `<div class="empty">Nothing yet.</div>`}</div>`;
  const form = it => {
    $("#frm").innerHTML = `<form class="card" id="cf" style="margin-bottom:14px"><div id="cm"></div>${fields.map(([k, label, type, opts]) => type === "check" ? `<label class="check"><input type="checkbox" name="${k}" ${it[k] === undefined ? (k === "popular" ? "" : "checked") : it[k] ? "checked" : ""}> ${label}</label>` :
      type === "select" ? `<label class="f"><span>${label}</span><select class="inp" name="${k}">${opts.map(([v, t]) => `<option value="${esc(v)}" ${String(it[k] || "") === String(v) ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label>` :
      type === "textarea" ? `<label class="f"><span>${label}</span><textarea class="inp" name="${k}">${esc(it[k] == null ? "" : it[k])}</textarea></label>` :
      `<label class="f"><span>${label}</span><input class="inp" name="${k}" type="${type || "text"}" value="${esc(it[k] == null ? "" : it[k])}"></label>`).join("")}
      <div class="row"><button class="btn" type="submit">Save</button><button class="btn line" type="button" id="cc">Cancel</button></div></form>`;
    $("#cc").onclick = () => $("#frm").innerHTML = "";
    $("#cf").onsubmit = async e => { e.preventDefault(); const b = {}; fields.forEach(([k, , type]) => { const inp = e.target.elements[k]; b[k] = type === "check" ? inp.checked : inp.value; });
      try { await api(`/admin/${table}${it.id ? "/" + it.id : ""}`, { method: "POST", body: b }); await refreshBoot(); toast("Saved"); reload(); } catch (er) { $("#cm").innerHTML = `<div class="formerr">${esc(er.message)}</div>`; } };
    $("#frm").scrollIntoView({ behavior: "smooth", block: "start" });
  };
  $("#add").onclick = () => form({});
  $$("[data-ed]").forEach(b => b.onclick = () => form(items.find(x => x.id === b.dataset.ed)));
  $$("[data-dl]").forEach(b => b.onclick = async () => { if (!confirm("Delete this?")) return; try { await api(`/admin/${table}/${b.dataset.dl}`, { method: "DELETE" }); await refreshBoot(); toast("Deleted"); reload(); } catch (e) { toast(e.message); } });
}
async function admSubjects(el) {
  const [{ items: subs }, { items: units }] = await Promise.all([api("/admin/subjects"), api("/admin/units")]);
  await simpleCrud(el, { table: "subjects", title: "Subjects", items: subs,
    fields: [["name", "Subject name *"], ["code", "Subject code (e.g. BT-104)"], ["description", "Description"], ["course", "Course"], ["year", "Year (e.g. 1st Year)"], ["semester", "Semester", "select", [["", "— Select semester —"], ...SEMESTERS.map(s => [s, s])]], ["branch", "Branch (All branches = shown to everyone)", "select", [["", "All branches"], ...BRANCHES.map(b => [b, b])]], ["icon", "Emoji icon"], ["color", "Colour", "color"], ["sort", "Order", "number"], ["visible", "Visible on site", "check"]],
    rowView: s => `<b>${esc(s.icon || "📘")} ${esc(s.name)}</b><div class="sub">${esc([s.code, s.year, s.semester, s.branch].filter(Boolean).join(" · "))}${s.visible ? "" : " · hidden"}</div>
      <div class="mt">${units.filter(u => u.subject_id === s.id).map(u => `<span class="tag">${esc(u.name)} <button data-du="${u.id}" aria-label="Remove unit" style="border:0;background:none;cursor:pointer;padding:0 0 0 2px;color:var(--red)">×</button></span>`).join("")}
      <button class="btn ghost sm" data-au="${s.id}" style="padding:3px 8px;font-size:12px">${ic("plus", "sm")}Unit</button> <a class="small" href="/admin/documents/new?subject=${s.id}">Upload notes</a></div>` });
  $$("[data-au]").forEach(b => b.onclick = async () => { const name = prompt("Unit name (e.g. Unit 3)"); if (!name) return; const n = units.filter(u => u.subject_id === b.dataset.au).length + 1; await api("/admin/units", { method: "POST", body: { subject_id: b.dataset.au, name, sort: n } }); await refreshBoot(); toast("Unit added"); reload(); });
  $$("[data-du]").forEach(b => b.onclick = async () => { if (!confirm("Remove this unit? Its documents stay, without a unit.")) return; await api("/admin/units/" + b.dataset.du, { method: "DELETE" }); await refreshBoot(); reload(); });
}
async function admCats(el) {
  const { items } = await api("/admin/categories");
  const iconOpts = [["crown", "Crown"], ["notebook-pen", "Notebook"], ["circle-help", "Question"], ["file-text", "File"], ["flask-conical", "Flask"], ["book-open", "Book"], ["graduation-cap", "Graduation cap"], ["sparkles", "Sparkles"], ["folder", "Folder"]];
  await simpleCrud(el, { table: "categories", title: "Categories", items, fields: [["name", "Name *"], ["slug", "Slug (url word)"], ["icon", "Icon", "select", iconOpts], ["description", "Description"], ["sort", "Order", "number"], ["visible", "Visible", "check"]],
    rowView: c => `<b>${esc(c.name)}</b><div class="sub">${esc(c.description || "")}${c.visible ? "" : " · hidden"}</div>` });
}
async function admPlans(el) {
  const { items } = await api("/admin/plans");
  items.forEach(p => p.features = JSON.parse(p.features || "[]").join("\n"));
  await simpleCrud(el, { table: "plans", title: "Plans (pricing)", items, fields: [["name", "Plan name *"], ["price", "Price (₹)", "number"], ["duration_months", "Duration (months)", "number"], ["features", "Features (one per line)", "textarea"], ["sort", "Order", "number"], ["popular", "Mark as POPULAR", "check"], ["active", "Active (shown on Pricing)", "check"]],
    rowView: p => `<b>${esc(p.name)} · ${rupee(p.price)} / ${p.duration_months} mo</b><div class="sub">${p.popular ? "POPULAR · " : ""}${p.active ? "active" : "hidden"}</div>` });
}
async function admUsers(el) {
  const q = new URLSearchParams(location.search).get("q") || "";
  const { users } = await api("/admin/users" + (q ? "?q=" + encodeURIComponent(q) : ""));
  // admins (and you) can't be blocked or removed, the server refuses it too
  const can = u => u.role !== "admin" && u.id !== S.me.id;
  el.innerHTML = `<div class="adm-h"><h2>Students</h2><span class="muted small">${users.length}${q ? " found" : ""}</span></div><form id="uq" class="row" style="margin-bottom:12px"><input class="inp" name="q" type="search" value="${esc(q)}" placeholder="Naam, email ya phone se search karo" aria-label="Search students"><button class="btn line" aria-label="Search">${ic("search", "sm")}</button></form>
   ${users.some(can) ? `<div class="bulkbar" id="bulk"><label class="ck"><input type="checkbox" id="uall"> <span id="ucount">Sab select</span></label><span class="grow"></span><button class="btn line sm" id="bblock" disabled>Block</button><button class="btn red sm" id="bremove" disabled>Remove</button></div>` : ""}
   <div class="list tbl">${users.map(u => { const act = u.premium_until > Date.now(); return `<div class="li${u.blocked ? " is-blocked" : ""}">${can(u) ? `<input type="checkbox" class="usel" value="${esc(u.id)}" aria-label="Select ${esc(u.email)}">` : `<span class="usel-sp"></span>`}<div class="grow"><b>${esc(u.name || "—")} ${u.role === "admin" ? '<span class="tag">admin</span>' : ""}${u.blocked ? '<span class="tag blocked">Blocked</span>' : ""}${u.google ? ' <span class="tag">Google</span>' : ""}${u.email_verified === 0 ? ' <span class="tag warn">unverified</span>' : ""}</b><div class="sub">${esc(u.email)}${u.phone ? " · " + esc(u.phone) : ""} · joined ${fmtDate(u.created_at)}</div>
     <div class="sub">${act ? `<span class="status active">${esc(u.plan_name || "Premium")} till ${fmtDate(u.premium_until)}</span>` : u.premium_until ? `<span class="status expired">expired ${fmtDate(u.premium_until)}</span>` : "Free"}</div>
     <div class="btns mt"><button class="btn ghost sm" data-g="${u.id}">+ Premium</button>${act ? `<button class="btn line sm" data-rv="${u.id}">Remove premium</button>` : ""}<button class="btn line sm" data-rp="${u.id}">${ic("key-round", "sm")}Reset password</button>${u.id !== S.me.id ? `<button class="btn line sm" data-ro="${u.id}" data-r="${u.role === "admin" ? "student" : "admin"}">${u.role === "admin" ? "Remove admin" : "Make admin"}</button>` : ""}${can(u) ? `<button class="btn line sm" data-bl="${u.id}" data-on="${u.blocked ? 0 : 1}">${ic(u.blocked ? "circle-check" : "ban", "sm")}${u.blocked ? "Unblock" : "Block"}</button><button class="btn red sm" data-rm="${u.id}">${ic("trash-2", "sm")}Remove</button>` : ""}</div></div></div>`; }).join("") || `<div class="empty">${q ? "Is search se koi student nahi mila." : "No students yet."}</div>`}</div>`;
  $("#uq").onsubmit = e => { e.preventDefault(); go("/admin/users?q=" + encodeURIComponent(e.target.q.value.trim())); };
  const act = async (id, body, msg) => { try { const r = await api("/admin/users/" + id, { method: "POST", body }); if (r.temp_password) alert("Temporary password: " + r.temp_password + "\n\nSend it to the student. They should change it from Profile after logging in."); else toast(msg); reload(); } catch (e) { toast(e.message); } };
  $$("[data-g]").forEach(b => b.onclick = () => { const m = prompt("Give premium for how many months? (1–120)", "1"); if (m) act(b.dataset.g, { action: "grant", months: m, plan_name: "Manual" }, "Premium added"); });
  $$("[data-rv]").forEach(b => b.onclick = () => confirm("Remove premium now?") && act(b.dataset.rv, { action: "revoke" }, "Premium removed"));
  $$("[data-rp]").forEach(b => b.onclick = () => confirm("Reset this student's password to a temporary one?") && act(b.dataset.rp, { action: "reset_password" }));
  $$("[data-ro]").forEach(b => b.onclick = () => confirm(b.dataset.r === "admin" ? "Give this user full admin access?" : "Remove admin access?") && act(b.dataset.ro, { action: "role", role: b.dataset.r }, "Role updated"));
  const byId = id => users.find(u => u.id === id);
  const who = list => list.length === 1 ? `<div class="cf-who"><b>${esc(list[0].name || "—")}</b><div class="sub">${esc(list[0].email)}</div></div>` : `<div class="cf-who"><b>${list.length} students</b><div class="sub">${esc(list.slice(0, 3).map(u => u.email).join(", "))}${list.length > 3 ? " …" : ""}</div></div>`;
  // Hinglish confirm sheet; resolves true only on the red button
  const confirmSheet = ({ title, text, list, note, yes, danger }) => new Promise(res => {
    const close = sheet(title, `<div class="cf"><p class="cf-q">${esc(text)}</p>${who(list)}${note ? `<p class="small muted">${esc(note)}</p>` : ""}<div class="cf-btns"><button class="btn line" id="cfno">Cancel</button><button class="btn ${danger ? "danger" : ""}" id="cfyes">${esc(yes)}</button></div></div>`);
    let done = false; const fin = v => { if (done) return; done = true; close(); res(v); };
    $("#cfno").onclick = () => fin(false); $("#cfyes").onclick = () => fin(true);
    $("#sx").addEventListener("click", () => fin(false)); $("#sbg").addEventListener("click", e => { if (e.target.id === "sbg") fin(false); });
  });
  const REMOVE = { title: "Student remove karein?", text: "Pakka remove karna hai? Ye wapas nahi hoga.", note: "Account, login aur sessions hamesha ke liye delete honge. Payment records hisaab ke liye bache rahenge.", yes: "Haan, remove karo", danger: true };
  const BLOCK = { title: "Student block karein?", text: "Block karne pe ye login nahi kar payega aur abhi ke sessions band ho jayenge. Baad me Unblock kar sakte ho.", yes: "Block karo", danger: true };
  $$("[data-rm]").forEach(b => b.onclick = async () => { if (await confirmSheet({ ...REMOVE, list: [byId(b.dataset.rm)] })) act(b.dataset.rm, { action: "remove" }, "Student remove ho gaya"); });
  $$("[data-bl]").forEach(b => b.onclick = async () => {
    const on = b.dataset.on === "1";
    if (on && !(await confirmSheet({ ...BLOCK, list: [byId(b.dataset.bl)] }))) return;
    act(b.dataset.bl, { action: on ? "block" : "unblock" }, on ? "Student block ho gaya" : "Student unblock ho gaya");
  });
  // bulk select
  const sel = () => $$(".usel:checked").map(c => c.value);
  const sync = () => { const n = sel().length; if (!$("#bulk")) return; $("#ucount").textContent = n ? n + " selected" : "Sab select"; $("#bblock").disabled = $("#bremove").disabled = !n; $("#uall").checked = n && n === $$(".usel").length; };
  $$(".usel").forEach(c => c.onchange = sync);
  if ($("#uall")) $("#uall").onchange = e => { $$(".usel").forEach(c => c.checked = e.target.checked); sync(); };
  const bulk = async (action, spec, msg) => {
    const ids = sel(); if (!ids.length) return;
    if (!(await confirmSheet({ ...spec, list: ids.map(byId) }))) return;
    try { const r = await api("/admin/users/bulk", { method: "POST", body: { action, ids } }); toast(`${r.done} ${msg}${r.skipped ? ` · ${r.skipped} skip` : ""}`); reload(); } catch (e) { toast(e.message); }
  };
  if ($("#bremove")) $("#bremove").onclick = () => bulk("remove", REMOVE, "remove ho gaye");
  if ($("#bblock")) $("#bblock").onclick = () => bulk("block", BLOCK, "block ho gaye");
  sync();
}
async function admSettings(el) {
  const { settings: s } = await api("/admin/settings"); const as = s.auth_status || {};
  const F = (k, label, type = "text", ph = "") => type === "textarea" ? `<label class="f"><span>${label}</span><textarea class="inp" name="${k}" placeholder="${esc(ph)}">${esc(s[k] || "")}</textarea></label>` : `<label class="f"><span>${label}</span><input class="inp" name="${k}" value="${esc(s[k] || "")}" placeholder="${esc(ph)}"></label>`;
  el.innerHTML = `<h2>Settings</h2><form id="stf"><div id="stm"></div>
    <div class="card mt"><h3 style="margin-top:0">Site</h3>${F("site_name", "Site name")}${F("site_tagline", "Tagline")}${F("announcement", "Announcement bar (leave empty to hide)")}${F("about_text", "About — short line")}${F("about_long", "About — full text (blank line between paragraphs)", "textarea")}</div>
    <div class="card mt" id="seoset"><h3 style="margin-top:0">Google Search</h3>
      <p class="small muted" style="margin-top:-4px">Google Search Console → Add property → URL prefix <b>${esc(location.origin)}/</b> → choose <b>HTML tag</b>. Paste the code here (or the whole &lt;meta …&gt; tag), Save, then click Verify in Search Console. Sitemap to submit: <code style="user-select:all;word-break:break-all">${esc(location.origin)}/sitemap.xml</code></p>
      ${s.google_site_verification ? `<div class="statusrow"><span class="pill ok">${ic("circle-check", "sm")}Verification tag is on the site</span></div>` : ""}
      ${F("google_site_verification", "Google verification code", "text", "e.g. AbCdEf123... from content=\"...\"")}</div>
    <div class="card mt" id="authset"><h3 style="margin-top:0">Login & email verification</h3>
      <p class="small muted" style="margin-top:-4px">Both are optional. Leave empty and the site keeps working with plain email + password. Values set in Cloudflare (env/secrets) override these.</p>
      <div class="statusrow"><span class="pill ${as.google_ready ? "ok" : ""}">${ic(as.google_ready ? "circle-check" : "circle-help", "sm")}Google sign-in ${as.google_ready ? "ON" : "OFF"}${as.google_source === "env" ? " (from Cloudflare)" : ""}</span>
      <span class="pill ${as.mail_ready ? "ok" : ""}">${ic(as.mail_ready ? "circle-check" : "circle-help", "sm")}Email codes ${as.mail_ready ? "ON · " + esc(as.mail_provider) : "OFF"}${as.mail_source === "env" ? " (from Cloudflare)" : ""}</span></div>
      ${F("google_client_id", "Google Client ID", "text", "1234567890-abc123.apps.googleusercontent.com")}
      <label class="f"><span>Mail provider</span><select class="inp" name="mail_provider"><option value="">— none —</option>${["brevo", "resend"].map(p => `<option value="${p}" ${s.mail_provider === p ? "selected" : ""}>${p === "brevo" ? "Brevo" : "Resend"}</option>`).join("")}</select></label>
      <label class="f"><span>Mail API key ${s.mail_api_key_set ? '<b class="ok-t">· saved</b>' : ""}</span><input class="inp" name="mail_api_key" type="password" autocomplete="off" placeholder="${s.mail_api_key_set ? "Saved — leave empty to keep it" : "Paste your Brevo / Resend API key"}"></label>
      ${s.mail_api_key_set ? `<label class="check"><input type="checkbox" name="clear_mail_key" value="1"> Remove saved API key</label>` : ""}
      ${F("mail_from", "From (sender)", "text", "StudyHPD <yourgmail@gmail.com>")}
      <p class="small muted">Brevo: use the Gmail you verified as a sender. Resend: use an address on your verified domain. Full steps are in the README.</p>
      <div class="row wrapr"><input class="inp" id="tmto" type="email" placeholder="${esc(S.me.email)}" style="flex:1;min-width:180px"><button class="btn line" type="button" id="tmb">${ic("mail", "sm")}Send test email</button></div><div id="tmm" class="small mt"></div></div>
    <div class="card mt" id="legalset"><h3 style="margin-top:0">Legal pages</h3>
      <p class="small muted" style="margin-top:-4px">Leave a box empty to use the built-in text (shown at <a href="/privacy" target="_blank">/privacy</a> and <a href="/terms" target="_blank">/terms</a>). To edit, tap "Start from current text", change it, then Save. Write "## " for a heading, "- " for a bullet, and leave a blank line between paragraphs. {contact} becomes your contact email (or WhatsApp) from below.</p>
      ${["privacy", "terms"].map(k => `<label class="f"><span>${k === "privacy" ? "Privacy Policy" : "Terms of Service"}${s[k + "_text"] ? ' <b class="ok-t">· custom</b>' : " · built-in"}</span><textarea class="inp legal-ta" name="${k}_text" placeholder="Empty = built-in text">${esc(s[k + "_text"] || "")}</textarea></label>
      <div class="row wrapr" style="margin:-4px 0 12px"><button class="btn line sm" type="button" data-legal="${k}">${ic("file-text", "sm")}Start from current text</button><a class="small" href="/${k}" target="_blank" rel="noopener">View page</a></div>`).join("")}</div>
    <div class="card mt"><h3 style="margin-top:0">Contact & social</h3>${F("contact_whatsapp", "WhatsApp number", "text", "9424xxxxxx")}${F("contact_phone", "Phone")}${F("contact_email", "Email")}${F("social_instagram", "Instagram URL")}${F("social_youtube", "YouTube URL")}${F("social_telegram", "Telegram URL")}${F("social_facebook", "Facebook URL")}</div>
    <div class="row wrapr mt"><button class="btn" type="submit">${ic("check", "sm")}Save settings</button><a class="btn line" href="/api/admin/export" download>${ic("download", "sm")}Download backup (JSON)</a></div></form>`;
  $("#tmb").onclick = async () => { const b = $("#tmb"); b.disabled = true; $("#tmm").textContent = "Sending…";
    try { const d = await api("/admin/test-email", { method: "POST", body: { to: $("#tmto").value } }); $("#tmm").innerHTML = `<span class="ok-t">Sent to ${esc(d.to)}. Check the inbox (and Spam).</span>`; }
    catch (er) { $("#tmm").innerHTML = `<span class="formerr" style="display:block">${esc(er.message)}</span>`; } b.disabled = false; };
  $("#stf").onsubmit = async e => { e.preventDefault(); const fd = new FormData(e.target); if (!(fd.get("upi_qr") || {}).size) fd.delete("upi_qr");
    try { await upload("/admin/settings", fd); await refreshBoot(); shell(); toast("Settings saved"); reload(); } catch (er) { $("#stm").innerHTML = `<div class="formerr">${esc(er.message)}</div>`; } };
}
async function admLogs(el) {
  const { logs } = await api("/admin/logs");
  el.innerHTML = `<h2>Activity Log</h2><div class="list">${logs.map(l => `<div class="li"><div class="grow"><b>${esc(l.action)}</b><div class="sub">${esc(l.detail)}</div><div class="sub">${esc(l.actor)} · ${fmtDT(l.created_at)}</div></div></div>`).join("") || `<div class="empty">No activity yet.</div>`}</div>`;
}

function notFound(el) { setMeta("notfound"); el.innerHTML = `<div class="empty mt2">${ic("file-text", "lg")}<h3>Page not found</h3><p><a href="/">Go home</a></p></div>`; }

// ---------- router ----------
// browser-tab titles for pages Google doesn't index (they used to all show the home page title)
const PRIVATE_TITLES = [[/^\/login\/code$/, "Log in with email code"], [/^\/login$/, "Log in"], [/^\/register$/, "Create account"], [/^\/forgot-password$/, "Reset password"],
  [/^\/profile$/, "My profile"], [/^\/admin\/login$/, "Admin login"], [/^\/admin/, "Admin"]];
async function render() {
  const my = ++seq, el = $("#main"), p = location.pathname.replace(/\/+$/, "") || "/";
  shell();
  setMeta(p === "/" ? "home" : p === "/search" ? "search" : "private", { label: PRIVATE_TITLES.find(([re]) => re.test(p))?.[1] });
  // a student with no branch or semester saved yet: the required step blocks every page until it is done
  if (studyNeeded()) { el.innerHTML = studyGateHtml(); wireStudyGate(el); return; }
  for (const [re, fn] of routes) {
    const m = p.match(re);
    if (m) {
      try { await fn(el, ...m.slice(1)); }
      catch (e) { if (my !== seq) return; if (e.status === 401) { await loadBoot(); return needLogin(); } el.innerHTML = `<div class="formerr mt">${esc(e.message)}</div>`; }
      return;
    }
  }
  notFound(el);
}
function go(url, replace) { if (replace) history.replaceState(null, "", url); else history.pushState(null, "", url); $("#sheet-root").innerHTML = ""; document.body.style.overflow = ""; window.scrollTo(0, 0); render(); }
// Premium free trial: one tap, once per person (the server decides; this only shows the answer)
document.addEventListener("click", async e => {
  const t = e.target.closest && e.target.closest("[data-trial-start]"); if (!t) return;
  e.preventDefault(); t.disabled = true;
  try { const r = await api("/trial/start", { method: "POST" }); S.me = r.me; S.boot.me = r.me; toast("Premium trial shuru ho gaya"); render(); }
  catch (er) { toast(er.message); t.disabled = false; }
});
document.addEventListener("click", e => {
  if (e.target.closest("[data-back]")) { e.preventDefault(); if (history.length > 1) history.back(); else go("/"); return; }
  const a = e.target.closest("a"); if (!a || a.target || a.hasAttribute("download") || e.metaKey || e.ctrlKey || e.shiftKey) return;
  const u = new URL(a.href, location.href); if (u.origin !== location.origin || u.pathname.startsWith("/api/")) return;
  e.preventDefault(); go(u.pathname + u.search + u.hash);
});
window.addEventListener("popstate", render);
// No offline mode / service worker any more. Phones that installed the old one get /sw.js as a kill-switch
// (it wipes its caches and unregisters itself); this also unregisters any leftover registration.
// Caches are deleted first (saved PDFs too), then the registration, so nothing is left even if this runs before the
// kill-switch. A second sweep catches a cache write the old worker was still finishing when the page opened.
const wipeOffline = async () => {
  try { if (window.caches) for (const k of await caches.keys()) await caches.delete(k); } catch {}
  try { if ("serviceWorker" in navigator) for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); } catch {}
};
wipeOffline(); setTimeout(wipeOffline, 6000);
// The app's brand splash (index.html, shown only inside the Android app) goes away as soon as the first page
// has rendered, and after 2.5 s at the latest, so it can never hold the app up.
function hideSplash() {
  const sp = document.getElementById("boot-splash"); if (!sp || hideSplash.done) return; hideSplash.done = true;
  requestAnimationFrame(() => { document.documentElement.classList.add("booted"); setTimeout(() => sp.remove(), 400); });
}
setTimeout(hideSplash, 2500);
(async () => {
  try { await loadBoot(); } catch (e) { $("#main").innerHTML = `<div class="formerr mt">Could not load. Please refresh. (${esc(e.message)})</div>`; hideSplash(); return; }
  render().finally(hideSplash);
})();
