/* =========================
   LINH TINH: spin free, oẳn tù tì, chọn ngẫu nhiên, đếm ngược
   Spin cooldown lưu RAM (ponytail: restart bot reset cooldown —
   cần bền thì thêm bảng spin_claims, chưa cần).
 ========================= */

const core = require("./core");
const { send, money, esc, settle, checkBet, credit, recordGame } = core;

const lastSpin = new Map(); // chatId -> timestamp
const SPIN_CD = 60 * 60 * 1000;

const HANDS = { keo: "✌️", bua: "✊", bao: "✋" };

module.exports = {
    commands: {
        "/spin": async (chatId) => {
            const last = lastSpin.get(chatId) || 0;
            const wait = SPIN_CD - (Date.now() - last);
            if (wait > 0) {
                await send(chatId,
                    `⏳ Quay rồi! Chờ thêm <b>${Math.ceil(wait / 60000)}</b> phút nhé.`);
                return;
            }
            const roll = Math.random() * 100;
            const prize = roll < 5 ? 20000 : roll < 20 ? 8000
                : roll < 50 ? 3000 : roll < 80 ? 1000 : 0;
            lastSpin.set(chatId, Date.now());
            if (prize > 0) {
                const nb = await credit(chatId, prize);
                await recordGame(chatId, "spin", 0, prize, "vòng quay free");
                await send(chatId,
                    `🎡 <b>VÒNG QUAY MAY MẮN</b>\n\n` +
                    (prize >= 8000 ? `💰 JACKPOT +${money(prize)} VNĐ!` : `🎉 Trúng +${money(prize)} VNĐ!`) +
                    `\n💳 Còn: <b>${money(nb)} VNĐ</b>`);
            } else {
                await recordGame(chatId, "spin", 0, 0, "quay hụt");
                await send(chatId, "🎡 Quay hụt rồi! 1 tiếng nữa quay lại nhé.");
            }
        },

        "/rps": async (chatId, args) => {
            const pick = (args[0] || "").toLowerCase();
            const bet = parseInt(args[1]);
            if (!HANDS[pick]) {
                await send(chatId, "Dùng: /rps keo|bua|bao &lt;tiền&gt;");
                return;
            }
            if (!await checkBet(chatId, bet)) return;
            const bot = Object.keys(HANDS)[Math.floor(Math.random() * 3)];
            const beats = { keo: "bao", bao: "bua", bua: "keo" };
            const result = bot === pick ? "draw"
                : beats[pick] === bot ? "win" : "lose";
            const win = result === "draw" ? bet
                : result === "win" ? Math.floor(bet * 1.95) : 0;
            const nb = await settle(chatId, "rps", bet, win, `${pick} vs ${bot}`);
            await send(chatId,
                `${HANDS[pick]} Bạn vs Bot ${HANDS[bot]}\n\n` +
                (result === "win" ? `🎉 Thắng! +${money(win)} VNĐ`
                    : result === "draw" ? `🤝 Hòa! Hoàn ${money(bet)} VNĐ`
                    : `💀 Thua, -${money(bet)} VNĐ.`) +
                `\n💳 Còn: <b>${money(nb)} VNĐ</b>`);
        },

        "/pick": async (chatId, args) => {
            const opts = args.join(" ").split(/[|,]/).map(s => s.trim()).filter(Boolean);
            if (opts.length < 2) {
                await send(chatId, "Dùng: /pick <a> | <b> | <c> ...");
                return;
            }
            await send(chatId,
                `🎲 Bot chọn: <b>${esc(opts[Math.floor(Math.random() * opts.length)])}</b>`);
        },

        "/countdown": async (chatId, args) => {
            const sec = Math.min(Math.max(parseInt(args[0]) || 0, 1), 3600);
            const content = args.slice(1).join(" ") || "Hết giờ!";
            if (!sec) {
                await send(chatId, "Dùng: /countdown &lt;giây&gt; &lt;nội dung&gt;");
                return;
            }
            await send(chatId, `⏱ Đếm ngược <b>${sec}s</b>: ${esc(content)}`);
            setTimeout(() =>
                send(chatId, `🔔 <b>HẾT ${sec}s!</b>\n\n${esc(content)}`).catch(() => {}),
                sec * 1000);
        }
    },

    help:
        "━━━ 🎡 <b>LINH TINH</b> ━━━\n" +
        "/spin — quay free mỗi giờ, trúng tới 20k\n" +
        "/rps keo|bua|bao &lt;tiền&gt; — oẳn tù tì ăn x1.95\n" +
        "/pick &lt;a&gt; | &lt;b&gt; ... — bot chọn hộ\n" +
        "/countdown &lt;giây&gt; &lt;nội dung&gt; — đếm ngược\n"
};
