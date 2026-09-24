/* =========================
   SOCIAL: lịch sử, BXH, chuyển tiền, nhiệm vụ
   Không thêm bảng mới — tái dùng users/games.
 ========================= */

const core = require("./core");
const { send, money, esc, db, getUser, deduct, credit, recordGame } = core;

const MISSION_TARGET = 10;
const MISSION_REWARD = 10000;

module.exports = {
    commands: {
        "/history": async (chatId, args) => {
            const n = Math.min(Math.max(parseInt(args[0]) || 10, 1), 30);
            const [rows] = await db.query(
                `SELECT game, bet, win, detail, created_at FROM games
                 WHERE telegram_id = ? ORDER BY id DESC LIMIT ${n}`,
                [chatId]
            );
            if (!rows.length) {
                await send(chatId, "📜 Chưa có ván nào. Chơi đi đã!");
                return;
            }
            const lines = rows.map((r, i) => {
                const p = Number(r.win) - Number(r.bet);
                const icon = p > 0 ? "🟢" : p < 0 ? "🔴" : "⚪";
                const d = r.detail ? ` — ${esc(r.detail)}` : "";
                return `${icon} <b>${esc(r.game)}</b> cược ${money(r.bet)} ` +
                    `${p >= 0 ? "+" : ""}${money(p)}${d}`;
            });
            await send(chatId,
                `📜 <b>${n} VÁN GẦN NHẤT</b>\n\n` + lines.join("\n"));
        },

        "/top": async (chatId) => {
            const [[byGame], [biggest]] = await Promise.all([
                db.query(
                    `SELECT game, COUNT(*) AS total, SUM(win - bet) AS profit
                     FROM games WHERE telegram_id = ? GROUP BY game
                     ORDER BY profit DESC`,
                    [chatId]
                ),
                db.query(
                    `SELECT game, bet, win, detail FROM games
                     WHERE telegram_id = ? AND win > bet
                     ORDER BY (win - bet) DESC LIMIT 5`,
                    [chatId]
                )
            ]);
            let msg = "🏆 <b>BẢNG VÀNG</b>\n";
            if (byGame.length) {
                msg += "\n💹 <b>Lãi/lỗ theo game:</b>\n" + byGame.map(r =>
                    `• <b>${esc(r.game)}</b>: ${r.total} ván, ` +
                    `<b>${money(r.profit || 0)}</b>`
                ).join("\n");
            } else {
                msg += "\nChưa có dữ liệu. Chơi vài ván đã!";
                await send(chatId, msg);
                return;
            }
            if (biggest.length) {
                msg += "\n\n🔥 <b>Top 5 ván ăn đậm:</b>\n" + biggest.map((r, i) =>
                    `${i + 1}. <b>${esc(r.game)}</b> cược ${money(r.bet)} ` +
                    `ăn <b>+${money(Number(r.win) - Number(r.bet))}</b>` +
                    (r.detail ? ` (${esc(r.detail)})` : "")
                ).join("\n");
            }
            await send(chatId, msg);
        },

        "/give": async (chatId, args) => {
            const target = parseInt(args[0]);
            const amount = parseInt(args[1]);
            if (!target || !amount || amount <= 0) {
                await send(chatId, "Dùng: /give &lt;telegram_id&gt; &lt;số tiền&gt;");
                return;
            }
            if (target === chatId) {
                await send(chatId, "❌ Không tự chuyển cho chính mình.");
                return;
            }
            const me = await getUser(chatId);
            if (amount > Number(me.balance)) {
                await send(chatId,
                    `❌ Không đủ tiền (còn ${money(me.balance)} VNĐ).`);
                return;
            }
            await getUser(target); // tạo ví người nhận nếu chưa có
            await deduct(chatId, amount);
            const nb = await credit(target, amount);
            await send(chatId,
                `💸 Đã chuyển <b>${money(amount)} VNĐ</b> cho ` +
                `<code>${target}</code>.\n💳 Bạn còn: <b>${money(Number(me.balance) - amount)} VNĐ</b>`);
            await send(target,
                `💰 Bạn nhận được <b>${money(amount)} VNĐ</b> từ ` +
                `<code>${chatId}</code>!\n💳 Số dư: <b>${money(nb)} VNĐ</b>`)
                .catch(() => {}); // ponytail: người nhận chưa /start bot thì gửi lỗi, bỏ qua
        },

        "/mission": async (chatId) => {
            const [[countRows]] = await db.query(
                `SELECT COUNT(*) AS c FROM games WHERE telegram_id = ?
                 AND game != 'mission' AND DATE(created_at) = CURDATE()`,
                [chatId]
            );
            const done = Number(countRows[0].c);
            if (done < MISSION_TARGET) {
                await send(chatId,
                    `🎯 <b>NHIỆM VỤ NGÀY</b>\n\n` +
                    `Chơi ${MISSION_TARGET} ván bất kỳ trong hôm nay để nhận ` +
                    `<b>${money(MISSION_REWARD)} VNĐ</b>.\n` +
                    `Tiến độ: <b>${done}/${MISSION_TARGET}</b> ván.`);
                return;
            }
            const [[claimed]] = await db.query(
                `SELECT COUNT(*) AS c FROM games WHERE telegram_id = ?
                 AND game = 'mission' AND DATE(created_at) = CURDATE()`,
                [chatId]
            );
            if (Number(claimed[0].c) > 0) {
                await send(chatId,
                    `✅ Hôm nay xong nhiệm vụ rồi (${done} ván). Mai quay lại nhé!`);
                return;
            }
            const nb = await credit(chatId, MISSION_REWARD);
            await recordGame(chatId, "mission", 0, MISSION_REWARD,
                `chơi ${done} ván/ngày`);
            await send(chatId,
                `🎉 <b>XONG NHIỆM VỤ!</b> +${money(MISSION_REWARD)} VNĐ\n` +
                `💳 Còn: <b>${money(nb)} VNĐ</b>`);
        }
    },

    help:
        "━━━ 🏆 <b>XÃ HỘI & NHIỆM VỤ</b> ━━━\n" +
        "/history [số] — xem ván gần nhất\n" +
        "/top — BXH lãi/lỗ + ván ăn đậm\n" +
        "/give &lt;id&gt; &lt;tiền&gt; — chuyển tiền\n" +
        "/mission — nhiệm vụ chơi 10 ván/ngày +10k\n"
};
