// ============================================================================
//  Собственные иллюстрации устройств (для режима «Картинки», когда нет фото)
// ============================================================================
const ART = {};
(function () {
  const W = 480;
  const ear = (H) => `<rect x="0" y="0" width="${W}" height="${H}" rx="3" fill="#17191e"/>`
    + `<rect x="2" y="2" width="17" height="${H - 4}" rx="2" fill="#3b4048"/><rect x="${W - 19}" y="2" width="17" height="${H - 4}" rx="2" fill="#3b4048"/>`
    + [8, H - 8].map(y => `<circle cx="10.5" cy="${y}" r="3" fill="#111"/><circle cx="${W - 10.5}" cy="${y}" r="3" fill="#111"/>`).join('');
  const face = (H, acc) => `<rect x="22" y="3" width="${W - 44}" height="${H - 6}" rx="2" fill="#2a2e35"/><rect x="22" y="3" width="${W - 44}" height="3" fill="${acc}"/>`;
  const disp = (x, y, w, h, acc) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="#07111f" stroke="#4b5563"/>`
    + `<rect x="${x + 5}" y="${y + 5}" width="${w * 0.45}" height="${h * 0.18}" fill="${acc}" opacity=".8"/><rect x="${x + 5}" y="${y + h * 0.42}" width="${w * 0.7}" height="${h * 0.12}" fill="#9ca3af" opacity=".5"/><rect x="${x + 5}" y="${y + h * 0.64}" width="${w * 0.55}" height="${h * 0.12}" fill="#9ca3af" opacity=".35"/>`;
  const knob = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#0d0f12" stroke="#6b7280" stroke-width="2"/><circle cx="${cx}" cy="${cy}" r="${r * 0.6}" fill="#1f2328"/><circle cx="${cx - r * 0.3}" cy="${cy - r * 0.35}" r="${r * 0.12}" fill="#9ca3af"/>`;
  const btns = (x, y, cols, rows, bw, bh, gap, pick) => { let s = ''; for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const f = pick ? pick(c, r) : '#d1d5db'; s += `<rect x="${x + c * (bw + gap)}" y="${y + r * (bh + gap)}" width="${bw}" height="${bh}" rx="2" fill="${f}"/>`; } return s; };
  const leds = (x, y, n, gap, colors) => { let s = ''; for (let i = 0; i < n; i++) s += `<circle cx="${x + i * gap}" cy="${y}" r="2.6" fill="${colors[i % colors.length]}"/>`; return s; };
  const bnc = (x, y, r = 7) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#c9a227"/><circle cx="${x}" cy="${y}" r="${r * 0.55}" fill="#3a3a3a"/><circle cx="${x}" cy="${y}" r="${r * 0.18}" fill="#e5e7eb"/>`;
  const rj = (x, y) => `<rect x="${x}" y="${y}" width="15" height="12" rx="1" fill="#0b0c0e" stroke="#555"/><rect x="${x + 4}" y="${y + 8}" width="7" height="4" fill="#2b2b2b"/>`;
  const xlr = (x, y, r = 9) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#111" stroke="#9ca3af" stroke-width="1.5"/><circle cx="${x - 3}" cy="${y - 2}" r="1.3" fill="#aaa"/><circle cx="${x + 3}" cy="${y - 2}" r="1.3" fill="#aaa"/><circle cx="${x}" cy="${y + 3}" r="1.3" fill="#aaa"/>`;
  const vents = (x, y, w, h, n) => { let s = ''; for (let i = 0; i < n; i++) s += `<rect x="${x}" y="${y + i * (h / n)}" width="${w}" height="${h / n * 0.45}" rx="1" fill="#15171b"/>`; return s; };
  const grille = (x, y, w, h) => { let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#20242a"/>`; for (let yy = y + 6; yy < y + h - 3; yy += 9) for (let xx = x + 6 + ((yy / 9) % 2) * 4; xx < x + w - 3; xx += 9) s += `<circle cx="${xx}" cy="${yy}" r="2.6" fill="#0c0d10"/>`; return s; };
  const add = (key, w, h, body) => { ART[key] = { w, h, svg: `<symbol id="art-${key}" viewBox="0 0 ${w} ${h}">${body}</symbol>` }; };

  const rack = (key, U, acc, inner) => { const H = U * 44; add(key, W, H, ear(H) + face(H, acc) + inner(H)); };
  // --- рэковые
  rack('proc', 2, '#7c3aed', H => disp(36, 18, 112, 52, '#60a5fa') + knob(186, 44, 20)
    + btns(224, 18, 4, 2, 22, 22, 6) + btns(340, 18, 4, 2, 22, 22, 6, (c, r) => c === 3 && r === 1 ? '#ef4444' : '#d1d5db') + leds(36, 80, 6, 9, ['#22c55e']));
  rack('sw', 2, '#a855f7', H => disp(36, 14, 70, 40, '#f59e0b') + btns(118, 14, 14, 3, 16, 14, 4, (c, r) => r === 0 && c === 2 ? '#ef4444' : r === 1 && c === 4 ? '#22c55e' : '#d1d5db') + `<rect x="420" y="16" width="10" height="56" rx="3" fill="#0d0f12"/><rect x="412" y="34" width="26" height="9" rx="2" fill="#9ca3af"/>`);
  rack('rt', 2, '#9333ea', H => btns(40, 18, 20, 2, 14, 18, 4) + disp(420, 20, 20, 48, '#38bdf8'));
  rack('led', 2, '#db2777', H => `<rect x="34" y="20" width="10" height="16" rx="2" fill="#111"/>` + disp(56, 16, 96, 56, '#f472b6') + knob(186, 44, 19) + vents(226, 18, 210, 52, 7));
  rack('ccu', 2, '#1d4ed8', H => disp(36, 18, 110, 50, '#93c5fd') + knob(180, 30, 12) + knob(212, 30, 12) + knob(244, 30, 12) + leds(170, 66, 8, 12, ['#22c55e', '#f59e0b']) + vents(290, 18, 146, 52, 6));
  rack('rec', 2, '#b91c1c', H => disp(36, 16, 110, 56, '#fca5a5') + `<rect x="166" y="22" width="120" height="16" rx="3" fill="#0b0c0e" stroke="#555"/>` + btns(166, 52, 6, 1, 16, 16, 5, (c) => c === 1 ? '#ef4444' : '#d1d5db') + knob(330, 44, 18) + leds(380, 44, 5, 10, ['#22c55e']));
  rack('sync', 1, '#a16207', H => disp(32, 8, 60, 28, '#fde68a') + (() => { let s = ''; for (let i = 0; i < 10; i++) s += bnc(120 + i * 30, 22, 8); return s; })());
  rack('net', 1, '#0f766e', H => leds(34, 22, 4, 7, ['#22c55e']) + (() => { let s = ''; for (let i = 0; i < 12; i++) for (let r = 0; r < 2; r++) s += rj(70 + i * 22 + Math.floor(i / 6) * 8, 6 + r * 17); for (let i = 0; i < 4; i++) s += `<rect x="${360 + i * 20}" y="9" width="16" height="26" rx="1" fill="#0b0c0e" stroke="#777"/>`; return s; })());
  rack('aud', 2, '#be123c', H => (() => { let s = ''; for (let r = 0; r < 2; r++) for (let i = 0; i < 8; i++) s += xlr(52 + i * 34, 26 + r * 36, 11); return s; })() + disp(340, 18, 96, 30, '#fda4af') + knob(388, 66, 10));
  rack('pp', 1, '#78716c', H => (() => { let s = ''; for (let i = 0; i < 16; i++) { s += bnc(44 + i * 26, 14, 6); s += bnc(44 + i * 26, 31, 6); } return s; })());
  rack('d3', 4, '#e5e7eb', H => grille(26, 8, W - 52, H - 52) + `<rect x="26" y="${H - 40}" width="${W - 52}" height="34" fill="#2a2e35"/>` + disp(40, H - 34, 90, 22, '#e5e7eb') + `<rect x="150" y="${H - 30}" width="8" height="14" rx="1" fill="#3b82f6"/><rect x="166" y="${H - 30}" width="8" height="14" rx="1" fill="#3b82f6"/><circle cx="200" cy="${H - 23}" r="6" fill="#111" stroke="#6b7280"/>` + `<text x="${W / 2}" y="${(H - 44) / 2 + 14}" text-anchor="middle" font-size="40" font-family="Arial" fill="#d1d5db" opacity=".85">d3</text>`);
  // --- настольные коробки
  const box = (key, acc, top) => add(key, 220, 120, `<rect x="6" y="26" width="208" height="88" rx="8" fill="#4b5563"/><rect x="6" y="26" width="208" height="88" rx="8" fill="url(#artG)"/><rect x="18" y="40" width="70" height="8" rx="2" fill="${acc}"/><rect x="18" y="56" width="120" height="5" rx="2" fill="#9ca3af" opacity=".6"/><circle cx="196" cy="100" r="3" fill="#22c55e"/>` + top);
  box('conv', '#0891b2', bnc(40, 18, 11) + bnc(80, 18, 11) + `<rect x="130" y="10" width="34" height="14" rx="2" fill="#111"/><rect x="134" y="14" width="26" height="6" fill="#444"/>`);
  box('da', '#0e7490', [30, 62, 94, 126, 158, 190].map(x => bnc(x, 18, 10)).join(''));
  box('ext', '#15803d', `<rect x="40" y="8" width="30" height="16" rx="2" fill="#2563eb"/><rect x="74" y="8" width="30" height="16" rx="2" fill="#16a34a"/>` + `<rect x="130" y="10" width="34" height="14" rx="2" fill="#111"/>`);
  box('enc', '#0d9488', `<rect x="30" y="10" width="34" height="14" rx="2" fill="#111"/><rect x="80" y="8" width="22" height="16" rx="1" fill="#0b0c0e" stroke="#777"/>` + bnc(130, 17, 10) + `<rect x="176" y="-10" width="6" height="34" rx="3" fill="#111"/>`);
  box('my', '#0369a1', `<rect x="40" y="10" width="34" height="14" rx="2" fill="#111"/>` + bnc(110, 17, 10));
  // --- прочее
  add('cam', 300, 170, `<rect x="40" y="50" width="170" height="90" rx="12" fill="#1f2328"/><rect x="40" y="50" width="170" height="90" rx="12" fill="url(#artG)"/>`
    + `<rect x="200" y="70" width="60" height="56" rx="6" fill="#2b3036"/><circle cx="268" cy="98" r="30" fill="#0b0d10" stroke="#4b5563" stroke-width="5"/><circle cx="268" cy="98" r="17" fill="#1e3a5f"/><circle cx="262" cy="92" r="5" fill="#93c5fd" opacity=".7"/>`
    + `<rect x="60" y="22" width="110" height="30" rx="8" fill="#2b3036"/><rect x="18" y="62" width="30" height="50" rx="4" fill="#2b3036"/><circle cx="70" cy="95" r="6" fill="#ef4444"/><rect x="90" y="122" width="80" height="6" rx="2" fill="#2563eb" opacity=".8"/>`);
  add('mon', 260, 200, `<rect x="6" y="6" width="248" height="150" rx="6" fill="#16181c"/><rect x="14" y="14" width="232" height="134" fill="#1e3a5f"/><path d="M14 148 L120 60 L246 148 Z" fill="#2563eb" opacity=".35"/><circle cx="200" cy="44" r="14" fill="#fbbf24" opacity=".6"/>`
    + `<rect x="118" y="156" width="24" height="26" fill="#2b2f36"/><rect x="74" y="182" width="112" height="10" rx="4" fill="#2b2f36"/>`);
  add('mv', 260, 200, `<rect x="6" y="6" width="248" height="150" rx="6" fill="#16181c"/>` + [[14, 14], [130, 14], [14, 81], [130, 81]].map(([x, y], i) => `<rect x="${x}" y="${y}" width="114" height="65" fill="${['#1e3a5f', '#3f1d5f', '#14532d', '#5f3a1e'][i]}"/><rect x="${x + 6}" y="${y + 50}" width="40" height="8" fill="#000" opacity=".6"/>`).join('')
    + `<rect x="118" y="156" width="24" height="26" fill="#2b2f36"/><rect x="74" y="182" width="112" height="10" rx="4" fill="#2b2f36"/>`);
  add('nb', 280, 180, `<rect x="40" y="6" width="200" height="132" rx="8" fill="#9ca3af"/><rect x="50" y="15" width="180" height="114" fill="#0f172a"/><rect x="58" y="24" width="70" height="40" fill="#1d4ed8" opacity=".8"/><rect x="134" y="24" width="88" height="40" fill="#0ea5e9" opacity=".5"/><rect x="58" y="70" width="164" height="50" fill="#334155"/>`
    + `<path d="M14 142 H266 L276 168 H4 Z" fill="#cbd5e1"/><rect x="112" y="150" width="56" height="8" rx="3" fill="#94a3b8"/>`);
  add('pc', 150, 220, `<rect x="20" y="6" width="110" height="208" rx="8" fill="#1f2328"/><rect x="20" y="6" width="110" height="208" rx="8" fill="url(#artG)"/><rect x="36" y="22" width="78" height="10" rx="2" fill="#0b0c0e"/><rect x="36" y="40" width="78" height="10" rx="2" fill="#0b0c0e"/>` + vents(36, 120, 78, 70, 8) + `<circle cx="75" cy="98" r="7" fill="#111" stroke="#60a5fa" stroke-width="2"/>`);
  add('ctl', 300, 150, `<path d="M20 20 H280 L296 140 H4 Z" fill="#2a2e35"/><path d="M20 20 H280 L296 140 H4 Z" fill="url(#artG)"/>` + btns(34, 34, 10, 2, 16, 14, 6, (c, r) => r === 0 && c === 3 ? '#ef4444' : r === 1 && c === 5 ? '#22c55e' : '#d1d5db')
    + btns(30, 84, 6, 2, 16, 14, 6, () => '#fbbf24') + `<rect x="200" y="76" width="10" height="56" rx="3" fill="#0d0f12"/><rect x="192" y="96" width="26" height="10" rx="2" fill="#9ca3af"/><circle cx="258" cy="104" r="14" fill="#0d0f12"/><rect x="254" y="84" width="8" height="22" rx="4" fill="#4b5563"/>`);
  add('light', 170, 220, `<path d="M40 200 H130 L120 176 H50 Z" fill="#1f2328"/><rect x="74" y="150" width="22" height="30" fill="#2b2f36"/><path d="M30 60 Q85 -10 140 60 V150 H30 Z" fill="#2a2e35"/><path d="M30 60 Q85 -10 140 60 V150 H30 Z" fill="url(#artG)"/>`
    + `<circle cx="85" cy="92" r="40" fill="#0b0d10" stroke="#4b5563" stroke-width="4"/>` + [[85, 92], [70, 80], [100, 80], [70, 104], [100, 104], [85, 70], [85, 114], [62, 92], [108, 92]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6" fill="#a78bfa"/>`).join(''));
  add('power', 140, 220, `<rect x="16" y="6" width="108" height="208" rx="10" fill="#17191e"/><rect x="16" y="6" width="108" height="208" rx="10" fill="url(#artG)"/><rect x="34" y="30" width="72" height="30" rx="3" fill="#0b1a2e"/><rect x="40" y="38" width="40" height="8" fill="#22c55e" opacity=".8"/>` + leds(44, 78, 4, 16, ['#22c55e', '#22c55e', '#f59e0b', '#ef4444']) + vents(34, 110, 72, 80, 8));
  add('per', 280, 100, `<rect x="6" y="14" width="268" height="78" rx="10" fill="#2a2e35"/>` + btns(18, 24, 14, 4, 14, 12, 4) + `<rect x="80" y="76" width="110" height="10" rx="2" fill="#d1d5db"/>`);
  // общий блик
  const grad = `<linearGradient id="artG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".14"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".18"/></linearGradient>`;
  ART._defs = grad + Object.values(ART).filter(a => a && a.svg).map(a => a.svg).join('');
})();
// какая иллюстрация подходит устройству
function artKey(cat) {
  return { cam: 'cam', ccu: 'ccu', sw: 'sw', proc: 'proc', rt: 'rt', conv: 'conv', da: 'da', ext: 'ext', mon: 'mon', mv: 'mv', led: 'led', rec: 'rec', pc: 'pc', nb: 'nb', d3: 'd3', enc: 'enc', net: 'net', sync: 'sync', aud: 'aud', ctl: 'ctl', light: 'light', power: 'power', per: 'per', pp: 'pp', my: 'my' }[cat] || 'my';
}
