#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""El idioma de las plantillas: catálogo de variables del FAP.

`generador/variables_fap.json` es la copia en el repositorio del catálogo de
variables que maneja el sistema. Vive aquí porque es aquí donde están las
plantillas: quien escriba una plantilla nueva —persona o Claude— tiene que usar
estos nombres y no inventar sinónimos. Ya pasó una vez: la vía de renovación
nació con `contratoAnterior`, `fechaFinAnterior`, `montoAnterior` y
`fechaNotificacion`, que eran `contratoNro`, `fechaFin`, `montoTotal` y
`fechanotificacion`; los tres primeros los publica el CRM, así que el sinónimo
convertía en tecleo lo que podía ser precarga.

Una copia en git se queda vieja sin avisar, y por eso está `--check`: contrasta
el catálogo contra lo que las plantillas usan de verdad.

    python3 scripts/variables.py                 lista los grupos
    python3 scripts/variables.py Fechas          lista un grupo
    python3 scripts/variables.py --buscar monto  busca por nombre o descripción
    python3 scripts/variables.py --check         verifica plantillas contra catálogo
    python3 scripts/variables.py --unir <a.json> funde un export del sistema con esta copia

El `--unir` sirve en los dos sentidos: para traer al repositorio lo que se haya
creado en el sistema, y para preparar el archivo que se importa al sistema con
lo que se haya creado aquí. Nunca borra ni pisa una variable existente.
"""

import json
import os
import re
import sys
import unicodedata

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CATALOGO = os.path.join(RAIZ, 'generador', 'variables_fap.json')
PLANTILLAS = os.path.join(RAIZ, 'generador', 'plantillas')

# Carpetas que se saltan al buscar plantillas. `bases/` lleva .docx de verdad,
# pero se rellenan A MANO y usan [CORCHETES], no etiquetas de docxtemplater:
# validarlas contra el catálogo no significaría nada. Está declarado aquí, y no
# omitido en silencio, para que el día que alguien se pregunte por qué no se
# comprueban tenga la respuesta escrita.
CARPETAS_A_MANO = {'bases'}
CARPETAS_IGNORADAS = {'.git', 'node_modules', '__pycache__', 'esquemas', 'vendor'}


def cargar(ruta=CATALOGO):
    with open(ruta, encoding='utf8') as f:
        return json.load(f)


def por_nombre(cat=None):
    cat = cat or cargar()
    return {v['nombre']: v for v in cat['variables']}


def subcampos(cat=None):
    """Los campos de dentro de cada bloque repetible, leídos de su descripción.

    Se guardan ahí y no en una clave aparte para no cambiarle el esquema al
    catálogo del sistema: lo que este repositorio escribe, el sistema lo importa.
    """
    cat = cat or cargar()
    out = {}
    for v in cat['variables']:
        if v.get('tipo') != 'repetible':
            continue
        m = re.search(r'(?:[Cc]ampos:?)\s+([a-zA-Z0-9_,\s]+)', v.get('descripcion', ''))
        out[v['nombre']] = ([c.strip() for c in m.group(1).split(',') if c.strip()]
                            if m else [])
    return out


# Un .docx guarda el texto en varias partes, y una etiqueta puede vivir en
# cualquiera. Mirar solo el cuerpo dejaba fuera {cedulaJefe} y {correoJefe}, que
# están en el encabezado de las actas de entrega: nunca se habían comprobado.
PARTES_TEXTO = re.compile(
    r'^word/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$')

RE_ETIQUETA = re.compile(
    r'\{([#/^]?)([A-Za-zÁÉÍÓÚÑáéíóúñ_][A-Za-z0-9ÁÉÍÓÚÑáéíóúñ_]*)\}')


def _texto_docx(ruta):
    """El texto de todas las partes del .docx, sin etiquetas XML.

    Word parte una etiqueta en varias corridas <w:r> cuando uno la edita, así
    que hay que quitar el marcado ANTES de buscar: si no, `{monto` y `Total}`
    parecen dos cosas distintas.
    """
    import zipfile
    z = zipfile.ZipFile(ruta)
    partes = []
    for n in z.namelist():
        if PARTES_TEXTO.match(n):
            partes.append((n, re.sub(r'<[^>]+>', '', z.read(n).decode('utf8', 'replace'))))
    return partes


def etiquetas_docx(ruta):
    return set(t for _, t in etiquetas_docx_detalle(ruta))


def etiquetas_docx_detalle(ruta):
    """(sigilo, nombre) de cada etiqueta, EN ORDEN.

    El sigilo —`#`, `^`, `/` o vacío— es lo que distingue el principio de un
    bucle de una variable suelta, y el orden es lo que permite saber dentro de
    qué bloque está cada una. `etiquetas_docx()` lo tiraba todo.
    """
    out = []
    for _, texto in _texto_docx(ruta):
        out.extend(RE_ETIQUETA.findall(texto))
    return out


def descubrir_plantillas(raiz=RAIZ):
    """Todas las carpetas del repositorio que contienen .docx.

    Se descubren en vez de listarse para que una herramienta nueva quede
    cubierta el día que nace. Antes esto miraba solo generador/plantillas/, y
    por ese hueco el Calificador creció con su propio vocabulario sin que nada
    se quejara.
    """
    out = {}
    for carpeta, subdirs, ficheros in os.walk(raiz):
        subdirs[:] = [d for d in subdirs if d not in CARPETAS_IGNORADAS]
        docs = sorted(f for f in ficheros
                      if f.endswith('.docx') and not f.startswith('~$'))
        if docs:
            rel = os.path.relpath(carpeta, raiz).replace(os.sep, '/')
            out[rel] = [os.path.join(carpeta, f) for f in docs]
    return dict(sorted(out.items()))


def _parecidas(nombre, conocidas):
    """Nombres del catálogo que solo se diferencian por mayúsculas o acentos.

    Un `fechaContratoo` o un `MontoTotal` casi nunca es un concepto nuevo: es un
    error de tipeo, y decirlo ahorra el viaje de ir a buscarlo al catálogo.
    """
    n = _norm(nombre)
    return sorted(c for c in conocidas if c != nombre and _norm(c) == n)


# ---------------------------------------------------------------- validación

def validar(etiquetas, contexto='', cat=None):
    """Devuelve las etiquetas que no están en el catálogo.

    La usan los generadores de plantillas antes de escribir el .docx, para que
    un nombre inventado no llegue nunca a una plantilla.
    """
    cat = cat or cargar()
    conocidas = set(por_nombre(cat))
    for campos in subcampos(cat).values():
        conocidas.update(campos)
    return sorted(t for t in etiquetas if t not in conocidas)


def exigir(etiquetas, contexto=''):
    faltan = validar(etiquetas)
    if faltan:
        raise SystemExit(
            'Estas etiquetas no están en el catálogo de variables%s:\n  %s\n\n'
            'O usan un nombre que el catálogo ya tiene con otro (míralo con\n'
            '  python3 scripts/variables.py --buscar <palabra>),\n'
            'o son de verdad nuevas y hay que añadirlas a generador/variables_fap.json\n'
            'y luego importarlas al sistema.'
            % ((' de ' + contexto) if contexto else '', '\n  '.join(faltan)))


# ---------------------------------------------------------------- órdenes

def cmd_grupos():
    cat = cargar()
    grupos = {}
    for v in cat['variables']:
        grupos.setdefault(v['grupo'], []).append(v['nombre'])
    print('%d variables en %d grupos\n' % (len(cat['variables']), len(grupos)))
    for g in sorted(grupos):
        print('  %-28s %3d' % (g, len(grupos[g])))
    print('\nPara ver uno:  python3 scripts/variables.py "<grupo>"')


def cmd_grupo(nombre):
    cat = cargar()
    hay = [v for v in cat['variables'] if v['grupo'].lower() == nombre.lower()]
    if not hay:
        parecidos = sorted({v['grupo'] for v in cat['variables']
                            if nombre.lower() in v['grupo'].lower()})
        raise SystemExit('No hay un grupo «%s».%s' % (
            nombre, ('\n¿Querías: ' + ', '.join(parecidos) + '?') if parecidos else ''))
    print('%s — %d variables\n' % (hay[0]['grupo'], len(hay)))
    for v in sorted(hay, key=lambda x: x['nombre'].lower()):
        linea = '  {%s}' % v['nombre']
        print('%-38s %s' % (linea, v.get('tipo', '')))
        if v.get('descripcion'):
            print('      %s' % v['descripcion'])
        if v.get('ejemplo'):
            print('      ej.: %s' % v['ejemplo'])
        if v.get('origen'):
            print('      se calcula desde {%s}' % v['origen'])


def _norm(s):
    """Sin acentos, sin espacios y en minúsculas.

    Los nombres del catálogo van pegados (`ellaadministradorcontador`) y las
    descripciones separadas («Administrador/a Contador/a»), así que buscar la
    cadena tal cual no encuentra lo que uno tiene en la cabeza.
    """
    s = unicodedata.normalize('NFD', s.lower())
    return ''.join(c for c in s if unicodedata.category(c) != 'Mn' and c.isalnum())


def cmd_buscar(texto):
    cat = cargar()
    t = _norm(texto)
    hay = [v for v in cat['variables']
           if t in _norm(v['nombre']) or t in _norm(v.get('descripcion', ''))
           or t in _norm(v.get('ejemplo', ''))]
    if not hay:
        raise SystemExit('Nada coincide con «%s».' % texto)
    print('%d coincidencia(s) con «%s»\n' % (len(hay), texto))
    for v in sorted(hay, key=lambda x: x['nombre'].lower()):
        print('  {%-32s %-9s %s' % (v['nombre'] + '}', v.get('tipo', ''), v['grupo']))
        if v.get('descripcion'):
            print('      %s' % v['descripcion'])


def cmd_check():
    cat = cargar()
    nombres = por_nombre(cat)
    subs = subcampos(cat)
    conocidas = set(nombres)
    for campos in subs.values():
        conocidas.update(campos)

    problemas = 0
    usadas = set()
    total_docs = 0
    for carpeta, rutas in descubrir_plantillas().items():
        if carpeta in CARPETAS_A_MANO:
            print('  · %s — %d .docx de relleno manual ([CORCHETES]); no se validan'
                  % (carpeta, len(rutas)))
            continue
        total_docs += len(rutas)
        for ruta in rutas:
            etq = etiquetas_docx(ruta)
            usadas |= etq
            fuera = sorted(t for t in etq if t not in conocidas)
            if not fuera:
                continue
            problemas += 1
            print('  ✗ %s/%s usa etiquetas fuera del catálogo:'
                  % (carpeta, os.path.basename(ruta)))
            for t in fuera:
                cerca = _parecidas(t, conocidas)
                if cerca:
                    print('      {%s}  ¿querías {%s}? (difiere solo en mayúsculas o acentos)'
                          % (t, '} o {'.join(cerca)))
                else:
                    print('      {%s}' % t)

    # Los campos declarados de un bloque tienen que existir de verdad. Sin esto,
    # {provs} podía declarar `n, ruc, dir, tel, monto` —que ninguna plantilla
    # usa— y callarse el `hof` que sí está.
    declarados_fantasma = sorted(
        {n for campos in subs.values() for n in campos if n not in usadas})
    if declarados_fantasma:
        print('  · aviso: campos declarados en un bloque que ninguna plantilla usa: %s'
              % ', '.join(declarados_fantasma))

    vacios = [n for n, c in subs.items() if not c]
    if vacios:
        print('  · aviso: estos bloques repetibles no dicen qué campos llevan: %s'
              % ', '.join(sorted(vacios)))

    if problemas:
        print('\n%d plantilla(s) con etiquetas sin catalogar.' % problemas)
        print('Búscalas antes de darlas por nuevas:  python3 scripts/variables.py --buscar <palabra>')
        return 1
    print('  ✓ las %d plantillas usan solo variables del catálogo (%d variables)'
          % (total_docs, len(cat['variables'])))
    sin_usar = len([n for n in nombres if n not in usadas])
    print('  · %d variables del catálogo no las usa ninguna plantilla Word '
          '(son de las plantillas HTML del CLM y de concordancia)' % sin_usar)
    return 0


def cmd_unir(ruta):
    propio = cargar()
    ajeno = cargar(ruta)
    tengo = {v['nombre'] for v in propio['variables']}
    nuevas = [v for v in ajeno.get('variables', []) if v['nombre'] not in tengo]
    if not nuevas:
        print('Nada que traer: el catálogo ya tiene todo lo de ese archivo.')
        return 0
    propio['variables'].extend(nuevas)
    propio['variables'].sort(key=lambda v: (v['grupo'], v['nombre'].lower()))
    with open(CATALOGO, 'w', encoding='utf8') as f:
        json.dump(propio, f, ensure_ascii=False, indent=2)
    print('Añadidas %d variable(s):' % len(nuevas))
    for v in nuevas:
        print('  + {%s}  (%s)' % (v['nombre'], v['grupo']))
    return 0


def main():
    a = sys.argv[1:]
    if not a:
        cmd_grupos(); return 0
    if a[0] == '--check':
        return cmd_check()
    if a[0] == '--buscar':
        if len(a) < 2: raise SystemExit('Falta qué buscar.')
        cmd_buscar(' '.join(a[1:])); return 0
    if a[0] == '--unir':
        if len(a) < 2: raise SystemExit('Falta el archivo a unir.')
        return cmd_unir(a[1])
    cmd_grupo(' '.join(a)); return 0


if __name__ == '__main__':
    # Estas órdenes se canalizan a head o grep todo el tiempo; sin esto, cortar
    # la tubería suelta un rastreo de error feo en medio del listado.
    try:
        sys.exit(main())
    except BrokenPipeError:
        try: sys.stdout.close()
        except Exception: pass
        sys.exit(0)
