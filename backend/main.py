from fastapi import FastAPI
from fastapi import File, Form, HTTPException, UploadFile
from fastapi.staticfiles import StaticFiles
import MySQLdb
import os
import inspect
from pathlib import Path
from functools import wraps
from threading import RLock
from uuid import uuid4

from system_manager import (validate_ambient_params, create_os_ambient, update_os_ambient, delete_os_ambient)

mydb = MySQLdb.connect(
    host="localhost",
    user="ambient_user",
    password="senha123",
    database="ambient_db"
)

database_lock = RLock()


def database_locked(function):
    if inspect.iscoroutinefunction(function):
        @wraps(function)
        async def async_wrapper(*args, **kwargs):
            with database_lock:
                return await function(*args, **kwargs)

        return async_wrapper

    @wraps(function)
    def wrapper(*args, **kwargs):
        with database_lock:
            return function(*args, **kwargs)

    return wrapper


def database_cursor():
    mydb.ping()
    return mydb.cursor()

app = FastAPI()

# CRUD do ambiente
@app.post("/ambients")
@database_locked
def insert_ambient(name: str, cpu_weight: int, cpu_max: int, memory_max: int, memory_swap_max: int, io_max: int):
    cursor = database_cursor()

    # Validar parâmetros
    clean_name = validate_ambient_params(name, cpu_weight, cpu_max, memory_max, memory_swap_max, io_max)

    # Ver conflito com nome do ambiente
    cursor.execute("SELECT id FROM ambients WHERE name = %s", (clean_name,))
    if cursor.fetchone():
        raise HTTPException(status_code=400, detail="Um ambiente com esse nome já existe.")
    
    # Criar o ambiente no sistema operacional
    try: 
        create_os_ambient(clean_name, cpu_weight, cpu_max, memory_max, memory_swap_max, io_max)

        # Inserir no banco de dados
        insert_query = "INSERT INTO ambients (name, cpu_weight, cpu_max, memory_max, memory_swap_max, io_max) VALUES (%s, %s, %s, %s, %s, %s)"
        cursor.execute(insert_query, (clean_name, cpu_weight, cpu_max, memory_max, memory_swap_max, io_max))
        mydb.commit()
    except Exception:
        # Caso o INSERT falhe mas o cgroup tenha sido criado
        mydb.rollback()
        delete_os_ambient(clean_name)
        raise

@app.get("/ambients")
@database_locked
def select_ambients():
    cursor = database_cursor()
    select_query = "SELECT * FROM ambients"
    cursor.execute(select_query)
    results = cursor.fetchall()
    return results

@app.put("/ambients/{ambient_id}")
@database_locked
def update_ambient(ambient_id: int, name: str, cpu_weight: int, cpu_max: int, memory_max: int, memory_swap_max: int, io_max: int):
    cursor = database_cursor()

    # Validar parâmetros
    clean_name = validate_ambient_params(name, cpu_weight, cpu_max, memory_max, memory_swap_max, io_max)

    # Verificar se o ambiente existe
    cursor.execute("SELECT name FROM ambients WHERE id = %s", (ambient_id,))
    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Ambiente não encontrado.")
    
    old_name = row[0]

    # Verificar se o novo nome já existe em outro ambiente
    cursor.execute("SELECT id FROM ambients WHERE name = %s AND id <> %s", (clean_name, ambient_id))
    if cursor.fetchone():
        raise HTTPException(status_code=400, detail="Um ambiente com esse nome já existe.")

    # Mudar o ambiente no sistema operacional
    update_os_ambient(old_name, clean_name, cpu_weight, cpu_max, memory_max, memory_swap_max, io_max)

    # Atualizar no banco de dados
    update_query = "UPDATE ambients SET name=%s, cpu_weight=%s, cpu_max=%s, memory_max=%s, memory_swap_max=%s, io_max=%s WHERE id=%s"
    cursor.execute(update_query, (clean_name, cpu_weight, cpu_max, memory_max, memory_swap_max, io_max, ambient_id))
    mydb.commit()

    # TODO: caso o banco falhe, precisa reverter as alterações no sistema operacional

