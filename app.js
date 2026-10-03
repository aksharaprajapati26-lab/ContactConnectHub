
// =====================================================
// CONTACT CONNECT HUB - FRONTEND JAVASCRIPT
// =====================================================

const API_BASE =
    window.location.port === "4000"
        ? "/api"
        : "http://localhost:4000/api";

let contacts = [];
let reminders = [];
let groups = [];
let currentContact = null;
let currentGroupId = null;
let shareMode = "profile";
const SETTINGS_STORAGE_KEY = "contactConnectHub.settings";
const AUTH_STORAGE_KEY = "contactConnectHub.auth";
const DEFAULT_SETTINGS = {
    reminderNotifications: false,
    birthdayReminders: true,
    aiRecommendations: true,
    selectiveSharing: true,
    otpVerification: false,
    suspiciousWarnings: true
};
let appSettings = { ...DEFAULT_SETTINGS };

function getStoredAuthUser() {
    try {
        const saved = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || "null");
        return saved && typeof saved === "object" ? saved : null;
    } catch (error) {
        return null;
    }
}

function setStoredAuthUser(user) {
    if (!user) {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        return;
    }

    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
}

function applyAuthState() {
    const user = getStoredAuthUser();
    const profileName = document.getElementById("sidebarProfileName");

    if (profileName) {
        const label = user && user.name ? user.name : "Akshara Prajapati";
        profileName.textContent = label;
    }

    const loginEmail = document.getElementById("loginEmail");
    const loginPassword = document.getElementById("loginPassword");

    if (loginEmail && !user) {
        loginEmail.value = "";
    }

    if (loginPassword && !user) {
        loginPassword.value = "";
    }
}

async function readResponse(response) {
    const body = await response.text();

    if (!body.trim()) {
        return {
            success: false,
            error: `Empty response from server (HTTP ${response.status})`
        };
    }

    try {
        return JSON.parse(body);
    } catch (error) {
        throw new Error(
            `Invalid JSON from ${response.url} (HTTP ${response.status})`
        );
    }
}

function normalizeTags(tags) {
    if (Array.isArray(tags)) {
        return tags;
    }

    if (!tags) {
        return [];
    }

    try {
        const parsed = JSON.parse(tags);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return String(tags)
            .split(",")
            .map(function (tag) { return tag.trim(); })
            .filter(Boolean);
    }
}

function loadSettings() {
    try {
        const savedSettings = JSON.parse(
            localStorage.getItem(SETTINGS_STORAGE_KEY) || "{}"
        );

        Object.keys(DEFAULT_SETTINGS).forEach(function (key) {
            if (typeof savedSettings[key] === "boolean") {
                appSettings[key] = savedSettings[key];
            }
        });
    } catch (error) {
        appSettings = { ...DEFAULT_SETTINGS };
    }

    document.querySelectorAll(".switch[data-setting]").forEach(function (button) {
        const enabled = appSettings[button.dataset.setting];
        button.classList.toggle("on", enabled);
        button.setAttribute("aria-pressed", String(enabled));
    });
}

function settingEnabled(name) {
    return appSettings[name] === true;
}

function notifyDueReminders() {
    if (
        !settingEnabled("reminderNotifications") ||
        !("Notification" in window) ||
        Notification.permission !== "granted"
    ) {
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, "0"),
        String(today.getDate()).padStart(2, "0")
    ].join("-");
    const storageKey = `contactConnectHub.notifiedReminders.${todayKey}`;
    let notified = {};

    try {
        notified = JSON.parse(localStorage.getItem(storageKey) || "{}");
    } catch (error) {
        notified = {};
    }

    reminders.forEach(function (reminder) {
        const dueDate = new Date(`${reminder.date}T00:00:00`);

        if (
            reminder.done ||
            Number.isNaN(dueDate.getTime()) ||
            dueDate > today ||
            notified[reminder.id]
        ) {
            return;
        }

        new Notification("Follow-up reminder", {
            body: reminder.text || "A contact follow-up is due."
        });
        notified[reminder.id] = true;
    });

    localStorage.setItem(storageKey, JSON.stringify(notified));
}

// =====================================================
// PAGE INFORMATION
// =====================================================

const pageInfo = {
    dashboard: [
        "Dashboard",
        "Your contacts, relationships and follow-ups in one place."
    ],
    contacts: [
        "Contacts",
        "Search, organize, edit and safely manage your contacts."
    ],
    favorites: [
        "Favorites",
        "Quick access to the people who matter most."
    ],
    groups: [
        "Groups",
        "Organize contacts into focused relationship circles."
    ],
    reminders: [
        "Reminders",
        "Follow-ups, birthdays and important interactions."
    ],
    graph: [
        "Relationship Graph",
        "Visualize relationship strength and connection patterns."
    ],
    insights: [
        "AI Insights",
        "Relationship scores, risks and smart recommendations."
    ],
    assistant: [
        "AI Assistant",
        "Ask naturally about your contacts and follow-ups."
    ],
    profile: [
        "My Profile",
        "Manage your profile and selective contact sharing."
    ],
    settings: [
        "Settings",
        "Notifications, privacy, security and account controls."
    ]
};

// =====================================================
// LOAD CONTACTS FROM BACKEND
// =====================================================

async function loadContacts() {
    try {
        const response = await fetch(`${API_BASE}/contacts`);
        const data = await readResponse(response);

        if (!response.ok || !data.success) {
            throw new Error(data.error || "Failed to load contacts");
        }

        contacts = (data.contacts || []).map(function (contact) {
            return {
                ...contact,

                id: Number(contact.id),

                favorite: Boolean(contact.favorite),

                score: Number(contact.relationship_score || 0),

                tags: normalizeTags(contact.tags),

                last:
                    contact.updated_at ||
                    contact.created_at ||
                    ""
            };
        });

        renderContacts();
        renderFavorites();
        updateStats();
        renderRelationshipStats();
        renderAIRecommendations();
        renderLocalInsights();

        console.log("Contacts loaded:", contacts);

    } catch (error) {
        console.error("Load contacts error:", error);
        showToast("Unable to load contacts");
    }
}

// =====================================================
// LOAD REMINDERS FROM BACKEND
// =====================================================

async function loadReminders() {
    try {
        const response = await fetch(`${API_BASE}/reminders`);
        const data = await readResponse(response);

        if (!response.ok || !data.success) {
            throw new Error(data.error || "Failed to load reminders");
        }

        reminders = (data.reminders || []).map(function (r) {
            return {
                id: Number(r.id),
                text: r.title || "",
                date: r.reminder_date || "Upcoming",
                time: r.reminder_time || "",
                type: r.type || "Reminder",
                done: Boolean(r.completed),
                contact_id: r.contact_id || null,
                notes: r.notes || ""
            };
        });

        renderReminders();
        renderLocalInsights();
        notifyDueReminders();

    } catch (error) {
        console.error("Load reminders error:", error);
        showToast("Unable to load reminders");
    }
}

// =====================================================
// PAGE NAVIGATION
// =====================================================

function showPage(id) {

    document.querySelectorAll(".page").forEach(function (page) {
        page.classList.remove("active");
    });

    const page = document.getElementById(id);

    if (page) {
        page.classList.add("active");
    }

    document.querySelectorAll(".nav a").forEach(function (link) {
        link.classList.toggle(
            "active",
            link.dataset.page === id
        );
    });

    if (pageInfo[id]) {

        const title = document.getElementById("pageTitle");
        const subtitle = document.getElementById("pageSubtitle");

        if (title) {
            title.textContent = pageInfo[id][0];
        }

        if (subtitle) {
            subtitle.textContent = pageInfo[id][1];
        }
    }

    if (id === "contacts") {
        renderContacts();
    }

    if (id === "favorites") {
        renderFavorites();
    }

    if (id === "graph") {
        renderGraph();
    }

    if (id === "groups") {
        loadGroups();
    }

    if (id === "reminders") {
        loadReminders();
        renderUpcomingBirthdays();
    }

    if (id === "profile") {
        loadProfile();
        generateProfileQR();
    }

    if (id === "dashboard") {
        loadDashboard();
    }
}

// =====================================================
// INITIALS
// =====================================================

function initials(name) {

    return String(name || "")
        .trim()
        .split(/\s+/)
        .map(function (word) {
            return word[0] || "";
        })
        .join("")
        .slice(0, 2)
        .toUpperCase();
}

// =====================================================
// RENDER CONTACTS
// =====================================================

function renderContacts() {

    const searchInput =
        document.getElementById("searchInput");

    const categoryFilter =
        document.getElementById("categoryFilter");

    const sortSelect =
        document.getElementById("sortSelect");

    const search =
        searchInput
            ? searchInput.value.trim().toLowerCase()
            : "";

    const category =
        categoryFilter
            ? categoryFilter.value
            : "";

    const sort =
        sortSelect
            ? sortSelect.value
            : "name";

    let result = contacts.filter(function (contact) {

        const searchable = [
            contact.name,
            contact.phone,
            contact.email,
            contact.category,
            contact.company,
            ...(contact.tags || [])
        ]
            .join(" ")
            .toLowerCase();

        return (
            searchable.includes(search) &&
            (!category || contact.category === category)
        );
    });

    if (sort === "name") {

        result.sort(function (a, b) {
            return String(a.name || "")
                .localeCompare(
                    String(b.name || "")
                );
        });
    }

    if (sort === "score") {

        result.sort(function (a, b) {
            return b.score - a.score;
        });
    }

    const contactCount =
        document.getElementById("contactCount");

    const contactsGrid =
        document.getElementById("contactsGrid");

    if (contactCount) {
        contactCount.textContent =
            result.length + " contacts";
    }

    if (contactsGrid) {

        contactsGrid.innerHTML =
            result.length
                ? result.map(contactCard).join("")
                : `
                    <div class="security-box">
                        No contacts found.
                    </div>
                `;
    }
}

// =====================================================
// CONTACT CARD
// =====================================================

