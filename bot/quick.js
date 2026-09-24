/* =========================
   QUICK — lựa chọn ở chỗ chat (reply keyboard + gợi ý lệnh "/").
   Bàn phím cố định dưới ô nhập: bấm là chơi, khỏi gõ lệnh.
   Nạp TRƯỚC ai.js: nút đã khớp thì "nuốt", không lọt sang AI.
 ========================= */

const core = require("./core");
const { send, telegram } = core;

const KB = {
    keyboard: [
        [{ text: "📋 MENU" }, { text: "💰 Số dư" }],
        [{ text: "🎲 Tài Xỉu" }, { text: "🦀 Bầu Cua" }],
        [{ text: "🪙 Xóc Đĩa" }, { text: "🃏 Xì Dách" }],
        [{ text: "🎰 Slot" }, { text: "🪙 Xu" }],
        [{ text: "🎉 Vui" }, { text: "💬 AI" }]
    ],
    resize_keyboard: true,
    is_persistent: true
};

function withKB(extra) {
    return { ...extra, reply_markup: KB };
}

/* text nút → hành động (tái dùng lệnh/cổng có sẵn) */
const QUICK_BTNS = new Set([
    "📋 MENU", "💰 Số dư",
    "🎲 Tài Xỉu", "🦀 Bầu Cua",
    "🪙 Xóc Đĩa", "🃏 Xì Dách",
    "🎰 Slot", "🪙 Xu",
    "🎉 Vui", "💬 AI"
]);

async function onButton(chatId, text) {
    const t = String(text || "").trim();
    if (!QUICK_BTNS.has(t)) return false;

    const menu = () => require("./menu");
    const portal = () => require("./games/portal");
    const run = (mod, cmd, args) =>
        require(mod).commands[cmd](chatId, args || []);

    /* Đang nhập dở (vd: nhập tiền) mà bấm phím nhanh khác
       → hủy nhập cũ để phím mới chạy, không bị "nuốt" nhầm */
    menu().cancelPending(chatId);

    if (t === "📋 MENU") {
        await send(chatId,
            "🎰 <b>MENU CHÍNH</b>\n\nChọn nhóm chức năng — khỏi nhớ lệnh:",
            { reply_markup: { inline_keyboard: require("./menu").MAIN } });
        return true;
    }
    if (t === "💰 Số dư") { await run("./points", "/balance"); return true; }
    if (t === "🎲 Tài Xỉu") { await portal().openPortal(chatId, "taixiu"); return true; }
    if (t === "🦀 Bầu Cua") { await portal().openPortal(chatId, "baucua"); return true; }
    if (t === "🪙 Xóc Đĩa") { await portal().openPortal(chatId, "xocdia"); return true; }
    if (t === "🃏 Xì Dách") { await require("./menu").startAsk(chatId, "bj"); return true; }
    if (t === "🎰 Slot") { await run("./games/slot", "/slot", ["10000"]); return true; }
    if (t === "🪙 Xu") { await run("./games/coin", "/coin", ["ngua", "10000"]); return true; }
    if (t === "🎉 Vui") {
        await send(chatId, "🎉 <b>VUI (KIỂU BOT FB)</b>\n\nBấm là có — khỏi gõ:",
            { reply_markup: { inline_keyboard: menu().FUN } });
        return true;
    }
    if (t === "💬 AI") { await menu().startAsk(chatId, "ai"); return true; }
    return false;
}

module.exports = {
    KB,
    withKB,

    commands: {
        "/kb": async (chatId) => {
            await send(chatId, "⌨️ Bàn phím nhanh đã bật — bấm nút dưới ô nhập để chơi.",
                withKB({}));
        }
    },

    /* khớp nút thì nuốt, không khớp trả false cho lọt tiếp */
    plainText: async (chatId, text) => onButton(chatId, text),

    /* Gợi ý lệnh khi gõ "/" ở chỗ chat */
    init: async () => {
        await telegram("setMyCommands", {
            commands: [
                { command: "menu", description: "Mở menu bấm nút" },
                { command: "taixiu", description: "Cổng Tài Xỉu" },
                { command: "baccarat", description: "Baccarat CON vs CAI" },
                { command: "baucua", description: "Cổng Bầu Cua" },
                { command: "xocdia", description: "Cổng Xóc Đĩa" },
                { command: "bj", description: "Xì dách <tiền>" },
                { command: "coin", description: "Xu ngua|sap <tiền>" },
                { command: "dice", description: "Đoán xúc xắc <1-6> <tiền>" },
                { command: "slot", description: "Slot <tiền>" },
                { command: "roulette", description: "Roulette do|den|số <tiền>" },
                { command: "hilo", description: "Cao/thấp cao|thap <tiền>" },
                { command: "rps", description: "Oẳn tù tì keo|bua|bao <tiền>" },
                { command: "balance", description: "Xem số dư" },
                { command: "daily", description: "Điểm danh nhận tiền" },
                { command: "top", description: "Bảng xếp hạng" },
                { command: "give", description: "Chuyển tiền" },
                { command: "thinh", description: "Thả thính random" },
                { command: "joke", description: "Truyện cười" },
                { command: "luck", description: "Vận may hôm nay" },
                { command: "boi", description: "Bói vui <tên>" },
                { command: "hop", description: "Độ hợp nhau <a>|<b>" },
                { command: "kb", description: "Bật bàn phím nhanh" }
            ]
        }).catch(() => {});
    },

    help:
        "━━━ ⌨️ <b>PHÍM NHANH</b> ━━━\n" +
        "/kb — hiện bàn phím dưới ô chat\n"
};
