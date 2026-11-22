// ===================== ТИПЫ СИГНАЛОВ =====================
// fam — семейство (для проверки совместимости), pre — префикс номера кабеля
const T = {
  sdi12g: { n: '12G-SDI', s: 'SDI', fam: 'sdi', rate: 4, c: '#14532d', pre: 'V' },
  sdi6g:  { n: '6G-SDI',  s: 'SDI', fam: 'sdi', rate: 3, c: '#15803d', pre: 'V' },
  sdi3g:  { n: '3G-SDI',  s: 'SDI', fam: 'sdi', rate: 2, c: '#22c55e', pre: 'V' },
  sdihd:  { n: 'HD-SDI',  s: 'SDI', fam: 'sdi', rate: 1, c: '#86efac', pre: 'V' },
  hdmi:   { n: 'HDMI',    s: 'HDMI', fam: 'hdmi', c: '#0ea5e9', pre: 'H' },
  hdmi13: { n: 'HDMI 1.3', s: 'HDMI 1.3', fam: 'hdmi', rate: 1, c: '#93c5fd', pre: 'H' },
  hdmi14: { n: 'HDMI 1.4', s: 'HDMI 1.4', fam: 'hdmi', rate: 2, c: '#3b82f6', pre: 'H' },
  hdmi20: { n: 'HDMI 2.0', s: 'HDMI 2.0', fam: 'hdmi', rate: 3, c: '#1d4ed8', pre: 'H' },
  hdmi21: { n: 'HDMI 2.1', s: 'HDMI 2.1', fam: 'hdmi', rate: 4, c: '#172554', pre: 'H' },
  dp:     { n: 'DisplayPort', s: 'DP', fam: 'dp', c: '#a78bfa', pre: 'D' },
  dp11:   { n: 'DisplayPort 1.1', s: 'DP 1.1', fam: 'dp', rate: 1, c: '#c4b5fd', pre: 'D' },
  dp12:   { n: 'DisplayPort 1.2', s: 'DP 1.2', fam: 'dp', rate: 2, c: '#8b5cf6', pre: 'D' },
  dp14:   { n: 'DisplayPort 1.4', s: 'DP 1.4', fam: 'dp', rate: 3, c: '#6d28d9', pre: 'D' },
  dp21:   { n: 'DisplayPort 2.1', s: 'DP 2.1', fam: 'dp', rate: 4, c: '#3b0764', pre: 'D' },
  dvi:    { n: 'DVI',     s: 'DVI', fam: 'dvi', c: '#f9a8d4', pre: 'D' },
  vga:    { n: 'VGA (аналог)', s: 'VGA', fam: 'vga', c: '#94a3b8', pre: 'D' },
  hdbt:   { n: 'HDBaseT', s: 'HDBT', fam: 'hdbt', c: '#22d3ee', pre: 'T' },
  cvbs:   { n: 'CVBS (композит)', s: 'CVBS', fam: 'cvbs', c: '#bdb8b2', pre: 'V' },
  fiber:  { n: 'Оптика (видео)', s: 'FIB', fam: 'fiber', c: '#fdba74', pre: 'F' },
  fibmm:  { n: 'Оптика многомод (MM)', s: 'MM', fam: 'fiber', c: '#f97316', pre: 'F' },
  fibsm:  { n: 'Оптика одномод (SM)', s: 'SM', fam: 'fiber', c: '#c2410c', pre: 'F' },
  fibhyb: { n: 'Оптика комбинированная (гибрид, SMPTE)', s: 'HYB', fam: 'fiber', c: '#7c2d12', pre: 'F' },
  eth:    { n: 'LAN витая пара (UTP: NDI/IP/Dante)', s: 'LAN', fam: 'eth', c: '#f5c518', pre: 'N' },
  sfp:    { n: 'SFP+ 10/25G (ST 2110)', s: 'SFP', fam: 'eth', c: '#0f766e', pre: 'N' },
  ref:    { n: 'Genlock / Ref', s: 'REF', fam: 'ref', c: '#db2777', pre: 'R' },
  tc:     { n: 'Timecode LTC', s: 'TC', fam: 'tc', c: '#a16207', pre: 'R' },
  aud:    { n: 'Аудио аналог (XLR/Jack)', s: 'AUD', fam: 'aud', c: '#ef4444', pre: 'A' },
  aes:    { n: 'AES/EBU', s: 'AES', fam: 'aes', c: '#fca5a5', pre: 'A' },
  madi:   { n: 'MADI', s: 'MADI', fam: 'madi', c: '#9f1239', pre: 'A' },
  usb:    { n: 'USB', s: 'USB', fam: 'usb', c: '#78716c', pre: 'U' },
  exp:    { n: 'Expansion Port', s: 'EXP', fam: 'exp', c: '#0e7490', pre: 'X' },
  ctrl:   { n: 'RS-422/232 управление', s: 'RS', fam: 'ctrl', c: '#7c5a3c', pre: 'C' },
  gpio:   { n: 'GPIO / Tally', s: 'GPIO', fam: 'gpio', c: '#84cc16', pre: 'G' },
  pwr:    { n: 'Питание 220 В', s: 'PWR', fam: 'pwr', c: '#000000', pre: 'P' },
  dmx:    { n: 'DMX 512 (свет)', s: 'DMX', fam: 'dmx', c: '#c026d3', pre: 'L' },
  any:    { n: 'Любой (простая схема)', s: '', fam: 'any', c: '#52525b', pre: 'C' },
};
const TYPE_KEYS = Object.keys(T);

// Совместимость: 2 — ок, 1 — предупреждение, 0 — нужен конвертер
function compat(a, b) {
  if (a === b) return [2, ''];
  const A = T[a], B = T[b];
  if (!A || !B) return [0, 'Неизвестный тип'];
  if (A.fam === B.fam && (A.fam === 'sdi' || A.fam === 'hdmi' || A.fam === 'dp')) {
    if (!A.rate || !B.rate || A.rate <= B.rate) return [2, ''];
    return [1, A.fam === 'sdi' ? `${A.n} → вход ${B.n}: вход может не принять такой формат` : `${A.n} → вход ${B.n}: вход старше версии — разрешение/частота будут ниже`];
  }
  if (A.fam === 'any' || B.fam === 'any') return [2, ''];
  if (A.fam === 'fiber' && B.fam === 'fiber') {
    if (a === 'fibhyb' || b === 'fibhyb') return a === 'fiber' || b === 'fiber' ? [1, 'Гибридный кабель: проверьте разъём на втором конце'] : [0, 'Гибридный (камерный) кабель соединяется только с гибридным разъёмом'];
    if (a === 'fiber' || b === 'fiber') return [1, 'Оптика: проверьте тип волокна (одномод/многомод)'];
    return [0, 'Одномод ↔ многомод: волокна несовместимы, нужен конвертер'];
  }
  if (A.fam === B.fam) return [1, `${A.n} ↔ ${B.n}: проверьте скорость/модуль`];
  const pair = [A.fam, B.fam].sort().join('+');
  if (pair === 'dvi+hdmi') return [1, 'HDMI ↔ DVI: нужен пассивный переходник, звука не будет'];
  if (pair === 'dp+hdmi' && A.fam === 'dp') return [1, 'DP → HDMI: нужен переходник (DP++)'];
  return [0, `${A.n} → ${B.n}: нужен конвертер`];
}

// ===================== КАТЕГОРИИ =====================
const CATS = {
  cam:  { n: 'Камеры', pre: 'CAM', c: '#2563eb', ic: 'cam' },
  ccu:  { n: 'CCU / базовые станции', pre: 'CCU', c: '#1d4ed8', ic: 'rack' },
  sw:   { n: 'Видеомикшеры', pre: 'SW', c: '#7c3aed', ic: 'sw' },
  proc: { n: 'Презентационные процессоры', pre: 'PRC', c: '#6d28d9', ic: 'sw' },
  rt:   { n: 'Матрицы / роутеры', pre: 'RTR', c: '#9333ea', ic: 'grid' },
  conv: { n: 'Конвертеры', pre: 'CNV', c: '#0891b2', ic: 'conv' },
  da:   { n: 'Распределители / сплиттеры', pre: 'DA', c: '#0e7490', ic: 'da' },
  ext:  { n: 'Удлинители / оптика', pre: 'EXT', c: '#15803d', ic: 'ext' },
  mon:  { n: 'Мониторы / экраны / проекторы', pre: 'MON', c: '#334155', ic: 'mon' },
  mv:   { n: 'Мультивьюеры', pre: 'MV', c: '#475569', ic: 'mv' },
  led:  { n: 'LED-процессоры и экраны', pre: 'LED', c: '#db2777', ic: 'led' },
  rec:  { n: 'Запись / плейбек', pre: 'REC', c: '#b91c1c', ic: 'rec' },
  nb:   { n: 'Ноутбуки', pre: 'NB', c: '#1e293b', ic: 'nb' },
  pc:   { n: 'Компьютеры / медиасерверы', pre: 'PC', c: '#0f172a', ic: 'pc' },
  d3:   { n: 'Медиасерверы disguise (d3)', pre: 'D3', c: '#0b0b0f', ic: 'd3' },
  enc:  { n: 'Стриминг / NDI / энкодеры', pre: 'ENC', c: '#0d9488', ic: 'enc' },
  net:  { n: 'Сеть', pre: 'NET', c: '#115e59', ic: 'net' },
  sync: { n: 'Синхронизация', pre: 'SYNC', c: '#a16207', ic: 'sync' },
  aud:  { n: 'Звук', pre: 'AUD', c: '#be123c', ic: 'aud' },
  ctl:  { n: 'Управление / tally / интерком', pre: 'CTL', c: '#4d7c0f', ic: 'ctl' },
  light:{ n: 'Свет / DMX', pre: 'LT', c: '#7e22ce', ic: 'light' },
  power:{ n: 'Питание', pre: 'PWR', c: '#1f2937', ic: 'power' },
  per:  { n: 'Периферия / офис', pre: 'PER', c: '#64748b', ic: 'pc' },
  pp:   { n: 'Патч-панели / прочее', pre: 'PP', c: '#57534e', ic: 'pp' },
  shape:{ n: 'Фигуры', pre: '', c: '#475569', ic: 'shape' },
  my:   { n: 'Мои устройства', pre: 'DEV', c: '#0369a1', ic: 'star' },
};

