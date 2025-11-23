const express = require('express');
const cors = require('cors');
const fs = require('fs');
const crypto = require('crypto');
const fetch = require('node-fetch');
const path = require('path');
const { Client, GatewayIntentBits, Partials, ActivityType } = require('discord.js');

// --- KONFIGURACJA ---
const BOT_TOKEN = 'MTQxMTI2OTA5NDUyNjY4MTExOQ.GhjnUi.E-Mhy4TNFpEsS62QD6N8pwjj08EEnm5XpCaeSw'; 
const GUILD_ID = '1202645184735613029';
const ROLE_ID = '1253431189314998405';
const PORT = 3000;

// --- WEBHOOKI ---
const TICKET_WEBHOOK_URL = 'https://discord.com/api/webhooks/1415072043858399394/6bYM_3C5rG2rWO-2hDfC63AC26eHHo9aCaojTXen9KBEE3x-OsInFHbiH1BA25hN5T7E';
const ARREST_WEBHOOK_URL = 'https://discord.com/api/webhooks/1414669238706245732/GLzu0BuHd2SFpuT2eX8hdSQ7NNtVHRH4B_Xed9MSbYMAgSxLiv780DBoHKBQ5lwDuxxO';
const REPORT_WEBHOOK_URL = 'https://discord.com/api/webhooks/1416718275512897587/M1etNa1iXF-I-OzVwNCYo-dZwa7A31vxOVumGZRtdo0j8jFgaGZ-mxSPxWBPfELFdD2t';
const VEHICLE_INSPECTION_WEBHOOK_URL = 'https://discord.com/api/webhooks/1413686917643501639/YOBjHaSmr4wmzMaKwZCdAfT1gaxcFOsRwGIQicxDAwP1y54ktqpi37hEVyTMZK9b1_rR';
const IMPOUND_WEBHOOK_URL = 'https://discord.com/api/webhooks/1421157864654766121/s0kM1PJ-bAin5awm0qjdyvbdBczMZcVMcEk1XVpjOv3GKOMBNvusIQZ4vBQTOTOeWOku';
const SUSPENDED_LICENSE_WEBHOOK_URL = 'https://discord.com/api/webhooks/1421209532490584187/_N6RsxZGlONA5N9Ttjd66izdAzU7cvelX9f4pTmRd12NHcmptgvVF3w6zWgR5HnjOhSo';

// Placeholdery (Zmień na właściwe linki jeśli posiadasz)
const UERD_DEATH_WEBHOOK_URL = 'https://discord.com/api/webhooks/123456789/zgon_placeholder'; 
const DOT_INVOICE_WEBHOOK_URL = 'https://discord.com/api/webhooks/123456789/faktury_dot_placeholder';
const DOT_REPORT_WEBHOOK_URL = 'https://discord.com/api/webhooks/123456789/raporty_dot_placeholder';

// ================================================================
// 1. ŚCIEŻKI DO PLIKÓW BAZY DANYCH
// ================================================================

const DB = {
    // POLICJA
    users: './db_users.json',
    citizens: './db_citizens.json',
    records: './db_records.json',
    announcements: './db_announcements.json',
    notes: './db_notes.json',
    chat: './db_chat.json',
    divisions: './db_divisions.json',
    bolo: './db_bolo.json',
    vehicles: './db_vehicles.json',
    leaves: './db_leaves.json',
    impound: './db_impound.json',
    suspended: './db_suspended_licenses.json',
    duty_hours: './db_duty_hours.json',
    active_duty: './db_active_duty.json',
    // CEPIK
    diagnosticians: './db_diagnosticians.json',
    // UERD
    uerd_users: './db_uerd_users.json',
    uerd_reports: './db_uerd_reports.json',
    uerd_cards: './db_uerd_cards.json',
    // DOT
    dot_users: './db_dot_users.json',
    dot_data: './db_dot_data.json',
    dot_reports: './db_dot_reports.json',
    dot_invoices: './db_dot_invoices.json',
    dot_parking: './db_dot_parking.json'
};

