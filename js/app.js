/**
 * Application shell — routing, global keyboard shortcuts, overlays and boot.
 */
(function (global) {
  'use strict';

  var U = global.U;
  var Store = global.Store;
  var Icons = global.Icons;

  var app = document.getElementById('app');

  // ---------------------------------------------------------------------------
  // Routing
  //
  // Routes live in the URL hash so a view can be deep-linked and the browser
  // back button works: #/home, #/study/<topic>, #/browse/<topic>
  // ---------------------------------------------------------------------------

  function parseHash() {
    var hash = (location.hash || '').replace(/^#\/?/, '');
    if (!hash) return { view: 'home', topicId: 'all' };
    var parts = hash.split('/');
    var view = parts[0];
    if (view !== 'study' && view !== 'browse' && view !== 'home') view = 'home';
    return { view: view, topicId: parts[1] || 'all' };
  }

  function syncHash(view, topicId, replace) {
    var next = view === 'home' ? '#/home' : '#/' + view + '/' + topicId;
    if (location.hash === next) return;
    if (replace && location.replace) {
      // Boot / external navigation: replace the entry rather than adding one.
      location.replace(location.pathname + location.search + next);
    } else {
      // In-app navigation pushes an entry so the back button works.
      location.hash = next;
    }
  }

  function navigate(view, topicId, fromHash) {
    var state = Store.state;

    state.view = view;
    state.topicId = topicId || 'all';
    state.cardIndex = 0;
    state.revealed = false;

    if (view === 'study') {
      state.queue = Store.buildQueue(state.topicId);
      state.sessionStats = { again: 0, hard: 0, good: 0, easy: 0, reviewed: 0 };
    }

    if (view === 'browse') {
      global.BrowseView.setTopic(state.topicId);
    }

    if (!fromHash) syncHash(view, state.topicId);

    render();
    window.scrollTo({ top: 0, behavior: 'auto' });
    updateChrome();
  }

  /**
   * Open a specific question, keeping the rest of the topic in the session.
   * @param {boolean} [reveal] land with the answer already expanded
   */
  function openQuestion(topicId, cardId, reveal) {
    var state = Store.state;

    state.view = 'study';
    state.topicId = topicId;
    state.revealed = !!reveal;

    var queue = Store.buildQueue(topicId);
    var idx = -1;
    for (var i = 0; i < queue.length; i++) {
      if (queue[i].id === cardId) { idx = i; break; }
    }
    // Bring the requested card to the front so it is the one on screen.
    if (idx > 0) {
      queue.unshift(queue.splice(idx, 1)[0]);
    }
    state.queue = queue;
    state.cardIndex = 0;
    state.sessionStats = { again: 0, hard: 0, good: 0, easy: 0, reviewed: 0 };

    syncHash('study', topicId);
    render();
    window.scrollTo({ top: 0, behavior: 'auto' });
    updateChrome();
  }

  function render() {
    if (!app) return;
    var view = Store.state.view;

    if (view === 'home') global.HomeView.render(app);
    else if (view === 'study') global.StudyView.render(app);
    else if (view === 'browse') global.BrowseView.render(app);

    updateChrome();
  }

  /** Reflect the current view in the header. */
  function updateChrome() {
    var view = Store.state.view;
    var brand = document.querySelector('.brand__tag');
    if (brand) {
      brand.textContent = view === 'home'
        ? 'SM-2 Spaced Repetition'
        : (view === 'study' ? 'Phiên ôn tập' : 'Danh sách câu hỏi');
    }
  }

  // ---------------------------------------------------------------------------
  // Celebration
  // ---------------------------------------------------------------------------

  function celebrate() {
    if (global.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var canvas = document.createElement('canvas');
    canvas.className = 'confetti-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    var w = global.innerWidth;
    var h = global.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.scale(dpr, dpr);

    var colors = ['#6d6af5', '#34d399', '#60a5fa', '#fbbf24', '#fb7185'];
    var particles = [];

    for (var i = 0; i < 64; i++) {
      var angle = (Math.PI * 2 * i) / 64 + Math.random() * 0.3;
      var speed = 3 + Math.random() * 5;
      particles.push({
        x: w / 2,
        y: h / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        size: 2 + Math.random() * 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        decay: 0.014 + Math.random() * 0.012
      });
    }

    var start = performance.now();

    function frame(now) {
      var elapsed = now - start;
      ctx.clearRect(0, 0, w, h);
      var alive = false;

      particles.forEach(function (p) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08;
        p.vx *= 0.99;
        p.alpha -= p.decay;

        if (p.alpha > 0) {
          alive = true;
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      if (alive && elapsed < 2200) {
        requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, w, h);
        canvas.remove();
      }
    }

    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------------------
  // Data modal
  // ---------------------------------------------------------------------------

  function openDataModal() {
    if (document.getElementById('data-modal')) return;

    var backdrop = U.el('div', { class: 'modal-backdrop', id: 'data-modal' });
    backdrop.innerHTML =
      '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="data-modal-title">' +
        '<div class="modal__header">' +
          '<h2 class="modal__title" id="data-modal-title">Quản lý tiến độ</h2>' +
          '<button class="icon-btn" data-modal-close aria-label="Đóng">' + Icons.get('x', { size: 15 }) + '</button>' +
        '</div>' +
        '<div class="modal__body">' +
          '<section class="modal__section">' +
            '<h3 class="modal__section-title">' + Icons.get('download', { size: 14 }) + 'Sao lưu</h3>' +
            '<p class="modal__section-text">Tải toàn bộ lịch sử ôn tập và chu kỳ SM-2 xuống máy dưới dạng file JSON.</p>' +
            '<button class="btn btn--secondary" data-modal-export>Tải file backup</button>' +
          '</section>' +
          '<section class="modal__section">' +
            '<h3 class="modal__section-title">' + Icons.get('upload', { size: 14 }) + 'Khôi phục</h3>' +
            '<p class="modal__section-text">Nạp lại một file backup đã lưu trước đây. Tiến độ hiện tại sẽ được thay thế.</p>' +
            '<input type="file" id="import-file" accept="application/json,.json" hidden>' +
            '<button class="btn btn--secondary" data-modal-import>Chọn file JSON</button>' +
          '</section>' +
          '<section class="modal__section">' +
            '<h3 class="modal__section-title" style="color:var(--danger)">' +
              Icons.get('triangleAlert', { size: 14 }) + 'Đặt lại</h3>' +
            '<p class="modal__section-text">Xoá toàn bộ tiến độ và đưa 758 câu hỏi về trạng thái chưa học. Không thể hoàn tác.</p>' +
            '<button class="btn btn--danger" data-modal-reset>Xoá toàn bộ tiến độ</button>' +
          '</section>' +
        '</div>' +
      '</div>';

    document.body.appendChild(backdrop);

    backdrop.addEventListener('mousedown', function (e) {
      if (e.target === backdrop) closeDataModal();
    });

    backdrop.addEventListener('click', function (e) {
      var t = e.target;

      if (t.closest('[data-modal-close]')) { closeDataModal(); return; }
      if (t.closest('[data-modal-export]')) { exportData(); return; }
      if (t.closest('[data-modal-import]')) {
        backdrop.querySelector('#import-file').click();
        return;
      }
      if (t.closest('[data-modal-reset]')) { resetProgress(); }
    });

    var fileInput = backdrop.querySelector('#import-file');
    fileInput.addEventListener('change', function (e) { importData(e.target.files[0]); });
  }

  function closeDataModal() {
    var modal = document.getElementById('data-modal');
    if (modal) modal.remove();
  }

  function exportData() {
    var name = 'it-interview-srs-' + U.todayStr() + '.json';
    U.downloadFile(name, JSON.stringify(Store.state.srs, null, 2));
    U.toast('Đã tải file backup');
  }

  function importData(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (evt) {
      try {
        var data = JSON.parse(evt.target.result);
        if (!data || !data.cards) throw new Error('Thiếu cấu trúc dữ liệu');
        Store.state.srs = data;
        Store.saveSRS();
        closeDataModal();
        render();
        U.toast('Đã khôi phục tiến độ');
      } catch (err) {
        U.toast('File không hợp lệ: ' + err.message, 'danger');
      }
    };
    reader.onerror = function () { U.toast('Không đọc được file', 'danger'); };
    reader.readAsText(file);
  }

  function resetProgress() {
    if (!global.confirm('Xoá toàn bộ tiến độ ôn tập? Hành động này không thể hoàn tác.')) return;
    Store.state.srs = {
      cards: {},
      stats: { reviewsToday: 0, lastStudyDate: U.todayStr(), streak: 0, history: {} }
    };
    Store.saveSRS();
    closeDataModal();
    render();
    U.toast('Đã đặt lại tiến độ');
  }

  // ---------------------------------------------------------------------------
  // Global keyboard shortcuts
  // ---------------------------------------------------------------------------

  function isTypingTarget(el) {
    if (!el) return false;
    var tag = el.tagName;
    return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || el.isContentEditable;
  }

  function onKeyDown(e) {
    // Command palette works everywhere, including inside inputs.
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      global.Palette.toggle();
      return;
    }

    if (e.key === 'Escape') {
      if (global.Palette.isOpen()) { global.Palette.close(); return; }
      if (document.getElementById('data-modal')) { closeDataModal(); return; }
      if (Store.state.view !== 'home') { navigate('home'); }
      return;
    }

    if (isTypingTarget(e.target)) return;

    var view = Store.state.view;

    if (view === 'study') {
      var onButton = e.target.closest ? e.target.closest('button') : null;

      if ((e.key === ' ' || e.key === 'Enter') && !onButton) {
        e.preventDefault();
        // Space reveals the answer; on the answer side it means "I recalled
        // it" — the same shortcut Anki uses.
        if (!Store.state.revealed) global.StudyView.reveal(app);
        else global.StudyView.rate(app, 3);
        return;
      }

      if (Store.state.revealed && e.key >= '1' && e.key <= '4') {
        e.preventDefault();
        global.StudyView.rate(app, parseInt(e.key, 10));
        return;
      }

      var key = e.key.toLowerCase();
      if (key === 's') { e.preventDefault(); global.StudyView.toggleStar(app); return; }
      if (key === 'l') { e.preventDefault(); global.StudyView.toggleLanguage(app); return; }

      if (e.key === 'ArrowLeft') { e.preventDefault(); global.StudyView.go(-1, app); return; }
      if (e.key === 'ArrowRight') { e.preventDefault(); global.StudyView.go(1, app); return; }
    }

    // "/" focuses the browse search field.
    if (e.key === '/' && view === 'browse') {
      var input = document.getElementById('browse-search');
      if (input) { e.preventDefault(); input.focus(); input.select(); }
    }
  }

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------

  function boot() {
    if (!Store.init()) return;

    // Header wiring.
    var themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) themeBtn.addEventListener('click', function () { Store.toggleTheme(); });

    var paletteBtn = document.getElementById('search-trigger');
    if (paletteBtn) paletteBtn.addEventListener('click', function () { global.Palette.open(); });

    var dataBtn = document.getElementById('data-btn');
    if (dataBtn) dataBtn.addEventListener('click', openDataModal);

    var brand = document.querySelector('.brand');
    if (brand) brand.addEventListener('click', function () { navigate('home'); });

    // Code copy buttons inside rendered answers.
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-copy-code]');
      if (!btn) return;
      var text = btn.getAttribute('data-copy-code') || '';
      var done = false;

      function markDone() {
        if (done) return;
        done = true;
        btn.classList.add('is-done');
        btn.innerHTML = Icons.get('check', { size: 13 }) + '<span>Đã sao chép</span>';
        setTimeout(function () {
          btn.classList.remove('is-done');
          btn.innerHTML = Icons.get('copy', { size: 13 }) + '<span>Copy</span>';
        }, 1800);
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(markDone, function () { fallbackCopy(text, markDone); });
      } else {
        fallbackCopy(text, markDone);
      }
    });

    document.addEventListener('keydown', onKeyDown);

    global.addEventListener('hashchange', function () {
      var route = parseHash();
      if (route.view !== Store.state.view || route.topicId !== Store.state.topicId) {
        navigate(route.view, route.topicId, true);
      }
    });

    var initial = parseHash();
    navigate(initial.view, initial.topicId, true);
    syncHash(initial.view, initial.topicId, true);

    // Build the search index while the user reads the dashboard.
    global.Palette.warmIndex();
  }

  function fallbackCopy(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { /* ignore */ }
    ta.remove();
  }

  global.App = {
    navigate: navigate,
    openQuestion: openQuestion,
    render: render,
    openDataModal: openDataModal,
    closeDataModal: closeDataModal,
    celebrate: celebrate
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
