# -*- coding: utf-8 -*-
"""
Comprobaciones de la hoja «Proveedores» y de la que se llena sola.

La hoja `Proveedores_Faltan` es una fórmula, y una fórmula mal escrita no falla:
se queda callada y muestra vacío, que es exactamente lo que se vería si no
faltara ninguno. Por eso aquí **se ejecuta de verdad**, con un motor de fórmulas,
y se comprueba qué devuelve.

    pip install openpyxl formulas
    python3 scripts/probar_hoja_proveedores.py

Lo que se comprueba, que son las tres cosas que pueden salir mal:

  · que la columna del proveedor se encuentre **por su encabezado** y no por su
    letra —en la prueba va en la D, no en la K, porque el maestro es de otra
    persona y las columnas se mueven—;
  · que un proveedor que está en dos contratos salga **una vez**;
  · que los que ya tienen fila **no** salgan.

Y una que no es de fórmulas pero se paga cara: que la hoja «Proveedores» no
lleve ninguna fórmula. Es la que lee el robot, y el robot lee valores guardados:
una fórmula sin calcular se publica como vacía.
"""
import sys, os, tempfile, warnings

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


def maestro_de_mentira(ruta):
    """Un maestro mínimo con la forma del de verdad: título en la fila 1,
    encabezados en la 2 y el proveedor en la **columna D**, para que la prueba
    falle si alguien vuelve a fijar la columna en la K."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "2026"
    ws["A1"] = "CONTROL DE CONTRATOS DE BIENES Y SERVICIOS"
    ws.append([])
    for j, h in enumerate(["Ítem", "Nro. DE CONTRATO", "Área Protegida",
                           "Nombre del Proveedor ", "CATEGORIA DEL PROCESO"], 1):
        ws.cell(row=2, column=j, value=h)
    for fila in [("1", "FIAS-2026-001", "PN Cotopaxi", "RIVERJARDÍN CÍA. LTDA.", "Combustible"),
                 ("2", "FIAS-2026-002", "RPF Chimborazo", "Edwin Klever Sinchiguano", "Mantenimiento"),
                 ("3", "FIAS-2026-003", "PN Cotopaxi", "RIVERJARDÍN CÍA. LTDA.", "Combustible"),
                 ("4", "FIAS-2026-900", "PN Cotopaxi", "FERRETERÍA EL CÓNDOR S.A.", "Mantenimiento"),
                 ("5", "FIAS-2026-901", "RPF Chimborazo", "María Soledad Quintana Ruiz", "Limpieza"),
                 ("6", "FIAS-2026-902", "PN Cotopaxi", "FERRETERÍA EL CÓNDOR S.A.", "Mantenimiento")]:
        ws.append(list(fila))
    wb.save(ruta)


def pegar(base, hojas, destino):
    """Copia las dos hojas generadas al maestro, como lo haría una persona."""
    wb = openpyxl.load_workbook(base)
    src = openpyxl.load_workbook(hojas)
    for nombre in (H.HOJA_FALTAN, "Proveedores"):
        s, d = src[nombre], wb.create_sheet(nombre)
        for fila in s.iter_rows():
            for c in fila:
                if c.value is not None:
                    d.cell(row=c.row, column=c.column, value=c.value)
    wb.save(destino)


def main():
    tmp = tempfile.mkdtemp(prefix="hojaprov_")
    base = os.path.join(tmp, "maestro.xlsx")
    hojas = os.path.join(tmp, "hojas.xlsx")
    junto = os.path.join(tmp, "junto.xlsx")
    maestro_de_mentira(base)

    # Los dos que ya tienen fila. Los otros dos de la hoja 2026 "faltan".
    provs = {
        H.norm("RIVERJARDÍN CÍA. LTDA."): {
            "raw": {"RIVERJARDÍN CÍA. LTDA.": 2}, "areas": {"PN Cotopaxi"},
            "cats": {"Combustible"}, "n": 2, "ultimo": "FIAS-2026-003"},
        H.norm("Edwin Klever Sinchiguano"): {
            "raw": {"Edwin Klever Sinchiguano": 1}, "areas": {"RPF Chimborazo"},
            "cats": {"Mantenimiento"}, "n": 1, "ultimo": "FIAS-2026-002"},
    }
    H.escribir(provs, hojas)
    pegar(base, hojas, junto)

    print("\n1 · La hoja que lee el robot son valores, no fórmulas")
    ws = openpyxl.load_workbook(hojas)["Proveedores"]
    formulas_sueltas = [c.coordinate for f in ws.iter_rows() for c in f
                        if isinstance(c.value, str) and c.value.startswith("=")]
    ok(not formulas_sueltas,
       "«Proveedores» no lleva ninguna fórmula: el robot lee valores guardados",
       formulas_sueltas[:3])
    ok([c.value for c in ws[1]][:3] == ["Nombre del Proveedor", "RUC",
                                        "Actividad económica"],
       "y sus encabezados son los que el robot busca")
    ok(ws.max_row == 3, "con los proveedores que ya tenían fila", ws.max_row - 1)

    print("\n2 · La hoja que se llena sola, ejecutando sus fórmulas")
    try:
        import formulas
    except ImportError:
        print("  · sin el paquete «formulas» no se pueden ejecutar. Instálalo con:")
        print("        pip install formulas")
        return 0 if not fallos else 1
    sol = formulas.ExcelModel().loads(junto).finish().calculate()
    nombre_libro = os.path.basename(junto)

    def celda(c):
        r = sol.get(f"'[{nombre_libro}]{H.HOJA_FALTAN.upper()}'!{c}")
        try:
            return r.value[0, 0]
        except Exception:
            return r

    ok(celda("C1") == 4,
       "encuentra la columna del proveedor por su encabezado, no por su letra",
       celda("C1"))
    lista = [x for x in (celda(f"A{r}") for r in range(5, 5 + H.FILAS_MIRA)) if x]
    ok(lista == ["FERRETERÍA EL CÓNDOR S.A.", "María Soledad Quintana Ruiz"],
       "lista exactamente los dos que no tienen fila", lista)
    ok(len([x for x in lista if "FERRETER" in x]) == 1,
       "y el que está en dos contratos sale una sola vez")
    ok(float(celda("B3")) == 2, "el contador dice cuántos faltan", celda("B3"))

    print("\n3 · Cuando no falta ninguno, se queda vacía")
    provs2 = dict(provs)
    for n, nom in (("FERRETERÍA EL CÓNDOR S.A.", "FERRETERÍA EL CÓNDOR S.A."),
                   ("María Soledad Quintana Ruiz", "María Soledad Quintana Ruiz")):
        provs2[H.norm(n)] = {"raw": {nom: 1}, "areas": set(), "cats": set(),
                             "n": 1, "ultimo": ""}
    hojas2 = os.path.join(tmp, "hojas2.xlsx")
    junto2 = os.path.join(tmp, "junto2.xlsx")
    H.escribir(provs2, hojas2)
    pegar(base, hojas2, junto2)
    sol2 = formulas.ExcelModel().loads(junto2).finish().calculate()

    def celda2(c):
        r = sol2.get(f"'[{os.path.basename(junto2)}]{H.HOJA_FALTAN.upper()}'!{c}")
        try:
            return r.value[0, 0]
        except Exception:
            return r

    lista2 = [x for x in (celda2(f"A{r}") for r in range(5, 5 + H.FILAS_MIRA)) if x]
    ok(lista2 == [], "ningún nombre de más cuando todos tienen fila", lista2)
    ok(float(celda2("B3")) == 0, "y el contador en cero", celda2("B3"))

    print("\n" + (f"✗ {fallos} comprobación(es) fallaron"
                  if fallos else "✓ todo bien"))
    return 1 if fallos else 0


if __name__ == "__main__":
    sys.exit(main())
