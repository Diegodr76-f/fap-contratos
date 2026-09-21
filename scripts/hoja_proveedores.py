# -*- coding: utf-8 -*-
"""
La hoja «Proveedores»: se genera sola, no se llena.

**Lo único que se escribe a mano es lo que ya se escribía**: el nombre del
proveedor, en la fila de su contrato, en la hoja `2026`. Al lado van ahora unas
columnas más —el RUC, la actividad económica y la verificación— y se llenan
**una sola vez por proveedor**, en cualquiera de sus contratos: el robot agrupa
por nombre y toma el primero que encuentre, así que las demás filas suyas se
quedan en blanco para siempre.

Con eso no hay nada que mantener: ni una segunda lista, ni copiar nombres, ni
emparejar dos hojas. El proveedor existe porque tiene un contrato, y su ficha se
arma de esa misma fila. No hay forma de que se duplique.

Este script hace dos cosas, ninguna obligatoria:

    python3 scripts/hoja_proveedores.py <Sistema_Alertas_Contratos_FIAS.xlsx>

  · dice **qué columnas añadir** a la hoja 2026, con su nombre exacto;
  · y escribe una hoja **«Proveedores»** que es solo para mirar: la lista de
    proveedores con su RUC, su actividad, su última verificación y cuántos
    contratos tiene, **toda con fórmulas**. No se escribe nada en ella; se pega
    al maestro y se llena sola desde la hoja 2026.

De paso revisa los nombres, que es lo único que una máquina no puede arreglar:

  · **Variantes de escritura** — «RIVERJARDÍN CÍA. LTDA.» y «RIVERJARDIN CÍA.
    LTDA» son el mismo proveedor y se unifican solas al normalizar el nombre.
  · **Nombres parecidos que NO se unifican** — «PLASENCIA» contra «PLASCENCIA»,
    «JOHNNY» contra «JHONNY». Son errores de tecleo que parten en dos el
    historial de una misma persona, y el nombre no alcanza para decidirlo: lo
    decide el RUC. Por eso salen listados.

**No toca el archivo de entrada**, y hay una razón dura: abrir y volver a
guardar el maestro con openpyxl **borra los enlaces de la hoja «Export»**, que
el robot publica —se probó, y los 138 contratos se quedaron sin link—.

Las fórmulas se comprueban ejecutándolas, con `scripts/probar_hoja_proveedores.py`:
una fórmula mal escrita no falla, se queda vacía — que es exactamente lo que se
vería si no hubiera ningún proveedor.
"""
import sys, os, re, unicodedata, itertools
from collections import defaultdict

try:
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment
except ImportError:
    sys.exit("Falta openpyxl. Instálalo con:\n    pip install openpyxl\n")

# Las hojas de contratos del maestro, con la fila donde están los encabezados.
HOJAS = [("2026", 2), ("2025", 2), ("2024", 2), ("2023", 2)]

# Las columnas que se añaden a la hoja 2026. El robot las busca por estos
# nombres (y por unas cuantas variantes), y **todas son opcionales**: sin ellas
# publica exactamente lo mismo que antes.
COLUMNAS_2026 = [
    ("RUC del Proveedor", "13 dígitos. Una sola vez por proveedor, en cualquiera de sus contratos."),
    ("Actividad económica", "La que consta en el RUC. También una sola vez."),
    ("Verificación del Proveedor", "Fecha en que se comprobó que sigue en regla."),
    ("Verificado por", "Quién la hizo."),
    ("Resultado de la verificación", "Vigente / Observado / No continuar."),
    ("Periodicidad", "Semestral o Anual. Si se deja vacío, se asume anual."),
]

# La vista: qué columna lleva y de qué columna de la hoja 2026 sale.
VISTA = [
    ("Proveedor", None),
    ("RUC", "RUC del Proveedor"),
    ("Actividad económica", "Actividad económica"),
    ("Última verificación", "Verificación del Proveedor"),
    ("Resultado", "Resultado de la verificación"),
    ("Contratos", None),
]
FILAS_MIRA = 500        # cuántas filas de la hoja de contratos mira la vista

