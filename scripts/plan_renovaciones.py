# -*- coding: utf-8 -*-
"""
Plan de renovaciones y procesos nuevos FAP 2027.

Lee la hoja "2026" del «Sistema de Alertas de Contratos FIAS» y arma el anexo
operativo del plan: qué contrato se puede renovar, cuál ya agotó su renovación
y debe salir como proceso nuevo, por qué vía va cada uno, hasta cuándo hay
plazo para enviarlo a la Unidad Operativa y en qué semana le toca.

La regla que ordena todo: FIAS permite renovar UNA sola vez. Un contrato
firmado en 2026 como "Renovación" ya usó ese cupo — para 2027 necesita un
proceso nuevo. Uno firmado como "Nuevo" todavía puede renovarse.

    python3 scripts/plan_renovaciones.py Sistema_Alertas_Contratos_FIAS.xlsx [carpeta_salida]

Escribe (fuera del repositorio, porque llevan datos de contratos y correos):
    Anexo_Renovaciones_2027_FAP.xlsx   maestro + una hoja por AC + calendario
    correos/<AC>.txt                   el correo de consulta ya redactado
"""
import sys, os, csv, datetime, unicodedata, re
from collections import Counter, defaultdict

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

# ---------------------------------------------------------------- parámetros
HOY = datetime.date(2026, 9, 1)

# Objetos que NO son "servicio recurrente y esencial": nunca van por renovación,
# siempre por proceso nuevo, y quedan fuera de la campaña de áreas protegidas.
NO_RECURRENTES = {"Consultoría", "Adquisición de equipos de campo"}

# Antelación mínima con la que la solicitud debe llegar a la Unidad Operativa,
# tomada del análisis de tiempos 2026 (mediana 28 d, p90 50 d; comparación de
# precios 40 d). Es lo que elimina la retroactividad, no la velocidad legal.
ANTELACION = {"A": 45, "B": 45, "C": 60}

RUTAS = {
    "A": "Renovación",
    "B": "Selección directa por excepción",
    "C": "Comparación de precios",
}

# Cupo semanal de ingreso. La unidad legal firmó 5,4 instrumentos/semana en
# promedio y 13 en su mejor semana; 10 sostiene el plan sin repetir el atasco
# de enero (60 procesos simultáneos en cola el 4 de febrero de 2026).
CUPO_SEMANAL = 10
PRIMERA_SEMANA = datetime.date(2026, 9, 21)   # lunes


MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
         "agosto", "septiembre", "octubre", "noviembre", "diciembre"]


def dl(d):
    """Fecha en castellano, para los correos."""
    return f"{d.day} de {MESES[d.month - 1]} de {d.year}"


def plural(n, sing, plu):
    return f"{n} {sing if n == 1 else plu}"


def norm(s):
    s = "" if s is None else str(s).strip().lower()
    s = "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", s)).strip()


def fecha(v):
    if isinstance(v, datetime.datetime):
        return v.date()
    if isinstance(v, datetime.date):
        return v
    return None


def leer(xlsx):
    wb = openpyxl.load_workbook(xlsx, data_only=True, read_only=True)
    ws = wb["2026"]
    filas = list(ws.iter_rows(values_only=True))
    hdr = list(filas[1])
    out = []
    for r in filas[2:]:
        d = dict(zip(hdr, r))
        if not d.get("Nro. DE CONTRATO"):
            continue
        out.append(d)
    wb.close()
    return out


def ruta(cat, tipo, monto):
    """Vía por la que sale el proceso 2027 de este contrato."""
    if cat in NO_RECURRENTES:
        return "C"                      # consultoría / equipos: siempre proceso nuevo
    if tipo == "Nuevo":
        return "A"                      # le queda su única renovación
    # Ya renovó en 2026 → proceso nuevo. La vía depende del objeto y del monto.
    if cat == "Combustible":
        return "B"                      # causal expresa: proveedor más cercano al AP
    if cat in ("Internet", "Radiofrecuencia", "Arrendamiento"):
        return "B"                      # único proveedor / inmueble específico: causal a motivar
    if monto <= 1000:
        return "B"                      # bajo el umbral de comparación de precios
    return "C"                          # mantenimiento, limpieza y demás: 3 cotizaciones


