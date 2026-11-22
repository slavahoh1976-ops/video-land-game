'use strict';
// ============================================================================
//  SignalFlow — редактор схем видеосигнала
// ============================================================================
const NS = 'http://www.w3.org/2000/svg';
const $ = s => document.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 10);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const svg = $('#svg'), vp = $('#vp'), stage = $('#stage');
const LY = { f: $('#Lframes'), e: $('#Ledges'), hv: $('#Lhover'), n: $('#Lnodes'), t: $('#Ltexts'), x: $('#Lextra'), o: $('#Lover') };

// ---------- хранилище (try/catch: в некоторых окружениях localStorage недоступен)
const store = {
  get(k, d) { try { const v = localStorage.getItem(STORE_PREFIX + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(STORE_PREFIX + k, typeof v === 'string' ? v : JSON.stringify(v)); return true; } catch (e) { return false; } },
};
const idb = (() => {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => { setTimeout(() => rej(new Error('idb timeout')), 1500); try { const r = indexedDB.open(IDB_NAME, 1); r.onblocked = () => rej(new Error('idb blocked')); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } }));
  return {
    async get(k) { try { const db = await open(); return await new Promise((res) => { const r = db.transaction('kv').objectStore('kv').get(k); r.onsuccess = () => res(r.result); r.onerror = () => res(undefined); }); } catch (e) { return store.get(k); } },
    async set(k, v) { try { const db = await open(); await new Promise((res, rej) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error); }); return true; } catch (e) { return store.set(k, v); } },
  };
})();
// данные соседней программы «Сигнал» (тот же сайт): только чтение, для переноса в «Экран» при первом запуске
async function fromSignal(key) {
  if (PRODUCT === 'signal') return undefined;
  try { const v = localStorage.getItem('sf_' + key); if (v) return JSON.parse(v); } catch (e) { }
  try {
    return await new Promise(res => {
      setTimeout(() => res(undefined), 1500);
      const r = indexedDB.open('signalflow');
      r.onupgradeneeded = () => { try { r.transaction.abort(); } catch (e) { } }; // базы нет — не создаём
      r.onerror = () => res(undefined);
      r.onsuccess = () => { try { const db = r.result, g = db.transaction('kv').objectStore('kv').get(key); g.onsuccess = () => { res(g.result); db.close(); }; g.onerror = () => res(undefined); } catch (e) { res(undefined); } };
    });
  } catch (e) { return undefined; }
}
const cfg = Object.assign({ groupRename: {}, groupOrder: [], groupsExtra: [], hidden: [], builtin: true, grid: true, snap: true, legend: true, labels: true, wire: 'orth', theme: 'light' }, store.get('cfg', {}));
const saveCfg = () => store.set('cfg', cfg);
const favs = new Set(store.get('favs', []));
let customLib = [];
const saveLib = () => idb.set('lib', customLib);
const openCats = new Set(store.get('openCats', ['fav', 'Мои устройства', 'Камеры']));

// ---------- SVG-стили (одни и те же для экрана и экспорта)
const SVG_CSS = `
text{font-family:-apple-system,"Segoe UI",Roboto,Arial,sans-serif}
.n-body{fill:var(--node);stroke:var(--nodeStroke);stroke-width:1}
.n-title{fill:#fff;font-weight:600;font-size:12.5px}
.n-note{font-weight:400;opacity:.92}
.n-sub{fill:#fff;fill-opacity:.85;font-size:10px}
.n-loc{fill:var(--muted);font-size:10px}
.n-ic{fill:none;stroke:#fff;stroke-width:1.3;stroke-linecap:round;stroke-linejoin:round}
.p-t{fill:var(--portText);font-size:10.5px}
.p-c{stroke:var(--node);stroke-width:1.5;transition:r .08s}
.p-c.free{fill:var(--node)!important;stroke:var(--pc);stroke-width:2.2}
.p-h{fill:transparent;cursor:crosshair}
.p-h:hover{fill:var(--pc);fill-opacity:.18}
.node:hover .p-c.free{stroke-width:2.6}
.node{cursor:move}
.node.sel .n-body{stroke:var(--sel);stroke-width:2.5}
.node.hl .n-body{stroke:var(--warn);stroke-width:4}
.e-hit{fill:none;stroke:transparent;stroke-width:12;cursor:pointer}
.e-line{fill:none;stroke-width:2;stroke-linejoin:round}
.edge.warn .e-line{stroke-dasharray:8 4}
.edge.bad .e-line{stroke-dasharray:3 4}
.edge.sel .e-line{stroke-width:4}
.edge:hover .e-line{stroke-width:3.2}
.e-lb{fill:var(--labelBg);stroke:var(--nodeStroke);stroke-width:.5}
.edge.bad .e-lb{fill:var(--bad)}
.edge.bad .e-lt{fill:#fff}
.e-lt{font-size:10px;fill:var(--nodeText);text-anchor:middle;dominant-baseline:central}
.f-body{fill:var(--frameFill);stroke-width:1.5;stroke-dasharray:6 4;pointer-events:none}
.f-head{cursor:move}
.f-t{font-size:13px;font-weight:700;pointer-events:none}
.f-rs{fill:var(--panel);stroke:var(--sel);cursor:nwse-resize;display:none}
.frame.sel .f-rs{display:block}
.frame.sel .f-body{stroke-width:2.5;stroke-dasharray:none}
.txt{cursor:move}
.txt text{fill:var(--nodeText)}
.txt rect{fill:transparent}
.txt.sel rect{stroke:var(--sel);stroke-dasharray:4 3}
.handle{fill:var(--panel);stroke:var(--sel);stroke-width:2;cursor:ew-resize}
.wph{fill:var(--sel);stroke:#fff;stroke-width:1.5;cursor:move}
.wpv{fill:var(--sel);fill-opacity:.28;stroke:var(--sel);stroke-opacity:.6;stroke-width:1;cursor:copy}
.wpv:hover{fill-opacity:.6}
.handle.v{cursor:ns-resize}
.wire-tmp{fill:none;stroke-width:2.5;stroke-dasharray:6 4;pointer-events:none}
.wiring .p-c.ok{stroke:#16a34a;stroke-width:3.5}
.wiring .p-c.wn{stroke:var(--warn);stroke-width:3.5}
.wiring .p-c.no{opacity:.25}
.p-c.target{stroke:#16a34a!important;stroke-width:5!important}
.lg-bg{fill:var(--node);stroke:var(--nodeStroke)}
.lg-t{fill:var(--nodeText);font-size:11px}
.lg-h{fill:var(--nodeText);font-size:12px;font-weight:700}
.n-frame{fill:transparent;stroke:none}
.node.sel .n-frame{stroke:var(--sel);stroke-width:1.5;stroke-dasharray:5 3}
.node.hl .n-frame{stroke:var(--warn);stroke-width:3;stroke-dasharray:none}
.n-plabel{fill:var(--nodeText);font-size:15px}
.n-plabel2{fill:var(--sub,#6b7280);font-size:12px}
.n-stext{font-size:14px}
.picmode .e-line{stroke-width:1.3}
.picmode .edge.sel .e-line{stroke-width:2.6}
.picmode .edge:hover .e-line{stroke-width:2.2}
.picmode .e-lb{stroke:none;fill-opacity:.9}
.picmode .e-lt{font-size:12px}
.hn circle{fill:#2563eb;fill-opacity:.85;cursor:crosshair}
.hn path{stroke:#fff;stroke-width:2;pointer-events:none}
.hn:hover circle{fill-opacity:1}
.hv-zone{fill:transparent}
.guide{stroke:#ec4899;stroke-width:1;stroke-dasharray:4 3;pointer-events:none}
.rsn{fill:var(--panel);stroke:var(--sel);stroke-width:2;cursor:nwse-resize}
.shp{fill:#facc15;stroke:#a16207;stroke-width:1.5;cursor:pointer}
.lod1 .p-t,.lod1 .e-lb,.lod1 .e-lt,.lod1 .n-loc,.lod1 .n-sub{display:none}
.lod2 .p-c,.lod2 .p-h,.lod2 .n-ic{display:none}
.lod2 .n-title{font-size:20px}
.lod2 .e-line{stroke-width:3}
.lod3 text,.lod3 .e-lb,.lod3 .n-img{display:none}
.lod3 .e-line{stroke-width:5;stroke-dasharray:none!important}
.lod3 .e-line{marker-end:none}
`;
const LIGHT = { picLine: '#3f3f46', node: '#ffffff', nodeStroke: '#cbd2dc', nodeText: '#111827', portText: '#374151', muted: '#6b7280', frameFill: 'rgba(37,99,235,.035)', labelBg: '#ffffff', sel: '#2563eb', warn: '#f59e0b', bad: '#ef4444', panel: '#ffffff' };
const cssFor = vars => SVG_CSS.replace(/var\(--(\w+)\)/g, (m, k) => vars[k] || m);
{ const st = document.createElement('style'); st.textContent = SVG_CSS; document.head.appendChild(st); }

// стрелки на концах кабелей, по цвету каждого типа
$('#defs').innerHTML = '<g id="imgDefs"></g>' + ART._defs + TYPE_KEYS.map(k => `<marker id="ar-${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 1L10 5L0 9z" fill="${T[k].c}"/></marker>`).join('');

// ---------- фото устройств: каждое фото один раз в <defs>, на схеме — <use>
function imgId(src) { return 'im' + hash(src).toString(36) + src.length.toString(36); }
function renderImgDefs() {
  const used = new Set(P.nodes.map(n => n.img).filter(Boolean));
  const have = new Set([...document.querySelectorAll('#imgDefs > symbol')].map(s => s.id.slice(4)));
  let add = '';
  for (const id of used) if (!have.has(id) && doc.images[id]) add += imgSymbol(id);
  if (add) $('#imgDefs').insertAdjacentHTML('beforeend', add);
}
function imgSymbol(id) { const im = doc.images[id]; return `<symbol id="img-${id}" viewBox="0 0 ${im.w} ${im.h}" preserveAspectRatio="xMidYMid meet"><image href="${im.src}" width="${im.w}" height="${im.h}"/></symbol>`; }
function putImage(img) { if (!img || !img.src) return null; const id = imgId(img.src); doc.images[id] = { src: img.src, w: img.w, h: img.h }; return id; }
async function readImage(file) {
  const url = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(file); });
  const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
  const s = Math.min(1, 420 / Math.max(im.width, im.height));
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(im.width * s)); c.height = Math.max(1, Math.round(im.height * s));
  c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
  let src = c.toDataURL('image/webp', 0.86); if (!src.startsWith('data:image/webp')) src = c.toDataURL('image/png');
  return { src, w: c.width, h: c.height };
}

// ============================================================================
//  ДОКУМЕНТ
// ============================================================================
const newPage = name => ({ id: uid(), name, nodes: [], edges: [], frames: [], texts: [], view: { x: 40, y: 40, k: 1 } });
const newDoc = () => ({ app: DOC_APP, appVersion: APP_VERSION, v: 1, name: 'Новая схема', author: '', pages: [newPage('Страница 1')], cur: 0, images: {} });
const replacer = (k, v) => (k[0] === '_' ? undefined : v);
const snap = () => { if (doc) doc.appVersion = APP_VERSION; return JSON.stringify(doc, replacer); };

let doc = null, P = null;
let view = { x: 40, y: 40, k: 1 };
const items = new Map();   // id -> {k:'n'|'e'|'f'|'t', o}
const els = new Map();     // id -> svg element
const adj = new Map();     // nodeId -> Set(edge)
const portUse = new Map(); // nodeId:portId -> edge
const sel = new Set();
let undoS = [], redoS = [];
let fileHandle = null, dirtyFile = false;

const devKey = d => ((d.maker || '') + '|' + (d.model || '')).toLowerCase();
const isPic = () => !!(doc && doc.view === 'pic');
// встроенные модели, для которых есть своя версия (с фото), не дублируем
const allLib = () => {
  if (!cfg.builtin) return customLib.concat(BUILTIN_LIB.filter(d => d.cat === 'shape'));
  const mine = new Set(customLib.map(devKey)), hid = new Set(cfg.hidden || []);
  return customLib.concat(BUILTIN_LIB.filter(d => !mine.has(devKey(d)) && !hid.has(d.id)));
};
const libById = id => customLib.find(d => d.id === id) || BUILTIN_LIB.find(d => d.id === id);

function reindex() {
  items.clear(); adj.clear(); portUse.clear();
  for (const n of P.nodes) { items.set(n.id, { k: 'n', o: n }); adj.set(n.id, new Set()); }
  for (const f of P.frames) items.set(f.id, { k: 'f', o: f });
  for (const t of P.texts) items.set(t.id, { k: 't', o: t });
  P.edges = P.edges.filter(e => items.has(e.from.n) && items.has(e.to.n));
  for (const e of P.edges) {
    items.set(e.id, { k: 'e', o: e });
    adj.get(e.from.n).add(e); adj.get(e.to.n).add(e);
    portUse.set(e.from.n + ':' + e.from.p, e); portUse.set(e.to.n + ':' + e.to.p, e);
  }
}
const node = id => { const it = items.get(id); return it && it.k === 'n' ? it.o : null; };
const portOf = (n, pid) => n.ports.find(p => p.id === pid);

// ============================================================================
//  ГЕОМЕТРИЯ УСТРОЙСТВА
// ============================================================================
const HH = 40, RH = 18;
function layout(n) {
  if (n._L) return n._L;
  if (n.shape) {
    const d = SHAPE_DEF[n.shape] || { w: 120, h: 60 }; const w = n.sw || d.w, h = n.sh || d.h;
    return (n._L = { left: [], right: [], w, h, ih: h, pos: {}, pic: 1 });
  }
  if (isPic()) {
    const im = n.img && doc.images[n.img];
    let w, ih;
    if (im) { const ar = im.w / im.h; w = n.pw || Math.round(clamp(ar * 110, 70, 220)); ih = Math.round(w / ar); }
    else { const art = ART[artKey(n.cat)]; const ar = art.w / art.h; w = n.pw || Math.round(clamp(ar * 95, 80, 230)); ih = Math.round(w / ar); }
    return (n._L = { left: [], right: [], w, h: ih + ((cfg.picLabel || 'role') === 'both' ? 42 : 26), ih, pos: {}, pic: 1 });
  }
  const left = [], right = [];
  for (const p of n.ports) ((p.dir === 'in') !== !!n.flip ? left : right).push(p);
  const rows = Math.max(left.length, right.length, 1);
  const ml = a => a.reduce((m, p) => Math.max(m, (p.name || '').length), 0);
  const sub = ((n.maker || '') + ' ' + (n.model || '')).trim();
  let w = Math.max(180, Math.round((ml(left) + ml(right)) * 6 + 54), Math.round(((n.label || '') + (n.note ? ' — ' + n.note : '')).length * 7.2 + 46), Math.round(sub.length * 5.7 + 46));
  w = Math.min(Math.ceil(w / 10) * 10, 420);
  const im = n.img && doc.images[n.img];
  if (im) w = Math.max(w, 200);
  const iw = w - 16, ih = im ? Math.round(Math.min(130, Math.max(28, iw * im.h / im.w))) : 0;
  const top = HH + 6 + (ih ? ih + 8 : 0);
  const h = top + rows * RH + 4 + (n.loc ? 14 : 0);
  const pos = {};
  left.forEach((p, i) => pos[p.id] = { x: 0, y: top + i * RH + RH / 2, d: -1 });
  right.forEach((p, i) => pos[p.id] = { x: w, y: top + i * RH + RH / 2, d: 1 });
  return (n._L = { left, right, w, h, pos, ih, iw });
}
function portPos(ref) {
  const n = node(ref.n); const L = layout(n); const q = L.pos[ref.p] || { x: 0, y: HH, d: -1 };
  return { x: n.x + q.x, y: n.y + q.y, d: q.d };
}

// ============================================================================
//  МАРШРУТИЗАЦИЯ КАБЕЛЕЙ
// ============================================================================
function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
function picOrient(e) {
  const na = node(e.from.n), nb = node(e.to.n), LA = layout(na), LB = layout(nb);
  const A = { id: na.id, x: na.x, y: na.y, w: LA.w, h: LA.h, ih: LA.ih }, B = { id: nb.id, x: nb.x, y: nb.y, w: LB.w, h: LB.h, ih: LB.ih };
  const acx = A.x + A.w / 2, acy = A.y + A.ih / 2, bcx = B.x + B.w / 2, bcy = B.y + B.ih / 2;
  const hgap = B.x > A.x + A.w + 16 ? 1 : (A.x > B.x + B.w + 16 ? -1 : 0);
  const vgap = B.y > A.y + A.h + 16 ? 1 : (A.y > B.y + B.h + 16 ? -1 : 0);
  const horiz = !!hgap && (!vgap || Math.abs(bcx - acx) >= Math.abs(bcy - acy));
  const sa = horiz ? (hgap > 0 ? 'R' : 'L') : vgap ? (vgap > 0 ? 'B' : 'T') : 'R';
  const sb = horiz ? (hgap > 0 ? 'L' : 'R') : vgap ? (vgap > 0 ? 'T' : 'B') : 'R';
  return { A, B, acx, acy, bcx, bcy, hgap, vgap, horiz, sa, sb };
}
// распределяем концы линий по сторонам устройств, чтобы они не сходились в одну точку
function assignAnchors() {
  const groups = new Map();
  const push = (k, it) => { if (!groups.has(k)) groups.set(k, []); groups.get(k).push(it); };
  for (const e of P.edges) {
    const o = picOrient(e); e._anc = {};
    const vert = s => s === 'L' || s === 'R';
    push(o.A.id + o.sa, { e, end: 'a', key: vert(o.sa) ? o.bcy : o.bcx, box: o.A, side: o.sa });
    push(o.B.id + o.sb, { e, end: 'b', key: vert(o.sb) ? o.acy : o.acx, box: o.B, side: o.sb });
  }
  for (const list of groups.values()) {
    list.sort((p, q) => p.key - q.key);
    const n = list.length, side = list[0].side, box = list[0].box;
    const len = (side === 'L' || side === 'R') ? box.ih : box.w;
    const step = Math.min(len / (n + 1), RH);   // точки входов/выходов на картинке — с тем же шагом, что и линии
    list.forEach((it, i) => { it.e._anc[it.end] = (i - (n - 1) / 2) * step; });
  }
}
// маршрут через точки поворота (как в draw.io): прямые углы, проходит через каждую точку
// точки поворота из текущей линии + новая точка на середине участка seg
function canonPts(e) {
  const r = e._r, a = r.a, b = r.b;
  const inner = r.pts.slice(1, -1);   // берём линию такой, какой она нарисована (с учётом раздвижки), — ручки стоят точно на ней
  const c = wpRoute(a, b, inner, true).pts.map(p => ({ x: p.x, y: p.y, f: p.f }));
  return c;
}
// сдвиг участка s канонической линии параллельно себе (как в draw.io); у порта остаётся хвостик
function moveSeg(C0, s, pt) {
  const arr = C0.map(p => ({ ...p }));
  const A = arr[s], B = arr[s + 1], horiz = Math.abs(A.y - B.y) < .5;
  const v = horiz ? Math.round(pt.y / 5) * 5 : Math.round(pt.x / 5) * 5;
  let i = s;
  if (A.f) { arr.splice(i + 1, 0, { x: A.x, y: A.y }); i++; }
  if (arr[i + 1].f) arr.splice(i + 1, 0, { x: arr[i + 1].x, y: arr[i + 1].y });
  if (horiz) { arr[i].y = v; arr[i + 1].y = v; } else { arr[i].x = v; arr[i + 1].x = v; }
  return arr.slice(2, -2).map(p => ({ x: p.x, y: p.y }));
}
function wpFromRoute(e, seg) {
  const r = e._r, pts = r.pts, old = e.wp || [];
  // берём существующие точки поворота; если их нет — углы текущей линии (без «хвостиков» у портов)
  const base = old.length ? old.map(w => ({ ...w })) : pts.slice(1, -1).map(p => ({ x: p.x, y: p.y }));
  const A = pts[seg], B = pts[seg + 1], mid = { x: Math.round((A.x + B.x) / 10) * 5, y: Math.round((A.y + B.y) / 10) * 5 };
  // вставляем перед первой точкой, которая на линии идёт после этого участка
  let ins = base.length;
  for (let j = 0; j < base.length; j++) { const k = pts.findIndex(p => Math.abs(p.x - base[j].x) < .6 && Math.abs(p.y - base[j].y) < .6); if (k > seg) { ins = j; break; } }
  base.splice(ins, 0, mid); base._ins = ins; return base;
}
// убираем точки поворота, через которые линия больше не проходит углом
function cleanWp(e) {
  if (!e.wp) return; const r = route(e), pts = r.pts;
  e.wp = e.wp.filter(w => pts.some((p, i) => i > 0 && i < pts.length - 1 && Math.abs(p.x - w.x) < .6 && Math.abs(p.y - w.y) < .6));
  if (!e.wp.length) delete e.wp;
}
function wpRoute(a, b, wp, keep) {
  const S = 18, dA = a.nx != null ? { x: a.nx, y: a.ny } : { x: a.d, y: 0 }, dB = b.nx != null ? { x: b.nx, y: b.ny } : { x: b.d, y: 0 };
  const sa = { x: a.x + dA.x * S, y: a.y + dA.y * S, f: 1 }, sb = { x: b.x + dB.x * S, y: b.y + dB.y * S, f: 1 };
  // после хвостика у порта линия продолжает своё направление, а в каждой точке поворота — поворачивает
  const pts = [a, sa]; let arr = dA.y === 0 ? 'h' : 'v';
  for (const w of wp) {
    const c = pts[pts.length - 1];
    if (Math.abs(c.x - w.x) > .5 && Math.abs(c.y - w.y) > .5) {
      const hFirst = c.wp ? arr === 'v' : arr === 'h';
      const k = hFirst ? { x: w.x, y: c.y } : { x: c.x, y: w.y }; pts.push(k); arr = hFirst ? 'v' : 'h';
    } else arr = Math.abs(c.y - w.y) <= .5 ? 'h' : 'v';
    pts.push({ x: w.x, y: w.y, wp: 1 });
  }
  const c = pts[pts.length - 1];
  if (Math.abs(c.x - sb.x) > .5 && Math.abs(c.y - sb.y) > .5) pts.push(dB.y === 0 ? { x: sb.x, y: c.y } : { x: c.x, y: sb.y });
  pts.push(sb, b);
  const out = [];   // убираем повторы и точки на одной прямой (хвостики у портов в режиме keep не трогаем)
  a = { ...a, f: 1 }; b = { ...b, f: 1 }; pts[0] = a; pts[pts.length - 1] = b;
  for (const p of pts) {
    const L = out[out.length - 1];
    if (L && Math.abs(L.x - p.x) < .5 && Math.abs(L.y - p.y) < .5) { if (p.f) L.f = 1; continue; }
    const K = out[out.length - 2];
    if (K && L && !(keep && L.f) && ((Math.abs(K.x - L.x) < .5 && Math.abs(L.x - p.x) < .5) || (Math.abs(K.y - L.y) < .5 && Math.abs(L.y - p.y) < .5))) out.pop();
    out.push(p);
  }
  return { pts: out, a, b, wp: 1 };
}
function picRoute(e) {
  const { A, B, acx, acy, bcx, bcy, hgap, vgap, horiz } = picOrient(e);
  const off = k => (e._anc && e._anc[k] != null) ? e._anc[k] : k === 'm' ? ((hash(e.id + k) % 5) - 2) * 6 : 0;
  let a, b, pts, seg;
  if (horiz) {
    a = { x: hgap > 0 ? A.x + A.w : A.x, y: clamp(acy + off('a'), A.y + 3, A.y + A.ih - 3), nx: hgap, ny: 0, d: hgap };
    b = { x: hgap > 0 ? B.x : B.x + B.w, y: clamp(bcy + off('b'), B.y + 3, B.y + B.ih - 3), nx: -hgap, ny: 0, d: -hgap };
    if (!(e.wp && e.wp.length) && Math.abs(a.y - b.y) < 14 && a.y > B.y + 3 && a.y < B.y + B.ih - 3) b.y = a.y;   // почти прямая — делаем прямой
  } else if (vgap) {
    a = { x: clamp(acx + off('a'), A.x + 3, A.x + A.w - 3), y: vgap > 0 ? A.y + A.h : A.y, nx: 0, ny: vgap, d: 0 };
    b = { x: clamp(bcx + off('b'), B.x + 3, B.x + B.w - 3), y: vgap > 0 ? B.y : B.y + B.h, nx: 0, ny: -vgap, d: 0 };
    if (!(e.wp && e.wp.length) && Math.abs(a.x - b.x) < 14 && a.x > B.x + 3 && a.x < B.x + B.w - 3) b.x = a.x;
  } else {
    a = { x: A.x + A.w, y: acy, nx: 1, ny: 0, d: 1 }; b = { x: B.x + B.w, y: bcy, nx: 1, ny: 0, d: 1 };
  }
  if (cfg.wire === 'line') return { pts: [a, b], a, b };
  if (cfg.wire === 'curve') return { pts: [a, b], a, b, curve: true };
  if (e.wp && e.wp.length) return wpRoute(a, b, e.wp);
  if (horiz) { const mx = e.pmx != null ? e.pmx : (a.x + b.x) / 2 + off('m'); pts = [a, { x: mx, y: a.y }, { x: mx, y: b.y }, b]; seg = { k: 'mx', key: 'pmx', i: 1, x: mx, y: (a.y + b.y) / 2 }; }
  else if (vgap) { const my = e.pmy != null ? e.pmy : (a.y + b.y) / 2 + off('m'); pts = [a, { x: a.x, y: my }, { x: b.x, y: my }, b]; seg = { k: 'my', key: 'pmy', i: 1, x: (a.x + b.x) / 2, y: my }; }
  else { const x = e.pmx != null ? e.pmx : Math.max(a.x, b.x) + 30; pts = [a, { x, y: a.y }, { x, y: b.y }, b]; seg = { k: 'mx', key: 'pmx', i: 1, x, y: (a.y + b.y) / 2 }; }
  return { pts, a, b, seg };
}
// сколько участков линии проходит через устройства (кроме касания краёв)
function nodeCross(pts) {
  let n = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const A = pts[i], B = pts[i + 1], x1 = Math.min(A.x, B.x), x2 = Math.max(A.x, B.x), y1 = Math.min(A.y, B.y), y2 = Math.max(A.y, B.y);
    for (const q of P.nodes) { const L = layout(q); if (x2 > q.x + 3 && x1 < q.x + L.w - 3 && y2 > q.y + 3 && y1 < q.y + L.h - 3) n++; }
  }
  return n;
}
// обход: из порта — вбок, затем по свободному горизонтальному «коридору» над/под устройствами
function detour(a, b, ax, bx, pref) {
  const ys = [pref];
  const x1 = Math.min(ax, bx), x2 = Math.max(ax, bx);
  for (const q of P.nodes) { const L = layout(q); if (q.x + L.w < x1 - 4 || q.x > x2 + 4) continue; ys.push(q.y - 22, q.y + L.h + 22); }
  let best = null, bc = Infinity, bd = Infinity;
  for (const my of ys) {
    const pts = [a, { x: ax, y: a.y }, { x: ax, y: my }, { x: bx, y: my }, { x: bx, y: b.y }, b];
    const c = nodeCross(pts), d = Math.abs(my - pref);
    if (c < bc || (c === bc && d < bd)) { bc = c; bd = d; best = { pts, my }; }
    if (c === 0 && d === 0) break;
  }
  return { ...best, cross: bc };
}
function route(e) {
  if (isPic() || node(e.from.n).shape || node(e.to.n).shape) return picRoute(e);
  const a = portPos(e.from), b = portPos(e.to);
  const style = cfg.wire;
  if (style === 'line') return { pts: [a, b], a, b };
  if (style === 'curve') return { pts: [a, b], a, b, curve: true };
  if (e.wp && e.wp.length) return wpRoute(a, b, e.wp);
  const pidx = ref => { const n = node(ref.n), q = layout(n).pos[ref.p]; return q ? Math.round((q.y - HH - 6) / RH) : 0; };
  const oA = 16 + (pidx(e.from) % 6) * RH, oB = 16 + (pidx(e.to) % 6) * RH;   // вертикали у портов — с шагом портов
  const o = 22 + (hash(e.id) % 4) * 5;         // разводим параллельные кабели
  const spread = ((hash(e.id) % 7) - 3) * 5;
  const ax = a.x + a.d * oA, bx = b.x + b.d * oB;
  let pts, seg;
  if (a.d !== b.d) {
    const forward = (b.x - a.x) * a.d > 16;
    if (forward && e.my == null) {
      const mx = e.mx != null ? e.mx : (a.x + b.x) / 2 + spread;
      pts = [a, { x: mx, y: a.y }, { x: mx, y: b.y }, b]; seg = { k: 'mx', i: 1, x: mx, y: (a.y + b.y) / 2 };
    } else {
      let my = e.my;
      if (my == null) {
        const na = node(e.from.n), nb = node(e.to.n);
        const aB = na.y + layout(na).h, bB = nb.y + layout(nb).h;
        if (b.y > aB + 10 && b.y > a.y) my = (aB + nb.y) / 2;
        else if (a.y > bB + 10) my = (bB + na.y) / 2;
        else my = Math.max(aB, bB) + 24 + Math.abs(spread);
      }
      pts = [a, { x: ax, y: a.y }, { x: ax, y: my }, { x: bx, y: my }, { x: bx, y: b.y }, b]; seg = { k: 'my', i: 2, x: (ax + bx) / 2, y: my };
    }
  } else {
    const x = e.mx != null ? e.mx : (a.d > 0 ? Math.max(ax, bx) : Math.min(ax, bx));
    pts = [a, { x, y: a.y }, { x, y: b.y }, b]; seg = { k: 'mx', i: 1, x, y: (a.y + b.y) / 2 };
  }
  // линия идёт сквозь устройство — ищем обход по свободному коридору (если изгиб не задан вручную)
  if (e.mx == null && e.my == null && P.nodes.length <= 1500) {
    const c0 = nodeCross(pts);
    if (c0) { const alt = detour(a, b, ax, bx, (a.y + b.y) / 2); if (alt && alt.cross < c0) { pts = alt.pts; seg = { k: 'my', i: 2, x: (ax + bx) / 2, y: alt.my }; } }
  }
  return { pts, a, b, seg };
}
function pathD(r) {
  const p = r.pts;
  if (r.curve) {
    const ax = r.a.nx ?? r.a.d, ay = r.a.ny ?? 0, bx = r.b.nx ?? r.b.d, by = r.b.ny ?? 0;
    const k = Math.max(40, Math.hypot(r.b.x - r.a.x, r.b.y - r.a.y) * 0.4);
    return `M${r.a.x} ${r.a.y}C${r.a.x + ax * k} ${r.a.y + ay * k} ${r.b.x + bx * k} ${r.b.y + by * k} ${r.b.x} ${r.b.y}`;
  }
  if (p.length === 2) return `M${p[0].x} ${p[0].y}L${p[1].x} ${p[1].y}`;
  let d = `M${p[0].x} ${p[0].y}`;
  for (let i = 1; i < p.length - 1; i++) {
    const A = p[i - 1], B = p[i], C = p[i + 1];
    const r1 = Math.min(6, Math.hypot(B.x - A.x, B.y - A.y) / 2), r2 = Math.min(6, Math.hypot(C.x - B.x, C.y - B.y) / 2);
    const ux = Math.sign(B.x - A.x), uy = Math.sign(B.y - A.y), vx = Math.sign(C.x - B.x), vy = Math.sign(C.y - B.y);
    d += `L${B.x - ux * r1} ${B.y - uy * r1}Q${B.x} ${B.y} ${B.x + vx * r2} ${B.y + vy * r2}`;
  }
  const L = p[p.length - 1]; return d + `L${L.x} ${L.y}`;
}
function labelPt(r) {
  if (r.curve || r.pts.length === 2) return { x: (r.a.x + r.b.x) / 2, y: (r.a.y + r.b.y) / 2 };
  let best = null, bl = -1;
  for (let i = 0; i < r.pts.length - 1; i++) {
    const A = r.pts[i], B = r.pts[i + 1], l = Math.abs(B.x - A.x) + Math.abs(B.y - A.y);
    if (l > bl) { bl = l; best = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 }; }
  }
  return best;
}
function edgeStatus(e) {
  const na = node(e.from.n), nb = node(e.to.n);
  const pa = na && portOf(na, e.from.p), pb = nb && portOf(nb, e.to.p);
  if (!pa || !pb) return [0, 'Порт удалён'];
  return compat(e.type || pa.type, pb.type);
}
function edgeText(e) {
  if (e.caption) return e.caption;
  if (!cfg.labels) return '';
  if (isPic()) { const t = [T[e.type] ? T[e.type].s : '', e.fmt].filter(Boolean).join(' '); return (e._st === 0 && t ? '⚠ ' : '') + t; }
  const parts = [];
  if (e.label) parts.push(e.label);
  parts.push(T[e.type] ? T[e.type].s : e.type);
  if (e.fmt) parts.push(e.fmt);
  if (e.len) parts.push(e.len + ' м');
  return (e._st === 0 ? '⚠ ' : '') + parts.join(' · ');
}

