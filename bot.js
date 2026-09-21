/* =====================================================
   BOT CÁ NHÂN — ENTRY POINT
   Render Web Service + Telegram Long Polling
===================================================== */

require("dotenv").config();

const fs = require("fs");
const http = require("http");
const core = require("./bot/core");

/* =====================================================
   RENDER HTTP SERVER
   Render yêu cầu Web Service phải listen PORT
===================================================== */

const PORT = Number(process.env.PORT) || 10000;

const server = http.createServer((req, res) => {
    if (req.url === "/" || req.url === "/health") {
        res.writeHead(200, {
            "Content-Type": "application/json; charset=utf-8"
        });

        res.end(JSON.stringify({
            ok: true,
            service: "TaiXiuTelegram",
            status: "running"
        }));

        return;
    }

    res.writeHead(404, {
        "Content-Type": "application/json; charset=utf-8"
    });

    res.end(JSON.stringify({
        ok: false,
        error: "Not Found"
    }));
});

server.listen(PORT, "0.0.0.0", () => {
    console.log(`🌐 HTTP server listening on port ${PORT}`);
});


/* =====================================================
   DANH SÁCH MODULE
===================================================== */

const modules = [
    require("./bot/ai"),
    require("./bot/games/portal"),
    require("./bot/games/taixiu"),
    require("./bot/games/baucua"),
    require("./bot/games/xocdia"),
    require("./bot/games/roulette"),
    require("./bot/games/blackjack"),
    require("./bot/games/hilo"),
    require("./bot/games/slot"),
    require("./bot/games/coin"),
    require("./bot/games/dice"),
    require("./bot/points"),
    require("./bot/notes"),
    require("./bot/reminders"),
    require("./bot/nhac"),
    require("./bot/tools"),
    require("./bot/power")
];


/* =====================================================
   GOM COMMAND / CALLBACK / PLAIN TEXT
===================================================== */

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


/* =====================================================
   HELP
===================================================== */

const HELP_TEXT =
    "🎰 <b>BOT CÁ NHÂN — TOÀN BỘ LỆNH</b>\n\n" +
    modules
        .map(m => m.help)
        .filter(h => h && h.trim())
        .join("\n");


/* =====================================================
   XỬ LÝ COMMAND
===================================================== */

async function handleCommand(msg) {

    const chatId = msg.chat.id;

    const text = (msg.text || "").trim();

    const [rawCmd, ...args] = text.split(/\s+/);

    const cmd = rawCmd
        .toLowerCase()
        .split("@")[0];


    /* Người đầu tiên /start sẽ thành owner */

    if (core.getOwner() === null) {

        core.setOwner(chatId);

        await core.send(
            chatId,
            "✅ Bạn đã trở thành chủ sở hữu bot.\n\n" +
            HELP_TEXT
        );
    }


    /* Chỉ owner được sử dụng bot */

    if (chatId !== core.getOwner()) {
        return;
    }


    const handler = commands[cmd];

    try {

        if (handler) {

            await handler(
                chatId,
                args,
                msg
            );

        } else {

            await core.send(
                chatId,
                "❓ Lệnh không tồn tại. Gõ /help để xem danh sách."
            );
        }

    } catch (error) {

        console.error(error);

        await core.send(
            chatId,
            `⚠️ Lỗi: ${error.message}`
        );
    }
}


/* =====================================================
   CHỐNG CHẠY TRÙNG
===================================================== */

const LOCK_FILE = ".bot.lock";

if (fs.existsSync(LOCK_FILE)) {

    const oldPid = parseInt(
        fs.readFileSync(
            LOCK_FILE,
            "utf8"
        )
    );

    let alive = false;

    try {

        process.kill(oldPid, 0);

        alive = true;

    } catch {
        /* process cũ đã chết */
    }


    if (alive) {

        console.error(
            `❌ Bot đang chạy rồi (PID ${oldPid})!`
        );

        process.exit(1);
    }
}


/* Ghi PID hiện tại */

fs.writeFileSync(
    LOCK_FILE,
    String(process.pid)
);


/* Xóa lock khi dừng */