// ================================================================
// 2. DANE W PAMIĘCI
// ================================================================

let users = {}, citizens = {}, records = {}, announcements = [], notes = {}, chatMessages = [], divisions = {}, bolo = [], vehicles = {}, leaves = [], impound = [], suspendedLicenses = [];
let dutyHours = {}, activeDutySessions = {};
let diagnosticians = [];
let uerdUsers = {}, uerdReports = {}, uerdCards = [];
let dotUsers = {}, dotData = {}, dotReports = [], dotInvoices = [], dotParking = [];

const RANKS = {
    WSP: [ 'Superintendent', 'Deputy Chief Superintendent', 'Colonel', 'Lieutenant Colonel', 'Major', 'Captain', 'Lieutenant', 'Sergeant', 'Master Trooper', 'Trooper First Class', 'Trooper', 'Probationary Trooper' ],
    OCSO: [ 'Sheriff', 'Undersheriff', 'Colonel', 'Major', 'Captain', 'Lieutenant Colonel', 'Lieutenant', 'Staff Sergeant', 'Sergeant', 'Corporal', 'Deputy', 'Probationary Deputy' ],
    DOT: [ '01 WisDOT Director', 'Kierownik', 'Główny Inżynier', 'Inżynier', 'Starszy Mechanik', 'Mechanik', 'Młodszy Mechanik', 'Starszy Pracownik Drogowy', 'Pracownik Drogowy', 'Młodszy Pracownik Drogowy', 'Rekrut' ],
    UERD: [ 'Ranga 12 (Zarząd)', 'Ranga 11', 'Ranga 10', 'Ranga 9', 'Ranga 8', 'Ranga 7', 'Ranga 6', 'Ranga 5', 'Ranga 4', 'Ranga 3', 'Ranga 2', 'Ranga 1 (Kadet)' ]
};

const app = express();
const client = new Client({
    intents: [ GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers ],
    partials: [ Partials.GuildMember, Partials.User ],
});

// ================================================================
// 3. FUNKCJE POMOCNICZE (Ładowanie i Naprawa)
// ================================================================

