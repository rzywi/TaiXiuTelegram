/* =========================
   GAME: SLOT MACHINE (nổ hũ)
========================= */

const core = require("../core");
const { send, telegram, money, settle, checkBet } = core;
const { textRoll } = require("./suspense");

const ICONS = ["🍒", "🍋", "🔔", "⭐", "💎", "7️⃣"];
const SPINS = ["🍒", "🍋", "🔔", "⭐", "💎", "7️⃣", "🍇", "🍉"];

function spinFrame() {
    const p = () =>
        SPINS[Math.floor(Math.random() * SPINS.length)];
    return `🎰 [ ${p()} | ${p()} | ${p()} ]`;
}


module.exports = {
    commands: {
        "/slot": async (chatId, args) => {
            const bet = parseInt(args[0]);
            if (!await checkBet(chatId, bet)) return;

            const head = `💸 Cược <b>${money(bet)} VNĐ</b>`;
            let msgId = null;
            try {
                msgId = await textRoll(chatId, [
                    `${head}\n\n🎰 [ ❓ | ❓ | ❓ ]\n<i>Bỏ xu… kéo cần…</i>`,
                    `${head}\n\n${spinFrame()}\n<i>Guồng đang quay…</i>`,
                    `${head}\n\n${spinFrame()}\n<i>Guồng đang quay…</i> 🌀`,
                    `${head}\n\n${spinFrame()}\n<i>Dừng lại…</i>`
                ]);
            } catch {
                msgId = null;
            }

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

            const text =
                `🎰 [ ${a} | ${b} | ${c} ]\n\n` +
                (win === bet * 10
                    ? `💎 NỔ HŨ JACKPOT! +${money(win)} VNĐ!`
                    : win > 0
                        ? `🎉 Trúng 2 icon, +${money(win)} VNĐ!`
                        : `💀 Không trúng, -${money(bet)} VNĐ.`) +
                `\n💳 Còn: <b>${money(newBalance)} VNĐ</b>`;

            if (msgId) {
                await telegram("editMessageText", {
                    chat_id: chatId,
                    message_id: msgId,
                    text: text,
                    parse_mode: "HTML"
                }).catch(() => send(chatId, text));
                return;
            }

            await send(chatId, text);
        }
    },

    help:
        "━━━ 🎰 <b>SLOT MACHINE</b> ━━━\n" +
        "/slot &lt;tiền&gt; — 3 icon giống nhau nổ hũ x10, 2 icon x2\n"
};
