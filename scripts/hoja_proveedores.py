# -*- coding: utf-8 -*-
"""
Arma la hoja «Proveedores» del Excel maestro, ya pre-llenada.

El listado de proveedores del CLM se alimenta de una hoja nueva en
`Sistema_Alertas_Contratos_FIAS.xlsx`. Esa hoja lleva lo que **solo sabe una
persona** —el RUC, la actividad económica por la que se contrató, y si alguien
verificó que el proveedor sigue en regla—, pero la lista de nombres ya está en
las hojas de contratos: 225 proveedores repartidos entre 2024, 2025 y 2026.

Este script los saca de ahí y escribe un `.xlsx` con la hoja lista para pegar en
el maestro, con los nombres puestos y las columnas de llenar en blanco. Quien la
complete no teclea nombres: solo llena RUC y actividad, y ve al lado en cuántos
contratos y en qué áreas aparece cada uno, que es lo que hace falta para
reconocerlo.

    python3 scripts/hoja_proveedores.py <Sistema_Alertas_Contratos_FIAS.xlsx> [salida.xlsx]

**No toca el archivo de entrada.** Escribe uno nuevo; la hoja se copia al
maestro a mano, porque el maestro es de otra persona.

De paso avisa de dos cosas que el llenado tiene que resolver:

  · **Variantes de escritura** — «RIVERJARDÍN CÍA. LTDA.» y «RIVERJARDIN CÍA.
    LTDA» son el mismo proveedor y se unifican solas al normalizar el nombre.
  · **Nombres parecidos que NO se unifican** — «PLASENCIA» contra «PLASCENCIA»,
    «JOHNNY» contra «JHONNY». Son errores de tecleo que parten en dos el
    historial de una misma persona, y el nombre no alcanza para decidirlo: lo
    decide el RUC. Por eso salen listados, para revisarlos mientras se llena.
"""
import sys, os, re, unicodedata, itertools
from collections import defaultdict

try:
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment
    from openpyxl.worksheet.datavalidation import DataValidation
except ImportError:
    sys.exit("Falta openpyxl. Instálalo con:\n    pip install openpyxl\n")

# Las hojas de contratos del maestro, con la fila donde están los encabezados.
HOJAS = [("2026", 2), ("2025", 2), ("2024", 2), ("2023", 2)]

# Lo que llena una persona (lo lee el robot) y lo que es solo referencia para
# reconocer al proveedor mientras se llena (el robot lo ignora y lo recalcula).
COLS_LLENAR = ["Nombre del Proveedor", "RUC", "Actividad económica",
               "Última verificación", "Verificado por", "Resultado",
               "Periodicidad", "Observaciones"]
COLS_REF = ["(ref) Contratos", "(ref) Áreas", "(ref) Categorías",
            "(ref) Último contrato", "(ref) Variantes de escritura"]

RESULTADOS = "Vigente,Observado,No continuar"
PERIODICIDADES = "Semestral,Anual"


def norm(s):
    """La misma llave que usa el CLM: sin tildes, sin puntuación, en mayúsculas.
    Unifica «RIVERJARDÍN CÍA. LTDA.» con «RIVERJARDIN CIA LTDA»."""
    s = unicodedata.normalize("NFD", str(s)).encode("ascii", "ignore").decode().upper()
    return re.sub(r"\s+", " ", re.sub(r"[^A-Z0-9 ]", " ", s)).strip()


def parecidos(a, b):
    """Dos nombres que comparten casi todas sus palabras. Grosero a propósito:
    esto no decide nada, solo pone el par delante de quien llena la hoja."""
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


def escribir(provs, salida):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Proveedores"
    cols = COLS_LLENAR + COLS_REF
    ws.append(cols)

    azul = PatternFill("solid", fgColor="1F3864")
    gris = PatternFill("solid", fgColor="D9D9D9")
    for j, nombre in enumerate(cols, 1):
        c = ws.cell(row=1, column=j)
        es_ref = nombre.startswith("(ref)")
        c.fill = gris if es_ref else azul
        c.font = Font(bold=True, color="333333" if es_ref else "FFFFFF", size=10)
        c.alignment = Alignment(vertical="center", wrap_text=True)
    ws.freeze_panes = "A2"

    orden = sorted(provs.items(), key=lambda kv: (-kv[1]["n"], kv[0]))
    for _, p in orden:
        # El nombre que se escribió más veces manda: es el que la mayoría de los
        # contratos ya lleva, así que es el que menos hay que corregir después.
        canon = max(p["raw"].items(), key=lambda kv: (kv[1], len(kv[0])))[0]
        otras = sorted(x for x in p["raw"] if x != canon)
        ws.append([canon, None, None, None, None, None, "Anual", None,
                   p["n"], " · ".join(sorted(p["areas"])),
                   " · ".join(sorted(p["cats"])), p["ultimo"] or "",
                   " | ".join(otras)])

    fin = ws.max_row
    dv_res = DataValidation(type="list", formula1=f'"{RESULTADOS}"', allow_blank=True)
    dv_per = DataValidation(type="list", formula1=f'"{PERIODICIDADES}"', allow_blank=True)
    ws.add_data_validation(dv_res)
    ws.add_data_validation(dv_per)
    dv_res.add(f"F2:F{fin}")
    dv_per.add(f"G2:G{fin}")

    anchos = [42, 16, 34, 16, 20, 14, 13, 40, 11, 40, 26, 20, 40]
    for j, w in enumerate(anchos, 1):
        ws.column_dimensions[openpyxl.utils.get_column_letter(j)].width = w

    wb.save(salida)
    return fin - 1


def main():
    if len(sys.argv) < 2:
        sys.exit("Uso: python3 scripts/hoja_proveedores.py "
                 "<Sistema_Alertas_Contratos_FIAS.xlsx> [salida.xlsx]")
    entrada = sys.argv[1]
    if not os.path.exists(entrada):
        sys.exit(f"No encuentro el archivo: {entrada}")
    salida = sys.argv[2] if len(sys.argv) > 2 else "Proveedores_FAP.xlsx"

    provs = leer(entrada)
    if not provs:
        sys.exit("No encontré la columna «Nombre del Proveedor» en ninguna hoja "
                 "de contratos. ¿Cambiaron los encabezados?")
    n = escribir(provs, salida)

    total_contratos = sum(p["n"] for p in provs.values())
    print(f"OK: {n} proveedores en «{salida}» (hoja «Proveedores»), "
          f"de {total_contratos} contratos.")
    print("    Cópiala al Excel maestro como una hoja más y llena RUC y actividad.")

    variantes = {k: sorted(p["raw"]) for k, p in provs.items() if len(p["raw"]) > 1}
    if variantes:
        print(f"\n{len(variantes)} proveedor(es) escritos de varias formas. "
              "Se unifican solos; la hoja lleva el más frecuente:")
        for k, formas in sorted(variantes.items()):
            print("   ·", " | ".join(formas))

    pares = [(a, b) for a, b in itertools.combinations(sorted(provs), 2) if parecidos(a, b)]
    if pares:
        print(f"\n{len(pares)} par(es) de nombres parecidos que NO se unifican solos. "
              "Revísalos al llenar: si comparten RUC son el mismo proveedor y el "
              "historial está partido en dos.")
        for a, b in pares:
            print(f"   · {a}  ⇄  {b}")


if __name__ == "__main__":
    main()
