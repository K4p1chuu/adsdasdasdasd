const { Client, GatewayIntentBits, Partials, PermissionsBitField, ActivityType } = require('discord.js');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// =================================================================================
// --- KONFIGURACJA ---
// Uzupełnij wszystkie poniższe wartości!
// =================================================================================

// Token bota z Discord Developer Portal
const BOT_TOKEN = 'MTQxMTI2OTA5NDUyNjY4MTExOQ.GqTWUl.b_X3_MaNMQSbaET9e2u5rgDfLUbpHHFeW67eEI'; 

// Adres URL do synchronizacji obywateli
const API_URL = 'http://localhost:3000/api/sync-citizens'; 

// ID serwera Discord, na którym działa bot
const GUILD_ID = '1202645184735613029'; 

// ID kanału, na który bot będzie wysyłał logi o synchronizacji
const LOG_CHANNEL_ID = '1423690747294519448'; 

// ID roli "brak prawa jazdy"
const NO_LICENSE_ROLE_ID = '1253431189314998405'; 

// --- Ścieżki do plików ---
const SUSPENDED_LICENSES_FILE_PATH = path.join(__dirname, '../db_suspended_licenses.json');

// =================================================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel, Partials.GuildMember, Partials.User],
});


// =================================================================================
// --- LOGIKA SYNCHRONIZACJI CZŁONKÓW ---
// =================================================================================

/**
 * Funkcja wykonująca synchronizację członków z serwerem API.
 * @param {import('discord.js').Guild} guild Obiekt serwera do synchronizacji.
 * @param {import('discord.js').TextChannel|null} feedbackChannel Kanał do wysłania odpowiedzi.
 */
