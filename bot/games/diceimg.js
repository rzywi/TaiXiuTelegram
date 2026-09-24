/* =========================
   VẼ ẢNH XÚC XẮC / ĐĨA BẠC
   Tự render PNG thuần Node (zlib có sẵn) — không cần thư viện ngoài.
   Xuất ra một ảnh duy nhất, các viên xúc xắc xếp HÀNG NGANG.
========================= */

const zlib = require("zlib");
const { loadEmoji } = require("./emoji");

/* Ghép ảnh RGBA (emoji) lên canvas với alpha-blend */
function blendEmoji(px, W, em, cx, cy, target) {
    const scale = target / em.width;

    for (let ty = 0; ty < target; ty++) {
        for (let tx = 0; tx < target; tx++) {
            const sx = Math.min(em.width - 1,
                Math.floor(tx / scale));
            const sy = Math.min(em.height - 1,
                Math.floor(ty / scale));
            const si = (sy * em.width + sx) * 4;
            const alpha = em.data[si + 3] / 255;
            if (alpha === 0) continue;

            const dx = Math.round(cx - target / 2 + tx);
            const dy = Math.round(cy - target / 2 + ty);
            if (dx < 0 || dy < 0) continue;
            const di = (dy * W + dx) * 3;
            if (di + 2 >= px.length) continue;

            px[di] = Math.round(
                em.data[si] * alpha + px[di] * (1 - alpha));
            px[di + 1] = Math.round(
                em.data[si + 1] * alpha + px[di + 1] * (1 - alpha));
            px[di + 2] = Math.round(
                em.data[si + 2] * alpha + px[di + 2] * (1 - alpha));
        }
    }
}


/* ---------- PNG ENCODER ---------- */

const CRC_TABLE = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        }
        t[n] = c;
    }
    return t;
})();

function crc32(buf) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
        c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    }
    return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([
        Buffer.from(type, "ascii"), data
    ]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
}

function pngEncode(width, height, rgb) {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;   /* bit depth */
    ihdr[9] = 2;   /* truecolor RGB */

    const raw = Buffer.alloc((width * 3 + 1) * height);
    let o = 0;
    for (let y = 0; y < height; y++) {
        raw[o++] = 0; /* filter: none */
        rgb.copy(raw, o, y * width * 3, (y + 1) * width * 3);
        o += width * 3;
    }

    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
        chunk("IHDR", ihdr),
        chunk("IDAT", zlib.deflateSync(raw, { level: 6 })),
        chunk("IEND", Buffer.alloc(0))
    ]);
}


/* ---------- BỘ VẼ CƠ BẢN ---------- */

const FELT = [15, 81, 58];        /* nền nhung xanh bàn casino */
const FELT_SHADOW = [9, 52, 38];

function newCanvas(w, h) {
    const px = Buffer.alloc(w * h * 3);
    for (let i = 0; i < w * h; i++) {
        px[i * 3] = FELT[0];
        px[i * 3 + 1] = FELT[1];
        px[i * 3 + 2] = FELT[2];
    }
    return px;
}

function setPx(px, W, x, y, c) {
    if (x < 0 || y < 0 || x >= W) return;
    const i = (y * W + x) * 3;
    if (i + 2 >= px.length) return;
    px[i] = c[0];
    px[i + 1] = c[1];
    px[i + 2] = c[2];
}

function fillCircle(px, W, cx, cy, rad, color) {
    for (let y = Math.floor(cy - rad); y <= cy + rad; y++) {
        for (let x = Math.floor(cx - rad); x <= cx + rad; x++) {
            const dx = x - cx, dy = y - cy;
            if (dx * dx + dy * dy <= rad * rad) {
                setPx(px, W, x, y, color);
            }
        }
    }
}

function fillTriangle(px, W, x1, y1, x2, y2, x3, y3, color) {
    const minX = Math.floor(Math.min(x1, x2, x3));
    const maxX = Math.ceil(Math.max(x1, x2, x3));
    const minY = Math.floor(Math.min(y1, y2, y3));
    const maxY = Math.ceil(Math.max(y1, y2, y3));

    const sign = (ax, ay, bx, by, cx, cy) =>
        (ax - cx) * (by - cy) - (bx - cx) * (ay - cy);

    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            const d1 = sign(x, y, x1, y1, x2, y2);
            const d2 = sign(x, y, x2, y2, x3, y3);
            const d3 = sign(x, y, x3, y3, x1, y1);
            const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
            const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
            if (!(hasNeg && hasPos)) {
                setPx(px, W, x, y, color);
            }
        }
    }
}