function loadDatabase() {
    const load = (path, defaultVal) => {
        if (!fs.existsSync(path)) {
            try { fs.writeFileSync(path, JSON.stringify(defaultVal, null, 2)); } catch(e){}
            return defaultVal;
        }
        try {
            const raw = fs.readFileSync(path, 'utf-8');
            return raw.trim() ? JSON.parse(raw) : defaultVal;
        } catch (e) {
            console.error(`Błąd odczytu ${path}, resetowanie.`);
            return defaultVal;
        }
    };

    // --- 1. POLICJA ---
    users = load(DB.users, {});
    const hasAdmin = Object.values(users).some(u => u.isAdmin);
    if (!hasAdmin) {
        users['admin@wsp.gov'] = { id: 'admin', email: 'admin@wsp.gov', username: 'Administrator', password: 'admin', badge: '000', rank: 'Superintendent', department: 'WSP', isAdmin: true, token: null };
        saveData(DB.users, users);
        console.log(">>> [AUTO-FIX] Utworzono domyślne konto POLICJA: admin@wsp.gov");
    }

    citizens = load(DB.citizens, {});
    records = load(DB.records, {});
    announcements = load(DB.announcements, []);
    notes = load(DB.notes, {});
    chatMessages = load(DB.chat, []);
    vehicles = load(DB.vehicles, {});
    leaves = load(DB.leaves, []);
    impound = load(DB.impound, []);
    suspendedLicenses = load(DB.suspended, []);
    dutyHours = load(DB.duty_hours, {});
    activeDutySessions = load(DB.active_duty, {});
    divisions = load(DB.divisions, { WSP: {}, OCSO: {} });
    bolo = load(DB.bolo, []);

    // --- 2. CEPIK ---
    diagnosticians = load(DB.diagnosticians, []);
    if (diagnosticians.length === 0) {
        diagnosticians.push({ id: 'diag_01', email: 'diagnosta@cepik.gov', password: 'admin', discordNick: 'Diag', robloxNick: 'Diag', skpNumber: 'WA-001', isDiagnostician: true, token: null });
        saveData(DB.diagnosticians, diagnosticians);
        console.log(">>> [AUTO-FIX] Utworzono domyślne konto CEPIK: diagnosta@cepik.gov");
    }

    // --- 3. UERD ---
    uerdUsers = load(DB.uerd_users, {});
    if (Object.keys(uerdUsers).length === 0) {
        uerdUsers['admin@uerd.gov'] = { id: 'uerd_01', email: 'admin@uerd.gov', username: 'Szef UERD', password: 'admin', badge: '01', rank: 'Ranga 12 (Zarząd)', isAdmin: true, department: 'UERD', token: null };
        saveData(DB.uerd_users, uerdUsers);
        console.log(">>> [AUTO-FIX] Utworzono domyślne konto UERD: admin@uerd.gov");
    }
    uerdReports = load(DB.uerd_reports, {});
    uerdCards = load(DB.uerd_cards, []);

    // --- 4. DOT ---
    dotUsers = load(DB.dot_users, {});
    if (Object.keys(dotUsers).length === 0) {
        dotUsers['director@dot.gov'] = { id: 'dot_01', email: 'director@dot.gov', username: 'Dyrektor DOT', password: 'admin', badge: '01', rank: '01 WisDOT Director', isAdmin: true, department: 'DOT', token: null };
        saveData(DB.dot_users, dotUsers);
        console.log(">>> [AUTO-FIX] Utworzono domyślne konto DOT: director@dot.gov");
    }
    dotData = load(DB.dot_data, { prices: "<h3>Cennik</h3>", badges: [], employees: [] });
    dotReports = load(DB.dot_reports, []);
    dotInvoices = load(DB.dot_invoices, []);
    dotParking = load(DB.dot_parking, []);

    // Fix IDs for BOLO if missing
    let dataWasModified = false;
    bolo.forEach(entry => { if (!entry.id) { entry.id = crypto.randomUUID(); dataWasModified = true; } });
    if (dataWasModified) saveData(DB.bolo, bolo);

    console.log('✅ Wszystkie bazy danych załadowane.');
}

function saveData(filePath, data) {
    try { fs.writeFileSync(filePath, JSON.stringify(data, null, 2)); } catch (e) { console.error(`Błąd zapisu ${filePath}:`, e); }
}

// ================================================================
// 4. MIDDLEWARE & CONFIG
// ================================================================

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const verifyToken = (req, res, next) => {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ message: 'Brak tokenu' });
    
    let user = Object.values(users).find(u => u.token === token);
    if (!user) user = diagnosticians.find(d => d.token === token);
    if (!user) user = Object.values(uerdUsers).find(u => u.token === token);
    if (!user) user = Object.values(dotUsers).find(u => u.token === token);

    if (!user) return res.status(401).json({ message: 'Nieprawidłowy token sesji.' });

    // Fallback department dla starszych kont
    if (!user.department && !user.isDiagnostician) {
        if (user.rank && user.rank.includes('Director')) user.department = 'DOT';
        else if (user.rank && user.rank.includes('Ranga')) user.department = 'UERD';
        else user.department = 'WSP';
    }
    
    req.user = user;
    next();
};

const verifyAdmin = (req, res, next) => { 
    if (req.user?.isAdmin || req.user?.rank?.includes('Director') || req.user?.rank?.includes('Zarząd')) return next();
    return res.status(403).json({message:'Brak uprawnień'}); 
};

const verifySenior = (req, res, next) => { 
    const u = req.user;
    if(u.isAdmin || u.rank==='Superintendent' || u.rank==='Sheriff' || u.rank==='01 WisDOT Director') return next();
    res.status(403).json({message:'Wymagana ranga dowódcza'});
};

// ================================================================
// 5. ENDPOINTY LOGOWANIA
// ================================================================

