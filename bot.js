/* =====================================================
   BOT CÁ NHÂN — ENTRY POINT
   Tất cả chức năng nằm trong thư mục bot/, mỗi nhóm
   chức năng một file. Muốn thêm chức năng mới: tạo file
   trong bot/ rồi thêm 1 dòng require vào danh sách dưới.
===================================================== */

require("dotenv").config();

const fs = require("fs");
const core = require("./bot/core");

/* Danh sách module chức năng */
const modules = [
    require("./bot/ai"),                    // chat AI
    require("./bot/games/portal"),          // engine cổng đặt cược
    require("./bot/games/taixiu"),          // Tài Xỉu
    require("./bot/games/baucua"),          // Bầu Cua Tôm Cá
    require("./bot/games/xocdia"),          // Xóc Đĩa
    require("./bot/games/roulette"),        // Roulette
    require("./bot/games/blackjack"),       // Xì Dách
    require("./bot/games/hilo"),            // Cao/Thấp
    require("./bot/games/slot"),            // Slot machine
    require("./bot/games/coin"),            // Tung đồng xu
    require("./bot/games/dice"),            // Đoán xúc xắc
    require("./bot/points"),                // quản lý điểm
    require("./bot/notes"),                 // ghi chú
    require("./bot/reminders"),             // nhắc nhở
    require("./bot/nhac"),                  // nhạc SoundCloud
    require("./bot/tools"),                 // công cụ tiện ích
    require("./bot/power")                  // shell / eval
];

/* Gom toàn bộ lệnh + nút bấm + handler từ các module */
const commands = {
    "/start": (chatId) => core.send(chatId, HELP_TEXT),
    "/help": (chatId) => core.send(chatId, HELP_TEXT)
};

const callbacks = [];
const plainTextHandlers = [];

for (const m of modules) {
    if (m.commands) {
        Object.assign(commands, m.commands);
    }
    if (m.callback) {
        callbacks.push(m.callback);
    }
    if (m.plainText) {
        plainTextHandlers.push(m.plainText);
    }
}

const HELP_TEXT =
    "🎰 <b>BOT CÁ NHÂN — TOÀN BỘ LỆNH</b>\n\n" +
    modules
        .map(m => m.help)
        .filter(h => h && h.trim())
        .join("\n");


/* =========================
   XỬ LÝ LỆNH
========================= */

async function handleCommand(msg) {

    const chatId = msg.chat.id;
    const text = (msg.text || "").trim();
    const [rawCmd, ...args] = text.split(/\s+/);
    const cmd = rawCmd.toLowerCase().split("@")[0];

    /* Bot riêng tư: người đầu tiên /start là chủ bot */
    if (core.getOwner() === null) {
        core.setOwner(chatId);
        await core.send(chatId,
            "✅ Bạn đã trở thành chủ sở hữu bot.\n\n" + HELP_TEXT);
    }

    if (chatId !== core.getOwner()) {
        return;
    }

    const handler = commands[cmd];

    try {
        if (handler) {
            await handler(chatId, args, msg);
        } else {
            await core.send(chatId,
                "❓ Lệnh không tồn tại. Gõ /help để xem danh sách.");
        }
    } catch (error) {
        console.error(error);
        await core.send(chatId, `⚠️ Lỗi: ${error.message}`);
    }
}


/* =========================
   CHỐNG CHẠY TRÙNG
   2 process bot cùng chạy sẽ giành tin nhắn của nhau
   (Telegram trả 409) → bot lag, tin nhắn thất thường.
========================= */

const LOCK_FILE = ".bot.lock";

if (fs.existsSync(LOCK_FILE)) {
    const oldPid = parseInt(
        fs.readFileSync(LOCK_FILE, "utf8"));
    let alive = false;
    try {
        process.kill(oldPid, 0);
        alive = true;
    } catch { /* process đã chết */ }

    if (alive) {
        console.error(
            "❌ Bot đang chạy rồi (PID " + oldPid + ")!\n" +
            "Không mở 2 bot cùng lúc. Thoát bằng: taskkill /PID " +
            oldPid + " /F");
        process.exit(1);
    }
}

