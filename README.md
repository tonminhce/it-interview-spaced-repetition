# ⚡ IT Interview — Spaced Repetition Flashcards

> Ôn tập **758 câu hỏi phỏng vấn IT** chuẩn hoá bằng thuật toán **Spaced Repetition (SM-2)** — ghi nhớ kiến thức dài hạn, phản xạ nhanh, tự tin vượt qua vòng phỏng vấn từ Junior đến Senior.

Ứng dụng chạy hoàn toàn trong trình duyệt: HTML + CSS + JavaScript thuần, **không cần build, không phụ thuộc gói cài đặt**.

---

## 🎯 Danh mục chuyên đề (8 chủ đề • 758 câu hỏi)

| Chủ đề | Số lượng | Mô tả trọng tâm |
| :--- | ---: | :--- |
| ☕ **Java Core & JVM** | **121 câu** | Bytecode, kiến trúc JVM, quản lý bộ nhớ, GC (G1/ZGC), đồng thời, Collection Framework |
| 🍃 **Spring & Spring Boot** | **117 câu** | IoC/DI, vòng đời bean, Spring AOP, quản lý transaction, Spring Security, microservice |
| 🗄️ **Database Essentials** | **161 câu** | B-Tree index, ACID, MVCC, cơ chế lock, tối ưu truy vấn, chuẩn hoá, sharding & replication |
| 📐 **System Design** | **136 câu** | Scalability, High Availability, sharding, load balancing, chiến lược cache, CAP, rate limiter |
| 🐳 **Docker & Kubernetes** | **78 câu** | Container runtime, image layer, multi-stage build, pod, deployment, service, ingress, HPA |
| 🐘 **PostgreSQL** | **71 câu** | VACUUM, WAL, HOT update, partial/GIN/BRIN index, partitioning, EXPLAIN ANALYZE |
| 📨 **Apache Kafka** | **42 câu** | Partition, consumer group, rebalance, exactly-once semantics, retention, ISR |
| ⚡ **Redis** | **32 câu** | Cấu trúc dữ liệu, persistence (RDB/AOF), replication & sentinel, Redis Cluster, distributed lock (Redlock) |

---

## 🧠 Cơ chế Spaced Repetition (SM-2)

Toán học lịch ôn **không đổi** so với phiên bản trước, nên tiến độ đã lưu vẫn dùng được nguyên vẹn. Bốn nút đánh giá được đặt tên theo **trạng thái ghi nhớ** thay vì điểm số chất lượng:

| Phím | Nút | Ý nghĩa | Lịch ôn lại |
| :--: | :--- | :--- | :--- |
| `1` | **Chưa nhớ** | Không gọi lại được nội dung | Hôm nay (và quay lại trong chính phiên này) |
| `2` | **Nhớ một phần** | Nhớ được một phần, phần còn lại phải xem lại | × 1,2 khoảng cách hiện tại |
| `3` | **Nhớ được** | Nhớ được với một chút effort | × ease hiện tại |
| `4` | **Nhớ ngay** | Nhớ ngay lập tức | × ease hiện tại × 1,3 |

Vì khoảng cách hiển thị trên nút là thứ người học tin tưởng nhất, mỗi nút đều hiển thị **đúng** lịch ôn sẽ được thiết lập — kể cả nút "Chưa nhớ" cũng không hứa hẹn sai một khoảng thời gian.

Tiến độ lưu trong `localStorage` (`srs_progress_v1`), kèm lịch sử ôn theo ngày để vẽ biểu đồ hoạt động.

---

## 🚀 Tính năng

**Học tập**
- **Mở rộng mượt mà** — đáp án trượt xuống đúng chỗ thẻ bấm, dùng kỹ thuật `grid-template-rows: 0fr → 1fr` (không cần JS đo chiều cao, không nhảy layout).
- **Thanh câu hỏi dính** — câu hỏi luôn nằm trên màn hình khi bạn đọc một đáp án dài (đáp án trung vị ~153 từ, dài nhất ~406 từ).
- **Đếm từ bộ nhớ** — thẻ bấm "Thu gọn" để gấp lại, câu hỏi không mất khỏi tầm mắt.
- **Hoàn tác 5 giây** — chấm nhầm thì bấm "Hoàn tác" ngay sau khi đánh giá, lịch ôn được trả về đúng trạng thái cũ.
- **Song ngữ VI/EN** — chuyển ngôn ngữ ngay trên thẻ, giữ nguyên trạng thái mở/đóng.
- **Bảng tổng kết phiên** — số thẻ đã ôn, tỉ lệ nhớ được, chuỗi ngày, và phân bổ 4 mức đánh giá.

**Tìm kiếm**
- **Command Palette (`Ctrl` + `K`)** — tìm trong toàn bộ 758 câu hỏi, fuzzy match không phân biệt dấu tiếng Việt.
  - `"cong nghe"` khớp với *"Công nghệ"*, `"da phuong"` khớp với *"đa phương"*.
  - Tìm trên cả câu hỏi Việt/Anh, chủ đề con, và nội dung đáp án.
  - Tô sáng phần khớp, nhóm theo loại, điều hướng bằng `↑` `↓`, `Enter` để mở.
  - Chọn một kết quả → mở thẻ với **đáp án đã mở sẵn**.
