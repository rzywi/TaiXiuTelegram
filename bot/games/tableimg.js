/* =========================
   TABLEIMG — vẽ board casino PNG thuần Node (zlib có sẵn).
   - baccaratPng: bàn xanh, CON vs CÁI, lá bài, điểm, THẮNG/THUA.
   - taixiuBoardPng: board tối neon, vòng xúc xắc, lịch sử, tiền, điểm.
   Chữ vẽ bằng font bitmap 5x7 (ASCII, không dấu) — caption giữ TV.
========================= */

const zlib = require("zlib");

/* ---------- PNG ENCODER ---------- */
const CRC_TABLE = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++)
            c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        t[n] = c;
    }
    return t;
})();
function crc32(buf) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++)
        c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
}
function pngEncode(w, h, rgb) {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0);
    ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8; ihdr[9] = 2;
    const raw = Buffer.alloc((w * 3 + 1) * h);
    let o = 0;
    for (let y = 0; y < h; y++) {
        raw[o++] = 0;
        rgb.copy(raw, o, y * w * 3, (y + 1) * w * 3);
        o += w * 3;
    }
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
        chunk("IHDR", ihdr),
        chunk("IDAT", zlib.deflateSync(raw, { level: 6 })),
        chunk("IEND", Buffer.alloc(0))
    ]);
}

/* ---------- CANVAS ---------- */
function newCanvas(w, h, bg) {
    const px = Buffer.alloc(w * h * 3);
    for (let i = 0; i < w * h; i++) {
        px[i * 3] = bg[0]; px[i * 3 + 1] = bg[1]; px[i * 3 + 2] = bg[2];
    }
    return px;
}
function setPx(px, W, x, y, c) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= W) return;
    const i = (y * W + x) * 3;
    if (i + 2 >= px.length) return;
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
}
function fillRect(px, W, x0, y0, w, h, c) {
    for (let y = y0; y < y0 + h; y++)
        for (let x = x0; x < x0 + w; x++) setPx(px, W, x, y, c);
}
function fillCircle(px, W, cx, cy, r, c) {
    for (let y = Math.floor(cy - r); y <= cy + r; y++)
        for (let x = Math.floor(cx - r); x <= cx + r; x++) {
            const dx = x - cx, dy = y - cy;
            if (dx * dx + dy * dy <= r * r) setPx(px, W, x, y, c);
        }
}
function ring(px, W, cx, cy, r, thick, c) {
    for (let y = Math.floor(cy - r - thick); y <= cy + r + thick; y++)
        for (let x = Math.floor(cx - r - thick); x <= cx + r + thick; x++) {
            const d = Math.hypot(x - cx, y - cy);
            if (Math.abs(d - r) <= thick / 2) setPx(px, W, x, y, c);
        }
}
function fillRoundedRect(px, W, x0, y0, w, h, rad, c) {
    for (let y = y0; y < y0 + h; y++)
        for (let x = x0; x < x0 + w; x++) {
            const cx = Math.max(x0 + rad, Math.min(x, x0 + w - rad));
            const cy = Math.max(y0 + rad, Math.min(y, y0 + h - rad));
            const dx = x - cx, dy = y - cy;
            if (dx * dx + dy * dy <= rad * rad) setPx(px, W, x, y, c);
        }
}
function fillTriangle(px, W, x1, y1, x2, y2, x3, y3, c) {
    const minX = Math.floor(Math.min(x1, x2, x3));
    const maxX = Math.ceil(Math.max(x1, x2, x3));
    const minY = Math.floor(Math.min(y1, y2, y3));
    const maxY = Math.ceil(Math.max(y1, y2, y3));
    const s = (ax, ay, bx, by, cx, cy) =>
        (ax - cx) * (by - cy) - (bx - cx) * (ay - cy);
    for (let y = minY; y <= maxY; y++)
        for (let x = minX; x <= maxX; x++) {
            const d1 = s(x, y, x1, y1, x2, y2);
            const d2 = s(x, y, x2, y2, x3, y3);
            const d3 = s(x, y, x3, y3, x1, y1);
            if (!((d1 < 0 || d2 < 0 || d3 < 0) &&
                (d1 > 0 || d2 > 0 || d3 > 0))) setPx(px, W, x, y, c);
        }
}
function vline(px, W, x, y0, y1, c) {
    for (let y = y0; y <= y1; y++) setPx(px, W, x, y, c);
}

