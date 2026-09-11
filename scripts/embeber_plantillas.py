#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Reconstruye el seed embebido de La Mágica desde generador/plantillas/.

El seed (`window.__SEED__`, la línea larga de generador/index.html) lleva las
plantillas Word en base64 para que la herramienta funcione abierta desde el
disco, sin conexión y sin la carpeta al lado. Antes se incrustaba a mano; con
este script, cambiar o añadir una plantilla es dejar el .docx en la carpeta y
volver a correrlo.

El `cfg` de ejemplo que ya trae el seed se conserva tal cual.

Uso:
    python3 scripts/embeber_plantillas.py
    python3 scripts/embeber_plantillas.py --check    # solo verifica, no escribe
"""

import base64
import io
import json
import os
import re
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HTML = os.path.join(RAIZ, 'generador', 'index.html')
PLANTILLAS = os.path.join(RAIZ, 'generador', 'plantillas')
MARCA = 'window.__SEED__='

# Orden en que se embeben: el mismo de TPL_SLOTS en la app, para que el
# diff del seed sea estable entre corridas.
ORDEN = [
    '1_Inicio_comparacion.docx',
    '2_Inicio_seleccion.docx',
    '11_Inicio_compra_directa.docx',
    '3_Invitacion_comparacion.docx',
    '4_Invitacion_seleccion.docx',
    '5_Acta_adjudicacion.docx',
    '6_Informe_justificacion.docx',
    '7_Orden_de_compra.docx',
    '8_Orden_de_servicio.docx',
    '9_Acta_entrega_recepcion.docx',
    '10_Informe_satisfaccion.docx',
    '18_Informe_satisfaccion_CD.docx',
    '12_Acta_entrega_area_protegida.docx',
    '13_Acta_entrega_area_control.docx',
    '16_Orden_de_compra_director.docx',
    '17_Orden_de_servicio.docx',
    '19_Informe_satisfaccion_renovacion.docx',
    '20_Solicitud_cotizacion_renovacion.docx',
]


def leer_lineas():
    with io.open(HTML, encoding='utf8') as f:
        return f.readlines()


def indice_seed(lineas):
    for i, l in enumerate(lineas):
        if MARCA in l:
            return i
    raise SystemExit('No encuentro la línea del seed en ' + HTML)


def seed_actual(linea):
    m = re.search(r'window\.__SEED__=(\{.*\});', linea.strip())
    if not m:
        raise SystemExit('La línea del seed no tiene la forma esperada.')
    return json.loads(m.group(1))


def construir_seed(cfg):
    archivos = sorted(f for f in os.listdir(PLANTILLAS) if f.endswith('.docx'))
    faltan = [f for f in archivos if f not in ORDEN]
    if faltan:
        raise SystemExit('Plantillas sin lugar en ORDEN (agrégalas al script '
                         'y a TPL_SLOTS en la app): ' + ', '.join(faltan))
    tpls = {}
    for nombre in ORDEN:
        ruta = os.path.join(PLANTILLAS, nombre)
        if not os.path.exists(ruta):
            print('  · aviso: falta ' + nombre + ' en la carpeta; se omite')
            continue
        with open(ruta, 'rb') as f:
            tpls[nombre] = base64.b64encode(f.read()).decode('ascii')
    seed = {'v': None, 'tpls': tpls}
    if cfg:
        seed['cfg'] = cfg
    return seed


def serializar(seed):
    # separators sin espacios: el seed pesa ~2 MB, cada byte cuenta.
    cuerpo = json.dumps(seed, ensure_ascii=False, separators=(',', ':'))
    return '<script>window.__SEED__=' + cuerpo + ';</script>\n'


def main():
    solo_check = '--check' in sys.argv
    lineas = leer_lineas()
    i = indice_seed(lineas)
    viejo = seed_actual(lineas[i])

    seed = construir_seed(viejo.get('cfg'))
    # La versión del seed solo sube si las plantillas cambiaron: así una copia
    # ya instalada no vuelve a pisar nada sin motivo.
    if seed['tpls'] == viejo.get('tpls'):
        print('El seed ya está al día (%d plantillas, v=%s).'
              % (len(seed['tpls']), viejo.get('v')))
        return 0
    if solo_check:
        print('DESACTUALIZADO: el seed no coincide con generador/plantillas/. '
              'Corre: python3 scripts/embeber_plantillas.py')
        return 1

    nuevas = sorted(set(seed['tpls']) - set(viejo.get('tpls') or {}))
    cambiadas = sorted(k for k in seed['tpls']
                       if k in (viejo.get('tpls') or {})
                       and seed['tpls'][k] != viejo['tpls'][k])
    quitadas = sorted(set(viejo.get('tpls') or {}) - set(seed['tpls']))

    seed['v'] = int(max(os.path.getmtime(os.path.join(PLANTILLAS, k))
                        for k in seed['tpls']) * 1000)
    if seed['v'] <= int(viejo.get('v') or 0):
        seed['v'] = int(viejo.get('v') or 0) + 1

    lineas[i] = serializar(seed)
    with io.open(HTML, 'w', encoding='utf8') as f:
        f.writelines(lineas)

    print('Seed reconstruido: %d plantillas, v=%d' % (len(seed['tpls']), seed['v']))
    for k in nuevas:
        print('  + ' + k)
    for k in cambiadas:
        print('  ~ ' + k)
    for k in quitadas:
        print('  - ' + k)
    print('  tamaño: %.2f MB' % (len(lineas[i]) / 1024.0 / 1024.0))
    return 0


if __name__ == '__main__':
    sys.exit(main())
