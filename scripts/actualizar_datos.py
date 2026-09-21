# -*- coding: utf-8 -*-
"""
Robot de actualización del CRM de Contratos FAP.
Descarga el Excel maestro desde OneDrive (link secreto EXCEL_URL),
lee la hoja "2026" + la hoja "Export" y regenera crm/contratos_export.json.
Si el maestro trae además la hoja "Proveedores", publica crm/proveedores_export.json.
"""
import os, re, json, base64, datetime, sys, unicodedata
import requests, openpyxl

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ruc as RUC
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
        codigoProceso=texto(val(row, "codigoProceso")),
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

# ============================================================================
# La hoja "Proveedores": lo que solo sabe una persona
# ============================================================================
# El listado de proveedores del CLM se arma solo con los contratos —nombre,
# áreas, categorías, montos y calificaciones salen de ahí—. Esta hoja añade lo
# que no está en ningún lado: el RUC, la actividad económica por la que se
# contrató y la verificación periódica de las ACs.
#
# Es opcional entera. Sin ella el CLM pinta el listado igual, solo que cada
# ficha dice «sin registrar» donde iría el RUC. Por eso esto va al final y en su
# propio archivo: si algo falla aquí, los contratos ya están publicados.
#
# Va en `proveedores_export.json` y no dentro del de contratos a propósito: el
# de contratos es un array, y tres páginas (CRM, CLM y renovaciones) lo leen
# como array. Cambiarle la forma para meter esto las rompería a las tres.
#
# **Se lee con lista blanca**, como el conversor de concordancia: solo suben las
# columnas nombradas aquí abajo. La hoja puede llevar teléfono, correo o
# dirección del proveedor —hace falta para trabajar— y el robot no los mira: son
# datos de contacto de una persona y el sitio es público.
PROV_COLS = dict(
    nombre=("nombre del proveedor", "proveedor", "razón social", "razon social"),
    ruc=("ruc",),
    actividad=("actividad económica", "actividad economica", "actividad"),
    verificacion=("última verificación", "ultima verificacion", "fecha de verificación",
                  "fecha de verificacion"),
    verificadoPor=("verificado por", "verificó", "verifico"),
    resultado=("resultado",),
    periodicidad=("periodicidad", "frecuencia"),
    observaciones=("observaciones", "observación", "observacion"),
)

provs = []
if "Proveedores" in wb.sheetnames:
    wsp = wb["Proveedores"]

    # Dónde están los encabezados. La hoja se pega con la fila 1, pero las hojas
    # de contratos del maestro llevan un título arriba y los encabezados en la
    # 2; si alguien uniformiza la nueva, se sigue encontrando en vez de publicar
    # una hoja vacía sin que nadie se entere.
    def encabezados(fila):
        return [str(c.value or "").strip().lower() for c in wsp[fila]]

    phdr, fila_hdr = [], 1
    for f in (1, 2, 3):
        cand = encabezados(f)
        if any(h.startswith("nombre del proveedor") or h == "proveedor" for h in cand):
            phdr, fila_hdr = cand, f
            break

    def pcol(*aliases):
        for a in aliases:
            for j, h in enumerate(phdr):
                if h == a or h.startswith(a):
                    return j
        return None

    P = {k: pcol(*als) for k, als in PROV_COLS.items()}
    if P["nombre"] is None:
        print("AVISO: la hoja «Proveedores» no tiene columna de nombre en ninguna "
              "de sus tres primeras filas; no se publica.")
        print("       Fila 1:", [h for h in encabezados(1) if h])
    else:
        def pval(row, key):
            j = P.get(key)
            if j is None or j >= len(row):
                return None
            v = row[j]
            return None if v is None else (str(v).strip() or None)

        # Solo para no publicar dos veces la misma fila. El emparejado de verdad
        # —ficha contra contratos— lo hace el CLM, con una sola función en JS
        # que normaliza los dos lados; aquí no hace falta que coincida al dedillo.
        def clave(s):
            s = unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode()
            return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", s.lower())).strip()

        vistos = set()
        for row in wsp.iter_rows(min_row=fila_hdr + 1, values_only=True):
            nombre = pval(row, "nombre")
            if not nombre:
                continue
            k = clave(nombre)
            if not k or k in vistos:
                continue
            vistos.add(k)
            crudo = None
            if P["ruc"] is not None and P["ruc"] < len(row):
                crudo = row[P["ruc"]]
            provs.append(dict(
                nombre=nombre,
                ruc=RUC.publicable(crudo),          # enmascarado si es persona natural
                rucTipo=RUC.tipo(crudo),
                actividad=pval(row, "actividad"),
                verificacion=iso(row[P["verificacion"]]) if (
                    P["verificacion"] is not None and P["verificacion"] < len(row)) else None,
                verificadoPor=pval(row, "verificadoPor"),
                resultado=pval(row, "resultado"),
                periodicidad=pval(row, "periodicidad"),
                observaciones=pval(row, "observaciones"),
            ))

        with open("crm/proveedores_export.json", "w", encoding="utf-8") as f:
            json.dump(cifrar(json.dumps(provs, ensure_ascii=False,
                                        default=str).encode("utf-8"), DATA_KEY),
                      f, ensure_ascii=False)

        con_ruc = sum(1 for p in provs if p["ruc"])
        naturales = sum(1 for p in provs if p["rucTipo"] == "Persona natural")
        print(f"OK: {len(provs)} proveedores publicados (cifrados), "
              f"{con_ruc} con RUC ({naturales} personas naturales, enmascaradas), "
              f"{sum(1 for p in provs if p['actividad'])} con actividad económica, "
              f"{sum(1 for p in provs if p['verificacion'])} verificados.")
        sin_ruc = [p["nombre"] for p in provs if not p["ruc"]
                   and (P["ruc"] is not None)]
        if sin_ruc:
            print(f"    {len(sin_ruc)} sin RUC utilizable (vacío o incompleto), "
                  f"p. ej.: {', '.join(sin_ruc[:3])}")
else:
    print("AVISO: el maestro no trae la hoja «Proveedores»; el CLM arma el listado "
          "solo con los contratos. Para crearla: python3 scripts/hoja_proveedores.py")