@app.delete("/ambients/{ambient_id}")
@database_locked
def delete_ambient(ambient_id: int):
    cursor = database_cursor()

    # Ver se o ambiente existe
    cursor.execute("SELECT name FROM ambients WHERE id = %s", (ambient_id,))
    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Ambiente não encontrado.")
    ambient_name = row[0]

    # Apagar o ambiente e os processos associados no sistema operacional
    try:
        delete_query = "DELETE FROM ambients WHERE id=%s"
        cursor.execute(delete_query, (ambient_id,))

        delete_os_ambient(ambient_name)
        
        mydb.commit()
    except Exception:
        # Caso o DELETE falhe mas o cgroup tenha sido apagado
        mydb.rollback()
        raise

# CRUD do programa
SCRIPTS_DIR = Path(
    os.environ.get(
        "SCRIPTS_DIR",
        str(Path(__file__).resolve().parent / "scripts"),
    )
)
SCRIPTS_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {".py", ".sh"}
@app.post("/programs")
@database_locked
async def insert_program(name: str = Form(...), file: UploadFile = File(...)):
    name = name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="O nome do programa é obrigatório")

    # Validar a extensão recebida
    extension = Path(file.filename or "").suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Tipo de arquivo não permitido"
        )

    # Nome do arquivo vira um identificador
    script_id = uuid4().hex
    destination = SCRIPTS_DIR / f"{script_id}{extension}"

    try:
        # Escrita em blocos
        with destination.open("xb") as output:
            while chunk := await file.read(1024 * 1024):
                output.write(chunk)
    except Exception:
        destination.unlink(missing_ok=True)
        raise
    finally:
        await file.close()

    try:
        cursor = database_cursor()
        insert_query = "INSERT INTO programs (name, path) VALUES (%s, %s)"
        cursor.execute(insert_query, (name, str(destination)))
        mydb.commit()
    except Exception:
        mydb.rollback()
        destination.unlink(missing_ok=True)
        raise

@app.get("/programs")
@database_locked
def select_programs():
    cursor = database_cursor()
    select_query = "SELECT * FROM programs"
    cursor.execute(select_query)
    results = cursor.fetchall()
    return results

@app.put("/programs/{program_id}")
@database_locked
def update_program(name: str, program_id: int):
    # TODO: Validar parâmetros
    # TODO: Ver se o programa existe
    cursor = database_cursor()
    update_query = "UPDATE programs SET name=%s WHERE id=%s"
    cursor.execute(update_query, (name, program_id))
    mydb.commit()

@app.delete("/programs/{program_id}")
@database_locked
def delete_program(program_id: int):
    # TODO: Validar parâmetros
    # TODO: Ver se o programa existe
    cursor = database_cursor()
    select_query = "SELECT path FROM programs WHERE id=%s"
    cursor.execute(select_query, (program_id,))
    result = cursor.fetchone()
    if result:
        program_path = result[0]
        try:
            os.remove(program_path)
        except FileNotFoundError:
            pass  # Se o arquivo não existir, apenas continue
    delete_query = "DELETE FROM programs WHERE id=%s"
    cursor.execute(delete_query, (program_id,))
    mydb.commit()

# CRUD do processo
@app.post("/processes")
@database_locked
def insert_process(programs_id: int, ambients_id: int):
    # TODO: Validar parâmetros
    # TODO: Ver se o programa e o ambiente existem
    # TODO: Criar o processo no sistema operacional
    status = "running" # TODO: Estado inicial
    cursor = database_cursor()
    insert_query = "INSERT INTO processes (programs_id, ambients_id, status) VALUES (%s, %s, %s)"
    cursor.execute(insert_query, (programs_id, ambients_id, status))
    mydb.commit()

@app.get("/processes")
@database_locked
def select_processes():
    cursor = database_cursor()
    select_query = "SELECT * FROM processes"
    cursor.execute(select_query)
    results = cursor.fetchall()
    return results

@app.delete("/processes/{process_id}")
@database_locked
def delete_process(process_id: int):
    # TODO: Validar parâmetros
    # TODO: Ver se o processo existe
    cursor = database_cursor()
    delete_query = "DELETE FROM processes WHERE id=%s"
    cursor.execute(delete_query, (process_id,))
    mydb.commit()

app.mount("/", StaticFiles(directory="../frontend", html=True), name="frontend")
