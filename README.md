# Play Piano

Ứng dụng web cho iPad: tải MP3/WAV piano, tạo hướng dẫn giai điệu, bấm đàn và dùng điện thoại quay đôi tay. Ghép video với **chính file nhạc gốc** sau khi quay.

## Chạy trên GitHub Pages

Không cần cài thư viện hay backend. Trong repo, mở **Settings → Pages → Deploy from a branch → main → / (root) → Save**. Địa chỉ dự kiến: https://huyinvestor87.github.io/play-piano/ (chỉ hoạt động sau khi bật Pages).

## Dùng trên iPad

1. Mở Safari, đặt iPad nằm ngang. Có thể thêm vào Màn hình chính qua menu Chia sẻ.
2. Tải file MP3/WAV piano, tối đa 30 MB / 5 phút. Âm thanh được giải mã và phân tích trên thiết bị, không gửi lên máy chủ.
3. Nghe và kiểm tra nốt gợi ý; dùng **Chỉnh nốt / nhập hướng dẫn** để sửa thời điểm, cao độ, độ dài hoặc nhập JSON chuẩn bị sẵn. Có thể đặt nhiều nốt cùng thời điểm.
4. Chọn quãng phím C3–C5 hoặc C4–C6. Chọn tốc độ chậm để tập; nhạc sẽ đổi cao độ khi giảm tốc độ. Quay ở **1×**.
5. Bật **Bố cục quay**. Camera điện thoại chỉ lấy vùng dưới đường cắt cùng đôi tay. Dải nốt hướng dẫn ở trên vẫn nhìn được nhưng nằm ngoài video. Bàn phím chính chỉ đổi màu khi thực sự chạm, không gợi ý trước nước bấm.
6. Quay trước khi bấm Bắt đầu. App đếm 3 tiếng, nhạc và hướng dẫn bắt đầu sau đó. Có thể tắt tiếng phím, nghe file gốc qua tai nghe. Sau quay, dùng CapCut hoặc trình dựng tương tự ghép file gốc tại mốc nhạc bắt đầu và bỏ tiếng camera.

**App không tự ghép video, không quay tay bằng camera và không kiểm tra bấm đúng/sai.** File gốc là nhạc cuối cùng của video, nên bấm theo hướng dẫn không đảm bảo khớp hoàn hảo nếu nốt nhận diện sai.

## Học đánh Für Elise

Trang `fur-elise.html` (nút **♪ Học đánh Für Elise** ở trang chính) hướng dẫn từng nốt của Für Elise để bạn nhìn iPad và đánh trên đàn thật:

- **Bàn phím trên màn hình giống đàn thật**: đủ nhóm 2 và 3 phím đen, ghi tên nốt (Đô Rê Mi và C D E), số quãng tám trên mọi phím Đô và đánh dấu **Đô giữa**. Một dải 88 phím phía trên cho biết bạn đang ở vùng nào của cây đàn (chọn được loại đàn 61 hoặc 76 phím trong Cài đặt).
- **Mỗi bước bấm** cho biết phím nào sáng, **số ngón tay** nào dùng (tay phải: vòng tròn xanh lá, tay trái: ô vuông xanh dương), vị trí phím so với nhóm phím đen và Đô giữa, nốt kế tiếp, khi nào đạp hoặc nhả pedal.
- **Nốt rơi** cho thấy nốt sắp đến và độ dài cần giữ.
- **12 đoạn tập**: 5 câu của phần A (đoạn nổi tiếng), phần A đầy đủ, phần B, phần C, đoạn kết và cả bài. Có thể tập tay phải, tay trái hoặc 2 tay, và bật lặp lại.
- **Tiếp ▶** hoặc chạm vào vùng nốt rơi để đi từng nốt theo nhịp của bạn. Bàn đạp lật trang Bluetooth hoặc phím mũi tên cũng dùng được. **▶ Tự chạy** phát nhạc mẫu ở 25–120% tốc độ (100% = ♩ 72), có đếm 3 nhịp trước khi chạy.
- Tối ưu cho iPad ngang và dọc: nút lớn, không bị zoom khi chạm hai lần, giữ màn hình sáng khi tập (Screen Wake Lock), vẫn phát tiếng khi gạt công tắc im lặng (iOS 17+), có thể thêm vào Màn hình chính để chạy toàn màn hình.

