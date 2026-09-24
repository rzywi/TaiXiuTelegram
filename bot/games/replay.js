/* =========================
   REPLAY — nút "chơi lại" dưới kết quả chơi nhanh.
   Cược cũ nhúng thẳng vào callback_data:
   again:<game>:<pick>:<bet> → sống sót sau restart,
   không cần RAM. Cổng cược: again:portal:<game>.
========================= */

const FILE_OF = {
    taixiu: "taixiu",
    xocdia: "xocdia",
    baucua: "baucua",
    coin: "coin",
    dice: "dice",
    slot: "slot",
    roulette: "roulette",
    hilo: "hilo",
    bj: "blackjack"
};

function btn(text, game, pick, bet) {
    return {
        text: text,
        callback_data: `again:${game}:${pick}:${bet}`
    };
}

function portalBtn(game) {
    return {
        text: "🎰 Cổng cược",
        callback_data: `again:portal:${game}`
    };
}

function menuBtn() {
    return {
        text: "📋 MENU",
        callback_data: "menu:cat:main"
    };
}

async function handleAgain(query) {
    const chatId = query.message.chat.id;
    const parts = (query.data || "").split(":");
    // again:portal:<game>
    if (parts[1] === "portal") {
        const portal = require("./portal");
        await portal.openPortal(chatId, parts[2]);
        return;
    }
    // again:<game>:<pick>:<bet>
    const game = parts[1];
    const pick = parts[2];
    const bet = parseInt(parts[3]);
    const file = FILE_OF[game];
    if (!file) return;
    try {
        const mod = require(`./${file}`);
        if (typeof mod.replay === "function") {
            await mod.replay(chatId, pick, bet);
        }
    } catch (e) {
        const core = require("../core");
        await core.send(chatId,
            "⚠️ Ván cũ hết hạn, gõ lệnh mới nhé.");
    }
}


module.exports = {
    btn,
    portalBtn,
    menuBtn,
    callback: {
        prefix: "again:",
        handler: handleAgain
    },
    help: ""
};
