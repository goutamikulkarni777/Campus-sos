-- Campus Emergency SOS & Alert System
-- MySQL schema (production reference). The app itself runs on SQLite
-- locally (see database.py) for zero-setup development; use this schema
-- when deploying against a real MySQL instance.

CREATE DATABASE IF NOT EXISTS campus_sos;
USE campus_sos;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    role ENUM('student', 'security') NOT NULL,
    contact VARCHAR(120),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS incidents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_name VARCHAR(120) NOT NULL,
    alert_type ENUM('sos', 'fire', 'medical', 'lockdown', 'other') NOT NULL,
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6),
    status ENUM('active', 'acknowledged', 'resolved') NOT NULL DEFAULT 'active',
    notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME NULL,
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
);

CREATE TABLE IF NOT EXISTS broadcasts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    alert_type ENUM('fire', 'lockdown', 'medical', 'general') NOT NULL,
    message VARCHAR(500) NOT NULL,
    created_by VARCHAR(120),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
