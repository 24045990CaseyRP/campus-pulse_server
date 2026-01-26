-- Database Schema for Campus Pulse
-- Use this script to initialize your database

CREATE DATABASE IF NOT EXISTS campus_pulse;
USE campus_pulse;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL, -- Will store hashed passwords
    role ENUM('student', 'admin', 'ig_rep') DEFAULT 'student',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pings Table (The main feed items)
CREATE TABLE IF NOT EXISTS pings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    content TEXT NOT NULL, -- e.g., "Free food at the atrium!"
    category ENUM('Food', 'Event', 'Study', 'Alert', 'Other') DEFAULT 'Other',
    location_name VARCHAR(255), -- e.g., "The Atrium", "Library Lvl 3"
    image_data LONGBLOB, -- Store image directly in DB (Max 4GB)
    upvotes INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE, -- To hide old/irrelevant pings
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Upvotes/Interactions Table (To track who voted and prevent spamming votes)
CREATE TABLE IF NOT EXISTS ping_votes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    ping_id INT NOT NULL,
    vote_type TINYINT DEFAULT 1, -- 1 for Upvote
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_vote (user_id, ping_id), -- Ensure one vote per user per ping
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (ping_id) REFERENCES pings(id) ON DELETE CASCADE
);

-- Comments Table
CREATE TABLE IF NOT EXISTS comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    ping_id INT NOT NULL,
    content TEXT NOT NULL,
    image_data LONGBLOB, -- Allow users to upload images in comments
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (ping_id) REFERENCES pings(id) ON DELETE CASCADE
);