# Funciones clásicas a propósito: IF, COUNTIF, LOOKUP, SUMPRODUCT, MAX. UNIQUE y
# FILTER harían la lista en una línea, pero solo existen en Excel 365, se guardan
# con prefijos raros (`_xlfn.`) cuando no las escribe Excel, y no hay con qué
# comprobarlas. Estas se probaron ejecutándolas.
#
# Y las columnas van **fijadas al generar**, no buscadas con MATCH dentro de la
# fórmula. Se intentó con INDEX(rango,0,n) y con OFFSET, que es lo elegante, y
# ninguna de las dos se puede ejecutar en la comprobación —el motor no las
# implementa—, así que habría que publicarlas a ciegas. El script lee el maestro,
# ve en qué letra está cada columna y la escribe. Si algún día las mueven, se
# vuelve a generar la hoja; el robot, que es el que de verdad alimenta el CLM,
# las sigue buscando por su encabezado y no se entera.

def norm(s):
    """La misma llave que usa el CLM: sin tildes, sin puntuación, en mayúsculas.
    Unifica «RIVERJARDÍN CÍA. LTDA.» con «RIVERJARDIN CIA LTDA»."""
    s = unicodedata.normalize("NFD", str(s)).encode("ascii", "ignore").decode().upper()
    return re.sub(r"\s+", " ", re.sub(r"[^A-Z0-9 ]", " ", s)).strip()


def parecidos(a, b):
    """Dos nombres que comparten casi todas sus palabras. Grosero a propósito:
    esto no decide nada, solo pone el par delante de quien mira."""
    A, B = set(a.split()), set(b.split())
    return len(A & B) / max(1, len(A | B)) >= 0.6


def leer(ruta):
    wb = openpyxl.load_workbook(ruta, read_only=True, data_only=True)
    provs = defaultdict(lambda: {"raw": defaultdict(int), "areas": set(),
                                 "cats": set(), "n": 0, "ultimo": None})
    for hoja, fila_hdr in HOJAS:
        if hoja not in wb.sheetnames:
            continue
        filas = list(wb[hoja].iter_rows(min_row=fila_hdr, values_only=True))
        if not filas:
            continue
        hdr = [norm(x) if x else "" for x in filas[0]]

        def idx(txt):
            for j, h in enumerate(hdr):
                if txt in h:
                    return j
            return None

        ip, ia, ic, inro = (idx("NOMBRE DEL PROVEEDOR"), idx("AREA PROTEGIDA"),
                            idx("CATEGORIA"), idx("NRO DE CONTRATO"))
        if ip is None:
            continue
        for r in filas[1:]:
            if ip >= len(r) or not r[ip]:
                continue
            k = norm(r[ip])
            if not k or k in ("N A", "NA"):
                continue
            p = provs[k]
            p["raw"][str(r[ip]).strip()] += 1
            p["n"] += 1
            for i, campo in ((ia, "areas"), (ic, "cats")):
                if i is not None and i < len(r) and r[i]:
                    p[campo].add(str(r[i]).strip())
            if inro is not None and inro < len(r) and r[inro]:
                nro = str(r[inro]).strip()
                if p["ultimo"] is None or nro > p["ultimo"]:
                    p["ultimo"] = nro
    wb.close()
    return provs


def columnas_que_faltan(ruta):
    """Cuáles de las columnas nuevas ya están en la hoja 2026 y cuáles no."""
    wb = openpyxl.load_workbook(ruta, read_only=True, data_only=True)
    if "2026" not in wb.sheetnames:
        wb.close()
        return [n for n, _ in COLUMNAS_2026], []
    # Una hoja recién creada no tiene ni fila 2; entonces faltan todas.
    fila2 = list(wb["2026"].iter_rows(min_row=2, max_row=2, values_only=True))
    hdr = [norm(v) if v else "" for v in (fila2[0] if fila2 else [])]
    wb.close()
    faltan = [n for n, _ in COLUMNAS_2026 if not any(h.startswith(norm(n)) for h in hdr)]
    estan = [n for n, _ in COLUMNAS_2026 if n not in faltan]
    return faltan, estan


