/* =========================
   GAME: XÓC ĐĨA
========================= */

const core = require("../core");
const { send, telegram, money, settle, checkBet } = core;
const portal = require("./portal");
const { coinsRowPng } = require("./diceimg");
const { photoRoll, photoResult } = require("./suspense");
const replay = require("./replay");

portal.register("xocdia", {
    title: "🪙 CỔNG ĐẶT CỬ XÓC ĐĨA",
    rules: "⚖️ CHẴN (số đỏ chẵn) · 🔺 LỄ (số đỏ lẻ) — x1.95",

    /* 4 đĩa — vẽ ảnh hàng ngang, chẵn = ĐỎ, lẻ = TRẮNG */
    diceCount: 4,

    /* Ảnh 4 đĩa đỏ/trắng xếp hàng ngang (lúc lắc có rung) */
    imageFor: (rolls, shake) =>
        coinsRowPng(rolls.map(v => v % 2 === 0), shake),

    playButtons: [
        [
            { text: "⚖️ CHẴN", callback_data: "pt:xocdia:play:chan" },
            { text: "🔺 LỄ", callback_data: "pt:xocdia:play:le" }
        ]
    ],

    /* rolls = giá trị 4 bi vừa lăn — mỗi bi chẵn tính là 1 đỏ.
       win = TỔNG nhận về (gốc + lãi) */
    play: (pick, bet, rolls) => {
        const reds =
            rolls.filter(v => v % 2 === 0).length;
        const result = reds % 2 === 0 ? "chan" : "le";
        const isWin = pick === result;
        const win = isWin ? Math.floor(bet * 1.95) : 0;

        return {
            win: win,
            outcomeText:
                `🪙 ${"🔴".repeat(reds)}${"⚪".repeat(4 - reds)}\n` +
                `Kết quả: <b>${result === "chan" ? "CHẴN ⚖️" : "LỄ 🔺"}</b>`,
            detail: `${reds} đỏ (${result})`
        };
    }
});

function replayKB(bet) {
    return {
        inline_keyboard: [
            [
                replay.btn("⚖️ CHẴN lại", "xocdia", "chan", bet),
                replay.btn("🔺 LẺ lại", "xocdia", "le", bet),
                replay.portalBtn("xocdia")
            ],
            [replay.menuBtn()]
        ]
    };
}

async function playQuick(chatId, side, bet) {
    bet = parseInt(bet);
    if (!await checkBet(chatId, bet)) return;

    const kb = replayKB(bet);
    const betLine = `💸 <b>${money(bet)} VNĐ</b> cửa ` +
        `<b>${side === "chan" ? "CHẴN ⚖️" : "LẺ 🔺"}</b>`;
    const img = (rolls, shake) =>
        coinsRowPng(rolls.map(v => v % 2 === 0), shake);
    let played = null;
    try {
        played = await photoRoll(chatId, img, 4,
            [
                `${betLine}\n\n🥣 <b>Xếp 4 đồng xu vào đĩa…</b>`,
                `${betLine}\n\n🥣 <b>Úp bát — XÓC XÓC XÓC!</b>`,
                `${betLine}\n\n🥣 <b>Đặt bát xuống… nín thở…</b>`,
                `${betLine}\n\n✨ <b>MỞ BÁT…</b>`
            ]);
    } catch {
        played = null;
    }

    const rolls = played
        ? played.rolls
        : [0, 0, 0, 0].map(() =>
            Math.floor(Math.random() * 6) + 1);
    const reds =
        rolls.filter(v => v % 2 === 0).length;
    const resultName = reds % 2 === 0 ? "chan" : "le";
    const isWin = side === resultName;
    const win = isWin
        ? Math.floor(bet * 1.95) : 0;

    const newBalance = await settle(
        chatId, "xocdia", bet, win,
        `${reds} đỏ (${resultName})`
    );

    const text =
        `🪙 4 đồng xu: <b>${reds} Đỏ / ${4 - reds} Trắng</b>\n` +
        `Kết quả: <b>${resultName === "chan" ? "CHẴN ⚖️" : "LẺ 🔺"}</b>\n\n` +
        (isWin
            ? `🎉 THẮNG! Nhận về +${money(win)} VNĐ`
            : `💀 THUA! Mất ${money(bet)} VNĐ.`) +
        `\n💳 Còn: <b>${money(newBalance)} VNĐ</b>`;

    if (played) {
        await photoResult(chatId, played.messageId,
            img(rolls), text, kb)
            .catch(() => send(chatId, text, { reply_markup: kb }));
        return;
    }

    await send(chatId, text, { reply_markup: kb });
}


module.exports = {
    commands: {
        "/xocdia": async (chatId, args) => {

            /* Không tham số → mở cổng đặt cược bấm nút */
            if (!args.length) {
                return portal.openPortal(chatId, "xocdia");
            }

            /* Chơi nhanh: /xocdia chan 50000 */
            const side = (args[0] || "").toLowerCase();
            const bet = parseInt(args[1]);

            if (side !== "chan" && side !== "le") {
                await send(chatId, "Dùng: /xocdia chan|le <tiền>");
                return;
            }
            await playQuick(chatId, side, bet);
        }
    },

    replay: playQuick,

    help:
        "━━━ 🪙 <b>XÓC ĐĨA</b> ━━━\n" +
        "/xocdia — mở cổng cược <b>bấm nút</b>\n" +
        "/xocdia chan|le &lt;tiền&gt; — chơi nhanh\n"
};
