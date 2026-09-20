/* =========================
   GAME: XÓC ĐĨA
========================= */

const core = require("../core");
const { send, money, settle, checkBet } = core;
const portal = require("./portal");
const { coinsRowPng } = require("./diceimg");

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
            if (!await checkBet(chatId, bet)) return;

            const coins = [0, 0, 0, 0].map(() =>
                Math.random() < 0.5 ? 1 : 0);
            const reds = coins.reduce((a, b) => a + b, 0);
            const result = reds % 2 === 0 ? "chan" : "le";
            const isWin = side === result;
            const win = isWin
                ? Math.floor(bet * 1.95) : 0;

            const newBalance = await settle(
                chatId, "xocdia", bet, win,
                `${reds} đỏ (${result})`
            );

            await send(chatId,
                `🪙 4 đồng xu: <b>${reds} Đỏ / ${4 - reds} Trắng</b>\n` +
                `Kết quả: <b>${result === "chan" ? "CHẴN ⚖️" : "LỄ 🔺"}</b>\n\n` +
                (isWin
                    ? `🎉 THẮNG! Nhận về +${money(win)} VNĐ`
                    : `💀 THUA! Mất ${money(bet)} VNĐ.`) +
                `\n💳 Còn: <b>${money(newBalance)} VNĐ</b>`);
        }
    },

    help:
        "━━━ 🪙 <b>XÓC ĐĨA</b> ━━━\n" +
        "/xocdia — mở cổng cược <b>bấm nút</b>\n" +
        "/xocdia chan|le &lt;tiền&gt; — chơi nhanh\n"
};