def causal(cat, rt):
    if rt != "B":
        return ""
    if cat == "Combustible":
        return "Combustible: proveedor más cercano al área protegida"
    if cat in ("Internet", "Radiofrecuencia"):
        return "Único proveedor en las inmediaciones (a motivar en el informe)"
    if cat == "Arrendamiento":
        return "Inmueble específico / único en las inmediaciones (a motivar)"
    return "Monto ≤ USD 1.000 con instrumento jurídico"


def clasificar(filas):
    universo, fuera = [], []
    for d in filas:
        if d.get("Estado de Gestión") != "Activo":
            continue
        cat = d["CATEGORIA DEL PROCESO/ BIEN O SERVICIO"]
        tipo = d["TIPO DE CONTRATO"]
        monto = float(d["Monto (incluido IVA)"] or 0)
        fin = fecha(d["FECHA DE FINALIZACIÓN"])
        rt = ruta(cat, tipo, monto)
        reg = {
            "nro": d["Nro. DE CONTRATO"],
            "detalle": str(d["DETALLE DEL CONTRATO"] or "").strip(),
            "area": d["Área Protegida"],
            "categoria": cat,
            "monto": monto,
            "fin": fin,
            "tipo2026": tipo,
            "proveedor": str(d["Nombre del Proveedor "] or "").strip(),
            "ac": d["Administrador/a de contrato"],
            "correo": d["Correo electrónico AC"],
            "adenda": d["Tiene adenda"],
            "ruta": rt,
            "via": RUTAS[rt],
            "causal": causal(cat, rt),
            "renovable": tipo == "Nuevo" and cat not in NO_RECURRENTES,
        }
        reg["limite"] = fin - datetime.timedelta(days=ANTELACION[rt]) if fin else None
        (fuera if cat in NO_RECURRENTES else universo).append(reg)
    return universo, fuera


