sudo apt update
sudo apt install python3 python3-fastapi python3-multipart python3-mysqldb uvicorn mysql-server python3-multipart
(rodar o init.sql)

cd backend
uvicorn main:app --reload