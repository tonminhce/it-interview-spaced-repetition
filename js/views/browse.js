/**
 * Browse — a searchable, filterable index of every question.
 *
 * The list is paginated (60 rows per page) so that scanning 758 questions
 * never puts 758 DOM subtrees into the document at once, and the search box
 * is debounced so a fast typist does not trigger a re-filter per keystroke.
 */
(function (global) {
  'use strict';

  var U = global.U;
  var Store = global.Store;
  var Icons = global.Icons;

  var PAGE_SIZE = 60;

  var filters = {
    query: '',
    level: 'all',
    status: 'all',
    limit: PAGE_SIZE
  };

  var LEVEL_OPTIONS = [
    { value: 'all', label: 'Mọi độ khó' },
    { value: 'beginner', label: 'Cơ bản' },
    { value: 'intermediate', label: 'Trung cấp' },
    { value: 'advanced', label: 'Nâng cao' }
  ];

  var STATUS_OPTIONS = [
    { value: 'all', label: 'Mọi trạng thái' },
    { value: 'due', label: 'Đến hạn' },
    { value: 'learning', label: 'Đang học' },
    { value: 'mastered', label: 'Đã thuộc' },
    { value: 'new', label: 'Thẻ mới' },
    { value: 'starred', label: 'Có gắn sao' }
  ];

  function cardsFor(topicId) {
    return Store.cardsFor(topicId);
  }

  function statusOf(card) {
    var key = Store.cardKey(card.topicId, card.id);
    var srs = Store.state.srs.cards[key];
    if (!srs) return 'new';
    return srs.state;
  }

  /**
   * Apply the level/status filters, then the text query.
   * The text query goes through the shared search core so that this list
   * and the command palette always agree on what a query means.
   */
  function filtered() {
    var cards = cardsFor(Store.state.topicId).filter(function (card) {
      if (filters.level !== 'all' && card.level !== filters.level) return false;

      if (filters.status !== 'all') {
        var key = Store.cardKey(card.topicId, card.id);
        var srs = Store.state.srs.cards[key];
        var st = srs ? srs.state : 'new';
        if (filters.status === 'starred' && !(srs && srs.starred)) return false;
        if (filters.status === 'due' && !(srs && srs.due <= U.todayStr())) return false;
        if (filters.status === 'new' && st !== 'new') return false;
        if (filters.status === 'mastered' && st !== 'mastered') return false;
        if (filters.status === 'learning' && st !== 'learning' && st !== 'review') return false;
      }
      return true;
    });

    var query = filters.query.trim();
    if (!query) return { cards: cards, ranges: {} };

    var hits = global.Search.query(query);
    var allowed = {};
    var ranges = {};

    hits.forEach(function (hit) {
      var key = hit.entry.card.topicId + '_' + hit.entry.card.id;
      allowed[key] = true;
      // Only highlight when the match was in the question itself.
      if (hit.indices && (hit.field === 'q' || hit.field === 'q_en')) {
        ranges[key] = hit.indices;
      }
    });

    return {
      cards: cards.filter(function (card) {
        return allowed[card.topicId + '_' + card.id];
      }),
      ranges: ranges
    };
  }

  function rowHtml(card, index, ranges) {
    var key = Store.cardKey(card.topicId, card.id);
    var srs = Store.state.srs.cards[key];
    var state = srs ? srs.state : 'new';
    var starred = srs && srs.starred;

    var questionHtml = U.escapeHtml(card.q);
    if (ranges && ranges[key]) {
      questionHtml = U.highlight(card.q, ranges[key]);
    }

    var preview = (card.a || '').replace(/[*#`>\-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 150);

    var statusChip = '';
    if (state === 'mastered') statusChip = '<span class="chip chip--success">Đã thuộc</span>';
    else if (state === 'learning') statusChip = '<span class="chip chip--info">Đang học</span>';
    else if (state === 'review') statusChip = '<span class="chip chip--info">Đang ôn</span>';
    else statusChip = '<span class="chip">Mới</span>';

    return (
      '<button class="q-row" data-action="open" data-topic="' + card.topicId + '" data-id="' + card.id + '">' +
        '<span class="q-row__index">' + (index + 1) + '</span>' +
        '<span class="q-row__body">' +
          '<span class="q-row__tags">' +
            '<span class="chip">' + U.escapeHtml(card.subcategory || card.category) + '</span>' +
            statusChip +
            '<span class="chip">' + U.escapeHtml(card.level === 'beginner' ? 'Cơ bản' :
              card.level === 'intermediate' ? 'Trung cấp' : 'Nâng cao') + '</span>' +
          '</span>' +
          '<span class="q-row__question">' + questionHtml + '</span>' +
          (preview ? '<span class="q-row__preview">' + U.escapeHtml(preview) + '…</span>' : '') +
        '</span>' +
        (starred ? '<span class="q-row__star">' + Icons.get('star', { size: 14 }) + '</span>' : '') +
      '</button>'
    );
  }

  function render(container) {
    var topic = Store.topicById(Store.state.topicId);
    var result = filtered();
    var list = result.cards;
    var shown = list.slice(0, filters.limit);

    container.innerHTML =
      '<main class="view">' +
        '<div class="container">' +
          '<div class="section-head">' +
            '<div>' +
              '<h1 class="section-head__title">' + U.escapeHtml(topic.name) + '</h1>' +
              '<p class="section-head__caption" id="browse-count"></p>' +
            '</div>' +
            '<button class="btn btn--primary" data-action="study">' +
              Icons.get('play', { size: 14 }) + 'Ôn chuyên đề này</button>' +
          '</div>' +

          '<div class="browse-toolbar">' +
            '<div class="search-field">' +
              '<span class="search-field__icon">' + Icons.get('search', { size: 14 }) + '</span>' +
              '<input type="search" class="search-field__input" id="browse-search" ' +
                'placeholder="Tìm trong câu hỏi…" value="' + U.escapeHtml(filters.query) + '" ' +
                'autocomplete="off" spellcheck="false" aria-label="Tìm câu hỏi">' +
            '</div>' +
            '<select class="select" id="browse-level" aria-label="Lọc theo độ khó">' +
              LEVEL_OPTIONS.map(function (o) {
                return '<option value="' + o.value + '"' +
                  (filters.level === o.value ? ' selected' : '') + '>' + o.label + '</option>';
              }).join('') +
            '</select>' +
            '<select class="select" id="browse-status" aria-label="Lọc theo trạng thái">' +
              STATUS_OPTIONS.map(function (o) {
                return '<option value="' + o.value + '"' +
                  (filters.status === o.value ? ' selected' : '') + '>' + o.label + '</option>';
              }).join('') +
            '</select>' +
          '</div>' +

          '<div class="q-list" id="browse-list"></div>' +
          '<div class="list-footer" id="browse-footer"></div>' +
        '</div>' +
      '</main>';

    paintResults(container, list, shown, result.ranges);
    bind(container);
  }

  function paintResults(container, list, shown, ranges) {
    var listEl = container.querySelector('#browse-list');
    var footerEl = container.querySelector('#browse-footer');
    var countEl = container.querySelector('#browse-count');

    if (countEl) {
      countEl.textContent = list.length + ' câu hỏi' +
        (filters.query ? ' khớp với “' + filters.query + '”' : '');
    }

    if (!list.length) {
      listEl.innerHTML =
        '<div class="empty-state">' +
          '<div class="empty-state__icon">' + Icons.get('search', { size: 20 }) + '</div>' +
          '<h2 class="empty-state__title">Không tìm thấy câu hỏi</h2>' +
          '<p class="empty-state__text">Thử một từ khoá khác, hoặc bỏ bớt bộ lọc đang áp dụng.</p>' +
        '</div>';
      footerEl.textContent = '';
      return;
    }

    listEl.innerHTML = shown.map(function (card, i) {
      return rowHtml(card, i, ranges);
    }).join('');

    if (shown.length < list.length) {
      footerEl.innerHTML =
        '<button class="btn btn--secondary btn--sm" data-action="more">' +
          'Xem thêm (' + (list.length - shown.length) + ' câu còn lại)</button>';
    } else {
      footerEl.textContent = 'Đã hiển thị toàn bộ ' + list.length + ' câu hỏi';
    }
  }

  function refresh(container) {
    var result = filtered();
    var list = result.cards;
    var shown = list.slice(0, filters.limit);
    paintResults(container, list, shown, result.ranges);
  }

  function bind(container) {
    var search = container.querySelector('#browse-search');
    var level = container.querySelector('#browse-level');
    var status = container.querySelector('#browse-status');

    if (search) {
      search.addEventListener('input', U.debounce(function () {
        filters.query = search.value;
        filters.limit = PAGE_SIZE;
        refresh(container);
      }, 140));
      search.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          e.stopPropagation();
          search.value = '';
          filters.query = '';
          filters.limit = PAGE_SIZE;
          refresh(container);
        }
      });
    }

    if (level) {
      level.addEventListener('change', function () {
        filters.level = level.value;
        filters.limit = PAGE_SIZE;
        refresh(container);
      });
    }

    if (status) {
      status.addEventListener('change', function () {
        filters.status = status.value;
        filters.limit = PAGE_SIZE;
        refresh(container);
      });
    }
  }

  function handleClick(e, btn) {
    var action = btn.getAttribute('data-action');

    if (action === 'open') {
      global.App.openQuestion(btn.getAttribute('data-topic'), parseInt(btn.getAttribute('data-id'), 10));
    } else if (action === 'study') {
      global.App.navigate('study', Store.state.topicId);
    } else if (action === 'more') {
      filters.limit += PAGE_SIZE;
      refresh(document.getElementById('app'));
    }
  }

  function setTopic(topicId) {
    filters.limit = PAGE_SIZE;
    filters.query = '';
  }

  global.BrowseView = {
    render: render,
    handleClick: handleClick,
    setTopic: setTopic,
    filters: filters
  };
})(window);
