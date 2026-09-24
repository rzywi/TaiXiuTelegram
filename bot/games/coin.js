/* =========================
   GAME: TUNG ĐỒNG XU
========================= */

const core = require("../core");
const { send, telegram, money, settle, checkBet } = core;
const { iconRowPng } = require("./diceimg");
const { photoRoll, photoResult } = require("./suspense");
const replay = require("./replay");

const FACES = ["🌕 NGỬA", "🌑 SẤP"];

/* lắc = 1 viên trắng in 🌕/🌑 đổi liên tục, gieo sau animation */
const img = (rolls, shake) =>
    iconRowPng([rolls[0] % 2 ? "ngua" : "sap"], shake);

function replayKB(bet) {
    return {
        inline_keyboard: [
            [
                replay.btn("🌕 Ngửa lại", "coin", "ngua", bet),
                replay.btn("🌑 Sấp lại", "coin", "sap", bet)
            ],
            [replay.menuBtn()]
        ]
    };
}

async function playQuick(chatId, side, bet) {
    bet = parseInt(bet);
    if (!await checkBet(chatId, bet)) return;

    const kb = replayKB(bet);
    const head = `💸 <b>${money(bet)} VNĐ</b> cửa ` +
        `<b>${side === "ngua" ? "NGỬA" : "SẤP"}</b>`;
    let played = null;
    try {
        played = await photoRoll(chatId, img, 1, [
            `${head}\n\n🪙 <b>Tung xu lên…</b>`,
            `${head}\n\n🪙 <b>Xu đang xoay…</b> 🌀`,
            `${head}\n\n🪙 <b>Xu đang xoay…</b> 🌀🌀`,
            `${head}\n\n✋ <b>Chụp! Mở tay…</b>`
        ]);
    } catch {
        played = null;
    }

    const flip =
        Math.random() < 0.5 ? "ngua" : "sap";
    const isWin = side === flip;
    const win = isWin
        ? Math.floor(bet * 1.95) : 0;

    const newBalance = await settle(
        chatId, "coin", bet, win, flip
    );

    const text =
        `🪙 Kết quả: <b>${flip === "ngua" ? FACES[0] : FACES[1]}</b>\n` +
        (isWin
            ? `🎉 THẮNG! Nhận về +${money(win)} VNĐ`
            : `💀 THUA! Mất ${money(bet)} VNĐ.`) +
        `\n💳 Còn: <b>${money(newBalance)} VNĐ</b>`;

    if (played) {
        await photoResult(chatId, played.messageId,
            await img([flip === "ngua" ? 1 : 2], false),
            text, kb)
            .catch(() => send(chatId, text, { reply_markup: kb }));
        return;
    }

    await send(chatId, text, { reply_markup: kb });
}


module.exports = {
    commands: {
        "/coin": async (chatId, args) => {
            const side = (args[0] || "").toLowerCase();
            const bet = parseInt(args[1]);

            if (side !== "ngua" && side !== "sap") {
                await send(chatId, "Dùng: /coin ngua|sap <tiền>");
                return;
            }
            await playQuick(chatId, side, bet);
        }
    },

    replay: playQuick,

    help:
        "━━━ 🪙 <b>TUNG ĐỒNG XU</b> ━━━\n" +
        "/coin ngua|sap &lt;tiền&gt; — đoán ngửa/sấp, ăn x1.95\n"
};