// ============================================================================
//  SVG-ШАБЛОНЫ
// ============================================================================
const lum = hex => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return 1; const v = parseInt(m[1], 16); return ((v >> 16 & 255) * .299 + (v >> 8 & 255) * .587 + (v & 255) * .114) / 255; };
function nodeSVGpic(n) {
  const L = layout(n), w = L.w, ih = L.ih, cat = CATS[n.cat] || CATS.my;
  let s = `<g class="node pic" data-id="${n.id}" transform="translate(${n.x},${n.y})"><rect class="n-frame" x="-4" y="-4" width="${w + 8}" height="${L.h + 8}" rx="4"/>`;
  if (n.shape) {
    const f = n.fill || '#ffffff', st = n.stroke || '#1f2937', fs = n.fs || 14;
    const tf = shapeTf(n, w, ih);
    s += `<g${tf.tr ? ` transform="${tf.tr}"` : ''}>${shapeSVG(n.shape, tf.dw, tf.dh, esc(f), esc(st), n.sp, n.sq)}</g>`;
    if (SHAPE_NOTEXT.has(n.shape)) return s + '</g>';
    const lines = String(n.label || '').split('\n'), tc = n.shape === 'text' ? (n.tcolor || '#111827') : lum(f) < 0.5 ? '#ffffff' : '#111827';
    s += `<text class="n-stext" text-anchor="middle" font-size="${fs}" fill="${tc}">` + lines.map((l, i) => `<tspan x="${w / 2}" y="${ih / 2 + (i - (lines.length - 1) / 2) * fs * 1.2 + fs * 0.35}">${esc(l)}</tspan>`).join('') + '</text>';
    return s + '</g>';
  }
  if (n.img && doc.images[n.img]) s += `<use class="n-img" href="#img-${n.img}" width="${w}" height="${ih}"/>`;
  else s += `<use class="n-img" href="#art-${artKey(n.cat)}" width="${w}" height="${ih}"/>`;
  const pm = cfg.picLabel || 'role', top = (pm === 'id' ? n.label : roleOf(n)) + (n.note ? ' — ' + n.note : '');
  s += `<text class="n-plabel" x="${w / 2}" y="${ih + 18}" text-anchor="middle">${esc(top)}</text>`;
  if (pm === 'both') s += `<text class="n-plabel2" x="${w / 2}" y="${ih + 34}" text-anchor="middle">${esc(n.label)}</text>`;
  return s + '</g>';
}
function nodeSVG(n) {
  if (isPic() || n.shape) return nodeSVGpic(n);
  const L = layout(n), w = L.w, h = L.h;
  const cat = CATS[n.cat] || CATS.my, c = n.color || cat.c;
  const sub = ((n.maker && n.maker !== 'Generic' ? n.maker + ' ' : '') + (n.model || '')).trim();
  let s = `<g class="node" data-id="${n.id}" transform="translate(${n.x},${n.y})">`
    + `<rect class="n-body" width="${w}" height="${h}" rx="6"/>`
    + `<path d="M0 6a6 6 0 0 1 6-6h${w - 12}a6 6 0 0 1 6 6v${HH - 6}h${-w}z" fill="${c}"/>`
    + `<path class="n-ic" transform="translate(8,12)" d="${ICONS[cat.ic] || ICONS.pp}"/>`
    + `<text class="n-title" x="30" y="17">${esc(n.label)}${n.note ? `<tspan class="n-note"> — ${esc(n.note)}</tspan>` : ''}</text>`
    + `<text class="n-sub" x="30" y="31">${esc(sub)}</text>`
    + (L.ih ? `<use class="n-img" href="#img-${n.img}" x="8" y="${HH + 6}" width="${L.iw}" height="${L.ih}"/>` : '');
  for (const p of n.ports) {
    const q = L.pos[p.id]; const col = (T[p.type] || T.sdi3g).c;
    const used = portUse.has(n.id + ':' + p.id);
    const tx = q.d < 0 ? 9 : w - 9, anc = q.d < 0 ? 'start' : 'end';
    s += `<circle class="p-c${used ? '' : ' free'}" data-p="${p.id}" cx="${q.x}" cy="${q.y}" r="5" fill="${col}" style="--pc:${col}"/>`
      + `<text class="p-t" x="${tx}" y="${q.y + 3.5}" text-anchor="${anc}">${p.dir === 'io' ? '⇄ ' : ''}${esc(p.name)}</text>`
      + `<circle class="p-h" data-p="${p.id}" cx="${q.x}" cy="${q.y}" r="10" style="--pc:${col}"/>`;
  }
  if (n.loc) s += `<text class="n-loc" x="8" y="${h - 6}">📍 ${esc(n.loc)}</text>`;
  return s + '</g>';
}
let LANE = 8;   // расстояние между параллельными линиями (задаётся в layoutEdges)
// разводим совпадающие средние участки соседних кабелей по параллельным дорожкам
function separateLanes(edges) {
  // все участки — препятствия; сдвигаем средний участок вместе с примыкающими «хвостами», проверяя и их
  const idx = { v: new Map(), h: new Map() }, B = 4;
  const put = (o, s) => { const k = Math.round(s.c / B); if (!idx[o].has(k)) idx[o].set(k, []); idx[o].get(k).push(s); };
  const segOf = (p1, p2) => Math.abs(p1.x - p2.x) < .5 ? ['v', p1.x, Math.min(p1.y, p2.y), Math.max(p1.y, p2.y)] : Math.abs(p1.y - p2.y) < .5 ? ['h', p1.y, Math.min(p1.x, p2.x), Math.max(p1.x, p2.x)] : null;
  const hit1 = (sg, e) => { if (!sg) return false; const [o, c, lo, hi] = sg; for (let k = Math.round((c - LANE) / B); k <= Math.round((c + LANE) / B); k++) for (const s of idx[o].get(k) || []) { if (s.e === e || Math.abs(s.c - c) >= LANE - 1) continue; if (Math.min(hi, s.hi) - Math.max(lo, s.lo) > 3) return true; } return false; };
  const reg = (sg, e) => { if (sg) put(sg[0], { e, c: sg[1], lo: sg[2], hi: sg[3] }); };
  // устройства — препятствия: средний участок не должен проходить через них (и «за» ними)
  const NC = 160, nidx = new Map();
  for (const n of P.nodes) { const L = layout(n), b = [n.x + 2, n.y + 2, n.x + L.w - 2, n.y + L.h - 2]; for (let gx = Math.floor(b[0] / NC); gx <= Math.floor(b[2] / NC); gx++) for (let gy = Math.floor(b[1] / NC); gy <= Math.floor(b[3] / NC); gy++) { const k = gx + ',' + gy; if (!nidx.has(k)) nidx.set(k, []); nidx.get(k).push(b); } }
  const nodeHit = sg => { if (!sg) return false; const [o, c, lo, hi] = sg; const x1 = o === 'v' ? c : lo, x2 = o === 'v' ? c : hi, y1 = o === 'v' ? lo : c, y2 = o === 'v' ? hi : c;
    for (let gx = Math.floor(x1 / NC); gx <= Math.floor(x2 / NC); gx++) for (let gy = Math.floor(y1 / NC); gy <= Math.floor(y2 / NC); gy++) for (const b of nidx.get(gx + ',' + gy) || []) if (x2 > b[0] && x1 < b[2] && y2 > b[1] && y1 < b[3]) return true;
    return false; };
  const movers = [];
  for (const e of edges) {
    const r = e._r; if (!r) continue;
    // каждый внутренний участок линии можно сдвинуть, чтобы он не лёг на чужую линию (хвостики у портов — на месте);
    // ручные линии (изгибы, сдвинутый участок) раскладываются после автоматических
    if (r.curve || r.pts.length < 4) { for (let i = 0; i < r.pts.length - 1; i++) reg(segOf(r.pts[i], r.pts[i + 1]), e); continue; }
    const manual = !!r.wp || (r.seg && e[r.seg.key || r.seg.k] != null);
    const ms = []; for (let i = 1; i < r.pts.length - 2; i++) ms.push(i);
    for (let i = 0; i < r.pts.length - 1; i++) if (!ms.some(k => i >= k - 1 && i <= k + 1)) reg(segOf(r.pts[i], r.pts[i + 1]), e);
    for (const i of ms) movers.push({ e, r, i, manual: manual ? 1 : 0, main: r.seg && r.seg.i === i ? 1 : 0 });
  }
  const len = m => { const p1 = m.r.pts[m.i], p2 = m.r.pts[m.i + 1]; return Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y); };
  movers.sort((p, q) => (p.manual || 0) - (q.manual || 0) || len(q) - len(p));
  const done = new Set();
  const deltas = [0]; for (let k = 1; k <= 40; k++) deltas.push(k * LANE, -k * LANE);
  for (const m of movers) {
    const P_ = m.r.pts, i = m.i, p1 = P_[i], p2 = P_[i + 1];
    if (!P_[i - 1] || !P_[i + 2] || (Math.abs(p1.x - p2.x) < .5 && Math.abs(p1.y - p2.y) < .5)) continue;
    const vert = Math.abs(p1.x - p2.x) < .5, c0 = vert ? p1.x : p1.y;
    const geo = c => { const q1 = vert ? { x: c, y: p1.y } : { x: p1.x, y: c }, q2 = vert ? { x: c, y: p2.y } : { x: p2.x, y: c }; return [segOf(P_[i - 1], q1), segOf(q1, q2), segOf(q2, P_[i + 2])]; };
    // лучше всего — ни линий, ни устройств; потом — хотя бы без наложения линий; потом — хотя бы не через устройства
    // хвостик у порта должен остаться не короче 10 px и направленным от прибора
    const A0 = P_[0], Z0 = P_[P_.length - 1];
    const dir = q => q.nx != null ? { x: q.nx, y: q.ny } : { x: q.d || 0, y: 0 };
    const stubOk = c => {
      if (i === 1) { const dA = dir(m.r.a || A0); if (vert && dA.x) { if ((c - A0.x) * dA.x < 10) return false; } if (!vert && dA.y) { if ((c - A0.y) * dA.y < 10) return false; } }
      if (i + 1 === P_.length - 2) { const dB = dir(m.r.b || Z0); if (vert && dB.x) { if ((c - Z0.x) * dB.x < 10) return false; } if (!vert && dB.y) { if ((c - Z0.y) * dB.y < 10) return false; } }
      return true;
    };
    let best = null, noNode = null, noEdge = null;
    for (const d of deltas) {
      if (d && !stubOk(c0 + d)) continue;
      const g = geo(c0 + d), eh = hit1(g[1], m.e), nh = g.some(nodeHit);
      if (!eh && !nh) { best = c0 + d; break; }
      if (!nh && noNode == null) noNode = c0 + d;
      if (!eh && noEdge == null) noEdge = c0 + d;
    }
    if (best == null) best = noEdge != null ? noEdge : noNode != null ? noNode : c0;   // наложение линий недопустимо — в первую очередь
    if (vert) { p1.x = p2.x = best; if (m.r.seg && m.main) m.r.seg.x = best; } else { p1.y = p2.y = best; if (m.r.seg && m.main) m.r.seg.y = best; }
    geo(best).forEach(sg => reg(sg, m.e));
  }
}
// подписи: ищем свободное место на своей линии — не поверх других подписей и устройств
const labelW = t => t.length * (isPic() ? 6.6 : 5.6) + 10;
function placeLabels(edges) {
  const CELL = 120, grid = new Map();
  const cells = (x1, y1, x2, y2, f) => { for (let gx = Math.floor(x1 / CELL); gx <= Math.floor(x2 / CELL); gx++) for (let gy = Math.floor(y1 / CELL); gy <= Math.floor(y2 / CELL); gy++) f(gx + ',' + gy); };
  const addBox = b => cells(b[0], b[1], b[2], b[3], k => { if (!grid.has(k)) grid.set(k, []); grid.get(k).push(b); });
  const overlap = b => { let s = 0; const seen = new Set(); cells(b[0], b[1], b[2], b[3], k => { for (const o of grid.get(k) || []) { if (seen.has(o)) continue; seen.add(o); const w = Math.min(b[2], o[2]) - Math.max(b[0], o[0]), h = Math.min(b[3], o[3]) - Math.max(b[1], o[1]); if (w > 0 && h > 0) s += w * h * (o.node ? 2 : 1); } }); return s; };
  for (const n of P.nodes) { const L = layout(n); const b = [n.x - 2, n.y - 2, n.x + L.w + 2, n.y + L.h + 2]; b.node = 1; addBox(b); }
  // участки линий — тоже помехи для подписей (кроме своей линии)
  const sgrid = new Map();
  for (const e of edges) { const r = e._r; if (!r || r.curve) continue; for (let i = 0; i < r.pts.length - 1; i++) { const A = r.pts[i], B = r.pts[i + 1], s = [Math.min(A.x, B.x), Math.min(A.y, B.y), Math.max(A.x, B.x), Math.max(A.y, B.y), e]; cells(s[0], s[1], s[2], s[3], k => { if (!sgrid.has(k)) sgrid.set(k, []); sgrid.get(k).push(s); }); } }
  const lineHits = (b, own) => { let n = 0; const seen = new Set(); cells(b[0], b[1], b[2], b[3], k => { for (const s of sgrid.get(k) || []) { if (s[4] === own || seen.has(s)) continue; seen.add(s); if (s[2] >= b[0] && s[0] <= b[2] && s[3] >= b[1] && s[1] <= b[3]) n++; } }); return n; };
  const order = edges.map(e => ({ e, t: edgeText(e) })).filter(x => x.t).sort((p, q) => q.t.length - p.t.length);
  for (const e of edges) e._lp = null;
  for (const { e, t } of order) {
    const r = e._r, w = labelW(t), h = 16, cands = [];
    if (r.curve) {
      const ax = r.a.nx ?? r.a.d, ay = r.a.ny ?? 0, bx = r.b.nx ?? r.b.d, by = r.b.ny ?? 0, k = Math.max(40, Math.hypot(r.b.x - r.a.x, r.b.y - r.a.y) * 0.4);
      const P0 = r.a, P1 = { x: r.a.x + ax * k, y: r.a.y + ay * k }, P2 = { x: r.b.x + bx * k, y: r.b.y + by * k }, P3 = r.b;
      for (const tt of [0.5, 0.38, 0.62, 0.27, 0.73, 0.18, 0.82]) { const u = 1 - tt; cands.push({ x: u * u * u * P0.x + 3 * u * u * tt * P1.x + 3 * u * tt * tt * P2.x + tt * tt * tt * P3.x, y: u * u * u * P0.y + 3 * u * u * tt * P1.y + 3 * u * tt * tt * P2.y + tt * tt * tt * P3.y }); }
    } else {
      const segs = [];
      for (let i = 0; i < r.pts.length - 1; i++) { const A = r.pts[i], B = r.pts[i + 1]; segs.push({ A, B, len: Math.abs(B.x - A.x) + Math.abs(B.y - A.y) }); }
      segs.sort((p, q) => q.len - p.len);
      for (const s of segs) {
        if (s.len < 14) continue;
        const horiz = Math.abs(s.B.y - s.A.y) < 1, need = horiz ? w + 6 : h + 6;
        const fr = s.len > need ? [0.5, 0.35, 0.65, 0.22, 0.78, 0.12, 0.88] : [0.5];
        for (const f of fr) cands.push({ x: s.A.x + (s.B.x - s.A.x) * f, y: s.A.y + (s.B.y - s.A.y) * f });
      }
      // запасные места — рядом с линией (сбоку от вертикали, над/под горизонталью)
      for (const s of segs.slice(0, 3)) {
        if (s.len < 14) continue;
        const horiz = Math.abs(s.B.y - s.A.y) < 1;
        for (const f of [0.5, 0.3, 0.7]) { const x = s.A.x + (s.B.x - s.A.x) * f, y = s.A.y + (s.B.y - s.A.y) * f;
          if (horiz) cands.push({ x, y: y - 11, side: 1 }, { x, y: y + 11, side: 1 }); else cands.push({ x: x + w / 2 + 5, y, side: 1 }, { x: x - w / 2 - 5, y, side: 1 }); }
      }
      if (!cands.length) cands.push(labelPt(r));
    }
    let best = null, bs = Infinity;
    for (const c of cands) { const b = [c.x - w / 2 - 2, c.y - h / 2 - 1, c.x + w / 2 + 2, c.y + h / 2 + 1]; const s = overlap(b) + lineHits(b, e) * 0.35 + (c.side ? 0.5 : 0); if (s < bs) { bs = s; best = { c, b }; if (s < 0.3) break; } }
    e._lp = best.c; addBox(best.b);
  }
}
// последняя проверка линии: без «отростков», не вдоль корпуса прибора, у порта — хвостик наружу
function tidyPts(e) {
  const r = e._r; if (!r || r.curve || r.pts.length < 3) return;
  const STUB = 14, a = r.a, b = r.b;
  const dir = q => q.nx != null ? { x: q.nx, y: q.ny } : { x: q.d || 0, y: 0 };
  const box = id => { const n = node(id), L = layout(n); return { x1: n.x, y1: n.y, x2: n.x + L.w, y2: n.y + (L.ih || L.h) }; };
  let p = r.pts.map(q => ({ x: q.x, y: q.y }));
  const simplify = () => {
    const out = [];
    for (const q of p) {
      const L = out[out.length - 1]; if (L && Math.abs(L.x - q.x) < .5 && Math.abs(L.y - q.y) < .5) continue;
      const K = out[out.length - 2];
      if (K && L && out.length > 1 && ((Math.abs(K.x - L.x) < .5 && Math.abs(L.x - q.x) < .5) || (Math.abs(K.y - L.y) < .5 && Math.abs(L.y - q.y) < .5))) out.pop();   // прямая или «отросток» туда-обратно
      out.push(q);
    }
    p = out;
  };
  simplify();
  // участки, прижатые к корпусу у порта (между портом и линией хвостика), отодвигаем наружу
  for (const [end, id] of [[a, e.from.n], [b, e.to.n]]) {
    const d = dir(end), B = box(id), hz = d.x !== 0;
    const line = hz ? end.x + d.x * STUB : end.y + d.y * STUB;
    for (let i = 1; i < p.length - 2; i++) {
      const A = p[i], Bp = p[i + 1];
      if (hz && Math.abs(A.x - Bp.x) < .5) {
        const inBand = (A.x - end.x) * d.x < STUB - .5 && (A.x - end.x) * d.x > -(B.x2 - B.x1);
        const lo = Math.min(A.y, Bp.y), hi = Math.max(A.y, Bp.y);
        if (inBand && hi > B.y1 - 6 && lo < B.y2 + 6) { A.x = Bp.x = line; }
      } else if (!hz && Math.abs(A.y - Bp.y) < .5) {
        const inBand = (A.y - end.y) * d.y < STUB - .5 && (A.y - end.y) * d.y > -(B.y2 - B.y1);
        const lo = Math.min(A.x, Bp.x), hi = Math.max(A.x, Bp.x);
        if (inBand && hi > B.x1 - 6 && lo < B.x2 + 6) { A.y = Bp.y = line; }
      }
    }
  }
  simplify();
  // хвостик у порта: первый и последний участки — от прибора, не короче STUB
  const fixEnd = (rev) => {
    if (rev) p.reverse();
    const P0 = p[0], P1 = p[1], d = dir(rev ? b : a);
    const along = d.x ? (P1.x - P0.x) * d.x : (P1.y - P0.y) * d.y, straight = d.x ? Math.abs(P1.y - P0.y) < .5 : Math.abs(P1.x - P0.x) < .5;
    if (!(straight && along >= STUB - .5)) {
      const s = { x: P0.x + d.x * STUB, y: P0.y + d.y * STUB };
      const el = d.x ? { x: s.x, y: P1.y } : { x: P1.x, y: s.y };
      p.splice(1, 0, s, el);
    }
    if (rev) p.reverse();
  };
  fixEnd(false); fixEnd(true); simplify();
  r.pts = p;
}
function layoutEdges() {
  if (isPic()) assignAnchors();
  for (const e of P.edges) { e._st = edgeStatus(e)[0]; e._r = route(e); }
  LANE = RH;   // линии расходятся не меньше, чем на шаг портов (в обоих режимах)
  if (cfg.wire === 'orth') { separateLanes(P.edges); separateLanes(P.edges); if (P.edges.length < 1500) separateLanes(P.edges); }
  for (const e of P.edges) tidyPts(e);
  if (cfg.wire === 'orth') { separateLanes(P.edges); for (const e of P.edges) tidyPts(e); }
  placeLabels(P.edges);
  for (const e of P.edges) setBB(e);
}
function setBB(e) {
  const r = e._r; let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const p of r.pts) { x1 = Math.min(x1, p.x); y1 = Math.min(y1, p.y); x2 = Math.max(x2, p.x); y2 = Math.max(y2, p.y); }
  if (r.curve) { x1 -= 80; x2 += 80; }
  e._bb = [x1, y1, x2, y2];
}
// полная раскладка после изменений (не во время перетаскивания)
let relayT = 0;
function scheduleRelayout() { clearTimeout(relayT); relayT = setTimeout(relayout, 30); }
function relayout() {
  if (drag && (drag.mode === 'move' || drag.mode === 'bend' || drag.mode === 'nresize' || drag.mode === 'wp' || drag.mode === 'wpnew' || drag.mode === 'seg')) return scheduleRelayout();
  layoutEdges();
  for (const e of P.edges) applyEdge(e);
  renderOverlay();
}
function applyEdge(e) {
  const g = els.get(e.id); if (!g) return;
  const t = edgeText(e), c = g.children, d = pathD(e._r);
  if (!!c[2] !== !!t || (c[3] && c[3].textContent !== t)) return rerenderEdge(e, true);
  c[0].setAttribute('d', d); c[1].setAttribute('d', d);
  if (c[2]) { const w = labelW(t); c[2].setAttribute('x', e._lp.x - w / 2); c[2].setAttribute('y', e._lp.y - 8); c[2].setAttribute('width', w); c[3].setAttribute('x', e._lp.x); c[3].setAttribute('y', e._lp.y); }
}
function edgeGeom(e, cached) {
  if (cached && e._r) { const t = edgeText(e); return { d: pathD(e._r), t, lp: e._lp || labelPt(e._r), lw: labelW(t) }; }
  const r = route(e);
  e._r = r;
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const p of r.pts) { x1 = Math.min(x1, p.x); y1 = Math.min(y1, p.y); x2 = Math.max(x2, p.x); y2 = Math.max(y2, p.y); }
  if (r.curve) { x1 -= 80; x2 += 80; }
  e._bb = [x1, y1, x2, y2];
  const t = edgeText(e); const lp = labelPt(r);
  return { d: pathD(r), t, lp, lw: labelW(t) };
}
function edgeSVG(e, cached) {
  if (!cached) e._st = edgeStatus(e)[0];
  const g = edgeGeom(e, cached === true);
  const col = e.color || (T[e.type] || T.sdi3g).c;
  const cls = e._st === 0 ? ' bad' : e._st === 1 ? ' warn' : '';
  let s = `<g class="edge${cls}" data-id="${e.id}"><path class="e-hit" d="${g.d}"/><path class="e-line" d="${g.d}" stroke="${col}" marker-end="url(#ar-${T[e.type] ? e.type : 'sdi3g'})"/>`;
  if (g.t) s += `<rect class="e-lb" x="${g.lp.x - g.lw / 2}" y="${g.lp.y - 8}" width="${g.lw}" height="16" rx="3"/><text class="e-lt" x="${g.lp.x}" y="${g.lp.y}">${esc(g.t)}</text>`;
  return s + '</g>';
}
function frameSVG(f) {
  const c = f.color || '#2563eb';
  return `<g class="frame" data-id="${f.id}" transform="translate(${f.x},${f.y})"><rect class="f-body" width="${f.w}" height="${f.h}" rx="8" stroke="${c}"/>`
    + `<rect class="f-head" width="${f.w}" height="26" rx="8" fill="${c}" fill-opacity=".14"/><text class="f-t" x="10" y="18" fill="${c}">${esc(f.title)}</text>`
    + `<rect class="f-rs" x="${f.w - 7}" y="${f.h - 7}" width="14" height="14" rx="2"/></g>`;
}
function textSVG(t) {
  const lines = String(t.text || ' ').split('\n'); const sz = t.size || 14;
  const w = Math.max(...lines.map(l => l.length)) * sz * 0.58 + 8, h = lines.length * sz * 1.3 + 6;
  t._w = w; t._h = h;
  return `<g class="txt" data-id="${t.id}" transform="translate(${t.x},${t.y})"><rect x="-4" y="-4" width="${w}" height="${h}" rx="3"/>`
    + `<text font-size="${sz}" font-weight="${t.bold ? 700 : 400}"${t.color ? ` style="fill:${esc(t.color)}"` : ''}>`
    + lines.map((l, i) => `<tspan x="0" y="${(i + 1) * sz * 1.3 - sz * 0.3}">${esc(l) || ' '}</tspan>`).join('') + '</text></g>';
}
function mk(str) { const g = document.createElementNS(NS, 'g'); g.innerHTML = str; return g.firstElementChild; }

// ============================================================================
//  ОТРИСОВКА
// ============================================================================
function renderAll() {
  reindex(); els.clear(); renderImgDefs(); updateModeUI(); hoverId = null; if (LY.hv) LY.hv.innerHTML = '';
  LY.f.innerHTML = P.frames.map(frameSVG).join('');
  layoutEdges();
  LY.e.innerHTML = P.edges.map(e => edgeSVG(e, true)).join('');
  LY.n.innerHTML = P.nodes.map(nodeSVG).join('');
  LY.t.innerHTML = P.texts.map(textSVG).join('');
  for (const L of [LY.f, LY.e, LY.n, LY.t]) for (const g of L.children) { els.set(g.dataset.id, g); g._v = true; }
  applySel(); renderExtra(); renderOverlay(); cull(true); renderPages(); updateStatus();
}
let headless = false;
function rerenderNode(n) {
  n._L = null; if (headless) return;
  if (n.img && !document.getElementById('img-' + n.img)) renderImgDefs();
  const old = els.get(n.id), g = mk(nodeSVG(n));
  if (old) old.replaceWith(g); else LY.n.appendChild(g);
  els.set(n.id, g); g._v = true;
  if (sel.has(n.id)) g.classList.add('sel');
}
function rerenderEdge(e, cached) {
  if (headless) return;
  const old = els.get(e.id), g = mk(edgeSVG(e, cached === true));
  if (old) old.replaceWith(g); else LY.e.appendChild(g);
  els.set(e.id, g); g._v = true;
  if (sel.has(e.id)) g.classList.add('sel');
}
function rerenderItem(id) {
  const it = items.get(id); if (!it) return;
  if (it.k === 'n') { rerenderNode(it.o); for (const e of adj.get(id)) rerenderEdge(e); }
  else if (it.k === 'e') rerenderEdge(it.o);
  else {
    const old = els.get(id), g = mk(it.k === 'f' ? frameSVG(it.o) : textSVG(it.o));
    old ? old.replaceWith(g) : (it.k === 'f' ? LY.f : LY.t).appendChild(g);
    els.set(id, g); if (sel.has(id)) g.classList.add('sel');
  }
}
// быстрое обновление геометрии кабеля без пересоздания элементов
function updateEdgeFast(e) {
  const g = els.get(e.id); if (!g) return;
  const r = edgeGeom(e); const c = g.children;
  c[0].setAttribute('d', r.d); c[1].setAttribute('d', r.d);
  if (c[2]) { c[2].setAttribute('x', r.lp.x - r.lw / 2); c[2].setAttribute('y', r.lp.y - 8); c[3].setAttribute('x', r.lp.x); c[3].setAttribute('y', r.lp.y); }
}
function applySel() {
  for (const g of document.querySelectorAll('#vp .sel')) g.classList.remove('sel');
  for (const id of sel) { const g = els.get(id); if (g) g.classList.add('sel'); }
  renderOverlay(); renderProps(); updateStatus();
}

// ручка изгиба выделенного кабеля
function renderOverlay() {
  LY.o.innerHTML = '';
  if (sel.size !== 1) return;
  const it0 = items.get([...sel][0]);
  if (it0 && it0.k === 'n' && (isPic() || it0.o.shape)) {
    const n = it0.o, L = layout(n);
    let s = `<rect class="rsn" data-rsn="${n.id}" x="${n.x + L.w - 5}" y="${n.y + L.ih - 5}" width="10" height="10" rx="2"/>`;
    if (n.shape) { const tf = shapeTf(n, L.w, L.ih); for (const hd of shapeHandles(n.shape, tf.dw, tf.dh, n.sp, n.sq)) { const [X, Y] = tf.toBox(hd.x, hd.y); s += `<rect class="shp" data-shp="${hd.k}" x="${n.x + X - 5}" y="${n.y + Y - 5}" width="10" height="10" transform="rotate(45 ${n.x + X} ${n.y + Y})"><title>Тяните — изменить форму</title></rect>`; } }
    LY.o.innerHTML = s; return;
  }
  if (cfg.wire !== 'orth') return;
  const it = it0; if (!it || it.k !== 'e' || !it.o._r || it.o._r.curve) return;
  const e = it.o, r = e._r, k = 1 / Math.max(view.k, .35);
  let s = '';
  // полупрозрачные точки на серединах участков — потяните, чтобы добавить изгиб
  const C = canonPts(e);
  for (let i = 1; i < C.length - 2; i++) {
    const A = C[i], B = C[i + 1], len = Math.abs(A.x - B.x) + Math.abs(A.y - B.y); if (len < 12 / Math.max(view.k, .35)) continue;
    const hz = Math.abs(A.y - B.y) < .5, w = (hz ? 16 : 8) * k, h = (hz ? 8 : 16) * k;
    s += `<rect class="handle${hz ? ' v' : ''}" data-sg="${e.id}" data-i="${i}" x="${(A.x + B.x) / 2 - w / 2}" y="${(A.y + B.y) / 2 - h / 2}" width="${w}" height="${h}" rx="${3 * k}"/>`;
  }
  LY.o.innerHTML = s;
}