/* ---------- FONT 5x7 ---------- */
const FONT = {
    A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
    C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
    D: ["11100", "10010", "10001", "10001", "10001", "10010", "11100"],
    E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
    F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
    G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
    H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
    I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
    J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
    K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
    L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
    N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
    O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
    Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
    R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
    S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
    T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
    U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
    V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
    W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
    X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
    Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
    Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
    0: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    1: ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
    2: ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
    3: ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
    4: ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
    5: ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
    6: ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
    7: ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
    8: ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
    9: ["01110", "10001", "10001", "01110", "00001", "00001", "01110"],
    "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
    "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
    ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
    ",": ["00000", "00000", "00000", "00000", "01100", "01100", "01000"],
    "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
    ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
    "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
    ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
    "?": ["01110", "10001", "00001", "00010", "00100", "00000", "00100"],
    " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"]
};
function textW(s, sc) { return String(s).length * 6 * sc - sc; }
/* chữ dài (tiền tỉ) → hạ cỡ chữ cho vừa maxW, không tràn khung */
function fitSc(s, sc, maxW) {
    s = String(s).toUpperCase();
    while (sc > 1 && textW(s, sc) > maxW) sc--;
    return sc;
}
function drawText(px, W, x, y, str, sc, color, align) {
    str = String(str).toUpperCase();
    let w = textW(str, sc);
    if (align === "c") x -= Math.floor(w / 2);
    if (align === "r") x -= w;
    for (let i = 0; i < str.length; i++) {
        const g = FONT[str[i]] || FONT[" "];
        for (let r = 0; r < 7; r++)
            for (let c = 0; c < 5; c++)
                if (g[r][c] === "1")
                    fillRect(px, W, x + i * 6 * sc + c * sc,
                        y + r * sc, sc, sc, color);
    }
}
function fmt(n) {
    const neg = Number(n) < 0 ? "-" : "";
    return neg + Math.abs(Math.round(Number(n))).toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
/* số tỉ tràn khung → rút gọn ASCII: 89,658,269,353 → 89.66B */
function fmtShort(n) {
    const a = Math.abs(Math.round(Number(n)));
    const sign = Number(n) < 0 ? "-" : "";
    const trim = (v) => {
        let s = v.toFixed(2);
        return s.replace(/\.?0+$/, "");
    };
    if (a >= 1e12) return sign + trim(a / 1e12) + "T";
    if (a >= 1e9) return sign + trim(a / 1e9) + "B";
    if (a >= 1e6) return sign + trim(a / 1e6) + "M";
    return fmt(n);
}

/* ---------- MÀU ---------- */
const GOLD = [212, 175, 55], GOLD_HI = [255, 214, 100];
const WHITE = [245, 245, 245], MUTED = [170, 195, 178];
const RED = [205, 40, 55], DARK = [10, 55, 42], DARK2 = [7, 38, 30];
const NEON = [255, 77, 109], PANEL = [26, 26, 34], BG_DARK = [13, 13, 19];
const GREEN = [45, 200, 120];

/* ---------- CHẤT BÀI ---------- */
function suitColor(s) {
    return (s === "H" || s === "D") ? [198, 30, 42] : [22, 22, 28];
}
function drawSuit(px, W, cx, cy, sz, suit, color) {
    if (suit === "D") {
        fillTriangle(px, W, cx, cy - sz, cx + sz * 0.7, cy,
            cx - sz * 0.7, cy, color);
        fillTriangle(px, W, cx, cy + sz, cx + sz * 0.7, cy,
            cx - sz * 0.7, cy, color);
    } else if (suit === "H") {
        fillCircle(px, W, cx - sz * 0.36, cy - sz * 0.22, sz * 0.42, color);
        fillCircle(px, W, cx + sz * 0.36, cy - sz * 0.22, sz * 0.42, color);
        fillTriangle(px, W, cx - sz * 0.72, cy + sz * 0.05,
            cx + sz * 0.72, cy + sz * 0.05, cx, cy + sz * 0.9, color);
    } else if (suit === "S") {
        fillTriangle(px, W, cx - sz * 0.72, cy + sz * 0.25,
            cx + sz * 0.72, cy + sz * 0.25, cx, cy - sz * 0.9, color);
        fillCircle(px, W, cx - sz * 0.34, cy + sz * 0.25, sz * 0.4, color);
        fillCircle(px, W, cx + sz * 0.34, cy + sz * 0.25, sz * 0.4, color);
        fillRect(px, W, Math.round(cx - sz * 0.12),
            Math.round(cy + sz * 0.4), Math.round(sz * 0.24),
            Math.round(sz * 0.5), color);
    } else {
        fillCircle(px, W, cx, cy - sz * 0.4, sz * 0.42, color);
        fillCircle(px, W, cx - sz * 0.4, cy + sz * 0.15, sz * 0.42, color);
        fillCircle(px, W, cx + sz * 0.4, cy + sz * 0.15, sz * 0.42, color);
        fillRect(px, W, Math.round(cx - sz * 0.12), Math.round(cy + sz * 0.2),
            Math.round(sz * 0.24), Math.round(sz * 0.6), color);
    }
}

/* vị trí pip cho lá số */
const PIPL = {
    1: [[.5, .5]],
    2: [[.35, .3], [.65, .7]],
    3: [[.35, .3], [.5, .5], [.65, .7]],
    4: [[.35, .3], [.65, .3], [.35, .7], [.65, .7]],
    5: [[.35, .3], [.65, .3], [.5, .5], [.35, .7], [.65, .7]],
    6: [[.35, .28], [.65, .28], [.35, .5], [.65, .5], [.35, .72], [.65, .72]],
    7: [[.35, .25], [.65, .25], [.5, .4], [.35, .55], [.65, .55],
        [.35, .78], [.65, .78]],
    8: [[.35, .25], [.65, .25], [.35, .42], [.65, .42],
        [.35, .6], [.65, .6], [.35, .78], [.65, .78]],
    9: [[.35, .25], [.65, .25], [.35, .42], [.65, .42], [.5, .52],
        [.35, .63], [.65, .63], [.35, .8], [.65, .8]],
    10: [[.35, .22], [.65, .22], [.35, .37], [.65, .37], [.35, .52],
         [.65, .52], [.35, .67], [.65, .67], [.35, .82], [.65, .82]]
};

function drawCard(px, W, x0, y0, w, h, card, faceDown) {
    fillRoundedRect(px, W, x0 + 5, y0 + 7, w, h, 18, [0, 0, 0]);
    fillRoundedRect(px, W, x0, y0, w, h, 18, [90, 90, 96]);
    fillRoundedRect(px, W, x0 + 4, y0 + 4, w - 8, h - 8, 15, WHITE);
    if (faceDown) {
        fillRoundedRect(px, W, x0 + 14, y0 + 14, w - 28, h - 28, 10,
            [150, 30, 48]);
        for (let yy = y0 + 30; yy < y0 + h - 20; yy += 26)
            for (let xx = x0 + 26; xx < x0 + w - 20; xx += 26)
                drawSuit(px, W, xx, yy, 6, "D", [212, 175, 55]);
        return;
    }
    const col = suitColor(card.suit);
    const rank = card.rankLabel;
    drawText(px, W, x0 + 14, y0 + 12, rank, 4, col, "l");
    drawSuit(px, W, x0 + 30, y0 + 66, 11, card.suit, col);
    const v = card.value;
    if (v >= 1 && v <= 10) {
        for (const [fx, fy] of PIPL[v])
            drawSuit(px, W, x0 + fx * w, y0 + 40 + fy * (h - 80),
                Math.round(w * 0.075), card.suit, col);
    } else {
        drawSuit(px, W, x0 + w / 2, y0 + h / 2, 30, card.suit, col);
    }
    drawText(px, W, x0 + w - 14, y0 + h - 66, rank, 4, col, "r");
}

function border(px, W, H, color, thick) {
    fillRect(px, W, 0, 0, W, thick, color);
    fillRect(px, W, 0, H - thick, W, thick, color);
    fillRect(px, W, 0, 0, thick, H, color);
    fillRect(px, W, W - thick, 0, thick, H, color);
}

/* card: { rank: 1-13, suit: 'H'|'D'|'S'|'C' } */
function cv(card) {
    const v = card.rank >= 10 ? 0 : card.rank; /* JQK=0, A=1 */
    const label = card.rank === 1 ? "A"
        : card.rank === 11 ? "J" : card.rank === 12 ? "Q"
        : card.rank === 13 ? "K" : String(card.rank);
    return { ...card, value: card.rank > 10 ? 11 : card.rank, bval: v,
        rankLabel: label };
}

/* ---------- BACCARAT ---------- */
function baccaratPng(o) {
    const W = 1280, H = 720;
    const px = newCanvas(W, H, DARK);
    border(px, W, H, RED, 10);
    drawText(px, W, W / 2, 34, "BACCARAT", 7, GOLD, "c");
    drawText(px, W, 320, 118, "CON", 9, GOLD, "c");
    drawText(px, W, 960, 118, "CAI", 9, GOLD, "c");
    vline(px, W, 640, 250, 620, [120, 90, 40]);

    const cw = 150, ch = 212, gap = 16, y = 246;
    const px0 = 50, bx0 = W - 50 - (cw * 3 + gap * 2);
    const hide = !!o.hide;
    const P = o.player.map(cv), B = o.banker.map(cv);
    for (let i = 0; i < 3; i++) {
        if (P[i]) drawCard(px, W, px0 + i * (cw + gap), y, cw, ch, P[i], hide);
        if (B[i]) drawCard(px, W, bx0 + i * (cw + gap), y, cw, ch, B[i], hide);
    }
    /* vòng VS */
    fillCircle(px, W, 640, 360, 30, [8, 25, 20]);
    ring(px, W, 640, 360, 30, 4, GOLD);
    drawText(px, W, 640, 342, "VS", 5, GOLD_HI, "c");

    if (!hide) {
        const pWin = o.winner === "con";
        const bWin = o.winner === "cai";
        const pCol = pWin ? GOLD_HI : WHITE;
        const bCol = bWin ? GOLD_HI : WHITE;
        drawText(px, W, 320, 492, String(o.pScore), 11, pCol, "c");
        drawText(px, W, 960, 492, String(o.bScore), 11, bCol, "c");
        drawText(px, W, 320, 580, "DIEM", 4, MUTED, "c");
        drawText(px, W, 960, 580, "DIEM", 4, MUTED, "c");
        pill(px, W, 320, 616, pWin, o.winner === "hoa" ? "HOA" :
            (pWin ? "THANG" : "THUA"));
        pill(px, W, 960, 616, bWin, o.winner === "hoa" ? "HOA" :
            (bWin ? "THANG" : "THUA"));
    } else {
        drawText(px, W, 320, 510, "?", 11, MUTED, "c");
        drawText(px, W, 960, 510, "?", 11, MUTED, "c");
    }
    return pngEncode(W, H, px);
}
function pill(px, W, cx, y, gold, text) {
    const w = 250, h = 58;
    if (gold) {
        fillRoundedRect(px, W, cx - w / 2 + 3, y + 4, w, h, 28,
            [0, 0, 0]);
        fillRoundedRect(px, W, cx - w / 2, y, w, h, 28, GOLD_HI);
        drawText(px, W, cx, y + 12, text, 5, [30, 25, 10], "c");
    } else {
        fillRoundedRect(px, W, cx - w / 2, y, w, h, 28, [24, 58, 48]);
        drawText(px, W, cx, y + 12, text, 5, MUTED, "c");
    }
}

/* ---------- XÚC XẮC MINI ---------- */
const PIPS = {
    1: [[.5, .5]], 2: [[.3, .3], [.7, .7]],
    3: [[.28, .28], [.5, .5], [.72, .72]],
    4: [[.3, .3], [.7, .3], [.3, .7], [.7, .7]],
    5: [[.28, .28], [.72, .28], [.5, .5], [.28, .72], [.72, .72]],
    6: [[.3, .27], [.7, .27], [.3, .5], [.7, .5], [.3, .73], [.7, .73]]
};
function miniDie(px, W, x0, y0, s, v, jx, jy) {
    x0 += jx || 0; y0 += jy || 0;
    fillRoundedRect(px, W, x0 + 4, y0 + 6, s, s, 20, [0, 0, 0]);
    fillRoundedRect(px, W, x0, y0, s, s, 20, WHITE);
    const red = v === 1 || v === 4;
    const col = red ? [205, 35, 45] : [25, 25, 30];
    for (const [fx, fy] of PIPS[v] || [])
        fillCircle(px, W, x0 + fx * s, y0 + fy * s,
            Math.max(4, Math.floor(s * 0.085)), col);
}

/* ---------- TÀI XỈU BOARD TỐI ---------- */
function taixiuBoardPng(o) {
    const W = 1280, H = 720;
    const px = newCanvas(W, H, BG_DARK);
    border(px, W, H, NEON, 8);
    /* nửa trái */
    fillCircle(px, W, 235, 245, 138, PANEL);
    ring(px, W, 235, 245, 138, 6, NEON);
    const d = o.dice;
    const j = o.shake ? () => Math.floor(Math.random() * 17) - 8 : () => 0;
    miniDie(px, W, 130, 150, 96, d[0], j(), j());
    miniDie(px, W, 250, 165, 96, d[1], j(), j());
    miniDie(px, W, 190, 265, 96, d[2], j(), j());
    drawText(px, W, 235, 418, "LICH SU", 4, [150, 160, 175], "c");
    const hist = (o.hist && o.hist.length ? o.hist : []).slice(-10);
    const n = Math.max(hist.length, 1);
    const dw = Math.min(46, 380 / 10);
    const x0 = 235 - ((10 - 1) * dw) / 2;
    for (let i = 0; i < 10; i++) {
        const h = hist[i - (10 - n)];
        const cx = x0 + i * dw, cy = 478;
        if (!h) {
            ring(px, W, cx, cy, 13, 3, [70, 70, 85]);
        } else if (h === "tai") {
            fillCircle(px, W, cx, cy, 14, WHITE);
        } else {
            fillCircle(px, W, cx, cy, 14, [30, 30, 38]);
            ring(px, W, cx, cy, 14, 3, WHITE);
        }
        if (i === 9) ring(px, W, cx, cy, 19, 3, NEON);
    }
    fillCircle(px, W, 120, 540, 13, WHITE);
    drawText(px, W, 142, 528, "TAI", 4, WHITE, "l");
    ring(px, W, 268, 540, 13, 3, WHITE);
    drawText(px, W, 290, 528, "XIU", 4, WHITE, "l");

    /* nửa phải */
    const X = 500;
    drawText(px, W, X, 52, "TAI XIU", 6, [150, 160, 175], "l");
    const win = !!o.isWin && !o.shake;
    const lose = o.shake ? false : !o.isWin && o.total !== undefined;
    const pillC = o.shake ? [60, 60, 75] : win ? GREEN : NEON;
    fillRoundedRect(px, W, X, 108, 430, 86, 42, pillC);
    drawText(px, W, X + 215, 132,
        o.shake ? "DANG LAC..." : win ? "BAN THANG" : "BAN THUA",
        6, WHITE, "c");
    const amtRaw = o.shake ? "..." :
        (win ? "+" + fmtShort(o.diff) : "-" + fmtShort(o.bet));
    const amtSc = fitSc(amtRaw, 11, W - X - 40);
    drawText(px, W, X, 218, amtRaw, amtSc, o.shake ? WHITE :
        win ? GREEN : NEON, "l");
    /* 2 hộp */
    box(px, W, X, 400, 400, 150, "TIEN", "CUOC", fmtShort(o.bet), WHITE);
    box(px, W, X + 424, 400, 316, 150, "TONG", "DIEM",
        o.shake ? "?" : String(o.total), o.shake ? WHITE : NEON);
    return pngEncode(W, H, px);
}
function box(px, W, x, y, w, h, l1, l2, val, vcol) {
    fillRoundedRect(px, W, x, y, w, h, 24, PANEL);
    drawText(px, W, x + 28, y + 26, l1, 4, [130, 140, 155], "l");
    drawText(px, W, x + 28, y + 58, l2, 4, [130, 140, 155], "l");
    const sc = fitSc(val, 6, w - 180);
    drawText(px, W, x + w - 24, y + 52, val, sc, vcol, "r");
}

module.exports = { baccaratPng, taixiuBoardPng };