function contactCard(c) {

    const health =
        c.score >= 80
            ? "Strong connection"
            : c.score >= 60
                ? "Good connection"
                : "Needs attention";

    const healthClass =
        c.score >= 80
            ? "green"
            : c.score >= 60
                ? "blue"
                : "red";

    const tags = Array.isArray(c.tags)
        ? c.tags
        : [];

    return `
        <div class="contact-card">

            <div class="contact-top">

                <div class="person">

                    <div class="avatar">
                        ${initials(c.name)}
                    </div>

                    <div>

                        <strong>
                            ${escapeHTML(c.name)}
                        </strong>

                        <small>
                            ${escapeHTML(c.category || "Other")}
                            ·
                            ${c.score}/100
                        </small>

                    </div>

                </div>

                <button
                    class="favorite-star ${c.favorite ? "on" : ""}"
                    onclick="toggleFavorite(${c.id})">

                    ${c.favorite ? "★" : "☆"}

                </button>

            </div>

            <div style="margin-top:10px">

                ${tags.map(function (tag) {

                    return `
                        <span class="tag">
                            #${escapeHTML(tag)}
                        </span>
                    `;

                }).join("")}

            </div>

            <div class="contact-meta">

                <div>
                    ☎ <b>
                        ${escapeHTML(c.phone || "Not added")}
                    </b>
                </div>

                <div>
                    ✉ <b>
                        ${escapeHTML(c.email || "Not added")}
                    </b>
                </div>

                <div>
                    ↻ Last update:
                    <b>
                        ${escapeHTML(formatDate(c.last))}
                    </b>
                </div>

            </div>

            <span class="pill ${healthClass}">
                ${health}
            </span>

            <div class="contact-actions">

                <button
                    class="btn small"
                    onclick="viewContact(${c.id})">
                    View
                </button>

                <button
                    class="btn small"
                    onclick="editContact(${c.id})">
                    Edit
                </button>

                <button
                    class="btn small danger"
                    onclick="deleteContact(${c.id})">
                    Delete
                </button>

            </div>

        </div>
    `;
}

// =====================================================
// FAVORITES
// =====================================================

function renderFavorites() {

    const favCategory =
        document.getElementById("favCategory");

    const favCount =
        document.getElementById("favCount");

    const favoritesGrid =
        document.getElementById("favoritesGrid");

    const category =
        favCategory
            ? favCategory.value
            : "";

    const result = contacts.filter(function (contact) {

        return (
            contact.favorite &&
            (!category ||
                contact.category === category)
        );
    });

    if (favCount) {
        favCount.textContent =
            result.length + " favorites";
    }

    if (favoritesGrid) {

        favoritesGrid.innerHTML =
            result.length
                ? result.map(contactCard).join("")
                : `
                    <div class="security-box">
                        No favorite contacts in this category.
                    </div>
                `;
    }
}

// =====================================================
// TOGGLE FAVORITE - BACKEND
// =====================================================

async function toggleFavorite(id) {

    const contact = contacts.find(function (c) {
        return Number(c.id) === Number(id);
    });

    if (!contact) {
        return;
    }

    try {

        const response = await fetch(
            `${API_BASE}/contacts/${id}/favorite`,
            {
                method: "PATCH"
            }
        );

        const data = await readResponse(response);

        if (!response.ok || !data.success) {
            throw new Error(
                data.error || "Failed to update favorite"
            );
        }

        contact.favorite = Boolean(data.favorite);

        renderContacts();
        renderFavorites();
        updateStats();

        showToast(
            contact.favorite
                ? "Added to favorites"
                : "Removed from favorites"
        );

    } catch (error) {

        console.error(
            "Favorite error:",
            error
        );

        showToast(
            error.message ||
            "Unable to update favorite"
        );
    }
}

// =====================================================
// UPDATE STATS
// =====================================================

function updateStats() {

    const statContacts =
        document.getElementById("statContacts");

    const statFav =
        document.getElementById("statFav");

    if (statContacts) {
        statContacts.textContent =
            contacts.length;
    }

    if (statFav) {

        statFav.textContent =
            contacts.filter(function (contact) {
                return contact.favorite;
            }).length;
    }
}

function renderRelationshipStats() {
    const scores = contacts.map(function (contact) {
        return Number(contact.score || 0);
    });
    const average = scores.length
        ? Math.round(scores.reduce(function (total, score) { return total + score; }, 0) / scores.length)
        : 0;
    const atRisk = scores.filter(function (score) { return score < 40; }).length;

    setText("statHealth", `${average}%`);
    setText("healthScore", average);
    setText("statRisk", atRisk);
}

function renderGraph() {
    const graph = document.querySelector("#graph .graph");
    const summary = document.querySelector("#graph .grid.two > .card:nth-child(2)");

    if (!graph || !summary) {
        return;
    }

    const nodes = contacts.slice(0, 12).map(function (contact, index, list) {
        const angle = -Math.PI / 2 + (index * Math.PI * 2) / list.length;
        return {
            contact,
            x: 50 + Math.cos(angle) * 35,
            y: 50 + Math.sin(angle) * 37
        };
    });

    graph.innerHTML = `
        <div class="section-head"><h2>Relationship Graph</h2><span class="pill blue">${contacts.length} contact${contacts.length === 1 ? "" : "s"}</span></div>
        ${nodes.length
            ? `<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${nodes.map(function (node) {
                return `<line x1="50" y1="50" x2="${node.x}" y2="${node.y}" stroke="#bfdbfe" stroke-width="0.45" />`;
            }).join("")}</svg>
            <div class="node" style="left:50%;top:50%"><div class="node-circle">YOU</div><strong>You</strong><small>Profile</small></div>
            ${nodes.map(function (node) {
                const score = Number(node.contact.score || 0);
                const strength = score >= 80 ? "Strong" : score >= 60 ? "Good" : score >= 40 ? "Needs attention" : "High risk";
                const id = Number(node.contact.id);
                return `<div class="node contact-node" role="button" tabindex="0" title="Open ${escapeHTML(node.contact.name)}" onclick="viewContact(${id})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();viewContact(${id})}" style="left:${node.x}%;top:${node.y}%"><div class="node-circle">${initials(node.contact.name)}</div><strong>${escapeHTML(node.contact.name)}</strong><small>${strength} · ${score}/100</small></div>`;
            }).join("")}`
            : '<div class="security-box" style="margin-top:24px">Add contacts to see your relationship network.</div>'}
    `;

    const bands = [
        { label: "Strong connection", test: (score) => score >= 80, style: "green" },
        { label: "Good connection", test: (score) => score >= 60 && score < 80, style: "blue" },
        { label: "Needs attention", test: (score) => score >= 40 && score < 60, style: "orange" },
        { label: "High risk", test: (score) => score < 40, style: "red" }
    ];

    summary.innerHTML = `
        <div class="section-head"><h2>Connection summary</h2></div>
        <div class="list">${bands.map(function (band) {
            const count = contacts.filter(function (contact) { return band.test(Number(contact.score || 0)); }).length;
            return `<div class="row"><span>${band.label}</span><span class="pill ${band.style}">${count}</span></div>`;
        }).join("")}</div>
        <div class="security-box" style="margin-top:20px">Scores are calculated from saved relationship data. Open a contact to review or update it.</div>
    `;
}

// =====================================================
// OPEN CONTACT MODAL
// =====================================================

function openContactModal(contact) {

    contact = contact || null;

    currentContact = contact;

    const title =
        document.getElementById(
            "contactModalTitle"
        );

    const editId =
        document.getElementById("editId");

    if (title) {

        title.textContent =
            contact
                ? "Edit Contact"
                : "Add Contact";
    }

    if (editId) {

        editId.value =
            contact
                ? contact.id
                : "";
    }

    setValue(
        "fName",
        contact ? contact.name : ""
    );

    setValue(
        "fPhone",
        contact ? contact.phone : ""
    );

    setValue(
        "fEmail",
        contact ? contact.email : ""
    );

    setValue(
        "fCategory",
        contact
            ? contact.category
            : "Friend"
    );

    setValue(
        "fTags",
        contact && Array.isArray(contact.tags)
            ? contact.tags.join(", ")
            : ""
    );

    setValue(
        "fCompany",
        contact ? contact.company : ""
    );

    setValue(
        "fJobTitle",
        contact ? contact.job_title : ""
    );

    setValue(
        "fAddress",
        contact ? contact.address : ""
    );

    setValue(
        "fNotes",
        contact ? contact.notes : ""
    );

    setValue(
        "fBirthday",
        contact ? contact.birthday : ""
    );

    setValue(
        "fWebsite",
        contact ? contact.website : ""
    );

    setValue(
        "fInstagram",
        contact ? contact.instagram : ""
    );

    setValue(
        "fLinkedin",
        contact ? contact.linkedin : ""
    );

    setValue(
        "fWhatsapp",
        contact ? contact.whatsapp : ""
    );

    const warning =
        document.getElementById(
            "contactWarning"
        );

    if (warning) {

        warning.innerHTML =
            "✓ Phone will be checked for duplicate contacts.";
    }

    const modal =
        document.getElementById(
            "contactModal"
        );

    if (modal) {
        modal.classList.add("show");
    }
}

// =====================================================
// SAVE CONTACT - POST / PUT
// =====================================================