fs.writeFileSync(LOCK_FILE, String(process.pid));

process.on("SIGINT", () => {
    try { fs.unlinkSync(LOCK_FILE); } catch {}
    process.exit(0);
});
process.on("exit", () => {
    try { fs.unlinkSync(LOCK_FILE); } catch {}
});


/* =========================
   XỬ LÝ NÚT BẤM
========================= */

async function handleCallback(query) {

    const chatId = query.message?.chat?.id;

    if (!chatId || chatId !== core.getOwner()) {
        return;
    }

    core.answerCb(query.id);

    for (const cb of callbacks) {
        if (query.data.startsWith(cb.prefix)) {
            return cb.handler(query).catch(async error => {
                console.error(error);
                core.answerCb(query.id, "⚠️ Có lỗi xảy ra");
            });
        }
    }
}


/* =========================
   LONG POLLING
========================= */

async function poll() {
    let offset = 0;

    while (true) {
        try {
            const response = await fetch(
                `https://api.telegram.org/bot${core.BOT_TOKEN}/getUpdates`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        offset: offset,
                        timeout: 25,
                        /* Chỉ nhận loại tin cần thiết, bỏ nhiễu */
                        allowed_updates:
                            ["message", "callback_query"]
                    })
                }
            );

            const data = await response.json();

            if (!data.ok || !data.result) {

                /* 409 = có process khác đang lấy tin nhắn */
                if (data.error_code === 409) {
                    console.error(
                        "❌ XUNG ĐỘT: một bot khác đang chạy " +
                        "(getUpdates bị 409). Đóng process còn lại!");
                }

                await new Promise(r => setTimeout(r, 3000));
                continue;
            }

            for (const update of data.result) {
                offset = update.update_id + 1;

                if (update.callback_query) {
                    handleCallback(update.callback_query)
                        .catch(console.error);
                    continue;
                }

                if (update.message && update.message.text) {

                    const text = update.message.text;

                    if (text.startsWith("/")) {
                        handleCommand(update.message)
                            .catch(console.error);
                    } else if (core.getOwner() === null ||
                               update.message.chat.id === core.getOwner()) {
                        /* Tin nhắn thường → chat AI */
                        plainTextHandlers.forEach(h =>
                            h(update.message.chat.id, text)
                                .catch(console.error));
                    }
                }
            }

        } catch (error) {
            console.error("Polling lỗi:", error.message);
            await new Promise(r => setTimeout(r, 3000));
        }
    }
}


/* =========================
   START
========================= */

(async () => {
    /* Chế độ polling: phải xóa webhook cũ nếu có */
    await core.telegram("deleteWebhook",
        { drop_pending_updates: false });

    try {
        await core.initDb();
        for (const m of modules) {
            if (m.init) await m.init();
        }
        /* Tải sẵn emoji chuẩn cho ảnh bầu cua (nền, không chờ) */
        require("./bot/games/emoji").prewarm()
            .catch(() => {});
    } catch (error) {
        console.error(
            "⚠️ Không kết nối được MySQL —",
            "các lệnh dùng database sẽ báo lỗi:",
            error.message
        );
    }

    console.log("🤖 Bot đang chạy (long polling)...");
    console.log(
        process.env.AI_API_KEY || process.env.AI_BASE_URL
            ? `💬 AI chat bật: ${process.env.AI_MODEL || "mặc định"}`
            : "💬 AI chat dùng AI miễn phí (điền AI_API_KEY trong .env để dùng AI mạnh hơn)"
    );
    console.log(core.getOwner()
        ? `🔒 Chế độ riêng tư — chỉ USER_ID ${core.getOwner()} dùng được`
        : "🔓 Chưa có OWNER_ID — người đầu tiên /start sẽ thành chủ bot");

    poll();
})();
