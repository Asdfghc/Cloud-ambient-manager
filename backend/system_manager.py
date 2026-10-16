# system_manager.py
import os
import re

from pathlib import Path
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


def init_cgroup_base():
    os.makedirs(CGROUP_BASE_PATH, exist_ok=True)
    for path in ["/sys/fs/cgroup/cgroup.subtree_control", f"{CGROUP_BASE_PATH}/cgroup.subtree_control"]:
        if os.path.exists(path):
            for controller in ["+cpu", "+memory", "+io"]:
                try:
                    with open(path, "w") as f:
                        f.write(controller)
                except OSError as error:
                    raise RuntimeError(f"Erro ao habilitar {controller} em {path}: {error}") from error


def write_cgroup_limits(ambient_path: str, cpu_weight: int, cpu_max: int, memory_max: int, memory_swap_max: int, io_max: int):
    
    # Peso de CPU
    with open(f"{ambient_path}/cpu.weight", "w") as f:
        f.write(str(cpu_weight))

    # Limite de CPU
    with open(f"{ambient_path}/cpu.max", "w") as f:
        f.write(f"{cpu_max * 1000} 100000")

    # Limite de memória RAM
    with open(f"{ambient_path}/memory.max", "w") as f:
        f.write(f"{memory_max * 1024 * 1024}")

    # Limite de memória swap
    if os.path.exists(f"{ambient_path}/memory.swap.max"):
        with open(f"{ambient_path}/memory.swap.max", "w") as f:
            f.write(str(memory_swap_max * 1024 * 1024))

    # Limite de I/O de disco
    io_bytes = io_max * 1024 * 1024
    with open(f"{ambient_path}/io.max", "w") as f:
        f.write(f"8:0 rbps={io_bytes} wbps={io_bytes}\n") # implementar de forma dinâmica para pegar o major:minor do disco


def create_os_ambient(name: str, cpu_weight: int, cpu_max: int, memory_max: int, memory_swap_max: int, io_max: int):
    init_cgroup_base()
    ambient_path = os.path.join(CGROUP_BASE_PATH, name)
    os.makedirs(ambient_path, exist_ok=True)
    write_cgroup_limits(ambient_path, cpu_weight, cpu_max, memory_max, memory_swap_max, io_max)


def update_os_ambient(old_name: str, new_name: str, cpu_weight: int, cpu_max: int, memory_max: int, memory_swap_max: int, io_max: int):
    init_cgroup_base()
    old_ambient_path = os.path.join(CGROUP_BASE_PATH, old_name)
    new_ambient_path = os.path.join(CGROUP_BASE_PATH, new_name)

    if not os.path.exists(old_ambient_path):
        raise RuntimeError("Ambiente não encontrado.")

    if old_name != new_name:
        if os.path.exists(new_ambient_path):
            raise RuntimeError("Um ambiente com o mesmo nome já existe .")
        
        os.rename(old_ambient_path, new_ambient_path)

    write_cgroup_limits(new_ambient_path, cpu_weight, cpu_max, memory_max, memory_swap_max, io_max)


def delete_os_ambient(name: str):
    ambient_path = os.path.join(CGROUP_BASE_PATH, name)
    if not os.path.exists(ambient_path):
        return
    
    if os.path.exists(f"{ambient_path}/cgroup.kill"):
        with open(f"{ambient_path}/cgroup.kill", "w") as f:
            f.write("1")

    os.rmdir(ambient_path)
        