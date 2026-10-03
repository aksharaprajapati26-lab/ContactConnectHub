const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "contacthub.db");

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Database connection failed:", err.message);
    } else {
        console.log("SQLite database connected.");
    }
});

db.serialize(() => {

    // CONTACTS
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
    `);

    db.run(
        "ALTER TABLE contacts ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'",
        (err) => {
            if (err && !err.message.includes("duplicate column name: tags")) {
                console.error("Contacts tags migration failed:", err.message);
            }
        }
    );

    // PROFILE
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
    `);

    db.run(
        "ALTER TABLE profile ADD COLUMN category TEXT DEFAULT 'Personal'",
        (err) => {
            if (err && !err.message.includes("duplicate column name: category")) {
                console.error("Profile category migration failed:", err.message);
            }
        }
    );

    // REMINDERS
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
            FOREIGN KEY(contact_id) REFERENCES contacts(id) ON DELETE CASCADE
        )
    `);

    // INTERACTIONS
    db.run(`
        CREATE TABLE IF NOT EXISTS interactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            contact_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            description TEXT,
            interaction_date TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(contact_id) REFERENCES contacts(id) ON DELETE CASCADE
        )
    `);

    // GROUPS
    db.run(`
        CREATE TABLE IF NOT EXISTS groups_table (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        )
    `);

    // CONTACT-GROUP RELATION
    db.run(`
        CREATE TABLE IF NOT EXISTS contact_groups (
            contact_id INTEGER,
            group_id INTEGER,
            PRIMARY KEY(contact_id, group_id),
            FOREIGN KEY(contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
            FOREIGN KEY(group_id) REFERENCES groups_table(id) ON DELETE CASCADE
        )
    `);

    console.log("Database tables ready.");
});

module.exports = db;