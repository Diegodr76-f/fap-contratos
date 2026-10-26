# -*- coding: utf-8 -*-
"""
Robot de actualización del CRM de Contratos FAP.
Descarga el Excel maestro desde OneDrive (link secreto EXCEL_URL),
lee la hoja "2026" + la hoja "Export" y regenera crm/contratos_export.json.

Y, si existe, la hoja "Registro de Calificaciones" -> crm/calificaciones_export.json
(cifrado). Es opcional: sin ella se publica exactamente lo de siempre.
"""
import os, re, json, base64, datetime, sys
import requests, openpyxl
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

URL = os.environ.get("EXCEL_URL", "").strip()
if not URL:
    sys.exit("ERROR: falta el secreto EXCEL_URL en el repositorio.")

# Frase de acceso para cifrar los datos publicados. Es obligatoria: sin ella no
# publicamos, para no exponer nunca los contratos en texto plano.
DATA_KEY = os.environ.get("DATA_KEY", "").strip()
if not DATA_KEY:
    sys.exit("ERROR: falta el secreto DATA_KEY. No se publica en claro por seguridad. "
             "Añádelo en Settings → Secrets and variables → Actions.")

ITER = 250000

def cifrar(plaintext_bytes, passphrase):
    """AES-256-GCM con clave derivada de la frase (PBKDF2-SHA256).
    Compatible con el descifrado WebCrypto del CLM y el CRM."""
    salt = os.urandom(16)
    iv = os.urandom(12)
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=ITER)
    key = kdf.derive(passphrase.encode("utf-8"))
    ct = AESGCM(key).encrypt(iv, plaintext_bytes, None)  # ciphertext + tag de 16 bytes
    b = lambda x: base64.b64encode(x).decode("ascii")
    return {"fap_enc": 1, "kdf": "PBKDF2-SHA256", "iter": ITER,
            "salt": b(salt), "iv": b(iv), "ct": b(ct)}

# Forzar descarga directa en links de OneDrive/SharePoint
if "download=1" not in URL:
    URL += ("&" if "?" in URL else "?") + "download=1"

r = requests.get(URL, timeout=120, allow_redirects=True)
r.raise_for_status()
if not r.content.startswith(b"PK"):
    sys.exit("ERROR: lo descargado no es un Excel. Revisa que el link de OneDrive "
             "sea 'Cualquier persona con el vínculo puede ver' y que apunte al archivo .xlsx.")

with open("/tmp/master.xlsx", "wb") as f:
    f.write(r.content)

wb = openpyxl.load_workbook("/tmp/master.xlsx", data_only=True)
ws = wb["2026"]
hdr = [str(c.value or "").strip().lower() for c in ws[2]]

def col(*aliases):
    for a in aliases:
        for j, h in enumerate(hdr):
            if h == a or h.startswith(a):
                return j
    return None

C = dict(
    nro=col("nro. de contrato"), detalle=col("detalle del contrato"),
    area=col("área protegida"), cat=col("categoria del proceso"),
    monto=col("monto (incluido iva)"), inicio=col("fecha de inicio"),
    firma=col("fecha de firma"), fin=col("fecha de finalización"),
    tipo=col("tipo de contrato"), proveedor=col("nombre del proveedor"),
    plazo=col("plazo"), adenda=col("tiene adenda"),
    tipoAdenda=col("tipo de adenda"), modificacion=col("modificación", "modificacion"),
    firmaAdenda=col("fecha de firma2"),
    ac=col("administrador/a de contrato"), correo=col("correo electrónico ac"),
    montoTotal=col("valor o plazo total"),
    # Liquidación de los contratos cerrados (hoja "2026")
    fcierre=col("fecha de cierre"),
    liquidado=col("valor liquidado"),
    saldo=col("saldo no ejecutado", "saldo"),
    # El puente con el expediente. El número de contrato se asigna al final, así
    # que nada lo ata a la carpeta donde se elaboró: esa correspondencia solo la
    # sabe quien la vivió, y estas dos columnas son donde se escribe.
    #  · carpeta        -> "Numero de carpeta interna" en la hoja 2026
    #  · codigoProceso  -> el código del expediente de la AC (RPFCH-2026-007)
    carpeta=col("numero de carpeta", "número de carpeta", "n.º de carpeta",
                "carpeta interna", "carpeta"),
    codigoProceso=col("codigoproceso", "código del proceso", "codigo del proceso"),
)
estado_cols = [j for j, h in enumerate(hdr) if "estado" in h and "gesti" in h] \
              or [j for j, h in enumerate(hdr) if "estado" in h]

