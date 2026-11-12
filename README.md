# it-docs-assistant

Trợ lý nổi ở góc màn hình Windows để nhân viên tra cứu và tải tài liệu IT.
Gõ tên tài liệu (ví dụ "cài win", "cấp thiết bị") rồi bấm **Tải về**. Gõ `hướng dẫn` để xem danh sách tài liệu.

## Thêm tài liệu

1. Thả file vào `docs/`. Tên file nên có từ khóa người dùng hay gõ (ví dụ `cai-win.pdf`).
   Tìm không phân biệt dấu. File `.txt` và `.md` được tìm cả trong nội dung.
2. Tùy chọn: `docs/docs.json` để đặt tên hiển thị và từ khóa:
   ```json
   [{ "file": "cai-win.pdf", "title": "Tài liệu cài Win", "keywords": "cai win, windows" }]
   ```

## Chạy thử

```
npm install
npm start
```

Nếu Electron chạy như Node và báo lỗi `ipcMain` undefined, xóa biến môi trường `ELECTRON_RUN_AS_NODE`.

## Build và gửi cho nhân viên

1. Tăng `version` trong `package.json` (ví dụ `1.0.1`).
2. `npm run build`
3. Gửi `dist/TroLyTaiLieu Setup <version>.exe`. Docs đã đóng gói sẵn, nhân viên cài đè lên bản cũ là cập nhật.

Exe chưa ký số: SmartScreen sẽ cảnh báo, bấm **More info → Run anyway**.
Máy bật Smart App Control sẽ chặn hẳn; cần ký số hoặc nhờ IT whitelist.

## Lưu ý

- Repo để **Private** vì `docs/` có thể chứa tài liệu nội bộ.
- `node_modules/` và `dist/` không đưa vào git.
