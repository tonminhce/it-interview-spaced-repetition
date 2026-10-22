/**
 * Query expansion.
 *
 * The deck is written in Vietnamese but its answers freely use English
 * technical vocabulary, and vice versa. A learner who thinks in "bộ nhớ đệm"
 * should not have to guess that the card says "cache", so queries are
 * expanded with a domain synonym table before they are matched.
 *
 * Expansion happens in *folded* space (accent-stripped, lower-cased), which
 * makes it work for queries typed without diacritics — "bo nho dem" expands
 * just like "bộ nhớ đệm".
 */
(function (global) {
  'use strict';

  var U = global.U;

  // Vietnamese → English. Ordered longest-first at expansion time so that
  // "bộ nhớ đệm phân tán" wins over "bộ nhớ đệm".
  var SYNONYMS = [
    ['bộ nhớ đệm phân tán', 'distributed cache'],
    ['bộ nhớ đệm', 'cache'],
    ['bộ đệm', 'cache'],
    ['hàng đợi tin nhắn', 'message queue'],
    ['hàng đợi', 'queue'],
    ['cơ sở dữ liệu quan hệ', 'relational database'],
    ['cơ sở dữ liệu', 'database'],
    ['bảng', 'table'],
    ['chỉ mục', 'index'],
    ['giao dịch', 'transaction'],
    ['ràng buộc', 'constraint'],
    ['lập trình hướng đối tượng', 'object oriented'],
    ['đa luồng', 'concurrency'],
    ['đa luồng', 'multithreading'],
    ['chạy song song', 'concurrency'],
    ['bộ thu gom rác', 'garbage collection'],
    ['thu gom rác', 'garbage collector'],
    ['mã bytecode', 'bytecode'],
    ['mô hình bộ nhớ', 'memory model'],
    ['bộ sưu tập', 'collection'],
    ['đa hình', 'polymorphism'],
    ['kế thừa', 'inheritance'],
    ['đóng gói', 'encapsulation'],
    ['trừu tượng', 'abstraction'],
    ['giao diện', 'interface'],
    ['lớp', 'class'],
    ['phương thức', 'method'],
    ['biến', 'variable'],
    ['đối tượng', 'object'],
    ['luồng', 'thread'],
    ['phân vùng', 'partition'],
    ['phân mảnh', 'sharding'],
    ['sao chép dữ liệu', 'replication'],
    ['nhân bản', 'replication'],
    ['tính sẵn sàng cao', 'high availability'],
    ['khả dụng cao', 'high availability'],
    ['cân bằng tải', 'load balancing'],
    ['giới hạn tốc độ', 'rate limiting'],
    ['mạng riêng ảo', 'virtual private network'],
    ['xác thực', 'authentication'],
    ['uỷ quyền', 'authorization'],
    ['mã hoá', 'encryption'],
    ['triển khai', 'deployment'],
    ['lớp điều khiển', 'controller'],
    ['chuyển đổi kiểu', 'type casting'],
    ['ngoại lệ', 'exception'],
    ['biến thể', 'variant'],
    ['chỉ thị', 'directive'],
    ['vòng lặp', 'loop'],
    ['hàm', 'function'],
    ['biểu thức', 'expression'],
    ['toán tử', 'operator'],
    ['kiểu dữ liệu', 'data type'],
    ['nguyên tử', 'atomic'],
    ['khóa', 'lock'],
    ['khóa phân tán', 'distributed lock'],
    ['hàng đợi ưu tiên', 'priority queue'],
    ['bản ghi', 'record'],
    ['tập hợp', 'set'],
    ['danh sách liên kết', 'linked list'],
    ['hàng đợi hai đầu', 'deque'],
    ['cây nhị phân', 'binary tree'],
    ['cây cân bằng', 'balanced tree'],
    ['bảng băm', 'hash table'],
    ['bảng băm phân tán', 'consistent hashing'],
    ['thuật toán', 'algorithm'],
    ['độ phức tạp', 'complexity'],
    ['bộ nhớ đệm', 'buffer'],
    ['tốc độ thông lượng', 'throughput'],
    ['độ trễ', 'latency'],
    ['cân bằng', 'balance'],
    ['dự phòng', 'failover'],
    ['chịu lỗi', 'fault tolerance'],
    ['phân tán', 'distributed'],
    ['mở rộng ngang', 'horizontal scaling'],
    ['mở rộng dọc', 'vertical scaling'],
    ['vi dịch vụ', 'microservice'],
    ['đơn vị triển khai', 'deployment'],
    ['lịch trình', 'scheduler'],
    ['hàng đợi ưu tiên cao', 'priority queue'],
    ['chính sách', 'policy'],
    ['quyền truy cập', 'access control'],
    ['phiên làm việc', 'session'],
    ['cookie', 'cookie'],
    ['mã thông báo', 'token'],
    ['khóa công khai', 'public key'],
    ['chữ ký số', 'signature'],
    ['giao thức', 'protocol'],
    ['tên miền', 'domain'],
    ['cổng', 'port'],
    ['địa chỉ ip', 'ip address'],
    ['bản ghi nhật ký', 'log'],
    ['chỉ số', 'metric'],
    ['giám sát', 'monitoring'],
    ['cảnh báo', 'alert'],
    ['sao lưu', 'backup'],
    ['khôi phục', 'restore'],
    ['tăng trưởng', 'growth'],
    ['chống giả mạo', 'anti forgery'],
    ['xác nhận hai bước', 'two factor authentication'],
    ['từ chối dịch vụ', 'denial of service'],
    ['tấn công', 'attack'],
    ['lỗ hổng', 'vulnerability'],
    ['mã độc', 'malware'],
    ['mã hóa', 'encryption'],
    ['bảng phân phối', 'distribution']
  ];

  // Extra keywords attached to every card of a topic. They let a learner
  // reach a topic's questions with a word that never appears in the
  // question itself ("orchestration" for Docker & Kubernetes).
  var TOPIC_KEYWORDS = {
    'jd-interview-notes': ['jd', 'interview', 'notes', 'java', 'spring', 'redis', 'sql', 'system design', 'frontend', 'react', 'git', 'concurrency', 'jpa', 'hibernate', 'postgres', 'kafka', 'docker'],
    'java': ['jvm', 'bytecode', 'garbage collection', 'gc', 'collection framework',
      'concurrency', 'thread', 'virtual thread', 'lambda', 'stream api', 'exception',
      'serialization', 'autoboxing', 'string pool', 'classloader'],
    'spring-spring-boot': ['dependency injection', 'bean', 'aop', 'transaction',
      'spring mvc', 'jpa', 'hibernate', 'spring security', 'actuator', 'microservice',
      'auto configuration', 'component scan', 'profile', 'inversion of control'],
    'redis': ['cache', 'key value', 'rdb', 'aof', 'sentinel', 'cluster', 'distributed lock',
      'redlock', 'pub sub', 'stream', 'eviction policy', 'lua scripting', 'hot key',
      'pipeline', 'replication'],
    'kafka': ['message queue', 'partition', 'consumer group', 'rebalance', 'offset',
      'exactly once', 'stream processing', 'retention', 'isr', 'log compaction'],
    'system-design': ['distributed system', 'microservice', 'scalability', 'load balancer',
      'rate limiter', 'cap theorem', 'consistency', 'availability', 'partition tolerance',
      'consistent hashing', 'idempotency', 'circuit breaker', 'backpressure', 'saga',
      'cqrs', 'event sourcing', 'capacity estimation', 'design scenario'],
    'database-essentials': ['sql', 'acid', 'mvcc', 'lock', 'normalization', 'index',
      'join', 'transaction', 'isolation level', 'query optimization', 'b tree',
      'replication', 'sharding', 'foreign key', 'view', 'stored procedure'],
    'postgresql': ['postgres', 'vacuum', 'wal', 'hot update', 'gin index', 'brin index',
      'explain analyze', 'partitioning', 'jsonb', 'cte', 'query plan', 'bloat',
      'connection pool', 'sequence', 'trigger'],
    'docker-kubernetes': ['container', 'dockerfile', 'image layer', 'pod', 'deployment',
      'service', 'ingress', 'hpa', 'namespace', 'helm', 'orchestration', 'kubelet',
      'build cache', 'multi stage build', 'readiness probe', 'liveness probe',
      'network policy', 'statefulset', 'sidecar', 'init container']
  };

  /**
   * Expand a folded query into every variant worth searching.
   * @param {string} foldedQuery accent-stripped, lower-cased query
   * @returns {string[]} variants to search, most specific first
   */
  function expand(foldedQuery) {
    var variants = [foldedQuery];
    if (!foldedQuery) return variants;

    // Longest phrases first, so "bộ nhớ đệm phân tán" is not clipped to
    // "bộ nhớ đệm" before it can expand.
    var entries = SYNONYMS.slice().sort(function (a, b) {
      return U.foldText(b[0]).length - U.foldText(a[0]).length;
    });

    entries.forEach(function (entry) {
      var key = U.foldText(entry[0]);
      if (!key || foldedQuery.indexOf(key) === -1) return;
      var variant = foldedQuery.split(key).join(entry[1]);
      if (variants.indexOf(variant) === -1) variants.push(variant);
    });

    return variants;
  }

  /** The keyword list attached to a card, derived from its topic. */
  function keywordsFor(topicId) {
    return (TOPIC_KEYWORDS[topicId] || []).join(' ');
  }

  global.Synonyms = {
    expand: expand,
    keywordsFor: keywordsFor,
    SYNONYMS: SYNONYMS,
    TOPIC_KEYWORDS: TOPIC_KEYWORDS
  };
})(window);
