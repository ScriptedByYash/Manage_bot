const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const app = express();

const PORT = process.env.PORT || 10000;

const token = process.env.BOT_TOKEN;

const bot = new TelegramBot(token, { polling: true });

/*
========================================
GOOGLE SHEET SETUP
========================================
*/

const SHEET_ID = '1vY_lDqZSYY39EJXK2WIUwVvD21yPsftfbw8MwoKp3G4';

const serviceAccountAuth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const doc = new GoogleSpreadsheet(SHEET_ID, serviceAccountAuth);

async function loadSheet() {

    await doc.loadInfo();

    const sheet = doc.sheetsByTitle['Users'];

    return sheet;
}

/*
========================================
VALIDATED USERS
========================================
*/

const validatedUsers = {};

/*
========================================
START
========================================
*/

bot.onText(/\/start/, async (msg) => {

    bot.sendMessage(msg.chat.id,
`🚀 Welcome to OIC Fusion Manager

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

bot.onText(/\/plans/, async (msg) => {

    bot.sendMessage(msg.chat.id,
`💰 Pricing Plans

🔹 OIC — ₹300/month
🔹 Fusion — ₹300/month
🔹 Combo — ₹500/month`);
});

/*
========================================
SUPPORT
========================================
*/

bot.onText(/\/support/, async (msg) => {

    bot.sendMessage(msg.chat.id,
`📩 Contact Admin

Telegram: @KLRAHUL_5646
WhatsApp: +919302613759`);
});

/*
========================================
VALIDATE
========================================
*/

bot.onText(/\/validate (.+)/, async (msg, match) => {

    try {

        const code = match[1].trim();

        const sheet = await loadSheet();

        const rows = await sheet.getRows();

        console.log(rows.map(r => r.Code));

        const user = rows.find(r => String(r.Code).trim() === code);

        if(!user) {

            bot.sendMessage(msg.chat.id,
`❌ CODE NOT FOUND`);

            return;
        }

        if(String(user.Active).toUpperCase() !== 'TRUE') {

            bot.sendMessage(msg.chat.id,
`❌ CODE DISABLED`);

            return;
        }

        validatedUsers[msg.chat.id] = code;

        bot.sendMessage(msg.chat.id,
`✅ BILL VALIDATED

Code: ${user.Code}

Paid: ${user.Paid}
Expiry: ${user.Expiry}
Renew: ${user.Renew}

Access: APPROVED`);

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

bot.onText(/\/expiry/, async (msg) => {

    try {

        const code = validatedUsers[msg.chat.id];

        if(!code) {

            bot.sendMessage(msg.chat.id,
`❌ Access Denied

Validate first using:
/validate CODE`);

            return;
        }

        const sheet = await loadSheet();

        const rows = await sheet.getRows();

        const user = rows.find(r => String(r.Code).trim() === code);

        if(!user) {

            bot.sendMessage(msg.chat.id,
`❌ USER NOT FOUND`);

            return;
        }

        bot.sendMessage(msg.chat.id,
`⚠️ RENEWAL NOTICE

Code: ${user.Code}
Paid: ${user.Paid}
Expiry: ${user.Expiry}
Renew: ${user.Renew}

Contact:
+919302613759`);

    } catch(error) {

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

bot.onText(/\/newinstance/, async (msg) => {

    bot.sendMessage(msg.chat.id,
`🆕 INSTANCE INFORMATION

Your instance is active.

Contact Admin:
Telegram: @KLRAHUL_5646
WhatsApp: +919302613759`);
});

/*
========================================
TEST USERS API
========================================
*/

app.get('/users', async (req, res) => {

    try {

        const sheet = await loadSheet();

        const rows = await sheet.getRows();

        const users = rows.map(row => ({
            Code: row.Code,
            Paid: row.Paid,
            Expiry: row.Expiry,
            Renew: row.Renew,
            Active: row.Active
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
