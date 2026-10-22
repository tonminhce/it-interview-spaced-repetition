/**
 * IT Interview Spaced Repetition (Linear & Raycast Inspired UI)
 * Features: Bento Grid, Smooth Reveal Flashcard, Mac Terminal Code Blocks,
 * Command Palette (Ctrl+K), SM-2 Algorithm & Canvas Confetti.
 */

// Technology configuration with distinctive branding colors & glows
const TOPICS_CONFIG = [
  { id: 'all', name: 'Tất cả chuyên đề (Full IT Deck)', icon: '🌟', color: '#6366f1', glow: 'rgba(99, 102, 241, 0.35)', desc: 'Tổng hợp toàn bộ 758 câu hỏi phỏng vấn chuẩn hóa' },
  { id: 'java', name: 'Java Core & JVM Internals', icon: '☕', color: '#f89820', glow: 'rgba(248, 152, 32, 0.35)', desc: 'Bytecode, JVM Memory, GC (G1/ZGC), Concurrency, Collections' },
  { id: 'spring-spring-boot', name: 'Spring & Spring Boot', icon: '🍃', color: '#10b981', glow: 'rgba(16, 185, 129, 0.35)', desc: 'IoC/DI, AOP, Bean Lifecycle, Transaction, Microservices' },
  { id: 'redis', name: 'Redis Caching & Architecture', icon: '⚡', color: '#ef4444', glow: 'rgba(239, 68, 68, 0.35)', desc: 'Data structures, RDB/AOF, Cluster, Sentinel, Redlock' },
  { id: 'kafka', name: 'Apache Kafka Event Streaming', icon: '📨', color: '#06b6d4', glow: 'rgba(6, 182, 212, 0.35)', desc: 'Partitions, Consumer Groups, Exactly-once, Rebalance' },
  { id: 'system-design', name: 'System Design & Scalability', icon: '📐', color: '#8b5cf6', glow: 'rgba(139, 92, 246, 0.35)', desc: 'High Availability, Sharding, CAP, Rate Limiting, Microservices' },
  { id: 'database-essentials', name: 'Database Essentials & SQL', icon: '🗄️', color: '#3b82f6', glow: 'rgba(59, 130, 246, 0.35)', desc: 'B-Tree Index, ACID, MVCC, Locks, Query Optimization' },
  { id: 'postgresql', name: 'PostgreSQL Deep Dive', icon: '🐘', color: '#38bdf8', glow: 'rgba(56, 189, 248, 0.35)', desc: 'VACUUM, WAL, HOT Updates, GIN/BRIN, EXPLAIN ANALYZE' },
  { id: 'docker-kubernetes', name: 'Docker & Kubernetes (DevOps)', icon: '🐳', color: '#0ea5e9', glow: 'rgba(14, 165, 233, 0.35)', desc: 'Image Layers, Pods, Services, Ingress, Deployments, HPA' }
];

// Application State
const state = {
  data: null,
  allCards: [],
  topicMap: {},
  srsData: { cards: {}, stats: { reviewsToday: 0, lastStudyDate: '', streak: 0 } },
  currentView: 'home', // 'home' | 'study' | 'browse'
  currentTopicId: null,
  currentCardIndex: 0,
  studyQueue: [],
  isRevealed: false,   // Smooth reveal state
  language: 'vi',      // 'vi' | 'en'
  searchQuery: '',
  filterLevel: 'all',
  filterStatus: 'all',
  theme: localStorage.getItem('srs_theme') || 'dark',
  cmdPaletteOpen: false,
  cmdSelectedIndex: 0
};

// Utilities
const getTodayStr = () => new Date().toISOString().split('T')[0];

const addDays = (dateStr, days) => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

