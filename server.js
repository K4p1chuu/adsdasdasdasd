const express = require('express');
const cors = require('cors');
const fs = require('fs');
const crypto = require('crypto');
const fetch = require('node-fetch');
const path = require('path');
const { Client, GatewayIntentBits, Partials, PermissionsBitField, ActivityType } = require('discord.js');
// SUGESTIA: Zainstaluj dotenv: npm install dotenv
// require('dotenv').config();

// --- KONFIGURACJA BOTA ---
// SUGESTIA: Przenieś token do pliku .env -> BOT_TOKEN=TwojToken
const BOT_TOKEN = 'MTQxMTI2OTA5NDUyNjY4MTExOQ.GhjnUi.E-Mhy4TNFpEsS62QD6N8pwjj08EEnm5XpCaeSw'; // process.env.BOT_TOKEN;
const GUILD_ID = '1202645184735613029';
const ROLE_ID = '1253431189314998405';
const LOG_CHANNEL_ID = '1423690747294519448'; // Ta zmienna jest zdefiniowana, ale nieużywana

const app = express();
const port = 3000;

// --- Ścieżki do plików (POLICYJNE) ---
const USERS_FILE_PATH = './db_users.json';
const CITIZENS_FILE_PATH = './db_citizens.json';
const RECORDS_FILE_PATH = './db_records.json';
const ANNOUNCEMENTS_FILE_PATH = './db_announcements.json';
const NOTES_FILE_PATH = './db_notes.json';
const CHAT_FILE_PATH = './db_chat.json';
const DIVISIONS_FILE_PATH = './db_divisions.json';
const BOLO_FILE_PATH = './db_bolo.json';
const VEHICLES_FILE_PATH = './db_vehicles.json';
const LEAVES_FILE_PATH = './db_leaves.json';
const IMPOUND_FILE_PATH = './db_impound.json';
const SUSPENDED_LICENSES_FILE_PATH = './db_suspended_licenses.json';
const DUTY_HOURS_FILE_PATH = './db_duty_hours.json';
const ACTIVE_DUTY_SESSIONS_FILE_PATH = './db_active_duty.json';

// --- Ścieżki do plików (CEPIK) ---
const DIAGNOSTICIANS_FILE_PATH = './db_diagnosticians.json';

// --- Ścieżki do plików (UERD - NOWE) ---
const UERD_USERS_FILE_PATH = './db_uerd_users.json';
const UERD_REPORTS_FILE_PATH = './db_uerd_reports.json'; // Interwencje, zgony, zwolnienia
const UERD_CARDS_FILE_PATH = './db_uerd_cards.json'; // Karty inwalidzkie

// --- Webhooki ---
// SUGESTIA: Przenieś wszystkie webhooki do pliku .env
const TICKET_WEBHOOK_URL = 'https://discord.com/api/webhooks/1415072043858399394/6bYM_3C5rG2rWO-2hDfC63AC26eHHo9aCaojTXen9KBEE3x-OsInFHbiH1BA25hN5T7E';
const ARREST_WEBHOOK_URL = 'https://discord.com/api/webhooks/1414669238706245732/GLzu0BuHd2SFpuT2eX8hdSQ7NNtVHRH4B_Xed9MSbYMAgSxLiv780DBoHKBQ5lwDuxxO';
const REPORT_WEBHOOK_URL = 'https://discord.com/api/webhooks/1416718275512897587/M1etNa1iXF-I-OzVwNCYo-dZwa7A31vxOVumGZRtdo0j8jFgaGZ-mxSPxWBPfELFdD2t';
const VEHICLE_INSPECTION_WEBHOOK_URL = 'https://discord.com/api/webhooks/1413686917643501639/YOBjHaSmr4wmzMaKwZCdAfT1gaxcFOsRwGIQicxDAwP1y54ktqpi37hEVyTMZK9b1_rR';
const IMPOUND_WEBHOOK_URL = 'https://discord.com/api/webhooks/1421157864654766121/s0kM1PJ-bAin5awm0qjdyvbdBczMZcVMcEk1XVpjOv3GKOMBNvusIQZ4vBQTOTOeWOku';
const SUSPENDED_LICENSE_WEBHOOK_URL = 'https://discord.com/api/webhooks/1421209532490584187/_N6RsxZGlONA5N9Ttjd66izdAzU7cvelX9f4pTmRd12NHcmptgvVF3w6zWgR5HnjOhSo';
const BOLO_WEBHOOK_URL = 'https://discord.com/api/webhooks/123456789/placeholder'; 

// Webhooki UERD (Możesz je podmienić na prawdziwe)
const UERD_DEATH_WEBHOOK_URL = 'https://discord.com/api/webhooks/123456789/zgon_placeholder'; 
const UERD_LEAVE_WEBHOOK_URL = 'https://discord.com/api/webhooks/123456789/zwolnienia_placeholder';

// --- Bazy danych w pamięci ---
let users = {}, citizens = {}, records = {}, announcements = [], notes = {}, chatMessages = [], divisions = {}, bolo = [], vehicles = {}, leaves = [], impound = [], suspendedLicenses = [];
let dutyHours = {}, activeDutySessions = {}, roleTimers = {};
let diagnosticians = [];
// Nowe bazy UERD
let uerdUsers = {}, uerdReports = {}, uerdCards = [];

// --- Konfiguracja rang (od najwyższej do najniższej) ---
const RANKS = {
    WSP: [ 'Superintendent', 'Deputy Chief Superintendent', 'Colonel', 'Lieutenant Colonel', 'Major', 'Captain', 'Lieutenant', 'Sergeant', 'Master Trooper', 'Trooper First Class', 'Trooper', 'Probationary Trooper' ],
    OCSO: [ 'Sheriff', 'Undersheriff', 'Colonel', 'Major', 'Captain', 'Lieutenant Colonel', 'Lieutenant', 'Staff Sergeant', 'Sergeant', 'Corporal', 'Deputy', 'Probationary Deputy' ],
    UERD: [ 'Ranga 12 (Zarząd)', 'Ranga 11', 'Ranga 10', 'Ranga 9', 'Ranga 8', 'Ranga 7', 'Ranga 6', 'Ranga 5', 'Ranga 4', 'Ranga 3', 'Ranga 2', 'Ranga 1 (Kadet)']
};

// --- KLIENT DISCORDA ---
const client = new Client({
    intents: [ GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers ],
    partials: [ Partials.GuildMember, Partials.User ],
});


