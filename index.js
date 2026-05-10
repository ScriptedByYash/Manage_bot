const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

const token = process.env.BOT_TOKEN;

const bot = new TelegramBot(token, { polling: true });

/*
========================================
ADMIN SETTINGS
========================================
*/

const ADMIN_ID = 934377942;
// Replace with your Telegram numeric ID

/*
========================================
LOAD USERS DATABASE
========================================
*/

const USERS_FILE = 'users.json';

function loadUsers() {
    return JSON.parse(fs.readFileSync(USERS_FILE));
}

function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

let users = loadUsers();

/*
========================================
AUTO EXPIRY CHECK
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
VALIDATED USERS SESSION
========================================
*/

const validatedUsers = {};

/*
========================================
START
========================================
*/

bot.onText(/\/start/, (msg) => {

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

bot.onText(/\/plans/, (msg) => {

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

bot.onText(/\/support/, (msg) => {

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

bot.onText(/\/validate (.+)/, (msg, match) => {

    users = loadUsers();

    const code = match[1];
    const chatId = msg.chat.id;

    if(users[code]) {

        if(isExpired(users[code].expiry)) {

            users[code].active = false;
            saveUsers(users);

            bot.sendMessage(chatId,
`❌ CODE EXPIRED

Code: ${code}

Status: EXPIRED
Access: DENIED`);

            return;
        }

        if(users[code].active === true) {

            validatedUsers[chatId] = code;

            bot.sendMessage(chatId,
`✅ BILL VALIDATED

Code: ${code}

Status: ACTIVE
Access: APPROVED`);
        }
        else {

            bot.sendMessage(chatId,
`❌ INVALID OR DISABLED CODE`);
        }
    }
    else {

        bot.sendMessage(chatId,
`❌ CODE NOT FOUND`);
    }
});

/*
========================================
EXPIRY
========================================
*/

bot.onText(/\/expiry/, (msg) => {

    const chatId = msg.chat.id;

    const code = validatedUsers[chatId];

    if(!code) {

        bot.sendMessage(chatId,
`❌ Access Denied

Validate first using:
/validate CODE`);

        return;
    }

    users = loadUsers();

    const user = users[code];

    bot.sendMessage(chatId,
`⚠️ RENEWAL NOTICE

Code                 : ${code}
Paid                  : ${user.paid}
Expiry               : ${user.expiry}
Renew Date      : ${user.renew}
Renew Contact : +919302613759

Action:
Contact us before renew date to keep your instance active.`);
});

/*
========================================
NEW INSTANCE
========================================
*/

bot.onText(/\/newinstance/, (msg) => {

    const chatId = msg.chat.id;

    const code = validatedUsers[chatId];

    if(!code) {

        bot.sendMessage(chatId,
`❌ Access Denied

Validate first using:
/validate CODE`);

        return;
    }

    bot.sendMessage(chatId,
`🆕 INSTANCE INFORMATION

Your instance is active.

Contact Admin:
Telegram: @KLRAHUL_5646
WhatsApp: +919302613759`);
});

/*
========================================
ADD USER
ADMIN ONLY
========================================

Usage:
/adduser 7890 09-May-2026 09-June-2026 04-June-2026

========================================
*/

bot.onText(/\/adduser (.+)/, (msg, match) => {

    if(msg.from.id !== ADMIN_ID) {

        bot.sendMessage(msg.chat.id,
`❌ Admin only command`);

        return;
    }

    users = loadUsers();

    const data = match[1].split(' ');

    if(data.length < 4) {

        bot.sendMessage(msg.chat.id,
`❌ Invalid Format

Example:
/adduser 7890 09-May-2026 09-June-2026 04-June-2026`);

        return;
    }

    const code = data[0];
    const paid = data[1];
    const expiry = data[2];
    const renew = data[3];

    users[code] = {
        paid,
        expiry,
        renew,
        active: true
    };

    saveUsers(users);

    bot.sendMessage(msg.chat.id,
`✅ USER ADDED

Code: ${code}`);
});

console.log('Bot Running...');
