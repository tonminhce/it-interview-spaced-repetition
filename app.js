/**
 * Spaced Repetition IT Interview Flashcard App
 * Powered by SM-2 Algorithm & LocalStorage
 */

// Topic definitions & ordering
const TOPICS_CONFIG = [
  { id: 'all', name: 'Tất cả chuyên đề (All Topics)', icon: '🌟', color: '#6366f1' },
  { id: 'java', name: 'Java Core & JVM', icon: '☕', color: '#f89820' },
  { id: 'spring-spring-boot', name: 'Spring & Spring Boot', icon: '🍃', color: '#6db33f' },
  { id: 'redis', name: 'Redis Caching & Data Structures', icon: '⚡', color: '#dc382d' },
  { id: 'kafka', name: 'Apache Kafka Event Streaming', icon: '📨', color: '#00b4d8' },
  { id: 'system-design', name: 'System Design & High Availability', icon: '📐', color: '#8b5cf6' },
  { id: 'database-essentials', name: 'Database Essentials & SQL Internals', icon: '🗄️', color: '#3b82f6' },
  { id: 'postgresql', name: 'PostgreSQL Deep Dive', icon: '🐘', color: '#336791' },
  { id: 'docker-kubernetes', name: 'Docker & Kubernetes (DevOps)', icon: '🐳', color: '#0db7ed' }
];

// App State
const state = {
  data: null,
  allCards: [],
  topicMap: {},
  srsData: { cards: {}, stats: { reviewsToday: 0, lastStudyDate: '', streak: 0 } },
  currentView: 'home', // 'home' | 'study' | 'browse'
  currentTopicId: null,
  currentCardIndex: 0,
  studyQueue: [],
  isFlipped: false,
  language: 'vi', // 'vi' | 'en'
  searchQuery: '',
  filterLevel: 'all',
  filterStatus: 'all',
  theme: localStorage.getItem('srs_theme') || 'dark'
};

// Utilities
const getTodayStr = () => new Date().toISOString().split('T')[0];

const addDays = (dateStr, days) => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

