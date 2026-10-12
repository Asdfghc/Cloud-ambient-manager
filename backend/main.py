from fastapi import FastAPI
from fastapi import File, Form, HTTPException, UploadFile
from fastapi.staticfiles import StaticFiles
import MySQLdb
import os
from pathlib import Path
from uuid import uuid4

mydb = MySQLdb.connect(
    host="localhost",
    user="ambient_user",
    password="senha123",
    database="ambient_db"
)

def database_cursor():
    mydb.ping(True)
    return mydb.cursor()

app = FastAPI()

# CRUD do ambiente
@app.post("/ambients")
def insert_ambient(name: str, cpu_weight: int, cpu_max: int, memory_max: int, memory_swap_max: int, io_max: int):
    # TODO: Validar parâmetros
    # TODO: Ver conflito de ambientes
    # TODO: Criar o ambiente no sistema operacional
    cursor = database_cursor()
    insert_query = "INSERT INTO ambients (name, cpu_weight, cpu_max, memory_max, memory_swap_max, io_max) VALUES (%s, %s, %s, %s, %s, %s)"
    cursor.execute(insert_query, (name, cpu_weight, cpu_max, memory_max, memory_swap_max, io_max))
    mydb.commit()

@app.get("/ambients")
def select_ambients():
    cursor = database_cursor()
    select_query = "SELECT * FROM ambients"
    cursor.execute(select_query)
    results = cursor.fetchall()
    return results

@app.put("/ambients/{ambient_id}")
def update_ambient(ambient_id: int, name: str, cpu_weight: int, cpu_max: int, memory_max: int, memory_swap_max: int, io_max: int):
    # TODO: Validar parâmetros
    # TODO: Ver conflito de ambientes
    # TODO: Mudar o ambiente no sistema operacional
    cursor = database_cursor()
    update_query = "UPDATE ambients SET name=%s, cpu_weight=%s, cpu_max=%s, memory_max=%s, memory_swap_max=%s, io_max=%s WHERE id=%s"
    cursor.execute(update_query, (name, cpu_weight, cpu_max, memory_max, memory_swap_max, io_max, ambient_id))
    mydb.commit()

@app.delete("/ambients/{ambient_id}")
def delete_ambient(ambient_id: int):
    # TODO: Validar parâmetros
    # TODO: Ver se o ambiente existe
    # TODO: Apagar o ambiente no sistema operacional
    cursor = database_cursor()
    delete_query = "DELETE FROM ambients WHERE id=%s"
    cursor.execute(delete_query, (ambient_id,))
    mydb.commit()

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
def select_programs():
    cursor = database_cursor()
    select_query = "SELECT * FROM programs"
    cursor.execute(select_query)
    results = cursor.fetchall()
    return results

@app.put("/programs/{program_id}")
def update_program(name: str, program_id: int):
    # TODO: Validar parâmetros
    # TODO: Ver se o programa existe
    cursor = database_cursor()
    update_query = "UPDATE programs SET name=%s WHERE id=%s"
    cursor.execute(update_query, (name, program_id))
    mydb.commit()

@app.delete("/programs/{program_id}")
def delete_program(program_id: int):
    # TODO: Validar parâmetros
    # TODO: Ver se o programa existe
    cursor = database_cursor()
    delete_query = "DELETE FROM programs WHERE id=%s"
    cursor.execute(delete_query, (program_id,))
    mydb.commit()

app.mount("/", StaticFiles(directory="../frontend", html=True), name="frontend")