// --- Funkcje pomocnicze ---
function loadDatabase() {
    const loadFile = (path, defaultValue) => {
        if (!fs.existsSync(path)) {
            saveData(path, defaultValue);
            return defaultValue;
        }
        try {
            const data = fs.readFileSync(path, 'utf-8');
            if (data.trim() === '') {
                saveData(path, defaultValue);
                return defaultValue;
            }
            return JSON.parse(data);
        } catch (error) {
            console.error(`Błąd wczytywania lub parsowania pliku ${path}. Plik został uszkodzony. Tworzenie nowego pliku. Błąd: ${error.message}`);
            // SUGESTIA: Zamiast usuwać plik, zmień jego nazwę, aby można było odzyskać dane.
            // fs.renameSync(path, `${path}.bak`);
            fs.unlinkSync(path);
            saveData(path, defaultValue);
            return defaultValue;
        }
    };
    
    // SUGESTIA: Zmień hasło 'admin' na hashowane.
    users = loadFile(USERS_FILE_PATH, { 'admin@wsp.gov': { id: 'admin', email: 'admin@wsp.gov', username: 'Administrator', password: 'admin', badge: '000', rank: 'Superintendent', department: 'WSP', isAdmin: true, token: null }});
    citizens = loadFile(CITIZENS_FILE_PATH, {});
    records = loadFile(RECORDS_FILE_PATH, {});
    announcements = loadFile(ANNOUNCEMENTS_FILE_PATH, []);
    notes = loadFile(NOTES_FILE_PATH, {});
    chatMessages = loadFile(CHAT_FILE_PATH, []);
    vehicles = loadFile(VEHICLES_FILE_PATH, {});
    leaves = loadFile(LEAVES_FILE_PATH, []);
    diagnosticians = loadFile(DIAGNOSTICIANS_FILE_PATH, []);
    impound = loadFile(IMPOUND_FILE_PATH, []);
    suspendedLicenses = loadFile(SUSPENDED_LICENSES_FILE_PATH, []);
    dutyHours = loadFile(DUTY_HOURS_FILE_PATH, {});
    activeDutySessions = loadFile(ACTIVE_DUTY_SESSIONS_FILE_PATH, {});
    
    // --- ŁADOWANIE DANYCH UERD (DODANE) ---
    uerdUsers = loadFile(UERD_USERS_FILE_PATH, { 'admin@uerd.gov': { id: 'uerd_admin', email: 'admin@uerd.gov', username: 'Szef UERD', password: 'admin', badge: '01', rank: 'Ranga 12 (Zarząd)', isAdmin: true, department: 'UERD', token: null }});
    uerdReports = loadFile(UERD_REPORTS_FILE_PATH, {});
    uerdCards = loadFile(UERD_CARDS_FILE_PATH, []);

    bolo = loadFile(BOLO_FILE_PATH, []);
    let dataWasModified = false;
    bolo.forEach(entry => {
        if (!entry.id) {
            entry.id = crypto.randomUUID();
            dataWasModified = true;
        }
    });
    if (dataWasModified) {
        console.log('Naprawiono brakujące ID w pliku BOLO. Zapisywanie...');
        saveData(BOLO_FILE_PATH, bolo);
    }

    const defaultDivisions = { 
        WSP: { "K-9 CANINE": { lead: [], members: [] }, "Special Response Team": { lead: [], members: [] }, "Speed Enforcement Unit": { lead: [], members: [] }, "Traffic Service Unit": { lead: [], members: [] }, "Detective Task Unit": { lead: [], members: [] } },
        OCSO: { "Highway Patrol": { lead: [], members: [] }, "K-9 CANINE": { lead: [], members: [] }, "Special Emergency Response Team": { lead: [], members: [] }, "Special Investigation Unit": { lead: [], members: [] } }
    };
    
    let loadedDivisions = loadFile(DIVISIONS_FILE_PATH, defaultDivisions);
    if (!loadedDivisions || !loadedDivisions.WSP || !loadedDivisions.OCSO) {
        console.log("Struktura dywizji jest nieprawidłowa lub pusta. Resetowanie do domyślnych wartości.");
        const oldDivisionsData = { ...loadedDivisions };
        loadedDivisions = defaultDivisions;
        if (Object.keys(oldDivisionsData).length > 0 && !oldDivisionsData.WSP) {
            loadedDivisions.WSP = oldDivisionsData;
        }
        saveData(DIVISIONS_FILE_PATH, loadedDivisions);
    }
    divisions = loadedDivisions;

    console.log('Bazy danych załadowane.');
}

function saveData(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error(`Błąd zapisu do ${filePath}:`, error);
    }
}

// --- SEKcja: Funkcje do zarządzania rolami ---
async function manageRole(userId, action) {
    if (ROLE_ID === 'ID_ROLI_BRAK_PRAWA_JAZDY') { // Check placeholder
        console.warn('Nie ustawiono ID roli. Operacja na rolach zostanie pominięta.');
        return;
    }
    try {
        const guild = await client.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch(userId);
        if (!member) {
            console.log(`Nie znaleziono członka o ID ${userId} na serwerze.`);
            return;
        }

        if (action === 'add') {
            await member.roles.add(ROLE_ID);
            console.log(`Nadano rolę użytkownikowi ${member.user.tag}`);
        } else if (action === 'remove') {
            await member.roles.remove(ROLE_ID);
            console.log(`Zabrano rolę użytkownikowi ${member.user.tag}`);
        }
    } catch (error) {
        console.error(`Nie udało się ${action === 'add' ? 'nadać' : 'zabrać'} roli użytkownikowi ${userId}:`, error.message);
    }
}

function scheduleRoleRemoval(suspensionId, userId, expirationDate) {
    const now = new Date();
    const delay = new Date(expirationDate).getTime() - now.getTime();

    if (delay > 0) {
        if (roleTimers[suspensionId]) {
            clearTimeout(roleTimers[suspensionId]);
        }
        roleTimers[suspensionId] = setTimeout(async () => {
            console.log(`Czas upłynął. Próba usunięcia roli dla ID: ${userId}`);
            await manageRole(userId, 'remove');
            suspendedLicenses = suspendedLicenses.filter(s => s.id !== suspensionId);
            saveData(SUSPENDED_LICENSES_FILE_PATH, suspendedLicenses);
            delete roleTimers[suspensionId];
        }, delay);
        console.log(`Zaplanowano usunięcie roli dla ${userId} za ${Math.round(delay / 1000 / 60)} minut.`);
    } else {
        console.log(`Czas dla ${userId} już upłynął. Natychmiastowe usuwanie roli.`);
        manageRole(userId, 'remove');
    }
}

function restoreRoleTimers() {
    const now = new Date().getTime();
    const activeSuspensions = suspendedLicenses.filter(s => new Date(s.expiresAt).getTime() > now);
    if(activeSuspensions.length !== suspendedLicenses.length){
        suspendedLicenses = activeSuspensions;
        saveData(SUSPENDED_LICENSES_FILE_PATH, suspendedLicenses);
    }

    console.log(`Odtwarzanie ${activeSuspensions.length} zaplanowanych zadań usunięcia ról...`);
    activeSuspensions.forEach(suspension => {
        scheduleRoleRemoval(suspension.id, suspension.citizenId, suspension.expiresAt);
    });
}


// --- Middleware ---
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const verifyToken = (req, res, next) => {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ message: 'Brak tokenu' });
    
    // Sprawdź we wszystkich bazach użytkowników
    let user = Object.values(users).find(u => u.token === token);
    
    if (!user) {
        user = diagnosticians.find(d => d.token === token);
    }
    
    if (!user) {
        // Sprawdź w bazie UERD
        user = Object.values(uerdUsers).find(u => u.token === token);
    }

    if (!user) return res.status(401).json({ message: 'Błędny token' });

    if (!user.department && !user.isDiagnostician && user.department !== 'UERD') {
        user.department = 'WSP';
    }

    req.user = user;
    next();
};

const verifyAdmin = (req, res, next) => {
    if (!req.user || !req.user.isAdmin) return res.status(403).json({ message: 'Brak uprawnień admina' });
    next();
};

const verifySenior = (req, res, next) => {
    const user = req.user;
    if (user && (
        user.isAdmin || 
        (user.rank === 'Superintendent' && user.badge === '101') ||
        (user.rank === 'Sheriff')
    )) {
        return next();
    }
    return res.status(403).json({ message: 'Brak uprawnień' });
};

