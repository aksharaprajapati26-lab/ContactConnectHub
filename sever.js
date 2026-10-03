require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const db = require("./database");

const app = express();
const PORT = 4000;

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function serializeTags(tags) {
    const values = Array.isArray(tags)
        ? tags
        : String(tags || "").split(",");

    return JSON.stringify(
        [...new Set(values.map((tag) => String(tag).trim()).filter(Boolean))]
    );
}


// =====================================================
// FRONTEND
// =====================================================

// Actual project structure:
//
// ContactConnectHubProject
// ├── backend
// │   ├── server.js
// │   └── database.js
// │
// └── frontend
//     ├── index.html
//     ├── app.js
//     └── qr.png

const frontendPath = path.join(__dirname, "..", "frontend");

// Serve frontend files
app.use(express.static(frontendPath));


// Open frontend index.html
app.get("/", (req, res) => {
    res.sendFile(
        path.join(frontendPath, "index.html"),
        (err) => {
            if (err) {
                console.error(
                    "Frontend loading error:",
                    err
                );

                res.status(500).send(
                    "Frontend index.html could not be loaded."
                );
            }
        }
    );
});


// =====================================================
// API HOME
// =====================================================

app.get("/api", (req, res) => {
    res.json({
        success: true,
        message: "Contact Connect Hub API is running",
        version: "1.0.0"
    });
});


// =====================================================
// CONTACTS
// =====================================================

// GET ALL CONTACTS

app.get("/api/contacts", (req, res) => {

    const search =
        req.query.search || "";

    const category =
        req.query.category || "";

    let sql = `
        SELECT *
        FROM contacts
        WHERE 1 = 1
    `;

    const params = [];

    if (search) {

        sql += `
            AND (
                name LIKE ?
                OR phone LIKE ?
                OR email LIKE ?
                OR company LIKE ?
            )
        `;

        const value = `%${search}%`;

        params.push(
            value,
            value,
            value,
            value
        );
    }

    if (category) {

        sql += `
            AND category = ?
        `;

        params.push(category);
    }

    sql += `
        ORDER BY name COLLATE NOCASE ASC
    `;

    db.all(
        sql,
        params,
        (err, rows) => {

            if (err) {

                console.error(
                    "GET contacts error:",
                    err
                );

                return res.status(500).json({
                    success: false,
                    error:
                        "Failed to fetch contacts"
                });
            }

            res.json({
                success: true,
                contacts: rows || []
            });
        }
    );
});


// =====================================================
// GET SINGLE CONTACT
// =====================================================

app.get(
    "/api/contacts/:id",
    (req, res) => {

        const id =
            req.params.id;

        db.get(
            `
            SELECT *
            FROM contacts
            WHERE id = ?
            `,
            [id],
            (err, row) => {

                if (err) {

                    console.error(
                        "GET contact error:",
                        err
                    );

                    return res.status(500).json({
                        success: false,
                        error:
                            "Database error"
                    });
                }

                if (!row) {

                    return res.status(404).json({
                        success: false,
                        error:
                            "Contact not found"
                    });
                }

                res.json({
                    success: true,
                    contact: row
                });
            }
        );
    }
);


// =====================================================
// ADD CONTACT
// =====================================================

app.post(
    "/api/contacts",
    (req, res) => {

        const {
            name,
            phone,
            category,
            email,
            company,
            job_title,
            address,
            notes,
            birthday,
            website,
            instagram,
            linkedin,
            whatsapp,
            tags,
            favorite
        } = req.body;

        // Required fields

        if (
            !name ||
            !phone ||
            !category
        ) {

            return res.status(400).json({
                success: false,
                error:
                    "Name, phone and category are required"
            });
        }

        const sql = `
            INSERT INTO contacts (
                name,
                phone,
                category,
                email,
                company,
                job_title,
                address,
                notes,
                birthday,
                website,
                instagram,
                linkedin,
                whatsapp,
                tags,
                favorite
            )
            VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?
            )
        `;

        const values = [
            name.trim(),
            phone.trim(),
            category.trim(),
            email || "",
            company || "",
            job_title || "",
            address || "",
            notes || "",
            birthday || "",
            website || "",
            instagram || "",
            linkedin || "",
            whatsapp || "",
            serializeTags(tags),
            favorite ? 1 : 0
        ];

        db.run(
            sql,
            values,
            function (err) {

                if (err) {

                    console.error(
                        "ADD contact error:",
                        err
                    );

                    return res.status(500).json({
                        success: false,
                        error:
                            "Failed to add contact"
                    });
                }

                const newId =
                    this.lastID;

                db.get(
                    `
                    SELECT *
                    FROM contacts
                    WHERE id = ?
                    `,
                    [newId],
                    (err, contact) => {

                        if (err) {

                            console.error(
                                "Retrieve new contact error:",
                                err
                            );

                            return res.status(500).json({
                                success: false,
                                error:
                                    "Contact created but could not be retrieved"
                            });
                        }

                        res.status(201).json({
                            success: true,
                            message:
                                "Contact added successfully",
                            contact
                        });
                    }
                );
            }
        );
    }
);


