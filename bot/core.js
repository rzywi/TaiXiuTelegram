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
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});


/* =========================
   TELEGRAM API
========================= */

async function telegram(method, data) {
    const response = await fetch(
        `${TELEGRAM_API}/${method}`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        }
    );

    return response.json();
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


/* =========================
   DATABASE
========================= */

async function initDb() {
    await db.query(
        `CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            telegram_id BIGINT UNIQUE,
            username VARCHAR(64),
            balance BIGINT DEFAULT 10000
        )`
    );

    await db.query(
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

    /* Migrate từ schema cũ (webapp đầu tiên): bảng games cũ
       thiếu cột game/detail/created_at → thêm vào */
    const [cols] = await db.query("SHOW COLUMNS FROM games");
    const names = cols.map(c => c.Field);

    if (!names.includes("game")) {
        await db.query(
            "ALTER TABLE games ADD COLUMN game VARCHAR(30)");
    }
    if (!names.includes("detail")) {
        await db.query(
            "ALTER TABLE games ADD COLUMN detail VARCHAR(255)");
    }
    if (!names.includes("created_at")) {
        await db.query(
            "ALTER TABLE games ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
    }

    await db.query(
        `CREATE TABLE IF NOT EXISTS notes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            telegram_id BIGINT,
            content TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
    );

    await db.query(
        `CREATE TABLE IF NOT EXISTS reminders (
            id INT AUTO_INCREMENT PRIMARY KEY,
            telegram_id BIGINT,
            content TEXT,
            remind_at DATETIME,
            done TINYINT DEFAULT 0
        )`
    );

    await db.query(
        `CREATE TABLE IF NOT EXISTS daily_bonus (
            telegram_id BIGINT,
            last_date DATE,
            PRIMARY KEY (telegram_id)
        )`
    );
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