async function saveContact(event) {

    if (event) {
        event.preventDefault();
    }

    const editIdElement =
        document.getElementById("editId");

    const id =
        editIdElement
            ? Number(editIdElement.value)
            : 0;

    const nameElement =
        document.getElementById("fName");

    const phoneElement =
        document.getElementById("fPhone");

    const categoryElement =
        document.getElementById("fCategory");

    const name =
        nameElement
            ? nameElement.value.trim()
            : "";

    const phone =
        phoneElement
            ? phoneElement.value.trim()
            : "";

    const category =
        categoryElement
            ? categoryElement.value
            : "";

    if (!name || !phone || !category) {

        showToast(
            "Name, phone and category are required"
        );

        return;
    }

    // =================================================
    // DUPLICATE PHONE CHECK
    // =================================================

    const normalizedPhone =
        phone.replace(/\D/g, "");

    const duplicate =
        contacts.find(function (contact) {

            const existingPhone =
                String(
                    contact.phone || ""
                ).replace(/\D/g, "");

            return (
                existingPhone === normalizedPhone &&
                Number(contact.id) !== id
            );
        });

    if (duplicate && settingEnabled("suspiciousWarnings")) {

        const warning =
            document.getElementById(
                "contactWarning"
            );

        if (warning) {

            warning.innerHTML =
                "⚠ Possible duplicate: this phone number already belongs to <b>" +
                escapeHTML(duplicate.name) +
                "</b>.";
        }

        const confirmed = await openConfirmDialog(
            "Possible duplicate contact found. Save anyway?",
            "Duplicate contact"
        );

        if (!confirmed) {
            return;
        }
    }

    // =================================================
    // CONTACT DATA
    // =================================================

    const contactData = {

        name: name,

        phone: phone,

        category: category,

        email: getValue("fEmail"),

        company: getValue("fCompany"),

        job_title: getValue("fJobTitle"),

        address: getValue("fAddress"),

        notes: getValue("fNotes"),

        birthday: getValue("fBirthday"),

        website: getValue("fWebsite"),

        instagram: getValue("fInstagram"),

        linkedin: getValue("fLinkedin"),

        whatsapp: getValue("fWhatsapp"),

        tags: getValue("fTags")
            .split(",")
            .map(function (tag) { return tag.trim(); })
            .filter(Boolean),

        favorite: id
            ? Boolean(
                contacts.find(function (c) {
                    return Number(c.id) === id;
                })?.favorite
            )
            : false
    };

    try {

        let response;

        // =================================================
        // EDIT
        // =================================================

        if (id) {

            response = await fetch(
                `${API_BASE}/contacts/${id}`,
                {
                    method: "PUT",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(
                            contactData
                        )
                }
            );

        }

        // =================================================
        // ADD
        // =================================================

        else {

            response = await fetch(
                `${API_BASE}/contacts`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(
                            contactData
                        )
                }
            );
        }

        const data =
            await readResponse(response);

        if (
            !response.ok ||
            !data.success
        ) {

            throw new Error(
                data.error ||
                "Failed to save contact"
            );
        }

        showToast(
            id
                ? "Contact updated successfully"
                : "Contact saved successfully"
        );

        // Reload from SQLite
        await loadContacts();

        // Close modal
        closeModal("contactModal");

        // Reset form
        const form =
            document.getElementById(
                "contactForm"
            );

        if (form) {
            form.reset();
        }

        if (editIdElement) {
            editIdElement.value = "";
        }

        currentContact = null;

    } catch (error) {

        console.error(
            "Save contact error:",
            error
        );

        showToast(
            error.message ||
            "Unable to save contact"
        );
    }
}

// =====================================================
// EDIT CONTACT
// =====================================================

function editContact(id) {

    const contact =
        contacts.find(function (c) {
            return Number(c.id) === Number(id);
        });

    if (!contact) {
        showToast("Contact not found");
        return;
    }

    openContactModal(contact);
}

// =====================================================
// DELETE CONTACT - BACKEND
// =====================================================

async function deleteContact(id) {

    const contact =
        contacts.find(function (c) {
            return Number(c.id) === Number(id);
        });

    if (!contact) {
        return;
    }

    const confirmed = await openConfirmDialog(
        "Delete " + contact.name + "?",
        "Delete contact"
    );

    if (!confirmed) {
        return;
    }

    try {

        const response =
            await fetch(
                `${API_BASE}/contacts/${id}`,
                {
                    method: "DELETE"
                }
            );

        const data =
            await readResponse(response);

        if (
            !response.ok ||
            !data.success
        ) {

            throw new Error(
                data.error ||
                "Failed to delete contact"
            );
        }

        contacts =
            contacts.filter(function (c) {
                return Number(c.id) !== Number(id);
            });

        renderContacts();
        renderFavorites();
        updateStats();

        showToast(
            "Contact deleted successfully"
        );

    } catch (error) {

        console.error(
            "Delete contact error:",
            error
        );

        showToast(
            error.message ||
            "Unable to delete contact"
        );
    }
}

// =====================================================
// VIEW CONTACT
// =====================================================

function viewContact(id) {

    currentContact =
        contacts.find(function (c) {
            return Number(c.id) === Number(id);
        });

    if (!currentContact) {
        return;
    }

    const c = currentContact;

    const detailsContent =
        document.getElementById(
            "detailsContent"
        );

    if (!detailsContent) {
        return;
    }

    const healthClass =
        c.score >= 80
            ? "green"
            : c.score >= 60
                ? "blue"
                : "red";

    const healthText =
        c.score >= 80
            ? "Strong connection"
            : c.score >= 60
                ? "Good connection"
                : "Needs attention";

    renderContactDetails(c, healthClass, healthText);

    const detailsModal =
        document.getElementById(
            "detailsModal"
        );

    if (detailsModal) {
        detailsModal.classList.add("show");
    }

    loadInteractionTimeline(c.id);
}

// =====================================================
// RENDER CONTACT DETAILS (without timeline, filled in async)
// =====================================================

function renderContactDetails(c, healthClass, healthText) {

    const detailsContent =
        document.getElementById(
            "detailsContent"
        );

    if (!detailsContent) {
        return;
    }

    detailsContent.innerHTML = `

        <div class="profile-head">

            <div class="avatar lg">
                ${initials(c.name)}
            </div>

            <div>

                <h2 style="margin:0">
                    ${escapeHTML(c.name)}
                </h2>

                <span class="muted">
                    ${escapeHTML(c.category || "Other")}
                    ·
                    ${c.score}/100
                </span>

            </div>

        </div>

        <div
            class="grid two"
            style="margin-top:20px">

            <div class="security-box">

                <b>☎ Phone</b>

                <br>

                ${escapeHTML(
                    c.phone || "Not added"
                )}

                <br><br>

                <b>✉ Email</b>

                <br>

                ${escapeHTML(
                    c.email || "Not added"
                )}

                <br><br>

                <b>Company</b>

                <br>

                ${escapeHTML(
                    c.company || "Not added"
                )}

                <br><br>

                <b>Notes</b>

                <br>

                ${escapeHTML(
                    c.notes || "No notes"
                )}

            </div>

            <div class="security-box">

                <b>Relationship health</b>

                <div
                    style="
                        font-size:30px;
                        font-weight:800;
                        margin:8px 0;
                    ">

                    ${c.score}/100

                </div>

                <span class="pill ${healthClass}">
                    ${healthText}
                </span>

                <p class="muted">

                    Last update:
                    ${escapeHTML(
                        formatDate(c.last)
                    )}

                </p>

            </div>

        </div>

        <div
            class="card"
            style="
                box-shadow:none;
                margin-top:15px;
            ">

            <div class="section-head">

                <h2>
                    Interaction history
                </h2>

                <button
                    class="btn small"
                    onclick="addInteraction(${c.id})">

                    + Interaction

                </button>

            </div>

            <div class="timeline" id="interactionTimeline">

                <div class="timeline-item">

                    <i class="timeline-dot"></i>

                    <p>
                        <small>Loading interaction history...</small>
                    </p>

                </div>

            </div>

        </div>

        <div class="modal-footer">

            <button
                class="btn"
                onclick="
                    openShareModal(currentContact);
                    closeModal('detailsModal');
                ">

                QR / vCard

            </button>

            <button
                class="btn"
                onclick="
                    openReminderModal(${c.id});
                    closeModal('detailsModal');
                ">

                Add follow-up

            </button>

            <button
                class="btn primary"
                onclick="
                    editContact(${c.id});
                    closeModal('detailsModal');
                ">

                Edit contact

            </button>

        </div>
    `;
}

// =====================================================
// LOAD + RENDER INTERACTION TIMELINE
// =====================================================

async function loadInteractionTimeline(contactId) {

    const timeline =
        document.getElementById(
            "interactionTimeline"
        );

    if (!timeline) {
        return;
    }

    try {

        const response =
            await fetch(
                `${API_BASE}/interactions?contact_id=${contactId}`
            );

        const data =
            await readResponse(response);

        if (
            !response.ok ||
            !data.success
        ) {
            throw new Error(
                data.error ||
                "Failed to load interactions"
            );
        }

        const items =
            data.interactions || [];

        if (!items.length) {

            timeline.innerHTML = `
                <div class="timeline-item">
                    <i class="timeline-dot"></i>
                    <p>
                        <small>No interactions logged yet.</small>
                    </p>
                </div>
            `;

            return;
        }

        timeline.innerHTML =
            items.map(function (item) {

                return `
                    <div class="timeline-item">

                        <i class="timeline-dot"></i>

                        <p>

                            <b>${escapeHTML(item.type || "Interaction")}</b>

                            ${item.description
                                ? " &middot; " + escapeHTML(item.description)
                                : ""}

                            <br>

                            <small>
                                ${escapeHTML(
                                    formatDate(item.interaction_date)
                                )}
                            </small>

                        </p>

                    </div>
                `;

            }).join("");

    } catch (error) {

        console.error(
            "Load interaction timeline error:",
            error
        );

        timeline.innerHTML = `
            <div class="timeline-item">
                <i class="timeline-dot"></i>
                <p>
                    <small>Unable to load interaction history.</small>
                </p>
            </div>
        `;
    }
}

// =====================================================
// CSV EXPORT
// =====================================================

const CSV_COLUMNS = [
    "name",
    "phone",
    "category",
    "email",
    "company",
    "job_title",
    "address",
    "notes",
    "birthday",
    "website",
    "instagram",
    "linkedin",
    "whatsapp",
    "tags"
];

