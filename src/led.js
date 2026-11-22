// ============================================================================
//  «ЭКРАН» — коммутация кабинетов LED-экрана (как NovaLCT, только удобнее):
//  выбор кабинетов и контроллера, экран из кабинетов (в т. ч. неровный и из разных кабинетов),
//  разводка данных по портам (авто змейкой / вручную протягиванием), загрузка портов,
//  резерв, линии питания по фазам, итоги, экспорт PNG/SVG/CSV. Хранится в проекте (doc.led).
// ============================================================================
const LED = (() => {
  // ---------- базы (типовые значения — сверяйте с паспортом своих кабинетов)
  // база кабинетов: типовые размеры × шаги пикселя + популярные прокатные модели.
  // Пиксели — по шагу; вес и мощность — типовые (≈30 кг/м², ≈760 Вт/м²), сверяйте с паспортом.
  // est: true — вес/мощность оценены (≈30 кг/м², ≈760 Вт/м²), не из паспорта; src — откуда взяты цифры
  const mk = (grp, maker, name, wmm, hmm, wpx, hpx, kg, wmax, wavg, src) => {
    const a = wmm * hmm / 1e6, est = !(kg && wmax);
    return { id: ('k_' + maker + '_' + name + '_' + wmm + 'x' + hmm).replace(/[^\w]+/g, '_'), grp, maker, name, wmm, hmm, wpx, hpx,
      kg: kg || Math.round(a * 30 * 10) / 10, wmax: wmax || Math.round(a * 760 / 5) * 5, wavg: wavg || 0, est, kgEst: !kg, src: src || '' };
  };
  const GEN = [ // [ширина мм, высота мм, [[шаг, px по ширине, px по высоте], ...], подпись]
    [500, 500, [[0.98, 512, 512], [1.25, 400, 400], [1.56, 320, 320], [1.95, 256, 256], [2.5, 200, 200], [2.6, 192, 192], [2.84, 176, 176], [2.9, 168, 168], [3.47, 144, 144], [3.9, 128, 128], [4.8, 104, 104], [5.95, 84, 84], [6.25, 80, 80]]],
    [500, 1000, [[1.95, 256, 512], [2.5, 200, 400], [2.6, 192, 384], [2.84, 176, 352], [2.9, 168, 336], [3.47, 144, 288], [3.9, 128, 256], [4.8, 104, 208], [5.95, 84, 168], [6.25, 80, 160], [7.8, 64, 128], [10.4, 48, 96]]],
    [500, 750, [[2.6, 192, 288], [2.9, 168, 252], [3.9, 128, 192]]],
    [500, 250, [[1.95, 256, 128], [2.6, 192, 96], [2.9, 168, 84], [3.9, 128, 64]], 'половинка'],
    [1000, 500, [[2.6, 384, 192], [2.9, 336, 168], [3.91, 256, 128], [4.81, 208, 104], [5.95, 168, 84]]],
    [1000, 1000, [[3.91, 256, 256], [4.81, 208, 208], [5.95, 168, 168], [7.8, 128, 128], [10.4, 96, 96]]],
    [600, 337.5, [[0.94, 640, 360], [1.25, 480, 270], [1.56, 384, 216], [1.875, 320, 180], [2.5, 240, 135]], '16:9'],
    [640, 480, [[1.25, 512, 384], [1.67, 384, 288], [1.86, 344, 258], [2.5, 256, 192], [3.33, 192, 144], [4, 160, 120], [5, 128, 96]]],
    [640, 640, [[2.5, 256, 256], [4, 160, 160], [5, 128, 128], [6.67, 96, 96], [8, 80, 80], [10, 64, 64]]],
    [600, 600, [[2.5, 240, 240], [3.75, 160, 160], [4.68, 128, 128], [6.25, 96, 96]]],
    [600, 1200, [[3.75, 160, 320], [5.77, 104, 208], [8.33, 72, 144]]],
    [960, 960, [[4, 240, 240], [5, 192, 192], [6.67, 144, 144], [8, 120, 120], [10, 96, 96], [16, 60, 60]]],
    [768, 768, [[4, 192, 192], [6, 128, 128], [8, 96, 96]]],
  ];
  const CABS = [];
  for (const [w, h, list, note] of GEN) for (const [p, x, y] of list) CABS.push(mk(`Типовые ${w}×${h}`, '', `${w}×${h} P${p}${note ? ' (' + note + ')' : ''}`, w, h, x, y));
  // прокатные модели — только проверенные по паспортам производителей: [производитель, модель, мм, мм, px, px, кг, Вт макс, Вт сред, источник]
  // 0 — в паспорте не нашли: такое поле считается оценкой и помечается «≈»
  const BR = [
    ['ROE Visual', 'Black Pearl BP2 V2', 500, 500, 176, 176, 9.35, 190, 95, 'паспорт ROE (BP2V2)'],
    ['ROE Visual', 'Black Pearl BP3', 500, 500, 128, 128, 8.7, 170, 85, 'паспорт ROE (BP3)'],
    ['Unilumin', 'Upad III 2.6', 500, 500, 192, 192, 9, 120, 40, 'паспорт Upad III'],
    ['Unilumin', 'Upad III 3.9', 500, 500, 128, 128, 0, 120, 40, 'паспорт Upad III (вес не указан)'],
    ['Unilumin', 'Upad IV 2.6', 500, 500, 192, 192, 6.3, 150, 50, 'паспорт Upad IV'],
    ['Unilumin', 'URM III 2.6 MK2 Pro', 500, 500, 192, 192, 7.62, 130, 45, 'паспорт URM III 2.6 MK2 Pro'],
    ['Leyard / Planar', 'CarbonLight CLI2.6 (одно питание)', 500, 500, 192, 192, 3.8, 150, 75, 'паспорт Leyard CLI2.6'],
    ['Leyard / Planar', 'CarbonLight CLI2.6L', 500, 1000, 192, 384, 7.0, 400, 135, 'паспорт Planar CLI2.6L (800/270 Вт/м²)'],
    ['Absen', 'PL1.9 Pro V10', 500, 500, 256, 256, 9, 0, 0, 'паспорт Absen (мощность не указана)'],
    ['Absen', 'PL2.5 Pro V10', 500, 500, 200, 200, 8.6, 0, 0, 'паспорт Absen (мощность не указана)'],
    ['Absen', 'PL3.9 Pro V10', 500, 500, 128, 128, 8.4, 0, 0, 'паспорт Absen (мощность не указана)'],
    ['Absen', 'PL3.9 Pro V10 (500×1000)', 500, 1000, 128, 256, 13.7, 0, 0, 'паспорт Absen (мощность не указана)'],
    ['Hikvision', 'DS-D4626CD-1A (P2.6)', 500, 500, 192, 192, 6.85, 115, 38, 'паспорт Hikvision (460/154 Вт/м²)'],
    ['LG', 'GSCE039 (P3.9)', 500, 1000, 128, 256, 12.4, 300, 100, 'паспорт LG GSCE039'],
  ];
  for (const [m, n, w, h, x, y, kg, wm, wa, src] of BR) CABS.push(mk(m, m, n, w, h, x, y, kg, wm, wa, src));
  const DEFCAB = () => CABS.find(c => c.name === '500×500 P2.6') || DEFCAB();
  // порт — 650 000 пикселей при 8 бит (вдвое меньше при 10/12 бит); maxW/maxH — предел ширины/высоты холста
  // контроллеры NovaStar — сверено с паспортами / руководствами NovaStar (src). Нагрузка на порт — для 60 Гц:
  //   formula: true — COEX: нагрузка × бит × частота < 0,95 Гбит/с (8 бит — 24, 10 бит A10s/A8s Pro — 32, 10/12 бит — 48)
  //   иначе — паспортные px на порт при 60 Гц (p8 / p10 / p12), на другой частоте пропорционально.
  //   maxW / maxH: 0 — в паспорте не найдено, размер не проверяем.
  const CTRLS = [
    { id: 'mx20', ser: 'COEX', name: 'NovaStar MX20', ports: 6, total: 3900000, maxW: 0, maxH: 0, formula: true, a10: true, src: 'MX20 Specifications V1.4.0' },
    { id: 'mx30', ser: 'COEX', name: 'NovaStar MX30', ports: 10, total: 6500000, maxW: 0, maxH: 0, formula: true, a10: true, src: 'MX30 Specifications V1.5.1' },
    { id: 'mx40', ser: 'COEX', name: 'NovaStar MX40 Pro', ports: 20, total: 9000000, maxW: 16384, maxH: 16384, formula: true, a10: true, src: 'MX40 Pro Specifications V1.5.1, COEX Wiki' },
    { id: 'ku20', ser: 'COEX', name: 'NovaStar KU20', ports: 6, total: 3900000, maxW: 0, maxH: 0, formula: true, only8: true, src: 'KU20 Specifications V1.1.0 (10 бит — только спец. прошивка)' },
    { id: 'cx40', ser: 'COEX', name: 'NovaStar CX40 Pro (5 Гбит/с, карты XA50 Pro / CA50E)', ports: 6, total: 9000000, maxW: 16384, maxH: 16384, p8: 2951200, p10: 2213200, p12: 1475600, src: 'CX40 Pro User Manual V1.5.0' },
    { id: 'vx400', ser: 'VX', name: 'NovaStar VX400 / VX400 Pro', ports: 4, total: 2600000, maxW: 10240, maxH: 8192, p8: 650000, src: 'VX400 / VX400 Pro Specifications' },
    { id: 'vx600', ser: 'VX', name: 'NovaStar VX600 / VX600 Pro', ports: 6, total: 3900000, maxW: 10240, maxH: 8192, p8: 650000, src: 'VX600 / VX600 Pro Specifications' },
    { id: 'vx1000', ser: 'VX', name: 'NovaStar VX1000 / VX1000 Pro', ports: 10, total: 6500000, maxW: 10240, maxH: 8192, p8: 650000, src: 'VX1000 / VX1000 Pro Specifications' },
    { id: 'vx2000', ser: 'VX', name: 'NovaStar VX2000 Pro', ports: 20, total: 13000000, maxW: 16384, maxH: 8192, p8: 650000, src: 'VX2000 Pro Specifications, VX Pro User Manual' },
    { id: 'vx4sn', ser: 'VX', name: 'NovaStar VX4S-N', ports: 4, total: 2300000, maxW: 3840, maxH: 1920, p8: 650000, p8note: true, src: 'VX4S-N User Manual' },
    { id: 'vx6s', ser: 'VX', name: 'NovaStar VX6s', ports: 6, total: 3900000, maxW: 4096, maxH: 4096, p8: 650000, p8note: true, src: 'VX6s Specifications V1.1.0' },
    { id: 'vx16s', ser: 'VX', name: 'NovaStar VX16s', ports: 16, total: 10400000, maxW: 16384, maxH: 8192, p8: 650000, src: 'VX16s Specifications V1.0.0' },
    { id: 'm300', ser: 'MCTRL', name: 'NovaStar MCTRL300', ports: 2, total: 2304000, maxW: 3840, maxH: 3840, p8: 650000, note: 'вход до 1920×1200; через 2 порта — не больше 1 300 000 px', src: 'MCTRL300 Specifications V2.4.0' },
    { id: 'm600', ser: 'MCTRL', name: 'NovaStar MCTRL600', ports: 4, total: 2304000, maxW: 3840, maxH: 3840, p8: 650000, src: 'MCTRL600 Specifications V2.3.4' },
    { id: 'm660', ser: 'MCTRL', name: 'NovaStar MCTRL660', ports: 4, total: 2304000, maxW: 3840, maxH: 3840, p8: 650000, note: 'через HDMI высота до 2560', src: 'MCTRL660 Specifications V1.4.1 / User Manual V1.4.3' },
    { id: 'm660p', ser: 'MCTRL', name: 'NovaStar MCTRL660 PRO', ports: 6, total: 2304000, maxW: 3840, maxH: 3840, p8: 650000, p10: 325000, src: 'MCTRL660 PRO Specifications' },
    { id: 'm700', ser: 'MCTRL', name: 'NovaStar MCTRL700', ports: 6, total: 2304000, maxW: 3840, maxH: 3840, p8: 650000, src: 'MCTRL700 Specifications V1.2.2' },
    { id: 'm4k', ser: 'MCTRL', name: 'NovaStar MCTRL4K', ports: 16, total: 8800000, maxW: 7680, maxH: 7680, p8: 650000, p10: 320000, note: 'через DVI — до 8 300 000 px', src: 'MCTRL4K Specifications' },
    { id: 'uhdjr', ser: 'NovaPro', name: 'NovaStar NovaPro UHD Jr', ports: 16, total: 10400000, maxW: 16384, maxH: 8192, p8: 650000, p10: 320000, src: 'NovaPro UHD Jr Specifications V1.1.2' },
    { id: 'h16', ser: 'H', name: 'NovaStar H-серия, карта 16×RJ45', ports: 16, total: 10400000, maxW: 10240, maxH: 10240, p8: 650000, p10: 320000, src: 'описание карты H_16xRJ45+2xFiber' },
  ];
  // ---------- приёмные карты NovaStar — только цифры из паспортов NovaStar (src). Максимум на одну карту при 60 Гц, Ш×В px.
  //   pwm / com — для ШИМ (PWM) и обычных (common) драйверов модулей; ключи 8 / 10 / 12 — бит; all — одна цифра без разбивки по битам.
  //   cx — с контроллерами COEX (если в паспорте отдельно); a10 — режим «10 бит A10s Pro / A8s Pro»;
  //   g5 — 5G-карта (только CX40 Pro / CX80 Pro); coex — есть в списке поддерживаемых карт COEX 1G.
  //   Нет цифры в паспорте — нет ключа: программа пишет «в паспорте не найдено», а не выдумывает.
  const RCARDS = [
    { id: 'a5sp', ser: 'Armor', name: 'A5s Plus', pwm: { 8: [512, 384], 10: [256, 384], 12: [256, 384] }, com: { 8: [384, 384], 10: [192, 384], 12: [192, 384] }, coex: true, src: 'A5s Plus Specifications V1.4.1' },
    { id: 'a7sp', ser: 'Armor', name: 'A7s Plus', pwm: { all: [512, 512] }, com: { all: [512, 384] }, coex: true, src: 'A7s Plus Specifications (Introduction)' },
    { id: 'a8s', ser: 'Armor', name: 'A8s', pwm: { all: [512, 384] }, coex: true, src: 'A8s Specifications V2.1.3', note: 'в ранних версиях паспорта — 512×256 (PWM)' },
    { id: 'a8sn', ser: 'Armor', name: 'A8s-N', pwm: { all: [512, 384] }, com: { all: [384, 384] }, coex: true, src: 'A8s-N Specifications V1.3.1' },
    { id: 'a8spro', ser: 'Armor', name: 'A8s Pro', pwm: { 8: [512, 512], 10: [512, 384], 12: [512, 384] }, cx: { 10: [512, 512] }, a10: true, coex: true, src: 'A8s Pro Specifications V1.1.2' },
    { id: 'a10sp', ser: 'Armor', name: 'A10s Plus', pwm: { all: [512, 512] }, src: 'A10s Plus Specifications V1.0.0' },
    { id: 'a10spn', ser: 'Armor', name: 'A10s Plus-N', pwm: { all: [512, 512] }, coex: true, src: 'A10s Plus-N Specifications V1.1.0' },
    { id: 'a10spro', ser: 'Armor', name: 'A10s Pro', pwm: { 8: [512, 512], 10: [512, 512], 12: [512, 256] }, a10: true, coex: true, src: 'A10s Pro Specifications V1.3.0' },
    { id: 'a4s', ser: 'Armor', name: 'A4s', pwm: { all: [256, 256] }, src: 'A4s Specifications V2.0.0' },
    { id: 'nv7512', ser: 'Armor', name: 'NV7512', pwm: { 8: [512, 512], 10: [512, 256] }, com: { 8: [512, 384], 10: [512, 192] }, src: 'NV7512 Specifications' },
    { id: 'xa50', ser: '5G (COEX)', name: 'XA50 Pro', pwm: { 8: [1024, 512], 10: [1024, 512], 12: [620, 512] }, g5: true, src: 'XA50 Pro Specifications' },
    { id: 'ca50e', ser: '5G (COEX)', name: 'CA50E', pwm: { 8: [768, 512], 10: [768, 512], 12: [512, 480] }, g5: true, src: 'CA50E Specifications V1.1.0' },
    { id: 'ca50c', ser: '5G (COEX)', name: 'CA50C', g5: true, src: 'COEX Control System Solution Manual (нагрузка карты в найденных паспортах не указана)' },
    { id: 'mrv532', ser: 'MRV', name: 'MRV532', pwm: { 8: [512, 384], 10: [256, 384], 12: [256, 384] }, cx: { 8: [512, 384], 10: [512, 384] }, coex: true, src: 'MRV532 Specifications V1.1.1' },
    { id: 'mrv432', ser: 'MRV', name: 'MRV432', pwm: { all: [512, 512] }, src: 'MRV432 Specifications V1.0.2' },
    { id: 'mrv416', ser: 'MRV', name: 'MRV416', pwm: { all: [512, 384] }, com: { all: [384, 384] }, src: 'MRV416 Specifications V1.0.2' },
    { id: 'mrv412', ser: 'MRV', name: 'MRV412', pwm: { all: [512, 512] }, src: 'MRV412 Specifications V1.0.3' },
    { id: 'mrv336', ser: 'MRV', name: 'MRV336', pwm: { all: [256, 256] }, src: 'MRV336 Specifications V1.2.0' },
    { id: 'b832', ser: 'прочие', name: 'B832', pwm: { all: [512, 512] }, src: 'B832 Specifications V1.1.3' },
    { id: 'at32', ser: 'прочие', name: 'AT32', pwm: { all: [512, 256] }, src: 'AT32 Specifications V1.0.1' },
  ];
  const RCSER = ['Armor', '5G (COEX)', 'MRV', 'прочие'];
  const rcById = id => RCARDS.find(r => r.id === id) || null;
  const G5CTRL = new Set(['cx40']);
  const PORT_PX = 650000;
  const PCOL = ['#2563eb', '#16a34a', '#ea580c', '#9333ea', '#0891b2', '#dc2626', '#ca8a04', '#db2777', '#4f46e5', '#059669', '#b45309', '#7c3aed', '#0284c7', '#65a30d', '#e11d48', '#0d9488', '#a16207', '#c026d3', '#1d4ed8', '#15803d'];
  const WCOL = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
  const PH = ['L1', 'L2', 'L3'];

  let L = null;              // doc.led
  let my = { cabs: [], ctrls: [] }; // свои кабинеты и контроллеры
  let on = false, mode = 'sel', act = 0, actW = 0, split = null, qp = { start: 'tl', dir: 'h', snake: true };
  let sel = new Set(), curCab = null;
  let vz = { x: 40, y: 40, z: 0.5 };
  const undoL = [], redoL = [];
  const $l = s => document.querySelector(s);
  const fmt = n => Math.round(n).toLocaleString('ru-RU');
  const f1 = n => (Math.round(n * 10) / 10).toLocaleString('ru-RU');
  const f2 = n => (Math.round(n * 100) / 100).toLocaleString('ru-RU');

  const allCabs = () => [...my.cabs, ...CABS];
  const allCtrls = () => [...my.ctrls, ...CTRLS];
  const scr = () => L.screens[L.cur] || L.screens[0];
  const cabDef = (S, id) => S.defs[id] || allCabs().find(c => c.id === id) || DEFCAB();
  const ctrlOf = S => S.ctrl;
  // нагрузка порта: COEX (formula) — по формуле из паспорта; остальные — паспортные px при 60 Гц, на другой частоте пропорционально
  const FPS = [23.98, 24, 25, 29.97, 30, 48, 50, 59.94, 60, 72, 75, 100, 119.88, 120, 144, 240];
  const fpsOf = S => +S.fps || 60;
  const bitOf = S => S.bit || (S.depth > 8 ? '10' : '8');
  const BITN = { '8': '8 бит', '10a': '10 бит (карты A10s Pro / A8s Pro)', '10': '10 бит', '12': '12 бит' };
  const isCoex = S => !!S.ctrl.formula;
  const bitsOf = S => ({ '8': 24, '10a': 32, '10': 48, '12': 48 })[bitOf(S)] || 24;
  const bitIssue = S => { const c = S.ctrl, b = bitOf(S); if (c.only8 && b !== '8') return 'у этого контроллера по паспорту только 8 бит (10 бит — со специальной прошивкой) — считаю как 8 бит'; if (b === '10a' && !c.a10) return 'режим «A10s Pro / A8s Pro» в паспорте этого контроллера не указан — считаю как 10 бит'; if (b === '10a' && not10a(S).length) return 'режим «A10s Pro / A8s Pro» работает только с картами A10s Pro / A8s Pro, а в кабинетах ' + [...new Set(not10a(S).map(x => x.rc.name))].join(', ') + ' — считаю как 10 бит'; return ''; };
  const effBit = S => { const c = S.ctrl, b = bitOf(S); if (c.only8) return '8'; if (b === '10a' && (!c.a10 || not10a(S).length)) return '10'; return b; };
  const pasp60 = S => { const c = S.ctrl, b = effBit(S), p8 = c.p8 || c.perPort || PORT_PX; if (b === '8') return p8; if (b === '12') return c.p12 || c.p10 || Math.round(p8 / 2); return c.p10 || Math.round(p8 / 2); };
  const paspHas = S => { const c = S.ctrl, b = effBit(S); return b === '8' || (b === '12' ? !!(c.p12 || c.p10) : !!c.p10); };
  const portAt = (S, fps) => isCoex(S) ? Math.round(950000000 / (({ '8': 24, '10a': 32, '10': 48, '12': 48 })[effBit(S)] * fps)) : Math.round(pasp60(S) * 60 / fps);
  const basePort = S => portAt(S, 60);
  const portCap = S => portAt(S, fpsOf(S));
  const rateF = S => portCap(S) / PORT_PX;
  const hiF = S => 1;
  const ctrlCap = S => Math.floor(S.ctrl.total * (S.units || 1));
  const capNote = S => {
    const f = String(fpsOf(S)).replace('.', ',');
    if (isCoex(S)) return 'по формуле из паспорта: px × ' + ({ '8': 24, '10a': 32, '10': 48, '12': 48 })[effBit(S)] + ' бит × ' + f + ' Гц < 0,95 Гбит/с';
    const base = fmt(pasp60(S)) + ' px при 60 Гц' + (paspHas(S) ? '' : ' (для 10/12 бит цифры в паспорте нет — половина от 8 бит)') + (S.ctrl.p8note && effBit(S) === '8' ? ' (отдельной цифры на порт в паспорте нет — 650 000, как у портов 1 Гбит/с NovaStar)' : '');
    return fpsOf(S) === 60 ? 'по паспорту: ' + base : 'по паспорту ' + base + ' × 60 / ' + f + ' Гц';
  };
  // ---------- приёмные карты: что стоит в кабинетах экрана и сколько они тянут
  const keepRc = o => o && o.rc ? { rc: o.rc, rcn: o.rcn || 1 } : {};
  const putDef = (S, d) => { S.defs[d.id] = { ...d, ...keepRc(S.defs[d.id]) }; return S.defs[d.id]; };
  const cardsIn = S => Object.keys(typeCount(S)).map(t => { const d = cabDef(S, t); return { t, d, rc: rcById(d.rc), n: Math.max(1, Math.round(+d.rcn || 1)), cnt: typeCount(S)[t] }; });
  const not10a = S => cardsIn(S).filter(x => x.rc && !x.rc.a10);
  const rcBit = S => { const b = effBit(S); return b === '10a' ? '10' : b; };
  const ICN = { pwm: 'ШИМ (PWM)', common: 'обычные (common)' };
  const icOf = S => S.ic === 'common' ? 'common' : 'pwm';
  // предел одной карты по паспорту для текущих драйверов / глубины цвета / контроллера
  function rcLim(S, rc) {
    if (!rc) return null;
    const com = icOf(S) === 'common', b = rcBit(S), t = com ? rc.com : rc.pwm, drv = com ? 'обычные драйверы' : 'PWM-драйверы';
    if (!com && isCoex(S) && rc.cx && rc.cx[b]) return { w: rc.cx[b][0], h: rc.cx[b][1], how: `${drv}, ${b} бит, с COEX` };
    if (!t) return { miss: rc.pwm || rc.com ? `для ${com ? 'обычных драйверов' : 'PWM-драйверов'} цифры в паспорте нет` : 'нагрузка карты в паспорте не найдена' };
    if (t[b]) return { w: t[b][0], h: t[b][1], how: `${drv}, ${b} бит` };
    if (t.all) return { w: t.all[0], h: t.all[1], how: `${drv}, в паспорте одна цифра без разбивки по битам`, all: true };
    return { miss: `для ${b} бит в паспорте цифры нет` };
  }
  function rcCompat(S, rc) {
    if (!rc || String(S.ctrl.id).startsWith('myc_')) return '';
    const g5c = G5CTRL.has(S.ctrl.id), cn = S.ctrl.name.replace(/^NovaStar /, '').replace(/ \(.*$/, '');
    if (rc.g5 && !g5c) return `${rc.name} — 5G-карта COEX, по документации NovaStar работает с CX40 Pro / CX80 Pro, а не с ${cn}`;
    if (!rc.g5 && g5c) return `${cn} работает с 5G-картами CA50E / CA50C / XA50 (COEX Solution Manual), ${rc.name} — карта 1G`;
    if (isCoex(S) && !rc.coex) return `${rc.name} нет в списке карт, поддерживаемых ${cn} (паспорт MX40 Pro, COEX Solution Manual)`;
    return '';
  }
  // проверка по типам кабинетов: st — ok / over (перебор пикселей) / side (не входит по сторонам) / miss (нет цифры) / none (карта не выбрана)
  function rcCheck(S) {
    return cardsIn(S).map(x => {
      const { d, rc, n } = x, px = Math.ceil(d.wpx * d.hpx / n), r = { ...x, px, compat: rcCompat(S, rc) };
      if (!rc) return { ...r, st: 'none' };
      const L2 = rcLim(S, rc); r.lim = L2;
      if (L2.miss) return { ...r, st: 'miss' };
      const cap = L2.w * L2.h; r.cap = cap; r.load = px / cap;
      if (px > cap) return { ...r, st: 'over' };
      if (n === 1 && (d.wpx > L2.w || d.hpx > L2.h)) return { ...r, st: d.hpx <= L2.w && d.wpx <= L2.h ? 'rot' : 'side' };
      return { ...r, st: 'ok' };
    });
  }
  const rcName = S => { const a = [...new Set(cardsIn(S).filter(x => x.rc).map(x => x.rc.name + (x.n > 1 ? ' ×' + x.n : '')))]; return a.length ? a.join(', ') : (S.card || ''); };
  const nPorts = S => S.ctrl.ports * (S.units || 1);
  const portName = (S, i) => (S.units || 1) > 1 ? String.fromCharCode(65 + Math.floor(i / S.ctrl.ports)) + (i % S.ctrl.ports + 1) : String(i + 1);

  function newScreen(name) {
    const c = DEFCAB();
    const S = { id: uid(), name: name || 'Экран 1', defs: { [c.id]: { ...c } }, cabs: [], ctrl: { ...CTRLS.find(x => x.id === 'm4k') }, units: 1, depth: 8, ports: [], backup: false,
      pat: { start: 'tl', dir: 'h', snake: true, split: 'lines', per: 0 }, fps: 60, bit: '8',
      pw: { v: 230, a: 16, k: 80, phases: 3, start: 'tl', dir: 'v', snake: true, lines: [] }, card: '', note: '' };
    gridFill(S, c, 8, 4); S.grid = { t: c.id, cols: 8, rows: 4 }; autoData(S); autoPower(S);
    return S;
  }
  function gridFill(S, c, cols, rows, x0 = 0, y0 = 0) {
    putDef(S, c);
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) S.cabs.push({ id: uid(), t: c.id, x: x0 + k * c.wpx, y: y0 + r * c.hpx });
  }
  function load(d) {
    if (!d || !Array.isArray(d.screens) || !d.screens.length) d = { v: 1, cur: 0, screens: [newScreen()] };
    L = d; if (doc) doc.led = L;
    L.cur = clamp(L.cur || 0, 0, L.screens.length - 1);
    sel.clear(); undoL.length = 0; redoL.length = 0; act = 0; actW = 0;
    if (on) { render(); lFit(); }
  }
  function changed(noHist) {
    if (!noHist) { /* история уже записана */ }
    doc.led = L; dirtyFile = true; setSaveState();
    clearTimeout(changed.t); changed.t = setTimeout(() => idb.set('doc', snap()), 700);
    render();
  }
  function lHistDrop() { undoL.pop(); render(); }
  function lHist() { undoL.push(JSON.stringify(L)); if (undoL.length > 100) undoL.shift(); redoL.length = 0; }
  function lUndo() { if (!undoL.length) return; redoL.push(JSON.stringify(L)); L = JSON.parse(undoL.pop()); doc.led = L; sel.clear(); changed(true); }
  function lRedo() { if (!redoL.length) return; undoL.push(JSON.stringify(L)); L = JSON.parse(redoL.pop()); doc.led = L; sel.clear(); changed(true); }

  // ---------- питание: ток I = P / (U · cos φ); предел линии P ≤ U · I_автомата · запас · cos φ
  const pfOf = S => S.pw.pf > 0 && S.pw.pf <= 1 ? S.pw.pf : 0.95;
  const lineLim = S => S.pw.v * S.pw.a * S.pw.k / 100 * pfOf(S);
  const amps = (S, w) => w / (S.pw.v * pfOf(S));
  // ---------- геометрия
  const cw = (S, c) => cabDef(S, c.t).wpx, ch = (S, c) => cabDef(S, c.t).hpx;
  function bounds(S, list) {
    list = list || S.cabs; if (!list.length) return { x: 0, y: 0, w: 0, h: 0 };
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const c of list) { x0 = Math.min(x0, c.x); y0 = Math.min(y0, c.y); x1 = Math.max(x1, c.x + cw(S, c)); y1 = Math.max(y1, c.y + ch(S, c)); }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  const byId = S => new Map(S.cabs.map(c => [c.id, c]));
  const px = (S, c) => cw(S, c) * ch(S, c);
  // нагрузка кабинета на порт: у COEX область уже 128 px теряет (128 − ширина) × высота
  const pxLoad = (S, c) => isCoex(S) && cw(S, c) < 128 ? 128 * ch(S, c) : px(S, c);

  // порядок обхода: ряды (или столбцы), начало в углу, змейкой или зигзагом
  function lines(S, list, dir) {
    const h = dir === 'h';
    const key = c => h ? c.y + ch(S, c) / 2 : c.x + cw(S, c) / 2, sz = c => h ? ch(S, c) : cw(S, c);
    const arr = [...list].sort((a, b) => key(a) - key(b)), out = [];
    for (const c of arr) { const last = out[out.length - 1]; if (last && Math.abs(key(c) - last.k) < sz(c) / 2) last.items.push(c); else out.push({ k: key(c), items: [c] }); }
    return out.map(l => l.items);
  }
  function orderLines(S, list, p) {
    const h = p.dir === 'h', rev1 = h ? p.start[0] === 'b' : p.start[1] === 'r', rev2 = h ? p.start[1] === 'r' : p.start[0] === 'b';
    let ls = lines(S, list, p.dir); if (rev1) ls.reverse();
    return ls.map(l => l.sort((a, b) => h ? (rev2 ? b.x - a.x : a.x - b.x) : (rev2 ? b.y - a.y : a.y - b.y)));
  }
  const snakeJoin = (ls, snake) => ls.flatMap((l, i) => snake && i % 2 ? [...l].reverse() : l);

  // ---------- авторазводка данных
  function autoData(S) {
    const cap = portCap(S), N = nPorts(S), p = S.pat, ls = orderLines(S, S.cabs, p), out = [];
    if (p.split === 'count' && p.per > 0) {
      { const avg = S.cabs.length ? S.cabs.reduce((t, c) => t + pxLoad(S, c), 0) / S.cabs.length : 1, mx = Math.max(1, Math.floor(cap / avg)); if (p.per > mx) { p.per = mx; toast(`На порт помещается не больше ${mx} каб. — поставил ${mx}`, 'w'); } }
      const flat = snakeJoin(ls, p.snake); for (let i = 0; i < flat.length; i += p.per) out.push(flat.slice(i, i + p.per));
    } else if (p.split === 'lines') {
      // целыми рядами: сколько рядов помещается в порт; каждый порт идёт змейкой от своего края
      let cur = [], load = 0;
      const flush = () => { if (cur.length) out.push(snakeJoin(cur, p.snake)); cur = []; load = 0; };
      for (const l of ls) {
        const lp = l.reduce((s, c) => s + pxLoad(S, c), 0);
        if (lp > cap) { flush(); let part = [], pl = 0; for (const c of l) { if (pl + pxLoad(S, c) > cap && part.length) { out.push(part); part = []; pl = 0; } part.push(c); pl += pxLoad(S, c); } if (part.length) out.push(part); continue; }
        if (load + lp > cap) flush();
        cur.push(l); load += lp;
      }
      flush();
    } else {
      // по максимуму: порт заполняется до предела
      let cur = [], load = 0;
      for (const c of snakeJoin(ls, p.snake)) { if (load + pxLoad(S, c) > cap && cur.length) { out.push(cur); cur = []; load = 0; } cur.push(c); load += pxLoad(S, c); }
      if (cur.length) out.push(cur);
    }
    S.ports = out.map(a => a.map(c => c.id));
    if (out.length > N) toast(`Нужно ${out.length} портов, а у контроллера ${N} — добавьте ещё один контроллер или выберите другой`, 'w');
  }
  // авторазводка питания: по мощности линии (напряжение × автомат × запас)
  function autoPower(S) {
    const w = S.pw, lim = lineLim(S), ls = orderLines(S, S.cabs, w), out = [];
    if (w.split !== 'max') { // поровну: каждая линия — целый столбец/ряд или его равная часть
      for (const l of ls) {
        const tw = l.reduce((a, c) => a + (cabDef(S, c.t).wmax || 0), 0);
        for (let k = Math.max(1, Math.ceil(tw / lim)); k <= l.length; k++) { // делим поровну; если часть всё же больше автомата — делим мельче
          const base = Math.floor(l.length / k), extra = l.length % k, parts = []; let p = 0;
          for (let q = 0; q < k; q++) { const n = base + (q < extra ? 1 : 0); if (n) parts.push(l.slice(p, p + n)); p += n; }
          if (parts.every(pt => pt.reduce((a, c) => a + (cabDef(S, c.t).wmax || 0), 0) <= lim) || k === l.length) { out.push(...parts); break; }
        }
      }
      w.lines = out.map(a => a.map(c => c.id)); return;
    }
    let cur = [], load = 0;
    for (const c of snakeJoin(ls, w.snake)) { const cw2 = cabDef(S, c.t).wmax || 0; if (load + cw2 > lim && cur.length) { out.push(cur); cur = []; load = 0; } cur.push(c); load += cw2; }
    if (cur.length) out.push(cur);
    w.lines = out.map(a => a.map(c => c.id));
  }
  function clean(S) {
    { const fresh = S.ctrl && CTRLS.find(c => c.id === S.ctrl.id); if (fresh && JSON.stringify(fresh) !== JSON.stringify(S.ctrl)) S.ctrl = { ...fresh }; else if (S.ctrl && !fresh && !String(S.ctrl.id).startsWith('myc_')) S.ctrl = { ...CTRLS.find(c => c.id === 'm4k') }; }
    if (S.card && !Object.values(S.defs).some(d => d.rc)) { // старое текстовое поле «Принимающая карта» → карта из базы
      const k = String(S.card).toLowerCase().replace(/novastar|armor|[\s_-]+/g, ''), rc = RCARDS.find(r => r.name.toLowerCase().replace(/[\s_-]+/g, '') === k);
      if (rc) { for (const t of Object.keys(typeCount(S))) S.defs[t] = { ...cabDef(S, t), rc: rc.id }; S.card = ''; }
    }
    const ids = new Set(S.cabs.map(c => c.id));
    S.ports = (S.ports || []).map(a => a.filter(id => ids.has(id)));
    while (S.ports.length && !S.ports[S.ports.length - 1].length) S.ports.pop();
    S.pw.lines = (S.pw.lines || []).map(a => a.filter(id => ids.has(id))).filter(a => a.length);
  }

  // ---------- сетка экрана «как в Срочном ТЗ»: поля на панели, экран перестраивается сразу
  const isGrid = S => !!(S.grid && !S.grid.custom);
  function gridInfer(S) { // экран без записи о сетке: понять тип и размеры
    if (S.grid) return S.grid;
    const t = S.cabs[0] ? S.cabs[0].t : curCab, d = cabDef(S, t), b = bounds(S);
    const uniform = S.cabs.every(c => c.t === t) && S.cabs.length === Math.round(b.w / d.wpx) * Math.round(b.h / d.hpx);
    return { t, cols: Math.max(1, Math.round(b.w / d.wpx)), rows: Math.max(1, Math.round(b.h / d.hpx)), custom: !uniform };
  }
  let gT = 0;
  function gridApply(S, g) {
    if (S.grid && S.grid.custom) toast('Экран перестроен ровной сеткой — Ctrl+Z вернёт как было');
    if (Date.now() - gT > 900) lHist(); gT = Date.now();
    const d = allCabs().find(x => x.id === g.t) || S.defs[g.t] || DEFCAB(), prev = S.grid && S.defs[S.grid.t];
    const nd = putDef(S, d); if (!nd.rc && prev && prev.rc) nd.rc = prev.rc; // карта переходит на новый тип кабинета

    S.cabs = []; gridFill(S, d, g.cols, g.rows);
    S.grid = { t: d.id, cols: g.cols, rows: g.rows };
    autoData(S); autoPower(S); changed(); lFit();
  }
  function syncGridBox(S) {
    const g = gridInfer(S), d = cabDef(S, g.t), ae = document.activeElement;
    const set = (id, v) => { const e = $l('#' + id); if (e && e !== ae) e.value = v; };
    const sel2 = $l('#gType');
    const opts = [...new Map([...allCabs(), ...Object.values(S.defs)].map(c => [c.id, c])).values()];
    const html = opts.map(c => `<option value="${c.id}"${c.id === g.t ? ' selected' : ''}>${esc(c.name)}</option>`).join('');
    if (sel2.dataset.h !== html) { sel2.innerHTML = html; sel2.dataset.h = html; }
    if (sel2 !== ae) sel2.value = g.t;
    set('gWpx', d.wpx); set('gHpx', d.hpx); set('gCols', g.cols); set('gRows', g.rows);
    set('gWm', f2u(g.cols * d.wmm / 1000)); set('gHm', f2u(g.rows * d.hmm / 1000));
    $l('#gInfo2').textContent = (g.custom ? 'Экран собран вручную — правка полей перестроит его сеткой. ' : '') + `${g.cols * g.rows} каб. · ${g.cols * d.wpx}×${g.rows * d.hpx} px · P${f2(d.wmm / d.wpx)}`;
  }
  const f2u = n => String(Math.round(n * 100) / 100);
  function wireGridBox() {
    const box = $l('#ledGridBox');
    const cur = () => { const S = scr(); return { S, g: { ...gridInfer(S) } }; };
    const num = id => parseFloat(String($l('#' + id).value).replace(',', '.'));
    box.addEventListener('input', ev => {
      const id = ev.target.id; const { S, g } = cur();
      if (id === 'gType') { g.t = ev.target.value; curCab = g.t; return gridApply(S, g); }
      if (id === 'gCols' || id === 'gRows') { const v = Math.round(num(id)); if (!(v >= 1 && v <= 200)) return; g[id === 'gCols' ? 'cols' : 'rows'] = v; return gridApply(S, g); }
      if (id === 'gWm' || id === 'gHm') { const m = num(id); if (!(m > 0)) return; const d = cabDef(S, g.t); const v = Math.max(1, Math.round(m * 1000 / (id === 'gWm' ? d.wmm : d.hmm))); if (v > 200) return; g[id === 'gWm' ? 'cols' : 'rows'] = v; return gridApply(S, g); }
      if (id === 'gWpx' || id === 'gHpx') {
        const w = Math.round(num('gWpx')), h = Math.round(num('gHpx')); if (!(w >= 8 && h >= 8)) return;
        const base = cabDef(S, g.t);
        if (w === base.wpx && h === base.hpx) return;
        // пиксели вписаны вручную — свой кабинет того же размера в мм (как «Своё разрешение» в ТЗ)
        const nid = 'px_' + w + 'x' + h + '_' + Math.round(base.wmm) + 'x' + Math.round(base.hmm);
        S.defs[nid] = { ...base, ...keepRc(base), id: nid, name: `${Math.round(base.wmm)}×${base.hmm} — ${w}×${h} px`, wpx: w, hpx: h };
        g.t = nid; return gridApply(S, g);
      }
    });
    box.addEventListener('click', ev => {
      const b = ev.target.closest('[data-gs]'); if (!b) return;
      const { S, g } = cur(), k = b.dataset.gs, f = k[0] === 'c' ? 'cols' : 'rows';
      g[f] = clamp(g[f] + (k[1] === '+' ? 1 : -1), 1, 200); gridApply(S, g);
    });
    // Enter / колесо в поле — сразу
    box.addEventListener('keydown', ev => { if (ev.key === 'Enter') ev.target.blur(); });
  }

  // ---------- расчёт
  function calc(S) {
    const b = bounds(S), cap = portCap(S), m = byId(S);
    const over = new Set();
    const ports = S.ports.map((a, i) => {
      let pxs = 0, o = 0;
      for (const id of a) { const c = m.get(id); if (!c) continue; pxs += pxLoad(S, c); if (pxs > cap) { o++; over.add(id); } }
      const avg = a.length ? pxs / a.length : 0;
      return { i, n: a.length, px: pxs, load: pxs / cap, over: o, max: avg ? Math.floor(cap / avg) : 0 };
    });
    const used = new Set(S.ports.flat()), free = S.cabs.filter(c => !used.has(c.id));
    let mmW = 0, mmH = 0, kg = 0, wmax = 0, wavg = 0, area = 0, pxT = 0;
    let estW = false, estKg = false, noAvg = false;
    for (const c of S.cabs) { const d = cabDef(S, c.t); kg += d.kg || 0; wmax += d.wmax || 0; wavg += d.wavg || 0; if (d.est) estW = true; if (d.kgEst || d.est && d.kgEst !== false) estKg = true; if (!d.wavg) noAvg = true; area += d.wmm * d.hmm / 1e6; pxT += d.wpx * d.hpx; }
    // размер в метрах — по крайним кабинетам (шаг пикселя каждого кабинета)
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const c of S.cabs) { const d = cabDef(S, c.t), sx = d.wmm / d.wpx, sy = d.hmm / d.hpx; x0 = Math.min(x0, c.x * sx); y0 = Math.min(y0, c.y * sy); x1 = Math.max(x1, c.x * sx + d.wmm); y1 = Math.max(y1, c.y * sy + d.hmm); }
    if (S.cabs.length) { mmW = x1 - x0; mmH = y1 - y0; }
    const pl = (S.pw.lines || []).map((a, i) => { const w = a.reduce((s, id) => s + ((m.get(id) && cabDef(S, m.get(id).t).wmax) || 0), 0); return { i, n: a.length, w, amp: amps(S, w), ph: S.pw.phases === 3 ? i % 3 : 0 }; });
    const phase = [0, 0, 0]; for (const l of pl) phase[l.ph] += l.amp;
    const warn = [];
    const N = nPorts(S);
    ports.forEach(p => { if (p.load > 1) warn.push(`Порт ${portName(S, p.i)}: перебор ${p.over} каб. — ${p.n} из макс. ${p.max} (${fmt(p.px)} px из ${fmt(cap)} при ${fpsOf(S)} Гц, ${BITN[effBit(S)]})`); });
    if (S.ports.length > N) warn.push(`Занято портов ${S.ports.length}, у ${S.units > 1 ? S.units + ' контроллеров' : 'контроллера'} их ${N}`);
    if (pxT > ctrlCap(S)) warn.push(`Пикселей ${fmt(pxT)} — больше, чем тянет ${S.units > 1 ? 'набор контроллеров' : 'контроллер'} при ${fpsOf(S)} Гц (${fmt(ctrlCap(S))})`);
    if (S.ctrl.maxW && b.w > S.ctrl.maxW * (S.units || 1)) warn.push(`Ширина ${b.w} px больше предела контроллера ${S.ctrl.maxW * (S.units || 1)} px`);
    if (S.ctrl.maxH && b.h > S.ctrl.maxH) warn.push(`Высота ${b.h} px больше предела контроллера ${S.ctrl.maxH} px`);
    if (free.length && S.ports.length) warn.push(`Не подключено кабинетов: ${free.length}`);
    pl.forEach(l => { if (l.amp > S.pw.a) warn.push(`Линия питания ${l.i + 1}: ${f1(l.amp)} А — больше автомата ${S.pw.a} А`); });
    if (overlaps(S)) warn.push('Есть кабинеты, наложенные друг на друга');
    const rcs = rcCheck(S), rcInfo = [];
    for (const r of rcs) {
      const nm = `«${r.d.name}»`, wh = r.lim && !r.lim.miss ? `${r.lim.w}×${r.lim.h}` : '';
      if (r.compat) warn.push(`Карта ${r.rc.name} в ${nm}: ${r.compat}`);
      if (r.st === 'over') warn.push(`Карта ${r.rc.name} в ${nm}: на карту ${fmt(r.px)} px, а по паспорту до ${wh} = ${fmt(r.cap)} px (${r.lim.how}) — нужна карта мощнее${r.n === 1 ? ' или 2 карты в кабинете' : ''}`);
      if (r.st === 'side') warn.push(`Карта ${r.rc.name} в ${nm}: кабинет ${r.d.wpx}×${r.d.hpx} px не входит в паспортные ${wh} по сторонам`);
      if (r.st === 'rot') rcInfo.push(`Карта ${r.rc.name} в ${nm}: ${r.d.wpx}×${r.d.hpx} px входит в паспортные ${wh} только повёрнутым — проверьте по паспорту и разводке модулей`);
      if (r.st === 'miss') rcInfo.push(`Карта ${r.rc.name} в ${nm}: ${r.lim.miss} — нагрузку на карту не проверяю`);
    }
    if (S.cabs.length && rcs.some(r => r.st === 'none')) rcInfo.push('Приёмная карта не выбрана' + (rcs.length > 1 ? ' для части кабинетов' : '') + ' — нагрузку на карту не проверяю (вкладка «Кабинеты»).');
    // резерв порт-в-порт: каждому занятому порту — свободный порт того же контроллера (как в NovaLCT)
    const bmap = new Map(), bfor = new Map();
    if (S.backup) {
      const usedI = ports.filter(p => p.n).map(p => p.i), freeI = [];
      for (let i = 0; i < N; i++) if (!usedI.includes(i)) freeI.push(i);
      usedI.forEach((i, k) => { if (k < freeI.length) { bmap.set(i, freeI[k]); bfor.set(freeI[k], i); } });
      if (usedI.length > freeI.length) warn.push(`Для резерва не хватает портов: занято ${usedI.length}, свободных ${freeI.length} — добавьте контроллер`);
    }
    // подсказки быстрой настройки VX с панели
    const info = [];
    if (/^vx/.test(S.ctrl.id || '')) {
      const ns = ports.filter(p => p.n).map(p => p.n);
      if (ns.some((n, k) => k && n > ns[k - 1])) info.push('Для быстрой настройки с панели VX нужно: кабинетов в порту 1 ≥ в порту 2 ≥ … (в NovaLCT можно и иначе)');
      const g = S.grid && !S.grid.custom ? S.grid : null;
      if (g && ns.some(n => n % g.cols && n % g.rows)) info.push(`Для быстрой настройки с панели VX число кабинетов на порт должно быть кратно числу столбцов (${g.cols}) или рядов (${g.rows})`);
    }
    if (bitIssue(S)) info.unshift(bitIssue(S) + '.');
    info.push(...rcInfo);
    if (estW) info.push('Мощность части кабинетов — оценка (нет паспортных данных): ток и линии питания примерные — введите мощность из паспорта.');
    return { b, ports, free, kg, wmax, wavg, area, pxT, mmW, mmH, pl, phase, warn, cap, over, bmap, bfor, info, estW, estKg, noAvg, rcs };
  }
  function overlaps(S) {
    const a = S.cabs; if (a.length > 1500) return false;
    for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) {
      const p = a[i], q = a[j];
      if (p.x < q.x + cw(S, q) && q.x < p.x + cw(S, p) && p.y < q.y + ch(S, q) && q.y < p.y + ch(S, p)) return true;
    }
    return false;
  }

  // ---------- отрисовка
  // ---------- лист «Схема коммутации и питания» (тёмный, как готовый чертёж)
  const PHC = ['#facc15', '#10b981', '#ef4444'];               // L1 жёлтый, L2 зелёный, L3 красный
  const PHN = ['жёлтый', 'зелёный', 'красный'];
  const lineCol = (S, i) => S.pw.phases === 3 ? PHC[i % 3] : WCOL[i % WCOL.length];
  const lineTag = (S, i) => S.pw.phases === 3 ? `L${i % 3 + 1}-${Math.floor(i / 3) + 1}` : `L${i + 1}`;
  const rear = S => !!S.rear;
  const dX = (S, c) => rear(S) ? -(c.x + cw(S, c)) : c.x;          // вид сзади — зеркально
  const dBounds = S => { const b = bounds(S); return rear(S) ? { x: -(b.x + b.w), y: b.y, w: b.w, h: b.h } : b; };
  function corner(S, c) { // где ввод (вид спереди)
    const b = bounds(S); if (!c || !b.w) return '—';
    const cx = c.x + cw(S, c) / 2, cy = c.y + ch(S, c) / 2;
    const v = cy > b.y + b.h * 0.66 ? 'Снизу' : cy < b.y + b.h * 0.34 ? 'Сверху' : 'Посередине';
    const h = cx < b.x + b.w * 0.34 ? 'слева' : cx > b.x + b.w * 0.66 ? 'справа' : 'по центру';
    return v + ' ' + h;
  }
  function jumpers(S, chains) { // перемычки: горизонтальные и вертикальные
    const m = byId(S); let hz = 0, vt = 0;
    for (const a of chains) for (let k = 1; k < a.length; k++) { const p = m.get(a[k - 1]), q = m.get(a[k]); if (!p || !q) continue; Math.abs(q.x - p.x) >= Math.abs(q.y - p.y) ? hz++ : vt++; }
    return { hz, vt, n: hz + vt };
  }
  const C2need = S => { const C = calc(S); return C.ports.filter(p => p.n).length * (S.backup ? 2 : 1) || 1; };
  function recCtrlObj(S, need, pxT) {
    const list = [...CTRLS].filter(c => c.id !== 'cx40').sort((a, b) => a.ports - b.ports || a.total - b.total), f = hiF(S);
    for (let u = 1; u <= 6; u++) for (const c of list) if (c.ports * u >= need && c.total * u * f >= pxT) return { c, u };
    return null;
  }
  function recCtrl(S, need, pxT) {
    const list = [...CTRLS].filter(c => c.id !== 'cx40').sort((a, b) => a.ports - b.ports || a.total - b.total), f = hiF(S);
    for (let u = 1; u <= 6; u++) for (const c of list) if (c.ports * u >= need && c.total * u * f >= pxT) return `${u}× ${c.name.replace(/ \/ .*/, '')} (${c.ports} портов)`;
    return 'нужно несколько контроллеров';
  }
  function sheet(S, C) {
    const cs = Object.assign({}, CD, L.calc || {}), m = byId(S);
    const used = C.ports.filter(p => p.n), mains = used.length, bk = S.backup ? Math.min(mains, nPorts(S) - mains) : 0;
    const dj = jumpers(S, S.ports), pj = jumpers(S, S.pw.lines || []);
    const pat = used.map(p => lines(S, S.ports[p.i].map(id => m.get(id)).filter(Boolean), S.pat.dir).length).join('-');
    const d0 = S.cabs[0] ? cabDef(S, S.cabs[0].t) : null, g = gridInfer(S);
    const lim = lineLim(S), perLine = d0 && d0.wmax ? Math.floor(lim / d0.wmax) : 0;
    const byPh = [0, 0, 0]; C.pl.forEach(l => byPh[l.ph]++);
    const zip = n => Math.ceil(n * (1 + (cs.zip ?? 10) / 100));
    const avgPct = S.pw.avgPct ?? 35, avgW = C.noAvg ? C.wmax * avgPct / 100 : C.wavg, avgLbl = C.noAvg ? `Мощность рабочая (≈ ${avgPct} % от пиковой, оценка)` : 'Мощность рабочая (средняя по паспорту)';
    const dEntry = corner(S, S.ports[0] && m.get(S.ports[0][0])), pEntry = corner(S, S.pw.lines && S.pw.lines[0] && m.get(S.pw.lines[0][0]));
    const pl0 = pat.split('-'), patTxt = !pat ? '' : pl0.every(x => x === pl0[0]) ? `по ${pl0[0]} ${S.pat.dir === 'v' ? (pl0[0] === '1' ? 'столбцу' : 'столбца') : (pl0[0] === '1' ? 'ряду' : 'ряда')} на порт` : `${S.pat.dir === 'v' ? 'столбцов' : 'рядов'} на порт: ${pat}`;
    const recNeed = mains + bk > nPorts(S) || C.pxT > ctrlCap(S);
    return { mains, bk, dj, pj, pat, d0, g, perLine, byPh, zip, avgPct, dEntry, pEntry, cs,
      title: `СХЕМА КОММУТАЦИИ И ПИТАНИЯ: ${S.name.toUpperCase()}`,
      sub: `Проект: ${doc.name || '—'}  |  Ракурс: ${rear(S) ? 'ВИД СЗАДИ (МОНТАЖ)' : 'ВИД СПЕРЕДИ'}  |  Дата: ${new Date().toLocaleDateString('ru-RU')}`,
      size: `${(C.mmW / 1000).toFixed(2)}×${(C.mmH / 1000).toFixed(2)} м  |  ${C.b.w}×${C.b.h} px`,
      spec: `${d0 ? `Кабинет: ${Math.round(d0.wmm)}×${Math.round(d0.hmm)} мм (P${(d0.wmm / d0.wpx).toFixed(2)})` : ''}${g && !g.custom ? ` • Сетка: ${g.cols}×${g.rows} (${S.cabs.length} шт)` : ` • ${S.cabs.length} шт`} • Вес: ${fmt(C.kg)} кг`,
      dTitle: `1. СИГНАЛ (RJ45) — ${mains} MAIN${bk ? ' + ' + bk + ' BKP' : ''} | ВХОД: ${dEntry.toUpperCase()}`,
      dSub: `Паттерн: ${pat || '—'} • Перемычек: ${dj.n} шт • ${fpsOf(S)} Гц, ${BITN[bitOf(S)]}, порт ≤ ${fmt(portCap(S))} px (белый круг = Main IN${S.backup ? ', оранжевый квадрат = Backup IN' : ''})${C.over.size ? ` • ПЕРЕБОР: ${C.over.size} каб.` : ''}`,
      pTitle: `2. ПИТАНИЕ (POWER) — ${C.pl.length} ЛИНИЙ (${S.pw.a}A) | ВХОД: ${pEntry.toUpperCase()}`,
      pSub: `Перемычек: ${pj.n} шт • ${S.pw.phases === 3 ? 'Цвета: ' + PH.map((p, i) => p + ' — ' + PHN[i]).join(' • ') : '1 фаза'} (белый круг = ввод IN)`,
      cards: [
        { t: 'ЭЛЕКТРОПИТАНИЕ', c: '#fbbf24', rows: [
          [C.estW ? 'Мощность пиковая (≈ оценка)' : 'Мощность пиковая (по паспорту)', `${f1(C.wmax / 1000)} кВт`, '#fbbf24'],
          [avgLbl, `${f1(avgW / 1000)} кВт`],
          ['Линии питания', `${C.pl.length} × автомат ${S.pw.a} А`, '#fbbf24'],
          ['Кабинетов на линию', perLine ? `до ${perLine}` : '—'],
          [`Ток по фазам (пик, cos φ ${String(pfOf(S)).replace('.', ',')})`, S.pw.phases === 3 ? C.phase.map((a, i) => `${PH[i]} ${Math.round(a)} А`).join(' · ') : `${Math.round(amps(S, C.wmax))} А`],
          ['Площадь · вес', `${f1(C.area)} м² · ${C.estKg ? '≈' : ''}${fmt(C.kg)} кг`]] },
        { t: 'КАБЕЛИ ПИТАНИЯ', c: '#34d399', rows: [
          ['Вводы от дистро', `${C.pl.length} шт`, '#34d399'],
          ...(S.pw.phases === 3 ? [['По фазам', `L1 ${byPh[0]} · L2 ${byPh[1]} · L3 ${byPh[2]}`]] : []),
          ['Вход в экран (вид спереди)', pEntry.toLowerCase()],
          [`Перемычки вертикальные, ${String(cs.vLen).replace('.', ',')} м`, `${pj.vt} шт`],
          [`Перемычки горизонтальные, ${String(cs.hLen).replace('.', ',')} м`, `${pj.hz} шт`],
          [`Перемычек всего / с запасом ${cs.zip} %`, `${pj.n} / ${zip(pj.n)} шт`, '#34d399']] },
        { t: 'СИГНАЛ (RJ45)', c: '#38bdf8', rows: [
          ['Контроллер', `${(S.units || 1)} × ${S.ctrl.name.replace(/^NovaStar /, '').replace(/ \/ .*/, '')}`, '#38bdf8'],
          ['Приёмная карта', rcName(S) || 'не выбрана', rcName(S) ? '' : '#94a3b8'],
          ['Порты основные / резерв', `${mains} / ${S.backup ? bk : '—'}  (из ${nPorts(S)})`],
          ['На порт', `до ${fmt(portCap(S))} px · ${BITN[bitOf(S)]} · ${String(fpsOf(S)).replace('.', ',')} Гц`],
          ['Вход в экран (вид спереди)', `${dEntry.toLowerCase()}${patTxt ? ', ' + patTxt : ''}`],
          [`Перемычки RJ45 верт. / гориз.`, `${dj.vt} / ${dj.hz} шт`],
          [`Перемычек всего / с запасом ${cs.zip} %`, `${dj.n} / ${zip(dj.n)} шт`, '#38bdf8'],
          ...(recNeed ? [['Рекомендуем', recCtrl(S, mains + bk, C.pxT)]] : [])] }] };
  }
  function svgBody(S, v, C, exp) {
    C = C || calc(S);
    const m = byId(S), out = [];
    const chains = v === 'data' ? S.ports : (S.pw.lines || []);
    const gOf = new Map(), iOf = new Map();
    chains.forEach((a, i) => a.forEach((id, k) => { gOf.set(id, i); iOf.set(id, k); }));
    const col = i => v === 'data' ? PCOL[i % PCOL.length] : lineCol(S, i);
    const unit = clamp(S.cabs.length ? Math.max(...S.cabs.map(c => Math.min(cw(S, c), ch(S, c)))) : 100, 40, 400);
    const db = dBounds(S);
    // кабинеты
    for (const c of S.cabs) {
      const d = cabDef(S, c.t), w = d.wpx, h = d.hpx, x = dX(S, c), y = c.y, g = gOf.get(c.id);
      const ov = v === 'data' && C.over.has(c.id), cl = g != null ? col(g) : null;
      let label = '';
      if (g != null) label = v === 'data' ? (cfg.ledMap ? `P:${portName(S, g).padStart(2, '0')} #${String(iOf.get(c.id) + 1).padStart(3, '0')}` : `P${portName(S, g)}.${iOf.get(c.id) + 1}`) : `${lineTag(S, g)}.${iOf.get(c.id) + 1}`;
      const base = Math.min(w, h) * 0.15, lenL = Math.max(4, label.length + (ov ? 1 : 0)), fs = exp ? base : Math.min(Math.max(base, 11 / vz.z), w * 0.92 / (lenL * 0.62), h * 0.3);
      out.push(`<g class="lcab${sel.has(c.id) ? ' sel' : ''}" data-c="${c.id}" data-g="${g ?? ''}"><rect class="lcr" x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${h - 2}" fill="${ov ? '#7f1d1d' : cl || '#1e293b'}" fill-opacity="${ov ? 0.9 : cl ? 0.28 : 1}" stroke="#334155" stroke-width="${unit * 0.008}"/>`
        + (ov ? `<rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${h - 2}" fill="url(#lhatch)"/>` : '')
        + (label ? `<rect x="${x + w / 2 - fs * label.length * 0.33 - fs * 0.25}" y="${y + h * 0.17 - fs * 0.62}" width="${fs * label.length * 0.66 + fs * 0.5}" height="${fs * 1.24}" rx="${fs * 0.2}" fill="#0b1220" fill-opacity=".85"/><text x="${x + w / 2}" y="${y + h * 0.17}" font-size="${fs}" class="ll">${esc((ov ? '⚠' : '') + label)}</text>` : '')
        + `<text x="${x + w / 2}" y="${y + h - fs * 0.6}" font-size="${fs * 0.55}" class="ls">${w}×${h}</text></g>`);
    }
    // контуры групп (порт / линия): обводка по внешним краям
    const sw = unit * 0.03;
    chains.forEach((a, i) => {
      const cabs = a.map(id => m.get(id)).filter(Boolean); if (!cabs.length) return;
      const segs = [];
      for (const c of cabs) {
        const x = dX(S, c), y = c.y, w = cw(S, c), h = ch(S, c);
        const sides = [[x, y, x + w, y, 0, -1], [x, y + h, x + w, y + h, 0, 1], [x, y, x, y + h, -1, 0], [x + w, y, x + w, y + h, 1, 0]];
        for (const [x1, y1, x2, y2, nx, ny] of sides) {
          const shared = cabs.some(o => { if (o === c) return false; const ox = dX(S, o), ow = cw(S, o), oh = ch(S, o);
            if (nx) return Math.abs((nx > 0 ? ox : ox + ow) - x1) < 1 && o.y < y2 - 1 && o.y + oh > y1 + 1;
            return Math.abs((ny > 0 ? o.y : o.y + oh) - y1) < 1 && ox < x2 - 1 && ox + ow > x1 + 1; });
          if (!shared) segs.push(`M${x1},${y1}L${x2},${y2}`);
        }
      }
      out.push(`<path d="${segs.join('')}" fill="none" stroke="${col(i)}" stroke-width="${sw}" stroke-linecap="square" pointer-events="none"/>`);
    });
    // стрелки цепочек
    if (!cfg.ledNoLines) chains.forEach((a, i) => {
      const pts = a.map(id => m.get(id)).filter(Boolean).map(c => [dX(S, c) + cw(S, c) / 2, c.y + ch(S, c) * 0.55]);
      const cl = col(i), aw = unit * 0.022, ah = unit * 0.07;
      for (let k = 1; k < pts.length; k++) {
        const [x1, y1] = pts[k - 1], [x2, y2] = pts[k], dx = x2 - x1, dy = y2 - y1, L0 = Math.hypot(dx, dy) || 1, ux = dx / L0, uy = dy / L0;
        const sx = x1 + ux * unit * 0.12, sy = y1 + uy * unit * 0.12, ex = x2 - ux * unit * 0.12, ey = y2 - uy * unit * 0.12;
        out.push(`<line x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}" stroke="${cl}" stroke-width="${aw}" stroke-linecap="round" pointer-events="none"/><path d="M${ex},${ey}L${ex - ux * ah - uy * ah * 0.55},${ey - uy * ah + ux * ah * 0.55}L${ex - ux * ah + uy * ah * 0.55},${ey - uy * ah - ux * ah * 0.55}z" fill="${cl}" pointer-events="none"/>`);
      }
      if (!pts.length) return;
      const [fx, fy] = pts[0], r = unit * 0.075;
      const f0 = m.get(a[0]), yb = f0.y + ch(S, f0) * 0.84;
      out.push(`<circle cx="${fx}" cy="${yb}" r="${r}" fill="#f8fafc" stroke="${cl}" stroke-width="${unit * 0.02}" pointer-events="none"/>`);
      if (v === 'data' && S.backup && C.bmap.has(i)) {
        const l = m.get(a[a.length - 1]), lx = dX(S, l) + cw(S, l) / 2, ly = l.y + ch(S, l) * 0.84, q = unit * 0.07;
        out.push(`<rect x="${lx - q}" y="${ly - q}" width="${q * 2}" height="${q * 2}" fill="#f97316" stroke="#0b1220" stroke-width="${unit * 0.01}" pointer-events="none"/>`);
      }
      void fy;
    });
    // размеры
    if (S.cabs.length) {
      const t = unit * 0.11;
      out.push(`<text x="${db.x + db.w / 2}" y="${db.y - t * 1.1}" font-size="${t}" class="ldim">${(C.mmW / 1000).toFixed(2)} м (${C.b.w} px) • ${rear(S) ? 'ВИД СЗАДИ (МОНТАЖ)' : 'ВИД СПЕРЕДИ'}</text>`
        + `<text x="${db.x - t * 1.2}" y="${db.y + db.h / 2}" font-size="${t}" class="ldim" transform="rotate(-90 ${db.x - t * 1.2} ${db.y + db.h / 2})">${(C.mmH / 1000).toFixed(2)} м (${C.b.h} px)</text>`);
    }
    return { body: out.join(''), C };
  }
  const ch2 = (S, c) => ch(S, c);
  const HATCH = `<pattern id="lhatch" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="16" fill="#7f1d1d" fill-opacity=".55"/></pattern>`;
  const DEFS = `<defs>${HATCH}<marker id="la" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="2.6" markerHeight="2.6" orient="auto"><path d="M1,1 L9,5 L1,9 z" fill="#111827" stroke="#fff" stroke-width="1"/></marker></defs>`;

  const panes = () => [...document.querySelectorAll('#ledStage .lpane')];
  const setT = () => document.querySelectorAll('#ledStage .lvp').forEach(g => g.setAttribute('transform', `translate(${vz.x},${vz.y}) scale(${vz.z})`));
  function patIcon(st, dir, snake) {
    // узор 3×3: откуда начинается и куда идёт цепочка
    const pts = [], rows = [0, 1, 2], h = dir === 'h';
    const r1 = h ? (st[0] === 'b' ? [2, 1, 0] : rows) : (st[1] === 'r' ? [2, 1, 0] : rows), r2 = h ? (st[1] === 'r' ? [2, 1, 0] : rows) : (st[0] === 'b' ? [2, 1, 0] : rows);
    r1.forEach((a, i) => { const seq = snake && i % 2 ? [...r2].reverse() : r2; seq.forEach(b => pts.push(h ? [4 + b * 7, 4 + a * 7] : [4 + a * 7, 4 + b * 7])); });
    return `<svg viewBox="0 0 22 22" width="20" height="20"><path d="M${pts.map(p => p.join(',')).join('L')}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="${pts[0][0]}" cy="${pts[0][1]}" r="2.6" fill="currentColor"/></svg>`;
  }
  function renderQuick() {
    const el = $l('#lQuick'); if (!el) return;
    el.style.display = mode === 'quick' ? '' : 'none';
    if (mode !== 'quick') return;
    const pats = []; for (const d of ['h', 'v']) for (const st of ['tl', 'tr', 'bl', 'br']) pats.push([st, d]);
    el.innerHTML = pats.map(([st, d]) => `<button class="lqp${qp.start === st && qp.dir === d ? ' on' : ''}" data-qst="${st}" data-qdir="${d}" title="Начало ${{ tl: 'слева сверху', tr: 'справа сверху', bl: 'слева снизу', br: 'справа снизу' }[st]}, ${d === 'h' ? 'по рядам' : 'по столбцам'}">${patIcon(st, d, qp.snake)}</button>`).join('')
      + `<button class="ltg${qp.snake ? ' on' : ''}" data-qsnake="1" title="Змейкой или зигзагом">${qp.snake ? 'змейка' : 'зигзаг'}</button>`;
  }
  function render() {
    if (!on || !L) return;
    const S = scr(); clean(S);
    let C = null;
    C = calc(S);
    for (const pn of panes()) pn.querySelector('.lvp').innerHTML = svgBody(S, pn.dataset.v, C).body;
    const SH = sheet(S, C); renderSheet(S, C, SH); renderSteps(S, C);
    setT();
    renderLeft(S); renderRight(S, C); syncGridBox(S);
    $l('#ledStatusL').textContent = `${S.name}: ${S.cabs.length} каб. · ${C.b.w}×${C.b.h} px · ${f2(C.mmW / 1000)}×${f2(C.mmH / 1000)} м` + (sel.size ? ` · выбрано ${sel.size}` : '') + (C.warn.length ? ` · внимание: ${C.warn.length}` : '');
    document.querySelectorAll('[data-lmode]').forEach(b => b.classList.toggle('on', b.dataset.lmode === mode));
    renderQuick();
    $l('#lMap').classList.toggle('on', !!cfg.ledMap); $l('#ledWrap').classList.toggle('lfull', !!cfg.ledFull || stepOf() === 5); $l('#lFull').classList.toggle('on', !!cfg.ledFull || stepOf() === 5); $l('#lRear').classList.toggle('on', rear(S)); $l('#lRear').textContent = rear(S) ? '◧ вид сзади (монтаж)' : '◨ вид спереди'; $l('#lLines').classList.toggle('on', !cfg.ledNoLines);
    const st = $l('#ledStage'); st.dataset.mode = mode; const bb = C.b, sp = split || (bb.w > bb.h * 1.25 ? 'v' : 'h'); if (st.classList.contains('vsplit') !== (sp === 'v')) { st.classList.toggle('vsplit', sp === 'v'); requestAnimationFrame(lFit); }
    const cn = (k, cur, attr) => `<button class="lcorner${cur === k ? ' on' : ''}" ${attr}="${k}" title="${{ tl: 'старт слева сверху', tr: 'старт справа сверху', bl: 'старт слева снизу', br: 'старт справа снизу' }[k]} (вид спереди)">${{ tl: '◤', tr: '◥', bl: '◣', br: '◢' }[k]}</button>`;
    const ctl = (P, a1, a2, sn, au) => `<span class="lpc">${['tl', 'tr', 'bl', 'br'].map(k => cn(k, P.start, a1)).join('')}<button class="ltg${P.dir === 'h' ? ' on' : ''}" ${a2}="h" title="по рядам">⇄</button><button class="ltg${P.dir === 'v' ? ' on' : ''}" ${a2}="v" title="по столбцам">⇅</button><button class="ltg${P.snake ? ' on' : ''}" data-act="${sn}" title="змейкой / зигзагом">${P.snake ? '∿' : '⋰'}</button><button class="pri" data-act="${au}" title="Развести автоматически">⚡ авто</button></span>`;
    $l('#lpTitleD').innerHTML = ctl(S.pat, 'data-pstart', 'data-pdir', 'dsnake', 'dauto') + `<b>${esc(SH.dTitle)}</b>${mode !== 'sel' ? ` <span class="lpAct">· ведёте порт ${portName(S, act)}</span>` : ''}<small>${esc(SH.dSub)}</small>`;
    $l('#lpTitleP').innerHTML = ctl(S.pw, 'data-wstart', 'data-wdir', 'psnake', 'pauto') + `<b>${esc(SH.pTitle)}</b>${mode !== 'sel' ? ` <span class="lpAct">· ведёте линию ${lineTag(S, actW)}</span>` : ''}<small>${esc(SH.pSub)}</small>`;
    $l('#ledHint').textContent = mode === 'quick' ? `Быстрое подключение: выберите узор вверху и обведите рамкой область — в окне «Сигнал» она уйдёт в порт ${portName(S, act)}, в окне «Питание» — в линию ${actW + 1}; затем сразу следующий порт. Правый щелчок по кабинету — убрать его из цепочки.` : mode === 'wire' ? `Проводка: ведите мышью по кабинетам — в окне «Сигнал» они встают в порт ${portName(S, act)}, в окне «Питание» — в линию ${actW + 1}. Щелчок по последнему кабинету цепочки — убрать его. Порт или линию выберите справа.`
      : 'Щелчок — выбрать, Shift — добавить, рамка — выбрать несколько, тяните — переместить (липнет к соседям). Del — удалить. Колесо — масштаб (оба окна вместе), правая кнопка или пробел — сдвиг.';
  }

  function renderSheet(S, C, SH) {
    $l('#ledHead').innerHTML = `<div><h2>${esc(SH.title)}</h2><div class="lsub">${esc(SH.sub)}</div></div><div class="lhr"><div class="lsize">${esc(SH.size)}</div><div class="lsub">${esc(SH.spec)}</div></div>`;
    $l('#ledCards').innerHTML = SH.cards.map(k => `<div class="lcard"><h4 style="color:${k.c}">${k.t}</h4>${k.rows.map(([a, b, c]) => `<div class="lcr2"><span>${esc(a)}</span><b${c ? ` style="color:${c}"` : ''}>${esc(b)}</b></div>`).join('')}</div>`).join('');
  }
  function renderLeft(S) {
    const scrs = L.screens.map((s, i) => `<div class="lscr${i === L.cur ? ' on' : ''}" data-si="${i}"><span>${esc(s.name)}</span><small>${s.cabs.length} каб.</small></div>`).join('');
    $l('#ledScreens').innerHTML = scrs;
    const q = ($l('#ledCabSearch').value || '').toLowerCase();
    const row = (c, mine) => `<div class="lcabItem${c.id === curCab ? ' on' : ''}" data-cab="${c.id}" draggable="true" title="Щелчок — выбрать для добавления · перетащите на поле · двойной щелчок — ${mine ? 'изменить' : 'копия для правки'}">
      <svg viewBox="0 0 40 40" width="34" height="34"><rect x="${20 - 17 * Math.min(1, c.wmm / c.hmm)}" y="${20 - 17 * Math.min(1, c.hmm / c.wmm)}" width="${34 * Math.min(1, c.wmm / c.hmm)}" height="${34 * Math.min(1, c.hmm / c.wmm)}" rx="2" fill="var(--accs)" stroke="var(--acc)"/></svg>
      <div><b>${esc(c.name)}</b><small>${c.wpx}×${c.hpx} px · P${f2(c.wmm / c.wpx)} · ${c.est ? '≈' : ''}${c.wmax || '?'} Вт · ${c.kgEst ? '≈' : ''}${c.kg || '?'} кг${c.est || c.kgEst ? ' <i class="lest">оценка</i>' : ' <i class="lok2">паспорт</i>'}</small></div></div>`;
    const f = c => !q || (c.name + ' ' + (c.maker || '') + ' ' + c.wpx + 'x' + c.hpx).toLowerCase().includes(q);
    const mine = my.cabs.filter(f), grps = new Map();
    for (const c of CABS.filter(f)) { if (!grps.has(c.grp)) grps.set(c.grp, []); grps.get(c.grp).push(c); }
    const open = cfg.ledOpen || {}, many = !q;
    $l('#ledCabList').innerHTML = (mine.length ? '<div class="lgrp">Мои кабинеты</div>' + mine.map(c => row(c, true)).join('') : '')
      + [...grps].map(([g, list]) => { const o = !many || open[g]; return `<div class="lgrp lgrpT${o ? ' on' : ''}" data-lgrp="${esc(g)}">${o ? '▾' : '▸'} ${esc(g)} <small>${list.length}</small></div>` + (o ? list.map(c => row(c, false)).join('') : ''); }).join('')
      + '<div class="small muted" style="padding:6px 2px">«паспорт» — вес и мощность из паспорта производителя; «≈ оценка» — пиксели точные, а вес и мощность примерные, введите свои (двойной щелчок → копия для правки). Нет нужного — «＋ Свой».</div>';
  }

  function bar(load) { const p = Math.round(load * 100); return `<div class="lbar"><i style="width:${Math.min(100, p)}%;background:${load > 1 ? '#dc2626' : load > 0.9 ? '#d97706' : '#16a34a'}"></i></div><span class="${load > 1 ? 'lbad' : ''}">${p}%</span>`; }
  function renderRight(S, C) {
    const N = nPorts(S), cap = C.cap;
    const opt = c => `<option value="${c.id}"${c.id === S.ctrl.id ? ' selected' : ''}>${esc(c.name)} — ${c.ports} портов</option>`, ctrlOpts = (my.ctrls.length ? `<optgroup label="Мои">${my.ctrls.map(opt).join('')}</optgroup>` : '') + ['COEX', 'VX', 'MCTRL', 'NovaPro', 'H'].map(g => `<optgroup label="${g}">${CTRLS.filter(c => c.ser === g).map(opt).join('')}</optgroup>`).join('');
    const prow = i => { const p = C.ports[i] || { n: 0, px: 0, load: 0, over: 0, max: 0 }; return `<div class="lport${i === act ? ' on' : ''}${p.over ? ' bad' : ''}" data-port="${i}" title="${fmt(p.px)} px из ${fmt(cap)}"><span class="lsw" style="background:${PCOL[i % PCOL.length]}"></span><b>${portName(S, i)}</b><small>${p.n ? `${p.n} из макс. ${p.max} каб.` : C.bfor.has(i) ? `резерв для порта ${portName(S, C.bfor.get(i))}` : '—'}${p.over ? ` · <b class="lbad">перебор ${p.over}</b>` : ''}${C.bmap.has(i) ? ` · рез. ${portName(S, C.bmap.get(i))}` : ''}</small>${bar(p.load)}${p.n ? `<button class="lx" data-pclr="${i}" title="Очистить порт">✕</button>` : ''}</div>`; };
    const showN = Math.max(N, S.ports.length);
    const corner = (k, t) => `<button class="lcorner${S.pat.start === k ? ' on' : ''}" data-pstart="${k}" title="${t}">${{ tl: '◤', tr: '◥', bl: '◣', br: '◢' }[k]}</button>`;
    const pcorner = (k, t) => `<button class="lcorner${S.pw.start === k ? ' on' : ''}" data-wstart="${k}" title="${t}">${{ tl: '◤', tr: '◥', bl: '◣', br: '◢' }[k]}</button>`;
    const needUnits = Math.max(Math.ceil(C.pxT / (ctrlCap(S) / (S.units || 1))), Math.ceil(S.ports.length / S.ctrl.ports), 1);
    const warn = (C.warn.length ? `<div class="lwarn">${C.warn.map(w => '⚠ ' + esc(w)).join('<br>')}</div>` : (S.cabs.length && S.ports.length ? '<div class="lok">✓ Всё в норме</div>' : '')) + (C.info.length ? `<div class="small muted" style="margin-bottom:6px">${C.info.map(t => 'ℹ ' + esc(t)).join('<br>')}</div>` : '');
    const lim = lineLim(S);
    const html = `
      <h3>Итого</h3>${warn}
      <table class="ltbl">
        <tr><td>Кабинетов</td><td>${S.cabs.length}${Object.keys(typeCount(S)).length > 1 ? ' (' + Object.entries(typeCount(S)).map(([k, n]) => esc(cabDef(S, k).name) + ' × ' + n).join(', ') + ')' : ''}</td></tr>
        <tr><td>Разрешение</td><td><b>${C.b.w} × ${C.b.h}</b> px</td></tr>
        <tr><td>Пикселей</td><td>${fmt(C.pxT)}</td></tr>
        <tr><td>Размер</td><td>${f2(C.mmW / 1000)} × ${f2(C.mmH / 1000)} м · ${f2(C.area)} м²</td></tr>
        <tr><td>Вес</td><td>${fmt(C.kg)} кг</td></tr>
        <tr><td>Мощность</td><td>макс ${f2(C.wmax / 1000)} кВт · ${C.noAvg ? `рабочая ≈ ${f2(C.wmax * (S.pw.avgPct ?? 35) / 100000)} кВт (${S.pw.avgPct ?? 35} %, оценка)` : `средняя ${f2(C.wavg / 1000)} кВт`}</td></tr>
        <tr><td>Ток (макс)</td><td>${f1(amps(S, C.wmax))} А (cos φ ${String(pfOf(S)).replace('.', ',')})${S.pw.phases === 3 ? ' · ≈' + f1(amps(S, C.wmax) / 3) + ' А на фазу' : ''}</td></tr>
      </table>
      <h3>Контроллер</h3>
      <select id="lCtrl">${ctrlOpts}</select>
      <div class="lrow"><label>Шт.<input type="number" id="lUnits" min="1" max="20" value="${S.units || 1}"></label><label>Частота<select id="lFps">${FPS.map(f => `<option value="${f}"${f === fpsOf(S) ? ' selected' : ''}>${String(f).replace('.', ',')} Гц</option>`).join('')}${FPS.includes(fpsOf(S)) ? '' : `<option value="${fpsOf(S)}" selected>${fpsOf(S)} Гц</option>`}<option value="custom">своя…</option></select></label><label>Цвет<select id="lBit">${Object.entries(BITN).filter(([k]) => !(k === '10a' && !S.ctrl.a10) && !(S.ctrl.only8 && k !== '8')).map(([k, t]) => `<option value="${k}"${k === bitOf(S) ? ' selected' : ''}>${t}</option>`).join('')}</select></label></div>
      <div class="small muted">${S.ctrl.ports} ${S.ctrl.ports % 10 >= 2 && S.ctrl.ports % 10 <= 4 && (S.ctrl.ports % 100 < 12 || S.ctrl.ports % 100 > 14) ? 'порта' : 'портов'} × <b>${fmt(cap)} px</b> на порт (${String(fpsOf(S)).replace('.', ',')} Гц, ${BITN[bitOf(S)]}, ${capNote(S)})${S.cabs[0] ? ` — это до <b>${Math.floor(cap / pxLoad(S, S.cabs[0]))} каб.</b> ${esc(cabDef(S, S.cabs[0].t).name)} на порт` : ''}. Всего до <b>${fmt(ctrlCap(S))} px</b>${S.ctrl.note ? ' (' + S.ctrl.note + ')' : ''}; ${S.ctrl.maxW ? `ширина до ${S.ctrl.maxW * (S.units || 1)} px` : 'предельная ширина в паспорте не найдена'}, ${S.ctrl.maxH ? `высота до ${S.ctrl.maxH} px` : 'предельная высота в паспорте не найдена'}${S.ctrl.maxW && S.ctrl.maxH && S.ctrl.maxW * S.ctrl.maxH > S.ctrl.total ? ' — но не одновременно: всего не больше ' + fmt(S.ctrl.total * (S.units || 1)) + ' px' : ''}.${bitIssue(S) ? ' <b class="lbad">' + esc(bitIssue(S)) + '.</b>' : ''}${S.ctrl.src ? ' <span class="lsrc">Источник: ' + esc(S.ctrl.src) + '.</span>' : ''}${needUnits > (S.units || 1) ? ` · <b class="lbad">нужно ${needUnits} шт.</b>` : ''}</div>
      <div class="small muted">Приёмная карта: ${rcName(S) ? '<b>' + esc(rcName(S)) + '</b>' : 'не выбрана'} — <button class="lnkb" data-ltab="cab">выбрать на вкладке «Кабинеты»</button></div>
      <div class="lrow"><label>Начало изображения X<input type="number" id="lOx" value="${S.ox || 0}"></label><label>Y<input type="number" id="lOy" value="${S.oy || 0}"></label><span class="small muted">с какой точки картинки начинается экран</span></div>
      <div class="lrow"><button id="lCtrlNew" class="small">＋ Свой контроллер</button></div>
      <h3>Данные (порты)</h3>
      <div class="lrow lpat"><span>Старт</span>${corner('tl', 'слева сверху')}${corner('tr', 'справа сверху')}${corner('bl', 'слева снизу')}${corner('br', 'справа снизу')}
        <button class="ltg${S.pat.dir === 'h' ? ' on' : ''}" data-pdir="h" title="по рядам">⇄ ряды</button><button class="ltg${S.pat.dir === 'v' ? ' on' : ''}" data-pdir="v" title="по столбцам">⇅ столбцы</button></div>
      <div class="lrow"><label><input type="checkbox" id="lSnake"${S.pat.snake ? ' checked' : ''}> змейкой</label>
        <select id="lSplit"><option value="lines"${S.pat.split === 'lines' ? ' selected' : ''}>целыми рядами</option><option value="max"${S.pat.split === 'max' ? ' selected' : ''}>до предела порта</option><option value="count"${S.pat.split === 'count' ? ' selected' : ''}>по N кабинетов</option></select>
        ${S.pat.split === 'count' ? `<input type="number" id="lPer" min="1" value="${S.pat.per || 8}" style="width:52px">` : ''}</div>
      <div class="lrow"><button class="pri" id="lAuto">⚡ Развести автоматически</button><button id="lClrAll">Очистить</button></div>
      <div class="lrow"><label><input type="checkbox" id="lBackup"${S.backup ? ' checked' : ''}> резерв порт-в-порт (последний кабинет → свободный порт)</label></div>
      <div class="lports">${Array.from({ length: showN }, (_, i) => prow(i)).join('')}</div>
      <h3>Питание</h3>
      <div class="lrow"><label>Сеть, В<input type="number" id="lV" value="${S.pw.v}"></label><label>Автомат, А<input type="number" id="lA" value="${S.pw.a}"></label><label>Запас, %<input type="number" id="lK" value="${S.pw.k}"></label><label>cos φ<input type="number" step="0.01" min="0.5" max="1" id="lPf" value="${pfOf(S)}"></label></div>
      <div class="lrow lpat"><span>Старт</span>${pcorner('tl', 'слева сверху')}${pcorner('tr', 'справа сверху')}${pcorner('bl', 'слева снизу')}${pcorner('br', 'справа снизу')}
        <button class="ltg${S.pw.dir === 'h' ? ' on' : ''}" data-wdir="h">⇄</button><button class="ltg${S.pw.dir === 'v' ? ' on' : ''}" data-wdir="v">⇅</button>
        <select id="lPh"><option value="1"${S.pw.phases === 1 ? ' selected' : ''}>1 фаза</option><option value="3"${S.pw.phases === 3 ? ' selected' : ''}>3 фазы</option></select></div>
      <div class="lrow"><label>Нарезка веток<select id="lPSplit"><option value="equal"${S.pw.split !== 'max' ? ' selected' : ''}>поровну (целые столбцы/ряды)</option><option value="max"${S.pw.split === 'max' ? ' selected' : ''}>до предела автомата</option></select></label><label>Рабочая, %<input type="number" id="lAvg" min="1" max="100" value="${S.pw.avgPct ?? 35}"></label></div>
      <div class="small muted">На линию до ${fmt(lim)} Вт — ≈ ${Math.max(1, Math.floor(lim / (cabDef(S, S.cabs[0] ? S.cabs[0].t : curCab).wmax || 1)))} каб.</div>
      <div class="lrow"><button class="pri" id="lPAuto">⚡ Развести питание</button><button id="lPClr">Очистить</button></div>
      <div class="lports">${C.pl.map(l => `<div class="lport${l.i === actW ? ' on' : ''}" data-wline="${l.i}"><span class="lsw" style="background:${lineCol(S, l.i)}"></span><b>${lineTag(S, l.i)}</b><small>${l.n} каб. · ${fmt(l.w)} Вт · ${f1(l.amp)} А</small>${bar(l.amp / S.pw.a)}</div>`).join('')}
        <div class="lport" data-wline="${C.pl.length}"><span class="lsw" style="background:${WCOL[C.pl.length % WCOL.length]}"></span><b>＋</b><small>новая линия (вручную)</small></div></div>
      ${S.pw.phases === 3 && C.pl.length ? `<div class="small">По фазам: ${C.phase.map((a, i) => PH[i] + ' ' + f1(a) + ' А').join(' · ')}</div>` : ''}
      <h3>Перемычки и запас</h3>
      <div class="lrow"><label>Перемычка гориз., м<input type="number" step="0.1" id="lHLen" value="${(L.calc && L.calc.hLen) ?? 1.5}"></label><label>верт., м<input type="number" step="0.1" id="lVLen" value="${(L.calc && L.calc.vLen) ?? 1}"></label><label>ЗИП, %<input type="number" id="lZip" value="${(L.calc && L.calc.zip) ?? 10}"></label></div>
      <h3>Приёмная карта в кабинете</h3>${rcPanel(S, C)}
      <h3>Выбранные кабинеты</h3>
      ${sel.size ? `<div class="lrow"><select id="lSelType">${[...new Set([curCab, ...S.cabs.filter(c => sel.has(c.id)).map(c => c.t)])].map(id => `<option value="${id}">${esc(cabDef(S, id).name)}</option>`).join('')}${allCabs().filter(c => c.id !== curCab).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select><button id="lSelSet">Заменить</button></div>
        <div class="lrow"><button id="lSelPort">→ в порт ${portName(S, act)}</button><button id="lSelDel">Удалить</button></div>` : '<div class="small muted">Выделите кабинеты на поле: щелчок, Shift, рамка, Ctrl+A.</div>'}
      <h3>Заметка</h3><textarea id="lNote" rows="3" placeholder="Где стоит экран, особенности монтажа…">${esc(S.note || '')}</textarea>`;
    $l('#ledProps').innerHTML = tabify(html, C);
  }
  // ---------- панель «Приёмная карта в кабинете» (вкладка «Кабинеты»)
  function rcShort(S, r) {
    const l = rcLim(S, r), cp = rcCompat(S, r);
    return (l.miss ? ' — нет данных' : ` — ${l.w}×${l.h}${l.all ? '' : ''}`) + (cp ? ' · не для этого контроллера' : '');
  }
  function rcPanel(S, C) {
    const rows = C.rcs || rcCheck(S);
    const opt = cur => '<option value="">— не выбрана —</option>' + RCSER.map(g => `<optgroup label="${g}">${RCARDS.filter(r => r.ser === g).map(r => `<option value="${r.id}"${r.id === cur ? ' selected' : ''}>${esc(r.name + rcShort(S, r))}</option>`).join('')}</optgroup>`).join('');
    const stat = r => {
      const wh = r.lim && !r.lim.miss ? `${r.lim.w}×${r.lim.h}` : '', per = r.n > 1 ? ` (кабинет ${r.d.wpx}×${r.d.hpx} ÷ ${r.n} карты)` : '';
      let t = '';
      if (r.st === 'none') t = '<span class="muted">Выберите карту — программа проверит, тянет ли она кабинет.</span>';
      else if (r.st === 'miss') t = `<span class="lest">нет данных</span> ${esc(r.lim.miss)} — нагрузку не проверяю.`;
      else {
        const pc = Math.round(r.load * 100), base = `на карту <b>${fmt(r.px)} px</b>${per} из ${wh} = ${fmt(r.cap)} px (${pc} %) · ${esc(r.lim.how)}`;
        t = r.st === 'ok' ? `<span class="lok2">✓ тянет</span> ${base}` : r.st === 'rot' ? `<span class="lest">проверьте</span> ${base}; по сторонам входит только повёрнутым` : r.st === 'side' ? `<b class="lbad">✗ не входит по сторонам</b> ${base}` : `<b class="lbad">✗ перебор</b> ${base}`;
      }
      if (r.compat) t += `<br><b class="lbad">⚠ ${esc(r.compat)}</b>`;
      if (r.rc && r.rc.a10) t += '<br><span class="muted">поддерживает режим «10 бит (A10s Pro / A8s Pro)»</span>';
      if (r.rc) t += `<br><span class="lsrc">Источник: ${esc(r.rc.src)}${r.rc.note ? ' (' + esc(r.rc.note) + ')' : ''}.</span>`;
      return t;
    };
    return `<div class="lrow"><label style="flex:1">Драйверы модулей<select id="lIc">${Object.entries(ICN).map(([k, t]) => `<option value="${k}"${k === icOf(S) ? ' selected' : ''}>${t}</option>`).join('')}</select></label></div>
      <div class="small muted" style="margin-bottom:6px">Нагрузка карты — по паспорту NovaStar при 60 Гц для ${ICN[icOf(S)]}, ${rcBit(S)} бит${isCoex(S) ? ', COEX' : ''}. Тип драйвера смотрите в паспорте модуля.</div>
      ${rows.length ? rows.map(r => `<div class="lrcb"><div><b>${esc(r.d.name)}</b> <small class="muted">${r.d.wpx}×${r.d.hpx} px · ${r.cnt} шт.</small></div>
        <div class="lrow"><select data-rct="${esc(r.t)}" style="flex:1">${opt(r.d.rc)}</select><label title="сколько приёмных карт стоит в одном кабинете">карт в каб.<input type="number" min="1" max="16" data-rcn="${esc(r.t)}" value="${r.n}" style="width:52px"></label></div>
        <div class="small">${stat(r)}</div></div>`).join('') : '<div class="small muted">На экране пока нет кабинетов.</div>'}
      ${rows.length > 1 && rows[0].d.rc ? `<div class="lrow"><button id="lRcAll" class="small">Карту ${esc((rows[0].rc || {}).name || '')} — всем типам кабинетов</button></div>` : ''}
      ${S.card ? `<div class="small muted">Раньше было указано текстом: «${esc(S.card)}» — выберите карту из списка.</div>` : ''}`;
  }
  const TABS = [['cab', 'Кабинеты'], ['sig', 'Сигнал'], ['pwr', 'Питание'], ['sum', 'Итог']];
  const TABOF = { 'Итого': 'sum', 'Заметка': 'sum', 'Контроллер': 'sig', 'Данные (порты)': 'sig', 'Питание': 'pwr', 'Перемычки и запас': 'pwr', 'Выбранные кабинеты': 'cab', 'Приёмная карта в кабинете': 'cab' };
  function tabify(html, C) {
    const cur = cfg.ledTab || 'sig', parts = html.split('<h3>'), box = {};
    for (const p of parts.slice(1)) { const t = p.slice(0, p.indexOf('</h3>')), k = TABOF[t] || 'sum'; (box[k] ||= []).push('<h3>' + p); }
    const badge = { sum: C.warn.length ? ` <i class="lbdg">${C.warn.length}</i>` : '', cab: sel.size ? ` <i class="lbdg n">${sel.size}</i>` : '' };
    return `<div class="ltabs">${TABS.map(([k, t]) => `<button data-ltab="${k}" class="${k === cur ? 'on' : ''}">${t}${badge[k] || ''}</button>`).join('')}</div>`
      + TABS.map(([k]) => `<div class="ltab${k === cur ? ' on' : ''}">${(box[k] || []).join('')}</div>`).join('');
  }
  const typeCount = S => S.cabs.reduce((o, c) => (o[c.t] = (o[c.t] || 0) + 1, o), {});

  // ---------- вид (масштаб/сдвиг)
  function lFit() {
    const S = scr(), b = dBounds(S), st = panes().find(p => p.offsetParent && p.clientWidth) || $l('#ledStage .lpane'); if (!st) return;
    const W = st.clientWidth || 800, H = st.clientHeight || 600;
    if (!b.w) { vz = { x: 40, y: 40, z: 0.5 }; render(); return; }
    const top = (st.querySelector('.lpTitle') || {}).offsetHeight || 40, z = Math.min((W - 70) / b.w, (H - top - 60) / b.h, 4);
    vz = { z, x: (W - b.w * z) / 2 - b.x * z + 10, y: top + (H - top - b.h * z) / 2 - b.y * z + 8 }; render();
  }
  const toWorld = (ev, svg) => { const r = (svg || ev.currentTarget).getBoundingClientRect(); const x = (ev.clientX - r.left - vz.x) / vz.z; return { x: rear(scr()) ? -x : x, y: (ev.clientY - r.top - vz.y) / vz.z, sx: ev.clientX - r.left, sy: ev.clientY - r.top }; };
  const cabAt = (S, p) => { for (let i = S.cabs.length - 1; i >= 0; i--) { const c = S.cabs[i]; if (p.x >= c.x && p.y >= c.y && p.x < c.x + cw(S, c) && p.y < c.y + ch(S, c)) return c; } return null; };

  // ---------- мышь
  let drag = null, space = false;
  function onDown(ev) {
    const sv = ev.currentTarget, kind = sv.closest('.lpane').dataset.v, S = scr(), p = toWorld(ev, sv);
    if (ev.button === 2 && mode !== 'sel') { // правый щелчок по кабинету — убрать его из цепочки (как в NovaLCT)
      const c0 = cabAt(S, p);
      if (c0) { const arrs = kind === 'power' ? S.pw.lines : S.ports; if (arrs.some(a => a.includes(c0.id))) { lHist(); for (const a of arrs) { const k = a.indexOf(c0.id); if (k >= 0) a.splice(k, 1); } changed(); } ev.preventDefault(); return; }
    }
    if (mode === 'quick' && ev.button === 0 && !space) { drag = { t: 'qband', sv, kind, p0: p }; sv.setPointerCapture(ev.pointerId); return; }
    if (ev.button === 1 || ev.button === 2 || space) { drag = { t: 'pan', sv, sx: ev.clientX, sy: ev.clientY, x: vz.x, y: vz.y }; sv.setPointerCapture(ev.pointerId); ev.preventDefault(); return; }
    const c = cabAt(S, p);
    if (mode === 'wire') {
      if (!c) return;
      lHist(); drag = { t: 'chain', sv, kind, last: null, did: false };
      chainTouch(S, c, true); drag.last = c.id; sv.setPointerCapture(ev.pointerId); render(); return;
    }
    if (c) {
      { const pi = S.ports.findIndex(a => a.includes(c.id)), li = (S.pw.lines || []).findIndex(a => a.includes(c.id)); if (pi >= 0) act = pi; if (li >= 0) actW = li; }
      if (ev.shiftKey) { sel.has(c.id) ? sel.delete(c.id) : sel.add(c.id); render(); return; }
      if (!sel.has(c.id)) { sel = new Set([c.id]); }
      drag = { t: 'move', sv, p0: p, orig: S.cabs.filter(k => sel.has(k.id)).map(k => ({ k, x: k.x, y: k.y })), moved: false };
    } else {
      if (!ev.shiftKey) sel.clear();
      drag = { t: 'band', sv, p0: p, add: new Set(sel) };
    }
    sv.setPointerCapture(ev.pointerId); render();
  }
  // разложить кабинеты по цепочкам, не перегружая: порт — до предела пикселей, линия — до предела автомата.
  // Не влезает — следующий свободный порт / новая линия. Возвращает номер последней цепочки.
  const loadOf = (S, kind, a) => { const m = byId(S); return a.reduce((t, id) => { const c = m.get(id); return t + (c ? (kind === 'power' ? (cabDef(S, c.t).wmax || 0) : pxLoad(S, c)) : 0); }, 0); };
  const costOf = (S, kind, c) => kind === 'power' ? (cabDef(S, c.t).wmax || 0) : pxLoad(S, c);
  const limOf = (S, kind) => kind === 'power' ? lineLim(S) : portCap(S);
  function place(S, kind, cabs, start) {
    const arrs = kind === 'power' ? S.pw.lines : S.ports, lim = limOf(S, kind), maxN = kind === 'power' ? 999 : nPorts(S);
    const ids = new Set(cabs.map(c => c.id));
    for (const a of arrs) for (let k = a.length - 1; k >= 0; k--) if (ids.has(a[k])) a.splice(k, 1);
    let i = start, moved = false, left = 0;
    for (const c of cabs) {
      const cost = costOf(S, kind, c);
      while (true) {
        while (arrs.length <= i) arrs.push([]);
        if (loadOf(S, kind, arrs[i]) + cost <= lim || (!arrs[i].length && cost > lim)) break;
        let n = i + 1; while (n < arrs.length + 1 && arrs[n] && arrs[n].length) n++;
        if (n >= maxN) { i = -1; break; }
        i = n; moved = true;
      }
      if (i < 0) { left++; i = start; continue; }
      arrs[i].push(c.id);
    }
    if (left) toast(kind === 'power' ? `Не хватило линий для ${left} каб.` : `Порты закончились: ${left} каб. не подключено — добавьте контроллер или снизьте частоту`, 'w');
    else if (moved) toast(kind === 'power' ? 'Линия заполнена — дальше пошла следующая' : `Порт заполнен — дальше пошёл порт ${portName(S, i)}`);
    return Math.max(0, i);
  }
  function placeLines(S, kind, ls, snake, start) {
    // целыми столбцами/рядами: не влезает целиком — следующий порт/линия; одна линия больше порта — режем
    const arrs = kind === 'power' ? S.pw.lines : S.ports, lim = limOf(S, kind), maxN = kind === 'power' ? 999 : nPorts(S);
    const ids = new Set(ls.flat().map(c => c.id));
    for (const a of arrs) for (let k = a.length - 1; k >= 0; k--) if (ids.has(a[k])) a.splice(k, 1);
    let i = start, cnt = 0, left = 0;
    const nextFree = () => { let n = i + 1; while (arrs[n] && arrs[n].length) n++; return n; };
    for (const l0 of ls) {
      while (arrs.length <= i) arrs.push([]);
      const l = snake && cnt % 2 ? [...l0].reverse() : l0, cost = l.reduce((t, c) => t + costOf(S, kind, c), 0);
      if (arrs[i].length && loadOf(S, kind, arrs[i]) + cost > lim) { i = nextFree(); cnt = 0; if (i >= maxN) { left += ls.slice(ls.indexOf(l0)).flat().length; break; } while (arrs.length <= i) arrs.push([]); }
      const l2 = snake && cnt % 2 ? [...l0].reverse() : l0;
      if (cost <= lim) { arrs[i].push(...l2.map(c => c.id)); cnt++; continue; }
      for (const c of l2) { if (loadOf(S, kind, arrs[i]) + costOf(S, kind, c) > lim && arrs[i].length) { i = nextFree(); if (i >= maxN) { left++; continue; } while (arrs.length <= i) arrs.push([]); } arrs[i].push(c.id); }
      cnt = 0;
    }
    if (left) toast(kind === 'power' ? `Не хватило линий для ${left} каб.` : `Порты закончились: ${left} каб. не подключено — добавьте контроллер или снизьте частоту`, 'w');
    return Math.min(i, maxN - 1);
  }
  function chainTouch(S, c, first) {
    const arrs = drag.kind === 'power' ? S.pw.lines : S.ports, ai = drag.kind === 'power' ? actW : act;
    while (arrs.length <= ai) arrs.push([]);
    const a = arrs[ai];
    if (first && a[a.length - 1] === c.id) { a.pop(); drag.did = true; return; } // щелчок по последнему — убрать
    if (a.includes(c.id)) return;
    const ni = place(S, drag.kind, [c], ai); // не даём перегрузить: при заполнении — в следующий порт / линию
    if (drag.kind === 'power') actW = ni; else act = ni;
    drag.did = true;
  }
  function hover(ev) {
    const S = scr(), sv = ev.currentTarget, kind = sv.closest('.lpane').dataset.v, c = cabAt(S, toWorld(ev, sv)), tip = $l('#ledTip'), hs = $l('#lhov');
    if (!c) { tip.style.display = 'none'; hs.textContent = ''; return; }
    const d = cabDef(S, c.t), pi = S.ports.findIndex(a => a.includes(c.id)), li = (S.pw.lines || []).findIndex(a => a.includes(c.id));
    tip.innerHTML = `<b>Кабинет ${S.cabs.indexOf(c) + 1}</b> · ${esc(d.name)}<br>`
      + (pi >= 0 ? `Порт <b>${portName(S, pi)}</b>, ${S.ports[pi].indexOf(c.id) + 1}-й из ${S.ports[pi].length}` : 'Порт: —')
      + (li >= 0 ? ` · Питание <b>${lineTag(S, li)}</b>, ${S.pw.lines[li].indexOf(c.id) + 1}-й из ${S.pw.lines[li].length}` : ' · Питание: —')
      + `<br><span>X ${c.x + (S.ox || 0)}, Y ${c.y + (S.oy || 0)} px · ${d.wpx}×${d.hpx} · ${d.wmax || '?'} Вт</span>`;
    const r = $l('#ledStage').getBoundingClientRect();
    tip.style.display = 'block'; tip.style.left = Math.min(ev.clientX - r.left + 14, r.width - 290) + 'px'; tip.style.top = (ev.clientY - r.top + 16) + 'px';
    hs.textContent = (pi >= 0 ? `.lpane[data-v=data] .lcab[data-g="${pi}"] .lcr{fill-opacity:.6}` : '') + (li >= 0 ? `.lpane[data-v=power] .lcab[data-g="${li}"] .lcr{fill-opacity:.6}` : '') + `.lcab[data-c="${c.id}"] .lcr{stroke:#f8fafc;stroke-width:${3 / vz.z}}`;
    void kind;
  }
  function onMove(ev) {
    if (!drag) return hover(ev);
    $l('#ledTip').style.display = 'none';
    const S = scr();
    if (drag.t === 'pan') { vz.x = drag.x + ev.clientX - drag.sx; vz.y = drag.y + ev.clientY - drag.sy; setT(); return; }
    const p = toWorld(ev, drag.sv);
    if (drag.t === 'chain') { const c = cabAt(S, p); if (c && c.id !== drag.last) { chainTouch(S, c, false); drag.last = c.id; render(); } return; }
    if (drag.t === 'move') {
      let dx = p.x - drag.p0.x, dy = p.y - drag.p0.y;
      if (!drag.moved && Math.hypot(dx, dy) * vz.z < 4) return;
      if (!drag.moved) { lHist(); drag.moved = true; }
      // привязка: края выбранных к краям остальных (в пикселях экрана)
      const thr = 12 / vz.z, others = S.cabs.filter(k => !sel.has(k.id));
      let bx = null, by = null;
      for (const o of drag.orig) {
        const w = cw(S, o.k), h = ch(S, o.k), ex = [o.x + dx, o.x + dx + w], ey = [o.y + dy, o.y + dy + h];
        for (const t of others) {
          const tx = [t.x, t.x + cw(S, t)], ty = [t.y, t.y + ch(S, t)];
          for (const a of ex) for (const b of tx) { const d = b - a; if (Math.abs(d) < thr && (bx === null || Math.abs(d) < Math.abs(bx))) bx = d; }
          for (const a of ey) for (const b of ty) { const d = b - a; if (Math.abs(d) < thr && (by === null || Math.abs(d) < Math.abs(by))) by = d; }
        }
      }
      if (bx !== null) dx += bx; if (by !== null) dy += by;
      for (const o of drag.orig) { o.k.x = Math.round(o.x + dx); o.k.y = Math.round(o.y + dy); }
      render(); return;
    }
    if (drag.t === 'qband') {
      const x0 = Math.min(drag.p0.x, p.x), y0 = Math.min(drag.p0.y, p.y), x1 = Math.max(drag.p0.x, p.x), y1 = Math.max(drag.p0.y, p.y);
      drag.r = { x0, y0, x1, y1 };
      const r = drag.sv.parentNode.querySelector('.lband'); r.style.display = 'block';
      r.style.left = Math.min(drag.p0.sx, p.sx) + 'px'; r.style.top = Math.min(drag.p0.sy, p.sy) + 'px'; r.style.width = Math.abs(p.sx - drag.p0.sx) + 'px'; r.style.height = Math.abs(p.sy - drag.p0.sy) + 'px';
      return;
    }
    if (drag.t === 'band') {
      const x0 = Math.min(drag.p0.x, p.x), y0 = Math.min(drag.p0.y, p.y), x1 = Math.max(drag.p0.x, p.x), y1 = Math.max(drag.p0.y, p.y);
      sel = new Set(drag.add);
      for (const c of S.cabs) if (c.x < x1 && c.x + cw(S, c) > x0 && c.y < y1 && c.y + ch(S, c) > y0) sel.add(c.id);
      const r = drag.sv.parentNode.querySelector('.lband'); r.style.display = 'block';
      r.style.left = Math.min(drag.p0.sx, p.sx) + 'px'; r.style.top = Math.min(drag.p0.sy, p.sy) + 'px'; r.style.width = Math.abs(p.sx - drag.p0.sx) + 'px'; r.style.height = Math.abs(p.sy - drag.p0.sy) + 'px';
      render();
    }
  }
  function onUp() {
    if (!drag) return;
    const t = drag; drag = null; document.querySelectorAll('#ledStage .lband').forEach(b => b.style.display = 'none');
    if (t.t === 'chain') { if (t.did) changed(); else undoL.pop(); return; }
    if (t.t === 'qband') {
      const S = scr(), r = t.r || { x0: t.p0.x, y0: t.p0.y, x1: t.p0.x + 0.1, y1: t.p0.y + 0.1 };
      const list = S.cabs.filter(c => c.x < r.x1 && c.x + cw(S, c) > r.x0 && c.y < r.y1 && c.y + ch(S, c) > r.y0);
      if (!list.length) return render();
      lHist();
      const arrs = t.kind === 'power' ? S.pw.lines : S.ports, ai = t.kind === 'power' ? actW : act;
      const last = placeLines(S, t.kind, orderLines(S, list, qp), qp.snake, ai);
      // следующий пустой порт / линия — сразу можно обводить дальше
      let nx = last + 1; while (arrs[nx] && arrs[nx].length) nx++;
      if (t.kind === 'power') actW = nx; else act = Math.min(nx, nPorts(S) - 1);
      changed(); return;
    }
    if (t.t === 'move' && t.moved) { markCustom(); changed(); return; }
    render();
  }
  function markCustom() { const S = scr(); if (S.grid) S.grid.custom = true; else S.grid = { ...gridInfer(S), custom: true }; }
  function onWheel(ev) {
    ev.preventDefault();
    const r = ev.currentTarget.getBoundingClientRect(), mx = ev.clientX - r.left, my2 = ev.clientY - r.top;
    const k = Math.exp(-ev.deltaY * (ev.ctrlKey ? 0.01 : 0.0015)), z = clamp(vz.z * k, 0.02, 8);
    vz.x = mx - (mx - vz.x) * z / vz.z; vz.y = my2 - (my2 - vz.y) * z / vz.z; vz.z = z;
    setT(); clearTimeout(onWheel.t); onWheel.t = setTimeout(render, 140);
  }
  function onDrop(ev) {
    ev.preventDefault();
    const id = ev.dataTransfer.getData('text/led-cab'); if (!id) return;
    const S = scr(), d = allCabs().find(c => c.id === id); if (!d) return;
    const p = toWorld(ev, ev.currentTarget.querySelector('svg')); lHist();
    putDef(S, d);
    let x = Math.round(p.x - d.wpx / 2), y = Math.round(p.y - d.hpx / 2);
    // прилипает к сетке своего размера относительно экрана
    const b = bounds(S); if (S.cabs.length) { x = b.x + Math.round((x - b.x) / d.wpx) * d.wpx; y = b.y + Math.round((y - b.y) / d.hpx) * d.hpx; }
    const c = { id: uid(), t: d.id, x, y }; S.cabs.push(c); markCustom(); sel = new Set([c.id]); curCab = d.id; changed();
  }

  // ---------- клавиатура (только когда открыт раздел)
  function key(ev) {
    const mod = ev.ctrlKey || ev.metaKey, k = ev.key.toLowerCase();
    if (/input|textarea|select/i.test(document.activeElement && document.activeElement.tagName)) return;
    const S = scr();
    if (mod && k === 'z') { ev.preventDefault(); return ev.shiftKey ? lRedo() : lUndo(); }
    if (mod && k === 'y') { ev.preventDefault(); return lRedo(); }
    if (mod && k === 'a') { ev.preventDefault(); sel = new Set(S.cabs.map(c => c.id)); return render(); }
    if (mod && k === 'd') { ev.preventDefault(); return dupSel(); }
    if (ev.key === 'Delete' || ev.key === 'Backspace') { if (sel.size) { ev.preventDefault(); lHist(); S.cabs = S.cabs.filter(c => !sel.has(c.id)); sel.clear(); markCustom(); changed(); } return; }
    if (ev.key === 'Escape') { sel.clear(); mode = 'sel'; return render(); }
    if (ev.key === ' ') { space = true; return; }
    if (!mod && (k === 'f' || k === '0')) return lFit();
    if (!mod && (ev.key === '+' || ev.key === '=' || ev.key === '-')) { const p = panes().find(q => q.clientWidth) || $l('#ledStage .lpane'), W = p.clientWidth / 2, H = p.clientHeight / 2, z = clamp(vz.z * (ev.key === '-' ? 0.8 : 1.25), 0.02, 8); vz.x = W - (W - vz.x) * z / vz.z; vz.y = H - (H - vz.y) * z / vz.z; vz.z = z; return render(); }
    if (!mod && k === 'v') { mode = 'sel'; return render(); }
    if (!mod && (k === 'w' || k === 'p')) { mode = 'wire'; return render(); }
    if (!mod && k === 'q') { mode = 'quick'; return render(); }
    if (ev.key.startsWith('Arrow') && sel.size) {
      ev.preventDefault(); lHist();
      for (const c of S.cabs) if (sel.has(c.id)) {
        const st = ev.shiftKey ? 1 : (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight' ? cw(S, c) : ch(S, c));
        if (ev.key === 'ArrowLeft') c.x -= st; if (ev.key === 'ArrowRight') c.x += st; if (ev.key === 'ArrowUp') c.y -= st; if (ev.key === 'ArrowDown') c.y += st;
      }
      markCustom(); changed();
    }
  }
  function dupSel() {
    const S = scr(); if (!sel.size) return; lHist();
    const list = S.cabs.filter(c => sel.has(c.id)), b = bounds(S, list), ns = new Set();
    for (const c of list) { const n = { ...c, id: uid(), x: c.x + b.w }; S.cabs.push(n); ns.add(n.id); }
    sel = ns; markCustom(); changed();
  }

  // ---------- кнопки и поля панелей
  function wire() {
    for (const pn of panes()) {
      const sv = pn.querySelector('svg');
      sv.addEventListener('pointerdown', onDown); sv.addEventListener('pointermove', onMove); sv.addEventListener('pointerup', onUp); sv.addEventListener('pointercancel', onUp);
      sv.addEventListener('wheel', onWheel, { passive: false }); sv.addEventListener('contextmenu', e => e.preventDefault());
      pn.addEventListener('dragover', e => e.preventDefault()); pn.addEventListener('drop', onDrop);
      sv.addEventListener('dblclick', ev => { const S = scr(), c = cabAt(S, toWorld(ev, sv)); if (c) cabInfo(S, c); else lFit(); });
      sv.addEventListener('pointerleave', () => { $l('#ledTip').style.display = 'none'; $l('#lhov').textContent = ''; });
    }
    addEventListener('resize', () => { if (on) lFit(); });
    addEventListener('keyup', e => { if (e.key === ' ') space = false; });
    const wrap = $l('#ledWrap');
    wrap.addEventListener('click', ev => {
      const t = ev.target.closest('button,[data-si],[data-cab],[data-port],[data-wline],[data-lgrp]'); if (!t) return;
      const S = scr(), d = t.dataset;
      if (d.lmode) { mode = d.lmode; return render(); }
      if (d.step) return setStep(+d.step);
      if (d.sa) {
        if (d.sa === 'rec') { const rc = recCtrlObj(S, C2need(S), calc(S).pxT); if (rc) { lHist(); S.ctrl = { ...rc.c }; S.units = rc.u; changed(); } return; }
        if (d.sa === 'clrD') { lHist(); S.ports = []; act = 0; return changed(); }
        if (d.sa === 'clrP') { lHist(); S.pw.lines = []; actW = 0; return changed(); }
        if (d.sa === 'png') return exportImg('png');
        if (d.sa === 'nlct') return novaDialog();
        if (d.sa === 'calc') return calcOpen();
      }
      if (d.ltab) { cfg.ledTab = d.ltab; saveCfg(); return render(); }
      if (d.act === 'dauto') { lHist(); autoData(S); return changed(); }
      if (d.act === 'pauto') { lHist(); autoPower(S); return changed(); }
      if (d.act === 'dsnake') { lHist(); S.pat.snake = !S.pat.snake; autoData(S); return changed(); }
      if (d.act === 'psnake') { lHist(); S.pw.snake = !S.pw.snake; autoPower(S); return changed(); }
      if (d.qst) { qp.start = d.qst; qp.dir = d.qdir; try { cfg.ledQP = qp; saveCfg(); } catch (e) { } return render(); }
      if (d.qsnake) { qp.snake = !qp.snake; try { cfg.ledQP = qp; saveCfg(); } catch (e) { } return render(); }
      if (d.si != null) { L.cur = +d.si; sel.clear(); act = 0; actW = 0; render(); return lFit(); }
      if (d.lgrp) { const o = cfg.ledOpen = cfg.ledOpen || {}; o[d.lgrp] = !o[d.lgrp]; saveCfg(); return renderLeft(S); }
      if (d.cab) { curCab = d.cab; if (isGrid(S) || !S.grid) { const g = gridInfer(S); if (!g.custom && g.t !== d.cab) { const nd = allCabs().find(x => x.id === d.cab), od = cabDef(S, g.t); g.t = d.cab; if (nd && !(nd.wmm === od.wmm && nd.hmm === od.hmm)) { g.cols = Math.max(1, Math.round(g.cols * od.wmm / nd.wmm)); g.rows = Math.max(1, Math.round(g.rows * od.hmm / nd.hmm)); } return gridApply(S, g); } } return render(); }
      if (d.pclr != null) { ev.stopPropagation(); lHist(); S.ports[+d.pclr] = []; return changed(); }
      if (d.port != null) { act = +d.port; mode = 'wire'; return render(); }
      if (d.wline != null) { actW = +d.wline; mode = 'wire'; return render(); }
      if (d.pstart) { lHist(); S.pat.start = d.pstart; autoData(S); return changed(); }
      if (d.pdir) { lHist(); S.pat.dir = d.pdir; autoData(S); return changed(); }
      if (d.wstart) { lHist(); S.pw.start = d.wstart; autoPower(S); return changed(); }
      if (d.wdir) { lHist(); S.pw.dir = d.wdir; autoPower(S); return changed(); }
      const id = t.id;
      if (id === 'lAuto') { lHist(); autoData(S); return changed(); }
      if (id === 'lClrAll') { lHist(); S.ports = []; return changed(); }
      if (id === 'lPAuto') { lHist(); autoPower(S); return changed(); }
      if (id === 'lPClr') { lHist(); S.pw.lines = []; return changed(); }
      if (id === 'lSelDel') { lHist(); S.cabs = S.cabs.filter(c => !sel.has(c.id)); sel.clear(); markCustom(); return changed(); }
      if (id === 'lSelSet') { lHist(); const nt = $l('#lSelType').value, dd = allCabs().find(c => c.id === nt) || cabDef(S, nt); putDef(S, dd); for (const c of S.cabs) if (sel.has(c.id)) c.t = nt; markCustom(); return changed(); }
      if (id === 'lSelPort') { lHist(); const ids = S.cabs.filter(c => sel.has(c.id)); act = place(S, 'data', snakeJoin(orderLines(S, ids, S.pat), S.pat.snake), act); return changed(); }
      if (id === 'lCtrlNew') return ctrlEditor();
      if (id === 'lScrAdd') { lHist(); L.screens.push(newScreen('Экран ' + (L.screens.length + 1))); L.cur = L.screens.length - 1; sel.clear(); changed(); return lFit(); }
      if (id === 'lScrDup') { lHist(); const n = JSON.parse(JSON.stringify(S)); n.id = uid(); n.name = S.name + ' (копия)'; L.screens.splice(L.cur + 1, 0, n); L.cur++; return changed(); }
      if (id === 'lScrRen') return askText('Название экрана', S.name, v => { if (!v) return; lHist(); S.name = v; changed(); });
      if (id === 'lScrDel') { if (L.screens.length < 2) return toast('Это единственный экран', 'w'); lHist(); toast('Экран «' + S.name + '» удалён — Ctrl+Z вернёт'); L.screens.splice(L.cur, 1); L.cur = Math.max(0, L.cur - 1); sel.clear(); changed(); return lFit(); }
      if (id === 'lGrid') return gridDialog(false);
      if (id === 'lCabNew') return cabEditor(null);
      if (id === 'lRcAll') { lHist(); const r0 = cabDef(S, Object.keys(typeCount(S))[0]); for (const k of Object.keys(typeCount(S))) S.defs[k] = { ...cabDef(S, k), rc: r0.rc }; return changed(); }
      if (id === 'lFit') return lFit();
      if (id === 'lFull') { cfg.ledFull = !cfg.ledFull; saveCfg(); render(); return requestAnimationFrame(lFit); }
      if (id === 'lRear') { lHist(); S.rear = !S.rear; changed(); return lFit(); }
      if (id === 'lMap') { cfg.ledMap = !cfg.ledMap; saveCfg(); return render(); }
      if (id === 'lLines') { cfg.ledNoLines = !cfg.ledNoLines; saveCfg(); return render(); }
      if (id === 'lSplitDir') { split = $l('#ledStage').classList.contains('vsplit') ? 'h' : 'v'; try { cfg.ledSplit = split; saveCfg(); } catch (e) { } render(); return requestAnimationFrame(lFit); }
      if (id === 'lUndo') return lUndo();
      if (id === 'lRedo') return lRedo();
      if (id === 'lPNG') return exportImg('png');
      if (id === 'lSVG') return exportImg('svg');
      if (id === 'lCSV') return exportCSV();
      if (id === 'lCalc') return calcOpen();
      if (id === 'lReset') return resetDialog();
      if (id === 'lNLCT') return novaDialog();
    });
    wrap.addEventListener('dblclick', ev => { const t = ev.target.closest('[data-cab]'); if (t) { const c = allCabs().find(x => x.id === t.dataset.cab); cabEditor(c); } const s = ev.target.closest('[data-si]'); if (s) $l('#lScrRen').click(); });
    wrap.addEventListener('dragstart', ev => { const t = ev.target.closest('[data-cab]'); if (t) ev.dataTransfer.setData('text/led-cab', t.dataset.cab); });
    wrap.addEventListener('change', ev => {
      const S = scr(), id = ev.target.id, v = ev.target.value;
      if (id === 'ledCabSearch') return;
      lHist();
      if (id === 'lCtrl') S.ctrl = { ...(allCtrls().find(c => c.id === v) || S.ctrl) };
      else if (id === 'lUnits') S.units = clamp(+v || 1, 1, 20);
      else if (id === 'lBit') S.bit = v;
      else if (id === 'lFps') {
        if (v === 'custom') { lHistDrop(); return askText('Своя частота, Гц', String(fpsOf(S)), t => { const f = parseFloat(String(t).replace(',', '.')); if (!(f >= 1 && f <= 1000)) return toast('Частота от 1 до 1000 Гц', 'w'); lHist(); S.fps = f; changed(); }); }
        S.fps = +v;
      }
      else if (ev.target.dataset.rct !== undefined) { const t = ev.target.dataset.rct; S.defs[t] = { ...cabDef(S, t), rc: v || undefined }; if (!v) delete S.defs[t].rc; else S.card = ''; }
      else if (ev.target.dataset.rcn !== undefined) { const t = ev.target.dataset.rcn; S.defs[t] = { ...cabDef(S, t), rcn: clamp(Math.round(+v || 1), 1, 16) }; }
      else if (id === 'lIc') S.ic = v === 'common' ? 'common' : 'pwm';
      else if (id === 'lOx') S.ox = Math.round(+v || 0);
      else if (id === 'lOy') S.oy = Math.round(+v || 0);
      else if (id === 'lSnake') { S.pat.snake = ev.target.checked; autoData(S); }
      else if (id === 'lSplit') { S.pat.split = v; autoData(S); }
      else if (id === 'lPer') { S.pat.per = Math.max(1, +v || 1); autoData(S); }
      else if (id === 'lBackup') S.backup = ev.target.checked;
      else if (id === 'lV') S.pw.v = +v || 230;
      else if (id === 'lA') S.pw.a = +v || 16;
      else if (id === 'lK') S.pw.k = clamp(+v || 80, 10, 100);
      else if (id === 'lPf') S.pw.pf = clamp(+v || 0.95, 0.5, 1);
      else if (id === 'lPh') S.pw.phases = +v;
      else if (id === 'lNote') S.note = v;
      else if (id === 'lPSplit') { S.pw.split = v; autoPower(S); }
      else if (id === 'lAvg') S.pw.avgPct = clamp(+v || 35, 1, 100);
      else if (id === 'lHLen' || id === 'lVLen' || id === 'lZip') { L.calc = Object.assign({ prices: {} }, CD, L.calc || {}); L.calc[{ lHLen: 'hLen', lVLen: 'vLen', lZip: 'zip' }[id]] = Math.max(0, +v || 0); }
      else { undoL.pop(); return; }
      changed();
    });
    $l('#ledCabSearch').addEventListener('input', () => renderLeft(scr()));
  }

  // ---------- диалоги
  function gridDialog() {
    const S = scr(), c = allCabs().find(x => x.id === curCab) || DEFCAB();
    openModal('Экран из кабинетов', `<p class="muted">Кабинет: <b>${esc(c.name)}</b> (${c.wpx}×${c.hpx} px, ${c.wmm}×${c.hmm} мм). Другой — выберите слева.</p>
      <div class="lrow"><label>Столбцов<input type="number" id="gC" min="1" value="8"></label><label>Рядов<input type="number" id="gR" min="1" value="4"></label></div>
      <div class="lrow"><label>или по размеру, м: ширина<input type="number" step="0.1" id="gW" placeholder="${f2(8 * c.wmm / 1000)}"></label><label>высота<input type="number" step="0.1" id="gH" placeholder="${f2(4 * c.hmm / 1000)}"></label></div>
      <div id="gInfo" class="small"></div>
      <div class="lrow" style="margin-top:10px"><button class="pri" id="gNew">Заменить экран</button><button id="gBelow">Добавить рядами снизу</button><button id="gRight">Добавить справа</button></div>`);
    const upd = () => { const C2 = +$l('#gC').value || 1, R2 = +$l('#gR').value || 1; $l('#gInfo').textContent = `${C2 * R2} каб. · ${C2 * c.wpx}×${R2 * c.hpx} px · ${f2(C2 * c.wmm / 1000)}×${f2(R2 * c.hmm / 1000)} м`; };
    $l('#gW').oninput = () => { $l('#gC').value = Math.max(1, Math.round(+$l('#gW').value * 1000 / c.wmm)); upd(); };
    $l('#gH').oninput = () => { $l('#gR').value = Math.max(1, Math.round(+$l('#gH').value * 1000 / c.hmm)); upd(); };
    $l('#gC').oninput = upd; $l('#gR').oninput = upd; upd();
    const go = how => { const C2 = +$l('#gC').value || 1, R2 = +$l('#gR').value || 1; lHist(); const b = bounds(S);
      if (how === 'new') { S.cabs = []; S.ports = []; S.pw.lines = []; gridFill(S, c, C2, R2); S.grid = { t: c.id, cols: C2, rows: R2 }; }
      else if (how === 'below') { gridFill(S, c, C2, R2, b.x, b.y + b.h); markCustom(); }
      else { gridFill(S, c, C2, R2, b.x + b.w, b.y); markCustom(); }
      if (how === 'new') { autoData(S); autoPower(S); } closeModal(); changed(); lFit(); };
    $l('#gNew').onclick = () => go('new'); $l('#gBelow').onclick = () => go('below'); $l('#gRight').onclick = () => go('right');
  }
  function cabEditor(c) {
    const mine = c && my.cabs.includes(c), d = c ? { ...c } : { name: '', maker: '', wmm: 500, hmm: 500, wpx: 192, hpx: 192, kg: 8, wmax: 200, wavg: 70, rc: '', rcn: 1 };
    const fld = (k, t, type = 'number', w = '') => `<label${w ? ` style="flex:${w}"` : ''}>${t}<input id="ce_${k}" type="${type}" value="${esc(d[k] ?? '')}"></label>`;
    openModal(mine ? 'Мой кабинет' : c ? 'Новый кабинет на основе «' + c.name + '»' : 'Новый кабинет', `
      <div class="lrow">${fld('name', 'Название', 'text', 2)}${fld('maker', 'Производитель', 'text', 1)}</div>
      <div class="lrow">${fld('wmm', 'Ширина, мм')}${fld('hmm', 'Высота, мм')}${fld('wpx', 'Пикселей по ширине')}${fld('hpx', 'по высоте')}</div>
      <div class="lrow">${fld('kg', 'Вес, кг')}${fld('wmax', 'Мощность макс, Вт')}${fld('wavg', 'средняя, Вт')}</div>
      <div class="lrow"><label style="flex:2">Приёмная карта<select id="ce_rc"><option value="">— не выбрана —</option>${RCSER.map(g => `<optgroup label="${g}">${RCARDS.filter(r => r.ser === g).map(r => `<option value="${r.id}"${r.id === d.rc ? ' selected' : ''}>${esc(r.name)}</option>`).join('')}</optgroup>`).join('')}</select></label><label>Карт в кабинете<input id="ce_rcn" type="number" min="1" max="16" value="${d.rcn || 1}"></label></div>
      ${d.card && !d.rc ? `<div class="small muted">Было указано текстом: «${esc(d.card)}»</div>` : ''}
      <div class="small muted" id="ceInfo"></div>
      <div class="lrow" style="margin-top:10px"><button class="pri" id="ceOk">Сохранить в «Мои кабинеты»</button>${mine ? '<button id="ceDel">Удалить</button>' : ''}</div>`);
    const info = () => { const w = +$l('#ce_wmm').value, p = +$l('#ce_wpx').value; $l('#ceInfo').textContent = w && p ? `Шаг пикселя ≈ P${f2(w / p)} мм` : ''; };
    ['wmm', 'wpx'].forEach(k => $l('#ce_' + k).oninput = info); info();
    $l('#ceOk').onclick = () => {
      const n = {}; for (const k of ['name', 'maker']) n[k] = $l('#ce_' + k).value.trim(); n.rc = $l('#ce_rc').value; n.rcn = clamp(Math.round(+$l('#ce_rcn').value || 1), 1, 16); if (d.card && !n.rc) n.card = d.card; for (const k of ['wmm', 'hmm', 'wpx', 'hpx', 'kg', 'wmax', 'wavg']) n[k] = +$l('#ce_' + k).value || 0;
      if (!n.name || !n.wpx || !n.hpx || !n.wmm || !n.hmm) return toast('Заполните название, размер в мм и пиксели', 'w');
      if (mine) Object.assign(c, n); else { n.id = 'my_' + uid(); my.cabs.unshift(n); curCab = n.id; }
      // обновить кабинет в экранах проекта
      if (mine) for (const S of L.screens) if (S.defs[c.id]) S.defs[c.id] = { ...c, ...(c.rc ? {} : keepRc(S.defs[c.id])) };
      saveMy(); closeModal(); changed(); toast('Кабинет сохранён');
    };
    if (mine) $l('#ceDel').onclick = () => { my.cabs = my.cabs.filter(x => x !== c); saveMy(); closeModal(); render(); };
  }
  function ctrlEditor() {
    const S = scr(), d = { ...S.ctrl };
    const fld = (k, t, type = 'number') => `<label>${t}<input id="ct_${k}" type="${type}" value="${esc(d[k] ?? '')}"></label>`;
    openModal('Свой контроллер', `<div class="lrow">${fld('name', 'Название', 'text')}</div>
      <div class="lrow">${fld('ports', 'Портов')}${fld('perPort', 'Пикселей на порт (8 бит)')}${fld('total', 'Всего пикселей')}</div>
      <div class="lrow">${fld('maxW', 'Макс. ширина, px')}${fld('maxH', 'Макс. высота, px')}</div>
      <div class="lrow" style="margin-top:10px"><button class="pri" id="ctOk">Сохранить</button></div>`);
    if (!d.perPort) $l('#ct_perPort').value = PORT_PX;
    $l('#ctOk').onclick = () => {
      const n = { id: 'myc_' + uid(), name: $l('#ct_name').value.trim() || 'Контроллер' }; for (const k of ['ports', 'perPort', 'total', 'maxW', 'maxH']) n[k] = +$l('#ct_' + k).value || 0; n.p8 = n.perPort; n.src = 'свой контроллер';
      if (!n.ports || !n.total) return toast('Укажите число портов и пиксели', 'w');
      my.ctrls.unshift(n); saveMy(); lHist(); S.ctrl = { ...n }; closeModal(); changed();
    };
  }
  function cabInfo(S, c) {
    const d = cabDef(S, c.t), pi = S.ports.findIndex(a => a.includes(c.id)), li = (S.pw.lines || []).findIndex(a => a.includes(c.id));
    openModal('Кабинет ' + (S.cabs.indexOf(c) + 1), `<table class="ltbl"><tr><td>Тип</td><td>${esc(d.name)}</td></tr><tr><td>Пиксели</td><td>${d.wpx}×${d.hpx}</td></tr><tr><td>Положение</td><td>X ${c.x}, Y ${c.y} px</td></tr>
      <tr><td>Порт</td><td>${pi >= 0 ? portName(S, pi) + ', ' + (S.ports[pi].indexOf(c.id) + 1) + '-й по цепочке' : '—'}</td></tr><tr><td>Питание</td><td>${li >= 0 ? 'линия ' + (li + 1) : '—'}</td></tr>
      <tr><td>Мощность</td><td>${d.wmax} Вт макс / ${d.wavg} Вт сред</td></tr><tr><td>Вес</td><td>${d.kg} кг</td></tr></table>
      <div class="lrow" style="margin-top:8px"><label>X<input type="number" id="ciX" value="${c.x}"></label><label>Y<input type="number" id="ciY" value="${c.y}"></label><button id="ciOk">Применить</button></div>`);
    $l('#ciOk').onclick = () => { lHist(); c.x = +$l('#ciX').value || 0; c.y = +$l('#ciY').value || 0; markCustom(); closeModal(); changed(); };
  }
  async function saveMy() { try { await idb.set('ledLib', my); } catch (e) { store.set('ledLib', my); } }

  // ---------- экспорт
  function exportSheet(S) {
    const C = calc(S), SH = sheet(S, C), W = 2300, H = 1620, X = (t, x, y, sz, col, wt, anc, fam) => `<text x="${x}" y="${y}" font-size="${sz}" fill="${col}" font-weight="${wt || 400}" text-anchor="${anc || 'start'}" font-family="${fam === 'm' ? 'Menlo, Consolas, monospace' : 'Arial, Helvetica, sans-serif'}">${esc(t)}</text>`;
    const db = dBounds(S), pad = Math.max(db.w, db.h) * 0.08;
    const panel = (v, x, y, w, h, title, sub, tc) => {
      const { body } = svgBody(S, v, C, true);
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#0b1220" stroke="#334155" stroke-width="2"/>` + X(title, x + 18, y + 32, 20, tc, 700) + X(sub, x + 18, y + 54, 14, '#94a3b8')
        + `<svg x="${x + 10}" y="${y + 70}" width="${w - 20}" height="${h - 80}" viewBox="${db.x - pad} ${db.y - pad} ${db.w + pad * 2} ${db.h + pad * 2}" preserveAspectRatio="xMidYMid meet">${body}</svg>`;
    };
    let cards = ''; const cw3 = (W - 92) / 3;
    SH.cards.forEach((k, i) => {
      const x = 46 + i * cw3, y = 1215;
      cards += `<rect x="${x}" y="${y}" width="${cw3}" height="${H - y - 46}" fill="#0f172a" stroke="#334155" stroke-width="2"/>` + X(k.t, x + 22, y + 42, 21, k.c, 700);
      k.rows.forEach(([a, b, c], r) => { const yy = y + 78 + r * 35; cards += X(a, x + 22, yy, 16, '#cbd5e1') + X(b, x + cw3 - 22, yy, 17, c || '#f8fafc', 600, 'end', 'm') + `<line x1="${x + 22}" y1="${yy + 11}" x2="${x + cw3 - 22}" y2="${yy + 11}" stroke="#1e293b"/>`; });
    });
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <style>.ll{text-anchor:middle;dominant-baseline:central;fill:#f8fafc;font-weight:700;font-family:Menlo,Consolas,monospace}.ls{text-anchor:middle;dominant-baseline:central;fill:#94a3b8;font-family:Menlo,Consolas,monospace}.ldim{text-anchor:middle;dominant-baseline:central;fill:#94a3b8;font-family:Menlo,Consolas,monospace}</style>
      <defs>${HATCH}</defs><rect width="${W}" height="${H}" fill="#060b16"/><rect x="46" y="46" width="${W - 92}" height="${H - 92}" fill="#0f172a" stroke="#334155" stroke-width="2"/>
      ${X(SH.title, 76, 98, 34, '#f8fafc', 700)}${X(SH.sub, 76, 132, 18, '#94a3b8', 400, 'start', 'm')}
      ${X(SH.size, W - 80, 98, 30, '#22d3ee', 700, 'end', 'm')}${X(SH.spec, W - 80, 132, 18, '#94a3b8', 400, 'end', 'm')}
      <line x1="46" y1="152" x2="${W - 46}" y2="152" stroke="#334155" stroke-width="2"/>
      ${panel('data', 62, 175, (W - 140) / 2, 1015, SH.dTitle, SH.dSub, '#22d3ee')}${panel('power', 62 + (W - 140) / 2 + 16, 175, (W - 140) / 2, 1015, SH.pTitle, SH.pSub, '#fbbf24')}
      ${cards}</svg>`;
  }
  async function exportImg(kind) {
    const S = scr(); if (!S.cabs.length) return toast('Экран пустой', 'w');
    const name = (S.name || 'экран').replace(/[\\/:*?"<>|]+/g, '_') + ' — схема коммутации и питания', s = exportSheet(S);
    if (kind === 'svg') return download(name + '.svg', s, 'image/svg+xml');
    const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
    await img.decode();
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; cv.getContext('2d').drawImage(img, 0, 0);
    cv.toBlob(b => download(name + '.png', b, 'image/png'), 'image/png');
  }
  function exportCSV() {
    const S = scr(), m = byId(S), ox = S.ox || 0, oy = S.oy || 0, rows = [['Экран', 'Порт', '№ в цепочке', 'Кабинет', 'Тип', 'X, px', 'Y, px', 'Пикселей', 'Линия питания']];
    const li = new Map(); (S.pw.lines || []).forEach((a, i) => a.forEach(id => li.set(id, i + 1)));
    S.ports.forEach((a, i) => a.forEach((id, k) => { const c = m.get(id); if (c) rows.push([S.name, portName(S, i), k + 1, S.cabs.indexOf(c) + 1, cabDef(S, c.t).name, c.x + ox, c.y + oy, px(S, c), li.get(id) || '']); }));
    for (const c of S.cabs) if (!S.ports.some(a => a.includes(c.id))) rows.push([S.name, '—', '', S.cabs.indexOf(c) + 1, cabDef(S, c.t).name, c.x + ox, c.y + oy, px(S, c), li.get(c.id) || '']);
    download((S.name || 'экран') + ' — порты и кабинеты.csv', csv(rows), 'text/csv');
  }
  // контроллер экрана — устройством на схему видеосигнала (порты LAN по числу занятых)


  // ---------- полная калькуляция проекта: все экраны — кабинеты, контроллеры, карты, кабели, питание
  const CD = { spare: 5, lanLen: 30, pwrLen: 20, work: 0, cur: '₽', hLen: 1.5, vLen: 1.0, zip: 10 };
  function calcRows() {
    const cs = L.calc = Object.assign({ prices: {} }, CD, L.calc || {}); cs.prices ||= {};
    const items = new Map(), add = (key, grp, name, unit, qty, note) => { if (!qty) return; const r = items.get(key) || { key, grp, name, unit, qty: 0, note: '' }; r.qty += qty; if (note) r.note = r.note ? r.note + '; ' + note : note; items.set(key, r); };
    const scrRows = []; let area = 0;
    for (const S of L.screens) {
      clean(S); const C = calc(S), tc = typeCount(S);
      for (const [t, n] of Object.entries(tc)) { const d = cabDef(S, t), sp = Math.ceil(n * cs.spare / 100); add('cab:' + d.name, 'LED-экраны', 'Кабинет ' + d.name, 'шт.', n + sp, `${S.name}: ${n}${sp ? ' + ' + sp + ' запас' : ''}`); }
      for (const r of C.rcs) if (r.rc) add('rc:' + r.rc.id, 'LED-экраны', 'Приёмная карта NovaStar ' + r.rc.name + ' (стоят в кабинетах)', 'шт.', r.cnt * r.n, `${S.name}: ${r.cnt} каб. × ${r.n} — входят в кабинеты`);
      add('ctrl:' + S.ctrl.name, 'LED-экраны', 'Контроллер ' + S.ctrl.name, 'шт.', S.units || 1, S.name);
      const used = C.ports.filter(p => p.n), jumpers = used.reduce((a, p) => a + p.n - 1, 0);
      add('lanJ', 'Кабели данных', 'Перемычка данных кабинет–кабинет (RJ45 / etherCON)', 'шт.', jumpers, S.name + ': ' + jumpers);
      add('lanF', 'Кабели данных', `Кабель данных контроллер → экран, ~${cs.lanLen} м`, 'шт.', used.length * (S.backup ? 2 : 1), S.name + ': ' + used.length + (S.backup ? ' + ' + used.length + ' резерв' : ''));
      const pj = C.pl.reduce((a, l) => a + l.n - 1, 0);
      add('pwJ', 'Питание', 'Перемычка питания кабинет–кабинет (powerCON)', 'шт.', pj, S.name + ': ' + pj);
      add('pwF', 'Питание', `Кабель питания щит → экран, ~${cs.pwrLen} м`, 'шт.', C.pl.length, S.name + ': ' + C.pl.length);
      add('brk:' + S.pw.a, 'Питание', `Автомат ${S.pw.a} А (линия ${fmt(lineLim(S))} Вт)`, 'шт.', C.pl.length, S.name);
      area += C.area;
      scrRows.push({ S, C });
    }
    const rows = [...items.values()].map(r => ({ ...r, price: +cs.prices[r.key] || (r.key === 'work' ? +cs.work : 0) }));
    return { rows, scrRows, cs, area };
  }
  // рабочая мощность экрана: средняя по паспорту, а если её нет — оценка (% от пиковой)
  const avgOf = (S, C) => C.noAvg ? C.wmax * (S.pw.avgPct ?? 35) / 100 : C.wavg;
  // ---------- калькуляция на листах A4 (200 dpi) — для PDF и печати
  function calcPages() {
    const { rows, scrRows, cs } = calcRows(), grps = [...new Set(rows.map(r => r.grp))];
    const PW = 1654, PH2 = 2339, M = 110, W = PW - M * 2, FF = 'Arial, "Helvetica Neue", Helvetica, sans-serif';
    const tmp = document.createElement('canvas').getContext('2d');
    const wrap = (t, font, maxW) => { tmp.font = font; const out = []; for (const para of String(t).split('\n')) { let line = ''; for (const w of para.split(' ')) { const tr = line ? line + ' ' + w : w; if (tmp.measureText(tr).width > maxW && line) { out.push(line); line = w; } else line = tr; } out.push(line); } return out; };
    const COL = [{ x: 0, w: 1150 }, { x: 1150, w: 180, r: 1 }, { x: 1340, w: W - 1340 }];
    const F = { b: `26px ${FF}`, bb: `bold 26px ${FF}`, s: `21px ${FF}`, g: `bold 22px ${FF}`, h: `bold 21px ${FF}` };
    // элементы: { h, draw(g, y) }
    const items = [];
    const thead = { h: 52, draw: (g, y) => { g.font = F.h; g.fillStyle = '#475569'; ['Позиция', 'Кол-во', ''].forEach((t, i) => { const c = COL[i]; g.textAlign = c.r ? 'right' : 'left'; g.fillText(t, M + c.x + (c.r ? c.w - 8 : 8), y + 32); }); g.strokeStyle = '#94a3b8'; g.lineWidth = 2; g.beginPath(); g.moveTo(M, y + 48); g.lineTo(M + W, y + 48); g.stroke(); } };
    for (const gname of grps) {
      items.push({ grp: 1, h: 50, draw: (g, y) => { g.fillStyle = '#eef2f7'; g.fillRect(M, y + 6, W, 42); g.font = F.g; g.fillStyle = '#0f172a'; g.textAlign = 'left'; g.fillText(gname.toUpperCase(), M + 8, y + 35); } });
      for (const r of rows.filter(x => x.grp === gname)) {
        const nl = wrap(r.name, F.b, COL[0].w - 16), tl = r.note ? wrap(r.note, F.s, COL[0].w - 16) : [];
        const h = 20 + nl.length * 34 + tl.length * 28;
        items.push({ h, draw: (g, y) => {
          g.textAlign = 'left'; g.font = F.b; g.fillStyle = '#0f172a'; nl.forEach((t, i) => g.fillText(t, M + 8, y + 40 + i * 34));
          g.font = F.s; g.fillStyle = '#64748b'; tl.forEach((t, i) => g.fillText(t, M + 8, y + 40 + nl.length * 34 + i * 28 - 4));
          g.font = F.b; g.fillStyle = '#0f172a'; const cell = (i, t) => { const c = COL[i]; g.textAlign = c.r ? 'right' : 'left'; g.fillText(t, M + c.x + (c.r ? c.w - 8 : 8), y + 40); };
          cell(1, f2(r.qty)); cell(2, r.unit);
          g.strokeStyle = '#e2e8f0'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(M, y + h); g.lineTo(M + W, y + h); g.stroke();
        } });
      }
    }
    items.push({ h: 12, draw: (g, y) => { g.strokeStyle = '#0f172a'; g.lineWidth = 3; g.beginPath(); g.moveTo(M, y + 8); g.lineTo(M + W, y + 8); g.stroke(); } });
    // экраны — по строке-абзацу на экран
    items.push({ h: 80, keep: 1, draw: (g, y) => { g.font = `bold 30px ${FF}`; g.fillStyle = '#0f172a'; g.textAlign = 'left'; g.fillText('Экраны', M, y + 62); } });
    const t2 = scrRows.reduce((o, { S, C }) => { o.cab += S.cabs.length; o.px += C.pxT; o.area += C.area; o.kg += C.kg; o.wmax += C.wmax; o.wa += avgOf(S, C); o.est ||= C.noAvg; o.ek ||= C.estKg; C.phase.forEach((a, i) => o.ph[i] += a); return o; }, { cab: 0, px: 0, area: 0, kg: 0, wmax: 0, wa: 0, est: false, ph: [0, 0, 0] });
    const para = (head, txt, bold) => { const l = wrap(txt, F.b, W - 16); return { h: 22 + 34 + l.length * 34, draw: (g, y) => { g.textAlign = 'left'; g.font = bold ? F.bb : F.g; g.fillStyle = '#0f172a'; g.fillText(head, M + 8, y + 40); g.font = F.b; g.fillStyle = '#334155'; l.forEach((t, i) => g.fillText(t, M + 8, y + 74 + i * 34)); g.strokeStyle = '#e2e8f0'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(M, y + 22 + 34 + l.length * 34 + 6); g.lineTo(M + W, y + 22 + 34 + l.length * 34 + 6); g.stroke(); } }; };
    for (const { S, C } of scrRows) items.push(para(S.name, `${S.cabs.length} каб. · ${C.b.w}×${C.b.h} px · ${f2(C.mmW / 1000)}×${f2(C.mmH / 1000)} м (${f2(C.area)} м²) · ${C.estKg ? '≈' : ''}${fmt(C.kg)} кг · мощность макс ${f2(C.wmax / 1000)} кВт, рабочая ${C.noAvg ? '≈' : ''}${f2(avgOf(S, C) / 1000)} кВт · ${C.ports.filter(p => p.n).length} портов${S.backup ? ' + резерв' : ''} · ${S.ctrl.name.replace(/^NovaStar /, '').replace(/ \(.*$/, '')}${(S.units || 1) > 1 ? ' ×' + S.units : ''} · ${fpsOf(S)} Гц${rcName(S) ? ' · карта ' + rcName(S) : ''} · ${C.pl.length} линий питания × ${S.pw.a} А`));
    if (scrRows.length) items.push(para('Всего', `${t2.cab} каб. · ${fmt(t2.px)} px · ${f2(t2.area)} м² · ${t2.ek ? '≈' : ''}${fmt(t2.kg)} кг · мощность макс ${f2(t2.wmax / 1000)} кВт, рабочая ${t2.est ? '≈' : ''}${f2(t2.wa / 1000)} кВт · ток макс ≈ ${t2.ph.map((a, i) => PH[i] + ' ' + f1(a) + ' А').join(' · ')}`, true));
    items.push(para('Примечание', 'Вес и мощность типовых кабинетов — примерные, сверьте с паспортом производителя. Знак «≈» — оценка.' + (t2.est ? ` Рабочая мощность там, где в паспорте нет средней, — ${scrRows.map(({ S }) => S.pw.avgPct ?? 35).filter((v, i, a) => a.indexOf(v) === i).join(' / ')} % от пиковой.` : '')));
    // раскладка по страницам
    const top1 = 300, topN = 190, bot = PH2 - 120, pages = [[]]; let y = top1 + thead.h, inTable = true;
    items.forEach((it, i) => {
      const nxt = it.keep && items[i + 1] ? items[i + 1].h : 0, grpNext = it.grp && items[i + 1] ? items[i + 1].h : 0;
      if (y + it.h + nxt + grpNext > bot) { pages.push([]); y = topN + (inTable && !it.keep ? thead.h : 0); }
      if (it.keep) inTable = false;
      pages[pages.length - 1].push({ it, y, th: pages.length > 1 && pages[pages.length - 1].length === 0 && inTable }); y += it.h;
    });
    const dt = new Date().toLocaleDateString('ru-RU');
    return pages.map((pg, pi) => {
      const c = document.createElement('canvas'); c.width = PW; c.height = PH2; const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, PW, PH2); g.textBaseline = 'alphabetic';
      if (pi === 0) {
        g.fillStyle = '#0f172a'; g.textAlign = 'left'; g.font = `bold 48px ${FF}`; g.fillText('Калькуляция проекта', M, 170);
        g.font = `30px ${FF}`; g.fillStyle = '#334155'; g.fillText(wrap(doc.name || 'Без названия', `30px ${FF}`, W - 400)[0], M, 220);
        g.textAlign = 'right'; g.font = `24px ${FF}`; g.fillStyle = '#64748b'; g.fillText('Дата: ' + dt, M + W, 170); g.fillText('«' + APP_NAME + '» ' + APP_VERSION, M + W, 210);
        g.strokeStyle = '#0f172a'; g.lineWidth = 3; g.beginPath(); g.moveTo(M, 250); g.lineTo(M + W, 250); g.stroke();
        thead.draw(g, top1);
      } else {
        g.textAlign = 'left'; g.font = `22px ${FF}`; g.fillStyle = '#64748b'; g.fillText('Калькуляция проекта — ' + (doc.name || ''), M, 130);
        if (pg[0] && pg[0].th) thead.draw(g, topN);
      }
      for (const { it, y: yy } of pg) it.draw(g, yy);
      g.textAlign = 'right'; g.font = `21px ${FF}`; g.fillStyle = '#94a3b8'; g.fillText(`Стр. ${pi + 1} из ${pages.length}`, M + W, PH2 - 60);
      return c;
    });
  }
  function calcOpen() {
    if (!L) load(doc.led);
    const draw = () => {
      const { rows, scrRows, cs } = calcRows(), grps = [...new Set(rows.map(r => r.grp))];
      const body = grps.map(g => `<tr class="cgrp"><td colspan="3">${esc(g)}</td></tr>` + rows.filter(r => r.grp === g).map(r => { return `<tr><td>${esc(r.name)}${r.note ? `<div class="small muted">${esc(r.note)}</div>` : ''}</td><td class="num">${f2(r.qty)}</td><td>${r.unit}</td></tr>`; }).join('')).join('');
      const tot = scrRows.reduce((o, { S, C }) => { o.cab += S.cabs.length; o.px += C.pxT; o.area += C.area; o.kg += C.kg; o.wmax += C.wmax; o.wavg += avgOf(S, C); o.est ||= C.noAvg; C.phase.forEach((a, i) => o.ph[i] += a); return o; }, { cab: 0, px: 0, area: 0, kg: 0, wmax: 0, wavg: 0, ph: [0, 0, 0] });
      $l('#mBody').innerHTML = `
        <div class="lrow"><label>Запас кабинетов, %<input type="number" id="cSpare" min="0" value="${cs.spare}"></label><label>Кабель данных до экрана, м<input type="number" id="cLan" min="0" value="${cs.lanLen}"></label><label>Кабель питания до щита, м<input type="number" id="cPwr" min="0" value="${cs.pwrLen}"></label></div>
        <table class="ctbl"><thead><tr><th>Позиция</th><th style="text-align:right">Кол-во</th><th style="width:60px"></th></tr></thead><tbody>${body}</tbody></table>
        <h4 style="margin:14px 0 4px">Экраны</h4>
        <table class="ctbl"><thead><tr><th>Экран</th><th>Кабинетов</th><th>Разрешение</th><th>Размер, м</th><th>Вес, кг</th><th>Мощность макс / рабочая, кВт</th><th>Порты</th><th>Линии питания</th></tr></thead><tbody>
        ${scrRows.map(({ S, C }) => `<tr><td>${esc(S.name)}</td><td class="num">${S.cabs.length}</td><td>${C.b.w}×${C.b.h}</td><td>${f2(C.mmW / 1000)}×${f2(C.mmH / 1000)} (${f2(C.area)} м²)</td><td class="num">${fmt(C.kg)}</td><td>${f2(C.wmax / 1000)} / ${C.noAvg ? '≈' : ''}${f2(avgOf(S, C) / 1000)}</td><td>${C.ports.filter(p => p.n).length}${S.backup ? ' + рез.' : ''} · ${esc(S.ctrl.name.replace(/^NovaStar /, ''))}${(S.units || 1) > 1 ? ' ×' + S.units : ''} · ${fpsOf(S)} Гц</td><td>${C.pl.length} × ${S.pw.a} А</td></tr>`).join('')}
        </tbody><tfoot><tr><td><b>Всего</b></td><td class="num"><b>${tot.cab}</b></td><td>${fmt(tot.px)} px</td><td>${f2(tot.area)} м²</td><td class="num"><b>${fmt(tot.kg)}</b></td><td><b>${f2(tot.wmax / 1000)}</b> / ${tot.est ? '≈' : ''}${f2(tot.wavg / 1000)}</td><td colspan="2">ток макс ≈ ${tot.ph.map((a, i) => PH[i] + ' ' + f1(a) + ' А').join(' · ')}</td></tr></tfoot></table>
        <div class="lrow" style="margin-top:10px"><button class="pri" id="cPDF">Скачать PDF</button><button id="cPrint">🖨 Печать</button><button id="cCSV">CSV</button><span class="small muted">Вес и мощность типовых кабинетов — примерные, сверьте с паспортом.</span></div>`;
    };
    openModal('Калькуляция проекта — ' + (doc.name || ''), '');
    $l('#modal .mbox').classList.add('wide');
    draw();
    const mb = $l('#mBody');
    mb.onchange = ev => {
      const t = ev.target, cs = L.calc, id = t.id;
      if (id === 'cSpare') cs.spare = Math.max(0, +t.value || 0); else if (id === 'cLan') cs.lanLen = Math.max(0, +t.value || 0); else if (id === 'cPwr') cs.pwrLen = Math.max(0, +t.value || 0);
      else return;
      changed(); draw();
    };
    mb.onclick = ev => {
      if (ev.target.id === 'cPDF') { const pg = calcPages(); pagesToPDF(pg).then(b => download((doc.name || 'проект').replace(/[\\/:*?"<>|]+/g, '_') + ' — калькуляция.pdf', b)).catch(e => toast('Не удалось сделать PDF: ' + (e.message || e), 'e')); return; }
      if (ev.target.id === 'cPrint') return printPages(calcPages());
      if (ev.target.id !== 'cCSV') return;
      const { rows, scrRows } = calcRows();
      const out = [['Раздел', 'Позиция', 'Кол-во', 'Ед.', 'Примечание']];
      for (const r of rows) out.push([r.grp, r.name, r.qty, r.unit, r.note]);
      out.push([]);
      out.push(['Экран', 'Кабинетов', 'Разрешение', 'Размер, м', 'Площадь, м²', 'Вес, кг', 'Мощность макс, кВт', 'Мощность рабочая, кВт', 'Контроллер', 'Частота, Гц', 'Портов', 'Линий питания']);
      for (const { S, C } of scrRows) out.push([S.name, S.cabs.length, C.b.w + '×' + C.b.h, f2(C.mmW / 1000) + '×' + f2(C.mmH / 1000), f2(C.area), Math.round(C.kg), f2(C.wmax / 1000), (C.noAvg ? '≈' : '') + f2(avgOf(S, C) / 1000), S.ctrl.name + ((S.units || 1) > 1 ? ' ×' + S.units : ''), fpsOf(S), C.ports.filter(p => p.n).length, C.pl.length]);
      download((doc.name || 'проект').replace(/[\\/:*?"<>|]+/g, '_') + ' — калькуляция.csv', csv(out), 'text/csv');
    };
  }

  // ---------- порядок работы: 1 Экран → 2 Контроллер → 3 Прописка → 4 Питание → 5 Лист
  const stepOf = () => +cfg.ledStep || 1;
  function stepInfo(S, C) {
    const allD = S.cabs.length && !C.free.length, over = C.over.size, needP = C.ports.filter(p => p.n).length * (S.backup ? 2 : 1);
    const pw = new Set((S.pw.lines || []).flat()), allP = S.cabs.length && S.cabs.every(c => pw.has(c.id)), pwOver = C.pl.some(l => l.amp > S.pw.a);
    const ctrlOk = C.pxT <= ctrlCap(S) && needP <= nPorts(S);
    return [
      { k: 1, t: 'Экран', ok: S.cabs.length > 0, hint: 'Слева выберите кабинет из базы и задайте сетку — числом кабинетов или размером в метрах. Экран строится сразу.' },
      { k: 2, t: 'Контроллер', ok: ctrlOk, bad: !ctrlOk, hint: 'Справа выберите контроллер, частоту и глубину цвета. Программа подскажет, сколько кабинетов влезает на порт.' },
      { k: 3, t: 'Прописка', ok: allD && !over, bad: over > 0, hint: 'Выберите узор над схемой и обведите кабинеты рамкой — порт заполнится до предела, остальное само уйдёт в следующий порт. Перегрузить порт нельзя. Или «⚡ авто».' },
      { k: 4, t: 'Питание', ok: allP && !pwOver, bad: pwOver, hint: 'Так же обведите кабинеты в окне «Питание» — линия заполнится до предела автомата, остальное уйдёт в следующую. Или «⚡ авто».' },
      { k: 5, t: 'Лист', ok: false, hint: 'Проверьте лист и сохраните: картинка PNG / SVG, калькуляция, прописка для NovaLCT.' }];
  }
  function setStep(k) {
    cfg.ledStep = k; mode = { 1: 'sel', 2: 'sel', 3: 'quick', 4: 'quick', 5: 'sel' }[k]; cfg.ledTab = { 1: 'sum', 2: 'sig', 3: 'sig', 4: 'pwr', 5: 'sum' }[k];
    saveCfg(); render(); requestAnimationFrame(lFit);
  }
  function renderSteps(S, C) {
    const st = stepInfo(S, C), cur = stepOf(), s0 = st[cur - 1];
    const rc = recCtrlObj(S, C.ports.filter(p => p.n).length * (S.backup ? 2 : 1) || 1, C.pxT);
    const acts = {
      2: rc && (rc.c.id !== S.ctrl.id || rc.u !== (S.units || 1)) ? `<button data-sa="rec">Взять рекомендуемый: ${rc.u} × ${esc(rc.c.name.replace(/^NovaStar /, '').replace(/ \/ .*/, ''))}</button>` : '',
      3: `<button class="pri" data-act="dauto">⚡ Авто</button><button data-sa="clrD">Очистить прописку</button>`,
      4: `<button class="pri" data-act="pauto">⚡ Авто</button><button data-sa="clrP">Очистить питание</button>`,
      5: `<button data-sa="png">PNG</button><button data-sa="nlct">Для NovaLCT</button><button data-sa="calc">Калькуляция</button>` };
    $l('#ledSteps').innerHTML = `<div class="lsteps">${st.map(x => `<button class="lstep${x.k === cur ? ' cur' : ''}${x.ok ? ' ok' : ''}${x.bad ? ' bad' : ''}" data-step="${x.k}"><i>${x.ok ? '✓' : x.bad ? '!' : x.k}</i>${x.t}</button>`).join('<span class="lsarr">›</span>')}</div>
      <div class="lshint"><span>${esc(s0.hint)}</span><span class="lsacts">${acts[cur] || ''}${cur < 5 ? `<button class="pri" data-step="${cur + 1}">Далее →</button>` : ''}</span></div>`;
    $l('#ledStage').dataset.step = cur;
    $l('#ledWrap').classList.toggle('lfull', !!cfg.ledFull || cur === 5);
  }
  function resetDialog() {
    const S = scr();
    openModal('Сброс — ' + S.name, `<p class="muted">Что сбросить? Всё можно вернуть через Ctrl+Z.</p>
      <div class="lreset"><button data-rs="data">Очистить прописку портов</button><button data-rs="power">Очистить линии питания</button><button data-rs="both">Очистить прописку и питание</button><button data-rs="all" class="lbadb">Начать экран заново (8×4, настройки по умолчанию)</button></div>`);
    $l('#mBody').onclick = ev => {
      const k = ev.target.dataset && ev.target.dataset.rs; if (!k) return;
      lHist();
      if (k === 'data' || k === 'both') S.ports = [];
      if (k === 'power' || k === 'both') S.pw.lines = [];
      if (k === 'all') { const n = newScreen(S.name); n.id = S.id; L.screens[L.cur] = n; cfg.ledStep = 1; }
      act = 0; actW = 0; sel.clear(); closeModal(); changed(); lFit();
      toast(k === 'all' ? 'Экран начат заново' : 'Сброшено — Ctrl+Z вернёт');
    };
  }
  // прописка для NovaLCT: пошаговая карточка (Screen Connection) + координаты карт
  function exportNovaLCT(what = 'txt') {
    const S = scr(), C = calc(S), m = byId(S), b = bounds(S); if (!S.cabs.length) return toast('Экран пустой', 'w');
    const g = gridInfer(S), d0 = cabDef(S, g.t), uni = !g.custom;
    const cell = c => ({ col: Math.round((c.x - b.x) / d0.wpx) + 1, row: Math.round((c.y - b.y) / d0.hpx) + 1 });
    const card = i => { const per = S.ctrl.ports; return { card: Math.floor(i / per) + 1, port: i % per + 1 }; };
    const L0 = [], used = C.ports.filter(p => p.n);
    L0.push(`ПРОПИСКА ЭКРАНА ДЛЯ NovaLCT — ${S.name}`, `Проект: ${doc.name || '—'} · ${new Date().toLocaleDateString('ru-RU')} · сделано в «${APP_NAME}» ${APP_VERSION}`, '');
    L0.push(`Экран: ${C.b.w}×${C.b.h} px, ${S.cabs.length} каб.` + (uni ? `, сетка ${g.cols} столбцов × ${g.rows} рядов` : ' (неровный — см. таблицу координат)'));
    L0.push(`Кабинет (размер принимающей карты): ${d0.wpx}×${d0.hpx} px — ${d0.name}`);
    L0.push(`Приёмная карта: ${rcName(S) || 'не выбрана'}` + (C.rcs.some(r => r.st === 'over' || r.st === 'side' || r.compat) ? ' — ВНИМАНИЕ: есть замечания по карте, см. «Итог» в программе' : ''));
    L0.push(`Контроллер: ${S.units || 1} × ${S.ctrl.name}; ${fpsOf(S)} Гц; ${BITN[bitOf(S)]}; на порт до ${fmt(portCap(S))} px`);
    L0.push(`Начало изображения: X ${S.ox || 0}, Y ${S.oy || 0}`, '');
    L0.push('ШАГИ В NovaLCT:', '1. Войдите как Advanced (пароль admin) → Screen Configuration → выберите контроллер.');
    L0.push(`2. Вкладка Screen Connection → Screen Type: ${uni ? 'Standard Screen' : 'Complex Screen'}.`);
    if (uni) { L0.push(`3. Rows: ${g.rows}, Columns: ${g.cols}. Receiving Card Size: Width ${d0.wpx}, Height ${d0.hpx} (Apply to All).`); }
    L0.push(`${uni ? 4 : 3}. Для каждого порта ниже: выберите Sending Card и Port, затем щёлкайте ячейки в указанном порядке (Столбец·Ряд, нумерация слева направо и сверху вниз — вид СПЕРЕДИ).`);
    L0.push(`${uni ? 5 : 4}. Start Position X ${S.ox || 0}, Y ${S.oy || 0} → Send to HW → Save. Сохраните файл: Save to File (.scr).`, '');
    for (const p of used) {
      const cc = card(p.i), cabs = S.ports[p.i].map(id => m.get(id)).filter(Boolean);
      L0.push(`ПОРТ ${portName(S, p.i)}  (Sending Card ${cc.card}, Port ${cc.port}) — ${p.n} карт, ${fmt(p.px)} px (${Math.round(p.load * 100)} %)` + (S.backup && C.bmap.has(p.i) ? `; резерв: порт ${portName(S, C.bmap.get(p.i))}` : ''));
      L0.push('   ' + cabs.map(c => { const q = cell(c); return uni ? `С${q.col}·Р${q.row}` : `(${c.x + (S.ox || 0)},${c.y + (S.oy || 0)})`; }).join(' → '));
    }
    if (C.free.length) L0.push('', `ВНИМАНИЕ: не прописано ${C.free.length} каб.`);
    if (C.over.size) L0.push('', `ВНИМАНИЕ: перегружено ${C.over.size} каб. — уменьшите цепочки.`);
    L0.push('', 'Резерв в NovaLCT: Screen Configuration → Sending Card → Redundancy: основной порт → резервный порт (см. выше).');
    const base = (S.name || 'экран').replace(/[\\/:*?"<>|]+/g, '_');
    if (what === 'txt') return download(base + ' — прописка NovaLCT.txt', L0.join('\r\n'), 'text/plain');
    const rows = [['Порт', 'Sending Card', 'Port', '№ в цепочке', 'Столбец', 'Ряд', 'X, px', 'Y, px', 'Ширина, px', 'Высота, px', 'Кабинет']];
    for (const p of used) S.ports[p.i].forEach((id, k) => { const c = m.get(id); if (!c) return; const q = cell(c), cc = card(p.i), d = cabDef(S, c.t); rows.push([portName(S, p.i), cc.card, cc.port, k + 1, uni ? q.col : '', uni ? q.row : '', c.x + (S.ox || 0), c.y + (S.oy || 0), d.wpx, d.hpx, d.name]); });
    download(base + ' — карты NovaLCT.csv', csv(rows), 'text/csv');
  }
  // ---------- .scr: раскладка экрана для NovaLCT (Screen Connection → Load from File)
  function scrModel(S) {
    const C = calc(S), m = byId(S), b = bounds(S), err = [], warn = [];
    if (!S.cabs.length) err.push('Экран пустой.');
    if (C.free.length) err.push(`Не подключено к портам кабинетов: ${C.free.length}. В файле NovaLCT каждый кабинет должен стоять на порту — разведите данные («⚡ Развести автоматически» или вручную).`);
    if (S.ports.length > nPorts(S)) err.push(`Занято портов ${S.ports.length}, а у ${(S.units || 1) > 1 ? 'контроллеров' : 'контроллера'} их ${nPorts(S)}.`);
    const ox = S.ox || 0, oy = S.oy || 0;
    if (ox + b.w > 65535 || oy + b.h > 65535) err.push('Координаты больше 65 535 px — формат NovaLCT такие не хранит.');
    if (C.over.size) warn.push(`Порт перегружен (${C.over.size} каб. сверх нормы) — NovaLCT файл откроет, но контроллер такую нагрузку не потянет.`);
    if (cardsIn(S).some(x => x.n > 1)) warn.push('В части кабинетов по 2+ приёмные карты: в файле кабинет записан одной областью — в NovaLCT разделите его на карты вручную.');
    if (S.backup) warn.push('Резервные порты в .scr не пишутся — включите резерв в NovaLCT: Sending Card → Redundancy.');
    const pos = new Map(); S.ports.forEach((a, i) => a.forEach((id, k) => pos.set(id, { s: Math.floor(i / S.ctrl.ports), p: i % S.ctrl.ports, c: k })));
    if ([...pos.values()].some(q => q.s > 255 || q.p > 255)) err.push('Слишком много отправляющих карт для формата NovaLCT.');
    const reg = c => { const d = cabDef(S, c.t), q = pos.get(c.id) || { s: 0, p: 0, c: 0 }; return { ...q, x: ox + c.x - b.x, y: oy + c.y - b.y, w: d.wpx, h: d.hpx }; };
    // ровная сетка из одинаковых кабинетов без дыр — «Standard Screen»; иначе — «Complex Screen»
    const g = gridInfer(S), d0 = cabDef(S, g.t), cellOf = new Map();
    let std = !g.custom && S.cabs.length === g.cols * g.rows && S.cabs.every(c => c.t === g.t);
    if (std) for (const c of S.cabs) { const col = Math.round((c.x - b.x) / d0.wpx), row = Math.round((c.y - b.y) / d0.hpx), k = col + ',' + row; if (col * d0.wpx !== c.x - b.x || row * d0.hpx !== c.y - b.y || cellOf.has(k)) { std = false; break; } cellOf.set(k, c); }
    let scr;
    if (std) {
      const regions = []; for (let col = 0; col < g.cols; col++) for (let row = 0; row < g.rows; row++) regions.push({ ...reg(cellOf.get(col + ',' + row)), col, row });
      scr = { type: 'std', x: ox, y: oy, cols: g.cols, rows: g.rows, regions };
    } else {
      const regions = []; S.ports.forEach(a => a.forEach(id => { const c = m.get(id); if (c) regions.push({ ...reg(c), col: 0, row: 0 }); }));
      scr = { type: 'cpx', regions };
    }
    return { err, warn, scr, std, C };
  }
  function exportSCR(S) {
    const M = scrModel(S); if (M.err.length) return toast(M.err[0], 'w');
    download((S.name || 'экран').replace(/[\\/:*?"<>|]+/g, '_') + ' — NovaLCT.scr', new Blob([buildSCR([M.scr])], { type: 'application/octet-stream' }));
  }
  function novaDialog() {
    const S = scr(), M = scrModel(S), g = gridInfer(S), used = M.C.ports.filter(p => p.n).length;
    openModal('Экспорт в NovaLCT — ' + S.name, `
      <p style="margin-top:0"><b>Файл .scr</b> — готовая раскладка экрана: какие кабинеты на каком порту, порядок в цепочке, координаты. Открывается в NovaLCT и отправляется на контроллер.</p>
      <table class="ltbl" style="margin-bottom:8px">
        <tr><td>Тип экрана в NovaLCT</td><td><b>${M.std ? `Standard Screen, ${g.cols} × ${g.rows}` : 'Complex Screen (неровный или из разных кабинетов)'}</b></td></tr>
        <tr><td>Кабинетов · портов</td><td>${S.cabs.length} · ${used}${(S.units || 1) > 1 ? ` (${S.units} отправляющих карты)` : ''}</td></tr>
        <tr><td>Начало изображения</td><td>X ${S.ox || 0}, Y ${S.oy || 0}</td></tr></table>
      ${M.err.length ? `<div class="lwarn">${M.err.map(e => '⛔ ' + esc(e)).join('<br>')}</div>` : ''}
      ${M.warn.length ? `<div class="lwarn">${M.warn.map(e => '⚠ ' + esc(e)).join('<br>')}</div>` : ''}
      <div class="lrow" style="margin:10px 0"><button class="pri" id="nvScr"${M.err.length ? ' disabled' : ''}>Скачать .scr</button><button id="nvTxt">Инструкция .txt</button><button id="nvCsv">Координаты .csv</button></div>
      <div class="small muted"><b>Как открыть:</b> NovaLCT → войти как Advanced (пароль admin) → Screen Configuration → выбрать контроллер → вкладка <b>Screen Connection</b> → <b>Load from File</b> → выбрать .scr → проверить раскладку → <b>Send to HW</b> → <b>Save</b>.<br>
      Файл собран по формату NovaLCT (разбор открытой библиотеки novastar.js) и сверен байт в байт с файлом, сохранённым в NovaLCT. ${M.std ? '' : 'Complex Screen собран по той же схеме, но с образцом из NovaLCT ещё не сверялся — проверьте раскладку после загрузки.'} Настройки модулей (.rcfgx) в файл не входят — их даёт производитель кабинета.</div>`);
    $l('#nvScr').onclick = () => exportSCR(S);
    $l('#nvTxt').onclick = () => exportNovaLCT('txt');
    $l('#nvCsv').onclick = () => exportNovaLCT('csv');
  }

  // ---------- переключение разделов
  function setOn(v) {
    on = v; document.body.classList.toggle('secLed', v);
    document.querySelectorAll('[data-sec]').forEach(b => b.classList.toggle('on', (b.dataset.sec === 'led') === v));
    try { cfg.sec = v ? 'led' : 'video'; saveCfg(); } catch (e) { }
    if (v) { if (!L) load(doc.led); render(); requestAnimationFrame(lFit); }
  }
  async function init() {
    try { my = (await idb.get('ledLib')) || store.get('ledLib', null) || (await fromSignal('ledLib')) || my; } catch (e) { }
    my.cabs ||= []; my.ctrls ||= []; curCab = curCab || DEFCAB().id;
    split = cfg.ledSplit || null; if (cfg.ledQP) qp = { ...qp, ...cfg.ledQP };
    wire(); wireGridBox();
    document.querySelectorAll('[data-sec]').forEach(b => b.onclick = () => setOn(b.dataset.sec === 'led'));
  }
  return { init, load, setOn, key, calcOpen, sheetSVG: () => exportSheet(scr()), get on() { return on; }, render, fit: lFit, CABS, CTRLS, calc: () => calc(scr()), autoData: () => { autoData(scr()); changed(); }, scr };
})();
// проект: раздел LED хранится в doc.led и открывается вместе с файлом
{
  const _open = openDoc;
  openDoc = function (d, h) { const r = _open(d, h); try { if (doc) LED.load(doc.led); } catch (e) { console.warn(e); } return r; };
}
LED.init();
setTimeout(() => LED.setOn(true), 0);
