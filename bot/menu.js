/* =========================
   MENU BẤM NÚT + NHẬP TỪNG BƯỚC
   /menu → chọn bằng nút, bot hỏi từng thông tin
   (số tiền, nội dung...) thay vì gõ lệnh dài.
   Nạp TRƯỚC ai.js: tin trả lời câu hỏi của menu bị
   menu "nuốt", không lọt sang AI.
 ========================= */

const core = require("./core");
const { send, telegram, esc } = core;

/* chatId -> { fn, expires } : câu hỏi đang chờ trả lời */
const pending = new Map();

function ask(chatId, prompt, fn) {
    pending.set(chatId, {
        fn: fn,
        expires: Date.now() + 5 * 60 * 1000
    });
    return send(chatId,
        prompt + "\n\n<i>Gõ /huy để hủy.</i>",
        { reply_markup: { force_reply: true } });
}

/* "10k" / "2m" / "5 tr" / "10.000" → số */
function parseAmount(raw) {
    let s = String(raw || "").trim().toLowerCase()
        .replace(/[\s,]/g, "");
    let mult = 1;
    if (s.endsWith("tr")) { mult = 1e6; s = s.slice(0, -2); }
    else if (s.endsWith("k")) { mult = 1e3; s = s.slice(0, -1); }
    else if (s.endsWith("m")) { mult = 1e6; s = s.slice(0, -1); }
    s = s.replace(/\./g, "");
    const n = Math.round(Number(s) * mult);
    return Number.isSafeInteger(n) && n > 0 ? n : 0;
}

function askAmount(chatId, label, fn) {
    return ask(chatId,
        `💰 <b>${esc(label)}</b>\nNhập số tiền (vd: <code>10000</code>, <code>50k</code>, <code>2m</code>):`,
        async (text) => {
            const amount = parseAmount(text);
            if (!amount) {
                await send(chatId,
                    "❌ Số tiền không hợp lệ. Gõ /menu làm lại.");
                return;
            }
            await fn(amount);
        });
}

/* Gọi lại lệnh có sẵn — tái dùng logic gốc, không copy */
function run(mod, cmd, chatId, args) {
    return require(mod).commands[cmd](chatId, args || []);
}


/* ---------- BÀN PHÍM ---------- */

const MAIN = [
    [{ text: "🎮 Game", callback_data: "menu:cat:game" },
     { text: "💰 Tiền", callback_data: "menu:cat:money" }],
    [{ text: "🛠 Tiện ích", callback_data: "menu:cat:tools" },
     { text: "🌐 Web & Ảnh", callback_data: "menu:cat:web" }],
    [{ text: "🎵 Nhạc", callback_data: "menu:cat:music" },
     { text: "📝 Nhớ & Nhắc", callback_data: "menu:cat:memo" }]
];

const BACK = [{ text: "⬅️ Về", callback_data: "menu:cat:main" }];

const SUBS = {
    game: [
        [{ text: "🎲 Tài Xỉu", callback_data: "menu:portal:taixiu" },
         { text: "🦀 Bầu Cua", callback_data: "menu:portal:baucua" }],
        [{ text: "🪙 Xóc Đĩa", callback_data: "menu:portal:xocdia" },
         { text: "🃏 Xì Dách", callback_data: "menu:ask:bj" }],
        [{ text: "🎡 Roulette", callback_data: "menu:ask:roulette" },
         { text: "🔼 Cao/Thấp", callback_data: "menu:ask:hilo" }],
        [{ text: "🎰 Slot", callback_data: "menu:ask:slot" },
         { text: "🪙 Xu", callback_data: "menu:ask:coin" }],
        [{ text: "🎲 Xúc xắc", callback_data: "menu:ask:dice" },
         { text: "✌️ Oẳn tù tì", callback_data: "menu:ask:rps" }],
        [{ text: "✨ Animation", callback_data: "menu:ask:roll" }],
        BACK
    ],
    money: [
        [{ text: "💰 Số dư", callback_data: "menu:run:balance" },
         { text: "🎁 Điểm danh", callback_data: "menu:run:daily" }],
        [{ text: "🎯 Nhiệm vụ", callback_data: "menu:run:mission" },
         { text: "🎡 Quay free", callback_data: "menu:run:spin" }],
        [{ text: "💸 Chuyển tiền", callback_data: "menu:ask:give" },
         { text: "📊 Thống kê", callback_data: "menu:run:stats" }],
        [{ text: "🏆 Bảng vàng", callback_data: "menu:run:top" },
         { text: "📜 Lịch sử", callback_data: "menu:run:history" }],
        BACK
    ],
    tools: [
        [{ text: "🧮 Máy tính", callback_data: "menu:ask:calc" },
         { text: "🔳 QR", callback_data: "menu:ask:qr" }],
        [{ text: "🌦 Thời tiết", callback_data: "menu:ask:weather" },
         { text: "🔑 Mật khẩu", callback_data: "menu:ask:password" }],
        [{ text: "🆔 UUID", callback_data: "menu:run:uuid" },
         { text: "🕐 Giờ", callback_data: "menu:run:time" }],
        BACK
    ],
    web: [
        [{ text: "🔗 Rút gọn link", callback_data: "menu:ask:short" },
         { text: "📸 Chụp web", callback_data: "menu:ask:shot" }],
        [{ text: "📖 Wiki", callback_data: "menu:ask:wiki" },
         { text: "😂 Meme", callback_data: "menu:run:meme" }],
        [{ text: "🐱 Mèo", callback_data: "menu:run:cat" },
         { text: "🐶 Chó", callback_data: "menu:run:dog" }],
        [{ text: "🇻🇳→🇬🇧 Dịch", callback_data: "menu:ask:en" },
         { text: "🇬🇧→🇻🇳 Dịch", callback_data: "menu:ask:vi" }],
        BACK
    ],
    music: [
        [{ text: "🎵 Tìm nhạc", callback_data: "menu:ask:nhac" },
         { text: "🎼 Lời bài hát", callback_data: "menu:ask:lyric" }],
        BACK
    ],
    memo: [
        [{ text: "📝 Lưu note", callback_data: "menu:ask:note" },
         { text: "📋 Xem notes", callback_data: "menu:run:notes" }],
        [{ text: "🗑 Xóa note", callback_data: "menu:ask:delnote" },
         { text: "⏰ Hẹn giờ", callback_data: "menu:ask:remind" }],
        [{ text: "⏳ Đang chờ", callback_data: "menu:run:reminders" }],
        BACK
    ]
};

