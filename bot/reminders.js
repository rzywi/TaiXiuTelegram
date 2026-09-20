/* =========================
   NHẮC NHỞ HẸN GIỜ
========================= */

const core = require("./core");
const { send, db } = core;


function scheduleReminder(row) {
    const delay =
        new Date(row.remind_at).getTime() - Date.now();

    if (delay <= 0) {
        return;
    }

    setTimeout(async () => {
        await send(row.telegram_id,
            `⏰ <b>NHẮC NHỞ</b>\n\n${row.content}`);
        await db.query(
            "UPDATE reminders SET done = 1 WHERE id = ?",
            [row.id]
        );
    }, delay);
}

/* Bot khởi động lại vẫn nhớ các hẹn chưa đến giờ */
async function init() {
    const [rows] = await db.query(
        "SELECT * FROM reminders WHERE done = 0"
    );
    rows.forEach(scheduleReminder);
}


module.exports = {
    init,

    commands: {
        "/remind": async (chatId, args) => {
            const minutes = parseInt(args[0]);
            const content = args.slice(1).join(" ");
            if (!minutes || !content) {
                await send(chatId, "Dùng: /remind <phút> <nội dung>");
                return;
            }
            const remindAt =
                new Date(Date.now() + minutes * 60000);
            const [result] = await db.query(
                `INSERT INTO reminders (telegram_id, content, remind_at)
                VALUES (?, ?, ?)`,
                [chatId, content, remindAt]
            );
            scheduleReminder({
                id: result.insertId,
                telegram_id: chatId,
                content: content,
                remind_at: remindAt
            });
            await send(chatId,
                `⏰ Sẽ nhắc bạn sau <b>${minutes}</b> phút.`);
        },

        "/reminders": async (chatId) => {
            const [rows] = await db.query(
                "SELECT * FROM reminders WHERE telegram_id = ? AND done = 0",
                [chatId]
            );
            if (!rows.length) {
                await send(chatId, "Không có nhắc nhở nào.");
                return;
            }
            await send(chatId,
                "⏰ <b>ĐANG CHỜ</b>\n\n" +
                rows.map(r =>
                    `<b>#${r.id}</b> [${new Date(r.remind_at).toLocaleString("vi-VN")}] — ${r.content}`)
                    .join("\n"));
        }
    },

    help:
        "━━━ ⏰ <b>NHẮC NHỞ</b> ━━━\n" +
        "/remind &lt;phút&gt; &lt;nội dung&gt; — hẹn giờ nhắc\n" +
        "/reminders — xem nhắc nhở đang chờ\n"
};