Nốt nhạc chép từ ấn bản Breitkopf & Härtel 1888 (bản khắc của [Mutopia Project](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=931), public domain) và được kiểm tra khớp với file MIDI của bản đó. Số ngón tay là gợi ý cho người mới. Dữ liệu nằm trong `fur-elise-score.js`, mỗi ô nhịp viết dạng `E5/5 D#5/4 …` (nốt/ngón:độ dài) nên dễ sửa.

## Nhận diện và âm thanh

- Web Worker nhận diện đơn âm bằng normalized difference (YIN-style), 8 kHz, khung 1.024 mẫu, bước 256 mẫu, quãng MIDI 48–84 (C3–C6).
- Chỉ tìm **một dòng giai điệu ước lượng**, không phải mô hình phiên âm piano đa âm. File piano hai tay có hợp âm, pedal, bè trầm hoặc nhiều nốt cùng lúc vẫn có thể sai/mất nốt; giai điệu có thể lẫn với bè đệm. Khoảng im lặng hay cao độ không đủ rõ không được thay bằng nốt giả.
- Muốn khớp chính xác cả hai tay cần bước phiên âm đa âm chuyên dụng và kiểm tra bản nốt. Bản đầu có import/export JSON làm đường nhập hướng dẫn đã xác minh.
- Tiếng phím là tổng hợp nhiều họa âm với độ tắt dần, **không phải sample piano thu thật**. Không dùng thư viện âm thanh/CDN; dùng file gốc để giữ chất lượng nhạc trong video.
- Quãng bàn phím chỉ có 2 octave để dễ bấm trên iPad; nốt ngoài quãng sẽ được báo và không tự chuyển octave.
- Khi chuyển tab hoặc khóa màn hình, nhạc dừng để tránh mất đồng bộ hướng dẫn. Cần chạm để bật AudioContext trên Safari.
- File nốt và âm thanh chỉ giữ trong phiên hiện tại. Xuất JSON trước khi đóng trang nếu đã sửa hướng dẫn. Tải lại file nhạc rồi nhập JSON khi quay lại.

## JSON hướng dẫn

```json
{
  "version": 1,
  "notes": [
    { "time": 0.2, "midi": 60, "duration": 0.5 },
    { "time": 0.7, "midi": 64, "duration": 0.5 }
  ]
}
```

Thời gian và độ dài tính bằng giây của file gốc. MIDI phải là số nguyên 48–84; nốt phải nằm trong thời lượng file. Tối đa 10.000 nốt / file JSON 2 MB.

## Phát triển / kiểm tra

```sh
npm test
npm run check
python3 -m http.server 8000
```

Mở http://localhost:8000. Các module/worker cần chạy qua HTTP(S), không mở bằng `file://`.

Kiểm tra trên iPad thật trước khi quay: mở giai điệu mẫu; thử hai ngón tay và trượt ngón; tải WAV/MP3 piano; dừng/tua/đổi tốc độ; xác minh nốt rơi nằm đúng cột phím; thử xoay màn hình và bố cục quay; quay một đoạn rồi ghép file gốc ở 1×.

CSS/JS dùng phiên bản query `v=1.0.0`; tăng cùng nhau khi cập nhật để tránh cache cũ. Các kiểm thử tự động xác minh nhận diện tín hiệu tổng hợp, chia nốt, JSON nhập và hình học bàn phím; không thay thế kiểm tra độ chính xác với file piano thật.
