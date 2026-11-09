#!/usr/bin/env python3
"""
Comprobaciones del sistema de diseño de las herramientas del FAP.

Las ocho herramientas son HTML sueltos, sin hoja de estilos compartida: cada una
lleva sus colores y sus reglas. Eso hace que se separen solas. En la auditoría de
noviembre de 2026 «Por vencer» se leía a 2,7:1 en el CLM y los rótulos de los
campos a 2,6:1 en el Calificador, todos los campos de todas las herramientas
hacían zoom en el iPhone, y La Mágica y el CRM pedían su motor de Word a dos CDN
cuando la copia estaba en el repositorio. Nada lo detectaba, porque nada de eso
rompe una prueba: solo se ve con el teléfono en la mano.

Aquí se vigila lo que SÍ se puede comprobar leyendo el archivo, sin navegador:

  1. Contraste. Todo color que se usa como texto pasa 4,5:1 (WCAG AA) sobre
     blanco, sobre el fondo de la página y sobre su propio fondo claro.
  2. Una sola paleta. Las herramientas que comparten token comparten valor, y los
     nombres en español (--tenue, --alerta…) valen lo mismo que los del CLM.
  3. Celular. Cada herramienta lleva la regla que pone los campos a 16 px —por
     debajo de eso Safari en el iPhone acerca la página al tocarlos—.
  4. Carga. La letra de Google no frena la primera pantalla y ningún <script>
     bloquea la página esperando a un servidor de fuera.
  5. Teclado. Cada herramienta tiene su regla de :focus-visible.

Lo que no se puede comprobar así —que nada se salga de la pantalla, que un botón
mida lo que tiene que medir— se mide en Chromium: ver plan/SISTEMA_DE_DISENO.md.

    python3 scripts/probar_diseno.py

Sale con código 1 si algo falla. No tiene dependencias.
"""
import os
import re
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HERRAMIENTAS = ['clm', 'generador', 'crm', 'instrumentos', 'calificacion',
                'bienes', 'planificador', 'renovaciones']

AA = 4.5          # texto normal
BLANCO = '#FFFFFF'

fallos = 0
pruebas = 0


def ok(cond, msg, extra=None):
    global fallos, pruebas
    pruebas += 1
    if cond:
        print('  ✓ ' + msg)
    else:
        fallos += 1
        print('  ✗ ' + msg + ('  → ' + str(extra) if extra is not None else ''))


def seccion(t):
    print('\n' + t)


# ------------------------------------------------------------------ contraste
def _lin(v):
    v /= 255
    return v / 12.92 if v <= .03928 else ((v + .055) / 1.055) ** 2.4


def luminancia(hx):
    h = hx.lstrip('#')
    if len(h) == 3:
        h = ''.join(c * 2 for c in h)
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return .2126 * _lin(r) + .7152 * _lin(g) + .0722 * _lin(b)


def contraste(a, b):
    la, lb = luminancia(a), luminancia(b)
    return (max(la, lb) + .05) / (min(la, lb) + .05)


# ------------------------------------------------------------------ lectura
def leer(h):
    with open(os.path.join(RAIZ, h, 'index.html'), encoding='utf-8') as f:
        s = f.read()
    # Las plantillas y los datos embebidos en base64 no son código: fuera.
    return re.sub(r'[A-Za-z0-9+/=]{400,}', '', s)


def tokens(s):
    """Los tokens del primer :root de la página (el de la herramienta)."""
    m = re.search(r':root\s*\{([^}]*)\}', s)
    if not m:
        return {}
    return {k: v.strip() for k, v in
            re.findall(r'--([a-zA-Z0-9-]+)\s*:\s*([^;]+);', m.group(1))}


def es_hex(v):
    return bool(re.fullmatch(r'#[0-9A-Fa-f]{3}(?:[0-9A-Fa-f]{3})?', v or ''))


