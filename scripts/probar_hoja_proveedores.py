# -*- coding: utf-8 -*-
"""
Comprobaciones de la hoja «Proveedores», la que se llena sola.

Es una hoja de puras fórmulas, y una fórmula mal escrita no falla: se queda
callada y muestra vacío, que es exactamente lo que se vería si no hubiera
proveedores. Por eso aquí **se ejecutan de verdad**, con un motor de fórmulas.

    pip install openpyxl formulas
    python3 scripts/probar_hoja_proveedores.py

Lo que se comprueba, que son las cosas que pueden salir mal en silencio:

  · que las columnas de la hoja 2026 se encuentren **por su encabezado** y no
    por su letra —en la prueba el proveedor va en la D, no en la K, porque el
    maestro es de otra persona y las columnas se mueven—;
  · que un proveedor con varios contratos salga **una sola vez**;
  · que el RUC escrito en **una sola** de sus filas aparezca igual, que es el
    punto de todo el diseño;
  · que de dos verificaciones se muestre **la más reciente**, con el resultado
    que le corresponde a esa fecha y no a otra;
  · y que un proveedor sin nada escrito salga igual, con sus columnas vacías.
"""
import sys, os, datetime, tempfile, warnings

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
    """La hoja 2026 con la forma de la de verdad: título en la fila 1,
    encabezados en la 2, y el proveedor en la **columna D** —no en la K— para
    que la prueba falle si alguien vuelve a fijar la columna.

    El RUC de cada proveedor se escribe en UNA sola de sus filas, que es como se
    va a usar. Y a RIVERJARDÍN se le ponen dos verificaciones, en filas
    distintas y desordenadas, para ver que sale la más reciente.
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "2026"
    ws["A1"] = "CONTROL DE CONTRATOS DE BIENES Y SERVICIOS"
    ws.append([])
    cols = ["Ítem", "Nro. DE CONTRATO", "Área Protegida", "Nombre del Proveedor ",
            "CATEGORIA DEL PROCESO", "RUC del Proveedor", "Actividad económica",
            "Verificación del Proveedor", "Verificado por",
            "Resultado de la verificación", "Periodicidad"]
    for j, h in enumerate(cols, 1):
        ws.cell(row=2, column=j, value=h)
    filas = [
        # ítem, nro, área, proveedor, categoría, ruc, actividad, fecha, por, resultado, per.
        ("1", "FIAS-2026-001", "PN Cotopaxi", "RIVERJARDÍN CÍA. LTDA.", "Combustible",
         None, None, datetime.date(2026, 3, 1), "Mery Zambrano", "Vigente", "Anual"),
        ("2", "FIAS-2026-002", "RPF Chimborazo", "Edwin Klever Sinchiguano", "Mantenimiento",
         "0603123456001", "Mantenimiento de instalaciones", None, None, None, None),
        # el RUC de RIVERJARDÍN va aquí, en su segundo contrato, y su verificación
        # más reciente también: ni la primera fila ni en orden
        ("3", "FIAS-2026-003", "PN Cotopaxi", "RIVERJARDÍN CÍA. LTDA.", "Combustible",
         "1790123456001", "Venta de combustibles", datetime.date(2026, 8, 15), "Cynthia Jarrín",
         "Observado", "Semestral"),
        ("4", "FIAS-2026-004", "PN Machalilla", "SIN NADA ESCRITO S.A.", "Limpieza",
         None, None, None, None, None, None),
        ("5", "FIAS-2026-005", "PN Cotopaxi", "RIVERJARDÍN CÍA. LTDA.", "Internet",
         None, None, None, None, None, None),
    ]
    for f in filas:
        ws.append(list(f))
    wb.save(ruta)


def pegar(base, vista, destino):
    """Copia la hoja de la vista al maestro, como lo haría una persona."""
    wb = openpyxl.load_workbook(base)
    src = openpyxl.load_workbook(vista)["Proveedores"]
    d = wb.create_sheet("Proveedores")
    for fila in src.iter_rows():
        for c in fila:
            if c.value is not None:
                d.cell(row=c.row, column=c.column, value=c.value)
    wb.save(destino)


def main():
    tmp = tempfile.mkdtemp(prefix="hojaprov_")
    base = os.path.join(tmp, "maestro.xlsx")
    vista = os.path.join(tmp, "vista.xlsx")
    junto = os.path.join(tmp, "junto.xlsx")
    maestro_de_mentira(base)
    # Veinte filas bastan para la lógica y la prueba tarda segundos, no minutos.
    FILAS = 20
    columnas = H.columnas_del_maestro(base)
    H.escribir_vista(vista, columnas, filas=FILAS)
    pegar(base, vista, junto)

    print("\n1 · Las columnas que hay que añadir a la hoja 2026")
    faltan, estan = H.columnas_que_faltan(base)
    ok(not faltan, "las encuentra todas cuando ya están puestas", faltan)
    vacio = os.path.join(tmp, "vacio.xlsx")
    wb = openpyxl.Workbook()
    wb.active.title = "2026"
    wb.save(vacio)
    faltan2, _ = H.columnas_que_faltan(vacio)
    ok(len(faltan2) == len(H.COLUMNAS_2026),
       "y dice que faltan las seis cuando no hay ninguna", faltan2)

    print("\n2 · La vista, ejecutando sus fórmulas")
    try:
        import formulas
    except ImportError:
        print("  · sin el paquete «formulas» no se pueden ejecutar. Instálalo con:")
        print("        pip install formulas")
        return 1 if fallos else 0
    sol = formulas.ExcelModel().loads(junto).finish().calculate()
    libro = os.path.basename(junto)

    def celda(c):
        r = sol.get(f"'[{libro}]PROVEEDORES'!{c}")
        try:
            return r.value[0, 0]
        except Exception:
            return r

    ok(columnas.get("Nombre del Proveedor") == "D",
       "encuentra el proveedor en la columna D por su encabezado, no fijada en la K",
       columnas.get("Nombre del Proveedor"))
    ok(columnas.get("RUC del Proveedor") == "F", "y el RUC donde está",
       columnas.get("RUC del Proveedor"))

    filas = []
    for i in range(FILAS):
        nombre = celda(f"A{4 + i}")
        if nombre:
            filas.append((nombre, celda(f"B{4 + i}"), celda(f"C{4 + i}"),
                          celda(f"D{4 + i}"), celda(f"E{4 + i}"), celda(f"F{4 + i}")))
    nombres = [f[0] for f in filas]
    ok(nombres == ["RIVERJARDÍN CÍA. LTDA.", "Edwin Klever Sinchiguano",
                   "SIN NADA ESCRITO S.A."],
       "lista cada proveedor una sola vez, en orden de aparición", nombres)

    river = filas[0]
    ok(river[1] == "1790123456001",
       "el RUC escrito en UNA sola fila sale igual — el punto de todo esto",
       river[1])
    ok(river[2] == "Venta de combustibles", "y su actividad", river[2])
    ok(river[5] == 3, "cuenta sus tres contratos", river[5])
    # Excel guarda las fechas como número de serie: 15/8/2026 es 46249.
    ok(str(river[3])[:5] == "46249" or "2026-08-15" in str(river[3]),
       "de sus dos verificaciones muestra la más reciente (15 ago), no la primera",
       river[3])
    ok(river[4] == "Observado",
       "con el resultado de ESA fecha, no el de la otra", river[4])

    edwin = filas[1]
    ok(edwin[1] == "0603123456001", "el de una persona natural igual", edwin[1])
    ok(edwin[5] == 1, "con su único contrato", edwin[5])

    nada = filas[2]
    ok(not nada[1] and not nada[2] and not nada[4],
       "un proveedor sin nada escrito sale igual, con sus columnas vacías",
       nada[1:])
    ok(nada[5] == 1, "y con su contrato contado", nada[5])

    print("\n" + (f"✗ {fallos} comprobación(es) fallaron" if fallos else "✓ todo bien"))
    return 1 if fallos else 0


if __name__ == "__main__":
    sys.exit(main())
