# ☕ Tea & Cafe — Website bán đồ uống

Website tĩnh (HTML + CSS + JavaScript thuần) cho quán trà & cà phê nhỏ, gồm đầy đủ chức năng mua hàng và quản lý đơn hàng — không cần cài đặt bất kỳ thư viện hay server backend nào.

## ✨ Tính năng

| Trang | Chức năng |
|---|---|
| `index.html` | Trang chủ: hero, sản phẩm nổi bật, giới thiệu, điểm nổi bật |
| `sanpham.html` | Thực đơn 11 món, **tìm kiếm theo tên** và **lọc theo danh mục** |
| `chitiet.html` | Chi tiết sản phẩm (thành phần, hương vị), chọn size, chọn số lượng, mua ngay |
| `giohang.html` | Giỏ hàng: sửa số lượng, xóa món, tính phí ship (miễn phí từ 200.000đ), đặt hàng COD hoặc chuyển khoản |
| `dangky.html` / `dangnhap.html` | Đăng ký / đăng nhập tài khoản (lưu trong `localStorage` của trình duyệt) |
| `admin.html` | Trang quản trị: thống kê, xem/cập nhật trạng thái/xóa đơn hàng |
| `gioithieu.html`, `lienhe.html` | Giới thiệu quán, liên hệ + form gửi tin nhắn, bản đồ |

## 🔑 Tài khoản quản trị mẫu

- Tên đăng nhập: `admin`
- Mật khẩu: `admin123`

Tài khoản này được tạo tự động lần đầu mở website. Đăng nhập tại `dangnhap.html`, sẽ tự chuyển đến trang quản trị.

> ⚠️ Lưu ý: đây là website tĩnh dùng `localStorage` — dữ liệu (tài khoản, đơn hàng, giỏ hàng) chỉ lưu trên **trình duyệt của từng máy**. Phù hợp cho demo / bài tập / dùng nội bộ, không phải hệ thống bán hàng thật.

## 💻 Chạy trên máy của bạn

Cách 1 — mở trực tiếp: nhấp đôi vào `index.html`.

Cách 2 — chạy server local (khuyên dùng, giống môi trường deploy thật):

```bash
# Python
python -m http.server 8080

# hoặc Node.js
npx serve .
```

Sau đó mở: http://localhost:8080

## 🚀 Deploy để người khác dùng

Toàn bộ là file tĩnh nên deploy miễn phí rất dễ, chỉ cần kéo-thả thư mục này lên một trong các dịch vụ sau:

- **Netlify**: vào [app.netlify.com/drop](https://app.netlify.com/drop), kéo thả thư mục vào.
- **Vercel**: `npx vercel` trong thư mục này, làm theo hướng dẫn.
- **GitHub Pages**: đẩy code lên repo GitHub → Settings → Pages → chọn nhánh `main` / thư mục gốc.

## 📁 Cấu trúc thư mục

```
├── index.html          # Trang chủ
├── sanpham.html        # Danh sách sản phẩm (tìm kiếm + lọc)
├── chitiet.html        # Chi tiết sản phẩm
├── giohang.html        # Giỏ hàng & thanh toán
├── gioithieu.html      # Giới thiệu
├── lienhe.html         # Liên hệ
├── dangnhap.html       # Đăng nhập
├── dangky.html         # Đăng ký
├── admin.html          # Quản trị (cần đăng nhập admin)
├── css/
│   └── style.css       # Toàn bộ giao diện
└── js/
    └── script.js       # Dữ liệu sản phẩm + giỏ hàng + tài khoản + đơn hàng
```

## 🛠️ Chỉnh sửa / bảo trì

- **Đổi sản phẩm, giá, mô tả**: sửa đối tượng `products` ở đầu file `js/script.js` — đây là nguồn dữ liệu duy nhất, các trang sẽ tự đồng bộ.
- **Đổi màu chủ đạo**: sửa các biến `:root` ở đầu file `css/style.css`.
- **Đổi thông tin liên hệ**: tìm & thay SĐT `097 368 3235` và email trong các file HTML.
