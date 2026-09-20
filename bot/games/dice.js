/* =========================
   GAME: ĐOÁN XÚC XẮC
========================= */

const core = require("../core");
const { send, money, settle, checkBet } = core;


module.exports = {
    commands: {
        "/dice": async (chatId, args) => {
            const guess = parseInt(args[0]);
            const bet = parseInt(args[1]);

            if (!guess || guess < 1 || guess > 6) {
                await send(chatId, "Dùng: /dice <số 1-6> <tiền>");
                return;
            }
            if (!await checkBet(chatId, bet)) return;

            const roll = Math.floor(Math.random() * 6) + 1;
            const isWin = guess === roll;
            const win = isWin ? Math.floor(bet * 5.8) : 0;

            const newBalance = await settle(
                chatId, "dice", bet, win, `đoán ${guess} ra ${roll}`
            );

            await send(chatId,
                `🎲 Xúc xắc ra: <b>${roll}</b>\n` +
                (isWin
                    ? `🎉 Chuẩn! Thắng +${money(win - bet)} VNĐ (x5.8)!`
                    : `💀 Sai, -${money(bet)} VNĐ.`) +
                `\n💳 Còn: <b>${money(newBalance)} VNĐ</b>`);
        }
    },

    help:
        "━━━ 🎲 <b>ĐOÁN XÚC XẮC</b> ━━━\n" +
        "/dice &lt;số 1-6&gt; &lt;tiền&gt; — đoán đúng ăn x5.8\n"
};
