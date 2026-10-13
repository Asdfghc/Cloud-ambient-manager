# system_manager.py
import os
import re
from fastapi import HTTPException


CGROUP_BASE_PATH = "/sys/fs/cgroup/ambient_project"

def validate_ambient_params(name: str, cpu_weight: int, cpu_max: int, memory_max: int, memory_swap_max: int, io_max: int):

    #Validação do Nome 
    name_clean = name.strip()
    if not name_clean or not re.match(r"^[a-zA-Z0-9_-]+$", name_clean):
        raise HTTPException(
            status_code=400,
            detail="O nome do ambiente deve conter apenas letras, números, hífen e underline (sem espaços ou caracteres especiais)."
        )

    #Validação do cpu_weight
    if not (1 <= cpu_weight <= 10000):
        raise HTTPException(
            status_code=400,
            detail="O prioridade de CPU deve estar entre 1 e 10000."
        )

    #Validação do cpu_max
    if not (1 <= cpu_max <= 100):
        raise HTTPException(
            status_code=400,
            detail="O maximo de uso de CPU deve estar entre 1 e 100%."
        )

    #Validação do memory_max 
    if memory_max < 16:
        raise HTTPException(
            status_code=400,
            detail="A memoria maxima deve ser de no mínimo 16 MB."
        )

    #Validação do memory_swap_max
    if memory_swap_max < 0:
        raise HTTPException(
            status_code=400,
            detail="A memoria swap maxima não pode ser negativa."
        )

    #Validação do io_max
    if io_max < 1:
        raise HTTPException(
            status_code=400,
            detail="O limite de I/O deve ser de no mínimo 1 MB/s."
        )

    return name_clean