/* =========================
   MẠNG + MEDIA: ảnh, animation, web, nhạc bổ trợ
   Toàn API miễn phí, không key.
   /nhac (SoundCloud) đã có sẵn — thêm /lyric đi kèm.
 ========================= */

const core = require("./core");
const { send, telegram, esc } = core;

async function getJson(url, ms) {
    const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(ms || 10000)
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
}

const DICE = {
    xucxac: "🎲", phi: "🎯", bongro: "🏀",
    bongda: "⚽", bowling: "🎳", slot: "🎰"
};

async function translate(chatId, text, pair, usage) {
    if (!text) {
        await send(chatId, `Dùng: ${usage} &lt;nội dung&gt;`);
        return;
    }
    const d = await getJson(
        "https://api.mymemory.translated.net/get?q=" +
        encodeURIComponent(text) + "&langpair=" + pair, 12000);
    const out = d && d.responseData && d.responseData.translatedText;
    if (!out) throw new Error("Dịch thất bại");
    await send(chatId, `🌐 <b>${esc(out)}</b>`);
}

module.exports = {
    commands: {
        /* Animation có sẵn của Telegram (không tốn API ngoài) */
        "/roll": async (chatId, args) => {
            const emoji = DICE[(args[0] || "xucxac").toLowerCase()] || "🎲";
            await telegram("sendDice", { chat_id: chatId, emoji: emoji });
        },

        "/meme": async (chatId) => {
            const m = await getJson("https://meme-api.com/gimme");
            await telegram("sendPhoto", {
                chat_id: chatId,
                photo: m.url,
                caption: `${esc(m.title || "Meme")} (r/${esc(m.subreddit || "memes")})`,
                parse_mode: "HTML"
            });
        },

        "/cat": async (chatId) => {
            await telegram("sendPhoto", {
                chat_id: chatId,
                photo: "https://cataas.com/cat",
                caption: "🐱 Meow!"
            });
        },

        "/dog": async (chatId) => {
            const d = await getJson("https://dog.ceo/api/breeds/image/random");
            await telegram("sendPhoto", {
                chat_id: chatId,
                photo: d.message,
                caption: "🐶 Gâu!"
            });
        },

        "/short": async (chatId, args) => {
            const url = args[0] || "";
            if (!/^https?:\/\//i.test(url)) {
                await send(chatId, "Dùng: /short &lt;link http...&gt;");
                return;
            }
            const res = await fetch(
                "https://is.gd/create.php?format=simple&url=" +
                encodeURIComponent(url),
                { signal: AbortSignal.timeout(10000) });
            const short = (await res.text()).trim();
            if (!short.startsWith("https://")) throw new Error(short);
            await send(chatId, `🔗 Link rút gọn:\n<code>${esc(short)}</code>`);
        },

        "/shot": async (chatId, args) => {
            let url = args[0] || "";
            if (!url) {
                await send(chatId, "Dùng: /shot &lt;link website&gt;");
                return;
            }
            if (!/^https?:\/\//i.test(url)) url = "https://" + url;
            const wait = await send(chatId, "📸 Đang chụp website…");
            try {
                await telegram("sendPhoto", {
                    chat_id: chatId,
                    photo: "https://s0.wp.com/mshots/v1/" +
                        encodeURIComponent(url) + "?w=1280",
                    caption: `🌐 ${esc(url)}`
                });
            } finally {
                if (wait.result) telegram("deleteMessage", {
                    chat_id: chatId,
                    message_id: wait.result.message_id
                }).catch(() => {});
            }
        },

        "/wiki": async (chatId, args) => {
            const q = args.join(" ");
            if (!q) {
                await send(chatId, "Dùng: /wiki &lt;từ khóa&gt;");
                return;
            }
            const res = await fetch(
                "https://vi.wikipedia.org/api/rest_v1/page/summary/" +
                encodeURIComponent(q),
                {
                    headers: { "User-Agent": "Mozilla/5.0" },
                    signal: AbortSignal.timeout(10000)
                });
            if (res.status === 404) {
                await send(chatId, "😕 Không tìm thấy bài viết.");
                return;
            }
            if (!res.ok) throw new Error("HTTP " + res.status);
            const p = await res.json();
            const link = p.content_urls && p.content_urls.desktop
                ? p.content_urls.desktop.page : "";
            await send(chatId,
                `📖 <b>${esc(p.title || q)}</b>\n\n` +
                `${esc(p.extract || "Không có tóm tắt.")}` +
                (link ? `\n\n🔗 ${link}` : ""));
        },

        "/en": async (chatId, args) =>
            translate(chatId, args.join(" "), "vi|en", "/en"),

        "/vi": async (chatId, args) =>
            translate(chatId, args.join(" "), "en|vi", "/vi"),

        "/lyric": async (chatId, args) => {
            const q = args.join(" ");
            if (!q) {
                await send(chatId, "Dùng: /lyric &lt;tên bài hát&gt;");
                return;
            }
            const arr = await getJson(
                "https://lrclib.net/api/search?q=" + encodeURIComponent(q));
            const hit = (arr || []).find(t => t.plainLyrics) || {};
            if (!hit.plainLyrics) {
                await send(chatId, "😕 Không tìm thấy lời bài này.");
                return;
            }
            let text = `🎼 <b>${esc(hit.trackName || q)}</b> — ` +
                `${esc(hit.artistName || "Không rõ")}\n\n` +
                `${esc(hit.plainLyrics)}`;
            if (text.length > 3800) text = text.slice(0, 3800) + "\n… (bị cắt)";
            await send(chatId, text);
        }
    },

    help:
        "━━━ 🌐 <b>ẢNH & WEB</b> ━━━\n" +
        "/roll [xucxac|phi|bongro|bongda|bowling|slot] — animation\n" +
        "/meme — ảnh meme random\n" +
        "/cat — ảnh mèo random\n" +
        "/dog — ảnh chó random\n" +
        "/short &lt;link&gt; — rút gọn link\n" +
        "/shot &lt;link&gt; — chụp ảnh website bất kỳ\n" +
        "/wiki &lt;từ khóa&gt; — tóm tắt Wikipedia\n" +
        "/en &lt;text&gt; — dịch Việt→Anh\n" +
        "/vi &lt;text&gt; — dịch Anh→Việt\n" +
        "━━━ 🎼 <b>NHẠC BỔ TRỢ</b> ━━━\n" +
        "/lyric &lt;tên bài&gt; — tìm lời bài hát (/nhac để nghe)\n"
};
