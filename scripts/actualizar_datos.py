# -*- coding: utf-8 -*-
"""
Robot de actualización del CRM de Contratos FAP.
Descarga el Excel maestro desde OneDrive (link secreto EXCEL_URL),
lee la hoja "2026" + la hoja "Export" y regenera crm/contratos_export.json.
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
    # sabe quien la vivió, y esa columna es donde se escribe.
    #  · carpeta -> "Numero de carpeta interna" en la hoja 2026
    carpeta=col("numero de carpeta", "número de carpeta", "n.º de carpeta",
                "carpeta interna", "carpeta"),
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
    out.append(dict(
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
    ))

if len(out) < 10:
    sys.exit(f"ERROR: solo se leyeron {len(out)} contratos; algo cambió en el Excel. "
             "No se publica para no dañar los datos actuales.")

plaintext = json.dumps(out, ensure_ascii=False, default=str).encode("utf-8")
sobre = cifrar(plaintext, DATA_KEY)
with open("crm/contratos_export.json", "w", encoding="utf-8") as f:
    json.dump(sobre, f, ensure_ascii=False)

faltan = [k for k in ("fcierre", "liquidado", "saldo") if C.get(k) is None]
if faltan:
    print("AVISO: no encontré en la hoja 2026 las columnas de liquidación:", ", ".join(faltan))
    print("       Encabezados disponibles (fila 2):", [h for h in hdr if h])

print(f"OK: {len(out)} contratos publicados (cifrados), "
      f"{sum(1 for c in out if c['link'])} con link, "
      f"{sum(1 for c in out if c['cerrado'])} cerrados, "
      f"{sum(1 for c in out if c['liquidado'] is not None)} con liquidación, "
      f"{sum(1 for c in out if c['carpeta'])} con carpeta interna.")