function fillRoundedRect(px, W, x0, y0, w, h, rad, color) {
    for (let y = y0; y < y0 + h; y++) {
        for (let x = x0; x < x0 + w; x++) {
            const cx = Math.max(x0 + rad, Math.min(x, x0 + w - rad));
            const cy = Math.max(y0 + rad, Math.min(y, y0 + h - rad));
            const dx = x - cx, dy = y - cy;
            if (dx * dx + dy * dy <= rad * rad) {
                setPx(px, W, x, y, color);
            }
        }
    }
}


/* ---------- VẼ XÚC XẮC ---------- */

/* Vị trí pip chuẩn mặt 1-6 (theo tỉ lệ kích thước viên) */
const PIPS = {
    1: [[.5, .5]],
    2: [[.28, .28], [.72, .72]],
    3: [[.26, .26], [.5, .5], [.74, .74]],
    4: [[.28, .28], [.72, .28], [.28, .72], [.72, .72]],
    5: [[.26, .26], [.74, .26], [.5, .5], [.26, .74], [.74, .74]],
    6: [[.28, .25], [.72, .25], [.28, .5], [.72, .5], [.28, .75], [.72, .75]]
};

/* Mặt 1 và 4 pip đỏ kiểu xúc xắc Trung */
const RED_PIP_VALUES = [1, 4];

const FACE = [248, 246, 238]; /* màu mặt viên xắc (để "tẩy" shape) */

function drawDieBase(px, W, x0, y0, size) {
    /* bóng đổ */
    fillRoundedRect(px, W, x0 + 7, y0 + 9, size, size,
        Math.floor(size * 0.18), FELT_SHADOW);

    /* viền tối */
    fillRoundedRect(px, W, x0, y0, size, size,
        Math.floor(size * 0.18), [55, 55, 60]);

    /* thân trắng ngà */
    fillRoundedRect(px, W, x0 + 6, y0 + 6, size - 12, size - 12,
        Math.floor(size * 0.15), FACE);
}

function drawDie(px, W, x0, y0, size, value) {
    drawDieBase(px, W, x0, y0, size);

    /* pips */
    const pipRad = Math.floor(size * 0.095);
    const pipColor =
        RED_PIP_VALUES.includes(value)
            ? [205, 35, 35] : [30, 30, 34];

    for (const [fx, fy] of PIPS[value] || []) {
        fillCircle(px, W,
            x0 + fx * size, y0 + fy * size,
            pipRad, pipColor);
    }
}


/* ---------- ICON 6 CON BẦU CUA (vẽ tay bằng hình cơ bản) ---------- */