const TITLES = {
    game: "🎮 <b>GAME</b>\n\nBấm để chơi — khỏi gõ lệnh:",
    money: "💰 <b>TIỀN</b>\n\nChọn:",
    tools: "🛠 <b>TIỆN ÍCH</b>\n\nChọn:",
    web: "🌐 <b>WEB & ẢNH</b>\n\nChọn:",
    music: "🎵 <b>NHẠC</b>\n\nChọn:",
    memo: "📝 <b>NHỚ & NHẮC</b>\n\nChọn:"
};

/* Lệnh chạy ngay, không cần nhập gì */
const RUNS = {
    balance: ["./points", "/balance"],
    daily: ["./points", "/daily"],
    stats: ["./points", "/stats"],
    mission: ["./social", "/mission"],
    spin: ["./extras", "/spin"],
    top: ["./social", "/top"],
    history: ["./social", "/history"],
    meme: ["./net", "/meme"],
    cat: ["./net", "/cat"],
    dog: ["./net", "/dog"],
    uuid: ["./tools", "/uuid"],
    time: ["./tools", "/time"],
    notes: ["./notes", "/notes"],
    reminders: ["./reminders", "/reminders"]
};


/* ---------- BẮT ĐẦU NHẬP LIỆU ---------- */

async function startAsk(chatId, key) {
    switch (key) {
        case "coin":
            return send(chatId, "🪙 <b>Chọn mặt:</b>", {
                reply_markup: { inline_keyboard: [[
                    { text: "Ngửa", callback_data: "menu:pick:coin:ngua" },
                    { text: "Sấp", callback_data: "menu:pick:coin:sap" }
                ]] }
            });
        case "dice":
            return send(chatId, "🎲 <b>Đoán số:</b>", {
                reply_markup: { inline_keyboard: [
                    [1, 2, 3].map(n => ({
                        text: String(n),
                        callback_data: `menu:pick:dice:${n}`
                    })),
                    [4, 5, 6].map(n => ({
                        text: String(n),
                        callback_data: `menu:pick:dice:${n}`
                    }))
                ] } }
            );
        case "rps":
            return send(chatId, "✌️ <b>Ra tay:</b>", {
                reply_markup: { inline_keyboard: [[
                    { text: "✌️ Kéo", callback_data: "menu:pick:rps:keo" },
                    { text: "✊ Búa", callback_data: "menu:pick:rps:bua" },
                    { text: "✋ Bao", callback_data: "menu:pick:rps:bao" }
                ]] } }
            );
        case "hilo":
            return send(chatId, "🔼 <b>Đoán lá sau:</b>", {
                reply_markup: { inline_keyboard: [[
                    { text: "🔼 Cao", callback_data: "menu:pick:hilo:cao" },
                    { text: "🔽 Thấp", callback_data: "menu:pick:hilo:thap" }
                ]] } }
            );
        case "roulette":
            return send(chatId, "🎡 <b>Đặt cửa:</b>", {
                reply_markup: { inline_keyboard: [[
                    { text: "🔴 Đỏ", callback_data: "menu:pick:roulette:do" },
                    { text: "⚫ Đen", callback_data: "menu:pick:roulette:den" },
                    { text: "🔢 Số…", callback_data: "menu:pick:roulette:num" }
                ]] } }
            );
        case "roll":
            return send(chatId, "✨ <b>Chọn animation:</b>", {
                reply_markup: { inline_keyboard: [
                    ["xucxac", "phi", "bongro"].map(k => ({
                        text: { xucxac: "🎲 Xúc xắc", phi: "🎯 Phi", bongro: "🏀 Bóng rổ" }[k],
                        callback_data: `menu:pick:roll:${k}`
                    })),
                    ["bongda", "bowling", "slot"].map(k => ({
                        text: { bongda: "⚽ Bóng đá", bowling: "🎳 Bowling", slot: "🎰 Slot" }[k],
                        callback_data: `menu:pick:roll:${k}`
                    }))
                ] } }
            );
        case "bj":
            return askAmount(chatId, "Xì Dách",
                (a) => run("./games/blackjack", "/bj", chatId, [String(a)]));
        case "slot":
            return askAmount(chatId, "Slot",
                (a) => run("./games/slot", "/slot", chatId, [String(a)]));
        case "give":
            return ask(chatId, "💸 <b>Chuyển tiền</b>\nNhập ID người nhận:",
                (t) => {
                    const id = parseInt(t);
                    if (!id) {
                        send(chatId, "❌ ID không hợp lệ. Gõ /menu làm lại.");
                        return;
                    }
                    askAmount(chatId, "Chuyển cho " + id, (a) =>
                        run("./social", "/give", chatId, [String(id), String(a)]));
                });
        case "remind":
            return ask(chatId, "⏰ Nhắc sau bao nhiêu <b>phút</b>?",
                (t) => {
                    if (!parseInt(t)) {
                        send(chatId, "❌ Số phút không hợp lệ.");
                        return;
                    }
                    ask(chatId, "Nhắc nội dung gì?", (c) =>
                        run("./reminders", "/remind", chatId, [t, c]));
                });
        case "note":
            return ask(chatId, "📝 Nhập nội dung ghi chú:",
                (t) => run("./notes", "/note", chatId, [t]));
        case "delnote":
            return ask(chatId, "🗑 Nhập <b>ID</b> ghi chú cần xóa (xem ID ở /notes):",
                (t) => run("./notes", "/delnote", chatId, [t]));
        case "countdown":
            return ask(chatId, "⏱ Đếm ngược bao nhiêu <b>giây</b>?",
                (t) => {
                    if (!parseInt(t)) {
                        send(chatId, "❌ Số giây không hợp lệ.");
                        return;
                    }
                    ask(chatId, "Hết giờ thì báo gì?", (c) =>
                        run("./extras", "/countdown", chatId, [t, c]));
                });
        case "pick":
            return ask(chatId, "🎲 Nhập các lựa chọn, cách nhau bằng <code>|</code>:\nvd: <code>ăn cơm | ăn mì | nhịn</code>",
                (t) => run("./extras", "/pick", chatId, [t]));
        case "calc":
            return ask(chatId, "🧮 Nhập biểu thức:\nvd: <code>(100+20)*1.1</code>",
                (t) => run("./tools", "/calc", chatId, t.split(/\s+/)));
        case "qr":
            return ask(chatId, "🔳 Nhập text/link cần tạo QR:",
                (t) => run("./tools", "/qr", chatId, [t]));
        case "weather":
            return ask(chatId, "🌦 Nhập tên thành phố:\nvd: <code>Hà Nội</code>",
                (t) => run("./tools", "/weather", chatId, [t]));
        case "password":
            return ask(chatId, "🔑 Nhập độ dài mật khẩu (số, vd: <code>16</code>):",
                (t) => run("./tools", "/password", chatId, [t]));
        case "short":
            return ask(chatId, "🔗 Nhập link cần rút gọn:",
                (t) => run("./net", "/short", chatId, [t]));
        case "shot":
            return ask(chatId, "📸 Nhập link website cần chụp:",
                (t) => run("./net", "/shot", chatId, [t]));
        case "wiki":
            return ask(chatId, "📖 Nhập từ khóa Wikipedia:",
                (t) => run("./net", "/wiki", chatId, [t]));
        case "en":
            return ask(chatId, "🇻🇳→🇬🇧 Nhập câu tiếng Việt:",
                (t) => run("./net", "/en", chatId, [t]));
        case "vi":
            return ask(chatId, "🇬🇧→🇻🇳 Nhập câu tiếng Anh:",
                (t) => run("./net", "/vi", chatId, [t]));
        case "nhac":
            return ask(chatId, "🎵 Nhập tên bài hát:",
                (t) => run("./nhac", "/nhac", chatId, [t]));
        case "lyric":
            return ask(chatId, "🎼 Nhập tên bài cần tìm lời:",
                (t) => run("./net", "/lyric", chatId, [t]));
        case "ai":
            return ask(chatId, "💬 Nhập câu hỏi cho AI:",
                (t) => run("./ai", "/ask", chatId, [t]));
        case "addpoints":
            return askAmount(chatId, "Cộng tiền",
                (a) => run("./points", "/addpoints", chatId, [String(a)]));
        default:
            return send(chatId, "🚧 Chức năng này đang làm.");
    }
}


