#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ningún secreto vuelve a entrar al repositorio.

En septiembre de 2026 GitGuardian avisó de lo que ya estaba publicado: cuatro
URLs de disparadores de Power Automate con su firma `sig=` dentro de los HTML.
El sitio es público y estático, así que esa firma —la única llave del flujo—
estaba a la vista de cualquiera, y quedó en el historial de git para siempre.

Lo grave no fue el descuido sino que **nada lo detectaba**: una URL firmada es
una cadena como cualquier otra, y ni las pruebas ni las revisiones miraban por
ahí. Esto es ese detector. Se corre solo en cada push (.github/workflows) y
también a mano:

    python3 scripts/revisar_secretos.py              todo el repositorio
    python3 scripts/revisar_secretos.py <archivo…>   solo lo que se le diga

Sale con código 1 si encuentra algo, para poder colgarlo de un workflow.

Qué NO hace: no descifra ni revisa el historial. Lo ya publicado no se arregla
borrándolo —está copiado fuera—, se arregla rotando la firma en Power Automate.
"""

import os
import re
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Carpetas que no son nuestras o que no tiene sentido revisar.
IGNORAR_DIR = {'.git', 'node_modules', '__pycache__', 'vendor', 'esquemas'}

# Extensiones de texto. Un .docx es un zip: no se revisa como texto.
EXTENSIONES = {'.html', '.js', '.py', '.json', '.md', '.yml', '.yaml', '.txt', '.css'}

# Cada regla: (nombre, expresión, explicación de qué hacer).
REGLAS = [
    ('URL de Power Automate con firma',
     re.compile(r'https://[^\s\'"<>]*(?:powerplatform\.com|logic\.azure\.com|'
                r'azure-apihub\.net)[^\s\'"<>]*[?&]sig=[A-Za-z0-9_%-]{16,}'),
     'La firma es la única llave del flujo. Va en el navegador de cada '
     'administradora (localStorage), nunca en el código. Ver README.'),

    ('Firma SAS suelta',
     re.compile(r'[?&]sig=[A-Za-z0-9_%-]{24,}'),
     'Parece una firma de acceso compartido. No se guarda en el repositorio.'),

    ('Clave de API o token',
     re.compile(r'(?i)\b(?:api[_-]?key|secret|passphrase|client[_-]?secret)\b'
                r'\s*[:=]\s*[\'"][^\'"\s]{12,}[\'"]'),
     'Los secretos van en Settings → Secrets and variables → Actions.'),

    ('Token de GitHub',
     re.compile(r'\b(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,}'),
     'Revócalo en GitHub ahora mismo y vuelve a emitirlo.'),

    ('Token de Slack',
     re.compile(r'\bxox[baprs]-[A-Za-z0-9-]{10,}'),
     'Revócalo en Slack ahora mismo.'),

    ('Clave de acceso de AWS',
     re.compile(r'\b(?:AKIA|ASIA)[0-9A-Z]{16}\b'),
     'Desactívala en IAM ahora mismo.'),

    ('Clave privada',
     re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH |PGP |DSA )?PRIVATE KEY-----'),
     'Una clave privada no se publica nunca. Genera otra.'),

    ('Datos de contratos en claro',
     re.compile(r'"fap_enc"\s*:\s*0'),
     'El export del CRM se publica cifrado (AES-256-GCM). Ver '
     'scripts/actualizar_datos.py.'),
]

# Lo que es a propósito y no es un secreto: el marcador de posición del diálogo
# que pide la URL, y los ejemplos de la documentación.
PERMITIDO = re.compile(r'sig=(?:…|\.\.\.|<|\{|xxx|zzz|y\b|TU_FIRMA|FIRMA)')


def archivos(argv):
    if argv:
        for a in argv:
            if os.path.isdir(a):
                for r in recorrer(a):
                    yield r
            else:
                yield a
        return
    for r in recorrer(RAIZ):
        yield r


def corto(ruta):
    """Ruta relativa al repositorio; absoluta si se revisó algo de fuera."""
    ruta = os.path.abspath(ruta)
    return os.path.relpath(ruta, RAIZ) if ruta.startswith(RAIZ + os.sep) else ruta


def recorrer(base):
    for carpeta, dirs, files in os.walk(base):
        dirs[:] = [d for d in dirs if d not in IGNORAR_DIR]
        for f in files:
            if os.path.splitext(f)[1].lower() in EXTENSIONES:
                yield os.path.join(carpeta, f)


def main():
    yo = os.path.abspath(__file__)
    hallazgos = []
    revisados = 0

    for ruta in archivos(sys.argv[1:]):
        # Este archivo lleva las expresiones dentro: se encontraría a sí mismo.
        if os.path.abspath(ruta) == yo:
            continue
        try:
            with open(ruta, encoding='utf-8', errors='replace') as fh:
                lineas = fh.read().splitlines()
        except OSError:
            continue
        revisados += 1
        for n, linea in enumerate(lineas, 1):
            for nombre, patron, consejo in REGLAS:
                m = patron.search(linea)
                if not m or PERMITIDO.search(m.group(0)):
                    continue
                hallazgos.append((corto(ruta), n, nombre, m.group(0), consejo))
                break   # una línea, un aviso: el primero ya la condena

    if not hallazgos:
        print('✓ %d archivos revisados: ningún secreto en el repositorio' % revisados)
        return 0

    print('✗ %d posible(s) secreto(s) en el repositorio:\n' % len(hallazgos))
    for rel, n, nombre, trozo, consejo in hallazgos:
        if len(trozo) > 90:
            trozo = trozo[:60] + '…' + trozo[-12:]
        print('  %s:%d' % (rel, n))
        print('    %s: %s' % (nombre, trozo))
        print('    %s\n' % consejo)
    print('Quítalo del archivo Y rota la credencial: lo que se subió una vez ya')
    print('está copiado fuera, borrarlo del código no lo vuelve secreto.')
    return 1


if __name__ == '__main__':
    sys.exit(main())
