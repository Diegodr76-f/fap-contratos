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
    ))

if len(out) < 10:
    sys.exit(f"ERROR: solo se leyeron {len(out)} contratos; algo cambió en el Excel. "
             "No se publica para no dañar los datos actuales.")

plaintext = json.dumps(out, ensure_ascii=False, default=str).encode("utf-8")
sobre = cifrar(plaintext, DATA_KEY)
with open("crm/contratos_export.json", "w", encoding="utf-8") as f:
    json.dump(sobre, f, ensure_ascii=False)

print(f"OK: {len(out)} contratos publicados (cifrados), "
      f"{sum(1 for c in out if c['link'])} con link, "
      f"{sum(1 for c in out if c['cerrado'])} cerrados.")

# ---------------------------------------------------------------------------
# BANCO DE PROVEEDORES
# Las ACs califican en el CLM/CRM y el flujo de Power Automate escribe cada
# calificación como una fila de la hoja "Registro de Calificaciones" del Excel.
# Aquí esa hoja se devuelve publicada (cifrada) para que todas las ACs vean el
# mismo historial: crm/calificaciones_export.json.
# ---------------------------------------------------------------------------

INDICADORES = ["Calidad del producto / servicio", "Cumplimiento de plazo",
               "Atención y soporte", "Cumplimiento contractual"]

def prov_key(nombre):
    """Misma normalización que el CLM (clm/index.html → provKey), para que
    'CIA. LTDA.' y 'S.A.' no partan al mismo proveedor en varias fichas."""
    s = str(nombre or "").strip().lower()
    k = re.sub(r"[.,;:\"'()]", " ", s)
    k = re.sub(r"\b(cia|ltda|limitada|s\s?a|sas|srl|cl|compania|compañia)\b", " ", k)
    k = re.sub(r"\s+", " ", k).strip()
    return k or s

def semaforo(score):
    if score >= 90: return "Confiable (Preferente)", True
    if score >= 80: return "Satisfactorio", True
    if score >= 70: return "Aceptable – Observado", True
    if score >= 60: return "Deficiente – Inaceptable", False
    return "No recomendado", False

def numero(v):
    """Acepta 82,5 (formato es-EC del CSV/Excel) y 82.5."""
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v or "").strip().replace(" ", "")
    if not s:
        return None
    if "," in s and "." in s:
        s = s.replace(".", "").replace(",", ".")
    else:
        s = s.replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None

hoja_cal = next((n for n in wb.sheetnames if "calificac" in n.lower()), None)
cals = []
if hoja_cal:
    wsc = wb[hoja_cal]
    filas = list(wsc.iter_rows(values_only=True))
    # La cabecera puede no estar en la primera fila (títulos, logos, notas)
    hi = next((i for i, f in enumerate(filas[:6])
               if f and any("puntaje" in str(c or "").lower() for c in f)), 0)
    head = [str(c or "").strip().lower() for c in filas[hi]]

    def ccol(*aliases):
        for a in aliases:
            for j, h in enumerate(head):
                if h.startswith(a):
                    return j
        return None

    K = dict(
        nro=ccol("nro. contrato", "nro contrato", "nro. de contrato", "contrato"),
        prov=ccol("nombre proveedor", "proveedor"),
        area=ccol("área protegida", "area protegida", "área", "area"),
        cat=ccol("categoría", "categoria"),
        ac=ccol("administrador"), fecha=ccol("fecha evaluación", "fecha evaluacion", "fecha"),
        c1=ccol("calidad"), c2=ccol("plazo"), c3=ccol("atención", "atencion"),
        c4=ccol("cump. contractual", "cumplimiento contractual", "contractual"),
        total=ccol("puntaje total", "puntaje"), res=ccol("resultado"),
        eleg=ccol("elegible"), obs=ccol("observaciones"), ruc=ccol("ruc"),
    )
    vistos = {}
    for row in filas[hi + 1:]:
        if not row or K["nro"] is None or K["nro"] >= len(row):
            continue
        nro = str(row[K["nro"]] or "").strip()
        score = numero(row[K["total"]]) if K["total"] is not None and K["total"] < len(row) else None
        if not nro or score is None:
            continue
        val = lambda k: (str(row[K[k]]).strip()
                         if K[k] is not None and K[k] < len(row) and row[K[k]] is not None else "")
        sem, elegible = semaforo(score)
        if K["res"] is not None and val("res"):
            sem = val("res")
        if K["eleg"] is not None and val("eleg"):
            elegible = val("eleg").lower().startswith(("s", "y", "t"))  # Sí / Yes / True
        aportes = []
        for idx, k in enumerate(("c1", "c2", "c3", "c4")):
            a = numero(row[K[k]]) if K[k] is not None and K[k] < len(row) else None
            if a is not None:
                aportes.append({"nombre": INDICADORES[idx], "aporte": round(a, 2)})
        prov = val("prov")
        fecha = iso(row[K["fecha"]]) if K["fecha"] is not None and K["fecha"] < len(row) else None
        entrada = dict(
            id="x" + nro, nro=nro, prov=prov, key=prov_key(prov), ruc=val("ruc"),
            area=val("area"), cat=val("cat"), ac=val("ac"),
            fecha=fecha or datetime.date.today().strftime("%Y-%m-%d"),
            score=round(score, 2), sem=sem, elegible=bool(elegible),
            aportes=aportes or None, vals=None, obs=val("obs"), user=val("ac"),
        )
        # Una calificación por contrato: si el flujo agregó varias filas (recalificación),
        # gana la más reciente, que es como lo resuelve el CLM.
        previa = vistos.get(nro)
        if not previa or str(entrada["fecha"]) >= str(previa["fecha"]):
            vistos[nro] = entrada
    cals = list(vistos.values())

if cals:
    sobre_cal = cifrar(json.dumps(cals, ensure_ascii=False, default=str).encode("utf-8"), DATA_KEY)
    with open("crm/calificaciones_export.json", "w", encoding="utf-8") as f:
        json.dump(sobre_cal, f, ensure_ascii=False)
    proveedores = len({c["key"] for c in cals})
    no_elegibles = sum(1 for c in cals if not c["elegible"])
    print(f"OK: {len(cals)} calificaciones publicadas (cifradas) desde la hoja "
          f"'{hoja_cal}' · {proveedores} proveedores · {no_elegibles} no elegibles.")
elif hoja_cal:
    print(f"AVISO: la hoja '{hoja_cal}' no tiene filas legibles; "
          "se conserva el calificaciones_export.json anterior.")
else:
    print("AVISO: el Excel no tiene hoja de calificaciones ('Registro de Calificaciones'); "
          "el banco de proveedores queda solo con lo local de cada navegador.")
