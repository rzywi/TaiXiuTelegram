/* =========================
   GAME: TÀI XỈU
   Cổng bấm nút + chơi nhanh bằng lệnh
========================= */

const core = require("../core");
const { send, money, settle, checkBet } = core;
const portal = require("./portal");
const { diceRowPng } = require("./diceimg");

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

            const [d1, d2, d3] = [0, 0, 0].map(() =>
                Math.floor(Math.random() * 6) + 1);
            const total = d1 + d2 + d3;
            const result = total >= 11 ? "tai" : "xiu";
            const isWin = choice === result;
            const win = isWin
                ? Math.floor(bet * 1.95) : 0;

            const newBalance = await settle(
                chatId, "taixiu", bet, win,
                `${d1}+${d2}+${d3}=${total} ${result}`
            );

            await send(chatId,
                `🎲 ${DICE[d1 - 1]} ${DICE[d2 - 1]} ${DICE[d3 - 1]}` +
                ` = <b>${total}</b>\n` +
                `Kết quả: <b>${result === "tai" ? "TÀI 🔴" : "XỈU ⚪"}</b>\n\n` +
                (isWin
                    ? `🎉 THẮNG! Nhận về +${money(win)} VNĐ`
                    : `💀 THUA! Mất ${money(bet)} VNĐ.`) +
                `\n💳 Còn: <b>${money(newBalance)} VNĐ</b>`);
        }
    },

    help:
        "━━━ 🎰 <b>CỔNG ĐẶT CỬ TÀI XỈU</b> ━━━\n" +
        "/taixiu — mở cổng cược <b>bấm nút</b>\n" +
        "/taixiu tai|xiu &lt;tiền&gt; — chơi nhanh\n"
};
