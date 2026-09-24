/* =========================
   VUI — kiểu bot FB/Mess: bói, hợp nhau, thính, joke, vận may.
   Toàn local random/hash, không API, không DB, không key.
========================= */

const core = require("./core");
const { send, esc } = core;

function hash(s) {
    let h = 0;
    for (const c of String(s)) h = (h * 31 + c.codePointAt(0)) >>> 0;
    return h;
}
function pick(arr, seed) {
    return arr[hash(seed) % arr.length];
}

const THINH = [
    "Anh có bản đồ không? Anh cứ lạc trong mắt em.",
    "Trời đổ mưa rồi, anh đổ em chưa?",
    "Em là wifi, anh tự động kết nối.",
    "Gọi anh là deadline, vì gặp anh tim em chạy gấp.",
    "Anh như tiền lẻ — thiếu là không chịu được.",
    "Ngoài trời 38 độ, lòng em 100 độ vì anh.",
    "Anh là trà sữa, thiếu anh em nhạt nhẽo.",
    "Cua anh khó như cua gái — nhưng em vẫn cua."
];

const JOKE = [
    "Tại sao cá không bao giờ cãi nhau? Vì nó im lặng như cá.",
    "Học dốt hóa: thầy hỏi sao điểm thấp, em bảo do phản ứng phụ.",
    "Vợ hỏi: anh yêu em bao nhiêu? Chồng: như wifi chùa — mất là tiếc.",
    "Sếp: sao đi trễ? Em: tại giấc mơ quá hay, không nỡ dậy.",
    "Ăn chay trường, trừ lúc thèm thịt.",
    "Tiền không mua được hạnh phúc, nhưng hết tiền thì chắc chắn buồn.",
    "Người yêu cũ như Windows update — cứ hiện về lúc không cần.",
    "Deadline dí như người yêu cũ đòi quà."
];

const BOI = [
    "Hôm nay hợp màu đỏ, kị màu tím than. Đánh đề tránh số 49.",
    "Quý nhân họ Nguyễn, tránh người họ Hứa (hứa lèo).",
    "Tài lộc mở lúc 14h, đừng ngủ trưa quá giờ.",
    "Tình duyên nở rộ, crush rep tin sau 3 tiếng.",
    "Không nên cho vay hôm nay, cho là mất.",
    "Hợp ăn lẩu, kị ăn chay một mình.",
    "Đi hướng Đông gặp may, hướng Tây gặp kẹt xe.",
    "Số may: 68 — đánh game nào cũng đỏ."
];

module.exports = {
    commands: {
        "/thinh": async (chatId) =>
            send(chatId, `💘 <b>${esc(pick(THINH, Date.now()))}</b>`),

        "/joke": async (chatId) =>
            send(chatId, `😂 ${esc(pick(JOKE, Date.now()))}`),

        "/luck": async (chatId) => {
            const day = new Date().toISOString().slice(0, 10);
            const pct = hash(chatId + day) % 101;
            const bar = "🟩".repeat(Math.round(pct / 10)) +
                "⬜".repeat(10 - Math.round(pct / 10));
            await send(chatId,
                `🍀 <b>VẬN MAY HÔM NAY: ${pct}%</b>\n${bar}\n` +
                (pct >= 80 ? "Đỏ lắm, all-in đi!" :
                 pct >= 50 ? "Bình bình, chơi nhỏ thôi." :
                 "Hơi đen, điểm danh /daily gỡ gạc."));
        },

        "/boi": async (chatId, args) => {
            const name = args.join(" ") || "bạn";
            await send(chatId,
                `🔮 <b>BÓI VUI CHO ${esc(name.toUpperCase())}</b>\n\n` +
                `${esc(pick(BOI, name + new Date().toISOString().slice(0, 10)))}`);
        },

        "/hop": async (chatId, args) => {
            const [a, b] = args.join(" ").split(/[|,]/)
                .map(s => s.trim()).filter(Boolean);
            if (!a || !b) {
                await send(chatId,
                    "Dùng: /hop &lt;tên1&gt; | &lt;tên2&gt;");
                return;
            }
            const pct = hash(a.toLowerCase() + "|" + b.toLowerCase()) % 101;
            await send(chatId,
                `💞 <b>${esc(a)} ❤ ${esc(b)}</b>\n` +
                `Độ hợp nhau: <b>${pct}%</b> ` +
                (pct >= 80 ? "— cưới luôn!" :
                 pct >= 50 ? "— tìm hiểu thêm đi." : "— làm bạn thôi."));
        }
    },

    help:
        "━━━ 🎉 <b>VUI (KIỂU BOT FB)</b> ━━━\n" +
        "/thinh — câu thả thính random\n" +
        "/joke — truyện cười\n" +
        "/luck — vận may hôm nay\n" +
        "/boi &lt;tên&gt; — bói vui mỗi ngày\n" +
        "/hop &lt;tên1&gt; | &lt;tên2&gt; — chấm độ hợp nhau\n"
};
