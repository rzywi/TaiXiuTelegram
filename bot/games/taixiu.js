/* =========================
   GAME: TÀI XỈU
   Cổng bấm nút + chơi nhanh bằng lệnh
========================= */

const core = require("../core");
const { send, telegram, money, settle, checkBet } = core;
const portal = require("./portal");
const { diceRowPng } = require("./diceimg");
const { photoRoll, photoResult } = require("./suspense");

const DICE = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

portal.register("taixiu", {
    title: "🎲 CỔNG ĐẶT CỬ TÀI XỈU",
    rules: "🔴 TÀI (11-18) · ⚪ XỈU (3-10) - x1,95",

    /* 3 xúc xắc — vẽ ảnh hàng ngang khi lắc và ra kết quả */
    diceCount: 3,

    /* Ảnh xúc xắc xếp hàng ngang (lúc lắc có rung, kết quả đứng yên) */
    imageFor: (rolls, shake) => diceRowPng(rolls, shake),

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
            if (!await checkBet(chatId, bet)) return;

            /* Animation lắc kiểu bàn thật: 1 ảnh, mặt đổi 4 khung,
               kết quả gieo SAU animation */
            const betLine = `💸 <b>${money(bet)} VNĐ</b> cửa ` +
                `<b>${choice === "tai" ? "TÀI 🔴" : "XỈU ⚪"}</b>`;
            let result;
            try {
                result = await photoRoll(chatId,
                    (r, s) => diceRowPng(r, s), 3,
                    [
                        `${betLine}\n\n🎲 <b>Bỏ xúc xắc vào bát…</b>`,
                        `${betLine}\n\n🎲 <b>Lắc mạnh… CLACK CLACK!</b>`,
                        `${betLine}\n\n🥣 <b>Úp bát xuống bàn…</b>`,
                        `${betLine}\n\n✨ <b>MỞ BÁT…</b>`
                    ]);
            } catch {
                result = null;
            }

            const [d1, d2, d3] = result
                ? result.rolls
                : [0, 0, 0].map(() =>
                    Math.floor(Math.random() * 6) + 1);
            const total = d1 + d2 + d3;
            const resultName = total >= 11 ? "tai" : "xiu";
            const isWin = choice === resultName;
            const win = isWin
                ? Math.floor(bet * 1.95) : 0;

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

            if (result) {
                await photoResult(chatId, result.messageId,
                    diceRowPng([d1, d2, d3]), text)
                    .catch(() => send(chatId, text));
                return;
            }

            await send(chatId, text);
        }
    },

    help:
        "━━━ 🎰 <b>CỔNG ĐẶT CỬ TÀI XỈU</b> ━━━\n" +
        "/taixiu — mở cổng cược <b>bấm nút</b>\n" +
        "/taixiu tai|xiu &lt;tiền&gt; — chơi nhanh\n"
};
