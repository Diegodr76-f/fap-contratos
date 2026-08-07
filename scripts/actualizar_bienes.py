# -*- coding: utf-8 -*-
"""
Robot de actualización de la matriz de bienes del FAP.

Descarga la MATRIZ NACIONAL DE ACTIVOS Y BIENES desde OneDrive (link secreto
BIENES_EXCEL_URL), lee las hojas "Activos" y "Bienes control" y regenera
bienes/bienes_export.json + bienes/datos/*.json.

Lo publicado va cifrado y partido por área, en archivos separados para que
una AC descargue solo lo suyo (unas decenas de kB) y no la matriz entera:

    bienes/bienes_export.json      índice en claro: qué áreas hay y cuántos
                                   bienes tiene cada una (ningún dato del bien)
    bienes/datos/maestro.json      sobre AES con TODOS los bienes  <- frase BIENES_KEY
    bienes/datos/PNC.json          sobre AES con los bienes del área <- frase derivada
    ...

Así, la administradora de bienes abre todo con su frase y cada AC abre
únicamente su área con la suya. La frase de cada área se deriva de la
maestra con HMAC-SHA256, de modo que no hay una lista de claves que
mantener: la herramienta las vuelve a calcular cuando hacen falta.

Si la matriz no cambió desde la última corrida no se vuelve a cifrar nada
(cada cifrado usa sal e IV nuevos y el archivo saldría distinto aunque los
datos fueran idénticos, ensuciando el repositorio con un commit diario).
"""
import os, re, json, base64, hmac, hashlib, datetime, sys
import requests, openpyxl
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

URL = os.environ.get("BIENES_EXCEL_URL", "").strip()
if not URL:
    sys.exit("ERROR: falta el secreto BIENES_EXCEL_URL en el repositorio.")

# Frase maestra de la matriz de bienes. Es distinta de DATA_KEY (la del
# CRM/CLM) a propósito: la de contratos la conoce todo el equipo, y aquí
# solo la administradora de bienes debe poder ver la matriz completa.
KEY = os.environ.get("BIENES_KEY", "").strip()
if not KEY:
    sys.exit("ERROR: falta el secreto BIENES_KEY. No se publica en claro por seguridad. "
             "Añádelo en Settings → Secrets and variables → Actions.")

ITER = 250000
UMBRAL_ACTIVO = 500          # activo fijo desde $500; por debajo, bien de control
ALFA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"   # sin I, O, 0 ni 1


def cifrar(obj, passphrase):
    """AES-256-GCM con clave derivada de la frase (PBKDF2-SHA256).
    Mismo sobre que descifra el WebCrypto del CLM, el CRM y /bienes/."""
    plaintext = json.dumps(obj, ensure_ascii=False, default=str).encode("utf-8")
    salt = os.urandom(16)
    iv = os.urandom(12)
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=ITER)
    key = kdf.derive(passphrase.encode("utf-8"))
    ct = AESGCM(key).encrypt(iv, plaintext, None)
    b = lambda x: base64.b64encode(x).decode("ascii")
    return {"fap_enc": 1, "kdf": "PBKDF2-SHA256", "iter": ITER,
            "salt": b(salt), "iv": b(iv), "ct": b(ct)}


def frase_area(master, sigla):
    """Frase de un área: 15 caracteres en grupos de cinco (XXXXX-XXXXX-XXXXX).
    Debe dar exactamente lo mismo que fraseArea() en bienes/index.html."""
    mac = hmac.new(master.encode("utf-8"), ("bienes-area:" + sigla).encode("utf-8"),
                   hashlib.sha256).digest()
    out = ""
    for i in range(15):
        out += ALFA[mac[i] % 32]
        if i % 5 == 4 and i < 14:
            out += "-"
    return out