// ===================== ИКОНКИ (16x16) =====================
const ICONS = {
  cam: 'M2 5h8v6H2zM10 7l4-2v6l-4-2z',
  rack: 'M2 3h12v4H2zM2 9h12v4H2zM4 5h2M4 11h2',
  sw: 'M1 4h14v8H1zM3 6h2v2H3zM6 6h2v2H6zM9 6h2v2H9zM3 9h8M12 6h2v4h-2z',
  grid: 'M2 2h12v12H2zM2 6h12M2 10h12M6 2v12M10 2v12',
  conv: 'M2 5h5v6H2zM9 5h5v6H9zM7 8h2M8 7l1 1-1 1',
  da: 'M2 7h4M6 8l7-5M6 8h7M6 8l7 5M2 9h4',
  ext: 'M1 8h4M11 8h4M5 6h6v4H5zM7 8h2',
  mon: 'M1 3h14v8H1zM6 14h4M8 11v3',
  mv: 'M1 3h14v9H1zM1 7.5h14M8 3v9',
  led: 'M1 3h14v9H1zM3 5h1M6 5h1M9 5h1M12 5h1M3 8h1M6 8h1M9 8h1M12 8h1M6 14h4',
  rec: 'M1 4h14v8H1zM5 6.5a1.5 1.5 0 1 0 0.01 0M9 7h4M9 9h4',
  pc: 'M2 3h12v8H2zM1 13h14M5 11v2M11 11v2',
  nb: 'M3 3h10v7H3zM1 12h14l-1 2H2z',
  d3: 'M2 2h12v12H2zM5 5h6v6H5zM2 8h3M11 8h3',
  enc: 'M3 9a5 5 0 0 1 10 0M5.5 9a2.5 2.5 0 0 1 5 0M8 9v5',
  net: 'M1 5h14v6H1zM3 7h2v2H3zM6 7h2v2H6zM9 7h2v2H9zM12 7h1v2h-1z',
  sync: 'M8 2a6 6 0 1 0 0.01 0M8 4v4l3 2',
  aud: 'M2 6h3l4-3v10l-4-3H2zM11 5a4 4 0 0 1 0 6M13 3a7 7 0 0 1 0 10',
  ctl: 'M3 2h10v12H3zM6 5a2 2 0 1 0 0.01 0M5 10h6M5 12h6',
  pp: 'M1 5h14v6H1zM3 8a1 1 0 1 0 0.01 0M6 8a1 1 0 1 0 0.01 0M9 8a1 1 0 1 0 0.01 0M12 8a1 1 0 1 0 0.01 0',
  light: 'M5 2h6l-1 6H6zM8 8v3M5 14h6M6 11h4',
  power: 'M9 1L3 9h5l-1 6 6-8H8z',
  shape: 'M2 3h7v7H2zM11.5 9a3 3 0 1 0 .01 0',
  star: 'M8 1.5l2 4.3 4.6.5-3.4 3.1 1 4.6L8 11.7 3.8 14l1-4.6L1.4 6.3 6 5.8z',
};

