/**
 * Command palette — a keyboard-first search across every question, plus the
 * application's commands.
 *
 * Matching is accent-insensitive and fuzzy, so "cong nghe" finds
 * "Công nghệ" and "jvm mem" finds "JVM Memory". Question text is scored
 * fuzzily; answer text is matched by substring so that a keystroke stays
 * well under a frame budget across the full 758-question corpus.
 *
 * Implements the ARIA combobox pattern: the input owns focus and points at
 * the active option with `aria-activedescendant`.
 */
(function (global) {
  'use strict';

  var U = global.U;
  var Store = global.Store;
  var Icons = global.Icons;

  var RECENT_KEY = 'srs_recent_searches_v1';
  var MAX_RESULTS = 40;

  var palette = {
    open: false,
    items: [],
    activeIndex: 0,
    root: null,
    input: null,
    list: null
  };

  // ---------------------------------------------------------------------------
  // Recent searches
  // ---------------------------------------------------------------------------

  function loadRecent() {
    try {
      var raw = localStorage.getItem(RECENT_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
  }

  function saveRecent(query) {
    var q = query.trim();
    if (q.length < 2) return;
    var list = loadRecent().filter(function (item) {
      return U.foldText(item) !== U.foldText(q);
    });
    list.unshift(q);
    list = list.slice(0, 6);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch (e) { /* ignore */ }
  }

  // ---------------------------------------------------------------------------
  // Command list
  // ---------------------------------------------------------------------------

  function commands(query) {
    var folded = U.foldText(query).trim();
    var globals = [
      { id: 'cmd-home', icon: 'target', title: 'Về trang chủ', hint: 'G', run: function () { go('home'); } },
      { id: 'cmd-theme', icon: 'sun', title: 'Đổi giao diện sáng / tối', run: function () { Store.toggleTheme(); } },
      { id: 'cmd-lang', icon: 'globe', title: 'Đổi ngôn ngữ VI / EN', run: function () { toggleLanguage(); } },
      { id: 'cmd-data', icon: 'sliders', title: 'Sao lưu & khôi phục tiến độ', run: function () { global.App.openDataModal(); } }
    ];

    var study = [];
    var browse = [];

    Store.state.topics.forEach(function (topic) {
      if (topic.id === 'all') return;
      study.push({
        id: 'cmd-study-' + topic.id,
        icon: topic.icon,
        title: 'Ôn tập: ' + topic.name,
        hint: topic.total + ' câu',
        run: function () { go('study', topic.id); }
      });
      browse.push({
        id: 'cmd-browse-' + topic.id,
        icon: 'list',
        title: 'Danh sách câu hỏi: ' + topic.name,
        run: function () { go('browse', topic.id); }
      });
    });

    // The empty state stays short: the essentials plus one entry per topic.
    // Everything else is reachable by typing.
    if (!folded) return globals.concat(study);

    return globals.concat(study, browse)
      .map(function (cmd) {
        var r = U.fuzzy(folded, cmd.title);
        return r ? { cmd: cmd, score: r.score * 0.7, indices: r.indices } : null;
      })
      .filter(Boolean)
      .sort(function (a, b) { return b.score - a.score; })
      .slice(0, 6);
  }

  function go(view, topicId) {
    close();
    global.App.navigate(view, topicId);
  }

  function toggleLanguage() {
    var next = Store.state.language === 'vi' ? 'en' : 'vi';
    Store.state.language = next;
    Store.saveSettings();
    close();
    global.App.render();
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  function buildItems(query) {
    var items = [];
    var trimmed = query.trim();

    if (!trimmed) {
      var recent = loadRecent();
      if (recent.length) {
        items.push({ group: 'Tìm kiếm gần đây' });
        recent.forEach(function (text) {
          items.push({
            type: 'recent',
            icon: 'history',
            title: text,
            hint: 'Tìm lại',
            run: function () {
              if (palette.input) {
                palette.input.value = text;
                palette.input.focus();
                render();
              }
            }
          });
        });
      }

      items.push({ group: 'Lệnh nhanh' });
      commands('').forEach(function (cmd) {
        items.push({
          type: 'command',
          icon: cmd.icon,
          title: cmd.title,
          hint: cmd.hint,
          run: cmd.run
        });
      });
      return items;
    }

    var cmdHits = commands(trimmed);
    if (cmdHits.length) {
      items.push({ group: 'Lệnh' });
      cmdHits.forEach(function (hit) {
        items.push({
          type: 'command',
          icon: hit.cmd.icon,
          title: hit.cmd.title,
          titleHtml: U.highlight(hit.cmd.title, hit.indices || []),
          hint: hit.cmd.hint,
          run: hit.cmd.run
        });
      });
    }

    var hits = global.Search.query(trimmed);
    if (hits.length) {
      items.push({ group: 'Câu hỏi' });
      hits.forEach(function (hit) {
        var card = hit.entry.card;
        var titleHtml = hit.indices
          ? U.highlight(global.Search.matchedText(hit), hit.indices)
          : U.escapeHtml(global.Search.matchedText(hit));

        items.push({
          type: 'question',
          icon: null,
          accent: true,
          title: card.q,
          titleHtml: titleHtml,
          subtitle: hit.field === 'answer'
            ? global.Search.answerSnippet(hit)
            : (card.subcategory || card.topicName),
          badge: card.topicName,
          run: function () {
            close();
            // Land on the question with its answer already open — the search
            // was for this answer, not for a question to answer.
            global.App.openQuestion(card.topicId, card.id, true);
          }
        });
      });
    }

    return items;
  }

  function render() {
    if (!palette.list) return;
    var query = palette.input.value;
    palette.items = buildItems(query);

    var optionCount = palette.items.filter(function (i) { return !i.group; }).length;

    if (!optionCount) {
      palette.list.innerHTML =
        '<div class="palette__empty">' +
          '<strong>Không tìm thấy kết quả</strong>' +
          'Thử từ khoá khác, hoặc tìm theo chủ đề (ví dụ: “jvm”, “kafka partition”).' +
          '<div class="palette__empty-actions">' +
            '<button class="btn btn--secondary btn--sm" data-palette-action="clear">Xoá tìm kiếm</button>' +
            '<button class="btn btn--secondary btn--sm" data-palette-action="browse">Xem tất cả câu hỏi</button>' +
          '</div>' +
        '</div>';
      palette.activeIndex = -1;
      syncActive();
      announce(0);
      syncListHeight();
      return;
    }

    var html = '';
    var optionIndex = 0;
    var groupCounts = {};

    palette.items.forEach(function (item) {
      if (item.group) {
        groupCounts[item.group] = 0;
        return;
      }
      // Attribute each option to the group that precedes it.
      for (var g = palette.items.length - 1; g >= 0; g--) {
        if (palette.items[g].group) { groupCounts[palette.items[g].group]++; break; }
      }
    });

    palette.items.forEach(function (item) {
      if (item.group) {
        html += '<div class="palette__group" role="presentation">' +
          U.escapeHtml(item.group) +
          '<span class="palette__group-count">' + (groupCounts[item.group] || 0) + '</span>' +
        '</div>';
        return;
      }
      var id = 'palette-option-' + optionIndex;
      var titleHtml = item.titleHtml || U.escapeHtml(item.title);
      html +=
        '<div class="palette__item" role="option" id="' + id + '" aria-selected="false" data-index="' + optionIndex + '">' +
          '<span class="palette__item-icon">' +
            (item.accent
              ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="10"/></svg>'
              : Icons.get(item.icon, { size: 15 })) +
          '</span>' +
          '<span class="palette__item-body">' +
            '<span class="palette__item-title">' + titleHtml + '</span>' +
            (item.subtitle ? '<span class="palette__item-sub">' + U.escapeHtml(item.subtitle) + '</span>' : '') +
          '</span>' +
          '<span class="palette__item-hint">' +
            (item.badge ? '<span class="chip">' + U.escapeHtml(item.badge) + '</span>' : '') +
            (item.hint ? '<span class="palette__item-sub">' + U.escapeHtml(item.hint) + '</span>' : '') +
          '</span>' +
        '</div>';
      optionIndex++;
    });

    palette.list.innerHTML = html;
    palette.activeIndex = 0;
    syncActive();
    announce(optionCount);

    var counter = palette.root.querySelector('.palette__footer-count');
    if (counter) counter.textContent = optionCount + ' kết quả';

    syncListHeight();
  }

  /**
   * Grow and shrink the results list with the result count instead of
   * snapping — this is most of what makes a palette feel "Raycast".
   */
  function syncListHeight() {
    var list = palette.list;
    if (!list) return;

    if (!list.style.height) {
      list.style.height = list.offsetHeight + 'px';
      void list.offsetHeight; // force a reflow so the next change animates
    }
    list.style.height = list.scrollHeight + 'px';
  }

  /** Announce the result count politely for screen-reader users. */
  function announce(count) {
    var live = palette.root && palette.root.querySelector('.palette__live');
    if (live) live.textContent = count === 0 ? 'Không có kết quả' : count + ' kết quả';
  }

  function selectableItems() {
    return palette.items.filter(function (item) { return !item.group; });
  }

  function syncActive() {
    if (!palette.list) return;
    var nodes = palette.list.querySelectorAll('.palette__item');
    var selected = null;

    Array.prototype.forEach.call(nodes, function (node, i) {
      var isActive = i === palette.activeIndex;
      node.classList.toggle('is-active', isActive);
      node.setAttribute('aria-selected', isActive ? 'true' : 'false');
      if (isActive) selected = node;
    });

    if (selected) {
      palette.input.setAttribute('aria-activedescendant', selected.id);
      selected.scrollIntoView({ block: 'nearest' });
    } else {
      palette.input.removeAttribute('aria-activedescendant');
    }
  }

  function move(delta) {
    var count = selectableItems().length;
    if (!count) return;
    palette.activeIndex = (palette.activeIndex + delta + count) % count;
    syncActive();
  }

  function runActive() {
    var items = selectableItems();
    var item = items[palette.activeIndex];
    if (item && typeof item.run === 'function') item.run();
  }

  // ---------------------------------------------------------------------------
  // Open / close
  // ---------------------------------------------------------------------------

  function open(initialQuery) {
    if (palette.open) return;
    palette.open = true;
    global.Search.warmIndex();

    // Remember what had focus so it can be restored on close.
    palette.returnFocus = document.activeElement;

    var backdrop = document.createElement('div');
    backdrop.className = 'palette-backdrop';
    backdrop.id = 'palette-root';
    backdrop.innerHTML =
      '<div class="palette" role="dialog" aria-modal="true" aria-label="Tìm kiếm nhanh">' +
        '<div class="palette__input-row">' +
          Icons.get('search', { size: 17 }) +
          '<input type="text" class="palette__input" id="palette-input" ' +
            'role="combobox" aria-expanded="true" aria-controls="palette-listbox" ' +
            'aria-autocomplete="list" aria-label="Tìm câu hỏi" ' +
            'placeholder="Tìm trong 758 câu hỏi…" autocomplete="off" spellcheck="false">' +
          '<span class="kbd">ESC</span>' +
        '</div>' +
        '<div class="palette__results" id="palette-listbox" role="listbox" aria-label="Kết quả"></div>' +
        '<div class="palette__footer">' +
          '<span class="palette__footer-hint"><span class="kbd">↑</span><span class="kbd">↓</span> di chuyển</span>' +
          '<span class="palette__footer-hint"><span class="kbd">↵</span> mở</span>' +
          '<span class="palette__footer-hint"><span class="kbd">esc</span> đóng</span>' +
          '<span class="palette__footer-count"></span>' +
        '</div>' +
        '<span class="u-visually-hidden palette__live" role="status" aria-live="polite"></span>' +
      '</div>';

    document.body.appendChild(backdrop);
    palette.root = backdrop;
    palette.input = backdrop.querySelector('#palette-input');
    palette.list = backdrop.querySelector('#palette-listbox');

    palette.input.value = initialQuery || '';
    palette.input.focus();
    if (initialQuery) palette.input.setSelectionRange(initialQuery.length, initialQuery.length);

    palette.input.addEventListener('input', function () {
      palette.activeIndex = 0;
      render();
    });

    palette.input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Home') { e.preventDefault(); palette.activeIndex = 0; syncActive(); }
      else if (e.key === 'End') { e.preventDefault(); palette.activeIndex = selectableItems().length - 1; syncActive(); }
      else if (e.key === 'Enter') { e.preventDefault(); saveRecent(palette.input.value); runActive(); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
      else if (e.key === 'Tab') {
        // Focus stays inside the dialog; Tab commits the selection.
        e.preventDefault();
        saveRecent(palette.input.value);
        runActive();
      }
    });

    backdrop.addEventListener('mousedown', function (e) {
      if (e.target === backdrop) close();
    });

    palette.list.addEventListener('click', function (e) {
      var action = e.target.closest('[data-palette-action]');
      if (action) {
        var kind = action.getAttribute('data-palette-action');
        if (kind === 'clear') {
          palette.input.value = '';
          palette.activeIndex = 0;
          render();
          palette.input.focus();
        } else if (kind === 'browse') {
          close();
          global.App.navigate('browse', 'all');
        }
        return;
      }

      var node = e.target.closest('.palette__item');
      if (!node) return;
      var idx = parseInt(node.getAttribute('data-index'), 10);
      palette.activeIndex = idx;
      saveRecent(palette.input.value);
      runActive();
    });

    palette.onResize = function () { if (palette.open) syncListHeight(); };
    global.addEventListener('resize', palette.onResize);

    render();
  }

  function close() {
    if (!palette.open) return;
    palette.open = false;
    if (palette.root) palette.root.remove();
    if (palette.onResize) {
      global.removeEventListener('resize', palette.onResize);
      palette.onResize = null;
    }
    if (palette.returnFocus && palette.returnFocus.focus) {
      palette.returnFocus.focus();
    }
    palette.returnFocus = null;
    palette.root = null;
    palette.input = null;
    palette.list = null;
    palette.items = [];
    palette.activeIndex = 0;
  }

  function toggle() {
    if (palette.open) close();
    else open();
  }

  global.Palette = {
    open: open,
    close: close,
    toggle: toggle,
    isOpen: function () { return palette.open; },
    warmIndex: function () { global.Search.warmIndex(); }
  };
})(window);