const verifyPayoutAccess = (req, res, next) => {
    const user = req.user;
    if (user && (
        user.isAdmin || 
        (user.rank === 'Superintendent' && user.badge === '101')
    )) {
        return next();
    }
    return res.status(403).json({ message: 'Brak uprawnień do wykonania tej akcji.' });
};

const verifyDiagnosticianLead = (req, res, next) => {
    if (
        (req.user.isDiagnostician && req.user.skpNumber && req.user.skpNumber.endsWith('001')) ||
        (req.user.isAdmin && !req.user.isDiagnostician)
    ) {
        return next();
    }
    return res.status(403).json({ message: 'Brak uprawnień naczelnika diagnostyki.' });
};


// --- Endpointy API ---

// LOGIN (ZAKTUALIZOWANY DLA MDT, CEPIK, UERD)
app.post('/api/login', (req, res) => {
    if (!req.body) return res.status(400).json({ success: false, message: 'Brak danych.' });

    const { username, password, system } = req.body;
    let userPool;
    let savePath;
    let isArray = false;

    if (system === 'cepik') {
        userPool = diagnosticians;
        savePath = DIAGNOSTICIANS_FILE_PATH;
        isArray = true;
    } else if (system === 'uerd') {
        userPool = uerdUsers; // UERD to obiekt
        savePath = UERD_USERS_FILE_PATH;
        isArray = false;
    } else {
        userPool = users; // Policja to obiekt
        savePath = USERS_FILE_PATH;
        isArray = false;
    }
    
    let user;
    if (isArray) {
        user = userPool.find(u => u.email === username);
    } else {
        user = Object.values(userPool).find(u => u.email === username);
    }
    
    if (user && user.password === password) {
        user.token = crypto.randomBytes(32).toString('hex');
        
        if (isArray) {
            saveData(savePath, userPool);
        } else {
            if (userPool[user.email]) {
                userPool[user.email].token = user.token;
                saveData(savePath, userPool);
            }
        }
        
        let redirectUrl = 'dashboard.html';
        if (system === 'cepik') redirectUrl = 'cepik.html';
        if (system === 'uerd') redirectUrl = 'uerd.html';

        res.json({ success: true, token: user.token, redirect: redirectUrl });
    } else {
        res.status(401).json({ success: false, message: 'Nieprawidłowe dane logowania' });
    }
});


app.get('/api/user-data', verifyToken, (req, res) => {
    const { password, token, ...userData } = req.user;
    res.json({ userData });
});

app.get('/api/config/ranks', verifyToken, (req, res) => {
    res.json(RANKS);
});

// --- API DLA POLICJI ---

app.get('/api/citizen/:id', verifyToken, (req, res) => {
    const citizenId = req.params.id;
    const citizen = citizens[citizenId];
    if (citizen) {
        const wantedMatches = bolo.filter(b => {
            const details = b.details || {};
            const involvedPersons = [details.osoba, details.kierowca, details.wlasciciel].filter(Boolean);
            return involvedPersons.some(personString => personString.includes(citizenId));
        });
        
        const ownedVehicles = Object.values(vehicles).filter(v => v.ownerId === citizenId);
        const now = new Date().getTime();
        const licenseSuspended = suspendedLicenses.some(s => s.citizenId === citizenId && new Date(s.expiresAt).getTime() > now);

        // Sprawdź czy ma kartę inwalidzką w UERD
        const disabilityCard = uerdCards.find(c => {
            const fullName = `${c.name} ${c.surname}`.toLowerCase();
            return citizen.name && citizen.name.toLowerCase().includes(fullName);
        });

        const responseData = {
            ...citizen,
            records: (records[citizenId] || []).sort((a, b) => new Date(b.issueDate) - new Date(a.issueDate)),
            wantedStatus: wantedMatches.length > 0 ? wantedMatches : null,
            vehicles: ownedVehicles.map(v => ({ plate: v.plate, status: v.status, isImpounded: v.isImpounded || false })),
            licenseSuspended: licenseSuspended,
            disabilityCard: disabilityCard || null // Dodano info dla policji
        };
        res.json(responseData);
    } else {
        res.status(404).json({ message: 'Nie znaleziono obywatela' });
    }
});

app.get('/api/citizens', verifyToken, (req, res) => {
    const now = new Date().getTime();
    suspendedLicenses = suspendedLicenses.filter(s => new Date(s.expiresAt).getTime() > now);
    saveData(SUSPENDED_LICENSES_FILE_PATH, suspendedLicenses);
    const citizensWithStatus = Object.values(citizens).map(c => {
        c.licenseSuspended = suspendedLicenses.some(s => s.citizenId === c.discordId);
        return c;
    });
    res.json(citizensWithStatus);
});

app.post('/api/sync-citizens', (req, res) => {
    const members = req.body;
    if (Array.isArray(members)) {
        members.forEach(m => {
            const existingCitizen = citizens[m.discordId] || { ticketCount: 0, arrestCount: 0, warningCount: 0, vehicles: [], licenseSuspended: false };
            const updatedData = { ...existingCitizen, ...m };
            if (!m.robloxId) updatedData.robloxId = existingCitizen.robloxId;
            citizens[m.discordId] = updatedData;
        });
        saveData(CITIZENS_FILE_PATH, citizens);
        res.json({ success: true, syncedCount: members.length });
    } else {
        res.status(400).json({ message: 'Nieprawidłowe dane.' });
    }
});

app.post('/api/vehicle-inspection', (req, res) => {
    try {
        const { reportType, reportContent, rawMessage } = req.body;
        const contentToParse = reportContent || rawMessage;
        if (!contentToParse) return res.status(400).json({ success: false, message: 'Brak treści raportu.' });

        const plateRegex = /(?:numery rejestracyjne, stan|Tablice rejestracyjne \/ Stan|Numery rejestracyjne, stan):\s*\**\s*([^,\n]+)/i;
        const ownerRegex = /(?:właściciel pojazdu|Ping Właściciela pojazdu):\s*\**\s*<@(\d+)>/i;

        const plateMatch = contentToParse.match(plateRegex);
        const ownerMatch = contentToParse.match(ownerRegex);
        
        if (!plateMatch || !ownerMatch) return res.status(400).json({ success: false, message: 'Nie udało się sparsować numeru rejestracyjnego lub właściciela.' });
        
        const plate = plateMatch[1].trim().toUpperCase();
        const ownerId = ownerMatch[1];
        
        const vehicle = vehicles[plate] || { inspections: [], registeredAt: new Date().toISOString() };
        
        Object.assign(vehicle, {
            plate: plate,
            ownerId: ownerId,
            ownerName: citizens[ownerId]?.name || 'Nieznany',
            lastInspection: new Date().toISOString(),
            status: reportType || (contentToParse.toLowerCase().includes('pozytywny') ? 'POZYTYWNY' : 'NEGATYWNY')
        });
        
        vehicle.inspections.unshift({ date: new Date().toISOString(), type: vehicle.status, content: contentToParse });
        vehicles[plate] = vehicle;
        saveData(VEHICLES_FILE_PATH, vehicles);
        
        if (VEHICLE_INSPECTION_WEBHOOK_URL) {
            fetch(VEHICLE_INSPECTION_WEBHOOK_URL, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: contentToParse })
            }).catch(err => console.error("Błąd wysyłania na webhook CEPiK:", err));
        }
        res.status(201).json({ success: true, message: `Status pojazdu ${plate} został zapisany.` });
    } catch (error) {
        console.error("Błąd w /api/vehicle-inspection:", error);
        res.status(500).json({ success: false, message: "Wewnętrzny błąd serwera." });
    }
});

