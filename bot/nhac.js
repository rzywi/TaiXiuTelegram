/* =========================
   PHÁT NHẠC SOUNDCLOUD
   /nhac <tên bài> → tìm 5 kết quả (bấm nút chọn)
   → tải mp3 128kbps → gửi về chat nghe ngay.

   Không cần API key: tự lấy client_id từ trang web
   SoundCloud (họ nhúng sẵn trong code js của trang).
========================= */

const core = require("./core");
const { send, telegram, telegramForm, answerCb, fmt } = core;

/* chatId -> mảng kết quả tìm kiếm gần nhất */
const searchCache = new Map();

/* ---------- LẤY CLIENT_ID ---------- */

let cachedClientId = null;

async function getClientId() {
    if (cachedClientId) return cachedClientId;

    const UA = { headers: { "User-Agent": "Mozilla/5.0" } };
    const html = await (await fetch("https://soundcloud.com/", UA)).text();
    const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)]
        .map(m => m[1]);

    for (const s of scripts) {
        try {
            const url = s.startsWith("http") ? s : "https://soundcloud.com" + s;
            const js = await (await fetch(url, UA)).text();
            const m = js.match(/client_id\s*[:=]\s*"([a-zA-Z0-9]{20,40})"/);
            if (m) {
                cachedClientId = m[1];
                return cachedClientId;
            }
        } catch { /* bỏ qua script lỗi */ }
    }

    throw new Error("Không lấy được client_id từ SoundCloud");
}

/* ---------- TÌM BÀI HÁT ---------- */

async function searchTracks(query) {
    const clientId = await getClientId();
    const UA = { headers: { "User-Agent": "Mozilla/5.0" } };

    const url =
        "https://api-v2.soundcloud.com/search/tracks?q=" +
        encodeURIComponent(query) +
        "&limit=10&client_id=" + clientId;

    const data = await (await fetch(url, UA)).json();

    if (!data.collection) {
        /* client_id hết hạn → lấy lại 1 lần */
        cachedClientId = null;
        const retryId = await getClientId();
        const retry = await (await fetch(
            url.replace(clientId, retryId), UA)).json();
        if (!retry.collection) {
            throw new Error("Tìm kiếm thất bại");
        }
        return pickPlayable(retry.collection);
    }

    return pickPlayable(data.collection);
}

/* Chỉ giữ bài phát được + có mp3 progressive (bỏ HLS-only) */
function pickPlayable(collection) {
    const out = [];

    for (const t of collection) {
        if (!t.media || !t.media.transcodings) continue;
        if (!t.policy || t.policy === "BLOCK") continue;

        const progressive =
            t.media.transcodings.find(
                x => x.format && x.format.protocol === "progressive");
        if (!progressive) continue;

        out.push({
            title: t.title,
            artist: t.user ? t.user.username : "Không rõ",
            duration: Math.round(t.duration / 1000),
            permalink: t.permalink_url,
            streamUrl: progressive.url,
            artwork: (t.artwork_url || "").replace("large", "t500x500") || null
        });

        if (out.length >= 5) break;
    }

    return out;
}

/* ---------- LẤY LINK MP3 + TẢI VỀ ---------- */

async function getMp3(track) {
    const clientId = await getClientId();
    const UA = { headers: { "User-Agent": "Mozilla/5.0" } };

    const media = await (await fetch(
        track.streamUrl + "?client_id=" + clientId, UA)).json();

    if (!media.url) {
        throw new Error("Không lấy được link mp3");
    }

    const response = await fetch(media.url, UA);
    const buf = Buffer.from(await response.arrayBuffer());

    if (buf.length > 45 * 1024 * 1024) {
        throw new Error("File quá lớn (>45MB), Telegram không cho gửi");
    }

    return buf;
}


/* ---------- LỆNH & NÚT BẤM ---------- */

function formatDuration(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m + ":" + String(s).padStart(2, "0");
}

async function doSearch(chatId, query) {
    const results = await searchTracks(query);

    if (!results.length) {
        await send(chatId, "😕 Không tìm thấy bài nào phát được.");
        return;
    }

    searchCache.set(chatId, results);

    await send(chatId,
        `🎵 <b>KẾT QUẢ CHO:</b> ${query}\n\n` +
        results.map((t, i) =>
            `<b>${i + 1}.</b> ${t.title}\n` +
            `   👤 ${t.artist} · ⏱ ${formatDuration(t.duration)}`)
            .join("\n") +
        `\n\n👇 Bấm số để nghe`,
        {
            reply_markup: {
                inline_keyboard: [
                    results.map((t, i) => ({
                        text: String(i + 1),
                        callback_data: `nhac:play:${i}`
                    })),
                    [{ text: "🔄 Tìm lại", callback_data: `nhac:replay` }]
                ]
            }
        });
}

async function playTrack(chatId, index) {
    const results = searchCache.get(chatId);
    const track = results && results[index];

    if (!track) {
        await send(chatId, "⏳ Danh sách đã cũ, gõ /nhac <tên bài> để tìm lại.");
        return;
    }

    const loading = await send(chatId,
        `⏳ Đang tải <b>${track.title}</b>…`);

    try {
        const mp3 = await getMp3(track);

        /* Xóa tin "đang tải" */
        if (loading.result) {
            telegram("deleteMessage", {
                chat_id: chatId,
                message_id: loading.result.message_id
            }).catch(() => {});
        }

        const form = new FormData();
        form.append("chat_id", String(chatId));
        form.append("audio",
            new Blob([mp3], { type: "audio/mpeg" }),
            "nhac.mp3");
        form.append("title", track.title);
        form.append("performer", track.artist);
        form.append("duration", String(track.duration));
        form.append("caption",
            `🎵 ${track.title}\n👤 ${track.artist}\n🔗 ${track.permalink}`);

        const sent = await telegramForm("sendAudio", form);

        if (!sent.ok) {
            throw new Error(
                sent.description || "Gửi audio thất bại");
        }

    } catch (error) {
        if (loading.result) {
            telegram("editMessageText", {
                chat_id: chatId,
                message_id: loading.result.message_id,
                text: `⚠️ Lỗi tải nhạc: ${error.message}`
            }).catch(() => {});
        }
    }
}


module.exports = {
    commands: {
        "/nhac": async (chatId, args) => {
            const query = args.join(" ");
            if (!query) {
                await send(chatId,
                    "🎵 Dùng: /nhac <tên bài hát>\n" +
                    "Ví dụ: /nhac hoa hai duong remix");
                return;
            }
            await doSearch(chatId, query);
        }
    },

    callback: {
        prefix: "nhac:",
        handler: async (query) => {
            const chatId = query.message.chat.id;
            const parts = query.data.split(":");

            if (parts[1] === "play") {
                return playTrack(chatId, parseInt(parts[2]));
            }

            /* Nút "🔄 Tìm lại" cũ (nhac:replay) → hỏi tên bài mới */
            if (parts[1] === "replay") {
                return require("./menu").startAsk(chatId, "nhac");
            }
        }
    },

    help:
        "━━━ 🎵 <b>NHẠC SOUNDCLOUD</b> ━━━\n" +
        "/nhac &lt;tên bài&gt; — tìm nhạc (bấm số để nghe)\n" +
        "Bot tải mp3 gửi thẳng vào chat, nghe offline được\n"
};