function drawAnimal(px, W, cx, cy, key) {

    if (key === "bau") {
        /* 🎃 quả bầu: thân cam + cuống xanh */
        fillCircle(px, W, cx, cy - 32, 8, [80, 150, 70]);
        fillCircle(px, W, cx, cy, 34, [235, 130, 20]);
        fillCircle(px, W, cx - 9, cy - 7, 19, [250, 165, 45]);
    }

    if (key === "cua") {
        /* 🦀 cua: càng + thân đỏ + mắt */
        fillCircle(px, W, cx - 30, cy - 20, 11, [215, 55, 45]);
        fillCircle(px, W, cx + 30, cy - 20, 11, [215, 55, 45]);
        fillCircle(px, W, cx - 18, cy - 10, 6, [215, 55, 45]);
        fillCircle(px, W, cx + 18, cy - 10, 6, [215, 55, 45]);
        fillCircle(px, W, cx, cy + 6, 28, [225, 60, 50]);
        fillCircle(px, W, cx - 10, cy - 4, 5, [255, 255, 255]);
        fillCircle(px, W, cx + 10, cy - 4, 5, [255, 255, 255]);
        fillCircle(px, W, cx - 10, cy - 4, 2, [20, 20, 20]);
        fillCircle(px, W, cx + 10, cy - 4, 2, [20, 20, 20]);
    }

    if (key === "tom") {
        /* 🦐 tôm: thân cong + đuôi quạt */
        fillCircle(px, W, cx + 2, cy + 4, 30, [240, 125, 60]);
        fillCircle(px, W, cx - 16, cy - 10, 23, FACE); /* tẩy thành cong */
        fillTriangle(px, W,
            cx + 26, cy + 8, cx + 46, cy, cx + 42, cy + 22,
            [240, 125, 60]);
        fillCircle(px, W, cx + 8, cy - 8, 3, [20, 20, 20]);
    }

    if (key === "ca") {
        /* 🐟 cá: thân xanh + đuôi tam giác + mắt */
        fillTriangle(px, W,
            cx + 20, cy, cx + 42, cy - 17, cx + 42, cy + 17,
            [55, 115, 190]);
        fillCircle(px, W, cx - 6, cy, 26, [65, 125, 200]);
        fillCircle(px, W, cx - 10, cy + 7, 15, [125, 175, 225]);
        fillCircle(px, W, cx - 20, cy - 7, 4, [15, 15, 15]);
    }

    if (key === "ga") {
        /* 🐓 gà: thân nâu + mào đỏ + mỏ vàng */
        fillTriangle(px, W,
            cx - 28, cy + 8, cx - 44, cy - 14, cx - 16, cy - 4,
            [140, 70, 30]);
        fillCircle(px, W, cx + 2, cy + 6, 24, [190, 100, 45]);
        fillCircle(px, W, cx + 14, cy - 20, 13, [190, 100, 45]);
        fillCircle(px, W, cx + 11, cy - 36, 6, [220, 40, 40]);
        fillCircle(px, W, cx + 19, cy - 33, 5, [220, 40, 40]);
        fillTriangle(px, W,
            cx + 24, cy - 23, cx + 37, cy - 18, cx + 24, cy - 13,
            [245, 180, 40]);
        fillCircle(px, W, cx + 22, cy - 9, 4, [220, 40, 40]);
        fillCircle(px, W, cx + 16, cy - 23, 3, [15, 15, 15]);
    }

    if (key === "huou") {
        /* 🦌 hươu: đầu nâu + tai + gạc nhánh */
        fillCircle(px, W, cx - 14, cy - 20, 4, [110, 70, 35]);
        fillCircle(px, W, cx - 21, cy - 29, 4, [110, 70, 35]);
        fillCircle(px, W, cx - 28, cy - 37, 4, [110, 70, 35]);
        fillCircle(px, W, cx + 14, cy - 20, 4, [110, 70, 35]);
        fillCircle(px, W, cx + 21, cy - 29, 4, [110, 70, 35]);
        fillCircle(px, W, cx + 28, cy - 37, 4, [110, 70, 35]);
        fillCircle(px, W, cx - 18, cy - 12, 7, [155, 100, 55]);
        fillCircle(px, W, cx + 18, cy - 12, 7, [155, 100, 55]);
        fillCircle(px, W, cx, cy + 2, 20, [155, 100, 55]);
        fillCircle(px, W, cx - 8, cy - 2, 3, [20, 20, 20]);
        fillCircle(px, W, cx + 8, cy - 2, 3, [20, 20, 20]);
        fillCircle(px, W, cx, cy + 12, 5, [90, 55, 25]);
    }
}


/* ---------- VẼ ĐĨA XÓC (tròn đỏ/trắng) ---------- */

function drawCoin(px, W, cx, cy, rad, isRed) {
    /* bóng đổ */
    fillCircle(px, W, cx + 5, cy + 7, rad, FELT_SHADOW);

    /* viền */
    fillCircle(px, W, cx, cy, rad,
        isRed ? [140, 18, 18] : [175, 175, 175]);

    /* thân */
    fillCircle(px, W, cx, cy, rad - 7,
        isRed ? [215, 45, 45] : [246, 244, 238]);

    /* vành trong cho có chiều sâu */
    fillCircle(px, W, cx, cy, Math.floor(rad * 0.62),
        isRed ? [235, 70, 60] : [255, 255, 255]);

    /* chấm giữa */
    fillCircle(px, W, cx, cy, Math.floor(rad * 0.12),
        isRed ? [150, 20, 20] : [120, 120, 120]);
}


/* ---------- RENDER HÀNG NGANG ---------- */

