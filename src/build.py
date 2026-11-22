import os, re
# Сборка «Экрана» из исходников:
#   index.html (сайт) · desktop/index.html и app/web/index.html (приложения Windows / Mac) · app/web/version.txt
# Общий код (lib.js, art.js, app.js) — тот же, что у «Сигнала»; настройки программы — prod_ekran.js.
# Разметка index.html: <!--L-->…<!--/L--> — части «Экрана», <!--V-->…<!--/V--> — части «Сигнала» (вырезаются).
d = os.path.dirname(os.path.abspath(__file__)) + '/'
R = lambda f: open(d + f, encoding='utf-8').read()
prod = R('prod_ekran.js'); c = lambda n: re.search(n + r"\s*=\s*'([^']*)'", prod).group(1)
icon = '<svg viewBox="0 0 16 16" width="20" height="20"><g fill="none" stroke="currentColor" stroke-width="1.6"><rect x="1.5" y="3" width="13" height="10" rx="1"/><path d="M5.8 3v10M10.2 3v10M1.5 8h13"/></g></svg>'
h = re.sub(r'<!--V-->.*?<!--/V-->', '', R('index.html'), flags=re.S).replace('<!--L-->', '').replace('<!--/L-->', '')
for k, v in {'APP_NAME': c('APP_NAME'), 'APP_TAG': c('APP_TAG'), 'SITE': c('SITE_URL'), 'ICON': icon, 'BODY': 'secLed prodEkran'}.items(): h = h.replace('{{%s}}' % k, v)
assert '{{' not in h
h = h.replace('/*CSS*/', R('style.css')).replace('/*JS*/', prod + '\n' + '\n'.join(R(f) for f in ('lib.js', 'art.js', 'app.js', 'scr.js', 'led.js')))
site = h.replace('<title>', '<link rel="manifest" href="manifest.webmanifest">\n<link rel="icon" href="icon-192.png">\n<link rel="apple-touch-icon" href="icon-180.png">\n<meta name="theme-color" content="#1f6feb">\n<title>', 1)
W = lambda p, t: open(d + '../' + p, 'w', encoding='utf-8').write(t)
W('index.html', site); W('desktop/index.html', h); W('app/web/index.html', h); W('app/web/version.txt', c('APP_VERSION'))
print('Экран', c('APP_VERSION'))