function csvEscape(value) {

    const str =
        String(value ?? "");

    if (/[",\n]/.test(str)) {

        return (
            '"' +
            str.replace(/"/g, '""') +
            '"'
        );
    }

    return str;
}

function exportContactsCSV() {

    if (!contacts.length) {

        showToast(
            "No contacts to export"
        );

        return;
    }

    const rows = [
        CSV_COLUMNS.join(",")
    ];

    contacts.forEach(function (c) {

        rows.push(
            CSV_COLUMNS.map(function (col) {
                return csvEscape(c[col]);
            }).join(",")
        );
    });

    const csvContent =
        rows.join("\r\n");

    const blob =
        new Blob(
            [csvContent],
            { type: "text/csv;charset=utf-8;" }
        );

    const url =
        URL.createObjectURL(blob);

    const link =
        document.createElement("a");

    link.href = url;

    link.download =
        "contacts-" +
        new Date().toISOString().slice(0, 10) +
        ".csv";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);

    showToast(
        "Exported " + contacts.length + " contacts"
    );
}

// =====================================================
// CSV IMPORT
// =====================================================

// Minimal RFC4180-ish CSV parser: handles quoted fields,
// escaped quotes (""), commas and newlines inside quotes.
function parseCSV(text) {

    const rows = [];

    let row = [];

    let field = "";

    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {

        const char = text[i];

        if (inQuotes) {

            if (char === '"') {

                if (text[i + 1] === '"') {
                    field += '"';
                    i++;
                } else {
                    inQuotes = false;
                }

            } else {
                field += char;
            }

            continue;
        }

        if (char === '"') {
            inQuotes = true;
            continue;
        }

        if (char === ",") {
            row.push(field);
            field = "";
            continue;
        }

        if (char === "\n" || char === "\r") {

            if (char === "\r" && text[i + 1] === "\n") {
                i++;
            }

            row.push(field);
            field = "";
            rows.push(row);
            row = [];
            continue;
        }

        field += char;
    }

    if (field.length || row.length) {
        row.push(field);
        rows.push(row);
    }

    return rows.filter(function (r) {
        return r.some(function (cell) {
            return cell.trim() !== "";
        });
    });
}

async function importContactsCSV(event) {

    const file =
        event.target.files[0];

    if (!file) {
        return;
    }

    try {

        const text =
            await file.text();

        const rows =
            parseCSV(text);

        if (rows.length < 2) {

            showToast(
                "CSV file has no data rows"
            );

            return;
        }

        const header =
            rows[0].map(function (h) {
                return h.trim().toLowerCase();
            });

        const dataRows =
            rows.slice(1);

        let successCount = 0;
        let failCount = 0;

        for (const rawRow of dataRows) {

            const record = {};

            header.forEach(function (col, index) {
                record[col] = rawRow[index] || "";
            });

            if (!record.name || !record.phone) {
                failCount++;
                continue;
            }

            const contactData = {
                name: record.name,
                phone: record.phone,
                category: record.category || "Friend",
                email: record.email || "",
                company: record.company || "",
                job_title: record.job_title || "",
                address: record.address || "",
                notes: record.notes || "",
                birthday: record.birthday || "",
                website: record.website || "",
                instagram: record.instagram || "",
                linkedin: record.linkedin || "",
                whatsapp: record.whatsapp || "",
                tags: (record.tags || "")
                    .split(/[;,]/)
                    .map(function (tag) { return tag.trim(); })
                    .filter(Boolean)
            };

            try {

                const response =
                    await fetch(
                        `${API_BASE}/contacts`,
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body: JSON.stringify(contactData)
                        }
                    );

                const data =
                    await readResponse(response);

                if (
                    !response.ok ||
                    !data.success
                ) {
                    failCount++;
                } else {
                    successCount++;
                }

            } catch (rowError) {
                failCount++;
            }
        }

        await loadContacts();

        showToast(
            "Imported " +
            successCount +
            " contact" +
            (successCount === 1 ? "" : "s") +
            (failCount ? (", " + failCount + " skipped") : "")
        );

    } catch (error) {

        console.error(
            "CSV import error:",
            error
        );

        showToast(
            "Unable to read CSV file"
        );

    } finally {

        event.target.value = "";
    }
}

// =====================================================
// GROUPS
// =====================================================

async function loadGroups() {

    try {

        const response =
            await fetch(`${API_BASE}/groups`);

        const data =
            await readResponse(response);

        if (
            !response.ok ||
            !data.success
        ) {
            throw new Error(
                data.error ||
                "Failed to load groups"
            );
        }

        groups =
            (data.groups || []).map(function (g) {
                return {
                    id: Number(g.id),
                    name: g.name,
                    contact_count:
                        Number(g.contact_count || 0)
                };
            });

        renderGroupsList();

    } catch (error) {

        console.error(
            "Load groups error:",
            error
        );

        showToast(
            "Unable to load groups"
        );
    }
}

function renderGroupsList() {

    const container =
        document.getElementById(
            "groupsList"
        );

    if (!container) {
        return;
    }

    if (!groups.length) {

        container.innerHTML = `
            <div class="security-box">
                No groups yet. Create one to start organizing contacts.
            </div>
        `;

        return;
    }

    container.innerHTML =
        groups.map(function (g) {

            return `
                <div class="row">

                    <div class="person">
                        <div>
                            <strong>
                                ${escapeHTML(g.name)}
                            </strong>
                            <small>
                                ${g.contact_count} contact${g.contact_count === 1 ? "" : "s"}
                            </small>
                        </div>
                    </div>

                    <button
                        class="btn small"
                        onclick="openGroupDetail(${g.id})">
                        View
                    </button>

                </div>
            `;

        }).join("");
}

async function createGroup() {

    const name = await openPromptDialog({
        title: "Create group",
        label: "Group name",
        placeholder: "VIP clients"
    });

    if (!name || !name.trim()) {
        return;
    }

    try {

        const response =
            await fetch(
                `${API_BASE}/groups`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        name: name.trim()
                    })
                }
            );

        const data =
            await readResponse(response);

        if (
            !response.ok ||
            !data.success
        ) {
            throw new Error(
                data.error ||
                "Failed to create group"
            );
        }

        showToast(
            "Group created"
        );

        await loadGroups();

    } catch (error) {

        console.error(
            "Create group error:",
            error
        );

        showToast(
            error.message ||
            "Unable to create group"
        );
    }
}

async function openGroupDetail(groupId) {

    currentGroupId =
        Number(groupId);

    try {

        const response =
            await fetch(
                `${API_BASE}/groups/${groupId}`
            );

        const data =
            await readResponse(response);

        if (
            !response.ok ||
            !data.success
        ) {
            throw new Error(
                data.error ||
                "Failed to load group"
            );
        }

        const group =
            data.group;

        const card =
            document.getElementById(
                "groupDetailCard"
            );

        if (card) {
            card.style.display = "block";
        }

        setText(
            "groupDetailTitle",
            group.name
        );

        setText(
            "groupDetailSubtitle",
            group.contacts.length +
                " contact" +
                (group.contacts.length === 1 ? "" : "s")
        );

        const contactsList =
            document.getElementById(
                "groupDetailContacts"
            );

        if (contactsList) {

            contactsList.innerHTML =
                group.contacts.length
                    ? group.contacts.map(function (c) {

                        return `
                            <div class="row">

                                <div class="person">
                                    <div class="avatar">
                                        ${initials(c.name)}
                                    </div>
                                    <div>
                                        <strong>${escapeHTML(c.name)}</strong>
                                        <small>${escapeHTML(c.phone || "")}</small>
                                    </div>
                                </div>

                                <button
                                    class="btn small danger"
                                    onclick="removeContactFromGroup(${c.id})">
                                    Remove
                                </button>

                            </div>
                        `;

                    }).join("")
                    : `
                        <div class="security-box">
                            No contacts in this group yet.
                        </div>
                    `;
        }

        const groupContactIds =
            new Set(
                group.contacts.map(function (c) {
                    return Number(c.id);
                })
            );

        const select =
            document.getElementById(
                "groupAddContactSelect"
            );

        if (select) {

            select.innerHTML =
                `<option value="">Add contact...</option>` +
                contacts
                    .filter(function (c) {
                        return !groupContactIds.has(
                            Number(c.id)
                        );
                    })
                    .map(function (c) {
                        return `
                            <option value="${c.id}">
                                ${escapeHTML(c.name)}
                            </option>
                        `;
                    })
                    .join("");
        }

    } catch (error) {

        console.error(
            "Load group detail error:",
            error
        );

        showToast(
            "Unable to load group"
        );
    }
}

async function addSelectedContactToGroup() {

    if (!currentGroupId) {
        return;
    }

    const select =
        document.getElementById(
            "groupAddContactSelect"
        );

    const contactId =
        select ? select.value : "";

    if (!contactId) {

        showToast(
            "Select a contact to add"
        );

        return;
    }

    try {

        const response =
            await fetch(
                `${API_BASE}/groups/${currentGroupId}/contacts/${contactId}`,
                { method: "POST" }
            );

        const data =
            await readResponse(response);

        if (
            !response.ok ||
            !data.success
        ) {
            throw new Error(
                data.error ||
                "Failed to add contact"
            );
        }

        showToast(
            "Contact added to group"
        );

        await openGroupDetail(currentGroupId);
        await loadGroups();

    } catch (error) {

        console.error(
            "Add contact to group error:",
            error
        );

        showToast(
            error.message ||
            "Unable to add contact"
        );
    }
}

async function removeContactFromGroup(contactId) {

    if (!currentGroupId) {
        return;
    }

    try {

        const response =
            await fetch(
                `${API_BASE}/groups/${currentGroupId}/contacts/${contactId}`,
                { method: "DELETE" }
            );

        const data =
            await readResponse(response);

        if (
            !response.ok ||
            !data.success
        ) {
            throw new Error(
                data.error ||
                "Failed to remove contact"
            );
        }

        showToast(
            "Contact removed from group"
        );

        await openGroupDetail(currentGroupId);
        await loadGroups();

    } catch (error) {

        console.error(
            "Remove contact from group error:",
            error
        );

        showToast(
            error.message ||
            "Unable to remove contact"
        );
    }
}

