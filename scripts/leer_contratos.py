# -*- coding: utf-8 -*-
"""
Leer la base de contratos que publica el robot, desde una terminal.

El robot deja cada mañana en crm/contratos_export.json lo que hay en el Excel
maestro, cifrado. El CLM lo abre en el navegador con la frase del equipo; esto
hace lo mismo desde aquí, para quien trabaja en el repositorio —una persona o
una sesión de Claude— sin que nadie tenga que subir el Excel a mano.

    python3 scripts/leer_contratos.py                  resumen del portafolio
    python3 scripts/leer_contratos.py --buscar pasochoa   contratos que coinciden
    python3 scripts/leer_contratos.py --json           la base entera, por la salida
    python3 scripts/leer_contratos.py --fresco         antes, trae lo último que publicó el robot

Tres reglas, y las tres son la política de datos del repositorio:

  · La frase se lee de la variable de entorno DATA_KEY y de ningún otro sitio:
    como argumento quedaría en el historial de la terminal.
  · Nada se escribe en disco. La base descifrada sale por la pantalla y ya; el
    que quiera un archivo lo redirige fuera del repositorio, que es público.
  · Los proveedores (RUC, cédula) no se leen: ese archivo va con otra frase y
    solo lo usa el Generador de Instrumentos.

Qué se renueva y qué va por proceso nuevo se decide con la misma regla que el
CLM (es_recurrente(), en plan_renovaciones.py, por fechas): no se reinventa aquí.
"""
import argparse, base64, datetime, json, os, subprocess, sys, unicodedata
from collections import Counter

try:
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
except ImportError:
    sys.exit("Falta una dependencia. Instálala con:\n    pip install cryptography openpyxl")

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(RAIZ, "scripts"))
from plan_renovaciones import es_recurrente  # noqa: E402  la única fuente de la regla

ARCHIVOS = {"contratos": "crm/contratos_export.json", "calificaciones": "crm/calificaciones_export.json"}


def plano(s):
    s = unicodedata.normalize("NFD", str(s or "").lower())
    return "".join(c for c in s if unicodedata.category(c) != "Mn")


def crudo(ruta, fresco):
    """El archivo tal como está publicado: del árbol de trabajo o, con --fresco, de origin/main."""
    if fresco:
        r = subprocess.run(["git", "-C", RAIZ, "show", "origin/main:" + ruta], capture_output=True)
        return r.stdout.decode("utf-8") if r.returncode == 0 else None
    ruta = os.path.join(RAIZ, ruta)
    if not os.path.exists(ruta):
        return None
    with open(ruta, encoding="utf-8") as f:
        return f.read()


def abrir(texto, frase):
    env = json.loads(texto)
    if not (isinstance(env, dict) and env.get("fap_enc")):
        return env, None
    b = base64.b64decode
    clave = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=b(env["salt"]),
                       iterations=env.get("iter", 250000)).derive(frase.encode("utf-8"))
    return json.loads(AESGCM(clave).decrypt(b(env["iv"]), b(env["ct"]), None).decode("utf-8")), env.get("generado")


def situacion(c, hoy):
    if c.get("cerrado"):
        return "cerrado"
    fin = c.get("fin")
    if not fin:
        return "sin fecha de fin"
    d = (datetime.date.fromisoformat(fin) - hoy).days
    return "vencido" if d < 0 else "por vencer (≤90 d)" if d <= 90 else "vigente"


def dia(iso):
    try:
        return datetime.date.fromisoformat(str(iso)[:10])
    except (TypeError, ValueError):
        return None


def que_sigue(c):
    if not es_recurrente(c.get("cat"), dia(c.get("inicio")) or dia(c.get("firma")), dia(c.get("fin"))):
        return "puntual: no continúa"
    if c.get("tipo") == "Nuevo":
        return "se puede renovar"
    return "proceso nuevo" if c.get("tipo") else "sin tipo de contrato"


def main():
    ap = argparse.ArgumentParser(description="Lee la base de contratos cifrada que publica el robot.")
    ap.add_argument("--buscar", metavar="TEXTO", help="contratos que contienen todas las palabras")
    ap.add_argument("--json", action="store_true", help="la base entera en JSON, por la salida estándar")
    ap.add_argument("--fresco", action="store_true", help="lee lo último publicado en origin/main (hace git fetch)")
    a = ap.parse_args()

    frase = os.environ.get("DATA_KEY", "").strip()
    if not frase:
        sys.exit("Falta la frase de acceso. Va en la variable de entorno DATA_KEY (la misma del CLM),\n"
                 "nunca como argumento. En una sesión en la nube se añade en la configuración del entorno.")
    if a.fresco:
        r = subprocess.run(["git", "-C", RAIZ, "fetch", "--quiet", "origin", "main"], capture_output=True, text=True)
        if r.returncode != 0:
            sys.exit("No pude traer origin/main: " + r.stderr.strip())

    texto = crudo(ARCHIVOS["contratos"], a.fresco)
    if texto is None:
        sys.exit("No encuentro " + ARCHIVOS["contratos"])
    try:
        contratos, generado = abrir(texto, frase)
    except Exception:
        sys.exit("La frase de DATA_KEY no abre la base: no es la del equipo, o el archivo está dañado.")
    extra = {}
    for k in ("calificaciones",):
        t = crudo(ARCHIVOS[k], a.fresco)
        try:
            extra[k] = abrir(t, frase)[0] if t else None
        except Exception:
            extra[k] = None

    if a.json:
        json.dump({"generado": generado, "contratos": contratos, "calificaciones": extra["calificaciones"]},
                  sys.stdout, ensure_ascii=False, indent=1)
        print()
        return

    hoy = datetime.date.today()
    if a.buscar:
        palabras = plano(a.buscar).split()
        campos = ("nro", "detalle", "area", "proveedor", "cat", "ac", "carpeta", "codigoProceso")
        n = 0
        for c in contratos:
            if all(p in plano(" ".join(str(c.get(k) or "") for k in campos)) for p in palabras):
                n += 1
                print(f"{c['nro']} · {c.get('cat')} · {c.get('tipo')} · {situacion(c, hoy)} · {que_sigue(c)}")
                print(f"   {str(c.get('detalle') or '')[:110]}")
                print(f"   {c.get('area')} · {c.get('proveedor')} · USD {c.get('montoTotal') or c.get('monto')} · "
                      f"{c.get('inicio')} → {c.get('fin')} · AC {c.get('ac')}")
        print(f"\n{n} contrato(s)")
        return

    activos = [c for c in contratos if not c.get("cerrado")]
    print(f"Base del {generado or 'robot (sin fecha)'} · {len(contratos)} contratos, {len(activos)} activos")
    for titulo, cuenta in (("Situación", Counter(situacion(c, hoy) for c in contratos)),
                           ("Qué sigue (activos)", Counter(que_sigue(c) for c in activos)),
                           ("Categoría (activos)", Counter(c.get("cat") or "—" for c in activos))):
        print(f"\n{titulo}")
        for k, v in cuenta.most_common():
            print(f"   {v:>4}  {k}")
    if extra["calificaciones"] is not None:
        print(f"\nRegistro de Calificaciones: {len(extra['calificaciones'])} fila(s)")


if __name__ == "__main__":
    main()