// ---------- отсечение невидимого (главное для скорости на больших схемах)
let cullRaf = 0;
function scheduleCull() { if (!cullRaf) cullRaf = requestAnimationFrame(() => { cullRaf = 0; cull(); }); }
function cull(force) {
  const total = P.nodes.length + P.edges.length;
  const big = total > 250;
  const r = stage.getBoundingClientRect(), m = 150 / view.k;
  const X1 = -view.x / view.k - m, Y1 = -view.y / view.k - m, X2 = (r.width - view.x) / view.k + m, Y2 = (r.height - view.y) / view.k + m;
  for (const n of P.nodes) {
    const g = els.get(n.id); if (!g) continue;
    const L = layout(n);
    const v = !big || !(n.x > X2 || n.y > Y2 || n.x + L.w < X1 || n.y + L.h < Y1);
    if (v !== g._v || force) { g.style.display = v ? '' : 'none'; g._v = v; }
  }
  for (const e of P.edges) {
    const g = els.get(e.id); if (!g || !e._bb) continue;
    const b = e._bb;
    const v = !big || !(b[0] > X2 || b[1] > Y2 || b[2] < X1 || b[3] < Y1);
    if (v !== g._v || force) { g.style.display = v ? '' : 'none'; g._v = v; }
  }
}

// ---------- вид
function setView() {
  vp.setAttribute('transform', `translate(${view.x},${view.y}) scale(${view.k})`);
  P.view = { ...view };
  $('#zoomLbl').textContent = Math.round(view.k * 100) + '%';
  svg.classList.toggle('lod1', view.k < 0.5);
  svg.classList.toggle('lod2', view.k < 0.22);
  svg.classList.toggle('lod3', view.k < 0.1);
  stage.classList.toggle('grid', !!cfg.grid);
  if (cfg.grid) {
    const a = 100 * view.k, b = 20 * view.k;
    const minor = b >= 7;
    stage.style.backgroundSize = minor ? `${a}px ${a}px,${a}px ${a}px,${b}px ${b}px,${b}px ${b}px` : `${a}px ${a}px,${a}px ${a}px,0 0,0 0`;
    stage.style.backgroundPosition = `${view.x}px ${view.y}px`;
  }
  scheduleCull();
}
function zoomAt(cx, cy, f) {
  const r = svg.getBoundingClientRect();
  const k = clamp(view.k * f, 0.04, 4);
  const px = cx - r.left, py = cy - r.top;
  view.x = px - (px - view.x) * (k / view.k); view.y = py - (py - view.y) * (k / view.k); view.k = k;
  setView();
}
function contentBBox(withExtra) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  const add = (a, b, c, d) => { x1 = Math.min(x1, a); y1 = Math.min(y1, b); x2 = Math.max(x2, c); y2 = Math.max(y2, d); };
  for (const n of P.nodes) { const L = layout(n); add(n.x, n.y, n.x + L.w, n.y + L.h); }
  for (const f of P.frames) add(f.x, f.y, f.x + f.w, f.y + f.h);
  for (const t of P.texts) add(t.x, t.y, t.x + (t._w || 100), t.y + (t._h || 20));
  for (const e of P.edges) if (e._bb) add(...e._bb);
  if (withExtra && extraBB) add(...extraBB);
  return x1 === Infinity ? null : { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}
function fit(bb) {
  bb = bb || contentBBox(true);
  const r = stage.getBoundingClientRect();
  if (!bb) { view = { x: 40, y: 40, k: 1 }; return setView(); }
  const k = clamp(Math.min((r.width - 80) / bb.w, (r.height - 80) / bb.h), 0.04, 1.4);
  view.k = k; view.x = (r.width - bb.w * k) / 2 - bb.x * k; view.y = (r.height - bb.h * k) / 2 - bb.y * k;
  setView();
}
function centerOn(x, y, k) {
  const r = stage.getBoundingClientRect();
  if (k) view.k = k;
  view.x = r.width / 2 - x * view.k; view.y = r.height / 2 - y * view.k; setView();
}
const toDoc = (cx, cy) => { const r = svg.getBoundingClientRect(); return { x: (cx - r.left - view.x) / view.k, y: (cy - r.top - view.y) / view.k }; };

// ---------- легенда и штамп
let extraBB = null;
function renderExtra() {
  extraBB = null; LY.x.innerHTML = '';
  if (!cfg.legend || !P.nodes.length) return;
  const bb = contentBBox(false); if (!bb) return;
  const used = {};
  for (const e of P.edges) used[e.type] = (used[e.type] || 0) + 1;
  const keys = Object.keys(used).filter(k => T[k]);
  const lx = bb.x, ly = bb.y + bb.h + 40;
  let s = '';
  if (keys.length) {
    const lh = 22 + keys.length * 18 + 8;
    s += `<g class="legend"><rect class="lg-bg" x="${lx}" y="${ly}" width="250" height="${lh}" rx="6"/><text class="lg-h" x="${lx + 10}" y="${ly + 17}">Легенда сигналов</text>`;
    keys.forEach((k, i) => { const y = ly + 34 + i * 18; s += `<line x1="${lx + 10}" y1="${y - 4}" x2="${lx + 40}" y2="${y - 4}" stroke="${T[k].c}" stroke-width="3"/><text class="lg-t" x="${lx + 48}" y="${y}">${esc(T[k].n)} — ${used[k]} шт.</text>`; });
    s += '</g>';
  }
  const tw = 320, th = 96, tx = Math.max(bb.x + bb.w - tw, lx + 270), ty = ly;
  const rows = [['Проект', doc.name], ['Лист', `${P.name} (${doc.cur + 1}/${doc.pages.length})`], ['Автор', doc.author || '—'], ['Дата', new Date().toLocaleDateString('ru-RU')]];
  s += `<g class="stamp"><rect class="lg-bg" x="${tx}" y="${ty}" width="${tw}" height="${th}" rx="4"/>`;
  rows.forEach((r, i) => { const y = ty + 20 + i * 21; s += `<text class="lg-t" x="${tx + 10}" y="${y}" fill-opacity=".6">${r[0]}</text><text class="lg-h" x="${tx + 70}" y="${y}">${esc(r[1])}</text>`; if (i) s += `<line x1="${tx}" x2="${tx + tw}" y1="${y - 15}" y2="${y - 15}" stroke="#cbd2dc" stroke-width=".6"/>`; });
  s += `<line x1="${tx + 62}" x2="${tx + 62}" y1="${ty}" y2="${ty + th}" stroke="#cbd2dc" stroke-width=".6"/></g>`;
  LY.x.innerHTML = s;
  extraBB = [lx, ly, tx + tw, ly + Math.max(th, keys.length ? 22 + keys.length * 18 + 8 : 0)];
}

// ============================================================================
//  ИЗМЕНЕНИЯ / ИСТОРИЯ / АВТОСОХРАНЕНИЕ
// ============================================================================
let asTimer = 0, extraTimer = 0;
function hist() {
  const s = snap(); undoS.push(s); const max = s.length > 400000 ? 30 : 200; while (undoS.length > max) undoS.shift(); redoS.length = 0;
  markDirty();
}
function markDirty() {
  dirtyFile = true; setSaveState(); scheduleRelayout();
  clearTimeout(asTimer); asTimer = setTimeout(() => idb.set('doc', snap()), 700);
  clearTimeout(extraTimer); extraTimer = setTimeout(() => { renderExtra(); updateStatus(); }, 250);
}
function setSaveState() {
  const s = $('#saveState');
  s.className = dirtyFile ? 'dirty' : 'ok';
  s.textContent = dirtyFile ? '● Не сохранено (Ctrl+S)' : (fileHandle ? 'Сохранено: ' + fileHandle.name : 'Автосохранено');
}
function loadState(str, keepView) {
  doc = JSON.parse(str); doc.images ||= {}; P = doc.pages[doc.cur] || doc.pages[0];
  if (keepView) P.view = { ...view };
  sel.clear(); renderAll();
  view = { ...(P.view || view) }; setView();
}
function undo() { if (!undoS.length) return toast('Нечего отменять'); redoS.push(snap()); loadState(undoS.pop(), true); markDirty(); }
function redo() { if (!redoS.length) return; undoS.push(snap()); loadState(redoS.pop(), true); markDirty(); }

function restoreBackup(b) {
  customLib = Array.isArray(b.lib) ? b.lib : customLib; const done = b.cfg && (b.cfg.migr || []).includes('io1'); for (const d of customLib) for (const p of d.ports || []) p.name = done ? numFirst(p.name) : portName(p.name, p.dir, p.type); saveLib();
  if (b.cfg) { Object.assign(cfg, b.cfg); saveCfg(); }
  if (Array.isArray(b.favs)) { favs.clear(); b.favs.forEach(x => favs.add(x)); store.set('favs', [...favs]); }
  renderTypeFilter(); renderLib();
  if (b.doc && b.doc.pages) openDoc(b.doc);
  toast(`Восстановлено из копии: схема и ${customLib.length} устройств базы`);
}
function openDoc(d, handle) {
  if (d && d.backup) return restoreBackup(d);
  if (!d || !Array.isArray(d.pages)) return toast(`Это не файл программы «${APP_NAME}»`, 'e');
  doc = d; doc.cur = clamp(doc.cur || 0, 0, doc.pages.length - 1); doc.images ||= {};
  $('#imgDefs').innerHTML = '';
  for (const pg of doc.pages) { pg.nodes ||= []; pg.edges ||= []; pg.frames ||= []; pg.texts ||= []; for (const n of pg.nodes) for (const p of n.ports) { p.id ||= uid(); p.name = d.pn2 ? numFirst(p.name) : portName(p.name, p.dir, p.type); } }
  d.pn2 = 1;
  P = doc.pages[doc.cur]; fileHandle = handle || null; undoS = []; redoS = [];
  $('#docName').value = doc.name; sel.clear(); renderAll();
  if (P.view) { view = { ...P.view }; setView(); } else fit();
  dirtyFile = false; setSaveState(); idb.set('doc', snap());
}
function setMode(m) {
  if ((doc.view || 'ports') === m) return;
  hist(); doc.view = m;
  for (const pg of doc.pages) for (const n of pg.nodes) n._L = null;
  renderAll(); updateModeUI(); markDirty();
  toast(m === 'pic' ? 'Режим «Картинки»: наведите на устройство и тяните от синего кружка' : 'Режим «С портами»');
}
function updateModeUI() {
  const pic = isPic();
  svg.classList.toggle('picmode', pic);
  document.querySelectorAll('[data-cmd=viewPorts],[data-cmd=viewPic]').forEach(b => b.classList.toggle('on', (b.dataset.cmd === 'viewPic') === pic));
}
function switchPage(i) {
  P.view = { ...view }; doc.cur = i; P = doc.pages[i]; sel.clear(); renderAll();
  if (P.view) { view = { ...P.view }; setView(); } else fit();
}

// ============================================================================
//  ОПЕРАЦИИ С ОБЪЕКТАМИ
// ============================================================================
function nextNum(prefix, list, field) {
  let m = 0; const re = new RegExp('^' + prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*-?(\\d+)$');
  for (const pg of doc.pages) for (const o of pg[list]) { const r = re.exec(o[field] || ''); if (r) m = Math.max(m, +r[1]); }
  return m + 1;
}
const nextCable = type => { const pre = (T[type] || T.sdi3g).pre; return pre + String(nextNum(pre, 'edges', 'label')).padStart(3, '0'); };
const nextLabel = cat => { const pre = (CATS[cat] || CATS.my).pre; return pre + ' ' + nextNum(pre, 'nodes', 'label'); };

function addNode(dev, x, y, noHist) {
  if (!noHist) hist();
  const n = {
    id: uid(), lib: dev.id, cat: dev.cat, maker: dev.maker, model: dev.model, label: nextLabel(dev.cat), ...(dev.role ? { role: dev.role } : {}),
    x: cfg.snap ? Math.round(x / 10) * 10 : x, y: cfg.snap ? Math.round(y / 10) * 10 : y,
    ports: dev.ports.map(p => ({ id: uid(), name: p.name, type: p.type, dir: p.dir })), loc: '', notes: '',
  };
  if (dev.img) n.img = putImage(dev.img);
  if (dev.shape) { n.shape = dev.shape; n.fill = dev.fill; if (dev.sw) n.sw = dev.sw; if (dev.sh) n.sh = dev.sh; n.label = dev.label || dev.model; }
  P.nodes.push(n); items.set(n.id, { k: 'n', o: n }); adj.set(n.id, new Set());
  rerenderNode(n);
  return n;
}
function connect(fromRef, toRef, noHist) {
  if (!noHist) hist();
  const fn = node(fromRef.n), pa = portOf(fn, fromRef.p);
  const e = { id: uid(), from: { ...fromRef }, to: { ...toRef }, type: pa.type, label: nextCable(pa.type), fmt: '', len: '' };
  P.edges.push(e); items.set(e.id, { k: 'e', o: e });
  adj.get(e.from.n).add(e); adj.get(e.to.n).add(e);
  portUse.set(e.from.n + ':' + e.from.p, e); portUse.set(e.to.n + ':' + e.to.p, e);
  rerenderEdge(e); rerenderNode(fn); rerenderNode(node(e.to.n));
  return e;
}
function deleteSel() {
  if (!sel.size) return;
  hist();
  const ids = new Set(sel);
  for (const id of ids) { const it = items.get(id); if (it && it.k === 'n') for (const e of adj.get(id)) ids.add(e.id); }
  P.nodes = P.nodes.filter(o => !ids.has(o.id)); P.edges = P.edges.filter(o => !ids.has(o.id));
  P.frames = P.frames.filter(o => !ids.has(o.id)); P.texts = P.texts.filter(o => !ids.has(o.id));
  sel.clear(); renderAll();
}
function selectOnly(ids) { sel.clear(); for (const i of ids) sel.add(i); applySel(); }

// ---------- буфер обмена
let clip = null, pasteN = 0;
function copySel() {
  const ns = P.nodes.filter(n => sel.has(n.id)), ids = new Set(ns.map(n => n.id));
  clip = JSON.parse(JSON.stringify({
    nodes: ns, edges: P.edges.filter(e => ids.has(e.from.n) && ids.has(e.to.n)),
    frames: P.frames.filter(f => sel.has(f.id)), texts: P.texts.filter(t => sel.has(t.id)),
    images: Object.fromEntries(ns.filter(n => n.img && doc.images[n.img]).map(n => [n.img, doc.images[n.img]])),
  }, replacer));
  try { store.set('clip', clip); } catch (e) { } pasteN = 0;
  toast(`Скопировано: ${ns.length} устр.`);
}
function paste(at) {
  const c = clip || store.get('clip', null); if (!c) return;
  hist(); pasteN++;
  Object.assign(doc.images, c.images || {});
  const map = {}, newIds = [];
  let dx = 30 * pasteN, dy = 30 * pasteN;
  if (at) {
    const all = [...c.nodes, ...c.frames, ...c.texts];
    if (all.length) { dx = at.x - Math.min(...all.map(o => o.x)); dy = at.y - Math.min(...all.map(o => o.y)); }
  }
  for (const n0 of c.nodes) {
    const n = JSON.parse(JSON.stringify(n0)); map[n.id] = n.id = uid(); n.x += dx; n.y += dy;
    const pm = {}; for (const p of n.ports) { const o = p.id; p.id = uid(); pm[o] = p.id; } n._pm = pm;
    n.label = nextLabelLike(n.label, n.cat);
    P.nodes.push(n); newIds.push(n.id);
  }
  const byOld = {}; for (const n of P.nodes) if (n._pm) byOld[Object.keys(map).find(k => map[k] === n.id)] = n;
  for (const e0 of c.edges) {
    const a = byOld[e0.from.n], b = byOld[e0.to.n]; if (!a || !b) continue;
    const e = { ...e0, id: uid(), from: { n: a.id, p: a._pm[e0.from.p] }, to: { n: b.id, p: b._pm[e0.to.p] }, label: '' };
    if (e.mx != null) e.mx += dx; if (e.my != null) e.my += dy; if (e.wp) e.wp = e.wp.map(w => ({ x: w.x + dx, y: w.y + dy }));
    P.edges.push(e);
  }
  for (const n of P.nodes) delete n._pm;
  for (const f0 of c.frames) { const f = { ...f0, id: uid(), x: f0.x + dx, y: f0.y + dy }; P.frames.push(f); newIds.push(f.id); }
  for (const t0 of c.texts) { const t = { ...t0, id: uid(), x: t0.x + dx, y: t0.y + dy }; P.texts.push(t); newIds.push(t.id); }
  reindex();
  for (const e of P.edges) if (!e.label) e.label = nextCable(e.type);
  sel.clear(); newIds.forEach(i => sel.add(i)); renderAll();
}
function nextLabelLike(label, cat) {
  const m = /^(.*?)(\d+)$/.exec(label || '');
  if (!m) return nextLabel(cat);
  const pre = m[1].trim(); const n = nextNum(pre, 'nodes', 'label');
  return pre + (m[1].endsWith(' ') ? ' ' : '') + n;
}

// ============================================================================
//  СОВМЕСТИМОСТЬ ПОРТОВ ДЛЯ ПОДКЛЮЧЕНИЯ
// ============================================================================
// fixed — порт, от которого тянем; возвращает [уровень, сообщение] или null если нельзя
function canLink(fixed, fp, nid, p, ignoreEdge) {
  if (nid === fixed.n) return null;
  const used = portUse.get(nid + ':' + p.id);
  if (used && used !== ignoreEdge) return null;
  const fd = fp.dir, td = p.dir;
  if (fd === 'out' && td === 'out') return null;
  if (fd === 'in' && td === 'in') return null;
  let src, dst;
  if (fd === 'out') { src = fp.type; dst = p.type; }
  else if (fd === 'in') { src = p.type; dst = fp.type; }
  else if (td === 'out') { src = p.type; dst = fp.type; }
  else { src = fp.type; dst = p.type; }
  return compat(src, dst);
}
function bestPort(fixed, fp, n, y, ignoreEdge) {
  let best = null, score = -Infinity;
  const L = layout(n);
  for (const p of n.ports) {
    const c = canLink(fixed, fp, n.id, p, ignoreEdge); if (!c) continue;
    const q = L.pos[p.id] || { y: L.h / 2 };
    const s = c[0] * 10000 - Math.abs(n.y + q.y - y);
    if (s > score) { score = s; best = { p, c }; }
  }
  return best;
}

// ============================================================================
//  УКАЗАТЕЛЬ: перетаскивание, соединение, рамка выделения, панорама
// ============================================================================
let drag = null, spaceDown = false, pendingEv = null, moveRaf = 0;
const hint = (t) => { const h = $('#hint'); if (t) { h.textContent = t; h.style.display = 'block'; } else h.style.display = 'none'; };

let lastWpDown = null;
svg.addEventListener('pointerdown', ev => {
  hidePops();
  if (typing(document.activeElement)) document.activeElement.blur();
  if (ev.button === 2) return;
  const pt = toDoc(ev.clientX, ev.clientY);
  svg.setPointerCapture(ev.pointerId);
  if (ev.button === 1 || spaceDown) { drag = { mode: 'pan', sx: ev.clientX, sy: ev.clientY, vx: view.x, vy: view.y }; stage.classList.add('panning'); return; }
  const t = ev.target;
  hoverId = null; LY.hv.innerHTML = '';
  const hn = t.closest('[data-hn]');
  if (hn) return startNodeWire(hn.dataset.hn, ev);
  const shp = t.closest('[data-shp]');
  if (shp) { const n = node([...sel][0]); if (n) { drag = { mode: 'shparam', n, key: shp.dataset.shp, edges: [...adj.get(n.id)], started: false }; return; } }
  const rsn = t.closest('[data-rsn]');
  if (rsn) { const n = node(rsn.dataset.rsn), L = layout(n); drag = { mode: 'nresize', n, sx: pt.x, sy: pt.y, w0: L.w, h0: L.ih, edges: [...adj.get(n.id)], started: false }; return; }
  const h = t.closest('[data-h]');
  if (h) { const e = items.get(h.dataset.h).o; drag = { mode: 'bend', e, started: false }; return; }
  const sgh = t.closest('[data-sg]');
  if (sgh) { const e = items.get(sgh.dataset.sg).o; drag = { mode: 'seg', e, C0: canonPts(e), s: +sgh.dataset.i, started: false }; return; }
  const wph = t.closest('[data-wph]');
  if (wph) {
    const e = items.get(wph.dataset.wph).o, i = +wph.dataset.i;
    const now = Date.now(), dbl = lastWpDown && lastWpDown.e === e && lastWpDown.i === i && now - lastWpDown.t < 400; lastWpDown = { e, i, t: now };
    if (dbl) { lastWpDown = null; hist(); e.wp.splice(i, 1); if (!e.wp.length) delete e.wp; rerenderItem(e.id); scheduleRelayout(); renderOverlay(); markDirty(); return; }
    drag = { mode: 'wp', e, i, started: false }; return;
  }
  const wpv = t.closest('[data-wpv]');
  if (wpv) { const e = items.get(wpv.dataset.wpv).o; drag = { mode: 'wpnew', e, seg: +wpv.dataset.i, sx: pt.x, sy: pt.y, started: false }; return; }
  const g = t.closest('[data-id]');
  const pEl = t.closest('[data-p]');
  if (pEl && g) return startWire(g.dataset.id, pEl.dataset.p, ev);
  if (t.closest('.f-rs')) { const f = items.get(g.dataset.id).o; drag = { mode: 'resize', f, sx: pt.x, sy: pt.y, w: f.w, h: f.h, started: false }; return; }
  if (g) {
    const id = g.dataset.id, it = items.get(id);
    if (it.k === 'e') {
      if (ev.shiftKey) sel.has(id) ? sel.delete(id) : sel.add(id); else { sel.clear(); sel.add(id); }
      applySel(); drag = null;
      const e = it.o;
      if (!ev.shiftKey && cfg.wire === 'orth' && e._r && !e._r.curve) {
        const C = canonPts(e); let bs = -1, bd = Infinity;
        for (let i = 1; i < C.length - 2; i++) { const A = C[i], B = C[i + 1]; const tt = Math.max(0, Math.min(1, ((pt.x - A.x) * (B.x - A.x) + (pt.y - A.y) * (B.y - A.y)) / ((B.x - A.x) ** 2 + (B.y - A.y) ** 2 || 1))); const d = Math.hypot(A.x + (B.x - A.x) * tt - pt.x, A.y + (B.y - A.y) * tt - pt.y); if (d < bd) { bd = d; bs = i; } }
        if (bs > 0 && bd < 12 / view.k) drag = { mode: 'seg', e, C0: C, s: bs, sx: pt.x, sy: pt.y, body: 1, started: false };
      }
      return;
    }
    if (ev.shiftKey || ev.metaKey || ev.ctrlKey) { if (sel.has(id)) { sel.delete(id); applySel(); return; } sel.add(id); }
    else if (!sel.has(id)) { sel.clear(); sel.add(id); }
    applySel();
    // что двигаем: выделенное + содержимое выделенных зон
    const mv = new Set(sel);
    for (const id2 of sel) {
      const it2 = items.get(id2);
      if (it2 && it2.k === 'f' && !ev.altKey) {
        const f = it2.o;
        for (const n of P.nodes) { const L = layout(n); const cx = n.x + L.w / 2, cy = n.y + L.h / 2; if (cx > f.x && cx < f.x + f.w && cy > f.y && cy < f.y + f.h) mv.add(n.id); }
        for (const tt of P.texts) if (tt.x > f.x && tt.x < f.x + f.w && tt.y > f.y && tt.y < f.y + f.h) mv.add(tt.id);
        for (const f2 of P.frames) if (f2 !== f && f2.x >= f.x && f2.y >= f.y && f2.x + f2.w <= f.x + f.w && f2.y + f2.h <= f.y + f.h) mv.add(f2.id);
      }
    }
    const list = [...mv].map(i => items.get(i)).filter(x => x && x.k !== 'e');
    const edges = new Set();
    for (const x of list) if (x.k === 'n') for (const e of adj.get(x.o.id)) edges.add(e);
    drag = { mode: 'move', sx: pt.x, sy: pt.y, list: list.map(x => ({ it: x, x0: x.o.x, y0: x.o.y })), edges: [...edges], started: false, anchor: list[0] && list[0].o };
    return;
  }
  // пустое место — рамка выделения
  if (!ev.shiftKey) { sel.clear(); applySel(); }
  drag = { mode: 'marquee', sx: ev.clientX, sy: ev.clientY, add: ev.shiftKey };
});

function startWire(nid, pid, ev) {
  const n = node(nid); if (!n) return;
  const p = portOf(n, pid);
  let fixed = { n: nid, p: pid }, fp = p, rewire = null, movingEnd = null;
  const used = portUse.get(nid + ':' + pid);
  if (used && !ev.altKey) {
    // берём за конец существующего кабеля — перекоммутация
    rewire = used; movingEnd = (used.from.n === nid && used.from.p === pid) ? 'from' : 'to';
    fixed = movingEnd === 'from' ? used.to : used.from;
    fp = portOf(node(fixed.n), fixed.p);
    els.get(used.id).style.opacity = '.25';
  }
  const start = portPos(fixed);
  drag = { mode: 'wire', fixed, fp, rewire, movingEnd, start, target: null };
  // подсветка совместимых портов
  svg.classList.add('wiring');
  for (const n2 of P.nodes) {
    const g = els.get(n2.id); if (!g || !g._v) continue;
    for (const c of g.querySelectorAll('.p-c')) {
      const pp = portOf(n2, c.dataset.p); const r = canLink(fixed, fp, n2.id, pp, rewire);
      c.classList.add(!r ? 'no' : r[0] === 2 ? 'ok' : r[0] === 1 ? 'wn' : 'no');
    }
  }
  const col = (T[fp.type] || T.sdi3g).c;
  LY.o.innerHTML = `<path class="wire-tmp" stroke="${col}" d=""/>`;
  hint(rewire ? 'Перетащите конец кабеля на другой порт · отпустите в пустоте — отмена' : 'Отпустите на порту или устройстве · в пустом месте — выбрать устройство и подключить');
}

svg.addEventListener('pointermove', ev => {
  if (!drag) return;
  pendingEv = ev;
  if (!moveRaf) moveRaf = requestAnimationFrame(() => { moveRaf = 0; if (pendingEv && drag) onMove(pendingEv); });
});
function onMove(ev) {
  const pt = toDoc(ev.clientX, ev.clientY);
  if (drag.mode === 'pan') { view.x = drag.vx + ev.clientX - drag.sx; view.y = drag.vy + ev.clientY - drag.sy; setView(); return; }
  if (drag.mode === 'move') {
    let dx = pt.x - drag.sx, dy = pt.y - drag.sy;
    if (!drag.started) { if (Math.hypot(dx, dy) * view.k < 3) return; drag.started = true; hist(); }
    if (cfg.snap && drag.anchor) { const a = drag.list[0]; dx = Math.round((a.x0 + dx) / 10) * 10 - a.x0; dy = Math.round((a.y0 + dy) / 10) * 10 - a.y0; }
    // умные направляющие: выравнивание по краям и центрам соседних устройств
    const an = drag.list[0] && drag.list[0].it.k === 'n' ? drag.list[0] : null;
    let guides = '';
    if (an && !ev.altKey) {
      const L0 = layout(an.it.o), h0 = L0.ih || L0.h, nx = an.x0 + dx, ny = an.y0 + dy, tol = 7 / view.k;
      const moving = drag.moveSet || (drag.moveSet = new Set(drag.list.map(m => m.it.o.id)));
      const fx = [nx, nx + L0.w / 2, nx + L0.w], fy = [ny, ny + h0 / 2, ny + h0];
      let bx = null, by = null;
      for (const n of P.nodes) {
        if (moving.has(n.id)) continue; const g = els.get(n.id); if (!g || !g._v) continue;
        const L = layout(n), h = L.ih || L.h, cx = [n.x, n.x + L.w / 2, n.x + L.w], cy = [n.y, n.y + h / 2, n.y + h];
        for (let i = 0; i < 3; i++) { const d = cx[i] - fx[i]; if (Math.abs(d) < tol && (!bx || Math.abs(d) < Math.abs(bx.d))) bx = { d, x: cx[i], n, L, h }; }
        for (let i = 0; i < 3; i++) { const d = cy[i] - fy[i]; if (Math.abs(d) < tol && (!by || Math.abs(d) < Math.abs(by.d))) by = { d, y: cy[i], n, L, h }; }
      }
      if (bx) dx += bx.d;
      if (by) dy += by.d;
      const fxN = an.x0 + dx, fyN = an.y0 + dy;
      if (bx) guides += `<line class="guide" x1="${bx.x}" y1="${Math.min(fyN, bx.n.y) - 20}" x2="${bx.x}" y2="${Math.max(fyN + h0, bx.n.y + bx.h) + 20}"/>`;
      if (by) guides += `<line class="guide" x1="${Math.min(fxN, by.n.x) - 20}" y1="${by.y}" x2="${Math.max(fxN + L0.w, by.n.x + by.L.w) + 20}" y2="${by.y}"/>`;
    }
    LY.o.innerHTML = guides;
    for (const m of drag.list) {
      m.it.o.x = m.x0 + dx; m.it.o.y = m.y0 + dy;
      const g = els.get(m.it.o.id); if (g) g.setAttribute('transform', `translate(${m.it.o.x},${m.it.o.y})`);
    }
    const mv = drag.moveSet || (drag.moveSet = new Set(drag.list.map(m => m.it.o.id)));
    for (const e of drag.edges) {
      // изгибы следуют за прибором: если двигаются оба конца — вся линия; если один — только участки у его порта
      if (e.wp && e.wp.length && (mv.has(e.from.n) || mv.has(e.to.n))) {
        if (!e._wp0) e._wp0 = { wp: e.wp.map(w => ({ ...w })), a: { ...e._r.a }, b: { ...e._r.b } };
        const W = e._wp0, both = mv.has(e.from.n) && mv.has(e.to.n);
        if (both) e.wp = W.wp.map(w => ({ x: w.x + dx, y: w.y + dy }));
        else {
          const o = mv.has(e.from.n) ? W.a : W.b, hz = (o.nx != null ? o.nx : o.d) !== 0 && (o.ny || 0) === 0;
          const list = mv.has(e.from.n) ? W.wp : W.wp.slice().reverse();
          // идём от двигающегося конца: точки на уровне его порта двигаются целиком, первая «поперечная» — только по одной оси
          const moved = []; let follow = true;
          for (const w of list) {
            const onLine = hz ? Math.abs(w.y - o.y) < .6 : Math.abs(w.x - o.x) < .6;
            if (follow && onLine) moved.push(hz ? { x: w.x, y: w.y + dy } : { x: w.x + dx, y: w.y });
            else { follow = false; moved.push({ ...w }); }
          }
          e.wp = mv.has(e.from.n) ? moved : moved.reverse();
        }
      }
      updateEdgeFast(e);
    }
    return;
  }
  if (drag.mode === 'resize') {
    if (!drag.started) { drag.started = true; hist(); }
    const f = drag.f; f.w = Math.max(120, Math.round((drag.w + pt.x - drag.sx) / 10) * 10); f.h = Math.max(60, Math.round((drag.h + pt.y - drag.sy) / 10) * 10);
    rerenderItem(f.id); return;
  }
  if (drag.mode === 'shparam') {
    const n = drag.n; if (!drag.started) { drag.started = true; hist(); }
    const L = layout(n), tf = shapeTf(n, L.w, L.ih), [lx, ly] = tf.toLocal(pt.x - n.x, pt.y - n.y);
    const hd = shapeHandles(n.shape, tf.dw, tf.dh, n.sp, n.sq).find(h => h.k === drag.key);
    if (hd) { n['s' + drag.key] = Math.round(hd.v(lx, ly) * 100) / 100; rerenderNode(n); drag.edges.forEach(updateEdgeFast); renderOverlay(); }
    return;
  }
  if (drag.mode === 'nresize') {
    const n = drag.n; if (!drag.started) { drag.started = true; hist(); }
    const dx = pt.x - drag.sx, dy = pt.y - drag.sy;
    if (n.shape) { n.sw = Math.max(16, Math.round((drag.w0 + dx) / 5) * 5); n.sh = Math.max(16, Math.round((drag.h0 + dy) / 5) * 5); }
    else n.pw = Math.max(40, Math.round((drag.w0 + dx) / 5) * 5);
    rerenderNode(n); drag.edges.forEach(updateEdgeFast); renderOverlay(); return;
  }
  if (drag.mode === 'nwire') {
    if (drag.target) { const g0 = els.get(drag.target); g0 && g0.classList.remove('hl'); drag.target = null; }
    const el = document.elementFromPoint(ev.clientX, ev.clientY);
    const g = el && el.closest && el.closest('.node');
    let end = pt;
    if (g && g.dataset.id !== drag.from) { drag.target = g.dataset.id; g.classList.add('hl'); const n = node(drag.target), L = layout(n); end = { x: n.x + L.w / 2, y: n.y + L.ih / 2 }; hint('Отпустите — порты подберутся автоматически'); }
    else hint('Отпустите на другом устройстве · в пустом месте — выбрать новое устройство');
    LY.o.firstChild.setAttribute('d', `M${drag.sx} ${drag.sy}L${end.x} ${end.y}`);
    return;
  }
  if (drag.mode === 'seg') {
    const e = drag.e;
    if (!drag.started) { if (drag.body && Math.hypot(pt.x - drag.sx, pt.y - drag.sy) * view.k < 4) return; drag.started = true; hist(); }
    e.wp = moveSeg(drag.C0, drag.s, pt); delete e.mx; delete e.my; delete e.pmx; delete e.pmy;
    updateEdgeFast(e); renderOverlay(); return;
  }
  if (drag.mode === 'wpnew') {   // тянем середину участка — появляется новая точка поворота
    const e = drag.e; if (Math.hypot(pt.x - drag.sx, pt.y - drag.sy) * view.k < 3 && !drag.started) return;
    if (!drag.started) { drag.started = true; hist(); e.wp = wpFromRoute(e, drag.seg); drag.mode = 'wp'; drag.i = e.wp._ins; delete e.wp._ins; }
  }
  if (drag.mode === 'wp') {
    const e = drag.e; if (!drag.started) { drag.started = true; hist(); }
    const g = ev.altKey ? 1 : 5; e.wp[drag.i] = { x: Math.round(pt.x / g) * g, y: Math.round(pt.y / g) * g };
    updateEdgeFast(e); renderOverlay(); return;
  }
  if (drag.mode === 'bend') {
    const e = drag.e; if (!drag.started) { drag.started = true; hist(); }
    const key = e._r.seg.key || e._r.seg.k;
    e[key] = e._r.seg.k === 'mx' ? Math.round(pt.x / 5) * 5 : Math.round(pt.y / 5) * 5;
    updateEdgeFast(e); renderOverlay(); return;
  }
  if (drag.mode === 'marquee') {
    const m = $('#marquee'), r = stage.getBoundingClientRect();
    const x = Math.min(ev.clientX, drag.sx) - r.left, y = Math.min(ev.clientY, drag.sy) - r.top;
    Object.assign(m.style, { display: 'block', left: x + 'px', top: y + 'px', width: Math.abs(ev.clientX - drag.sx) + 'px', height: Math.abs(ev.clientY - drag.sy) + 'px' });
    return;
  }
  if (drag.mode === 'wire') {
    if (drag.target) { drag.target.el && drag.target.el.classList.remove('target'); drag.target = null; }
    const el = document.elementFromPoint(ev.clientX, ev.clientY);
    let end = pt, msg = '';
    const g = el && el.closest && el.closest('.node');
    if (g) {
      const n = node(g.dataset.id); const pEl = el.closest('[data-p]');
      let cand = null;
      if (pEl) { const p = portOf(n, pEl.dataset.p); const c = canLink(drag.fixed, drag.fp, n.id, p, drag.rewire); if (c) cand = { p, c }; else msg = 'Сюда нельзя: порт занят или то же направление'; }
      else cand = bestPort(drag.fixed, drag.fp, n, pt.y, drag.rewire);
      if (cand) {
        const ref = { n: n.id, p: cand.p.id };
        const c = g.querySelector(`.p-c[data-p="${cand.p.id}"]`); c && c.classList.add('target');
        drag.target = { ref, el: c, c: cand.c };
        const pp = portPos(ref); end = pp;
        msg = `→ ${n.label} · ${cand.p.name}` + (cand.c[1] ? '   ⚠ ' + cand.c[1] : '');
      } else if (!msg) msg = 'На этом устройстве нет свободного подходящего порта';
    }
    const s = drag.start, k = Math.max(40, Math.abs(end.x - s.x) * 0.45);
    const ed = end.d || -s.d;
    LY.o.firstChild.setAttribute('d', `M${s.x} ${s.y}C${s.x + s.d * k} ${s.y} ${end.x + ed * k} ${end.y} ${end.x} ${end.y}`);
    if (msg) hint(msg);
  }
}
svg.addEventListener('pointerup', ev => {
  if (!drag) return;
  if (moveRaf) { cancelAnimationFrame(moveRaf); moveRaf = 0; if (pendingEv) onMove(pendingEv); }
  const d = drag; drag = null; pendingEv = null;
  stage.classList.remove('panning');
  if (d.mode === 'move' && d.started) { for (const e of d.edges) { if (e._wp0) { delete e._wp0; cleanWp(e); } } markDirty(); renderOverlay(); cull(); }
  if ((d.mode === 'resize' || d.mode === 'bend' || d.mode === 'nresize' || d.mode === 'shparam' || d.mode === 'wp' || d.mode === 'seg') && d.started) { markDirty(); if (d.mode === 'shparam') renderProps(); if (d.mode === 'wp' || d.mode === 'seg') { cleanWp(d.e); rerenderItem(d.e.id); scheduleRelayout(); renderOverlay(); } }
  if (d.mode === 'nwire') finishNodeWire(d, ev);
  if (d.mode === 'marquee') {
    const m = $('#marquee'); m.style.display = 'none';
    const a = toDoc(d.sx, d.sy), b = toDoc(ev.clientX, ev.clientY);
    const x1 = Math.min(a.x, b.x), y1 = Math.min(a.y, b.y), x2 = Math.max(a.x, b.x), y2 = Math.max(a.y, b.y);
    if ((x2 - x1) * view.k > 4) {
      for (const n of P.nodes) { const L = layout(n); if (n.x < x2 && n.x + L.w > x1 && n.y < y2 && n.y + L.h > y1) sel.add(n.id); }
      for (const t of P.texts) if (t.x < x2 && t.x + (t._w || 50) > x1 && t.y < y2 && t.y + (t._h || 20) > y1) sel.add(t.id);
      for (const f of P.frames) if (f.x >= x1 && f.y >= y1 && f.x + f.w <= x2 && f.y + f.h <= y2) sel.add(f.id);
      for (const e of P.edges) if (sel.has(e.from.n) && sel.has(e.to.n) && ev.altKey) sel.add(e.id);
      applySel();
    }
  }
  if (d.mode === 'wire') finishWire(d, ev);
});
let hoverId = null;
function renderHover() {
  LY.hv.innerHTML = '';
  const n = hoverId && node(hoverId); if (!n || (!isPic() && !n.shape)) return;
  const L = layout(n), m = 16;
  const pts = [[n.x + L.w / 2, n.y - m], [n.x + L.w + m, n.y + L.ih / 2], [n.x + L.w / 2, n.y + L.h + m - 4], [n.x - m, n.y + L.ih / 2]];
  LY.hv.innerHTML = `<rect class="hv-zone" data-hzone="${n.id}" x="${n.x - 30}" y="${n.y - 30}" width="${L.w + 60}" height="${L.h + 60}"/>`
    + pts.map(p => `<g class="hn" data-hn="${n.id}" transform="translate(${p[0]},${p[1]})"><title>Тяните, чтобы соединить</title><circle r="8"/><path d="M-3.5 0h7M0 -3.5v7"/></g>`).join('');
}
svg.addEventListener('pointermove', ev => {
  if (drag) return;
  const t = ev.target;
  if (t.closest && t.closest('[data-hn],[data-hzone]') && hoverId) {
    const z = t.closest('[data-hzone]'); if (!z || z.dataset.hzone === hoverId) return;
  }
  const g = t.closest && t.closest('.node');
  let id = g ? g.dataset.id : null;
  if (id && !isPic() && !(node(id) || {}).shape) id = null;
  if (id !== hoverId) { hoverId = id; renderHover(); }
});
function startNodeWire(nid, ev) {
  const n = node(nid); if (!n) return;
  const L = layout(n);
  drag = { mode: 'nwire', from: nid, sx: n.x + L.w / 2, sy: n.y + L.ih / 2, target: null };
  LY.o.innerHTML = '<path class="wire-tmp" stroke="#2563eb" d=""/>';
  hint('Отпустите на другом устройстве · в пустом месте — выбрать новое устройство');
}
// лучшая пара свободных портов между двумя устройствами (направление подбирается само)
function bestPair(A, B) {
  let best = null;
  const free = (n, p) => !portUse.has(n.id + ':' + p.id);
  const outish = p => p.dir === 'out' || p.dir === 'io', inish = p => p.dir === 'in' || p.dir === 'io';
  for (const pa of A.ports) { if (!free(A, pa)) continue;
    for (const pb of B.ports) { if (!free(B, pb)) continue;
      if (outish(pa) && inish(pb)) { const c = compat(pa.type, pb.type); const s = c[0] * 10 + 3 + (pa.dir !== 'io') + (pb.dir !== 'io'); if (!best || s > best.s) best = { from: { n: A.id, p: pa.id }, to: { n: B.id, p: pb.id }, c, s }; }
      if (outish(pb) && inish(pa)) { const c = compat(pb.type, pa.type); const s = c[0] * 10 + (pa.dir !== 'io') + (pb.dir !== 'io'); if (!best || s > best.s) best = { from: { n: B.id, p: pb.id }, to: { n: A.id, p: pa.id }, c, s }; }
    }
  }
  return best;
}
function addLinkPort(n, dir) {
  const k = n.ports.filter(p => p.type === 'any').length + 1;
  const p = { id: uid(), name: 'Связь ' + k, type: 'any', dir }; n.ports.push(p); n._L = null; return p;
}
function finishNodeWire(d, ev) {
  hint(''); LY.o.innerHTML = '';
  if (d.target) { const g0 = els.get(d.target); g0 && g0.classList.remove('hl'); }
  const A = node(d.from);
  if (d.target) {
    const B = node(d.target);
    hist();
    let pr = bestPair(A, B);
    if (pr && pr.c[0] === 0) pr = null; // несовместимые порты — проводим простую связь, как в draw.io
    if (!pr) {
      const pa = A.ports.find(p => (p.dir === 'out' || p.dir === 'io') && !portUse.has(A.id + ':' + p.id)) || addLinkPort(A, 'io');
      const pb = B.ports.find(p => (p.dir === 'in' || p.dir === 'io') && !portUse.has(B.id + ':' + p.id) && compat(pa.type, p.type)[0] > 0) || addLinkPort(B, 'io');
      pr = { from: { n: A.id, p: pa.id }, to: { n: B.id, p: pb.id }, c: compat(pa.type, pb.type) };
      toast('Подходящих свободных портов нет — проведена простая связь (порты можно поправить в свойствах)', 'w');
    } else if (pr.c[0] < 2) toast(pr.c[1], pr.c[0] === 0 ? 'e' : 'w');
    const e = connect(pr.from, pr.to, true);
    selectOnly([e.id]); markDirty(); return;
  }
  const el = document.elementFromPoint(ev.clientX, ev.clientY);
  if (el === svg || (el && el.closest && !el.closest('[data-id]') && svg.contains(el))) {
    const fp = A.ports.find(p => (p.dir === 'out' || p.dir === 'io') && !portUse.has(A.id + ':' + p.id)) || A.ports.find(p => !portUse.has(A.id + ':' + p.id)) || addLinkPort(A, 'io');
    openQuick(ev.clientX, ev.clientY, toDoc(ev.clientX, ev.clientY), { fixed: { n: A.id, p: fp.id }, fp });
  }
}
function finishWire(d, ev) {
  svg.classList.remove('wiring'); hint('');
  for (const c of svg.querySelectorAll('.p-c.ok,.p-c.wn,.p-c.no,.p-c.target')) c.classList.remove('ok', 'wn', 'no', 'target');
  LY.o.innerHTML = '';
  if (d.rewire) els.get(d.rewire.id).style.opacity = '';
  if (d.target) {
    const tn = node(d.target.ref.n), tp = portOf(tn, d.target.ref.p);
    if (d.rewire) {
      hist();
      d.rewire[d.movingEnd] = { ...d.target.ref };
      if (d.movingEnd === 'from') d.rewire.type = tp.type;
      delete d.rewire.mx; delete d.rewire.my;
      renderAll(); selectOnly([d.rewire.id]);
    } else {
      const fx = d.fixed, fd = d.fp.dir;
      const fromFixed = fd === 'out' || (fd === 'io' && tp.dir !== 'out');
      const e = fromFixed ? connect(fx, d.target.ref) : connect(d.target.ref, fx);
      if (d.target.c[0] < 2) toast(d.target.c[1], d.target.c[0] === 0 ? 'e' : 'w');
      selectOnly([e.id]); markDirty();
    }
    renderOverlay();
    return;
  }
  // отпустили в пустоте — предложить устройство и подключить
  if (!d.rewire) {
    const el = document.elementFromPoint(ev.clientX, ev.clientY);
    if (el === svg || (el && el.closest && !el.closest('[data-id]') && svg.contains(el))) openQuick(ev.clientX, ev.clientY, toDoc(ev.clientX, ev.clientY), d);
  }
  renderOverlay();
}

// колесо: тачпад — панорама, колесо мыши или Ctrl — масштаб
svg.addEventListener('wheel', ev => {
  ev.preventDefault();
  const mouseWheel = ev.deltaMode === 1 || (ev.deltaX === 0 && Math.abs(ev.deltaY) >= 50 && Number.isInteger(ev.deltaY));
  if (ev.ctrlKey || ev.metaKey || (mouseWheel && !ev.shiftKey)) {
    const dy = ev.deltaMode === 1 ? ev.deltaY * 33 : ev.deltaY;
    zoomAt(ev.clientX, ev.clientY, Math.exp(-clamp(dy, -120, 120) * (ev.ctrlKey && !mouseWheel ? 0.01 : 0.0018)));
  } else {
    view.x -= ev.shiftKey && !ev.deltaX ? ev.deltaY : ev.deltaX; view.y -= ev.shiftKey && !ev.deltaX ? 0 : ev.deltaY; setView();
  }
}, { passive: false });

svg.addEventListener('dblclick', ev => {
  const wph = ev.target.closest('[data-wph]');
  if (wph) { const e = items.get(wph.dataset.wph).o; hist(); e.wp.splice(+wph.dataset.i, 1); if (!e.wp.length) delete e.wp; rerenderItem(e.id); scheduleRelayout(); renderOverlay(); markDirty(); return; }
  const g = ev.target.closest('[data-id]');
  if (!g) return openQuick(ev.clientX, ev.clientY, toDoc(ev.clientX, ev.clientY));
  selectOnly([g.dataset.id]);
  const f = $('#props [data-focus]'); if (f) { f.focus(); f.select && f.select(); }
});

// ============================================================================
//  КЛАВИАТУРА
// ============================================================================
const typing = el => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
document.addEventListener('keydown', ev => {
  const mod = ev.ctrlKey || ev.metaKey, k = ev.key.toLowerCase();
  if (typeof LED !== 'undefined' && LED.on && !(mod && 'sop'.includes(k))) return LED.key(ev);
  if (mod && k === 's') { ev.preventDefault(); return ev.shiftKey ? saveAs() : save(); }
  if (mod && k === 'o') { ev.preventDefault(); return openFile(); }
  if (mod && k === 'p') { ev.preventDefault(); return printDoc(); }
  if (mod && k === 'f') { ev.preventDefault(); $('#findBox').focus(); $('#findBox').select(); return; }
  if (ev.key === 'Escape') {
    if (!$('#modal').classList.contains('hidden')) return closeModal();
    hidePops(); if (typing(document.activeElement)) return document.activeElement.blur();
    if (drag && drag.mode === 'wire') { finishWire({ ...drag, target: null, rewire: drag.rewire }, { clientX: -1, clientY: -1 }); drag = null; return; }
    sel.clear(); applySel(); return;
  }
  if (typing(document.activeElement) || !$('#modal').classList.contains('hidden')) return;
  if (ev.code === 'Space') { if (!spaceDown) { spaceDown = true; stage.classList.add('spacepan'); } ev.preventDefault(); return; }
  if (mod && k === 'z') { ev.preventDefault(); return ev.shiftKey ? redo() : undo(); }
  if (mod && k === 'y') { ev.preventDefault(); return redo(); }
  if (mod && k === 'c') { ev.preventDefault(); return copySel(); }
  if (mod && k === 'x') { ev.preventDefault(); copySel(); return deleteSel(); }
  if (mod && k === 'v') { ev.preventDefault(); return paste(); }
  if (mod && k === 'd') { ev.preventDefault(); copySel(); return paste(); }
  if (mod && k === 'a') { ev.preventDefault(); return selectOnly([...P.nodes, ...P.frames, ...P.texts].map(o => o.id)); }
  if (mod && k === 'k') { ev.preventDefault(); return quickAtCenter(); }
  if (mod && (k === '0')) { ev.preventDefault(); const r = stage.getBoundingClientRect(); return zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1 / view.k); }
  if (mod) return;
  if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); return deleteSel(); }
  if (k === 'f') return fit();
  if (k === '/' || k === 'a' && !ev.shiftKey) { ev.preventDefault(); return quickAtCenter(); }
  if (k === 'z') return addFrame();
  if (k === 't') return addText();
  if (k === 'r') return flipSel();
  if (k === '+' || k === '=') { const r = stage.getBoundingClientRect(); return zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.2); }
  if (k === '-') { const r = stage.getBoundingClientRect(); return zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1 / 1.2); }
  if (ev.key.startsWith('Arrow') && sel.size) {
    ev.preventDefault(); const s = ev.shiftKey ? 50 : 10;
    const dx = ev.key === 'ArrowLeft' ? -s : ev.key === 'ArrowRight' ? s : 0, dy = ev.key === 'ArrowUp' ? -s : ev.key === 'ArrowDown' ? s : 0;
    nudge(dx, dy);
  }
});
document.addEventListener('keyup', ev => { if (ev.code === 'Space') { spaceDown = false; stage.classList.remove('spacepan'); } });
let nudgeT = 0;
function nudge(dx, dy) {
  if (!nudgeT) hist(); clearTimeout(nudgeT); nudgeT = setTimeout(() => nudgeT = 0, 600);
  const es = new Set();
  for (const id of sel) {
    const it = items.get(id); if (!it || it.k === 'e') continue;
    it.o.x += dx; it.o.y += dy; els.get(id).setAttribute('transform', `translate(${it.o.x},${it.o.y})`);
    if (it.k === 'n') for (const e of adj.get(id)) es.add(e);
  }
  es.forEach(updateEdgeFast); renderOverlay(); markDirty();
}
function flipSel() {
  const ns = [...sel].map(node).filter(Boolean); if (!ns.length) return;
  hist(); for (const n of ns) { n.flip = !n.flip; rerenderItem(n.id); } renderProps();
}

