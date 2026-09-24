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

    console.log(
        `🌐 HTTP server listening on port ${PORT}`
    );

});


/* =====================================================
   DANH SÁCH MODULE
===================================================== */

const modules = [

    require("./bot/menu"),
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
    require("./bot/social"),
    require("./bot/extras"),
    require("./bot/net"),
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

    "/start": (chatId) =>
        core.send(chatId, HELP_TEXT),

    "/help": (chatId) =>
        core.send(chatId, HELP_TEXT)

};


const callbacks = [];
const plainTextHandlers = [];


for (const m of modules) {

    if (m.commands) {

        Object.assign(
            commands,
            m.commands
        );

    }


    if (m.callback) {

        callbacks.push(
            m.callback
        );

    }


    if (m.plainText) {

        plainTextHandlers.push(
            m.plainText
        );

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

    const text =
        (msg.text || "").trim();


    const [rawCmd, ...args] =
        text.split(/\s+/);


    const cmd =
        rawCmd
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

        }

        else {

            await core.send(

                chatId,

                "❓ Lệnh không tồn tại. Gõ /help để xem danh sách."

            );

        }

    }

    catch (error) {

        console.error(
            "❌ Command error:",
            error
        );


        try {

            await core.send(

                chatId,

                `⚠️ Lỗi: ${error.message}`

            );

        }

        catch (sendError) {

            console.error(
                "❌ Không thể gửi thông báo lỗi:",
                sendError.message
            );

        }

    }

}


/* =====================================================
   CHỐNG CHẠY TRÙNG
===================================================== */

const LOCK_FILE = ".bot.lock";