# ---------------------------------------------------------------- catálogos
# Sigla del código -> nombre del área. Es la misma tabla de bienes/index.html
# (ver bienes/MATRIZ.md para saber de dónde sale cada sigla).
AREAS = {
    "PNA": "Parque Nacional Antisana",
    "PNCC": "Parque Nacional Cayambe Coca",
    "PNCCa": "Parque Nacional Cotacachi Cayapas",
    "PNC": "Parque Nacional Cotopaxi",
    "PNLL": "Parque Nacional Llanganates",
    "PNM": "Parque Nacional Machalilla",
    "PNP": "Parque Nacional Podocarpus",
    "PNRNS": "Parque Nacional Río Negro Sopladora",
    "PNS": "Parque Nacional Sangay",
    "PNSNG": "Parque Nacional Sumaco Napo Galeras",
    "PNYCI": "Parque Nacional Yacuri",
    "PNY": "Parque Nacional Yasuní",
    "REAR": "Reserva Ecológica Arenillas",
    "RECB": "Reserva Ecológica Cofán Bermejo",
    "REEA": "Reserva Ecológica El Ángel",
    "REI": "Reserva Ecológica Los Ilinizas",
    "REMACH": "Reserva Ecológica Mache Chindul",
    "RCM": "Reserva Ecológica Manglares Cayapas Mataje",
    "REMCH": "Reserva Ecológica Manglares Churute",
    "RBCP": "Reserva Biológica Cerro Plateado",
    "RBCC": "Reserva Biológica Colonso Chalupas",
    "RBEC": "Reserva Biológica El Cóndor",
    "RBEQ": "Reserva Biológica El Quimi",
    "RBL": "Reserva Biológica Limoncocha",
    "RGP": "Reserva Geobotánica Pululahua",
    "RMEP": "Reserva Marina El Pelado",
    "RMGSF": "Reserva Marina Galera San Francisco",
    "RMISC": "Reserva Marina Isla Santa Clara",
    "RPFCH": "Reserva de Producción de Fauna Chimborazo",
    "RPFC": "Reserva de Producción de Fauna Cuyabeno",
    "RPFMS": "Reserva de Producción de Fauna Manglares El Salado",
    "RMPSE": "Reserva de Producción de Fauna Marino Costera Puntilla Santa Elena",
    "RVSEP": "Refugio de Vida Silvestre El Pambilar",
    "RVSEZ": "Refugio de Vida Silvestre El Zarza",
    "RVSMERE": "Refugio de Vida Silvestre Estuario del Río Esmeraldas",
    "REVISICOF": "Refugio de Vida Silvestre Isla Corazón y Fragatas",
    "RVSCH": "Refugio de Vida Silvestre La Chiquita",
    "RVSMT": "Refugio de Vida Silvestre Machángara Tomebamba",
    "REVISMEM": "Refugio de Vida Silvestre Manglares El Morro",
    "RVSMERM": "Refugio de Vida Silvestre Manglares Estuario Río Muisne",
    "RVSMCP": "Refugio de Vida Silvestre Marino Costero Pacoche",
    "RVSP": "Refugio de Vida Silvestre Pasochoa",
    "ANRB": "Área Nacional de Recreación El Boliche",
    "ANRIS": "Área Nacional de Recreación Isla Santay",
    "ANRPL": "Área Nacional de Recreación Playas de Villamil",
    "DAPOFC": "Dirección de Áreas Protegidas y Otras Formas de Conservación",
}
SIGLA_ALIAS = {
    "RMPCPS": "REVISICOF", "REVISIC": "REVISICOF", "RVSMEM": "REVISMEM",
    "RPFMCPSE": "RMPSE", "REMCHU": "REMCH", "RECM": "RCM",
}
# Tipo contable -> vida útil en años, para los registros que no la traen.
VIDA_POR_TIPO = {
    "EQUIPO DE COMPUTACIÓN": 3,
    "EQUIPO DE OFICINA/CAMPO": 10,
    "MAQUINARIA Y EQUIPO DE CAMPO": 10,
    "MUEBLES Y ENSERES": 10,
    "VEHÍCULOS": 5,
}