// ===================== БАЗА УСТРОЙСТВ =====================
// Формат портов: "тип[*кол-во][:Имя]" через запятую. Конфигурации типовые —
// перед проектом сверяйтесь с паспортом устройства (любое можно отредактировать).
const RAW = [
  // --- Камеры
  ['cam', 'Generic', 'Камера SDI', 'ref,sdi3g:Return', 'sdi3g*2'],
  ['cam', 'Generic', 'Камера HDMI', '', 'hdmi'],
  ['cam', 'Generic', 'PTZ-камера NDI', 'eth:LAN/NDI/PoE', 'sdi3g,hdmi'],
  ['cam', 'Sony', 'HDC-3500 (головка)', 'fiber:SMPTE fiber', 'sdi3g:Prompter/Return'],
  ['cam', 'Sony', 'FX6', 'tc:TC IN', 'sdi12g,hdmi'],
  ['cam', 'Sony', 'FX9', 'ref,tc:TC IN', 'sdi12g,sdi3g,hdmi'],
  ['cam', 'Sony', 'FR7 (PTZ)', 'ref,eth:LAN', 'sdi12g,sdi3g,hdmi,fiber:Optical'],
  ['cam', 'Blackmagic', 'URSA Broadcast G2', 'sdi12g:PGM Return,ref,aud*2:XLR', 'sdi12g,sdi3g:Monitor'],
  ['cam', 'Blackmagic', 'Studio Camera 4K Pro G2', 'sdi12g:PGM Return,aud*2:XLR,eth:LAN', 'sdi12g,hdmi'],
  ['cam', 'Blackmagic', 'Pocket Cinema 6K', 'aud:Mini XLR', 'hdmi'],
  ['cam', 'Panasonic', 'AW-UE150', 'ref,eth:LAN/PoE+', 'sdi12g,sdi3g,hdmi,fiber:Optical'],
  ['cam', 'Panasonic', 'AW-UE100', 'ref,eth:LAN/NDI', 'sdi12g,hdmi'],
  ['cam', 'Panasonic', 'AG-CX350', 'tc', 'sdi3g,hdmi'],
  ['cam', 'Canon', 'CR-N500', 'eth:LAN/NDI', 'sdi3g,hdmi'],
  ['cam', 'Canon', 'XF605', 'tc', 'sdi12g,hdmi'],
  ['cam', 'BirdDog', 'P400', 'eth:LAN/NDI/PoE', 'sdi3g,hdmi'],
  ['cam', 'Marshall', 'CV568 (POV)', '', 'sdi3g,hdmi'],
  ['cam', 'GoPro', 'HERO (HDMI)', '', 'hdmi:Media Mod'],
  // --- CCU
  ['ccu', 'Sony', 'HDCU-3500', 'fiber:Camera,ref,sdi3g:Return*1', 'sdi12g*4,eth:LAN'],
  ['ccu', 'Blackmagic', 'URSA Studio Fiber Converter', 'fiber:SMPTE,ref', 'sdi12g*2'],
  ['ccu', 'Blackmagic', 'Studio Fiber Converter', 'fiber:SMPTE,sdi12g:Return,ref', 'sdi12g*2'],
  // --- Видеомикшеры
  ['sw', 'Blackmagic', 'ATEM Mini Pro', 'hdmi*4,aud*2:Mic 3.5', 'hdmi:Out,usb:Webcam,eth:LAN'],
  ['sw', 'Blackmagic', 'ATEM Mini Extreme ISO', 'hdmi*8,aud*2:Mic 3.5', 'hdmi*2:Out,usb*2,eth:LAN'],
  ['sw', 'Blackmagic', 'ATEM SDI Extreme ISO', 'sdi3g*4,hdmi*4', 'sdi3g:PGM,sdi3g*2:AUX,hdmi:MV,usb,eth:LAN'],
  ['sw', 'Blackmagic', 'ATEM Television Studio HD8 ISO', 'sdi3g*8,ref,aud*2:XLR', 'sdi3g:PGM,sdi3g*3:AUX,hdmi:MV,eth:LAN'],
  ['sw', 'Blackmagic', 'ATEM Television Studio 4K8', 'sdi12g*8,ref,aud*2:XLR', 'sdi12g:PGM,sdi12g*3:AUX,hdmi:MV,eth:LAN'],
  ['sw', 'Blackmagic', 'ATEM 1 M/E Constellation 4K', 'sdi12g*10,ref', 'sdi12g*6:AUX,sdi12g:MV SDI,hdmi:MV HDMI,eth:LAN'],
  ['sw', 'Blackmagic', 'ATEM 2 M/E Constellation 4K', 'sdi12g*20,ref', 'sdi12g*12:AUX,sdi12g*2:MV,eth:LAN'],
  ['sw', 'Blackmagic', 'ATEM 4 M/E Constellation 4K', 'sdi12g*40,ref', 'sdi12g*24:AUX,sdi12g*4:MV,eth:LAN'],
  ['sw', 'Roland', 'V-160HD', 'sdi3g*8,hdmi*8,aud*4:XLR', 'sdi3g*3,hdmi*3,usb,eth:LAN'],
  ['sw', 'Roland', 'V-8HD', 'hdmi*8', 'hdmi*3'],
  ['sw', 'Roland', 'V-1HD+', 'hdmi*4', 'hdmi*2'],
  ['sw', 'Ross', 'Carbonite Ultra 1M/E', 'sdi3g*24,ref', 'sdi3g*12:AUX,sdi3g*2:MV,eth:LAN'],
  ['sw', 'Ross', 'Carbonite Black 2M/E', 'sdi3g*36,ref', 'sdi3g*18:AUX,sdi3g*4:MV,eth:LAN'],
  ['sw', 'Sony', 'XVS-G1', 'sdi12g*24,ref', 'sdi12g*12,eth:LAN'],
  ['sw', 'Datavideo', 'SE-1200MU', 'sdi3g*4,hdmi*2', 'sdi3g*2,hdmi*2'],
  ['sw', 'NewTek', 'TriCaster Mini 4K', 'hdmi*4,eth:NDI', 'hdmi*2,eth:LAN'],
  ['sw', 'Generic', 'vMix ПК + DeckLink Quad 2', 'sdi3g*6,eth:NDI/LAN', 'sdi3g*2:Out,hdmi:GUI HDMI,dp:GUI DP'],
  ['sw', 'Generic', 'OBS ПК (захват HDMI)', 'hdmi*2:Capture,eth:LAN', 'hdmi:GUI HDMI,dp:GUI DP'],
  // --- Презентационные процессоры
  ['proc', 'Barco', 'E2 Gen 2 (Event Master, типовая конф.)', 'hdmi*8:HDMI 2.0,dp*4:DP 1.2,sdi12g*8:12G-SDI,ref:Genlock', 'hdmi*8:HDMI Out,sdi12g*4:SDI Out,dp:DP Out,hdmi*4:MVR,ref:Genlock Loop,eth:LAN', 'exp*4:Expansion Link CXP'],
  ['proc', 'Barco', 'Event Master Ex (Tri-combo)', 'hdmi:HDMI 2.0,dp:DP 1.2,sdi12g*2:12G-SDI,ref:Genlock', 'hdmi:HDMI 2.0 Out,dp:DP Out,sdi12g*2:12G-SDI Out,eth:LAN', 'exp*2:Expansion Link'],
  ['proc', 'Barco', 'Event Master Ex (пустой, 2 слота)', 'ref:Genlock', 'eth:LAN', 'exp*2:Expansion Link'],
  ['proc', 'Barco', 'ImagePRO-4K', 'hdmi:HDMI 2.0,dp:DP 1.2,sdi12g*2,ref', 'hdmi:HDMI 2.0 Out,dp:DP Out,sdi12g*2:SDI Out,eth:LAN'],
  ['proc', 'PixelHue', 'Q8 (2 вх. + 2 вых. карты, типовая)', 'hdmi*8:HDMI 2.0,dp*8:DP 1.2,sdi12g*8:12G-SDI,ref:Genlock', 'hdmi*8:HDMI Out,sdi12g*4:SDI Out,fiber*4:OPT,hdmi*2:MVR,eth:LAN,eth:Dante'],
  ['proc', 'PixelHue', 'P20', 'hdmi*8:HDMI/DP,sdi12g*4:12G-SDI', 'hdmi*8:HDMI 2.0 Out,hdmi:MVR,eth:LAN'],
  ['proc', 'PixelHue', 'P10', 'hdmi*4:HDMI/DP', 'hdmi*2:HDMI 2.0 Out,hdmi*6:HDMI 1.3 Out,eth:LAN'],
  ['proc', 'Magnimage', 'LED-550D (550DS с SDI)', 'cvbs*2:AV,vga*2,dvi,hdmi,dp,sdi3g:SDI', 'dvi*2:DVI Out,vga:VGA Out,dvi:DVI Loop,sdi3g:SDI Loop,eth:LAN'],
  ['proc', 'Magnimage', 'LED-W4000', 'sdi3g:SDI,hdmi*3,dvi*4,dp*4', 'dvi*4:DVI A,hdmi*2:HDMI A,dvi*4:DVI B (резерв),hdmi*2:HDMI B (резерв),eth:LAN'],
  ['proc', 'Datapath', 'Fx4', 'dp:DP 1.2,hdmi:HDMI 2.0', 'hdmi*4:Out,eth:LAN'],
  ['proc', 'Barco', 'S3-4K', 'sdi12g*4,hdmi*4,dp*4', 'hdmi*4:HDMI Out,sdi12g*2:SDI Out,eth:LAN', 'exp*2:Expansion Link CXP'],
  ['proc', 'Analog Way', 'Aquilon RS2 (типовая конф.)', 'sdi12g*8,hdmi*8', 'hdmi*8:Out,eth:LAN'],
  ['proc', 'Analog Way', 'Pulse 4K', 'hdmi*4,dp*2,sdi12g*2', 'hdmi*2:Out,sdi12g:Out,eth:LAN'],
  ['proc', 'Analog Way', 'Picturall Pro', 'hdmi*2', 'dp*8:Out,eth:LAN'],
  ['proc', 'Novastar', 'VX1000 (all-in-one)', 'hdmi*2,dvi*2,sdi3g*2', 'eth*10:Port,hdmi:Monitor,eth:LAN'],
  // --- Матрицы
  ['rt', 'Blackmagic', 'Smart Videohub 12G 40x40', 'sdi12g*40,ref', 'sdi12g*40,eth:LAN'],
  ['rt', 'Blackmagic', 'Videohub 12G 20x20', 'sdi12g*20,ref', 'sdi12g*20,eth:LAN'],
  ['rt', 'Blackmagic', 'Smart Videohub 12G 12x12', 'sdi12g*12,ref', 'sdi12g*12,eth:LAN'],
  ['rt', 'Blackmagic', 'Videohub 10x10 12G', 'sdi12g*10,ref', 'sdi12g*10,eth:LAN'],
  ['rt', 'AJA', 'KUMO 3232-12G', 'sdi12g*32,ref', 'sdi12g*32,eth:LAN'],
  ['rt', 'AJA', 'KUMO 1616-12G', 'sdi12g*16,ref', 'sdi12g*16,eth:LAN'],
  ['rt', 'Generic', 'HDMI матрица 8x8', 'hdmi*8,ctrl', 'hdmi*8,eth:LAN'],
  ['rt', 'Generic', 'HDMI матрица 4x4', 'hdmi*4', 'hdmi*4'],
  ['rt', 'Lightware', 'MX2-8x8-HDMI20', 'hdmi*8', 'hdmi*8,eth:LAN'],
  // --- Lightware: MX2 HDMI 2.0
  ['rt', 'Lightware', 'MX2-4x4-HDMI20-CA', 'hdmi*4:HDMI In', 'hdmi*4:HDMI Out', 'eth:LAN,ctrl:RS-232'],
  ['rt', 'Lightware', 'MX2-16x16-HDMI20', 'hdmi*16:HDMI In', 'hdmi*16:HDMI Out', 'eth:LAN'],
  ['rt', 'Lightware', 'MX2-16x16-HDMI20-Audio(-R)', 'hdmi*16:HDMI In,aud*4:Audio In', 'hdmi*16:HDMI Out,aud*8:Audio Out', 'eth:LAN'],
  ['rt', 'Lightware', 'MX2-24x24-HDMI20', 'hdmi*24:HDMI In', 'hdmi*24:HDMI Out', 'eth:LAN'],
  ['rt', 'Lightware', 'MX2-24x24-HDMI20-Audio(-R)', 'hdmi*24:HDMI In,aud*8:Audio In', 'hdmi*24:HDMI Out,aud*8:Audio Out', 'eth:LAN'],
  ['rt', 'Lightware', 'MX2-32x32-HDMI20-A-R', 'hdmi*32:HDMI In,aud*16:Audio In', 'hdmi*32:HDMI Out,aud*16:Audio Out', 'eth:LAN'],
  ['rt', 'Lightware', 'MX2-48x48-HDMI20-A-R', 'hdmi*48:HDMI In,aud*16:Audio In', 'hdmi*48:HDMI Out,aud*16:Audio Out', 'eth:LAN'],
  // --- Lightware: MX2 DH (HDMI + DisplayPort)
  ['rt', 'Lightware', 'MX2-8x8-DH-4DPi-A', 'hdmi*4:HDMI In,dp*4:DP In', 'hdmi*8:HDMI Out,aud*2:Audio Out', 'eth:LAN'],
  ['rt', 'Lightware', 'MX2-8x8-DH-8DPi-A', 'dp*8:DP In,aud*4:Audio In', 'hdmi*8:HDMI Out,aud*4:Audio Out', 'eth:LAN'],
  ['rt', 'Lightware', 'MX2-16x16-DH-8DPi-A-R', 'hdmi*8:HDMI In,dp*8:DP In,aud*8:Audio In', 'hdmi*16:HDMI Out,aud*8:Audio Out', 'eth:LAN'],
  ['rt', 'Lightware', 'MX2-24x24-DH-12DPi-A-R', 'hdmi*12:HDMI In,dp*12:DP In,aud*12:Audio In', 'hdmi*24:HDMI Out,aud*8:Audio Out', 'eth:LAN'],
  ['rt', 'Lightware', 'MX2-32x32-DH-16DPi-A-R', 'hdmi*16:HDMI In,dp*16:DP In,aud*12:Audio In', 'hdmi*32:HDMI Out,aud*16:Audio Out', 'eth:LAN'],
  ['rt', 'Lightware', 'MX2-48x48-DH-24DPio-A-R', 'hdmi*24:HDMI In,dp*24:DP In,aud*16:Audio In', 'hdmi*24:HDMI Out,dp*24:DP Out,aud*32:Audio Out', 'eth:LAN'],
  // --- Lightware: MX2 DisplayPort
  ['rt', 'Lightware', 'MX2-8x8-DH-8DPio-A (DP 1.2 8×8)', 'dp*8:DP In,aud*4:Audio In', 'dp*8:DP Out,aud*8:Audio Out', 'eth:LAN'],
  ['rt', 'Lightware', 'MX2-24x24-DH-24DPio-A-R (DP 24×24)', 'dp*24:DP In,aud*8:Audio In', 'dp*24:DP Out,aud*24:Audio Out', 'eth:LAN'],
  ['rt', 'Lightware', 'MX2-48x48-DH-48DPio-A-R (DP 48×48)', 'dp*48:DP In,aud*16:Audio In', 'dp*48:DP Out,aud*48:Audio Out', 'eth:LAN'],
  // --- Lightware: MMX (переговорные, HDMI + HDBaseT/TPS)
  ['rt', 'Lightware', 'MMX8x4-HT420M', 'hdmi*4:HDMI In,hdbt*4:TPS In,aud:Mic In,aud:Line In', 'hdmi*2:HDMI Out,hdbt*2:TPS Out,aud*2:Audio Out', 'eth:LAN,ctrl:RS-232'],
  ['rt', 'Lightware', 'MMX8x4-HT400MC', 'hdmi*4:HDMI In,hdbt*4:TPS In,aud:Mic In', 'hdmi*4:HDMI Out', 'eth:LAN'],
  ['rt', 'Lightware', 'MMX8x8-HDMI-4K-A', 'hdmi*8:HDMI In', 'hdmi*8:HDMI Out,aud*6:Audio (вх/вых)', 'eth:LAN'],
  ['rt', 'Lightware', 'MMX8x8-HT080', 'hdmi*8:HDMI In,aud:Audio In', 'hdbt*8:TPS Out,aud:Audio Out', 'eth:LAN'],
  ['rt', 'Lightware', 'MMX8x8-HT440', 'hdmi*4:HDMI In,hdbt*4:TPS In', 'hdmi*4:HDMI Out,hdbt*4:TPS Out', 'eth:LAN'],
  // --- Lightware: Taurus UCX (USB-C)
  ['rt', 'Lightware', 'Taurus UCX-2x1-HC40', 'hdmi:HDMI In,usb:USB-C In (видео+данные)', 'hdmi:HDMI Out', 'eth:LAN,usb:USB Host'],
  ['rt', 'Lightware', 'Taurus UCX-2x2-H40', 'hdmi*2:HDMI In', 'hdmi*2:HDMI Out', 'eth:LAN,usb*2:USB Host'],
  ['rt', 'Lightware', 'Taurus UCX-4x2-HC40', 'hdmi*2:HDMI In,usb*2:USB-C In (видео+данные)', 'hdmi*2:HDMI Out', 'eth:LAN,usb*2:USB Host'],
  ['rt', 'Lightware', 'Taurus UCX-4x2-HC40D (Dante)', 'hdmi*2:HDMI In,usb*2:USB-C In (видео+данные)', 'hdmi*2:HDMI Out,aud*2:Audio Out', 'eth:LAN,eth:Dante'],
  // --- Lightware: модульные рамы MX-FR (порты зависят от плат — типовая конфигурация)
  ['rt', 'Lightware', 'MX-FR9 (модульная, типовая)', 'hdmi*8:HDMI In', 'hdmi*8:HDMI Out', 'eth:LAN'],
  ['rt', 'Lightware', 'MX-FR17 (модульная, типовая)', 'hdmi*16:HDMI In', 'hdmi*16:HDMI Out', 'eth:LAN'],
  ['rt', 'Lightware', 'MX-FR33L/R (модульная, типовая)', 'hdmi*32:HDMI In', 'hdmi*32:HDMI Out', 'eth:LAN'],
  ['rt', 'Lightware', 'MX-FR65R (модульная, типовая)', 'hdmi*64:HDMI In', 'hdmi*64:HDMI Out', 'eth:LAN'],
  ['rt', 'Lightware', 'MX-FR80R (модульная, типовая)', 'hdmi*80:HDMI In', 'hdmi*80:HDMI Out', 'eth:LAN'],
  // --- Конвертеры
  ['conv', 'Blackmagic', 'Micro Converter SDI→HDMI 12G', 'sdi12g', 'sdi12g:Loop,hdmi'],
  ['conv', 'Blackmagic', 'Micro Converter HDMI→SDI 12G', 'hdmi', 'sdi12g*2'],
  ['conv', 'Blackmagic', 'Micro Converter SDI→HDMI 3G', 'sdi3g', 'sdi3g:Loop,hdmi'],
  ['conv', 'Blackmagic', 'Micro Converter HDMI→SDI 3G', 'hdmi', 'sdi3g*2'],
  ['conv', 'Blackmagic', 'Teranex Mini SDI→HDMI 12G', 'sdi12g', 'sdi12g:Loop,hdmi,aud*2:Analog'],
  ['conv', 'Blackmagic', 'Teranex Mini HDMI→SDI 12G', 'hdmi,aud*2:Analog', 'sdi12g'],
  ['conv', 'Blackmagic', 'Teranex AV (кросс-конвертер)', 'sdi12g,hdmi,ref,aud*2', 'sdi12g*2,hdmi'],
  ['conv', 'Blackmagic', 'Mini Converter Audio→SDI', 'sdi3g,aes*2,aud*2', 'sdi3g'],
  ['conv', 'Blackmagic', 'Mini Converter SDI→Audio', 'sdi3g', 'sdi3g:Loop,aes*2,aud*2'],
  ['conv', 'Blackmagic', 'Mini Converter UpDownCross HD', 'sdi3g,hdmi', 'sdi3g*2,hdmi'],
  ['conv', 'Decimator', 'MD-HX (кросс-конвертер)', 'sdi3g,hdmi', 'sdi3g*2,hdmi'],
  ['conv', 'Decimator', 'MD-LX', 'sdi3g,hdmi', 'sdi3g,hdmi'],
  ['conv', 'AJA', 'Hi5-12G (SDI→HDMI)', 'sdi12g', 'hdmi'],
  ['conv', 'AJA', 'HA5-12G (HDMI→SDI)', 'hdmi', 'sdi12g*2'],
  ['conv', 'Generic', 'DP → HDMI переходник', 'dp', 'hdmi'],
  ['conv', 'Generic', 'HDMI → DVI переходник', 'hdmi', 'dvi'],
  ['conv', 'Generic', 'Скалер HDMI→SDI', 'hdmi', 'sdi3g'],
  ['conv', 'Generic', 'Скалер SDI→HDMI', 'sdi3g', 'hdmi'],
  ['conv', 'Generic', 'CVBS→SDI конвертер', 'cvbs', 'sdi3g'],
  ['conv', 'Generic', 'HDMI → DP конвертер', 'hdmi', 'dp'],
  ['conv', 'Generic', 'VGA → HDMI скалер', 'vga,aud:Audio In', 'hdmi'],
  ['conv', 'Generic', 'HDMI → VGA конвертер', 'hdmi', 'vga,aud:Audio Out'],
  ['conv', 'Generic', 'Эмулятор EDID HDMI', 'hdmi', 'hdmi'],
  // --- DA
  ['da', 'Blackmagic', 'Mini Converter SDI Distribution 4K', 'sdi12g', 'sdi12g*8'],
  ['da', 'Blackmagic', 'Mini Converter SDI Distribution 3G', 'sdi3g', 'sdi3g*8'],
  ['da', 'Generic', 'HDMI сплиттер 1x2', 'hdmi', 'hdmi*2'],
  ['da', 'Generic', 'HDMI сплиттер 1x4', 'hdmi', 'hdmi*4'],
  ['da', 'Generic', 'HDMI сплиттер 1x8', 'hdmi', 'hdmi*8'],
  ['da', 'Generic', 'HDMI 2.0 сплиттер 1x4 (4K60)', 'hdmi:HDMI 2.0', 'hdmi*4:HDMI 2.0'],
  ['da', 'Generic', 'DP MST хаб 1x3', 'dp', 'dp*3'],
  ['da', 'Generic', 'SDI DA 1x4', 'sdi3g', 'sdi3g*4'],
  ['da', 'Generic', 'Genlock DA 1x6', 'ref', 'ref*6'],
  // --- Удлинители
  ['ext', 'Generic', 'HDBaseT TX', 'hdmi', 'hdbt,hdmi:Loop'],
  ['ext', 'Generic', 'HDBaseT RX', 'hdbt', 'hdmi'],
  ['ext', 'Generic', 'HDMI по оптике TX', 'hdmi', 'fiber'],
  ['ext', 'Generic', 'HDMI по оптике RX', 'fiber', 'hdmi'],
  ['ext', 'Blackmagic', 'Mini Converter Optical Fiber 12G', 'sdi12g:SDI In,fiber:Fiber In', 'sdi12g*2:SDI Out,fiber:Fiber Out'],
  ['ext', 'AJA', 'FiDO-T-12G (SDI→оптика)', 'sdi12g', 'fiber'],
  ['ext', 'AJA', 'FiDO-R-12G (оптика→SDI)', 'fiber', 'sdi12g*2'],
  ['ext', 'Generic', 'Оптический кросс 12 портов', 'fiber*12', 'fiber*12'],
  ['ext', 'Generic', 'HDMI 2.0 4K по оптике TX', 'hdmi:HDMI 2.0', 'fiber,hdmi:Loop'],
  ['ext', 'Generic', 'HDMI 2.0 4K по оптике RX', 'fiber', 'hdmi:HDMI 2.0'],
  ['ext', 'Generic', 'KVM-удлинитель TX (HDMI+USB)', 'hdmi,usb', 'hdbt:HDBaseT/LAN'],
  ['ext', 'Generic', 'KVM-удлинитель RX (HDMI+USB)', 'hdbt:HDBaseT/LAN', 'hdmi,usb'],
  ['ext', 'Generic', 'DP по оптике TX', 'dp', 'fiber'],
  ['ext', 'Generic', 'DP по оптике RX', 'fiber', 'dp'],
  // --- Мониторы
  ['mon', 'Generic', 'Монитор SDI', 'sdi3g', 'sdi3g:Loop'],
  ['mon', 'Generic', 'Телевизор / монитор HDMI', 'hdmi', ''],
  ['mon', 'Generic', 'Монитор ПК (DP/HDMI)', 'dp,hdmi', ''],
  ['mon', 'Generic', 'Проектор', 'hdmi,hdbt', ''],
  ['mon', 'Generic', 'Суфлёр (HDMI/SDI)', 'hdmi,sdi3g', ''],
  ['mon', 'Blackmagic', 'SmartView 4K G2', 'sdi12g*2', 'sdi12g:Loop,eth:LAN'],
  ['mon', 'Blackmagic', 'SmartView HD', 'sdi3g', 'sdi3g:Loop'],
  ['mon', 'Sony', 'PVM-X2400', 'sdi12g*4,hdmi', 'sdi12g*2:Loop'],
  ['mon', 'Atomos', 'Shinobi SDI', 'sdi3g,hdmi', 'sdi3g:Loop'],
  ['mon', 'Lilliput', 'Q17 (12G)', 'sdi12g,hdmi', 'sdi12g:Loop'],
  // --- Мультивьюеры
  ['mv', 'Blackmagic', 'MultiView 16', 'sdi6g*16', 'sdi6g*2,hdmi'],
  ['mv', 'Blackmagic', 'MultiView 4 HD', 'sdi3g*4', 'sdi3g:Out,hdmi'],
  ['mv', 'Decimator', 'DMON-QUAD', 'sdi3g*4', 'sdi3g*2,hdmi'],
  ['mv', 'Generic', 'HDMI мультивьюер 4x1', 'hdmi*4', 'hdmi'],
  // --- LED
  ['led', 'Novastar', 'MCTRL4K', 'hdmi:HDMI 2.0,dp:DP 1.2,dvi', 'eth*16:Port,fiber*2:OPT,hdmi:Loop'],
  ['led', 'Novastar', 'MCTRL660 Pro', 'hdmi,dvi,sdi3g', 'eth*6:Port,fiber*2:OPT'],
  ['led', 'Novastar', 'MCTRL R5', 'hdmi,dp,sdi12g', 'eth*8:Port,fiber*2:OPT'],
  ['led', 'Novastar', 'VX600', 'hdmi*2,dvi,sdi3g', 'eth*6:Port,hdmi:Monitor'],
  ['led', 'Novastar', 'CVT10 (оптика↔медь)', 'fiber*2:OPT', 'eth*10:Port'],
  ['led', 'Novastar', 'MX40 Pro', 'hdmi*2:HDMI 2.0,dp:DP 1.2,sdi12g:12G-SDI,ref:Genlock', 'eth*20:Port,fiber*4:10G OPT,sdi12g:SDI Loop,eth:LAN'],
  ['led', 'Novastar', 'H5 (типовая конф.)', 'hdmi*4:HDMI 2.0,dvi*4,sdi3g*2', 'eth*16:Port,hdmi*2:Monitor,eth:LAN'],
  ['led', 'Novastar', 'VX400', 'hdmi,dvi,sdi3g', 'eth*4:Port,hdmi:Monitor,usb:USB'],
  ['led', 'Novastar', 'VX16s', 'hdmi*2:HDMI 1.3,hdmi:HDMI 2.0,dp,dvi*2,sdi3g', 'eth*16:Port,fiber*2:OPT,hdmi:Monitor,eth:LAN'],
  ['led', 'Novastar', 'TB60 (медиаплеер)', 'hdmi,usb', 'eth*2:Port,eth:LAN'],
  ['led', 'Generic', 'LED-экран (вход по оптике)', 'fiber*2:OPT', ''],
  ['led', 'Generic', 'Резервный канал экрана (Backup)', 'eth*4:Backup In', ''],
  ['led', 'Brompton', 'Tessera SX40', 'hdmi:HDMI 2.0,sdi12g*2,ref', 'sfp*4:10G Trunk,eth:LAN'],
  ['led', 'Brompton', 'Tessera XD 10G', 'sfp:10G Trunk', 'eth*10:Port,sfp:Loop'],
  ['led', 'Brompton', 'Tessera S8', 'hdmi,dvi,sdi3g', 'eth*8:Port'],
  ['led', 'Colorlight', 'X16', 'hdmi*2,dvi*2,sdi3g', 'eth*16:Port'],
  ['led', 'Colorlight', 'Z6 Pro', 'hdmi:HDMI 2.0,dp,sdi12g', 'eth*24:Port,fiber*4:OPT'],
  ['led', 'Generic', 'LED-экран (кабинеты)', 'eth*4:Data In', ''],
  ['led', 'Generic', 'Сигнальная лампа / таймер', 'gpio', ''],
  // --- Запись
  ['rec', 'Blackmagic', 'HyperDeck Studio 4K Pro', 'sdi12g,hdmi,ref,aud*2:XLR', 'sdi12g*2,hdmi,eth:LAN'],
  ['rec', 'Blackmagic', 'HyperDeck Studio HD Plus', 'sdi3g,hdmi', 'sdi3g,hdmi,eth:LAN'],
  ['rec', 'Blackmagic', 'HyperDeck Extreme 8K HDR', 'sdi12g*4,hdmi,ref', 'sdi12g*4,hdmi,eth:LAN'],
  ['rec', 'AJA', 'Ki Pro Ultra 12G', 'sdi12g*4,hdmi,ref', 'sdi12g*4,hdmi,eth:LAN'],
  ['rec', 'Atomos', 'Ninja V', 'hdmi', 'hdmi'],
  ['rec', 'Atomos', 'Shogun 7', 'sdi12g,hdmi', 'sdi12g,hdmi'],
  ['rec', 'Atomos', 'Ninja Ultra', 'hdmi', 'hdmi'],
  ['rec', 'Generic', 'Повтор (replay) сервер', 'sdi3g*6,ref', 'sdi3g*2,eth:LAN'],
  // --- ПК / медиасерверы
  ['nb', 'Generic', 'Ноутбук', 'usb:USB', 'hdmi:HDMI,usb:USB-C,aud:Audio Out,eth:LAN'],
  ['nb', 'Generic', 'Ноутбук с презентацией', 'usb:Кликер', 'hdmi:HDMI (презентация),aud:Audio Out,eth:LAN'],
  ['nb', 'Generic', 'Ноутбук с Resolume', 'usb:MIDI/контроллер,hdmi:Capture', 'hdmi:HDMI Out,dp:USB-C/DP Out,aud:Audio Out,eth:LAN (NDI/Art-Net)'],
  ['nb', 'Generic', 'Ноутбук с Event Master Toolset', '', 'eth:LAN → E2/Ex,hdmi:HDMI (монитор)'],
  ['nb', 'Generic', 'Ноутбук с NovaLCT / VPlat', '', 'usb:USB → контроллер,eth:LAN,hdmi:HDMI'],
  ['nb', 'Generic', 'Ноутбук с vMix / OBS', 'usb*2:Capture,eth:NDI', 'hdmi:HDMI Out,aud:Audio Out'],
  ['pc', 'Generic', 'ПК (2×DP + HDMI)', '', 'dp*2,hdmi,eth:LAN'],
  ['pc', 'Generic', 'ПК + DeckLink 8K Pro', 'sdi12g*2,ref', 'sdi12g*2,dp,eth:LAN'],
  ['pc', 'Apple', 'Mac mini / MacBook', '', 'hdmi,usb*2:USB-C,eth:LAN'],
  ['pc', 'Resolume', 'Arena медиасервер (4 выхода)', 'sdi3g*2:Capture', 'dp*4,eth:LAN'],
  // --- disguise (d3). Выходы VX/GX — через сменные VFC-карты (по умолчанию HDMI 2.0);
  //     входы HD-BNC: каждый 12G-вход = 4×3G (quad). Порты можно переопределить под свои VFC.
  ['d3', 'disguise', 'VX 4+', 'sdi12g*4:SDI In (12G / 4×3G),ref:Genlock', 'hdmi*4:VFC,dp:GUI DP 1.4', 'sfp*2:100GbE,eth*2:LAN'],
  ['d3', 'disguise', 'VX 4+ (VFC Quad 3G-SDI)', 'sdi12g*4:SDI In (12G / 4×3G),ref:Genlock', 'sdi3g*16:VFC SDI,dp:GUI DP 1.4', 'sfp*2:100GbE,eth*2:LAN'],
  ['d3', 'disguise', 'VX 3', 'sdi12g*3:SDI In (12G / 4×3G),ref:Genlock', 'hdmi*3:VFC,dp:GUI DP 1.4', 'sfp*2:100GbE,eth*2:LAN'],
  ['d3', 'disguise', 'VX 2+', 'sdi12g*2:SDI In (12G / 4×3G),ref:Genlock', 'hdmi*2:VFC,dp:GUI DP 1.4', 'sfp*2:100GbE,eth*2:LAN'],
  ['d3', 'disguise', 'VX 1', 'sdi12g:SDI In (12G / 4×3G),ref:Genlock', 'hdmi:VFC,dp:GUI DP 1.4', 'eth*2:LAN'],
  ['d3', 'disguise', 'GX 3', 'sdi12g*3:SDI In (12G / 4×3G),ref:Genlock', 'hdmi*3:VFC,dp:GUI DP 1.4', 'sfp*2:100GbE,eth*2:LAN'],
  ['d3', 'disguise', 'GX 3 (IP-VFC ST 2110)', 'sdi12g*3:SDI In (12G / 4×3G),ref:Genlock', 'dp:GUI DP 1.4', 'sfp*12:IP-VFC 25G,sfp*2:100GbE,eth*2:LAN'],
  ['d3', 'disguise', 'GX 3+ (типовая, как GX 3)', 'sdi12g*3:SDI In (12G / 4×3G),ref:Genlock', 'hdmi*3:VFC,dp:GUI DP 1.4', 'sfp*2:100GbE,eth*2:LAN'],
  ['d3', 'disguise', 'EX 3+', 'hdmi:HDMI 2.0 In,sdi12g*2:SDI In (12G / 3G),ref:Genlock', 'dp*3:DP 1.4 Out,dp:GUI DP 1.4', 'sfp*2:100GbE,eth*2:10GbE'],
  ['d3', 'disguise', 'EX 2C', 'hdmi:HDMI 2.0 In,sdi12g*2:SDI In (12G / 3G),ref:Genlock', 'dp*2:DP 1.4 Out,dp:GUI DP 1.4', 'sfp*2:100GbE,eth*2:10GbE'],
  ['d3', 'disguise', 'EX 2 (вход только NDI)', 'ref:Genlock', 'dp*2:DP 1.4 Out,dp:GUI DP 1.2', 'sfp*2:100GbE,eth*2:10GbE'],
  ['d3', 'disguise', 'EX 3 (1-е пок., без захвата)', '', 'dp*3:DP 1.4 Out', 'sfp*2:25GbE,eth*2:10GbE,eth*2:1GbE'],
  ['d3', 'disguise', 'RX III (рендер-нода, RenderStream)', '', '', 'sfp*2:100GbE RenderStream,eth*2:LAN'],
  ['d3', 'disguise', 'PX (Porta)', 'ref:Genlock', '', 'sdi3g*4:SDI вх/вых,eth*2:LAN'],
  ['d3', 'disguise', 'VX 4 (снят с пр-ва)', 'sdi3g*16:SDI In (quad → 4×4K),ref:Genlock', 'hdmi*4:VFC,dp:GUI DP 1.4', 'sfp*2:25GbE,eth*2:10GbE'],
  ['d3', 'disguise', 'VX 2 (снят с пр-ва)', 'sdi12g*2:SDI In (12G / 4×3G),ref:Genlock', 'hdmi*2:VFC,dp:GUI DP 1.2', 'eth*2:LAN'],
  ['d3', 'disguise', 'GX 2c (снят с пр-ва)', 'sdi3g*8:SDI In (quad → 2×4K),ref:Genlock', 'hdmi*2:VFC,dp:GUI DP 1.2', 'eth*2:10GbE'],
  ['d3', 'disguise', 'GX 2 (снят, типовая)', 'sdi3g*4:SDI In,ref:Genlock', 'hdmi*2:VFC,dp:GUI', 'eth*2:LAN'],
  ['d3', 'disguise', 'GX 1 (снят, типовая)', 'sdi3g*4:SDI In,ref:Genlock', 'hdmi:VFC,dp:GUI', 'eth*2:LAN'],
  ['d3', 'disguise', 'RX II (снят)', '', '', 'sfp*2:RenderStream,eth*2:LAN'],
  ['d3', 'disguise', '4x4pro (снят, типовая)', 'sdi3g*4:SDI In,ref:Genlock', 'dvi*4:VFC,dp:GUI', 'eth*2:LAN'],
  ['d3', 'disguise', '2x4pro (снят, типовая)', 'sdi3g*4:SDI In,ref:Genlock', 'dvi*2:VFC,dp:GUI', 'eth*2:LAN'],
  ['d3', 'disguise', '4x2pro (снят, типовая)', 'sdi3g*4:SDI In,ref:Genlock', 'dvi*4:VFC,dp:GUI', 'eth*2:LAN'],
  ['d3', 'disguise', 'solo (снят, типовая)', 'sdihd*3:SDI In (опция)', 'dp*2:Out,dp:GUI', 'eth*2:LAN'],
  ['nb', 'disguise', 'Ноутбук с disguise Designer', '', 'hdmi:HDMI,aud:Audio Out', 'eth:LAN (d3Net)'],
  ['pc', 'Generic', 'Графический сервер (CasparCG)', 'ref', 'sdi3g*4:Fill/Key,eth:LAN'],
  ['pc', 'Generic', 'Видеоплеер (Brightsign/медиаплеер)', 'eth:LAN', 'hdmi'],
  // --- Стриминг / NDI
  ['enc', 'Blackmagic', 'Web Presenter HD', 'sdi3g,aud*2:XLR', 'sdi3g:Loop,usb:Webcam,eth:LAN'],
  ['enc', 'Blackmagic', 'Streaming Encoder HD', 'hdmi', 'eth:LAN,usb'],
  ['enc', 'Magewell', 'Pro Convert SDI 4K Plus', 'sdi12g', 'eth:NDI'],
  ['enc', 'Magewell', 'Pro Convert HDMI 4K Plus', 'hdmi', 'eth:NDI'],
  ['enc', 'Magewell', 'Pro Convert NDI to HDMI', 'eth:NDI', 'hdmi'],
  ['enc', 'BirdDog', 'Flex 4K OUT', 'eth:NDI', 'hdmi,sdi12g'],
  ['enc', 'Teradek', 'Prism Flex', 'sdi12g,hdmi', 'eth:LAN,hdmi:Loop'],
  ['enc', 'Haivision', 'Makito X4 (SRT)', 'sdi3g*4', 'eth*2:LAN'],
  ['enc', 'Teradek', 'Bolt 6 TX (беспроводной)', 'sdi12g,hdmi', 'sdi12g:Loop'],
  ['enc', 'Teradek', 'Bolt 6 RX (беспроводной)', '', 'sdi12g*2,hdmi'],
  ['enc', 'Hollyland', 'Mars 4K TX', 'sdi3g,hdmi', 'sdi3g:Loop'],
  ['enc', 'Hollyland', 'Mars 4K RX', '', 'sdi3g,hdmi'],
  // --- Сеть
  ['net', 'Generic', 'Коммутатор 8×1G', 'eth*8:Port', ''],
  ['net', 'Generic', 'Коммутатор 24×1G + 4×SFP+', 'eth*24:Port,sfp*4:SFP+', ''],
  ['net', 'Generic', 'Коммутатор 48×1G PoE', 'eth*48:Port', ''],
  ['net', 'Generic', 'Коммутатор 2110 32×100G', 'sfp*32:QSFP', ''],
  ['net', 'Generic', 'Роутер / Wi-Fi', 'eth*4:LAN,eth:WAN', ''],
  // --- Синхронизация
  ['sync', 'Blackmagic', 'Mini Converter Sync Generator', '', 'ref*6'],
  ['sync', 'Tektronix', 'SPG8000A', 'ref:Ext Ref,eth:PTP', 'ref*6,tc*2:LTC,eth:LAN'],
  ['sync', 'Evertz', '5601MSC', 'ref,eth:PTP', 'ref*8,tc*2'],
  ['sync', 'Generic', 'Генератор таймкода', '', 'tc*4'],
  // --- Звук
  ['aud', 'Generic', 'Микшерный пульт (аналог)', 'aud*16:Mic/Line', 'aud*8:Out'],
  ['aud', 'Generic', 'Цифровой пульт (Dante)', 'aud*16:Mic,madi', 'aud*8:Out,aes*2,madi,eth*2:Dante'],
  ['aud', 'Behringer', 'X32', 'aud*32:Mic,aes:AES50 A,aes:AES50 B', 'aud*16:Out,aes:AES Out,usb'],
  ['aud', 'Generic', 'Радиомикрофон (приёмник)', '', 'aud'],
  ['aud', 'Generic', 'Колонки / мониторы', 'aud*2', ''],
  ['aud', 'Generic', 'Аудио эмбеддер SDI', 'sdi3g,aud*4', 'sdi3g'],
  ['aud', 'Generic', 'Аудио де-эмбеддер SDI', 'sdi3g', 'sdi3g:Loop,aud*4'],
  // --- Управление
  ['ctl', 'Blackmagic', 'ATEM 1 M/E Advanced Panel', 'eth:LAN', ''],
  ['ctl', 'Blackmagic', 'ATEM Camera Control Panel', 'eth:LAN', ''],
  ['ctl', 'Panasonic', 'AW-RP150 PTZ пульт', 'eth:LAN,ctrl', ''],
  ['ctl', 'Sony', 'RCP-3500', 'eth:LAN', ''],
  ['ctl', 'Generic', 'Tally-контроллер', 'gpio*8,eth:LAN', 'gpio*8'],
  ['ctl', 'Generic', 'Интерком базовая станция', 'aud*4:4W,eth:LAN', 'aud*4:4W'],
  ['ctl', 'Generic', 'Stream Deck', '', 'usb'],
  ['ctl', 'Barco', 'Event Master EC-200 (пульт)', 'eth:LAN,hdmi*2:Монитор', ''],
  ['ctl', 'Barco', 'Event Master EC-50 (пульт)', 'eth:LAN,hdmi:Монитор', ''],
  ['ctl', 'PixelHue', 'PixelFlow / пульт управления', 'eth:LAN', ''],
  ['ctl', 'Generic', 'Кликер для презентаций (приёмник)', '', 'usb'],
  ['ctl', 'Generic', 'Таймер сцены (Stage timer)', 'hdmi,eth:LAN', ''],
  // --- Прочее
  ['pp', 'Generic', 'Патч-панель BNC 24 (нормаль)', 'sdi12g*24:Rear', 'sdi12g*24:Front'],
  ['pp', 'Generic', 'Проходной разъём (стена/пол)', 'sdi12g,hdmi,eth', 'sdi12g,hdmi,eth'],
  ['pp', 'Generic', 'Кабельный барабан (SDI)', 'sdi12g', 'sdi12g'],
  ['pp', 'Generic', 'Блок (пустой)', 'hdmi', 'hdmi'],
];