# Cada dialecto: qué tokens son TEXTO, sobre qué fondos tienen que leerse, y qué
# token es el fondo claro de cada color de estado.
DIALECTOS = {
    'clm': dict(
        de=['clm', 'crm', 'calificacion', 'bienes'],
        fondo='bg', suave='tint',
        texto=['ink', 'navy', 'muted', 'muted2', 'green', 'amber', 'red', 'teal', 'violet'],
        grises=['muted', 'muted2'],
        estado={'green': 'greenbg', 'amber': 'amberbg', 'red': 'redbg'},
        boton=['navy', 'red', 'green'],       # fondos que llevan texto blanco
    ),
    'planificador': dict(
        de=['planificador', 'renovaciones'],
        fondo='papel', suave='azul-claro',
        texto=['ink', 'texto', 'tenue', 'debil', 'azul', 'ok', 'alerta', 'critico',
               'ren', 'nue', 'rojo'],
        grises=['tenue', 'debil'],
        estado={'ok': 'ok-bg', 'alerta': 'alerta-bg', 'critico': 'critico-bg',
                'ren': 'ren-bg', 'nue': 'nue-bg', 'rojo': 'rojo-bg'},
        boton=['azul'],
    ),
    'instrumentos': dict(
        de=['instrumentos'],
        fondo='fondo', suave='azul-claro',
        texto=['texto', 'gris', 'azul', 'ok', 'warn', 'peligro'],
        grises=['gris'],
        estado={},
        boton=['azul'],
    ),
}

# Un mismo color con dos nombres: el del CLM y el de las herramientas en español.
EQUIVALENTES = {
    'ink': ['ink'], 'navy': ['azul'], 'bg': ['papel'], 'tint': ['azul-claro'],
    'muted': ['tenue'], 'muted2': ['debil'],
    'green': ['ok', 'ren'], 'amber': ['alerta', 'nue'], 'red': ['critico', 'rojo'],
}

# La Mágica no usa tokens: escribe sus colores en línea. Estos tres eran texto y
# no contrastaban (2,6:1, 3,9:1 y 3,8:1); no tienen que volver.
VETADOS_GENERADOR = ['#9AA0B2', '#7A8090', '#B4690E']

PAGINAS = {h: leer(h) for h in HERRAMIENTAS}
TOKENS = {h: tokens(PAGINAS[h]) for h in HERRAMIENTAS}

# ---------------------------------------------------------------- 1
seccion('1 · Todo color que se usa como texto pasa 4,5:1')
for nombre, d in DIALECTOS.items():
    for h in d['de']:
        t = TOKENS[h]
        malos = []
        n = 0
        fondo = t.get(d['fondo'])
        for tok in d['texto']:
            c = t.get(tok)
            if not es_hex(c):
                continue
            sobre = [('blanco', BLANCO)]
            if es_hex(fondo):
                sobre.append(('--' + d['fondo'], fondo))
            if tok in d['grises'] and es_hex(t.get(d['suave'])):
                sobre.append(('--' + d['suave'], t[d['suave']]))
            claro = d['estado'].get(tok)
            if claro and es_hex(t.get(claro)):
                sobre.append(('--' + claro, t[claro]))
            for rotulo, b in sobre:
                n += 1
                r = contraste(c, b)
                if r < AA:
                    malos.append('--%s %s sobre %s: %.2f:1' % (tok, c, rotulo, r))
        ok(n > 0 and not malos, '%s: %d pares de texto y fondo' % (h, n),
           '; '.join(malos) or 'no se encontraron los tokens')
        blancos = ['--%s %s con texto blanco: %.2f:1' % (b, t[b], contraste(BLANCO, t[b]))
                   for b in d['boton'] if es_hex(t.get(b)) and contraste(BLANCO, t[b]) < AA]
        ok(not blancos, '%s: el texto blanco de los botones se lee' % h, '; '.join(blancos))

for h in ('clm', 'crm'):
    pares = re.findall(r'\{bg:"(#[0-9A-Fa-f]{6})",fg:"(#[0-9A-Fa-f]{6})"\}', PAGINAS[h])
    malos = ['%s sobre %s: %.2f:1' % (fg, bg, contraste(fg, bg))
             for bg, fg in pares if contraste(fg, bg) < AA]
    ok(len(pares) >= 8 and not malos,
       '%s: las %d píldoras de categoría' % (h, len(pares)), '; '.join(malos))

g = PAGINAS['generador']
hallados = [v for v in VETADOS_GENERADOR if re.search(re.escape(v), g, re.I)]
ok(not hallados, 'generador: no vuelven los tres colores de texto que no contrastaban',
   ', '.join(hallados))