process.on("SIGINT", () => {

    try {
        fs.unlinkSync(LOCK_FILE);
    } catch {}

    process.exit(0);
});


process.on("SIGTERM", () => {

    try {
        fs.unlinkSync(LOCK_FILE);
    } catch {}

    process.exit(0);
});


process.on("exit", () => {

    try {
        fs.unlinkSync(LOCK_FILE);
    } catch {}
});


/* =====================================================
   CALLBACK
===================================================== */

async function handleCallback(query) {

    const chatId =
        query.message?.chat?.id;


    if (
        !chatId ||
        chatId !== core.getOwner()
    ) {
        return;
    }


    core.answerCb(query.id);


    for (const cb of callbacks) {

        if (
            query.data.startsWith(
                cb.prefix
            )
        ) {

            return cb.handler(query)
                .catch(async error => {

                    console.error(error);

                    core.answerCb(
                        query.id,
                        "⚠️ Có lỗi xảy ra"
                    );
                });
        }
    }
}


/* =====================================================
   TELEGRAM LONG POLLING
===================================================== */

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

                        allowed_updates: [
                            "message",
                            "callback_query"
                        ]
                    })
                }
            );


            const data =
                await response.json();


            if (
                !data.ok ||
                !data.result
            ) {

                /* Telegram 409:
                   Có bot khác đang polling */

                if (
                    data.error_code === 409
                ) {

                    console.error(
                        "❌ XUNG ĐỘT: một bot khác đang chạy " +
                        "(getUpdates bị 409)."
                    );
                }


                await new Promise(
                    resolve =>
                        setTimeout(
                            resolve,
                            3000
                        )
                );

                continue;
            }


            for (
                const update of data.result
            ) {

                offset =
                    update.update_id + 1;


                /* Callback button */

                if (
                    update.callback_query
                ) {

                    handleCallback(
                        update.callback_query
                    ).catch(console.error);

                    continue;
                }


                /* Message */

                if (
                    update.message &&
                    update.message.text
                ) {

                    const text =
                        update.message.text;


                    /* Command */

                    if (
                        text.startsWith("/")
                    ) {

                        handleCommand(
                            update.message
                        ).catch(console.error);

                    }


                    /* Tin nhắn thường */

                    else if (
                        core.getOwner() === null ||
                        update.message.chat.id ===
                            core.getOwner()
                    ) {

                        plainTextHandlers.forEach(
                            handler => {

                                handler(
                                    update.message.chat.id,
                                    text
                                ).catch(console.error);

                            }
                        );
                    }
                }
            }

        } catch (error) {

            console.error(
                "Polling lỗi:",
                error.message
            );


            await new Promise(
                resolve =>
                    setTimeout(
                        resolve,
                        3000
                    )
            );
        }
    }
}


/* =====================================================
   START BOT
===================================================== */

(async () => {

    try {

        /* Polling thì phải xóa webhook */

        await core.telegram(
            "deleteWebhook",
            {
                drop_pending_updates: false
            }
        );


        /* Kết nối MySQL */

        await core.initDb();


        /* Khởi tạo module */

        for (
            const m of modules
        ) {

            if (m.init) {
                await m.init();
            }
        }


        /* Preload emoji */

        require("./bot/games/emoji")
            .prewarm()
            .catch(() => {});


    } catch (error) {

        console.error(
            "⚠️ Không kết nối được MySQL —",
            "các lệnh dùng database sẽ báo lỗi:",
            error.message
        );
    }


    console.log(
        "🤖 Bot đang chạy (long polling)..."
    );


    console.log(
        process.env.AI_API_KEY ||
        process.env.AI_BASE_URL

            ? `💬 AI chat bật: ${
                process.env.AI_MODEL ||
                "mặc định"
              }`

            : "💬 AI chat dùng AI miễn phí"
    );


    console.log(
        core.getOwner()

            ? `🔒 Chế độ riêng tư — chỉ USER_ID ${
                core.getOwner()
              } dùng được`

            : "🔓 Chưa có OWNER_ID — " +
              "người đầu tiên /start sẽ thành chủ bot"
    );


    /* Bắt đầu Telegram polling */

    poll();

})();
