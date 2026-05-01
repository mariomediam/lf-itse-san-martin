"""
Servicios de negocio para Inspector.

Centraliza la lógica del dominio separándola de la capa HTTP (views/serializers),
lo que facilita reutilización, pruebas unitarias y futuros cambios.
"""

from django.db.models import Value
from django.db.models.functions import Concat, Upper
from django.shortcuts import get_object_or_404

from ..models import Inspector


def buscar_inspectores(busqueda: str | None = None) -> list[Inspector]:
    """
    Retorna inspectores filtrando por nombre completo (apellido paterno +
    apellido materno + nombres), insensible a mayúsculas y minúsculas.

    Parámetros
    ----------
    busqueda : str | None
        Texto libre que se busca en la concatenación de apellido paterno,
        apellido materno y nombres.
        Si es ``None`` o cadena vacía se devuelven todos los registros.

    Retorna
    -------
    list[Inspector]
        Registros que cumplen el criterio, ordenados por apellido paterno,
        apellido materno y nombres.
    """
    qs = Inspector.objects.annotate(
        nombre_completo=Concat(
            'apellido_paterno', Value(' '),
            'apellido_materno', Value(' '),
            'nombres',
        )
    )

    if busqueda and busqueda.strip():
        qs = qs.filter(nombre_completo__icontains=busqueda.strip())

    return list(qs.order_by('apellido_paterno', 'apellido_materno', 'nombres'))


def listar_inspectores() -> list[Inspector]:
    """Retorna todos los inspectores ordenados por apellido paterno y nombres."""
    return list(Inspector.objects.all().order_by('apellido_paterno', 'apellido_materno', 'nombres'))


def obtener_inspector(pk: int) -> Inspector:
    """Retorna el Inspector con la PK indicada. Lanza HTTP 404 si no existe."""
    return get_object_or_404(Inspector, pk=pk)


def crear_inspector(data: dict, usuario) -> Inspector:
    """
    Crea un Inspector con los datos validados.

    Parámetros
    ----------
    data    : dict  — datos validados por InspectorWriteSerializer
    usuario : AUTH_USER_MODEL instance

    Retorna
    -------
    Inspector
        Instancia recién creada.
    """
    return Inspector.objects.create(
        **data,
        usuario=usuario,
    )


def actualizar_inspector(pk: int, data: dict) -> Inspector:
    """
    Actualiza los campos de un Inspector.

    Parámetros
    ----------
    pk   : int   — clave primaria del inspector a actualizar
    data : dict  — datos validados por InspectorWriteSerializer

    Retorna
    -------
    Inspector
        Instancia actualizada.
    """
    inspector = get_object_or_404(Inspector, pk=pk)
    for campo, valor in data.items():
        setattr(inspector, campo, valor)
    inspector.save()
    return inspector


def eliminar_inspector(pk: int) -> None:
    """
    Elimina físicamente el Inspector indicado.
    Lanza HTTP 404 si no existe.
    Lanza ProtectedError si está asignado a certificados ITSE.
    """
    inspector = get_object_or_404(Inspector, pk=pk)
    inspector.delete()
