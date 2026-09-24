/* =========================
   GAME: XÌ DÁCH (BLACKJACK) — có nút Rút/Dừng
========================= */

const core = require("../core");
const { send, telegram, money, settle, checkBet } = core;

const bjSessions = new Map();

const RANKS = [
    ["A", 11], ["2", 2], ["3", 3], ["4", 4], ["5", 5],
    ["6", 6], ["7", 7], ["8", 8], ["9", 9], ["10", 10],
    ["J", 10], ["Q", 10], ["K", 10]
];

const SUITS = ["♠️", "♥️", "♦️", "♣️"];

function drawCard(deck) {
    const i = Math.floor(Math.random() * deck.length);
    return deck.splice(i, 1)[0];
}

function handValue(cards) {
    let total = 0;
    let aces = 0;

    for (const card of cards) {
        total += card.value;
        if (card.rank === "A") {
            aces++;
        }
    }

    while (total > 21 && aces > 0) {
        total -= 10;
        aces--;
    }

    return total;
}

function cardStr(card) {
    return `${card.rank}${card.suit}`;
}

function bjTableText(session, reveal) {
    const dealerCards = session.dealer.map(cardStr);
    const playerCards = session.player.map(cardStr);

    const dealerShow = reveal
        ? dealerCards.join(" ") +
          ` = <b>${handValue(session.dealer)}</b>`
        : dealerCards[0] + " ❓";

    return (
        `🃏 <b>XÌ DÁCH</b> — cược ${money(session.bet)} VNĐ\n\n` +
        `🏦 Nhà cái: ${dealerShow}\n` +
        `👤 Bạn: ${playerCards.join(" ")} ` +
        `= <b>${handValue(session.player)}</b>`
    );
}

function bjButtons() {
    return {
        inline_keyboard: [[
            { text: "🃏 RÚT", callback_data: "bj_hit" },
            { text: "✋ DỪNG", callback_data: "bj_stand" }
        ]]
    };
}

async function bjStart(chatId, bet) {
    if (bjSessions.has(chatId)) {
        const old = bjSessions.get(chatId);
        if (Date.now() - old.started < 180000) {
            await send(chatId,
                "⏳ Ván trước chưa xong! Nhấn Rút/Dừng ở tin nhắn cũ.");
            return;
        }
        bjSessions.delete(chatId);
    }

    const deck = [];
    for (const [rank, value] of RANKS) {
        for (const suit of SUITS) {
            deck.push({ rank, value, suit });
        }
    }

    const session = {
        started: Date.now(),
        bet: bet,
        deck: deck,
        player: [drawCard(deck), drawCard(deck)],
        dealer: [drawCard(deck), drawCard(deck)]
    };

    bjSessions.set(chatId, session);

    /* Xì bàng ngay từ đầu */
    if (handValue(session.player) === 21) {
        await bjFinish(chatId, "blackjack");
        return;
    }

    const sent = await send(chatId,
        bjTableText(session, false), bjButtons());

    session.messageId = sent.result.message_id;
}

async function bjHit(chatId) {
    const session = bjSessions.get(chatId);
    if (!session) {
        await send(chatId,
            "⏳ Ván xì dách cũ hết hạn (bot mới restart). Gõ /menu → Xì Dách chơi ván mới nhé.");
        return;
    }

    session.player.push(drawCard(session.deck));
    const total = handValue(session.player);

    if (total > 21) {
        await bjFinish(chatId, "bust");
        return;
    }

    if (total === 21) {
        await bjFinish(chatId, "player21");
        return;
    }

    telegram("editMessageText", {
        chat_id: chatId,
        message_id: session.messageId,
        text: bjTableText(session, false),
        parse_mode: "HTML",
        reply_markup: bjButtons()
    }).catch(() => {});
}

async function bjStand(chatId) {
    const session = bjSessions.get(chatId);
    if (!session) {
        await send(chatId,
            "⏳ Ván xì dách cũ hết hạn (bot mới restart). Gõ /menu → Xì Dách chơi ván mới nhé.");
        return;
    }

    while (handValue(session.dealer) < 17) {
        session.dealer.push(drawCard(session.deck));
    }

    const dealerTotal = handValue(session.dealer);
    const playerTotal = handValue(session.player);

    let outcome;
    if (dealerTotal > 21) {
        outcome = "dealerbust";
    } else if (playerTotal > dealerTotal) {
        outcome = "win";
    } else if (playerTotal === dealerTotal) {
        outcome = "push";
    } else {
        outcome = "lose";
    }

    await bjFinish(chatId, outcome);
}

async function bjFinish(chatId, outcome) {
    const session = bjSessions.get(chatId);
    bjSessions.delete(chatId);

    let win = 0;
    let resultText = "";

    switch (outcome) {
        case "blackjack":
            win = Math.floor(session.bet * 2.5);
            resultText = "🂡 XÌ BÀNG! ĂN x2.5! 🎉";
            break;
        case "bust":
            resultText = "💥 Quá 21 điểm — QUẮC!";
            break;
        case "player21":
        case "win":
            win = session.bet * 2;
            resultText = "🎉 Bạn THẮNG!";
            break;
        case "dealerbust":
            win = session.bet * 2;
            resultText = "🏦 Nhà cái quắc — bạn THẮNG!";
            break;
        case "push":
            win = session.bet;
            resultText = "🤝 Hòa — hoàn cược.";
            break;
        case "lose":
            resultText = "💀 Nhà cái thắng.";
            break;
    }

    const newBalance = await settle(
        chatId, "xidach", session.bet, win,
        `${handValue(session.player)} vs ${handValue(session.dealer)}`
    );

    telegram("editMessageText", {
        chat_id: chatId,
        message_id: session.messageId,
        text:
            bjTableText(session, true) +
            `\n\n${resultText}` +
            `\n💳 Còn: <b>${money(newBalance)} VNĐ</b>`,
        parse_mode: "HTML",
        reply_markup: {
            inline_keyboard: [
                [{
                    text: "🃏 Ván mới cùng cược",
                    callback_data: `again:bj:go:${session.bet}`
                }],
                [{
                    text: "📋 MENU",
                    callback_data: "menu:cat:main"
                }]
            ]
        }
    }).catch(async () => {
        /* Nếu edit lỗi (tin nhắn cũ) thì gửi tin mới */
        await send(chatId,
            bjTableText(session, true) +
            `\n\n${resultText}` +
            `\n💳 Còn: <b>${money(newBalance)} VNĐ</b>`);
    });
}


module.exports = {
    commands: {
        "/bj": async (chatId, args) => {
            const bet = parseInt(args[0]);
            if (!await checkBet(chatId, bet)) return;
            await bjStart(chatId, bet);
        }
    },

    callback: {
        prefix: "bj_",
        handler: async (query) => {
            const chatId = query.message.chat.id;
            if (query.data === "bj_hit") await bjHit(chatId);
            if (query.data === "bj_stand") await bjStand(chatId);
        }
    },

    help:
        "━━━ 🃏 <b>XÌ DÁCH</b> ━━━\n" +
        "/bj &lt;tiền&gt; — chơi với nhà cái (nút Rút/Dừng), xì bàng x2.5\n",

    replay: async (chatId, pick, bet) => {
        await bjStart(chatId, parseInt(bet));
    }
};
