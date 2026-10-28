CREATE DATABASE IF NOT EXISTS ambient_db;
USE ambient_db;

CREATE USER IF NOT EXISTS 'ambient_user'@'%' IDENTIFIED BY 'senha123';
GRANT ALL PRIVILEGES ON ambient_db.* TO 'ambient_user'@'%';
FLUSH PRIVILEGES;

CREATE TABLE IF NOT EXISTS ambients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    cpu_weight SMALLINT UNSIGNED NOT NULL,
    cpu_max INT UNSIGNED NOT NULL,
    memory_max INT UNSIGNED NOT NULL,
    memory_swap_max INT UNSIGNED NOT NULL,
    io_max INT UNSIGNED NOT NULL);

CREATE TABLE IF NOT EXISTS programs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    path VARCHAR(255) NOT NULL);

CREATE TABLE IF NOT EXISTS processes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    programs_id INT NOT NULL,
    ambients_id INT NOT NULL,
    status ENUM('running', 'paused', 'stopped', 'error') NOT NULL,
    pid INT,
    FOREIGN KEY (programs_id) REFERENCES programs(id),
    FOREIGN KEY (ambients_id) REFERENCES ambients(id) ON DELETE CASCADE);