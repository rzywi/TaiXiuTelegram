/* =========================
   GAME: ROULETTE
========================= */

const core = require("../core");
const { send, money, settle, checkBet } = core;


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
            if (!await checkBet(chatId, bet)) return;

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

            await send(chatId,
                `🎡 Bánh xe quay… Ra: <b>${number} ${colorIcon}</b>\n\n` +
                (isWin
                    ? `🎉 Thắng +${money(win - bet)} VNĐ!`
                    : `💀 Thua -${money(bet)} VNĐ.`) +
                `\n💳 Còn: <b>${money(newBalance)} VNĐ</b>`);
        }
    },

    help:
        "━━━ 🎡 <b>ROULETTE</b> ━━━\n" +
        "/roulette do|den|số(0-36) &lt;tiền&gt; — " +
        "đỏ/đen x2, đoán đúng số x36\n"
};