app.get('/api/vehicles', verifyToken, (req, res) => res.json(Object.values(vehicles)));
app.get('/api/vehicle/:plate', verifyToken, (req, res) => {
    const plate = req.params.plate.toUpperCase();
    const vehicle = vehicles[plate];
    if (vehicle) res.json(vehicle); else res.status(404).json({ message: 'Nie znaleziono pojazdu' });
});

app.put('/api/vehicle/:plate', verifyToken, verifyDiagnosticianLead, (req, res) => {
    const plate = req.params.plate.toUpperCase();
    if (vehicles[plate]) {
        const { ownerId, make, model, color } = req.body;
        let vehicleUpdated = false;
        if (ownerId && citizens[ownerId]) {
            vehicles[plate].ownerId = ownerId;
            vehicles[plate].ownerName = citizens[ownerId].name;
            vehicleUpdated = true;
        } else if (ownerId) return res.status(400).json({ success: false, message: 'Nieprawidłowe ID właściciela.' });
        
        if (make) { vehicles[plate].make = make; vehicleUpdated = true; }
        if (model) { vehicles[plate].model = model; vehicleUpdated = true; }
        if (color) { vehicles[plate].color = color; vehicleUpdated = true; }

        if (vehicleUpdated) {
            saveData(VEHICLES_FILE_PATH, vehicles);
            res.json({ success: true, message: 'Dane pojazdu zaktualizowane.' });
        } else res.status(400).json({ success: false, message: 'Nie podano żadnych danych do aktualizacji.' });
    } else res.status(404).json({ success: false, message: 'Nie znaleziono pojazdu.' });
});

app.delete('/api/vehicles/:plate', verifyToken, (req, res) => {
    const plate = req.params.plate.toUpperCase();
    if (vehicles[plate]) {
        delete vehicles[plate];
        saveData(VEHICLES_FILE_PATH, vehicles);
        res.json({ success: true, message: 'Pojazd usunięty.' });
    } else res.status(404).json({ success: false, message: 'Nie znaleziono pojazdu.' });
});

app.delete('/api/vehicles/:plate/inspections/:index', verifyToken, verifySenior, (req, res) => {
    const { plate, index } = req.params;
    const vehicle = vehicles[plate.toUpperCase()];
    if (vehicle && vehicle.inspections && vehicle.inspections[index]) {
        vehicle.inspections.splice(index, 1);
        if (vehicle.inspections.length > 0) {
            vehicle.lastInspection = vehicle.inspections[0].date;
            vehicle.status = vehicle.inspections[0].type;
        } else {
            vehicle.lastInspection = null;
            vehicle.status = 'Brak danych';
        }
        saveData(VEHICLES_FILE_PATH, vehicles);
        res.json({ success: true, message: 'Przegląd został usunięty.' });
    } else res.status(404).json({ success: false, message: 'Nie znaleziono pojazdu lub przeglądu.' });
});

app.post('/api/records', verifyToken, async (req, res) => {
    const reportData = { ...req.body, id: crypto.randomUUID(), issueDate: new Date(), author: req.user.username, authorBadge: req.user.badge, department: req.user.department };
    const { civilianDiscordId, reportType } = reportData;
    const discordIdMatch = (civilianDiscordId || '').match(/<@(\d+)>/);
    const cleanDiscordId = discordIdMatch ? discordIdMatch[1] : civilianDiscordId;

    if (!cleanDiscordId) return res.status(400).json({ success: false, message: "Brak ID Discord osoby." });

    if (!records[cleanDiscordId]) records[cleanDiscordId] = [];
    records[cleanDiscordId].unshift(reportData);
    saveData(RECORDS_FILE_PATH, records);

    if (citizens[cleanDiscordId]) {
        if (reportType === 'mandat') citizens[cleanDiscordId].ticketCount = (citizens[cleanDiscordId].ticketCount || 0) + 1;
        else if (reportType === 'pouczenie') citizens[cleanDiscordId].warningCount = (citizens[cleanDiscordId].warningCount || 0) + 1;
        else if (reportType === 'areszt') citizens[cleanDiscordId].arrestCount = (citizens[cleanDiscordId].arrestCount || 0) + 1;
        saveData(CITIZENS_FILE_PATH, citizens);
    }

    try {
        if (reportType === 'mandat') {
            const dueDate = new Date(reportData.issueDate);
            dueDate.setDate(dueDate.getDate() + 3);
            const formattedDueDate = `${dueDate.getDate().toString().padStart(2, '0')}/${(dueDate.getMonth() + 1).toString().padStart(2, '0')}/${dueDate.getFullYear()}`;
            
            let description = `**Departament funkcjonariusza:** ${reportData.department}\n\n`;
            if (reportData.ticketTarget === 'vehicle') {
                    description += `**Dane zatrzymanego Pojazdu**\n**Kierowca:** <@${cleanDiscordId}>\n**Marka Pojazdu, Model, Kolor:** ${reportData.vehicleInfo}\n**Numer rejestracyjny / stan rejestracji:** ${reportData.licensePlate}\n\n`;
            } else {
                    description += `**Dane zatrzymanej osoby**\n**Ping osoby zatrzymanej:** <@${cleanDiscordId}>\n\n`;
            }
            
            description += `**Szczegóły mandatu**\n**Zarzuty:**\n${(reportData.charges || []).map(c => `- ${c.name}`).join('\n')}\n**Kara grzywny:** $${reportData.totalFine}\n**Miejsce wystawienia:** ${reportData.location}\n**Data wystawienia:** ${new Date(reportData.issueDate).toLocaleDateString('pl-PL')}\n**Ostatnia data zapłaty:** ${formattedDueDate}\n**Czy został przyjęty:** ${reportData.isAccepted}\n**Sposób wręczenia mandatu:** ${reportData.deliveryMethod}\n\n**Dane funkcjonariusza**\n**Ping funkcjonariusza:** <@${req.user.robloxId || 'Brak ID'}>\n**Prowadzący czynność:** ${reportData.author}\n**Stopień i odznaka:** ${req.user.rank} | ${reportData.authorBadge}`;

            const embed = { color: reportData.department === 'OCSO' ? 16754176 : 3447003, description, timestamp: new Date().toISOString() };
            if (reportData.photoUrl) embed.image = { url: reportData.photoUrl };
            
            await fetch(TICKET_WEBHOOK_URL, { 
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ embeds: [embed], content: `||<@${cleanDiscordId}>||` }) 
            });

        } else if (reportType === 'areszt') {
            const officerDiscordIdMatch = (reportData.officerDiscordId || '').match(/<@(\d+)>/);
            const cleanOfficerDiscordId = officerDiscordIdMatch ? officerDiscordIdMatch[1] : reportData.officerDiscordId;

            let description = `**Dane Zatrzymanego**\n**Ping osoby zatrzymanej:** <@${cleanDiscordId}>\n**Imię, Nazwisko:** ${reportData.civilianFullName}\n**Wiek:** ${reportData.civilianAge}\n**Płeć:** ${reportData.civilianGender}\n**Zarekwirowane Przedmioty:** ${reportData.confiscatedItems || 'Brak'}\n\n**Dane Funkcjonariusza**\n**Ping funkcjonariusza:** <@${cleanOfficerDiscordId}>\n**Departament:** ${reportData.department}\n**Odznaka:** ${reportData.authorBadge}\n**Stopień:** ${req.user.rank}\n\n**Szczegóły Aresztu**\n**Gdzie został aresztowany:** ${reportData.arrestLocation}\n**Zarzuty:**\n${(reportData.charges || []).map(c => `- ${c.name} (${c.lata} mies. / $${c.price})`).join('\n')}\n**Długość wyroku (1 Miesiąc = 1 minuta):** ${reportData.finalSentence} minut\n**Wysokość grzywny:** $${reportData.finalTotalFine}\n**Na której komendzie odsiaduje wyrok:** ${reportData.jailLocation}\n\n-# (jeżeli ktoś chce zamienić miesiące na pieniądze to nie może mieć więcej niż 99 miesięcy i maksymalnie może wykupić 30 miesięcy a 1 Miesiąc = 1000$)`;
            
            const embed = { color: 15158332, description, timestamp: new Date().toISOString() };
            if (reportData.photoUrl) embed.image = { url: reportData.photoUrl };
            await fetch(ARREST_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ embeds: [embed] }) });
        }
    } catch (error) { console.error("Błąd webhooka:", error); }
    res.json({ success: true, message: 'Zgłoszenie zapisane.' });
});

