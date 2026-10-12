from fastapi import FastAPI
from fastapi import File, HTTPException, UploadFile
from fastapi.staticfiles import StaticFiles
import MySQLdb
from pathlib import Path
from uuid import uuid4

mydb = MySQLdb.connect(
    host="localhost",
    user="ambient_user",
    password="senha123",
    database="ambient_db"
)
cursor = mydb.cursor()

app = FastAPI()

# CRUD do ambiente
@app.post("/ambients")
def insert_ambient(name: str, cpu_weight: int, cpu_max: int, memory_max: int, memory_swap_max: int, io_max: int):
    insert_query = "INSERT INTO ambients (name, cpu_weight, cpu_max, memory_max, memory_swap_max, io_max) VALUES (%s, %s, %s, %s, %s, %s)"
    cursor.execute(insert_query, (name, cpu_weight, cpu_max, memory_max, memory_swap_max, io_max))
    mydb.commit()

@app.get("/ambients")
def select_ambients():
    select_query = "SELECT * FROM ambients"
    cursor.execute(select_query)
    results = cursor.fetchall()
    return results

@app.put("/ambients/{ambient_id}")
def update_ambient(ambient_id: int, name: str, cpu_weight: int, cpu_max: int, memory_max: int, memory_swap_max: int, io_max: int):
    update_query = "UPDATE ambients SET name=%s, cpu_weight=%s, cpu_max=%s, memory_max=%s, memory_swap_max=%s, io_max=%s WHERE id=%s"
    cursor.execute(update_query, (name, cpu_weight, cpu_max, memory_max, memory_swap_max, io_max, ambient_id))
    mydb.commit()

@app.delete("/ambients/{ambient_id}")
def delete_ambient(ambient_id: int):
    delete_query = "DELETE FROM ambients WHERE id=%s"
    cursor.execute(delete_query, (ambient_id,))
    mydb.commit()

app.mount("/", StaticFiles(directory="../frontend", html=True), name="frontend")