// ============================================================================
//  БЫСТРОЕ ДОБАВЛЕНИЕ (поиск устройства)
// ============================================================================
let quick = null;
function quickAtCenter() { const r = stage.getBoundingClientRect(); openQuick(r.left + r.width / 2 - 200, r.top + 80, toDoc(r.left + r.width / 2, r.top + r.height / 2)); }
function openQuick(cx, cy, docPt, wire) {
  hidePops();
  quick = { docPt, wire, idx: 0, list: [] };
  const q = $('#quick'); q.classList.remove('hidden');
  q.style.left = clamp(cx, 8, innerWidth - 410) + 'px'; q.style.top = clamp(cy, 8, innerHeight - 400) + 'px';
  $('#quickIn').value = ''; $('#quickShapes').innerHTML = wire ? '' : shapeGridHTML(); $('#quickShapes').classList.toggle('hidden', !!wire); renderQuick(); setTimeout(() => $('#quickIn').focus(), 0);
}
function devMatches(d, q) {
  if (!q) return true;
  const arrow = /^(\w+)\s*(?:→|->|>|2)\s*(\w+)$/.exec(q);
  if (arrow) {
    const fa = famOf(arrow[1]), fb = famOf(arrow[2]);
    if (fa && fb) return d.ports.some(p => p.dir !== 'out' && T[p.type].fam === fa) && d.ports.some(p => p.dir !== 'in' && T[p.type].fam === fb);
  }
  const hay = (d.maker + ' ' + d.model + ' ' + (CATS[d.cat] || {}).n + ' ' + d.ports.map(p => T[p.type].n).join(' ')).toLowerCase();
  return q.split(/\s+/).every(w => hay.includes(w));
}
function famOf(w) {
  w = w.toLowerCase(); const map = { sdi: 'sdi', hdmi: 'hdmi', dp: 'dp', dvi: 'dvi', fiber: 'fiber', 'оптика': 'fiber', opt: 'fiber', ndi: 'eth', ip: 'eth', lan: 'eth', eth: 'eth', utp: 'eth', sm: 'fibsm', mm: 'fibmm', 'одномод': 'fibsm', 'многомод': 'fibmm', 'гибрид': 'fibhyb', hybrid: 'fibhyb', usb: 'usb', hdbt: 'hdbt', hdbaset: 'hdbt', cvbs: 'cvbs', av: 'cvbs', vga: 'vga', aes: 'aes', audio: 'aud', xlr: 'aud' };
  return map[w];
}
function renderQuick() {
  const q = $('#quickIn').value.trim().toLowerCase();
  let list = allLib().filter(d => devMatches(d, q));
  if (quick.wire) {
    const w = quick.wire;
    list = list.map(d => {
      const tmp = { id: '_tmp', ports: d.ports.map((p, i) => ({ ...p, id: 'p' + i })) };
      let best = null;
      for (const p of tmp.ports) { const c = canLink(w.fixed, w.fp, '_tmp', p, null); if (c && (!best || c[0] > best.c[0])) best = { p, c }; }
      return best && best.c[0] > 0 ? { d, best } : null;
    }).filter(Boolean).sort((a, b) => b.best.c[0] - a.best.c[0] || (favs.has(b.d.id) - favs.has(a.d.id)));
  } else list = list.sort((a, b) => favs.has(b.id) - favs.has(a.id)).map(d => ({ d }));
  quick.list = list.slice(0, 80); quick.idx = 0;
  $('#quickList').innerHTML = (quick.wire ? `<div class="qh">Совместимо с ${esc(T[quick.wire.fp.type].n)} — устройство будет подключено автоматически</div>` : '')
    + quick.list.map((x, i) => itemHTML(x.d, i, x.best ? '→ ' + x.best.p.name + (x.best.c[0] === 1 ? ' ⚠' : '') : null)).join('')
    + (quick.list.length ? '' : '<div class="qh">Ничего не найдено. Создайте своё устройство: Вставка → Создать своё устройство</div>');
  hlQuick();
}
function hlQuick() { [...$('#quickList').querySelectorAll('.item')].forEach((el, i) => el.classList.toggle('on', i === quick.idx)); const on = $('#quickList .item.on'); on && on.scrollIntoView({ block: 'nearest' }); }
$('#quickIn').addEventListener('input', renderQuick);
$('#quickIn').addEventListener('keydown', ev => {
  if (ev.key === 'ArrowDown') { quick.idx = Math.min(quick.idx + 1, quick.list.length - 1); hlQuick(); ev.preventDefault(); }
  if (ev.key === 'ArrowUp') { quick.idx = Math.max(quick.idx - 1, 0); hlQuick(); ev.preventDefault(); }
  if (ev.key === 'Enter' && quick.list[quick.idx]) quickPick(quick.idx);
  if (ev.key === 'Escape') hidePops();
});
$('#quickList').addEventListener('click', ev => { const it = ev.target.closest('.item'); if (it && !ev.target.closest('.fav')) quickPick(+it.dataset.i); });
function quickPick(i) {
  const x = quick.list[i]; if (!x) return;
  const q = quick; hidePops();
  hist();
  const n = addNode(x.d, q.docPt.x, q.docPt.y - 20, true);
  if (q.wire && x.best) {
    const p = n.ports[x.best.p.id.slice(1)];
    const L = layout(n); const pos = L.pos[p.id];
    // ставим устройство так, чтобы порт оказался под курсором
    if (pos) { n.x = Math.round((q.docPt.x - pos.x - (pos.d < 0 ? -40 : 40)) / 10) * 10; n.y = Math.round((q.docPt.y - pos.y) / 10) * 10; }
    else { n.x = Math.round((q.docPt.x - L.w / 2) / 10) * 10; n.y = Math.round((q.docPt.y - L.ih / 2) / 10) * 10; }
    rerenderNode(n);
    const fd = q.wire.fp.dir; const fromFixed = fd === 'out' || (fd === 'io' && p.dir !== 'out');
    const e = fromFixed ? connect(q.wire.fixed, { n: n.id, p: p.id }, true) : connect({ n: n.id, p: p.id }, q.wire.fixed, true);
    selectOnly([n.id]);
    if (x.best.c[0] < 2) toast(x.best.c[1], 'w');
  } else selectOnly([n.id]);
  markDirty(); cull();
}

