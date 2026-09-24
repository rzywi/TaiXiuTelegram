/* =========================
   CỔNG ĐẶT CỬ DÙNG CHUNG
   Bàn cược bấm nút: chỉnh mức cược + đặt cửa.

   Cách hoạt động khi đặt cửa:
   - Thu hồi tin cũ → gửi MỘT tin duy nhất là ảnh xúc xắc
     HÀNG NGANG, trong lúc lắc mặt xúc xắc đổi liên tục
     (editMessageMedia) → khung cuối hiện kết quả + nút cược.
   - Không dùng sendDice của Telegram (nó là từng tin riêng
     xếp dọc dưới chat).
========================= */

const core = require("../core");
const { send, telegram, money, getUser,
        deduct, credit, recordGame } = core;

/* chatId -> { game, bet, messageId } */
const portals = new Map();

const BET_STEPS = [1000, 5000, 10000, 50000, 100000];

/* Thời gian mỗi khung lắc — càng lớn càng lâu, càng kịch tính */
const SHAKE_MS = 1000;

/* Hiệu ứng chờ (game không có ảnh kết quả) */
const DEFAULT_SUSPENSE = [
    "🎲 Lắc lắc lắc…",
    "🎲💫 Đang lắc…",
    "🎯 Sắp ra kết quả rồi…"
];

/* gameKey -> { title, rules, playButtons, diceCount,
                imageFor(rolls, shake, ctx), play(pick, bet, rolls),
                roll() custom } 
   ctx = { chatId, bet, result } — game board (taixiu/baccarat)
   cần bet/kết quả để vẽ ảnh */
const registered = {};