def programar(universo):
    """Reparte el universo en semanas, primero lo que vence antes y lo que
    tarda más en tramitarse, con un tope de CUPO_SEMANAL por semana."""
    orden = sorted(universo, key=lambda x: (x["limite"], {"C": 0, "B": 1, "A": 2}[x["ruta"]], -x["monto"]))
    for i, x in enumerate(orden):
        x["semana"] = PRIMERA_SEMANA + datetime.timedelta(weeks=i // CUPO_SEMANAL)
        x["holgura"] = (x["limite"] - x["semana"]).days
        # La AC debe tener los documentos listos una semana antes de enviar.
        x["docs_listos"] = x["semana"] - datetime.timedelta(days=7)
    return orden


# ------------------------------------------------------------------- salidas
AZUL = "00249C"
GRIS = "F4F6FB"
COL = {"A": "E7F4EC", "B": "EEF1FB", "C": "FBF1E1"}


def _cab(ws, fila, titulos, anchos):
    for i, (t, a) in enumerate(zip(titulos, anchos), start=1):
        c = ws.cell(row=fila, column=i, value=t)
        c.font = Font(bold=True, color="FFFFFF", size=10)
        c.fill = PatternFill("solid", fgColor=AZUL)
        c.alignment = Alignment(vertical="center", wrap_text=True)
        ws.column_dimensions[get_column_letter(i)].width = a
    ws.freeze_panes = ws.cell(row=fila + 1, column=1)


CAMPOS = [
    ("nro", "N.º de contrato 2026", 21),
    ("detalle", "Detalle", 46),
    ("area", "Área protegida", 34),
    ("categoria", "Categoría", 16),
    ("monto", "Monto 2026 (USD)", 15),
    ("fin", "Vence", 12),
    ("tipo2026", "Tipo 2026", 12),
    ("renovable", "¿Renovable?", 12),
    ("via", "Vía 2027", 30),
    ("causal", "Causal / nota", 40),
    ("limite", "Enviar a más tardar", 18),
    ("semana", "Semana asignada", 15),
    ("docs_listos", "Documentos listos", 17),
    ("proveedor", "Proveedor 2026", 34),
    ("ac", "Administrador/a", 20),
]


def _fila(ws, r, x):
    for i, (k, _, _) in enumerate(CAMPOS, start=1):
        v = x.get(k)
        if k == "renovable":
            v = "Sí" if v else "No — proceso nuevo"
        if isinstance(v, datetime.date):
            v = v.isoformat()
        c = ws.cell(row=r, column=i, value=v)
        c.alignment = Alignment(vertical="top", wrap_text=(i in (2, 3, 10, 14)))
        if k == "monto":
            c.number_format = '#,##0.00'
        c.fill = PatternFill("solid", fgColor=COL[x["ruta"]])


def escribir_xlsx(universo, fuera, destino):
    wb = openpyxl.Workbook()

    # --- Resumen
    ws = wb.active
    ws.title = "Resumen"
    ws["A1"] = "PLAN DE RENOVACIONES Y PROCESOS NUEVOS · FAP 2027"
    ws["A1"].font = Font(bold=True, size=14, color=AZUL)
    ws["A2"] = f"Corte {HOY.isoformat()} · fuente: Sistema de Alertas de Contratos FIAS, hoja 2026"
    ws["A2"].font = Font(size=10, color="6B7180")
    r = 4
    rc = Counter(x["ruta"] for x in universo)
    montos = defaultdict(float)
    for x in universo:
        montos[x["ruta"]] += x["monto"]
    filas = [
        ("Contratos activos de áreas protegidas en el universo", len(universo), sum(x["monto"] for x in universo)),
        ("A · Renovables (contrato 2026 nuevo)", rc["A"], montos["A"]),
        ("B · Proceso nuevo por selección directa por excepción", rc["B"], montos["B"]),
        ("C · Proceso nuevo por comparación de precios", rc["C"], montos["C"]),
        ("Fuera del universo (objeto no recurrente)", len(fuera), sum(x["monto"] for x in fuera)),
    ]
    _cab(ws, r, ["Concepto", "N.º", "Monto 2026 (USD)"], [58, 10, 20])
    for i, (t, n, m) in enumerate(filas, start=r + 1):
        ws.cell(row=i, column=1, value=t)
        ws.cell(row=i, column=2, value=n)
        c = ws.cell(row=i, column=3, value=round(m, 2))
        c.number_format = '#,##0.00'

    # --- Maestro
    ws = wb.create_sheet("Maestro")
    _cab(ws, 1, [t for _, t, _ in CAMPOS], [a for _, _, a in CAMPOS])
    for i, x in enumerate(sorted(universo, key=lambda y: (y["semana"], y["ruta"], y["nro"])), start=2):
        _fila(ws, i, x)

    # --- Calendario
    ws = wb.create_sheet("Calendario")
    _cab(ws, 1, ["Semana (lunes)", "Procesos", "A · Renovación", "B · Directa", "C · Comparación",
                 "Límite más próximo del lote", "Holgura (días)"], [16, 10, 15, 13, 17, 24, 15])
    sem = defaultdict(list)
    for x in universo:
        sem[x["semana"]].append(x)
    for i, s in enumerate(sorted(sem), start=2):
        g = sem[s]
        c = Counter(y["ruta"] for y in g)
        lim = min(y["limite"] for y in g)
        for j, v in enumerate([s.isoformat(), len(g), c["A"], c["B"], c["C"], lim.isoformat(), (lim - s).days], start=1):
            ws.cell(row=i, column=j, value=v)

    # --- Carga por AC
    ws = wb.create_sheet("Carga por AC")
    _cab(ws, 1, ["Administrador/a de contrato", "Correo", "Total", "A", "B", "C",
                 "Monto 2026 (USD)", "Primera semana", "Responde antes de"],
         [24, 26, 8, 6, 6, 6, 18, 15, 18])
    porac = defaultdict(list)
    for x in universo:
        porac[x["ac"]].append(x)
    for i, (ac, g) in enumerate(sorted(porac.items(), key=lambda kv: min(y["semana"] for y in kv[1])), start=2):
        c = Counter(y["ruta"] for y in g)
        s = min(y["semana"] for y in g)
        vals = [ac, g[0]["correo"], len(g), c["A"], c["B"], c["C"], round(sum(y["monto"] for y in g), 2),
                s.isoformat(), (s - datetime.timedelta(days=5)).isoformat()]
        for j, v in enumerate(vals, start=1):
            cel = ws.cell(row=i, column=j, value=v)
            if j == 7:
                cel.number_format = '#,##0.00'

    # --- Una hoja por AC
    for ac, g in sorted(porac.items()):
        nombre = re.sub(r"[\\/*?:\[\]]", "", str(ac))[:31]
        ws = wb.create_sheet(nombre)
        ws["A1"] = f"{ac} · {len(g)} procesos para 2027"
        ws["A1"].font = Font(bold=True, size=12, color=AZUL)
        _cab(ws, 3, [t for _, t, _ in CAMPOS], [a for _, _, a in CAMPOS])
        for i, x in enumerate(sorted(g, key=lambda y: (y["semana"], y["ruta"])), start=4):
            _fila(ws, i, x)

    # --- Fuera del universo
    ws = wb.create_sheet("Fuera del universo")
    ws["A1"] = "Objetos no recurrentes: no admiten renovación, siempre proceso nuevo"
    ws["A1"].font = Font(bold=True, size=11, color=AZUL)
    _cab(ws, 3, [t for _, t, _ in CAMPOS[:9]], [a for _, _, a in CAMPOS[:9]])
    for i, x in enumerate(fuera, start=4):
        x.setdefault("semana", None)
        x.setdefault("docs_listos", None)
        for j, (k, _, _) in enumerate(CAMPOS[:9], start=1):
            v = x.get(k)
            if k == "renovable":
                v = "No — objeto no recurrente"
            if isinstance(v, datetime.date):
                v = v.isoformat()
            ws.cell(row=i, column=j, value=v)

    wb.save(destino)
    return destino


CUERPO = """Asunto: Contratos {anio} de {area_corta} — confirmar continuidad antes del {responde}

Estimada/o {ac}:

Estamos armando el plan de contratación 2027 del FAP. La regla del FIAS es que un
contrato se renueva UNA sola vez: los que en 2026 ya se firmaron como renovación
no admiten otra, y para 2027 tienen que salir como proceso nuevo. Por eso este
año la solicitud no puede esperar a enero.

Tienes {n} contratos vigentes bajo tu administración:

{tabla}

Te pido dos cosas, antes del {responde}:

1. Confirmar, contrato por contrato, si el área necesita mantener el servicio en
   2027. Si alguno ya no se requiere, decirlo también: es la única forma de no
   tramitar lo que no se va a usar.
2. Para los que sí continúan, revisar el monto. En 2026, 11 de cada 13 adendas
   fueron aumentos de valor por consumo subestimado; toma como base el consumo
   ejecutado de este año, no el presupuesto del contrato.

Qué tienes que preparar según la vía de cada proceso:

{instrucciones}

Tu primer lote entra la semana del {semana}. Los documentos deben estar listos el
{docs}: esa semana la Unidad Operativa recibe hasta 10 procesos de todo el FAP,
así que llegar tarde a tu semana significa esperar a la siguiente.

Todo se envía por el formulario de procesos administrativos. Los expedientes que
lleguen por correo no entran a la cola: en 2026 hubo que reconstruir 18 contratos
que ingresaron por fuera del formulario.

En La Mágica ya tienes las plantillas de los documentos precontractuales.

Gracias,
{firma}
"""

INSTRUCCIONES = {
    "A": ("Renovación ({n}): informe de satisfacción firmado por ti y por el "
          "responsable del área (con el análisis técnico, geográfico y económico que "
          "justifica seguir con el mismo proveedor), PAG 2027 aprobado, solicitud de "
          "cotización al proveedor para el nuevo período y su cotización. El contrato "
          "de renovación lo elabora la Unidad Operativa."),
    "B": ("Selección directa por excepción ({n}): solicitud de inicio del "
          "responsable del área, solicitud de cotización y cotización del proveedor, e "
          "informe de justificación que motive la causal de excepción."),
    "C": ("Comparación de precios ({n}): solicitud de inicio, cotizaciones de "
          "MÍNIMO 3 proveedores de la base del FAP, convocatoria a la Comisión de "
          "Calificación y acta de la Comisión. Es la vía más lenta —40 días de mediana "
          "en 2026— y por eso va primero en el calendario."),
}


def escribir_correos(universo, carpeta, firma="Unidad Legal · FAP"):
    os.makedirs(carpeta, exist_ok=True)
    porac = defaultdict(list)
    for x in universo:
        porac[x["ac"]].append(x)
    for ac, g in porac.items():
        g = sorted(g, key=lambda y: (y["semana"], y["ruta"]))
        s = min(y["semana"] for y in g)
        responde = s - datetime.timedelta(days=5)
        docs = min(y["docs_listos"] for y in g)
        areas = sorted({y["area"] for y in g})
        area_corta = areas[0] if len(areas) == 1 else f"{len(areas)} áreas protegidas"
        tabla = "\n".join(
            "  · {nro}  {det:<44}  vence {fin}  →  {via}  ·  semana del {sem}".format(
                nro=y["nro"], det=(y["detalle"][:42] + "..") if len(y["detalle"]) > 44 else y["detalle"],
                fin=dl(y["fin"]), via=y["via"], sem=dl(y["semana"]))
            for y in g)
        c = Counter(y["ruta"] for y in g)
        instr = "\n\n".join(INSTRUCCIONES[r].format(n=plural(c[r], "contrato", "contratos"))
                            for r in "ABC" if c[r])
        txt = CUERPO.format(anio=2027, area_corta=area_corta, ac=ac, n=len(g), tabla=tabla,
                            responde=dl(responde), instrucciones=instr,
                            semana=dl(s), docs=dl(docs), firma=firma)
        with open(os.path.join(carpeta, re.sub(r"[^\w]+", "_", str(ac)) + ".txt"), "w", encoding="utf-8") as f:
            f.write(txt)
    return len(porac)


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    xlsx = sys.argv[1]
    salida = sys.argv[2] if len(sys.argv) > 2 else "."
    os.makedirs(salida, exist_ok=True)

    universo, fuera = clasificar(leer(xlsx))
    programar(universo)

    anexo = escribir_xlsx(universo, fuera, os.path.join(salida, "Anexo_Renovaciones_2027_FAP.xlsx"))
    n = escribir_correos(universo, os.path.join(salida, "correos"))

    rc = Counter(x["ruta"] for x in universo)
    tarde = [x for x in universo if x["semana"] > x["limite"]]
    print(f"universo: {len(universo)} contratos · A {rc['A']} · B {rc['B']} · C {rc['C']}")
    print(f"fuera del universo (objeto no recurrente): {len(fuera)}")
    print(f"semanas: {len(set(x['semana'] for x in universo))} · cupo {CUPO_SEMANAL}/semana")
    print(f"procesos que quedarían fuera de plazo: {len(tarde)}")
    print(f"anexo: {anexo}")
    print(f"correos redactados: {n}")


if __name__ == "__main__":
    main()