def sigla_de(codigo, ubicacion):
    partes = [p for p in re.split(r"[\s\n\-]+", str(codigo or "")) if p]
    s = partes[1] if len(partes) > 1 else ""
    # Filas viejas del tipo «02 RPFMS-026-001-EO» dejan la sigla en el bloque 1.
    if s.isdigit() and len(partes) > 2:
        s = re.sub(r"^\d+", "", partes[0]) or partes[2]
    s = SIGLA_ALIAS.get(s, s)
    # RVSP se usó a la vez para Pasochoa y para El Pambilar: desempata la ubicación.
    if s == "RVSP" and re.search(r"pambilar", str(ubicacion or ""), re.I):
        s = "RVSEP"
    return s if s in AREAS else (s or "SIN-AREA")


def iso(v):
    if isinstance(v, (datetime.datetime, datetime.date)):
        return v.strftime("%Y-%m-%d")
    if isinstance(v, str):
        s = v.strip()
        m = re.match(r"(\d{4})-(\d{2})-(\d{2})", s)
        if m:
            return m.group(0)
        m = re.match(r"^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})", s)
        if m:
            return "%s-%02d-%02d" % (m.group(3), int(m.group(2)), int(m.group(1)))
    return ""


def num(v):
    try:
        return float(str(v).replace(",", "."))
    except (TypeError, ValueError):
        return 0.0


def txt(v):
    if v is None:
        return ""
    return re.sub(r"\s+", " ", str(v)).strip()


# ---------------------------------------------------------------- descarga
if "download=1" not in URL:
    URL += ("&" if "?" in URL else "?") + "download=1"

r = requests.get(URL, timeout=180, allow_redirects=True)
r.raise_for_status()
if not r.content.startswith(b"PK"):
    sys.exit("ERROR: lo descargado no es un Excel. Revisa que el link de OneDrive "
             "sea 'Cualquier persona con el vínculo puede ver' y apunte al .xlsx.")

with open("/tmp/matriz_bienes.xlsx", "wb") as f:
    f.write(r.content)

wb = openpyxl.load_workbook("/tmp/matriz_bienes.xlsx", data_only=True, read_only=True)
hoy = datetime.date.today()

# Las 44 columnas de la matriz, en el orden en que están (base 0).
COL = dict(
    codigo=0, descripcion=1, detalle=2, cantidad=3, tipoSeguros=4, tipoContable=5,
    proyecto=6, fechaCompra=7, donante=8, proveedor=9, ruc=10, factura=11,
    facturaLink=12, valor=13, marca=14, modelo=15, serie=16, cedula=17,
    custodio=18, institucion=19, ubicacion=20, acta=21, asegurado=22,
    inicioSeguro=23, finSeguro=24, aseguradora=25, poliza=26, garantia=27,
    inicioGarantia=28, finGarantia=29, estadoGarantia=30, estadoFisico=31,
    vida=32, fechaBaja=39, motivoBaja=40, observaciones=41, foto=42,
)
FECHAS = {"fechaCompra", "inicioSeguro", "finSeguro", "inicioGarantia", "finGarantia", "fechaBaja"}
NUMEROS = {"valor", "cantidad", "vida"}