function register(gameKey, def) {
    registered[gameKey] = def;
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

/* Gieo n xúc xắc giá trị 1-6 */
function roll(n) {
    return Array.from({ length: n }, () =>
        Math.floor(Math.random() * 6) + 1);
}

function portalKeyboard(game) {
    const def = registered[game];

    /* Mã nút mang luôn tên game: pt:<game>:<hành động>
       → bảng cũ sau khi restart bot vẫn bấm được */
    const base = `pt:${game}`;

    const rows = [
        BET_STEPS.map(step => ({
            text: `+${step / 1000}K`,
            callback_data: `${base}:add:${step}`
        })),
        [
            { text: "♾ ALL-IN", callback_data: `${base}:allin` },
            { text: "♻️ 10K", callback_data: `${base}:reset` }
        ],
        ...def.playButtons,
        [{ text: "📋 MENU", callback_data: "menu:cat:main" }]
    ];

    return { inline_keyboard: rows };
}

async function portalText(chatId, game, note) {
    const user = await getUser(chatId);
    const p = portals.get(chatId) || { bet: 10000 };
    const def = registered[game];

    return (
        `${def.title}\n\n` +
        `💰 Tiền: <b>${money(user.balance)} VNĐ</b>\n` +
        `🏷 Cược: <b>${money(p.bet)} VNĐ</b>\n\n` +
        `${def.rules}\n` +
        `👇 Bấm nút để đặt cược` +
        (note ? `\n\n${note}` : "")
    );
}

/* Thu hồi tin nhắn bàn cược cũ (nếu còn) */
async function deleteOld(chatId) {
    const p = portals.get(chatId);
    if (p && p.messageId) {
        await telegram("deleteMessage", {
            chat_id: chatId,
            message_id: p.messageId
        }).catch(() => {});
    }
}

/* Gửi bàn cược text mới và ghi nhớ id để lần sau thu hồi */
async function sendPortal(chatId, note) {
    const p = portals.get(chatId);
    if (!p) return;

    const sent = await send(chatId,
        await portalText(chatId, p.game, note),
        { reply_markup: portalKeyboard(p.game) });

    if (sent.result) {
        p.messageId = sent.result.message_id;
    }

    return sent;
}

async function openPortal(chatId, game) {
    if (!portals.has(chatId)) {
        portals.set(chatId, { game: game, bet: 10000 });
    }
    portals.get(chatId).game = game;

    await deleteOld(chatId);
    return sendPortal(chatId, "");
}

/* Làm mới = thu hồi tin cũ + gửi tin mới */
async function refreshPortal(chatId, note) {
    const p = portals.get(chatId);
    if (!p) return;

    await deleteOld(chatId);
    return sendPortal(chatId, note);
}


/* ---------- ẢNH XÚC XẮC HÀNG NGANG ---------- */

function pngPart(png) {
    return new Blob([png], { type: "image/png" });
}

async function sendDicePhoto(chatId, png, caption) {
    const form = new FormData();
    form.append("chat_id", String(chatId));
    form.append("photo", pngPart(png), "dice.png");
    form.append("caption", caption);
    form.append("parse_mode", "HTML");

    const sent = await core.telegramForm("sendPhoto", form);
    return sent.result;
}

/* Đổi ảnh + chữ của tin ảnh xúc xắc — 1 lần gọi */
async function editDicePhoto(chatId, messageId, png,
                             caption, keyboard) {
    const form = new FormData();
    form.append("chat_id", String(chatId));
    form.append("message_id", String(messageId));
    form.append("media", JSON.stringify({
        type: "photo",
        media: "attach://dice",
        caption: caption,
        parse_mode: "HTML"
    }));
    form.append("dice", pngPart(png), "dice.png");

    if (keyboard) {
        form.append("reply_markup", JSON.stringify(keyboard));
    }

    return core.telegramForm("editMessageMedia", form);
}

/* Lắc bằng chữ (dự phòng khi không có ảnh) */
async function textSuspense(chatId) {
    const p = portals.get(chatId);
    const def = registered[p.game];

    p.lastRolls = typeof def.roll === "function"
        ? def.roll()
        : roll(def.diceCount || 3);

    const frames = def.suspense || DEFAULT_SUSPENSE;
    await sendPortal(chatId, frames[0]);

    for (const frame of frames.slice(1)) {
        await sleep(550);
        await telegram("editMessageText", {
            chat_id: chatId,
            message_id: p.messageId,
            text: await portalText(chatId, p.game, frame),
            parse_mode: "HTML",
            reply_markup: portalKeyboard(p.game)
        }).catch(() => {});
    }
    await sleep(550);
}

/* ctx có thể là { dice, shake, hist, bet, total, diff, isWin } (taixiu)
   hoặc { player, banker, ..., hide } (baccarat) → truyền thẳng vào board */
async function playWithSuspense(chatId, pick) {
    const p = portals.get(chatId);
    const def = registered[p.game];

    await deleteOld(chatId);

    if (!def.imageFor) {
        return textSuspense(chatId);
    }

    const n = def.diceCount || 3;
    const rollFn = typeof def.roll === "function" ? def.roll : roll;
    const shakeCtx = (rolls) => typeof def.shakeCtx === "function"
        ? def.shakeCtx(chatId, p.bet, pick, rolls, true)
        : undefined;
    const betLine = `💸 <b>${money(p.bet)} VNĐ</b> trên bàn`;
    const shakes = typeof def.shakes === "function"
        ? def.shakes(chatId, p.bet, pick)
        : [
            `${betLine}\n\n🎲 <b>Lắc lắc lắc…</b>`,
            `${betLine}\n\n🎲 <b>Lắc đều lắc đều…</b>`,
            `${betLine}\n\n🥣 <b>Đậy bát, lắc tiếp…</b>`,
            `${betLine}\n\n✨ <b>Sắp mở bát…</b>`
        ];

    /* Tin duy nhất: ảnh xúc xắc ngang đang rung lắc */
    const shakePng = await def.imageFor(rollFn(n), true, shakeCtx(rollFn(n)));
    const sent = await sendDicePhoto(chatId,
        shakePng, shakes[0])
        .catch(() => null);

    /* Gửi ảnh lỗi → chuyển sang lắc bằng chữ, ván vẫn chạy */
    if (!sent) {
        return textSuspense(chatId);
    }
    p.messageId = sent.message_id;

    /* Mặt xúc xắc xoay + rung vị trí liên tục */
    for (let i = 1; i < shakes.length; i++) {
        await sleep(SHAKE_MS);
        const framePng = await def.imageFor(rollFn(n), true, shakeCtx(rollFn(n)));
        await editDicePhoto(chatId, p.messageId,
            framePng, shakes[i])
            .catch(() => {});
    }
    await sleep(SHAKE_MS);

    /* Kết quả cuối cùng do bot quyết định */
    p.lastRolls = rollFn(n);
    p.resultCtx = undefined;
    if (typeof def.resultCtx === "function") {
        try {
            const ctx = def.resultCtx(chatId, p.bet, pick, p.lastRolls);
            if (ctx !== undefined) p.resultCtx = ctx;
        } catch {}
    }
}


/* ctx kết quả cho ảnh board: game có resultCtx() tự dựng
   (taixiu cần bet/total/lời, baccarat cần bài/điểm),
   mặc định truyền p.resultCtx của playWithSuspense */
function resultCtx(chatId, p, r) {
    const def = registered[p.game];
    if (typeof def.resultCtx === "function" && r) {
        try {
            const ctx = def.resultCtx(chatId, p.bet, p.lastPick,
                p.lastRolls, r);
            if (ctx !== undefined) return ctx;
        } catch {}
    }
    return p.resultCtx;
}

/* ---------- XỬ LÝ NÚT BẤM ---------- */

async function handlePortalCallback(query) {
    const chatId = query.message.chat.id;
    const data = query.data;

    /* Mã nút: pt:<game>:<hành động>[:<tham số>] */
    const parts = data.split(":");
    const game = parts[1];
    const action = parts[2];

    if (!registered[game]) return;

    if (!portals.has(chatId)) {
        portals.set(chatId, { game: game, bet: 10000 });
    }

    const p = portals.get(chatId);
    p.game = game;

    const user = await getUser(chatId);

    /* Chỉnh mức cược — thu hồi cũ, gửi mới */
    if (action === "add") {
        p.bet += parseInt(parts[3]);
        return refreshPortal(chatId,
            "➕ Đã tăng cược lên " + money(p.bet) + " VNĐ.");
    }

    if (action === "allin") {
        p.bet = Math.max(Number(user.balance), 0);
        return refreshPortal(chatId,
            p.bet > 0
                ? "♾ Đã ALL-IN " + money(p.bet) + " VNĐ!"
                : "❌ Cháy túi rồi — dùng /addpoints nhé!");
    }

    if (action === "reset") {
        p.bet = 10000;
        return refreshPortal(chatId,
            "♻️ Mức cược đặt lại 10,000 VNĐ.");
    }

    /* Đặt cửa: trừ cược ngay → lắc → thắng nhận cả gốc lãi */
    if (action === "play") {

        if (p.bet <= 0) {
            return core.answerCb(query.id, "Đặt cược trước đã!");
        }
        if (p.bet > Number(user.balance)) {
            return core.answerCb(query.id,
                `Không đủ tiền (còn ${money(user.balance)} VNĐ) — /addpoints`);
        }

        /* Trừ tiền cược NGAY LẬP TỨC trước khi lắc */
        const afterBet = await deduct(chatId, p.bet);

        const pick = parts[3];
        const def = registered[p.game];
        p.lastPick = pick;
        await playWithSuspense(chatId, pick);
        const rolls = p.lastRolls || [];

        /* Game tự tính: { win (tổng nhận về), outcomeText, detail } */
        const r = def.play(pick, p.bet, rolls);

        /* Thắng: cộng lại cả gốc lãi; thua: không cộng gì */
        let newBalance;
        if (r.win > 0) {
            newBalance = await credit(chatId, r.win);
        } else {
            newBalance = afterBet;
        }

        await recordGame(chatId, p.game, p.bet, r.win, r.detail);

        const moneyText = r.win > 0
            ? `🎊 <b>THẮNG!</b> Nhận về <b>+${money(r.win)} VNĐ</b>`
            : `💀 <b>THUA!</b> Mất <b>${money(p.bet)} VNĐ</b>`;

        const resultText =
            r.outcomeText + "\n\n" + moneyText +
            `\n💳 Tiền còn: <b>${money(newBalance)} VNĐ</b>`;

        if (def.imageFor && p.messageId) {
            /* Khung cuối: ảnh kết quả + dòng tiền + nút cược */
            const resultPng = await def.imageFor(rolls, false, resultCtx(chatId, p, r));
            await editDicePhoto(chatId, p.messageId,
                resultPng,
                await portalText(chatId, p.game, resultText),
                portalKeyboard(p.game)
            ).catch(() => refreshPortal(chatId, resultText));
        } else {
            await telegram("editMessageText", {
                chat_id: chatId,
                message_id: p.messageId,
                text: await portalText(chatId, p.game, resultText),
                parse_mode: "HTML",
                reply_markup: portalKeyboard(p.game)
            }).catch(() => refreshPortal(chatId, resultText));
        }
    }
}


module.exports = {
    register,
    openPortal,
    money,
    callback: {
        prefix: "pt:",
        handler: handlePortalCallback
    },
    help: ""
};