app.delete('/api/records/:citizenId/:recordId', verifyToken, verifySenior, (req, res) => {
    const { citizenId, recordId } = req.params;
    if (records[citizenId]) {
        const recordIndex = records[citizenId].findIndex(r => r.id === recordId);
        if (recordIndex > -1) {
            const [recordToDelete] = records[citizenId].splice(recordIndex, 1);
            saveData(RECORDS_FILE_PATH, records);
            if (citizens[citizenId]) {
                const type = recordToDelete.reportType;
                if (type === 'mandat') citizens[citizenId].ticketCount = Math.max(0, (citizens[citizenId].ticketCount || 0) - 1);
                else if (type === 'pouczenie') citizens[citizenId].warningCount = Math.max(0, (citizens[citizenId].warningCount || 0) - 1);
                else if (type === 'areszt') citizens[citizenId].arrestCount = Math.max(0, (citizens[citizenId].arrestCount || 0) - 1);
                saveData(CITIZENS_FILE_PATH, citizens);
            }
            res.json({ success: true });
        } else res.status(404).json({ success: false, message: 'Nie znaleziono rekordu.' });
    } else res.status(404).json({ success: false, message: 'Nie znaleziono obywatela.' });
});

app.get('/api/officers/stats', verifyToken, (req, res) => {
    const allRecords = Object.values(records).flat();
    const officerStats = Object.values(users).map(officer => {
        const officerRecords = allRecords.filter(r => r.author === officer.username);
        const tickets = officerRecords.filter(r => r.reportType === 'mandat');
        const arrests = officerRecords.filter(r => r.reportType === 'areszt');
        const warnings = officerRecords.filter(r => r.reportType === 'pouczenie');
        const ticketsValue = tickets.reduce((sum, t) => sum + (Number(t.totalFine) || 0), 0);
        const arrestsValue = arrests.reduce((sum, arrest) => sum + (Number(arrest.finalTotalFine) || 0), 0);
        const { password, token, ...officerData } = officer;
        if (!officerData.department) officerData.department = 'WSP';
        const activeLeave = leaves.find(l => l.officerBadge === officer.badge && l.department === officer.department); 
        officerData.onLeave = !!activeLeave;
        return { ...officerData, stats: { tickets: { count: tickets.length, totalValue: ticketsValue }, arrests: { count: arrests.length, totalValue: arrestsValue }, warnings: { count: warnings.length }, totalValue: ticketsValue + arrestsValue } };
    });
    res.json(officerStats);
});

app.get('/api/officers/records/:email', verifyToken, (req, res) => {
    const email = decodeURIComponent(req.params.email);
    const officer = Object.values(users).find(u => u.email === email);
    if (!officer) {
        return res.status(404).json([]);
    }
    const allRecords = Object.values(records).flat();
    const officerRecords = allRecords
        .filter(r => r.author === officer.username)
        .sort((a, b) => new Date(b.issueDate) - new Date(a.issueDate));
    res.json(officerRecords);
});

app.get('/api/officer/badge/:badge', verifyToken, (req, res) => {
    const badge = req.params.badge;
    const officer = Object.values(users).find(u => u.badge === badge);

    if (!officer) {
        return res.status(404).json({ message: 'Nie znaleziono funkcjonariusza o tej odznace.' });
    }

    const allRecords = Object.values(records).flat();
    const officerRecords = allRecords.filter(r => r.author === officer.username);
    
    const tickets = officerRecords.filter(r => r.reportType === 'mandat');
    const arrests = officerRecords.filter(r => r.reportType === 'areszt');
    const warnings = officerRecords.filter(r => r.reportType === 'pouczenie');
    
    const ticketsValue = tickets.reduce((sum, t) => sum + (Number(t.totalFine) || 0), 0);
    const arrestsValue = arrests.reduce((sum, arrest) => sum + (Number(arrest.finalTotalFine) || 0), 0);

    const { password, token, ...officerData } = officer;

    res.json({
        ...officerData,
        stats: {
            tickets: { count: tickets.length, totalValue: ticketsValue },
            arrests: { count: arrests.length, totalValue: arrestsValue },
            warnings: { count: warnings.length },
            totalValue: ticketsValue + arrestsValue
        },
        records: officerRecords.sort((a, b) => new Date(b.issueDate) - new Date(a.issueDate))
    });
});

app.get('/api/officers', verifyToken, (req, res) => res.json(Object.values(users).map(({ password, token, ...officer }) => officer)));

app.post('/api/officers', verifyToken, verifyAdmin, (req, res) => {
    const { email, username, password, badge, rank, isAdmin, robloxId, discordNick, robloxNick, joinedAt, department } = req.body;
    if (users[email]) return res.status(400).json({ success: false, message: 'Użytkownik istnieje.' });
    users[email] = { id: `user_${crypto.randomUUID()}`, email, username, password, badge, rank, department, isAdmin: isAdmin === 'true', token: null, robloxId, discordNick, robloxNick, joinedAt };
    saveData(USERS_FILE_PATH, users);
    res.json({ success: true, user: users[email] });
});

app.put('/api/officers/:email', verifyToken, (req, res) => {
    const targetEmail = decodeURIComponent(req.params.email);
    if (!users[targetEmail]) return res.status(404).json({ success: false, message: 'Nie znaleziono funkcjonariusza.' });
    const { username, newEmail, password, badge, rank, robloxId, discordNick, robloxNick, joinedAt, department } = req.body;
    const canEditSensitive = req.user.isAdmin || (req.user.rank === 'Superintendent' && req.user.badge === '101');
    if (req.user.email !== targetEmail && !canEditSensitive) return res.status(403).json({ success: false, message: 'Brak uprawnień.' });

    const updatedUser = { ...users[targetEmail] };
    if (username && canEditSensitive) updatedUser.username = username;
    if (password && canEditSensitive) updatedUser.password = password;
    if (badge) updatedUser.badge = badge;
    if (rank) updatedUser.rank = rank;
    if (robloxId) updatedUser.robloxId = robloxId;
    if (discordNick) updatedUser.discordNick = discordNick;
    if (robloxNick) updatedUser.robloxNick = robloxNick;
    if (joinedAt) updatedUser.joinedAt = joinedAt;
    if (department) updatedUser.department = department;

    if (newEmail && newEmail !== targetEmail && canEditSensitive) {
        if (users[newEmail]) return res.status(400).json({ success: false, message: 'Email zajęty.' });
        delete users[targetEmail];
        updatedUser.email = newEmail;
        users[newEmail] = updatedUser;
    } else users[targetEmail] = updatedUser;

    saveData(USERS_FILE_PATH, users);
    res.json({ success: true, message: 'Dane zaktualizowane.' });
});

