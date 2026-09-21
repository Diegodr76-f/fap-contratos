# -*- coding: utf-8 -*-
"""
Comprobaciones de la hoja «Proveedores».

Lo que se comprueba es la columna que se llena sola: la que avisa de los
proveedores que ya tienen contrato pero todavía no tienen fila. Es una fórmula,
y una fórmula mal escrita **no falla: se queda vacía** — que es exactamente lo
que se vería si no faltara ningún proveedor. Por eso aquí se ejecuta de verdad.

    pip install openpyxl formulas
    python3 scripts/probar_hoja_proveedores.py

Las fórmulas se entregan en español (`SI`, `Y`, `CONTAR.SI`, con `;`), que es
como las lee el Excel donde se pegan. El motor de comprobación habla inglés, así
que aquí se traducen —es un cambio mecánico de nombres y del separador— y se
ejecuta esa versión. Lo que se prueba es la lógica, que es la misma.

Y se comprueba también lo que rompió la primera entrega: que la columna A sean
**valores y no fórmulas**. Si fuera una fórmula, al aparecer un proveedor nuevo
la lista se recorrería y cada RUC escrito al lado quedaría pegado a otra persona.
"""
import sys, os, re, tempfile, warnings

warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    import openpyxl
except ImportError:
    sys.exit("Falta openpyxl. Instálalo con:\n    pip install openpyxl formulas\n")

import hoja_proveedores as H

fallos = 0


def ok(cond, msg, extra=None):
    global fallos
    if cond:
        print("  ✓ " + msg)
    else:
        fallos += 1
        print("  ✗ " + msg + (f"  → {extra}" if extra is not None else ""))


def a_ingles(f):
    """La misma fórmula con los nombres en inglés y comas. Cambio mecánico: es
    lo único que separa lo que se entrega de lo que se puede ejecutar aquí."""
    f = f.replace("CONTAR.SI(", "\x00").replace("SI(", "IF(").replace("\x00", "COUNTIF(")
    f = f.replace("SUMAPRODUCTO(", "SUMPRODUCT(")
    f = re.sub(r"\bY\(", "AND(", f)
    return f.replace(";", ",")