# Links y estado desde la hoja Export, cruzados por nro de contrato
exp = {}
if "Export" in wb.sheetnames:
    for row in wb["Export"].iter_rows(min_row=2, values_only=True):
        if row and row[0]:
            link = str(row[14]).strip() if len(row) > 14 and row[14] and "http" in str(row[14]) else None
            estado = str(row[13] or "").strip() if len(row) > 13 else ""
            exp[str(row[0]).strip()] = {"link": link, "estado": estado}

def iso(v):
    if isinstance(v, (datetime.datetime, datetime.date)):
        return v.strftime("%Y-%m-%d")
    if isinstance(v, str):
        m = re.match(r"(\d{4})-(\d{2})-(\d{2})", v.strip())
        if m:
            return m.group(0)
    return None

def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None

def val(row, key):
    """Lee una columna opcional: None si el Excel no la tiene (no rompe el robot)."""
    j = C.get(key)
    if j is None or j >= len(row):
        return None
    return row[j]

def num2(v):
    """Número redondeado a 2 decimales (el Excel arrastra colas como 0.6799999998)."""
    n = num(v)
    return None if n is None else round(n, 2)

def texto(v):
    """Un código que se escribe a mano. La carpeta «47» llega desde Excel como
    número y publicarla como «47.0» rompería la búsqueda en el CLM."""
    if v is None:
        return None
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return str(v).strip() or None

# ---------------------------------------------------------------------------
# «Registro de Calificaciones»: hoja OPCIONAL del Excel maestro donde se pega la
# fila del CSV que descarga el CLM al calificar a un proveedor. Es lo que permite
# que una calificación hecha en una computadora apague la alerta en todas.
# Como con las columnas de arriba: si no está (o no se entiende) se avisa y se
# publica exactamente lo mismo que antes.
#
# De esa hoja se publica solo lo necesario —n.º de contrato, fecha, puntajes y la
# observación—: ni el nombre del proveedor ni ningún dato suyo. Y el registro del
# robot (público, como el repositorio) dice solo cuántas filas, nunca cuáles.
# ---------------------------------------------------------------------------
def encabezado(ws, *palabras, filas=8):
    """La fila de encabezado de una hoja que lleva un título o una nota arriba:
    la primera, entre las primeras `filas`, que tenga una celda por palabra."""
    for i, row in enumerate(ws.iter_rows(min_row=1, max_row=filas, values_only=True), 1):
        celdas = [str(c or "").strip().lower() for c in row]
        if all(any(c == p or c.startswith(p) for c in celdas) for p in palabras):
            return i, celdas
    return None, None

def columna(celdas, *alias):
    for a in alias:
        for j, h in enumerate(celdas):
            if h == a or h.startswith(a):
                return j
    return None

def celda(row, j):
    return row[j] if j is not None and j < len(row) else None

def limpio(v):
    """Texto de una celda, sin espacios de más; None si está vacía."""
    t = re.sub(r"\s+", " ", str(v)).strip() if v is not None else ""
    return t or None

def num_es(v):
    """Número de una celda que puede venir como texto con coma decimal, que es
    como queda una fila pegada desde el CSV (separado por «;») del CLM."""
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    t = re.sub(r"[\s%]", "", str(v or ""))
    if not t:
        return None
    if "," in t:
        t = t.replace(".", "").replace(",", ".")
    return num(t)

def leer_calificaciones(wb):
    """Las filas de «Registro de Calificaciones», o None si la hoja no existe
    (que no es lo mismo que existir vacía: el CLM solo avisa «pega la fila en el
    Registro» cuando el Registro existe)."""
    hoja = next((n for n in wb.sheetnames if n.strip().lower() == "registro de calificaciones"), None)
    if hoja is None:
        return None
    ws = wb[hoja]
    i, h = encabezado(ws, "nro", "puntaje")
    if i is None:
        print("AVISO: la hoja «Registro de Calificaciones» no tiene las columnas «Nro. Contrato» "
              "y «PUNTAJE TOTAL» en sus primeras filas: no se publica ninguna calificación.")
        return None
    cn = columna(h, "nro. contrato", "nro contrato", "n.º contrato", "nro")
    cf = columna(h, "fecha evaluación", "fecha evaluacion", "fecha")
    ct = columna(h, "puntaje")
    # Los cuatro aportes del indicador (ya ponderados: «Calidad (40%)» va de 0 a 40)
    ci = [columna(h, "calidad"), columna(h, "plazo"), columna(h, "atención", "atencion"),
          columna(h, "cump", "contractual")]
    co = columna(h, "observ")
    filas, malas = [], 0
    for row in ws.iter_rows(min_row=i + 1, values_only=True):
        nro = limpio(celda(row, cn))
        if not nro or "FIAS" not in nro.upper():
            continue
        score = num_es(celda(row, ct))
        if score is None or not 0 <= score <= 100:
            malas += 1
            continue
        d = {"nro": nro, "score": round(score, 2)}
        f = iso(celda(row, cf))
        if f:
            d["fecha"] = f
        ap = [num_es(celda(row, j)) for j in ci]
        if all(a is not None for a in ap):
            d["aportes"] = [round(a, 2) for a in ap]
        obs = limpio(celda(row, co))
        if obs:
            d["obs"] = obs
        filas.append(d)
    if malas:
        print(f"AVISO: {malas} fila(s) de «Registro de Calificaciones» sin un puntaje entre 0 y 100: "
              "no se publican.")
    return filas