async function deleteCurrentGroup() {

    if (!currentGroupId) {
        return;
    }

    const confirmed = await openConfirmDialog(
        "Delete this group? Contacts themselves will not be deleted.",
        "Delete group"
    );

    if (!confirmed) {
        return;
    }

    try {

        const response =
            await fetch(
                `${API_BASE}/groups/${currentGroupId}`,
                { method: "DELETE" }
            );

        const data =
            await readResponse(response);

        if (
            !response.ok ||
            !data.success
        ) {
            throw new Error(
                data.error ||
                "Failed to delete group"
            );
        }

        showToast(
            "Group deleted"
        );

        currentGroupId = null;

        const card =
            document.getElementById(
                "groupDetailCard"
            );

        if (card) {
            card.style.display = "none";
        }

        await loadGroups();

    } catch (error) {

        console.error(
            "Delete group error:",
            error
        );

        showToast(
            error.message ||
            "Unable to delete group"
        );
    }
}

// =====================================================
// BIRTHDAYS
// =====================================================

// Given a birthday string ("YYYY-MM-DD" or similar parseable date),
// returns { days, nextDate, turningAge } for the next occurrence,
// or null if there's no usable birthday.
function nextBirthdayInfo(birthday) {

    if (!birthday) {
        return null;
    }

    const original =
        new Date(birthday);

    if (
        Number.isNaN(
            original.getTime()
        )
    ) {
        return null;
    }

    const today =
        new Date();

    today.setHours(0, 0, 0, 0);

    let next =
        new Date(
            today.getFullYear(),
            original.getMonth(),
            original.getDate()
        );

    if (next < today) {

        next =
            new Date(
                today.getFullYear() + 1,
                original.getMonth(),
                original.getDate()
            );
    }

    const msPerDay =
        1000 * 60 * 60 * 24;

    const days =
        Math.round(
            (next - today) / msPerDay
        );

    const turningAge =
        next.getFullYear() -
        original.getFullYear();

    return {
        days: days,
        nextDate: next,
        turningAge: turningAge
    };
}

// Returns contacts with an upcoming birthday within `withinDays`,
// sorted soonest first. Each item includes the contact plus
// `daysUntil`, `nextDate`, and `turningAge`.
function getUpcomingBirthdays(withinDays) {

    withinDays =
        withinDays || 30;

    return contacts
        .map(function (c) {

            const info =
                nextBirthdayInfo(
                    c.birthday
                );

            if (!info) {
                return null;
            }

            return {
                contact: c,
                daysUntil: info.days,
                nextDate: info.nextDate,
                turningAge: info.turningAge
            };
        })
        .filter(function (item) {
            return (
                item &&
                item.daysUntil <= withinDays
            );
        })
        .sort(function (a, b) {
            return a.daysUntil - b.daysUntil;
        });
}

function formatBirthdayWhen(daysUntil) {

    if (daysUntil === 0) {
        return "Today";
    }

    if (daysUntil === 1) {
        return "Tomorrow";
    }

    return "In " + daysUntil + " days";
}

function renderUpcomingBirthdays() {

    const container =
        document.getElementById(
            "upcomingBirthdaysList"
        );

    if (!container) {
        return;
    }

    if (!settingEnabled("birthdayReminders")) {
        container.innerHTML = `
            <div class="security-box">
                Birthday reminders are off in Settings.
            </div>
        `;
        return;
    }

    const upcoming =
        getUpcomingBirthdays(30);

    if (!upcoming.length) {

        container.innerHTML = `
            <div class="security-box">
                No birthdays in the next 30 days.
            </div>
        `;

        return;
    }

    container.innerHTML =
        upcoming.map(function (item) {

            const c =
                item.contact;

            return `
                <div class="row">

                    <div class="person">

                        <div class="avatar">
                            ${initials(c.name)}
                        </div>

                        <div>

                            <strong>
                                ${escapeHTML(c.name)}
                            </strong>

                            <small>
                                ${formatBirthdayWhen(item.daysUntil)}
                                &middot;
                                turning ${item.turningAge}
                            </small>

                        </div>

                    </div>

                    <button
                        class="btn small"
                        onclick="
                            openReminderModal(
                                ${c.id},
                                {
                                    text: 'Wish ${escapeHTML(c.name).replace(/'/g, "\\'")} a happy birthday',
                                    date: '${item.nextDate.toISOString().slice(0, 10)}',
                                    type: 'Birthday'
                                }
                            )
                        ">
                        + Reminder
                    </button>

                </div>
            `;

        }).join("");
}

// =====================================================
// DASHBOARD AI RECOMMENDATIONS (computed from real data)
// =====================================================

function renderAIRecommendations() {

    const container =
        document.getElementById(
            "aiRecommendations"
        );

    if (!container) {
        return;
    }

    if (!settingEnabled("aiRecommendations")) {
        container.innerHTML = `
            <div class="recommend">
                Recommendations are off in Settings.
            </div>
        `;
        return;
    }

    const items = [];

    // Most overdue contact (oldest last-updated)
    const sortedByLast =
        [...contacts]
            .filter(function (c) {
                return c.last;
            })
            .sort(function (a, b) {
                return (
                    new Date(a.last) -
                    new Date(b.last)
                );
            });

    if (sortedByLast.length) {

        const stalest =
            sortedByLast[0];

        const daysSince =
            Math.round(
                (new Date() - new Date(stalest.last)) /
                (1000 * 60 * 60 * 24)
            );

        items.push(
            "☎ Follow up with <b>" +
            escapeHTML(stalest.name) +
            "</b> — last update " +
            (daysSince >= 0 ? daysSince + " days ago" : "recently") +
            "."
        );
    }

    // Upcoming birthdays
    const upcoming =
        getUpcomingBirthdays(14);

    if (upcoming.length) {

        const next =
            upcoming[0];

        items.push(
            "🎂 <b>" +
            escapeHTML(next.contact.name) +
            "</b> has a birthday " +
            formatBirthdayWhen(next.daysUntil).toLowerCase() +
            "."
        );
    }

    // High-risk relationships
    const risky =
        contacts.filter(function (c) {
            return c.score < 40;
        });

    if (risky.length) {

        items.push(
            "⚠ Review <b>" +
            risky.length +
            " high-risk relationship" +
            (risky.length === 1 ? "" : "s") +
            "</b>."
        );
    }

    if (!items.length) {

        container.innerHTML = `
            <div class="recommend">
                No recommendations right now — everything looks up to date.
            </div>
        `;

        return;
    }

    container.innerHTML =
        items.map(function (text) {

            return `
                <div class="recommend">
                    ${text}
                </div>
            `;

        }).join("");
}

function renderLocalInsights() {
    const section = document.getElementById("insights");

    if (!section) {
        return;
    }

    const scores = contacts.map(function (contact) {
        return Number(contact.score || 0);
    });
    const averageScore = scores.length
        ? Math.round(scores.reduce(function (total, score) { return total + score; }, 0) / scores.length)
        : 0;
    const atRiskCount = scores.filter(function (score) { return score < 40; }).length;
    const now = new Date();
    const nextWeek = new Date(now);
    nextWeek.setDate(now.getDate() + 7);
    const followUps = reminders.filter(function (reminder) {
        const date = new Date(`${reminder.date}T00:00:00`);
        return !reminder.done && !Number.isNaN(date.getTime()) && date <= nextWeek;
    }).length;
    const seenPhones = new Set();
    let duplicateCount = 0;

    contacts.forEach(function (contact) {
        const phone = String(contact.phone || "").replace(/\D/g, "");
        const email = String(contact.email || "").trim().toLowerCase();
        const keys = [phone && `phone:${phone}`, email && `email:${email}`].filter(Boolean);

        if (keys.some(function (key) { return seenPhones.has(key); })) {
            duplicateCount++;
        }

        keys.forEach(function (key) { seenPhones.add(key); });
    });

    const nextBirthday = settingEnabled("birthdayReminders")
        ? getUpcomingBirthdays(14)[0]
        : null;
    const suggestions = [];

    if (followUps) {
        suggestions.push(`${followUps} follow-up${followUps === 1 ? "" : "s"} due this week.`);
    }
    if (nextBirthday) {
        suggestions.push(`${escapeHTML(nextBirthday.contact.name)} has a birthday ${formatBirthdayWhen(nextBirthday.daysUntil).toLowerCase()}.`);
    }
    if (atRiskCount) {
        suggestions.push(`${atRiskCount} contact${atRiskCount === 1 ? "" : "s"} have a relationship score below 40.`);
    }
    if (duplicateCount) {
        suggestions.push(`${duplicateCount} possible duplicate contact${duplicateCount === 1 ? "" : "s"} found by phone or email.`);
    }

    section.innerHTML = `
        <div class="grid stats">
            <div class="card stat"><div><div class="stat-label">Average relationship score</div><div class="stat-value">${averageScore}</div><span class="pill ${averageScore >= 70 ? "green" : "orange"}">${contacts.length ? "From your contacts" : "No contacts"}</span></div><div class="stat-icon">♥</div></div>
            <div class="card stat"><div><div class="stat-label">Follow-up opportunities</div><div class="stat-value">${followUps}</div><span class="pill orange">Next 7 days</span></div><div class="stat-icon">↗</div></div>
            <div class="card stat"><div><div class="stat-label">Low relationship scores</div><div class="stat-value">${atRiskCount}</div><span class="pill red">Below 40</span></div><div class="stat-icon">!</div></div>
            <div class="card stat"><div><div class="stat-label">Possible duplicates</div><div class="stat-value">${duplicateCount}</div><span class="pill blue">Phone or email</span></div><div class="stat-icon">◈</div></div>
        </div>
        <div class="card" style="margin-top:18px">
            <div class="section-head"><h2>Local insights</h2><span class="muted">Calculated from saved contacts and reminders</span></div>
            ${suggestions.length
                ? suggestions.map(function (suggestion) { return `<div class="recommend">${suggestion}</div>`; }).join("")
                : '<div class="recommend">No follow-ups, birthdays, low scores or duplicates need attention right now.</div>'}
            <p class="muted">AI-generated insights require an AI provider configured on the backend.</p>
        </div>
    `;
}