// Markdown fallback simple renderer in case marked isn't available
function renderMarkdown(md) {
  if (!md) return '';
  if (window.marked && typeof window.marked.parse === 'function') {
    return window.marked.parse(md);
  }
  // Simple fallback
  let html = md
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*)\*/gim, '<em>$1</em>')
    .replace(/`([^`]+)`/gim, '<code>$1</code>')
    .replace(/\n\n/gim, '<p></p>')
    .replace(/\n/gim, '<br>');
  return html;
}

// Spaced Repetition Engine (SuperMemo SM-2)
class SRSEngine {
  static getCardKey(topicId, cardId) {
    return `${topicId}_${cardId}`;
  }

  static getCardRecord(key) {
    if (!state.srsData.cards[key]) {
      return {
        state: 'new',       // 'new' | 'learning' | 'review' | 'mastered'
        interval: 0,        // days
        ease: 2.5,          // default ease factor
        reps: 0,            // successful repetitions
        lapses: 0,          // times failed (rated again)
        due: getTodayStr(),
        lastReviewed: null,
        starred: false
      };
    }
    return state.srsData.cards[key];
  }

  static saveSRS() {
    localStorage.setItem('srs_progress_v1', JSON.stringify(state.srsData));
  }

  static loadSRS() {
    try {
      const stored = localStorage.getItem('srs_progress_v1');
      if (stored) {
        state.srsData = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to load srs data from localStorage:', e);
    }

    // Check streak
    const today = getTodayStr();
    if (!state.srsData.stats) {
      state.srsData.stats = { reviewsToday: 0, lastStudyDate: today, streak: 0 };
    }
    if (state.srsData.stats.lastStudyDate !== today) {
      const yesterday = addDays(today, -1);
      if (state.srsData.stats.lastStudyDate === yesterday) {
        // Streak continues
      } else if (state.srsData.stats.lastStudyDate !== today) {
        state.srsData.stats.streak = 0;
      }
      state.srsData.stats.reviewsToday = 0;
      state.srsData.stats.lastStudyDate = today;
      SRSEngine.saveSRS();
    }
  }

  static calculateIntervals(record) {
    const ease = record.ease || 2.5;
    const interval = record.interval || 0;
    const reps = record.reps || 0;

    return {
      again: '<10m',
      hard: reps === 0 ? '1d' : `${Math.max(1, Math.round(interval * 1.2))}d`,
      good: reps === 0 ? '1d' : (reps === 1 ? '3d' : `${Math.max(2, Math.round(interval * ease))}d`),
      easy: reps === 0 ? '3d' : (reps === 1 ? '5d' : `${Math.max(4, Math.round(interval * ease * 1.3))}d`)
    };
  }

  static rateCard(key, rating) {
    // rating: 1 = Again, 2 = Hard, 3 = Good, 4 = Easy
    let record = SRSEngine.getCardRecord(key);
    let today = getTodayStr();

    record.lastReviewed = new Date().toISOString();

    if (rating === 1) {
      // Again (Failed)
      record.reps = 0;
      record.interval = 1;
      record.ease = Math.max(1.3, (record.ease || 2.5) - 0.2);
      record.lapses = (record.lapses || 0) + 1;
      record.state = 'learning';
      record.due = today; // Repeat in current day
    } else if (rating === 2) {
      // Hard
      record.reps = (record.reps || 0) + 1;
      record.interval = Math.max(1, Math.round((record.interval || 1) * 1.2));
      record.ease = Math.max(1.3, (record.ease || 2.5) - 0.15);
      record.state = record.reps >= 4 ? 'mastered' : 'review';
      record.due = addDays(today, record.interval);
    } else if (rating === 3) {
      // Good
      if (record.reps === 0) {
        record.interval = 1;
      } else if (record.reps === 1) {
        record.interval = 3;
      } else {
        record.interval = Math.max(2, Math.round((record.interval || 1) * (record.ease || 2.5)));
      }
      record.reps = (record.reps || 0) + 1;
      record.state = record.reps >= 4 ? 'mastered' : 'review';
      record.due = addDays(today, record.interval);
    } else if (rating === 4) {
      // Easy
      if (record.reps === 0) {
        record.interval = 3;
      } else if (record.reps === 1) {
        record.interval = 6;
      } else {
        record.interval = Math.max(4, Math.round((record.interval || 1) * (record.ease || 2.5) * 1.3));
      }
      record.reps = (record.reps || 0) + 1;
      record.ease = (record.ease || 2.5) + 0.15;
      record.state = record.reps >= 3 ? 'mastered' : 'review';
      record.due = addDays(today, record.interval);
    }

    state.srsData.cards[key] = record;

    // Update study streak
    state.srsData.stats.reviewsToday = (state.srsData.stats.reviewsToday || 0) + 1;
    if (state.srsData.stats.streak === 0) {
      state.srsData.stats.streak = 1;
    }
    state.srsData.stats.lastStudyDate = today;

    SRSEngine.saveSRS();
    return record;
  }

  static toggleStar(key) {
    let record = SRSEngine.getCardRecord(key);
    record.starred = !record.starred;
    state.srsData.cards[key] = record;
    SRSEngine.saveSRS();
    return record.starred;
  }
}

// Data Initialization
function initData() {
  const rawData = window.INTERVIEW_DATA;
  if (!rawData) {
    document.getElementById('app').innerHTML = `
      <div class="container empty-state">
        <div class="empty-state-icon">⚠️</div>
        <h2 class="empty-state-title">Chưa tìm thấy dữ liệu</h2>
        <p class="empty-state-desc">Vui lòng đảm bảo file <code>data.js</code> hoặc <code>data.json</code> đã được nạp.</p>
      </div>
    `;
    return;
  }

  state.data = rawData;
  state.allCards = [];
  state.topicMap = {};

  for (const topicKey of Object.keys(rawData)) {
    const topicObj = rawData[topicKey];
    state.topicMap[topicKey] = topicObj;
    if (topicObj.questions && Array.isArray(topicObj.questions)) {
      topicObj.questions.forEach(q => {
        state.allCards.push({
          ...q,
          topicId: topicKey,
          topicName: topicObj.name
        });
      });
    }
  }

  SRSEngine.loadSRS();
  applyTheme(state.theme);
  renderApp();
}

// Theme handling
function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('srs_theme', theme);
  const themeBtn = document.getElementById('theme-toggle-btn');
  if (themeBtn) {
    themeBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
  }
}

function toggleTheme() {
  applyTheme(state.theme === 'dark' ? 'light' : 'dark');
}

// Statistics Calculators
function getTopicStats(topicId) {
  let cards = [];
  if (topicId === 'all') {
    cards = state.allCards;
  } else if (state.topicMap[topicId]) {
    cards = state.topicMap[topicId].questions || [];
  }

  const today = getTodayStr();
  let mastered = 0;
  let learning = 0;
  let due = 0;
  let newCards = 0;
  let starred = 0;

  cards.forEach(card => {
    const key = SRSEngine.getCardKey(card.topicId || topicId, card.id);
    const srs = state.srsData.cards[key];
    if (!srs || srs.state === 'new') {
      newCards++;
      due++; // New cards count as due to learn
    } else {
      if (srs.state === 'mastered') mastered++;
      else learning++;

      if (srs.due <= today) {
        due++;
      }
      if (srs.starred) starred++;
    }
  });

  return {
    total: cards.length,
    mastered,
    learning,
    due,
    newCards,
    starred
  };
}

function getGlobalStats() {
  const topicStats = getTopicStats('all');
  return {
    total: topicStats.total,
    mastered: topicStats.mastered,
    learning: topicStats.learning,
    due: topicStats.due,
    reviewsToday: state.srsData.stats.reviewsToday || 0,
    streak: state.srsData.stats.streak || 0
  };
}

// Router & View Switcher
function navigateTo(view, topicId = null) {
  state.currentView = view;
  state.currentTopicId = topicId;
  state.isFlipped = false;
  state.currentCardIndex = 0;

  if (view === 'study') {
    setupStudyQueue(topicId);
  }

  renderApp();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setupStudyQueue(topicId) {
  let cards = topicId === 'all' ? [...state.allCards] : [...(state.topicMap[topicId].questions || [])];
  const today = getTodayStr();

  // Prioritize: Due today / Overdue first, then New cards, then mastered
  cards.sort((a, b) => {
    const keyA = SRSEngine.getCardKey(a.topicId || topicId, a.id);
    const keyB = SRSEngine.getCardKey(b.topicId || topicId, b.id);
    const srsA = state.srsData.cards[keyA];
    const srsB = state.srsData.cards[keyB];

    const isDueA = !srsA || srsA.due <= today ? 1 : 0;
    const isDueB = !srsB || srsB.due <= today ? 1 : 0;

    if (isDueA !== isDueB) return isDueB - isDueA;
    return 0;
  });

  state.studyQueue = cards;
  state.currentCardIndex = 0;
}

// Render Master Functions
function renderApp() {
  const app = document.getElementById('app');
  if (!app) return;

  if (state.currentView === 'home') {
    renderHomeView(app);
  } else if (state.currentView === 'study') {
    renderStudyView(app);
  } else if (state.currentView === 'browse') {
    renderBrowseView(app);
  }
}

// 1. Home View
function renderHomeView(container) {
  const gStats = getGlobalStats();

  let html = `
    <!-- Stats Banner -->
    <section class="stats-banner">
      <div class="container">
        <div class="stats-grid">
          <div class="stat-item">
            <div class="stat-icon" style="color: #6366f1;">📚</div>
            <div class="stat-content">
              <span class="stat-value">${gStats.total}</span>
              <span class="stat-label">Tổng câu hỏi</span>
            </div>
          </div>
          <div class="stat-item">
            <div class="stat-icon" style="color: #ef4444;">⏰</div>
            <div class="stat-content">
              <span class="stat-value">${gStats.due}</span>
              <span class="stat-label">Cần ôn hôm nay</span>
            </div>
          </div>
          <div class="stat-item">
            <div class="stat-icon" style="color: #3b82f6;">📖</div>
            <div class="stat-content">
              <span class="stat-value">${gStats.learning}</span>
              <span class="stat-label">Đang rèn luyện</span>
            </div>
          </div>
          <div class="stat-item">
            <div class="stat-icon" style="color: #10b981;">🏆</div>
            <div class="stat-content">
              <span class="stat-value">${gStats.mastered}</span>
              <span class="stat-label">Đã thành thạo</span>
            </div>
          </div>
          <div class="stat-item">
            <div class="stat-icon" style="color: #f59e0b;">🔥</div>
            <div class="stat-content">
              <span class="stat-value">${gStats.streak} ngày</span>
              <span class="stat-label">Chuỗi học tập</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Main Section -->
    <main class="main-content">
      <div class="container">
        <div class="section-header">
          <div>
            <h1 class="section-title">Chọn Chuyên Đề Phỏng Vấn IT</h1>
            <p class="section-subtitle">Spaced Repetition Flashcards phân loại theo từng mảng công nghệ chuyên sâu</p>
          </div>
          <div class="filter-bar">
            <div class="search-input-wrapper">
              <span class="search-icon">🔍</span>
              <input type="text" id="topic-search-input" class="search-input" placeholder="Tìm kiếm câu hỏi nhanh..." value="${state.searchQuery}">
            </div>
            <button class="btn btn-secondary" onclick="openDataModal()">⚙️ Quản lý dữ liệu</button>
          </div>
        </div>

        <div class="topics-grid">
  `;

  TOPICS_CONFIG.forEach(topic => {
    const stats = getTopicStats(topic.id);
    const masteredPct = stats.total > 0 ? Math.round((stats.mastered / stats.total) * 100) : 0;
    const learningPct = stats.total > 0 ? Math.round((stats.learning / stats.total) * 100) : 0;
    const newPct = stats.total > 0 ? 100 - masteredPct - learningPct : 100;

    html += `
      <div class="topic-card" style="border-top: 4px solid ${topic.color};">
        <div class="topic-card-header">
          <div class="topic-meta">
            <div class="topic-icon-box" style="color: ${topic.color};">${topic.icon}</div>
            <div>
              <h2 class="topic-title">${topic.name}</h2>
              <span class="topic-count">${stats.total} câu hỏi chuẩn hóa</span>
            </div>
          </div>
        </div>

        <div class="topic-progress-wrapper">
          <div class="progress-bar-bg">
            <div class="progress-segment seg-mastered" style="width: ${masteredPct}%;" title="Thành thạo: ${stats.mastered}"></div>
            <div class="progress-segment seg-learning" style="width: ${learningPct}%;" title="Đang học: ${stats.learning}"></div>
            <div class="progress-segment seg-new" style="width: ${newPct}%;" title="Thẻ mới: ${stats.newCards}"></div>
          </div>
          <div class="progress-labels">
            <span>Tiến độ thành thạo: <strong>${masteredPct}%</strong></span>
            <span>${stats.mastered}/${stats.total}</span>
          </div>
        </div>

        <div class="topic-badges">
          ${stats.due > 0 ? `<span class="srs-badge badge-due">⏰ ${stats.due} cần ôn</span>` : `<span class="srs-badge badge-mastered">✓ Đã hoàn thành</span>`}
          <span class="srs-badge badge-learning">📖 ${stats.learning} đang học</span>
          <span class="srs-badge badge-new">✨ ${stats.newCards} mới</span>
          ${stats.starred > 0 ? `<span class="srs-badge" style="background: rgba(251, 191, 36, 0.15); color: #fbbf24;">⭐ ${stats.starred}</span>` : ''}
        </div>

        <div class="topic-actions">
          <button class="btn btn-primary" onclick="navigateTo('study', '${topic.id}')">
            🔥 Học Ngay (${stats.due > 0 ? stats.due : stats.total})
          </button>
          <button class="btn btn-secondary" onclick="navigateTo('browse', '${topic.id}')" title="Xem danh sách câu hỏi">
            📋 Xem tất cả
          </button>
        </div>
      </div>
    `;
  });

  html += `
        </div>
      </div>
    </main>
  `;

  container.innerHTML = html;

  // Search input binding
  const searchInput = document.getElementById('topic-search-input');
  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        state.searchQuery = searchInput.value.trim();
        navigateTo('browse', 'all');
      }
    });
  }
}

// 2. Study View (Flashcards)
function renderStudyView(container) {
  const topicId = state.currentTopicId;
  const topicCfg = TOPICS_CONFIG.find(t => t.id === topicId) || TOPICS_CONFIG[0];
  const totalInQueue = state.studyQueue.length;

  if (totalInQueue === 0 || state.currentCardIndex >= totalInQueue) {
    container.innerHTML = `
      <main class="main-content">
        <div class="container study-container">
          <div class="empty-state">
            <div class="empty-state-icon">🎉</div>
            <h2 class="empty-state-title">Tuyệt vời! Bạn đã hoàn thành phiên ôn tập!</h2>
            <p class="empty-state-desc">Tất cả các thẻ trong chuyên đề <strong>${topicCfg.name}</strong> đã được đánh giá và lên lịch lặp lại ngắt quãng SM-2.</p>
            <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
              <button class="btn btn-primary" onclick="navigateTo('home')">🏠 Quay về Trang Chủ</button>
              <button class="btn btn-secondary" onclick="setupStudyQueue('${topicId}'); renderApp();">🔄 Ôn Lại Tất Cả Thẻ</button>
            </div>
          </div>
        </div>
      </main>
    `;
    return;
  }

  const card = state.studyQueue[state.currentCardIndex];
  const cardKey = SRSEngine.getCardKey(card.topicId || topicId, card.id);
  const srsRecord = SRSEngine.getCardRecord(cardKey);
  const intervals = SRSEngine.calculateIntervals(srsRecord);

  const isVi = state.language === 'vi';
  const questionText = isVi ? card.q : (card.q_en || card.q);
  const answerMarkdown = isVi ? card.a : (card.a_en || card.a);
  const isStarred = srsRecord.starred;

  let levelTagClass = 'tag-beginner';
  let levelName = 'Cơ bản';
  if (card.level === 'intermediate') {
    levelTagClass = 'tag-intermediate';
    levelName = 'Trung cấp';
  } else if (card.level === 'advanced') {
    levelTagClass = 'tag-advanced';
    levelName = 'Nâng cao';
  }

  let html = `
    <main class="main-content">
      <div class="container study-container">
        <!-- Top Nav Controls -->
        <div class="study-nav">
          <div class="study-info">
            <button class="btn btn-secondary" onclick="navigateTo('home')">← Trang chủ</button>
            <span class="study-title">${topicCfg.icon} ${topicCfg.name}</span>
            <span class="study-counter">${state.currentCardIndex + 1} / ${totalInQueue}</span>
          </div>
          <div class="study-options">
            <button class="btn-lang-pill ${isVi ? 'active' : ''}" onclick="toggleLanguage('vi')">Tiếng Việt</button>
            <button class="btn-lang-pill ${!isVi ? 'active' : ''}" onclick="toggleLanguage('en')">English</button>
            <button class="btn-icon" onclick="navigateTo('browse', '${topicId}')" title="Xem danh sách">📋</button>
          </div>
        </div>

        <!-- Flashcard -->
        <div class="flashcard-wrapper">
          <div class="flashcard" id="active-flashcard">
            <!-- Header -->
            <div class="flashcard-header">
              <div class="card-tags">
                <span class="tag tag-category">${card.category || topicCfg.name}</span>
                ${card.subcategory ? `<span class="tag tag-category">${card.subcategory}</span>` : ''}
                <span class="tag ${levelTagClass}">${levelName}</span>
                ${srsRecord.interval > 0 ? `<span class="tag" style="background: var(--bg-tertiary); color: var(--text-secondary);">Khoảng cách: ${srsRecord.interval}d</span>` : ''}
              </div>
              <div class="card-quick-actions">
                <button class="btn-star ${isStarred ? 'active' : ''}" onclick="toggleCardStar('${cardKey}')" title="Đánh dấu sao câu này (Phím S)">
                  ${isStarred ? '★' : '☆'}
                </button>
              </div>
            </div>

            <!-- Body -->
            <div class="flashcard-body" onclick="handleCardBodyClick(event)">
              <div class="question-text">${questionText}</div>

              ${!state.isFlipped ? `
                <div class="flip-prompt" onclick="flipCard()">
                  <span style="font-size: 2rem;">💡</span>
                  <span>Chạm vào đây hoặc nhấn <strong>Phím Space</strong> để lật xem đáp án chi tiết</span>
                  <span class="flip-prompt-key">SPACE / ENTER</span>
                </div>
              ` : `
                <div class="answer-section">
                  <div class="answer-label">
                    <span>⚡ Phân Tích & Câu Trả Lời Chuẩn Phỏng Vấn:</span>
                  </div>
                  <div class="markdown-content">
                    ${renderMarkdown(answerMarkdown)}
                  </div>

                  ${card.references && card.references.length > 0 ? `
                    <div class="card-references">
                      <div class="card-references-title">Tài liệu tham khảo chuyên sâu:</div>
                      ${card.references.map(ref => `<a href="${ref.url}" target="_blank" rel="noopener noreferrer">↗ ${ref.label || ref.url}</a>`).join('')}
                    </div>
                  ` : ''}
                </div>
              `}
            </div>
          </div>
        </div>

        <!-- Controls Below Card -->
        <div class="study-controls">
          ${!state.isFlipped ? `
            <div class="flip-button-bar">
              <button class="btn-flip-large" onclick="flipCard()">
                <span>🔄 Xem Đáp Án</span>
                <span style="opacity: 0.7; font-size: 0.85rem; font-weight: normal;">[Space]</span>
              </button>
            </div>
          ` : `
            <div class="srs-ratings-grid">
              <button class="srs-btn srs-btn-again" onclick="rateCurrentCard(1)">
                <span class="srs-btn-key">[1]</span>
                <span class="srs-btn-time">${intervals.again}</span>
                <span class="srs-btn-title">Lặp lại</span>
              </button>
              <button class="srs-btn srs-btn-hard" onclick="rateCurrentCard(2)">
                <span class="srs-btn-key">[2]</span>
                <span class="srs-btn-time">${intervals.hard}</span>
                <span class="srs-btn-title">Khó</span>
              </button>
              <button class="srs-btn srs-btn-good" onclick="rateCurrentCard(3)">
                <span class="srs-btn-key">[3]</span>
                <span class="srs-btn-time">${intervals.good}</span>
                <span class="srs-btn-title">Được</span>
              </button>
              <button class="srs-btn srs-btn-easy" onclick="rateCurrentCard(4)">
                <span class="srs-btn-key">[4]</span>
                <span class="srs-btn-time">${intervals.easy}</span>
                <span class="srs-btn-title">Dễ</span>
              </button>
            </div>
          `}

          <div class="study-secondary-bar">
            <button class="btn btn-secondary" onclick="prevCard()" ${state.currentCardIndex === 0 ? 'disabled' : ''}>← Thẻ trước</button>
            <span>Phím tắt: <strong>Space</strong> lật | <strong>1 - 4</strong> đánh giá | <strong>S</strong> gắn sao</span>
            <button class="btn btn-secondary" onclick="skipCard()">Bỏ qua →</button>
          </div>
        </div>
      </div>
    </main>
  `;

  container.innerHTML = html;
}

// 3. Browse / List View
function renderBrowseView(container) {
  const topicId = state.currentTopicId || 'all';
  const topicCfg = TOPICS_CONFIG.find(t => t.id === topicId) || TOPICS_CONFIG[0];

  let rawList = topicId === 'all' ? [...state.allCards] : [...(state.topicMap[topicId].questions || [])];

  // Filtering
  const query = state.searchQuery.toLowerCase();
  const filtered = rawList.filter(card => {
    // Search keyword
    if (query) {
      const matchQ = (card.q || '').toLowerCase().includes(query) || (card.q_en || '').toLowerCase().includes(query);
      const matchA = (card.a || '').toLowerCase().includes(query);
      const matchSub = (card.subcategory || '').toLowerCase().includes(query);
      if (!matchQ && !matchA && !matchSub) return false;
    }

    // Level filter
    if (state.filterLevel !== 'all' && card.level !== state.filterLevel) {
      return false;
    }

    // Status filter
    if (state.filterStatus !== 'all') {
      const cardKey = SRSEngine.getCardKey(card.topicId || topicId, card.id);
      const srs = state.srsData.cards[cardKey] || { state: 'new' };
      if (state.filterStatus === 'starred' && !srs.starred) return false;
      if (state.filterStatus === 'due' && srs.due > getTodayStr()) return false;
      if (state.filterStatus === 'mastered' && srs.state !== 'mastered') return false;
      if (state.filterStatus === 'learning' && srs.state !== 'learning') return false;
      if (state.filterStatus === 'new' && srs.state !== 'new') return false;
    }

    return true;
  });

  let html = `
    <main class="main-content">
      <div class="container browse-container">
        <div class="section-header">
          <div>
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <button class="btn btn-secondary" onclick="navigateTo('home')">← Quay lại</button>
              <h1 class="section-title">${topicCfg.icon} ${topicCfg.name}</h1>
            </div>
            <p class="section-subtitle">Hiển thị ${filtered.length} / ${rawList.length} câu hỏi theo bộ lọc</p>
          </div>
          <div>
            <button class="btn btn-primary" onclick="navigateTo('study', '${topicId}')">🔥 Học Chuyên Đề Này</button>
          </div>
        </div>

        <!-- Filter and Search controls -->
        <div style="background: var(--bg-secondary); padding: 1rem 1.25rem; border: 1px solid var(--border-color); border-radius: var(--radius-md); margin-bottom: 1.5rem; display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; justify-content: space-between;">
          <div class="search-input-wrapper" style="flex: 1; min-width: 250px;">
            <span class="search-icon">🔍</span>
            <input type="text" id="browse-search" class="search-input" placeholder="Tìm theo câu hỏi, câu trả lời, từ khóa..." value="${state.searchQuery}">
          </div>

          <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
            <select id="filter-level-select" class="search-input" style="width: auto; padding-left: 1rem;" onchange="handleLevelFilter(this.value)">
              <option value="all" ${state.filterLevel === 'all' ? 'selected' : ''}>Mọi độ khó</option>
              <option value="beginner" ${state.filterLevel === 'beginner' ? 'selected' : ''}>Cơ bản (Beginner)</option>
              <option value="intermediate" ${state.filterLevel === 'intermediate' ? 'selected' : ''}>Trung cấp (Intermediate)</option>
              <option value="advanced" ${state.filterLevel === 'advanced' ? 'selected' : ''}>Nâng cao (Advanced)</option>
            </select>

            <select id="filter-status-select" class="search-input" style="width: auto; padding-left: 1rem;" onchange="handleStatusFilter(this.value)">
              <option value="all" ${state.filterStatus === 'all' ? 'selected' : ''}>Tất cả trạng thái</option>
              <option value="due" ${state.filterStatus === 'due' ? 'selected' : ''}>⏰ Đến hạn ôn</option>
              <option value="learning" ${state.filterStatus === 'learning' ? 'selected' : ''}>📖 Đang học</option>
              <option value="mastered" ${state.filterStatus === 'mastered' ? 'selected' : ''}>🏆 Đã thuộc</option>
              <option value="new" ${state.filterStatus === 'new' ? 'selected' : ''}>✨ Thẻ mới</option>
              <option value="starred" ${state.filterStatus === 'starred' ? 'selected' : ''}>⭐ Có gắn sao</option>
            </select>
          </div>
        </div>

        <!-- Question List -->
        <div class="browse-table-wrapper">
  `;

  if (filtered.length === 0) {
    html += `
      <div style="text-align: center; padding: 3rem 1rem; color: var(--text-secondary);">
        <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">Không tìm thấy câu hỏi nào phù hợp với bộ lọc</p>
        <button class="btn btn-secondary" onclick="resetFilters()">Xóa bộ lọc</button>
      </div>
    `;
  } else {
    filtered.forEach((card, idx) => {
      const cardKey = SRSEngine.getCardKey(card.topicId || topicId, card.id);
      const srs = state.srsData.cards[cardKey] || { state: 'new' };
      const isStarred = srs.starred;

      let levelClass = 'tag-beginner';
      let levelText = 'Cơ bản';
      if (card.level === 'intermediate') {
        levelClass = 'tag-intermediate';
        levelText = 'Trung cấp';
      } else if (card.level === 'advanced') {
        levelClass = 'tag-advanced';
        levelText = 'Nâng cao';
      }

      html += `
        <div class="question-list-item" onclick="openCardInStudy('${card.topicId || topicId}', ${card.id})">
          <div class="q-index">#${idx + 1}</div>
          <div class="q-content">
            <div class="q-header-meta">
              <span class="tag tag-category">${card.category || topicCfg.name}</span>
              ${card.subcategory ? `<span class="tag tag-category">${card.subcategory}</span>` : ''}
              <span class="tag ${levelClass}">${levelText}</span>
              ${srs.state === 'mastered' ? `<span class="tag" style="background: var(--color-easy-bg); color: var(--color-easy);">Thành thạo</span>` : ''}
              ${srs.state === 'learning' ? `<span class="tag" style="background: var(--color-good-bg); color: var(--color-good);">Đang học (${srs.interval}d)</span>` : ''}
              ${isStarred ? `<span style="color: #fbbf24;">★</span>` : ''}
            </div>
            <div class="q-title">${card.q}</div>
            <div class="q-preview">${(card.a || '').replace(/[\*#`]/g, '').substring(0, 160)}...</div>
          </div>
        </div>
      `;
    });
  }

  html += `
        </div>
      </div>
    </main>
  `;

  container.innerHTML = html;

  const browseInput = document.getElementById('browse-search');
  if (browseInput) {
    browseInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      renderBrowseView(container);
    });
  }
}

// User Actions
function flipCard() {
  state.isFlipped = true;
  renderApp();
}

function handleCardBodyClick(e) {
  if (e.target.closest('a') || e.target.closest('button')) return;
  if (!state.isFlipped) {
    flipCard();
  }
}

function rateCurrentCard(rating) {
  const card = state.studyQueue[state.currentCardIndex];
  if (!card) return;

  const topicId = state.currentTopicId;
  const cardKey = SRSEngine.getCardKey(card.topicId || topicId, card.id);

  SRSEngine.rateCard(cardKey, rating);

  if (rating === 1) {
    // If rated Again, append card to the queue so it reappears before session end
    state.studyQueue.push(card);
  }

  state.currentCardIndex++;
  state.isFlipped = false;
  renderApp();
}

function prevCard() {
  if (state.currentCardIndex > 0) {
    state.currentCardIndex--;
    state.isFlipped = false;
    renderApp();
  }
}

function skipCard() {
  if (state.currentCardIndex < state.studyQueue.length - 1) {
    state.currentCardIndex++;
    state.isFlipped = false;
    renderApp();
  }
}

function toggleLanguage(lang) {
  state.language = lang;
  renderApp();
}

function toggleCardStar(cardKey) {
  SRSEngine.toggleStar(cardKey);
  renderApp();
}

function openCardInStudy(topicId, cardId) {
  setupStudyQueue(topicId);
  const foundIdx = state.studyQueue.findIndex(c => c.id === cardId);
  if (foundIdx !== -1) {
    state.currentCardIndex = foundIdx;
  }
  state.currentView = 'study';
  state.currentTopicId = topicId;
  state.isFlipped = false;
  renderApp();
}

function handleLevelFilter(level) {
  state.filterLevel = level;
  renderBrowseView(document.getElementById('app'));
}

function handleStatusFilter(status) {
  state.filterStatus = status;
  renderBrowseView(document.getElementById('app'));
}

function resetFilters() {
  state.searchQuery = '';
  state.filterLevel = 'all';
  state.filterStatus = 'all';
  renderBrowseView(document.getElementById('app'));
}

// Data Management Modal (Export, Import, Reset)
function openDataModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'data-modal';

  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3 class="modal-title">⚙️ Quản lý Tiến Độ & Dữ Liệu</h3>
        <button class="btn-icon" onclick="closeDataModal()">✕</button>
      </div>
      <div class="modal-body">
        <div style="margin-bottom: 1.5rem;">
          <h4 style="font-size: 0.95rem; margin-bottom: 0.5rem; color: var(--accent);">📥 Sao lưu dữ liệu học (Export)</h4>
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.75rem;">
            Tải về file JSON chứa toàn bộ lịch sử ôn tập Spaced Repetition của bạn để lưu trữ hoặc chuyển sang máy tính khác.
          </p>
          <button class="btn btn-secondary" onclick="exportData()">💾 Tải File Backup JSON</button>
        </div>

        <div style="margin-bottom: 1.5rem; border-top: 1px solid var(--border-color); padding-top: 1.25rem;">
          <h4 style="font-size: 0.95rem; margin-bottom: 0.5rem; color: #10b981;">📤 Phục hồi dữ liệu (Import)</h4>
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.75rem;">
            Nạp file backup JSON đã lưu trước đó để tiếp tục lộ trình học.
          </p>
          <input type="file" id="import-file-input" accept=".json" style="display: none;" onchange="handleFileImport(event)">
          <button class="btn btn-secondary" onclick="document.getElementById('import-file-input').click()">📁 Chọn File JSON Để Khôi Phục</button>
        </div>

        <div style="border-top: 1px solid var(--border-color); padding-top: 1.25rem;">
          <h4 style="font-size: 0.95rem; margin-bottom: 0.5rem; color: var(--color-again);">⚠️ Đặt lại toàn bộ tiến độ (Reset)</h4>
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.75rem;">
            Xóa toàn bộ lịch sử ôn tập và đưa 758 câu hỏi về trạng thái "Chưa học". Thao tác này không thể hoàn tác.
          </p>
          <button class="btn btn-secondary" style="color: var(--color-again); border-color: var(--color-again);" onclick="resetAllProgress()">🗑️ Xóa Toàn Bộ Tiến Độ</button>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeDataModal()">Đóng</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

function closeDataModal() {
  const modal = document.getElementById('data-modal');
  if (modal) modal.remove();
}

function exportData() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.srsData, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `spaced_repetition_backup_${getTodayStr()}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

function handleFileImport(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const imported = JSON.parse(evt.target.result);
      if (imported.cards) {
        state.srsData = imported;
        SRSEngine.saveSRS();
        alert('Khôi phục dữ liệu tiến độ học thành công!');
        closeDataModal();
        renderApp();
      } else {
        alert('File không hợp lệ: thiếu cấu trúc dữ liệu thẻ.');
      }
    } catch(err) {
      alert('Lỗi đọc file: ' + err.message);
    }
  };
  reader.readAsText(file);
}

function resetAllProgress() {
  if (confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử ôn tập và đưa tất cả 758 câu hỏi về trạng thái ban đầu?')) {
    state.srsData = { cards: {}, stats: { reviewsToday: 0, lastStudyDate: getTodayStr(), streak: 0 } };
    SRSEngine.saveSRS();
    alert('Đã đặt lại tiến độ học tập thành công.');
    closeDataModal();
    renderApp();
  }
}

// Global Keyboard Shortcut Listener
window.addEventListener('keydown', (e) => {
  // If typing in an input or select, skip shortcuts
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
    return;
  }

  // Modal close
  if (e.key === 'Escape') {
    if (document.getElementById('data-modal')) {
      closeDataModal();
      return;
    }
    if (state.currentView !== 'home') {
      navigateTo('home');
      return;
    }
  }

  // Flashcard view shortcuts
  if (state.currentView === 'study') {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!state.isFlipped) {
        flipCard();
      }
    } else if (state.isFlipped) {
      if (e.key === '1') rateCurrentCard(1);
      else if (e.key === '2') rateCurrentCard(2);
      else if (e.key === '3') rateCurrentCard(3);
      else if (e.key === '4') rateCurrentCard(4);
    }

    if (e.key.toLowerCase() === 's') {
      const card = state.studyQueue[state.currentCardIndex];
      if (card) {
        const key = SRSEngine.getCardKey(card.topicId || state.currentTopicId, card.id);
        toggleCardStar(key);
      }
    }

    if (e.key.toLowerCase() === 'l') {
      toggleLanguage(state.language === 'vi' ? 'en' : 'vi');
    }

    if (e.key === 'ArrowLeft') {
      prevCard();
    } else if (e.key === 'ArrowRight') {
      skipCard();
    }
  }
});

// Bootstrapping
window.addEventListener('DOMContentLoaded', () => {
  initData();
});
