/* =========================
   GAME: SLOT MACHINE (nổ hũ)
========================= */

const core = require("../core");
const { send, money, settle, checkBet } = core;

const ICONS = ["🍒", "🍋", "🔔", "⭐", "💎", "7️⃣"];


module.exports = {
    commands: {
        "/slot": async (chatId, args) => {
            const bet = parseInt(args[0]);
            if (!await checkBet(chatId, bet)) return;

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

            await send(chatId,
                `🎰 [ ${a} | ${b} | ${c} ]\n\n` +
                (win === bet * 10
                    ? `💎 NỔ HŨ JACKPOT! +${money(win)} VNĐ!`
                    : win > 0
                        ? `🎉 Trúng 2 icon, +${money(win)} VNĐ!`
                        : `💀 Không trúng, -${money(bet)} VNĐ.`) +
                `\n💳 Còn: <b>${money(newBalance)} VNĐ</b>`);
        }
    },

    help:
        "━━━ 🎰 <b>SLOT MACHINE</b> ━━━\n" +
        "/slot &lt;tiền&gt; — 3 icon giống nhau nổ hũ x10, 2 icon x2\n"
};