// подпись под картинкой на схеме: короткое название устройства (в единственном числе)
const CAT_ROLE = { cam: 'камера', ccu: 'CCU', sw: 'видеомикшер', proc: 'видеопроцессор', rt: 'матрица', conv: 'конвертер', da: 'сплиттер', ext: 'удлинитель',
  mon: 'монитор', mv: 'мультивьюер', led: 'LED-контроллер', rec: 'рекордер', nb: 'ноутбук', pc: 'компьютер', d3: 'сервер D3', enc: 'энкодер', net: 'коммутатор',
  sync: 'генератор синхры', aud: 'звук', ctl: 'пульт', light: 'свет', power: 'питание', per: 'клавиатура и мышь', pp: 'патч-панель', my: 'устройство' };
function roleOf(d) {
  if (d.role && String(d.role).trim()) return String(d.role).trim();
  const model = String(d.model || ''), t = ((d.maker || '') + ' ' + model).toLowerCase(), c = d.cat;
  const clean = s => s.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
  if (c === 'my') return clean(model) || 'устройство';
  if (c === 'nb') return /^ноут/i.test(model) ? clean(model.replace(/^ноут(бук)?(?=\s|$)/i, 'ноутбук')) : 'ноутбук';
  if (c === 'mon') return 'монитор';
  if (/hippo/.test(t)) return 'сервер Hippotizer';
  if (/resolume|резолюм/.test(t)) return 'сервер Resolume';
  if (c === 'd3' || /disguise/.test(t)) return 'сервер D3';
  if (/watchout/.test(t)) return 'сервер Watchout';
  if (/pixera/.test(t)) return 'сервер Pixera';
  if (/vmix/.test(t)) return 'сервер vMix';
  if (/птс/.test(t)) return 'ПТС';
  if (/интерком|intercom|clear-?com|riedel/.test(t)) return 'интерком';
  if (/tally|талли/.test(t)) return 'tally';
  if (/клик|clicker|презентер|spotlight|perfect ?cue|microcue/.test(t)) return 'кликер';
  if (/(^|\s)ec-\d|\(пульт\)|control panel/.test(t)) return 'пульт';
  if (/decklink|ultrastudio|capture|захват/.test(t)) return 'плата захвата';
  if (c === 'aud') {
    if (/стейдж|stage|rio\d|dante.*бокс/.test(t)) return 'стейдж-бокс';
    if (/iem|ушн/.test(t)) return 'ушной мониторинг';
    if (/радио|ulx|slx|ew\s?\d/.test(t)) return 'радиомикрофоны';
    if (/микрофон|гарнитур/.test(t)) return 'микрофон';
    if (/scarlett|2i2|us-\d|звуков\S* карт|audio interface/.test(t)) return 'звуковая карта';
    if (/саундбар|колонк|акустик|сабвуфер|монитор/.test(t)) return 'акустика';
    if (/пульт|mixer|x32|m32|\bql|\bcl\d|sq-|dlive|tf\d/.test(t)) return 'звуковой пульт';
    return 'звук';
  }
  if (c === 'light') return /grandma|magicq|пульт|wing|avolites|chamsys/.test(t) ? 'световой пульт' : 'свет';
  if (c === 'power') return /ибп|ups/.test(t) ? 'ИБП' : 'питание';
  if (c === 'per') return /клав|мыш|keyboard|mouse/.test(t) ? 'клавиатура и мышь' : /мфу|принтер|printer/.test(t) ? 'принтер' : 'периферия';
  if (c === 'net' && /интернет|облак|internet/.test(t)) return 'интернет';
  if (c === 'pc' && /сервер|server/.test(t)) return 'сервер';
  return CAT_ROLE[c] || 'устройство';
}
// старый формат «HDMI 2.0 1» → «1 - HDMI 2.0» (номер не сливается с версией); русские названия не трогаем
function numFirst(name) {
  let s = String(name == null ? '' : name); const m = /^(.*\S)\s+(\d+)$/.exec(s);
  if (m && !/[А-Яа-яЁё]/.test(m[1]) && !/^\d+ - /.test(s)) s = `${m[2]} - ${m[1]}`;
  return s;
}
// название порта с направлением: вход — «… In», выход — «… Out»; ⇄ и русские названия не трогаем
function portName(name, dir, type) {
  let s = numFirst(name); if (!s || /[А-Яа-яЁё]/.test(s)) return s;
  s = s.replace(/\s+(in|out|input|output)$/i, '').replace(/^(in|out|input|output)$/i, '');
  if (type && T[type] && (/^\d+ -$/.test(s) || !s)) s = (s ? s + ' ' : '') + (T[type].fam === 'sdi' ? T[type].n : T[type].s);
  if (dir === 'io') return s;
  return s + (dir === 'in' ? ' In' : dir === 'out' ? ' Out' : '');
}
function parsePorts(spec, dir) {
  const out = [];
  if (!spec) return out;
  const counters = {};
  spec.split(',').map(s => s.trim()).filter(Boolean).forEach(item => {
    let [tc, name] = item.split(':');
    let [t, cnt] = tc.split('*');
    let nm = name;
    if (name && name.includes('*')) { [nm, cnt] = name.split('*'); }
    cnt = parseInt(cnt || '1', 10);
    if (/expansion|\bexp\b/i.test(nm || '')) t = 'exp';
    if (!T[t]) t = 'sdi3g';
    if (t === 'fiber') { if (/гибрид|hybrid|smpte|\btac\b/i.test(nm || '')) t = 'fibhyb'; else if (/\bsm\b|single|одномод/i.test(nm || '')) t = 'fibsm'; else if (/\bmm\b|multi|многомод/i.test(nm || '')) t = 'fibmm'; }
    const ver = /(\d\.\d)/.exec(nm || '');
    if (ver && t === 'hdmi') t = { '1.3': 'hdmi13', '1.4': 'hdmi14', '2.0': 'hdmi20', '2.1': 'hdmi21' }[ver[1]] || t;
    if (ver && t === 'dp') t = { '1.1': 'dp11', '1.2': 'dp12', '1.4': 'dp14', '2.0': 'dp21', '2.1': 'dp21' }[ver[1]] || t;
    const fdir = T[t] && T[t].fam === 'eth' ? 'io' : dir;
    for (let i = 0; i < cnt; i++) {
      const ck = T[t].s; counters[ck] = (counters[ck] || 0) + 1;
      let label;
      if (nm) label = cnt > 1 ? `${i + 1} - ${nm}` : nm;
      else label = `${counters[ck]} - ${T[t].s}`;
      out.push({ name: portName(label, fdir, t), type: t, dir: fdir });
    }
  });
  return out;
}

