import re

from fastapi import HTTPException


def validate_ambient_params(
    name: str,
    cpu_weight: int,
    cpu_max: int,
    memory_max: int,
    memory_swap_max: int,
    io_max: int,
):
    name_clean = name.strip()
    if not name_clean or not re.match(r"^[a-zA-Z0-9_-]+$", name_clean):
        raise HTTPException(
            status_code=400,
            detail="O nome do ambiente deve conter apenas letras, números, hífen e underline (sem espaços ou caracteres especiais).",
        )

    if not (1 <= cpu_weight <= 10000):
        raise HTTPException(
            status_code=400,
            detail="O prioridade de CPU deve estar entre 1 e 10000.",
        )

    if not (1 <= cpu_max <= 100):
        raise HTTPException(
            status_code=400,
            detail="O maximo de uso de CPU deve estar entre 1 e 100%.",
        )

    if memory_max < 16 or memory_max > 4096:
        raise HTTPException(
            status_code=400,
            detail="A memoria maxima deve ser entre 16 MB e 4096 MB.",
        )

    if memory_swap_max < 0:
        raise HTTPException(
            status_code=400,
            detail="A memoria swap maxima não pode ser negativa.",
        )

    if io_max < 1:
        raise HTTPException(
            status_code=400,
            detail="O limite de I/O deve ser de no mínimo 1 MB/s.",
        )

    return name_clean