# «color:» a secas: border-left-color y background-color sí pueden llevarlo.
for h in HERRAMIENTAS:
    ok(re.search(r'(?<![a-z-])color:\s*var\(--amber-s\)', PAGINAS[h]) is None,
       '%s: el ámbar de marca (--amber-s) no se usa como texto' % h)

# ---------------------------------------------------------------- 2
seccion('2 · Una sola paleta')
base = TOKENS['clm']
for h in ('crm', 'calificacion', 'bienes'):
    distintos = ['--%s: %s (en el CLM, %s)' % (k, v, base[k])
                 for k, v in TOKENS[h].items()
                 if k in base and es_hex(v) and v.lower() != base[k].lower()
                 and not (v.lower() in ('#fff', '#ffffff') and base[k].lower() in ('#fff', '#ffffff'))]
    ok(not distintos, '%s: sus tokens valen lo mismo que los del CLM' % h, '; '.join(distintos))
for h in ('planificador', 'renovaciones'):
    t = TOKENS[h]
    distintos = []
    for canon, otros in EQUIVALENTES.items():
        for o in otros:
            if o in t and es_hex(t[o]) and es_hex(base.get(canon)) \
                    and t[o].lower() != base[canon].lower():
                distintos.append('--%s: %s (en el CLM --%s es %s)' % (o, t[o], canon, base[canon]))
    ok(not distintos, '%s: sus nombres en español valen lo mismo que los del CLM' % h,
       '; '.join(distintos))

# ---------------------------------------------------------------- 3
seccion('3 · Celular')
REGLA_16 = re.compile(
    r'@media\s*\(max-width:\s*\d+px\)\s*\{(?:[^{}]|\{[^{}]*\})*?'
    r'input:not\(\[type=checkbox\]\):not\(\[type=radio\]\):not\(\[type=range\]\),select,textarea'
    r'\{font-size:16px!important\}', re.S)
for h in HERRAMIENTAS:
    s = PAGINAS[h]
    ok(re.search(r'<meta name="viewport" content="width=device-width', s) is not None,
       '%s: tiene la etiqueta viewport' % h)
    ok(REGLA_16.search(s) is not None,
       '%s: los campos van a 16 px en pantalla estrecha (sin eso el iPhone acerca la página)' % h)

# ---------------------------------------------------------------- 4
seccion('4 · Carga con señal floja')
for h in HERRAMIENTAS:
    s = PAGINAS[h]
    cabeza = s[:s.find('</head>')] if '</head>' in s else s[:s.find('<body')]
    sin_noscript = re.sub(r'<noscript>.*?</noscript>', '', cabeza, flags=re.S)
    hojas = re.findall(r'<link[^>]+fonts\.googleapis\.com/css[^>]*>', sin_noscript)
    frenan = [x for x in hojas if 'media="print"' not in x or 'onload=' not in x]
    ok(not frenan, '%s: la letra de Google no frena la primera pantalla' % h,
       'falta media="print" onload="this.media=\'all\'"')
    de_fuera = re.findall(r'<script[^>]+src=["\']https?://[^"\']+["\'][^>]*>', cabeza)
    ok(not de_fuera, '%s: ningún <script> espera a un servidor de fuera' % h,
       ' '.join(de_fuera)[:160])

for h in ('generador', 'crm'):
    s = PAGINAS[h]
    for lib in ('pizzip.min.js', 'docxtemplater.min.js'):
        m = re.search(r'<script[^>]*src="\.\./clm/vendor/%s"[^>]*onerror="fapMotor\(\'https://[^\']+\'\)"'
                      % re.escape(lib), s)
        ok(m is not None and os.path.exists(os.path.join(RAIZ, 'clm', 'vendor', lib)),
           '%s: %s sale del repositorio, con el CDN solo de respaldo' % (h, lib))
ok('function motorListo()' in PAGINAS['generador'],
   'generador: si el motor llega tarde, el aviso de «no cargó» se quita solo (motorListo)')

# ---------------------------------------------------------------- 5
seccion('5 · Teclado')
for h in HERRAMIENTAS:
    ok(re.search(r'button:focus-visible[^{]*\{[^}]*outline:\s*2', PAGINAS[h]) is not None,
       '%s: lo que se pulsa muestra dónde está el foco' % h)

print()
if fallos:
    print('✗ %d de %d comprobaciones fallan' % (fallos, pruebas))
    sys.exit(1)
print('✓ %d comprobaciones, todo bien' % pruebas)