// ============================================================================
//  БИБЛИОТЕКА
// ============================================================================
const typeFilter = new Set();
function portSummary(d) {
  const agg = {};
  for (const p of d.ports) { const k = (p.dir === 'out' ? 'out' : p.dir === 'io' ? 'io' : 'in') + ':' + T[p.type].s; agg[k] = (agg[k] || 0) + 1; }
  const f = dir => Object.entries(agg).filter(([k]) => k.startsWith(dir)).map(([k, v]) => (v > 1 ? v + '×' : '') + k.split(':')[1]).join(' ');
  const i = f('in:'), o = f('out:'), io = f('io:');
  return [i && 'вх ' + i, o && 'вых ' + o, io && '⇄ ' + io].filter(Boolean).join(' · ');
}
function itemHTML(d, i, extra) {
  const cat = CATS[d.cat] || CATS.my;
  return `<div class="item" draggable="true" data-dev="${esc(d.id)}" ${i != null ? `data-i="${i}"` : ''}${cfg.libView === 'grid' ? '' : ` title="${esc(d.maker + ' ' + d.model + '\n' + portSummary(d))}"`}>`
    + (d.img ? `<div class="ic ph"><img src="${d.img.src}" alt="" draggable="false"></div>` : d.cat !== 'shape' ? `<div class="ic art"><svg viewBox="0 0 ${ART[artKey(d.cat)].w} ${ART[artKey(d.cat)].h}"><use href="#art-${artKey(d.cat)}"/></svg></div>` : `<div class="ic" style="background:${cat.c}"><svg viewBox="0 0 16 16"><path d="${ICONS[cat.ic]}" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`)
    + `<div class="t"><div class="m">${esc(d.model)}</div><div class="k">${esc(d.maker !== 'Generic' ? d.maker + ' · ' : '')}${esc(extra || portSummary(d))}</div></div>`
    + `<span class="edt" data-edt="${esc(d.id)}" title="Изменить устройство">✎</span><span class="fav${favs.has(d.id) ? ' on' : ''}" data-fav="${esc(d.id)}" title="В избранное">★</span></div>`;
}
function renderTypeFilter() {
  const keys = ['sdi12g', 'sdi3g', 'hdmi', 'dp', 'fiber', 'eth', 'hdbt', 'ref', 'aud'];
  $('#libTypeFilter').innerHTML = `<span data-tf="photo" class="${typeFilter.has('photo') ? 'on' : ''}" style="${typeFilter.has('photo') ? 'background:#0f766e' : 'border-color:#0f766e'}" title="Только устройства с фото">📷 С фото</span>` + keys.map(k => `<span data-tf="${k}" class="${typeFilter.has(k) ? 'on' : ''}" style="${typeFilter.has(k) ? 'background:' + T[k].c : 'border-color:' + T[k].c}">${T[k].s === 'SDI' ? T[k].n.replace('-SDI', '') + ' SDI' : T[k].s}</span>`).join('');
}
const rawGroup = d => (d.group && d.group.trim()) || (CATS[d.cat] || CATS.my).n;
const groupOf = d => { const g = rawGroup(d); return (cfg.groupRename || {})[g] || g; };
function allGroupNames() {
  const s = new Set();
  for (const g of cfg.groupOrder || []) s.add(g);
  for (const d of customLib) s.add(groupOf(d));
  for (const c of Object.keys(CATS)) if (c !== 'shape' && c !== 'my') s.add((cfg.groupRename || {})[CATS[c].n] || CATS[c].n);
  for (const g of cfg.groupsExtra || []) s.add(g);
  s.add(groupOf({ cat: 'shape' }));
  return [...s];
}
// перенос устройства в группу: своё — меняем поле, встроенное — создаём свою копию (она заменит встроенную)
function moveToGroup(list, g) {
  let n = 0;
  for (const d of list) {
    if (!d || d.cat === 'shape') continue;
    if (customLib.includes(d)) { d.group = g; n++; continue; }
    const c = { ...JSON.parse(JSON.stringify(d)), id: 'c' + uid(), group: g }; delete c.shape;
    customLib.push(c); n++;
  }
  if (!(cfg.groupOrder || []).includes(g)) cfg.groupOrder = [...(cfg.groupOrder || []), g];
  cfg.groupsExtra = (cfg.groupsExtra || []).filter(x => x !== g);
  openCats.add(g); store.set('openCats', [...openCats]);
  saveLib(); saveCfg(); renderLib();
  if (n) toast(`Перемещено в «${g}»: ${n}`);
}
function askText(title, value, cb, ph) {
  openModal(title, `<div class="fld"><input id="askIn" value="${esc(value || '')}" placeholder="${esc(ph || '')}" style="font-size:15px;padding:8px"></div><div class="btns"><button class="pri" id="askOk">OK</button><button id="askNo">Отмена</button></div>`);
  const i = $('#askIn'); i.focus(); i.select();
  const ok = () => { const v = i.value.trim(); closeModal(); if (v) cb(v); };
  $('#askOk').onclick = ok; $('#askNo').onclick = closeModal; i.onkeydown = e => { if (e.key === 'Enter') ok(); };
}
function newGroup(after) {
  askText('Новая группа', '', name => {
    if (allGroupNames().includes(name)) return toast('Такая группа уже есть', 'w');
    cfg.groupsExtra = [...(cfg.groupsExtra || []), name];
    const order = cfg.groupOrder && cfg.groupOrder.length ? cfg.groupOrder.slice() : currentGroupOrder();
    const i = after ? order.indexOf(after) : -1; order.splice(i >= 0 ? i + 1 : order.length, 0, name);
    cfg.groupOrder = order; openCats.add(name); store.set('openCats', [...openCats]); saveCfg(); renderLib();
    toast(`Группа «${name}» создана — перетащите в неё устройства`);
  }, 'например: Аппаратная 1, Стол игрока');
}
function renameGroup(old) {
  askText('Переименовать группу', old, name => {
    if (name === old) return;
    for (const d of customLib) if (groupOf(d) === old) d.group = name;
    const rn = { ...(cfg.groupRename || {}) };
    for (const k of Object.keys(rn)) if (rn[k] === old) rn[k] = name;
    for (const c of Object.values(CATS)) if (c.n === old) rn[c.n] = name;
    cfg.groupRename = rn;
    if (cfg.devOrder && cfg.devOrder[old]) { cfg.devOrder = { ...cfg.devOrder, [name]: cfg.devOrder[old] }; delete cfg.devOrder[old]; }
    cfg.groupOrder = (cfg.groupOrder || []).map(g => g === old ? name : g);
    cfg.groupsExtra = (cfg.groupsExtra || []).map(g => g === old ? name : g);
    if (openCats.has(old)) { openCats.delete(old); openCats.add(name); store.set('openCats', [...openCats]); }
    saveLib(); saveCfg(); renderLib(); toast(`Группа переименована: «${name}»`);
  });
}
function currentGroupOrder() { return [...document.querySelectorAll('#libList .cat')].map(c => c.dataset.cat).filter(c => c !== 'fav'); }
function moveGroup(g, dir) {
  const order = cfg.groupOrder && cfg.groupOrder.length ? cfg.groupOrder.slice() : currentGroupOrder();
  for (const x of allGroupNames()) if (!order.includes(x)) order.push(x);
  const i = order.indexOf(g), j = i + dir; if (i < 0 || j < 0 || j >= order.length) return;
  [order[i], order[j]] = [order[j], order[i]]; cfg.groupOrder = order; saveCfg(); renderLib();
}
function placeGroupBefore(g, target) {
  const order = (cfg.groupOrder && cfg.groupOrder.length ? cfg.groupOrder.slice() : currentGroupOrder()).filter(x => x !== g);
  for (const x of allGroupNames()) if (!order.includes(x) && x !== g) order.push(x);
  const i = order.indexOf(target); order.splice(i < 0 ? order.length : i, 0, g); cfg.groupOrder = order; saveCfg(); renderLib();
}
function deleteGroup(g) {
  const devs = allLib().filter(d => groupOf(d) === g && d.cat !== 'shape');
  if (!devs.length) { cfg.groupsExtra = (cfg.groupsExtra || []).filter(x => x !== g); cfg.groupOrder = (cfg.groupOrder || []).filter(x => x !== g); saveCfg(); renderLib(); return toast(`Группа «${g}» удалена`); }
  const others = allGroupNames().filter(x => x !== g && x !== groupOf({ cat: 'shape' }));
  openModal(`Удалить группу «${g}»`, `<p>В группе устройств: <b>${devs.length}</b>. Что с ними сделать?</p>
    <div class="fld"><label><input type="radio" name="dg" value="move" checked> Перенести в группу:</label><select id="dgTo">${others.map(x => `<option>${esc(x)}</option>`).join('')}</select></div>
    <div class="fld"><label><input type="radio" name="dg" value="del"> Удалить устройства вместе с группой (можно будет вернуть сразу после)</label></div>
    <div class="btns"><button class="pri" id="dgOk">Удалить группу</button><button id="dgNo">Отмена</button></div>`);
  $('#dgNo').onclick = closeModal;
  $('#dgOk').onclick = () => {
    const mode = document.querySelector('input[name=dg]:checked').value, to = $('#dgTo').value; closeModal();
    cfg.groupsExtra = (cfg.groupsExtra || []).filter(x => x !== g); cfg.groupOrder = (cfg.groupOrder || []).filter(x => x !== g);
    if (mode === 'move') moveToGroup(devs, to); else deleteDevices(devs);
    saveCfg(); renderLib();
  };
}
function pickGroup(list) {
  const names = allGroupNames().filter(x => x !== groupOf({ cat: 'shape' }));
  openModal(`Переместить в группу (${list.length})`, `<div class="fld"><label>Группа</label><select id="pgSel">${names.map(x => `<option>${esc(x)}</option>`).join('')}</select></div>
    <div class="fld"><label>…или новая группа</label><input id="pgNew" placeholder="название новой группы"></div>
    <div class="btns"><button class="pri" id="pgOk">Переместить</button><button id="pgNo">Отмена</button></div>`);
  $('#pgNo').onclick = closeModal;
  $('#pgOk').onclick = () => { const g = $('#pgNew').value.trim() || $('#pgSel').value; const back = baseOpen; closeModal(); moveToGroup(list, g); if (back) baseManager(); };
}
// порядок устройств внутри группы (перетаскиванием)
function sortByDevOrder(g, list) {
  const ord = (cfg.devOrder || {})[g]; if (!ord || !ord.length) return list;
  const pos = new Map(ord.map((id, i) => [id, i])), base = new Map(list.map((d, i) => [d.id, i]));
  return list.sort((a, b) => (pos.has(a.id) ? pos.get(a.id) : 1e6 + base.get(a.id)) - (pos.has(b.id) ? pos.get(b.id) : 1e6 + base.get(b.id)));
}
function placeDevice(devId, g, targetId, after) {
  let d = libById(devId); if (!d) return;
  if (groupOf(d) !== g) { const before = customLib.length; moveToGroup([d], g); d = customLib.length > before ? customLib[customLib.length - 1] : libById(devId); }
  if (!d || d.id === targetId) return renderLib();
  const ids = sortByDevOrder(g, allLib().filter(x => groupOf(x) === g)).map(x => x.id).filter(id => id !== d.id);
  let i = ids.indexOf(targetId); i = i < 0 ? ids.length : i + (after ? 1 : 0);
  ids.splice(i, 0, d.id);
  cfg.devOrder = { ...(cfg.devOrder || {}), [g]: ids }; saveCfg(); renderLib();
}
const insAfter = (it, ev) => { const r = it.getBoundingClientRect(); return cfg.libView === 'grid' ? ev.clientX > r.left + r.width / 2 : ev.clientY > r.top + r.height / 2; };
// предпросмотр устройства при наведении (режим значков)
let libPrevT = 0;
function hideLibPreview() { clearTimeout(libPrevT); const p = $('#libPreview'); if (p) p.classList.remove('on'); }
function showLibPreview(it) {
  const d = libById(it.dataset.dev); if (!d) return;
  let p = $('#libPreview'); if (!p) { p = document.createElement('div'); p.id = 'libPreview'; document.body.appendChild(p); }
  const k = artKey(d.cat), pic = d.img ? `<img src="${d.img.src}" alt="">` : d.cat !== 'shape' && ART[k] ? `<svg viewBox="0 0 ${ART[k].w} ${ART[k].h}"><use href="#art-${k}"/></svg>` : '';
  p.innerHTML = `<div class="pv">${pic}</div><div class="pt"><b>${esc(d.model)}</b><span>${esc(d.maker && d.maker !== 'Generic' ? d.maker + ' · ' : '')}${esc(roleOf(d))}</span><small>${esc(portSummary(d))}</small></div>`;
  const r = it.getBoundingClientRect(), lib = $('#lib').getBoundingClientRect();
  p.classList.add('on');
  const h = p.offsetHeight, top = Math.max(8, Math.min(window.innerHeight - h - 8, r.top + r.height / 2 - h / 2));
  p.style.left = (lib.right + 10) + 'px'; p.style.top = top + 'px';
}
function renderLib() {
  $('#libList').classList.toggle('grid', cfg.libView === 'grid');
  document.querySelectorAll('[data-libview]').forEach(b => b.classList.toggle('on', (cfg.libView || 'list') === b.dataset.libview));
  hideLibPreview();
  const q = $('#libSearch').value.trim().toLowerCase();
  const tf = [...typeFilter].filter(k => k !== 'photo');
  const all = allLib().filter(d => devMatches(d, q) && (!typeFilter.has('photo') || d.img) && (!tf.length || d.ports.some(p => typeFilter.has(p.type) || (typeFilter.has('sdi3g') && T[p.type].fam === 'sdi' && p.type !== 'sdi12g') || (typeFilter.has('hdmi') && T[p.type].fam === 'hdmi') || (typeFilter.has('dp') && T[p.type].fam === 'dp') || (typeFilter.has('fiber') && T[p.type].fam === 'fiber'))));
  const groups = [['fav', '★ Избранное', all.filter(d => favs.has(d.id))]];
  const gmap = new Map();
  for (const d of all) { const g = groupOf(d); if (!gmap.has(g)) gmap.set(g, []); gmap.get(g).push(d); }
  for (const [g, list] of gmap) sortByDevOrder(g, list);
  const order = (cfg.groupOrder || []).slice();
  for (const g of customLib.map(groupOf)) if (!order.includes(g)) order.push(g);
  for (const c of Object.keys(CATS)) { const n = groupOf({ cat: c }); if (!order.includes(n)) order.push(n); }
  for (const g of gmap.keys()) if (!order.includes(g)) order.push(g);
  for (const g of cfg.groupsExtra || []) if (!order.includes(g)) order.push(g);
  const extra = new Set(cfg.groupsExtra || []);
  for (const g of order) if (gmap.has(g) || extra.has(g)) groups.push([g, g, gmap.get(g) || []]);
  const searching = q || typeFilter.size;
  $('#libList').innerHTML = groups.filter(g => g[2].length || (!searching && (g[0] === 'fav' || extra.has(g[0])))).map(([c, name, list]) => {
    const open = searching || openCats.has(c);
    return `<div class="cat${open ? '' : ' closed'}" data-cat="${esc(c)}"><div class="catH"${c !== 'fav' ? ' draggable="true" title="Перетащите, чтобы изменить порядок · правый клик — меню группы"' : ''}><span class="arr">▼</span>${esc(name)}<span class="cnt">${list.length}</span></div><div class="items">`
      + (list.length ? list.map(d => itemHTML(d)).join('') : `<div class="small muted" style="padding:2px 12px 6px">${c === 'fav' ? 'Нажмите ★ у устройства, чтобы добавить сюда' : 'Пустая группа — перетащите сюда устройства'}</div>`) + '</div></div>';
  }).join('') || `<div class="muted" style="padding:12px;line-height:1.5">${customLib.length || q ? 'Ничего не найдено' : 'Ваша база пуста.<br>Нажмите «＋ Своё устройство» или просто перетащите фото устройства сюда.'}</div>`;
}
$('#libSearch').addEventListener('input', renderLib);
// переключатель «список / значки» и предпросмотр при наведении
document.addEventListener('click', ev => { const b = ev.target.closest('[data-libview]'); if (!b) return; cfg.libView = b.dataset.libview; saveCfg(); renderLib(); });
$('#libList').addEventListener('mouseover', ev => {
  if (cfg.libView !== 'grid') return; const it = ev.target.closest('.item'); if (!it) return;
  clearTimeout(libPrevT); libPrevT = setTimeout(() => showLibPreview(it), 120);
});
$('#libList').addEventListener('mouseout', ev => { const it = ev.target.closest('.item'); if (it && !it.contains(ev.relatedTarget)) hideLibPreview(); });
$('#libList').addEventListener('scroll', hideLibPreview, { passive: true });
$('#libList').addEventListener('dragstart', hideLibPreview);
// ширина левой панели: тянуть за край, двойной клик — сброс
(() => {
  const app = $('#app'), h = $('#libResize'); if (!h) return;
  const setW = w => { if (w) app.style.setProperty('--libW', w + 'px'); else app.style.removeProperty('--libW'); window.dispatchEvent(new Event('resize')); };
  const saved = store.get('libW', 0); if (saved) setW(saved);
  h.addEventListener('pointerdown', ev => {
    ev.preventDefault(); h.setPointerCapture(ev.pointerId); h.classList.add('on');
    const x0 = ev.clientX, w0 = $('#lib').getBoundingClientRect().width;
    const mv = e => setW(Math.round(Math.max(220, Math.min(window.innerWidth * 0.6, w0 + e.clientX - x0))));
    const up = () => { h.classList.remove('on'); h.removeEventListener('pointermove', mv); h.removeEventListener('pointerup', up); store.set('libW', Math.round($('#lib').getBoundingClientRect().width)); };
    h.addEventListener('pointermove', mv); h.addEventListener('pointerup', up);
  });
  h.addEventListener('dblclick', () => { store.set('libW', 0); setW(0); });
})();
$('#libBuiltin').checked = cfg.builtin;
$('#libBuiltin').addEventListener('change', ev => { cfg.builtin = ev.target.checked; saveCfg(); renderLib(); });
$('#libTypeFilter').addEventListener('click', ev => { const s = ev.target.closest('[data-tf]'); if (!s) return; const k = s.dataset.tf; typeFilter.has(k) ? typeFilter.delete(k) : typeFilter.add(k); renderTypeFilter(); renderLib(); });
function onFavClick(ev) {
  const f = ev.target.closest('[data-fav]'); if (!f) return false;
  const id = f.dataset.fav; favs.has(id) ? favs.delete(id) : favs.add(id); store.set('favs', [...favs]); renderLib(); if (quick) renderQuick(); return true;
}
let libAddN = 0;
$('#libList').addEventListener('click', ev => {
  if (onFavClick(ev)) return;
  const ed = ev.target.closest('[data-edt]'); if (ed) return editDevice(libById(ed.dataset.edt));
  const h = ev.target.closest('.catH');
  if (h) { const c = h.parentNode.dataset.cat; openCats.has(c) ? openCats.delete(c) : openCats.add(c); store.set('openCats', [...openCats]); h.parentNode.classList.toggle('closed'); return; }
  const it = ev.target.closest('.item'); if (!it) return;
  const r = stage.getBoundingClientRect(); const c = toDoc(r.left + r.width / 2, r.top + r.height / 2);
  libAddN = (libAddN + 1) % 8;
  const n = addNode(libById(it.dataset.dev), c.x - 90 + libAddN * 20, c.y - 60 + libAddN * 20);
  selectOnly([n.id]); markDirty();
});
$('#quickList').addEventListener('mousedown', ev => { if (ev.target.closest('[data-fav]')) { ev.preventDefault(); onFavClick(ev); } });
let libDragGroup = null;
$('#libList').addEventListener('dragstart', ev => {
  const h = ev.target.closest && ev.target.closest('.catH');
  if (h) { libDragGroup = h.parentNode.dataset.cat; ev.dataTransfer.setData('text/sf-group', libDragGroup); ev.dataTransfer.effectAllowed = 'move'; return; }
  libDragGroup = null;
});
$('#libList').addEventListener('dragover', ev => {
  const cat = ev.target.closest && ev.target.closest('.cat'); if (!cat || cat.dataset.cat === 'fav') return;
  const t = ev.dataTransfer.types;
  if (t.includes('text/sf-dev') || t.includes('text/sf-group')) {
    ev.preventDefault(); ev.dataTransfer.dropEffect = 'move';
    document.querySelectorAll('#libList .catH.drop, #libList .insB, #libList .insA').forEach(x => x.classList.remove('drop', 'insB', 'insA'));
    const it = t.includes('text/sf-dev') && ev.target.closest('.item');
    if (it) { it.classList.add(insAfter(it, ev) ? 'insA' : 'insB'); }
    else cat.querySelector('.catH').classList.add('drop');
  }
});
const clearLibDrop = () => document.querySelectorAll('#libList .catH.drop, #libList .insB, #libList .insA').forEach(x => x.classList.remove('drop', 'insB', 'insA'));
$('#libList').addEventListener('dragleave', ev => { if (!ev.relatedTarget || !$('#libList').contains(ev.relatedTarget)) clearLibDrop(); });
$('#libList').addEventListener('dragend', clearLibDrop);
$('#libList').addEventListener('drop', ev => {
  clearLibDrop();
  const cat = ev.target.closest && ev.target.closest('.cat'); if (!cat || cat.dataset.cat === 'fav') return;
  const g = cat.dataset.cat, dev = ev.dataTransfer.getData('text/sf-dev'), grp = ev.dataTransfer.getData('text/sf-group');
  const it = dev && ev.target.closest('.item');
  if (it) { ev.preventDefault(); ev.stopPropagation(); placeDevice(dev, g, it.dataset.dev, insAfter(it, ev)); return; }
  if (dev) { ev.preventDefault(); ev.stopPropagation(); const d = libById(dev); if (d && groupOf(d) !== g) moveToGroup([d], g); return; }
  if (grp && grp !== g) { ev.preventDefault(); ev.stopPropagation(); placeGroupBefore(grp, g); }
});
$('#libList').addEventListener('dragstart', ev => { const it = ev.target.closest('.item'); if (!it) return; ev.dataTransfer.setData('text/sf-dev', it.dataset.dev); ev.dataTransfer.effectAllowed = 'copyMove'; });
$('#libList').addEventListener('contextmenu', ev => {
  const h = ev.target.closest('.catH');
  if (h) {
    ev.preventDefault(); const g = h.parentNode.dataset.cat; if (g === 'fav') return;
    return showCtx(ev.clientX, ev.clientY, [
      ['Переименовать группу…', () => renameGroup(g)], ['＋ Новая группа…', () => newGroup(g)], ['＋ Новое устройство в эту группу…', () => deviceEditor({ id: null, cat: 'my', group: g, maker: '', model: '', ports: [] })],
      '-', ['Выше', () => moveGroup(g, -1)], ['Ниже', () => moveGroup(g, 1)],
      '-', ['Развернуть все группы', () => { allGroupNames().forEach(x => openCats.add(x)); store.set('openCats', [...openCats]); renderLib(); }], ['Свернуть все группы', () => { openCats.clear(); store.set('openCats', []); renderLib(); }],
      '-', ['Удалить группу…', () => deleteGroup(g)]]);
  }
  const it = ev.target.closest('.item'); if (!it) return; ev.preventDefault();
  const d = libById(it.dataset.dev), custom = customLib.includes(d);
  showCtx(ev.clientX, ev.clientY, [
    ['Добавить на схему', () => it.click()],
    ['Изменить (фото, порты, название)…', () => editDevice(d)],
    ['Копия как новое устройство…', () => deviceEditor({ ...JSON.parse(JSON.stringify(d)), id: null, model: d.model + ' (копия)' })],
    ['Переместить в группу…', () => pickGroup([d])],
    ['Удалить из базы', () => deleteDevices([d])],
    '-', ['Вся база — редактор…', () => baseManager()],
  ]);
});
stage.addEventListener('dragover', ev => { if (ev.dataTransfer.types.includes('text/sf-dev')) { ev.preventDefault(); ev.dataTransfer.dropEffect = 'copy'; } });
stage.addEventListener('drop', ev => {
  const id = ev.dataTransfer.getData('text/sf-dev'); if (!id) return; ev.preventDefault();
  const p = toDoc(ev.clientX, ev.clientY); const n = addNode(libById(id), p.x - 20, p.y - 20); selectOnly([n.id]); markDirty();
});

// ============================================================================
//  ПАНЕЛЬ СВОЙСТВ
// ============================================================================
const typeOpts = cur => TYPE_KEYS.map(k => `<option value="${k}"${k === cur ? ' selected' : ''}>${esc(T[k].n)}</option>`).join('');
const dirOpts = cur => [['in', 'Вход'], ['out', 'Выход'], ['io', '⇄ Двунапр.']].map(([v, n]) => `<option value="${v}"${v === cur ? ' selected' : ''}>${n}</option>`).join('');
const FORMATS = ['720p50', '1080i50', '1080p25', '1080p50', '1080p60', '2160p25', '2160p50', '2160p60', '3840x2160', '1920x1080', '1280x720'];
function fld(label, key, val, opt = {}) {
  const a = `data-k="${key}"${opt.focus ? ' data-focus="1"' : ''}${opt.list ? ` list="${opt.list}"` : ''}`;
  const input = opt.area ? `<textarea ${a} rows="${opt.rows || 3}">${esc(val)}</textarea>`
    : opt.select ? `<select ${a}>${opt.select}</select>`
      : `<input ${a} value="${esc(val)}" type="${opt.type || 'text'}"${opt.ph ? ` placeholder="${esc(opt.ph)}"` : ''}>`;
  return `<div class="fld"><label>${label}</label>${input}</div>`;
}
// автоназвание порта: «HDMI IN 2», «3G-SDI OUT 1», «LAN 1» — номер по порядку среди портов того же типа и направления
const portBase = (t, dir) => { const s = T[t] ? (T[t].fam === 'sdi' ? T[t].n : (T[t].s || 'Связь')) : 'Порт'; return dir === 'in' ? `${s} In` : dir === 'out' ? `${s} Out` : s; };
function renumberPorts(ports) {
  const cnt = {};
  for (const p of ports) { const k = p.type + '|' + p.dir; cnt[k] = (cnt[k] || 0) + 1; if (p.auto) p.name = `${cnt[k]} - ${portBase(p.type, p.dir)}`; }
}
function portsTable(ports) {
  return `<table class="ports"><thead><tr><th>Направление</th><th>Тип сигнала</th><th title="Ставится само. Клик — задать своё">Название</th><th></th></tr></thead><tbody>` + ports.map((p, i) => `<tr data-pi="${i}"><td style="width:30%"><select data-pk="dir">${dirOpts(p.dir)}</select></td><td style="width:36%"><select data-pk="type">${typeOpts(p.type)}</select></td><td class="pn" data-pren="${i}" title="Клик — своё название">${esc(p.name)}</td><td class="x" data-pdel="${i}" title="Удалить порт">✕</td></tr>`).join('') + '</tbody></table>'
    + `<div class="btns"><button data-padd="in">＋ Вход</button><button data-padd="out">＋ Выход</button><button data-padd="bulk">＋ Несколько…</button></div>`;
}
function startPortRename(t) {
  const pn = t.closest && t.closest('[data-pren]'); if (!pn || pn.querySelector('input')) return !!pn;
  pn.innerHTML = `<input data-pk="name" value="${esc(pn.textContent)}">`;
  const i = pn.querySelector('input'); i.focus(); i.select();
  i.onkeydown = e => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); i.blur(); } };
  return true;
}
function renderProps() {
  const el = $('#props');
  const list = [...sel].map(id => items.get(id)).filter(Boolean);
  if (!list.length) return renderDocProps(el);
  if (list.length > 1) {
    const ns = list.filter(x => x.k === 'n');
    el.innerHTML = `<h3>Выделено: ${list.length}</h3><div class="small muted">Устройств: ${ns.length}, кабелей: ${list.filter(x => x.k === 'e').length}</div>
      <h4>Выравнивание</h4><div class="btns"><button data-al="l" title="По левому краю">⇤</button><button data-al="cx" title="По центру">⇹</button><button data-al="r" title="По правому краю">⇥</button><button data-al="t" title="По верху">⤒</button><button data-al="cy" title="По середине">⇳</button><button data-al="b" title="По низу">⤓</button></div>
      <div class="btns"><button data-al="dh">Распределить ↔</button><button data-al="dv">Распределить ↕</button></div>
      ${ns.length ? `<h4>Для всех устройств</h4>${fld('Помещение / рэк', 'mloc', '', { ph: 'например: Аппаратная, рэк 2' })}<div class="btns"><button data-act="flip">⇆ Зеркально (R)</button><button data-act="frameSel">▢ Обвести зоной</button></div>` : ''}
      <div class="btns"><button data-act="dup">Дублировать</button><button data-act="del">Удалить</button></div>`;
    return;
  }
  const it = list[0];
  if (it.k === 'n') return renderNodeProps(el, it.o);
  if (it.k === 'e') return renderEdgeProps(el, it.o);
  if (it.k === 'f') {
    const f = it.o;
    el.innerHTML = `<h3>▢ Зона</h3>${fld('Название', 'title', f.title, { focus: 1 })}${fld('Цвет', 'color', f.color || '#2563eb', { type: 'color' })}
      <div class="small muted">Перетаскивайте за заголовок — устройства внутри поедут вместе (Alt — двигать только рамку). Угол справа внизу — размер.</div><div class="btns"><button data-act="del">Удалить зону</button></div>`;
    return;
  }
  if (it.k === 't') {
    const t = it.o;
    el.innerHTML = `<h3>T Текст</h3>${fld('Текст', 'text', t.text, { area: 1, rows: 4, focus: 1 })}<div class="row">${fld('Размер', 'size', t.size || 14, { type: 'number' })}${fld('Цвет', 'color', t.color || '#111827', { type: 'color' })}</div>
      <label class="small"><input type="checkbox" data-k="bold"${t.bold ? ' checked' : ''}> Жирный</label><div class="btns"><button data-act="del">Удалить</button></div>`;
  }
}
function renderNodeProps(el, n) {
  const cat = CATS[n.cat] || CATS.my;
  if (n.shape) {
    el.innerHTML = `<h3>▢ Фигура</h3>${fld('Текст (Enter — новая строка)', 'label', n.label, { area: 1, rows: 2, focus: 1 })}
      <div class="row">${fld('Заливка', 'fill', n.fill || '#ffffff', { type: 'color' })}${fld('Обводка', 'stroke', n.stroke || '#1f2937', { type: 'color' })}</div>
      <div class="row">${fld('Форма', 'shape', '', { select: SHAPE_KINDS.map(([v, t]) => `<option value="${v}"${v === n.shape ? ' selected' : ''}>${t}</option>`).join('') })}${fld('Шрифт', 'fs', n.fs || 14, { type: 'number' })}</div>
      <div class="row">${fld('Ширина', 'sw', layout(n).w, { type: 'number' })}${fld('Высота', 'sh', layout(n).ih, { type: 'number' })}</div>
      ${SHAPE_P[n.shape] != null ? `<div class="fld"><label>${{ round: 'Скругление углов', barrow: 'Длина наконечника', lthick: 'Длина наконечника', doc: 'Волна', tape: 'Волна', tri: 'Положение вершины', lstep: 'Место излома', process: 'Ширина полос' }[n.shape] || 'Наклон / глубина'}</label><input type="range" data-k="sp" min="0" max="1" step="0.01" value="${n.sp ?? SHAPE_P[n.shape]}"></div>` : ''}
      ${SHAPE_Q[n.shape] != null ? `<div class="fld"><label>Толщина стрелы</label><input type="range" data-k="sq" min="0.1" max="1" step="0.01" value="${n.sq ?? SHAPE_Q[n.shape]}"></div>` : ''}
      <div class="btns"><button data-act="rot">↻ Повернуть 90°</button><button data-act="flipH">⇆ Отразить</button><button data-act="flipV">⇅ Отразить</button>${n.sp != null || n.sq != null || n.rot || n.flipH || n.flipV ? '<button data-act="shReset">Сбросить форму</button>' : ''}</div>
      <div class="small muted">Жёлтые ромбики на выделенной фигуре — изменить форму. Уголок справа внизу — размер. Синие кружки при наведении — соединить.</div>
      <div class="btns"><button data-act="dup">Дублировать</button><button data-act="del">Удалить</button></div>`;
    return;
  }
  const conns = n.ports.map(p => {
    const e = portUse.get(n.id + ':' + p.id); if (!e) return '';
    const other = e.from.n === n.id ? e.to : e.from; const on = node(other.n), op = on && portOf(on, other.p);
    const arrow = e.from.n === n.id ? '→' : '←';
    return `<tr class="clk" data-goto="${e.id}"><td><span class="dot" style="background:${T[e.type].c}"></span></td><td>${esc(p.name)}</td><td>${arrow}</td><td><b>${esc(on && on.label)}</b> ${esc(op && op.name)}</td><td class="muted">${esc(e.label)}</td></tr>`;
  }).join('');
  el.innerHTML = `<h3><span class="dot" style="background:${n.color || cat.c}"></span>${esc(cat.n)}</h3>
    ${fld('Обозначение (номер)', 'label', n.label, { focus: 1 })}
    ${fld('Подпись под картинкой', 'role', n.role || '', { ph: roleOf({ ...n, role: '' }) })}
    ${fld('Дополнительная подпись', 'note', n.note || '', { ph: 'например: главный экран, проекция, запись' })}
    <div class="row">${fld('Производитель', 'maker', n.maker)}${fld('Модель', 'model', n.model)}</div>
    ${fld('Помещение / рэк / позиция', 'loc', n.loc, { ph: 'Аппаратная, рэк 2, U14', list: 'locList' })}
    ${fld('Примечание', 'notes', n.notes, { area: 1, rows: 2 })}
    ${isPic() ? fld('Ширина картинки на схеме', 'pw', layout(n).w, { type: 'number' }) : ''}
    <div class="row">${fld('Цвет шапки', 'color', n.color || cat.c, { type: 'color' })}<div class="fld"><label>&nbsp;</label><button data-act="flip">⇆ Зеркально (R)</button></div></div>
    <h4>Фото</h4>${n.img && doc.images[n.img] ? `<img class="propImg" src="${doc.images[n.img].src}">` : '<div class="small muted">Нет фото. Выделите устройство и вставьте картинку Ctrl+V или перетащите файл на блок.</div>'}<div class="btns"><button data-act="photo">${n.img ? 'Заменить фото' : 'Добавить фото'}</button>${n.img ? '<button data-act="photoDel">Убрать</button>' : ''}</div>
    <h4>Порты (${n.ports.length})</h4>${portsTable(n.ports)}
    ${conns ? `<h4>Подключения</h4><table class="grid">${conns}</table>` : ''}
    <div class="btns" style="margin-top:12px"><button data-act="dup">Дублировать</button><button data-act="toLib">★ Сохранить в базу</button><button data-act="del">Удалить</button></div>
    <datalist id="locList">${[...new Set(doc.pages.flatMap(pg => pg.nodes.map(x => x.loc)).filter(Boolean))].map(l => `<option value="${esc(l)}">`).join('')}</datalist>`;
}
function renderEdgeProps(el, e) {
  const a = node(e.from.n), b = node(e.to.n), pa = portOf(a, e.from.p), pb = portOf(b, e.to.p);
  const st = edgeStatus(e);
  let conv = '';
  if (st[0] < 2) {
    const list = convertersFor(e.type, pb.type).slice(0, 6);
    conv = `<div class="${st[0] === 0 ? 'badbox' : 'warnbox'}">⚠ ${esc(st[1])}</div>` + (list.length ? `<div class="small muted">Вставить в разрыв:</div><div class="btns">${list.map(d => `<button data-conv="${d.id}" title="${esc(d.maker)}">${esc(d.model)}</button>`).join('')}</div>` : '');
  }
  el.innerHTML = `<h3><span class="dot" style="background:${e.color || T[e.type].c}"></span>Кабель</h3>
    <div class="small" style="margin-bottom:10px;line-height:1.6"><b>${esc(a.label)}</b> · ${esc(pa.name)}<br>→ <b>${esc(b.label)}</b> · ${esc(pb.name)}</div>${conv}
    ${fld('Номер / маркировка', 'label', e.label, { focus: 1 })}
    ${fld('Подпись на схеме (вместо авто)', 'caption', e.caption || '', { ph: 'например: cat 5, hdmi 1920x1080' })}
    ${fld('Тип сигнала', 'type', '', { select: typeOpts(e.type) })}
    <div class="row">${fld('Формат', 'fmt', e.fmt, { list: 'fmtList', ph: '1080p50' })}${fld('Длина, м', 'len', e.len, { type: 'number' })}</div>
    ${fld('Примечание', 'notes', e.notes, { area: 1, rows: 2 })}
    ${fld('Свой цвет', 'color', e.color || T[e.type].c, { type: 'color' })}
    <div class="btns"><button data-act="resetColor">Цвет по типу</button><button data-act="resetBend">Сбросить изгибы</button>${pa.dir === 'io' && pb.dir === 'io' ? '<button data-act="reverse">⇄ Направление</button>' : ''}<button data-act="del">Удалить</button></div>
    <div class="small muted" style="margin-top:8px">Перетащите конец кабеля за порт, чтобы переключить его.<br>Изгибы, как в draw.io: потяните линию или ручку на участке — участок сдвинется параллельно, углы останутся прямыми. Верните участок на одну линию с соседним — лишний изгиб исчезнет. «Сбросить изгибы» — автопрокладка.</div>
    <datalist id="fmtList">${FORMATS.map(f => `<option value="${f}">`).join('')}</datalist>`;
}
function renderDocProps(el) {
  const used = {}; let bad = 0;
  for (const pg of doc.pages) for (const e of pg.edges) used[e.type] = (used[e.type] || 0) + 1;
  for (const e of P.edges) if (e._st === 0) bad++;
  el.innerHTML = `<h3>Проект</h3>${fld('Название', 'docname', doc.name)}${fld('Автор / инженер', 'author', doc.author)}
    <h4>Лист «${esc(P.name)}»</h4>
    <div class="stat"><span>Устройств</span><b>${P.nodes.length}</b></div><div class="stat"><span>Кабелей</span><b>${P.edges.length}</b></div>
    <div class="stat"><span>Несовместимых соединений</span><b style="color:${bad ? 'var(--bad)' : ''}">${bad}</b></div>
    ${Object.keys(used).length ? `<h4>Сигналы в проекте</h4><div class="legend">${Object.entries(used).map(([k, v]) => `<i style="background:${T[k].c}"></i><span>${esc(T[k].n)} — ${v}</span>`).join('')}</div>` : ''}
    <h4>Как работать</h4><div class="small muted" style="line-height:1.55">
    • Перетащите устройство из библиотеки или <b>дважды кликните</b> по холсту — быстрый поиск.<br>
    • Тяните от <b>порта</b> к порту или просто на устройство — порт подберётся сам. Отпустите в пустоте — предложит совместимое устройство и подключит его.<br>
    • Зелёные порты — совместимы, оранжевые — с оговоркой.<br>
    • Тяните за конец существующего кабеля — перекоммутация.<br>
    • <b>Пробел</b>+мышь или средняя кнопка — панорама; колесо — масштаб.<br>
    • Z — зона, T — текст, R — зеркально, F — показать всё.</div>`;
}
function convertersFor(ft, tt) {
  return allLib().filter(d => ['conv', 'da', 'ext', 'enc', 'aud'].includes(d.cat)
    && d.ports.some(p => p.dir !== 'out' && compat(ft, p.type)[0] === 2) && d.ports.some(p => p.dir !== 'in' && compat(p.type, tt)[0] === 2));
}
function insertConverter(e, devId) {
  const dev = libById(devId); hist();
  const a = portPos(e.from), b = portPos(e.to);
  const n = addNode(dev, (a.x + b.x) / 2 - 90, (a.y + b.y) / 2 - 40, true);
  n.label = nextLabel('conv');
  const pin = n.ports.find(p => p.dir !== 'out' && compat(e.type, p.type)[0] === 2);
  const pb = portOf(node(e.to.n), e.to.p);
  const pout = n.ports.find(p => p.dir !== 'in' && p !== pin && compat(p.type, pb.type)[0] === 2);
  const oldTo = e.to;
  e.to = { n: n.id, p: pin.id }; delete e.mx; delete e.my;
  reindex();
  const e2 = { id: uid(), from: { n: n.id, p: pout.id }, to: oldTo, type: pout.type, label: nextCable(pout.type), fmt: e.fmt || '', len: '' };
  P.edges.push(e2);
  renderAll(); selectOnly([n.id]); markDirty();
  toast('Конвертер вставлен: ' + dev.model);
}

