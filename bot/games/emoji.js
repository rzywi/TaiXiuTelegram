/* =========================
   EMOJI CHUẨN NOTO (Google)
   Tải icon emoji độ phân giải cao về máy (cache đĩa),
   giải mã PNG → RGBA thô để ghép vào ảnh xúc xắc.
========================= */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const CACHE_DIR = path.join(__dirname, ".emoji-cache");

/* Mã unicode emoji (file emoji_u<code>.png của Noto).
   Bầu cua giữ nguyên; thêm bộ cho coin/slot/rps/roulette/bài. */
const CODES = {
    bau: "1f383",  /* 🎃 */
    cua: "1f980",  /* 🦀 */
    tom: "1f990",  /* 🦐 */
    ca: "1f41f",   /* 🐟 */
    ga: "1f413",   /* 🐓 */
    huou: "1f98c", /* 🦌 */

    ngua: "1f315",   /* 🌕 */
    sap: "1f311",    /* 🌑 */

    cherry: "1f352", /* 🍒 */
    lemon: "1f34b",  /* 🍋 */
    bell: "1f514",   /* 🔔 */
    star: "2b50",    /* ⭐ */
    gem: "1f48e",    /* 💎 */
    seven: "1f3b0",  /* 🎰 (thay 7️⃣ — keycap không có file riêng) */
    grapes: "1f347", /* 🍇 */
    melon: "1f349",  /* 🍉 */

    keo: "270c", /* ✌️ */
    bua: "1f44a", /* ✊ */
    bao: "270b",  /* ✋ */

    do: "1f534",   /* 🔴 */
    den: "26ab",   /* ⚫ */
    xanh: "1f7e2", /* 🟢 */

    back: "1f0cf",   /* 🃏 lưng bài */
    heart: "2764",   /* ❤️ */
    spade: "2660",   /* ♠️ */
    diamond: "2666", /* ♦️ */
    club: "2663"     /* ♣️ */
};

const URL_BASE =
    "https://raw.githubusercontent.com/googlefonts/noto-emoji/v2.047/png/128/";

const memory = {};


/* ---------- GIẢI MÃ PNG → RGBA (thuần Node) ---------- */

function decodePng(buf) {
    let o = 8; /* bỏ qua signature */
    let width = 0, height = 0, bitDepth = 0, colorType = 0;
    const idat = [];

    while (o + 8 <= buf.length) {
        const len = buf.readUInt32BE(o);
        const type = buf.toString("ascii", o + 4, o + 8);
        const data = buf.subarray(o + 8, o + 8 + len);

        if (type === "IHDR") {
            width = data.readUInt32BE(0);
            height = data.readUInt32BE(4);
            bitDepth = data[8];
            colorType = data[9];
        } else if (type === "IDAT") {
            idat.push(data);
        }
        o += 12 + len;
    }

    if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2)) {
        throw new Error("PNG không hỗ trợ: depth=" + bitDepth +
            " color=" + colorType);
    }

    const bpp = colorType === 6 ? 4 : 3;
    const raw = zlib.inflateSync(Buffer.concat(idat));
    const stride = width * bpp;
    const out = Buffer.alloc(width * height * 4);
    let prev = Buffer.alloc(stride);

    for (let y = 0; y < height; y++) {
        const rowStart = y * (stride + 1);
        const filter = raw[rowStart];
        const cur = Buffer.from(
            raw.subarray(rowStart + 1, rowStart + 1 + stride));

        for (let x = 0; x < stride; x++) {
            const a = x >= bpp ? cur[x - bpp] : 0;
            const b = prev[x];
            const c = x >= bpp ? prev[x - bpp] : 0;

            switch (filter) {
                case 1: cur[x] = (cur[x] + a) & 0xFF; break;
                case 2: cur[x] = (cur[x] + b) & 0xFF; break;
                case 3:
                    cur[x] = (cur[x] + ((a + b) >> 1)) & 0xFF;
                    break;
                case 4: {
                    const p = a + b - c;
                    const pa = Math.abs(p - a);
                    const pb = Math.abs(p - b);
                    const pc = Math.abs(p - c);
                    const pr =
                        (pa <= pb && pa <= pc) ? a
                            : (pb <= pc ? b : c);
                    cur[x] = (cur[x] + pr) & 0xFF;
                    break;
                }
            }
        }

        for (let x = 0; x < width; x++) {
            const si = x * bpp;
            const di = (y * width + x) * 4;
            out[di] = cur[si];
            out[di + 1] = cur[si + 1];
            out[di + 2] = cur[si + 2];
            out[di + 3] = bpp === 4 ? cur[si + 3] : 255;
        }

        prev = cur;
    }

    return { width: width, height: height, data: out };
}


/* ---------- TẢI + CACHE ---------- */

async function loadEmoji(key) {
    if (memory[key]) return memory[key];

    try {
        const file = path.join(CACHE_DIR, key + ".png");
        let buf;

        if (fs.existsSync(file)) {
            buf = fs.readFileSync(file);
        } else {
            const response = await fetch(
                URL_BASE + "emoji_u" + CODES[key] + ".png");
            if (!response.ok) return null;
            buf = Buffer.from(await response.arrayBuffer());
            fs.mkdirSync(CACHE_DIR, { recursive: true });
            fs.writeFileSync(file, buf);
        }

        const decoded = decodePng(buf);
        memory[key] = decoded;
        return decoded;

    } catch {
        return null;
    }
}

/* Tải trước 6 icon lúc bot khởi động để ván đầu không chờ */
async function prewarm() {
    await Promise.all(
        Object.keys(CODES).map(k => loadEmoji(k)));
}


module.exports = { loadEmoji, prewarm };