// Markdown Renderer with Mac Terminal Code Blocks & Callouts
function renderEnhancedMarkdown(md) {
  if (!md) return '';
  let rawHtml = '';

  if (window.marked && typeof window.marked.parse === 'function') {
    rawHtml = window.marked.parse(md);
  } else {
    rawHtml = md
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*)\*/gim, '<em>$1</em>')
      .replace(/`([^`]+)`/gim, '<code>$1</code>')
      .replace(/\n\n/gim, '<p></p>')
      .replace(/\n/gim, '<br>');
  }

  // Inject Mac Terminal window chrome onto <pre><code> blocks
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = rawHtml;

  const preBlocks = tempDiv.querySelectorAll('pre');
  preBlocks.forEach((pre, index) => {
    const code = pre.querySelector('code');
    const codeText = code ? code.innerText : pre.innerText;
    
    // Detect language if marked annotated it
    let lang = 'CODE';
    if (code && code.className) {
      const match = code.className.match(/language-([a-z0-9]+)/i);
      if (match) lang = match[1].toUpperCase();
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'mac-terminal-block';

    const header = document.createElement('div');
    header.className = 'mac-terminal-header';
    header.innerHTML = `
      <div class="mac-dots">
        <span class="mac-dot dot-red"></span>
        <span class="mac-dot dot-yellow"></span>
        <span class="mac-dot dot-green"></span>
      </div>
      <span class="terminal-lang-badge">${lang}</span>
      <button class="btn-copy-code" onclick="copySnippet(this, ${index})">Copy</button>
    `;

    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(header);
    wrapper.appendChild(pre);

    // Save text in a data attribute for easy copying
    wrapper.setAttribute('data-code', encodeURIComponent(codeText));
  });

  // Enhance Callouts for Key Takeaways / Warnings
  const blockquotes = tempDiv.querySelectorAll('blockquote');
  blockquotes.forEach(bq => {
    bq.className = 'callout-box';
    if (bq.innerText.toLowerCase().includes('lỗi thường gặp') || bq.innerText.toLowerCase().includes('pitfall') || bq.innerText.toLowerCase().includes('lưu ý')) {
      bq.className = 'callout-box callout-pitfall';
    }
  });

  return tempDiv.innerHTML;
}

// Copy Code Snippet Handler
function copySnippet(btn, index) {
  const wrapper = btn.closest('.mac-terminal-block');
  if (!wrapper) return;
  const rawCode = decodeURIComponent(wrapper.getAttribute('data-code') || '');
  navigator.clipboard.writeText(rawCode).then(() => {
    const originalText = btn.textContent;
    btn.textContent = '✓ Copied!';
    btn.style.color = '#10b981';
    btn.style.borderColor = '#10b981';
    setTimeout(() => {
      btn.textContent = originalText;
      btn.style.color = '';
      btn.style.borderColor = '';
    }, 2000);
  });
}

// Spaced Repetition Engine (SuperMemo SM-2)
class SRSEngine {
  static getCardKey(topicId, cardId) {
    return `${topicId}_${cardId}`;
  }

  static getCardRecord(key) {
    if (!state.srsData.cards[key]) {
      return {
        state: 'new',
        interval: 0,
        ease: 2.5,
        reps: 0,
        lapses: 0,
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

    const today = getTodayStr();
    if (!state.srsData.stats) {
      state.srsData.stats = { reviewsToday: 0, lastStudyDate: today, streak: 0 };
    }
    if (state.srsData.stats.lastStudyDate !== today) {
      const yesterday = addDays(today, -1);
      if (state.srsData.stats.lastStudyDate !== yesterday && state.srsData.stats.lastStudyDate !== today) {
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
    let record = SRSEngine.getCardRecord(key);
    let today = getTodayStr();

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
      record.due = addDays(today, record.interval);
    } else if (rating === 3) {
      if (record.reps === 0) record.interval = 1;
      else if (record.reps === 1) record.interval = 3;
      else record.interval = Math.max(2, Math.round((record.interval || 1) * (record.ease || 2.5)));
      
      record.reps = (record.reps || 0) + 1;
      record.state = record.reps >= 4 ? 'mastered' : 'review';
      record.due = addDays(today, record.interval);
    } else if (rating === 4) {
      if (record.reps === 0) record.interval = 3;
      else if (record.reps === 1) record.interval = 6;
      else record.interval = Math.max(4, Math.round((record.interval || 1) * (record.ease || 2.5) * 1.3));
      
      record.reps = (record.reps || 0) + 1;
      record.ease = (record.ease || 2.5) + 0.15;
      record.state = record.reps >= 3 ? 'mastered' : 'review';
      record.due = addDays(today, record.interval);
    }

    state.srsData.cards[key] = record;
    state.srsData.stats.reviewsToday = (state.srsData.stats.reviewsToday || 0) + 1;
    if (state.srsData.stats.streak === 0) state.srsData.stats.streak = 1;
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
      <div class="container" style="text-align: center; padding: 5rem 1rem;">
        <h2 style="font-size: 1.5rem; margin-bottom: 0.5rem;">⚠️ Chưa tìm thấy dữ liệu câu hỏi</h2>
        <p style="color: var(--text-secondary);">Vui lòng kiểm tra file <code>data.js</code>.</p>
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

// Theme Handling
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

// Statistics Calculations
function getTopicStats(topicId) {
  let cards = topicId === 'all' ? state.allCards : (state.topicMap[topicId]?.questions || []);
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
      due++;
    } else {
      if (srs.state === 'mastered') mastered++;
      else learning++;

      if (srs.due <= today) due++;
      if (srs.starred) starred++;
    }
  });

  return { total: cards.length, mastered, learning, due, newCards, starred };
}

function getGlobalStats() {
  const stats = getTopicStats('all');
  const pctMastered = stats.total > 0 ? Math.round((stats.mastered / stats.total) * 100) : 0;
  return {
    ...stats,
    pctMastered,
    reviewsToday: state.srsData.stats.reviewsToday || 0,
    streak: state.srsData.stats.streak || 0
  };
}

// Router & View Switcher
function navigateTo(view, topicId = null) {
  state.currentView = view;
  state.currentTopicId = topicId;
  state.isRevealed = false;
  state.currentCardIndex = 0;

  if (view === 'study') {
    setupStudyQueue(topicId);
  }

  updateSessionProgress(0);
  renderApp();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setupStudyQueue(topicId) {
  let cards = topicId === 'all' ? [...state.allCards] : [...(state.topicMap[topicId]?.questions || [])];
  const today = getTodayStr();

  // Prioritize due cards first, then new, then learning
  cards.sort((a, b) => {
    const keyA = SRSEngine.getCardKey(a.topicId || topicId, a.id);
    const keyB = SRSEngine.getCardKey(b.topicId || topicId, b.id);
    const srsA = state.srsData.cards[keyA];
    const srsB = state.srsData.cards[keyB];

    const isDueA = !srsA || srsA.due <= today ? 1 : 0;
    const isDueB = !srsB || srsB.due <= today ? 1 : 0;
    return isDueB - isDueA;
  });

  state.studyQueue = cards;
  state.currentCardIndex = 0;
}

function updateSessionProgress(pct) {
  const fill = document.getElementById('session-progress-fill');
  if (fill) fill.style.width = `${pct}%`;
}

// Master Render Function
function renderApp() {
  const app = document.getElementById('app');
  if (!app) return;

  if (state.currentView === 'home') {
    updateSessionProgress(0);
    renderHomeBentoView(app);
  } else if (state.currentView === 'study') {
    renderStudySmoothView(app);
  } else if (state.currentView === 'browse') {
    updateSessionProgress(0);
    renderBrowseView(app);
  }
}

// ==========================================================================
// 1. HOME VIEW (BENTO GRID DASHBOARD)
// ==========================================================================
function renderHomeBentoView(container) {
  const g = getGlobalStats();

  let html = `
    <main class="main-content">
      <div class="container">
        <!-- Bento Top Hero Section -->
        <div class="bento-hero-section">
          <!-- Bento Cell 1: Goal & Quick Resume -->
          <div class="bento-cell bento-hero-cell">
            <div>
              <div class="hero-tag">Mục Tiêu Ôn Luyện Hôm Nay</div>
              <h2 class="hero-goal-title">
                ${g.due > 0 ? `Bạn có <span style="color: #6366f1;">${g.due} câu hỏi</span> cần ôn tập` : `🎉 Bạn đã hoàn thành toàn bộ mục tiêu hôm nay!`}
              </h2>
              <p class="hero-goal-desc">
                Ứng dụng thuật toán Spaced Repetition (SM-2) để tối ưu thời điểm ôn tập lặp lại, giúp biến kiến thức phỏng vấn IT thành phản xạ tự nhiên.
              </p>
            </div>

            <div class="hero-actions-bar">
              <button class="btn btn-primary" onclick="navigateTo('study', 'all')">
                ⚡ Ôn Tập Ngay (${g.due > 0 ? g.due : g.total} Thẻ)
              </button>
              <button class="cmd-k-trigger" onclick="openCommandPalette()">
                <span>🔍 Tìm kiếm nhanh</span>
                <kbd>Ctrl K</kbd>
              </button>
            </div>
          </div>

          <!-- Bento Cell 2: Streak Widget -->
          <div class="bento-cell bento-streak-cell">
            <div class="streak-flame-wrapper">🔥</div>
            <div class="streak-value">${g.streak} <span style="font-size: 1rem; color: var(--text-secondary); font-weight: 500;">ngày</span></div>
            <div class="streak-label">Chuỗi ngày ôn luyện</div>
            <p style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 0.5rem;">
              ${g.reviewsToday > 0 ? `Hôm nay đã ôn ${g.reviewsToday} lượt.` : `Chưa ôn câu nào hôm nay.`}
            </p>
          </div>

          <!-- Bento Cell 3: Global Mastery Progress -->
          <div class="bento-cell" style="justify-content: space-between;">
            <div>
              <div class="streak-label">Mức Độ Thành Thạo</div>
              <div class="bento-stat-number" style="margin-top: 0.4rem; color: #10b981;">${g.pctMastered}%</div>
              <p style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 0.25rem;">
                ${g.mastered} / ${g.total} câu thuộc lòng
              </p>
            </div>

            <div style="margin-top: 1rem;">
              <div class="progress-stacked-bar">
                <div class="prog-seg-mastered" style="width: ${g.pctMastered}%;"></div>
                <div class="prog-seg-learning" style="width: ${Math.round((g.learning / g.total) * 100)}%;"></div>
              </div>
              <div class="progress-legend-row" style="margin-bottom: 0;">
                <span>📖 ${g.learning} đang rèn</span>
                <span>✨ ${g.newCards} mới</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Section Title -->
        <div class="section-headline">
          <div>
            <h2 class="section-title">Chuyên Đề Công Nghệ (8 Khối Kiến Thức)</h2>
            <p class="section-caption">Chọn một chuyên đề để bắt đầu ôn tập chuyên sâu hoặc xem toàn bộ danh sách</p>
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <button class="btn btn-secondary" onclick="openDataModal()">⚙️ Quản lý dữ liệu</button>
          </div>
        </div>

        <!-- Tech Bento Grid -->
        <div class="bento-topics-grid">
  `;

  TOPICS_CONFIG.forEach(topic => {
    const stats = getTopicStats(topic.id);
    const masteredPct = stats.total > 0 ? Math.round((stats.mastered / stats.total) * 100) : 0;
    const learningPct = stats.total > 0 ? Math.round((stats.learning / stats.total) * 100) : 0;
    const newPct = stats.total > 0 ? 100 - masteredPct - learningPct : 100;

    html += `
      <div class="tech-card" style="--topic-accent: ${topic.color}; --topic-glow: ${topic.glow};">
        <div class="tech-card-header">
          <div class="tech-icon-container" style="color: ${topic.color};">${topic.icon}</div>
          <div class="tech-title-group">
            <h3>${topic.name}</h3>
            <span class="tech-count-badge">${stats.total} câu hỏi chuẩn hóa</span>
          </div>
        </div>

        <p style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 1.15rem; line-height: 1.45;">
          ${topic.desc}
        </p>

        <!-- Progress Bar -->
        <div class="progress-stacked-bar">
          <div class="prog-seg-mastered" style="width: ${masteredPct}%;" title="Thành thạo: ${stats.mastered}"></div>
          <div class="prog-seg-learning" style="width: ${learningPct}%;" title="Đang học: ${stats.learning}"></div>
          <div class="prog-seg-new" style="width: ${newPct}%;" title="Thẻ mới: ${stats.newCards}"></div>
        </div>
        <div class="progress-legend-row">
          <span>Tiến độ thành thạo: <strong>${masteredPct}%</strong></span>
          <span>${stats.mastered}/${stats.total}</span>
        </div>

        <!-- Badges -->
        <div class="tech-badge-row">
          ${stats.due > 0 ? `<span class="mini-badge badge-due-glow">⏰ ${stats.due} cần ôn</span>` : `<span class="mini-badge badge-mastered-glow">✓ Đã xong hôm nay</span>`}
          <span class="mini-badge badge-learning-glow">📖 ${stats.learning} đang học</span>
          <span class="mini-badge badge-new-dim">✨ ${stats.newCards} mới</span>
          ${stats.starred > 0 ? `<span class="mini-badge" style="background: rgba(251, 191, 36, 0.12); color: #fbbf24; border: 1px solid rgba(251, 191, 36, 0.25);">⭐ ${stats.starred}</span>` : ''}
        </div>

        <!-- Actions -->
        <div class="tech-card-actions">
          <button class="btn btn-primary" onclick="navigateTo('study', '${topic.id}')">
            🔥 Học Ngay (${stats.due > 0 ? stats.due : stats.total})
          </button>
          <button class="btn btn-secondary" onclick="navigateTo('browse', '${topic.id}')" title="Xem danh mục câu hỏi">
            📋 Danh sách
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
}