app.delete('/api/officers/:email', verifyToken, verifyAdmin, (req, res) => {
    const email = decodeURIComponent(req.params.email);
    if (email === 'admin@wsp.gov' || email === req.user.email) return res.status(400).json({ success: false, message: 'Nie można usunąć.' });
    if (users[email]) { delete users[email]; saveData(USERS_FILE_PATH, users); res.json({ success: true }); } else res.status(404).json({ success: false });
});

app.get('/api/announcements', verifyToken, (req, res) => res.json(announcements));
app.post('/api/announcements', verifyToken, verifyAdmin, (req, res) => {
    const newAnnouncement = { ...req.body, id: crypto.randomUUID(), author: req.user.username };
    announcements.unshift(newAnnouncement);
    saveData(ANNOUNCEMENTS_FILE_PATH, announcements);
    res.json({ success: true });
});
app.delete('/api/announcements/:id', verifyToken, verifyAdmin, (req, res) => {
    announcements = announcements.filter(a => a.id !== req.params.id);
    saveData(ANNOUNCEMENTS_FILE_PATH, announcements);
    res.json({ success: true });
});

app.get('/api/reports/today-stats', verifyToken, (req, res) => {
    try {
        const officerUsername = req.user.username;
        const allRecords = Object.values(records).flat();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayRecords = allRecords.filter(r => { const recordDate = new Date(r.issueDate); recordDate.setHours(0, 0, 0, 0); return r.author === officerUsername && recordDate.getTime() === today.getTime(); });
        const tickets = todayRecords.filter(r => r.reportType === 'mandat');
        const arrests = todayRecords.filter(r => r.reportType === 'areszt');
        const warnings = todayRecords.filter(r => r.reportType === 'pouczenie');
        const stats = { stops: tickets.length + arrests.length + warnings.length, tickets: tickets.length, arrests: arrests.length, warnings: warnings.length, ticketValue: tickets.reduce((sum, t) => sum + (Number(t.totalFine) || 0), 0), arrestValue: arrests.reduce((sum, a) => sum + (Number(a.finalTotalFine) || 0), 0) };
        res.json(stats);
    } catch (error) { res.status(500).json({ success: false }); }
});

app.post('/api/reports', verifyToken, async (req, res) => {
    try {
        const reportData = req.body;
        const reportContent = `**SZCZEGÓŁY SŁUŻBY**\n**Ilość przeprowadzonych zatrzymań:** ${reportData.stops}\n**Ilość nałożonych mandatów:** ${reportData.tickets}\n**Ilość aresztów:** ${reportData.arrests}\n**Ilość zastosowanych pouczeń:** ${reportData.warnings}\n\n**DANE**\n**Departament:** ${reportData.department}\n**Imię i nazwisko:** ${reportData.name}\n**Ping funkcjonariusza:** <@${req.user.robloxId || 'Brak ID'}>\n**Stopień:** ${reportData.rank}\n**Odznaka:** ${reportData.badge}\n**Data:** ${reportData.date}\n**Podpis:** ${reportData.signature}`;
        await fetch(REPORT_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: reportContent.trim() }) });
        res.json({ success: true, message: 'Raport wysłany.' });
    } catch (error) { res.status(500).json({ success: false }); }
});

app.get('/api/chat', verifyToken, (req, res) => res.json(chatMessages));
app.post('/api/chat', verifyToken, (req, res) => {
    if (!req.body.message || !req.body.message.trim()) return res.status(400).json({ success: false });
    chatMessages.push({ ...req.body, id: crypto.randomUUID(), timestamp: new Date(), author: req.user.username, authorBadge: req.user.badge });
    if (chatMessages.length > 50) chatMessages.shift();
    saveData(CHAT_FILE_PATH, chatMessages);
    res.json({ success: true });
});

app.get('/api/notes', verifyToken, (req, res) => res.json({ note: notes[req.user.id] || '' }));
app.post('/api/notes', verifyToken, (req, res) => { notes[req.user.id] = req.body.note; saveData(NOTES_FILE_PATH, notes); res.json({ success: true }); });

app.get('/api/duty/status', verifyToken, (req, res) => {
    const session = activeDutySessions[req.user.email];
    res.json(session ? { onDuty: true, startTime: session.startTime } : { onDuty: false });
});

app.post('/api/duty/start', verifyToken, (req, res) => {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Warsaw' }));
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    if (currentMinutes < 19 * 60 || currentMinutes > 23 * 60 + 30) return res.status(403).json({ success: false, message: 'Służba tylko 19:00 - 23:30.' });
    if (activeDutySessions[req.user.email]) return res.status(400).json({ success: false, message: 'Już na służbie.' });
    activeDutySessions[req.user.email] = { startTime: new Date().toISOString(), username: req.user.username, badge: req.user.badge, department: req.user.department, rank: req.user.rank };
    saveData(ACTIVE_DUTY_SESSIONS_FILE_PATH, activeDutySessions);
    res.json({ success: true, startTime: activeDutySessions[req.user.email].startTime });
});

app.post('/api/duty/end', verifyToken, (req, res) => {
    const session = activeDutySessions[req.user.email];
    if (!session) return res.status(400).json({ success: false, message: 'Nie jesteś na służbie.' });
    const hoursCompleted = Math.floor(((new Date()) - new Date(session.startTime)) / (1000 * 60 * 60));
    const earnings = hoursCompleted * 750;
    if (!dutyHours[req.user.email]) dutyHours[req.user.email] = { username: session.username, badge: session.badge, department: session.department, rank: session.rank, totalHours: 0, totalEarnings: 0, temporaryHours: 0, temporaryEarnings: 0 };
    dutyHours[req.user.email].temporaryHours += ((new Date()) - new Date(session.startTime)) / (1000 * 60 * 60);
    if (hoursCompleted > 0) dutyHours[req.user.email].temporaryEarnings += earnings;
    delete activeDutySessions[req.user.email];
    saveData(ACTIVE_DUTY_SESSIONS_FILE_PATH, activeDutySessions);
    saveData(DUTY_HOURS_FILE_PATH, dutyHours);
    res.json({ success: true, hoursCompleted, earnings });
});

app.get('/api/duty/leaderboard', verifyToken, (req, res) => {
    res.json(Object.values(users).filter(u => u.username !== 'Administrator').map(user => ({ username: user.username, badge: user.badge, department: user.department, rank: user.rank, ...(dutyHours[user.email] || { temporaryHours: 0, temporaryEarnings: 0, totalHours: 0, totalEarnings: 0 }) })));
});

app.post('/api/duty/payout', verifyToken, verifyPayoutAccess, (req, res) => {
    // Tu powinna być weryfikacja verifyPayoutAccess
    for (const email in dutyHours) { dutyHours[email].totalHours += dutyHours[email].temporaryHours || 0; dutyHours[email].totalEarnings += dutyHours[email].temporaryEarnings || 0; dutyHours[email].temporaryHours = 0; dutyHours[email].temporaryEarnings = 0; }
    saveData(DUTY_HOURS_FILE_PATH, dutyHours);
    res.json({ success: true });
});

