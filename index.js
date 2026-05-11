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
        Instances: String(row.get('Instances')).trim().toUpperCase()
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
CHECK ACCESS
========================================
*/

function hasFusionAccess(type) {

    return type === 'FUSION' || type === 'BOTH';
}

function hasOICAccess(type) {

    return type === 'OIC' || type === 'BOTH';
}

/*
========================================
START
========================================
*/

bot.onText(/^\/start$/, async (msg) => {

    bot.sendMessage(msg.chat.id,
`🚀 OIC Fusion Manager

━━━━━━━━━━━━━━

AVAILABLE COMMANDS

/plans
/support
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
PLANS
========================================
*/

bot.onText(/^\/plans$/, async (msg) => {

    bot.sendMessage(msg.chat.id,
`💰 PRICING PLANS

━━━━━━━━━━━━━━

🔹 OIC Instance
₹300 / Month

🔹 Fusion Instance
₹300 / Month

🔹 Combo Pack
₹500 / Month

━━━━━━━━━━━━━━`);
});

/*
========================================
SUPPORT
========================================
*/

bot.onText(/^\/support$/, async (msg) => {

    bot.sendMessage(msg.chat.id,
`📩 SUPPORT

━━━━━━━━━━━━━━

Telegram
@KLRAHUL_5646

WhatsApp
+919302613759

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
`❌ ACCESS DISABLED

Code: ${user.Code}

Contact Support:
@KLRAHUL_5646`);

            return;
        }

        if(isExpired(user.Expiry)) {

            bot.sendMessage(msg.chat.id,
`⚠️ INSTANCE EXPIRED

━━━━━━━━━━━━━━

Code
${user.Code}

Expiry Date
${user.Expiry}

━━━━━━━━━━━━━━

Contact Support
@KLRAHUL_5646`);

            return;
        }

        validatedUsers[msg.chat.id] = user.Code;

        bot.sendMessage(msg.chat.id,
`✅ BILL VALIDATED

━━━━━━━━━━━━━━

Code
${user.Code}

Plan
${user.Instances}

Paid Date
${user.Paid}

Expiry Date
${user.Expiry}

Renew Date
${user.Renew}

Status
ACTIVE

━━━━━━━━━━━━━━`);
    }

    catch(error) {

        console.log(error);

        bot.sendMessage(msg.chat.id,
`❌ SYSTEM ERROR

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

        const code = validatedUsers[msg.chat.id];

        if(!code) {

            bot.sendMessage(msg.chat.id,
`❌ ACCESS DENIED

Validate First

/validate CODE`);

            return;
        }

        const user = await getUserByCode(code);

        if(!user) {

            bot.sendMessage(msg.chat.id,
`❌ USER NOT FOUND`);

            return;
        }

        bot.sendMessage(msg.chat.id,
`📅 RENEWAL NOTICE

━━━━━━━━━━━━━━

Code
${user.Code}

Plan
${user.Instances}

Expiry Date
${user.Expiry}

Renew Date
${user.Renew}

━━━━━━━━━━━━━━

Contact
@KLRAHUL_5646`);
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
FUSION INSTANCE
========================================
*/

bot.onText(/^\/fusioninstance$/, async (msg) => {

    try {

        const code = validatedUsers[msg.chat.id];

        if(!code) {

            bot.sendMessage(msg.chat.id,
`❌ VALIDATE FIRST

/validate CODE`);

            return;
        }

        const user = await getUserByCode(code);

        if(
            user.Active.toUpperCase() !== 'TRUE' ||
            isExpired(user.Expiry)
        ) {

            bot.sendMessage(msg.chat.id,
`⚠️ INSTANCE EXPIRED`);

            return;
        }

        if(!hasFusionAccess(user.Instances)) {

            bot.sendMessage(msg.chat.id,
`❌ FUSION ACCESS NOT AVAILABLE

Your Plan:
${user.Instances}`);

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

        bot.sendMessage(msg.chat.id,
`❌ ERROR

${error.message}`);
    }
});

/*
========================================
OIC INSTANCE
========================================
*/

bot.onText(/^\/oicinstance$/, async (msg) => {

    try {

        const code = validatedUsers[msg.chat.id];

        if(!code) {

            bot.sendMessage(msg.chat.id,
`❌ VALIDATE FIRST

/validate CODE`);

            return;
        }

        const user = await getUserByCode(code);

        if(
            user.Active.toUpperCase() !== 'TRUE' ||
            isExpired(user.Expiry)
        ) {

            bot.sendMessage(msg.chat.id,
`⚠️ INSTANCE EXPIRED`);

            return;
        }

        if(!hasOICAccess(user.Instances)) {

            bot.sendMessage(msg.chat.id,
`❌ OIC ACCESS NOT AVAILABLE

Your Plan:
${user.Instances}`);

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

        const code = validatedUsers[msg.chat.id];

        if(!code) {

            bot.sendMessage(msg.chat.id,
`❌ VALIDATE FIRST

/validate CODE`);

            return;
        }

        const user = await getUserByCode(code);

        if(
            user.Active.toUpperCase() !== 'TRUE' ||
            isExpired(user.Expiry)
        ) {

            bot.sendMessage(msg.chat.id,
`⚠️ INSTANCE EXPIRED`);

            return;
        }

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

        const code = validatedUsers[msg.chat.id];

        if(!code) {

            bot.sendMessage(msg.chat.id,
`❌ VALIDATE FIRST

/validate CODE`);

            return;
        }

        const user = await getUserByCode(code);

        if(
            user.Active.toUpperCase() !== 'TRUE' ||
            isExpired(user.Expiry)
        ) {

            bot.sendMessage(msg.chat.id,
`⚠️ INSTANCE EXPIRED`);

            return;
        }

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

        const code = validatedUsers[msg.chat.id];

        if(!code) {

            bot.sendMessage(msg.chat.id,
`❌ VALIDATE FIRST

/validate CODE`);

            return;
        }

        const user = await getUserByCode(code);

        if(
            user.Active.toUpperCase() !== 'TRUE' ||
            isExpired(user.Expiry)
        ) {

            bot.sendMessage(msg.chat.id,
`⚠️ INSTANCE EXPIRED`);

            return;
        }

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

        const code = validatedUsers[msg.chat.id];

        if(!code) {

            bot.sendMessage(msg.chat.id,
`❌ VALIDATE FIRST

/validate CODE`);

            return;
        }

        const user = await getUserByCode(code);

        if(
            user.Active.toUpperCase() !== 'TRUE' ||
            isExpired(user.Expiry)
        ) {

            bot.sendMessage(msg.chat.id,
`⚠️ INSTANCE EXPIRED`);

            return;
        }

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
TEST API
========================================
*/

app.get('/users', async (req, res) => {

    try {

        const sheet = await loadUsersSheet();

        const rows = await sheet.getRows();

        const users = rows.map(row => ({
            Code: row.get('Code'),
            Paid: row.get('Paid'),
            Expiry: row.get('Expiry'),
            Renew: row.get('Renew'),
            Active: row.get('Active'),
            Instances: row.get('Instances')
        }));

        res.json(users);

    } catch(error) {

        res.json({
            error: error.message
        });
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

/*
========================================
START SERVER
========================================
*/

app.listen(PORT, () => {

    console.log('Bot Running...');
    console.log(`Server running on port ${PORT}`);
});