// =====================================================
// UPDATE CONTACT
// =====================================================

app.put(
    "/api/contacts/:id",
    (req, res) => {

        const id =
            req.params.id;

        const {
            name,
            phone,
            category,
            email,
            company,
            job_title,
            address,
            notes,
            birthday,
            website,
            instagram,
            linkedin,
            whatsapp,
            tags,
            favorite
        } = req.body;

        if (
            !name ||
            !phone ||
            !category
        ) {

            return res.status(400).json({
                success: false,
                error:
                    "Name, phone and category are required"
            });
        }

        const sql = `
            UPDATE contacts
            SET
                name = ?,
                phone = ?,
                category = ?,
                email = ?,
                company = ?,
                job_title = ?,
                address = ?,
                notes = ?,
                birthday = ?,
                website = ?,
                instagram = ?,
                linkedin = ?,
                whatsapp = ?,
                tags = ?,
                favorite = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;

        const values = [
            name.trim(),
            phone.trim(),
            category.trim(),
            email || "",
            company || "",
            job_title || "",
            address || "",
            notes || "",
            birthday || "",
            website || "",
            instagram || "",
            linkedin || "",
            whatsapp || "",
            serializeTags(tags),
            favorite ? 1 : 0,
            id
        ];

        db.run(
            sql,
            values,
            function (err) {

                if (err) {

                    console.error(
                        "UPDATE contact error:",
                        err
                    );

                    return res.status(500).json({
                        success: false,
                        error:
                            "Failed to update contact"
                    });
                }

                if (this.changes === 0) {

                    return res.status(404).json({
                        success: false,
                        error:
                            "Contact not found"
                    });
                }

                db.get(
                    `
                    SELECT *
                    FROM contacts
                    WHERE id = ?
                    `,
                    [id],
                    (err, contact) => {

                        if (err) {

                            return res.status(500).json({
                                success: false,
                                error:
                                    "Contact updated but could not be retrieved"
                            });
                        }

                        res.json({
                            success: true,
                            message:
                                "Contact updated successfully",
                            contact
                        });
                    }
                );
            }
        );
    }
);


// =====================================================
// DELETE CONTACT
// =====================================================

app.delete(
    "/api/contacts/:id",
    (req, res) => {

        const id =
            req.params.id;

        db.run(
            `
            DELETE FROM contacts
            WHERE id = ?
            `,
            [id],
            function (err) {

                if (err) {

                    console.error(
                        "DELETE contact error:",
                        err
                    );

                    return res.status(500).json({
                        success: false,
                        error:
                            "Failed to delete contact"
                    });
                }

                if (this.changes === 0) {

                    return res.status(404).json({
                        success: false,
                        error:
                            "Contact not found"
                    });
                }

                res.json({
                    success: true,
                    message:
                        "Contact deleted successfully"
                });
            }
        );
    }
);


// =====================================================
// TOGGLE FAVORITE
// =====================================================

app.patch(
    "/api/contacts/:id/favorite",
    (req, res) => {

        const id =
            req.params.id;

        db.get(
            `
            SELECT favorite
            FROM contacts
            WHERE id = ?
            `,
            [id],
            (err, contact) => {

                if (err) {

                    console.error(
                        "Favorite lookup error:",
                        err
                    );

                    return res.status(500).json({
                        success: false,
                        error:
                            "Database error"
                    });
                }

                if (!contact) {

                    return res.status(404).json({
                        success: false,
                        error:
                            "Contact not found"
                    });
                }

                const newValue =
                    contact.favorite
                        ? 0
                        : 1;

                db.run(
                    `
                    UPDATE contacts
                    SET
                        favorite = ?,
                        updated_at =
                            CURRENT_TIMESTAMP
                    WHERE id = ?
                    `,
                    [
                        newValue,
                        id
                    ],
                    function (err) {

                        if (err) {

                            console.error(
                                "Favorite update error:",
                                err
                            );

                            return res.status(500).json({
                                success: false,
                                error:
                                    "Failed to update favorite"
                            });
                        }

                        res.json({
                            success: true,
                            favorite:
                                newValue === 1
                        });
                    }
                );
            }
        );
    }
);


// =====================================================
// PROFILE
// =====================================================

// GET PROFILE

app.get(
    "/api/profile",
    (req, res) => {

        db.get(
            `
            SELECT *
            FROM profile
            WHERE id = 1
            `,
            [],
            (err, profile) => {

                if (err) {

                    console.error(
                        "GET profile error:",
                        err
                    );

                    return res.status(500).json({
                        success: false,
                        error:
                            "Failed to fetch profile"
                    });
                }

                res.json({
                    success: true,
                    profile:
                        profile || null
                });
            }
        );
    }
);


// SAVE / UPDATE PROFILE

app.put(
    "/api/profile",
    (req, res) => {

        const {
            name,
            phone,
            email,
            category,
            company,
            job_title,
            address,
            website,
            instagram,
            linkedin,
            whatsapp,
            bio
        } = req.body;

        const sql = `
            INSERT INTO profile (
                id,
                name,
                phone,
                email,
                category,
                company,
                job_title,
                address,
                website,
                instagram,
                linkedin,
                whatsapp,
                bio
            )
            VALUES (
                1, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?
            )

            ON CONFLICT(id)
            DO UPDATE SET
                name = excluded.name,
                phone = excluded.phone,
                email = excluded.email,
                category = excluded.category,
                company = excluded.company,
                job_title = excluded.job_title,
                address = excluded.address,
                website = excluded.website,
                instagram = excluded.instagram,
                linkedin = excluded.linkedin,
                whatsapp = excluded.whatsapp,
                bio = excluded.bio
        `;

        const values = [
            name || "",
            phone || "",
            email || "",
            category || "Personal",
            company || "",
            job_title || "",
            address || "",
            website || "",
            instagram || "",
            linkedin || "",
            whatsapp || "",
            bio || ""
        ];

        db.run(
            sql,
            values,
            function (err) {

                if (err) {

                    console.error(
                        "SAVE profile error:",
                        err
                    );

                    return res.status(500).json({
                        success: false,
                        error:
                            "Failed to save profile"
                    });
                }

                db.get(
                    `
                    SELECT *
                    FROM profile
                    WHERE id = 1
                    `,
                    [],
                    (err, profile) => {

                        if (err) {

                            return res.status(500).json({
                                success: false,
                                error:
                                    "Profile saved but could not be retrieved"
                            });
                        }

                        res.json({
                            success: true,
                            message:
                                "Profile saved successfully",
                            profile
                        });
                    }
                );
            }
        );
    }
);


// =====================================================
// REMINDERS
// =====================================================

// GET REMINDERS

app.get(
    "/api/reminders",
    (req, res) => {

        const sql = `
            SELECT
                reminders.*,
                contacts.name AS contact_name
            FROM reminders
            LEFT JOIN contacts
                ON reminders.contact_id =
                   contacts.id
            ORDER BY
                reminder_date ASC,
                reminder_time ASC
        `;

        db.all(
            sql,
            [],
            (err, rows) => {

                if (err) {

                    console.error(
                        "GET reminders error:",
                        err
                    );

                    return res.status(500).json({
                        success: false,
                        error:
                            "Failed to fetch reminders"
                    });
                }

                res.json({
                    success: true,
                    reminders: rows || []
                });
            }
        );
    }
);


// ADD REMINDER

app.post(
    "/api/reminders",
    (req, res) => {

        const {
            contact_id,
            title,
            reminder_date,
            reminder_time,
            notes
        } = req.body;

        if (
            !title ||
            !reminder_date
        ) {

            return res.status(400).json({
                success: false,
                error:
                    "Title and reminder date are required"
            });
        }

        const sql = `
            INSERT INTO reminders (
                contact_id,
                title,
                reminder_date,
                reminder_time,
                notes
            )
            VALUES (?, ?, ?, ?, ?)
        `;

        db.run(
            sql,
            [
                contact_id || null,
                title,
                reminder_date,
                reminder_time || "",
                notes || ""
            ],
            function (err) {

                if (err) {

                    console.error(
                        "ADD reminder error:",
                        err
                    );

                    return res.status(500).json({
                        success: false,
                        error:
                            "Failed to create reminder"
                    });
                }

                res.status(201).json({
                    success: true,
                    message:
                        "Reminder created successfully",
                    id: this.lastID
                });
            }
        );
    }
);


// COMPLETE REMINDER

app.patch(
    "/api/reminders/:id/complete",
    (req, res) => {

        const id =
            req.params.id;

        db.run(
            `
            UPDATE reminders
            SET completed = 1
            WHERE id = ?
            `,
            [id],
            function (err) {

                if (err) {

                    console.error(
                        "Complete reminder error:",
                        err
                    );

                    return res.status(500).json({
                        success: false,
                        error:
                            "Failed to complete reminder"
                    });
                }

                if (this.changes === 0) {

                    return res.status(404).json({
                        success: false,
                        error:
                            "Reminder not found"
                    });
                }

                res.json({
                    success: true,
                    message:
                        "Reminder completed"
                });
            }
        );
    }
);


// DELETE REMINDER

app.delete(
    "/api/reminders/:id",
    (req, res) => {

        const id =
            req.params.id;

        db.run(
            `
            DELETE FROM reminders
            WHERE id = ?
            `,
            [id],
            function (err) {

                if (err) {

                    console.error(
                        "DELETE reminder error:",
                        err
                    );

                    return res.status(500).json({
                        success: false,
                        error:
                            "Failed to delete reminder"
                    });
                }

                if (this.changes === 0) {

                    return res.status(404).json({
                        success: false,
                        error:
                            "Reminder not found"
                    });
                }

                res.json({
                    success: true,
                    message:
                        "Reminder deleted successfully"
                });
            }
        );
    }
);


// =====================================================
// INTERACTIONS
// =====================================================

// GET INTERACTIONS

app.get(
    "/api/interactions",
    (req, res) => {

        const contactId =
            req.query.contact_id;

        let sql = `
            SELECT
                interactions.*,
                contacts.name AS contact_name
            FROM interactions
            LEFT JOIN contacts
                ON interactions.contact_id =
                   contacts.id
        `;

        const params = [];

        if (contactId) {

            sql += `
                WHERE interactions.contact_id = ?
            `;

            params.push(contactId);
        }

        sql += `
            ORDER BY interaction_date DESC
        `;

        db.all(
            sql,
            params,
            (err, rows) => {

                if (err) {

                    console.error(
                        "GET interactions error:",
                        err
                    );

                    return res.status(500).json({
                        success: false,
                        error:
                            "Failed to fetch interactions"
                    });
                }

                res.json({
                    success: true,
                    interactions:
                        rows || []
                });
            }
        );
    }
);


// ADD INTERACTION

app.post(
    "/api/interactions",
    (req, res) => {

        const {
            contact_id,
            type,
            description,
            interaction_date
        } = req.body;

        if (
            !contact_id ||
            !type
        ) {

            return res.status(400).json({
                success: false,
                error:
                    "Contact and interaction type are required"
            });
        }

        const sql = `
            INSERT INTO interactions (
                contact_id,
                type,
                description,
                interaction_date
            )
            VALUES (?, ?, ?, ?)
        `;

        db.run(
            sql,
            [
                contact_id,
                type,
                description || "",
                interaction_date ||
                    new Date().toISOString()
            ],
            function (err) {

                if (err) {

                    console.error(
                        "ADD interaction error:",
                        err
                    );

                    return res.status(500).json({
                        success: false,
                        error:
                            "Failed to add interaction"
                    });
                }

                const interactionId =
                    this.lastID;

                // Increase relationship score
                db.run(
                    `
                    UPDATE contacts
                    SET relationship_score =
                        CASE
                            WHEN relationship_score < 100
                            THEN relationship_score + 5
                            ELSE 100
                        END,
                        updated_at =
                            CURRENT_TIMESTAMP
                    WHERE id = ?
                    `,
                    [contact_id],
                    (scoreErr) => {

                        if (scoreErr) {

                            console.error(
                                "Relationship score update error:",
                                scoreErr
                            );
                        }
                    }
                );

                res.status(201).json({
                    success: true,
                    message:
                        "Interaction added successfully",
                    id: interactionId
                });
            }
        );
    }
);


// =====================================================
// GROUPS
// =====================================================

// GET GROUPS

app.get(
    "/api/groups",
    (req, res) => {

        const sql = `
            SELECT
                groups_table.id,
                groups_table.name,
                COUNT(
                    contact_groups.contact_id
                ) AS contact_count
            FROM groups_table
            LEFT JOIN contact_groups
                ON groups_table.id =
                   contact_groups.group_id
            GROUP BY groups_table.id
            ORDER BY groups_table.name
        `;

        db.all(
            sql,
            [],
            (err, rows) => {

                if (err) {

                    console.error(
                        "GET groups error:",
                        err
                    );

                    return res.status(500).json({
                        success: false,
                        error:
                            "Failed to fetch groups"
                    });
                }

                res.json({
                    success: true,
                    groups: rows || []
                });
            }
        );
    }
);


// CREATE GROUP

app.post(
    "/api/groups",
    (req, res) => {

        const { name } =
            req.body;

        if (!name) {

            return res.status(400).json({
                success: false,
                error:
                    "Group name is required"
            });
        }

        db.run(
            `
            INSERT INTO groups_table
            (name)
            VALUES (?)
            `,
            [name.trim()],
            function (err) {

                if (err) {

                    console.error(
                        "CREATE group error:",
                        err
                    );

                    return res.status(400).json({
                        success: false,
                        error:
                            "Group already exists or could not be created"
                    });
                }

                res.status(201).json({
                    success: true,
                    message:
                        "Group created successfully",
                    id: this.lastID
                });
            }
        );
    }
);


// ADD CONTACT TO GROUP

app.post(
    "/api/groups/:groupId/contacts/:contactId",
    (req, res) => {

        const groupId =
            req.params.groupId;

        const contactId =
            req.params.contactId;

        db.run(
            `
            INSERT OR IGNORE INTO contact_groups
            (
                contact_id,
                group_id
            )
            VALUES (?, ?)
            `,
            [
                contactId,
                groupId
            ],
            function (err) {

                if (err) {

                    console.error(
                        "ADD contact to group error:",
                        err
                    );

                    return res.status(500).json({
                        success: false,
                        error:
                            "Failed to add contact to group"
                    });
                }

                res.json({
                    success: true,
                    message:
                        "Contact added to group"
                });
            }
        );
    }
);


// GET SINGLE GROUP WITH ITS CONTACTS

app.get(
    "/api/groups/:groupId",
    (req, res) => {

        const groupId =
            req.params.groupId;

        db.get(
            `
            SELECT id, name
            FROM groups_table
            WHERE id = ?
            `,
            [groupId],
            (err, group) => {

                if (err) {

                    console.error(
                        "GET group error:",
                        err
                    );

                    return res.status(500).json({
                        success: false,
                        error:
                            "Failed to fetch group"
                    });
                }

                if (!group) {

                    return res.status(404).json({
                        success: false,
                        error:
                            "Group not found"
                    });
                }

                db.all(
                    `
                    SELECT contacts.*
                    FROM contacts
                    JOIN contact_groups
                        ON contacts.id =
                           contact_groups.contact_id
                    WHERE contact_groups.group_id = ?
                    ORDER BY contacts.name COLLATE NOCASE ASC
                    `,
                    [groupId],
                    (err, contactRows) => {

                        if (err) {

                            console.error(
                                "GET group contacts error:",
                                err
                            );

                            return res.status(500).json({
                                success: false,
                                error:
                                    "Failed to fetch group contacts"
                            });
                        }

                        res.json({
                            success: true,
                            group: {
                                ...group,
                                contacts: contactRows || []
                            }
                        });
                    }
                );
            }
        );
    }
);


// DELETE GROUP

app.delete(
    "/api/groups/:groupId",
    (req, res) => {

        const groupId =
            req.params.groupId;

        db.run(
            `
            DELETE FROM groups_table
            WHERE id = ?
            `,
            [groupId],
            function (err) {

                if (err) {

                    console.error(
                        "DELETE group error:",
                        err
                    );

                    return res.status(500).json({
                        success: false,
                        error:
                            "Failed to delete group"
                    });
                }

                if (this.changes === 0) {

                    return res.status(404).json({
                        success: false,
                        error:
                            "Group not found"
                    });
                }

                res.json({
                    success: true,
                    message:
                        "Group deleted successfully"
                });
            }
        );
    }
);


// REMOVE CONTACT FROM GROUP

app.delete(
    "/api/groups/:groupId/contacts/:contactId",
    (req, res) => {

        const groupId =
            req.params.groupId;

        const contactId =
            req.params.contactId;

        db.run(
            `
            DELETE FROM contact_groups
            WHERE group_id = ?
              AND contact_id = ?
            `,
            [
                groupId,
                contactId
            ],
            function (err) {

                if (err) {

                    console.error(
                        "REMOVE contact from group error:",
                        err
                    );

                    return res.status(500).json({
                        success: false,
                        error:
                            "Failed to remove contact from group"
                    });
                }

                if (this.changes === 0) {

                    return res.status(404).json({
                        success: false,
                        error:
                            "Contact was not in that group"
                    });
                }

                res.json({
                    success: true,
                    message:
                        "Contact removed from group"
                });
            }
        );
    }
);


// =====================================================
// DASHBOARD
// =====================================================

app.get(
    "/api/dashboard",
    (req, res) => {

        const queries = {

            totalContacts: `
                SELECT COUNT(*) AS count
                FROM contacts
            `,

            favoriteContacts: `
                SELECT COUNT(*) AS count
                FROM contacts
                WHERE favorite = 1
            `,

            pendingReminders: `
                SELECT COUNT(*) AS count
                FROM reminders
                WHERE completed = 0
            `,

            totalInteractions: `
                SELECT COUNT(*) AS count
                FROM interactions
            `,

            categories: `
                SELECT
                    category,
                    COUNT(*) AS count
                FROM contacts
                GROUP BY category
                ORDER BY count DESC
            `
        };


        db.get(
            queries.totalContacts,
            [],
            (err, total) => {

                if (err) {

                    console.error(
                        "Dashboard contacts error:",
                        err
                    );

                    return res.status(500).json({
                        success: false,
                        error:
                            "Dashboard error"
                    });
                }


                db.get(
                    queries.favoriteContacts,
                    [],
                    (err, favorites) => {

                        if (err) {

                            console.error(
                                "Dashboard favorites error:",
                                err
                            );

                            return res.status(500).json({
                                success: false,
                                error:
                                    "Dashboard error"
                            });
                        }


                        db.get(
                            queries.pendingReminders,
                            [],
                            (err, reminders) => {

                                if (err) {

                                    console.error(
                                        "Dashboard reminders error:",
                                        err
                                    );

                                    return res.status(500).json({
                                        success: false,
                                        error:
                                            "Dashboard error"
                                    });
                                }


                                db.get(
                                    queries.totalInteractions,
                                    [],
                                    (err, interactions) => {

                                        if (err) {

                                            console.error(
                                                "Dashboard interactions error:",
                                                err
                                            );

                                            return res.status(500).json({
                                                success: false,
                                                error:
                                                    "Dashboard error"
                                            });
                                        }


                                        db.all(
                                            queries.categories,
                                            [],
                                            (err, categories) => {

                                                if (err) {

                                                    console.error(
                                                        "Dashboard categories error:",
                                                        err
                                                    );

                                                    return res.status(500).json({
                                                        success: false,
                                                        error:
                                                            "Dashboard error"
                                                    });
                                                }


                                                res.json({

                                                    success: true,

                                                    dashboard: {

                                                        totalContacts:
                                                            total?.count || 0,

                                                        favoriteContacts:
                                                            favorites?.count || 0,

                                                        pendingReminders:
                                                            reminders?.count || 0,

                                                        totalInteractions:
                                                            interactions?.count || 0,

                                                        categories:
                                                            categories || []
                                                    }
                                                });
                                            }
                                        );
                                    }
                                );
                            }
                        );
                    }
                );
            }
        );
    }
);


// =====================================================
// AI ASSISTANT
// =====================================================


function buildLocalAssistantAnswer(messages, contacts, reminders, interactions, groups) {
    const lastUserMessage = Array.isArray(messages)
        ? [...messages]
            .reverse()
            .find(
                (message) =>
                    message &&
                    message.role === "user" &&
                    typeof message.content === "string"
            )
        : null;

    const question = (lastUserMessage?.content || "").trim();

    if (!question) {
        return "I’m ready to help with your contacts, reminders, birthdays, groups, and relationship follow-ups.";
    }

    const lower = question.toLowerCase();

    const allContacts = contacts || [];
    const allReminders = reminders || [];
    const allInteractions = interactions || [];
    const allGroups = groups || [];

    const pending = allReminders.filter(
        (item) => !item.completed
    );

    const topContacts = [...allContacts]
        .sort(
            (a, b) =>
                (Number(b.relationship_score) || 0) -
                (Number(a.relationship_score) || 0)
        )
        .slice(0, 5);

    const weakContacts = [...allContacts]
        .filter(
            (contact) =>
                Number(contact.relationship_score || 0) < 60
        )
        .sort(
            (a, b) =>
                (Number(a.relationship_score) || 0) -
                (Number(b.relationship_score) || 0)
        );

    const favoriteContacts = allContacts.filter(
        (contact) =>
            contact.favorite === 1 ||
            contact.favorite === true ||
            contact.favorite === "1"
    );

    const birthdayContacts = allContacts.filter(
        (contact) =>
            String(contact.birthday || "").trim()
    );

    // -------------------------------------------------
    // CONTACT COUNT
    // -------------------------------------------------

    if (
        /how many contacts|number of contacts|total contacts|contacts do i have/i.test(
            lower
        )
    ) {
        return `You currently have ${allContacts.length} contact(s) saved in Contact Connect Hub.`;
    }

    // -------------------------------------------------
    // FAVORITES
    // -------------------------------------------------

    if (
        /favorite contacts|favourite contacts|my favorites|my favourites/i.test(
            lower
        )
    ) {
        if (!favoriteContacts.length) {
            return "You do not have any favorite contacts yet.";
        }

        const names = favoriteContacts
            .slice(0, 10)
            .map((contact) => contact.name)
            .join(", ");

        return `Your favorite contacts are: ${names}.`;
    }

    // -------------------------------------------------
    // SEARCH CONTACT BY NAME
    // -------------------------------------------------

    const matchingContact = allContacts.find((contact) => {
        const name = String(contact.name || "").toLowerCase();
        return (
            name &&
            lower.includes(name)
        );
    });

    if (
        matchingContact &&
        /who is|tell me about|details|information|about/i.test(lower)
    ) {
        const details = [];

        if (matchingContact.category) {
            details.push(`Category: ${matchingContact.category}`);
        }

        if (matchingContact.company) {
            details.push(`Company: ${matchingContact.company}`);
        }

        if (matchingContact.job_title) {
            details.push(`Job: ${matchingContact.job_title}`);
        }

        if (matchingContact.birthday) {
            details.push(`Birthday: ${matchingContact.birthday}`);
        }

        if (matchingContact.relationship_score !== undefined) {
            details.push(
                `Relationship score: ${matchingContact.relationship_score}/100`
            );
        }

        if (!details.length) {
            return `${matchingContact.name} is saved in your contacts, but there are no additional details available.`;
        }

        return `${matchingContact.name}: ${details.join(" | ")}.`;
    }

    // -------------------------------------------------
    // FOLLOW-UPS / REMINDERS
    // -------------------------------------------------

    if (
        /follow[- ]?up|reminder|reminders|due|task|tasks/i.test(
            lower
        )
    ) {
        if (!pending.length) {
            return "You do not have any unfinished reminders right now.";
        }

        const lines = pending
            .slice(0, 5)
            .map(
                (item) =>
                    `${item.contact_name || "Contact"}: ${item.title || "Reminder"} (${item.reminder_date || "date not set"})`
            );

        return `You have ${pending.length} pending reminder(s): ${lines.join("; ")}.`;
    }

    // -------------------------------------------------
    // BIRTHDAYS
    // -------------------------------------------------

    if (
        /birthday|birthdays/i.test(lower)
    ) {
        if (!birthdayContacts.length) {
            return "No birthday entries are saved in your contact list yet.";
        }

        const lines = birthdayContacts
            .slice(0, 10)
            .map(
                (contact) =>
                    `${contact.name}: ${contact.birthday}`
            )
            .join("; ");

        return `Saved birthdays: ${lines}.`;
    }

    // -------------------------------------------------
    // STRONG CONNECTIONS
    // -------------------------------------------------

    if (
        /strongest|best connection|top connection|strong connection|highest score/i.test(
            lower
        )
    ) {
        if (!topContacts.length) {
            return "No contact relationship scores are available yet.";
        }

        const lines = topContacts
            .map(
                (contact) =>
                    `${contact.name} (${contact.relationship_score || 0}/100)`
            )
            .join("; ");

        return `Your highest relationship scores are: ${lines}.`;
    }

    // -------------------------------------------------
    // FAVORITE + RELATIONSHIP
    // -------------------------------------------------

    if (
        /favorite.*relationship|relationship.*favorite/i.test(
            lower
        )
    ) {
        if (!favoriteContacts.length) {
            return "You do not have any favorite contacts yet.";
        }

        const lines = favoriteContacts
            .slice(0, 5)
            .map(
                (contact) =>
                    `${contact.name} (${contact.relationship_score || 0}/100)`
            )
            .join("; ");

        return `Your favorite contacts and their relationship scores are: ${lines}.`;
    }
// -------------------------------------------------
// WHO SHOULD I CONTACT TODAY?
// -------------------------------------------------

if (
    /who should i contact today|who should i contact|contact today|who do i contact/i.test(
        lower
    )
) {
    const candidates = [...allContacts]
        .sort(
            (a, b) =>
                (Number(a.relationship_score) || 0) -
                (Number(b.relationship_score) || 0)
        )
        .slice(0, 3);

    if (!candidates.length) {
        return "You do not have any contacts yet.";
    }

    const names = candidates
        .map(
            (contact) =>
                `${contact.name} (${contact.relationship_score || 0}/100)`
        )
        .join("; ");

    return `Based on relationship scores, you could consider contacting: ${names}.`;
}
    // -------------------------------------------------
    // RISK / NEEDS ATTENTION
    // -------------------------------------------------

    if (
        /risk|weak|needs attention|high[- ]?risk|low score|low relationship/i.test(
            lower
        )
    ) {
        if (!weakContacts.length) {
            return "No contacts currently look at-risk based on the relationship scores in your database.";
        }

        const lines = weakContacts
            .slice(0, 5)
            .map(
                (contact) =>
                    `${contact.name} (${contact.relationship_score || 0}/100)`
            )
            .join("; ");

        return `Contacts that may need attention: ${lines}.`;
    }

    // -------------------------------------------------
    // GROUPS
    // -------------------------------------------------

    if (
        /group|groups|circle|circles/i.test(lower)
    ) {
        if (!allGroups.length) {
            return "You do not have any groups created yet.";
        }

        const groupNames = [
            ...new Set(
                allGroups
                    .map((group) => group.group_name)
                    .filter(Boolean)
            )
        ];

        if (!groupNames.length) {
            return "Groups exist, but no group names are available.";
        }

        return `Your groups are: ${groupNames.join(", ")}.`;
    }

    // -------------------------------------------------
    // COMPANY SEARCH
    // -------------------------------------------------

    const companyMatches = allContacts.filter((contact) => {
        const company = String(
            contact.company || ""
        ).toLowerCase();

        return (
            company &&
            lower.includes(company)
        );
    });

    if (
        companyMatches.length &&
        /company|work|working|employee|employees|people/i.test(
            lower
        )
    ) {
        const names = companyMatches
            .map((contact) => contact.name)
            .join(", ");

        return `Contacts associated with that company: ${names}.`;
    }

    // -------------------------------------------------
    // INTERACTIONS
    // -------------------------------------------------

    if (
        /interaction|interactions|contact history|history|recent communication/i.test(
            lower
        )
    ) {
        if (!allInteractions.length) {
            return "There are no saved interactions yet.";
        }

        const lines = allInteractions
            .slice(0, 5)
            .map(
                (item) =>
                    `${item.contact_name || "Contact"}: ${item.type || "Interaction"}${item.interaction_date ? ` (${item.interaction_date})` : ""}`
            )
            .join("; ");

        return `Recent interactions: ${lines}.`;
    }

    // -------------------------------------------------
    // GENERAL SUMMARY
    // -------------------------------------------------

    if (
        /summary|overview|dashboard|overall|what do i have|what's in my app/i.test(
            lower
        )
    ) {
        return `Your Contact Connect Hub currently has ${allContacts.length} contacts, ${pending.length} pending reminders, ${allGroups.length} groups, and ${allInteractions.length} saved interactions.`;
    }

    // -------------------------------------------------
    // HELP
    // -------------------------------------------------

    if (
        /help|what can you do|commands|features/i.test(
            lower
        )
    ) {
        return `I can help you with:
• Contacts and contact counts
• Favorite contacts
• Relationship scores
• Contacts needing attention
• Follow-ups and reminders
• Birthdays
• Groups
• Interaction history
• Contact and company searches`;
    }

    // -------------------------------------------------
    // DEFAULT
    // -------------------------------------------------

    return "I can help you review contacts, favorites, relationship scores, follow-ups, reminders, birthdays, groups, and interaction history.";
}
app.post("/api/assistant", async (req, res) => {
    const placeholderKeys = new Set([
        "demo-key",
        "demo",
        "your_openai_key_here",
        "replace-me",
        "changeme",
        "test-key"
    ]);
    const apiKeyValue =
        process.env.OPENAI_API_KEY ||
        process.env.AI_API_KEY || "";
    const apiKey = String(apiKeyValue).trim();
    const isPlaceholderKey = apiKey && placeholderKeys.has(apiKey.toLowerCase());
    const apiUrl =
        process.env.AI_API_URL ||
        "https://api.openai.com/v1/chat/completions";
    const model =
        process.env.AI_MODEL ||
        "gpt-4o-mini";
    const messages = Array.isArray(req.body.messages)
        ? req.body.messages
            .filter(message =>
                message &&
                ["user", "assistant"].includes(message.role) &&
                typeof message.content === "string"
            )
            .slice(-12)
            .map(message => ({
                role: message.role,
                content: message.content.slice(0, 2000)
            }))
        : [];

    if (!messages.length || messages[messages.length - 1].role !== "user") {
        return res.status(400).json({
            success: false,
            error: "Enter a question to get started."
        });
    }

    const queryAll = (sql) => new Promise((resolve, reject) => {
        db.all(sql, [], (err, rows) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(rows || []);
        });
    });

    try {
        const [contacts, reminders, interactions, groups] = await Promise.all([
            queryAll(`
                SELECT name, category, company, job_title, birthday, notes,
                       favorite, relationship_score, created_at, updated_at
                FROM contacts
                ORDER BY name COLLATE NOCASE ASC
                LIMIT 300
            `),
            queryAll(`
                SELECT reminders.title, reminders.reminder_date,
                       reminders.reminder_time, reminders.notes,
                       reminders.completed, contacts.name AS contact_name
                FROM reminders
                LEFT JOIN contacts ON contacts.id = reminders.contact_id
                ORDER BY reminders.reminder_date ASC
                LIMIT 300
            `),
            queryAll(`
                SELECT interactions.type, interactions.description,
                       interactions.interaction_date,
                       contacts.name AS contact_name
                FROM interactions
                LEFT JOIN contacts ON contacts.id = interactions.contact_id
                ORDER BY interactions.interaction_date DESC
                LIMIT 500
            `),
            queryAll(`
                SELECT groups_table.name AS group_name,
                       contacts.name AS contact_name
                FROM groups_table
                LEFT JOIN contact_groups
                    ON contact_groups.group_id = groups_table.id
                LEFT JOIN contacts
                    ON contacts.id = contact_groups.contact_id
                ORDER BY groups_table.name, contacts.name
                LIMIT 300
            `)
        ]);

        if (!apiKey || isPlaceholderKey) {
            const answer = buildLocalAssistantAnswer(messages, contacts, reminders, interactions, groups);
            return res.json({
                success: true,
                answer,
                mode: "demo"
            });
        }

        const systemPrompt = [
            "You are the Contact Connect Hub assistant.",
            "Answer questions about contact management, relationship follow-ups, and using this app. You may also answer general questions that help with those tasks.",
            "Use the supplied app data when relevant. Never invent contact details, reminders, interactions, or app capabilities. If the data does not contain the answer, say so plainly and offer a useful next step.",
            "For unrelated requests, briefly explain that you specialize in Contact Connect Hub and relationship management.",
            `Today's date is ${new Date().toISOString().slice(0, 10)}.`,
            "App data:",
            JSON.stringify({ contacts, reminders, interactions, groups })
        ].join("\n\n");

        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model,
                messages: [
                    { role: "system", content: systemPrompt },
                    ...messages
                ],
                temperature: 0.3
            }),
            signal: AbortSignal.timeout(30000)
        });
        const result = await response.json();

        if (!response.ok) {
            console.error("AI provider error:", result.error?.message || response.status);
            return res.status(502).json({
                success: false,
                error: "The AI provider could not answer right now. Check the server configuration and try again."
            });
        }

        const answer = result.choices?.[0]?.message?.content;
        if (typeof answer !== "string" || !answer.trim()) {
            return res.status(502).json({
                success: false,
                error: "The AI provider returned an empty answer. Please try again."
            });
        }

        res.json({ success: true, answer: answer.trim() });
    } catch (error) {
        console.error("AI assistant error:", error.message);
        res.status(502).json({
            success: false,
            error: "Unable to reach the AI service. Please try again."
        });
    }
});


// =====================================================
// UNKNOWN API ROUTE
// =====================================================

app.use(
    "/api",
    (req, res) => {

        res.status(404).json({
            success: false,
            error:
                "API endpoint not found"
        });
    }
);


// =====================================================
// SERVER ERROR HANDLER
// =====================================================

app.use(
    (err, req, res, next) => {

        console.error(
            "Server error:",
            err
        );

        res.status(500).json({
            success: false,
            error:
                "Internal server error"
        });
    }
);


// =====================================================
// START SERVER
// =====================================================

if (require.main === module) {
    app.listen(
        PORT,
        () => {

            console.log("");
            console.log(
                "======================================"
            );
            console.log(
                "     CONTACT CONNECT HUB"
            );
            console.log(
                "======================================"
            );
            console.log("");

            console.log(
                `Server running at: http://localhost:${PORT}`
            );

            console.log(
                `Frontend:          http://localhost:${PORT}`
            );

            console.log(
                `API running at:    http://localhost:${PORT}/api`
            );

            console.log("");

            console.log(
                "Frontend folder:",
                frontendPath
            );

            console.log("");
        }
    );
}

module.exports = app;