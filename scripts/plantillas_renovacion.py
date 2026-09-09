#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Genera las tres plantillas Word de la vía de renovación.

La Mágica solo conocía comparación de precios, selección directa por excepción y
compra directa. El plan de renovaciones 2027 abre una cuarta vía —39 expedientes—
cuyos documentos no tenían plantilla:

  19_Informe_satisfaccion_renovacion.docx   bloque 1, no necesita el PAG
  20_Solicitud_cotizacion_renovacion.docx   bloque 2, necesita el PAG aprobado
  21_Notificacion_renovacion.docx           bloque 2

Las tres se arman sobre el paquete de una plantilla existente (membrete, pie de
página con el logo, estilos, fuentes Titillium Web y márgenes institucionales):
se reemplaza únicamente el cuerpo de word/document.xml y se conserva todo lo
demás, así el formato es exactamente el mismo que el del resto de documentos.

Uso:
    python3 scripts/plantillas_renovacion.py [carpeta_plantillas]

Por defecto escribe en generador/plantillas/. Después de correrlo hay que
regenerar el seed embebido:
    python3 scripts/embeber_plantillas.py
"""

import os
import re
import shutil
import sys
import zipfile

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = '2_Inicio_seleccion.docx'   # paquete del que se hereda el membrete

FUENTE = '<w:rFonts w:ascii="Titillium Web" w:hAnsi="Titillium Web"/>'
TAM = '<w:sz w:val="22"/><w:szCs w:val="22"/>'


def x(s):
    """Escapa texto para XML."""
    return (s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;'))


def run(texto, negrita=False, cursiva=False, blanco=False):
    rpr = FUENTE
    if negrita:
        rpr += '<w:b/><w:bCs/>'
    if cursiva:
        rpr += '<w:i/><w:iCs/>'
    if blanco:
        rpr += '<w:color w:val="FFFFFF"/>'
    rpr += TAM
    return ('<w:r><w:rPr>' + rpr + '</w:rPr>'
            '<w:t xml:space="preserve">' + x(texto) + '</w:t></w:r>')


def runs(partes):
    """partes: lista de str (texto normal) o (texto, 'b'|'i'|'bi')."""
    out = ''
    for p in partes:
        if isinstance(p, tuple):
            t, m = p
            out += run(t, negrita='b' in m, cursiva='i' in m)
        else:
            out += run(p)
    return out


def p(partes, jc='both', espacio_despues=120, negrita=False, sangria=0):
    """Un párrafo. `partes` puede ser un string o una lista para runs()."""
    if isinstance(partes, str):
        partes = [(partes, 'b')] if negrita else [partes]
    ppr = '<w:pPr>'
    ppr += '<w:spacing w:after="%d" w:line="259" w:lineRule="auto"/>' % espacio_despues
    if sangria:
        ppr += '<w:ind w:left="%d"/>' % sangria
    ppr += '<w:jc w:val="%s"/>' % jc
    ppr += '<w:rPr>' + FUENTE + TAM + '</w:rPr></w:pPr>'
    return '<w:p>' + ppr + runs(partes) + '</w:p>'


def titulo(texto, jc='center'):
    return p([(texto, 'b')], jc=jc, espacio_despues=200)


def seccion(texto):
    return p([(texto, 'b')], jc='both', espacio_despues=80)


def vacio(altura=120):
    return ('<w:p><w:pPr><w:spacing w:after="%d"/><w:rPr>' % altura
            + FUENTE + TAM + '</w:rPr></w:pPr></w:p>')


def celda(ancho, contenido, fondo=None, jc='left', negrita=False, blanco=False):
    tcpr = '<w:tcPr><w:tcW w:w="%d" w:type="dxa"/>' % ancho
    tcpr += ('<w:tcBorders>'
             '<w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
             '<w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
             '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
             '<w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
             '</w:tcBorders>')
    if fondo:
        tcpr += '<w:shd w:val="clear" w:color="auto" w:fill="%s"/>' % fondo
    tcpr += '<w:vAlign w:val="center"/></w:tcPr>'
    rpr = FUENTE
    if negrita:
        rpr += '<w:b/><w:bCs/>'
    if blanco:
        rpr += '<w:color w:val="FFFFFF"/>'
    rpr += TAM
    par = ('<w:p><w:pPr><w:spacing w:after="40"/><w:jc w:val="%s"/>'
           '<w:rPr>%s</w:rPr></w:pPr>'
           '<w:r><w:rPr>%s</w:rPr><w:t xml:space="preserve">%s</w:t></w:r></w:p>'
           % (jc, rpr, rpr, x(contenido)))
    return '<w:tc>' + tcpr + par + '</w:tc>'


def tabla(anchos, encabezados, filas):
    """filas: lista de listas de (texto, jc)."""
    total = sum(anchos)
    out = ('<w:tbl><w:tblPr><w:tblW w:w="%d" w:type="dxa"/>'
           '<w:tblLayout w:type="fixed"/>'
           '<w:tblCellMar><w:left w:w="70" w:type="dxa"/>'
           '<w:right w:w="70" w:type="dxa"/></w:tblCellMar>'
           '<w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1"'
           ' w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr><w:tblGrid>'
           % total)
    for a in anchos:
        out += '<w:gridCol w:w="%d"/>' % a
    out += '</w:tblGrid>'
    out += '<w:tr><w:trPr><w:tblHeader/></w:trPr>'
    for i, h in enumerate(encabezados):
        out += celda(anchos[i], h, fondo='2E74B5', jc='center',
                     negrita=True, blanco=True)
    out += '</w:tr>'
    for fila in filas:
        out += '<w:tr>'
        for i, c in enumerate(fila):
            texto, jc = (c if isinstance(c, tuple) else (c, 'left'))
            out += celda(anchos[i], texto, jc=jc)
        out += '</w:tr>'
    out += '</w:tbl>'
    return out


def firma(nombre_tag, cargo, entidad):
    """Bloque de firma centrado."""
    out = vacio(200) + vacio(200)
    out += p(['______________________________'], jc='center', espacio_despues=0)
    out += p([(nombre_tag, 'b')], jc='center', espacio_despues=0)
    out += p([cargo], jc='center', espacio_despues=0)
    out += p([entidad], jc='center', espacio_despues=200)
    return out


def dos_firmas(izq, der):
    """Dos bloques de firma en una tabla sin bordes."""
    def bloque(nombre, cargo, entidad):
        rpr = FUENTE + TAM
        rprb = FUENTE + '<w:b/><w:bCs/>' + TAM
        def linea(t, negro=False):
            r = rprb if negro else rpr
            return ('<w:p><w:pPr><w:spacing w:after="0"/><w:jc w:val="center"/>'
                    '<w:rPr>%s</w:rPr></w:pPr><w:r><w:rPr>%s</w:rPr>'
                    '<w:t xml:space="preserve">%s</w:t></w:r></w:p>'
                    % (r, r, x(t)))
        return (linea('______________________________') + linea(nombre, True)
                + linea(cargo) + linea(entidad))

    def tc(cont):
        return ('<w:tc><w:tcPr><w:tcW w:w="4460" w:type="dxa"/>'
                '<w:tcBorders><w:top w:val="nil"/><w:left w:val="nil"/>'
                '<w:bottom w:val="nil"/><w:right w:val="nil"/></w:tcBorders>'
                '</w:tcPr>' + cont + '</w:tc>')

    return (vacio(200) + vacio(200)
            + '<w:tbl><w:tblPr><w:tblW w:w="8920" w:type="dxa"/>'
              '<w:tblLayout w:type="fixed"/>'
              '<w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/>'
              '<w:bottom w:val="nil"/><w:right w:val="nil"/>'
              '<w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders>'
              '<w:tblLook w:val="0000"/></w:tblPr>'
              '<w:tblGrid><w:gridCol w:w="4460"/><w:gridCol w:w="4460"/></w:tblGrid>'
              '<w:tr>' + tc(bloque(*izq)) + tc(bloque(*der)) + '</w:tr></w:tbl>')


# ---------------------------------------------------------------- documentos

def informe_satisfaccion_renovacion():
    """19 — Bloque 1. No necesita el PAG: se hace de septiembre a diciembre."""
    c = ''
    c += titulo('INFORME DE SATISFACCIÓN Y ANÁLISIS DE RENOVACIÓN')
    c += p([('Informe Nro. ', 'b'), ('{memoNro}', 'b')], jc='center',
           espacio_despues=60)
    c += p(['{ciudad}, {fechaInforme}'], jc='center', espacio_despues=240)

    c += seccion('1. ANTECEDENTES')
    c += p(['El Fondo de Inversión Ambiental Sostenible (FIAS), en su calidad de '
            'administrador de los recursos del Fondo de Áreas Protegidas (FAP), '
            'mantiene con ',
            ('{proveedor}', 'b'),
            ', con RUC {proveedorRuc}, el contrato Nro. ',
            ('{contratoNro}', 'b'),
            ', suscrito el {fechaContrato}, cuyo objeto es «',
            ('{objeto}', 'b'),
            '», por un monto de USD {montoTotal}, con vigencia hasta el '
            '{fechaFin}, para el {area}.'])
    c += p(['El servicio es de carácter recurrente y su continuidad es necesaria '
            'para la operación del área protegida: la interrupción del servicio '
            'a partir del {arranqueSucesor} afectaría directamente la gestión '
            'del {area}.'])

    c += seccion('2. VERIFICACIÓN DE LA CLÁUSULA DE RENOVACIÓN')
    c += p(['Conforme a la Matriz de procesos de adquisición, contratación y '
            'renovación del FAP, la renovación procede únicamente cuando el '
            'contrato original la contempla expresamente y cuando el contrato '
            'vigente no es, a su vez, una renovación —el FIAS permite renovar '
            'una sola vez—.'])
    c += p([('Resultado de la verificación: ', 'b'), '{clausulaTexto}'])

    c += seccion('3. EJECUCIÓN DEL SERVICIO Y CONFORMIDAD')
    c += p(['Durante el período de vigencia del contrato, ',
            ('{proveedor}', 'b'),
            ' prestó el servicio contratado en las condiciones, plazos y '
            'especificaciones pactadas. El detalle de lo ejecutado es el '
            'siguiente:'])
    c += tabla([6520, 1100, 1300],
               ['DESCRIPCIÓN Y ESPECIFICACIONES', 'CANT', 'UNIDAD'],
               [[('{#items}{desc}', 'left'), ('{cantidad}', 'center'),
                 ('{unidad}{/items}', 'center')]])
    c += vacio(120)
    c += p(['La administración del contrato deja constancia de la ',
            ('entera satisfacción', 'b'),
            ' con el servicio recibido: no se registraron incumplimientos, '
            'multas ni observaciones pendientes de subsanación durante el '
            'período informado.'])

    c += seccion('4. ANÁLISIS TÉCNICO')
    c += p(['{analisisTecnico}'])

    c += seccion('5. ANÁLISIS GEOGRÁFICO')
    c += p(['{analisisGeografico}'])

    c += seccion('6. ANÁLISIS ECONÓMICO')
    c += p(['El consumo efectivamente ejecutado durante el período asciende a ',
            ('USD {consumoEjecutado}', 'b'),
            ', frente a un valor contratado de USD {montoTotal}. Este '
            'consumo ejecutado —no el presupuesto del contrato vigente— es la '
            'base sobre la cual se solicitará la cotización del nuevo período, '
            'para evitar la subestimación que obliga a tramitar adendas de '
            'aumento de valor.'])
    c += p(['{analisisEconomico}'])

    c += seccion('7. CONCLUSIÓN Y RECOMENDACIÓN')
    c += p(['Con los antecedentes expuestos y verificada la cláusula de '
            'renovación, quien suscribe deja constancia de la satisfacción con '
            'el servicio prestado por ',
            ('{proveedor}', 'b'),
            ' y ',
            ('recomienda renovar el contrato Nro. {contratoNro}', 'b'),
            ' para el período comprendido entre el {periodoDesde} y el '
            '{periodoHasta}, por una sola vez, conforme lo permite el '
            'instrumento vigente.'])
    c += p(['El monto del nuevo período se determinará una vez aprobado el Plan '
            'Anual de Gasto, con cargo al componente {partida} denominado '
            '«{lineaNombre}», de la fuente de financiamiento {fuente}. El '
            'contrato de renovación será elaborado por la Unidad Operativa del '
            'FAP.'])

    c += dos_firmas(('{ac}', 'Administrador/a Contador/a', 'FIAS'),
                    ('{jefe}', '{jefeCargo}', 'Ministerio del Ambiente y Energía'))
    return c


def solicitud_cotizacion_renovacion():
    """20 — Bloque 2. Requiere el PAG aprobado: fija el presupuesto del área."""
    c = ''
    c += p(['{ciudad}, {fechaSolCotizacion}'], jc='right', espacio_despues=240)
    c += p([('Oficio Nro. ', 'b'), ('{memoNro}', 'b')], jc='left',
           espacio_despues=200)
    c += p([('Señores', 'b')], jc='left', espacio_despues=0)
    c += p([('{proveedor}', 'b')], jc='left', espacio_despues=0)
    c += p(['RUC: {proveedorRuc}'], jc='left', espacio_despues=0)
    c += p(['Presente.-'], jc='left', espacio_despues=240)

    c += p([('Asunto: ', 'b'),
            'Solicitud de cotización para el nuevo período — renovación del '
            'contrato Nro. {contratoNro}'], espacio_despues=240)

    c += p(['De mi consideración:'], espacio_despues=200)

    c += p(['El Fondo de Inversión Ambiental Sostenible (FIAS), administrador de '
            'los recursos del Fondo de Áreas Protegidas (FAP), mantiene con '
            'ustedes el contrato Nro. ',
            ('{contratoNro}', 'b'),
            ', cuyo objeto es «',
            ('{objeto}', 'b'),
            '», con vigencia hasta el {fechaFin}.'])
    c += p(['Verificada la satisfacción con el servicio prestado y la '
            'procedencia de la renovación, y aprobado el Plan Anual de Gasto '
            'del {area} —que fija el presupuesto disponible—, solicito a '
            'ustedes presentar su ',
            ('cotización para el período comprendido entre el {periodoDesde} y '
             'el {periodoHasta}', 'b'),
            ', conforme al siguiente detalle:'])
    c += vacio(80)
    c += tabla([1000, 1200, 6720],
               ['CANT', 'UNIDAD', 'DESCRIPCIÓN Y ESPECIFICACIONES'],
               [[('{#items}{cantidad}', 'center'), ('{unidad}', 'center'),
                 ('{desc}{/items}', 'left')]])
    c += vacio(160)

    c += p([('Condiciones de la cotización', 'b')], espacio_despues=80)
    c += p(['a) El presupuesto referencial asignado para el período es de ',
            ('{presupuestoLetras}', 'b'),
            ', con cargo al componente {partida} '
            'denominado «{lineaNombre}», de la fuente de financiamiento '
            '{fuente}. La cotización no podrá superar ese valor.'],
          sangria=284, espacio_despues=60)
    c += p(['b) Los precios deberán presentarse con el desglose unitario de '
            'cada ítem e indicar por separado el IVA aplicable.'],
          sangria=284, espacio_despues=60)
    c += p(['c) El plazo de entrega o de prestación del servicio es de {plazo} '
            'días.'], sangria=284, espacio_despues=60)
    c += p(['d) Documentos requeridos para el pago: {formaPago}'],
          sangria=284, espacio_despues=60)
    c += p(['e) La cotización deberá remitirse hasta el ',
            ('{fechaLimite}', 'b'),
            ' al correo {acCorreo}, y mantendrá su validez por treinta (30) '
            'días.'], sangria=284, espacio_despues=200)

    c += p(['La suscripción del contrato de renovación queda sujeta a la '
            'elaboración del instrumento por parte de la Unidad Operativa del '
            'FAP y a la disponibilidad de fondos verificada.'],
          espacio_despues=240)

    c += p(['Con sentimientos de distinguida consideración,'], espacio_despues=200)
    c += p(['Atentamente,'], espacio_despues=0)
    c += firma('{ac}', 'Administrador/a Contador/a', 'FIAS — Fondo de Áreas Protegidas')
    return c


def notificacion_renovacion():
    """21 — Bloque 2. Cierra lo que hace la AC; el contrato lo hace la Unidad Operativa."""
    c = ''
    c += p(['{ciudad}, {fechanotificacion}'], jc='right', espacio_despues=240)
    c += p([('Oficio Nro. ', 'b'), ('{memoNro}', 'b')], jc='left',
           espacio_despues=200)
    c += p([('Señores', 'b')], jc='left', espacio_despues=0)
    c += p([('{proveedor}', 'b')], jc='left', espacio_despues=0)
    c += p(['RUC: {proveedorRuc}'], jc='left', espacio_despues=0)
    c += p(['Presente.-'], jc='left', espacio_despues=240)

    c += p([('Asunto: ', 'b'),
            'Notificación de renovación del contrato Nro. {contratoNro}'],
          espacio_despues=240)

    c += p(['De mi consideración:'], espacio_despues=200)

    c += p(['Por medio del presente notifico a ustedes que el Fondo de '
            'Inversión Ambiental Sostenible (FIAS), en calidad de administrador '
            'de los recursos del Fondo de Áreas Protegidas (FAP), ha resuelto ',
            ('renovar el contrato Nro. {contratoNro}', 'b'),
            ', cuyo objeto es «',
            ('{objeto}', 'b'),
            '», suscrito para el {area}.'])

    c += p([('Condiciones de la renovación', 'b')], espacio_despues=80)
    c += tabla([3200, 5720],
               ['CONCEPTO', 'DETALLE'],
               [[('Contrato que se renueva', 'left'),
                 ('{contratoNro}', 'left')],
                [('Período del nuevo servicio', 'left'),
                 ('Del {periodoDesde} al {periodoHasta}', 'left')],
                [('Inicio del servicio', 'left'), ('{arranqueSucesor}', 'left')],
                [('Monto de la renovación', 'left'),
                 ('{montoLetras}', 'left')],
                [('Plazo de entrega o prestación', 'left'),
                 ('{plazo} días', 'left')],
                [('Documentos para el pago', 'left'), ('{formaPago}', 'left')],
                [('Línea de gasto', 'left'),
                 ('{partida} — {lineaNombre} · {fuente}', 'left')]])
    c += vacio(160)

    c += p(['La renovación opera por una sola vez, conforme a la cláusula '
            'prevista en el contrato original. El ',
            ('contrato de renovación será elaborado por la Unidad Operativa '
             'del FAP', 'b'),
            ' y se les remitirá para su suscripción; hasta su suscripción, las '
            'condiciones del contrato vigente se mantienen en todos sus demás '
            'términos.'])
    c += p(['Agradeceré confirmar la recepción de esta notificación y mantener '
            'actualizada la documentación habilitante requerida para la '
            'suscripción.'], espacio_despues=240)

    c += p(['Atentamente,'], espacio_despues=0)
    c += firma('{ac}', 'Administrador/a Contador/a', 'FIAS — Fondo de Áreas Protegidas')
    return c


DOCUMENTOS = [
    ('19_Informe_satisfaccion_renovacion.docx',
     'Informe de satisfacción y análisis de renovación',
     informe_satisfaccion_renovacion),
    ('20_Solicitud_cotizacion_renovacion.docx',
     'Solicitud de cotización para el nuevo período',
     solicitud_cotizacion_renovacion),
    ('21_Notificacion_renovacion.docx',
     'Notificación de renovación',
     notificacion_renovacion),
]


def construir(base_docx, salida, cuerpo, titulo_doc):
    with zipfile.ZipFile(base_docx) as z:
        partes = [(i, z.read(i.filename)) for i in z.infolist()]

    doc = None
    for info, datos in partes:
        if info.filename == 'word/document.xml':
            doc = datos.decode('utf-8')
    if doc is None:
        raise SystemExit('El paquete base no tiene word/document.xml')

    m = re.search(r'<w:sectPr\b.*?</w:sectPr>', doc, re.S)
    sect = m.group(0) if m else ''
    cabeza = doc[:doc.index('<w:body>') + len('<w:body>')]
    nuevo = cabeza + cuerpo + sect + '</w:body></w:document>'

    tmp = salida + '.tmp'
    with zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as out:
        for info, datos in partes:
            if info.filename == 'word/document.xml':
                out.writestr(info, nuevo.encode('utf-8'))
            elif info.filename == 'docProps/core.xml':
                t = datos.decode('utf-8')
                t = re.sub(r'<dc:title>.*?</dc:title>',
                           '<dc:title>' + x(titulo_doc) + '</dc:title>', t, flags=re.S)
                out.writestr(info, t.encode('utf-8'))
            else:
                out.writestr(info, datos)
    shutil.move(tmp, salida)


def main():
    carpeta = sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'generador', 'plantillas')
    base = os.path.join(carpeta, BASE)
    if not os.path.exists(base):
        raise SystemExit('No encuentro la plantilla base: ' + base)
    for nombre, titulo_doc, fn in DOCUMENTOS:
        destino = os.path.join(carpeta, nombre)
        construir(base, destino, fn(), titulo_doc)
        print('%-46s %7d bytes' % (nombre, os.path.getsize(destino)))


if __name__ == '__main__':
    main()