app.post('/api/login', (req, res) => {
    const { username, password, system } = req.body;
    let user, pool, path, isArr = false;

    if (system === 'cepik') { pool = diagnosticians; path = DB.diagnosticians; isArr = true; }
    else if (system === 'uerd') { pool = uerdUsers; path = DB.uerd_users; }
    else if (system === 'dot') { pool = dotUsers; path = DB.dot_users; }
    else { pool = users; path = DB.users; }

    if (isArr) user = pool.find(u => u.email === username);
    else user = Object.values(pool).find(u => u.email === username);

    if (user && user.password === password) {
        user.token = crypto.randomBytes(32).toString('hex');
        if (isArr) saveData(path, pool);
        else { pool[user.email] = user; saveData(path, pool); }
        
        let redir = 'dashboard.html';
        if (system === 'cepik') redir = 'cepik.html';
        if (system === 'uerd') redir = 'uerd.html';
        if (system === 'dot') redir = 'dot-panel.html';

        return res.json({ success: true, token: user.token, redirect: redir });
    }
    res.status(401).json({ success: false, message: 'Błędne dane logowania.' });
});

app.get('/api/user-data', verifyToken, (req, res) => {
    const { password, token, ...safeUser } = req.user;
    if (diagnosticians.some(d => d.email === safeUser.email)) safeUser.isDiagnostician = true;
    res.json({ userData: safeUser });
});

app.get('/api/config/ranks', verifyToken, (req, res) => res.json(RANKS));

// ================================================================
// 6. ENDPOINTY DOT (WisDOT)
// ================================================================

app.get('/api/dot/data', verifyToken, (req, res) => res.json(dotData));
app.post('/api/dot/update-config', verifyToken, verifyAdmin, (req, res) => {
    if(req.body.type === 'prices') dotData.prices = req.body.data;
    if(req.body.type === 'badges') dotData.badges = req.body.data;
    if(req.body.type === 'employees') dotData.employees = req.body.data;
    saveData(DB.dot_data, dotData);
    res.json({success:true});
});
app.get('/api/dot/users', verifyToken, verifyAdmin, (req, res) => res.json(Object.values(dotUsers)));
app.post('/api/dot/users', verifyToken, verifyAdmin, (req, res) => {
    const { name, rank } = req.body;
    const email = name.toLowerCase().replace(/ /g, '.') + '@dot.gov';
    if(dotUsers[email]) return res.status(400).json({message:'Istnieje'});
    dotUsers[email] = { id: crypto.randomUUID(), email, username: name, password: '123', badge: 'DOT', rank, department: 'DOT', isAdmin: rank.includes('01'), token: null };
    saveData(DB.dot_users, dotUsers);
    dotData.employees = Object.values(dotUsers).map(u => ({name: u.username, rank: u.rank}));
    saveData(DB.dot_data, dotData);
    res.json({success:true});
});
app.delete('/api/dot/users/:id', verifyToken, verifyAdmin, (req, res) => {
    const id = req.params.id;
    let key = Object.keys(dotUsers).find(k => k === id || dotUsers[k].username === id);
    if(key) {
        delete dotUsers[key];
        saveData(DB.dot_users, dotUsers);
        dotData.employees = Object.values(dotUsers).map(u => ({name: u.username, rank: u.rank}));
        saveData(DB.dot_data, dotData);
        return res.json({success:true});
    }
    res.status(404).json({success:false});
});

app.get('/api/dot/invoices', verifyToken, (req, res) => res.json(dotInvoices));
app.post('/api/dot/invoice', verifyToken, async (req, res) => {
    const inv = {...req.body, id: Date.now(), issuedBy: req.user.username, timestamp: new Date().toISOString()};
    dotInvoices.push(inv);
    saveData(DB.dot_invoices, dotInvoices);
    if(DOT_INVOICE_WEBHOOK_URL) {
        try {
            const embed = { title: "🧾 Nowa Faktura WisDOT", color: 0xff9900, fields: [ {name:"Wystawił",value:inv.issuer},{name:"Płatnik",value:inv.payer},{name:"Kwota",value:`$${inv.amount}`} ] };
            await fetch(DOT_INVOICE_WEBHOOK_URL, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({embeds:[embed]})});
        } catch(e){}
    }
    res.json({success:true});
});