/* ---------- ĐÃ BẤM LỰA CHỌN → HỎI TIỀN ---------- */

async function onPick(chatId, key, val) {
    if (key === "roll") {
        return run("./net", "/roll", chatId, [val]);
    }

    if (key === "roulette" && val === "num") {
        return ask(chatId, "🎡 Nhập số <b>0-36</b>:", (t) => {
            const n = parseInt(t);
            if (isNaN(n) || n < 0 || n > 36) {
                send(chatId, "❌ Chỉ số 0-36. Gõ /menu làm lại.");
                return;
            }
            askAmount(chatId, "Roulette số " + n, (a) =>
                run("./games/roulette", "/roulette", chatId, [String(n), String(a)]));
        });
    }

    const label = {
        coin: "Tung đồng xu", dice: "Đoán xúc xắc",
        rps: "Oẳn tù tì", hilo: "Cao/Thấp", roulette: "Roulette"
    }[key] || "Đặt cược";

    return askAmount(chatId, label, (a) => {
        if (key === "coin") return run("./games/coin", "/coin", chatId, [val, String(a)]);
        if (key === "dice") return run("./games/dice", "/dice", chatId, [val, String(a)]);
        if (key === "rps") return run("./extras", "/rps", chatId, [val, String(a)]);
        if (key === "hilo") return run("./games/hilo", "/hilo", chatId, [val, String(a)]);
        if (key === "roulette") return run("./games/roulette", "/roulette", chatId, [val, String(a)]);
    });
}


