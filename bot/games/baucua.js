/* =========================
   GAME: BẦU CUA TÔM CÁ
========================= */

const core = require("../core");
const { send, telegram, money, settle, checkBet } = core;
const portal = require("./portal");
const { animalRowPng } = require("./diceimg");
const { photoRoll, photoResult } = require("./suspense");
const replay = require("./replay");

const ICONS = {
    bau: "🎃", cua: "🦀", tom: "🦐",
    ca: "🐟", ga: "🐓", huou: "🦌"
};

/* Giá trị xúc xắc 1-6 ứng với 6 con */
const BY_VALUE = ["bau", "cua", "tom", "ca", "ga", "huou"];

portal.register("baucua", {
    title: "🦀 CỔNG ĐẶT CỬ BẦU CUA TÔM CÁ",
    rules: "3 xúc xắc — trúng 1 lần x2 · 2 lần x3 · 3 lần x4",

    /* 3 xúc xắc — mặt 1-6 ứng 6 con, vẽ ảnh hàng ngang */
    diceCount: 3,

    /* Ảnh xúc xắc xếp hàng ngang (lúc lắc có rung) */
    imageFor: (rolls, shake) =>
        animalRowPng(rolls.map(v => BY_VALUE[v - 1]), shake),

    playButtons: [
        ["bau", "cua", "tom"].map(k => ({
            text: ICONS[k], callback_data: `pt:baucua:play:${k}`
        })),
        ["ca", "ga", "huou"].map(k => ({
            text: ICONS[k], callback_data: `pt:baucua:play:${k}`
        }))
    ],

    /* rolls = giá trị 3 xúc xắc vừa lăn (1=BAU, 2=CUA, 3=TOM, 4=CA, 5=GA, 6=HUOU).
       win = TỔNG nhận về (gốc + lãi) */
    play: (pick, bet, rolls) => {
        const rolled = rolls.map(v => BY_VALUE[v - 1]);
        const matches =
            rolled.filter(r => r === pick).length;

        /* Trúng mới có tiền: 1 lần nhận gốc+lãi (x2),
           2 lần x3, 3 lần x4 — trúng 0 lần là MẤT trắng */
        const win = matches > 0
            ? bet + bet * matches : 0;

        return {
            win: win,
            outcomeText:
                `🥣 Bát xóc: ${rolled.map(r => ICONS[r]).join(" ")}\n` +
                `Bạn chọn ${ICONS[pick]} — trúng <b>${matches}</b> lần`,
            detail: rolled.join(",")
        };
    }
});

function replayKB(pick, bet) {
    return {
        inline_keyboard: [
            [
                replay.btn(`${ICONS[pick]} Lại`, "baucua", pick, bet),
                replay.portalBtn("baucua")
            ],
            [replay.menuBtn()]
        ]
    };
}

async function playQuick(chatId, pick, bet) {
    bet = parseInt(bet);
    if (!ICONS[pick] || !await checkBet(chatId, bet)) return;

    const kb = replayKB(pick, bet);
    const betLine = `💸 <b>${money(bet)} VNĐ</b> cửa ${ICONS[pick]}`;
    const img = (rolls, shake) =>
        animalRowPng(rolls.map(v => BY_VALUE[v - 1]), shake);
    let played = null;
    try {
        played = await photoRoll(chatId, img, 3,
            [
                `${betLine}\n\n🥣 <b>Bỏ 3 hột vào bát…</b>`,
                `${betLine}\n\n🥣 <b>LẮC! LẮC MẠNH!</b>`,
                `${betLine}\n\n🥣 <b>Úp bát — giữ nguyên…</b>`,
                `${betLine}\n\n✨ <b>MỞ BÁT…</b>`
            ]);
    } catch {
        played = null;
    }

    const values = played
        ? played.rolls
        : [0, 0, 0].map(() =>
            Math.floor(Math.random() * 6) + 1);
    const rolled = values.map(v => BY_VALUE[v - 1]);
    const matches =
        rolled.filter(r => r === pick).length;

    /* Trúng 0 lần = mất trắng, không hoàn cược */
    const win = matches > 0
        ? bet + bet * matches : 0;

    const newBalance = await settle(
        chatId, "baucua", bet, win, rolled.join(",")
    );

    const text =
        `🥣 Bát xóc: ${rolled.map(r => ICONS[r]).join(" ")}\n\n` +
        (matches > 0
            ? `🎉 Trúng <b>${matches}</b> con — ăn +${money(bet * matches)} VNĐ!`
            : `💀 Không trúng con nào, mất ${money(bet)} VNĐ.`) +
        `\n💳 Còn: <b>${money(newBalance)} VNĐ</b>`;

    if (played) {
        await photoResult(chatId, played.messageId,
            await img(values), text, kb)
            .catch(() => send(chatId, text, { reply_markup: kb }));
        return;
    }

    await send(chatId, text, { reply_markup: kb });
}


module.exports = {
    commands: {
        "/baucua": async (chatId, args) => {

            /* Không đủ tham số → mở cổng đặt cược bấm nút */
            if (args.length < 2) {
                return portal.openPortal(chatId, "baucua");
            }

            /* Chơi nhanh: /baucua 50000 cua */
            const bet = parseInt(args[0]);
            const pick = (args[1] || "").toLowerCase();

            if (!ICONS[pick]) {
                await send(chatId,
                    "Dùng: /baucua <tiền> <món>\n" +
                    "Món: bầu, cua, ca, tom, ga, huou");
                return;
            }
            await playQuick(chatId, pick, bet);
        }
    },

    replay: playQuick,

    help:
        "━━━ 🦀 <b>BẦU CUA TÔM CÁ</b> ━━━\n" +
        "/baucua — mở cổng cược <b>bấm nút</b>\n" +
        "/baucua &lt;tiền&gt; &lt;món&gt; — chơi nhanh\n"
};
