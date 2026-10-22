/**
 * Application store: data loading, persistence, and the SM-2 spaced-repetition
 * engine.
 *
 * The scheduling math is byte-for-byte compatible with the previous
 * implementation, so progress already stored in `srs_progress_v1` keeps
 * working unchanged. Only additive fields (e.g. the daily history map) were
 * introduced, and those migrate automatically.
 */
(function (global) {
  'use strict';

  var U = global.U;

  var STORAGE_KEY = 'srs_progress_v1';
  var THEME_KEY = 'srs_theme';
  var SETTINGS_KEY = 'srs_settings_v1';

  var state = {
    data: null,
    allCards: [],
    topicMap: {},
    topics: [],
    srs: { cards: {}, stats: { reviewsToday: 0, lastStudyDate: '', streak: 0, history: {} } },
    view: 'home',
    topicId: null,
    cardIndex: 0,
    queue: [],
    revealed: false,
    language: 'vi',
    theme: 'dark',
    sessionStats: { again: 0, hard: 0, good: 0, easy: 0, reviewed: 0 }
  };

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  function saveSRS() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.srs));
    } catch (e) {
      console.warn('Không thể lưu tiến độ:', e);
    }
  }

  function loadSRS() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        var parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') state.srs = parsed;
      }
    } catch (e) {
      console.warn('Không thể đọc tiến độ:', e);
    }

    var stats = state.srs.stats || (state.srs.stats = {});
    if (!stats.history || typeof stats.history !== 'object') stats.history = {};

    var today = U.todayStr();
    if (!stats.lastStudyDate) {
      stats.lastStudyDate = today;
      stats.reviewsToday = 0;
    }
    // Day rollover: reset the daily counter, keep the streak alive only if the
    // user studied yesterday or today.
    if (stats.lastStudyDate !== today) {
      var yesterday = U.addDays(today, -1);
      if (stats.lastStudyDate !== yesterday) stats.streak = 0;
      stats.reviewsToday = 0;
      stats.lastStudyDate = today;
      saveSRS();
    }
    if (typeof stats.streak !== 'number') stats.streak = 0;
    if (typeof stats.reviewsToday !== 'number') stats.reviewsToday = 0;
  }

  function loadSettings() {
    try {
      var raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        var s = JSON.parse(raw);
        if (s && s.language) state.language = s.language;
      }
    } catch (e) { /* ignore */ }
  }

  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ language: state.language }));
    } catch (e) { /* ignore */ }
  }

  function applyTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* ignore */ }
    var btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.innerHTML = global.Icons.get(theme === 'dark' ? 'sun' : 'moon', { size: 16 });
      btn.setAttribute('aria-label', theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối');
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0a0a0c' : '#fcfcfd');
  }

  function toggleTheme() {
    applyTheme(state.theme === 'dark' ? 'light' : 'dark');
  }

  // ---------------------------------------------------------------------------
  // Topic catalogue
  //
  // Each topic carries a single accent hue. The accent is used sparingly —
  // a hairline marker and icon tint — so the interface stays calm and the
  // colour carries meaning instead of decoration.
  // ---------------------------------------------------------------------------

  var TOPICS = [
    {
      id: 'all', name: 'Tất cả chuyên đề', icon: 'layers', hue: 245,
      desc: 'Toàn bộ ngân hàng 758 câu hỏi phỏng vấn chuẩn hoá.'
    },
    {
      id: 'java', name: 'Java Core & JVM', icon: 'coffee', hue: 28,
      desc: 'Bytecode, bộ nhớ JVM, GC (G1/ZGC), đồng thời, collections.'
    },
    {
      id: 'spring-spring-boot', name: 'Spring & Spring Boot', icon: 'leaf', hue: 152,
      desc: 'IoC/DI, AOP, vòng đời bean, transaction, microservice.'
    },
    {
      id: 'redis', name: 'Redis', icon: 'zap', hue: 4,
      desc: 'Cấu trúc dữ liệu, RDB/AOF, cluster, sentinel, Redlock.'
    },
    {
      id: 'kafka', name: 'Apache Kafka', icon: 'send', hue: 190,
      desc: 'Partition, consumer group, exactly-once, rebalance.'
    },
    {
      id: 'system-design', name: 'System Design', icon: 'network', hue: 268,
      desc: 'High availability, sharding, CAP, rate limit, kiến trúc.'
    },
    {
      id: 'database-essentials', name: 'Database Essentials', icon: 'table', hue: 214,
      desc: 'B-Tree index, ACID, MVCC, lock, tối ưu truy vấn.'
    },
    {
      id: 'postgresql', name: 'PostgreSQL', icon: 'database', hue: 205,
      desc: 'VACUUM, WAL, HOT update, GIN/BRIN, EXPLAIN ANALYZE.'
    },
    {
      id: 'docker-kubernetes', name: 'Docker & Kubernetes', icon: 'box', hue: 200,
      desc: 'Image layer, pod, service, ingress, deployment, HPA.'
    }
  ];

  function topicById(id) {
    for (var i = 0; i < TOPICS.length; i++) if (TOPICS[i].id === id) return TOPICS[i];
    return TOPICS[0];
  }

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  function init() {
    var raw = global.INTERVIEW_DATA;
    if (!raw) {
      var app = document.getElementById('app');
      if (app) {
        app.innerHTML =
          '<div class="empty-state"><div class="empty-state__icon">' +
          global.Icons.get('triangleAlert', { size: 22 }) +
          '</div><h2 class="empty-state__title">Chưa tìm thấy dữ liệu câu hỏi</h2>' +
          '<p class="empty-state__text">Hãy kiểm tra rằng file <code>data.js</code> nằm cạnh <code>index.html</code>.</p></div>';
      }
      return false;
    }

    state.data = raw;
    state.allCards = [];
    state.topicMap = {};
    state.topics = [];

    Object.keys(raw).forEach(function (topicKey) {
      var topic = raw[topicKey];
      state.topicMap[topicKey] = topic;
      var cfg = topicById(topicKey);
      state.topics.push({
        id: topicKey,
        name: topic.name,
        icon: cfg.icon,
        hue: cfg.hue,
        desc: cfg.desc,
        total: topic.questions ? topic.questions.length : 0
      });
      if (topic.questions && Array.isArray(topic.questions)) {
        topic.questions.forEach(function (q) {
          state.allCards.push({
            id: q.id,
            topicId: topicKey,
            topicName: topic.name,
            category: q.category || topic.name,
            subcategory: q.subcategory || '',
            level: q.level || 'beginner',
            q: q.q || '',
            q_en: q.q_en || '',
            a: q.a || '',
            a_en: q.a_en || '',
            references: q.references || [],
            isFull: q.is_full !== false
          });
        });
      }
    });

    loadSRS();
    loadSettings();
    applyTheme(localStorage.getItem(THEME_KEY) || 'dark');

    // The full-deck entry is not a data topic but is a first-class card on
    // the dashboard, so it leads the grid.
    var allCfg = TOPICS[0];
    state.topics.unshift({
      id: 'all',
      name: allCfg.name,
      icon: allCfg.icon,
      hue: allCfg.hue,
      desc: allCfg.desc,
      total: state.allCards.length
    });

    return true;
  }

  // ---------------------------------------------------------------------------
  // SM-2 engine
  // ---------------------------------------------------------------------------

  function cardKey(topicId, cardId) { return topicId + '_' + cardId; }

  function getRecord(key) {
    if (!state.srs.cards[key]) {
      state.srs.cards[key] = {
        state: 'new',
        interval: 0,
        ease: 2.5,
        reps: 0,
        lapses: 0,
        due: U.todayStr(),
        lastReviewed: null,
        starred: false
      };
    }
    return state.srs.cards[key];
  }

  /** Preview the interval each rating button will schedule. */
  function previewIntervals(record) {
    var ease = record.ease || 2.5;
    var interval = record.interval || 0;
    var reps = record.reps || 0;
    function days(n) { return n + ' ngày'; }
    return {
      // Rating 1 sets due = today and re-queues the card later in this
      // session, so "today" is the truthful preview — not a shorter interval.
      again: 'Hôm nay',
      hard: days(reps === 0 ? 1 : Math.max(1, Math.round(interval * 1.2))),
      good: days(reps === 0 ? 1 : (reps === 1 ? 3 : Math.max(2, Math.round(interval * ease)))),
      easy: days(reps === 0 ? 3 : (reps === 1 ? 5 : Math.max(4, Math.round(interval * ease * 1.3))))
    };
  }

  /**
   * Apply a rating (1 = Again, 2 = Hard, 3 = Good, 4 = Easy).
   * @returns {object} the updated record
   */
  function rate(key, rating) {
    var record = getRecord(key);
    var today = U.todayStr();

    record.lastReviewed = new Date().toISOString();

    if (rating === 1) {
      record.reps = 0;
      record.interval = 1;
      record.ease = Math.max(1.3, (record.ease || 2.5) - 0.2);
      record.lapses = (record.lapses || 0) + 1;
      record.state = 'learning';
      record.due = today;
    } else if (rating === 2) {
      record.reps = (record.reps || 0) + 1;
      record.interval = Math.max(1, Math.round((record.interval || 1) * 1.2));
      record.ease = Math.max(1.3, (record.ease || 2.5) - 0.15);
      record.state = record.reps >= 4 ? 'mastered' : 'review';
      record.due = U.addDays(today, record.interval);
    } else if (rating === 3) {
      if (record.reps === 0) record.interval = 1;
      else if (record.reps === 1) record.interval = 3;
      else record.interval = Math.max(2, Math.round((record.interval || 1) * (record.ease || 2.5)));

      record.reps = (record.reps || 0) + 1;
      record.state = record.reps >= 4 ? 'mastered' : 'review';
      record.due = U.addDays(today, record.interval);
    } else if (rating === 4) {
      if (record.reps === 0) record.interval = 3;
      else if (record.reps === 1) record.interval = 6;
      else record.interval = Math.max(4, Math.round((record.interval || 1) * (record.ease || 2.5) * 1.3));

      record.reps = (record.reps || 0) + 1;
      record.ease = (record.ease || 2.5) + 0.15;
      record.state = record.reps >= 3 ? 'mastered' : 'review';
      record.due = U.addDays(today, record.interval);
    }

    state.srs.cards[key] = record;

    var stats = state.srs.stats;
    stats.reviewsToday = (stats.reviewsToday || 0) + 1;
    if (!stats.streak) stats.streak = 1;
    stats.lastStudyDate = today;
    stats.history[today] = (stats.history[today] || 0) + 1;

    saveSRS();
    return record;
  }

  function toggleStar(key) {
    var record = getRecord(key);
    record.starred = !record.starred;
    state.srs.cards[key] = record;
    saveSRS();
    return record.starred;
  }

  // ---------------------------------------------------------------------------
  // Statistics
  // ---------------------------------------------------------------------------

  function topicStats(topicId) {
    var cards = topicId === 'all'
      ? state.allCards
      : (state.topicMap[topicId] ? state.topicMap[topicId].questions : []);
    var today = U.todayStr();

    var mastered = 0, learning = 0, due = 0, fresh = 0, starred = 0;

    cards.forEach(function (card) {
      var key = cardKey(card.topicId || topicId, card.id);
      var srs = state.srs.cards[key];
      if (!srs || srs.state === 'new') {
        fresh++;
        due++;
        return;
      }
      if (srs.state === 'mastered') mastered++;
      else learning++;
      if (srs.due <= today) due++;
      if (srs.starred) starred++;
    });

    return {
      total: cards.length,
      mastered: mastered,
      learning: learning,
      due: due,
      newCards: fresh,
      starred: starred
    };
  }

  function globalStats() {
    var stats = topicStats('all');
    stats.pctMastered = stats.total ? Math.round((stats.mastered / stats.total) * 100) : 0;
    stats.reviewsToday = state.srs.stats.reviewsToday || 0;
    stats.streak = state.srs.stats.streak || 0;
    stats.history = state.srs.stats.history || {};
    return stats;
  }

  /** Last `days` days of review counts, oldest first. */
  function recentHistory(days) {
    var history = state.srs.stats.history || {};
    var out = [];
    var today = U.todayStr();
    for (var i = days - 1; i >= 0; i--) {
      var d = U.addDays(today, -i);
      out.push({ date: d, count: history[d] || 0 });
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Study queue
  // ---------------------------------------------------------------------------

  /** Build a review queue: due cards first, then new cards, then the rest. */
  function buildQueue(topicId) {
    var cards = topicId === 'all'
      ? state.allCards.slice()
      : (state.topicMap[topicId] ? state.topicMap[topicId].questions.slice() : []);
    var today = U.todayStr();

    function bucket(card) {
      var key = cardKey(card.topicId || topicId, card.id);
      var srs = state.srs.cards[key];
      if (!srs || srs.state === 'new') return 1;   // new
      if (srs.due <= today) return 0;             // due now
      return 2;                                   // not due yet
    }

    cards.sort(function (a, b) { return bucket(a) - bucket(b); });
    return cards;
  }

  global.Store = {
    state: state,
    init: init,
    saveSRS: saveSRS,
    applyTheme: applyTheme,
    toggleTheme: toggleTheme,
    saveSettings: saveSettings,
    TOPICS: TOPICS,
    topicById: topicById,
    cardKey: cardKey,
    getRecord: getRecord,
    previewIntervals: previewIntervals,
    rate: rate,
    toggleStar: toggleStar,
    topicStats: topicStats,
    globalStats: globalStats,
    recentHistory: recentHistory,
    buildQueue: buildQueue,
    STORAGE_KEY: STORAGE_KEY
  };
})(window);
