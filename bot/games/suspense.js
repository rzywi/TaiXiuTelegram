/* =========================
   SUSPENSE — hiệu ứng lắc/xoay trước khi mở kết quả.
   photoRoll: 1 tin ảnh duy nhất, mặt đổi liên tục
              (editMessageMedia) → trả { messageId, rolls }.
   textRoll:  1 tin chữ duy nhất, nội dung đổi liên tục
              → trả messageId để game edit kết quả vào.
   Kết quả do bot gieo SAU animation (rolls cuối),
   giống kiểu lắc bát thật.
 ========================= */

const core = require("../core");

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

function rollDice(n) {
    return Array.from({ length: n }, () =>
        Math.floor(Math.random() * 6) + 1);
}

function pngPart(png) {
    return new Blob([png], { type: "image/png" });
}

/* captions[i] đi kèm frame i (frame 0 = lúc gửi).
   imageFor(rolls, shake=true) → Buffer PNG (sync hay async đều được) */
async function photoRoll(chatId, imageFor, n, captions, frameMs) {
    const ms = frameMs || 700;

    const first = await imageFor(rollDice(n), true);
    const form = new FormData();
    form.append("chat_id", String(chatId));
    form.append("photo", pngPart(first), "dice.png");
    form.append("caption", captions[0]);
    form.append("parse_mode", "HTML");

    const sent = await core.telegramForm("sendPhoto", form);
    if (!sent.result) {
        throw new Error("Gửi ảnh thất bại");
    }
    const messageId = sent.result.message_id;

    for (let i = 1; i < captions.length; i++) {
        await sleep(ms);
        const frame = await imageFor(rollDice(n), true);
        const f = new FormData();
        f.append("chat_id", String(chatId));
        f.append("message_id", String(messageId));
        f.append("media", JSON.stringify({
            type: "photo",
            media: "attach://dice",
            caption: captions[i],
            parse_mode: "HTML"
        }));
        f.append("dice", pngPart(frame), "dice.png");
        await core.telegramForm("editMessageMedia", f)
            .catch(() => {});
    }
    await sleep(ms);

    return { messageId: messageId, rolls: rollDice(n) };
}

/* Đổi khung ảnh suspense thành ảnh kết quả thật */
async function photoResult(chatId, messageId, png, caption, keyboard) {
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

/* frames[0] gửi mới, các frame sau edit tại chỗ.
   keyboard gán vào tin cuối (nút chơi lại) */
async function textRoll(chatId, frames, frameMs, keyboard) {
    const ms = frameMs || 600;

    const sent = await core.send(chatId, frames[0]);
    const messageId = sent.result.message_id;

    for (let i = 1; i < frames.length; i++) {
        await sleep(ms);
        await core.telegram("editMessageText", {
            chat_id: chatId,
            message_id: messageId,
            text: frames[i],
            parse_mode: "HTML",
            reply_markup: i === frames.length - 1 && keyboard
                ? keyboard
                : undefined
        }).catch(() => {});
    }

    return messageId;
}

/* Gắn nút chơi lại vào tin kết quả đã có */
async function attachReplay(chatId, messageId, text, keyboard, isPhoto) {
    if (isPhoto) {
        return null; // ảnh đã gắn nút lúc photoResult
    }
    await core.telegram("editMessageText", {
        chat_id: chatId,
        message_id: messageId,
        text: text,
        parse_mode: "HTML",
        reply_markup: keyboard
    }).catch(() => {});
}


module.exports = { photoRoll, photoResult, textRoll, attachReplay };
