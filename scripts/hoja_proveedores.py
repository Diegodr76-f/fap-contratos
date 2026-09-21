# -*- coding: utf-8 -*-
"""
La hoja «Proveedores» del Excel maestro.

Es una hoja aparte, con un proveedor por fila. La columna A trae los nombres ya
puestos —salen de las hojas de contratos, nadie los teclea— y al lado se escribe
lo que solo sabe una persona: el RUC, la actividad económica y la verificación.

A la derecha, separada, hay una columna que **se llena sola**: los proveedores
que ya tienen contrato pero todavía no tienen fila. Cuando entra un contrato con
un proveedor nuevo, su nombre aparece ahí y se copia a la primera fila libre de
la columna A. Casi siempre está vacía.

    python3 scripts/hoja_proveedores.py <Sistema_Alertas_Contratos_FIAS.xlsx>

**Se entrega como texto para pegar, no como pestaña para copiar**, y la razón es
un fallo real: una pestaña suelta en otro libro lleva fórmulas que apuntan a la
hoja `2026`, que en ese libro no existe. Al copiarla al maestro, Excel no
encuentra a qué apuntar y la hoja entera queda en `#¡REF!`. Pegando texto no
pasa: las fórmulas se escriben dentro del libro bueno y se resuelven ahí.

Por lo mismo las fórmulas salen **en español y con `;`**, que es como las lee el
Excel de quien las va a pegar.

## Por qué la columna A son valores y no una fórmula

Porque al lado se escribe a mano. Si la lista de nombres fuera una fórmula, al
aparecer un proveedor nuevo la lista se recorrería —o cambiaría entera si se
ordena la hoja `2026`— y **cada RUC quedaría pegado a otra persona**. Los
nombres se quedan quietos en su fila; lo único que se mueve es el aviso de la
derecha, que no tiene nada escrito al lado.
"""
import sys, os, re, unicodedata, itertools
from collections import defaultdict

try:
    import openpyxl
except ImportError:
    sys.exit("Falta openpyxl. Instálalo con:\n    pip install openpyxl\n")

# Las hojas de contratos del maestro, con la fila donde están los encabezados.
HOJAS = [("2026", 2), ("2025", 2), ("2024", 2), ("2023", 2)]

# Lo que se escribe a mano (lo lee el robot).
COLS = ["Nombre del Proveedor", "RUC", "Actividad económica",
        "Última verificación", "Verificado por", "Resultado",
        "Periodicidad", "Observaciones"]

FILA_TITULO = 1
FILA_HDR = 2            # los encabezados, como en las demás hojas del maestro
FILA_1 = 3              # el primer proveedor
COL_AVISO = "J"         # la columna que se llena sola, separada de lo que se escribe
FILAS_MIRA = 500        # cuántas filas de la hoja de contratos vigila el aviso
HASTA = 900             # hasta dónde miran las fórmulas la lista de la columna A

# Fórmulas en español y con «;», que es como las lee el Excel donde se pegan.
# Clásicas a propósito: SI, Y, CONTAR.SI. UNIQUE y FILTER harían esto en una
# línea pero solo existen en Excel 365.
F_AVISO = ('=SI(\'{hoja}\'!${col}{fila}="";"";'
           'SI(Y(CONTAR.SI($A${p1}:$A${hasta};\'{hoja}\'!${col}{fila})=0;'
           'CONTAR.SI({antes};\'{hoja}\'!${col}{fila})=0);'
           '\'{hoja}\'!${col}{fila};""))')
# SUMAPRODUCTO y no CONTAR.SI(...;"?*"): las filas que no avisan de nada
# devuelven "", que es texto vacío y no una celda vacía, y CONTAR.SI las
# cuenta igual —daba 20 en vez de 1—. Se vio ejecutándolo.
F_CUENTA = '=SUMAPRODUCTO((${ca}${a1}:${ca}${afin}<>"")*1)'


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
    """Los proveedores de todas las hojas de contratos, y dónde está la columna
    del proveedor en la hoja del año en curso."""
    wb = openpyxl.load_workbook(ruta, read_only=True, data_only=True)
    provs = defaultdict(lambda: {"raw": defaultdict(int), "n": 0})
    col_prov = None
    for hoja, fila_hdr in HOJAS:
        if hoja not in wb.sheetnames:
            continue
        filas = list(wb[hoja].iter_rows(min_row=fila_hdr, values_only=True))
        if not filas:
            continue
        hdr = [norm(x) if x else "" for x in filas[0]]
        ip = next((j for j, h in enumerate(hdr) if "NOMBRE DEL PROVEEDOR" in h), None)
        if ip is None:
            continue
        if hoja == HOJAS[0][0]:
            col_prov = openpyxl.utils.get_column_letter(ip + 1)
        for r in filas[1:]:
            if ip >= len(r) or not r[ip]:
                continue
            k = norm(r[ip])
            if not k or k in ("N A", "NA"):
                continue
            provs[k]["raw"][str(r[ip]).strip()] += 1
            provs[k]["n"] += 1
    wb.close()
    return provs, col_prov


