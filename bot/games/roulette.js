/* =========================
   GAME: ROULETTE
========================= */

const core = require("../core");
const { send, telegram, money, settle, checkBet } = core;
const { iconRowPng } = require("./diceimg");
const { photoRoll, photoResult } = require("./suspense");
const replay = require("./replay");

/* xúc xắc lắc → viên trắng in 🔴/⚫/🟢 đổi liên tục */
const img = (rolls, shake) =>
    iconRowPng(rolls.map(d =>
        ["xanh", "do", "den"][d % 3]), shake);

function replayKB(target, bet) {
    return {
        inline_keyboard: [
            [replay.btn(`🎡 ${target} lại`, "roulette", target, bet)],
            [replay.menuBtn()]
        ]
    };
}

async function playQuick(chatId, target, bet) {
    bet = parseInt(bet);
    if (!await checkBet(chatId, bet)) return;

    const kb = replayKB(target, bet);
    const head = `💸 Cược <b>${money(bet)} VNĐ</b> cửa <b>${target}</b>`;
    let played = null;
    try {
        played = await photoRoll(chatId, img, 1, [
            `${head}\n\n🎡 <b>Bóng lăn…</b>`,
            `${head}\n\n🎡 <b>Bánh xe quay…</b>`,
            `${head}\n\n🎡 <b>Quay tít…</b> 🌀`,
            `${head}\n\n🎡 <b>Bóng rơi vào ô…</b>`
        ]);
    } catch {
        played = null;
    }

    const number =
        Math.floor(Math.random() * 37);
    const color =
        number === 0 ? "xanh"
            : Math.random() < 0.5 ? "do" : "den";

    let win = 0;
    let isWin = false;

    if (target === "do" || target === "den") {
        isWin = target === color;
        win = isWin ? bet * 2 : 0;
    } else {
        const num = parseInt(target);
        if (num === number && num <= 36) {
            isWin = true;
            win = bet * 36;
        }
    }

    const newBalance = await settle(
        chatId, "roulette", bet, win,
        `số ${number} ${color}`
    );

    const colorIcon =
        color === "xanh" ? "🟢"
            : color === "do" ? "🔴" : "⚫";

    const text =
        `🎡 Bánh xe dừng! Ra: <b>${number} ${colorIcon}</b>\n\n` +
        (isWin
            ? `🎉 Thắng +${money(win - bet)} VNĐ!`
            : `💀 Thua -${money(bet)} VNĐ.`) +
        `\n💳 Còn: <b>${money(newBalance)} VNĐ</b>`;

    if (played) {
        await photoResult(chatId, played.messageId,
            await img([color === "xanh" ? 0
                : color === "do" ? 1 : 2], false), text, kb)
            .catch(() => send(chatId, text, { reply_markup: kb }));
        return;
    }

    await send(chatId, text, { reply_markup: kb });
}


module.exports = {
    commands: {
        "/roulette": async (chatId, args) => {
            const target = (args[0] || "").toLowerCase();
            const bet = parseInt(args[1]);

            if (!target) {
                await send(chatId,
                    "Dùng: /roulette do|den|số(0-36) <tiền>");
                return;
            }
            await playQuick(chatId, target, bet);
        }
    },

    replay: playQuick,

    help:
        "━━━ 🎡 <b>ROULETTE</b> ━━━\n" +
        "/roulette do|den|số(0-36) &lt;tiền&gt; — " +
        "đỏ/đen x2, đoán đúng số x36\n"
};