// eth/sfp всегда двунаправленные
function normPorts(arr) {
  return arr.map(p => (T[p.type] && T[p.type].fam === 'eth') ? { ...p, dir: 'io' } : p);
}

const BUILTIN_LIB = RAW.map((r, i) => ({
  id: 'b' + i,
  cat: r[0], maker: r[1], model: r[2],
  ports: normPorts([...parsePorts(r[3], 'in'), ...parsePorts(r[4], 'out'), ...parsePorts(r[5], 'io')]),
}));

// ---------- фигуры (палитра как в draw.io)
const SHAPE_KINDS = [
  ['text', 'Текст', 80, 30], ['rect', 'Прямоугольник', 120, 60], ['ellipse', 'Круг / овал', 80, 80], ['diamond', 'Ромб', 100, 80],
  ['round', 'Скруглённый', 120, 60], ['para', 'Параллелограмм', 120, 60], ['trap', 'Трапеция', 120, 60], ['hex', 'Шестиугольник', 120, 60],
  ['step', 'Шеврон', 120, 60], ['process', 'Процесс', 120, 60], ['tri', 'Треугольник', 70, 80], ['doc', 'Документ', 120, 70],
  ['tape', 'Лента', 120, 70], ['cloud', 'Облако', 130, 80], ['barrow', 'Стрелка-блок', 120, 60], ['dot', 'Точка', 16, 16],
  ['larrow', 'Стрелка', 120, 20], ['ldouble', 'Двойная стрелка', 120, 20], ['lthick', 'Толстая стрелка', 120, 26], ['lstep', 'Ступенька', 120, 40],
];
const SHAPE_DEF = Object.fromEntries(SHAPE_KINDS.map(k => [k[0], { n: k[1], w: k[2], h: k[3] }]));
const SHAPE_NOTEXT = new Set(['dot', 'larrow', 'ldouble', 'lthick', 'lstep']);
// параметры формы (жёлтые ромбики): p — основной, q — второй (толщина стрелы)
const SHAPE_P = { round: .4, para: .2, trap: .2, hex: .2, step: .2, process: .1, doc: .2, tape: .12, barrow: .4, lthick: .25, tri: .5, lstep: .5 };
const SHAPE_Q = { barrow: .5, lthick: .4 };
function shapeSVG(kind, w, h, f, st, p, q) {
  p = p ?? SHAPE_P[kind]; q = q ?? SHAPE_Q[kind];
  const A = `fill="${f}" stroke="${st}" stroke-width="1.4" stroke-linejoin="round"`;
  const poly = pts => `<polygon points="${pts.map(v => v.join(',')).join(' ')}" ${A}/>`;
  const head = (x, y, dir) => `<polygon points="${x},${y} ${x - 9 * dir},${y - 5} ${x - 9 * dir},${y + 5}" fill="${st}"/>`;
  switch (kind) {
    case 'text': return `<rect width="${w}" height="${h}" fill="transparent"/>`;
    case 'round': return `<rect width="${w}" height="${h}" rx="${p * Math.min(w, h) / 2}" ${A}/>`;
    case 'ellipse': return `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2}" ry="${h / 2}" ${A}/>`;
    case 'diamond': return poly([[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]]);
    case 'para': return poly([[w * p, 0], [w, 0], [w * (1 - p), h], [0, h]]);
    case 'trap': return poly([[w * p, 0], [w * (1 - p), 0], [w, h], [0, h]]);
    case 'hex': return poly([[w * p, 0], [w * (1 - p), 0], [w, h / 2], [w * (1 - p), h], [w * p, h], [0, h / 2]]);
    case 'step': return poly([[0, 0], [w * (1 - p), 0], [w, h / 2], [w * (1 - p), h], [0, h], [w * p, h / 2]]);
    case 'process': return `<rect width="${w}" height="${h}" ${A}/><line x1="${w * p}" y1="0" x2="${w * p}" y2="${h}" stroke="${st}" stroke-width="1.4"/><line x1="${w * (1 - p)}" y1="0" x2="${w * (1 - p)}" y2="${h}" stroke="${st}" stroke-width="1.4"/>`;
    case 'tri': return poly([[0, 0], [w, h * p], [0, h]]);
    case 'doc': { const b = h * (1 - p); return `<path d="M0 0H${w}V${b}C${w * .75} ${b - h * p} ${w * .5} ${b + h * p * 1.2} 0 ${b + h * p * .3}Z" ${A}/>`; }
    case 'tape': return `<path d="M0 ${h * p}C${w * .25} ${-h * p * .7} ${w * .5} ${h * p * 2.7} ${w} ${h * p}V${h * (1 - p)}C${w * .75} ${h * (1 + p * .7)} ${w * .5} ${h * (1 - p * 2.7)} 0 ${h * (1 - p)}Z" ${A}/>`;
    case 'cloud': return `<path d="M${w * .25} ${h * .9}C${w * .02} ${h * .9} ${w * .02} ${h * .5} ${w * .2} ${h * .48}C${w * .15} ${h * .15} ${w * .5} ${h * .05} ${w * .55} ${h * .28}C${w * .65} ${h * .05} ${w * .95} ${h * .15} ${w * .85} ${h * .45}C${w * 1.02} ${h * .5} ${w} ${h * .9} ${w * .78} ${h * .9}Z" ${A}/>`;
    case 'barrow': case 'lthick': { const hx = w * (1 - p), t = h * (1 - q) / 2; return poly([[0, t], [hx, t], [hx, 0], [w, h / 2], [hx, h], [hx, h - t], [0, h - t]]); }
    case 'dot': return `<circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) / 2}" fill="${st}"/>`;
    case 'larrow': return `<line x1="0" y1="${h / 2}" x2="${w - 6}" y2="${h / 2}" stroke="${st}" stroke-width="1.6"/>` + head(w, h / 2, 1);
    case 'ldouble': return `<line x1="6" y1="${h / 2}" x2="${w - 6}" y2="${h / 2}" stroke="${st}" stroke-width="1.6"/>` + head(w, h / 2, 1) + head(0, h / 2, -1);
    case 'lstep': return `<path d="M0 2H${w * p}V${h - 4}H${w - 6}" fill="none" stroke="${st}" stroke-width="1.6"/>` + head(w, h - 4, 1);
    default: return `<rect width="${w}" height="${h}" ${A}/>`;
  }
}
// ромбики настройки формы: позиция в координатах фигуры и как из позиции получить значение
function shapeHandles(kind, w, h, p, q) {
  p = p ?? SHAPE_P[kind]; q = q ?? SHAPE_Q[kind];
  const c = (v, a, b) => Math.max(a, Math.min(b, v));
  switch (kind) {
    case 'round': return [{ k: 'p', x: p * Math.min(w, h) / 2, y: 0, v: (x, y) => c(x / (Math.min(w, h) / 2), 0, 1) }];
    case 'para': case 'trap': case 'hex': return [{ k: 'p', x: w * p, y: 0, v: x => c(x / w, 0, .45) }];
    case 'step': return [{ k: 'p', x: w * (1 - p), y: 0, v: x => c(1 - x / w, 0, .6) }];
    case 'process': return [{ k: 'p', x: w * p, y: 0, v: x => c(x / w, .02, .4) }];
    case 'doc': return [{ k: 'p', x: w, y: h * (1 - p), v: (x, y) => c(1 - y / h, .04, .45) }];
    case 'tape': return [{ k: 'p', x: 0, y: h * p, v: (x, y) => c(y / h, 0, .35) }];
    case 'tri': return [{ k: 'p', x: w, y: h * p, v: (x, y) => c(y / h, 0, 1) }];
    case 'lstep': return [{ k: 'p', x: w * p, y: h / 2, v: x => c(x / w, .05, .9) }];
    case 'barrow': case 'lthick': return [{ k: 'p', x: w * (1 - p), y: 0, v: x => c(1 - x / w, .08, .9) }, { k: 'q', x: 0, y: h * (1 - q) / 2, v: (x, y) => c(1 - 2 * y / h, .1, 1) }];
    default: return [];
  }
}
// поворот на 90° и отражения: рисуем в «своих» координатах и переводим в рамку фигуры
function shapeTf(n, w, h) {
  const r = n.rot || 0, fh = !!n.flipH, fv = !!n.flipV;
  const dw = r % 180 ? h : w, dh = r % 180 ? w : h;
  const toBox = (x, y) => { let X, Y; if (r === 0) { X = x; Y = y; } else if (r === 90) { X = w - y; Y = x; } else if (r === 180) { X = w - x; Y = h - y; } else { X = y; Y = h - x; } if (fh) X = w - X; if (fv) Y = h - Y; return [X, Y]; };
  const toLocal = (X, Y) => { if (fh) X = w - X; if (fv) Y = h - Y; if (r === 0) return [X, Y]; if (r === 90) return [Y, w - X]; if (r === 180) return [w - X, h - Y]; return [h - Y, X]; };
  const tr = (fh || fv ? `translate(${fh ? w : 0},${fv ? h : 0}) scale(${fh ? -1 : 1},${fv ? -1 : 1}) ` : '') + (r === 90 ? `translate(${w},0) rotate(90)` : r === 180 ? `translate(${w},${h}) rotate(180)` : r === 270 ? `translate(0,${h}) rotate(270)` : '');
  return { dw, dh, toBox, toLocal, tr };
}
const SHAPE_PORTS = Array.from({ length: 8 }, (_, i) => ({ name: 'Связь ' + (i + 1), type: 'any', dir: 'io' }));
SHAPE_KINDS.forEach(([k, name, w, h]) => BUILTIN_LIB.push({ id: 'sh_' + k, cat: 'shape', maker: 'Generic', model: name, shape: k, fill: k === 'text' ? 'transparent' : '#ffffff', label: k === 'text' ? 'Текст' : SHAPE_NOTEXT.has(k) ? '' : '', sw: w, sh: h, ports: SHAPE_PORTS.map(p => ({ ...p })) }));
// готовые заготовки (как в ваших схемах)
[
  ['sh1', 'Экран (прямоугольник)', 'rect', '#ffffff', 'Экран', 200, 120],
  ['sh2', 'Блок с подписью', 'round', '#ffffff', 'Устройство', 150, 50],
  ['sh3', 'Сигнальная лампа', 'ellipse', '#22c55e', 'Сигнальная\nлампа', 90, 90],
  ['sh4', 'Кнопка', 'ellipse', '#ef4444', 'Кнопка', 44, 44],
  ['sh5', 'Мышка / датчик', 'round', '#ffffff', 'Мышка', 30, 54],
].forEach(([id, model, shape, fill, label, sw, sh]) => BUILTIN_LIB.push({ id, cat: 'shape', maker: 'Generic', model, shape, fill, label, sw, sh, ports: SHAPE_PORTS.map(p => ({ ...p })) }));
