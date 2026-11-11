# -*- coding: utf-8 -*-
"""
Comprobaciones del robot (scripts/actualizar_datos.py).

El robot corre una vez al día contra un Excel que es de otra persona y se
reordena, y publica los datos que usan el CRM, el CLM, Instrumentos y las
renovaciones. Esto lo ejercita de verdad: arma Excels de mentira con openpyxl,
los sirve en local, corre el robot como lo corre el workflow y descifra lo que
publica. Lo que importa de la hoja opcional «Registro de Calificaciones»: SIN
ella se publica exactamente lo que se publicaba antes, y CON ella no se adivina
nada. Y que la hoja «Proveedores», con el RUC de cada proveedor, solo se lee si
existe su propia frase (PROVEEDORES_KEY), se publica aparte y cifrada con ella, y
la frase del registro —la que tienen las ACs— no la abre: el RUC es información
privada (el de una persona natural es su cédula) y solo lo usa el Generador.
Y que las respuestas de la consulta de continuidad —qué dijo cada AC que pasa
con su contrato el año siguiente— se publican aparte, vengan de una hoja del
maestro o de su propio libro (RESPUESTAS_URL), sin tocar lo demás.

Uso (necesita lo mismo que el workflow que corre el robot):
    pip install openpyxl requests cryptography
    python3 scripts/probar_robot.py

Sale con código 1 si algo falla, para poder colgarlo de un workflow.
"""
import base64, datetime, functools, http.server, json, os, shutil, subprocess, sys, tempfile, threading

try:
    import openpyxl
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
except ImportError as e:
    sys.exit(f"Falta una dependencia de la prueba ({e.name}). Instálala con:\n"
             "    pip install openpyxl requests cryptography")

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROBOT = os.path.join(RAIZ, "scripts", "actualizar_datos.py")
CLAVE = "frase-de-prueba"
CLAVE_PROV = "otra-frase-solo-del-generador"

fallos = pruebas = 0
def ok(cond, msg, extra=None):
    global fallos, pruebas
    pruebas += 1
    if cond:
        print("  ✓ " + msg)
    else:
        fallos += 1
        print("  ✗ " + msg + (f"  → {extra}" if extra is not None else ""))
def seccion(t):
    print("\n" + t)

# Las llaves que el robot publicaba ANTES de las hojas opcionales. Si alguien
# añade una llave a todos los contratos, esta lista lo dice.
LLAVES_DE_SIEMPRE = {
    "nro", "detalle", "area", "cat", "monto", "montoTotal", "cerrado", "inicio", "firma", "fin",
    "tipo", "proveedor", "plazo", "adenda", "tipoAdenda", "modificacion", "firmaAdenda", "ac",
    "correo", "link", "fcierre", "liquidado", "saldo", "carpeta", "codigoProceso"}

ENCABEZADO_2026 = [
    "Ítem", "Nro. DE CONTRATO", "DETALLE DEL CONTRATO", "Área Protegida",
    "CATEGORIA DEL PROCESO/ BIEN O SERVICIO", "Monto (incluido IVA)", "Fecha de inicio",
    "FECHA DE FIRMA", "FECHA DE FINALIZACIÓN", "TIPO DE CONTRATO", "Nombre del Proveedor ",
    "PLAZO", "Tiene adenda", "Tipo de adenda", "Modificación", "Fecha de firma2",
    "Valor o plazo total ", "Administrador/a de contrato", "Correo electrónico AC",
    "Estado de Gestión", "Fecha de cierre", "Valor liquidado", "Saldo no ejecutado",
    "Numero de carpeta interna"]

PROVEEDORES = ["Servitec S.A.", "RIVERJARDÍN CÍA. LTDA.", "Lucila Eloina Valverde Guevara",
               "Sin Fila Proveedor", "Repetido Uno", "Doce Digitos"]

