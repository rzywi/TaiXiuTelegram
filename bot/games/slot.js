/* =========================
   GAME: SLOT MACHINE (nổ hũ)
========================= */

const core = require("../core");
const { send, telegram, money, settle, checkBet } = core;
const { iconRowPng } = require("./diceimg");
const { photoRoll, photoResult } = require("./suspense");
const replay = require("./replay");

const ICONS = ["🍒", "🍋", "🔔", "⭐", "💎", "7️⃣"];

/* icon guồng → key emoji (7️⃣ keycap không có file riêng → máy slot) */
const KEY_OF = {
    "🍒": "cherry", "🍋": "lemon", "🔔": "bell",
    "⭐": "star", "💎": "gem", "7️⃣": "seven",
    "🍇": "grapes", "🍉": "melon", "❓": "back"
};
const SPINS = ["🍒", "🍋", "🔔", "⭐", "💎", "7️⃣", "🍇", "🍉"];

/* lắc = 3 viên trắng in icon quay đổi liên tục, gieo sau */
const frameImg = (rolls, shake) =>
    iconRowPng(rolls.map(d => KEY_OF[SPINS[d % SPINS.length]]),
        shake);

function spinFrameKeys() {
    const p = () =>
        Math.floor(Math.random() * SPINS.length);
    return [p(), p(), p()];
}

function replayKB(bet) {
    return {
        inline_keyboard: [
            [replay.btn("🎰 Quay lại", "slot", "go", bet)],
            [replay.menuBtn()]
        ]
    };
}

async function playQuick(chatId, bet) {
    bet = parseInt(bet);
    if (!await checkBet(chatId, bet)) return;

    const kb = replayKB(bet);
    const head = `💸 Cược <b>${money(bet)} VNĐ</b>`;
    let played = null;
    try {
        played = await photoRoll(chatId, frameImg, 3, [
            `${head}\n\n🎰 [ ❓ | ❓ | ❓ ]\n<i>Bỏ xu… kéo cần…</i>`,
            `${head}\n\n🎰 <i>Guồng đang quay…</i>`,
            `${head}\n\n🎰 <i>Guồng đang quay…</i> 🌀`,
            `${head}\n\n🎰 <i>Dừng lại…</i>`
        ]);
    } catch {
        played = null;
    }

    const pick = () =>
        ICONS[Math.floor(Math.random() * ICONS.length)];
    const [a, b, c] = [pick(), pick(), pick()];

    let win = 0;
    if (a === b && b === c) {
        win = bet * 10;
    } else if (a === b || b === c || a === c) {
        win = bet * 2;
    }

    const newBalance = await settle(
        chatId, "slot", bet, win, `${a}${b}${c}`
    );

    const text =
        `🎰 [ ${a} | ${b} | ${c} ]\n\n` +
        (win === bet * 10
            ? `💎 NỔ HŨ JACKPOT! +${money(win)} VNĐ!`
            : win > 0
                ? `🎉 Trúng 2 icon, +${money(win)} VNĐ!`
                : `💀 Không trúng, -${money(bet)} VNĐ.`) +
        `\n💳 Còn: <b>${money(newBalance)} VNĐ</b>`;

    if (played) {
        const keys = [ICONS.indexOf(a),
                      ICONS.indexOf(b),
                      ICONS.indexOf(c)];
        await photoResult(chatId, played.messageId,
            await frameImg(keys, false), text, kb)
            .catch(() => send(chatId, text, { reply_markup: kb }));
        return;
    }

    await send(chatId, text, { reply_markup: kb });
}


module.exports = {
    commands: {
        "/slot": async (chatId, args) => {
            await playQuick(chatId, parseInt(args[0]));
        }
    },

    replay: (chatId, pick, bet) => playQuick(chatId, bet),

    help:
        "━━━ 🎰 <b>SLOT MACHINE</b> ━━━\n" +
        "/slot &lt;tiền&gt; — 3 icon giống nhau nổ hũ x10, 2 icon x2\n"
};