// =====================================================
// REMINDERS
// =====================================================

function renderReminders() {

    const container =
        document.getElementById(
            "remindersList"
        );

    if (!container) {
        return;
    }

    if (!reminders.length) {

        container.innerHTML = `
            <div class="security-box">
                No reminders yet.
            </div>
        `;

        return;
    }

    container.innerHTML =
        reminders.map(function (r) {

            return `

                <div class="row">

                    <div class="person">

                        <button
                            class="btn small"
                            onclick="
                                toggleReminder(${r.id})
                            ">

                            ${r.done ? "✓" : "○"}

                        </button>

                        <div>

                            <strong
                                style="
                                    ${r.done
                                        ? "text-decoration:line-through;color:#94a3b8;"
                                        : ""
                                    }
                                ">

                                ${escapeHTML(r.text)}

                            </strong>

                            <small>

                                ${escapeHTML(r.date)}

                                ${r.time
                                    ? " · " +
                                      escapeHTML(r.time)
                                    : ""
                                }

                                ·

                                ${escapeHTML(
                                    r.type || "Reminder"
                                )}

                            </small>

                        </div>

                    </div>

                    <button
                        class="btn small danger"
                        onclick="
                            deleteReminder(${r.id})
                        ">

                        Delete

                    </button>

                </div>

            `;

        }).join("");
}

// =====================================================
// OPEN REMINDER MODAL
// =====================================================

function openReminderModal(contactId, prefill) {

    prefill = prefill || {};

    const modal =
        document.getElementById(
            "reminderModal"
        );

    if (modal) {
        modal.classList.add("show");
    }

    const contactSelect =
        document.getElementById(
            "rContact"
        );

    if (contactSelect) {

        contactSelect.innerHTML =
            `<option value="">Select contact</option>` +
            contacts.map(function (c) {

                return `
                    <option value="${c.id}">
                        ${escapeHTML(c.name)}
                    </option>
                `;

            }).join("");

        if (contactId) {
            contactSelect.value =
                String(contactId);
        }
    }

    setValue(
        "rText",
        prefill.text || ""
    );

    setValue(
        "rDate",
        prefill.date || ""
    );

    setValue(
        "rTime",
        ""
    );

    const typeElement =
        document.getElementById("rType");

    if (typeElement) {
        typeElement.value =
            prefill.type || "Follow-up";
    }
}

// =====================================================
// SAVE REMINDER
// =====================================================

async function saveReminder() {

    const text =
        getValue("rText");

    const date =
        getValue("rDate");

    const time =
        getValue("rTime");

    const typeElement =
        document.getElementById("rType");

    const type =
        typeElement
            ? typeElement.value
            : "Reminder";

    const contactElement =
        document.getElementById(
            "rContact"
        );

    const contactId =
        contactElement
            ? contactElement.value
            : "";

    if (!text) {

        showToast(
            "Enter a reminder first"
        );

        return;
    }

    if (!date) {

        showToast(
            "Select a reminder date"
        );

        return;
    }

    try {

        const response =
            await fetch(
                `${API_BASE}/reminders`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        contact_id:
                            contactId
                                ? Number(contactId)
                                : null,

                        title: text,

                        reminder_date:
                            date,

                        reminder_time:
                            time,

                        notes: type
                    })
                }
            );

        const data =
            await readResponse(response);

        if (
            !response.ok ||
            !data.success
        ) {

            throw new Error(
                data.error ||
                "Failed to create reminder"
            );
        }

        await loadReminders();

        closeModal(
            "reminderModal"
        );

        showToast(
            "Reminder added successfully"
        );

    } catch (error) {

        console.error(
            "Reminder error:",
            error
        );

        showToast(
            error.message ||
            "Unable to add reminder"
        );
    }
}

// =====================================================
// TOGGLE REMINDER
// =====================================================

async function toggleReminder(id) {

    const reminder =
        reminders.find(function (r) {
            return Number(r.id) === Number(id);
        });

    if (!reminder) {
        return;
    }

    if (reminder.done) {
        return;
    }

    try {

        const response =
            await fetch(
                `${API_BASE}/reminders/${id}/complete`,
                {
                    method: "PATCH"
                }
            );

        const data =
            await readResponse(response);

        if (
            !response.ok ||
            !data.success
        ) {

            throw new Error(
                data.error ||
                "Failed to complete reminder"
            );
        }

        await loadReminders();

        showToast(
            "Reminder completed"
        );

    } catch (error) {

        console.error(
            "Complete reminder error:",
            error
        );

        showToast(
            "Unable to complete reminder"
        );
    }
}

// =====================================================
// DELETE REMINDER
// =====================================================

async function deleteReminder(id) {

    const confirmed = await openConfirmDialog(
        "Delete this reminder?",
        "Delete reminder"
    );

    if (!confirmed) {
        return;
    }

    try {

        const response =
            await fetch(
                `${API_BASE}/reminders/${id}`,
                {
                    method: "DELETE"
                }
            );

        const data =
            await readResponse(response);

        if (
            !response.ok ||
            !data.success
        ) {

            throw new Error(
                data.error ||
                "Failed to delete reminder"
            );
        }

        await loadReminders();

        showToast(
            "Reminder deleted"
        );

    } catch (error) {

        console.error(
            "Delete reminder error:",
            error
        );

        showToast(
            "Unable to delete reminder"
        );
    }
}

// =====================================================
// INTERACTION
// =====================================================

async function addInteraction(contactId) {

    const type = await openPromptDialog({
        title: "Add interaction",
        label: "Interaction type",
        defaultValue: "Call",
        placeholder: "Call, Message, Meeting, Email"
    });

    if (!type) {
        return;
    }

    const description = await openPromptDialog({
        title: "Add interaction",
        label: "Short description",
        placeholder: "Discussed roadmap and next steps"
    }) || "";

    try {

        const response =
            await fetch(
                `${API_BASE}/interactions`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        contact_id:
                            Number(contactId),

                        type: type,

                        description:
                            description,

                        interaction_date:
                            new Date().toISOString()
                    })
                }
            );

        const data =
            await readResponse(response);

        if (
            !response.ok ||
            !data.success
        ) {

            throw new Error(
                data.error ||
                "Failed to add interaction"
            );
        }

        await loadContacts();

        await loadInteractionTimeline(contactId);

        showToast(
            "Interaction added"
        );

    } catch (error) {

        console.error(
            "Interaction error:",
            error
        );

        showToast(
            "Unable to add interaction"
        );
    }
}

// =====================================================
// AI ASSISTANT
// =====================================================

  async function sendChat() {
    const input = document.getElementById("chatInput");
    const chat = document.getElementById("chat");

    if (!input || !chat || input.disabled) {
        return;
    }

    const question = input.value.trim();

    if (!question) {
        return;
    }

    const userBubble = document.createElement("div");
    userBubble.className = "bubble me";
    userBubble.textContent = question;
    chat.appendChild(userBubble);

    const aiBubble = document.createElement("div");
    aiBubble.className = "bubble ai";
    aiBubble.textContent = "Thinking...";
    chat.appendChild(aiBubble);

    const messages = [...chat.querySelectorAll(".bubble")]
        .slice(-13, -2)
        .map(function (bubble) {
            return {
                role: bubble.classList.contains("me")
                    ? "user"
                    : "assistant",
                content: bubble.textContent
            };
        });

    messages.push({
        role: "user",
        content: question
    });

    // Give the assistant useful Contact Connect Hub context
    const context = {
        contacts: contacts.map(function (contact) {
            return {
                name: contact.name,
                category: contact.category,
                company: contact.company,
                job_title: contact.job_title,
                birthday: contact.birthday,
                tags: contact.tags,
                favorite: contact.favorite,
                score: contact.score,
                last: contact.last
            };
        }),

        reminders: reminders.map(function (reminder) {
            return {
                text: reminder.text,
                date: reminder.date,
                time: reminder.time,
                type: reminder.type,
                done: reminder.done,
                contact_id: reminder.contact_id
            };
        })
    };

    input.value = "";
    input.disabled = true;
    chat.scrollTop = chat.scrollHeight;

    try {
        const response = await fetch(`${API_BASE}/assistant`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                messages: messages,
                context: context
            })
        });

        const data = await readResponse(response);

        if (!response.ok || !data.success) {
            throw new Error(
                data.error ||
                "The assistant could not answer."
            );
        }

        aiBubble.textContent = data.answer;

    } catch (error) {

        aiBubble.textContent =
            error.message ||
            "Unable to reach the assistant. Please try again.";

    } finally {

        input.disabled = false;
        input.focus();
        chat.scrollTop = chat.scrollHeight;
    }
}
    
function openAssistant() {

    showPage("assistant");

    const input =
        document.getElementById(
            "chatInput"
        );

    if (input) {
        input.focus();
    }
}

// =====================================================
// PROFILE
// =====================================================

function getMyProfile() {

    const name =
        getValue("profileName");

    const phone =
        getValue("profilePhone");

    const email =
        getValue("profileEmail");

    const category =
        getValue("profileCategory");

    return {

        name:
            name ||
            "Akshara Prajapati",

        phone:
            phone ||
            "+91 98XXXXXX21",

        email:
            email ||
            "akshara@example.com",

        category:
            category ||
            "Personal",

        notes:
            "My Profile",

        tags: []
    };
}

// =====================================================
// LOAD PROFILE
// =====================================================

