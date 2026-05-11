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

async function loadSheet() {

    await doc.loadInfo();

    return doc.sheetsByTitle['Users'];
}

/*
========================================
VALIDATED USERS SESSION
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
START
========================================
*/

bot.onText(/^\/start$/, async (msg) => {

    bot.sendMessage(msg.chat.id,
`🚀 Welcome To OIC Fusion Manager

Commands:

/plans
/support
/validate CODE
/expiry
/newinstance`);
});

/*
========================================
PLANS
========================================
*/

bot.onText(/^\/plans$/, async (msg) => {

    bot.sendMessage(msg.chat.id,
`💰 Pricing Plans

🔹 OIC Instance — ₹300/month
🔹 Fusion Instance — ₹300/month
🔹 Combo Pack — ₹500/month`);
});

/*
========================================
SUPPORT
========================================
*/

bot.onText(/^\/support$/, async (msg) => {

    bot.sendMessage(msg.chat.id,
`📩 Support

Telegram:
@KLRAHUL_5646

WhatsApp:
+919302613759`);
});

/*
========================================
VALIDATE
========================================
*/

bot.onText(/^\/validate (.+)/, async (msg, match) => {

    try {

        const code = match[1].trim();

        const sheet = await loadSheet();

        const rows = await sheet.getRows({
            offset: 0
        });

        const users = rows.map(row => ({
            Code: row.get('Code'),
            Paid: row.get('Paid'),
            Expiry: row.get('Expiry'),
            Renew: row.get('Renew'),
            Active: row.get('Active')
        }));

        console.log(users);

        const user = users.find(
            u => String(u.Code).trim() === code
        );

        if(!user) {

            bot.sendMessage(msg.chat.id,
`❌ CODE NOT FOUND`);

            return;
        }

        if(String(user.Active).trim().toUpperCase() !== 'TRUE') {

            bot.sendMessage(msg.chat.id,
`❌ CODE DISABLED`);

            return;
        }

        if(isExpired(user.Expiry)) {

            bot.sendMessage(msg.chat.id,
`❌ CODE EXPIRED

Code: ${user.Code}

Expiry:
${user.Expiry}`);

            return;
        }

        validatedUsers[msg.chat.id] = user.Code;

        bot.sendMessage(msg.chat.id,
`✅ BILL VALIDATED

Code: ${user.Code}

Paid:
${user.Paid}

Expiry:
${user.Expiry}

Renew:
${user.Renew}

Status:
ACTIVE`);

    } catch(error) {

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

        const code = validatedUsers[msg.chat.id];

        if(!code) {

            bot.sendMessage(msg.chat.id,
`❌ Access Denied

Use:
/validate CODE`);

            return;
        }

        const sheet = await loadSheet();

        const rows = await sheet.getRows({
            offset: 0
        });

        const users = rows.map(row => ({
            Code: row.get('Code'),
            Paid: row.get('Paid'),
            Expiry: row.get('Expiry'),
            Renew: row.get('Renew'),
            Active: row.get('Active')
        }));

        const user = users.find(
            u => String(u.Code).trim() === code
        );

        if(!user) {

            bot.sendMessage(msg.chat.id,
`❌ USER NOT FOUND`);

            return;
        }

        bot.sendMessage(msg.chat.id,
`⚠️ RENEWAL NOTICE

Code:
${user.Code}

Paid:
${user.Paid}

Expiry:
${user.Expiry}

Renew Date:
${user.Renew}

Renew Contact:
+919302613759`);
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
NEW INSTANCE
========================================
*/

bot.onText(/^\/newinstance$/, async (msg) => {

    const code = validatedUsers[msg.chat.id];

    if(!code) {

        bot.sendMessage(msg.chat.id,
`❌ Access Denied

Validate first using:
/validate CODE`);

        return;
    }

    bot.sendMessage(msg.chat.id,
`🆕 INSTANCE INFORMATION

Your instance is active.

Contact Admin:

Telegram:
@KLRAHUL_5646

WhatsApp:
+919302613759`);
});

/*
========================================
TEST API
========================================
*/

app.get('/users', async (req, res) => {

    try {

        const sheet = await loadSheet();

        const rows = await sheet.getRows({
            offset: 0
        });

        const users = rows.map(row => ({
            Code: row.get('Code'),
            Paid: row.get('Paid'),
            Expiry: row.get('Expiry'),
            Renew: row.get('Renew'),
            Active: row.get('Active')
        }));

        res.json(users);

    } catch(error) {

        console.log(error);

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