bienes = []
for ws in wb.worksheets:
    nombre = (ws.title or "").strip().lower()
    if "activo" in nombre:
        hoja = "Activos"
    elif "control" in nombre:
        hoja = "Bienes control"
    else:
        continue
    for fila in ws.iter_rows(min_row=2, values_only=True):
        if not fila or fila[0] is None or not str(fila[0]).strip():
            continue
        g = lambda k: fila[COL[k]] if COL[k] < len(fila) else None
        b = {}
        for k in COL:
            v = g(k)
            if k in FECHAS:
                b[k] = iso(v)
            elif k in NUMEROS:
                b[k] = num(v)
            else:
                b[k] = txt(v)
        b["hoja"] = hoja
        b["sigla"] = sigla_de(b["codigo"], b["ubicacion"])
        b["area"] = AREAS.get(b["sigla"], b["sigla"])
        if not b["vida"]:
            b["vida"] = VIDA_POR_TIPO.get(b["tipoContable"].upper(), 10)
        # La depreciación NO se publica: la herramienta la recalcula al abrirse,
        # con corte del día. Publicarla congelaría la cifra y volvería a crear el
        # problema que tiene hoy la matriz (columnas cerradas a fechas distintas).
        bienes.append(b)

if len(bienes) < 50:
    sys.exit("ERROR: solo se leyeron %d bienes; algo cambió en la matriz. "
             "No se publica para no dañar los datos actuales." % len(bienes))

# ---------------------------------------------------------------- publicación
INDICE = "bienes/bienes_export.json"
DATOS = "bienes/datos"

# Huella del contenido: si la matriz no cambió, no se recifra nada. Cada cifrado
# estrena sal e IV, así que sin esta comprobación el robot generaría un archivo
# distinto cada día aunque nadie hubiera tocado el Excel.
firma = hashlib.sha256(
    json.dumps(bienes, ensure_ascii=False, sort_keys=True, default=str).encode("utf-8")
).hexdigest()

anterior = {}
try:
    with open(INDICE, encoding="utf-8") as f:
        anterior = json.load(f)
except (OSError, ValueError):
    pass
if anterior.get("firma") == firma and os.path.isdir(DATOS):
    print("Sin cambios en la matriz (firma %s…): no se republica." % firma[:12])
    sys.exit(0)

por_area = {}
for b in bienes:
    por_area.setdefault(b["sigla"], []).append(b)

os.makedirs(DATOS, exist_ok=True)
# Se borran los sobres de áreas que ya no existen para que no queden datos
# viejos accesibles con una frase que sigue siendo válida.
for viejo in os.listdir(DATOS):
    if viejo.endswith(".json"):
        os.remove(os.path.join(DATOS, viejo))

with open(os.path.join(DATOS, "maestro.json"), "w", encoding="utf-8") as f:
    json.dump(cifrar(bienes, KEY), f, ensure_ascii=False)

areas_out = {}
for sigla, lista in sorted(por_area.items()):
    if sigla not in AREAS:
        # Códigos que no se pudieron atribuir a un área: quedan solo en el sobre
        # maestro, para que la administradora los vea y los corrija en el Excel.
        continue
    frase = frase_area(KEY, sigla)
    with open(os.path.join(DATOS, sigla + ".json"), "w", encoding="utf-8") as f:
        json.dump(cifrar(lista, frase), f, ensure_ascii=False)
    areas_out[sigla] = {
        # La huella permite reconocer de qué área es una frase sin derivar la
        # clave (una sola PBKDF2 por entrada en vez de 44). Es el hash de una
        # frase de ~75 bits de azar, no de algo adivinable.
        "huella": hashlib.sha256(frase.encode("utf-8")).hexdigest(),
        "n": len(lista),
        "archivo": "datos/" + sigla + ".json",
    }

with open(INDICE, "w", encoding="utf-8") as f:
    json.dump({
        "generado": hoy.isoformat(),
        "total": len(bienes),
        "firma": firma,
        "maestro": "datos/maestro.json",
        "areas": areas_out,
    }, f, ensure_ascii=False, indent=1)

sin_area = sum(1 for b in bienes if b["sigla"] not in AREAS)
activos = sum(1 for b in bienes if b["hoja"] == "Activos")
print("OK: %d bienes publicados (cifrados) — %d activos fijos, %d bienes de control, "
      "%d áreas, %d sin área reconocible."
      % (len(bienes), activos, len(bienes) - activos, len(areas_out), sin_area))