app.get('/api/divisions', verifyToken, (req, res) => res.json(divisions));
app.post('/api/divisions/members', verifyToken, verifyAdmin, (req, res) => {
    const { divisionName, memberType, officerName, department } = req.body;
    if (divisions[department]?.[divisionName]?.[memberType] && !divisions[department][divisionName][memberType].includes(officerName)) {
        divisions[department][divisionName][memberType].push(officerName);
        saveData(DIVISIONS_FILE_PATH, divisions);
        res.json({ success: true });
    } else res.status(400).json({ success: false });
});
app.delete('/api/divisions/members', verifyToken, verifyAdmin, (req, res) => {
    const { divisionName, memberType, officerName, department } = req.body;
    if (divisions[department]?.[divisionName]?.[memberType]) {
        divisions[department][divisionName][memberType] = divisions[department][divisionName][memberType].filter(name => name !== officerName);
        saveData(DIVISIONS_FILE_PATH, divisions);
        res.json({ success: true });
    } else res.status(400).json({ success: false });
});

app.get('/api/diagnosticians', verifyToken, (req, res) => res.json(diagnosticians.map(({ password, token, ...diag }) => diag)));
app.post('/api/diagnosticians', verifyToken, verifyAdmin, (req, res) => {
    const { email, password, discordNick, robloxNick, discordId, skpNumber } = req.body;
    if (diagnosticians.some(d => d.email === email)) return res.status(400).json({ success: false, message: 'Istnieje.' });
    diagnosticians.push({ id: `diag_${crypto.randomUUID()}`, email, password, discordNick, robloxNick, discordId, skpNumber, isDiagnostician: true, token: null });
    saveData(DIAGNOSTICIANS_FILE_PATH, diagnosticians);
    res.status(201).json({ success: true });
});
app.delete('/api/diagnosticians/:id', verifyToken, verifyAdmin, (req, res) => {
    diagnosticians = diagnosticians.filter(d => d.id !== req.params.id);
    saveData(DIAGNOSTICIANS_FILE_PATH, diagnosticians);
    res.json({ success: true });
});

app.get('/api/bolo', verifyToken, (req, res) => res.json(bolo));
app.post('/api/bolo', verifyToken, async (req, res) => {
    const { type, details, photoUrl } = req.body;
    bolo.unshift({ id: crypto.randomUUID(), type, details, photoUrl, author: req.user.username, authorBadge: req.user.badge, createdAt: new Date().toISOString() });
    saveData(BOLO_FILE_PATH, bolo);
    // Webhook BOLO logic here (skrócone)
    res.status(201).json({ success: true });
});
app.delete('/api/bolo/:id', verifyToken, verifySenior, (req, res) => {
    bolo = bolo.filter(b => b.id !== req.params.id);
    saveData(BOLO_FILE_PATH, bolo);
    res.json({ success: true });
});

app.get('/api/leaves', verifyToken, (req, res) => res.json(leaves));
app.post('/api/leaves', verifyToken, async (req, res) => {
    const { reason, dateRange, canExtend, signature } = req.body;
    leaves.unshift({ id: crypto.randomUUID(), officerName: req.user.username, officerDiscordId: req.user.robloxId, officerRank: req.user.rank, officerBadge: req.user.badge, department: req.user.department, reason, dateRange, canExtend, signature, submittedAt: new Date().toISOString() });
    saveData(LEAVES_FILE_PATH, leaves);
    res.status(201).json({ success: true });
});
app.delete('/api/leaves/:id', verifyToken, (req, res) => {
    leaves = leaves.filter(l => l.id !== req.params.id);
    saveData(LEAVES_FILE_PATH, leaves);
    res.json({ success: true });
});

app.get('/api/impound', verifyToken, (req, res) => res.json(impound));
app.post('/api/impound', verifyToken, async (req, res) => {
    const plateNumber = (req.body.plate || '').split('/')[0].trim().toUpperCase();
    if (vehicles[plateNumber]) { vehicles[plateNumber].isImpounded = true; saveData(VEHICLES_FILE_PATH, vehicles); }
    impound.unshift({ id: crypto.randomUUID(), date: new Date().toISOString(), ...req.body });
    saveData(IMPOUND_FILE_PATH, impound);
    if(IMPOUND_WEBHOOK_URL) { /* Webhook logic */ }
    res.status(201).json({ success: true });
});
app.delete('/api/impound/:id', verifyToken, (req, res) => {
    const v = impound.find(v => v.id === req.params.id);
    if (v) { const plate = (v.plate||'').split('/')[0].trim().toUpperCase(); if(vehicles[plate]) { vehicles[plate].isImpounded = false; saveData(VEHICLES_FILE_PATH, vehicles); } }
    impound = impound.filter(v => v.id !== req.params.id);
    saveData(IMPOUND_FILE_PATH, impound);
    res.json({ success: true });
});

app.get('/api/suspended-licenses', verifyToken, (req, res) => {
    const now = new Date().getTime();
    suspendedLicenses = suspendedLicenses.filter(s => new Date(s.expiresAt).getTime() > now);
    saveData(SUSPENDED_LICENSES_FILE_PATH, suspendedLicenses);
    res.json(suspendedLicenses);
});
app.post('/api/suspended-licenses', verifyToken, async (req, res) => {
    const { officerName, citizenPing } = req.body;
    const discordIdMatch = (citizenPing || '').match(/<@(\d+)>/);
    const citizenId = discordIdMatch ? discordIdMatch[1] : null;
    if (!citizenId || !citizens[citizenId]) return res.status(404).json({ success: false });
    const end = new Date(); end.setDate(end.getDate() + 7);
    suspendedLicenses.push({ id: crypto.randomUUID(), officerName, citizenId, citizenName: citizens[citizenId].name, startsAt: new Date().toISOString(), expiresAt: end.toISOString() });
    saveData(SUSPENDED_LICENSES_FILE_PATH, suspendedLicenses);
    // Webhook & Role logic (skrócone)
    res.status(201).json({ success: true });
});
app.delete('/api/suspended-licenses/:id', verifyToken, verifySenior, (req, res) => {
    suspendedLicenses = suspendedLicenses.filter(s => s.id !== req.params.id);
    saveData(SUSPENDED_LICENSES_FILE_PATH, suspendedLicenses);
    res.json({ success: true });
});

// --- API UERD (NOWE - DODANE) ---

