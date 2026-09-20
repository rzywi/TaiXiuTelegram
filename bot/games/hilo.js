/* =========================
   GAME: ĐOÁN BÀI CAO/THẤP
========================= */

const core = require("../core");
const { send, money, settle, checkBet } = core;

const NAMES = ["A", "2", "3", "4", "5", "6", "7",
               "8", "9", "10", "J", "Q", "K"];


module.exports = {
    commands: {
        "/hilo": async (chatId, args) => {
            const guess = (args[0] || "").toLowerCase();
            const bet = parseInt(args[1]);

            if (guess !== "cao" && guess !== "thap") {
                await send(chatId, "Dùng: /hilo cao|thap <tiền>");
                return;
            }
            if (!await checkBet(chatId, bet)) return;

            const valueOf = () =>
                Math.floor(Math.random() * 13) + 1;

            const first = valueOf();
            const second = valueOf();

            let outcome;
            if (second === first) {
                outcome = "push";
            } else if (second > first) {
                outcome = "cao";
            } else {
                outcome = "thap";
            }

            const isWin = guess === outcome;
            const win = outcome === "push"
                ? bet
                : isWin ? Math.floor(bet * 1.95) : 0;

            const newBalance = await settle(
                chatId, "hilo", bet, win,
                `${first}->${second}`
            );

            await send(chatId,
                `🃏 Lá trước: <b>${NAMES[first - 1]}</b>\n` +
                `🃏 Lá sau: <b>${NAMES[second - 1]}</b>\n\n` +
                (outcome === "push"
                    ? "🤝 Bằng nhau — hoàn cược."
                    : isWin
                        ? `🎉 THẮNG! Nhận về +${money(win)} VNĐ`
                        : `💀 THUA! Mất ${money(bet)} VNĐ.`) +
                `\n💳 Còn: <b>${money(newBalance)} VNĐ</b>`);
        }
    },

    help:
        "━━━ 🃏 <b>CAO / THẤP</b> ━━━\n" +
        "/hilo cao|thap &lt;tiền&gt; — đoán lá sau cao hay thấp hơn\n"
};
