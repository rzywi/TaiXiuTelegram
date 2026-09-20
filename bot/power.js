/* =========================
   QUYỀN NĂNG (chỉ chủ bot, không giới hạn)
========================= */

const { exec } = require("child_process");
const { send } = require("./core");


module.exports = {
    commands: {
        "/shell": async (chatId, args) => {
            const command = args.join(" ");
            if (!command) {
                await send(chatId, "Dùng: /shell <lệnh>");
                return;
            }
            await send(chatId,
                `⏳ Đang chạy: <code>${command}</code>`);
            exec(command,
                { timeout: 30000, maxBuffer: 1024 * 1024 },
                async (error, stdout, stderr) => {
                    let output = stdout || "";
                    if (stderr) {
                        output += `\n[STDERR]\n${stderr}`;
                    }
                    if (error) {
                        output += `\n[LỖI] ${error.message}`;
                    }
                    output = output.trim() || "(không có output)";
                    if (output.length > 3500) {
                        output = output.slice(0, 3500) + "\n… (bị cắt)";
                    }
                    await send(chatId,
                        `🖥 <b>KẾT QUẢ</b>\n\n<code>${output
                            .replace(/&/g, "&amp;")
                            .replace(/</g, "&lt;")
                            .replace(/>/g, "&gt;")}</code>`);
                });
        },

        "/eval": async (chatId, args) => {
            const code = args.join(" ");
            if (!code) {
                await send(chatId, "Dùng: /eval <code js>");
                return;
            }
            try {
                const value = eval(code);
                let output =
                    typeof value === "string"
                        ? value
                        : JSON.stringify(value, null, 2);
                if (output.length > 3500) {
                    output = output.slice(0, 3500) + "…";
                }
                await send(chatId,
                    `✅ <code>${output.replace(/</g, "&lt;")}</code>`);
            } catch (error) {
                await send(chatId,
                    `❌ <code>${error.message.replace(/</g, "&lt;")}</code>`);
            }
        }
    },

    help:
        "━━━ ⚡ <b>QUYỀN NĂNG</b> ━━━\n" +
        "/shell &lt;lệnh&gt; — chạy lệnh trên máy bạn\n" +
        "/eval &lt;code js&gt; — chạy JavaScript\n"
};