// изменения в панели свойств — с одной точкой отмены на поле
let editing = null;
$('#props').addEventListener('focusin', () => { editing = null; });
$('#props').addEventListener('input', ev => propChange(ev, false));
$('#props').addEventListener('change', ev => propChange(ev, true));
function propChange(ev, commit) {
  const t = ev.target; const key = t.dataset.k, pk = t.dataset.pk;
  if (!key && !pk) return;
  if (key === 'docname') { doc.name = t.value; $('#docName').value = t.value; markDirty(); return; }
  if (key === 'author') { doc.author = t.value; markDirty(); return; }
  if (editing !== t) { hist(); editing = t; }
  const val = t.type === 'checkbox' ? t.checked : t.value;
  const list = [...sel].map(id => items.get(id)).filter(Boolean);
  if (key === 'mloc') { for (const x of list) if (x.k === 'n') { x.o.loc = val; rerenderItem(x.o.id); } markDirty(); return; }
  const it = list[0]; if (!it) return;
  const o = it.o;
  if (pk) {
    const i = +t.closest('tr').dataset.pi; const p = o.ports[i];
    p[pk] = val;
    if (pk === 'type' && T[val].fam === 'eth') { p.dir = 'io'; }
    if (pk === 'name') delete p.auto; else { p.auto = true; renumberPorts(o.ports); }
    if (pk === 'dir' || pk === 'type') { const e = portUse.get(o.id + ':' + p.id); if (e && e.from.n === o.id && e.from.p === p.id) e.type = p.type; }
    rerenderItem(o.id); markDirty(); if (commit) renderProps(); return;
  }
  if (key === 'size') o.size = +val || 14;
  else if (key === 'sp' || key === 'sq') o[key] = +val;
  else if (['pw', 'sw', 'sh', 'fs'].includes(key)) { if (+val > 0) o[key] = +val; else delete o[key]; }
  else if (key === 'len') o.len = val;
  else o[key] = val;
  if (it.k === 'e' && key === 'type') o.color = o.color && o.color !== T[o.type].c ? o.color : undefined;
  rerenderItem(o.id); renderOverlay(); markDirty();
  if (commit && (key === 'type' || key === 'color' || key === 'shape')) renderProps();
}
$('#props').addEventListener('click', ev => {
  const t = ev.target;
  const list = [...sel].map(id => items.get(id)).filter(Boolean); const it = list[0];
  if (startPortRename(t)) return;
  if (t.dataset.al) return align(t.dataset.al);
  if (t.dataset.conv) return insertConverter(it.o, t.dataset.conv);
  const gt = t.closest('[data-goto]'); if (gt) return goTo(gt.dataset.goto);
  if (t.dataset.pdel != null) { hist(); const n = it.o; const p = n.ports[+t.dataset.pdel]; const e = portUse.get(n.id + ':' + p.id); n.ports.splice(+t.dataset.pdel, 1); if (e) P.edges = P.edges.filter(x => x !== e); renderAll(); return; }
  if (t.dataset.padd) {
    const n = it.o;
    if (t.dataset.padd === 'bulk') return bulkPorts(ps => { hist(); n.ports.push(...ps); renumberPorts(n.ports); rerenderItem(n.id); renderProps(); markDirty(); });
    hist(); const dir = t.dataset.padd, type = (n.ports.find(p => p.dir === dir) || n.ports[0] || { type: 'sdi3g' }).type;
    n.ports.push({ id: uid(), name: '', type, dir: T[type].fam === 'eth' ? 'io' : dir, auto: true }); renumberPorts(n.ports);
    rerenderItem(n.id); renderProps(); markDirty(); return;
  }
  const act = t.dataset.act; if (!act) return;
  if (act === 'rot' || act === 'flipH' || act === 'flipV' || act === 'shReset') {
    const n = it.o, L = layout(n); hist();
    if (act === 'rot') { n.rot = ((n.rot || 0) + 90) % 360; n.sw = L.ih; n.sh = L.w; }
    if (act === 'flipH') n.flipH = !n.flipH;
    if (act === 'flipV') n.flipV = !n.flipV;
    if (act === 'shReset') { delete n.sp; delete n.sq; if (n.rot % 180) { n.sw = L.ih; n.sh = L.w; } delete n.rot; delete n.flipH; delete n.flipV; }
    rerenderItem(n.id); renderOverlay(); renderProps(); markDirty(); return;
  }
  if (act === 'del') deleteSel();
  if (act === 'dup') { copySel(); paste(); }
  if (act === 'flip') flipSel();
  if (act === 'frameSel') frameAroundSel();
  if (act === 'toLib') deviceEditor(nodeToDev(it.o));
  if (act === 'photo') { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = async () => { if (!i.files[0]) return; const im = await readImage(i.files[0]); hist(); it.o.img = putImage(im); rerenderItem(it.o.id); renderProps(); markDirty(); }; i.click(); }
  if (act === 'photoDel') { hist(); delete it.o.img; rerenderItem(it.o.id); renderProps(); markDirty(); }
  if (act === 'resetColor') { hist(); delete it.o.color; rerenderItem(it.o.id); renderProps(); markDirty(); }
  if (act === 'resetBend') { hist(); delete it.o.mx; delete it.o.my; delete it.o.pmx; delete it.o.pmy; delete it.o.wp; rerenderItem(it.o.id); scheduleRelayout(); renderOverlay(); markDirty(); }
  if (act === 'reverse') { hist(); const e = it.o; [e.from, e.to] = [e.to, e.from]; rerenderItem(e.id); renderProps(); markDirty(); }
});
function align(mode) {
  const list = [...sel].map(id => items.get(id)).filter(x => x && x.k !== 'e');
  if (list.length < 2) return;
  hist();
  const bb = x => x.k === 'n' ? { w: layout(x.o).w, h: layout(x.o).h } : x.k === 'f' ? { w: x.o.w, h: x.o.h } : { w: x.o._w || 50, h: x.o._h || 20 };
  const L = list.map(x => ({ x, o: x.o, ...bb(x) }));
  const minX = Math.min(...L.map(a => a.o.x)), maxX = Math.max(...L.map(a => a.o.x + a.w)), minY = Math.min(...L.map(a => a.o.y)), maxY = Math.max(...L.map(a => a.o.y + a.h));
  if (mode === 'l') L.forEach(a => a.o.x = minX); if (mode === 'r') L.forEach(a => a.o.x = maxX - a.w); if (mode === 'cx') L.forEach(a => a.o.x = Math.round((minX + maxX) / 2 - a.w / 2));
  if (mode === 't') L.forEach(a => a.o.y = minY); if (mode === 'b') L.forEach(a => a.o.y = maxY - a.h); if (mode === 'cy') L.forEach(a => a.o.y = Math.round((minY + maxY) / 2 - a.h / 2));
  if (mode === 'dh') { L.sort((a, b) => a.o.x - b.o.x); const tot = L.reduce((s, a) => s + a.w, 0), gap = (maxX - minX - tot) / (L.length - 1); let x = minX; L.forEach(a => { a.o.x = Math.round(x); x += a.w + gap; }); }
  if (mode === 'dv') { L.sort((a, b) => a.o.y - b.o.y); const tot = L.reduce((s, a) => s + a.h, 0), gap = (maxY - minY - tot) / (L.length - 1); let y = minY; L.forEach(a => { a.o.y = Math.round(y); y += a.h + gap; }); }
  renderAll(); markDirty();
}
function goTo(id) {
  const it = items.get(id); if (!it) return;
  selectOnly([id]);
  if (it.k === 'e') { const b = it.o._bb; centerOn((b[0] + b[2]) / 2, (b[1] + b[3]) / 2); }
  else { const L = it.k === 'n' ? layout(it.o) : { w: 100, h: 40 }; centerOn(it.o.x + L.w / 2, it.o.y + L.h / 2); }
  const g = els.get(id); if (g && it.k === 'n') { g.classList.add('hl'); setTimeout(() => g.classList.remove('hl'), 1200); }
}

// ============================================================================
//  ЗОНЫ И ТЕКСТ
// ============================================================================
function centerDoc() { const r = stage.getBoundingClientRect(); return toDoc(r.left + r.width / 2, r.top + r.height / 2); }
function addFrame() {
  if ([...sel].some(id => items.get(id) && items.get(id).k === 'n')) return frameAroundSel();
  hist(); const c = centerDoc();
  const f = { id: uid(), x: Math.round((c.x - 250) / 10) * 10, y: Math.round((c.y - 150) / 10) * 10, w: 500, h: 300, title: 'Помещение', color: '#2563eb' };
  P.frames.push(f); items.set(f.id, { k: 'f', o: f }); rerenderItem(f.id); selectOnly([f.id]); markDirty();
}
function frameAroundSel() {
  const ns = [...sel].map(id => items.get(id)).filter(x => x && (x.k === 'n' || x.k === 't')); if (!ns.length) return;
  hist();
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const x of ns) { const L = x.k === 'n' ? layout(x.o) : { w: x.o._w, h: x.o._h }; x1 = Math.min(x1, x.o.x); y1 = Math.min(y1, x.o.y); x2 = Math.max(x2, x.o.x + L.w); y2 = Math.max(y2, x.o.y + L.h); }
  const f = { id: uid(), x: x1 - 30, y: y1 - 50, w: x2 - x1 + 60, h: y2 - y1 + 80, title: ns[0].o.loc || 'Зона', color: '#2563eb' };
  P.frames.push(f); items.set(f.id, { k: 'f', o: f }); rerenderItem(f.id); selectOnly([f.id]); markDirty();
}
function addText() {
  hist(); const c = centerDoc();
  const t = { id: uid(), x: Math.round(c.x / 10) * 10, y: Math.round(c.y / 10) * 10, text: 'Текст', size: 16 };
  P.texts.push(t); items.set(t.id, { k: 't', o: t }); rerenderItem(t.id); selectOnly([t.id]); markDirty();
  setTimeout(() => { const f = $('#props [data-focus]'); f && (f.focus(), f.select()); }, 0);
}

// ============================================================================
//  КОНТЕКСТНОЕ МЕНЮ
// ============================================================================
function showCtx(x, y, list) {
  hidePops();
  const c = $('#ctx'); const acts = list.filter(Boolean);
  c.innerHTML = acts.map((a, i) => a === '-' ? '<hr>' : `<a data-i="${i}">${esc(a[0])}</a>`).join('');
  c.classList.remove('hidden');
  c.style.left = Math.min(x, innerWidth - 240) + 'px'; c.style.top = Math.min(y, innerHeight - c.offsetHeight - 8) + 'px';
  c.onclick = ev => { const a = ev.target.closest('[data-i]'); if (a) { hidePops(); acts[+a.dataset.i][1](); } };
}
svg.addEventListener('contextmenu', ev => {
  ev.preventDefault();
  const g = ev.target.closest('[data-id]'); const pt = toDoc(ev.clientX, ev.clientY);
  if (g) {
    const id = g.dataset.id; if (!sel.has(id)) selectOnly([id]);
    const it = items.get(id);
    if (it.k === 'e') {
      const e = it.o, pb = portOf(node(e.to.n), e.to.p);
      const cv = convertersFor(e.type, pb.type).slice(0, 5);
      return showCtx(ev.clientX, ev.clientY, [...cv.map(d => ['Вставить: ' + d.model, () => insertConverter(e, d.id)]), cv.length && '-', ['Сбросить изгибы (автопрокладка)', () => { hist(); delete e.mx; delete e.my; delete e.pmx; delete e.pmy; delete e.wp; rerenderItem(e.id); renderOverlay(); markDirty(); }], ['Удалить кабель', deleteSel]]);
    }
    return showCtx(ev.clientX, ev.clientY, [
      ['Дублировать  Ctrl+D', () => { copySel(); paste(); }], ['Копировать  Ctrl+C', copySel],
      it.k === 'n' && ['Зеркально (входы справа)  R', flipSel], it.k === 'n' && ['Обвести зоной', frameAroundSel],
      it.k === 'n' && ['Сохранить / обновить в базе…', () => deviceEditor(nodeToDev(it.o))],
      ['На передний план', () => toFront(1)], ['На задний план', () => toFront(0)], '-', ['Удалить  Del', deleteSel]]);
  }
  showCtx(ev.clientX, ev.clientY, [
    ['Добавить устройство из базы…', () => openQuick(ev.clientX, ev.clientY, pt)],
    ['＋ Новое устройство здесь (своё, с фото)…', () => deviceEditor({ id: null, cat: 'my', maker: '', model: '', ports: [], _placeAt: pt })],
    '-',
    ['Фигуры…', () => openShapes(ev.clientX, ev.clientY, pt)],
    (clip || store.get('clip', null)) && ['Вставить сюда', () => paste(pt)],
    ['Зона (помещение/рэк)', addFrame], ['Текст', addText], '-', ['Показать всё', () => fit()], ['Выделить всё', () => selectOnly([...P.nodes, ...P.frames, ...P.texts].map(o => o.id))]]);
});
function shapeGridHTML() {
  return SHAPE_KINDS.map(([k, name, w, h]) => `<div class="shb" draggable="true" data-dev="sh_${k}" title="${esc(name)} — клик или перетащите на схему"><svg viewBox="${-3} ${-3} ${w + 6} ${h + 6}" preserveAspectRatio="xMidYMid meet">${shapeSVG(k, w, h, k === 'text' ? 'transparent' : '#ffffff', '#1f2937')}${k === 'text' ? `<text x="${w / 2}" y="${h / 2 + 5}" text-anchor="middle" font-size="15" fill="#111827">Text</text>` : ''}</svg></div>`).join('');
}
let shapesAt = null;
function openShapes(cx, cy, docPt) {
  hidePops(); shapesAt = docPt;
  const p = $('#shapesPop'); p.querySelector('.shGrid').innerHTML = shapeGridHTML(); p.classList.remove('hidden');
  p.style.left = clamp(cx, 8, innerWidth - 250) + 'px'; p.style.top = clamp(cy, 8, innerHeight - 330) + 'px';
}
document.addEventListener('click', ev => {
  const b = ev.target.closest && ev.target.closest('.shb'); if (!b) return;
  const inQuick = !!b.closest('#quick'); const pt = inQuick && quick ? quick.docPt : shapesAt;
  hidePops(); if (pt) placeShape(b.dataset.dev, pt);
});
document.addEventListener('dragstart', ev => { const b = ev.target.closest && ev.target.closest('.shb'); if (b) { ev.dataTransfer.setData('text/sf-dev', b.dataset.dev); ev.dataTransfer.effectAllowed = 'copy'; setTimeout(hidePops, 0); } });
function placeShape(id, pt) {
  const d = BUILTIN_LIB.find(x => x.id === id); if (!d) return;
  const n = addNode(d, pt.x, pt.y); const L = layout(n); n.x = Math.round((pt.x - L.w / 2) / 10) * 10; n.y = Math.round((pt.y - (L.ih || L.h) / 2) / 10) * 10;
  rerenderNode(n); selectOnly([n.id]); markDirty();
}
function toFront(front) {
  hist();
  for (const key of ['nodes', 'frames', 'texts']) {
    const a = P[key].filter(o => sel.has(o.id)), b = P[key].filter(o => !sel.has(o.id));
    P[key] = front ? b.concat(a) : a.concat(b);
  }
  renderAll(); markDirty();
}
function hidePops() { $('#shapesPop').classList.add('hidden'); $('#quick').classList.add('hidden'); $('#ctx').classList.add('hidden'); quick = null; document.querySelectorAll('.menu.open').forEach(m => m.classList.remove('open')); }
document.addEventListener('pointerdown', ev => { if (!ev.target.closest('.pop') && !ev.target.closest('#svg')) hidePops(); });

// ============================================================================
//  СТРАНИЦЫ
// ============================================================================
function renderPages() {
  $('#pages').innerHTML = doc.pages.map((pg, i) => `<div class="pg${i === doc.cur ? ' on' : ''}" data-pg="${i}" title="Двойной клик — переименовать, правый клик — меню">${esc(pg.name)}</div>`).join('') + '<button class="add" data-cmd="addPage" title="Новый лист">＋</button>';
}
$('#pages').addEventListener('click', ev => { const p = ev.target.closest('[data-pg]'); if (p && +p.dataset.pg !== doc.cur) switchPage(+p.dataset.pg); });
$('#pages').addEventListener('dblclick', ev => { const p = ev.target.closest('[data-pg]'); if (p) renamePage(+p.dataset.pg, p); });
$('#pages').addEventListener('contextmenu', ev => {
  const p = ev.target.closest('[data-pg]'); if (!p) return; ev.preventDefault(); const i = +p.dataset.pg;
  showCtx(ev.clientX, ev.clientY - 120, [['Переименовать', () => renamePage(i, p)], ['Дублировать лист', () => { hist(); const c = JSON.parse(JSON.stringify(doc.pages[i], replacer)); c.id = uid(); c.name += ' (копия)'; doc.pages.splice(i + 1, 0, c); switchPage(i + 1); markDirty(); }],
  doc.pages.length > 1 && ['Удалить лист', () => { hist(); doc.pages.splice(i, 1); doc.cur = Math.min(doc.cur, doc.pages.length - 1); P = doc.pages[doc.cur]; switchPage(doc.cur); markDirty(); toast('Лист удалён. Ctrl+Z — вернуть'); }]]);
});
function renamePage(i, el) {
  const inp = document.createElement('input'); inp.value = doc.pages[i].name; inp.style.width = '140px';
  el.replaceWith(inp); inp.focus(); inp.select();
  const done = () => { if (inp.value.trim() && inp.value !== doc.pages[i].name) { hist(); doc.pages[i].name = inp.value.trim(); markDirty(); } renderPages(); renderExtra(); };
  inp.addEventListener('blur', done); inp.addEventListener('keydown', e => { if (e.key === 'Enter') inp.blur(); if (e.key === 'Escape') { inp.value = doc.pages[i].name; inp.blur(); } });
}

// ============================================================================
//  ПРОВЕРКА, ЖУРНАЛЫ, ЭКСПОРТ
// ============================================================================
function updateStatus() {
  let bad = 0, warn = 0; for (const e of P.edges) { if (e._st === 0) bad++; else if (e._st === 1) warn++; }
  $('#status').innerHTML = `Устройств: <b>${P.nodes.length}</b> · Кабелей: <b>${P.edges.length}</b>` + (bad ? ` · <span style="color:var(--bad)">⚠ несовместимо: ${bad}</span>` : '') + (warn ? ` · <span style="color:var(--warn)">внимание: ${warn}</span>` : '') + (sel.size ? ` · Выделено: ${sel.size}` : '');
}
function openModal(title, html) { $('#mTitle').textContent = title; $('#mBody').innerHTML = html; $('#modal').classList.remove('hidden'); }
function closeModal() { $('#modal').classList.add('hidden'); $('#modal .mbox').classList.remove('wide'); const mb = $('#mBody'); mb.oninput = mb.onchange = mb.onclick = null; editorPaste = null; baseOpen = false; }
$('#mClose').onclick = closeModal;
$('#modal').addEventListener('pointerdown', ev => { if (ev.target.id === 'modal') closeModal(); });

