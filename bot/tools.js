/* =========================
   CÔNG CỤ TIỆN ÍCH
========================= */

const crypto = require("crypto");
const { send, telegram } = require("./core");


module.exports = {
    commands: {
        "/ping": async (chatId) => {
            await send(chatId, "🏓 Pong! Bot đang sống.");
        },

        "/id": async (chatId) => {
            await send(chatId,
                `🆔 ID của bạn: <code>${chatId}</code>`);
        },

        "/time": async (chatId) => {
            await send(chatId,
                `🕐 ${new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}`);
        },

        "/echo": async (chatId, args) => {
            await send(chatId,
                args.length ? args.join(" ") : "…");
        },

        "/calc": async (chatId, args) => {
            const expr = args.join(" ");
            if (!/^[\d\s+\-*/().%]+$/.test(expr)) {
                await send(chatId,
                    "Chỉ cho phép số và + - * / ( ) %");
                return;
            }
            try {
                const value =
                    Function(`"use strict"; return (${expr})`)();
                await send(chatId,
                    `🧮 <code>${expr}</code> = <b>${value}</b>`);
            } catch {
                await send(chatId, "Biểu thức không hợp lệ.");
            }
        },

        "/qr": async (chatId, args) => {
            const content = args.join(" ");
            if (!content) {
                await send(chatId, "Dùng: /qr <text hoặc link>");
                return;
            }
            await telegram("sendPhoto", {
                chat_id: chatId,
                photo:
                    `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=` +
                    encodeURIComponent(content),
                caption: `QR: ${content}`
            });
        },

        "/weather": async (chatId, args) => {
            const city = args.join(" ");
            if (!city) {
                await send(chatId, "Dùng: /weather <thành phố>");
                return;
            }
            const response = await fetch(
                `https://wttr.in/${encodeURIComponent(city)}?format=j1`,
                { signal: AbortSignal.timeout(8000) }
            );
            const data = await response.json();
            const cur = data.current_condition[0];
            await send(chatId,
                `🌦 <b>${city.toUpperCase()}</b>\n\n` +
                `Nhiệt độ: <b>${cur.temp_C}°C</b> (cảm giác ${cur.FeelsLikeC}°C)\n` +
                `Trạng thái: ${cur.weatherDesc[0].value}\n` +
                `Độ ẩm: ${cur.humidity}%\n` +
                `Gió: ${cur.windspeedKmph} km/h`);
        },

        "/password": async (chatId, args) => {
            const len = Math.min(
                parseInt(args[0]) || 16, 128);
            const chars =
                "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
            let password = "";
            const bytes = crypto.randomBytes(len);
            for (let i = 0; i < len; i++) {
                password += chars[bytes[i] % chars.length];
            }
            await send(chatId,
                `🔑 Mật khẩu (${len} ký tự):\n<code>${password}</code>`);
        },

        "/uuid": async (chatId) => {
            await send(chatId,
                `🆔 <code>${crypto.randomUUID()}</code>`);
        }
    },

    help:
        "━━━ 🛠 <b>CÔNG CỤ</b> ━━━\n" +
        "/calc &lt;biểu thức&gt; — máy tính\n" +
        "/qr &lt;text&gt; — tạo mã QR\n" +
        "/weather &lt;thành phố&gt; — thời tiết\n" +
        "/password &lt;độ dài&gt; — tạo mật khẩu\n" +
        "/uuid — tạo UUID\n" +
        "/id — xem ID của bạn\n" +
        "/ping — kiểm tra bot sống\n" +
        "/time — giờ hiện tại\n" +
        "/echo &lt;text&gt; — bot nhại lại\n"
};
