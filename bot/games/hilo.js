/* =========================
   GAME: ĐOÁN BÀI CAO/THẤP
========================= */

const core = require("../core");
const { send, telegram, money, settle, checkBet } = core;
const { textRoll } = require("./suspense");
const replay = require("./replay");

const NAMES = ["A", "2", "3", "4", "5", "6", "7",
               "8", "9", "10", "J", "Q", "K"];

function cardFrame() {
    return NAMES[Math.floor(Math.random() * NAMES.length)];
}

function replayKB(guess, bet) {
    return {
        inline_keyboard: [[
            replay.btn(guess === "cao" ? "🔼 Cao lại" : "🔽 Thấp lại",
                "hilo", guess, bet)
        ]]
    };
}

async function playQuick(chatId, guess, bet) {
    bet = parseInt(bet);
    if (!await checkBet(chatId, bet)) return;

    const kb = replayKB(guess, bet);
    const head = `💸 Cược <b>${money(bet)} VNĐ</b> đoán ` +
        `<b>${guess === "cao" ? "CAO 🔼" : "THẤP 🔽"}</b>`;
    let msgId = null;
    try {
        msgId = await textRoll(chatId, [
            `${head}\n\n🃏 <b>Xào bài…</b> 🃏🃏`,
            `${head}\n\n🃏 <b>Chia lá sau…</b> ${cardFrame()} ❓`,
            `${head}\n\n🃏 <b>Lật từ từ…</b> ${cardFrame()} 👀`,
            `${head}\n\n🃏 <b>MỞ…</b>`
        ]);
    } catch {
        msgId = null;
    }

    const valueOf = () =>
        Math.floor(Math.random() * 13) + 1;

    const first = valueOf();
    const second = valueOf();

    let outcome;
    if (second === first) {
        outcome = "push";
    } else if (second > first) {
        outcome = "cao";
    } else {
        outcome = "thap";
    }

    const isWin = guess === outcome;
    const win = outcome === "push"
        ? bet
        : isWin ? Math.floor(bet * 1.95) : 0;

    const newBalance = await settle(
        chatId, "hilo", bet, win,
        `${first}->${second}`
    );

    const text =
        `🃏 Lá trước: <b>${NAMES[first - 1]}</b>\n` +
        `🃏 Lá sau: <b>${NAMES[second - 1]}</b>\n\n` +
        (outcome === "push"
            ? "🤝 Bằng nhau — hoàn cược."
            : isWin
                ? `🎉 THẮNG! Nhận về +${money(win)} VNĐ`
                : `💀 THUA! Mất ${money(bet)} VNĐ.`) +
        `\n💳 Còn: <b>${money(newBalance)} VNĐ</b>`;

    if (msgId) {
        await telegram("editMessageText", {
            chat_id: chatId,
            message_id: msgId,
            text: text,
            parse_mode: "HTML",
            reply_markup: kb
        }).catch(() => send(chatId, text, { reply_markup: kb }));
        return;
    }

    await send(chatId, text, { reply_markup: kb });
}


module.exports = {
    commands: {
        "/hilo": async (chatId, args) => {
            const guess = (args[0] || "").toLowerCase();
            const bet = parseInt(args[1]);

            if (guess !== "cao" && guess !== "thap") {
                await send(chatId, "Dùng: /hilo cao|thap <tiền>");
                return;
            }
            await playQuick(chatId, guess, bet);
        }
    },

    replay: playQuick,

    help:
        "━━━ 🃏 <b>CAO / THẤP</b> ━━━\n" +
        "/hilo cao|thap &lt;tiền&gt; — đoán lá sau cao hay thấp hơn\n"
};
