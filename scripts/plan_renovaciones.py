# -*- coding: utf-8 -*-
"""
Plan de renovaciones y procesos nuevos FAP 2027.

Lee la hoja "2026" del «Sistema de Alertas de Contratos FIAS» y arma el anexo
operativo del plan: qué contrato se puede renovar, cuál ya agotó su renovación
y debe salir como proceso nuevo, por qué vía va cada uno, hasta cuándo hay
plazo para enviarlo a la Unidad Operativa y en qué semana le toca.

La meta del plan es tener los 128 expedientes precontractuales generados y
revisados antes de enero de 2027. La FIRMA no depende de nosotros: sin el PAG
aprobado no se puede suscribir, y además es el PAG el que fija cuánto
presupuesto tiene cada área. Por eso el script separa los documentos que se
pueden hacer ya (bloque 1) de los que necesitan el techo presupuestario
(bloque 2), y proyecta la firma según la fecha en que se apruebe el PAG.

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


# Fechas en que arrancan los sucesores. Cada grupo tiene su propia fecha tope
# de suscripción: no todo tiene que estar firmado el 31 de diciembre.
CORTE_1 = datetime.date(2027, 1, 1)
CORTE_2 = datetime.date(2027, 2, 1)


def grupo_firma(inicio):
    if inicio is None:
        return "—"
    if inicio <= CORTE_1:
        return "1-ene"
    if inicio <= CORTE_2:
        return "1-feb"
    return "posterior"


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
        # El contrato de 2027 arranca el día siguiente al vencimiento del vigente:
        # ese es el día contra el que se mide la retroactividad, no el 1 de enero.
        reg["inicio27"] = fin + datetime.timedelta(days=1) if fin else None
        reg["grupo"] = grupo_firma(reg["inicio27"])
        (fuera if cat in NO_RECURRENTES else universo).append(reg)
    return universo, fuera


def programar(universo):
    """Reparte el universo en semanas, primero lo que vence antes y lo que
    tarda más en tramitarse, con un tope de CUPO_SEMANAL por semana.

    Dentro de cada nivel de urgencia agrupa por categoría a propósito: revisar
    diez expedientes de combustible seguidos cuesta menos que alternarlos con
    mantenimientos y arriendos, porque el revisor contrasta contra el mismo
    modelo de contrato en vez de cambiar de marco en cada expediente."""
    orden = sorted(universo, key=lambda x: (x["limite"], {"C": 0, "B": 1, "A": 2}[x["ruta"]],
                                            x["categoria"], -x["monto"]))
    for i, x in enumerate(orden):
        x["semana"] = PRIMERA_SEMANA + datetime.timedelta(weeks=i // CUPO_SEMANAL)
        x["holgura"] = (x["limite"] - x["semana"]).days
        # La AC debe tener los documentos listos una semana antes de enviar.
        x["docs_listos"] = x["semana"] - datetime.timedelta(days=7)
    return orden



def consolidables(universo):
    """Contratos que podrían salir como UN solo instrumento: misma
    administradora, mismo proveedor y misma categoría, en varias áreas.

    Cada instrumento que se evita es una revisión, una elaboración y una toma
    de firmas menos — y la capacidad de la unidad legal se mide en instrumentos,
    no en dólares."""
    grupos = defaultdict(list)
    for x in universo:
        grupos[(x["ac"], norm(x["proveedor"]), x["categoria"])].append(x)
    out = [(k, v) for k, v in grupos.items() if len(v) > 1]
    out.sort(key=lambda kv: -len(kv[1]))
    return out


def _factor_semana(w):
    """Las dos últimas semanas de diciembre y la primera de enero no producen
    como una semana normal."""
    if w in (datetime.date(2026, 12, 21), datetime.date(2026, 12, 28)):
        return 0.4
    if w == datetime.date(2027, 1, 4):
        return 0.8
    return 1.0


def proyectar_firma(universo, fecha_pag, capacidad, consolidados=0):
    """Cuándo quedaría firmado cada contrato si el PAG se aprueba en
    `fecha_pag` y la unidad sostiene `capacidad` instrumentos por semana.

    Supone lo que este plan garantiza: que el expediente precontractual ya está
    hecho y revisado, así que tras el PAG solo resta pedir la cotización en
    firme con el techo presupuestario, elaborar el instrumento y tomar firmas.
    """
    orden = sorted(universo, key=lambda x: (x["inicio27"], {"C": 0, "B": 1, "A": 2}[x["ruta"]]))
    if consolidados:
        orden = orden[:max(0, len(orden) - consolidados)]
    arranque = fecha_pag + datetime.timedelta(days=10)          # cotización en firme
    w = arranque + datetime.timedelta(days=(7 - arranque.weekday()) % 7)
    res, i = [], 0
    while i < len(orden):
        for _ in range(int(round(capacidad * _factor_semana(w)))):
            if i >= len(orden):
                break
            x = dict(orden[i])
            x["firma"] = w + datetime.timedelta(days=4)          # se firma al cierre de esa semana
            x["retro"] = max(0, (x["firma"] - x["inicio27"]).days)
            res.append(x)
            i += 1
        w += datetime.timedelta(weeks=1)
    return res


def resumen_proyeccion(res):
    g1 = [x for x in res if x["grupo"] == "1-ene"]
    g2 = [x for x in res if x["grupo"] == "1-feb"]
    a_tiempo = lambda g, tope: sum(1 for x in g if x["firma"] <= tope)
    retros = sorted(x["retro"] for x in res)
    mediana = retros[len(retros) // 2] if retros else 0
    return {
        "g1_ok": a_tiempo(g1, datetime.date(2026, 12, 31)), "g1": len(g1),
        "g2_ok": a_tiempo(g2, datetime.date(2027, 1, 31)), "g2": len(g2),
        "retro_mediana": mediana,
        "retro_max": max(retros) if retros else 0,
    }


# Escenarios que se tabulan en el anexo. La fecha del PAG pesa más que
# cualquier mejora interna, y por eso encabeza la tabla.
FECHAS_PAG = [datetime.date(2026, 10, 15), datetime.date(2026, 11, 16),
              datetime.date(2026, 12, 1), datetime.date(2026, 12, 15),
              datetime.date(2027, 1, 5), datetime.date(2027, 2, 1)]
CAPACIDADES = [(9, 0), (13, 0), (13, 20)]


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
    ("inicio27", "Arranca el sucesor", 18),
    ("grupo", "Grupo de firma", 14),
    ("limite", "Expediente listo a más tardar", 24),
    ("semana", "Semana asignada", 15),
    ("docs_listos", "Documentos de la AC listos", 24),
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
        c.alignment = Alignment(vertical="top", wrap_text=(i in (2, 3, 10, 16)))
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
    g1 = [x for x in universo if x["grupo"] == "1-ene"]
    g2 = [x for x in universo if x["grupo"] == "1-feb"]
    g3 = [x for x in universo if x["grupo"] == "posterior"]
    filas += [
        ("— Sucesor arranca el 1 de enero de 2027 (firmar antes del 31-dic)", len(g1), sum(x["monto"] for x in g1)),
        ("— Sucesor arranca el 1 de febrero de 2027 (firmar antes del 31-ene)", len(g2), sum(x["monto"] for x in g2)),
        ("— Sucesor arranca después de febrero de 2027", len(g3), sum(x["monto"] for x in g3)),
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

    # --- Instrumentos consolidables
    ws = wb.create_sheet("Consolidables")
    ws["A1"] = "Contratos que podrían salir como un solo instrumento"
    ws["A1"].font = Font(bold=True, size=12, color=AZUL)
    ws["A2"] = ("Misma administradora, mismo proveedor y misma categoría en varias áreas. "
                "Cada instrumento evitado es una revisión, una elaboración y una toma de firmas menos.")
    ws["A2"].font = Font(size=10, color="6B7180")
    grupos = consolidables(universo)
    _cab(ws, 4, ["Administrador/a", "Proveedor", "Categoría", "Contratos", "Áreas",
                 "Monto conjunto (USD)", "Contratos 2026 agrupados"],
         [22, 34, 16, 11, 8, 20, 60])
    r = 5
    for (ac, _, cat), v in grupos:
        vals = [ac, v[0]["proveedor"], cat, len(v), len({y["area"] for y in v}),
                round(sum(y["monto"] for y in v), 2), " · ".join(y["nro"] for y in v)]
        for j, val in enumerate(vals, start=1):
            c = ws.cell(row=r, column=j, value=val)
            c.alignment = Alignment(vertical="top", wrap_text=(j in (2, 7)))
            if j == 6:
                c.number_format = '#,##0.00'
        r += 1
    evitables = sum(len(v) - 1 for _, v in grupos)
    c = ws.cell(row=r + 1, column=1, value=f"Instrumentos evitables consolidando: {evitables}")
    c.font = Font(bold=True, color=AZUL)

    # --- Proyección de firma según la fecha del PAG
    ws = wb.create_sheet("Proyección firma")
    ws["A1"] = "¿Cuántos contratos quedarían firmados a tiempo?"
    ws["A1"].font = Font(bold=True, size=12, color=AZUL)
    ws["A2"] = ("Supone el expediente precontractual ya hecho y revisado. Sin el PAG aprobado no se "
                "puede firmar, y es el PAG el que fija el presupuesto de cada área: por eso su fecha "
                "manda sobre cualquier mejora interna.")
    ws["A2"].font = Font(size=10, color="6B7180")
    _cab(ws, 4, ["PAG aprobado", "Firmas por semana", "Instrumentos consolidados",
                 "Grupo 1-ene a tiempo", "Grupo 1-feb a tiempo",
                 "Retroactividad mediana (días)", "Retroactividad máxima (días)"],
         [16, 18, 24, 20, 20, 26, 26])
    r = 5
    for f_pag in FECHAS_PAG:
        for cap, cons in CAPACIDADES:
            d = resumen_proyeccion(proyectar_firma(universo, f_pag, cap, cons))
            vals = [dl(f_pag), cap, cons, f"{d['g1_ok']} de {d['g1']}",
                    f"{d['g2_ok']} de {d['g2']}", d["retro_mediana"], d["retro_max"]]
            for j, val in enumerate(vals, start=1):
                ws.cell(row=r, column=j, value=val)
            r += 1
    c = ws.cell(row=r + 1, column=1,
                value="Referencia 2026: retroactividad mediana de 64 días, máxima de 151, en el 100 % de las renovaciones.")
    c.font = Font(italic=True, color="6B7180")

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
no admiten otra, y para 2027 tienen que salir como proceso nuevo, que toma más
tiempo. Por eso este año el trámite no puede empezar en enero.

La meta es llegar a fin de año con TODOS los expedientes precontractuales hechos
y revisados. La firma es otra cosa: sin el PAG 2027 aprobado no se puede
suscribir, y además es el PAG el que fija cuánto presupuesto tienes. Lo que sí
depende de nosotros es que, el día que el PAG salga, no quede ningún documento
pendiente.

Tienes {n} contratos vigentes bajo tu administración:

{tabla}

Te pido dos cosas, antes del {responde}:

1. Confirmar, contrato por contrato, si el área necesita mantener el servicio en
   2027. Si alguno ya no se requiere, decirlo también: es la única forma de no
   tramitar lo que no se va a usar.
2. Decirme si alguno de estos servicios lo presta el mismo proveedor en varias de
   tus áreas. Si es así lo sacamos como un solo contrato con un anexo por área,
   en vez de tres o cuatro instrumentos separados.

AHORA, sin esperar al PAG — esto es lo que entra en tu semana asignada:

{bloque1}

CUANDO EL PAG ESTÉ APROBADO — no lo prepares todavía, el monto sale de ahí:

{bloque2}

Sobre el monto: cuando toque cotizar, toma como base el consumo ejecutado de este
año, no el presupuesto del contrato vigente. En 2026, 11 de las 13 adendas fueron
aumentos de valor por consumo subestimado.

Tu primer lote entra la semana del {semana} y tus documentos deben estar listos el
{docs}. Esa semana la Unidad Operativa recibe hasta 10 expedientes de todo el FAP,
así que llegar tarde a tu semana significa esperar a la siguiente.

Todo se envía por el formulario de procesos administrativos. Los expedientes que
lleguen por correo no entran a la cola: en 2026 hubo que reconstruir 18 contratos
que ingresaron por fuera del formulario.

En La Mágica ya tienes las plantillas de los documentos precontractuales.

Gracias,
{firma}
"""