async function runSync(guild, feedbackChannel = null) {
    if (!guild) {
        console.error("Błąd: Próbowano uruchomić synchronizację bez podania serwera.");
        return;
    }

    let logChannel = feedbackChannel;
    // Jeśli nie ma kanału zwrotnego (np. przy auto-sync), pobierz kanał logów
    if (!logChannel) {
        try {
            logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
        } catch (err) {
            console.error(`Nie udało się pobrać kanału logów o ID: ${LOG_CHANNEL_ID}`, err);
            logChannel = null; // Ustaw na null, aby uniknąć błędów przy próbie wysłania wiadomości
        }
    }

    try {
        if (feedbackChannel) {
            await feedbackChannel.send('[WSP-MDT] Rozpoczynam synchronizację członków. To może chwilę potrwać...');
        } else {
            console.log(`[${new Date().toLocaleString()}] Rozpoczynam automatyczną synchronizację dla serwera ${guild.name}...`);
        }

        const allMembers = await guild.members.fetch();
        const memberMap = new Map();
        allMembers.forEach(member => memberMap.set(member.id, member));

        try {
            const owner = await guild.members.fetch(guild.ownerId);
            if (owner) memberMap.set(owner.id, owner);
        } catch (err) {
            console.error("Nie udało się pobrać właściciela serwera po ID.", err);
        }
        
        const membersData = [...memberMap.values()].map(m => ({
            discordId: m.id,
            name: m.displayName,
        }));

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(membersData),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Błąd API: ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();
        const successMessage = `[WSP-MDT] Pomyślnie zsynchronizowano ${result.syncedCount} członków.`;
        
        if (result.success) {
            if (logChannel && logChannel.id !== feedbackChannel?.id) await logChannel.send(successMessage);
            else if (feedbackChannel) await feedbackChannel.send(successMessage);
            console.log(`[${new Date().toLocaleString()}] Synchronizacja zakończona pomyślnie.`);
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error('Błąd podczas synchronizacji:', error);
        if (logChannel) {
            await logChannel.send(`[WSP-MDT] Wystąpił błąd podczas synchronizacji: ${error.message}`);
        }
    }
}


// =================================================================================
// --- LOGIKA ZARZĄDZANIA ROLĄ "BRAK PRAWA JAZDY" ---
// =================================================================================

async function checkSuspensions(guild) {
    if (!guild) {
        console.error("checkSuspensions: Brak obiektu serwera. Pomijam sprawdzanie.");
        return;
    }
    try {
        if (!fs.existsSync(SUSPENDED_LICENSES_FILE_PATH) || !fs.readFileSync(SUSPENDED_LICENSES_FILE_PATH, 'utf-8').trim()) {
            return;
        }

        const fileContent = fs.readFileSync(SUSPENDED_LICENSES_FILE_PATH, 'utf-8');
        let suspensions = JSON.parse(fileContent);

        const now = new Date();
        let dataWasChanged = false;
        const activeSuspensions = [];

        for (const suspension of suspensions) {
            // Sprawdzanie, czy zawieszenie wygasło
            if (new Date(suspension.expiresAt) <= now) {
                console.log(`Wygasło zawieszenie dla ID: ${suspension.citizenId}. Zdejmuję rolę.`);
                try {
                    const member = await guild.members.fetch(suspension.citizenId);
                    if (member.roles.cache.has(NO_LICENSE_ROLE_ID)) {
                        await member.roles.remove(NO_LICENSE_ROLE_ID);
                        console.log(`Zdjęto rolę ${member.user.tag}`);
                    }
                } catch (error) {
                    if (error.code !== 10007) console.error(`Nie udało się zdjąć roli ID ${suspension.citizenId}.`, error.message);
                }
                dataWasChanged = true;
                continue;
            }

            // Nadawanie roli dla nowych zawieszeń
            if (!suspension.roleAssigned) {
                console.log(`Nowe zawieszenie dla ID: ${suspension.citizenId}. Nadaję rolę.`);
                try {
                    const member = await guild.members.fetch(suspension.citizenId);
                    await member.roles.add(NO_LICENSE_ROLE_ID);
                    suspension.roleAssigned = true;
                    dataWasChanged = true;
                    console.log(`Nadano rolę ${member.user.tag}`);
                } catch (error) {
                    if (error.code !== 10007) console.error(`Nie udało się nadać roli ID ${suspension.citizenId}.`, error.message);
                }
            }
            
            activeSuspensions.push(suspension);
        }

        if (dataWasChanged) {
            fs.writeFileSync(SUSPENDED_LICENSES_FILE_PATH, JSON.stringify(activeSuspensions, null, 2));
        }
    } catch (error) {
        console.error("Wystąpił błąd podczas sprawdzania zawieszeń:", error);
    }
}


// =================================================================================
// --- GŁÓWNE ZDARZENIA BOTA ---
// =================================================================================

client.once('ready', async () => {
    console.log(`Bot ${client.user.tag} jest gotowy!`);
    client.user.setActivity('WSP & OCSO', { type: ActivityType.Watching });

    try {
        const guild = await client.guilds.fetch(GUILD_ID);
        if (guild) {
            console.log(`Ustawiono automatyczne zadania dla serwera: ${guild.name}`);
            
            // --- Uruchomienie zadań cyklicznych ---
            // 1. Synchronizacja członków (co godzinę)
            await runSync(guild);
            setInterval(() => runSync(guild), 3600 * 1000);

            // 2. Sprawdzanie zawieszonych praw jazdy (co 15 sekund)
            setInterval(() => checkSuspensions(guild), 15000);

        } else {
            console.error(`Nie mogłem znaleźć serwera o ID: ${GUILD_ID}. Zadania automatyczne nie będą działać.`);
        }
    } catch (error) {
        console.error(`Nie udało się pobrać serwera o ID ${GUILD_ID}:`, error);
    }
});

client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild || !message.content.startsWith('!sync')) return;

    try {
        const member = message.member ?? await message.guild.members.fetch(message.author.id);
        
        if (!member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply('Nie masz uprawnień do używania tej komendy.');
        }
        await runSync(message.guild, message.channel);
    } catch (error) {
        console.error('Błąd przy komendzie !sync:', error);
        await message.reply(`Wystąpił błąd: ${error.message}`);
    }
});

client.login(BOT_TOKEN);

