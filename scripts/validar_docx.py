#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Comprueba que los .docx de verdad se abren en Word.

Que un .docx sea un zip con XML bien formado NO significa que Word lo abra. En
septiembre de 2026 se subieron a `main` once plantillas que Word declaraba
dañadas: al convertir los cuadros combinados en variables se sustituyó un
<w:sdt> que envolvía un PÁRRAFO entero por una corrida suelta, y quedó un <w:r>
donde iba un <w:p>. XML impecable, documento inservible.

Lo grave fue que no había forma de notarlo: python-docx abría las once sin
protestar, y LibreOffice las convertía a PDF tan contento. Los dos son
permisivos; Word no. Por eso esto valida contra el esquema oficial ISO/IEC
29500-4:2016, que está en scripts/esquemas/ y sí las rechaza, señalando además
el elemento exacto.

    python3 scripts/validar_docx.py                      las plantillas del repo
    python3 scripts/validar_docx.py <carpeta|archivo>    lo que se le diga

Sin lxml instalado hace solo las comprobaciones de estructura, que son de
biblioteca estándar y ya cazan el fallo de arriba. Con lxml (pip install lxml)
añade el esquema completo, que además caza el orden de los hijos —<w:tblBorders>
detrás de <w:tblLayout>, por ejemplo—, cosa que la estructura sola no ve.
"""

import os
import sys
import zipfile
import xml.etree.ElementTree as ET

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLANTILLAS = os.path.join(RAIZ, 'generador', 'plantillas')
ESQUEMA = os.path.join(RAIZ, 'scripts', 'esquemas', 'ISO-IEC29500-4_2016', 'wml.xsd')

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'

# Dónde puede vivir cada elemento del cuerpo. Un <w:r> dentro de <w:tc> o de
# <w:body> es XML válido y Word no lo abre.
PADRES = {
    'w:r':  {'w:p', 'w:hyperlink', 'w:ins', 'w:del', 'w:smartTag', 'w:sdtContent',
             'w:fldSimple', 'w:dir', 'w:bdo', 'w:moveFrom', 'w:moveTo', 'w:rt',
             'w:rubyBase', 'w:customXml'},
    'w:t':  {'w:r'},
    'w:p':  {'w:body', 'w:tc', 'w:sdtContent', 'w:txbxContent', 'w:hdr', 'w:ftr',
             'w:footnote', 'w:endnote', 'w:comment', 'w:docPartBody', 'w:customXml'},
    'w:tr': {'w:tbl', 'w:sdtContent', 'w:customXml'},
    'w:tc': {'w:tr', 'w:sdtContent', 'w:customXml'},
}
PARTES_CUERPO = ('word/document.xml', 'word/header', 'word/footer',
                 'word/footnotes.xml', 'word/endnotes.xml')

# El esquema ISO no conoce las extensiones de Word 2010/2013 (w14:paraId,
# wp14:sizeRelH, w14:checkbox, mc:Ignorable…). Word las escribe y las acepta;
# no son un defecto.
def _es_ruido(m):
    if "Element '{http://schemas.microsoft.com/office/word/20" in m:
        return True
    if "Element '{http://schemas.microsoft.com/office/drawing/" in m:
        return True
    if 'attribute' in m and ('/office/word/20' in m or '/markup-compatibility/' in m
                             or '/office/drawing/' in m or '/office/2006/' in m):
        return True
    return False


def _n(t):
    return t.replace(W, 'w:')


def revisar_estructura(z):
    fallos = []
    if z.testzip():
        fallos.append('entrada corrupta en el zip')
    nombres = set(z.namelist())
    for req in ('[Content_Types].xml', '_rels/.rels', 'word/document.xml'):
        if req not in nombres:
            fallos.append('falta %s' % req)
    for parte in sorted(x for x in nombres if x.endswith('.rels')):
        base = os.path.dirname(os.path.dirname(parte))
        try:
            r = ET.fromstring(z.read(parte))
        except Exception as e:
            fallos.append('%s no parsea: %s' % (parte, e))
            continue
        for rel in r:
            destino = rel.get('Target', '')
            if rel.get('TargetMode') == 'External' or destino.startswith('http'):
                continue
            ruta = os.path.normpath(os.path.join(base, destino)).replace('\\', '/')
            if ruta not in nombres:
                fallos.append('%s apunta a una parte inexistente: %s' % (parte, destino))
    for parte in sorted(x for x in nombres
                        if x.endswith('.xml') and x.startswith(PARTES_CUERPO)):
        try:
            raiz = ET.fromstring(z.read(parte))
        except Exception as e:
            fallos.append('%s no parsea: %s' % (parte, e))
            continue
        for padre in raiz.iter():
            for hijo in padre:
                h = _n(hijo.tag)
                if h in PADRES and _n(padre.tag) not in PADRES[h]:
                    fallos.append('%s: <%s> dentro de <%s>, ahí no puede ir'
                                  % (parte, h, _n(padre.tag)))
    vistos, out = set(), []
    for f in fallos:
        if f not in vistos:
            vistos.add(f)
            out.append(f)
    return out


def revisar_esquema(z, validador):
    from lxml import etree
    fallos = []
    for parte in sorted(x for x in z.namelist()
                        if x.endswith('.xml') and x.startswith(PARTES_CUERPO)):
        try:
            doc = etree.fromstring(z.read(parte))
        except Exception as e:
            fallos.append('%s no parsea: %s' % (parte, e))
            continue
        if not validador.validate(doc):
            for e in validador.error_log:
                if not _es_ruido(e.message):
                    fallos.append('%s: %s' % (parte, e.message))
    return fallos


def cargar_validador():
    if not os.path.exists(ESQUEMA):
        return None, 'no encuentro el esquema en scripts/esquemas/'
    try:
        from lxml import etree
    except ImportError:
        return None, 'sin lxml (pip install lxml) — solo comprobación de estructura'
    try:
        return etree.XMLSchema(etree.parse(ESQUEMA)), None
    except Exception as e:
        return None, 'el esquema no cargó: %s' % e


def validar(objetivo=None):
    """Valida una carpeta o un archivo. Devuelve 0 si todo abre, 1 si no."""
    objetivo = objetivo or PLANTILLAS
    if os.path.isdir(objetivo):
        archivos = [os.path.join(objetivo, f) for f in sorted(os.listdir(objetivo))
                    if f.endswith('.docx')]
    else:
        archivos = [objetivo]
    if not archivos:
        raise SystemExit('No hay .docx en ' + objetivo)

    validador, aviso = cargar_validador()
    if aviso:
        print('· %s\n' % aviso)

    malos = 0
    for ruta in archivos:
        nombre = os.path.basename(ruta)
        try:
            z = zipfile.ZipFile(ruta)
        except Exception as e:
            malos += 1
            print('✗ %-46s no es un zip válido: %s' % (nombre, e))
            continue
        fallos = revisar_estructura(z)
        if validador is not None:
            fallos += revisar_esquema(z, validador)
        if fallos:
            malos += 1
            print('✗ %s' % nombre)
            for f in fallos[:5]:
                print('     %s' % f[:160])
            if len(fallos) > 5:
                print('     … y %d más' % (len(fallos) - 5))
        else:
            print('✓ %s' % nombre)

    print('\n%s' % ('%d documento(s) que Word no abriría' % malos if malos
                    else 'los %d se abren: estructura y esquema correctos' % len(archivos)))
    return 1 if malos else 0


def main():
    return validar(sys.argv[1] if len(sys.argv) > 1 else None)


if __name__ == '__main__':
    try:
        sys.exit(main())
    except BrokenPipeError:
        sys.exit(0)
