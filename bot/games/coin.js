/* =========================
   GAME: TUNG ĐỒNG XU
========================= */

const core = require("../core");
const { send, telegram, money, settle, checkBet } = core;
const { textRoll } = require("./suspense");

const FACES = ["🌕 NGỬA", "🌑 SẤP"];


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

            const head = `💸 <b>${money(bet)} VNĐ</b> cửa ` +
                `<b>${side === "ngua" ? "NGỬA" : "SẤP"}</b>`;
            let msgId = null;
            try {
                msgId = await textRoll(chatId, [
                    `${head}\n\n🪙 <b>Tung xu lên…</b>`,
                    `${head}\n\n🪙 <b>Xu đang xoay…</b> 🌀`,
                    `${head}\n\n🪙 <b>Xu đang xoay…</b> 🌀🌀`,
                    `${head}\n\n✋ <b>Chụp! Mở tay…</b>`
                ]);
            } catch {
                msgId = null;
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
        "━━━ 🪙 <b>TUNG ĐỒNG XU</b> ━━━\n" +
        "/coin ngua|sap &lt;tiền&gt; — đoán ngửa/sấp, ăn x1.95\n"
};