async function loadProfile() {

    try {

        const response =
            await fetch(
                `${API_BASE}/profile`
            );

        const data =
            await readResponse(response);

        if (
            !response.ok ||
            !data.success
        ) {
            throw new Error(
                data.error ||
                "Failed to load profile"
            );
        }

        const profile =
            data.profile;

        if (!profile) {
            return;
        }

        setValue(
            "profileName",
            profile.name || ""
        );

        setValue(
            "profilePhone",
            profile.phone || ""
        );

        setValue(
            "profileEmail",
            profile.email || ""
        );

        setValue(
            "profileCategory",
            profile.category || "Personal"
        );

        setValue(
            "profileCompany",
            profile.company || ""
        );

        setValue(
            "profileJobTitle",
            profile.job_title || ""
        );

        setValue(
            "profileAddress",
            profile.address || ""
        );

        setValue(
            "profileWebsite",
            profile.website || ""
        );

        setValue(
            "profileInstagram",
            profile.instagram || ""
        );

        setValue(
            "profileLinkedin",
            profile.linkedin || ""
        );

        setValue(
            "profileWhatsapp",
            profile.whatsapp || ""
        );

        setValue(
            "profileBio",
            profile.bio || ""
        );

        updateProfileDisplay();

    } catch (error) {

        console.error(
            "Load profile error:",
            error
        );
    }
}

// =====================================================
// SAVE PROFILE
// =====================================================

async function saveProfile() {

    const name =
        getValue("profileName");

    if (!name) {

        showToast(
            "Please enter your name"
        );

        return;
    }

    const profileData = {

        name: name,

        phone:
            getValue("profilePhone"),

        email:
            getValue("profileEmail"),

        company:
            getValue("profileCompany"),

        job_title:
            getValue("profileJobTitle"),

        address:
            getValue("profileAddress"),

        website:
            getValue("profileWebsite"),

        instagram:
            getValue("profileInstagram"),

        linkedin:
            getValue("profileLinkedin"),

        whatsapp:
            getValue("profileWhatsapp"),

        bio:
            getValue("profileBio")
    };

    try {

        const response =
            await fetch(
                `${API_BASE}/profile`,
                {
                    method: "PUT",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(
                            profileData
                        )
                }
            );

        const data =
            await readResponse(response);

        if (
            !response.ok ||
            !data.success
        ) {

            throw new Error(
                data.error ||
                "Failed to save profile"
            );
        }

        updateProfileDisplay();

        generateProfileQR();

        showToast(
            "Profile saved successfully"
        );

    } catch (error) {

        console.error(
            "Save profile error:",
            error
        );

        showToast(
            error.message ||
            "Unable to save profile"
        );
    }
}

// =====================================================
// UPDATE PROFILE DISPLAY
// =====================================================

function updateProfileDisplay() {

    const name =
        getValue("profileName") ||
        "Akshara Prajapati";

    const heading =
        document.getElementById(
            "profileHeading"
        );

    if (heading) {
        heading.textContent =
            name;
    }

    const sidebarName =
        document.getElementById(
            "sidebarProfileName"
        );

    if (sidebarName) {
        sidebarName.textContent =
            name;
    }
}

// =====================================================
// VCARD ESCAPING
// =====================================================

function escapeVCard(value) {

    return String(value || "")
        .replace(/\\/g, "\\\\")
        .replace(/\r?\n/g, "\\n")
        .replace(/;/g, "\\;")
        .replace(/,/g, "\\,");
}

// =====================================================
// BUILD VCARD
// =====================================================

function buildVCard(
    profile,
    selectedValues
) {

    if (!profile) {
        return "";
    }

    const fields =
        selectedValues || [
            "name",
            "phone",
            "email",
            "category"
        ];

    let vcard =
        "BEGIN:VCARD\n" +
        "VERSION:3.0";

    fields.forEach(
        function (field) {

            if (
                field === "name" &&
                profile.name
            ) {

                vcard +=
                    "\nFN:" +
                    escapeVCard(
                        profile.name
                    );
            }

            if (
                field === "phone" &&
                profile.phone
            ) {

                vcard +=
                    "\nTEL:" +
                    escapeVCard(
                        profile.phone
                    );
            }

            if (
                field === "email" &&
                profile.email
            ) {

                vcard +=
                    "\nEMAIL:" +
                    escapeVCard(
                        profile.email
                    );
            }

            if (
                field === "category" &&
                profile.category
            ) {

                vcard +=
                    "\nCATEGORIES:" +
                    escapeVCard(
                        profile.category
                    );
            }

            if (
                field === "notes" &&
                profile.notes
            ) {

                vcard +=
                    "\nNOTE:" +
                    escapeVCard(
                        profile.notes
                    );
            }

            if (
                field === "tags" &&
                profile.tags &&
                profile.tags.length
            ) {

                vcard +=
                    "\nX-TAGS:" +
                    escapeVCard(
                        profile.tags.join(", ")
                    );
            }
        }
    );

    vcard +=
        "\nEND:VCARD";

    return vcard;
}

// =====================================================
// PROFILE QR
// =====================================================

function generateProfileQR() {

    const profile =
        getMyProfile();

    const qrBox =
        document.getElementById(
            "profileQR"
        );

    if (!qrBox) {
        return;
    }

    qrBox.innerHTML = "";

    if (
        typeof QRCode ===
        "undefined"
    ) {

        qrBox.innerHTML = `
            <div class="security-box">
                QR library could not be loaded.
            </div>
        `;

        return;
    }

    const vcard =
        buildVCard(profile);

    new QRCode(
        qrBox,
        {
            text: vcard,
            width: 280,
            height: 280,
            correctLevel:
                QRCode.CorrectLevel.M
        }
    );
}

// =====================================================
// SHARE MODAL
// =====================================================

function openShareModal(contact) {

    if (contact) {

        shareMode =
            "contact";

        currentContact =
            contact;

    } else {

        shareMode =
            "profile";

        currentContact =
            getMyProfile();
    }

    document
        .querySelectorAll(
            ".share-field"
        )
        .forEach(
            function (field) {

                field.checked =
                    !settingEnabled("selectiveSharing") ||
                    field.value === "name" ||
                    field.value === "phone";
                field.disabled = !settingEnabled("selectiveSharing");
            }
        );

    const generatedQR =
        document.getElementById(
            "generatedQR"
        );

    if (generatedQR) {
        generatedQR.innerHTML = "";
    }

    const modal =
        document.getElementById(
            "shareModal"
        );

    if (modal) {
        modal.classList.add("show");
    }
}

// =====================================================
// GENERATE QR
// =====================================================

function generateQR() {

    const profile =
        shareMode === "profile"
            ? getMyProfile()
            : currentContact;

    if (!profile) {

        showToast(
            "No contact information found"
        );

        return;
    }

    const selectedFields =
        Array.from(
            document.querySelectorAll(
                ".share-field:checked"
            )
        ).map(
            function (field) {
                return field.value;
            }
        );

    if (!selectedFields.length) {

        showToast(
            "Select at least one field"
        );

        return;
    }

    const vcard =
        buildVCard(
            profile,
            selectedFields
        );

    const qrBox =
        document.getElementById(
            "generatedQR"
        );

    if (!qrBox) {
        return;
    }

    qrBox.innerHTML = "";

    if (
        typeof QRCode ===
        "undefined"
    ) {

        showToast(
            "QR library could not be loaded"
        );

        return;
    }

    new QRCode(
        qrBox,
        {
            text: vcard,
            width: 300,
            height: 300,
            correctLevel:
                QRCode.CorrectLevel.M
        }
    );

    showToast(
        shareMode === "profile"
            ? "Your profile QR generated"
            : "Contact QR generated"
    );
}

// =====================================================
// DOWNLOAD VCARD
// =====================================================

function downloadVCardData(
    profile,
    selectedFields
) {

    if (!profile) {

        showToast(
            "No profile information found"
        );

        return;
    }

    const vcard =
        buildVCard(
            profile,
            selectedFields
        );

    const blob =
        new Blob(
            [vcard],
            {
                type:
                    "text/vcard;charset=utf-8"
            }
        );

    const url =
        URL.createObjectURL(
            blob
        );

    const link =
        document.createElement(
            "a"
        );

    link.href = url;

    link.download =
        (
            profile.name ||
            "Contact"
        )
            .replace(
                /[^\w\s-]/g,
                ""
            )
            .replace(
                /\s+/g,
                "_"
            ) +
        ".vcf";

    document.body.appendChild(
        link
    );

    link.click();

    document.body.removeChild(
        link
    );

    setTimeout(
        function () {
            URL.revokeObjectURL(
                url
            );
        },
        100
    );

    showToast(
        "vCard downloaded"
    );
}

// =====================================================
// DOWNLOAD VCARD FROM SHARE MODAL
// =====================================================

function downloadVCard() {

    const profile =
        shareMode === "profile"
            ? getMyProfile()
            : currentContact;

    if (!profile) {

        showToast(
            "No contact selected"
        );

        return;
    }

    const selectedFields =
        Array.from(
            document.querySelectorAll(
                ".share-field:checked"
            )
        ).map(
            function (field) {
                return field.value;
            }
        );

    if (!selectedFields.length) {

        showToast(
            "Select at least one field"
        );

        return;
    }

    downloadVCardData(
        profile,
        selectedFields
    );
}

// =====================================================
// DOWNLOAD COMPLETE PROFILE VCARD
// =====================================================

function downloadProfileVCard() {

    const profile =
        getMyProfile();

    downloadVCardData(
        profile,
        null
    );
}

// =====================================================
// SETTINGS
// =====================================================

async function toggleSwitch(button) {
    if (!button || !Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, button.dataset.setting)) {
        return;
    }

    const setting = button.dataset.setting;

    if (setting === "otpVerification") {
        showToast("OTP verification requires an authentication provider");
        return;
    }

    const enabled = !settingEnabled(setting);

    if (setting === "reminderNotifications" && enabled) {
        if (!("Notification" in window)) {
            showToast("This browser does not support notifications");
            return;
        }

        if (Notification.permission === "default") {
            const permission = await Notification.requestPermission();

            if (permission !== "granted") {
                showToast("Notification permission was not granted");
                return;
            }
        } else if (Notification.permission !== "granted") {
            showToast("Allow notifications in browser settings first");
            return;
        }
    }

    appSettings[setting] = enabled;

    try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(appSettings));
    } catch (error) {
        showToast("Could not save this setting in this browser");
        return;
    }

    button.classList.toggle("on", enabled);
    button.setAttribute("aria-pressed", String(enabled));
    renderUpcomingBirthdays();
    renderAIRecommendations();
    notifyDueReminders();
    showToast(enabled ? "Setting enabled" : "Setting disabled");
}