# Los documentos se parten en dos bloques. El corte es el PAG: todo lo que no
# necesita saber el monto se hace ya; lo que lo necesita espera.
BLOQUE_1 = {
    "A": ("Renovación ({n}): informe de satisfacción firmado por ti y por el "
          "responsable del área, con el análisis técnico, geográfico y económico que "
          "justifica seguir con el mismo proveedor. Avísame también si el contrato "
          "original NO tiene cláusula de renovación: en ese caso no se puede renovar "
          "y hay que sacarlo como proceso nuevo."),
    "B": ("Selección directa por excepción ({n}): solicitud de inicio del responsable "
          "del área e informe de justificación que motive la causal de excepción."),
    "C": ("Comparación de precios ({n}): solicitud de inicio, especificaciones técnicas "
          "o TdR, y los tres proveedores de la base del FAP ya identificados. La "
          "Comisión de Calificación se designa desde ya por memorando. La invitación "
          "queda redactada, con el presupuesto en blanco."),
}

BLOQUE_2 = {
    "A": ("Renovación ({n}): solicitud de cotización al proveedor para el nuevo "
          "período con el presupuesto del PAG, su cotización y la notificación. El "
          "contrato de renovación lo elabora la Unidad Operativa."),
    "B": ("Selección directa por excepción ({n}): solicitud de cotización en firme con "
          "el presupuesto asignado, cotización del proveedor, y la orden o notificación "
          "según el instrumento que corresponda."),
    "C": ("Comparación de precios ({n}): se cursa la invitación a los tres proveedores, "
          "se reciben las cotizaciones, se reúne la Comisión y se levanta el acta de "
          "adjudicación. Es la vía más lenta —40 días de mediana en 2026— y por eso su "
          "expediente va primero en el calendario."),
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
            "  · {nro}  {det:<44}  vence {fin}  ·  el sucesor arranca el {ini}\n"
            "      {via}  ·  su expediente entra la semana del {sem}".format(
                nro=y["nro"], det=(y["detalle"][:42] + "..") if len(y["detalle"]) > 44 else y["detalle"],
                fin=dl(y["fin"]), ini=dl(y["inicio27"]), via=y["via"], sem=dl(y["semana"]))
            for y in g)
        c = Counter(y["ruta"] for y in g)
        bloques = []
        for fuente in (BLOQUE_1, BLOQUE_2):
            bloques.append("\n\n".join(
                fuente[r].format(n=plural(c[r], "contrato", "contratos"))
                for r in "ABC" if c[r]))
        txt = CUERPO.format(anio=2027, area_corta=area_corta, ac=ac, n=len(g), tabla=tabla,
                            responde=dl(responde), bloque1=bloques[0], bloque2=bloques[1],
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
    gc = Counter(x["grupo"] for x in universo)
    tarde = [x for x in universo if x["semana"] > x["limite"]]
    evitables = sum(len(v) - 1 for _, v in consolidables(universo))
    print(f"universo: {len(universo)} contratos · A {rc['A']} · B {rc['B']} · C {rc['C']}")
    print(f"fuera del universo (objeto no recurrente): {len(fuera)}")
    print(f"grupos de firma: 1-ene {gc['1-ene']} · 1-feb {gc['1-feb']} · posterior {gc['posterior']}")
    print(f"semanas: {len(set(x['semana'] for x in universo))} · cupo {CUPO_SEMANAL}/semana")
    print(f"expedientes que quedarían fuera de plazo: {len(tarde)}")
    print(f"instrumentos evitables consolidando: {evitables}")
    print("proyección de firma (expediente ya revisado):")
    for f_pag in FECHAS_PAG:
        d = resumen_proyeccion(proyectar_firma(universo, f_pag, 13))
        print(f"   PAG {f_pag.isoformat()} · 13 firmas/sem → 1-ene {d['g1_ok']}/{d['g1']}"
              f" · 1-feb {d['g2_ok']}/{d['g2']} · retro mediana {d['retro_mediana']} d")
    print(f"anexo: {anexo}")
    print(f"correos redactados: {n}")


if __name__ == "__main__":
    main()
