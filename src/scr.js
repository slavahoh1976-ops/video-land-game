// ============================================================================
//  ФАЙЛ .scr ДЛЯ NovaLCT («Screen Connection» → «Load from File»)
//  Формат — по открытой библиотеке novastar.js (MIT, © Andrei Sarakeev), разбор NovaLCT:
//  заголовок «DSCI» + сумма байтов, блок DVI, блок экранов (версия 1006), блок настроек экранов.
//  Сверено побайтно с настоящим файлом NovaLCT (cfg/test.scr). Контрольные суммы — сумма байтов mod 65536.
//  scr: { type: 'std'|'cpx', x, y, cols, rows, regions: [{ s, p, c, x, y, col, row, w, h }] } — regions:
//    для стандартного экрана в порядке «по столбцам, внутри — по рядам», как пишет NovaLCT.
// ============================================================================
function buildSCR(screens) {
  const sum = (u, a, b) => { let t = 0; for (let i = a; i < b; i++) t += u[i]; return t & 0xffff; };
  const W = (len) => ({ u: new Uint8Array(len), get v() { return new DataView(this.u.buffer); } });
  // DVI (128 байт): версия 1001, сумма, 1×1 порт DVI, 1920×1080 — как в файле NovaLCT
  const dvi = W(128); { const v = dvi.v; v.setUint16(0, 1001, true); dvi.u[4] = 1; dvi.u[5] = 1; v.setUint16(6, 1920, true); v.setUint16(8, 1080, true); v.setUint16(2, sum(dvi.u, 4, 128), true); }
  // экраны
  const bodies = screens.map(S => {
    if (S.type === 'std') {
      const b = W(10 + S.regions.length * 17), v = b.v;
      b.u[0] = 1; b.u[1] = 0; v.setUint16(2, S.x, true); v.setUint16(4, S.y, true); v.setUint16(6, S.cols, true); v.setUint16(8, S.rows, true);
      S.regions.forEach((r, i) => { const o = 10 + i * 17; b.u[o] = r.s; b.u[o + 1] = r.p; v.setUint16(o + 2, r.c, true); v.setUint16(o + 4, r.x, true); v.setUint16(o + 6, r.y, true); v.setUint16(o + 8, r.col, true); v.setUint16(o + 10, r.row, true); v.setUint16(o + 12, r.w, true); v.setUint16(o + 14, r.h, true); b.u[o + 16] = 255; });
      return b.u;
    }
    const b = W(6 + S.regions.length * 16), v = b.v;
    b.u[0] = 2; b.u[1] = 0; v.setUint32(2, S.regions.length, true);
    S.regions.forEach((r, i) => { const o = 6 + i * 16; b.u[o] = r.s; b.u[o + 1] = r.p; v.setUint16(o + 2, r.c, true); v.setUint16(o + 4, r.x, true); v.setUint16(o + 6, r.y, true); v.setUint16(o + 8, r.col || 0, true); v.setUint16(o + 10, r.row || 0, true); v.setUint16(o + 12, r.w, true); v.setUint16(o + 14, r.h, true); });
    return b.u;
  });
  const ext = new TextEncoder().encode(JSON.stringify(screens.map((_, i) => ({ si: i, x1: 0, y1: 0, x2: 0, y2: 0, x3: 0, y3: 0, x4: 0, y4: 0 }))));
  const head = 133 + 4 * screens.length, extPos = head + bodies.reduce((a, b) => a + b.length, 0);
  const si = W(extPos + 2 + ext.length); { const v = si.v;
    v.setUint16(0, 1006, true); v.setUint32(28, extPos, true); si.u[132] = screens.length;
    let o = head; bodies.forEach((b, i) => { v.setUint32(133 + 4 * i, b.length, true); si.u.set(b, o); o += b.length; });
    v.setUint16(extPos, ext.length, true); si.u.set(ext, extPos + 2); v.setUint16(2, sum(si.u, 4, si.u.length), true); }
  // настройки экранов: версия 1002, по 40 байт на экран (масштаб 1:1, VirtualMap 228 — как в файле NovaLCT)
  const ad = W(133 + 40 * screens.length); { const v = ad.v;
    v.setUint16(0, 1002, true); ad.u[132] = screens.length;
    screens.forEach((_, i) => { const o = 133 + 40 * i; ad.u[o + 1] = 1; ad.u[o + 3] = 1; ad.u[o + 4] = 228; });
    v.setUint16(2, sum(ad.u, 4, ad.u.length), true); }
  const out = new Uint8Array(54 + dvi.u.length + si.u.length + ad.u.length), v = new DataView(out.buffer);
  out.set([68, 83, 67, 73], 0); v.setUint32(6, dvi.u.length, true); v.setUint32(10, si.u.length, true); v.setUint16(14, ad.u.length, true);
  out.set(dvi.u, 54); out.set(si.u, 54 + dvi.u.length); out.set(ad.u, 54 + dvi.u.length + si.u.length);
  v.setUint16(4, sum(out, 6, 54 + dvi.u.length + si.u.length), true);
  return out;
}