def columnas_del_maestro(ruta, hoja="2026", fila_hdr=2):
    """En qué letra está cada columna que le interesa a la vista. Se resuelve
    aquí, al generar, y no dentro de la fórmula: ver el comentario de arriba."""
    wb = openpyxl.load_workbook(ruta, read_only=True, data_only=True)
    if hoja not in wb.sheetnames:
        wb.close()
        return {}
    fila = list(wb[hoja].iter_rows(min_row=fila_hdr, max_row=fila_hdr, values_only=True))
    wb.close()
    if not fila:
        return {}
    letras = {}
    quiero = ["Nombre del Proveedor"] + [c for _, c in VISTA if c]
    for j, v in enumerate(fila[0], 1):
        if not v:
            continue
        h = norm(v)
        for q in quiero:
            if q not in letras and h.startswith(norm(q)):
                letras[q] = openpyxl.utils.get_column_letter(j)
    return letras


def escribir_vista(salida, columnas, hoja="2026", fila_hdr=2, filas=None):
    """La hoja «Proveedores», entera de fórmulas. Nadie escribe en ella.

    `columnas` dice en qué letra está cada columna de la hoja de contratos.
    `filas` es cuántas filas de esa hoja mira, y solo se toca desde la prueba:
    evaluar 500 filas de fórmulas tarda minutos y la lógica es la misma con
    veinte."""
    filas = filas or FILAS_MIRA
    if "Nombre del Proveedor" not in columnas:
        raise ValueError("no encontré la columna «Nombre del Proveedor» en la "
                         "hoja %s; sin ella la vista no se puede armar" % hoja)
    desde, hasta = fila_hdr + 1, fila_hdr + filas

    def rango(cual):
        letra = columnas.get(cual)
        return None if letra is None else "'%s'!$%s$%d:$%s$%d" % (hoja, letra, desde,
                                                                  letra, hasta)

    nombres = rango("Nombre del Proveedor")
    col_nombre = columnas["Nombre del Proveedor"]

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Proveedores"
    ws["A1"] = ("Se llena sola desde la hoja «%s». No escribas nada aquí: el RUC "
                "y la verificación van en la fila del contrato." % hoja)
    ws["A1"].font = Font(bold=True, size=10, color="C00000")
    ws.append([])
    for j, (titulo, _) in enumerate(VISTA, 1):
        c = ws.cell(row=3, column=j, value=titulo)
        c.fill = PatternFill("solid", fgColor="1F3864")
        c.font = Font(bold=True, color="FFFFFF", size=10)
        c.alignment = Alignment(vertical="center", wrap_text=True)
    ws.freeze_panes = "A4"

    fechas = rango("Verificación del Proveedor")
    for k in range(filas):
        fila, origen = 4 + k, desde + k
        celda = "'%s'!$%s%d" % (hoja, col_nombre, origen)
        # La primera fila no tiene nada arriba con qué compararse: se la manda
        # contra el encabezado, que nunca va a coincidir con un nombre.
        antes = "$A$3:$A$3" if fila == 4 else "$A$4:$A$%d" % (fila - 1)
        ws.cell(row=fila, column=1).value = (
            '=IF({celda}="","",IF(COUNTIF({antes},{celda})=0,{celda},""))'
        ).format(celda=celda, antes=antes)

        for j, (titulo, origen_col) in enumerate(VISTA, 1):
            if j == 1:
                continue
            destino = ws.cell(row=fila, column=j)
            if titulo == "Contratos":
                destino.value = '=IF($A{f}="","",COUNTIF({nombres},$A{f}))'.format(
                    f=fila, nombres=nombres)
                continue
            col = rango(origen_col)
            if col is None:          # esa columna todavía no existe en el maestro
                destino.value = '=""'
                continue
            if titulo == "Última verificación":
                # La más reciente, no la primera: es la que dice si el proveedor
                # sigue en regla hoy. SUMPRODUCT(MAX(...)) es el «máximo si» de
                # toda la vida, sin entrar la fórmula con Ctrl+Mayús+Intro.
                maximo = 'SUMPRODUCT(MAX(({nombres}=$A{f})*{col}))'.format(
                    f=fila, nombres=nombres, col=col)
                destino.value = '=IF($A{f}="","",IF({m}=0,"",{m}))'.format(f=fila, m=maximo)
                destino.number_format = "dd/mm/yyyy"
            elif titulo == "Resultado" and fechas:
                # El resultado que acompaña a esa fecha, no otro cualquiera.
                destino.value = (
                    '=IF($D{f}="","",IFERROR(LOOKUP(2,1/(({nombres}=$A{f})*'
                    '({fechas}=$D{f})),{col}),""))'
                ).format(f=fila, nombres=nombres, fechas=fechas, col=col)
            else:
                # El primero que no esté vacío entre los contratos de ese
                # proveedor: por eso basta escribirlo una vez, donde sea.
                destino.value = (
                    '=IF($A{f}="","",IFERROR(LOOKUP(2,1/(({nombres}=$A{f})*'
                    '({col}<>"")),{col}),""))'
                ).format(f=fila, nombres=nombres, col=col)

    for j, w in enumerate([44, 16, 34, 17, 16, 11], 1):
        ws.column_dimensions[openpyxl.utils.get_column_letter(j)].width = w
    wb.save(salida)


