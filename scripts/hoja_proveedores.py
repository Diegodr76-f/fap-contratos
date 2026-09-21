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
maestro a mano, porque el maestro es de otra persona. Y hay una razón dura para
no escribir en él: abrir y volver a guardar el maestro con openpyxl **borra los
enlaces de la hoja «Export»**, y el robot los publica —se probó y los 138
contratos se quedaron sin link—.

De paso avisa de dos cosas que el llenado tiene que resolver:

  · **Variantes de escritura** — «RIVERJARDÍN CÍA. LTDA.» y «RIVERJARDIN CÍA.
    LTDA» son el mismo proveedor y se unifican solas al normalizar el nombre.
  · **Nombres parecidos que NO se unifican** — «PLASENCIA» contra «PLASCENCIA»,
    «JOHNNY» contra «JHONNY». Son errores de tecleo que parten en dos el
    historial de una misma persona, y el nombre no alcanza para decidirlo: lo
    decide el RUC. Por eso salen listados, para revisarlos mientras se llena.

## Son dos hojas, y la separación es el diseño

  · **«Proveedores»** — lo que se llena, y lo que lee el robot. Valores
    guardados, ninguna fórmula.
  · **«Proveedores_Faltan»** — una fórmula que mira la hoja 2026 y dice qué
    proveedores todavía no tienen fila. Casi siempre está vacía.

Separadas porque **nunca se escribe a mano al lado de una fórmula que se
expande**: al aparecer un nombre nuevo la lista se recorre y los RUC de al lado
quedan pegados a otra persona. Es el error clásico de este patrón, y la razón
de que los datos vivan en una hoja que no se mueve.

Así, cuando entra un contrato con un proveedor nuevo, su nombre aparece solo en
«Proveedores_Faltan». Se copia a la primera fila libre de «Proveedores» —o se
elige del desplegable de esa columna, que se alimenta de ahí mismo— y se le
llena el RUC. Nadie teclea un nombre, así que no hay forma de que entre con una
tilde distinta.

Para ponerse al día de golpe cuando se acumularon varios:

    python3 scripts/hoja_proveedores.py --actualizar <maestro.xlsx> [salida.xlsx]

escribe **solo las filas que faltan**, en el mismo orden de columnas que ya
tiene la hoja (si le añadieron columnas propias —teléfono, dirección— las
respeta y las deja en blanco). Si no falta ninguna, no escribe nada y lo dice.

Lo que NO hace es decidir por nadie: si un nombre nuevo se parece a uno que ya
está, lo añade igual —perder un proveedor es peor que tener una fila de más— y
lo saca en la lista de parecidos para que se resuelva con el RUC.