const ITEM = 180;   /* kích thước 1 viên/đĩa */
const GAP = 26;
const PAD = 34;
const H = ITEM + PAD * 2;

function rowWidth(n) {
    return PAD * 2 + n * ITEM + (n - 1) * GAP;
}

/* values: mảng 1-6 → ảnh các viên xúc xắc xếp ngang.
   shake = true → mỗi viên lệch vị trí ngẫu nhiên nhẹ,
   tạo cảm giác bát đang lắc dữ dội */
function diceRowPng(values, shake) {
    const W = rowWidth(values.length);
    const px = newCanvas(W, H);
    const J = shake ? 14 : 0;

    values.forEach((v, i) => {
        const jx = J ? Math.floor(Math.random() * J * 2) - J : 0;
        const jy = J ? Math.floor(Math.random() * J * 2) - J : 0;
        drawDie(px, W,
            PAD + i * (ITEM + GAP) + jx, PAD + jy, ITEM,
            Math.min(6, Math.max(1, v)));
    });

    return pngEncode(W, H, px);
}

/* reds: mảng true(đỏ)/false(trắng) → hàng đĩa xóc */
function coinsRowPng(reds, shake) {
    const W = rowWidth(reds.length);
    const px = newCanvas(W, H);
    const J = shake ? 12 : 0;

    reds.forEach((isRed, i) => {
        const jx = J ? Math.floor(Math.random() * J * 2) - J : 0;
        const jy = J ? Math.floor(Math.random() * J * 2) - J : 0;
        drawCoin(px, W,
            PAD + ITEM / 2 + i * (ITEM + GAP) + jx,
            PAD + ITEM / 2 + jy,
            Math.floor(ITEM / 2) - 6, isRed);
    });

    return pngEncode(W, H, px);
}

/* keys: mảng "bau"|"cua"|"tom"|"ca"|"ga"|"huou"
   → hàng viên xắc có EMOJI CHUẨN trên mặt (Noto Google).
   Tải emoji lỗi thì dùng hình vẽ tay dự phòng */
async function animalRowPng(keys, shake) {
    const W = rowWidth(keys.length);
    const px = newCanvas(W, H);
    const J = shake ? 14 : 0;

    const emojis = await Promise.all(keys.map(loadEmoji));

    keys.forEach((key, i) => {
        const jx = J ? Math.floor(Math.random() * J * 2) - J : 0;
        const jy = J ? Math.floor(Math.random() * J * 2) - J : 0;
        const x0 = PAD + i * (ITEM + GAP) + jx;
        const y0 = PAD + jy;

        drawDieBase(px, W, x0, y0, ITEM);

        const em = emojis[i];
        if (em) {
            /* ghép emoji với alpha-blend mượt */
            const target = Math.floor(ITEM * 0.68);
            blendEmoji(px, W, em,
                x0 + ITEM / 2, y0 + ITEM / 2, target);
        } else {
            drawAnimal(px, W,
                x0 + ITEM / 2, y0 + ITEM / 2, key);
        }
    });

    return pngEncode(W, H, px);
}


/* keys: mảng key emoji bất kỳ (ngua/sap/cherry/keo/do/back...)
   → hàng viên trắng có EMOJI CHUẨN giữa mặt.
   Tải lỗi → giữ mặt trắng trơn (vẫn lắc được). */
async function iconRowPng(keys, shake) {
    const W = rowWidth(keys.length);
    const px = newCanvas(W, H);
    const J = shake ? 14 : 0;

    const emojis = await Promise.all(keys.map(loadEmoji));

    keys.forEach((key, i) => {
        const jx = J ? Math.floor(Math.random() * J * 2) - J : 0;
        const jy = J ? Math.floor(Math.random() * J * 2) - J : 0;
        const x0 = PAD + i * (ITEM + GAP) + jx;
        const y0 = PAD + jy;

        drawDieBase(px, W, x0, y0, ITEM);

        const em = emojis[i];
        if (em) {
            const target = Math.floor(ITEM * 0.68);
            blendEmoji(px, W, em,
                x0 + ITEM / 2, y0 + ITEM / 2, target);
        }
    });

    return pngEncode(W, H, px);
}


module.exports = { diceRowPng, coinsRowPng, animalRowPng, iconRowPng };