app.get('/api/dot/reports', verifyToken, (req, res) => res.json(dotReports));
app.post('/api/dot/report', verifyToken, async (req, res) => {
    const rep = {...req.body, id: Date.now(), author: req.user.username, dateSubmitted: new Date().toISOString()};
    dotReports.unshift(rep);
    saveData(DB.dot_reports, dotReports);
    if(DOT_REPORT_WEBHOOK_URL) {
        try {
            await fetch(DOT_REPORT_WEBHOOK_URL, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({content:`🚧 **RAPORT WisDOT**: ${rep.name} (${rep.rank})`})});
        } catch(e){}
    }
    res.json({success:true});
});

app.get('/api/dot/parking', verifyToken, (req, res) => res.json(dotParking));
app.post('/api/dot/parking', verifyToken, (req, res) => {
    dotParking.unshift({...req.body, id: Date.now(), towedBy: req.user.username, date: new Date().toISOString()});
    saveData(DB.dot_parking, dotParking);
    res.json({success:true});
});

// ================================================================
// 7. ENDPOINTY UERD (ADMIN & OPERACYJNE)
// ================================================================

// Zarządzanie pracownikami (Admin UERD)
app.get('/api/uerd/users', verifyToken, verifyAdmin, (req, res) => res.json(Object.values(uerdUsers)));
app.post('/api/uerd/users', verifyToken, verifyAdmin, (req, res) => {
    const { email, username, password, badge, rank } = req.body;
    if(uerdUsers[email]) return res.status(400).json({message:'Istnieje'});
    uerdUsers[email] = { id: crypto.randomUUID(), email, username, password, badge, rank, department:'UERD', isAdmin: rank.includes('12') || rank.includes('Zarząd'), token:null };
    saveData(DB.uerd_users, uerdUsers);
    res.json({success:true});
});
app.delete('/api/uerd/users/:id', verifyToken, verifyAdmin, (req, res) => {
    const target = Object.keys(uerdUsers).find(k => uerdUsers[k].id === req.params.id || k === req.params.id);
    if(target) { delete uerdUsers[target]; saveData(DB.uerd_users, uerdUsers); return res.json({success:true}); }
    res.status(404).json({success:false});
});

// Raporty i Interwencje
app.get('/api/uerd/reports', verifyToken, (req, res) => res.json(Object.values(uerdReports).flat()));
app.post('/api/uerd/intervention', verifyToken, async (req, res) => {
    const { citizenId, type, reason, description, author } = req.body;
    const cleanId = (citizenId || '').match(/<@(\d+)>/)?.[1] || citizenId;
    if (!cleanId) return res.status(400).json({ success: false });

    const newReport = { id: crypto.randomUUID(), date: new Date().toISOString(), citizenId: cleanId, type, reason, description, author, authorBadge: req.user.badge };
    if (!uerdReports[cleanId]) uerdReports[cleanId] = [];
    uerdReports[cleanId].unshift(newReport);
    saveData(DB.uerd_reports, uerdReports);

    if (type === 'AKT_ZGONU') {
        if (records[cleanId]) { delete records[cleanId]; saveData(DB.records, records); }
        if (citizens[cleanId]) {
            citizens[cleanId].ticketCount = 0; citizens[cleanId].arrestCount = 0; citizens[cleanId].warningCount = 0; citizens[cleanId].licenseSuspended = false;
            saveData(DB.citizens, citizens);
        }
        suspendedLicenses = suspendedLicenses.filter(s => s.citizenId !== cleanId);
        saveData(DB.suspended, suspendedLicenses);
        if (UERD_DEATH_WEBHOOK_URL) fetch(UERD_DEATH_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: `**AKT ZGONU**: <@${cleanId}>` }) }).catch(e=>{});
    }
    res.json({ success: true });
});

