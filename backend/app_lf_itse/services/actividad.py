"""
Servicios de negocio para Actividad.

Centraliza la lógica del dominio separándola de la capa HTTP (views/serializers),
lo que facilita reutilización, pruebas unitarias y futuros cambios.
"""

from ..models import Actividad


def listar_actividades() -> list[Actividad]:
    """
    Retorna todas las actividades ordenadas por id.

    Retorna
    -------
    list[Actividad]
        Registros de la tabla ``actividades`` ordenados por id.
    """
    return list(Actividad.objects.all().order_by('id'))
