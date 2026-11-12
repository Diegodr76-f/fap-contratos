# -*- coding: utf-8 -*-
"""
Robot de actualización del CRM de Contratos FAP.
Descarga el Excel maestro desde OneDrive (link secreto EXCEL_URL),
lee la hoja "2026" —y las de los años siguientes, si existen— + la hoja "Export"
y regenera crm/contratos_export.json.

Y, si existe, la hoja "Registro de Calificaciones" -> crm/calificaciones_export.json
(cifrado). Es opcional: sin ella se publica exactamente lo de siempre.

Y, solo si existe el secreto PROVEEDORES_KEY, los datos de los proveedores (hoja
"Proveedores" y columna RUC de "2026") -> instrumentos/proveedores_export.json,
cifrado con ESA frase, que no es la del registro. Lo lee solo el Generador de
Instrumentos, que usa una sola persona; las ACs no tienen esa frase.
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

# La frase de los proveedores. Opcional: sin ella la hoja «Proveedores» ni se lee.
# Tiene que ser OTRA que DATA_KEY: la del registro la tienen las 20 ACs, y la
# cédula de una persona natural no es para ellas (ver leer_proveedores()).
PROVEEDORES_KEY = os.environ.get("PROVEEDORES_KEY", "").strip()

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
# La hora a la que se LEYÓ el Excel, no la que termina el robot: el CLM la compara
# con la hora en que una AC envió una calificación para saber si el Registro ya
# podía traerla (ver «calificacionRetirada» en clm/index.html).
LEIDO = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
if not r.content.startswith(b"PK"):
    sys.exit("ERROR: lo descargado no es un Excel. Revisa que el link de OneDrive "
             "sea 'Cualquier persona con el vínculo puede ver' y que apunte al archivo .xlsx.")

with open("/tmp/master.xlsx", "wb") as f:
    f.write(r.content)

wb = openpyxl.load_workbook("/tmp/master.xlsx", data_only=True)
# Las hojas de contratos: «2026» y, desde enero, las de los años siguientes
# («2027», «2028»…) si ya existen. Hasta 2026 el robot leía solo «2026»: los
# contratos firmados en 2027 habrían quedado fuera del CLM sin que nada avisara,
# y los de 2026 que vencen el 31 de enero tienen que seguir estando. Las hojas de
# años anteriores no se leen (tienen otro formato y ya no se gestionan).
# Sin una hoja nueva se publica exactamente lo mismo que antes.
ANIO_BASE = 2026
ws = wb[str(ANIO_BASE)]
hdr = []
C = {}
estado_cols = []

def col(*aliases):
    for a in aliases:
        for j, h in enumerate(hdr):
            if h == a or h.startswith(a):
                return j
    return None

def mapear(hoja):
    """Deja en hdr, C y estado_cols las columnas de esa hoja, buscadas por su rótulo."""
    global hdr, C, estado_cols
    hdr = [str(c.value or "").strip().lower() for c in hoja[2]]
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

OBLIGATORIAS = ("nro", "detalle", "area", "cat", "monto", "inicio", "firma", "fin", "tipo", "proveedor",
                "plazo", "adenda", "tipoAdenda", "modificacion", "firmaAdenda", "ac", "correo", "montoTotal")
mapear(ws)

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
# «Registro de Calificaciones»: hoja OPCIONAL del Excel maestro donde un flujo de
# Power Automate agrega la fila de cada calificación que una AC confirma en el CLM
# (plan/FLUJO_CALIFICACIONES.md). Es lo que permite
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
    como queda una fila que alguien escribió o corrigió a mano en la tabla."""
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
    (que no es lo mismo que existir vacía: sin hoja no se publica el archivo y el
    CLM sabe que todavía no hay Registro)."""
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

# ---------------------------------------------------------------------------
# Proveedores: cédula o RUC, representante, correo y dirección, para las
# contrapartes del Generador de Instrumentos. Son datos privados (el RUC de una
# persona natural es su cédula), así que:
#  · sin el secreto PROVEEDORES_KEY no se lee nada;
#  · se publican aparte, cifrados con esa frase, que solo tiene quien usa el
#    Generador; si alguien pone la misma frase que DATA_KEY, no se publica;
#  · contratos_export.json no cambia ni un byte;
#  · el registro del robot (público) dice cuántos, nunca cuáles.
# Las columnas se buscan por su rótulo y todas son opcionales menos el nombre.
# ---------------------------------------------------------------------------
def plano(v):
    t = str(v or "").lower()
    for a, b in (("á", "a"), ("é", "e"), ("í", "i"), ("ó", "o"), ("ú", "u"), ("ü", "u"), ("ñ", "n")):
        t = t.replace(a, b)
    return re.sub(r"[^a-z0-9]+", " ", t).strip()

ALIAS_PROV = {
    "nombre": ("proveedor", "nombre del proveedor", "razon social", "nombre o razon social", "nombre", "contratista"),
    "identificacion": ("ruc", "ruc ci", "ruc cedula", "cedula", "cedula ruc", "ci", "identificacion",
                       "numero de identificacion", "n de identificacion"),
    "representante": ("representante legal", "representante"),
    "email": ("correo electronico", "correo", "email", "e mail", "mail"),
    "direccion": ("direccion", "domicilio"),
}
# Un rótulo que nombra a otra persona no es del proveedor: «Correo electrónico AC»,
# «Cédula del representante».
NO_PROV = {
    "nombre": re.compile(r"\b(representante|administrador|ac|area|contacto|banco)\b"),
    "identificacion": re.compile(r"\b(representante|administrador|ac)\b"),
    "representante": re.compile(r"\b(cedula|ruc|correo|ci)\b"),
    "email": re.compile(r"\b(administrador|ac)\b"),
    "direccion": re.compile(r"\b(administrador|ac)\b"),
}

def columna_prov(celdas, campo, usadas=()):
    mejor, puntos = None, 0
    for j, h in enumerate(celdas):
        h = plano(h)
        if not h or j in usadas or NO_PROV[campo].search(h):
            continue
        p = 0
        for a in ALIAS_PROV[campo]:
            if h == a:
                p = max(p, 3)
            elif h.startswith(a + " "):
                p = max(p, 2)
        if p > puntos:
            mejor, puntos = j, p
    return mejor

def identificacion(v):
    """Excel guarda la cédula como número: le quita el cero inicial y a veces la
    escribe como 1792212502001.0. Con 9 o 12 dígitos solo puede faltar ese cero."""
    if v is None:
        return None
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    t = re.sub(r"[\s.\-]", "", str(v).strip())
    if not t:
        return None
    if t.isdigit() and len(t) in (9, 12):
        t = "0" + t
    return t

def leer_proveedores(wb, ws_contratos):
    """Lista de proveedores [{nombre, identificacion, ...}] o None si no hay de dónde."""
    lista, por_clave, choques = [], {}, 0
    def poner(d):
        nonlocal choques
        k = plano(d.get("nombre"))
        if not k:
            return
        if k not in por_clave:
            por_clave[k] = {"nombre": d["nombre"]}
            lista.append(por_clave[k])
        p = por_clave[k]
        for c in ("identificacion", "representante", "email", "direccion"):
            v = d.get(c)
            if not v:
                continue
            if not p.get(c):
                p[c] = v
            elif c == "identificacion" and p[c] != v:
                choques += 1

    hubo = False
    hoja = next((n for n in wb.sheetnames if plano(n) == "proveedores"), None)
    if hoja is not None:
        ws_p = wb[hoja]
        enc = None
        for i, row in enumerate(ws_p.iter_rows(min_row=1, max_row=10, values_only=True), 1):
            celdas = list(row)
            jn = columna_prov(celdas, "nombre")
            ji = columna_prov(celdas, "identificacion", (jn,)) if jn is not None else None
            if jn is not None and ji is not None:
                usadas = {jn, ji}
                cols = {"nombre": jn, "identificacion": ji}
                for c in ("representante", "email", "direccion"):
                    j = columna_prov(celdas, c, usadas)
                    if j is not None:
                        cols[c] = j; usadas.add(j)
                enc = (i, cols)
                break
        if enc is None:
            print("AVISO: la hoja «Proveedores» no tiene, en sus primeras filas, una columna con el "
                  "nombre del proveedor y otra con el RUC o la cédula: no se lee.")
        else:
            hubo = True
            i, cols = enc
            for row in ws_p.iter_rows(min_row=i + 1, values_only=True):
                d = {c: limpio(celda(row, j)) for c, j in cols.items()}
                d["identificacion"] = identificacion(celda(row, cols["identificacion"]))
                if d["nombre"]:
                    poner(d)

    # «El RUC va en la fila del contrato»: si la hoja 2026 tiene esa columna, también cuenta.
    j_ruc = next((j for j, h in enumerate(hdr) if plano(h) in ("ruc", "ruc ci", "ruc cedula", "cedula ruc", "cedula")
                  or plano(h).startswith("ruc ")), None)
    if j_ruc is not None:
        hubo = True
        for row in ws_contratos.iter_rows(min_row=3, values_only=True):
            nombre = limpio(celda(row, C["proveedor"]))
            ruc = identificacion(celda(row, j_ruc))
            if nombre and ruc:
                poner({"nombre": nombre, "identificacion": ruc})

    if not hubo:
        print("AVISO: hay frase de proveedores, pero el Excel no tiene la hoja «Proveedores» ni una "
              "columna RUC en «2026»: no se publica nada de proveedores.")
        return None
    if choques:
        print(f"AVISO: {choques} proveedor(es) aparecen con dos RUC distintos: se publica el primero.")
    return lista

proveedores = None
if PROVEEDORES_KEY and PROVEEDORES_KEY == DATA_KEY:
    print("AVISO: PROVEEDORES_KEY es igual a DATA_KEY, la frase que tienen todas las ACs. "
          "No se publican los proveedores: pon una frase distinta.")
elif PROVEEDORES_KEY:
    proveedores = leer_proveedores(wb, ws)

def leer_contratos(hoja):
    """Los contratos de una hoja, con las columnas que mapear() dejó en C."""
    filas = []
    for row in hoja.iter_rows(min_row=3, values_only=True):
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
        filas.append(d)
    return filas

out = leer_contratos(ws)
por_hoja = {str(ANIO_BASE): len(out)}
vistos = {c["nro"] for c in out}
siguientes = sorted(n for n in wb.sheetnames if n.strip().isdigit() and len(n.strip()) == 4 and int(n) > ANIO_BASE)
for nombre in siguientes:
    mapear(wb[nombre])
    faltan_cols = [k for k in OBLIGATORIAS if C.get(k) is None]
    if faltan_cols:
        print(f"AVISO: la hoja «{nombre.strip()}» no tiene en su fila 2 las columnas de la hoja «{ANIO_BASE}» "
              f"({', '.join(faltan_cols)}): no se leen sus contratos.")
        continue
    # Un número repetido en dos hojas se publica una vez: manda la primera.
    nuevos = [c for c in leer_contratos(wb[nombre]) if c["nro"] not in vistos]
    vistos.update(c["nro"] for c in nuevos)
    out.extend(nuevos)
    por_hoja[nombre.strip()] = len(nuevos)
mapear(ws)   # lo que sigue (avisos de columnas) habla de la hoja base

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
if proveedores is not None:
    os.makedirs("instrumentos", exist_ok=True)
    sobre_p = cifrar(json.dumps(proveedores, ensure_ascii=False).encode("utf-8"), PROVEEDORES_KEY)
    sobre_p["generado"] = LEIDO
    with open("instrumentos/proveedores_export.json", "w", encoding="utf-8") as f:
        json.dump(sobre_p, f, ensure_ascii=False)

if calificaciones is not None:
    sobre_c = cifrar(json.dumps(calificaciones, ensure_ascii=False).encode("utf-8"), DATA_KEY)
    sobre_c["generado"] = LEIDO
    with open("crm/calificaciones_export.json", "w", encoding="utf-8") as f:
        json.dump(sobre_c, f, ensure_ascii=False)

faltan = [k for k in ("fcierre", "liquidado", "saldo") if C.get(k) is None]
if faltan:
    print("AVISO: no encontré en la hoja 2026 las columnas de liquidación:", ", ".join(faltan))
    print("       Encabezados disponibles (fila 2):", [h for h in hdr if h])

if len(por_hoja) > 1:
    print("    Por hoja: " + ", ".join(f"«{k}» {v}" for k, v in por_hoja.items()) + ".")
print(f"OK: {len(out)} contratos publicados (cifrados), "
      f"{sum(1 for c in out if c['link'])} con link, "
      f"{sum(1 for c in out if c['cerrado'])} cerrados, "
      f"{sum(1 for c in out if c['liquidado'] is not None)} con liquidación, "
      f"{sum(1 for c in out if c['carpeta'])} con carpeta interna.")

if calificaciones is not None:
    print(f"    Registro de Calificaciones: {len(calificaciones)} fila(s) publicadas.")
if proveedores is not None:
    print(f"    Proveedores: {len(proveedores)} publicados, "
          f"{sum(1 for p in proveedores if p.get('identificacion'))} con cédula o RUC "
          "(cifrados con su propia frase; solo los lee el Generador de Instrumentos).")