def texto_para_pegar(provs, col_prov, hoja="2026", fila_hdr_contratos=2):
    """La hoja entera como texto separado por tabuladores, lista para pegar en
    A1. Cada línea es una fila; cada tabulador, una celda."""
    lineas = []

    cab = [""] * 9
    cab[0] = ("Un proveedor por fila. Escribe el RUC y la actividad; el nombre "
              "ya está puesto.")
    lineas.append("\t".join(cab) + "\tSe llena sola: proveedores con contrato y sin fila")
    lineas.append("\t".join(COLS + ["", "⚠ Faltan por agregar"]))

    orden = sorted(provs.items(), key=lambda kv: (-kv[1]["n"], kv[0]))
    nombres = [max(p["raw"].items(), key=lambda kv: (kv[1], len(kv[0])))[0]
               for _, p in orden]

    for i in range(max(len(nombres), FILAS_MIRA)):
        celdas = [""] * 10
        if i < len(nombres):
            celdas[0] = nombres[i]
        fila = FILA_1 + i
        origen = fila_hdr_contratos + 1 + i
        if i < FILAS_MIRA:
            # Lo que ya salió más arriba en este mismo aviso, para no repetir un
            # proveedor que está en varios contratos. La primera fila no tiene
            # nada encima: se la manda contra el encabezado, que nunca coincide
            # con un nombre —y sobre todo, no se incluye a sí misma, que sería
            # una referencia circular.
            antes = ("${c}${h}:${c}${h}".replace("${c}", "$" + COL_AVISO)
                     .replace("${h}", "$%d" % FILA_HDR) if i == 0
                     else "$%s$%d:$%s$%d" % (COL_AVISO, FILA_1, COL_AVISO, fila - 1))
            celdas[9] = F_AVISO.format(hoja=hoja, col=col_prov, fila=origen,
                                       p1=FILA_1, hasta=HASTA, antes=antes)
        lineas.append("\t".join(celdas))

    # El contador va arriba del todo, en la celda de al lado del título.
    lineas[0] = lineas[0].replace(
        "\tSe llena sola: proveedores con contrato y sin fila",
        "\t" + F_CUENTA.format(ca=COL_AVISO, a1=FILA_1,
                               afin=FILA_1 + FILAS_MIRA - 1)
        + "\tfaltan por agregar (si es 0, no falta ninguno)")
    return "\n".join(lineas)


def main():
    if len(sys.argv) < 2:
        sys.exit("Uso: python3 scripts/hoja_proveedores.py "
                 "<Sistema_Alertas_Contratos_FIAS.xlsx> [salida.txt]")
    entrada = sys.argv[1]
    if not os.path.exists(entrada):
        sys.exit(f"No encuentro el archivo: {entrada}")
    salida = sys.argv[2] if len(sys.argv) > 2 else "hoja_Proveedores.txt"

    provs, col_prov = leer(entrada)
    if not provs or not col_prov:
        sys.exit("No encontré la columna «Nombre del Proveedor» en la hoja de "
                 "contratos. ¿Cambiaron los encabezados?")

    txt = texto_para_pegar(provs, col_prov)
    with open(salida, "w", encoding="utf-8") as f:
        f.write(txt)

    print(f"OK: «{salida}» con {len(provs)} proveedores, listo para pegar.")
    print()
    print("  1. En el maestro, crea una hoja nueva y llámala  Proveedores")
    print(f"  2. Abre «{salida}», selecciona todo (Ctrl+E) y copia (Ctrl+C)")
    print("  3. Ponte en la celda A1 de la hoja nueva y pega (Ctrl+V)")
    print()
    print(f"  (el nombre del proveedor se leyó de la columna {col_prov} de la hoja 2026)")

    variantes = {k: sorted(p["raw"]) for k, p in provs.items() if len(p["raw"]) > 1}
    if variantes:
        print(f"\n{len(variantes)} proveedor(es) escritos de varias formas. Se unifican "
              "solos; en la hoja va el más frecuente:")
        for k, formas in sorted(variantes.items()):
            print("   ·", " | ".join(formas))

    pares = [(a, b) for a, b in itertools.combinations(sorted(provs), 2) if parecidos(a, b)]
    if pares:
        print(f"\n{len(pares)} par(es) de nombres parecidos que NO se unifican solos. "
              "Si comparten RUC son el mismo proveedor y su historial está partido "
              "en dos: hay que corregir el nombre en la hoja de contratos.")
        for a, b in pares:
            print(f"   · {a}  ⇄  {b}")


if __name__ == "__main__":
    main()