function cableRows() {
  const rows = [];
  doc.pages.forEach((pg, pi) => {
    const nm = new Map(pg.nodes.map(n => [n.id, n]));
    for (const e of pg.edges) {
      const a = nm.get(e.from.n), b = nm.get(e.to.n); if (!a || !b) continue;
      const pa = a.ports.find(p => p.id === e.from.p), pb = b.ports.find(p => p.id === e.to.p);
      const st = pa && pb ? compat(e.type, pb.type) : [0, 'порт удалён'];
      rows.push({ pi, e, page: pg.name, label: e.label, type: (T[e.type] || {}).n, fmt: e.fmt || '', from: a.label, fromPort: pa ? pa.name : '?', fromLoc: a.loc || '', to: b.label, toPort: pb ? pb.name : '?', toLoc: b.loc || '', len: e.len || '', notes: e.notes || '', st });
    }
  });
  return rows.sort((x, y) => String(x.label).localeCompare(String(y.label), 'ru', { numeric: true }));
}
function showCables() {
  const rows = cableRows();
  openModal(`Кабельный журнал — ${rows.length} шт.`, `<div class="btns"><button class="pri" data-m="csvCables">⇩ Скачать CSV (Excel)</button><button data-m="renumber">Перенумеровать по порядку</button></div>
   <table class="grid"><thead><tr><th>№</th><th>Тип</th><th>Формат</th><th>Откуда</th><th>Куда</th><th>Длина</th><th>Лист</th><th></th></tr></thead><tbody>
   ${rows.map((r, i) => `<tr class="clk" data-row="${i}"><td><b>${esc(r.label)}</b></td><td><span class="dot" style="background:${(T[r.e.type] || {}).c}"></span> ${esc(r.type)}</td><td>${esc(r.fmt)}</td><td><b>${esc(r.from)}</b> · ${esc(r.fromPort)}<div class="small muted">${esc(r.fromLoc)}</div></td><td><b>${esc(r.to)}</b> · ${esc(r.toPort)}<div class="small muted">${esc(r.toLoc)}</div></td><td>${esc(r.len)}</td><td class="muted">${esc(r.page)}</td><td>${r.st[0] === 0 ? '⚠' : r.st[0] === 1 ? '!' : ''}</td></tr>`).join('')}
   </tbody></table>`);
  $('#mBody').onclick = ev => {
    const m = ev.target.dataset.m; if (m === 'csvCables') return exportCablesCSV(); if (m === 'renumber') { renumber(); return showCables(); }
    const tr = ev.target.closest('[data-row]'); if (tr) { const r = rows[+tr.dataset.row]; closeModal(); if (r.pi !== doc.cur) switchPage(r.pi); goTo(r.e.id); }
  };
}
function renumber() {
  hist(); const cnt = {};
  doc.pages.forEach(pg => {
    const nm = new Map(pg.nodes.map(n => [n.id, n]));
    const es = [...pg.edges].sort((a, b) => { const A = nm.get(a.from.n), B = nm.get(b.from.n); return (A.x - B.x) || (A.y - B.y) || (portPos(a.from).y - portPos(b.from).y || 0); });
    for (const e of es) { const pre = (T[e.type] || T.sdi3g).pre; cnt[pre] = (cnt[pre] || 0) + 1; e.label = pre + String(cnt[pre]).padStart(3, '0'); }
  });
  renderAll(); markDirty(); toast('Кабели перенумерованы');
}
function bomRows() {
  const m = new Map();
  for (const pg of doc.pages) for (const n of pg.nodes) {
    const k = n.maker + '|' + n.model;
    if (!m.has(k)) m.set(k, { cat: (CATS[n.cat] || CATS.my).n, maker: n.maker, model: n.model, qty: 0, labels: [] });
    const r = m.get(k); r.qty++; r.labels.push(n.label);
  }
  return [...m.values()].sort((a, b) => a.cat.localeCompare(b.cat) || a.model.localeCompare(b.model));
}
function cableBOM() {
  const m = {};
  for (const r of cableRows()) { const k = r.type; m[k] ||= { n: 0, len: 0 }; m[k].n++; m[k].len += +r.len || 0; }
  return m;
}
function showBOM() {
  const rows = bomRows(), cb = cableBOM();
  openModal('Спецификация оборудования', `<div class="btns"><button class="pri" data-m="csv">⇩ Скачать CSV (Excel)</button></div>
  <table class="grid"><thead><tr><th>Категория</th><th>Производитель</th><th>Модель</th><th>Кол-во</th><th>Обозначения</th></tr></thead><tbody>
  ${rows.map(r => `<tr><td class="muted">${esc(r.cat)}</td><td>${esc(r.maker)}</td><td><b>${esc(r.model)}</b></td><td><b>${r.qty}</b></td><td class="small">${esc(r.labels.join(', '))}</td></tr>`).join('')}</tbody></table>
  <h4 style="margin-top:18px">Кабели</h4><table class="grid"><thead><tr><th>Тип</th><th>Штук</th><th>Суммарная длина, м</th></tr></thead><tbody>${Object.entries(cb).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v.n}</td><td>${v.len || '—'}</td></tr>`).join('')}</tbody></table>`);
  $('#mBody').onclick = ev => { if (ev.target.dataset.m === 'csv') exportBOMCSV(); };
}
function runCheck() {
  const issues = [];
  doc.pages.forEach((pg, pi) => {
    const prev = P; P = pg; reindex();
    const labels = {};
    for (const e of pg.edges) {
      const st = edgeStatus(e);
      if (st[0] < 2) issues.push({ pi, id: e.id, lvl: st[0], txt: `${e.label}: ${node(e.from.n).label} → ${node(e.to.n).label}. ${st[1]}` });
      if (e.label) (labels[e.label] ||= []).push(e);
    }
    for (const [l, arr] of Object.entries(labels)) if (arr.length > 1) issues.push({ pi, id: arr[1].id, lvl: 1, txt: `Номер кабеля ${l} повторяется ${arr.length} раза` });
    const nl = {};
    for (const n of pg.nodes) {
      (nl[n.label] ||= []).push(n);
      const conn = n.ports.filter(p => portUse.has(n.id + ':' + p.id)).length;
      if (!conn && n.ports.length) issues.push({ pi, id: n.id, lvl: 1, txt: `${n.label} (${n.model}) ни к чему не подключено` });
      const isDisplay = ['mon', 'led'].includes(n.cat);
      if (isDisplay && !n.ports.some(p => p.dir !== 'out' && portUse.has(n.id + ':' + p.id))) issues.push({ pi, id: n.id, lvl: 1, txt: `${n.label}: на экран не приходит сигнал` });
      const refIn = n.ports.find(p => p.type === 'ref' && p.dir === 'in');
      if (refIn && pg.nodes.some(x => x.cat === 'sync') && !portUse.has(n.id + ':' + refIn.id)) issues.push({ pi, id: n.id, lvl: 1, txt: `${n.label}: не подключён Genlock/Ref, хотя генератор синхры есть` });
    }
    for (const [l, arr] of Object.entries(nl)) if (arr.length > 1) issues.push({ pi, id: arr[1].id, lvl: 1, txt: `Обозначение «${l}» повторяется ${arr.length} раза` });
    P = prev; reindex();
  });
  issues.sort((a, b) => a.lvl - b.lvl);
  openModal(issues.length ? `Проверка схемы — найдено замечаний: ${issues.length}` : 'Проверка схемы',
    issues.length ? `<table class="grid"><tbody>${issues.map((x, i) => `<tr class="clk" data-row="${i}"><td style="width:24px">${x.lvl === 0 ? '⛔' : '⚠'}</td><td>${esc(x.txt)}</td><td class="muted">${esc(doc.pages[x.pi].name)}</td></tr>`).join('')}</tbody></table>` : '<p>✅ Замечаний нет: все соединения совместимы, номера уникальны.</p>');
  $('#mBody').onclick = ev => { const tr = ev.target.closest('[data-row]'); if (tr) { const x = issues[+tr.dataset.row]; closeModal(); if (x.pi !== doc.cur) switchPage(x.pi); goTo(x.id); } };
}

const inClaude = () => !!(window.claude && typeof window.claude.use === 'function');
async function download(name, data, type) {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  if (inClaude()) {
    try {
      const dl = await window.claude.use('downloads');
      if (dl) { await dl.save({ filename: name, data: blob }); toast('Файл сохранён: ' + name); return; }
    } catch (e) { if (e && e.code === 'declined') return; toast('Не удалось сохранить: ' + ((e && (e.message || e.code)) || e), 'e'); return; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
const safeName = () => (doc.name || 'схема').replace(/[\\/:*?"<>|]+/g, '_');
const csv = rows => '﻿' + rows.map(r => r.map(v => { v = String(v ?? ''); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(';')).join('\r\n');
function exportCablesCSV() {
  download(safeName() + ' — кабельный журнал.csv', csv([['№ кабеля', 'Тип', 'Формат', 'Откуда', 'Порт', 'Помещение (откуда)', 'Куда', 'Порт', 'Помещение (куда)', 'Длина, м', 'Примечание', 'Лист', 'Статус'],
  ...cableRows().map(r => [r.label, r.type, r.fmt, r.from, r.fromPort, r.fromLoc, r.to, r.toPort, r.toLoc, r.len, r.notes, r.page, r.st[0] === 2 ? 'OK' : r.st[1]])]), 'text/csv');
}
function exportBOMCSV() {
  const cb = cableBOM();
  download(safeName() + ' — спецификация.csv', csv([['Категория', 'Производитель', 'Модель', 'Кол-во', 'Обозначения'], ...bomRows().map(r => [r.cat, r.maker, r.model, r.qty, r.labels.join(', ')]), [], ['Кабели', 'Тип', '', 'Штук', 'Длина, м'], ...Object.entries(cb).map(([k, v]) => ['', k, '', v.n, v.len || ''])]), 'text/csv');
}
function buildExportSVG() {
  const bb = contentBBox(true); if (!bb) { toast('Схема пустая', 'w'); return null; }
  const pad = 30, x = bb.x - pad, y = bb.y - pad, w = bb.w + pad * 2, h = bb.h + pad * 2;
  for (const e of P.edges) e._st = edgeStatus(e)[0];
  return `<svg xmlns="http://www.w3.org/2000/svg"${isPic() ? ' class="picmode"' : ''} width="${Math.ceil(w)}" height="${Math.ceil(h)}" viewBox="${x} ${y} ${w} ${h}"><style>${cssFor(LIGHT)}</style><defs>${isPic() ? ART._defs : ''}${[...new Set(P.nodes.map(n => n.img).filter(i => i && doc.images[i]))].map(imgSymbol).join('')}${[...$('#defs').querySelectorAll('marker')].map(m => m.outerHTML).join('')}</defs>`
    + `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffffff"/>`
    + P.frames.map(frameSVG).join('') + (layoutEdges(), P.edges.map(e => edgeSVG(e, true)).join('')) + P.nodes.map(nodeSVG).join('') + P.texts.map(textSVG).join('') + LY.x.innerHTML + '</svg>';
}
function exportSVG() { const s = buildExportSVG(); if (s) download(safeName() + ' — ' + P.name + '.svg', s, 'image/svg+xml'); }
function exportPNG() {
  const s = buildExportSVG(); if (!s) return;
  const w = +/width="(\d+)"/.exec(s)[1], h = +/height="(\d+)"/.exec(s)[1];
  const scale = Math.min(2, 14000 / Math.max(w, h));
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas'); c.width = Math.round(w * scale); c.height = Math.round(h * scale);
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
    c.toBlob(b => b ? download(safeName() + ' — ' + P.name + '.png', b) : toast('Схема слишком большая для PNG — используйте SVG', 'e'), 'image/png');
  };
  img.onerror = () => toast('Не удалось построить PNG — используйте SVG', 'e');
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
}
// ---------- PDF из готовых страниц (canvas → JPEG → PDF), без внешних библиотек; страница A4 (595×842 pt)
async function pagesToPDF(canvases, wPt = 595.28, hPt = 842.89) {
  const jpgs = [];
  for (const c of canvases) jpgs.push(new Uint8Array(await (await new Promise(r => c.toBlob(r, 'image/jpeg', 0.92))).arrayBuffer()));
  const enc = new TextEncoder(), parts = [], offs = []; let len = 0;
  const put = x => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); len += b.length; };
  const obj = (n, body) => { offs[n] = len; put(`${n} 0 obj\n`); for (const b of [].concat(body)) put(b); put('\nendobj\n'); };
  const N = canvases.length, kids = [];
  put('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  for (let i = 0; i < N; i++) kids.push(`${3 + i * 3} 0 R`);
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, `<< /Type /Pages /Count ${N} /Kids [${kids.join(' ')}] >>`);
  canvases.forEach((c, i) => {
    const pn = 3 + i * 3, im = pn + 1, ct = pn + 2, cs = `q ${wPt.toFixed(2)} 0 0 ${hPt.toFixed(2)} 0 0 cm /Im0 Do Q`;
    obj(pn, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${wPt.toFixed(2)} ${hPt.toFixed(2)}] /Resources << /XObject << /Im0 ${im} 0 R >> >> /Contents ${ct} 0 R >>`);
    obj(im, [`<< /Type /XObject /Subtype /Image /Width ${c.width} /Height ${c.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpgs[i].length} >>\nstream\n`, jpgs[i], '\nendstream']);
    obj(ct, `<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`);
  });
  const xref = len, total = 3 + N * 3;
  put(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let n = 1; n < total; n++) put(String(offs[n]).padStart(10, '0') + ' 00000 n \n');
  put(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(parts, { type: 'application/pdf' });
}
// печать готовых страниц (A4 книжная): каждая страница — картинка на свой лист
function printPages(canvases) {
  if (inClaude()) return toast('Печать в окне просмотра Claude недоступна — скачайте PDF и распечатайте его', 'w');
  let pa = $('#printArea'); if (!pa) { pa = document.createElement('div'); pa.id = 'printArea'; document.body.appendChild(pa); }
  pa.innerHTML = canvases.map(c => `<img class="ppage" src="${c.toDataURL('image/jpeg', 0.92)}">`).join('');
  let st = $('#printPageCss'); if (!st) { st = document.createElement('style'); st.id = 'printPageCss'; document.head.appendChild(st); }
  st.textContent = '@media print{@page{size:A4 portrait;margin:0}#printArea img.ppage{display:block;width:210mm;height:297mm;page-break-after:always;break-after:page}}';
  const done = () => { st.textContent = ''; pa.innerHTML = ''; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => window.print(), 80);
}
function printDoc() {
  if (inClaude()) return toast('Печать в окне просмотра Claude недоступна — сделайте «Экспорт PNG/SVG» или откройте приложение в браузере', 'w');
  const s = PRODUCT === 'ekran' ? LED.sheetSVG() : buildExportSVG(); if (!s) return;
  let pa = $('#printArea'); if (!pa) { pa = document.createElement('div'); pa.id = 'printArea'; document.body.appendChild(pa); }
  pa.innerHTML = s; const sv = pa.firstChild; sv.removeAttribute('width'); sv.removeAttribute('height');
  setTimeout(() => window.print(), 50);
}

// ============================================================================
//  ФАЙЛЫ
// ============================================================================
const FILE_TYPES = [{ description: `Проект «${APP_NAME}»`, accept: { 'application/json': ['.json', '.vsf'] } }];
async function writeHandle(h) { const w = await h.createWritable(); await w.write(snap()); await w.close(); }
async function save() {
  if (fileHandle) { try { await writeHandle(fileHandle); dirtyFile = false; setSaveState(); toast('Сохранено'); return; } catch (e) { } }
  return saveAs();
}
async function saveAs() {
  if (window.showSaveFilePicker) {
    try {
      const h = await showSaveFilePicker({ suggestedName: safeName() + FILE_EXT, types: FILE_TYPES });
      await writeHandle(h); fileHandle = h; dirtyFile = false; setSaveState(); toast('Сохранено: ' + h.name); return;
    } catch (e) { if (e.name === 'AbortError') return; }
  }
  download(safeName() + FILE_EXT, snap(), 'application/json'); dirtyFile = false; setSaveState();
}
async function openFile() {
  if (window.showOpenFilePicker) {
    try { const [h] = await showOpenFilePicker({ types: FILE_TYPES }); const f = await h.getFile(); openDoc(JSON.parse(await f.text()), h); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  $('#fileIn').click();
}
$('#fileIn').addEventListener('change', async ev => {
  const f = ev.target.files[0]; if (!f) return;
  try { openDoc(JSON.parse(await f.text())); } catch (e) { toast('Не удалось открыть файл', 'e'); }
  ev.target.value = '';
});
// перетаскивание файла .vsf прямо в окно
document.addEventListener('dragover', ev => { if (ev.dataTransfer.types.includes('Files')) ev.preventDefault(); });
document.addEventListener('drop', async ev => {
  const f = ev.dataTransfer.files && ev.dataTransfer.files[0]; if (!f) return; ev.preventDefault();
  if (f.type.startsWith('image/')) {
    let im; try { im = await readImage(f); } catch (e) { return toast('Не удалось прочитать фото', 'e'); }
    const g = ev.target.closest && ev.target.closest('.node');
    if (g) { const n = node(g.dataset.id); hist(); n.img = putImage(im); rerenderItem(n.id); selectOnly([n.id]); markDirty(); return; }
    const onCanvas = stage.contains(ev.target);
    return deviceEditor({ id: null, cat: 'my', maker: '', model: f.name.replace(/\.[^.]+$/, ''), img: im, ports: [], _placeAt: onCanvas ? toDoc(ev.clientX, ev.clientY) : undefined });
  }
  try { const d = JSON.parse(await f.text()); if (d.backup) restoreBackup(d); else if (d.pages) openDoc(d); else if (Array.isArray(d.devices)) importLib(d); } catch (e) { toast('Не удалось открыть файл', 'e'); }
});

// ---------- база устройств: свой редактор, импорт/экспорт
function bulkPorts(cb) {
  openModal('Добавить несколько портов', `<div class="row">${fld('Направление', 'b_dir', '', { select: dirOpts('in') })}${fld('Тип', 'b_type', '', { select: typeOpts('sdi12g') })}</div>
   <div class="row">${fld('Количество', 'b_n', 4, { type: 'number' })}${fld('Своё имя (необязательно)', 'b_name', '', { ph: 'пусто — названия поставятся сами' })}</div>
   <div class="row">${fld('Начать нумерацию с', 'b_start', 1, { type: 'number' })}<div></div></div><div class="btns"><button class="pri" id="bOk">Добавить</button></div>`);
  $('#bOk').onclick = () => {
    const g = k => $(`#mBody [data-k="${k}"]`).value;
    const type = g('b_type'), dir = T[type].fam === 'eth' ? 'io' : g('b_dir'), n = clamp(+g('b_n') || 1, 1, 256), st = +g('b_start') || 1;
    const nm = g('b_name').trim();
    const ps = []; for (let i = 0; i < n; i++) ps.push(nm ? { id: uid(), name: portName(`${st + i} - ${nm}`, dir, type), type, dir } : { id: uid(), name: '', type, dir, auto: true });
    closeModal(); cb(ps);
  };
}
let editorPaste = null;
// правка: свои — как есть; встроенные — сохраняются как своя версия (заменяет встроенную)
function editDevice(d) {
  if (!d) return;
  if (customLib.includes(d)) return deviceEditor(d);
  deviceEditor({ ...JSON.parse(JSON.stringify(d)), id: null, _builtin: d.id });
}
function deleteDevices(list) {
  if (!list.length) return;
  const mine = list.filter(d => customLib.includes(d)), builtin = list.filter(d => !customLib.includes(d));
  const prevLib = customLib.slice(), prevHidden = (cfg.hidden || []).slice();
  customLib = customLib.filter(d => !mine.includes(d));
  cfg.removedDefaults = [...new Set([...(cfg.removedDefaults || []), ...mine.map(d => d.id)])];
  cfg.hidden = [...new Set([...(cfg.hidden || []), ...builtin.map(d => d.id)])];
  saveLib(); saveCfg(); renderLib();
  const t = document.createElement('div');
  t.innerHTML = `Удалено из базы: ${list.length} <u style="cursor:pointer;margin-left:8px">Вернуть</u>`; t.style.pointerEvents = 'auto';
  t.querySelector('u').onclick = () => { customLib = prevLib; cfg.hidden = prevHidden; saveLib(); saveCfg(); renderLib(); t.remove(); if (!$('#modal').classList.contains('hidden') && baseOpen) baseManager(); };
  $('#toast').appendChild(t); setTimeout(() => t.remove(), 7000);
}
// перенести изменения устройства базы на уже стоящие на схеме: порты сопоставляются по имени, кабели сохраняются
function nodesOfDev(keys, ids) { const r = []; for (const pg of doc.pages) for (const n of pg.nodes) if (ids.has(n.lib) || keys.has(devKey(n))) r.push([pg, n]); return r; }
function applyDevToNodes(dev, oldKeys, oldIds) {
  const list = nodesOfDev(oldKeys, oldIds); if (!list.length) return 0;
  hist();
  const imgId = dev.img ? putImage(dev.img) : null;
  for (const [pg, n] of list) {
    n.lib = dev.id; n.maker = dev.maker; n.model = dev.model; n.cat = dev.cat; if (dev.role) n.role = dev.role; else delete n.role;
    if (imgId) n.img = imgId; else delete n.img;
    const byName = new Map(n.ports.map(p => [p.dir + '|' + p.name, p]));
    const used = new Set();
    n.ports = dev.ports.map(p => {
      const old = byName.get(p.dir + '|' + p.name) || n.ports.find(q => q.name === p.name && !used.has(q.id));
      const id = old && !used.has(old.id) ? old.id : uid(); used.add(id);
      return { id, name: p.name, type: p.type, dir: p.dir };
    });
    const ids = new Set(n.ports.map(p => p.id));
    pg.edges = pg.edges.filter(e => !((e.from.n === n.id && !ids.has(e.from.p)) || (e.to.n === n.id && !ids.has(e.to.p))));
    n._L = null;
  }
  renderAll(); markDirty();
  return list.length;
}
function deviceEditor(dev) {
  const d = JSON.parse(JSON.stringify(dev)); d.ports = (d.ports || []).map(p => ({ ...p }));
  d.cat = d.cat || 'my';
  const groups = allGroupNames();
  d.group = (d.group && d.group.trim()) ? groupOf(d) : (dev.model ? groupOf(dev) : groupOf({ cat: d.cat }));
  let newGrp = false;
  const oldKeys = new Set([devKey(dev)]), oldIds = new Set([dev.id, dev._builtin].filter(Boolean));
  const onSchema = (dev.id || dev._builtin) ? nodesOfDev(oldKeys, oldIds).length : 0;
  const draw = () => {
    const catName = k => (cfg.groupRename || {})[CATS[k].n] || CATS[k].n;
    const catOpts = Object.keys(CATS).filter(k => k !== 'shape').map(k => `<option value="${k}"${k === d.cat ? ' selected' : ''}>${esc(catName(k))} (${esc(CATS[k].pre)})</option>`).join('');
    const isOld = !!((dev.id && customLib.some(x => x.id === dev.id)) || dev._builtin);
    openModal(isOld ? 'Редактировать устройство' : 'Новое устройство в базе', `
    <div class="devGrid">
      <div>
        <div id="dPhoto" class="photoDrop" title="Перетащите фото сюда, вставьте Ctrl+V или нажмите">${d.img ? `<img src="${d.img.src}">` : '<div>📷<br>Фото устройства<br><span class="small muted">перетащите файл, Ctrl+V<br>или нажмите для выбора</span></div>'}</div>
        <div class="btns">${d.img ? '<button data-ph="del">Убрать фото</button>' : ''}<button data-ph="pick">Выбрать файл…</button></div>
        <div class="small muted">Лучше фото передней или задней панели на белом или прозрачном фоне. Уменьшается автоматически.</div>
      </div>
      <div>
        <div class="row">${fld('Производитель', 'd_maker', d.maker === 'Generic' ? '' : (d.maker || ''))}${fld('Модель', 'd_model', d.model || '', { focus: 1 })}</div>
        ${fld('Подпись на схеме (под картинкой)', 'd_role', d.role || '', { ph: roleOf({ ...d, role: '' }) + ' — по умолчанию' })}
        <div class="row">${(newGrp ? fld('Новая группа', 'd_group', '', { ph: 'название новой группы', focus: 1 }) : fld('Группа в библиотеке', 'd_group', '', { select: [...new Set([...groups, d.group])].map(g => `<option${g === d.group ? ' selected' : ''}>${esc(g)}</option>`).join('') + '<option value="__new">＋ Новая группа…</option>' }))}${fld('Цвет шапки и префикс', 'd_cat', '', { select: catOpts })}</div>
        <datalist id="grpList">${groups.map(g => `<option value="${esc(g)}">`).join('')}</datalist>
        <h4>Порты (${d.ports.length})</h4><div id="dPorts">${portsTable(d.ports)}</div>
        <div class="small muted">Ethernet/SFP порты автоматически становятся двунаправленными (⇄).</div>
      </div>
    </div>
    ${onSchema ? `<label class="small" style="display:flex;gap:6px;align-items:center;margin-top:10px"><input type="checkbox" id="dApply" checked> Обновить такие устройства на схеме (${onSchema} шт.) — кабели на сохранённых портах останутся</label>` : ''}
    ${dev._builtin ? '<div class="small muted" style="margin-top:6px">Это встроенная модель — изменения сохранятся как ваша версия и заменят её в библиотеке.</div>' : ''}
    <div class="saveBar">
      ${isOld ? `<button class="pri" id="dSave" title="Записать изменения в этот прибор">💾 Сохранить — заменить «${esc(dev.model || '')}»</button><button id="dSaveNew" title="Оставить старый прибор как есть и добавить новый">＋ Сохранить как новый</button>` : '<button class="pri" id="dSave">💾 Добавить в базу</button>'}
      <span style="flex:1"></span>${baseOpen ? '<button id="dBack">← К базе</button>' : ''}${isOld ? '<button id="dDel" class="danger">Удалить из базы</button>' : ''}
    </div>`);
    const body = $('#mBody');
    const setPhoto = async f => { if (!f || !f.type.startsWith('image/')) return toast('Это не изображение', 'w'); try { d.img = await readImage(f); draw(); } catch (e) { toast('Не удалось прочитать фото', 'e'); } };
    editorPaste = setPhoto;
    const drop = $('#dPhoto');
    drop.ondragover = ev => { ev.preventDefault(); ev.stopPropagation(); drop.classList.add('over'); };
    drop.ondragleave = () => drop.classList.remove('over');
    drop.ondrop = ev => { ev.preventDefault(); ev.stopPropagation(); setPhoto(ev.dataTransfer.files[0]); };
    body.oninput = ev => { const t = ev.target;
      if (t.dataset.k === 'd_group' && t.value === '__new') { newGrp = true; d.group = ''; return draw(); }
      if (t.dataset.k === 'd_cat') { if (t.value === d.cat) return; d.group = groupOf({ cat: t.value }); d.cat = t.value; newGrp = false; return draw(); }
      if (t.dataset.k) { d[t.dataset.k.slice(2)] = t.value; } if (t.dataset.pk) { const p = d.ports[+t.closest('tr').dataset.pi]; p[t.dataset.pk] = t.value; if (t.dataset.pk === 'type' && T[t.value].fam === 'eth') p.dir = 'io'; if (t.dataset.pk === 'name') delete p.auto; else if (ev.type === 'change') { p.auto = true; renumberPorts(d.ports); draw(); } } };
    body.onchange = body.oninput;
    body.onclick = ev => {
      const t = ev.target;
      if (startPortRename(t)) return;
      if (t.closest('#dPhoto') || t.dataset.ph === 'pick') { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = () => setPhoto(i.files[0]); i.click(); return; }
      if (t.dataset.ph === 'del') { delete d.img; draw(); return; }
      if (t.dataset.pdel != null) { d.ports.splice(+t.dataset.pdel, 1); draw(); }
      if (t.dataset.padd) {
        if (t.dataset.padd === 'bulk') return bulkPorts(ps => { d.ports.push(...ps); renumberPorts(d.ports); deviceEditorRedraw(); });
        const dir = t.dataset.padd, last = [...d.ports].reverse().find(p => p.dir === dir || (dir === 'out' && p.dir === 'io'));
        const type = last ? last.type : 'sdi12g';
        d.ports.push({ name: '', type, dir: T[type].fam === 'eth' ? 'io' : dir, auto: true }); renumberPorts(d.ports); draw();
      }
      if (t.id === 'dBack') return baseManager();
      if (t.id === 'dDel') { const target = customLib.find(x => x.id === dev.id) || libById(dev._builtin); const back = baseOpen; closeModal(); deleteDevices([target]); if (back) baseManager(); return; }
      if (t.id === 'dSave' || t.id === 'dSaveNew') {
        const asNew = t.id === 'dSaveNew';
        if (!d.model || !d.model.trim()) return toast('Укажите модель', 'w');
        if (asNew && d.model.trim() === (dev.model || '').trim() && (d.maker || '').trim() === (dev.maker === 'Generic' ? '' : (dev.maker || '')).trim()) d.model = d.model.trim() + ' (копия)';
        const oldItem = libById(dev.id) || libById(dev._builtin), g0 = oldItem ? groupOf(oldItem) : null;
        const ids0 = g0 ? sortByDevOrder(g0, allLib().filter(x => groupOf(x) === g0)).map(x => x.id) : [];
        const clean = { id: !asNew && dev.id && customLib.some(x => x.id === dev.id) ? dev.id : 'c' + uid(), cat: d.cat, group: (d.group || '').trim(), maker: (d.maker || '').trim() || 'Generic', model: d.model.trim(), ports: d.ports.map(p => ({ name: p.name, type: p.type, dir: p.dir })) };
        if (d.img) clean.img = d.img;
        if (d.role && d.role.trim()) clean.role = d.role.trim();
        const i = customLib.findIndex(x => x.id === clean.id);
        if (i >= 0) customLib[i] = clean; else customLib.push(clean);
        if (!asNew && dev._builtin && devKey(clean) !== devKey(dev)) cfg.hidden = [...new Set([...(cfg.hidden || []), dev._builtin])], saveCfg();
        if (oldItem && g0 === groupOf(clean)) {
          const ids = ids0.slice(), k = ids.indexOf(oldItem.id);
          if (asNew) ids.splice(k >= 0 ? k + 1 : ids.length, 0, clean.id); else if (k >= 0) ids[k] = clean.id; else ids.push(clean.id);
          cfg.devOrder = { ...(cfg.devOrder || {}), [g0]: ids }; saveCfg();
        }
        saveLib(); openCats.add(groupOf(clean)); store.set('openCats', [...openCats]); renderLib();
        const apply = !asNew && $('#dApply') && $('#dApply').checked; const back = baseOpen;
        closeModal();
        const cnt = apply ? applyDevToNodes(clean, oldKeys, oldIds) : 0;
        toast((!asNew && (i >= 0 || dev._builtin) ? 'Обновлено в базе: ' : 'Добавлено в базу как новый: ') + clean.model + (cnt ? ` · на схеме обновлено: ${cnt}` : ''));
        if (dev._placeAt) { const n = addNode(clean, dev._placeAt.x, dev._placeAt.y); const L = layout(n); n.x = Math.round((dev._placeAt.x - L.w / 2) / 10) * 10; n.y = Math.round((dev._placeAt.y - (L.ih || L.h) / 2) / 10) * 10; rerenderNode(n); selectOnly([n.id]); markDirty(); }
        if (back) baseManager();
        return;
        if (false && dev._fromNode) { const n = node(dev._fromNode); if (n) { hist(); n.lib = clean.id; if (clean.img) n.img = putImage(clean.img); rerenderItem(n.id); renderProps(); markDirty(); } }
      }
    };
  };
  const deviceEditorRedraw = draw;
  draw();
}
const nodeToDev = n => ({ id: n.lib && customLib.some(x => x.id === n.lib) ? n.lib : null, _builtin: n.lib && BUILTIN_LIB.some(x => x.id === n.lib) ? n.lib : undefined, _fromNode: n.id, cat: n.cat, maker: n.maker, model: n.model, img: n.img && doc.images[n.img] ? { ...doc.images[n.img] } : undefined, ports: n.ports.map(p => ({ name: p.name, type: p.type, dir: p.dir })) });
// Ctrl+V с картинкой: в редакторе устройства — фото; на схеме — фото выделенного устройства
document.addEventListener('paste', async ev => {
  const f = [...(ev.clipboardData ? ev.clipboardData.files : [])].find(f => f.type.startsWith('image/'));
  if (!f) return;
  if (!$('#modal').classList.contains('hidden') && editorPaste) { ev.preventDefault(); return editorPaste(f); }
  const n = [...sel].map(node).filter(Boolean)[0];
  if (n && !typing(document.activeElement)) { ev.preventDefault(); const im = await readImage(f); hist(); n.img = putImage(im); rerenderItem(n.id); renderProps(); markDirty(); }
});
let baseOpen = false, baseQ = '', baseSel = new Set();
function baseManager() {
  baseOpen = true;
  const all = customLib.map(d => ({ d, mine: true })).concat(BUILTIN_LIB.filter(d => d.cat !== 'shape' && !customLib.some(c => devKey(c) === devKey(d))).map(d => ({ d, mine: false, hidden: (cfg.hidden || []).includes(d.id) })));
  const q = baseQ.trim().toLowerCase();
  const rows = all.filter(x => !q || (x.d.maker + ' ' + x.d.model + ' ' + groupOf(x.d)).toLowerCase().includes(q));
  const hiddenN = (cfg.hidden || []).length;
  openModal(`База устройств — ваших: ${customLib.length}, встроенных: ${BUILTIN_LIB.length - 5}`, `
    <div class="btns" style="align-items:center"><input id="bmQ" placeholder="Поиск по базе…" value="${esc(baseQ)}" style="flex:1;min-width:220px">
      <button class="pri" data-bm="new">＋ Новое устройство</button><button data-bm="moveSel" ${baseSel.size ? '' : 'disabled'}>В группу… (${baseSel.size})</button><button data-bm="delSel" ${baseSel.size ? '' : 'disabled'}>Удалить выбранные (${baseSel.size})</button><button data-bm="newGroup">＋ Группа</button>
      ${hiddenN ? `<button data-bm="unhide">Вернуть скрытые встроенные (${hiddenN})</button>` : ''}
      <button data-bm="export">⇩ Экспорт</button><button data-bm="import">⇧ Импорт</button></div>
    <div class="small muted" style="margin:4px 0 8px">Клик по строке — изменить. Ваши устройства хранятся в браузере; сохраняйте копию через «⇩ Экспорт».</div>
    <table class="grid bm"><thead><tr><th style="width:26px"><input type="checkbox" id="bmAll"></th><th style="width:70px">Фото</th><th>Модель</th><th>Группа</th><th>Порты</th><th style="width:150px"></th></tr></thead><tbody>
    ${rows.slice(0, 600).map(x => { const d = x.d; return `<tr class="clk${x.hidden ? ' muted' : ''}" data-bid="${esc(d.id)}">
      <td><input type="checkbox" data-bsel="${esc(d.id)}"${baseSel.has(d.id) ? ' checked' : ''}></td>
      <td>${d.img ? `<img src="${d.img.src}" style="max-width:64px;max-height:36px;object-fit:contain;background:#fff;border-radius:3px">` : ''}</td>
      <td><b>${esc(d.model)}</b><div class="small muted">${esc(d.maker)}${x.mine ? ' · <span style="color:var(--acc)">ваше</span>' : ' · встроенное'}${x.hidden ? ' · скрыто' : ''}</div></td>
      <td class="small">${esc(groupOf(d))}</td><td class="small">${esc(portSummary(d))}</td>
      <td style="white-space:nowrap"><button data-bm="edit">✎ Изменить</button> <button data-bm="dup" title="Копия">⧉</button> <button data-bm="${x.hidden ? 'unhideOne' : 'del'}" title="${x.hidden ? 'Вернуть' : 'Удалить'}">${x.hidden ? '↺' : '🗑'}</button></td></tr>`; }).join('')}
    </tbody></table>${rows.length > 600 ? '<div class="small muted">Показаны первые 600 — уточните поиск</div>' : ''}`);
  const body = $('#mBody');
  const qi = $('#bmQ'); qi.focus(); qi.setSelectionRange(qi.value.length, qi.value.length);
  qi.oninput = () => { baseQ = qi.value; clearTimeout(qi._t); qi._t = setTimeout(baseManager, 200); };
  body.oninput = null; body.onchange = ev => {
    const t = ev.target;
    if (t.id === 'bmAll') { rows.forEach(x => t.checked ? baseSel.add(x.d.id) : baseSel.delete(x.d.id)); return baseManager(); }
    if (t.dataset.bsel) { t.checked ? baseSel.add(t.dataset.bsel) : baseSel.delete(t.dataset.bsel); const b = body.querySelector('[data-bm=delSel]'); b.disabled = !baseSel.size; b.textContent = `Удалить выбранные (${baseSel.size})`; const m = body.querySelector('[data-bm=moveSel]'); m.disabled = !baseSel.size; m.textContent = `В группу… (${baseSel.size})`; }
  };
  body.onclick = ev => {
    const t = ev.target; if (t.dataset.bsel || t.id === 'bmAll' || t.id === 'bmQ') return;
    const tr = t.closest('[data-bid]'); const d = tr && libById(tr.dataset.bid);
    const act = t.dataset.bm;
    if (act === 'new') return deviceEditor({ id: null, cat: 'my', maker: '', model: '', ports: [] });
    if (act === 'export') return CMD.libExport();
    if (act === 'import') return $('#libIn').click();
    if (act === 'unhide') { cfg.hidden = []; saveCfg(); renderLib(); return baseManager(); }
    if (act === 'moveSel') { const list = [...baseSel].map(libById).filter(Boolean); baseSel.clear(); return pickGroup(list); }
    if (act === 'newGroup') return newGroup();
    if (act === 'delSel') { const list = [...baseSel].map(libById).filter(Boolean); baseSel.clear(); deleteDevices(list); return baseManager(); }
    if (!d) return;
    if (act === 'del') { deleteDevices([d]); return baseManager(); }
    if (act === 'unhideOne') { cfg.hidden = (cfg.hidden || []).filter(x => x !== d.id); saveCfg(); renderLib(); return baseManager(); }
    if (act === 'dup') return deviceEditor({ ...JSON.parse(JSON.stringify(d)), id: null, model: d.model + ' (копия)' });
    editDevice(d);
  };
}
// отпечаток прибора — чтобы понять, правил ли его пользователь после загрузки с сайта
function devHash(d) {
  const s = JSON.stringify([d.maker || '', d.model || '', d.cat || '', d.group || '', (d.ports || []).map(p => [p.name, p.type, p.dir]), d.img ? d.img.src : '']);
  let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36);
}
// шаблон по умолчанию с сайта: настройки групп и обновление нетронутых приборов
function applyTemplate(data) {
  if (!data.tplVer || cfg.tplVer === data.tplVer) return 0;
  let m = 0; const tpl = new Map((data.devices || []).map(d => [d.id, d])), prev = data.prev || {};
  for (let i = customLib.length - 1; i >= 0; i--) {
    const d = customLib[i]; if (!prev[d.id] || prev[d.id] !== devHash(d)) continue;   // правили сами — не трогаем
    const t = tpl.get(d.id);
    if (t) customLib[i] = JSON.parse(JSON.stringify(t)); else customLib.splice(i, 1);
    m++;
  }
  const D = data.defaults || {};
  cfg.groupRename = { ...(D.groupRename || {}), ...(cfg.groupRename || {}) };
  cfg.hidden = [...new Set([...(cfg.hidden || []), ...(D.hidden || [])])];
  cfg.groupsExtra = [...new Set([...(cfg.groupsExtra || []), ...(D.groupsExtra || [])])];
  if (!(cfg.groupOrder || []).length && (D.groupOrder || []).length) cfg.groupOrder = D.groupOrder.slice();
  cfg.devOrder = { ...(D.devOrder || {}), ...(cfg.devOrder || {}) };
  cfg.tplVer = data.tplVer; saveCfg(); if (m) saveLib();
  return m + 1;
}
async function mergeDefaults(force) {
  let data = window.SF_EMBED ? JSON.parse(JSON.stringify(window.SF_EMBED)) : null;
  if (!data && !location.protocol.startsWith('http')) { if (force) toast('База с фото доступна, когда программа открыта с сайта', 'w'); return 0; }
  if (!data) try { const r = await fetch('devices.json?v=' + Date.now(), { cache: 'no-store' }); if (!r.ok) throw 0; data = await r.json(); } catch (e) { if (force) toast('Не удалось загрузить базу с фото', 'e'); return 0; }
  const tplChanged = applyTemplate(data);
  const have = new Set(customLib.map(d => d.id)), haveKey = new Set(customLib.map(devKey)), removed = new Set(force ? [] : (cfg.removedDefaults || []));
  let n = 0;
  for (const d of data.devices || []) { if (have.has(d.id) || haveKey.has(devKey(d)) || removed.has(d.id)) continue; for (const p of d.ports || []) p.name = portName(p.name, p.dir, p.type); customLib.push(d); n++; }
  // разовое обновление уже загруженных устройств: Expansion-порты и версии HDMI/DP (1.6.5)
  if (!(cfg.migr || []).includes('exp1')) {
    const byId = new Map((data.devices || []).map(d => [d.id, d])); let m = 0;
    const HV = { '1.3': 'hdmi13', '1.4': 'hdmi14', '2.0': 'hdmi20', '2.1': 'hdmi21' }, DV = { '1.1': 'dp11', '1.2': 'dp12', '1.4': 'dp14', '2.0': 'dp21', '2.1': 'dp21' };
    for (const d of customLib) {
      for (const p of d.ports || []) { const v = /(\d\.\d)/.exec(p.name || ''); if (v && p.type === 'hdmi' && HV[v[1]]) p.type = HV[v[1]], m++; if (v && p.type === 'dp' && DV[v[1]]) p.type = DV[v[1]], m++; }
      const src = byId.get(d.id); if (!src || (d.ports || []).some(p => p.type === 'exp')) continue;
      const ex = src.ports.filter(p => p.type === 'exp'); if (ex.length) { d.ports.push(...ex.map(p => ({ ...p }))); m++; }
    }
    cfg.migr = [...(cfg.migr || []), 'exp1']; saveCfg(); if (m) { saveLib(); renderLib(); }
  }
  if (force) cfg.removedDefaults = [], saveCfg();
  if (n) { const added = (data.devices || []).filter(d => customLib.includes(d)).slice(-n); saveLib(); typeFilter.add('photo'); renderTypeFilter(); renderLib(); toast(n <= 3 ? `В базу добавлено: ${added.map(d => d.model).join(', ')}` : `Загружена база с фото: ${n} устройств — показаны в библиотеке (фильтр «📷 С фото»)`); }
  else if (tplChanged) renderLib();
  else if (force) toast(`База с фото: в ней ${(data.devices || []).length} приборов, у вас в библиотеке уже ${customLib.filter(d => d.img).length} с фото`);
  return n;
}
function importLib(data) {
  const reopen = baseOpen;
  const list = Array.isArray(data) ? data : data.devices; let n = 0;
  for (const d of list || []) {
    if (!d.model || !Array.isArray(d.ports)) continue;
    for (const p of d.ports) p.name = portName(p.name, p.dir, p.type);
    const c = { id: d.id && String(d.id).startsWith('c') ? d.id : 'c' + uid(), cat: CATS[d.cat] ? d.cat : 'my', group: d.group || '', img: d.img && d.img.src ? d.img : undefined, maker: d.maker || 'Generic', model: d.model, ports: normPorts(d.ports.filter(p => T[p.type]).map(p => ({ name: p.name, type: p.type, dir: p.dir || 'in' }))) };
    const i = customLib.findIndex(x => x.id === c.id); if (i >= 0) customLib[i] = c; else customLib.push(c); n++;
  }
  saveLib(); renderLib(); toast(`Импортировано устройств: ${n}`); if (reopen) baseManager();
}
$('#libIn').addEventListener('change', async ev => { const f = ev.target.files[0]; if (!f) return; try { importLib(JSON.parse(await f.text())); } catch (e) { toast('Не удалось прочитать базу', 'e'); } ev.target.value = ''; });

