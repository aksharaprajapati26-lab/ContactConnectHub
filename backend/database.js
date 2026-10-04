const sqlite3 = require("sqlite3").verbose();
const path = require("path");

// SQLite database file
const dbPath = path.join(__dirname, "contacthub.db");

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Database connection failed:", err.message);
    } else {
        console.log("SQLite database connected.");
    }
});

db.serialize(() => {

    // =========================
    // CONTACTS
    // =========================

    db.run(`
        CREATE TABLE IF NOT EXISTS contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            category TEXT NOT NULL,
            email TEXT,
            company TEXT,
            job_title TEXT,
            address TEXT,
            notes TEXT,
            birthday TEXT,
            website TEXT,
            instagram TEXT,
            linkedin TEXT,
            whatsapp TEXT,
            tags TEXT NOT NULL DEFAULT '[]',
            favorite INTEGER DEFAULT 0,
            relationship_score INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) {
            console.error("Contacts table error:", err.message);
        }
    });


    // =========================
    // PROFILE
    // =========================

    db.run(`
        CREATE TABLE IF NOT EXISTS profile (
            id INTEGER PRIMARY KEY,
            name TEXT,
            phone TEXT,
            email TEXT,
            category TEXT DEFAULT 'Personal',
            company TEXT,
            job_title TEXT,
            address TEXT,
            website TEXT,
            instagram TEXT,
            linkedin TEXT,
            whatsapp TEXT,
            bio TEXT
        )
    `, (err) => {
        if (err) {
            console.error("Profile table error:", err.message);
        }
    });


    // =========================
    // REMINDERS
    // =========================

    db.run(`
        CREATE TABLE IF NOT EXISTS reminders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            contact_id INTEGER,
            title TEXT NOT NULL,
            reminder_date TEXT NOT NULL,
            reminder_time TEXT,
            notes TEXT,
            completed INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(contact_id)
                REFERENCES contacts(id)
                ON DELETE CASCADE
        )
    `, (err) => {
        if (err) {
            console.error("Reminders table error:", err.message);
        }
    });


    // =========================
    // INTERACTIONS
    // =========================

    db.run(`
        CREATE TABLE IF NOT EXISTS interactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            contact_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            description TEXT,
            interaction_date TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(contact_id)
                REFERENCES contacts(id)
                ON DELETE CASCADE
        )
    `, (err) => {
        if (err) {
            console.error("Interactions table error:", err.message);
        }
    });


    // =========================
    // GROUPS
    // =========================

    db.run(`
        CREATE TABLE IF NOT EXISTS groups_table (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        )
    `, (err) => {
        if (err) {
            console.error("Groups table error:", err.message);
        }
    });


    // =========================
    // CONTACT-GROUP RELATION
    // =========================

    db.run(`
        CREATE TABLE IF NOT EXISTS contact_groups (
            contact_id INTEGER,
            group_id INTEGER,
            PRIMARY KEY(contact_id, group_id),
            FOREIGN KEY(contact_id)
                REFERENCES contacts(id)
                ON DELETE CASCADE,
            FOREIGN KEY(group_id)
                REFERENCES groups_table(id)
                ON DELETE CASCADE
        )
    `, (err) => {
        if (err) {
            console.error("Contact-groups table error:", err.message);
        }
    });


    console.log("Database tables ready.");
});

module.exports = db;