// 1. Zapisywanie Interwencji / Aktu Zgonu
app.post('/api/uerd/intervention', verifyToken, async (req, res) => {
    const { citizenId, type, reason, description, author } = req.body;
    
    // Wyciągnij czyste ID z formatu <@123>
    const discordIdMatch = (citizenId || '').match(/<@(\d+)>/);
    const cleanId = discordIdMatch ? discordIdMatch[1] : citizenId;

    if (!cleanId) return res.status(400).json({ success: false, message: 'Nieprawidłowe ID obywatela.' });

    // Zapisz raport w bazie UERD
    const newReport = {
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        citizenId: cleanId,
        type, reason, description, author,
        authorBadge: req.user.badge
    };
    
    if (!uerdReports[cleanId]) uerdReports[cleanId] = [];
    uerdReports[cleanId].unshift(newReport);
    saveData(UERD_REPORTS_FILE_PATH, uerdReports);

    // LOGIKA AKTU ZGONU - RESET KARTOTEKI
    if (type === 'AKT_ZGONU') {
        console.log(`Wystawiono AKT ZGONU dla ${cleanId}. Czyszczenie kartoteki...`);

        // 1. Wyczyść rekordy (mandaty/areszty)
        if (records[cleanId]) {
            delete records[cleanId];
            saveData(RECORDS_FILE_PATH, records);
        }
        
        // 2. Zresetuj liczniki obywatela
        if (citizens[cleanId]) {
            citizens[cleanId].ticketCount = 0;
            citizens[cleanId].arrestCount = 0;
            citizens[cleanId].warningCount = 0;
            citizens[cleanId].licenseSuspended = false;
            saveData(CITIZENS_FILE_PATH, citizens);
        }

        // 3. Usuń zawieszenie prawa jazdy
        const initialSuspensionsCount = suspendedLicenses.length;
        suspendedLicenses = suspendedLicenses.filter(s => s.citizenId !== cleanId);
        if (suspendedLicenses.length !== initialSuspensionsCount) {
            saveData(SUSPENDED_LICENSES_FILE_PATH, suspendedLicenses);
            // Opcjonalnie: Zdejmij rolę Discord jeśli masz bota podłączonego
            // manageRole(cleanId, 'remove'); 
        }

        // 4. Wyślij Webhook (Zgon)
        if (UERD_DEATH_WEBHOOK_URL && UERD_DEATH_WEBHOOK_URL.startsWith('http')) {
            try {
                await fetch(UERD_DEATH_WEBHOOK_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        content: `🚑 **AKT ZGONU / CK**\n\n**Obywatel:** <@${cleanId}>\n**Data:** ${new Date().toLocaleString('pl-PL')}\n**Przyczyna:** ${reason}\n**Wystawił:** ${author || req.user.username}`
                    })
                });
            } catch (e) { console.error("Błąd webhooka zgonu:", e); }
        }
    }

    res.json({ success: true, message: type === 'AKT_ZGONU' ? 'Akt zgonu wystawiony. Kartoteka zresetowana.' : 'Interwencja zapisana.' });
});

app.get('/api/uerd/reports', verifyToken, (req, res) => {
    // Zwraca płaską listę ostatnich raportów dla podglądu
    const allReports = Object.values(uerdReports).flat().sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(allReports.slice(0, 50)); // Ostatnie 50
});

app.delete('/api/uerd/reports/:id', verifyToken, (req, res) => {
    const id = req.params.id;
    let deleted = false;
    
    for (const citizenId in uerdReports) {
        const initialLen = uerdReports[citizenId].length;
        uerdReports[citizenId] = uerdReports[citizenId].filter(r => r.id !== id);
        if (uerdReports[citizenId].length !== initialLen) {
            deleted = true;
            break; // Zakładamy unikalne ID
        }
    }
    
    if (deleted) {
        saveData(UERD_REPORTS_FILE_PATH, uerdReports);
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false, message: 'Nie znaleziono raportu.' });
    }
});

// 2. Karty Inwalidzkie
app.post('/api/uerd/cards', verifyToken, (req, res) => {
    const newCard = { ...req.body, id: crypto.randomUUID(), issueDate: new Date().toISOString(), author: req.user.username };
    uerdCards.unshift(newCard);
    saveData(UERD_CARDS_FILE_PATH, uerdCards);
    res.json({ success: true });
});

app.get('/api/uerd/cards', verifyToken, (req, res) => {
    res.json(uerdCards);
});

app.delete('/api/uerd/cards/:id', verifyToken, (req, res) => {
    const id = req.params.id;
    const initialLen = uerdCards.length;
    uerdCards = uerdCards.filter(c => c.id !== id);
    
    if (uerdCards.length !== initialLen) {
        saveData(UERD_CARDS_FILE_PATH, uerdCards);
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false, message: 'Nie znaleziono karty.' });
    }
});

// 3. Zwolnienia Lekarskie (używamy tej samej struktury co raporty, ale jako inny 'typ' lub osobny plik, tu użyjemy uerdReports z typem 'ZWOLNIENIE')
app.post('/api/uerd/leaves', verifyToken, async (req, res) => {
    const { name, surname, period, reason, employer } = req.body;
    
    const newLeave = {
        id: crypto.randomUUID(),
        type: 'ZWOLNIENIE',
        date: new Date().toISOString(),
        details: { name, surname, period, reason, employer },
        author: req.user.username
    };
    
    // Zapisujemy "ogólnie" w osobnej tablicy 'leaves' w uerdReports
    if (!uerdReports['leaves']) uerdReports['leaves'] = [];
    uerdReports['leaves'].unshift(newLeave);
    saveData(UERD_REPORTS_FILE_PATH, uerdReports);

    // Webhook
    if (UERD_LEAVE_WEBHOOK_URL && UERD_LEAVE_WEBHOOK_URL.startsWith('http')) {
        try {
            const content = `# Zwolnienia Lekaskie <:UERD:1394667806888296609> \n\n\`\`\`**Imię:** ${name}\n**Nazwisko:** ${surname}\n**Okres zwolnienia:** ${period}\n**Powód zwolnienia:** ${reason}\n**Podpis osoby wystawiającego:** ${req.user.username}\n**Ping pracodawcy (jeśli jest):** ${employer || 'Brak'}\`\`\``;
            
            await fetch(UERD_LEAVE_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content })
            });
        } catch (e) { console.error("Błąd webhooka zwolnień:", e); }
    }

    res.json({ success: true });
});

app.get('/api/uerd/leaves', verifyToken, (req, res) => {
    res.json(uerdReports['leaves'] || []);
});

app.delete('/api/uerd/leaves/:id', verifyToken, (req, res) => {
    if (uerdReports['leaves']) {
        uerdReports['leaves'] = uerdReports['leaves'].filter(l => l.id !== req.params.id);
        saveData(UERD_REPORTS_FILE_PATH, uerdReports);
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false });
    }
});

// --- Zarządzanie Personelem UERD (Admin Panel) ---
app.get('/api/uerd/users', verifyToken, verifyAdmin, (req, res) => {
    res.json(Object.values(uerdUsers));
});

app.post('/api/uerd/users', verifyToken, verifyAdmin, (req, res) => {
    const { email, username, password, badge, rank } = req.body;
    if (uerdUsers[email]) return res.status(400).json({ success: false, message: 'Użytkownik istnieje.' });
    
    uerdUsers[email] = {
        id: crypto.randomUUID(), email, username, password, badge, rank,
        isAdmin: rank.includes('12'), // Auto admin dla rangi 12
        department: 'UERD'
    };
    saveData(UERD_USERS_FILE_PATH, uerdUsers);
    res.json({ success: true });
});

// --- END API ---

// --- Serwowanie plików statycznych ---
app.use(express.static('public'));

// --- Catch-all i start serwera ---
app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
        res.status(404).json({ success: false, message: 'Nie znaleziono takiego endpointu API.' });
    } else {
        res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
    }
});

// --- Start serwera I BOTA ---
client.once('ready', async () => {
    console.log(`Bot ${client.user.tag} jest gotowy!`);
    client.user.setActivity('WSP & OCSO & UERD', { type: ActivityType.Watching });
    
    loadDatabase();
    
    // Po wczytaniu bazy danych, odtwarzamy timery
    if(typeof restoreRoleTimers === 'function') restoreRoleTimers();
    
    // Uruchomienie serwera Express dopiero po zalogowaniu bota i załadowaniu danych
    app.listen(port, () => {
        console.log(`Serwer MDT działa. Adres: http://localhost:${port}`);
    });
});

client.login(BOT_TOKEN);