// ==========================================================================
// 2. STUDY VIEW (SMOOTH EXPAND / REVEAL FLASHCARD ENGINE)
// ==========================================================================
function renderStudySmoothView(container) {
  const topicId = state.currentTopicId;
  const topicCfg = TOPICS_CONFIG.find(t => t.id === topicId) || TOPICS_CONFIG[0];
  const totalInQueue = state.studyQueue.length;

  // Calculate current progress %
  const currentPct = totalInQueue > 0 ? Math.round(((state.currentCardIndex) / totalInQueue) * 100) : 100;
  updateSessionProgress(currentPct);

  // Deck completed state
  if (totalInQueue === 0 || state.currentCardIndex >= totalInQueue) {
    updateSessionProgress(100);
    triggerConfetti();

    container.innerHTML = `
      <main class="main-content">
        <div class="container study-view-wrapper">
          <div class="smooth-card" style="text-align: center; padding: 4rem 2rem;">
            <div style="font-size: 3.5rem; margin-bottom: 1rem;">🎉</div>
            <h2 style="font-size: 1.6rem; font-weight: 800; letter-spacing: -0.025em; margin-bottom: 0.5rem;">
              Tuyệt vời! Bạn đã hoàn thành phiên ôn tập!
            </h2>
            <p style="color: var(--text-secondary); max-width: 480px; margin: 0 auto 1.75rem auto; line-height: 1.6;">
              Tất cả các thẻ trong chuyên đề <strong>${topicCfg.name}</strong> đã được đánh giá và cập nhật chu kỳ Spaced Repetition (SM-2).
            </p>
            <div style="display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap;">
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

  let levelTagClass = 'chip-beginner';
  let levelName = 'Cơ bản';
  if (card.level === 'intermediate') {
    levelTagClass = 'chip-intermediate';
    levelName = 'Trung cấp';
  } else if (card.level === 'advanced') {
    levelTagClass = 'chip-advanced';
    levelName = 'Nâng cao';
  }

  let html = `
    <main class="main-content">
      <div class="container study-view-wrapper">
        <!-- Top Nav & Meta Bar -->
        <div class="study-header-bar">
          <div class="study-deck-meta">
            <button class="btn btn-secondary" onclick="navigateTo('home')" style="padding: 0.35rem 0.75rem; font-size: 0.82rem;">
              ← Trang chủ
            </button>
            <span class="study-deck-name">${topicCfg.icon} ${topicCfg.name}</span>
            <span class="study-counter-chip">${state.currentCardIndex + 1} / ${totalInQueue}</span>
          </div>

          <div style="display: flex; align-items: center; gap: 0.65rem;">
            <div class="lang-switch-toggle">
              <button class="lang-btn ${isVi ? 'active' : ''}" onclick="toggleLanguage('vi')">VI</button>
              <button class="lang-btn ${!isVi ? 'active' : ''}" onclick="toggleLanguage('en')">EN</button>
            </div>
            <button class="btn-icon" onclick="navigateTo('browse', '${topicId}')" title="Xem danh sách">📋</button>
          </div>
        </div>

        <!-- Master Flashcard (Smooth Reveal) -->
        <div class="smooth-card">
          <!-- Card Topbar -->
          <div class="smooth-card-topbar">
            <div class="smooth-tag-cluster">
              <span class="chip-tag chip-cat">${card.category || topicCfg.name}</span>
              ${card.subcategory ? `<span class="chip-tag chip-cat">${card.subcategory}</span>` : ''}
              <span class="chip-tag ${levelTagClass}">${levelName}</span>
              ${srsRecord.interval > 0 ? `<span class="chip-tag chip-cat" style="color: var(--text-secondary);">Khoảng cách: ${srsRecord.interval}d</span>` : ''}
            </div>

            <div class="card-actions-cluster">
              <button class="btn-star-glow ${isStarred ? 'active' : ''}" onclick="toggleCardStar('${cardKey}')" title="Gắn sao câu hỏi này (Phím S)">
                ${isStarred ? '★' : '☆'}
              </button>
            </div>
          </div>

          <!-- Card Body -->
          <div class="smooth-card-body">
            <h1 class="card-question-title">${questionText}</h1>

            ${!state.isRevealed ? `
              <!-- Trigger Banner to reveal answer -->
              <div class="reveal-trigger-banner" onclick="revealAnswer()">
                <div class="reveal-icon-spark">💡</div>
                <div class="reveal-prompt-text">
                  <span>Bấm vào đây để mở rộng đáp án chi tiết</span>
                  <kbd>SPACE / ENTER</kbd>
                </div>
              </div>
            ` : `
              <!-- Expanded Answer Content -->
              <div class="expanded-answer-container">
                <div class="answer-header-pill">
                  <span>⚡ Phân Tích Kỹ Thuật & Lời Giải Chuẩn Phỏng Vấn:</span>
                </div>

                <div class="markdown-body">
                  ${renderEnhancedMarkdown(answerMarkdown)}
                </div>

                ${card.references && card.references.length > 0 ? `
                  <div class="references-footer">
                    <div class="references-title">Tài liệu tham khảo chuyên sâu:</div>
                    ${card.references.map(ref => `
                      <a href="${ref.url}" target="_blank" rel="noopener noreferrer">↗ ${ref.label || ref.url}</a>
                    `).join('')}
                  </div>
                ` : ''}
              </div>
            `}
          </div>
        </div>

        <!-- Floating Action Dock (Always Visible, ratings active when revealed) -->
        <div class="floating-action-dock">
          ${!state.isRevealed ? `
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <button class="btn btn-primary" onclick="revealAnswer()" style="width: 100%; padding: 0.85rem; font-size: 1rem;">
                <span>💡 Xem Lời Giải Chi Tiết</span>
                <kbd style="margin-left: 0.5rem; background: rgba(255,255,255,0.2); color: #fff;">SPACE</kbd>
              </button>
            </div>
          ` : `
            <div class="dock-ratings-grid">
              <button class="dock-rate-btn btn-again-glow" onclick="rateCurrentCard(1)">
                <span class="dock-key-badge"><kbd>1</kbd></span>
                <span class="dock-time-pill">${intervals.again}</span>
                <span class="dock-title">Lặp lại</span>
              </button>
              <button class="dock-rate-btn btn-hard-glow" onclick="rateCurrentCard(2)">
                <span class="dock-key-badge"><kbd>2</kbd></span>
                <span class="dock-time-pill">${intervals.hard}</span>
                <span class="dock-title">Khó</span>
              </button>
              <button class="dock-rate-btn btn-good-glow" onclick="rateCurrentCard(3)">
                <span class="dock-key-badge"><kbd>3</kbd></span>
                <span class="dock-time-pill">${intervals.good}</span>
                <span class="dock-title">Được</span>
              </button>
              <button class="dock-rate-btn btn-easy-glow" onclick="rateCurrentCard(4)">
                <span class="dock-key-badge"><kbd>4</kbd></span>
                <span class="dock-time-pill">${intervals.easy}</span>
                <span class="dock-title">Dễ</span>
              </button>
            </div>
          `}

          <div class="dock-aux-controls">
            <button class="btn btn-secondary" onclick="prevCard()" ${state.currentCardIndex === 0 ? 'disabled' : ''} style="padding: 0.35rem 0.75rem; font-size: 0.8rem;">
              ← Thẻ trước
            </button>
            <span style="font-size: 0.75rem;">Phím: <kbd>Space</kbd> mở | <kbd>1-4</kbd> đánh giá | <kbd>S</kbd> sao | <kbd>L</kbd> ngôn ngữ</span>
            <button class="btn btn-secondary" onclick="skipCard()" style="padding: 0.35rem 0.75rem; font-size: 0.8rem;">
              Bỏ qua →
            </button>
          </div>
        </div>
      </div>
    </main>
  `;

  container.innerHTML = html;
}

// ==========================================================================
// 3. BROWSE / LIST VIEW
// ==========================================================================
function renderBrowseView(container) {
  const topicId = state.currentTopicId || 'all';
  const topicCfg = TOPICS_CONFIG.find(t => t.id === topicId) || TOPICS_CONFIG[0];
  let rawList = topicId === 'all' ? [...state.allCards] : [...(state.topicMap[topicId]?.questions || [])];

  const query = state.searchQuery.toLowerCase();
  const filtered = rawList.filter(card => {
    if (query) {
      const matchQ = (card.q || '').toLowerCase().includes(query) || (card.q_en || '').toLowerCase().includes(query);
      const matchA = (card.a || '').toLowerCase().includes(query);
      const matchSub = (card.subcategory || '').toLowerCase().includes(query);
      if (!matchQ && !matchA && !matchSub) return false;
    }
    if (state.filterLevel !== 'all' && card.level !== state.filterLevel) return false;
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
      <div class="container" style="max-width: 980px;">
        <div class="section-headline">
          <div style="display: flex; align-items: center; gap: 0.85rem;">
            <button class="btn btn-secondary" onclick="navigateTo('home')">← Trang chủ</button>
            <h1 class="section-title">${topicCfg.icon} ${topicCfg.name}</h1>
          </div>
          <button class="btn btn-primary" onclick="navigateTo('study', '${topicId}')">🔥 Ôn Chuyên Đề Này</button>
        </div>

        <!-- Filter bar -->
        <div style="background: var(--bg-surface-1); border: 1px solid var(--border-hairline); border-radius: var(--radius-md); padding: 1rem; margin-bottom: 1.5rem; display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; justify-content: space-between;">
          <div style="position: relative; flex: 1; min-width: 260px;">
            <input type="text" id="browse-search-input" style="width: 100%; padding: 0.55rem 1rem; background: var(--bg-surface-2); border: 1px solid var(--border-hairline); border-radius: var(--radius-sm); color: var(--text-primary); font-size: 0.88rem; outline: none;" placeholder="Tìm theo từ khóa câu hỏi, nội dung..." value="${state.searchQuery}">
          </div>

          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <select id="filter-level" onchange="state.filterLevel = this.value; renderBrowseView(document.getElementById('app'));" style="padding: 0.5rem 0.75rem; background: var(--bg-surface-2); border: 1px solid var(--border-hairline); border-radius: var(--radius-sm); color: var(--text-primary); font-size: 0.85rem;">
              <option value="all" ${state.filterLevel === 'all' ? 'selected' : ''}>Mọi độ khó</option>
              <option value="beginner" ${state.filterLevel === 'beginner' ? 'selected' : ''}>Cơ bản</option>
              <option value="intermediate" ${state.filterLevel === 'intermediate' ? 'selected' : ''}>Trung cấp</option>
              <option value="advanced" ${state.filterLevel === 'advanced' ? 'selected' : ''}>Nâng cao</option>
            </select>

            <select id="filter-status" onchange="state.filterStatus = this.value; renderBrowseView(document.getElementById('app'));" style="padding: 0.5rem 0.75rem; background: var(--bg-surface-2); border: 1px solid var(--border-hairline); border-radius: var(--radius-sm); color: var(--text-primary); font-size: 0.85rem;">
              <option value="all" ${state.filterStatus === 'all' ? 'selected' : ''}>Tất cả trạng thái</option>
              <option value="due" ${state.filterStatus === 'due' ? 'selected' : ''}>⏰ Đến hạn</option>
              <option value="learning" ${state.filterStatus === 'learning' ? 'selected' : ''}>📖 Đang học</option>
              <option value="mastered" ${state.filterStatus === 'mastered' ? 'selected' : ''}>🏆 Đã thuộc</option>
              <option value="new" ${state.filterStatus === 'new' ? 'selected' : ''}>✨ Thẻ mới</option>
              <option value="starred" ${state.filterStatus === 'starred' ? 'selected' : ''}>⭐ Có gắn sao</option>
            </select>
          </div>
        </div>

        <!-- Question Cards List -->
        <div style="background: var(--bg-surface-1); border: 1px solid var(--border-hairline); border-radius: var(--radius-lg); overflow: hidden;">
  `;

  if (filtered.length === 0) {
    html += `
      <div style="text-align: center; padding: 3rem 1rem; color: var(--text-secondary);">
        Không tìm thấy câu hỏi phù hợp.
      </div>
    `;
  } else {
    filtered.forEach((card, idx) => {
      const cardKey = SRSEngine.getCardKey(card.topicId || topicId, card.id);
      const srs = state.srsData.cards[cardKey] || { state: 'new' };
      const isStarred = srs.starred;

      html += `
        <div style="border-bottom: 1px solid var(--border-hairline); padding: 1.15rem 1.4rem; cursor: pointer; transition: background 0.15s; display: flex; gap: 1rem; align-items: flex-start;"
             onmouseover="this.style.background='var(--bg-surface-2)'" onmouseout="this.style.background='transparent'"
             onclick="openCardInStudy('${card.topicId || topicId}', ${card.id})">
          <div style="font-family: var(--font-mono); font-size: 0.78rem; color: var(--text-muted); width: 32px; padding-top: 0.2rem;">#${idx + 1}</div>
          <div style="flex: 1;">
            <div style="display: flex; gap: 0.4rem; align-items: center; margin-bottom: 0.35rem; flex-wrap: wrap;">
              <span class="chip-tag chip-cat">${card.category || topicCfg.name}</span>
              ${card.subcategory ? `<span class="chip-tag chip-cat">${card.subcategory}</span>` : ''}
              ${srs.state === 'mastered' ? `<span class="mini-badge badge-mastered-glow">Đã thuộc</span>` : ''}
              ${srs.state === 'learning' ? `<span class="mini-badge badge-learning-glow">${srs.interval}d</span>` : ''}
              ${isStarred ? `<span style="color: #fbbf24;">★</span>` : ''}
            </div>
            <div style="font-size: 1rem; font-weight: 600; line-height: 1.4; color: var(--text-primary);">${card.q}</div>
            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.35rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
              ${(card.a || '').replace(/[\*#`]/g, '').substring(0, 160)}...
            </div>
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

  const bInput = document.getElementById('browse-search-input');
  if (bInput) {
    bInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      renderBrowseView(container);
    });
  }
}

