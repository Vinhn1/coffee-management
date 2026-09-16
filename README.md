# Bụi Coffee - Hệ Thống Quản Lý Quán Cà Phê 50 Bàn

Ứng dụng web quản lý bán hàng (POS Mobile-First) cho quán **Bụi Coffee**, được thiết kế tối ưu hóa cho thao tác trên điện thoại thông minh, máy tính bảng và máy tính để bàn.

---

## 1. Tính năng nổi bật

- **Quản lý sơ đồ 50 Bàn**:
  - Trực quan hóa tình trạng 50 bàn phục vụ với mã màu: Trống, Có khách / Chưa thanh toán, Đã thanh toán.
  - Lọc nhanh: Tất cả, Bàn đang có khách, Bàn trống.
  - Hỗ trợ chuyển bàn và gộp bàn nhanh chóng.

- **Menu nước thực tế từ Bụi Coffee**:
  - Trích xuất đầy đủ và chính xác 100% từ bảng menu thực tế của quán.
  - 7 danh mục: Coffee pha máy, Trà trái cây, Yaourt trái cây, Nước ép, Sinh tố, Đá xay, Thức uống đóng chai.
  - Thông tin Wifi quán: `Pass: 68686868`.

- **Tìm kiếm tức thì thông minh**:
  - Tìm kiếm thời gian thực (instant search) hỗ trợ gõ tiếng Việt không dấu (ví dụ: gõ `bac xiu`, `tra dao`, `yaourt`, `sinh to bo` hiển thị ngay kết quả).
  - Thanh trượt danh mục tiện lợi.

- **Quản lý Order & Gọi món**:
  - Tăng / giảm số lượng món (+/-) trực tiếp.
  - Thêm ghi chú nhanh cho từng món: Ít đường, Không đường, Ít đá, Nhiều đá, Uống nóng, Mang về...

- **Thanh toán & Hóa đơn**:
  - Hỗ trợ 2 phương thức: Tiền mặt (tự động tính tiền thừa trả khách) và Chuyển khoản VietQR.
  - Mã VietQR được sinh tự động kèm đúng số tiền và nội dung thanh toán theo bàn.
  - Xuất hóa đơn / in biên lai trực tiếp.

- **Lưu trữ dữ liệu & Báo cáo**:
  - Tự động lưu trên trình duyệt (LocalStorage), không bị mất dữ liệu khi tải lại trang hoặc mất mạng.
  - Chức năng Sao lưu (Export JSON) và Khôi phục (Import JSON) để dễ dàng đồng bộ sang thiết bị khác.
  - Thống kê doanh thu trong ngày, số đơn hàng đã hoàn thành và danh sách các món bán chạy nhất.

---

## 2. Công nghệ sử dụng

- **Frontend**: HTML5, Vanilla CSS3 (CSS Variables, Flexbox/Grid, Responsive Mobile-First), ES6 JavaScript Modules.
- **Biểu tượng**: Hệ thống SVG vector sắc nét, tối ưu tốc độ tải.
- **Không cần cài đặt Node.js/Backend**: Có thể chạy trực tiếp bằng cách mở file `index.html` hoặc deploy trực tiếp lên GitHub Pages.

---

## 3. Triển khai lên GitHub Pages

Repo đã được cấu hình GitHub Actions trong thư mục `.github/workflows/deploy.yml`.

Khi push lên nhánh `main`, hệ thống sẽ tự động xuất bản website lên GitHub Pages tại địa chỉ:
`https://vinhn1.github.io/coffee-management/`

Hoặc bạn có thể kích hoạt thủ công trong **GitHub Repository -> Settings -> Pages -> Build and deployment -> Source: Deploy from a branch (main / root)**.
