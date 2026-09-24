/* =========================
   GAME: ĐOÁN XÚC XẮC
========================= */

const core = require("../core");
const { send, telegram, money, settle, checkBet } = core;
const { diceRowPng } = require("./diceimg");
const { photoRoll, photoResult } = require("./suspense");
const replay = require("./replay");

const FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

function replayKB(guess, bet) {
    return {
        inline_keyboard: [[
            replay.btn(`🎲 ${guess} lại`, "dice", String(guess), bet),
            { text: "🎲 Cổng cược", callback_data: "again:portal:taixiu" }
        ]]
    };
}

async function playQuick(chatId, guess, bet) {
    guess = parseInt(guess);
    bet = parseInt(bet);
    if ((!guess || guess < 1 || guess > 6) ||
        !await checkBet(chatId, bet)) return;

    const kb = replayKB(guess, bet);
    const head = `💸 <b>${money(bet)} VNĐ</b> đoán <b>${guess}</b>`;
    let played = null;
    try {
        played = await photoRoll(chatId,
            (r, s) => diceRowPng(r, s), 1,
            [
                `${head}\n\n🎲 <b>Bỏ xúc xắc vào chén…</b>`,
                `${head}\n\n🎲 <b>Lắc… Lắc…</b>`,
                `${head}\n\n🥣 <b>Úp xuống…</b>`,
                `${head}\n\n✨ <b>MỞ…</b>`
            ]);
    } catch {
        played = null;
    }

    const roll = played
        ? played.rolls[0]
        : Math.floor(Math.random() * 6) + 1;
    const isWin = guess === roll;
    const win = isWin ? Math.floor(bet * 5.8) : 0;

    const newBalance = await settle(
        chatId, "dice", bet, win, `đoán ${guess} ra ${roll}`
    );

    const text =
        `🎲 Xúc xắc ra: <b>${roll}</b> ${FACES[roll - 1]}\n` +
        (isWin
            ? `🎉 Chuẩn! Thắng +${money(win - bet)} VNĐ (x5.8)!`
            : `💀 Sai, -${money(bet)} VNĐ.`) +
        `\n💳 Còn: <b>${money(newBalance)} VNĐ</b>`;

    if (played) {
        await photoResult(chatId, played.messageId,
            diceRowPng([roll]), text, kb)
            .catch(() => send(chatId, text, { reply_markup: kb }));
        return;
    }

    await send(chatId, text, { reply_markup: kb });
}


module.exports = {
    commands: {
        "/dice": async (chatId, args) => {
            const guess = parseInt(args[0]);
            const bet = parseInt(args[1]);

            if (!guess || guess < 1 || guess > 6) {
                await send(chatId, "Dùng: /dice <số 1-6> <tiền>");
                return;
            }
            await playQuick(chatId, guess, bet);
        }
    },

    replay: playQuick,

    help:
        "━━━ 🎲 <b>ĐOÁN XÚC XẮC</b> ━━━\n" +
        "/dice &lt;số 1-6&gt; &lt;tiền&gt; — đoán đúng ăn x5.8\n"
};