// =====================================================
// LOGIN
// =====================================================

function openLogin() {

    const screen =
        document.getElementById(
            "loginScreen"
        );

    if (screen) {
        screen.classList.add(
            "show"
        );
    }
}

function closeLogin() {

    const screen =
        document.getElementById(
            "loginScreen"
        );

    if (screen) {
        screen.classList.remove(
            "show"
        );
    }
}

function loginDemo() {
    const emailInput = document.getElementById("loginEmail");
    const passwordInput = document.getElementById("loginPassword");
    const email = (emailInput ? emailInput.value : "").trim();
    const password = (passwordInput ? passwordInput.value : "").trim();

    if (!email || !password) {
        showToast("Enter both email and password to continue");
        return;
    }

    const name = email.split("@")[0]
        .split(/[._-]/)
        .filter(Boolean)
        .map(function (part) {
            return part.charAt(0).toUpperCase() + part.slice(1);
        })
        .join(" ") || "Demo User";

    const user = {
        name,
        email,
        password,
        loggedInAt: new Date().toISOString()
    };

    setStoredAuthUser(user);
    applyAuthState();
    closeLogin();
    showToast(`Signed in as ${name}`);
}

function logout() {
    setStoredAuthUser(null);
    applyAuthState();
    showToast("Signed out successfully");
}

let pendingDialogResolver = null;

function resolvePendingDialog(value) {
    if (!pendingDialogResolver) {
        return value;
    }

    const resolver = pendingDialogResolver;
    pendingDialogResolver = null;
    resolver(value);
    return value;
}

function openConfirmDialog(message, title = "Confirm") {
    return new Promise(function (resolve) {
        const modal = document.getElementById("confirmModal");
        const modalTitle = document.getElementById("confirmModalTitle");
        const modalMessage = document.getElementById("confirmModalMessage");

        if (!modal || !modalTitle || !modalMessage) {
            resolve(false);
            return;
        }

        pendingDialogResolver = resolve;
        modalTitle.textContent = title;
        modalMessage.textContent = message;
        modal.classList.add("show");
    });
}

function openPromptDialog(options) {
    return new Promise(function (resolve) {
        const modal = document.getElementById("promptModal");
        const modalTitle = document.getElementById("promptModalTitle");
        const modalLabel = document.getElementById("promptModalLabel");
        const modalInput = document.getElementById("promptModalInput");

        if (!modal || !modalTitle || !modalLabel || !modalInput) {
            resolve(null);
            return;
        }

        const settings = options || {};

        pendingDialogResolver = resolve;
        modalTitle.textContent = settings.title || "Enter value";
        modalLabel.textContent = settings.label || "Value";
        modalInput.type = settings.type || "text";
        modalInput.value = settings.defaultValue || "";
        modalInput.placeholder = settings.placeholder || "";
        modal.classList.add("show");

        setTimeout(function () {
            modalInput.focus();
            modalInput.select();
        }, 50);
    });
}

function submitPromptModal() {
    const input = document.getElementById("promptModalInput");
    const value = input ? input.value.trim() : "";

    closeModal("promptModal");
    resolvePendingDialog(value || null);
}

function cancelActiveDialog() {
    const confirmModal = document.getElementById("confirmModal");
    const promptModal = document.getElementById("promptModal");

    if (confirmModal) {
        confirmModal.classList.remove("show");
    }

    if (promptModal) {
        promptModal.classList.remove("show");
    }

    resolvePendingDialog(false);
}

// =====================================================
// MODALS
// =====================================================

function closeModal(id) {

    const modal =
        document.getElementById(
            id
        );

    if (modal) {
        modal.classList.remove(
            "show"
        );
    }
}

document.addEventListener(
    "click",
    function (event) {

        if (
            event.target.classList.contains(
                "modal-backdrop"
            )
        ) {
            if (event.target.id === "confirmModal") {
                resolvePendingDialog(false);
            }

            if (event.target.id === "promptModal") {
                resolvePendingDialog(null);
            }

            event.target.classList.remove(
                "show"
            );
        }
    }
);

// =====================================================
// DASHBOARD
// =====================================================

async function loadDashboard() {

    try {

        const response =
            await fetch(
                `${API_BASE}/dashboard`
            );

        const data =
            await readResponse(response);

        if (
            !response.ok ||
            !data.success
        ) {
            throw new Error(
                data.error ||
                "Failed to load dashboard"
            );
        }

        const dashboard =
            data.dashboard;

        setText(
            "statContacts",
            dashboard.totalContacts
        );

        setText(
            "statFav",
            dashboard.favoriteContacts
        );

        setText(
            "statReminders",
            dashboard.pendingReminders
        );

        setText(
            "statInteractions",
            dashboard.totalInteractions
        );

    } catch (error) {

        console.error(
            "Dashboard error:",
            error
        );
    }

    renderRecentContacts();
    renderDashboardUpcomingReminders();
}

// =====================================================
// DASHBOARD: RECENT CONTACTS
// =====================================================

function renderRecentContacts() {

    const container =
        document.getElementById(
            "recentContactsList"
        );

    if (!container) {
        return;
    }

    const recent =
        [...contacts]
            .filter(function (c) {
                return c.last;
            })
            .sort(function (a, b) {
                return (
                    new Date(b.last) -
                    new Date(a.last)
                );
            })
            .slice(0, 3);

    if (!recent.length) {

        container.innerHTML = `
            <div class="security-box">
                No contacts yet.
            </div>
        `;

        return;
    }

    container.innerHTML =
        recent.map(function (c) {

            const pillClass =
                c.score >= 80
                    ? "green"
                    : c.score >= 60
                        ? "blue"
                        : "red";

            const pillText =
                c.score >= 80
                    ? "Strong"
                    : c.score >= 60
                        ? "Good"
                        : "Needs attention";

            return `
                <div class="row">

                    <div class="person">

                        <div class="avatar sm">
                            ${initials(c.name)}
                        </div>

                        <span>

                            <strong>
                                ${escapeHTML(c.name)}
                            </strong>

                            <small>
                                Updated ${escapeHTML(formatDate(c.last))}
                            </small>

                        </span>

                    </div>

                    <span class="pill ${pillClass}">
                        ${pillText}
                    </span>

                </div>
            `;

        }).join("");
}

// =====================================================
// DASHBOARD: UPCOMING REMINDERS (reminders + birthdays)
// =====================================================

function renderDashboardUpcomingReminders() {

    const container =
        document.getElementById(
            "upcomingRemindersList"
        );

    if (!container) {
        return;
    }

    const pendingReminders =
        [...reminders]
            .filter(function (r) {
                return !r.done;
            })
            .sort(function (a, b) {
                return (
                    new Date(a.date) -
                    new Date(b.date)
                );
            })
            .slice(0, 3)
            .map(function (r) {
                return {
                    label: r.text,
                    when: r.date,
                    pill: r.type || "Reminder"
                };
            });

    const upcomingBirthdays =
        getUpcomingBirthdays(30)
            .slice(0, 3)
            .map(function (item) {
                return {
                    label: item.contact.name + "'s birthday",
                    when: formatBirthdayWhen(item.daysUntil),
                    pill: "Birthday"
                };
            });

    const merged =
        [...pendingReminders, ...upcomingBirthdays]
            .slice(0, 3);

    if (!merged.length) {

        container.innerHTML = `
            <div class="security-box">
                No upcoming reminders.
            </div>
        `;

        return;
    }

    container.innerHTML =
        merged.map(function (item) {

            return `
                <div class="row">

                    <span>

                        <strong>
                            ${escapeHTML(item.label)}
                        </strong>

                        <small
                            style="display:block;color:#64748b">
                            ${escapeHTML(item.when)}
                        </small>

                    </span>

                    <span class="pill ${item.pill === "Birthday" ? "orange" : "blue"}">
                        ${escapeHTML(item.pill)}
                    </span>

                </div>
            `;

        }).join("");
}

// =====================================================
// SEARCH / FILTER EVENTS
// =====================================================

document.addEventListener(
    "input",
    function (event) {

        if (
            event.target.id ===
            "searchInput"
        ) {

            renderContacts();
        }
    }
);

document.addEventListener(
    "change",
    function (event) {

        if (
            event.target.id ===
                "categoryFilter" ||
            event.target.id ===
                "sortSelect"
        ) {

            renderContacts();
        }

        if (
            event.target.id ===
            "favCategory"
        ) {

            renderFavorites();
        }
    }
);

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

function getValue(id) {

    const element =
        document.getElementById(id);

    return element
        ? element.value.trim()
        : "";
}

function setValue(
    id,
    value
) {

    const element =
        document.getElementById(id);

    if (element) {
        element.value =
            value ?? "";
    }
}

function setText(
    id,
    value
) {

    const element =
        document.getElementById(id);

    if (element) {
        element.textContent =
            value;
    }
}

function formatDate(value) {

    if (!value) {
        return "Not available";
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return String(value);
    }

    return date.toLocaleString();
}

// =====================================================
// ESCAPE HTML
// =====================================================

function escapeHTML(value) {

    return String(
        value ?? ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}

// =====================================================
// TOAST
// =====================================================

function showToast(message) {

    const toast =
        document.getElementById(
            "toast"
        );

    if (!toast) {

        console.log(
            message
        );

        return;
    }

    toast.textContent =
        message;

    toast.classList.add(
        "show"
    );

    clearTimeout(
        window.toastTimer
    );

    window.toastTimer =
        setTimeout(
            function () {

                toast.classList.remove(
                    "show"
                );

            },
            2400
        );
}

// =====================================================
// START APPLICATION
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    async function () {

        loadSettings();
        applyAuthState();

        console.log(
            "Contact Connect Hub starting..."
        );

        await loadContacts();

        await loadReminders();

        await loadProfile();

        await loadDashboard();

        generateProfileQR();

        console.log(
            "Contact Connect Hub ready."
        );
    }
);