if (fs.existsSync(LOCK_FILE)) {

    const oldPid =
        parseInt(
            fs.readFileSync(
                LOCK_FILE,
                "utf8"
            )
        );


    let alive = false;


    try {

        process.kill(
            oldPid,
            0
        );

        alive = true;

    }

    catch {

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


/* =====================================================
   XÓA LOCK KHI DỪNG
===================================================== */

function removeLock() {

    try {

        if (fs.existsSync(LOCK_FILE)) {

            fs.unlinkSync(
                LOCK_FILE
            );

        }

    }

    catch (error) {

        console.error(
            "⚠️ Không thể xóa lock:",
            error.message
        );

    }

}


process.on("SIGINT", () => {

    removeLock();

    process.exit(0);

});


process.on("SIGTERM", () => {

    removeLock();

    process.exit(0);

});


process.on("exit", () => {

    removeLock();

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


    try {

        await core.answerCb(
            query.id
        );

    }

    catch (error) {

        console.error(
            "⚠️ answerCb lỗi:",
            error.message
        );

    }


    for (const cb of callbacks) {

        if (
            query.data &&
            query.data.startsWith(
                cb.prefix
            )
        ) {

            try {

                await cb.handler(
                    query
                );

            }

            catch (error) {

                console.error(
                    "❌ Callback error:",
                    error
                );


                try {

                    await core.answerCb(

                        query.id,

                        "⚠️ Có lỗi xảy ra"

                    );

                }

                catch {}

            }

            return;

        }

    }

}


/* =====================================================
   TELEGRAM LONG POLLING
===================================================== */

async function poll() {

    let offset = 0;


    console.log(
        "🟢 Telegram polling đã bắt đầu"
    );


    while (true) {

        try {

            const response = await fetch(

                `https://api.telegram.org/bot${core.BOT_TOKEN}/getUpdates`,

                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
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


            /* Telegram trả lỗi */

            if (
                !data.ok ||
                !data.result
            ) {

                /* 409 = có bot khác đang polling */

                if (
                    data.error_code === 409
                ) {

                    console.error(

                        "❌ XUNG ĐỘT: một bot khác đang chạy " +
                        "(getUpdates bị 409)."

                    );

                }

                else {

                    console.error(

                        "❌ Telegram API lỗi:",

                        data.error_code,

                        data.description

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


            /* =================================================
               XỬ LÝ UPDATE
            ================================================= */

            for (
                const update of data.result
            ) {

                offset =
                    update.update_id + 1;


                /* =============================================
                   CALLBACK BUTTON
                ============================================= */

                if (
                    update.callback_query
                ) {

                    handleCallback(
                        update.callback_query
                    )
                    .catch(
                        console.error
                    );


                    continue;

                }


                /* =============================================
                   MESSAGE
                ============================================= */

                if (
                    update.message &&
                    update.message.text
                ) {

                    const text =
                        update.message.text;


                    /* COMMAND */

                    if (
                        text.startsWith("/")
                    ) {

                        handleCommand(
                            update.message
                        )
                        .catch(
                            console.error
                        );

                    }


                    /* TIN NHẮN THƯỜNG */

                    else if (

                        core.getOwner() === null ||

                        update.message.chat.id ===
                            core.getOwner()

                    ) {

                        for (const handler of plainTextHandlers) {

                            try {

                                /* Menu trả true khi đã "nuốt" tin
                                   (nhập số tiền, nội dung...) —
                                   tin đó không lọt tiếp xuống AI */
                                const swallowed =
                                    await handler(
                                        update.message.chat.id,
                                        text
                                    );

                                if (swallowed === true) {
                                    break;
                                }

                            }

                            catch (error) {

                                console.error(error);

                            }

                        }

                    }

                }

            }

        }

        catch (error) {

            console.error(

                "❌ Polling lỗi:",

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
   HÀM TIMEOUT
   Dùng để tránh Render bị treo vô thời hạn
===================================================== */

function timeoutPromise(
    promise,
    milliseconds,
    message
) {

    let timer;


    const timeout =
        new Promise(
            (_, reject) => {

                timer = setTimeout(
                    () => {

                        reject(
                            new Error(
                                message
                            )
                        );

                    },
                    milliseconds
                );

            }
        );


    return Promise.race([

        promise,

        timeout

    ]).finally(() => {

        clearTimeout(timer);

    });

}


/* =====================================================
   START BOT
===================================================== */

(async () => {

    console.log(
        "========================================"
    );

    console.log(
        "🚀 ĐANG KHỞI ĐỘNG BOT..."
    );

    console.log(
        "========================================"
    );


    /* =================================================
       KIỂM TRA BOT TOKEN
    ================================================= */

    if (!core.BOT_TOKEN) {

        console.error(
            "❌ BOT_TOKEN chưa được cấu hình!"
        );

        process.exit(1);

    }


    console.log(
        "🟢 BOT_TOKEN: đã được cấu hình"
    );


    /* =================================================
       XÓA WEBHOOK
       Long polling không được chạy cùng webhook
    ================================================= */

    try {

        console.log(
            "🔵 Đang kiểm tra / xóa Telegram webhook..."
        );


        await timeoutPromise(

            core.telegram(
                "deleteWebhook",
                {
                    drop_pending_updates: false
                }
            ),

            15000,

            "Telegram deleteWebhook timeout sau 15 giây"

        );


        console.log(
            "🟢 Telegram webhook đã được xử lý"
        );

    }

    catch (error) {

        console.error(
            "⚠️ Không thể xóa webhook:",
            error.message
        );


        console.error(
            "⚠️ Bot vẫn sẽ tiếp tục khởi động..."
        );

    }


    /* =================================================
       KẾT NỐI MYSQL
    ================================================= */

    try {

        console.log(
            "🔵 Đang khởi tạo MySQL..."
        );


        console.log(
            "DB CONFIG:"
        );

        console.log(
            "  host:",
            process.env.DB_HOST || "(chưa có)"
        );

        console.log(
            "  port:",
            process.env.DB_PORT || "(mặc định 3306)"
        );

        console.log(
            "  user:",
            process.env.DB_USER || "(chưa có)"
        );

        console.log(
            "  database:",
            process.env.DB_NAME || "(chưa có)"
        );


        await timeoutPromise(

            core.initDb(),

            15000,

            "MySQL init timeout sau 15 giây"

        );


        console.log(
            "🟢 MySQL đã khởi tạo thành công"
        );

    }

    catch (error) {

        console.error(
            "❌ Không kết nối được MySQL"
        );

        console.error(
            "❌ MYSQL MESSAGE:",
            error.message
        );

        console.error(
            "❌ MYSQL CODE:",
            error.code || "(không có)"
        );


        console.error(
            "⚠️ Bot vẫn tiếp tục chạy."
        );

        console.error(
            "⚠️ Các chức năng cần database có thể không hoạt động."
        );

    }


    /* =================================================
       KHỞI TẠO MODULE
    ================================================= */

    console.log(
        "🔵 Đang khởi tạo các module..."
    );


    for (
        const m of modules
    ) {

        try {

            if (m.init) {

                await timeoutPromise(

                    m.init(),

                    10000,

                    "Module init timeout sau 10 giây"

                );

            }

        }

        catch (error) {

            console.error(
                "⚠️ Module init lỗi:",
                error.message
            );

        }

    }


    console.log(
        "🟢 Các module đã được khởi tạo"
    );


    /* =================================================
       PRELOAD EMOJI
    ================================================= */

    try {

        require("./bot/games/emoji")
            .prewarm()
            .catch(() => {});

    }

    catch (error) {

        console.error(
            "⚠️ Emoji preload lỗi:",
            error.message
        );

    }


    /* =================================================
       BOT READY
    ================================================= */

    console.log(
        "========================================"
    );

    console.log(
        "🤖 BOT ĐANG CHẠY — LONG POLLING"
    );

    console.log(
        "========================================"
    );


    /* =================================================
       AI STATUS
    ================================================= */

    console.log(

        process.env.AI_API_KEY ||
        process.env.AI_BASE_URL

            ? `💬 AI chat bật: ${
                process.env.AI_MODEL ||
                "mặc định"
              }`

            : "💬 AI chat dùng AI miễn phí"

    );


    /* =================================================
       OWNER STATUS
    ================================================= */

    console.log(

        core.getOwner()

            ? `🔒 Chế độ riêng tư — chỉ USER_ID ${
                core.getOwner()
              } dùng được`

            : "🔓 Chưa có OWNER_ID — " +
              "người đầu tiên /start sẽ thành chủ bot"

    );


    /* =================================================
       BẮT ĐẦU TELEGRAM POLLING
    ================================================= */

    poll();

})();
