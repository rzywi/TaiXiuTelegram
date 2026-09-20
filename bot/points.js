/* =========================
   QUẢN LÝ ĐIỂM
========================= */

const core = require("./core");
const { send, money, db, getUser } = core;


module.exports = {
    commands: {
        "/balance": async (chatId) => {
            const user = await getUser(chatId);
            await send(chatId,
                `💰 Tiền của bạn: <b>${money(user.balance)} VNĐ</b>`);
        },

        "/addpoints": async (chatId, args) => {
            const amount = parseInt(args[0]);
            if (!amount) {
                await send(chatId, "Dùng: /addpoints <số tiền>");
                return;
            }
            const user = await getUser(chatId);
            const newBalance =
                Number(user.balance) + amount;
            await db.query(
                "UPDATE users SET balance = ? WHERE telegram_id = ?",
                [newBalance, chatId]
            );
            await send(chatId,
                `✅ Đã cộng. Hiện có: <b>${money(newBalance)} VNĐ</b>`);
        },

        "/reset": async (chatId) => {
            await db.query(
                "UPDATE users SET balance = 10000 WHERE telegram_id = ?",
                [chatId]
            );
            await send(chatId, "♻️ Đã reset về 10,000 VNĐ.");
        },

        "/daily": async (chatId) => {
            const today =
                new Date().toISOString().slice(0, 10);
            const [rows] = await db.query(
                "SELECT * FROM daily_bonus WHERE telegram_id = ?",
                [chatId]
            );
            if (rows.length && rows[0].last_date === today) {
                await send(chatId,
                    "⏳ Hôm nay đã nhận rồi, mai quay lại nhé.");
                return;
            }
            await db.query(
                `INSERT INTO daily_bonus (telegram_id, last_date)
                VALUES (?, ?)
                ON DUPLICATE KEY UPDATE last_date = VALUES(last_date)`,
                [chatId, today]
            );
            await db.query(
                "UPDATE users SET balance = balance + 5000 WHERE telegram_id = ?",
                [chatId]
            );
            await send(chatId,
                "🎁 Nhận <b>5,000 VNĐ</b> miễn phí!");
        },

        "/stats": async (chatId) => {
            const [rows] = await db.query(
                `SELECT
                    COUNT(*) AS total,
                    SUM(win > bet) AS wins,
                    SUM(win < bet) AS losses,
                    SUM(win - bet) AS profit
                FROM games WHERE telegram_id = ?`,
                [chatId]
            );
            const s = rows[0];
            await send(chatId,
                `📊 <b>THỐNG KÊ</b>\n\n` +
                `Tổng ván: <b>${s.total || 0}</b>\n` +
                `Thắng: <b>${s.wins || 0}</b>\n` +
                `Thua: <b>${s.losses || 0}</b>\n` +
                `Lãi/lỗ: <b>${money(s.profit || 0)} VNĐ</b>`);
        }
    },

    help:
        "━━━ 💰 <b>TIỀN (ẢO — VNĐ)</b> ━━━\n" +
        "/balance — xem tiền\n" +
        "/daily — nhận 5k VNĐ miễn phí/ngày\n" +
        "/addpoints &lt;số&gt; — cộng tiền không giới hạn\n" +
        "/reset — reset về 10k VNĐ\n" +
        "/stats — thống kê thắng thua\n"
};
