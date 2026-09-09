#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Convierte los controles de contenido de las plantillas en variables.

Las plantillas Word llevaban 187 cuadros combinados que la administradora tenía
que elegir a mano, uno por uno, en cada documento. El que se olvida no falla en
silencio: imprime la barra —«Administrador/a Contador/a», «del/a»— en un
documento que se firma. Con 13 expedientes en paralelo son más de mil clics.

La idea es la del generador de instrumentos jurídicos: una sola elección
gobierna todas las apariciones. Aquí, además, casi nada se elige: el género de
la AC y el del responsable del área están en la Hoja de Datos, el del área sale
de su propio nombre, y el número (bien/bienes, día/días) se deriva de lo que ya
hay capturado. Solo queda por elegir el género del proveedor.

REGLA DE SEGURIDAD: esto trabaja con lista blanca. Un control se convierte solo
si una regla lo nombra explícitamente; cualquier otro se queda como está. Lo que
no es concordancia —«Cumple / No cumple», «Presencial / Virtual»— no se toca, y
no por criterio del momento sino porque no está en la lista.

    python3 scripts/concordancia.py --revisar     qué se convertiría y qué no
    python3 scripts/concordancia.py --aplicar     reescribe las plantillas
    python3 scripts/concordancia.py --verificar   que lo que no es concordancia sigue ahí
