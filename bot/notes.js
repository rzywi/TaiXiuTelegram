/* =========================
   GHI CHÚ
========================= */

const core = require("./core");
const { send, db } = core;


module.exports = {
    commands: {
        "/note": async (chatId, args) => {
            const content = args.join(" ");
            if (!content) {
                await send(chatId, "Dùng: /note <nội dung>");
                return;
            }
            await db.query(
                "INSERT INTO notes (telegram_id, content) VALUES (?, ?)",
                [chatId, content]
            );
            await send(chatId, "📝 Đã lưu ghi chú.");
        },

        "/notes": async (chatId) => {
            const [rows] = await db.query(
                "SELECT * FROM notes WHERE telegram_id = ? ORDER BY id DESC LIMIT 30",
                [chatId]
            );
            if (!rows.length) {
                await send(chatId, "Chưa có ghi chú nào.");
                return;
            }
            await send(chatId,
                "📝 <b>GHI CHÚ</b>\n\n" +
                rows.map(r =>
                    `<b>#${r.id}</b> — ${r.content}`).join("\n"));
        },

        "/delnote": async (chatId, args) => {
            const id = parseInt(args[0]);
            if (!id) {
                await send(chatId, "Dùng: /delnote <id>");
                return;
            }
            await db.query(
                "DELETE FROM notes WHERE id = ? AND telegram_id = ?",
                [id, chatId]
            );
            await send(chatId, "🗑 Đã xóa.");
        }
    },

    help:
        "━━━ 📝 <b>GHI CHÚ</b> ━━━\n" +
        "/note &lt;nội dung&gt; — lưu ghi chú\n" +
        "/notes — xem ghi chú\n" +
        "/delnote &lt;id&gt; — xóa ghi chú\n"
};
