/* =========================
   GAME: BACCARAT (CON vs CAI)
   Cổng bấm nút + chơi nhanh. Ảnh board casino.
   Luật rút lá 3 rút gọn: CON <=5 rút, CAI <=5 rút.
   ponytail: chưa tableau đầy đủ CAI theo lá 3 CON, thêm khi cần.
========================= */

const core = require("../core");
const { send, money, settle, checkBet } = core;
const portal = require("./portal");
const { baccaratPng } = require("./tableimg");
const { photoRoll, photoResult } = require("./suspense");
const replay = require("./replay");

const SUITS = ["H", "D", "S", "C"];

function drawDeck() {
    const d = [];
    for (let r = 1; r <= 13; r++)
        for (const s of SUITS) d.push({ rank: r, suit: s });
    return d;
}
function take(deck) {
    return deck.splice(Math.floor(Math.random() * deck.length), 1)[0];
}
function score(hand) {
    return hand.reduce((t, c) =>
        t + (c.rank >= 10 ? 0 : c.rank), 0) % 10;
}
/* 1 ván: chia 2-2, rút gọn lá 3 */
function deal() {
    const deck = drawDeck();
    const player = [take(deck), take(deck)];
    const banker = [take(deck), take(deck)];
    if (score(player) <= 5) player.push(take(deck));
    if (score(banker) <= 5) banker.push(take(deck));
    const pScore = score(player), bScore = score(banker);
    const winner = pScore === bScore ? "hoa"
        : pScore > bScore ? "con" : "cai";
    return { player, banker, pScore, bScore, winner };
}
/* tiền nhận về (gốc+lãi): con/cai x1.95, hoa x8, hòa hoàn cược */
function payout(pick, bet, d) {
    if (pick === "hoa") return d.winner === "hoa" ? bet * 8 : 0;
    if (d.winner === "hoa") return bet;
    return d.winner === pick ? Math.floor(bet * 1.95) : 0;
}
function cardName(c) {
    const r = c.rank === 1 ? "A" : c.rank === 11 ? "J"
        : c.rank === 12 ? "Q" : c.rank === 13 ? "K" : String(c.rank);
    const s = { H: "♥", D: "♦", S: "♠", C: "♣" }[c.suit];
    return r + s;
}
function outcomeText(d) {
    const w = d.winner === "con" ? "CON thắng"
        : d.winner === "cai" ? "CÁI thắng" : "HÒA";
    return `🂡 CON: ${d.player.map(cardName).join(" ")} = <b>${d.pScore}</b>\n` +
        `🏦 CÁI: ${d.banker.map(cardName).join(" ")} = <b>${d.bScore}</b>\n` +
        `Kết quả: <b>${w}</b>`;
}

portal.register("baccarat", {
    title: "🂡 CỔNG BACCARAT — CON vs CÁI",
    rules: "CON/CAI x1.95 · HÒA x8 (đặt CON/CAI gặp HÒA hoàn cược)",
    diceCount: 2,
    roll: () => deal(),
    shakeCtx: (chatId, bet, pick, rolls) => ({ ...rolls, hide: true }),
    resultCtx: (chatId, bet, pick, rolls, r) =>
        r ? { ...rolls, hide: false } : { ...rolls, hide: true },
    imageFor: (rolls, shake, ctx) =>
        baccaratPng(ctx || { ...rolls, hide: !!shake }),
    playButtons: [
        [
            { text: "🔴 CON", callback_data: "pt:baccarat:play:con" },
            { text: "🔵 CÁI", callback_data: "pt:baccarat:play:cai" },
            { text: "🟢 HÒA", callback_data: "pt:baccarat:play:hoa" }
        ]
    ],
    play: (pick, bet, rolls) => {
        const win = payout(pick, bet, rolls);
        return {
            win,
            outcomeText: outcomeText(rolls),
            detail: `con ${rolls.pScore} vs cai ${rolls.bScore}`
        };
    }
});

function replayKB(bet) {
    return {
        inline_keyboard: [
            [
                replay.btn("🔴 CON lại", "baccarat", "con", bet),
                replay.btn("🔵 CÁI lại", "baccarat", "cai", bet),
                replay.btn("🟢 HÒA lại", "baccarat", "hoa", bet)
            ],
            [replay.portalBtn("baccarat")],
            [replay.menuBtn()]
        ]
    };
}

async function playQuick(chatId, pick, bet) {
    bet = parseInt(bet);
    if (!["con", "cai", "hoa"].includes(pick) ||
        !await checkBet(chatId, bet)) return;
    const kb = replayKB(bet);
    const d = deal();
    const betLine = `💸 <b>${money(bet)} VNĐ</b> cửa <b>${pick.toUpperCase()}</b>`;
    let played = null;
    try {
        played = await photoRoll(chatId,
            async () => baccaratPng({ ...d, hide: true }), 0,
            [
                `${betLine}\n\n🂡 <b>Chia bài…</b>`,
                `${betLine}\n\n🂡 <b>CON xem bài…</b>`,
                `${betLine}\n\n🏦 <b>CÁI xem bài…</b>`,
                `${betLine}\n\n✨ <b>MỞ BÀI…</b>`
            ]);
    } catch { played = null; }

    const win = payout(pick, bet, d);
    const newBalance = await settle(chatId, "baccarat", bet, win,
        `con ${d.pScore} vs cai ${d.bScore} ${d.winner}`);
    const text = outcomeText(d) + "\n\n" + (win > bet
        ? `🎉 THẮNG! Nhận về +${money(win)} VNĐ`
        : win === bet
            ? `🤝 HÒA — hoàn cược ${money(bet)} VNĐ.`
            : `💀 THUA! Mất ${money(bet)} VNĐ.`) +
        `\n💳 Còn: <b>${money(newBalance)} VNĐ</b>`;

    if (played) {
        await photoResult(chatId, played.messageId,
            baccaratPng({ ...d, hide: false }), text, kb)
            .catch(() => send(chatId, text, { reply_markup: kb }));
        return;
    }
    await send(chatId, text, { reply_markup: kb });
}

module.exports = {
    commands: {
        "/baccarat": async (chatId, args) => {
            if (!args.length) return portal.openPortal(chatId, "baccarat");
            await playQuick(chatId, (args[0] || "").toLowerCase(),
                parseInt(args[1]));
        }
    },
    replay: playQuick,
    help:
        "━━━ 🂡 <b>BACCARAT</b> ━━━\n" +
        "/baccarat — mở cổng CON/CÁI/HÒA\n" +
        "/baccarat con|cai|hoa &lt;tiền&gt; — chơi nhanh\n"
};
