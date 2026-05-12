const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const app = express();

const PORT = process.env.PORT || 10000;

const token = process.env.BOT_TOKEN;

const bot = new TelegramBot(token, {
    polling: true
});

/*
========================================
TELEGRAM MENU COMMANDS
========================================
*/

bot.setMyCommands([

    {
        command: 'start',
        description: 'Start Bot'
    },

    {
        command: 'validate',
        description: 'Validate Your Code'
    },

    {
        command: 'expiry',
        description: 'Check Subscription'
    },

    {
        command: 'fusioninstance',
        description: 'Fusion Instance Detail'
    },

    {
        command: 'oicinstance',
        description: 'OIC Instance Detail'
    },

    {
        command: 'oicsftpdetail',
        description: 'OIC SFTP Detail'
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

/*
========================================
GOOGLE SHEET CONFIG
========================================
*/

const SHEET_ID = '1vY_lDqZSYY39EJXK2WIUwVvD21yPsftfbw8MwoKp3G4';

const serviceAccountAuth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const doc = new GoogleSpreadsheet(
    SHEET_ID,
    serviceAccountAuth
);

/*
========================================
LOAD SHEETS
========================================
*/

async function loadUsersSheet() {

    await doc.loadInfo();

    return doc.sheetsByTitle['Users'];
}

async function loadCredentialsSheet() {

    await doc.loadInfo();

    return doc.sheetsByTitle['Credentials'];
}

/*
========================================
VALIDATED USERS
========================================
*/

const validatedUsers = {};

/*
========================================
CHECK EXPIRY
========================================
*/

function isExpired(expiryDate) {

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

    const parts = expiryDate.split('-');

    const day = parseInt(parts[0]);

    const month = months[parts[1]];

    const year = parseInt(parts[2]);

    const expiry = new Date(year, month, day);

    const today = new Date();

    expiry.setHours(0,0,0,0);

    today.setHours(0,0,0,0);

    return today > expiry;
}

/*
========================================
GET USER DATA
========================================
*/

async function getUserByCode(code) {

    const sheet = await loadUsersSheet();

    const rows = await sheet.getRows();

    const users = rows.map(row => ({
        Code: String(row.get('Code')).trim(),

        Paid: row.get('Paid'),

        Expiry: row.get('Expiry'),

        Renew: row.get('Renew'),

        Active: String(row.get('Active')).trim(),

        LastPayment: row.get('Last payment'),

        UserName: row.get('User Name'),

        UserCountryCode: row.get('User Country Code'),

        UserMobile: row.get('User Mobile'),

        UserTelegramId: row.get('User Telegram Id'),

        Instances: String(row.get('Instances'))
            .trim()
            .replace(/\s/g, '')
            .toUpperCase()
    }));

    return users.find(
        u => u.Code === code
    );
}

/*
========================================
GET CREDENTIALS
========================================
*/

async function getCredentials() {

    const sheet = await loadCredentialsSheet();

    const rows = await sheet.getRows();

    if(rows.length === 0) {
        return null;
    }

    return {
        fusion: rows[0].get('Fusion Detail'),
        oic: rows[0].get('OIC Detail'),
        sftp: rows[0].get('SFTP Detail'),
        atp: rows[0].get('ATP Detail'),
        ftp: rows[0].get('FTP Detail'),
        vbcs: rows[0].get('VBCS DB Detail')
    };
}

/*
========================================
ACCESS CHECK
========================================
*/

function hasFusionAccess(type) {

    return (
        type === 'FUSION' ||
        type === 'BOTH'
    );
}

function hasOICAccess(type) {

    return (
        type === 'OIC' ||
        type === 'BOTH'
    );
}

/*
========================================
VALID USER CHECK
========================================
*/

async function validateUserAccess(chatId) {

    const code = validatedUsers[chatId];

    if(!code) {
        return {
            success: false,
            message:
`❌ VALIDATE FIRST

/validate CODE`
        };
    }

    const user = await getUserByCode(code);

    if(!user) {
        return {
            success: false,
            message: '❌ USER NOT FOUND'
        };
    }

    if(
        user.Active.toUpperCase() !== 'TRUE' ||
        isExpired(user.Expiry)
    ) {

        return {
            success: false,
            message:
`⚠️ INSTANCE EXPIRED

━━━━━━━━━━━━━━

Code
${user.Code}

Expiry Date
${user.Expiry}

━━━━━━━━━━━━━━

Contact Support
@KLRAHUL_5646`
        };
    }

    return {
        success: true,
        user
    };
}

/*
========================================
START
========================================
*/

bot.onText(/^\/start$/, async (msg) => {

    const chatId = msg.chat.id;

    let userName = 'User';

    const code = validatedUsers[chatId];

    if(code) {

        const user = await getUserByCode(code);

        if(user && user.UserName) {

            userName = user.UserName;
        }
    }

    bot.sendMessage(chatId,
`🚀 Welcome ${userName}

━━━━━━━━━━━━━━

AVAILABLE COMMANDS

/validate CODE
/expiry

/fusioninstance
/oicinstance
/oicsftpdetail
/atpdetail
/ftpdetail
/vbcsdbdetail

━━━━━━━━━━━━━━`);
});

/*
========================================
VALIDATE
========================================
*/

bot.on('message', async (msg) => {

    try {

        if(!msg.text) return;

        if(!msg.text.startsWith('/validate')) return;

        const parts = msg.text.split(' ');

        if(parts.length < 2) {

            bot.sendMessage(msg.chat.id,
`❌ INVALID FORMAT

Use:
/validate CODE`);

            return;
        }

        const code = parts[1].trim();

        const user = await getUserByCode(code);

        if(!user) {

            bot.sendMessage(msg.chat.id,
`❌ CODE NOT FOUND`);

            return;
        }

        if(user.Active.toUpperCase() !== 'TRUE') {

            bot.sendMessage(msg.chat.id,
`❌ ACCESS DISABLED`);

            return;
        }

        if(isExpired(user.Expiry)) {

            bot.sendMessage(msg.chat.id,
`⚠️ INSTANCE EXPIRED

Expiry Date
${user.Expiry}`);

            return;
        }

        /*
        ========================================
        ADMIN ALERT
        ========================================
        */

        if(process.env.ADMIN_ID) {

            bot.sendMessage(
                process.env.ADMIN_ID,

`🚨 NEW USER VALIDATION

━━━━━━━━━━━━━━

👤 User
${user.UserName || 'N/A'}

🔑 Code
${user.Code}

📦 Plan
${user.Instances}

📱 Telegram ID
${msg.from.id}

🧑 Username
@${msg.from.username || 'N/A'}

🌍 Country Code
${user.UserCountryCode || 'N/A'}

📞 Mobile
${user.UserMobile || 'N/A'}

━━━━━━━━━━━━━━`
            );
        }

        validatedUsers[msg.chat.id] = user.Code;

        bot.sendMessage(msg.chat.id,
`✅ BILL VALIDATED

━━━━━━━━━━━━━━

👤 User
${user.UserName || 'N/A'}

Code
${user.Code}

Plan
${user.Instances}

📅 Expiry
${user.Expiry}

🟢 Status
ACTIVE

━━━━━━━━━━━━━━`);
    }

    catch(error) {

        console.log(error);

        bot.sendMessage(msg.chat.id,
`❌ ERROR

${error.message}`);
    }
});

/*
========================================
EXPIRY
========================================
*/

bot.onText(/^\/expiry$/, async (msg) => {

    try {

        const result = await validateUserAccess(msg.chat.id);

        if(!result.success) {

            bot.sendMessage(msg.chat.id, result.message);

            return;
        }

        const user = result.user;

        bot.sendMessage(msg.chat.id,
`📅 SUBSCRIPTION DETAILS

━━━━━━━━━━━━━━

👤 User
${user.UserName || 'N/A'}

📦 Plan
${user.Instances}

💰 Last Payment
${user.LastPayment || 'N/A'}

📅 Expiry
${user.Expiry}

🔄 Renew Before
${user.Renew}

🟢 Status
ACTIVE

━━━━━━━━━━━━━━`);
    }

    catch(error) {

        console.log(error);
    }
});

/*
========================================
FUSION INSTANCE
========================================
*/

bot.onText(/^\/fusioninstance$/, async (msg) => {

    try {

        const result = await validateUserAccess(msg.chat.id);

        if(!result.success) {

            bot.sendMessage(msg.chat.id, result.message);

            return;
        }

        const user = result.user;

        if(!hasFusionAccess(user.Instances)) {

            bot.sendMessage(msg.chat.id,
`❌ FUSION ACCESS NOT AVAILABLE`);

            return;
        }

        const creds = await getCredentials();

        bot.sendMessage(msg.chat.id,
`🚀 FUSION INSTANCE DETAIL

━━━━━━━━━━━━━━

${creds.fusion}

━━━━━━━━━━━━━━`);
    }

    catch(error) {

        console.log(error);
    }
});

/*
========================================
OIC INSTANCE
========================================
*/

bot.onText(/^\/oicinstance$/, async (msg) => {

    try {

        const result = await validateUserAccess(msg.chat.id);

        if(!result.success) {

            bot.sendMessage(msg.chat.id, result.message);

            return;
        }

        const user = result.user;

        if(!hasOICAccess(user.Instances)) {

            bot.sendMessage(msg.chat.id,
`❌ OIC ACCESS NOT AVAILABLE`);

            return;
        }

        const creds = await getCredentials();

        bot.sendMessage(msg.chat.id,
`☁️ OIC INSTANCE DETAIL

━━━━━━━━━━━━━━

${creds.oic}

━━━━━━━━━━━━━━`);
    }

    catch(error) {

        console.log(error);
    }
});

/*
========================================
SFTP DETAIL
========================================
*/

bot.onText(/^\/oicsftpdetail$/, async (msg) => {

    try {

        const result = await validateUserAccess(msg.chat.id);

        if(!result.success) {

            bot.sendMessage(msg.chat.id, result.message);

            return;
        }

        const user = result.user;

        if(!hasOICAccess(user.Instances)) {

            bot.sendMessage(msg.chat.id,
`❌ OIC ACCESS NOT AVAILABLE`);

            return;
        }

        const creds = await getCredentials();

        bot.sendMessage(msg.chat.id,
`📂 SFTP DETAIL

━━━━━━━━━━━━━━

${creds.sftp}

━━━━━━━━━━━━━━`);
    }

    catch(error) {

        console.log(error);
    }
});

/*
========================================
ATP DETAIL
========================================
*/

bot.onText(/^\/atpdetail$/, async (msg) => {

    try {

        const result = await validateUserAccess(msg.chat.id);

        if(!result.success) {

            bot.sendMessage(msg.chat.id, result.message);

            return;
        }

        const user = result.user;

        if(!hasOICAccess(user.Instances)) {

            bot.sendMessage(msg.chat.id,
`❌ OIC ACCESS NOT AVAILABLE`);

            return;
        }

        const creds = await getCredentials();

        bot.sendMessage(msg.chat.id,
`🗄 ATP DETAIL

━━━━━━━━━━━━━━

${creds.atp}

━━━━━━━━━━━━━━`);
    }

    catch(error) {

        console.log(error);
    }
});

/*
========================================
FTP DETAIL
========================================
*/

bot.onText(/^\/ftpdetail$/, async (msg) => {

    try {

        const result = await validateUserAccess(msg.chat.id);

        if(!result.success) {

            bot.sendMessage(msg.chat.id, result.message);

            return;
        }

        const user = result.user;

        if(!hasOICAccess(user.Instances)) {

            bot.sendMessage(msg.chat.id,
`❌ OIC ACCESS NOT AVAILABLE`);

            return;
        }

        const creds = await getCredentials();

        bot.sendMessage(msg.chat.id,
`📁 FTP DETAIL

━━━━━━━━━━━━━━

${creds.ftp}

━━━━━━━━━━━━━━`);
    }

    catch(error) {

        console.log(error);
    }
});

/*
========================================
VBCS DB DETAIL
========================================
*/

bot.onText(/^\/vbcsdbdetail$/, async (msg) => {

    try {

        const result = await validateUserAccess(msg.chat.id);

        if(!result.success) {

            bot.sendMessage(msg.chat.id, result.message);

            return;
        }

        const user = result.user;

        if(!hasOICAccess(user.Instances)) {

            bot.sendMessage(msg.chat.id,
`❌ OIC ACCESS NOT AVAILABLE`);

            return;
        }

        const creds = await getCredentials();

        bot.sendMessage(msg.chat.id,
`🗃 VBCS DB DETAIL

━━━━━━━━━━━━━━

${creds.vbcs}

━━━━━━━━━━━━━━`);
    }

    catch(error) {

        console.log(error);
    }
});

/*
========================================
ROOT
========================================
*/

app.get('/', (req, res) => {

    res.send('Bot Running...');
});

app.get('/health', (req, res) => {

    res.status(200).send('OK');
});

/*
========================================
START SERVER
========================================
*/

app.listen(PORT, () => {

    console.log('Bot Running...');
    console.log(`Server running on port ${PORT}`);
});

console.log('Bot Running...');
