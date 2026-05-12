const TelegramBot = require('node-telegram-bot-api');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const express = require('express');

const app = express();

const bot = new TelegramBot(process.env.BOT_TOKEN, {
    polling: true
});

const ADMIN_ID = process.env.ADMIN_ID;

const serviceAccountAuth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(
    process.env.SHEET_ID,
    serviceAccountAuth
);

let usersSheet;
let credentialsSheet;

async function loadSheet() {

    await doc.loadInfo();

    usersSheet = doc.sheetsByTitle['Users'];
    credentialsSheet = doc.sheetsByTitle['Credentials'];

    console.log('Google Sheets Loaded');
}

loadSheet();

async function getUsers() {

    const rows = await usersSheet.getRows();

    return rows.map(row => ({
        Code: row.get('Code'),
        Paid: row.get('Paid'),
        Expiry: row.get('Expiry'),
        Renew: row.get('Renew'),
        Active: row.get('Active'),
        Instences: row.get('Instences'),
        LastPayment: row.get('Last payment'),
        UserName: row.get('User Name'),
        UserCountryCode: row.get('User Country Code'),
        UserMobile: row.get('User Mobile'),
        UserTelegramId: row.get('User Telegram Id')
    }));
}

function parseDate(dateStr) {

    const months = {
        Jan: 0,
        Feb: 1,
        Mar: 2,
        Apr: 3,
        May: 4,
        Jun: 5,
        Jul: 6,
        Aug: 7,
        Sep: 8,
        Oct: 9,
        Nov: 10,
        Dec: 11
    };

    const parts = dateStr.split('-');

    return new Date(
        parseInt(parts[2]),
        months[parts[1]],
        parseInt(parts[0])
    );
}

function isExpired(expiryDate) {

    const today = new Date();

    today.setHours(0, 0, 0, 0);

    return parseDate(expiryDate) < today;
}

async function validateUser(code, telegramId, telegramUser) {

    const users = await getUsers();

    const user = users.find(
        u => u.Code === code
    );

    if (!user) {

        return {
            valid: false,
            message: '❌ CODE NOT FOUND'
        };
    }

    if (user.Active !== 'TRUE') {

        return {
            valid: false,
            message: '❌ ACCESS DISABLED'
        };
    }

    if (isExpired(user.Expiry)) {

        return {
            valid: false,
            message:
                '❌ INSTANCE EXPIRED\n\nPlease renew your subscription.'
        };
    }

    // TELEGRAM ID SECURITY

    if (
        user.UserTelegramId &&
        user.UserTelegramId !== telegramId.toString()
    ) {

        return {
            valid: false,
            message:
                '❌ THIS CODE IS ALREADY LINKED TO ANOTHER TELEGRAM ACCOUNT'
        };
    }

    // FIRST TIME VALIDATION

    if (!user.UserTelegramId) {

        if (ADMIN_ID) {

            bot.sendMessage(
                ADMIN_ID,
                `
🚨 NEW USER VALIDATION

Code: ${user.Code}
User Name: ${user.UserName || 'N/A'}
Telegram Name: @${telegramUser.username || 'No Username'}
Telegram ID: ${telegramId}
Mobile: +${user.UserCountryCode}${user.UserMobile}
Plan: ${user.Instences}
                `
            );
        }
    }

    return {
        valid: true,
        user
    };
}

// START

bot.onText(/\/start/, async (msg) => {

    const chatId = msg.chat.id;

    const users = await getUsers();

    const user = users.find(
        u => u.UserTelegramId === chatId.toString()
    );

    if (!user) {

        bot.sendMessage(
            chatId,
            `
🚀 OIC Fusion Manager

━━━━━━━━━━━━━━

Please validate your code first.

Example:
/validate 2365

━━━━━━━━━━━━━━
            `
        );

        return;
    }

    bot.sendMessage(
        chatId,
        `
🚀 Welcome ${user.UserName || 'User'}

━━━━━━━━━━━━━━

📦 Plan
${user.Instences}

📅 Expiry
${user.Expiry}

Available Commands

/expiry
/fusioninstance
/oicinstance
/oicsftpdetail
/atpdetail
/ftpdetail
/vbcsdbdetail

━━━━━━━━━━━━━━
        `
    );
});

// VALIDATE

bot.onText(/\/validate (.+)/, async (msg, match) => {

    const chatId = msg.chat.id;

    const code = match[1];

    const result = await validateUser(
        code,
        chatId,
        msg.from
    );

    if (!result.valid) {

        bot.sendMessage(chatId, result.message);

        return;
    }

    bot.sendMessage(
        chatId,
        `
✅ CODE VALIDATED

👤 User
${result.user.UserName}

📦 Plan
${result.user.Instences}

📅 Expiry
${result.user.Expiry}

━━━━━━━━━━━━━━
        `
    );
});

// EXPIRY

bot.onText(/\/expiry/, async (msg) => {

    const chatId = msg.chat.id;

    const users = await getUsers();

    const user = users.find(
        u => u.UserTelegramId === chatId.toString()
    );

    if (!user) {

        bot.sendMessage(
            chatId,
            '❌ VALIDATE YOUR CODE FIRST'
        );

        return;
    }

    bot.sendMessage(
        chatId,
        `
📅 SUBSCRIPTION DETAILS

━━━━━━━━━━━━━━

👤 User
${user.UserName}

📦 Plan
${user.Instences}

💰 Last Payment
₹${user.LastPayment}

📅 Expiry
${user.Expiry}

🔄 Renew Before
${user.Renew}

🟢 Status
ACTIVE

━━━━━━━━━━━━━━
        `
    );
});

// LOAD CREDENTIALS

