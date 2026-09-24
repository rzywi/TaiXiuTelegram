/* =========================
   GAME: TÀI XỈU
   Cổng bấm nút + chơi nhanh bằng lệnh
========================= */

const core = require("../core");
const { send, telegram, money, settle, checkBet } = core;
const portal = require("./portal");
const { taixiuBoardPng } = require("./tableimg");
const { photoRoll, photoResult } = require("./suspense");
const replay = require("./replay");

const DICE = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

/* lịch sử TÀI/XỈU cho board (RAM — restart reset, DB vẫn đủ) */
const txHist = new Map();
function histOf(chatId) {
    return txHist.get(chatId) || [];
}
function pushHist(chatId, r) {
    const h = histOf(chatId).concat([r]).slice(-10);
    txHist.set(chatId, h);
    return h;
}
function boardOf(dice, o) {
    const d = (o && Array.isArray(o.dice) && o.dice.length === 3)
        ? o.dice : dice;
    return taixiuBoardPng({
        dice: d, shake: o ? !!o.shake : true,
        hist: (o && o.hist) || [], bet: (o && o.bet) || 0,
        total: o && o.total, diff: o && o.diff, isWin: o && o.isWin
    });
}
function resultOf(chatId, bet, rolls, win) {
    const [d1, d2, d3] = rolls;
    const total = d1 + d2 + d3;
    const res = total >= 11 ? "tai" : "xiu";
    return {
        dice: rolls, shake: false, hist: pushHist(chatId, res),
        bet, total, diff: win - bet, isWin: win > 0
    };
}

function replayKB(bet) {
    return {
        inline_keyboard: [
            [
                replay.btn("🔴 TÀI lại", "taixiu", "tai", bet),
                replay.btn("⚪ XỈU lại", "taixiu", "xiu", bet),
                replay.portalBtn("taixiu")
            ],
            [replay.menuBtn()]
        ]
    };
}

portal.register("taixiu", {
    title: "🎲 CỔNG ĐẶT CỬ TÀI XỈU",
    rules: "🔴 TÀI (11-18) · ⚪ XỈU (3-10) - x1,95",

    /* 3 xúc xắc — board tối neon (lắc rung, kết quả đầy đủ tiền/số) */
    diceCount: 3,

    /* Ảnh board: lúc lắc dùng dice vừa gieo, kết quả tính đủ ở resultCtx */
    imageFor: (rolls, shake, ctx) => boardOf(rolls, ctx),
    shakeCtx: (chatId, bet, pick, rolls) =>
        ({ dice: rolls, shake: true, hist: histOf(chatId), bet }),
    shakes: (chatId, bet) => [
        `💸 <b>${money(bet)} VNĐ</b> trên bàn\n\n🎲 <b>Bỏ xúc xắc vào bát…</b>`,
        `💸 <b>${money(bet)} VNĐ</b> trên bàn\n\n🎲 <b>Lắc mạnh… CLACK CLACK!</b>`,
        `💸 <b>${money(bet)} VNĐ</b> trên bàn\n\n🥣 <b>Úp bát xuống bàn…</b>`,
        `💸 <b>${money(bet)} VNĐ</b> trên bàn\n\n✨ <b>MỞ BÁT…</b>`
    ],
    resultCtx: (chatId, bet, pick, rolls, r) =>
        r ? resultOf(chatId, bet, rolls, r.win)
          : { dice: rolls, shake: true, hist: histOf(chatId), bet },

    playButtons: [
        [
            { text: "🔴 TÀI", callback_data: "pt:taixiu:play:tai" },
            { text: "⚪ XỈU", callback_data: "pt:taixiu:play:xiu" }
        ]
    ],

    /* rolls = giá trị 3 xúc xắc vừa lăn.
       win = TỔNG nhận về (gốc + lãi), 0 nếu thua */
    play: (pick, bet, rolls) => {
        const [d1, d2, d3] = rolls;
        const total = d1 + d2 + d3;
        const result = total >= 11 ? "tai" : "xiu";
        const isWin = pick === result;
        const win = isWin ? Math.floor(bet * 1.95) : 0;

        return {
            win: win,
            outcomeText:
                `🎲 ${DICE[d1 - 1]} ${DICE[d2 - 1]} ${DICE[d3 - 1]}` +
                ` = <b>${total}</b>\n` +
                `Kết quả: <b>${result === "tai" ? "TÀI 🔴" : "XỈU ⚪"}</b>`,
            detail: `${d1}+${d2}+${d3}=${total} ${result}`
        };
    }
});