def maestro_de_mentira(ruta):
    """La hoja 2026 con la forma de la de verdad: título en la fila 1,
    encabezados en la 2. El proveedor va en la **columna D**, no en la K, para
    que la prueba falle si alguien fija la columna en vez de buscarla.

    ACME está en tres contratos: tiene que salir una sola vez.
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "2026"
    ws["A1"] = "CONTROL DE CONTRATOS DE BIENES Y SERVICIOS"
    ws.append([])
    for j, h in enumerate(["Ítem", "Nro. DE CONTRATO", "Área Protegida",
                           "Nombre del Proveedor ", "CATEGORIA DEL PROCESO"], 1):
        ws.cell(row=2, column=j, value=h)
    for f in [("1", "FIAS-2026-001", "PN Cotopaxi", "ACME S.A.", "Combustible"),
              ("2", "FIAS-2026-002", "RPF Chimborazo", "Edwin Sinchiguano", "Mantenimiento"),
              ("3", "FIAS-2026-003", "PN Cotopaxi", "ACME S.A.", "Combustible"),
              ("4", "FIAS-2026-004", "PN Machalilla", "FERRETERÍA NUEVA", "Limpieza"),
              ("5", "FIAS-2026-005", "PN Cotopaxi", "ACME S.A.", "Internet")]:
        ws.append(list(f))
    wb.save(ruta)
    return wb


def pegar_texto(base, txt, destino, ya_puestos):
    """Pega el texto en una hoja «Proveedores», como haría una persona con
    Ctrl+V — y deja en la columna A solo los nombres que ya estarían puestos,
    para que los demás salgan en el aviso."""
    wb = openpyxl.load_workbook(base)
    ws = wb.create_sheet("Proveedores")
    for i, linea in enumerate(txt.split("\n"), 1):
        for j, celda in enumerate(linea.split("\t"), 1):
            if celda == "":
                continue
            if j == 1 and i >= H.FILA_1 and celda not in ya_puestos:
                continue          # ese proveedor todavía no tiene fila
            ws.cell(row=i, column=j,
                    value=a_ingles(celda) if celda.startswith("=") else celda)
    wb.save(destino)


def main():
    tmp = tempfile.mkdtemp(prefix="hojaprov_")
    base = os.path.join(tmp, "maestro.xlsx")
    junto = os.path.join(tmp, "junto.xlsx")
    maestro_de_mentira(base)

    provs, col_prov = H.leer(base)
    H.FILAS_MIRA = 20      # veinte filas bastan; con 500 la prueba tarda minutos
    txt = H.texto_para_pegar(provs, col_prov)

    print("\n1 · Lo que se entrega")
    ok(col_prov == "D",
       "encuentra el proveedor en la columna D por su encabezado, no fijado en la K",
       col_prov)
    lineas = txt.split("\n")
    ok(lineas[1].split("\t")[0] == "Nombre del Proveedor",
       "los encabezados que lee el robot van en la fila 2")
    nombres_col_a = [l.split("\t")[0] for l in lineas[H.FILA_1 - 1:] if l.split("\t")[0]]
    ok(nombres_col_a == ["ACME S.A.", "Edwin Sinchiguano", "FERRETERÍA NUEVA"],
       "la columna A trae los nombres ya puestos, uno por proveedor", nombres_col_a)
    ok(all(not n.startswith("=") for n in nombres_col_a),
       "y son valores, no fórmulas: al lado se escribe a mano")
    formulas_txt = [c for l in lineas for c in l.split("\t") if c.startswith("=")]
    ok(formulas_txt and not any("," in f for f in formulas_txt),
       "ninguna fórmula usa la coma: el separador es «;», como en un Excel en español",
       [f for f in formulas_txt if "," in f][:1])
    ok(any("CONTAR.SI" in f for f in formulas_txt),
       "y con los nombres en español")

    print("\n2 · La columna que se llena sola, ejecutando sus fórmulas")
    try:
        import formulas
    except ImportError:
        print("  · sin el paquete «formulas» no se pueden ejecutar. Instálalo con:")
        print("        pip install formulas")
        return 1 if fallos else 0

    # Solo dos de los tres tienen fila; el tercero tiene que aparecer en el aviso.
    pegar_texto(base, txt, junto, {"ACME S.A.", "Edwin Sinchiguano"})
    sol = formulas.ExcelModel().loads(junto).finish().calculate()
    libro = os.path.basename(junto)

    def celda(c):
        r = sol.get(f"'[{libro}]PROVEEDORES'!{c}")
        try:
            return r.value[0, 0]
        except Exception:
            return r

    aviso = [celda(f"{H.COL_AVISO}{H.FILA_1 + i}") for i in range(H.FILAS_MIRA)]
    aviso = [x for x in aviso if x]
    ok(aviso == ["FERRETERÍA NUEVA"],
       "avisa del que no tiene fila, y solo de ese", aviso)
    ok(float(celda(f"{H.COL_AVISO}1")) == 1, "y el contador dice cuántos faltan",
       celda(f"{H.COL_AVISO}1"))

    print("\n3 · Con todos puestos, el aviso se queda vacío")
    junto2 = os.path.join(tmp, "junto2.xlsx")
    pegar_texto(base, txt, junto2,
                {"ACME S.A.", "Edwin Sinchiguano", "FERRETERÍA NUEVA"})
    sol2 = formulas.ExcelModel().loads(junto2).finish().calculate()
    libro2 = os.path.basename(junto2)

    def celda2(c):
        r = sol2.get(f"'[{libro2}]PROVEEDORES'!{c}")
        try:
            return r.value[0, 0]
        except Exception:
            return r

    aviso2 = [x for x in (celda2(f"{H.COL_AVISO}{H.FILA_1 + i}")
                          for i in range(H.FILAS_MIRA)) if x]
    ok(aviso2 == [], "ningún nombre de más", aviso2)
    ok(float(celda2(f"{H.COL_AVISO}1")) == 0, "y el contador en cero",
       celda2(f"{H.COL_AVISO}1"))

    print("\n" + (f"✗ {fallos} comprobación(es) fallaron" if fallos else "✓ todo bien"))
    return 1 if fallos else 0


if __name__ == "__main__":
    sys.exit(main())
