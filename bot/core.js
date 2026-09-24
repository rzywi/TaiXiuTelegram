/* =========================
   CORE — cấu hình, Telegram API, database
   (mọi module đều require file này)
========================= */

const mysql = require("mysql2/promise");
const fs = require("fs");

const BOT_TOKEN = process.env.BOT_TOKEN;

const TELEGRAM_API =
    `https://api.telegram.org/bot${BOT_TOKEN}`;

let OWNER_ID = process.env.OWNER_ID
    ? Number(process.env.OWNER_ID)
    : null;

const db = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,

    ssl: {
        rejectUnauthorized: false
    },

    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,

    connectTimeout: 10000
});

/* =========================
   TELEGRAM API
========================= */

async function telegram(method, data) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
        const response = await fetch(
            `${TELEGRAM_API}/${method}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(data),
                signal: controller.signal
            }
        );

        return response.json();
    } finally {
        clearTimeout(timer);
    }
}

/* Gửi API dạng multipart (để upload ảnh/buffer) */
async function telegramForm(method, form) {
    const response = await fetch(
        `${TELEGRAM_API}/${method}`,
        { method: "POST", body: form }
    );

    return response.json();
}

async function send(chatId, text, extra = {}) {
    return telegram("sendMessage", {
        chat_id: chatId,
        text: text,
        parse_mode: "HTML",
        ...extra
    });
}

async function typing(chatId) {
    telegram("sendChatAction", {
        chat_id: chatId,
        action: "typing"
    }).catch(() => {});
}

async function answerCb(id, text) {
    await telegram("answerCallbackQuery", {
        callback_query_id: id,
        text: text || undefined,
        show_alert: false
    }).catch(() => {});
}

function fmt(n) {
    return Number(n).toLocaleString("vi-VN");
}

/* Tiền hiển thị ĐẦY ĐỦ số, dấu phẩy ngăn cách: 9,500,000
   (tự viết thủ công — không phụ thuộc locale của máy) */
function money(n) {
    const num = Math.round(Number(n)) || 0;
    const neg = num < 0 ? "-" : "";
    return neg + Math.abs(num).toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function esc(s) {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}


/* =========================
   OWNER (chế độ riêng tư)
========================= */

function getOwner() {
    return OWNER_ID;
}

function setOwner(chatId) {
    OWNER_ID = chatId;

    const path = ".env";
    let content = "";

    if (fs.existsSync(path)) {
        content = fs.readFileSync(path, "utf8");
    }

    if (content.includes("OWNER_ID=")) {
        content = content.replace(
            /OWNER_ID=.*/,
            `OWNER_ID=${chatId}`
        );
    } else {
        content =
            content.trimEnd() +
            `\nOWNER_ID=${chatId}\n`;
    }

    fs.writeFileSync(path, content, "utf8");
}




console.log("🔎 DB CONFIG:", {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    database: process.env.DB_NAME
});
/* =========================
   DATABASE
========================= */

async function initDb() {

    let connection;

    try {

        console.log("🔵 MySQL: đang lấy connection...");

        connection = await db.getConnection();

        console.log("🟢 MySQL: CONNECTED");

        console.log("🔵 MySQL: đang test SELECT 1...");

        await connection.query("SELECT 1");

        console.log("🟢 MySQL: SELECT 1 OK");


        /* =================================================
           TABLE USERS
        ================================================= */

        await connection.query(
            `CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                telegram_id BIGINT UNIQUE,
                username VARCHAR(64),
                balance BIGINT DEFAULT 10000
            )`
        );


        /* =================================================
           TABLE GAMES
        ================================================= */

        await connection.query(
            `CREATE TABLE IF NOT EXISTS games (
                id INT AUTO_INCREMENT PRIMARY KEY,
                telegram_id BIGINT,
                game VARCHAR(30),
                bet BIGINT,
                win BIGINT,
                detail VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`
        );


        /* =================================================
           MIGRATE GAMES
           Schema cũ có thể thiếu các cột
        ================================================= */

        console.log(
            "🔵 MySQL: kiểm tra schema games..."
        );


        const [cols] =
            await connection.query(
                "SHOW COLUMNS FROM games"
            );


        const names =
            cols.map(
                c => c.Field
            );


        if (!names.includes("game")) {

            console.log(
                "🟡 MySQL: thêm cột game..."
            );

            await connection.query(
                "ALTER TABLE games ADD COLUMN game VARCHAR(30)"
            );

        }


        if (!names.includes("detail")) {

            console.log(
                "🟡 MySQL: thêm cột detail..."
            );

            await connection.query(
                "ALTER TABLE games ADD COLUMN detail VARCHAR(255)"
            );

        }


        if (!names.includes("created_at")) {

            console.log(
                "🟡 MySQL: thêm cột created_at..."
            );

            await connection.query(
                "ALTER TABLE games ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
            );

        }


        /* =================================================
           TABLE NOTES
        ================================================= */

        await connection.query(
            `CREATE TABLE IF NOT EXISTS notes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                telegram_id BIGINT,
                content TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`
        );


        /* =================================================
           TABLE REMINDERS
        ================================================= */

        await connection.query(
            `CREATE TABLE IF NOT EXISTS reminders (
                id INT AUTO_INCREMENT PRIMARY KEY,
                telegram_id BIGINT,
                content TEXT,
                remind_at DATETIME,
                done TINYINT DEFAULT 0
            )`
        );


        /* =================================================
           TABLE DAILY BONUS
        ================================================= */

        await connection.query(
            `CREATE TABLE IF NOT EXISTS daily_bonus (
                telegram_id BIGINT,
                last_date DATE,
                PRIMARY KEY (telegram_id)
            )`
        );


        console.log(
            "🟢 MySQL: tất cả bảng đã sẵn sàng"
        );

    }

    catch (error) {

        console.error(
            "❌ MYSQL ERROR:",
            error
        );

        console.error(
            "❌ MYSQL MESSAGE:",
            error.message
        );

        console.error(
            "❌ MYSQL CODE:",
            error.code
        );

        throw error;

    }

    finally {

        if (connection) {

            connection.release();

        }

    }

}

async function getUser(telegramId) {
    const [rows] = await db.query(
        "SELECT * FROM users WHERE telegram_id = ?",
        [telegramId]
    );

    if (rows.length > 0) {
        return rows[0];
    }

    await db.query(
        `INSERT INTO users (telegram_id, balance)
        VALUES (?, 10000)
        ON DUPLICATE KEY UPDATE telegram_id = telegram_id`,
        [telegramId]
    );

    const [created] = await db.query(
        "SELECT * FROM users WHERE telegram_id = ?",
        [telegramId]
    );

    return created[0];
}

/* Trừ cược + cộng thưởng + lưu lịch sử, trả về số dư mới */
async function settle(chatId, game, bet, win, detail) {
    const user = await getUser(chatId);
    const newBalance =
        Number(user.balance) - bet + win;

    /* 2 câu ghi chạy song song cho nhanh */
    await Promise.all([
        db.query(
            "UPDATE users SET balance = ? WHERE telegram_id = ?",
            [newBalance, chatId]
        ),
        db.query(
            `INSERT INTO games (telegram_id, game, bet, win, detail)
            VALUES (?, ?, ?, ?, ?)`,
            [chatId, game, bet, win, detail || null]
        )
    ]);

    return newBalance;
}

/* Kiểm tra cược hợp lệ; gửi thông báo lỗi nếu sai */
async function checkBet(chatId, bet) {
    if (!bet || bet <= 0) {
        await send(chatId, "❌ Điểm cược không hợp lệ.");
        return false;
    }

    const user = await getUser(chatId);

    if (bet > user.balance) {
        await send(chatId,
            `❌ Không đủ tiền (còn ${money(user.balance)} VNĐ).`);
        return false;
    }

    return true;
}


/* Trừ tiền cược NGAY khi đặt (trước khi lắc) */
async function deduct(chatId, amount) {
    const user = await getUser(chatId);
    const newBalance =
        Number(user.balance) - amount;

    await db.query(
        "UPDATE users SET balance = ? WHERE telegram_id = ?",
        [newBalance, chatId]
    );

    return newBalance;
}

/* Cộng tiền nhận về khi thắng */
async function credit(chatId, amount) {
    const user = await getUser(chatId);
    const newBalance =
        Number(user.balance) + amount;

    await db.query(
        "UPDATE users SET balance = ? WHERE telegram_id = ?",
        [newBalance, chatId]
    );

    return newBalance;
}

/* Lưu lịch sử ván chơi (returned = tổng nhận về, 0 nếu thua) */
async function recordGame(chatId, game, bet, returned, detail) {
    await db.query(
        `INSERT INTO games (telegram_id, game, bet, win, detail)
        VALUES (?, ?, ?, ?, ?)`,
        [chatId, game, bet, returned, detail || null]
    );
}


module.exports = {
    BOT_TOKEN,
    db,
    telegram,
    telegramForm,
    send,
    typing,
    answerCb,
    fmt,
    money,
    esc,
    getOwner,
    setOwner,
    initDb,
    getUser,
    settle,
    checkBet,
    deduct,
    credit,
    recordGame
};
