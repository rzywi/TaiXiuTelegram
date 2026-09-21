# 🎲 TaiXiuTelegram

> Telegram Bot trò chơi Tài Xỉu với hệ thống tài khoản, số dư, lịch sử ván chơi và AI Chat.

![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Telegram](https://img.shields.io/badge/Telegram-Bot-26A5E4?style=for-the-badge&logo=telegram&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-Database-4479A1?style=for-the-badge&logo=mysql&logoColor=white)
![Render](https://img.shields.io/badge/Deploy-Render-46E3B7?style=for-the-badge&logo=render&logoColor=white)

---

## 📌 Giới thiệu

**TaiXiuTelegram** là một Telegram Bot được xây dựng bằng **Node.js**, sử dụng Telegram Bot API và MySQL.

Bot hỗ trợ hệ thống người dùng, số dư, đặt cược Tài/Xỉu, lịch sử trò chơi, ghi chú, nhắc nhở và trò chuyện với AI.

Project được thiết kế theo hướng module hóa để dễ phát triển và mở rộng thêm chức năng.

---

## ✨ Tính năng

### 🎲 Tài Xỉu

- Đặt cược Tài / Xỉu
- Kiểm tra số dư
- Trừ tiền cược
- Cộng tiền thưởng
- Lưu lịch sử từng ván
- Hiển thị kết quả và chi tiết ván chơi

### 👤 Người dùng

- Tự động tạo tài khoản Telegram
- Quản lý số dư
- Số dư khởi tạo: `10,000`
- Lưu Telegram ID và username

### 🎁 Daily Bonus

- Nhận thưởng hằng ngày
- Theo dõi ngày nhận thưởng
- Mỗi tài khoản có trạng thái riêng

### 📝 Notes

- Lưu ghi chú cá nhân
- Quản lý nội dung ghi chú theo Telegram ID

### ⏰ Reminders

- Tạo lời nhắc
- Lưu thời gian nhắc
- Theo dõi trạng thái hoàn thành

### 🤖 AI Chat

- Tích hợp AI API
- Hỗ trợ model tùy chỉnh thông qua biến môi trường
- Có thể thay đổi API endpoint mà không cần sửa code chính

### 🔒 Chế độ riêng tư

Bot có thể giới hạn quyền sử dụng theo `OWNER_ID`.

---

## 🛠️ Công nghệ

| Công nghệ | Sử dụng |
|---|---|
| Node.js | Runtime |
| JavaScript | Ngôn ngữ chính |
| Telegram Bot API | Giao tiếp với Telegram |
| MySQL | Cơ sở dữ liệu |
| mysql2 | Kết nối MySQL |
| dotenv | Quản lý biến môi trường |
| Render | Deploy |
| Aiven | MySQL Cloud |
| AI API | AI Chat |

---

## 📁 Cấu trúc project

```text
TaiXiuTelegram/
│
├── bot.js
├── package.json
├── package-lock.json
├── README.md
├── .gitignore
│
└── bot/
    ├── core.js
    ├── ...
    │
    └── các module chức năng
