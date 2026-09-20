/* =========================
   GAME: TUNG ĐỒNG XU
========================= */

const core = require("../core");
const { send, money, settle, checkBet } = core;


module.exports = {
    commands: {
        "/coin": async (chatId, args) => {
            const side = (args[0] || "").toLowerCase();
            const bet = parseInt(args[1]);

            if (side !== "ngua" && side !== "sap") {
                await send(chatId, "Dùng: /coin ngua|sap <tiền>");
                return;
            }
            if (!await checkBet(chatId, bet)) return;

            const flip =
                Math.random() < 0.5 ? "ngua" : "sap";
            const isWin = side === flip;
            const win = isWin
                ? Math.floor(bet * 1.95) : 0;

            const newBalance = await settle(
                chatId, "coin", bet, win, flip
            );

            await send(chatId,
                `🪙 Kết quả: <b>${flip === "ngua" ? "NGỬA" : "SẮP"}</b>\n` +
                (isWin
                    ? `🎉 THẮNG! Nhận về +${money(win)} VNĐ`
                    : `💀 THUA! Mất ${money(bet)} VNĐ.`) +
                `\n💳 Còn: <b>${money(newBalance)} VNĐ</b>`);
        }
    },

    help:
        "━━━ 🪙 <b>TUNG ĐỒNG XU</b> ━━━\n" +
        "/coin ngua|sap &lt;tiền&gt; — đoán ngửa/sấp, ăn x1.95\n"
};