// User Actions
function revealAnswer() {
  state.isRevealed = true;
  renderApp();
}

function rateCurrentCard(rating) {
  const card = state.studyQueue[state.currentCardIndex];
  if (!card) return;

  const topicId = state.currentTopicId;
  const cardKey = SRSEngine.getCardKey(card.topicId || topicId, card.id);

  SRSEngine.rateCard(cardKey, rating);

  if (rating === 1) {
    // Push failed card to reappear later in the session
    state.studyQueue.push(card);
  }

  state.currentCardIndex++;
  state.isRevealed = false;
  renderApp();
}

function prevCard() {
  if (state.currentCardIndex > 0) {
    state.currentCardIndex--;
    state.isRevealed = false;
    renderApp();
  }
}

function skipCard() {
  if (state.currentCardIndex < state.studyQueue.length - 1) {
    state.currentCardIndex++;
    state.isRevealed = false;
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
  state.isRevealed = false;
  renderApp();
}

// ==========================================================================
// 4. COMMAND PALETTE (CTRL + K / SPOTLIGHT SEARCH)
// ==========================================================================
function openCommandPalette() {
  state.cmdPaletteOpen = true;
  const existing = document.getElementById('cmd-palette-root');
  if (existing) existing.remove();

  const backdrop = document.createElement('div');
  backdrop.className = 'cmd-palette-backdrop';
  backdrop.id = 'cmd-palette-root';
  backdrop.onclick = (e) => {
    if (e.target === backdrop) closeCommandPalette();
  };

  backdrop.innerHTML = `
    <div class="cmd-palette-modal">
      <div class="cmd-search-header">
        <span style="font-size: 1.1rem; color: var(--text-muted);">🔍</span>
        <input type="text" id="cmd-input" class="cmd-search-input" placeholder="Tìm kiếm bất kỳ câu hỏi nào trong 758 câu hoặc gõ lệnh..." autofocus>
        <kbd>ESC</kbd>
      </div>
      <div class="cmd-results-list" id="cmd-results"></div>
      <div class="cmd-footer">
        <span>Dùng phím <kbd>↑</kbd> <kbd>↓</kbd> để di chuyển</span>
        <span>Nhấn <kbd>Enter</kbd> để mở</span>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);
  const input = document.getElementById('cmd-input');
  input.focus();
  input.addEventListener('input', updateCommandResults);
  input.addEventListener('keydown', handleCommandKeyDown);

  updateCommandResults();
}

function closeCommandPalette() {
  state.cmdPaletteOpen = false;
  const root = document.getElementById('cmd-palette-root');
  if (root) root.remove();
}

function updateCommandResults() {
  const input = document.getElementById('cmd-input');
  const resultsContainer = document.getElementById('cmd-results');
  if (!input || !resultsContainer) return;

  const query = input.value.trim().toLowerCase();
  let items = [];

  if (!query) {
    // Quick Actions
    items.push({ type: 'header', label: 'Chuyên đề học tập' });
    TOPICS_CONFIG.forEach(t => {
      items.push({
        type: 'topic',
        icon: t.icon,
        title: `Học chuyên đề: ${t.name}`,
        action: () => { closeCommandPalette(); navigateTo('study', t.id); }
      });
    });
    items.push({ type: 'header', label: 'Tùy chọn hệ thống' });
    items.push({
      type: 'action',
      icon: '🌓',
      title: 'Đổi giao diện Sáng / Tối',
      action: () => { toggleTheme(); closeCommandPalette(); }
    });
    items.push({
      type: 'action',
      icon: '⚙️',
      title: 'Quản lý / Sao lưu dữ liệu tiến độ (Export/Import)',
      action: () => { closeCommandPalette(); openDataModal(); }
    });
  } else {
    // Search across questions
    const matched = state.allCards.filter(c => 
      (c.q || '').toLowerCase().includes(query) || (c.q_en || '').toLowerCase().includes(query)
    ).slice(0, 15);

    if (matched.length > 0) {
      items.push({ type: 'header', label: `Câu hỏi tìm thấy (${matched.length})` });
      matched.forEach(c => {
        items.push({
          type: 'question',
          icon: '💡',
          title: c.q,
          badge: c.category,
          action: () => {
            closeCommandPalette();
            openCardInStudy(c.topicId, c.id);
          }
        });
      });
    } else {
      items.push({ type: 'header', label: 'Không tìm thấy câu hỏi phù hợp' });
    }
  }

  // Render items
  let html = '';
  let selectableIndex = 0;
  items.forEach((item) => {
    if (item.type === 'header') {
      html += `<div class="cmd-group-label">${item.label}</div>`;
    } else {
      const isSelected = selectableIndex === state.cmdSelectedIndex;
      html += `
        <div class="cmd-item ${isSelected ? 'selected' : ''}" data-idx="${selectableIndex}" onclick="executeCmdItem(${selectableIndex})">
          <div class="cmd-item-left">
            <span>${item.icon}</span>
            <span class="cmd-item-title">${item.title}</span>
          </div>
          ${item.badge ? `<span class="chip-tag chip-cat">${item.badge}</span>` : ''}
        </div>
      `;
      selectableIndex++;
    }
  });

  resultsContainer.innerHTML = html;
  state.currentCmdItems = items.filter(i => i.type !== 'header');
}

function handleCommandKeyDown(e) {
  const items = state.currentCmdItems || [];
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    state.cmdSelectedIndex = (state.cmdSelectedIndex + 1) % items.length;
    updateCommandSelection();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    state.cmdSelectedIndex = (state.cmdSelectedIndex - 1 + items.length) % items.length;
    updateCommandSelection();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    executeCmdItem(state.cmdSelectedIndex);
  } else if (e.key === 'Escape') {
    closeCommandPalette();
  }
}

function updateCommandSelection() {
  const domItems = document.querySelectorAll('.cmd-item');
  domItems.forEach((el, idx) => {
    if (idx === state.cmdSelectedIndex) el.classList.add('selected');
    else el.classList.remove('selected');
  });
}

function executeCmdItem(index) {
  const items = state.currentCmdItems || [];
  if (items[index] && typeof items[index].action === 'function') {
    items[index].action();
  }
}

// ==========================================================================
// 5. CANVAS CONFETTI CELEBRATION
// ==========================================================================
function triggerConfetti() {
  let canvas = document.getElementById('confetti-canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'confetti-canvas';
    document.body.appendChild(canvas);
  }

  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = [];
  const colors = ['#6366f1', '#a855f7', '#ec4899', '#38bdf8', '#10b981', '#f59e0b'];

  for (let i = 0; i < 90; i++) {
    particles.push({
      x: canvas.width / 2,
      y: canvas.height / 2,
      vx: (Math.random() - 0.5) * 16,
      vy: (Math.random() - 0.5) * 16 - 3,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 1,
      rotation: Math.random() * 360,
      vrot: (Math.random() - 0.5) * 10
    });
  }

  function renderConfetti() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;

    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.25; // gravity
      p.alpha -= 0.012;
      p.rotation += p.vrot;

      if (p.alpha > 0) {
        alive = true;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }
    });

    if (alive) {
      requestAnimationFrame(renderConfetti);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.remove();
    }
  }

  requestAnimationFrame(renderConfetti);
}

// Data Management Modal (Export, Import, Reset)
function openDataModal() {
  const modal = document.createElement('div');
  modal.className = 'cmd-palette-backdrop';
  modal.id = 'data-modal';

  modal.innerHTML = `
    <div class="cmd-palette-modal" style="padding: 1.5rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
        <h3 style="font-size: 1.15rem; font-weight: 700;">⚙️ Quản lý Tiến Độ & Sao Lưu</h3>
        <button class="btn-icon" onclick="closeDataModal()">✕</button>
      </div>

      <div style="margin-bottom: 1.25rem;">
        <h4 style="font-size: 0.92rem; color: var(--accent-primary); margin-bottom: 0.4rem;">📥 Xuất dữ liệu (Export Backup)</h4>
        <p style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 0.65rem;">
          Tải về file JSON sao lưu toàn bộ lịch sử và tiến độ ôn tập Spaced Repetition của bạn.
        </p>
        <button class="btn btn-secondary" onclick="exportData()">💾 Tải File Backup JSON</button>
      </div>

      <div style="margin-bottom: 1.25rem; border-top: 1px solid var(--border-hairline); padding-top: 1.1rem;">
        <h4 style="font-size: 0.92rem; color: #10b981; margin-bottom: 0.4rem;">📤 Khôi phục tiến độ (Import)</h4>
        <p style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 0.65rem;">
          Nạp lại file backup JSON đã lưu trước đây để tiếp tục lộ trình học.
        </p>
        <input type="file" id="import-file-input" accept=".json" style="display: none;" onchange="handleFileImport(event)">
        <button class="btn btn-secondary" onclick="document.getElementById('import-file-input').click()">📁 Chọn File JSON Phục Hồi</button>
      </div>

      <div style="border-top: 1px solid var(--border-hairline); padding-top: 1.1rem;">
        <h4 style="font-size: 0.92rem; color: var(--color-again); margin-bottom: 0.4rem;">⚠️ Đặt lại toàn bộ tiến độ (Reset)</h4>
        <p style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 0.65rem;">
          Xóa toàn bộ lịch sử ôn tập và đưa 758 câu hỏi về trạng thái chưa học.
        </p>
        <button class="btn btn-secondary" style="color: var(--color-again); border-color: rgba(244,63,94,0.3);" onclick="resetAllProgress()">🗑️ Xóa Toàn Bộ Tiến Độ</button>
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
  const a = document.createElement('a');
  a.setAttribute("href", dataStr);
  a.setAttribute("download", `it_interview_srs_backup_${getTodayStr()}.json`);
  document.body.appendChild(a);
  a.click();
  a.remove();
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
        alert('Khôi phục dữ liệu tiến độ thành công!');
        closeDataModal();
        renderApp();
      } else {
        alert('File không hợp lệ: thiếu cấu trúc srs.');
      }
    } catch(err) {
      alert('Lỗi đọc file: ' + err.message);
    }
  };
  reader.readAsText(file);
}

function resetAllProgress() {
  if (confirm('Bạn có chắc chắn muốn đặt lại toàn bộ tiến độ và xóa lịch sử ôn tập?')) {
    state.srsData = { cards: {}, stats: { reviewsToday: 0, lastStudyDate: getTodayStr(), streak: 0 } };
    SRSEngine.saveSRS();
    alert('Đã đặt lại tiến độ thành công.');
    closeDataModal();
    renderApp();
  }
}

// Global Keyboard Shortcut Listener
window.addEventListener('keydown', (e) => {
  // Command Palette trigger: Ctrl+K or Cmd+K
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    if (state.cmdPaletteOpen) closeCommandPalette();
    else openCommandPalette();
    return;
  }

  // If in an input, skip study hotkeys
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
    return;
  }

  // Escape handling
  if (e.key === 'Escape') {
    if (state.cmdPaletteOpen) {
      closeCommandPalette();
      return;
    }
    if (document.getElementById('data-modal')) {
      closeDataModal();
      return;
    }
    if (state.currentView !== 'home') {
      navigateTo('home');
      return;
    }
  }

  // Flashcard View Shortcuts
  if (state.currentView === 'study') {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!state.isRevealed) {
        revealAnswer();
      }
    } else if (state.isRevealed) {
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
