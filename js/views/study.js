/**
 * Study session.
 *
 * The card is rendered once and then mutated in place: revealing the answer
 * toggles a class on the disclosure region, which animates the answer open
 * with the `grid-template-rows: 0fr -> 1fr` technique — no re-render, no
 * layout thrash, and the answer expands exactly where the trigger was.
 *
 * Rating advances to the next card inside a View Transition so the swap
 * reads as a single continuous motion rather than a flash.
 */
(function (global) {
  'use strict';

  var U = global.U;
  var Store = global.Store;
  var Icons = global.Icons;
  var app = document.getElementById('app');
  var stickyObserver = null;

  var LEVELS = {
    beginner: { label: 'Cơ bản', cls: 'chip--success' },
    intermediate: { label: 'Trung cấp', cls: 'chip--warning' },
    advanced: { label: 'Nâng cao', cls: 'chip--danger' }
  };

  /* Labels describe the learner's recall state rather than a quality grade —
     SM-2 measures how well something was recalled, not how hard it felt. */
  var RATINGS = [
    { value: 1, key: '1', label: 'Chưa nhớ', cls: 'rating-btn--again', tone: 'again' },
    { value: 2, key: '2', label: 'Nhớ một phần', cls: 'rating-btn--hard', tone: 'hard' },
    { value: 3, key: '3', label: 'Nhớ được', cls: 'rating-btn--good', tone: 'good' },
    { value: 4, key: '4', label: 'Nhớ ngay', cls: 'rating-btn--easy', tone: 'easy' }
  ];

  var LEVEL_LABELS = {
    beginner: 'Cơ bản',
    intermediate: 'Trung cấp',
    advanced: 'Nâng cao'
  };

  function currentCard() {
    return Store.state.queue[Store.state.cardIndex] || null;
  }

  function currentKey(card) {
    return Store.cardKey(card.topicId || Store.state.topicId, card.id);
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  function render(container) {
    var queue = Store.state.queue;
    var topic = Store.topicById(Store.state.topicId);

    if (!queue.length || Store.state.cardIndex >= queue.length) {
      renderComplete(container, topic);
      return;
    }

    container.innerHTML =
      '<main class="view">' +
        '<div class="container view--narrow">' +
          '<div class="study-bar">' +
            '<div class="study-bar__left">' +
              '<button class="icon-btn icon-btn--bordered" data-action="home" aria-label="Về trang chủ">' +
                Icons.get('chevronLeft', { size: 15 }) + '</button>' +
              '<h1 class="study-bar__title">' +
                '<span style="color:var(--text-tertiary)">' + Icons.get(topic.icon, { size: 15 }) + '</span>' +
                U.escapeHtml(topic.name) +
              '</h1>' +
              '<span class="study-counter" id="study-counter"></span>' +
            '</div>' +
            '<div class="study-bar__right">' +
              '<div class="session-timer">' +
                '<button class="icon-btn" data-action="timer-toggle" aria-label="Tạm dừng bộ đếm">' +
                  Icons.get(Store.state.timer.running ? 'pause' : 'play', { size: 14 }) +
                '</button>' +
                '<span class="session-timer__clock" id="timer-clock">' +
                  (Store.state.timer.roundMinutes === 0 ? '∞' : Store.formatClock(Store.state.timer.remaining)) +
                '</span>' +
                '<select class="select select--timer" id="timer-length" aria-label="Độ dài phiên ôn tập">' +
                  [10, 25, 45, 0].map(function (m) {
                    return '<option value="' + m + '"' +
                      (Store.state.timer.roundMinutes === m ? ' selected' : '') + '>' +
                      (m === 0 ? 'Không giới hạn' : m + ' phút') + '</option>';
                  }).join('') +
                '</select>' +
              '</div>' +
              '<div class="segmented" role="group" aria-label="Ngôn ngữ">' +
                '<button class="segmented__btn" data-action="lang" data-lang="vi">VI</button>' +
                '<button class="segmented__btn" data-action="lang" data-lang="en">EN</button>' +
              '</div>' +
              '<button class="icon-btn icon-btn--bordered" data-action="browse" aria-label="Danh sách câu hỏi">' +
                Icons.get('list', { size: 15 }) + '</button>' +
            '</div>' +
          '</div>' +

          '<div class="study-progress"><div class="study-progress__fill" id="study-progress-fill"></div></div>' +

          '<div id="study-card-slot"></div>' +

          '<div class="rating-dock" id="rating-dock"></div>' +
        '</div>' +
      '</main>';

    renderCard(container);
    // Applies the disclosure state in both directions: when arriving from
    // search the answer is already open, otherwise the region stays inert.
    setRevealed(Store.state.revealed, container);
  }

  function renderCard(container) {
    var card = currentCard();
    if (!card) return;

    var slot = container.querySelector('#study-card-slot');
    var topic = Store.topicById(Store.state.topicId);
    var record = Store.getRecord(currentKey(card));
    var isVi = Store.state.language === 'vi';

    var question = isVi ? card.q : (card.q_en || card.q);
    var questionEn = isVi ? (card.q_en || '') : '';
    var answer = isVi ? card.a : (card.a_en || card.a);
    var level = LEVELS[card.level] || LEVELS.beginner;

    slot.innerHTML =
      '<article class="flashcard" id="flashcard">' +
        '<div class="flashcard__meta">' +
          '<div class="flashcard__tags">' +
            '<span class="chip">' + U.escapeHtml(card.category || topic.name) + '</span>' +
            (card.subcategory ? '<span class="chip">' + U.escapeHtml(card.subcategory) + '</span>' : '') +
            '<span class="chip ' + level.cls + '">' + level.label + '</span>' +
            (record.interval > 0 ? '<span class="chip">Lặp lại sau ' + record.interval + ' ngày</span>' : '') +
          '</div>' +
          '<button class="icon-btn' + (record.starred ? ' is-active' : '') + '" data-action="star" ' +
            'aria-label="Gắn sao câu hỏi" aria-pressed="' + (record.starred ? 'true' : 'false') + '">' +
            Icons.get('star', { size: 16 }) +
          '</button>' +
        '</div>' +

        '<div class="flashcard__qbar" id="flashcard-qbar">' +
          '<div class="flashcard__qtext">' +
            '<h2 class="flashcard__question" id="card-question" lang="' + (isVi ? 'vi' : 'en') + '">' +
              U.escapeHtml(question) + '</h2>' +
            (questionEn
              ? '<p class="flashcard__question-en" id="card-question-en" lang="en">' + U.escapeHtml(questionEn) + '</p>'
              : '') +
          '</div>' +
          '<button class="reveal-trigger" id="reveal-trigger" data-action="toggle-reveal" ' +
            'aria-expanded="false" aria-controls="answer-region">' +
            '<span class="reveal-trigger__icon">' + Icons.get('chevronDown', { size: 14 }) + '</span>' +
            '<span id="reveal-label">Xem đáp án</span>' +
            '<span class="reveal-trigger__keys" aria-hidden="true"><span class="kbd">Space</span></span>' +
          '</button>' +
        '</div>' +

        '<div id="hint-slot"></div>' +

        '<div class="reveal" id="answer-region">' +
          '<div class="reveal__inner">' +
            '<div class="reveal__content">' +
              '<div class="reveal__heading">' + Icons.get('zap', { size: 12 }) +
                (card.subcategory ? U.escapeHtml(card.subcategory) : 'Lời giải &amp; phân tích') + '</div>' +
              '<div class="prose" id="card-answer" lang="' + (isVi ? 'vi' : 'en') + '">' +
                renderAnswer(answer) +
              '</div>' +
              (card.references && card.references.length ? renderReferences(card.references) : '') +
            '</div>' +
          '</div>' +
        '</div>' +
      '</article>';

    renderDock(container);
    updateProgress(container);
    bindStickyBar(container);

    // A hint belongs to a specific card, so it is restored with it.
    if (Store.state.hintShown) showHint(container, true);
  }

  function renderAnswer(answer) {
    if (!answer || !answer.trim()) {
      return '<div class="answer-missing">' +
        Icons.get('info', { size: 15 }) +
        '<span>Câu hỏi này chưa có lời giải chi tiết. Hãy tự trả lời dựa trên kiến thức của bạn ' +
        'rồi đánh giá mức độ ghi nhớ.</span></div>';
    }
    return global.Markdown.render(answer);
  }

  function renderReferences(refs) {
    return (
      '<div class="references">' +
        '<div class="references__title">Tài liệu tham khảo</div>' +
        '<div class="references__list">' +
          refs.map(function (ref) {
            var url = ref.url || '#';
            return '<a class="references__link" href="' + U.escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' +
              Icons.get('arrowRight', { size: 11 }) +
              U.escapeHtml(ref.label || url.replace(/^https?:\/\//, '').slice(0, 48)) +
            '</a>';
          }).join('') +
        '</div>' +
      '</div>'
    );
  }

  function renderDock(container) {
    var dock = container.querySelector('#rating-dock');
    if (!dock) return;

    var card = currentCard();
    if (!card) return;

    var revealed = Store.state.revealed;
    var hinted = Store.state.hintShown;
    var record = Store.getRecord(currentKey(card));
    var intervals = Store.previewIntervals(record);

    var revealPanel =
      '<div class="dock-panel is-active" data-panel="reveal">' +
        '<div class="dock-row">' +
          '<button class="btn btn--primary btn--lg dock-row__main" data-action="reveal">' +
            Icons.get('play', { size: 14 }) + 'Xem lời giải chi tiết' +
            '<span class="kbd" aria-hidden="true">Space</span>' +
          '</button>' +
          '<button class="btn btn--secondary btn--lg" data-action="hint"' + (hinted ? ' disabled' : '') + '>' +
            Icons.get('lightbulb', { size: 14 }) + (hinted ? 'Đã xem gợi ý' : 'Gợi ý') +
            (hinted ? '' : '<span class="kbd" aria-hidden="true">H</span>') +
          '</button>' +
        '</div>' +
      '</div>';

    var ratePanel =
      '<div class="dock-panel is-active" data-panel="rate">' +
        (hinted
          ? '<div class="dock-note">' + Icons.get('lightbulb', { size: 12 }) +
            'Bạn đã xem gợi ý, nên "Nhớ được" sẽ được tính là "Nhớ một phần".</div>'
          : '') +
        '<div class="rating-grid">' +
          RATINGS.map(function (r) {
            return '<button class="rating-btn ' + r.cls + '" data-action="rate" data-rating="' + r.value + '">' +
              '<span class="rating-btn__key" aria-hidden="true">' + r.key + '</span>' +
              '<span class="rating-btn__label">' + r.label + '</span>' +
              '<span class="rating-btn__interval">' + intervals[r.tone] + '</span>' +
            '</button>';
          }).join('') +
        '</div>' +
      '</div>';

    dock.innerHTML = (revealed ? ratePanel : revealPanel) +
      '<div class="dock-foot">' +
        '<div class="dock-foot__keys" aria-hidden="true">' +
          '<span class="kbd">Space</span><span>mở đáp án</span>' +
          '<span class="kbd">H</span><span>gợi ý</span>' +
          '<span class="kbd">1</span><span class="kbd">2</span><span class="kbd">3</span><span class="kbd">4</span><span>đánh giá</span>' +
          '<span class="kbd">S</span><span>sao</span>' +
          '<span class="kbd">L</span><span>ngôn ngữ</span>' +
        '</div>' +
        '<div class="u-row u-gap-2">' +
          '<button class="btn btn--ghost btn--sm" data-action="prev"' +
            (Store.state.cardIndex === 0 ? ' disabled' : '') + '>' +
            Icons.get('chevronLeft', { size: 13 }) + 'Trước</button>' +
          '<button class="btn btn--ghost btn--sm" data-action="next">Bỏ qua' +
            Icons.get('chevronRight', { size: 13 }) + '</button>' +
        '</div>' +
      '</div>';
  }

  function updateProgress(container) {
    var counter = container.querySelector('#study-counter');
    var fill = container.querySelector('#study-progress-fill');
    var total = Store.state.queue.length;
    var index = Store.state.cardIndex;

    if (counter) counter.textContent = Math.min(index + 1, total) + ' / ' + total;
    if (fill) fill.style.width = (total ? (index / total) * 100 : 0) + '%';
  }

  /** Flag the question bar once it sticks, so it can gain a hairline. */
  function bindStickyBar(container) {
    var bar = container.querySelector('#flashcard-qbar');
    if (!bar) return;

    // The observer holds a reference to the card it watches; without
    // disconnecting, every card rendered would leak one.
    if (stickyObserver) {
      stickyObserver.disconnect();
      stickyObserver = null;
    }

    var sentinel = document.createElement('div');
    sentinel.style.cssText = 'position:absolute;height:1px;width:1px;pointer-events:none;';
    bar.parentNode.insertBefore(sentinel, bar);

    if (global.IntersectionObserver) {
      stickyObserver = new IntersectionObserver(function (entries) {
        bar.classList.toggle('is-stuck', !entries[0].isIntersecting);
      }, { rootMargin: '-64px 0px 0px 0px', threshold: 0 });
      stickyObserver.observe(sentinel);
    }
  }

  function renderComplete(container, topic) {
    var stats = Store.globalStats();
    var session = Store.state.sessionStats || { again: 0, hard: 0, good: 0, easy: 0, reviewed: 0 };
    var total = session.reviewed || 1;

    var breakdown = [
      { label: 'Chưa nhớ', value: session.again, cls: 'rating-btn--again' },
      { label: 'Nhớ một phần', value: session.hard, cls: 'rating-btn--hard' },
      { label: 'Nhớ được', value: session.good, cls: 'rating-btn--good' },
      { label: 'Nhớ ngay', value: session.easy, cls: 'rating-btn--easy' }
    ];

    container.innerHTML =
      '<main class="view">' +
        '<div class="container view--narrow">' +
          '<div class="session-done">' +
            '<div class="session-done__badge">' + Icons.get('checkCheck', { size: 24 }) + '</div>' +
            '<h1 class="session-done__title">Hoàn thành phiên ôn tập</h1>' +
            '<p class="session-done__text">' +
              'Bạn đã đánh giá toàn bộ thẻ của chủ đề <strong>' + U.escapeHtml(topic.name) +
              '</strong>. Lịch ôn tiếp theo đã được cập nhật theo thuật toán SM-2.' +
            '</p>' +

            '<div class="session-done__stats">' +
              '<div class="session-done__stat">' +
                '<span class="session-done__stat-value">' + session.reviewed + '</span>' +
                '<span class="session-done__stat-label">thẻ đã ôn</span>' +
              '</div>' +
              '<div class="session-done__stat">' +
                '<span class="session-done__stat-value">' +
                  Math.round(((session.hard + session.good + session.easy) / total) * 100) + '%</span>' +
                '<span class="session-done__stat-label">nhớ được</span>' +
              '</div>' +
              '<div class="session-done__stat">' +
                '<span class="session-done__stat-value">' + stats.streak + '</span>' +
                '<span class="session-done__stat-label">ngày liên tục</span>' +
              '</div>' +
              (session.hinted
                ? '<div class="session-done__stat">' +
                    '<span class="session-done__stat-value">' + session.hinted + '</span>' +
                    '<span class="session-done__stat-label">đã xem gợi ý</span>' +
                  '</div>'
                : '') +
            '</div>' +

            '<div class="session-breakdown">' +
              breakdown.map(function (b) {
                var pct = Math.round((b.value / total) * 100);
                return '<div class="session-breakdown__item">' +
                  '<span class="session-breakdown__label ' + b.cls + '">' + b.label + '</span>' +
                  '<span class="session-breakdown__bar"><span class="' + b.cls + '" style="width:' + pct + '%"></span></span>' +
                  '<span class="session-breakdown__value">' + b.value + '</span>' +
                '</div>';
              }).join('') +
            '</div>' +

            '<div class="u-row u-gap-3" style="flex-wrap:wrap;justify-content:center">' +
              '<button class="btn btn--primary" data-action="home">' +
                Icons.get('target', { size: 14 }) + 'Về trang chủ</button>' +
              '<button class="btn btn--secondary" data-action="restart">' +
                Icons.get('refreshCw', { size: 14 }) + 'Ôn lại từ đầu</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</main>';
  }

  // ---------------------------------------------------------------------------
  // Reveal — the smooth expand
  // ---------------------------------------------------------------------------

  function setRevealed(revealed, container) {
    Store.state.revealed = revealed;

    var region = container.querySelector('#answer-region');
    var inner = container.querySelector('.reveal__inner');
    var trigger = container.querySelector('#reveal-trigger');
    var label = container.querySelector('#reveal-label');

    if (region) region.classList.toggle('is-open', revealed);
    if (inner) {
      // A zero-height region is still reachable by assistive tech, so keep it
      // inert while collapsed.
      if ('inert' in inner) inner.inert = !revealed;
      inner.setAttribute('aria-hidden', revealed ? 'false' : 'true');
    }
    if (trigger) trigger.setAttribute('aria-expanded', revealed ? 'true' : 'false');
    if (label) label.textContent = revealed ? 'Thu gọn' : 'Xem đáp án';

    renderDock(container);
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  function reveal(container) {
    if (Store.state.revealed) return;
    setRevealed(true, container);
  }

  /**
   * Show a hint: the opening of the answer, which narrows the search space
   * without handing the answer over.
   *
   * A card that has been hinted has not been recalled unaided, so choosing
   * "Nhớ được" for it is recorded as "Nhớ một phần" instead.
   */
  function showHint(container, restoring) {
    var card = currentCard();
    if (!card) return;
    if (Store.state.hintShown && !restoring) return;

    var answer = Store.state.language === 'vi' ? card.a : (card.a_en || card.a);
    var hint = global.Markdown.extractHint(answer);
    Store.state.hintShown = true;

    var slot = container.querySelector('#hint-slot');
    if (!slot) return;

    var panel = slot.querySelector('.hint');
    if (!panel) {
      panel = U.el('div', { class: 'hint' }, [
        U.el('div', { class: 'hint__head', html: Icons.get('lightbulb', { size: 12 }) + 'Gợi ý' }),
        U.el('p', { class: 'hint__text' })
      ]);
      slot.appendChild(panel);
    }

    var text = panel.querySelector('.hint__text');
    if (text) text.textContent = hint || 'Câu hỏi này chưa có lời giải để gợi ý.';

    renderDock(container);

    if (!restoring) {
      U.toast('Đã xem gợi ý — chọn "Nhớ được" sẽ được tính là "Nhớ một phần".');
    }
  }

  function rate(container, rating) {
    var card = currentCard();
    if (!card) return;

    var key = currentKey(card);
    var snapshot = JSON.parse(JSON.stringify(Store.state.srs.cards[key] || null));
    var previousIndex = Store.state.cardIndex;
    var queueLength = Store.state.queue.length;
    var hinted = Store.state.hintShown;

    // A hinted card has not been recalled unaided: "Nhớ được" becomes
    // "Nhớ một phần" so the schedule stays honest.
    var effective = rating;
    if (hinted && rating === 3) effective = 2;

    Store.rate(key, effective);

    var session = Store.state.sessionStats;
    if (session) {
      session.reviewed++;
      if (effective === 1) session.again++;
      else if (effective === 2) session.hard++;
      else if (effective === 3) session.good++;
      else if (effective === 4) session.easy++;
      if (hinted) session.hinted++;
    }

    // A failed card returns later in the same session.
    if (effective === 1) Store.state.queue.push(card);

    Store.state.cardIndex++;
    Store.state.revealed = false;
    Store.state.hintShown = false;

    advance(container);

    // Offer a short undo window — cheap, and it removes the fear of a mis-click.
    U.toast(
      (hinted && effective !== rating
        ? 'Đã ghi nhận: ' + RATINGS[rating - 1].label + ' → ' + RATINGS[effective - 1].label + ' (đã xem gợi ý)'
        : 'Đã ghi nhận: ' + RATINGS[effective - 1].label),
      null,
      {
        label: 'Hoàn tác',
        onClick: function () {
          if (snapshot) Store.state.srs.cards[key] = snapshot;
          else delete Store.state.srs.cards[key];
          Store.saveSRS();
          Store.state.queue.length = queueLength;
          Store.state.cardIndex = previousIndex;
          Store.state.revealed = false;
          Store.state.hintShown = hinted;
          if (session) {
            session.reviewed--;
            if (effective === 1) session.again--;
            else if (effective === 2) session.hard--;
            else if (effective === 3) session.good--;
            else if (effective === 4) session.easy--;
            if (hinted) session.hinted--;
          }
          render(container);
        }
      }
    );
  }

  function advance(container) {
    var next = currentCard();

    if (!next) {
      render(container);
      global.App.celebrate();
      return;
    }

    U.withViewTransition(function () {
      renderCard(container);
    });

    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function go(delta, container) {
    var target = Store.state.cardIndex + delta;
    if (target < 0 || target >= Store.state.queue.length) return;
    Store.state.cardIndex = target;
    Store.state.revealed = false;
    Store.state.hintShown = false;
    advance(container);
  }

  /** Refresh the focus timer without re-rendering the card. */
  function updateTimer() {
    var timer = Store.state.timer;
    var clock = document.getElementById('timer-clock');
    if (clock) {
      clock.textContent = timer.roundMinutes === 0 ? '∞' : Store.formatClock(timer.remaining);
      clock.classList.toggle('is-warning',
        timer.roundMinutes > 0 && timer.remaining <= 60);
    }
    var toggle = document.querySelector('[data-action="timer-toggle"]');
    if (toggle) {
      toggle.innerHTML = Icons.get(timer.running ? 'pause' : 'play', { size: 14 });
      toggle.setAttribute('aria-label', timer.running ? 'Tạm dừng bộ đếm' : 'Tiếp tục bộ đếm');
    }
  }

  function setRoundLength(minutes) {
    var timer = Store.state.timer;
    timer.roundMinutes = minutes;
    timer.remaining = minutes === 0 ? 0 : minutes * 60;
    timer.mode = 'focus';
    updateTimer();
  }

  function toggleStar(container) {
    var card = currentCard();
    if (!card) return;
    var starred = Store.toggleStar(currentKey(card));
    var btn = container.querySelector('[data-action="star"]');
    if (btn) {
      btn.classList.toggle('is-active', starred);
      btn.setAttribute('aria-pressed', starred ? 'true' : 'false');
    }
    U.toast(starred ? 'Đã gắn sao câu hỏi' : 'Đã bỏ gắn sao');
  }

  /** Switch language without tearing down the card (keeps the reveal state). */
  function toggleLanguage(container) {
    var next = Store.state.language === 'vi' ? 'en' : 'vi';
    Store.state.language = next;
    Store.saveSettings();

    var card = currentCard();
    if (!card) return;

    var isVi = next === 'vi';
    var questionEl = container.querySelector('#card-question');
    var questionEnEl = container.querySelector('#card-question-en');
    var answerEl = container.querySelector('#card-answer');
    var langButtons = container.querySelectorAll('[data-action="lang"]');

    if (questionEl) {
      questionEl.textContent = isVi ? card.q : (card.q_en || card.q);
      questionEl.setAttribute('lang', isVi ? 'vi' : 'en');
    }

    if (questionEnEl) {
      var en = isVi ? (card.q_en || '') : '';
      if (en) {
        questionEnEl.textContent = en;
        questionEnEl.hidden = false;
      } else if (questionEnEl.parentNode) {
        questionEnEl.remove();
      }
    }

    if (answerEl) {
      answerEl.innerHTML = renderAnswer(isVi ? card.a : (card.a_en || card.a));
      answerEl.setAttribute('lang', isVi ? 'vi' : 'en');
    }

    Array.prototype.forEach.call(langButtons, function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-lang') === next);
    });
  }

  function handleClick(e, btn) {
    var action = btn.getAttribute('data-action');

    if (action === 'reveal') reveal(app);
    else if (action === 'toggle-reveal') setRevealed(!Store.state.revealed, app);
    else if (action === 'hint') showHint(app);
    else if (action === 'rate') rate(app, parseInt(btn.getAttribute('data-rating'), 10));
    else if (action === 'star') toggleStar(app);
    else if (action === 'prev') go(-1, app);
    else if (action === 'next') go(1, app);
    else if (action === 'lang') toggleLanguage(app);
    else if (action === 'home') global.App.navigate('home');
    else if (action === 'browse') global.App.navigate('browse', Store.state.topicId);
    else if (action === 'restart') global.App.navigate('study', Store.state.topicId);
    else if (action === 'timer-toggle') {
      Store.state.timer.running = !Store.state.timer.running;
      updateTimer();
    }
  }

  global.StudyView = {
    render: render,
    handleClick: handleClick,
    reveal: reveal,
    showHint: showHint,
    rate: rate,
    go: go,
    toggleStar: toggleStar,
    toggleLanguage: toggleLanguage,
    updateTimer: updateTimer,
    setRoundLength: setRoundLength,
    currentCard: currentCard
  };
})(window);
