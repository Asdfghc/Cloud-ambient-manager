# system_manager.py
import os
import subprocess
import signal

from pathlib import Path


CGROUP_BASE_PATH = "/sys/fs/cgroup/ambient_project"
ACTIVE_PROCESSES = {} # Dicionário para armazenar os processos ativos


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


def update_os_ambient(name: str, cpu_weight: int, cpu_max: int, memory_max: int, memory_swap_max: int, io_max: int):
    init_cgroup_base()
    ambient_path = os.path.join(CGROUP_BASE_PATH, name)

    if not os.path.exists(ambient_path):
        raise RuntimeError("Ambiente não encontrado.")

    write_cgroup_limits(ambient_path, cpu_weight, cpu_max, memory_max, memory_swap_max, io_max)


def delete_os_ambient(name: str):
    ambient_path = os.path.join(CGROUP_BASE_PATH, name)
    if not os.path.exists(ambient_path):
        return
    
    if os.path.exists(f"{ambient_path}/cgroup.kill"):
        with open(f"{ambient_path}/cgroup.kill", "w") as f:
            f.write("1")

    os.rmdir(ambient_path)


def start_os_process(ambient_name: str, program_path: str, process_id: int):

    ambient_path = os.path.join(CGROUP_BASE_PATH, ambient_name)
    if not os.path.exists(ambient_path):
        raise RuntimeError("Ambiente não encontrado.")
    if not Path(program_path).is_file():
        raise RuntimeError("Programa não encontrado.")

    # Define o interpretador do Python para o script
    if Path(program_path).suffix.lower() == ".py":
        program_cmd = ["python3", "-u", program_path]
    elif Path(program_path).suffix.lower() == ".sh":
        program_cmd = ["bash", program_path]
    else:
        program_cmd = [program_path]
    

    # Cria o processo isolado via namespace
    # --pid: cria um novo namespace de PID
    # --fork: cria um novo processo filho
    # --kill-child: garante que o processo filho seja morto quando o processo pai terminar
    # --uts: isola o hostname do ambiente
    # --ipc: isola a comunicação entre processos
    # --mount-proc: monta o /proc do novo namespace
    command = ["unshare", "--pid", "--fork", "--kill-child", "--uts", "--ipc", "--mount-proc", *program_cmd]

    # Cria a pasta de logs caso não exista, e define o arquivo de saída do processo
    log_dir = Path(__file__).parent / "logs"
    log_dir.mkdir(exist_ok=True)
    log_path = log_dir / f"{ambient_name}_{process_id}.log"

    # Coloca o PID dentro do cgroup do ambiente
    def apply_cgroup():
        with open(f"{ambient_path}/cgroup.procs", "w") as f:
            f.write(str(os.getpid()))
            
    # Inicia o processo e redireciona a saída para o arquivo de log
    with open(log_path, "wb") as log_file:
        proc = subprocess.Popen(
            command,
            stdin = subprocess.DEVNULL,
            stdout=log_file,
            stderr=subprocess.STDOUT,
            preexec_fn=apply_cgroup,
            start_new_session=True,
        )

    # Salva o processo em um dicionário para gerenciar os status depois
    ACTIVE_PROCESSES[process_id] = proc
    return proc.pid

def check_os_process_status(process_id: int, pid: int):
    if not pid:
        return "error"

    # Procura no dicionário de processos ativos o processo do ID fornecido
    proc = ACTIVE_PROCESSES.get(process_id)
    if proc is not None:
        # Verifica se o processo ainda está rodando
        if proc.poll() is None:
            return "running"
        
        ACTIVE_PROCESSES.pop(process_id, None) 

        if proc.returncode == 0:
            return "stopped"
        return "error"

    # Se a API reiniciar, o dicionário de processos vai estar vazio. Procura o processo no sistema operacional
    if os.path.exists(f"/proc/{pid}"):
        return "running"
    return "stopped"

def stop_os_process(process_id: int, pid: int):
    if not pid:
        return

    # Manda um sinal de kill para o processo, se ele ainda estiver rodando
    try:
        os.killpg(pid, signal.SIGKILL)
    except ProcessLookupError:
        pass

    # Remove o processo do dicionário de processos ativos
    proc = ACTIVE_PROCESSES.pop(process_id, None)



def read_os_process_log(ambient_name: str, process_id: int):
    log_path = Path(__file__).parent / "logs" / f"{ambient_name}_{process_id}.log"

    # Verifica se o arquivo de log existe
    if not log_path.exists():
        return "Log não encontrado."

    # Retorna o conteúdo do log
    return log_path.read_text(encoding="utf-8", errors="replace")