def main():
    if len(sys.argv) < 2:
        sys.exit("Uso: python3 scripts/hoja_proveedores.py "
                 "<Sistema_Alertas_Contratos_FIAS.xlsx> [vista.xlsx]")
    entrada = sys.argv[1]
    if not os.path.exists(entrada):
        sys.exit(f"No encuentro el archivo: {entrada}")
    salida = sys.argv[2] if len(sys.argv) > 2 else "Proveedores_vista.xlsx"

    faltan, estan = columnas_que_faltan(entrada)
    print("PASO 1 — columnas de la hoja «2026»")
    if not faltan:
        print("    Ya están las seis. No hay nada que añadir.")
    else:
        print("    Añade estas al final de la fila 2 (la de los encabezados):\n")
        for nombre, para_que in COLUMNAS_2026:
            marca = "ya está" if nombre in estan else "FALTA "
            print(f"      [{marca}] {nombre}")
            print(f"                 {para_que}")
    print("\n    Se llenan una sola vez por proveedor, en cualquiera de sus")
    print("    contratos. Las demás filas suyas se quedan en blanco.")

    print("\nPASO 2 — la vista (opcional)")
    columnas = columnas_del_maestro(entrada)
    if "Nombre del Proveedor" not in columnas:
        print("    No encontré la columna «Nombre del Proveedor» en la hoja 2026,")
        print("    así que no escribí la vista.")
    else:
        escribir_vista(salida, columnas)
        print(f"    Escribí «{salida}» con la hoja «Proveedores», toda de fórmulas.")
        print("    Cópiala al maestro si quieres ver la lista también en Excel. No")
        print("    se escribe nada en ella: se llena sola desde la hoja 2026.")
        print("    Las columnas quedan fijadas a su letra de hoy "
              f"({', '.join(f'{k}={v}' for k, v in sorted(columnas.items()))}).")
        print("    Si algún día las mueves, vuelve a correr esto.")

    provs = leer(entrada)
    if not provs:
        return
    print(f"\nPASO 3 — los nombres ({len(provs)} proveedores en "
          f"{sum(p['n'] for p in provs.values())} contratos)")

    variantes = {k: sorted(p["raw"]) for k, p in provs.items() if len(p["raw"]) > 1}
    if variantes:
        print(f"\n    {len(variantes)} escritos de varias formas. Se unifican solos:")
        for k, formas in sorted(variantes.items()):
            print("      ·", " | ".join(formas))

    pares = [(a, b) for a, b in itertools.combinations(sorted(provs), 2) if parecidos(a, b)]
    if pares:
        print(f"\n    {len(pares)} par(es) de nombres parecidos que NO se unifican solos.")
        print("    Si comparten RUC son el mismo proveedor y su historial está")
        print("    partido en dos: hay que corregir el nombre en la hoja de contratos.")
        for a, b in pares:
            print(f"      · {a}  ⇄  {b}")


if __name__ == "__main__":
    main()