def libro(proveedores=None, registro=None, ruc_2026=None, encabezado_prov=None):
    """Un Excel maestro de mentira: 12 contratos en «2026» y, si se piden, las hojas opcionales.
    ruc_2026: {n.º de fila 1-12: RUC} para añadir a «2026» la columna «RUC» de la fila del contrato."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "2026"
    ws.append(["CONTROL DE CONTRATOS"])
    ws.append(ENCABEZADO_2026 + (["RUC"] if ruc_2026 is not None else []))
    for i in range(1, 13):
        ws.append([i, f"FIAS-FAP-2026-{i:03d}", f"Servicio {i}", "Parque Nacional Cotopaxi", "Mantenimiento",
                   1000 + i, datetime.datetime(2026, 1, 1), datetime.datetime(2026, 1, 5),
                   datetime.datetime(2026, 12, 31), "Nuevo", PROVEEDORES[i % len(PROVEEDORES)], 360,
                   "No", "N/A", "N/A", "N/A", 1000 + i, "Ana Pérez", "ana@fias.org.ec", "Activo",
                   None, None, None, 40 + i] + ([ruc_2026.get(i)] if ruc_2026 is not None else []))
    if proveedores is not None:
        p = wb.create_sheet("Proveedores")
        p["A1"] = "Se llena sola desde la hoja «2026». No escribas nada aquí: el RUC va en la fila del contrato."
        p.append([])
        p.append(encabezado_prov or ["Proveedor", "RUC", "Actividad económica", "Última verificación", "Resultado", "Contratos"])
        for fila in proveedores:
            p.append(fila)
    if registro is not None:
        r = wb.create_sheet("Registro de Calificaciones")
        r["A1"] = "Registro de calificaciones de proveedores"
        r.append(["Nro. Contrato", "Nombre Proveedor", "Área Protegida", "Categoría", "Administrador/a AC",
                  "Fecha Evaluación", "Calidad (40%)", "Plazo (30%)", "Atención (5%)",
                  "Cump. Contractual (25%)", "PUNTAJE TOTAL", "RESULTADO", "Elegible Futuros Proc.",
                  "Observaciones"])
        for fila in registro:
            r.append(fila)
    return wb

ENCABEZADO_RESP = ["nro", "detalle", "area", "categoria", "proveedor", "montoTotal2026", "vence", "tipo2026",
                   "renovable", "decision", "continua", "monto2027", "observaciones", "ac", "correoAC", "respondido"]

def libro_respuestas(filas, wb=None, titulo="Hoja1"):
    """El Excel donde caen las respuestas de renovaciones/index.html: una fila por contrato.
    filas: [(nro, decision, continua, observaciones, respondido)]. Con wb, la hoja se añade a ese libro."""
    if wb is None:
        wb = openpyxl.Workbook(); h = wb.active; h.title = titulo
    else:
        h = wb.create_sheet(titulo)
    h.append(ENCABEZADO_RESP)
    for nro, dec, cont, obs, resp in filas:
        h.append([nro, "Servicio x", "Parque Nacional Cotopaxi", "Mantenimiento", "Servitec S.A.", 1000,
                  datetime.datetime(2026, 12, 31), "Renovación", "No", dec, cont, None, obs,
                  "Ana Pérez", "ana@fias.org.ec", resp])
    return wb

def descifrar(ruta, frase=CLAVE):
    with open(ruta, encoding="utf-8") as f:
        env = json.load(f)
    b = base64.b64decode
    clave = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=b(env["salt"]),
                       iterations=env["iter"]).derive(frase.encode("utf-8"))
    return json.loads(AESGCM(clave).decrypt(b(env["iv"]), b(env["ct"]), None).decode("utf-8")), env

class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

ULTIMA = {}   # lo que dejó la última corrida que no cabe en la tupla: la ruta de los proveedores

def correr(wb, tmp, frase_prov=None, respuestas=None):
    """Corre el robot contra ese Excel. Devuelve (salida, contratos, registro o None).
    Con frase_prov, como si existiera el secreto PROVEEDORES_KEY. Con respuestas (un
    libro, o 'roto'), como si existiera RESPUESTAS_URL apuntando a él."""
    servir = os.path.join(tmp, "servir"); trabajo = os.path.join(tmp, "trabajo")
    for d in (servir, trabajo):
        shutil.rmtree(d, ignore_errors=True); os.makedirs(d)
    os.makedirs(os.path.join(trabajo, "crm"))
    wb.save(os.path.join(servir, "maestro.xlsx"))
    if respuestas == "roto":
        with open(os.path.join(servir, "respuestas.xlsx"), "w") as f:
            f.write("<html>inicia sesión</html>")
    elif respuestas is not None:
        respuestas.save(os.path.join(servir, "respuestas.xlsx"))
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0),
                                          functools.partial(Silencioso, directory=servir))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    try:
        # El entorno de quien corre la prueba, menos los proxies: el robot habla con
        # un servidor en esta misma máquina y un proxy corporativo lo estorbaría.
        env = {k: v for k, v in os.environ.items() if k.lower() not in ("http_proxy", "https_proxy", "all_proxy")}
        env.update({"DATA_KEY": CLAVE, "EXCEL_URL": f"http://127.0.0.1:{srv.server_address[1]}/maestro.xlsx",
                    "NO_PROXY": "127.0.0.1,localhost", "no_proxy": "127.0.0.1,localhost"})
        env.pop("PROVEEDORES_KEY", None)
        env.pop("RESPUESTAS_URL", None)
        if respuestas is not None:
            env["RESPUESTAS_URL"] = f"http://127.0.0.1:{srv.server_address[1]}/respuestas.xlsx"
        if frase_prov is not None:
            env["PROVEEDORES_KEY"] = frase_prov
        p = subprocess.run([sys.executable, ROBOT], cwd=trabajo, env=env, capture_output=True, text=True, timeout=120)
    finally:
        srv.shutdown()
    salida = p.stdout + p.stderr
    if p.returncode != 0:
        print("    (el robot salió con error)\n" + salida)
        return salida, None, None
    contratos, _ = descifrar(os.path.join(trabajo, "crm", "contratos_export.json"))
    ULTIMA["proveedores"] = os.path.join(trabajo, "instrumentos", "proveedores_export.json")
    ULTIMA["decisiones"] = os.path.join(trabajo, "crm", "decisiones_export.json")
    reg = os.path.join(trabajo, "crm", "calificaciones_export.json")
    return salida, contratos, (descifrar(reg)[0] if os.path.exists(reg) else None)

tmp = tempfile.mkdtemp(prefix="probar_robot_")
try:
    # ------------------------------------------------------------ 1
    seccion("1 · Sin las hojas opcionales se publica exactamente lo de siempre")
    salida, base, reg = correr(libro(), tmp)
    ok(base is not None and len(base) == 12, "el robot publica los 12 contratos", len(base or []))
    ok(all(set(c) == LLAVES_DE_SIEMPRE for c in base or []),
       "cada contrato lleva las mismas llaves de siempre, ni una más",
       sorted(set().union(*[set(c) for c in base or []]) ^ LLAVES_DE_SIEMPRE))
    ok(reg is None, "y no aparece calificaciones_export.json")
    ok(not os.path.exists(ULTIMA["decisiones"]) and "Consulta de continuidad" not in salida,
       "ni decisiones_export.json: sin respuestas no hay archivo")
    ok("Proveedores:" not in salida and "Registro de Calificaciones:" not in salida,
       "tampoco hay resumen de las hojas que no están")

    # ------------------------------------------------------------ 2
    seccion("2 · Sin la frase de proveedores, la hoja «Proveedores» ni se lee")
    ver = datetime.datetime(2026, 10, 26)
    hoja = [["Servitec S.A.", 1792212502001, "Venta al por mayor", ver, "Activo", 2],
            ["RIVERJARDÍN CÍA. LTDA.", "0992123456001", "Combustibles", ver, None, 2]]
    salida, con, reg = correr(libro(proveedores=hoja, ruc_2026={1: "1792212502001"}), tmp)
    ok(con == base, "con la hoja «Proveedores» y una columna RUC en «2026» se publica exactamente lo mismo que sin ellas")
    ok(reg is None and not os.path.exists(ULTIMA["proveedores"]), "y no aparece ningún archivo nuevo")
    ok("1792212502001" not in salida and "0992123456001" not in salida and "Proveedores:" not in salida,
       "ni el registro del robot menciona un RUC, ni a los proveedores")

    # ------------------------------------------------------------ 3
    seccion("3 · Con su propia frase: un archivo aparte, solo para el Generador de Instrumentos")
    hoja = [["Servitec S.A.", 1792212502001, "Rosa Prueba", "servitec@ejemplo.ec", "Av. Amazonas N1-23", "Venta"],
            ["RIVERJARDÍN CÍA. LTDA.", "992123456001", None, None, None, "Combustibles"],     # Excel le quitó el cero
            ["Lucila Eloina Valverde Guevara", 102030405, None, "lucila@ejemplo.ec", None, ""],   # cédula sin el cero
            ["Riverjardín Cía. Ltda.", "0992123456001", "Pedro Prueba", None, "Calle 2", ""],    # la misma empresa, otra escritura
            [None, "1700000000001", None, None, None, ""],                                    # sin nombre: no es un proveedor
            ["Servitec S.A.", "1799999999001", None, None, None, ""]]                        # otro RUC para el mismo nombre
    enc = ["Razón social", "RUC / CI", "Representante legal", "Correo electrónico", "Dirección", "Actividad económica"]
    salida, con, _ = correr(libro(proveedores=hoja, encabezado_prov=enc, ruc_2026={4: 1712345678001.0}), tmp, CLAVE_PROV)
    ok(con == base, "los contratos publicados no cambian ni un byte: el RUC nunca va al registro de las ACs")
    ruta = ULTIMA["proveedores"]
    ok(os.path.exists(ruta), "aparece instrumentos/proveedores_export.json")
    try:
        descifrar(ruta, CLAVE); abre_con_la_de_las_ac = True
    except Exception:
        abre_con_la_de_las_ac = False
    ok(not abre_con_la_de_las_ac, "y la frase del registro, la que tienen las ACs, NO lo abre")
    prov, sobre_p = descifrar(ruta, CLAVE_PROV)
    with open(ruta, encoding="utf-8") as f:
        crudo = f.read()
    ok("1792212502001" not in crudo and "Servitec" not in crudo, "en el archivo no hay nada en claro")
    ok(__import__("re").fullmatch(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ", sobre_p.get("generado", "")) is not None,
       "lleva la hora en que se leyó el Excel, fuera del cifrado, para decir «actualizado hoy»")
    por = {p["nombre"]: p for p in prov}
    ok(all(set(p) <= {"nombre", "identificacion", "representante", "email", "direccion"} for p in prov),
       "solo publica lo que usa una contraparte: nombre, cédula o RUC, representante, correo y dirección",
       sorted(set().union(*[set(p) for p in prov])))
    ok(por.get("Servitec S.A.") == {"nombre": "Servitec S.A.", "identificacion": "1792212502001", "representante": "Rosa Prueba",
                                     "email": "servitec@ejemplo.ec", "direccion": "Av. Amazonas N1-23"},
       "las columnas se encuentran por su rótulo («Razón social», «RUC / CI»…), y un RUC numérico sale como texto", por.get("Servitec S.A."))
    ok(por.get("RIVERJARDÍN CÍA. LTDA.", {}).get("identificacion") == "0992123456001"
       and por.get("Lucila Eloina Valverde Guevara", {}).get("identificacion") == "0102030405",
       "a un RUC de 12 dígitos y a una cédula de 9 se les repone el cero que Excel quita",
       [por.get("RIVERJARDÍN CÍA. LTDA."), por.get("Lucila Eloina Valverde Guevara")])
    ok(por.get("RIVERJARDÍN CÍA. LTDA.", {}).get("representante") == "Pedro Prueba" and "Riverjardín Cía. Ltda." not in por,
       "dos escrituras del mismo nombre son un proveedor, y una completa a la otra")
    ok(len(prov) == 4 and por.get("Repetido Uno", {}).get("identificacion") == "1712345678001",
       "la columna RUC de «2026» también cuenta, y una fila sin nombre no", [p["nombre"] for p in prov])
    ok("Proveedores: 4 publicados, 4 con cédula o RUC" in salida and "dos RUC distintos" in salida,
       "el robot dice cuántos publicó y avisa del proveedor con dos RUC", salida.strip().splitlines()[-3:])
    ok(not any(x in salida for x in ("1792212502001", "Servitec", "Lucila", "Rosa Prueba")),
       "y su registro, que es público, no nombra a ninguno ni muestra un RUC")

    salida, con, _ = correr(libro(proveedores=hoja, encabezado_prov=enc), tmp, CLAVE)
    ok(not os.path.exists(ULTIMA["proveedores"]) and "igual a DATA_KEY" in salida and con == base,
       "si alguien pone como frase de proveedores la misma del registro, no se publica, avisando")
    salida, con, _ = correr(libro(), tmp, CLAVE_PROV)
    ok(not os.path.exists(ULTIMA["proveedores"]) and "no se publica nada de proveedores" in salida and con == base,
       "con la frase pero sin hoja ni columna RUC, no se publica nada y el robot no se cae")
    wb = libro(); p = wb.create_sheet("Proveedores"); p.append(["Proveedor", "Contratos"]); p.append(["Servitec S.A.", 2])
    salida, con, _ = correr(wb, tmp, CLAVE_PROV)
    ok(not os.path.exists(ULTIMA["proveedores"]) and "no se lee" in salida and con == base,
       "una hoja «Proveedores» sin columna de RUC o cédula no se lee, avisando")

    # Solo el Generador los lee: ninguna otra herramienta del sitio pide ese archivo.
    otros = []
    for dirpath, dirs, archivos in os.walk(RAIZ):
        dirs[:] = [d for d in dirs if d not in (".git", "node_modules", "instrumentos", "scripts", ".github")]
        for a in archivos:
            if a.endswith((".html", ".js")):
                with open(os.path.join(dirpath, a), encoding="utf-8", errors="ignore") as f:
                    if "proveedores_export" in f.read():
                        otros.append(os.path.relpath(os.path.join(dirpath, a), RAIZ))
    ok(not otros, "ninguna herramienta fuera de instrumentos/ menciona proveedores_export.json", otros)

    # ------------------------------------------------------------ 4
    seccion("4 · «Registro de Calificaciones»: un archivo aparte, cifrado igual")
    registro = [
        ["FIAS-FAP-2026-001", "Servitec S.A.", "Cotopaxi", "Mantenimiento", "Ana Pérez",
         datetime.datetime(2026, 10, 20), 32.5, 24, 4, 20, 80.5, "Satisfactorio", "Sí", "Todo bien"],
        # Pegada desde el CSV (separado por «;», con coma decimal): llega como texto.
        ["FIAS-FAP-2026-002", "Riverjardín", "Cotopaxi", "Combustible", "Ana Pérez",
         "2026-10-21", "30,00", "25,50", "4,00", "21,00", "80,50", "Satisfactorio", "Sí", ""],
        ["FIAS-FAP-2026-003", "x", "x", "x", "x", "2026-10-22", 1, 1, 1, 1, "abc", "", "", ""],      # sin puntaje
        ["OTRO-001", "x", "x", "x", "x", "2026-10-22", 1, 1, 1, 1, 70, "", "", ""],                   # no es un contrato
        ["FIAS-FAP-2026-004", "x", "x", "x", "x", "2026-10-22", 1, 1, 1, 1, 150, "", "", ""],         # fuera de 0 a 100
        ["FIAS-FAP-2026-005", "x", "x", "x", "x", "2026-10-23", None, None, None, None, 70, "Aceptable", "Sí", ""],
    ]
    salida, con, reg = correr(libro(registro=registro), tmp)
    ok([c for c in con] == base, "los contratos publicados no cambian por tener el registro")
    ok(reg is not None and [r["nro"] for r in reg] == ["FIAS-FAP-2026-001", "FIAS-FAP-2026-002", "FIAS-FAP-2026-005"],
       "se publican solo las filas con un contrato y un puntaje entre 0 y 100", [r["nro"] for r in reg or []])
    ok(reg[0] == {"nro": "FIAS-FAP-2026-001", "score": 80.5, "fecha": "2026-10-20",
                  "aportes": [32.5, 24.0, 4.0, 20.0], "obs": "Todo bien"},
       "una fila con números trae sus cuatro aportes, la fecha y la observación", reg[0])
    ok(reg[1] == {"nro": "FIAS-FAP-2026-002", "score": 80.5, "fecha": "2026-10-21", "aportes": [30.0, 25.5, 4.0, 21.0]},
       "una fila pegada como texto con coma decimal se lee igual", reg[1])
    ok(reg[2] == {"nro": "FIAS-FAP-2026-005", "score": 70.0, "fecha": "2026-10-23"},
       "sin aportes no se inventan: llega solo el puntaje")
    with open(os.path.join(tmp, "trabajo", "crm", "calificaciones_export.json"), encoding="utf-8") as f:
        sobre_reg = json.load(f)
    with open(os.path.join(tmp, "trabajo", "crm", "contratos_export.json"), encoding="utf-8") as f:
        sobre_con = json.load(f)
    ok(__import__("re").fullmatch(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ", sobre_reg.get("generado", "")) is not None,
       "el archivo del Registro lleva la hora en que el robot LEYÓ el Excel (fuera del cifrado): con ella el CLM sabe si una calificación fue retirada")
    ok(sobre_reg["generado"] <= sobre_con["generado"],
       "y esa hora no es posterior a la de los contratos, que es la del final de la corrida")
    ok("2 fila(s)" in salida and "3 fila(s) publicadas" in salida, "el robot dice cuántas descartó y cuántas publicó", salida.strip().splitlines()[-2:])

    salida, _, reg = correr(libro(registro=[]), tmp)
    ok(reg == [], "la hoja existe pero vacía: se publica una lista vacía (el Registro existe, solo que sin filas)")

    wb = libro(); r = wb.create_sheet("Registro de Calificaciones"); r.append(["Contrato", "Nota"]); r.append(["FIAS-FAP-2026-001", 80])
    salida, con, reg = correr(wb, tmp)
    ok(reg is None and "no tiene las columnas" in salida and con == base,
       "sin las columnas que el CLM exporta no se publica nada, avisando, y el robot no se cae")

    wb = libro(proveedores=[], registro=[])
    wb["Registro de Calificaciones"].title = "registro de calificaciones "
    wb["Proveedores"].title = " PROVEEDORES"
    salida, con, reg = correr(wb, tmp)
    ok(reg == [], "los nombres de las hojas se reconocen sin importar mayúsculas ni espacios de más")

    # ------------------------------------------------------------ 5
    seccion("5 · Las respuestas de la consulta de continuidad: aparte, cifradas, y opcionales")
    resp = [
        ("FIAS-FAP-2026-001", "Contratación directa con el mismo proveedor", "Sí", None, "2026-09-10T13:28:57.506Z"),
        ("FIAS-FAP-2026-002", "Comparación de precios", "Sí", "El administrador quiere cambiar de taller", "2026-09-10T13:29:02.091Z"),
        ("FIAS-FAP-2026-003", "Renovación con el mismo proveedor", "Sí", None, datetime.datetime(2026, 9, 11, 8, 0, 0)),
        ("FIAS-FAP-2026-004", "Proceso nuevo — cambio de proveedor", "Sí", None, None),
        ("FIAS-FAP-2026-005", "No continúa en 2027", "No", None, "2026-09-12T10:00:00.000Z"),
        ("FIAS-FAP-2026-006", "Algo que nadie ofreció", "Sí", None, "2026-09-12T10:00:00.000Z"),   # no se entiende
        ("OTRO-001", "Comparación de precios", "Sí", None, "2026-09-12T10:00:00.000Z"),              # no es un contrato
        (None, None, None, None, None),
    ]
    # Camino 1: el libro aparte, tal como lo deja el flujo (su hoja se llama «Hoja1»).
    salida, con, reg = correr(libro(), tmp, respuestas=libro_respuestas(resp))
    ok(con == base and reg is None, "los contratos publicados no cambian por tener las respuestas")
    ruta = ULTIMA["decisiones"]
    ok(os.path.exists(ruta), "aparece crm/decisiones_export.json")
    dec, sobre_d = descifrar(ruta)
    with open(ruta, encoding="utf-8") as f:
        crudo = f.read()
    ok("FIAS-FAP" not in crudo and "taller" not in crudo, "cifrado con la frase del registro: nada en claro")
    ok([(d["nro"][-3:], d["decision"]) for d in dec] == [("001", "directa"), ("002", "comparar"), ("003", "renovar"),
                                                         ("004", "cambiar"), ("005", "terminar")],
       "cada respuesta sale como una de las cinco claves que entiende el CLM", [(d["nro"][-3:], d["decision"]) for d in dec])
    ok(dec[1] == {"nro": "FIAS-FAP-2026-002", "decision": "comparar", "obs": "El administrador quiere cambiar de taller",
                  "fecha": "2026-09-10T13:29:02.091Z"}, "con su observación y su fecha", dec[1])
    ok(dec[2].get("fecha") == "2026-09-11T08:00:00" and "fecha" not in dec[3], "una fecha de Excel se lee igual, y sin fecha no se inventa", dec[2:4])
    ok(all(set(d) <= {"nro", "decision", "obs", "fecha"} for d in dec),
       "solo publica eso: ni la AC, ni el proveedor, ni los montos", sorted(set().union(*[set(d) for d in dec])))
    ok(__import__("re").fullmatch(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ", sobre_d.get("generado", "")) is not None,
       "lleva la hora de lectura fuera del cifrado")
    ok("5 respuesta(s) publicadas" in salida and "1 respuesta(s)" in salida and "taller" not in salida and "FIAS-FAP-2026-002" not in salida,
       "el robot dice cuántas publicó y cuántas no entendió, sin nombrar ninguna", salida.strip().splitlines()[-3:])

    # Camino 2: la hoja copiada dentro del Excel maestro, se llame como se llame.
    salida, con, _ = correr(libro_respuestas(resp[:2], wb=libro(), titulo="Respuestas renovación"), tmp)
    dec2, _ = descifrar(ULTIMA["decisiones"])
    ok(con == base and [d["decision"] for d in dec2] == ["directa", "comparar"],
       "también se leen de una hoja del propio Excel maestro, sin ningún secreto")
    # Con los dos, manda el libro de respuestas: el maestro puede tener una copia vieja.
    salida, con, _ = correr(libro_respuestas(resp[:1], wb=libro(), titulo="Copia vieja"), tmp, respuestas=libro_respuestas(resp[:5]))
    ok(len(descifrar(ULTIMA["decisiones"])[0]) == 5, "si están en los dos sitios, manda el libro de respuestas")

    # El enlace roto no tumba la publicación de los contratos.
    salida, con, _ = correr(libro(), tmp, respuestas="roto")
    ok(con == base and not os.path.exists(ULTIMA["decisiones"]) and "no pude leer el Excel de respuestas" in salida,
       "si el enlace de las respuestas falla, se avisa y los contratos se publican igual", salida.strip().splitlines()[:2])
    # Una hoja con «nro» pero sin «decision» (la «Export» del maestro) no es la de respuestas.
    wb = libro(); e = wb.create_sheet("Export"); e.append(["nro", "detalle", "estado"]); e.append(["FIAS-FAP-2026-001", "x", "Activo"])
    salida, con, _ = correr(wb, tmp)
    ok(con == base and not os.path.exists(ULTIMA["decisiones"]), "una hoja con «nro» pero sin «decision» no se toma por la de respuestas")
finally:
    shutil.rmtree(tmp, ignore_errors=True)

print("\n" + (f"✗ {fallos} de {pruebas} comprobaciones fallaron" if fallos else f"✓ {pruebas} comprobaciones, todo bien"))
sys.exit(1 if fallos else 0)