calificaciones = leer_calificaciones(wb)

out = []
for row in ws.iter_rows(min_row=3, values_only=True):
    correo, nro = row[C["correo"]], row[C["nro"]]
    if not correo or "@" not in str(correo):
        continue
    if not nro or "FIAS" not in str(nro).upper():
        continue
    nro = str(nro).strip()
    e = exp.get(nro, {})
    plazo = row[C["plazo"]]
    if isinstance(plazo, (datetime.date, datetime.datetime)):
        plazo = iso(plazo)
    d = dict(
        nro=nro,
        detalle=row[C["detalle"]] or "",
        area=row[C["area"]] or "",
        cat=row[C["cat"]] or "",
        monto=num(row[C["monto"]]) or 0,
        montoTotal=num(row[C["montoTotal"]]),
        cerrado=any("cerrad" in str(row[j] or "").lower() for j in estado_cols)
                or "cerrad" in e.get("estado", "").lower(),
        inicio=iso(row[C["inicio"]]), firma=iso(row[C["firma"]]), fin=iso(row[C["fin"]]),
        tipo=row[C["tipo"]] or "",
        proveedor=str(row[C["proveedor"]] or "").strip(),
        plazo=plazo,
        adenda=row[C["adenda"]] or "",
        tipoAdenda=(str(row[C["tipoAdenda"]] or "").strip() or None),
        modificacion=(str(row[C["modificacion"]] or "").strip() or None),
        firmaAdenda=iso(row[C["firmaAdenda"]]),
        ac=str(row[C["ac"]] or "").strip(),
        correo=str(correo).strip(),
        link=e.get("link"),
        fcierre=iso(val(row, "fcierre")),
        liquidado=num2(val(row, "liquidado")),
        saldo=num2(val(row, "saldo")),
        carpeta=texto(val(row, "carpeta")),
        codigoProceso=texto(val(row, "codigoProceso")),
    )
    out.append(d)

if len(out) < 10:
    sys.exit(f"ERROR: solo se leyeron {len(out)} contratos; algo cambió en el Excel. "
             "No se publica para no dañar los datos actuales.")

plaintext = json.dumps(out, ensure_ascii=False, default=str).encode("utf-8")
sobre = cifrar(plaintext, DATA_KEY)
# Cuándo corrió el robot, en claro y fuera del cifrado: no es un dato de ningún
# contrato. Con él el CLM dice «actualizada hoy 06:31» y, si el robot deja de
# correr, avisa en ámbar en vez de presentar como viva una base de hace días.
sobre["generado"] = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
with open("crm/contratos_export.json", "w", encoding="utf-8") as f:
    json.dump(sobre, f, ensure_ascii=False)

# El registro va en su propio archivo, cifrado igual: así contratos_export.json no
# cambia de forma (lo leen el CRM, el CLM, Instrumentos y las renovaciones, que
# esperan una lista de contratos) y el archivo solo existe cuando existe la hoja.
if calificaciones is not None:
    sobre_c = cifrar(json.dumps(calificaciones, ensure_ascii=False).encode("utf-8"), DATA_KEY)
    sobre_c["generado"] = sobre["generado"]
    with open("crm/calificaciones_export.json", "w", encoding="utf-8") as f:
        json.dump(sobre_c, f, ensure_ascii=False)

faltan = [k for k in ("fcierre", "liquidado", "saldo") if C.get(k) is None]
if faltan:
    print("AVISO: no encontré en la hoja 2026 las columnas de liquidación:", ", ".join(faltan))
    print("       Encabezados disponibles (fila 2):", [h for h in hdr if h])

print(f"OK: {len(out)} contratos publicados (cifrados), "
      f"{sum(1 for c in out if c['link'])} con link, "
      f"{sum(1 for c in out if c['cerrado'])} cerrados, "
      f"{sum(1 for c in out if c['liquidado'] is not None)} con liquidación, "
      f"{sum(1 for c in out if c['carpeta'])} con carpeta interna.")

if calificaciones is not None:
    print(f"    Registro de Calificaciones: {len(calificaciones)} fila(s) publicadas.")
