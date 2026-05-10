const TelegramBot = require('node-telegram-bot-api');

const token = process.env.BOT_TOKEN;

const bot = new TelegramBot(token, { polling: true });

/*
========================================
VALID CODES DATABASE
========================================
*/

const validCodes = [
  "2365",
  "9821",
  "5646",
  "7854"
];

/*
========================================
START COMMAND
========================================
*/

bot.onText(/\/start/, (msg) => {

    bot.sendMessage(msg.chat.id,
`🚀 Welcome to OIC Fusion Manager

Available Services:
✅ OIC Demo Instance
✅ Fusion Demo Instance
✅ Combo Plans
✅ SFTP & ATP Access

Commands:
/plans - View Pricing
/support - Contact Admin
/expiry - Renewal Notice
/validate CODE - Validate Bill Code
/newinstance - Instance Information`);
});

/*
========================================
PLANS
========================================
*/

bot.onText(/\/plans/, (msg) => {

    bot.sendMessage(msg.chat.id,
`💰 Pricing Plans

🔹 OIC Instance — ₹300/month
🔹 Fusion Instance — ₹300/month
🔹 Combo Pack — ₹500/month

🎁 SFTP & ATP details included with OIC.`);
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
EXPIRY
========================================
*/

bot.onText(/\/expiry/, (msg) => {

    bot.sendMessage(msg.chat.id,
`⚠️ RENEWAL NOTICE

Code                 : 2365
Paid                  : 09-May-2026
Expiry               : 09-June-2026
Renew Date      : 04-June-2026
Renew Contact : +919302613759

Action:
Contact us before the renew date to keep your instance active.`);
});

/*
========================================
VALIDATE
Usage:
/validate 2365
========================================
*/

bot.onText(/\/validate (.+)/, (msg, match) => {

    const code = match[1];

    if(validCodes.includes(code)) {

        bot.sendMessage(msg.chat.id,
`✅ BILL VALIDATED

Code ${code} is currently active.

Status: VALID
Access: APPROVED`);
    }
    else {

        bot.sendMessage(msg.chat.id,
`❌ INVALID CODE

Code ${code} is not valid or has expired.

Status: INVALID
Access: DENIED`);
    }
});

/*
========================================
NEW INSTANCE
========================================
*/

bot.onText(/\/newinstance/, (msg) => {

    bot.sendMessage(msg.chat.id,
`🆕 NEW INSTANCE REQUEST

Please send the following details:

👤 Name:
📧 Email:
📱 Mobile Number:
📦 Required Service:
   • OIC
   • Fusion
   • Combo

💳 Payment Screenshot

Admin will activate your instance shortly.`);
});

console.log("Bot Running...");