// ================================================================
// 8. ENDPOINTY CEPIK / POJAZDY
// ================================================================

app.get('/api/vehicles', verifyToken, (req, res) => res.json(Object.values(vehicles)));
app.get('/api/vehicle/:plate', verifyToken, (req, res) => {
    const v = vehicles[req.params.plate.toUpperCase()];
    if(v) res.json(v); else res.status(404).json({message:'Brak pojazdu'});
});
app.post('/api/vehicle-inspection', (req, res) => {
    try {
        const { reportType, reportContent, rawMessage } = req.body;
        const content = reportContent || rawMessage;
        if (!content) return res.status(400).json({ success: false });

        const plateMatch = content.match(/(?:numery rejestracyjne, stan|Tablice rejestracyjne \/ Stan|Numery rejestracyjne, stan):\s*\**\s*([^,\n]+)/i);
        const ownerMatch = content.match(/(?:właściciel pojazdu|Ping Właściciela pojazdu):\s*\**\s*<@(\d+)>/i);
        
        if (!plateMatch || !ownerMatch) return res.status(400).json({ success: false, message: 'Nie wykryto danych' });
        
        const plate = plateMatch[1].trim().toUpperCase();
        const ownerId = ownerMatch[1];
        
        const vehicle = vehicles[plate] || { inspections: [], registeredAt: new Date().toISOString() };
        Object.assign(vehicle, { plate, ownerId, ownerName: citizens[ownerId]?.name || 'Nieznany', lastInspection: new Date().toISOString(), status: reportType || (content.toLowerCase().includes('pozytywny') ? 'POZYTYWNY' : 'NEGATYWNY') });
        vehicle.inspections.unshift({ date: new Date().toISOString(), type: vehicle.status, content });
        vehicles[plate] = vehicle;
        saveData(DB.vehicles, vehicles);
        
        if (VEHICLE_INSPECTION_WEBHOOK_URL) fetch(VEHICLE_INSPECTION_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) }).catch(e=>console.error(e));
        res.status(201).json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

// ================================================================
// 9. ENDPOINTY POLICJA (WSPÓLNE)
// ================================================================

app.get('/api/search/citizen', (req, res) => {
    const q = (req.query.q||'').toLowerCase();
    const resList = Object.values(citizens).filter(c => c.name?.toLowerCase().includes(q) || c.id?.includes(q));
    res.json(resList);
});

app.get('/api/citizen/:id', verifyToken, (req, res) => {
    const citizenId = req.params.id;
    const citizen = citizens[citizenId];
    if (citizen) {
        const wantedMatches = bolo.filter(b => {
            const d = b.details || {};
            const involved = [d.osoba, d.kierowca, d.wlasciciel].filter(Boolean);
            return involved.some(p => p.includes(citizenId));
        });
        const ownedVehicles = Object.values(vehicles).filter(v => v.ownerId === citizenId);
        const now = new Date().getTime();
        const licenseSuspended = suspendedLicenses.some(s => s.citizenId === citizenId && new Date(s.expiresAt).getTime() > now);
        const disabilityCard = uerdCards.find(c => citizen.name && citizen.name.toLowerCase().includes(`${c.name} ${c.surname}`.toLowerCase()));

        res.json({
            ...citizen,
            records: (records[citizenId] || []).sort((a, b) => new Date(b.issueDate) - new Date(a.issueDate)),
            wantedStatus: wantedMatches.length > 0 ? wantedMatches : null,
            vehicles: ownedVehicles.map(v => ({ plate: v.plate, status: v.status, isImpounded: v.isImpounded || false })),
            licenseSuspended,
            disabilityCard: disabilityCard || null
        });
    } else res.status(404).json({ message: 'Nie znaleziono obywatela' });
});

app.get('/api/citizens', verifyToken, (req, res) => {
    const now = new Date().getTime();
    suspendedLicenses = suspendedLicenses.filter(s => new Date(s.expiresAt).getTime() > now);
    saveData(DB.suspended, suspendedLicenses);
    const result = Object.values(citizens).map(c => { c.licenseSuspended = suspendedLicenses.some(s => s.citizenId === c.discordId); return c; });
    res.json(result);
});

app.post('/api/records', verifyToken, async (req, res) => {
    const reportData = { ...req.body, id: crypto.randomUUID(), issueDate: new Date(), author: req.user.username, authorBadge: req.user.badge, department: req.user.department };
    const cleanId = (reportData.civilianDiscordId || '').match(/<@(\d+)>/)?.[1] || reportData.civilianDiscordId;
    if (!cleanId) return res.status(400).json({ success: false, message: "Brak ID." });

    if (!records[cleanId]) records[cleanId] = [];
    records[cleanId].unshift(reportData);
    saveData(DB.records, records);

    if (citizens[cleanId]) {
        if (reportData.reportType === 'mandat') citizens[cleanId].ticketCount = (citizens[cleanId].ticketCount || 0) + 1;
        else if (reportData.reportType === 'areszt') citizens[cleanId].arrestCount = (citizens[cleanId].arrestCount || 0) + 1;
        saveData(DB.citizens, citizens);
    }

    try {
        if (reportData.reportType === 'mandat') {
            const embed = { title: "MANDAT", description: `Wystawił: ${reportData.author}\nGrzywna: $${reportData.totalFine}`, color: 0xff0000 };
            await fetch(TICKET_WEBHOOK_URL, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ embeds: [embed], content: `||<@${cleanId}>||` }) });
        } else if (reportData.reportType === 'areszt') {
            const embed = { title: "ARESZT", description: `Wystawił: ${reportData.author}\nWyrok: ${reportData.finalSentence} min`, color: 0xff0000 };
            await fetch(ARREST_WEBHOOK_URL, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ embeds: [embed] }) });
        }
    } catch(e) {}
    res.json({ success: true });
});