// ============================================================================
//  КОМАНДЫ МЕНЮ
// ============================================================================
function toast(msg, kind) {
  const d = document.createElement('div'); d.textContent = msg; if (kind) d.className = kind;
  $('#toast').appendChild(d); setTimeout(() => d.remove(), kind === 'e' ? 5000 : 2800);
}
const CMD = {
  new: () => { if (P.nodes.length) { idb.set('doc_backup', snap()); } openDoc(newDoc()); toast('Новый проект. Предыдущий сохранён в резервной копии браузера'); },
  open: openFile, save, saveAs, exportPNG, exportSVG, print: printDoc,
  calc: () => typeof LED !== 'undefined' && LED.calcOpen(), cables: exportCablesCSV, bom: exportBOMCSV, cablesView: showCables, bomView: showBOM, check: runCheck,
  demo: () => { openDoc(buildDemo()); fit(); }, stress: () => { const t0 = performance.now(); openDoc(buildStress(1000)); fit(); toast(`Построено за ${Math.round(performance.now() - t0)} мс`); },
  undo, redo, copy: copySel, paste: () => paste(), dup: () => { copySel(); paste(); }, del: deleteSel,
  selAll: () => selectOnly([...P.nodes, ...P.frames, ...P.texts].map(o => o.id)), find: () => $('#findBox').focus(), renumber,
  quick: quickAtCenter, addFrame, addText, newDevice: () => deviceEditor({ id: null, cat: 'my', maker: '', model: '', ports: [] }),
  newGroup: () => newGroup(),
  backupAll: () => download(`${APP_NAME} — резервная копия ${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ app: DOC_APP, backup: 1, appVersion: APP_VERSION, date: new Date().toISOString(), doc: JSON.parse(snap()), lib: customLib, cfg, favs: [...favs] }), 'application/json'),
  restoreAll: () => $('#fileIn').click(),
  baseManager: () => { baseQ = ''; baseSel.clear(); baseManager(); },
  libExport: () => { if (!customLib.length) return toast('В вашей базе пока нет устройств', 'w'); download('Сигнал — база устройств.json', JSON.stringify({ app: 'SignalFlow', devices: customLib }), 'application/json'); },
  libImport: () => $('#libIn').click(),
  libDefault: () => mergeDefaults(true),
  photoDemo: () => { const d = buildPhotoDemo(); if (d) { openDoc(d); fit(); } },
  fit: () => fit(), zoom100: () => { const r = stage.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1 / view.k); },
  zoomIn: () => { const r = stage.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.25); },
  zoomOut: () => { const r = stage.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 0.8); },
  toggleGrid: () => { cfg.grid = !cfg.grid; cfg.snap = cfg.grid; saveCfg(); setView(); toast(cfg.grid ? 'Сетка и привязка включены' : 'Сетка выключена'); },
  toggleLegend: () => { cfg.legend = !cfg.legend; saveCfg(); renderExtra(); },
  toggleLabels: () => { cfg.labels = !cfg.labels; saveCfg(); renderAll(); },
  picLabel: () => {
    const order = ['role', 'id', 'both'], nm = { role: 'название («монитор», «видеопроцессор»)', id: 'номер («MON 1», «PRC 1»)', both: 'название и номер' };
    cfg.picLabel = order[(order.indexOf(cfg.picLabel || 'role') + 1) % 3]; saveCfg();
    for (const pg of doc.pages) for (const n of pg.nodes) n._L = null; renderAll();
    toast('Под картинкой: ' + nm[cfg.picLabel]);
  },
  theme: () => { cfg.theme = cfg.theme === 'dark' ? 'light' : 'dark'; saveCfg(); document.documentElement.classList.toggle('dark', cfg.theme === 'dark'); },
  viewPorts: () => setMode('ports'), viewPic: () => setMode('pic'),
  addPage: () => { hist(); doc.pages.push(newPage('Страница ' + (doc.pages.length + 1))); switchPage(doc.pages.length - 1); markDirty(); },
  about: () => openModal(`${APP_NAME} — версия ${APP_VERSION}`, `<p class="muted">${APP_ABOUT}. Сборка от ${APP_DATE}.</p>` + CHANGELOG.map(([v, d, list]) => `<h4>${/^\d/.test(v) ? 'v' + v : v} · ${d}${v === APP_VERSION ? ' — текущая' : ''}</h4><ul style="margin:4px 0 10px;padding-left:20px;line-height:1.6">${list.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`).join('') + '<p class="small muted">Исходники и обновления: github.com/slavahoh1976-ops/signalflow</p>'),
  help: () => openModal('Горячие клавиши и приёмы', `<table class="grid"><tbody>${[
    ['Двойной клик по холсту, A, /, Ctrl+K', 'Быстрый поиск и добавление устройства'],
    ['Тянуть от порта', 'Новый кабель (зелёные порты — совместимы)'],
    ['Отпустить кабель на устройстве', 'Порт подберётся автоматически'],
    ['Отпустить кабель в пустоте', 'Выбрать устройство — оно встанет и подключится'],
    ['Тянуть за занятый порт', 'Перекоммутировать кабель (Alt — новый кабель)'],
    ['Пробел + мышь, средняя кнопка', 'Панорама'], ['Колесо / Ctrl+колесо / щипок', 'Масштаб'], ['Тачпад двумя пальцами', 'Панорама'],
    ['F', 'Показать всё'], ['Ctrl+0', 'Масштаб 100%'], ['Shift+клик, рамка', 'Множественное выделение'],
    ['Стрелки (Shift — ×5)', 'Сдвиг выделенного'], ['Ctrl+C / V / D / X', 'Копировать / вставить / дублировать / вырезать'],
    ['Ctrl+Z / Ctrl+Y', 'Отмена / повтор'], ['Del', 'Удалить'], ['Z', 'Зона вокруг выделенного (или новая)'], ['T', 'Текст'], ['R', 'Зеркально: входы справа'],
    ['Ctrl+S / Ctrl+O', 'Сохранить / открыть проект (' + FILE_EXT + ')'], ['Ctrl+F', 'Найти на схеме'], ['Ctrl+P', 'Печать / PDF'],
    ['Поиск «sdi>hdmi»', 'Конвертеры из одного сигнала в другой'], ['Правый клик по кабелю', 'Вставить конвертер в разрыв'],
  ].map(r => `<tr><td style="white-space:nowrap"><b>${esc(r[0])}</b></td><td>${esc(r[1])}</td></tr>`).join('')}</tbody></table>`),
};
document.addEventListener('click', ev => {
  const c = ev.target.closest('[data-cmd]'); if (!c) return;
  const cmd = c.dataset.cmd;
  document.querySelectorAll('.menu').forEach(m => { m.classList.remove('open'); });
  c.closest('.dd') && (c.closest('.dd').style.display = 'none', setTimeout(() => c.closest('.dd').style.display = '', 200));
  if (cmd.startsWith('wire:')) { cfg.wire = cmd.slice(5); $('#wireStyle').value = cfg.wire; saveCfg(); renderAll(); return; }
  CMD[cmd] && CMD[cmd]();
});
$('#wireStyle').addEventListener('change', ev => { cfg.wire = ev.target.value; saveCfg(); renderAll(); });
$('#docName').addEventListener('input', ev => { doc.name = ev.target.value; markDirty(); });
$('#saveState').addEventListener('click', () => dirtyFile && save());
// поиск по схеме
let findIdx = 0;
$('#findBox').addEventListener('keydown', ev => {
  if (ev.key !== 'Enter') return;
  const q = ev.target.value.trim().toLowerCase(); if (!q) return;
  const hits = [...P.nodes.filter(n => (n.label + ' ' + n.model + ' ' + n.maker + ' ' + (n.loc || '') + ' ' + (n.notes || '')).toLowerCase().includes(q)),
  ...P.edges.filter(e => (e.label + ' ' + (e.notes || '')).toLowerCase().includes(q))];
  if (!hits.length) return toast('Не найдено на этом листе');
  findIdx = (findIdx + (ev.shiftKey ? -1 : 1) + hits.length) % hits.length;
  goTo(hits[findIdx].id); hint(`Найдено: ${findIdx + 1} из ${hits.length} (Enter — дальше)`); setTimeout(() => hint(''), 1800);
});
addEventListener('resize', () => scheduleCull());
addEventListener('beforeunload', ev => { idb.set('doc', snap()); });

// ============================================================================
//  ПРИМЕР И НАГРУЗОЧНЫЙ ТЕСТ
// ============================================================================
function buildDemo() {
  headless = true; const saved = { doc, P }; doc = newDoc(); doc.name = 'Пример: студия и аппаратная'; doc.author = '';
  P = doc.pages[0]; P.name = 'Видео'; reindex();
  const D = m => allLib().find(d => d.model === m);
  const add = (m, x, y, label, loc) => { const n = addNode(D(m), x, y, true); if (label) n.label = label; if (loc) n.loc = loc; n._L = null; return n; };
  const pid = (n, name) => {
    const want = /\bout\b/i.test(name) ? 'out' : /\bin\b/i.test(name) ? 'in' : null;   // направление из названия
    const ok = p => !want || p.dir === want || p.dir === 'io';
    return (n.ports.find(p => ok(p) && p.name === name) || n.ports.find(p => ok(p) && p.name === portName(name, p.dir, p.type)) || {}).id;
  };
  const C = (a, ap, b, bp, fmt, len) => { const fa = pid(a, ap), fb = pid(b, bp); if (!fa || !fb) { console.warn('demo port', a.label, ap, b.label, bp); return; } const e = connect({ n: a.id, p: fa }, { n: b.id, p: fb }, true); if (fmt) e.fmt = fmt; if (len) e.len = len; };
  const cams = [0, 1, 2, 3].map(i => add('Studio Camera 4K Pro G2', 60, 80 + i * 150, 'CAM ' + (i + 1), 'Студия'));
  const ptz = add('AW-UE150', 60, 700, 'CAM 5', 'Студия');
  const vh = add('Videohub 12G 20x20', 520, 60, 'RTR 1', 'Аппаратная, рэк 1');
  const sync = add('Mini Converter Sync Generator', 520, 560, 'SYNC 1', 'Аппаратная, рэк 1');
  const mac = add('Mac mini / MacBook', 60, 900, 'PC 1', 'Аппаратная');
  const h2s = add('Micro Converter HDMI→SDI 12G', 300, 900, null, 'Аппаратная');
  const gfx = add('Графический сервер (CasparCG)', 520, 760, 'GFX 1', 'Аппаратная, рэк 1');
  const atem = add('ATEM 2 M/E Constellation 4K', 900, 60, 'SW 1', 'Аппаратная, рэк 1');
  const rec = add('HyperDeck Studio 4K Pro', 1340, 60, 'REC 1', 'Аппаратная, рэк 1');
  const web = add('Web Presenter HD', 1340, 260, 'ENC 1', 'Аппаратная, рэк 1');
  const mv1 = add('SmartView 4K G2', 1340, 430, 'MON 1', 'Аппаратная');
  const s2h = add('Micro Converter SDI→HDMI 12G', 1340, 600, null, 'Сцена');
  const nova = add('MCTRL4K', 1640, 560, 'LED 1', 'Сцена');
  const scr = add('LED-экран (кабинеты)', 1960, 600, 'LED экран', 'Сцена');
  const swn = add('Коммутатор 24×1G + 4×SFP+', 1640, 1000, 'NET 1', 'Аппаратная, рэк 1');
  cams.forEach((c, i) => C(c, 'SDI OUT 1', vh, 'SDI IN ' + (i + 1), '2160p50', 30));
  C(ptz, 'SDI OUT 1', vh, 'SDI IN 5', '2160p50', 40);
  C(mac, 'HDMI OUT 1', h2s, 'HDMI IN 1', '1080p50', 2); C(h2s, 'SDI OUT 1', vh, 'SDI IN 6');
  for (let i = 1; i <= 6; i++) C(vh, 'SDI OUT ' + i, atem, 'SDI IN ' + i);
  C(gfx, 'Fill/Key 1', atem, 'SDI IN 7'); C(gfx, 'Fill/Key 2', atem, 'SDI IN 8');
  C(atem, 'AUX 1', rec, 'SDI IN 1', '2160p50'); C(atem, 'AUX 2', web, 'SDI IN 1', '1080p50');
  C(atem, 'MV 1', mv1, 'SDI IN 1'); C(atem, 'AUX 3', s2h, 'SDI IN 1');
  C(s2h, 'HDMI OUT 1', nova, 'HDMI 2.0', '2160p50', 50);
  C(nova, 'Port 1', scr, 'Data In 1'); C(nova, 'Port 2', scr, 'Data In 2');
  C(atem, 'AUX 4', vh, 'SDI IN 7', '2160p50');
  cams.forEach((c, i) => C(vh, 'SDI OUT ' + (7 + i), c, 'PGM Return', '2160p50', 30));
  C(sync, 'REF OUT 1', atem, 'REF IN 1'); C(sync, 'REF OUT 2', vh, 'REF IN 1'); C(sync, 'REF OUT 3', rec, 'REF IN 1'); C(sync, 'REF OUT 4', gfx, 'REF IN 1'); C(sync, 'REF OUT 5', ptz, 'REF IN 1');
  C(atem, 'LAN', swn, 'Port 1'); C(vh, 'LAN', swn, 'Port 2'); C(web, 'LAN', swn, 'Port 3'); C(nova, 'Port 16', swn, 'Port 4');
  P.frames.push({ id: uid(), x: 20, y: 20, w: 380, h: 860, title: 'Студия', color: '#2563eb' });
  P.frames.push({ id: uid(), x: 470, y: 0, w: 1150, h: 1180, title: 'Аппаратная', color: '#7c3aed' });
  P.frames.push({ id: uid(), x: 1300, y: 540, w: 980, h: 360, title: 'Сцена', color: '#db2777' });
  P.texts.push({ id: uid(), x: 20, y: -60, text: 'Пример схемы: 5 камер → роутер → ATEM → запись / стрим / LED', size: 22, bold: true });
  const out = doc; doc = saved.doc; P = saved.P; headless = false; if (P) reindex();
  for (const pg of out.pages) for (const n of pg.nodes) delete n._L;
  return JSON.parse(JSON.stringify(out, replacer));
}
function buildPhotoDemo() {
  const F = m => customLib.find(d => d.model === m) || allLib().find(d => d.model === m);
  if (!customLib.some(d => d.img)) { toast('Сначала загрузите базу с фото: Вставка → Загрузить базу с фото', 'w'); return null; }
  headless = true; const saved = { doc, P }; doc = newDoc(); doc.name = 'Пример из ваших фото'; doc.view = 'pic'; P = doc.pages[0]; reindex();
  const A = (m, x, y, label) => { const d = F(m); if (!d) return null; const n = addNode(d, x, y, true); if (label) n.label = label; return n; };
  const L = (a, b, cap) => { if (!a || !b) return; let pr = bestPair(a, b); if (pr && pr.c[0] === 0) pr = null; if (!pr) { const pa = addLinkPort(a, 'io'), pb = addLinkPort(b, 'io'); pr = { from: { n: a.id, p: pa.id }, to: { n: b.id, p: pb.id } }; } const e = connect(pr.from, pr.to, true); if (cap) e.caption = cap; };
  const scr = A('Прямоугольник (экран, блок)', 80, 40, 'LED-экран'); if (scr) { scr.sw = 320; scr.sh = 170; }
  const lamp = A('Круг — сигнальная лампа', 440, 80, 'Сигнальная\nлампа');
  const proc = A('LED-550D (550DS с SDI)', 80, 270, 'Процессор');
  const e2 = A('E2 Gen 2 (Event Master, типовая конф.)', 420, 260, 'E2');
  const ec = A('Event Master EC-50 (пульт)', 760, 240, 'Пульт EC-50');
  const players = [0, 1, 2].map(i => A('Ноутбук', 380 + i * 300, 560, 'Игрок ' + (i + 1)));
  const mons = [0, 1, 2].map(i => A('Монитор AOC (HDMI/VGA)', 380 + i * 300, 760, 'Монитор ' + (i + 1)));
  const host = A('Монитор — PGM', 1340, 760, 'Ведущий');
  const pres = A('Ноутбук с презентацией', 60, 600, 'Презентация');
  const reza = A('Ноутбук с Resolume', 60, 820, 'Resolume');
  const sw = A('HP коммутатор 24×1G + 4 SFP', 500, 1010, 'Коммутатор');
  const atem = A('ATEM Mini Pro', 1250, 260, 'ATEM');
  const cam = A('PXW-Z190 (XDCAM 4K)', 1280, 60, 'Камера');
  reindex();
  L(pres, e2, 'hdmi'); L(reza, e2, 'hdmi 1920x1080'); L(e2, proc, 'dvi'); L(proc, scr, ''); L(lamp, proc, 'cat 5');
  players.forEach((n, i) => { L(n, mons[i], 'hdmi'); L(n, sw, 'cat 5'); });
  L(ec, sw, 'cat 5'); L(cam, atem, 'hdmi'); L(atem, host, 'hdmi'); L(atem, e2, 'hdmi');
  const out = JSON.parse(JSON.stringify(doc, replacer)); doc = saved.doc; P = saved.P; headless = false; if (P) reindex();
  return out;
}
function buildStress(N) {
  headless = true; const saved = { doc, P }; doc = newDoc(); doc.name = `Тест нагрузки: ${N} устройств`; P = doc.pages[0]; reindex();
  const lib = BUILTIN_LIB.filter(d => d.ports.length <= 24 && d.ports.some(p => p.dir === 'in') && d.ports.some(p => p.dir === 'out'));
  const cols = 40; const ns = [];
  for (let i = 0; i < N; i++) ns.push(addNode(lib[(i * 7) % lib.length], (i % cols) * 320, Math.floor(i / cols) * 360, true));
  let ec = 0;
  for (let i = 0; i < N; i++) {
    const a = ns[i];
    for (const j of [i + 1, i + cols, i + 2]) {
      const b = ns[j]; if (!b) continue;
      const pa = a.ports.find(p => p.dir === 'out' && !portUse.has(a.id + ':' + p.id));
      const pb = pa && b.ports.find(p => p.dir === 'in' && !portUse.has(b.id + ':' + p.id) && T[p.type].fam === T[pa.type].fam);
      if (pa && pb) { connect({ n: a.id, p: pa.id }, { n: b.id, p: pb.id }, true); ec++; }
    }
  }
  const out = JSON.parse(JSON.stringify(doc, replacer)); doc = saved.doc; P = saved.P; headless = false; if (P) reindex();
  return out;
}

// ============================================================================
//  СТАРТ
// ============================================================================
document.documentElement.classList.toggle('dark', cfg.theme === 'dark');
$('#appVer').textContent = 'v' + APP_VERSION; document.title = `${APP_NAME} ${APP_VERSION} — ${APP_TAG}`;
$('#wireStyle').value = cfg.wire;
renderTypeFilter();
doc = newDoc(); P = doc.pages[0];
(async () => {
  let lib = null; try { lib = await idb.get('lib'); } catch (e) { lib = null; }
  if (!lib) { const old = store.get('lib', null); if (old) lib = old; }
  customLib = Array.isArray(lib) ? lib : [];
  if (!(cfg.migr || []).includes('io1')) { for (const d of customLib) for (const p of d.ports || []) p.name = portName(p.name, p.dir, p.type); cfg.migr = [...(cfg.migr || []), 'io1']; saveCfg(); saveLib(); }
  else for (const d of customLib) for (const p of d.ports || []) p.name = numFirst(p.name);
  if (PRODUCT === 'signal') try { await mergeDefaults(false); } catch (e) { console.warn('База с фото не загрузилась', e); }
  renderLib();
  let saved = null; try { saved = await idb.get('doc'); } catch (e) { saved = null; }
  if (!saved) saved = store.get('doc', null);
  let d = null;
  try { d = typeof saved === 'string' ? JSON.parse(saved) : saved; if (!d || !d.pages) d = null; } catch (e) { d = null; }
  if (!d && PRODUCT === 'ekran') { // первый запуск «Экрана»: забрать LED-экраны из последнего проекта «Сигнала»
    let sg = await fromSignal('doc'); try { if (typeof sg === 'string') sg = JSON.parse(sg); } catch (e) { sg = null; }
    if (sg && sg.led && sg.led.screens && sg.led.screens.length) { d = newDoc(); d.name = sg.name || d.name; d.led = sg.led; setTimeout(() => toast('Экраны перенесены из «Сигнала»'), 600); }
  }
  openDoc(d || (PRODUCT === 'ekran' ? newDoc() : buildDemo()));
  if (!d && PRODUCT === 'signal') setTimeout(() => fit(), 30);
  dirtyFile = false; setSaveState();
})();
// открытие файла проекта двойным кликом, когда приложение установлено (PWA file handler)
try { if ('launchQueue' in window) launchQueue.setConsumer(async p => { if (!p.files || !p.files.length) return; const h = p.files[0]; const f = await h.getFile(); try { openDoc(JSON.parse(await f.text()), h); } catch (e) { toast('Не удалось открыть файл', 'e'); } }); } catch (e) { }
// ---------- обновления (как в «Срочном ТЗ»): кнопка «⟳ версия» вверху справа мигает, если вышла новая,
// и всплывает оповещение «Обновить / Позже». Проверка: при запуске, каждые 15 минут и при возврате в окно.
// Сайт — перезагрузка с новой версией; Windows / Mac — программа сама скачивает новую версию и перезапускается.
const DESK = window.SIGNAL_DESKTOP || null;
const verNum = v => String(v).split('.').map(x => +x || 0).reduce((s, x) => s * 1000 + x, 0);
const UPD = { ver: '', shell: '', notes: '', last: 0, busy: false };
const onSite = () => /^https?:$/.test(location.protocol) && location.href.startsWith(SITE_URL);
async function hardReload(v) {
  try { await idb.set('doc', snap()); } catch (e) { }
  try { if (window.caches) for (const k of await caches.keys()) if (k.startsWith(CACHE_PREFIX)) await caches.delete(k); } catch (e) { }
  try { if (navigator.serviceWorker) for (const r of await navigator.serviceWorker.getRegistrations()) await r.update(); } catch (e) { }
  const u = new URL(location.href); u.searchParams.set('v', v || String(Date.now())); location.replace(u.toString());
}
function syncVerBtn() {
  const b = $('#verBtn'); if (!b) return;
  const has = !!(UPD.ver || UPD.shell);
  b.innerHTML = `<span class="vic">⟳</span>${APP_VERSION}`;
  b.classList.toggle('has-upd', has);
  b.title = has ? `Доступна версия ${UPD.ver || UPD.shell} — нажмите, чтобы обновить${UPD.notes ? '\n' + UPD.notes : ''}`
    : `Версия ${APP_VERSION}${DESK ? ' (приложение ' + DESK.shell + ')' : ''} — нажмите, чтобы проверить обновления`;
}
async function fetchVer() {
  const url = (onSite() ? 'version.json' : SITE_URL + 'version.json') + '?t=' + Date.now();
  const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
async function pollUpdate(force, manual) {
  if (UPD.busy || (inClaude() && !manual)) return;
  if (!force && Date.now() - UPD.last < 12e4) return;
  UPD.last = Date.now();
  let j; try { j = await fetchVer(); } catch (e) { if (manual) toast('Не удалось проверить обновления — нет связи с сайтом', 'w'); return; }
  UPD.ver = verNum(j.version) > verNum(APP_VERSION) ? j.version : '';
  const sh = j.desktop && j.desktop.shell;
  UPD.shell = DESK && sh && verNum(sh) > verNum(DESK.shell) ? sh : '';
  UPD.notes = (UPD.ver || UPD.shell) && j.notes ? String(j.notes) : '';
  syncVerBtn();
  if (!UPD.ver && !UPD.shell) { $('#updCard')?.remove(); if (manual) toast(`У вас последняя версия ${APP_VERSION}`); return; }
  const key = (UPD.ver || UPD.shell) + '|' + new Date().toDateString();
  // старое приложение (без обновления в один клик) само показывает своё окно — здесь только мигающая кнопка
  if (DESK && typeof DESK.update !== 'function' && !manual) return;
  if (manual || store.get('updLater', '') !== key) showUpdCard(key);
}
function showUpdCard(key) {
  $('#updCard')?.remove();
  const v = UPD.ver || UPD.shell;
  const how = DESK ? 'Программа скачает новую версию и перезапустится. Схема и библиотека сохранятся.'
    : onSite() ? 'Страница перезагрузится с новой версией. Схема и библиотека сохранятся.'
    : 'Эта страница открыта файлом с компьютера и сама не обновится — откройте новую версию на сайте.';
  const d = document.createElement('div'); d.id = 'updCard';
  d.innerHTML = `<b>Доступна версия ${esc(v)}</b><div class="muted">У вас ${APP_VERSION}${DESK && UPD.shell && !UPD.ver ? ' (приложение ' + esc(DESK.shell) + ')' : ''}.</div>`
    + (UPD.notes ? `<div class="un">${esc(UPD.notes)}</div>` : '') + `<div class="muted">${how}</div>`
    + `<div class="ub"><button class="pri" data-u="go">${DESK || onSite() ? 'Обновить' : 'Открыть сайт'}</button><button data-u="later">Позже</button></div>`;
  d.onclick = ev => {
    const a = ev.target.dataset.u; if (!a) return;
    d.remove();
    if (a === 'later') { store.set('updLater', key); return; }
    doUpdate();
  };
  document.body.appendChild(d);
}
async function doUpdate() {
  if (UPD.busy) return;
  if (DESK) {
    if (typeof DESK.update !== 'function') return DESK.checkUpdates && DESK.checkUpdates(); // старое приложение — его окно обновления
    UPD.busy = true;
    try { await idb.set('doc', snap()); } catch (e) { }
    const t = document.createElement('div'); t.id = 'updBusy'; t.textContent = 'Загрузка обновления…'; document.body.appendChild(t);
    try {
      const r = await DESK.update(UPD.ver, UPD.shell);
      if (r && r.error) throw new Error(r.error);
      t.textContent = r && r.restart ? 'Устанавливаю обновление и перезапускаю…' : 'Готово — открываю новую версию…';
    } catch (e) {
      t.remove(); UPD.busy = false;
      toast('Обновление не удалось: ' + (e.message || e) + '. Можно скачать новую версию на странице загрузки.', 'e');
    }
    return;
  }
  if (onSite()) return hardReload(UPD.ver);
  window.open(SITE_URL, '_blank');
}
if (DESK && DESK.onProgress) DESK.onProgress(p => { const t = $('#updBusy'); if (t) t.textContent = 'Загрузка обновления… ' + Math.round(Math.max(0, Math.min(1, +p || 0)) * 100) + '%'; });
window.sigCheckUpdate = manual => pollUpdate(true, manual); // меню приложения «Проверить обновления…»
$('#verBtn').onclick = () => (UPD.ver || UPD.shell) ? doUpdate() : pollUpdate(true, true);
syncVerBtn();
setTimeout(() => pollUpdate(true), 1500);
setInterval(() => pollUpdate(true), 15 * 60 * 1000);
addEventListener('focus', () => pollUpdate(false));
document.addEventListener('visibilitychange', () => { if (!document.hidden) pollUpdate(false); });
// PWA (установка как приложение) — только при хостинге на своём сайте
try { if ('serviceWorker' in navigator && location.protocol === 'https:' && window.top === window && document.querySelector('link[rel=manifest]')) navigator.serviceWorker.register('sw.js'); } catch (e) { }