/* Chơi nhanh 1 ván, xong gắn nút chơi lại ngay dưới kết quả */
async function playQuick(chatId, choice, bet) {
    bet = parseInt(bet);
    if (!await checkBet(chatId, bet)) return;

    const kb = replayKB(bet);
    const betLine = `💸 <b>${money(bet)} VNĐ</b> cửa ` +
        `<b>${choice === "tai" ? "TÀI 🔴" : "XỈU ⚪"}</b>`;
    const img = (rolls, shake, ctx) => boardOf(rolls, ctx);
    let played = null;
    try {
        played = await photoRoll(chatId,
            (r) => img(r, true,
                { dice: r, shake: true, hist: histOf(chatId), bet }), 3,
            [
                `${betLine}\n\n🎲 <b>Bỏ xúc xắc vào bát…</b>`,
                `${betLine}\n\n🎲 <b>Lắc mạnh… CLACK CLACK!</b>`,
                `${betLine}\n\n🥣 <b>Úp bát xuống bàn…</b>`,
                `${betLine}\n\n✨ <b>MỞ BÁT…</b>`
            ]);
    } catch {
        played = null;
    }

    const [d1, d2, d3] = played
        ? played.rolls
        : [0, 0, 0].map(() =>
            Math.floor(Math.random() * 6) + 1);
    const total = d1 + d2 + d3;
    const resultName = total >= 11 ? "tai" : "xiu";
    const isWin = choice === resultName;
    const win = isWin ? Math.floor(bet * 1.95) : 0;

    const newBalance = await settle(
        chatId, "taixiu", bet, win,
        `${d1}+${d2}+${d3}=${total} ${resultName}`
    );

    const text =
        `🎲 ${DICE[d1 - 1]} ${DICE[d2 - 1]} ${DICE[d3 - 1]}` +
        ` = <b>${total}</b>\n` +
        `Kết quả: <b>${resultName === "tai" ? "TÀI 🔴" : "XỈU ⚪"}</b>\n\n` +
        (isWin
            ? `🎉 THẮNG! Nhận về +${money(win)} VNĐ`
            : `💀 THUA! Mất ${money(bet)} VNĐ.`) +
        `\n💳 Còn: <b>${money(newBalance)} VNĐ</b>`;

    if (played) {
        await photoResult(chatId, played.messageId,
            taixiuBoardPng(resultOf(chatId, bet, [d1, d2, d3], win)),
            text, kb)
            .catch(() => send(chatId, text, { reply_markup: kb }));
        return;
    }

    await send(chatId, text, { reply_markup: kb });
}


module.exports = {
    commands: {
        "/taixiu": async (chatId, args) => {

            /* Không tham số → mở cổng đặt cược bấm nút */
            if (!args.length) {
                return portal.openPortal(chatId, "taixiu");
            }

            /* Chơi nhanh: /taixiu tai 50000 */
            const choice = (args[0] || "").toLowerCase();
            const bet = parseInt(args[1]);

            if (choice !== "tai" && choice !== "xiu") {
                await send(chatId, "Dùng: /taixiu tai|xiu <tiền>");
                return;
            }
            await playQuick(chatId, choice, bet);
        }
    },

    replay: playQuick,

    help:
        "━━━ 🎰 <b>CỔNG ĐẶT CỬ TÀI XỈU</b> ━━━\n" +
        "/taixiu — mở cổng cược <b>bấm nút</b>\n" +
        "/taixiu tai|xiu &lt;tiền&gt; — chơi nhanh\n"
};