- **Danh sách câu hỏi** — lọc theo độ khó và trạng thái học, tìm kiếm có debounce, phân trang (60 câu/lần).

**Giao diện**
- **Hệ thống design token** — mọi màu, khoảng cách, bo góc, chuyển động đều khai báo tập trung; sáng/tối dùng chung một bộ token.
- **Icon SVG nội tuyến** — thay toàn bộ emoji chức năng, đồng nhất trên mọi hệ điều hành.
- **Motion có kiểm soát** — vào chậm hơn ra (`320ms` vào, `200ms` ra), tôn trọng `prefers-reduced-motion`.
- **Chiều sâu bằng lớp** — viền hairline 1px + highlight 1px phía trên, không dùng glow neon.
- **Tiếng Việt đúng kiểu** — font Be Vietnam Pro, không `text-transform: uppercase` trên chữ có dấu, `lang` đổi theo ngôn ngữ.

**Khác**
- 💾 **Sao lưu / khôi phục** — xuất toàn bộ tiến độ ra JSON, nạp lại trên thiết bị khác.
- 🔗 **Deep link** — `#/study/redis`, `#/browse/java`; nút back của trình duyệt hoạt động.

### ⌨️ Phím tắt

| Phím | Hành động |
| :--- | :--- |
| `Ctrl` / `⌘` + `K` | Mở Command Palette |
| `Space` / `Enter` | Mở đáp án; khi đã mở → đánh giá "Nhớ được" |
| `1` `2` `3` `4` | Chưa nhớ / Nhớ một phần / Nhớ được / Nhớ ngay |
| `S` | Gắn sao câu hỏi |
| `L` | Đổi ngôn ngữ VI / EN |
| `←` `→` | Thẻ trước / bỏ qua |
| `/` | Focus ô tìm kiếm (ở danh sách câu hỏi) |
| `Esc` | Đóng palette / modal, quay về trang chủ |

---

## 🏗️ Cấu trúc mã nguồn

```
index.html              # khung ứng dụng (header, mount point, script order)
data.js                 # 758 câu hỏi (window.INTERVIEW_DATA)
marked.min.js           # trình phân tích markdown

styles/
  tokens.css            # design token: màu, typography, spacing, motion, elevation
  base.css              # reset, focus, scrollbar, tiện ích
  components.css        # button, chip, header, command palette, modal, toast
  views.css             # home dashboard, study session, browse list
  prose.css             # typography cho đáp án dài: bảng, code block, callout

js/
  icons.js              # bộ icon SVG nội tuyến
  utils.js              # DOM helper, fold tiếng Việt, fuzzy scoring, toast
  store.js              # nạp dữ liệu, lưu trữ, engine SM-2
  markdown.js           # render đáp án + code block + bảng
  palette.js            # Command Palette (Ctrl+K)
  views/home.js         # dashboard
  views/study.js        # phiên ôn tập + mở rộng mượt mà
  views/browse.js       # danh sách câu hỏi
  app.js                # router (hash), phím tắt, modal, khởi động

tools/
  verify-views.sh       # render từng view bằng headless Chrome và kiểm tra DOM
  browser-drive.js      # điều khiển Chrome qua DevTools Protocol (không cần npm)
```

> Các script dùng `<script>` cổ điển (không phải ES module) để ứng dụng vẫn chạy được khi mở trực tiếp `index.html` bằng `file://`.

---

## 💻 Chạy cục bộ

Mở trực tiếp `index.html` bằng trình duyệt, hoặc dùng server tĩnh:

```bash
npm start          # python -m http.server 8000
npm run serve      # npx serve .
```

### Kiểm thử

```bash
npm run verify     # render mọi view bằng headless Chrome, kiểm tra DOM
npm run shots      # chụp ảnh các màn hình chính
```

`npm run verify` bắt được loại lỗi mà mắt thường bỏ sót: một sai số thứ tự phép toán trong chuỗi nối có thể âm thầm làm mất nửa giao diện mà trang vẫn trông "có vẻ ổn".

---

## 📦 Triển khai lên GitHub Pages

Ứng dụng tương thích trực tiếp với GitHub Pages. Workflow `.github/workflows/deploy.yml` tự động publish mỗi lần push lên `main`:

1. Vào **Settings** → **Pages** → **Build and deployment** → **Source: Deploy from a branch**
2. Chọn nhánh `main`, thư mục `/(root)`, nhấn **Save**
3. Trang sẽ tự động chạy tại `https://tonminhce.github.io/it-interview-spaced-repetition/`

---

## 📄 Bản quyền dữ liệu

Bộ dữ liệu câu hỏi được tổng hợp và cấu trúc hóa cho mục đích học tập và ôn luyện phỏng vấn cá nhân.