"""

import os
import re
import sys
import zipfile

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLANTILLAS = os.path.join(RAIZ, 'generador', 'plantillas')

# ---------------------------------------------------------------- los grupos
# Cada grupo es una elección que gobierna varias etiquetas a la vez. El orden de
# los valores es el orden de las opciones del grupo.
GRUPOS = {
    'generoAC': {
        'etiqueta': 'Administrador/a Contador/a (FIAS)',
        'opciones': ['Masculino', 'Femenino'],
        'tags': {
            'administradoracontadora':   ['administrador contador', 'administradora contadora'],
            'AdminContador':             ['Administrador Contador', 'Administradora Contadora'],
            'ellaadministradorcontador': ['el administrador contador', 'la administradora contadora'],
            'ElLaadministradorcontador': ['El administrador contador', 'La administradora contadora'],
            'ellaadministradorOrden':    ['el administrador', 'la administradora'],
            'ElLaadministradorOrden':    ['El administrador', 'La administradora'],
            'ADMINISTRADORorden':        ['ADMINISTRADOR', 'ADMINISTRADORA'],
            'SecretarioA':               ['Secretario', 'Secretaria'],
        }},
    'generoJefeAP': {
        'etiqueta': 'Responsable del área protegida (MAE)',
        'opciones': ['Masculino', 'Femenino'],
        'tags': {
            'ellaadministradorAP':  ['el administrador', 'la administradora'],
            'ElLaadministradorAP':  ['El administrador', 'La administradora'],
            'dellaadministradorAP': ['del administrador', 'de la administradora'],
            'AdministradoraAP':     ['Administrador', 'Administradora'],
            'administradorAP':      ['administrador', 'administradora'],
            'ordenadorA':           ['ordenador', 'ordenadora'],
            'elLaOrdenador':        ['el ordenador', 'la ordenadora'],
            'PresidenteA':          ['Presidente', 'Presidenta'],
        }},
    'generoProveedor': {
        'etiqueta': 'Proveedor (persona natural o empresa)',
        'opciones': ['Persona natural — masculino', 'Persona natural — femenino', 'Persona jurídica (empresa)'],
        'tags': {
            'elLaProveedor':    ['el proveedor', 'la proveedora', 'la empresa proveedora'],
            'ElLaProveedor':    ['El proveedor', 'La proveedora', 'La empresa proveedora'],
            'alALaProveedor':   ['al proveedor', 'a la proveedora', 'a la empresa proveedora'],
            'delDeLaProveedor': ['del proveedor', 'de la proveedora', 'de la empresa proveedora'],
            'ProveedorTitulo':  ['Proveedor', 'Proveedora', 'Proveedora'],
            'proveedorTrato':   ['Señor', 'Señora', 'Señores'],
            'adjudicadoA':      ['adjudicado', 'adjudicada', 'adjudicada'],
        }},
    'generoAP': {
        'etiqueta': 'Género del nombre del área protegida',
        'opciones': ['Masculino (el Parque, el Refugio)', 'Femenino (la Reserva, la Estación)'],
        'tags': {
            'ellaAP':  ['el', 'la'],
            'EllaAP':  ['El', 'La'],
            'dellaAP': ['del', 'de la'],
            'allaAP':  ['al', 'a la'],
        }},
    'generoDirector': {
        'etiqueta': 'Director/a Ejecutivo/a del FIAS',
        'opciones': ['Masculino', 'Femenino'],
        'tags': {
            'DirectorEjecutivo': ['Director Ejecutivo', 'Directora Ejecutiva'],
        }},
}

# Estas no se eligen: salen de lo que ya está capturado.
DERIVADAS = {
    'elLosProducto':                       'número de ítems',
    'ElLosProducto':                       'número de ítems',
    'delDeLosBien':                        'número de ítems',
    'describeDescriben':                   'número de ítems',
    'cumpleCumplen':                       'número de ítems',
    'diaDias':                             'plazo en días',
    'contadoContados':                     'plazo en días',
    'diaContadoDiasContados':              'plazo en días',
    'adquisicionContratacion':             'bien o servicio',
    'adquisicionBienContratacionServicio': 'bien o servicio',
    'delBienDelServicio':                  'bien o servicio y número de ítems',
    'finalizadoEntregado':                 'bien o servicio',
    'actaInforme':                         'tipo de proceso',
}

# ---------------------------------------------------------------- la lista blanca
# (opciones exactas del control, patrón que debe seguirle o None, etiqueta).
# Se prueban en orden; la primera que encaja manda. Lo que no encaja NO SE TOCA.
REGLAS = [
    # — el mismo texto para dos personas distintas: lo decide lo que viene detrás —
    ('el administrador|la administradora', r'^\s*de la orden',        'ellaadministradorOrden'),
    ('el administrador|la administradora', r'^\s*del instrumento',    'ellaadministradorOrden'),
    ('el administrador|la administradora', r'^\s*del área protegida', 'ellaadministradorAP'),
    ('El administrador|La administradora', r'^\s*de la orden',        'ElLaadministradorOrden'),
    ('ADMINISTRADOR|ADMINISTRADORA',       r'^\s*DE LA ORDEN',        'ADMINISTRADORorden'),
    ('del administrador|de la administradora', r'^\s*del área',       'dellaadministradorAP'),
    ('administrador|administradora',       r'^\s*del área',           'administradorAP'),
    ('Administrador|Administradora',       None,                      'AdministradoraAP'),

    # — género de la AC —
    ('Administrador contador|Administradora contadora', None, 'AdminContador'),
    ('Administrador Contador|Administradora Contadora', None, 'AdminContador'),
    ('administrador contador|administradora contadora', None, 'administradoracontadora'),
    ('el administrador contador|la administradora contadora', None, 'ellaadministradorcontador'),
    ('El administrador contador|La administradora contadora', None, 'ElLaadministradorcontador'),
    ('Secretario|Secretaria', None, 'SecretarioA'),

    # — género del responsable del área (que es el ordenador de gasto) —
    # Ojo: el texto de la plantilla ya dice «de gasto» justo después, así que la
    # etiqueta va sin ese trozo. Elegir la opción del cuadro dejaba «ordenador de
    # gasto de gasto» en los tres memorandos de inicio.
    ('ordenador de gasto|ordenadora de gasto', r'^\s*de gasto', 'ordenadorA'),
    ('ordenador|ordenadora',                   r'^\s*de gasto', 'ordenadorA'),
    ('el ordenador de gasto|la ordenadora de gasto', r'^\s*de gasto', 'elLaOrdenador'),
    ('Presidente|Presidenta', None, 'PresidenteA'),

    # — género del proveedor —
    ('el proveedor|la proveedora',    None, 'elLaProveedor'),
    ('El proveedor|La proveedora',    None, 'ElLaProveedor'),
    ('al proveedor|a la proveedora',  None, 'alALaProveedor'),
    ('de la proveedora|del proveedor', None, 'delDeLaProveedor'),   # ojo: femenino primero
    ('Proveedor|Proveedora',          None, 'ProveedorTitulo'),
    ('Señor|Señores|Señora',          None, 'proveedorTrato'),
    ('Señor|Señora|Señores',          None, 'proveedorTrato'),
    ('adjudicado|adjudicada',         None, 'adjudicadoA'),

    # — género del área: siempre pegado a {area}; delante de {objeto} NO, porque
    #   el objeto es texto libre y su género no se puede saber —
    ('del|de la', r'^\s*\{area\}', 'dellaAP'),
    ('de la|del', r'^\s*\{area\}', 'dellaAP'),
    ('el|la',     r'^\s*\{area\}', 'ellaAP'),
    ('El|La',     r'^\s*\{area\}', 'EllaAP'),

    ('Director Ejecutivo|Directora Ejecutiva', None, 'DirectorEjecutivo'),

    # — número y naturaleza: no se eligen, se derivan —
    ('el producto|los productos', None, 'elLosProducto'),
    ('El producto|Los productos', None, 'ElLosProducto'),
    ('del bien|de los bienes',    None, 'delDeLosBien'),
    ('describe|describen',        None, 'describeDescriben'),
    ('cumple|cumplen',            None, 'cumpleCumplen'),
    ('día|días',                  None, 'diaDias'),
    (' contado|contados',         None, 'contadoContados'),
    ('día contado|días contados', None, 'diaContadoDiasContados'),
    ('adquisición|contratación',  None, 'adquisicionContratacion'),
    ('adquisición del bien|contratación del servicio', None, 'adquisicionBienContratacionServicio'),
    ('del bien|de los bienes|del servicio|de los servicios', None, 'delBienDelServicio'),
    ('finalizado el servicio|se han entregado los bienes', None, 'finalizadoEntregado'),
    ('acta de adjudicación|informe de justificación', None, 'actaInforme'),
]

# Lo que se queda a mano, y por qué. Sirve de documentación y de comprobación:
# si algo de aquí acabara convirtiéndose, es un error.
NO_TOCAR = {
    'Cumple|No cumple':      'es un juicio sobre cada oferta, no una concordancia',
    'cumple|No cumple':      'es un juicio sobre cada oferta, no una concordancia',
    'Presencial|Virtual':    'es un hecho de la sesión: cómo asistió cada miembro',
    'solicitud|cotización':  'es qué documento se nombra, no una concordancia',
    'el|la {objeto}':        'el género del objeto es texto libre: no se puede saber',
}


# ---------------------------------------------------------------- barras a mano
# Además de los cuadros combinados, algunas plantillas traen la barra escrita
# directamente en el texto. Cada entrada es (texto exacto, con qué se sustituye).
# Si el texto no aparece en una plantilla, no pasa nada.
TEXTOS = [
    ('Administrador/a Contador/a',          '{AdminContador}'),
    ('el/la administrador/a',               '{ellaadministradorAP}'),
    ('del/la Administrador(a)',             '{dellaadministradorAP}'),
    ('Administrador/a del área protegida',  '{AdministradoraAP} del área protegida'),
    ('el/la proveedor',                     '{elLaProveedor}'),
]
# Lo que se queda con barra, a propósito: «el/la {objeto}» depende del género del
# objeto, que lo escribe la AC en texto libre. Elegir uno de los dos sería
# adivinar, y la barra al menos es honesta.


def _sustituir_en_parrafo(par, hechos):
    """Sustituye dentro de un párrafo, aunque Word haya partido el texto.

    Word corta una frase en varias corridas por cualquier motivo —un cambio de
    formato, una revisión vieja—, así que «el/la administrador/a» puede estar
    repartido entre dos. Se leen todas las corridas del párrafo como un texto
    seguido y, al sustituir, el reemplazo entero va a la primera corrida
    afectada y de las demás se recorta lo que cubría.
    """
    for literal, reemplazo in TEXTOS:
        while True:
            trozos = [(m.start(1), m.end(1), m.group(1))
                      for m in re.finditer(r'<w:t[^>]*>(.*?)</w:t>', par, re.S)]
            if not trozos:
                break
            texto = ''.join(t[2] for t in trozos)
            desde = texto.find(literal)
            if desde < 0:
                break
            hasta = desde + len(literal)
            # se reescriben de atrás hacia delante para no mover las posiciones
            inicio_de = []
            acc = 0
            for _, _, t in trozos:
                inicio_de.append(acc); acc += len(t)
            primero = None
            for k in range(len(trozos) - 1, -1, -1):
                ini_k = inicio_de[k]
                fin_k = ini_k + len(trozos[k][2])
                if fin_k <= desde or ini_k >= hasta:
                    continue
                a = max(desde, ini_k) - ini_k
                b = min(hasta, fin_k) - ini_k
                t = trozos[k][2]
                primero = k
                par = par[:trozos[k][0]] + t[:a] + t[b:] + par[trozos[k][1]:]
            if primero is None:
                break
            # el reemplazo entra donde empezaba el literal
            trozos = [(m.start(1), m.end(1), m.group(1))
                      for m in re.finditer(r'<w:t[^>]*>(.*?)</w:t>', par, re.S)]
            ini_k = inicio_de[primero]
            corte = desde - ini_k
            t = trozos[primero][2]
            par = (par[:trozos[primero][0]] + t[:corte] + reemplazo + t[corte:]
                   + par[trozos[primero][1]:])
            hechos.append(literal)
    return par


def sustituir_textos(xml):
    """Reemplaza las barras escritas a mano. Devuelve (xml, [cambios])."""
    hechos = []
    partes = re.split(r'(<w:p[ >].*?</w:p>)', xml, flags=re.S)
    for i, trozo in enumerate(partes):
        if trozo.startswith('<w:p') and '<w:t' in trozo:
            partes[i] = _sustituir_en_parrafo(trozo, hechos)
    return ''.join(partes), hechos


def _tags_conocidas():
    t = {}
    for g, d in GRUPOS.items():
        for tag in d['tags']:
            t[tag] = g
    for tag, origen in DERIVADAS.items():
        t[tag] = 'derivada · ' + origen
    return t


def analizar(ruta):
    """Devuelve (xml, [(inicio, fin, opciones, texto_siguiente, tag_o_None)])."""
    xml = zipfile.ZipFile(ruta).read('word/document.xml').decode('utf8')
    plano = []
    for m in re.finditer(r'<w:sdt>.*?</w:sdt>', xml, re.S):
        s = m.group(0)
        if '<w:comboBox' not in s and '<w:dropDownList' not in s:
            continue
        ops = '|'.join(re.findall(r'w:displayText="([^"]*)"', s))
        if not ops:
            continue
        # texto que sigue, ya sin marcas, para poder discriminar
        cola = re.sub(r'<[^>]+>', '', xml[m.end():m.end() + 900])[:60]
        tag = None
        for o, patron, t in REGLAS:
            if o != ops:
                continue
            if patron is None or re.match(patron, cola):
                tag = t
                break
        plano.append((m.start(), m.end(), ops, cola, tag))
    return xml, plano


def _escribir(ruta, xml_nuevo):
    tmp = ruta + '.tmp'
    with zipfile.ZipFile(ruta) as z, zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as out:
        for i in z.infolist():
            out.writestr(i, xml_nuevo.encode('utf8') if i.filename == 'word/document.xml'
                         else z.read(i.filename))
    os.replace(tmp, ruta)


def _rpr_de(sdt):
    m = re.search(r'<w:sdtContent>.*?<w:rPr>(.*?)</w:rPr>', sdt, re.S)
    return m.group(1) if m else ('<w:rFonts w:ascii="Titillium Web" w:hAnsi="Titillium Web"/>'
                                 '<w:sz w:val="22"/><w:szCs w:val="22"/>')


def convertir(ruta, escribir=False):
    xml, ctrls = analizar(ruta)
    conv, quedan = [], []
    for ini, fin, ops, cola, tag in ctrls:
        (conv if tag else quedan).append((ops, cola, tag))
    if escribir and not conv:
        # Plantillas sin ningún cuadro combinado (las de renovación) pueden traer
        # igualmente barras escritas a mano.
        salida, hechos = sustituir_textos(xml)
        if hechos:
            _escribir(ruta, salida)
    if escribir and conv:
        nuevo, pos = [], 0
        for ini, fin, ops, cola, tag in ctrls:
            if not tag:
                continue
            nuevo.append(xml[pos:ini])
            nuevo.append('<w:r><w:rPr>%s</w:rPr><w:t xml:space="preserve">{%s}</w:t></w:r>'
                         % (_rpr_de(xml[ini:fin]), tag))
            pos = fin
        nuevo.append(xml[pos:])
        salida, _ = sustituir_textos(''.join(nuevo))
        _escribir(ruta, salida)
    return conv, quedan


# Lo que TIENE que seguir habiendo después de convertir. Si un día una regla
# nueva se llevara por delante un control de juicio, esto lo caza.
INTOCABLES = {
    'Cumple|No cumple': 18,
    'Presencial|Virtual': 3,
    'solicitud|cotización': 2,
    'el|la': 1,          # el que va delante de {objeto}
}


def cmd_verificar():
    """Comprueba que lo que no es concordancia sigue estando."""
    import collections
    hay = collections.Counter()
    for f in sorted(os.listdir(PLANTILLAS)):
        if not f.endswith('.docx'):
            continue
        xml = zipfile.ZipFile(os.path.join(PLANTILLAS, f)).read('word/document.xml').decode('utf8')
        for sdt in re.findall(r'<w:sdt>.*?</w:sdt>', xml, re.S):
            if '<w:comboBox' in sdt or '<w:dropDownList' in sdt:
                ops = '|'.join(re.findall(r'w:displayText="([^"]*)"', sdt))
                if ops:
                    hay[ops] += 1
    mal = 0
    for ops, esperados in sorted(INTOCABLES.items()):
        n = hay.get(ops, 0)
        ok = (n == esperados)
        mal += 0 if ok else 1
        print('  %s %-24s %d de %d' % ('✓' if ok else '✗', ops, n, esperados))
    sobran = {o: n for o, n in hay.items() if o not in INTOCABLES}
    if sobran:
        mal += 1
        print('  ✗ quedaron controles sin declarar: %s' % sobran)
    if mal:
        print('\nAlgo se llevó por delante un control que no es de concordancia.')
        return 1
    print('\n  Los %d controles que no son concordancia siguen intactos.' % sum(INTOCABLES.values()))
    return 0


def main():
    escribir = '--aplicar' in sys.argv
    if '--verificar' in sys.argv:
        return cmd_verificar()
    if not escribir and '--revisar' not in sys.argv:
        raise SystemExit(__doc__)

    conocidas = _tags_conocidas()
    total_c = total_q = 0
    resto = {}
    for f in sorted(os.listdir(PLANTILLAS)):
        if not f.endswith('.docx'):
            continue
        conv, quedan = convertir(os.path.join(PLANTILLAS, f), escribir)
        total_c += len(conv); total_q += len(quedan)
        for ops, cola, _ in quedan:
            resto.setdefault(ops, []).append(f)
        if conv or quedan:
            print('  %-46s convierte %3d · deja %2d' % (f, len(conv), len(quedan)))

    print('\n%s %d controles · quedan a mano %d'
          % ('CONVERTIDOS' if escribir else 'SE CONVERTIRÍAN', total_c, total_q))

    print('\nLO QUE NO SE TOCA')
    for ops, arch in sorted(resto.items(), key=lambda kv: -len(kv[1])):
        razon = NO_TOCAR.get(ops)
        if razon is None and ops.startswith('el|la'):
            razon = NO_TOCAR['el|la {objeto}']
        print('  %2d ×  %-34s %s' % (len(arch), ops[:34], razon or '⚠ SIN REGLA — revisar'))

    sin_razon = [o for o in resto if o not in NO_TOCAR and not o.startswith('el|la')]
    if sin_razon:
        print('\n⚠ Hay controles sin regla y sin motivo declarado. O se añaden a REGLAS,')
        print('  o se declaran en NO_TOCAR con su razón. No se tocan mientras tanto.')
        return 1

    print('\nETIQUETAS QUE HACEN FALTA (%d)' % len(conocidas))
    for g in list(GRUPOS) + ['derivadas']:
        if g == 'derivadas':
            print('  · derivadas (no se eligen): %s' % ', '.join(sorted(DERIVADAS)))
        else:
            print('  · %-16s %s' % (g, ', '.join(sorted(GRUPOS[g]['tags']))))
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except BrokenPipeError:
        sys.exit(0)
