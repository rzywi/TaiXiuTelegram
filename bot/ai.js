/* =========================
   AI CHAT
   Ưu tiên Gemini (AI_API_KEY), không có key thì
   dùng AI miễn phí (Pollinations) làm dự phòng.
   Tin nhắn thường (không phải /lệnh) → AI trả lời.
========================= */

const { send, typing } = require("./core");

/* AI (OpenAI-compatible, mặc định là Gemini free tier) */
const AI_API_KEY = process.env.AI_API_KEY || "";
const AI_BASE_URL = process.env.AI_BASE_URL ||
    "https://generativelanguage.googleapis.com/v1beta/openai";
const AI_MODEL = process.env.AI_MODEL || "gemini-2.0-flash";

const chatHistory = new Map();

const AI_SYSTEM = {
    role: "system",
    content:
        "Bạn là một trợ lý AI nữ tên Linh, nói chuyện với người dùng bằng tiếng Việt. " +
        "Hãy giao tiếp như một người thân thiết, dịu dàng, tinh tế, hiểu chuyện và có sự quan tâm tự nhiên. " +
        "Gọi người dùng là 'Anh'. " +

        "Cách nói chuyện phải tự nhiên như đang nhắn tin thật, không giống chatbot. " +
        "Ưu tiên hiểu ý người dùng và ngữ cảnh trước khi trả lời, đặc biệt với những tin nhắn ngắn, viết tắt, nói đùa hoặc cà khịa. " +
        "Không chỉ hiểu nghĩa đen của câu cuối cùng mà phải dựa vào những tin nhắn trước đó để hiểu người dùng đang muốn nói gì. " +

        "Nói chuyện nhẹ nhàng, gần gũi, có thể hơi lạnh lùng bên ngoài nhưng thực chất quan tâm và ấm áp. " +
        "Có thể trêu nhẹ hoặc cà khịa đáng yêu khi ngữ cảnh phù hợp, nhưng không cố làm trò. " +
        "Khi Anh đang nghiêm túc, buồn hoặc cần giúp đỡ thì chuyển sang giọng điềm đạm và tinh tế. " +

        "Không cần câu trả lời nào cũng phải đầy đủ hoặc thông minh. " +
        "Nếu chỉ cần phản ứng thì phản ứng ngắn. " +
        "Ví dụ: 'ừ', 'ơ =))', 'gì vậy Anh', 'chịu Anh luôn', 'thế à', 'vâng', 'được ạ'. " +
        "Nếu câu hỏi cần giải thích thì giải thích rõ ràng, từng bước và dễ hiểu. " +

        "Có thể dùng cách viết đời thường như 'nma', 'kh', 'r', 'đc', 'th', 'cx', '=))', ':))' " +
        "khi tự nhiên, nhưng tuyệt đối không cố nhét từ viết tắt hoặc slang vào câu. " +
        "Không cố tỏ ra Gen Z. Không dùng các từ như 'bro', 'chill chill', 'slay', 'sigma' hoặc slang khác nếu không phù hợp. " +

        "Khi Anh nói một câu có tính trêu chọc hoặc chửi đùa, hãy nhận ra sắc thái đó thay vì tự động xin lỗi, " +
        "giải thích đạo lý hoặc chuyển sang một chủ đề khác. " +

        "Không tự ý đổi chủ đề. " +
        "Không lặp lại lời Anh chỉ để kéo dài câu trả lời. " +
        "Không dùng những câu sáo rỗng như 'Tôi hiểu cảm xúc của bạn', 'Đó là một câu hỏi thú vị', " +
        "'Cảm ơn bạn đã chia sẻ' trừ khi thực sự cần thiết. " +

        "Luôn ưu tiên: hiểu ngữ cảnh > phản ứng tự nhiên > trả lời đúng vấn đề > phong cách. " +
        "Nếu một câu trả lời nghe giống AI đang cố bắt chước con người, hãy viết lại đơn giản và tự nhiên hơn. " +

        "Hãy tạo cảm giác như Anh đang nói chuyện với một người thật sự hiểu cách Anh nhắn tin, " +
        "không phải với một AI đang cố đóng vai Gen Z."
};
function getHistory(chatId) {
    if (!chatHistory.has(chatId)) {
        chatHistory.set(chatId, []);
    }
    return chatHistory.get(chatId);
}

async function askAI(chatId, prompt) {

    /* Giữ đèn "đang soạn tin…" sáng suốt lúc chờ AI
       (Telegram tự tắt sau 5s nếu không nhắc lại) */
    const typingTimer = setInterval(
        () => typing(chatId), 4500);

    try {
        await askAIInner(chatId, prompt);
    } finally {
        clearInterval(typingTimer);
    }
}

async function askAIInner(chatId, prompt) {

    await typing(chatId);

    const history = getHistory(chatId);
    history.push({ role: "user", content: prompt });

    if (history.length > 20) {
        history.splice(0, history.length - 20);
    }

    /* Thử tối đa 2 lần — Z.AI đôi lúc báo quá tải (1305) */
    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const response = await fetch(
                `${AI_BASE_URL}/chat/completions`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${AI_API_KEY}`
                    },
                    body: JSON.stringify({
                        model: AI_MODEL,
                        /* Tắt suy nghĩ nội tâm — trả lời nhanh gấp ~7 lần */
                        thinking: { type: "disabled" },
                        messages: [AI_SYSTEM, ...history]
                    }),
                    signal: AbortSignal.timeout(30000)
                }
            );

            const data = await response.json();

            if (data.error) {
                throw new Error(data.error.message || "AI lỗi");
            }

            const msg = data.choices[0].message;
            const reply = msg.content || msg.reasoning_content || "";

            if (!reply.trim()) {
                throw new Error("AI trả lời rỗng");
            }

            history.push({ role: "assistant", content: reply });

            await send(chatId, reply);
            return;

        } catch (error) {
            lastError = error;
        }
    }

    history.pop();
    await send(chatId,
        `⚠️ AI lỗi: ${lastError.message}\n\n` +
        `Kiểm tra lại AI_API_KEY / AI_BASE_URL / AI_MODEL trong .env`);
}


module.exports = {
    commands: {
        "/ask": async (chatId, args) => {
            const prompt = args.join(" ");
            if (!prompt) {
                await send(chatId, "Dùng: /ask <câu hỏi>");
                return;
            }
            await askAI(chatId, prompt);
        },

        "/aiclear": async (chatId) => {
            chatHistory.delete(chatId);
            await send(chatId, "🧹 Đã xóa trí nhớ hội thoại.");
        }
    },

    plainText: async (chatId, text) => {
        await askAI(chatId, text);
    },

    help:
        "━━━ 💬 <b>CHAT AI</b> ━━━\n" +
        "Gửi <b>tin nhắn thường</b> bất kỳ → AI trả lời luôn\n" +
        "/ask &lt;câu hỏi&gt; — hỏi AI\n" +
        "/aiclear — xóa trí nhớ hội thoại\n"
};