app.get('/api/bolo', verifyToken, (req, res) => res.json(bolo));
app.post('/api/bolo', verifyToken, async (req, res) => {
    bolo.unshift({ ...req.body, id: crypto.randomUUID(), author: req.user.username, createdAt: new Date().toISOString() });
    saveData(DB.bolo, bolo);
    res.status(201).json({ success: true });
});
app.delete('/api/bolo/:id', verifyToken, verifySenior, (req, res) => {
    bolo = bolo.filter(b => b.id !== req.params.id);
    saveData(DB.bolo, bolo);
    res.json({ success: true });
});

app.get('/api/announcements', verifyToken, (req, res) => res.json(announcements));
app.post('/api/announcements', verifyToken, verifyAdmin, (req, res) => {
    announcements.unshift({ ...req.body, id: crypto.randomUUID(), author: req.user.username });
    saveData(DB.announcements, announcements);
    res.json({ success: true });
});
app.delete('/api/announcements/:id', verifyToken, verifyAdmin, (req, res) => {
    announcements = announcements.filter(a => a.id !== req.params.id);
    saveData(DB.announcements, announcements);
    res.json({ success: true });
});

app.get('/api/notes', verifyToken, (req, res) => res.json({ note: notes[req.user.id] || '' }));
app.post('/api/notes', verifyToken, (req, res) => { notes[req.user.id] = req.body.note; saveData(DB.notes, notes); res.json({ success: true }); });

app.get('/api/chat', verifyToken, (req, res) => res.json(chatMessages));
app.post('/api/chat', verifyToken, (req, res) => {
    if (!req.body.message) return res.status(400).json({ success: false });
    chatMessages.push({ ...req.body, id: crypto.randomUUID(), timestamp: new Date(), author: req.user.username, authorBadge: req.user.badge });
    if (chatMessages.length > 50) chatMessages.shift();
    saveData(DB.chat, chatMessages);
    res.json({ success: true });
});