module.exports = {
    commands: {
        "/menu": async (chatId) => {
            await send(chatId,
                "🎰 <b>MENU CHÍNH</b>\n\nChọn nhóm chức năng — khỏi nhớ lệnh:",
                { reply_markup: { inline_keyboard: MAIN } });
        },

        "/huy": async (chatId) => {
            if (pending.delete(chatId)) {
                await send(chatId, "🚫 Đã hủy.");
            } else {
                await send(chatId, "Không có gì để hủy.");
            }
        }
    },

    /* Chạy trước AI: "nuốt" tin nhập liệu (trả true),
       tin thường trả false cho lọt xuống AI */
    plainText: async (chatId, text) => {
        const p = pending.get(chatId);
        if (!p) return false;

        if (Date.now() > p.expires) {
            pending.delete(chatId);
            return false;
        }

        if (text.trim() === "/huy") {
            pending.delete(chatId);
            await send(chatId, "🚫 Đã hủy.");
            return true;
        }

        pending.delete(chatId);

        try {
            await p.fn(text);
        } catch (error) {
            console.error("❌ Menu input lỗi:", error);
            await send(chatId, `⚠️ Lỗi: ${error.message}`);
        }

        return true;
    },

    callback: {
        prefix: "menu:",
        handler: async (query) => {
            const chatId = query.message.chat.id;
            const parts = query.data.split(":");
            const action = parts[1];
            const a = parts[2];
            const b = parts[3];

            if (action === "cat") {
                const kb = a === "main" ? MAIN : SUBS[a];
                if (!kb) return;
                const title = a === "main"
                    ? "🎰 <b>MENU CHÍNH</b>\n\nChọn nhóm chức năng — khỏi nhớ lệnh:"
                    : TITLES[a];
                await telegram("editMessageText", {
                    chat_id: chatId,
                    message_id: query.message.message_id,
                    text: title,
                    parse_mode: "HTML",
                    reply_markup: { inline_keyboard: kb }
                });
                return;
            }

            if (action === "portal") {
                await require("./games/portal").openPortal(chatId, a);
                return;
            }

            if (action === "run") {
                const target = RUNS[a];
                if (!target) return;
                await run(target[0], target[1], chatId, []);
                return;
            }

            if (action === "ask") {
                await startAsk(chatId, a);
                return;
            }

            if (action === "pick") {
                await onPick(chatId, a, b);
                return;
            }
        }
    },

    help:
        "━━━ 🎰 <b>MENU BẤM NÚT</b> ━━━\n" +
        "/menu — mở menu, bấm nút + nhập từng bước\n" +
        "/huy — hủy thao tác đang nhập\n"
};