async function getCredentials() {

    const rows = await credentialsSheet.getRows();

    const row = rows[0];

    return {
        fusion: row.get('Fusion Detail'),
        oic: row.get('OIC Detail'),
        sftp: row.get('SFTP Detail'),
        atp: row.get('ATP Detail'),
        ftp: row.get('FTP Detail'),
        vbcs: row.get('VBCS DB Detail')
    };
}

async function getCurrentUser(chatId) {

    const users = await getUsers();

    return users.find(
        u => u.UserTelegramId === chatId.toString()
    );
}

// FUSION

bot.onText(/\/fusioninstance/, async (msg) => {

    const chatId = msg.chat.id;

    const user = await getCurrentUser(chatId);

    if (!user) {

        bot.sendMessage(chatId, '❌ ACCESS DENIED');

        return;
    }

    if (
        user.Instences !== 'FUSION' &&
        user.Instences !== 'BOTH'
    ) {

        bot.sendMessage(
            chatId,
            '❌ FUSION ACCESS NOT AVAILABLE'
        );

        return;
    }

    const creds = await getCredentials();

    bot.sendMessage(
        chatId,
        `🚀 FUSION DETAIL\n\n${creds.fusion}`
    );
});

// OIC

bot.onText(/\/oicinstance/, async (msg) => {

    const chatId = msg.chat.id;

    const user = await getCurrentUser(chatId);

    if (!user) {

        bot.sendMessage(chatId, '❌ ACCESS DENIED');

        return;
    }

    if (
        user.Instences !== 'OIC' &&
        user.Instences !== 'BOTH'
    ) {

        bot.sendMessage(
            chatId,
            '❌ OIC ACCESS NOT AVAILABLE'
        );

        return;
    }

    const creds = await getCredentials();

    bot.sendMessage(
        chatId,
        `🚀 OIC DETAIL\n\n${creds.oic}`
    );
});

// SFTP

bot.onText(/\/oicsftpdetail/, async (msg) => {

    const chatId = msg.chat.id;

    const user = await getCurrentUser(chatId);

    if (!user) {

        bot.sendMessage(chatId, '❌ ACCESS DENIED');

        return;
    }

    if (
        user.Instences !== 'OIC' &&
        user.Instences !== 'BOTH'
    ) {

        bot.sendMessage(
            chatId,
            '❌ SFTP ACCESS NOT AVAILABLE'
        );

        return;
    }

    const creds = await getCredentials();

    bot.sendMessage(
        chatId,
        `🚀 SFTP DETAIL\n\n${creds.sftp}`
    );
});

// ATP

bot.onText(/\/atpdetail/, async (msg) => {

    const chatId = msg.chat.id;

    const user = await getCurrentUser(chatId);

    if (!user) {

        bot.sendMessage(chatId, '❌ ACCESS DENIED');

        return;
    }

    if (
        user.Instences !== 'OIC' &&
        user.Instences !== 'BOTH'
    ) {

        bot.sendMessage(
            chatId,
            '❌ ATP ACCESS NOT AVAILABLE'
        );

        return;
    }

    const creds = await getCredentials();

    bot.sendMessage(
        chatId,
        `🚀 ATP DETAIL\n\n${creds.atp}`
    );
});

// FTP

bot.onText(/\/ftpdetail/, async (msg) => {

    const chatId = msg.chat.id;

    const user = await getCurrentUser(chatId);

    if (!user) {

        bot.sendMessage(chatId, '❌ ACCESS DENIED');

        return;
    }

    if (
        user.Instences !== 'OIC' &&
        user.Instences !== 'BOTH'
    ) {

        bot.sendMessage(
            chatId,
            '❌ FTP ACCESS NOT AVAILABLE'
        );

        return;
    }

    const creds = await getCredentials();

    bot.sendMessage(
        chatId,
        `🚀 FTP DETAIL\n\n${creds.ftp}`
    );
});

// VBCS

bot.onText(/\/vbcsdbdetail/, async (msg) => {

    const chatId = msg.chat.id;

    const user = await getCurrentUser(chatId);

    if (!user) {

        bot.sendMessage(chatId, '❌ ACCESS DENIED');

        return;
    }

    if (
        user.Instences !== 'OIC' &&
        user.Instences !== 'BOTH'
    ) {

        bot.sendMessage(
            chatId,
            '❌ VBCS ACCESS NOT AVAILABLE'
        );

        return;
    }

    const creds = await getCredentials();

    bot.sendMessage(
        chatId,
        `🚀 VBCS DB DETAIL\n\n${creds.vbcs}`
    );
});

// COMMAND MENU

bot.setMyCommands([

    {
        command: 'start',
        description: 'Open Main Menu'
    },

    {
        command: 'expiry',
        description: 'Check Subscription'
    },

    {
        command: 'fusioninstance',
        description: 'Fusion Detail'
    },

    {
        command: 'oicinstance',
        description: 'OIC Detail'
    },

    {
        command: 'oicsftpdetail',
        description: 'SFTP Detail'
    },

    {
        command: 'atpdetail',
        description: 'ATP Detail'
    },

    {
        command: 'ftpdetail',
        description: 'FTP Detail'
    },

    {
        command: 'vbcsdbdetail',
        description: 'VBCS DB Detail'
    }

]);

// APIs

app.get('/', (req, res) => {

    res.send('Bot Running...');
});

app.get('/health', (req, res) => {

    res.status(200).send('OK');
});

app.get('/users', async (req, res) => {

    const users = await getUsers();

    res.json(users);
});

// KEEP ALIVE LOG

setInterval(() => {

    console.log('Bot Alive:', new Date());

}, 60000);

// SERVER

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {

    console.log(`Server running on port ${PORT}`);
});

console.log('Bot Running...');
