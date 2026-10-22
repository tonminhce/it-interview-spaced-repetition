# ⚡ IT Interview Spaced Repetition Flashcards

> Ứng dụng web ôn tập 758 câu hỏi phỏng vấn IT chuyên sâu chuẩn hóa theo thuật toán **Spaced Repetition (SM-2)** — Giúp ghi nhớ kiến thức dài hạn, phản xạ nhanh và tự tin vượt qua các vòng phỏng vấn kỹ thuật từ Junior đến Senior.

---

## 🎯 Danh mục chuyên đề (8 Topics • 758 Questions)

| Icon | Chuyên đề | Số lượng | Mô tả trọng tâm |
| :---: | :--- | :---: | :--- |
| ☕ | **Java Core & JVM** | **121 câu** | Bytecode, JVM Architecture, Memory Management, GC (G1/ZGC), Concurrency, Multithreading, Collection Framework |
| 🍃 | **Spring & Spring Boot** | **117 câu** | IoC/DI, Bean Lifecycle, Spring AOP, Transaction Management, Spring Security, Spring Cloud Microservices |
| ⚡ | **Redis** | **32 câu** | Data Structures, Persistence (RDB/AOF), Replication & Sentinel, Redis Cluster, Distributed Lock (Redlock) |
| 📨 | **Apache Kafka** | **42 câu** | Partitioning, Consumer Group, Rebalance, Exactly-once Semantics, Retention, ISR, Kafka Streams |
| 📐 | **System Design** | **136 câu** | Scalability, High Availability, Sharding, Load Balancing, Caching Strategy, CAP Theorem, Rate Limiter, Microservices |
| 🗄️ | **Database Essentials** | **161 câu** | B-Tree Index, Query Optimization, ACID, Isolation Levels, MVCC, Locks, Normalization, Sharding & Replication |
| 🐘 | **PostgreSQL Deep Dive** | **71 câu** | VACUUM, WAL, HOT Updates, Partial/GIN/BRIN Index, Partitioning, EXPLAIN ANALYZE, Connection Pooling |
| 🐳 | **Docker & Kubernetes** | **78 câu** | Container Runtime, Image Layering, Multi-stage Build, Pods, Deployments, Services, Ingress, HPA, Network Policy |
| 🌟 | **Tất cả chuyên đề (Full Deck)** | **758 câu** | Ôn tập tổng hợp toàn bộ ngân hàng câu hỏi |

---

## 🧠 Cơ chế Spaced Repetition (Thuật toán SM-2)

Ứng dụng áp dụng thuật toán chuẩn **SuperMemo SM-2** (nền tảng của Anki):
- **[1] Lặp lại (Again):** Thẻ chưa nhớ — hệ thống đưa thẻ vào hàng đợi ôn lại ngay trong phiên và giảm điểm độ dễ (Ease Factor).
- **[2] Khó (Hard):** Thẻ khó nhớ — tăng nhẹ khoảng cách ôn tập (\(\times 1.2\)).
- **[3] Tốt (Good):** Trả lời đúng với nỗ lực vừa phải — giãn cách tối ưu theo độ dễ hiện tại.
- **[4] Dễ (Easy):** Nắm rất chắc — tăng mạnh khoảng cách ôn tập và tăng điểm Ease Factor.

Mỗi lượt trả lời được tính toán và lưu trực tiếp vào `localStorage` của trình duyệt, không lo mất tiến độ.

---

## 🚀 Tính năng nổi bật

- ⚡ **Hoạt động 100% Offline & Không cần cài đặt:** Chạy thuần Client-side SPA (HTML5/CSS3/Vanilla JS), không cần server, không cần build npm.
- 🌐 **Hỗ trợ Song ngữ (Bilingual VI / EN):** Chuyển đổi linh hoạt giữa Tiếng Việt và Tiếng Anh chỉ với 1 click hoặc phím tắt `L`.
- ⌨️ **Hệ thống phím tắt thuận tiện:**
  - `Space` hoặc `Enter`: Lật thẻ xem đáp án
  - `1`, `2`, `3`, `4`: Đánh giá mức độ ghi nhớ (Again, Hard, Good, Easy)
  - `S`: Gắn sao (Bookmark) câu hỏi hay
  - `L`: Đổi ngôn ngữ Tiếng Việt / English
  - `←` / `→`: Xem thẻ trước / Bỏ qua
  - `Esc`: Quay về trang chủ
- 📊 **Thống kê trực quan:** Theo dõi số thẻ cần ôn hôm nay (Due), thẻ đang học (Learning), thẻ đã thành thạo (Mastered) và Chuỗi ngày ôn tập (Streak).
- 🔍 **Tìm kiếm & Lọc nâng cao:** Tra cứu câu hỏi tức thì theo từ khóa, độ khó (Beginner / Intermediate / Advanced), hoặc theo trạng thái học tập.
- 💾 **Sao lưu & Khôi phục (Backup / Restore):** Xuất toàn bộ tiến độ ra file JSON và dễ dàng khôi phục trên thiết bị khác.
- 🌙 **Giao diện Hiện đại (Dark / Light Mode):** Tối ưu cho mắt khi học tập lâu dài.

---

## 💻 Hướng dẫn chạy cục bộ

Chỉ cần tải thư mục về máy và mở trực tiếp file `index.html` bằng bất kỳ trình duyệt nào:
```bash
# Hoặc chạy với server tĩnh nhẹ
npx serve .
# hoặc
python -m http.server 8000
```

---

## 📦 Triển khai lên GitHub Pages

Ứng dụng được thiết kế tương thích trực tiếp với GitHub Pages:
1. Vào mục **Settings** của repository trên GitHub.
2. Chọn tab **Pages** ở cột menu bên trái.
3. Tại phần **Build and deployment** > **Branch**, chọn nhánh `main` và thư mục `/(root)`.
4. Nhấn **Save**. Trang web sẽ được tự động kích hoạt tại địa chỉ:
   `https://tonminhce.github.io/it-interview-spaced-repetition/`

---

## 📄 Bản quyền dữ liệu

Bộ dữ liệu câu hỏi được tổng hợp và cấu trúc hóa cho mục đích học tập và ôn luyện phỏng vấn cá nhân.
