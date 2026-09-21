# -*- coding: utf-8 -*-
"""
El RUC de una persona natural es su cédula.

Trece dígitos. Los dos primeros son la provincia, el tercero dice qué es el
contribuyente y los tres últimos el establecimiento:

    0603xxxxxx001      tercer dígito 0-5  ->  persona natural
    0660xxxxxx001      tercer dígito 6    ->  entidad pública
    1790xxxxxx001      tercer dígito 9    ->  sociedad

En una sociedad el RUC es dato de registro público: está en la factura, en el
SRI y en el portal de compras públicas. En una persona natural **los diez
primeros dígitos son la cédula**, así que publicarlo es publicar el documento
de identidad de alguien — y la mayoría de los proveedores del FAP son personas
naturales (combustible, mantenimiento, transporte en las áreas).

Por eso el RUC completo se queda en el Excel maestro, que vive en SharePoint
con control de acceso, y lo que sale publicado va por `publicable()`: completo
para sociedades, enmascarado para personas naturales. Los dígitos que quedan a
la vista alcanzan para confirmar que la ficha es de quien uno cree —que es para
lo que la AC la abre— y no para reconstruir la cédula.

La decisión se toma **en el robot, antes de cifrar**: así la cédula no entra
nunca al archivo publicado, ni siquiera dentro del sobre cifrado. Si la frase de
acceso se filtrara algún día, no habría cédulas que filtrar.
"""

MASCARA = "•" * 5   # cinco bolitas: 0603•••••1001


def digitos(valor):
    """Los dígitos del RUC tal como se escribió en el Excel (con guiones, espacios
    o como número: `1790123456001` llega a veces como float)."""
    if valor is None:
        return ""
    if isinstance(valor, float) and valor.is_integer():
        valor = int(valor)
    return "".join(ch for ch in str(valor) if ch.isdigit())


def tipo(valor):
    """«Persona natural», «Sociedad», «Entidad pública» — o None si no es un RUC.

    No inventa: si el número no tiene 13 dígitos devuelve None y el resto del
    sistema lo trata como ficha sin RUC, que es la verdad."""
    d = digitos(valor)
    if len(d) != 13:
        return None
    tercero = d[2]
    if tercero == "6":
        return "Entidad pública"
    if tercero == "9":
        return "Sociedad"
    if tercero in "012345":
        return "Persona natural"
    return None


def es_persona_natural(valor):
    return tipo(valor) == "Persona natural"


def publicable(valor):
    """Lo que puede salir del Excel hacia el archivo publicado.

    Sociedad o entidad pública -> el RUC completo.
    Persona natural           -> `0603•••••1001`, que confirma identidad sin
                                 entregar la cédula.
    Cualquier otra cosa       -> None: un número a medio escribir no se publica
                                 ni enmascarado, porque no se sabe qué es.
    """
    d = digitos(valor)
    t = tipo(d)
    if t is None:
        return None
    if t == "Persona natural":
        return d[:4] + MASCARA + d[-4:]
    return d