Las fórmulas se comprueban ejecutándolas, con `scripts/probar_hoja_proveedores.py`:
una fórmula mal escrita no falla, se queda vacía — que es justo lo que se vería
si no faltara ningún proveedor.
"""
import sys, os, re, unicodedata, itertools
from collections import defaultdict

try:
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment
    from openpyxl.worksheet.datavalidation import DataValidation
    from openpyxl.formatting.rule import FormulaRule
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

HOJA_FALTAN = "Proveedores_Faltan"
FILAS_MIRA = 500        # cuántas filas de la hoja de contratos vigila la fórmula

# La hoja que se llena sola vive **aparte** de la que se escribe, y eso es el
# punto del diseño, no una manía: nunca se escribe a mano al lado de una fórmula
# que se expande. Cuando aparece un nombre nuevo, la lista se recorre —y los RUC
# de al lado quedan pegados a otra persona—. En «Proveedores» todo son valores
# guardados, que no se mueven; la fórmula vive sola en su hoja.
#
# Y son funciones clásicas a propósito: IF, AND, COUNTIF, INDEX, MATCH. UNIQUE y
# FILTER harían esto en una línea, pero solo existen en Excel 365, se guardan con
# prefijos raros (`_xlfn.`) cuando no las escribe Excel, y no hay forma de
# comprobarlas aquí. Estas se probaron ejecutándolas.
#
# La columna del proveedor se busca por su encabezado, no se fija en la K: el
# maestro es de otra persona y las columnas se mueven de sitio.
F_COLUMNA = "=IFERROR(MATCH(\"Nombre del Proveedor*\",'{hoja}'!${fila}:${fila},0),0)"
# De la fila `origen` de la hoja de contratos: el nombre del proveedor, si no
# tiene ya fila en «Proveedores» y no salió antes en esta misma lista.
F_FALTA = ("=IF($C$1=0,\"\","
           "IF(INDEX('{hoja}'!$A{origen}:$BZ{origen},1,$C$1)=\"\",\"\","
           "IF(AND("
           "COUNTIF(Proveedores!$A$2:$A${hastaprov},INDEX('{hoja}'!$A{origen}:$BZ{origen},1,$C$1))=0,"
           "COUNTIF($A${primera}:$A${anterior},INDEX('{hoja}'!$A{origen}:$BZ{origen},1,$C$1))=0),"
           "INDEX('{hoja}'!$A{origen}:$BZ{origen},1,$C$1),\"\")))")


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


def escribir(provs, salida, hoja_contratos="2026", fila_hdr=2):
    """Dos hojas, y la separación entre ellas es el punto del diseño.

    · «Proveedores» es lo que se llena y lo que lee el robot. Son valores
      guardados, sin una sola fórmula: el nombre no se mueve nunca de su fila,
      así que el RUC de al lado no puede terminar pegado a otra persona.
    · «Proveedores_Faltan» es una fórmula sola, que mira la hoja 2026 y dice qué
      proveedores todavía no tienen fila. Casi siempre está vacía.
    """
    wb = openpyxl.Workbook()

    # ---------- la hoja que se llena ----------
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
    ws.freeze_panes = "B2"

    orden = sorted(provs.items(), key=lambda kv: (-kv[1]["n"], kv[0]))
    for _, p in orden:
        ws.append(fila_de(p, cols))

    fin = max(ws.max_row, 2)
    hasta = fin + 300   # sitio para los que vengan, con sus validaciones puestas
    dv_res = DataValidation(type="list", formula1=f'"{RESULTADOS}"', allow_blank=True)
    dv_per = DataValidation(type="list", formula1=f'"{PERIODICIDADES}"', allow_blank=True)
    # El nombre se elige de la lista de los que faltan: ni se teclea ni se copia,
    # así no hay forma de que entre con una tilde distinta.
    dv_nom = DataValidation(type="list", allow_blank=True,
                            formula1=f"={HOJA_FALTAN}!$A$5:$A${4 + FILAS_MIRA}")
    for dv, rango in ((dv_res, f"F2:F{hasta}"), (dv_per, f"G2:G{hasta}"),
                      (dv_nom, f"A{fin + 1}:A{hasta}")):
        ws.add_data_validation(dv)
        dv.add(rango)

    # Un nombre repetido se pinta rojo en el momento. El robot además publica la
    # fila más completa de las dos, pero mejor verlo aquí y borrar la de más.
    ws.conditional_formatting.add(
        f"A2:A{hasta}",
        FormulaRule(formula=[f'AND(A2<>"",COUNTIF($A$2:$A${hasta},A2)>1)'],
                    fill=PatternFill("solid", fgColor="FFC7CE"), stopIfTrue=False))

    anchos = [42, 16, 34, 16, 20, 14, 13, 40, 11, 40, 26, 20, 40]
    for j, w in enumerate(anchos, 1):
        ws.column_dimensions[openpyxl.utils.get_column_letter(j)].width = w

    # ---------- la hoja que se llena sola ----------
    wf = wb.create_sheet(HOJA_FALTAN)
    wf["A1"] = "Proveedores con contrato que todavía NO tienen fila en «Proveedores»"
    wf["A1"].font = Font(bold=True, size=11, color="1F3864")
    wf["A2"] = ("Esta hoja se llena sola desde «%s». Si está vacía, no falta ninguno. "
                "Para añadir uno: cópialo y pégalo en la primera fila libre de la "
                "hoja «Proveedores», o elígelo del desplegable de esa columna."
                % hoja_contratos)
    wf["A2"].font = Font(size=9, color="666666")
    wf["C1"] = F_COLUMNA.format(hoja=hoja_contratos, fila=fila_hdr)   # columna del nombre
    wf["C1"].font = Font(size=8, color="BBBBBB")
    wf["A3"] = "Faltan:"
    wf["A3"].font = Font(bold=True, size=10)
    # SUMPRODUCT y no COUNTIF("?*"): las filas que no aportan nada devuelven "",
    # que es texto vacío y no una celda vacía, y COUNTIF las cuenta igual —da 500
    # en vez de 2—. Se comprobó ejecutando las dos.
    wf["B3"] = '=SUMPRODUCT((A5:A%d<>"")*1)' % (4 + FILAS_MIRA)
    wf["B3"].font = Font(bold=True, size=10, color="C00000")
    wf["A4"] = "Nombre del proveedor (cópialo a la hoja «Proveedores»)"
    wf["A4"].font = Font(bold=True, size=10, color="FFFFFF")
    wf["A4"].fill = PatternFill("solid", fgColor="1F3864")
    for k in range(FILAS_MIRA):
        destino, origen = 5 + k, fila_hdr + 1 + k
        # La primera fila no tiene nada arriba con qué compararse: se la manda
        # contra el encabezado, que nunca va a coincidir con un nombre.
        wf.cell(row=destino, column=1).value = F_FALTA.format(
            hoja=hoja_contratos, origen=origen, hastaprov=hasta,
            primera=4 if destino == 5 else 5, anterior=destino - 1)
    wf.column_dimensions["A"].width = 56
    wf.freeze_panes = "A5"

    wb.save(salida)
    return fin - 1


def canon(p):
    """El nombre que se escribió más veces: es el que la mayoría de los
    contratos ya lleva, así que es el que menos hay que corregir después."""
    return max(p["raw"].items(), key=lambda kv: (kv[1], len(kv[0])))[0]


def fila_de(p, encabezados):
    """Una fila en el orden de columnas que ya tiene la hoja. Lo que no reconoce
    lo deja en blanco: si al maestro le añadieron columnas propias —teléfono,
    dirección— se respetan y no se pisan."""
    nombre = canon(p)
    valores = {
        "nombre del proveedor": nombre,
        "periodicidad": "Anual",
        "(ref) contratos": p["n"],
        "(ref) áreas": " · ".join(sorted(p["areas"])),
        "(ref) categorías": " · ".join(sorted(p["cats"])),
        "(ref) último contrato": p["ultimo"] or "",
        "(ref) variantes de escritura": " | ".join(sorted(x for x in p["raw"]
                                                         if x != nombre)),
    }
    return [valores.get(str(h or "").strip().lower()) for h in encabezados]


def leer_hoja(ruta):
    """Lo que ya está en la hoja «Proveedores» del maestro: los encabezados tal
    cual, y las llaves de los proveedores que ya tienen fila."""
    wb = openpyxl.load_workbook(ruta, read_only=True, data_only=True)
    if "Proveedores" not in wb.sheetnames:
        wb.close()
        return None, None
    ws = wb["Proveedores"]
    filas = list(ws.iter_rows(values_only=True))
    wb.close()
    if not filas:
        return [], {}
    # Dónde están los encabezados: la hoja se pega con la fila 1, pero las hojas
    # de contratos del maestro llevan título arriba y encabezados en la 2. El
    # robot mira igual las tres primeras; aquí se hace lo mismo para no diferir.
    i_hdr = next((i for i, r in enumerate(filas[:3])
                  if r and any("nombre del proveedor" in norm(c).lower()
                               for c in r if c)), 0)
    encabezados = list(filas[i_hdr])
    ya = {}
    for r in filas[i_hdr + 1:]:
        if r and r[0] and norm(r[0]):
            ya[norm(r[0])] = str(r[0]).strip()
    return encabezados, ya


def actualizar(entrada, salida):
    encabezados, ya = leer_hoja(entrada)
    if encabezados is None:
        sys.exit(f"«{entrada}» todavía no tiene la hoja «Proveedores». "
                 "Créala primero, sin --actualizar.")
    provs = leer(entrada)
    if not provs:
        sys.exit("No encontré la columna «Nombre del Proveedor» en ninguna hoja "
                 "de contratos. ¿Cambiaron los encabezados?")

    faltan = {k: p for k, p in provs.items() if k not in ya}
    sobran = [nombre for k, nombre in ya.items() if k not in provs]

    if not faltan:
        print(f"La hoja está al día: los {len(provs)} proveedores con contratos "
              f"ya tienen fila. No escribí nada.")
    else:
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Proveedores"
        ws.append(encabezados)
        for c in ws[1]:
            c.font = Font(bold=True, size=10)
        for _, p in sorted(faltan.items(), key=lambda kv: (-kv[1]["n"], kv[0])):
            ws.append(fila_de(p, encabezados))
        for j in range(1, len(encabezados) + 1):
            ws.column_dimensions[openpyxl.utils.get_column_letter(j)].width = 28
        wb.save(salida)
        print(f"OK: {len(faltan)} proveedor(es) nuevo(s) en «{salida}».")
        print("    Pega esas filas al final de la hoja «Proveedores» del maestro "
              "y llena su RUC y actividad.")
        print(f"    Los otros {len(ya)} ya tenían fila; no se tocan.")

    # Un nombre nuevo que se parece a uno que ya está casi siempre es un error
    # de tecleo en el contrato, no un proveedor distinto. Se añade igual —perder
    # uno es peor que tener una fila de más— pero se dice, que es lo que el RUC
    # resuelve.
    dudosos = [(canon(p), ya[k2]) for k, p in faltan.items()
               for k2 in ya if parecidos(k, k2)]
    if dudosos:
        print(f"\n⚠ {len(dudosos)} de los nuevos se parecen a uno que ya está en "
              "la hoja. Si comparten RUC, es el mismo y sobra la fila nueva:")
        for nuevo, viejo in dudosos:
            print(f"   · nuevo: {nuevo}\n     ya está: {viejo}")

    if sobran:
        print(f"\n{len(sobran)} fila(s) de la hoja sin ningún contrato. No las "
              "borro —puede ser un proveedor registrado antes de contratarlo—, "
              "pero conviene mirarlas:")
        for nombre in sorted(sobran)[:10]:
            print("   ·", nombre)
        if len(sobran) > 10:
            print(f"   … y {len(sobran) - 10} más")


def main():
    args = [a for a in sys.argv[1:] if a != "--actualizar"]
    modo_actualizar = "--actualizar" in sys.argv
    if not args:
        sys.exit("Uso:\n"
                 "  python3 scripts/hoja_proveedores.py <maestro.xlsx> [salida.xlsx]\n"
                 "      crea la hoja «Proveedores» completa, ya pre-llenada\n"
                 "  python3 scripts/hoja_proveedores.py --actualizar <maestro.xlsx> [salida.xlsx]\n"
                 "      solo las filas que faltan, para pegarlas al final")
    entrada = args[0]
    if not os.path.exists(entrada):
        sys.exit(f"No encuentro el archivo: {entrada}")

    if modo_actualizar:
        actualizar(entrada, args[1] if len(args) > 1 else "Proveedores_nuevos.xlsx")
        return

    salida = args[1] if len(args) > 1 else "Proveedores_FAP.xlsx"
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
