# LỘ TRÌNH ÔN TẬP PHỎNG VẤN JAVA BACKEND (2+ NĂM KINH NGHIỆM)
> **Nguồn câu hỏi:** [it-interview-spaced-repetition](https://github.com/tonminhce/it-interview-spaced-repetition)  
> **Định hướng:** **Deep Dive / Bản chất kỹ thuật (Internals, Gotchas, Trade-offs)**  

---

## 1. BẢNG MA TRẬN ĐỐI CHIẾU JD & KHO CÂU HỎI

| Yêu cầu trong JD | Chuyên mục trên Web Spaced Repetition | Số câu chọn lọc | Trọng tâm phỏng vấn (Deep-Dive) |
|---|---|---|---|
| **Java 2+ yrs & Data Structures** | `java` (Tổng 121 câu) | **26 câu cốt lõi** | HashMap internals, ConcurrentHashMap, ThreadPoolExecutor, JMM volatile, GC, Virtual Threads |
| **Spring Framework & Hibernate** | `spring-spring-boot` (Tổng 117 câu) | **25 câu cốt lõi** | Bean Lifecycle, AOP Proxy gotchas, @Transactional propagation, N+1 query, Dirty checking, HikariCP |
| **Redis & Caching Solutions** | `redis` (Tổng 32 câu) | **14 câu cốt lõi** | Redis single-thread event loop, Data structures, Caching patterns, Cache stampede/avalanche, Distributed lock |
| **RDBMS (PostgreSQL/MySQL)** | `postgresql` (71 câu) & `database-essentials` | **22 câu cốt lõi** | B+ Tree, Composite index, Sargable queries, EXPLAIN ANALYZE, MVCC, Deadlock, Isolation levels |
| **NoSQL (MongoDB/Cassandra)** | `database-essentials` (Tổng 161 câu) | **10 câu cốt lõi** | CAP/BASE theorem, Document vs Wide-column, MongoDB embed vs ref, LSM-tree vs B-tree |
| **System Design & Architecture** | `system-design` (Tổng 136 câu) | **16 câu cốt lõi** | Consistent hashing, Idempotency key, Rate Limiter, Outbox pattern, Saga, Flash sale / Ledger |
| **Kafka & Docker (Bonus)** | `kafka` (42 câu) & `docker-kubernetes` (78 câu) | **8 câu cốt lõi** | Kafka partitions & ordering, Consumer group rebalance, Outbox CDC, Multi-stage docker |
| **Frontend & Git (Phần bù JD)** | *Ngoại kho (Bổ sung độc lập)* | **15 câu chuẩn** | JS Event Loop, Closures, React Hooks & Virtual DOM, jQuery basics, Git rebase vs merge |

---

## 2. TRỤ CỘT 1: JAVA CORE, DATA STRUCTURES & MULTITHREADING (JD: Java 2+ yrs)

### A. Collections & Data Structures Internals (Cấu trúc dữ liệu & Bản chất)

- **`[ID: 96004]` Từ Java 8, HashMap xử lý bucket bị đụng độ nhiều như thế nào?**
  - *Bản chất:* Trước Java 8 dùng LinkedList (O(n) worst-case). Từ Java 8: Khi số phần tử trong 1 bucket $\ge 8$ (`TREEIFY_THRESHOLD`) **VÀ** tổng dung lượng mảng $\ge 64$ (`MIN_TREEIFY_CAPACITY`), bucket chuyển thành **Red-Black Tree** (O(log n)). Nếu mảng < 64, HashMap chọn `resize()` mảng gấp đôi thay vì chuyển cây. Khi số phần tử giảm về $\le 6$ (`UNTREEIFY_THRESHOLD`), chuyển ngược lại LinkedList để tiết kiệm bộ nhớ.
- **`[ID: 96005]` Dùng object mutable làm key của HashMap thì chuyện gì xảy ra?**
  - *Bản chất:* Nếu mutate trường dữ liệu tham gia tính `hashCode()`, mã hash thay đổi. HashMap sẽ tìm kiếm ở sai bucket $\to$ `get(key)` trả về `null` dù object vẫn tồn tại trong Map (gây memory leak và mất mát dữ liệu). Vì vậy Key luôn phải là **Immutable** (String, Integer, Java 14+ Record).
- **`[ID: 96006]` Cài LRU cache chỉ bằng thư viện chuẩn của Java thì làm thế nào?**
  - *Bản chất:* Kế thừa `LinkedHashMap` với constructor `accessOrder = true` (sắp xếp theo thứ tự truy cập thay vì chèn) và override method `removeEldestEntry(entry)` trả về `size() > MAX_ENTRIES`.
- **`[ID: 96007]` `Collectors.toMap()` có hai cạm bẫy nào khi gom List thành Map?**
  - *Bản chất:* (1) Duplicate key ném ngay `IllegalStateException` (cần truyền merge function `(v1, v2) -> v1`). (2) Map mặc định không cho value null $\to$ nếu value là null sẽ ném `NullPointerException`.
- **`[ID: 2522]` ArrayList và LinkedList khác nhau thế nào?**
  - *Bản chất:* ArrayList dùng mảng liên tục (contiguous memory), tận dụng tối đa **CPU Cache Locality** $\to$ duyệt tuần tự cực nhanh. LinkedList gồm các Node rời rạc trên Heap, tốn 24 bytes overhead cho mỗi node (trên 64-bit JVM) và gây CPU cache miss liên tục. Thực tế 99% dùng ArrayList.
- **`[ID: 93508]` ArrayList tự tăng dung lượng (grow/resize) nội bộ thế nào?**
  - *Bản chất:* Dung lượng ban đầu là 10 (khi add phần tử đầu tiên). Mỗi khi đầy, tăng $1.5$ lần (`newCapacity = oldCapacity + (oldCapacity >> 1)`), sau đó copy mảng cũ sang mảng mới bằng `Arrays.copyOf` (gọi System.arraycopy native).
- **`[ID: 2530]` ConcurrentHashMap khác Hashtable thế nào?**
  - *Bản chất:* Hashtable đồng bộ hoá toàn bộ bảng bằng `synchronized` trên mọi method (bottleneck cực lớn). `ConcurrentHashMap` trong Java 8 dùng **CAS (Compare-And-Swap)** khi chèn node đầu tiên của bucket, và chỉ `synchronized` trên đúng node đầu của bucket đó khi có đụng độ hash. Đọc (`get`) hoàn toàn lock-free nhờ `volatile Node.val`.
- **`[ID: 96062]` `ConcurrentHashMap` đảm bảo thread-safe bằng cách nào? Vì sao `if (!map.containsKey(k)) map.put(k, v)` vẫn sai?**
  - *Bản chất:* Thread-safe chỉ đảm bảo cho từng thao tác đơn lẻ. Thao tác ghép `containsKey` + `put` là **check-then-act** (không nguyên tử giữa hai bước). Để thread-safe tuyệt đối, bắt buộc dùng `putIfAbsent` hoặc `computeIfAbsent`.

### B. Concurrency, Multithreading & Memory Model (Bản chất Luồng & Bộ nhớ)

- **`[ID: 2550]` `volatile` keyword trong Java là gì?**
  - *Bản chất:* Đảm bảo **Visibility** (mọi thread đều đọc giá trị mới nhất trực tiếp từ Main Memory, không lưu trên CPU L1/L2 cache) và ngăn chặn **Instruction Reordering** nhờ chèn các rào chắn bộ nhớ (**Memory Barriers / Fences**). Chú ý: `volatile` **KHÔNG** đảm bảo tính nguyên tử (Atomicity) cho phép toán compound như `count++`.
- **`[ID: 96061]` Vì sao double-checked locking không có `volatile` là sai? Java Memory Model liên quan thế nào?**
  - *Bản chất:* Quá trình `instance = new Singleton()` gồm 3 bước: (1) Cấp phát bộ nhớ, (2) Khởi tạo constructor, (3) Gán địa chỉ cho biến `instance`. Do CPU/JIT compiler reorder, bước 3 có thể diễn ra trước bước 2. Thread khác kiểm tra `instance != null` sẽ nhận được một đối tượng chưa khởi tạo xong (partially constructed object) $\to$ crash ứng dụng. `volatile` ngăn instruction reordering.
- **`[ID: 96054]` `synchronized` và `ReentrantLock` khác nhau thế nào? Khi nào chọn cái nào?**
  - *Bản chất:* `synchronized` là implicit lock do JVM quản lý, tự giải phóng khi xong block. `ReentrantLock` là explicit lock của `java.util.concurrent`, cung cấp: `tryLock(timeout)` (tránh chờ vô hạn gây deadlock), Fair lock (FIFO), khả năng ngắt (`lockInterruptibly`), và hỗ trợ nhiều `Condition` (await/signal).
- **`[ID: 96058]` `ThreadPoolExecutor` có những tham số nào? Vì sao nhiều nơi khuyên không dùng `Executors.newFixedThreadPool()`?**
  - *Bản chất:* 7 tham số: `corePoolSize`, `maximumPoolSize`, `keepAliveTime`, `unit`, `workQueue`, `threadFactory`, `handler`.
  - *Quy trình:* Task đến $\to$ nếu active < corePoolSize thì tạo thread mới $\to$ nếu đã đủ corePoolSize thì đẩy vào `workQueue` $\to$ chỉ khi `workQueue` đầy mới tạo thread vượt core lên max $\to$ nếu queue đầy và chạm max thì gọi `RejectedExecutionHandler`.
  - *Cạm bẫy:* `newFixedThreadPool` dùng `LinkedBlockingQueue` vô hạn (Integer.MAX_VALUE) $\to$ khi tải cao, queue phình to gây **OutOfMemoryError (OOM)** trước khi kịp kích hoạt cơ chế từ chối task.
- **`[ID: 96057]` Chọn số thread cho thread pool thế nào? Task CPU-bound và IO-bound khác nhau ra sao?**
  - *Bản chất:* 
    - **CPU-bound:** Số luồng = $N_{cpu} + 1$ (tránh context switching lãng phí).
    - **IO-bound:** Số luồng = $N_{cpu} \times (1 + \frac{\text{Wait Time}}{\text{Compute Time}})$. Khi luồng chờ IO/Database, CPU có thể chuyển sang phục vụ luồng khác.
- **`[ID: 96063]` `ThreadLocal` gây rò rỉ bộ nhớ khi dùng với thread pool như thế nào? Vì sao phải gọi `remove()`?**
  - *Bản chất:* Mỗi `Thread` giữ một `ThreadLocalMap`. Entry trong map có Key là WeakReference tới `ThreadLocal`, nhưng Value là Strong Reference. Khi dùng Thread Pool, luồng không bị hủy mà được tái sử dụng liên tục. Nếu không gọi `ThreadLocal.remove()`, Value sẽ sống mãi cùng Thread trong pool $\to$ **Memory Leak**.
- **`[ID: 96064]` CAS hoạt động thế nào trong `AtomicInteger`? ABA problem là gì và khi nào nên dùng `LongAdder`?**
  - *Bản chất:* CAS (Compare-And-Swap) dùng chỉ lệnh phần cứng `cmpxchg` để update biến không cần lock. ABA problem xảy ra khi giá trị đổi từ A $\to$ B $\to$ A khiến CAS ngỡ như chưa đổi (giải quyết bằng `AtomicStampedReference` kèm version). Dưới độ tranh chấp cao (high contention), dùng `LongAdder` phân tán giá trị ra các Cell riêng biệt để tránh nghẽn bus CPU.
- **`[ID: 96065]` Pinning trong virtual thread (Java 21) là gì? Vì sao không nên pool virtual thread?**
  - *Bản chất:* Virtual thread được mount lên OS carrier thread. Khi chạy bên trong khối `synchronized` hoặc gọi JNI / native code, virtual thread bị "ghim" (pinned) chặt vào carrier thread, ngăn carrier thread chuyển sang unpark virtual thread khác $\to$ tắc nghẽn luồng. Giải pháp: thay `synchronized` bằng `ReentrantLock`. Không bao giờ pool virtual thread vì nó siêu nhẹ (vài KB), hãy tạo mới theo request (`Executors.newVirtualThreadPerTaskExecutor()`).
- **`[ID: 96059]` `thenApply`, `thenCompose`, `thenCombine` trong CompletableFuture khác nhau thế nào?**
  - *Bản chất:* `thenApply`: biến đổi kết quả đồng bộ ($T \to U$). `thenCompose`: phẳng hoá kết quả bất đồng bộ (giống flatMap, nhận function trả về `CompletableFuture<U>`). `thenCombine`: chờ 2 future độc lập hoàn thành rồi gộp kết quả của cả 2.

### C. JVM, Memory Management & Java Essentials

- **`[ID: 2503]` Bộ nhớ Stack và Heap trong Java khác nhau thế nào?**
  - *Bản chất:* Stack lưu trữ local primitive variables, references và call frame của từng thread (thread-private, cấp phát & giải phóng cực nhanh theo phạm vi hàm). Heap lưu trữ tất cả Object instances và mảng (shared across threads, được quản lý và dọn dẹp bởi Garbage Collector).
- **`[ID: 96060]` Metaspace là gì? Khác PermGen thế nào và khi nào gặp `OutOfMemoryError: Metaspace`?**
  - *Bản chất:* Từ Java 8, PermGen (nằm trong JVM Heap) bị thay thế bởi Metaspace (nằm trên native OS memory ngoài Heap). Metaspace lưu trữ class metadata, method bytecode. Gặp lỗi OOM Metaspace khi ứng dụng sinh class động liên tục (CGLIB, Spring reflection, dynamic proxies) mà không được garbage collect hoặc rò rỉ ClassLoader.
- **`[ID: 2558]` Garbage Collection (GC) hoạt động như thế nào?**
  - *Bản chất:* Dựa trên giả thuyết Weak Generational Hypothesis (hầu hết object chết rất trẻ). Chia làm Young Generation (Eden, Survivor S0, S1) và Old Generation. Object sống sót qua nhiều chu kỳ GC sẽ được promote lên Old Gen. Các GC hiện đại (G1GC, ZGC) chia heap thành các Region nhỏ để đạt Stop-The-World (STW) latency cực thấp (< 1ms với ZGC).
- **`[ID: 96000]` Vì sao `Integer a = 127, b = 127` thì `a == b` ra true, còn với 128 lại ra false?**
  - *Bản chất:* Java áp dụng Integer Cache cho dải giá trị từ `-128` đến `127`. Khi autoboxing trong dải này, JVM tái sử dụng các instance có sẵn trong pool. Ngoài dải này, JVM tạo mới đối tượng (`new Integer(128)`), do đó toán tử so sánh tham chiếu `==` trả về `false`.
- **`[ID: 96014]` `orElse` và `orElseGet` khác nhau ra sao? Dùng Optional sai cách kiểu nào hay gặp?**
  - *Bản chất:* `orElse(getDefault())` luôn thực thi biểu thức bên trong bất kể Optional có rỗng hay không (Eager evaluation). `orElseGet(() -> getDefault())` chỉ thực thi khi Optional rỗng (Lazy evaluation qua Supplier). Sai lầm kinh điển: dùng `optional.get()` mà không check `isPresent()`, hoặc truyền Optional làm tham số hàm/field của Entity.

---

## 3. TRỤ CỘT 2: SPRING FRAMEWORK, SPRING BOOT & HIBERNATE (JD: Core, AOP, Data, MVC)

### A. Spring Core, Bean Lifecycle & Dependency Injection

- **`[ID: 2565]` Dependency Injection (DI) là gì? Spring cài đặt DI thế nào?**
  - *Bản chất:* Tách rời việc tạo dependency ra khỏi đối tượng sử dụng nó. Có 3 kiểu: Field Injection (`@Autowired`), Setter Injection, và Constructor Injection. Luôn ưu tiên **Constructor Injection** vì: bắt buộc dependency không thể null (immutability), phát hiện sớm circular dependency, và dễ viết unit test không cần Spring context.
- **`[ID: 3501]` Auto-configuration trong Spring Boot hoạt động thế nào?**
  - *Bản chất:* Khi khởi động, `@EnableAutoConfiguration` kích hoạt thông qua file metadata `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` (Spring Boot 3) hoặc `spring.factories` (Spring Boot 2). Nó quét các configuration class và áp dụng các điều kiện kiểm tra (Conditionals) như `@ConditionalOnClass`, `@ConditionalOnMissingBean`, `@ConditionalOnProperty` để tự động tạo Bean chỉ khi thỏa mãn điều kiện.
- **`[ID: 3502]` Bean scope trong Spring là gì? Singleton và Prototype khác nhau thế nào?**
  - *Bản chất:* Singleton (mặc định): duy nhất 1 instance trong Spring IoC container (chú ý: phải thiết kế stateless để thread-safe). Prototype: mỗi lần request/inject là 1 instance mới hoàn toàn.
- **`[ID: 96104]` Inject một bean scope `prototype` vào bean `singleton` thì mỗi lần dùng có ra instance mới không?**
  - *Bản chất:* **KHÔNG!** Vì Singleton bean chỉ được khởi tạo và inject dependency đúng 1 lần duy nhất lúc container startup $\to$ prototype bean bị giữ cố định suốt vòng đời của singleton. Giải pháp: Dùng `ObjectProvider<MyPrototype>`, `@Lookup` method injection, hoặc cấu hình `proxyMode = ScopedProxyMode.TARGET_CLASS`.
- **`[ID: 96105]` Đặt `@Bean` trong class `@Component` thay vì `@Configuration` thì khác gì?**
  - *Bản chất:* `@Configuration` dùng CGLIB proxy để wrap class (Full mode). Khi method A gọi method B có `@Bean`, nó sẽ intercept để trả về bean có sẵn trong container (giữ tính singleton). Với `@Component` (Lite mode), không có proxy CGLIB $\to$ gọi trực tiếp method B sẽ sinh ra một đối tượng Java thuần mới, phá vỡ tính Singleton của Spring bean.
- **`[ID: 3507]` Circular dependency trong Spring là gì? Cách phát hiện và fix?**
  - *Bản chất:* Bean A inject Bean B và Bean B lại inject Bean A. Từ Spring Boot 2.6+, circular dependency bị cấm mặc định (`BeanCurrentlyInCreationException`). Cách giải quyết: Refactor tách logic chung ra Bean C, dùng Event Listener, hoặc giải pháp tình thế là thêm `@Lazy` vào một bên.
- **`[ID: 96115]` Một bean khai báo cả `@PostConstruct`, `InitializingBean` và `initMethod` thì thứ tự chạy ra sao?**
  - *Bản chất:* Thứ tự chạy: (1) `@PostConstruct` (annotation-based JSR-250) $\to$ (2) `afterPropertiesSet()` của interface `InitializingBean` $\to$ (3) `initMethod` cấu hình trong `@Bean(initMethod = "...")`.

### B. Spring AOP & Proxies (Bản chất AOP & Giao dịch)

- **`[ID: 96106]` Spring chọn JDK dynamic proxy hay CGLIB proxy dựa trên tiêu chí gì?**
  - *Bản chất:* Quy tắc gốc: Nếu target class implements interface $\to$ dùng **JDK Dynamic Proxy** (dựa trên reflection và interface). Nếu không implements interface $\to$ dùng **CGLIB** (tạo subclass bytecode lúc runtime). Tuy nhiên, từ Spring Boot 2.x+, cấu hình mặc định đã chuyển sang ưu tiên **CGLIB** (`spring.aop.proxy-target-class=true`) cho cả trường hợp có interface.
- **`[ID: 96114]` Đặt `@Transactional` lên method `private` hoặc method `final` thì có chạy không?**
  - *Bản chất:* **KHÔNG chạy transaction!** Vì Spring AOP tạo proxy bọc ngoài target class: CGLIB không thể override method `final` hay method `private`. Đặc biệt: nếu một public method không có `@Transactional` gọi nội bộ (self-invocation `this.otherMethod()`) sang method có `@Transactional` trong cùng một class, transaction cũng **KHÔNG** hoạt động vì cuộc gọi này không đi qua AOP Proxy.

### C. Spring Web MVC & Rest APIs

- **`[ID: 3511]` `DispatcherServlet` trong Spring MVC hoạt động như thế nào?**
  - *Bản chất:* Là Front Controller nhận mọi HTTP request: (1) Gửi request tới `HandlerMapping` để tìm Handler (Controller method) phù hợp $\to$ (2) Chuyển qua `HandlerAdapter` để thực thi Controller $\to$ (3) Thực thi Interceptors (preHandle) $\to$ (4) Gọi Controller $\to$ (5) Chuyển kết quả qua `HttpMessageConverter` (với `@ResponseBody`) để parse JSON/XML hoặc qua `ViewResolver` (với MVC truyền thống) $\to$ (6) Trả response về cho client.
- **`[ID: 3525]` `@ControllerAdvice` và `@ExceptionHandler` dùng để làm gì?**
  - *Bản chất:* Xử lý tập trung toàn bộ exception của ứng dụng. Bắt các exception phát sinh từ controller, chuyển đổi thành mã HTTP status code chuẩn và format response thống nhất (Spring Boot 3 chuẩn hóa bằng RFC 7807 `ProblemDetail`).
- **`[ID: 96160]` Frontend gọi API bị lỗi CORS, request `OPTIONS` trả về 401 dù đã có `@CrossOrigin`. Nguyên nhân và cách sửa?**
  - *Bản chất:* Trình duyệt gửi Preflight request (HTTP method `OPTIONS`) không mang token Authorization. Nếu Spring Security chặn request này trước khi nó kịp đến Spring MVC DispatcherServlet (nơi đặt `@CrossOrigin`), Security sẽ trả về 401 Unauthorized. Giải pháp: Cấu hình `http.cors(Customizer.withDefaults())` trong `SecurityFilterChain` và cấu hình bean `CorsConfigurationSource`.

### D. Hibernate & Spring Data JPA (Gotchas & Performance Tuning)

- **`[ID: 3514]` N+1 query problem trong JPA là gì? Cách fix?**
  - *Bản chất:* Khi query 1 danh sách N phần tử có quan hệ Lazy (ví dụ Order có nhiều OrderItem), JPA chạy 1 câu query lấy N Order, sau đó trong vòng lặp truy cập `order.getItems()`, JPA chạy thêm N câu query riêng lẻ $\to$ tổng $N+1$ câu query làm sập DB.
  - *Giải pháp:* Dùng `JOIN FETCH` trong JPQL, khai báo `@EntityGraph(attributePaths = {"items"})`, hoặc đặt cấu hình `@BatchSize(size = 50)`.
- **`[ID: 96151]` `LazyInitializationException` xảy ra khi nào? Vì sao trên môi trường dev không thấy nhưng lên production lại gặp?**
  - *Bản chất:* Xảy ra khi truy cập lazy association sau khi Hibernate Session / Persistence Context đã đóng. Ở môi trường dev, cấu hình `spring.jpa.open-in-view=true` (OSIV) thường được bật mặc định $\to$ Session mở xuyên suốt cả tầng Controller/View. Lên production hoặc khi chạy trong async thread / scheduled task, OSIV bị tắt $\to$ ném ngoại lệ. Khắc phục bằng DTO projection hoặc fetch join từ repository layer.
- **`[ID: 96154]` Vì sao sửa field của entity trong method `@Transactional` mà không gọi `save()` thì DB vẫn được cập nhật?**
  - *Bản chất:* Cơ chế **Dirty Checking** của Hibernate. Khi entity được load vào persistence context, Hibernate lưu một snapshot trạng thái ban đầu của entity. Khi transaction commit, Hibernate so sánh entity hiện tại với snapshot. Nếu phát hiện thay đổi (dirty), nó sẽ tự động sinh và thực thi câu lệnh SQL `UPDATE`.
- **`[ID: 96155]` `@EntityGraph` và `join fetch` khác nhau thế nào? Khi nào chọn cái nào để chữa N+1?**
  - *Bản chất:* `join fetch` được viết cứng trong câu query JPQL (luôn biến thành SQL INNER/LEFT JOIN). `@EntityGraph` là cơ chế linh hoạt được định nghĩa độc lập (thường sinh LEFT OUTER JOIN), cho phép áp dụng trên Spring Data derived queries (`findById`, `findAll`) mà không cần viết lại toàn bộ câu query.
- **`[ID: 3530]` Transaction propagation trong Spring: các loại phổ biến là gì?**
  - *Bản chất:* 
    - `REQUIRED` (mặc định): Tham gia transaction hiện có, nếu chưa có thì tạo mới.
    - `REQUIRES_NEW`: Luôn tạo transaction mới độc lập, tạm dừng (suspend) transaction hiện tại.
    - `NESTED`: Chạy bên trong transaction cha bằng cơ chế Savepoint của JDBC (rollback inner không làm rollback outer).
- **`[ID: 96100]` Method có `@Transactional` ném checked exception thì transaction có rollback không?**
  - *Bản chất:* **KHÔNG!** Quy ước mặc định của Spring Transaction chỉ tự động rollback đối với `RuntimeException` (Unchecked) và `Error`. Nếu ném `Exception` đã kiểm tra (Checked Exception như `IOException`, `SQLException`), transaction vẫn **COMMIT**. Muốn rollback bắt buộc phải khai báo tường minh: `@Transactional(rollbackFor = Exception.class)`.
- **`[ID: 96112]` Đã `try/catch` nuốt exception rồi mà vẫn nhận `UnexpectedRollbackException: Transaction rolled back because it has been marked as rollback-only` — vì sao?**
  - *Bản chất:* Cả method cha và con đều dùng propagation `REQUIRED` (chung 1 transaction). Khi method con bị ném exception, Spring AOP đánh dấu cờ `rollbackOnly = true`. Dù method cha có `try/catch` bắt exception đó thì cờ rollback đã được kích hoạt $\to$ đến khi method cha kết thúc và cố commit, Spring phát hiện cờ này và ném `UnexpectedRollbackException`.
- **`[ID: 96158]` Hai người cùng mở một đơn hàng và cùng bấm lưu, người sau ghi đè người trước. Em thiết kế luồng chống việc này thế nào?**
  - *Bản chất:* Áp dụng **Optimistic Locking** bằng annotation `@Version` trên entity. Khi update, Hibernate tự động thêm `WHERE id = ? AND version = ?`. Nếu bản ghi đã bị người khác sửa trước, số version tăng lên $\to$ câu update ảnh hưởng 0 dòng $\to$ Hibernate ném `OptimisticLockException` để ứng dụng thông báo conflict cho người dùng. Nếu xung đột quá thường xuyên, dùng **Pessimistic Locking** (`@Lock(LockModeType.PESSIMISTIC_WRITE)` $\to$ `SELECT FOR UPDATE`).
- **`[ID: 96163]` Import 100.000 bản ghi bằng `saveAll()` rất chậm. Em đã đặt `hibernate.jdbc.batch_size=50` mà log vẫn ra từng câu INSERT một. Vì sao?**
  - *Bản chất:* Entity đang dùng khóa chính `@GeneratedValue(strategy = GenerationType.IDENTITY)`. Với IDENTITY, Hibernate bắt buộc phải thực thi ngay từng câu `INSERT` vào DB để lấy ID tự tăng do database sinh ra về gán cho Entity $\to$ **vô hiệu hóa hoàn toàn cơ chế JDBC batching**. Giải pháp: chuyển sang chiến lược `SEQUENCE` (kèm sequence allocationSize) hoặc dùng Spring `JdbcTemplate.batchUpdate()`.
- **`[ID: 96164]` Production báo `HikariPool-1 - Connection is not available, request timed out after 30000ms`. Em chẩn đoán và xử lý thế nào?**
  - *Bản chất:* Cạn kiệt Connection Pool. Nguyên nhân thường do: giữ transaction quá lâu (gọi external 3rd-party API hoặc xử lý tính toán nặng bên trong khối `@Transactional`), thiếu index khiến query chạy nhiều giây, hoặc leak connection do không đóng stream/cursor. Công thức sizing của HikariCP: $\text{Pool Size} = 2 \times N_{cpu} + \text{effective\_spindle\_count}$.

---

## 4. TRỤ CỘT 3: REDIS & CACHING SOLUTIONS (JD: Web servers, Redis)

- **`[ID: 2219]` Redis là gì và tại sao nó có tốc độ cực nhanh?**
  - *Bản chất:* In-memory data store. Redis cực nhanh vì: (1) Lưu trữ toàn bộ dữ liệu trên RAM (tốc độ nanosecond so với millisecond của đĩa), (2) Single-threaded event loop xử lý request dựa trên non-blocking I/O multiplexing (`epoll`/`kqueue`) $\to$ hoàn toàn loại bỏ overhead của thread context switching và khóa lock, (3) Cấu trúc dữ liệu nội bộ được tối ưu hóa ở mức C (SDS, skiplist, ziplist, intset).
- **`[ID: 2220]` Các kiểu dữ liệu trong Redis: String, Hash, List, Set, Sorted Set dùng khi nào?**
  - *Bản chất:* 
    - `String`: Cache JSON, session, bộ đếm atomic (`INCR`).
    - `Hash`: Lưu object có nhiều field (cho phép `HGET`, `HSET` từng field mà không cần serialize lại cả object).
    - `List`: Message queue đơn giản (`LPUSH` + `BRPOP`), timeline hoạt động.
    - `Set`: Lưu các phần tử duy nhất, tính toán tập hợp (`SINTER`, `SUNION` để tìm bạn chung, tag).
    - `Sorted Set (ZSet)`: Lưu phần tử kèm điểm số (Score) dùng Skiplist $\to$ BXH Leaderboard, sliding window rate limiter.
- **`[ID: 2263]` Redis Sorted Set: cách implement leaderboard real-time và sliding window rate limiter?**
  - *Bản chất:* 
    - *Leaderboard:* `ZADD leaderboard score userId`, lấy top: `ZREVRANGE leaderboard 0 9 WITHSCORES` (độ phức tạp $O(\log N + M)$).
    - *Sliding Window Rate Limiter:* Mỗi request thêm entry vào ZSet với score và member là timestamp hiện tại. Xóa các request cũ ngoài cửa sổ: `ZREMRANGEBYSCORE key 0 (now - window)`. Đếm số request còn lại bằng `ZCARD key`. Nếu `count < limit` thì cho phép, ngược lại block. Đặt TTL cho key.
- **`[ID: 2265]` Các caching strategies: Cache-Aside, Write-Through, Write-Behind — khi nào dùng cái nào?**
  - *Bản chất:* 
    - *Cache-Aside (Lazy Loading - phổ biến nhất):* Ứng dụng đọc từ cache $\to$ nếu miss thì đọc từ DB $\to$ ghi vào cache. Khi update: ghi DB rồi xóa (evict) cache.
    - *Write-Through:* Ứng dụng ghi vào cache, cache tự động ghi đồng bộ xuống DB trước khi báo thành công.
    - *Write-Behind (Write-Back):* Ứng dụng ghi vào cache, cache gom batch và ghi bất đồng bộ xuống DB (tốc độ ghi cực cao nhưng rủi ro mất dữ liệu nếu Redis crash).
- **`[ID: 2234]` & `[ID: 91205]` Cache stampede (thundering herd), Cache Avalanche và Cache Penetration là gì? Cách phòng tránh?**
  - *Bản chất:* 
    - *Cache Avalanche (Tuyết lở):* Hàng ngàn key hết hạn cùng thời điểm $\to$ đồng loạt truy vấn DB. *Khắc phục:* Cộng thêm một khoảng thời gian ngẫu nhiên (Jitter: TTL = base + random(0, 300s)).
    - *Cache Breakdown / Stampede:* Một Key cực hot (Hot key) hết hạn $\to$ hàng triệu request đồng thời chọc thẳng vào DB. *Khắc phục:* Dùng Mutex Lock (Distributed Lock) để chỉ cho 1 thread tính toán nạp lại cache, hoặc Logical Expiration (chạy thread ngầm cập nhật trước khi hết hạn).
    - *Cache Penetration:* Truy vấn dữ liệu không hề tồn tại (cả cache và DB đều không có) $\to$ request liên tục đánh sập DB. *Khắc phục:* Cache giá trị `null` với TTL ngắn, hoặc dùng **Bloom Filter** chặn ngay từ tầng ngoài.
- **`[ID: 2221]` Redis persistence: phân biệt RDB và AOF, khi nào nên dùng loại nào?**
  - *Bản chất:* RDB (Snapshots định kỳ): dump toàn bộ RAM ra file nhị phân `dump.rdb` (file gọn, phục hồi cực nhanh nhưng mất dữ liệu giữa 2 lần snapshot). AOF (Append-Only File): ghi lại mọi lệnh write vào file log `appendonly.aof` với fsync (an toàn dữ liệu cao, fsync everysec mất tối đa 1s data nhưng file lớn). Production khuyến nghị dùng **Hybrid Persistence** (RDB preamble + AOF log).
- **`[ID: 2225]` & `[ID: 2271]` Redis eviction policies: LRU, LFU, allkeys vs volatile?**
  - *Bản chất:* Kích hoạt khi bộ nhớ chạm ngưỡng `maxmemory`:
    - `allkeys-lru` (Least Recently Used trên toàn bộ key) vs `volatile-lru` (chỉ xét key có set TTL).
    - `allkeys-lfu` (Least Frequently Used - đếm tần suất truy cập). Hệ thống cache chung nên chọn `allkeys-lru` hoặc `allkeys-lfu`.
- **`[ID: 2266]` Distributed lock với Redis: implement như thế nào? Redlock algorithm giải quyết vấn đề gì?**
  - *Bản chất:* 
    - *Single Node:* `SET resource_name my_random_value NX PX 30000`. `NX`: chỉ set nếu chưa tồn tại, `PX`: TTL 30s. Khi giải phóng lock, **bắt buộc** dùng **Lua Script** để so sánh `my_random_value` xem có đúng lock do mình giữ hay không trước khi `DEL` (tránh xóa nhầm lock của thread khác khi bị quá hạn).
    - *Redlock:* Dùng trên cluster gồm N master node độc lập (thường là 5 nodes). Client lần lượt acquire lock trên cả 5 node với timeout ngắn. Nếu acquire thành công trên quá nửa node ($\ge 3$ nodes) và tổng thời gian < TTL thì lock thành công.
- **`[ID: 98009]` Hot key trong Redis Cluster là gì? Phát hiện và xử lý ra sao?**
  - *Bản chất:* Một key nhận lưu lượng truy cập khổng lồ tập trung vào đúng 1 node chứa hash slot của key đó $\to$ nghẽn CPU/Network của node đó dù cả cluster vẫn rảnh. Giải pháp: Thêm **Local Cache** (Caffeine in-memory cache) ngay tại backend service, hoặc kỹ thuật **Key Salting** (tách `hot_key` thành `hot_key_1`, `hot_key_2`, ... để dàn đều sang các node).

---

## 5. TRỤ CỘT 4: DATABASES - RDBMS & NOSQL (JD: PostgreSQL, MySQL, NoSQL, MongoDB, Cassandra)

### A. RDBMS Core: ACID, Isolation Levels & MVCC

- **`[ID: 92005]` & `[ID: 97850]` ACID là gì? Giải thích từng thuộc tính trong thực tế.**
  - *Bản chất:*
    - **Atomicity (Nguyên tử):** All or nothing. Đảm bảo bằng Undo Log (MySQL) hoặc WAL/MVCC (Postgres).
    - **Consistency (Nhất quán):** Dữ liệu tuân thủ mọi ràng buộc, khóa ngoại, unique constraint trước và sau giao dịch.
    - **Isolation (Cô lập):** Các giao dịch đồng thời không làm sai lệch nhau. Đảm bảo bằng Lock và MVCC.
    - **Durability (Bền vững):** Khi commit thành công, dữ liệu không bị mất kể cả sập nguồn. Đảm bảo bằng Redo Log / Write-Ahead Logging (WAL).
- **`[ID: 92007]`, `[ID: 8110]` & `[ID: 97851]` Bốn mức Isolation Levels và các hiện tượng (Anomalies) tương ứng?**
  - *Bản chất:*
    1. `Read Uncommitted`: Nguy cơ **Dirty Read** (đọc dữ liệu chưa commit của transaction khác).
    2. `Read Committed` (Mặc định của Postgres & Oracle): Chặn Dirty Read. Vẫn dính **Non-repeatable Read** (đọc lại cùng 1 dòng thì dữ liệu đã bị sửa bởi transaction khác đã commit).
    3. `Repeatable Read` (Mặc định của MySQL InnoDB): Chặn Dirty Read & Non-repeatable Read. Postgres cũng chặn luôn Phantom Read ở mức này nhờ Snapshot MVCC.
    4. `Serializable`: Mức cao nhất, loại bỏ hoàn toàn **Phantom Read** và **Write Skew** bằng cách tuần tự hóa giao dịch (hoặc Serializable Snapshot Isolation - SSI).
- **`[ID: 8134]` & `[ID: 97800]` MVCC trong PostgreSQL là gì? `xmin`/`xmax` hoạt động ra sao?**
  - *Bản chất:* Multi-Version Concurrency Control cho phép "Readers do not block Writers, and Writers do not block Readers". Trong Postgres, mỗi câu `UPDATE` không ghi đè dữ liệu cũ mà đánh dấu kết thúc phiên bản cũ (`xmax` được set) và tạo 1 tuple (dòng) mới với `xmin` là transaction ID hiện tại. Một câu `DELETE` thực chất chỉ set `xmax`. Nhờ đó, transaction khác mở trước vẫn nhìn thấy phiên bản cũ hợp lệ.
- **`[ID: 97801]` & `[ID: 97802]` Dead tuple, Table bloat và Autovacuum trong PostgreSQL là gì?**
  - *Bản chất:* Các tuple cũ có `xmax` mà không còn transaction nào có thể nhìn thấy gọi là **Dead Tuple**. Dead tuple tích tụ làm bảng phình to (**Table Bloat**), làm chậm cả Seq Scan lẫn Index Scan. **Autovacuum** là tiến trình ngầm định kỳ quét dọn dead tuple để tái sử dụng không gian đĩa cho các insert/update sau. Nếu bảng update dồn dập mà autovacuum không kịp chạy, bảng sẽ phình to khủng khiếp.

### B. Indexing, Sargable Queries & Query Optimization

- **`[ID: 92009]` & `[ID: 93016]` B-Tree và B+ Tree khác nhau thế nào? Vì sao database dùng B+ Tree?**
  - *Bản chất:* Trong B-Tree, cả node gốc, node trung gian và node lá đều chứa data/pointer tới data. Trong **B+ Tree**, các node trung gian **chỉ chứa key** để điều hướng, toàn bộ data/row pointer chỉ nằm ở **node lá**. Các node lá được liên kết đôi tuần tự với nhau.
  - *Ưu điểm của B+ Tree:* (1) Node trung gian chứa được nhiều key hơn $\to$ cây lùn hơn (thường chỉ cao 3-4 tầng cho hàng chục triệu bản ghi), giảm tối đa số lần đọc I/O đĩa. (2) Truy vấn theo khoảng (**Range Scan**) cực nhanh nhờ duyệt dọc theo danh sách liên kết ở lá.
- **`[ID: 92011]`, `[ID: 8107]` & `[ID: 97761]` Composite Index: Leftmost Prefix Rule và thứ tự sắp xếp cột?**
  - *Bản chất:* Index trên `(A, B, C)` chỉ hoạt động khi query có cột `A`. Nếu query `WHERE B = 1 AND C = 2`, index **hoàn toàn vô dụng**.
  - *Quy tắc vàng đặt thứ tự:* Đặt các cột tìm kiếm đẳng thức (`=`) lên đầu, sau đó mới đến cột tìm kiếm theo khoảng (`>`, `<`, `BETWEEN`), và cuối cùng là cột dùng cho `ORDER BY`. Ví dụ `WHERE tenant_id = ? AND status = ? AND created_at > ?` $\to$ thứ tự index tối ưu là `(tenant_id, status, created_at)`.
- **`[ID: 97751]` Vì sao `WHERE DATE(created_at) = '2026-01-01'` không dùng được index trên `created_at`?**
  - *Bản chất:* Đây là **Non-sargable query**. Khi bọc hàm `DATE()` quanh cột, database không thể dùng giá trị đã sắp xếp trong B-Tree mà phải duyệt toàn bộ bảng và tính hàm cho từng dòng.
  - *Sửa lại thành Sargable:* `WHERE created_at >= '2026-01-01 00:00:00' AND created_at < '2026-01-02 00:00:00'`.
- **`[ID: 97752]` Đánh index lên cột `is_active` hay `status` (ít giá trị phân biệt) có tác dụng không?**
  - *Bản chất:* Phụ thuộc vào **Selectivity (Độ chọn lọc)**. Nếu `status = 'PENDING'` chiếm 95% bảng, query tìm pending sẽ bị Seq Scan vì optimizer thấy đọc index rồi nhảy sang heap còn tốn I/O hơn. Nhưng nếu `status = 'FAILED'` chỉ chiếm 0.1%, index sẽ phát huy tác dụng cực lớn. Tốt nhất trong trường hợp này là dùng **Partial Index** (`CREATE INDEX idx_failed ON orders(created_at) WHERE status = 'FAILED'`).
- **`[ID: 97756]` Đọc output `EXPLAIN ANALYZE` thế nào? `cost` và `actual time` khác nhau ra sao?**
  - *Bản chất:* `EXPLAIN` chỉ là ước tính của Planner dựa trên thống kê (Statistics). `EXPLAIN ANALYZE` thực sự chạy truy vấn và in ra thời gian thực tế. `cost` là đơn vị tính toán trừu tượng của optimizer; `actual time` tính bằng mili-giây. Chú ý số **rows ước tính** so với **actual rows**: nếu lệch nhau hàng nghìn lần, nghĩa là thống kê DB đã quá cũ $\to$ cần chạy `ANALYZE tableName`.
- **`[ID: 97760]` Cần thêm index cho bảng 200 triệu dòng đang chạy production. Làm thế nào để không khóa bảng?**
  - *Bản chất:* Lệnh `CREATE INDEX` mặc định sẽ chiếm khóa `SHARE LOCK`, chặn toàn bộ thao tác ghi (`INSERT`, `UPDATE`, `DELETE`) trên bảng trong suốt thời gian tạo index.
  - *Giải pháp:* Trong PostgreSQL dùng `CREATE INDEX CONCURRENTLY`. Trong MySQL dùng `ALGORITHM=INPLACE, LOCK=NONE`.

### C. NoSQL (MongoDB, Cassandra) vs SQL

- **`[ID: 92017]` & `[ID: 92019]` SQL và NoSQL khác nhau ở đâu? Khi nào chọn cái nào?**
  - *Bản chất:* SQL tuân thủ schema chặt chẽ, tối ưu cho quan hệ phức tạp, transaction ACID, scale dọc. NoSQL schema linh hoạt, thiết kế cho scale ngang (horizontal scaling), chấp nhận eventual consistency. Chọn SQL cho tài chính, hóa đơn, quản trị nghiệp vụ. Chọn NoSQL khi dữ liệu phi cấu trúc, lưu lượng ghi khổng lồ (IoT logs, clickstream).
- **`[ID: 92018]` 4 loại NoSQL chính và đại diện tiêu biểu?**
  - *Bản chất:* (1) Key-Value (Redis, DynamoDB), (2) Document Store (MongoDB - lưu BSON), (3) Wide-Column Store (Apache Cassandra, ScyllaDB - phân vùng theo Partition Key, tối ưu ghi), (4) Graph Database (Neo4j - quan hệ mạng xã hội, fraud detection).
- **`[ID: 92036]` Trong MongoDB, khi nào nên Embed (nhúng) và khi nào nên Reference (tham chiếu)?**
  - *Bản chất:* 
    - *Embed (1-to-1, 1-to-few):* Dữ liệu con luôn đi kèm dữ liệu cha và không phát triển vô hạn (ví dụ User có 1 vài Address). Đọc 1 lần ra hết, không cần join. (Giới hạn: Document size $\le 16\text{MB}$).
    - *Reference (1-to-many, many-to-many):* Dữ liệu con tăng trưởng liên tục hoặc được tái sử dụng ở nhiều nơi (ví dụ Order và Products, User và Logs).
- **`[ID: 92067]` B-Tree và LSM-Tree khác nhau thế nào? Vì sao NoSQL ghi-nhiều (Cassandra) hay dùng LSM-tree?**
  - *Bản chất:* B-Tree thực hiện ghi ngẫu nhiên (Random I/O) để cập nhật in-place trên trang đĩa. **LSM-Tree (Log-Structured Merge-Tree)** chuyển đổi toàn bộ thao tác ghi thành ghi tuần tự (Sequential I/O): ghi vào MemTable trên RAM và Append-only log (CommitLog) $\to$ sau đó flush tuần tự ra đĩa thành các file SSTable immutable $\to$ tốc độ ghi cực nhanh, chịu tải ghi vượt trội hơn B-Tree rất nhiều lần.

---

## 6. TRỤ CỘT 5: SYSTEM DESIGN & KIẾN TRÚC PHÂN TÁN (JD: System Design & Algorithms)

- **`[ID: 20024]` & `[ID: 98107]` Consistent Hashing là gì? Virtual Node giải quyết vấn đề gì?**
  - *Bản chất:* Khi sharding bằng modulo $hash(key) \% N$, việc thêm/bớt node làm $N$ thay đổi $\to$ gần như $100\%$ key bị dịch chuyển. Consistent Hashing ánh xạ cả node và key lên một vòng tròn băm ($0$ đến $2^{32}-1$). Khi thêm/bớt 1 node, chỉ có $\frac{1}{N}$ số key cần di chuyển. **Virtual Nodes** ánh xạ 1 server vật lý thành hàng trăm node ảo trên vòng tròn để phân bổ đều dữ liệu, tránh tình trạng điểm nóng (hotspot) do phân bố băm không đều.
- **`[ID: 20025]` Idempotency Key là gì và làm thế nào để thiết kế một API thanh toán an toàn khi client retry?**
  - *Bản chất:* Đảm bảo gọi API 1 lần hay $N$ lần kết quả đều như nhau. Client sinh ra `Idempotency-Key` (UUIDv4) gửi trong HTTP Header. Backend nhận request: Dùng Redis `SET key NX EX 120` để lock. Nếu key đã có $\to$ request đang được xử lý (trả 409 hoặc chờ). Nếu chưa $\to$ thực thi thanh toán trong DB transaction có lưu `idempotency_key` vào bảng `processed_requests` (Unique Constraint) kèm response payload. Các lần retry sau chỉ việc đọc payload đã lưu trả về ngay.
- **`[ID: 2012]` & `[ID: 98161]` Rate Limiter: Các thuật toán phổ biến và thiết kế dùng chung?**
  - *Bản chất:* 
    - *Token Bucket:* Token được bơm vào xô theo tốc độ cố định; request lấy token ra; cho phép burst traffic.
    - *Leaky Bucket:* Request vào xô và được xử lý theo tốc độ ổn định như giọt nước nhỏ giọt.
    - *Sliding Window Counter:* Kết hợp counter của cửa sổ trước và cửa sổ hiện tại để tính toán tỷ lệ, memory gọn và chính xác.
    - *Cài đặt:* Dùng Redis kết hợp Lua script chạy atomic trên API Gateway.
- **`[ID: 2020]` Circuit Breaker Pattern là gì? (Resilience4j trong Spring Boot)**
  - *Bản chất:* Ngăn chặn lỗi dây chuyền (Cascading Failure) khi service phụ thuộc bị chậm hoặc chết. Có 3 trạng thái:
    - `CLOSED`: Hoạt động bình thường. Nếu tỷ lệ lỗi vượt ngưỡng (ví dụ 50%) $\to$ chuyển sang `OPEN`.
    - `OPEN`: Mọi request bị từ chối ngay lập tức (fail fast) hoặc gọi hàm Fallback, không làm nghẽn thread pool.
    - `HALF-OPEN`: Sau khoảng thời gian chờ (sleep window), cho phép một lượng nhỏ request thử nghiệm đi qua. Nếu thành công $\to$ về `CLOSED`, thất bại $\to$ quay lại `OPEN`.
- **`[ID: 2021]` & `[ID: 98263]` Saga Pattern trong Microservices: Choreography vs Orchestration?**
  - *Bản chất:* Quản lý phân tán transactions bằng chuỗi các local transaction. Nếu 1 bước lỗi, chạy các Compensating Transactions (giao dịch bù trừ) để rollback dữ liệu.
    - *Choreography:* Các service giao tiếp qua Message Broker (Kafka/RabbitMQ), tự lắng nghe event và kích hoạt bước tiếp theo (phù hợp hệ thống ít service, đơn giản).
    - *Orchestration:* Có 1 Orchestrator tập trung điều phối, ra lệnh cho từng service thực thi và quản lý state machine (phù hợp quy trình phức tạp, dễ theo dõi).
- **`[ID: 91220]` & `[ID: 2247]` Transactional Outbox Pattern giải quyết vấn đề Dual-Write thế nào?**
  - *Bản chất:* Khi service vừa cần cập nhật DB vừa cần publish event sang Kafka, nếu 1 trong 2 thất bại sẽ gây mất nhất quán (Dual-Write problem).
  - *Giải pháp:* Trong cùng một DB transaction, ghi dữ liệu nghiệp vụ và ghi thêm 1 bản ghi event vào bảng `outbox_table`. Sau đó một tiến trình nền (hoặc công cụ CDC như **Debezium** đọc WAL log) sẽ đọc bảng outbox để bắn sang Kafka và đánh dấu đã gửi. Đảm bảo At-least-once delivery tuyệt đối.
- **`[ID: 98151]` Thiết kế ví điện tử (Ledger): Làm thế nào để số dư không bao giờ sai?**
  - *Bản chất:* 
    - Tuyệt đối không chỉ dùng một cột `balance = balance - amount`.
    - Phải dùng mô hình **Sổ cái kép (Double-Entry Bookkeeping)**: Mọi giao dịch tiền đều có 2 dòng đối ứng: Cột Nợ (Debit) và Cột Có (Credit), tổng luôn bằng 0.
    - Dữ liệu sổ cái là **Immutable (Chỉ chèn INSERT, không bao giờ UPDATE)**. Muốn điều chỉnh phải chèn một transaction đối soát bù trừ.
    - Số dư là snapshot tính toán từ lịch sử giao dịch kết hợp Optimistic Locking trên bảng Account.
- **`[ID: 98152]` Thiết kế hệ thống Flash Sale / Đặt vé: Chống bán vượt (Overselling) khi traffic tăng vọt?**
  - *Bản chất:* 
    - Không thể để hàng chục nghìn request chọc thẳng vào MySQL/PostgreSQL.
    - Tách làm 3 lớp:
      1. *Lớp 1 (Redis):* Nạp trước tồn kho lên Redis. Dùng **Redis Lua Script** để thực hiện kiểm tra và trừ tồn kho nguyên tử (`if redis.call('get', key) > 0 then return redis.call('decr', key) else return 0 end`).
      2. *Lớp 2 (Queue):* Nếu trừ Redis thành công $\to$ bắn message đặt hàng vào Kafka/RabbitMQ.
      3. *Lớp 3 (Worker & DB):* Worker lấy message từ queue, chèn đơn hàng và trừ tồn kho trong DB bằng câu lệnh an toàn: `UPDATE inventory SET stock = stock - 1 WHERE id = ? AND stock > 0`.

---

## 7. TRỤ CỘT 6 (BONUS): KAFKA & DOCKER/K8S (LỢI THẾ CỦA BACKEND 2+ YRS)

- **`[ID: 2202]` Kiến trúc Apache Kafka: Topic, Partition, Offset, Consumer Group?**
  - *Bản chất:* Topic được chia thành nhiều **Partition** (đơn vị scale song song). Mỗi partition là một commit log tuần tự, mỗi message có một số **Offset** duy nhất. Các consumer trong cùng một **Consumer Group** chia nhau tiêu thụ các partition (mỗi partition tại một thời điểm chỉ do đúng 1 consumer trong group đọc).
- **`[ID: 2205]` Thứ tự message trong Kafka được đảm bảo như thế nào?**
  - *Bản chất:* Kafka **CHỈ** đảm bảo thứ tự message trên **cùng một Partition**. Nếu muốn các event của cùng một người dùng theo đúng thứ tự thời gian, bắt buộc phải đặt `key = userId` khi publish để Kafka hash vào cùng một partition.
- **`[ID: 2211]` Exactly-once semantics (EOS) trong Kafka hoạt động thế nào?**
  - *Bản chất:* Kết hợp Idempotent Producer (`enable.idempotence=true` $\to$ broker gắn PID và sequence number để loại bỏ message trùng lặp khi retry) và Kafka Transactions (`beginTransaction`, `sendOffsetsToTransaction`, `commitTransaction`) theo mô hình Consume-Transform-Produce.
- **`[ID: 2214]` Dead Letter Queue (DLQ) trong Kafka xử lý lỗi thế nào?**
  - *Bản chất:* Khi consumer gặp lỗi không thể khắc phục (malformed data, lỗi logic), nếu cứ retry tại chỗ sẽ làm tắc nghẽn luồng đọc (consumer lag tăng cao). Thay vào đó, sau $N$ lần retry có backoff, consumer chuyển message hỏng sang một topic riêng gọi là **DLQ** để đội vận hành phân tích xử lý sau, giải phóng luồng chính.
- **Docker Multi-Stage Build cho Spring Boot:**
  - *Bản chất:* Dùng stage 1 (Maven/Gradle + JDK full) để compile code ra file `.jar`. Stage 2 chỉ dùng JRE Alpine/Distroless siêu nhẹ để copy file jar sang chạy. Không chạy container với quyền `root` (dùng non-root user). Kết quả: Dung lượng image giảm từ 800MB xuống dưới 150MB, triệt tiêu các lỗ hổng bảo mật từ compiler.
- **Kubernetes Liveness & Readiness Probes với Spring Boot Actuator:**
  - *Bản chất:* 
    - `Liveness Probe` (`/actuator/health/liveness`): Kiểm tra app có bị deadlock/treo ngầm không. Nếu fail $\to$ K8s kill và restart container.
    - `Readiness Probe` (`/actuator/health/readiness`): Kiểm tra app đã sẵn sàng nhận traffic chưa (đã kết nối DB, load cache xong chưa). Nếu fail $\to$ K8s ngắt route traffic khỏi Pod mà không restart.

---

## 8. PHẦN BÙ JD (NGOÀI KHO): FRONTEND & GIT (CHUẨN BỊ 100% SẴN SÀNG)

Kho câu hỏi `it-interview-spaced-repetition` thuần Backend. Để đạt 100% yêu cầu JD, đây là bộ câu hỏi chuẩn nhất mà nhà tuyển dụng thường hỏi Java Backend:

### A. Frontend (HTML/CSS, JavaScript, jQuery & ReactJS)

1. **JavaScript Event Loop: Call Stack, Web APIs, Microtask và Macrotask?**
   - *Trả lời:* Call Stack chạy đồng bộ. Khi gặp async: (1) Web APIs xử lý (Timer, DOM, Fetch). (2) Hoàn thành xong thì callback của `Promise.then`, `async/await` đẩy vào **Microtask Queue**; còn `setTimeout`, `setInterval` đẩy vào **Macrotask Queue**. (3) Sau mỗi lần Call Stack rỗng, Event Loop **luôn ưu tiên dọn sạch toàn bộ Microtask Queue trước**, rồi mới lấy 1 task từ Macrotask Queue.
2. **Closures trong JavaScript là gì? Cho ví dụ thực tế?**
   - *Trả lời:* Closure là một hàm có khả năng ghi nhớ và truy cập vào các biến thuộc phạm vi cha (lexical scope) ngay cả khi hàm cha đã thực thi xong và thoát ra khỏi call stack. Dùng để tạo private variable (data encapsulation) hoặc hàm memoize / currying.
3. **`==` và `===` trong JavaScript khác nhau thế nào?**
   - *Trả lời:* `==` (so sánh lỏng lẻo) tự động ép kiểu dữ liệu (type coercion) trước khi so sánh (ví dụ: `'5' == 5` ra `true`, `null == undefined` ra `true`). `===` (so sánh nghiêm ngặt) so sánh cả kiểu dữ liệu và giá trị mà không ép kiểu (`'5' === 5` ra `false`). Luôn khuyến nghị dùng `===`.
4. **CSS Box Model gồm những gì? `box-sizing: border-box` có tác dụng gì?**
   - *Trả lời:* Gồm: Content, Padding, Border, Margin. Mặc định `box-sizing: content-box` khiến `width` chỉ tính cho phần content (khi thêm padding/border sẽ làm phình to kích thước phần tử). Đặt `box-sizing: border-box` giúp `width` bao trọn cả content + padding + border, giúp tính toán layout trực quan và chuẩn xác.
5. **Flexbox và Grid: Khi nào dùng cái nào?**
   - *Trả lời:* Flexbox tối ưu cho bố cục **1 chiều** (1D - theo hàng ngang Row hoặc cột dọc Column, ví dụ thanh Navbar, căn giữa các phần tử). CSS Grid tối ưu cho bố cục **2 chiều** (2D - hàng và cột đồng thời, ví dụ toàn bộ layout trang web, dashboard lưới).
6. **jQuery: `$(document).ready()` và Event Delegation cho phần tử động?**
   - *Trả lời:* `$(document).ready()` đảm bảo DOM đã load xong trước khi chạy mã JS. Khi có các phần tử HTML sinh ra động (ví dụ qua AJAX), bắt sự kiện click thông thường sẽ không nhận. Phải dùng Event Delegation: `$(parent).on('click', '.dynamic-child', function() { ... })`.
7. **ReactJS: Virtual DOM và Reconciliation hoạt động thế nào?**
   - *Trả lời:* Virtual DOM là một bản sao JavaScript object nhẹ của Real DOM trên RAM. Khi State thay đổi, React tạo một cây Virtual DOM mới, so sánh với cây cũ (Diffing Algorithm), tính toán phần khác biệt tối thiểu, và chỉ cập nhật đúng những phần tử thay đổi lên Real DOM thật (Reconciliation), giúp tăng hiệu năng UI rõ rệt.
8. **React Hooks: `useState`, `useEffect`, `useCallback`, `useMemo` dùng khi nào?**
   - *Trả lời:* 
     - `useState`: Quản lý state cục bộ của functional component.
     - `useEffect`: Xử lý side effects (gọi API, subscription, cleanup timer).
     - `useMemo`: Cache lại **kết quả tính toán nặng** giữa các lần re-render.
     - `useCallback`: Cache lại **định nghĩa của một hàm** để tránh truyền hàm mới làm re-render component con.
9. **Props Drilling trong React là gì và cách giải quyết?**
   - *Trả lời:* Là tình trạng phải truyền props qua quá nhiều tầng component trung gian không dùng đến nó. Giải quyết bằng: React Context API (cho ứng dụng nhỏ/vừa, theme, user auth) hoặc State Management chuyên dụng như Redux Toolkit / Zustand.
10. **Lỗi CORS (Cross-Origin Resource Sharing) từ góc nhìn Frontend & Backend?**
    - *Trả lời:* Do chính sách Same-Origin Policy của trình duyệt chặn khi Origin (Protocol + Domain + Port) của frontend khác backend. Khắc phục: Backend phải cấu hình header `Access-Control-Allow-Origin`, hoặc trong lúc development Frontend cấu hình Proxy trong `vite.config.js` / `package.json`.

### B. Git Workflow & Collaboration

1. **`git merge` vs `git rebase` khác nhau thế nào? Quy tắc vàng khi rebase?**
   - *Trả lời:* `git merge` tạo một commit gộp (merge commit), giữ nguyên lịch sử rẽ nhánh chân thực. `git rebase` đem các commit của branch hiện tại đặt nối tiếp lên đỉnh của branch đích, tạo lịch sử commit thẳng tắp (linear history).
   - *Quy tắc vàng:* **Không bao giờ rebase trên public/shared branch (main, develop)** vì nó ghi đè commit hash, làm vỡ lịch sử làm việc của toàn bộ đồng nghiệp.
2. **Quy trình giải quyết Merge Conflict trong Git?**
   - *Trả lời:* Khi Git báo conflict $\to$ mở các file có cờ `<<<<<<< HEAD` (code nhánh hiện tại) và `>>>>>>> branch` (code nhánh ghép) $\to$ thảo luận với đồng đội để chọn code đúng hoặc giữ cả hai $\to$ lưu file $\to$ chạy `git add <file>` $\to$ hoàn thành bằng `git commit` (nếu merge) hoặc `git rebase --continue` (nếu rebase).
3. **`git cherry-pick` là gì? Khi nào dùng?**
   - *Trả lời:* Lấy một commit cụ thể từ một nhánh khác áp dụng sang nhánh hiện tại mà không cần merge cả nhánh. Thường dùng khi cần nhặt gấp một commit sửa lỗi hotfix từ nhánh `hotfix` sang nhánh `develop` hoặc `staging`.
4. **`git stash` dùng khi nào? Phân biệt `stash pop` và `stash apply`?**
   - *Trả lời:* Lưu tạm thời các thay đổi chưa commit vào một ngăn xếp khi cần chuyển nhánh gấp để làm việc khác. `git stash pop`: áp dụng lại thay đổi và xóa luôn khỏi stash stack. `git stash apply`: áp dụng lại thay đổi nhưng vẫn giữ bản lưu trong stash stack.
5. **`git reset` (soft, mixed, hard) và `git revert`?**
   - *Trả lời:* `git reset --soft` đưa HEAD về commit cũ, giữ nguyên code ở Staging area. `--mixed` giữ code ở Working directory. `--hard` xóa sạch mọi thay đổi. Chú ý: `git reset` viết lại lịch sử (chỉ dùng cục bộ). Với commit đã đẩy lên remote, bắt buộc dùng `git revert <commit>` để tạo một commit mới đảo ngược lại commit cũ một cách an toàn.

---

## 9. LỊCH TRÌNH ÔN TẬP SPACED REPETITION TRONG 14 NGÀY

Ứng dụng nguyên lý đường cong lãng quên (Ebbinghaus Forgetting Curve), chia quá trình ôn luyện 758 câu thành lộ trình 14 ngày tinh gọn:

- **Ngày 1-2: Java Core, Collections & Concurrency Internals**
  - Trọng tâm: [96004], [96005], [96058], [96061], [96062], [96063], [96065].
  - Ôn lại: Mở web app, lọc category `java`, đánh dấu "Hard" cho các câu concurrency.
- **Ngày 3-5: Spring Boot, Bean Scopes, AOP & JPA Transactions**
  - Trọng tâm: [3501], [96104], [96106], [96114], [3514], [96151], [96154], [96163], [96164].
  - Spaced Repetition: Làm lại 5 câu Java khó của Ngày 1.
- **Ngày 6-7: Redis Caching & Query Optimization (PostgreSQL/MySQL)**
  - Trọng tâm: [2219], [2263], [2265], [2266], [97751], [97756], [97760], [97761], [97800].
  - Spaced Repetition: Làm lại 5 câu Spring Gotchas của Ngày 3-4.
- **Ngày 8-9: NoSQL (MongoDB/Cassandra) & System Design Core**
  - Trọng tâm: [92036], [92067], [20024], [20025], [2012], [2021], [91220], [98151], [98152].
  - Spaced Repetition: Làm lại các câu Redis lock và DB index.
- **Ngày 10-11: Kafka, Message Queues & Docker/Kubernetes**
  - Trọng tâm: [2202], [2205], [2211], [2214], Docker multi-stage build, K8s probes.
  - Spaced Repetition: Ôn lại toàn bộ các câu đánh dấu "Hard" từ các ngày trước.
- **Ngày 12: Frontend (JS Event Loop, React Hooks) & Git Essentials**
  - Trọng tâm: 10 câu Frontend và 5 câu Git trong phần bổ sung.
- **Ngày 13-14: Mock Interview & Tổng ôn toàn diện**
  - Mở chế độ Study ngẫu nhiên trên web, luyện nói to câu trả lời tiếng Việt và tiếng Anh.
  - Tập trung giải thích theo cấu trúc: **Định nghĩa ngắn $\to$ Cơ chế internals $\to$ Gotchas/Cạm bẫy thực tế $\to$ Giải pháp tối ưu.**