app.get('/api/impound', verifyToken, (req, res) => res.json(impound));
app.post('/api/impound', verifyToken, async (req, res) => {
    const plateNumber = (req.body.plate || '').split('/')[0].trim().toUpperCase();
    if (vehicles[plateNumber]) { vehicles[plateNumber].isImpounded = true; saveData(DB.vehicles, vehicles); }
    impound.unshift({ id: crypto.randomUUID(), date: new Date().toISOString(), ...req.body });
    saveData(DB.impound, impound);
    if(IMPOUND_WEBHOOK_URL) fetch(IMPOUND_WEBHOOK_URL, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({content: `Odholowano pojazd: ${plateNumber}`})}).catch(e=>{});
    res.status(201).json({ success: true });
});

app.get('/api/suspended-licenses', verifyToken, (req, res) => res.json(suspendedLicenses));
app.post('/api/suspended-licenses', verifyToken, async (req, res) => {
    const { officerName, citizenPing } = req.body;
    const citizenId = (citizenPing || '').match(/<@(\d+)>/)?.[1];
    if (!citizenId || !citizens[citizenId]) return res.status(404).json({ success: false });
    const end = new Date(); end.setDate(end.getDate() + 7);
    suspendedLicenses.push({ id: crypto.randomUUID(), officerName, citizenId, citizenName: citizens[citizenId].name, startsAt: new Date().toISOString(), expiresAt: end.toISOString() });
    saveData(DB.suspended, suspendedLicenses);
    res.status(201).json({ success: true });
});

app.get('/api/leaves', verifyToken, (req, res) => res.json(leaves));
app.post('/api/leaves', verifyToken, (req, res) => {
    leaves.unshift({ ...req.body, id: crypto.randomUUID() });
    saveData(DB.leaves, leaves);
    res.json({success:true});
});

app.get('/api/duty/status', verifyToken, (req, res) => {
    const session = activeDutySessions[req.user.email];
    res.json(session ? { onDuty: true, startTime: session.startTime } : { onDuty: false });
});
app.post('/api/duty/start', verifyToken, (req, res) => {
    if (activeDutySessions[req.user.email]) return res.status(400).json({ success: false });
    activeDutySessions[req.user.email] = { startTime: new Date().toISOString(), username: req.user.username, badge: req.user.badge, department: req.user.department, rank: req.user.rank };
    saveData(DB.active_duty, activeDutySessions);
    res.json({ success: true, startTime: activeDutySessions[req.user.email].startTime });
});
app.post('/api/duty/end', verifyToken, (req, res) => {
    const session = activeDutySessions[req.user.email];
    if (!session) return res.status(400).json({ success: false });
    const hours = ((new Date()) - new Date(session.startTime)) / (1000 * 60 * 60);
    if (!dutyHours[req.user.email]) dutyHours[req.user.email] = { username: session.username, totalHours: 0 };
    dutyHours[req.user.email].totalHours += hours;
    delete activeDutySessions[req.user.email];
    saveData(DB.active_duty, activeDutySessions);
    saveData(DB.duty_hours, dutyHours);
    res.json({ success: true, hours });
});

app.get('/api/officers', verifyToken, (req, res) => res.json(Object.values(users)));
app.post('/api/officers', verifyToken, verifyAdmin, (req, res) => {
    const { email, username } = req.body;
    if(users[email]) return res.status(400).json({message:'Istnieje'});
    users[email] = { ...req.body, id: crypto.randomUUID(), token: null };
    saveData(DB.users, users);
    res.json({success:true});
});

// ================================================================
// 10. START SERWERA
// ================================================================

app.use(express.static('public'));
app.use((req, res) => {
    if (req.path.startsWith('/api/')) res.status(404).json({ success: false, message: 'API endpoint not found.' });
    else res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

client.once('ready', async () => {
    console.log(`Bot ${client.user.tag} gotowy!`);
    client.user.setActivity('WSP & OCSO & UERD & DOT', { type: ActivityType.Watching });
    loadDatabase(); 
    app.listen(PORT, () => console.log(`Serwer MDT działa na porcie ${PORT}`));
});

client.login(BOT_TOKEN);