# -*- coding: utf-8 -*-
"""
Comprobaciones del robot (scripts/actualizar_datos.py).

El robot corre una vez al día contra un Excel que es de otra persona y se
reordena, y publica los datos que usan el CRM, el CLM, Instrumentos y las
renovaciones. Esto lo ejercita de verdad: arma Excels de mentira con openpyxl,
los sirve en local, corre el robot como lo corre el workflow y descifra lo que
publica. Lo que importa de la hoja opcional «Registro de Calificaciones»: SIN
ella se publica exactamente lo que se publicaba antes, y CON ella no se adivina
nada. Y que la hoja «Proveedores», con el RUC de cada proveedor, NO se publica:
el RUC es información privada (el de una persona natural es su cédula).

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

def libro(proveedores=None, registro=None):
    """Un Excel maestro de mentira: 12 contratos en «2026» y, si se piden, las hojas opcionales."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "2026"
    ws.append(["CONTROL DE CONTRATOS"])
    ws.append(ENCABEZADO_2026)
    for i in range(1, 13):
        ws.append([i, f"FIAS-FAP-2026-{i:03d}", f"Servicio {i}", "Parque Nacional Cotopaxi", "Mantenimiento",
                   1000 + i, datetime.datetime(2026, 1, 1), datetime.datetime(2026, 1, 5),
                   datetime.datetime(2026, 12, 31), "Nuevo", PROVEEDORES[i % len(PROVEEDORES)], 360,
                   "No", "N/A", "N/A", "N/A", 1000 + i, "Ana Pérez", "ana@fias.org.ec", "Activo",
                   None, None, None, 40 + i])
    if proveedores is not None:
        p = wb.create_sheet("Proveedores")
        p["A1"] = "Se llena sola desde la hoja «2026». No escribas nada aquí: el RUC va en la fila del contrato."
        p.append([])
        p.append(["Proveedor", "RUC", "Actividad económica", "Última verificación", "Resultado", "Contratos"])
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

def descifrar(ruta):
    with open(ruta, encoding="utf-8") as f:
        env = json.load(f)
    b = base64.b64decode
    clave = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=b(env["salt"]),
                       iterations=env["iter"]).derive(CLAVE.encode("utf-8"))
    return json.loads(AESGCM(clave).decrypt(b(env["iv"]), b(env["ct"]), None).decode("utf-8")), env

class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

def correr(wb, tmp):
    """Corre el robot contra ese Excel. Devuelve (salida, contratos, registro o None)."""
    servir = os.path.join(tmp, "servir"); trabajo = os.path.join(tmp, "trabajo")
    for d in (servir, trabajo):
        shutil.rmtree(d, ignore_errors=True); os.makedirs(d)
    os.makedirs(os.path.join(trabajo, "crm"))
    wb.save(os.path.join(servir, "maestro.xlsx"))
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0),
                                          functools.partial(Silencioso, directory=servir))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    try:
        # El entorno de quien corre la prueba, menos los proxies: el robot habla con
        # un servidor en esta misma máquina y un proxy corporativo lo estorbaría.
        env = {k: v for k, v in os.environ.items() if k.lower() not in ("http_proxy", "https_proxy", "all_proxy")}
        env.update({"DATA_KEY": CLAVE, "EXCEL_URL": f"http://127.0.0.1:{srv.server_address[1]}/maestro.xlsx",
                    "NO_PROXY": "127.0.0.1,localhost", "no_proxy": "127.0.0.1,localhost"})
        p = subprocess.run([sys.executable, ROBOT], cwd=trabajo, env=env, capture_output=True, text=True, timeout=120)
    finally:
        srv.shutdown()
    salida = p.stdout + p.stderr
    if p.returncode != 0:
        print("    (el robot salió con error)\n" + salida)
        return salida, None, None
    contratos, _ = descifrar(os.path.join(trabajo, "crm", "contratos_export.json"))
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
    ok("Proveedores:" not in salida and "Registro de Calificaciones:" not in salida,
       "tampoco hay resumen de las hojas que no están")

    # ------------------------------------------------------------ 2
    seccion("2 · La hoja «Proveedores» del Excel no se publica: el RUC es privado")
    ver = datetime.datetime(2026, 10, 26)
    hoja = [["Servitec S.A.", 1792212502001, "Venta al por mayor", ver, "Activo", 2],
            ["RIVERJARDÍN CÍA. LTDA.", "0992123456001", "Combustibles", ver, None, 2]]
    salida, con, reg = correr(libro(proveedores=hoja), tmp)
    ok(con == base, "con la hoja «Proveedores» se publica exactamente lo mismo que sin ella")
    ok(reg is None, "y no aparece ningún archivo nuevo")
    ok("1792212502001" not in salida and "0992123456001" not in salida, "ni el registro del robot menciona un RUC")

    # ------------------------------------------------------------ 3
    seccion("3 · «Registro de Calificaciones»: un archivo aparte, cifrado igual")
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
    ok(__import__("re").fullmatch(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ", sobre_reg.get("generado", "")) is not None,
       "el archivo del Registro lleva la hora en que se publicó (fuera del cifrado): con ella el CLM sabe si una calificación fue retirada")
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
finally:
    shutil.rmtree(tmp, ignore_errors=True)

print("\n" + (f"✗ {fallos} de {pruebas} comprobaciones fallaron" if fallos else f"✓ {pruebas} comprobaciones, todo bien"))
sys.exit(1 if fallos else 0)
