/**
 * Home dashboard — the "what should I do right now" surface.
 *
 * Three tiles answer the three questions a learner opens the app with:
 * what to study, whether the habit is holding, and how much is mastered.
 * Below that, one card per topic with its own progress.
 */
(function (global) {
  'use strict';

  var U = global.U;
  var Store = global.Store;
  var Icons = global.Icons;

  function ring(value, max) {
    var radius = 40;
    var circumference = 2 * Math.PI * radius;
    var pct = max > 0 ? Math.min(1, value / max) : 0;
    var offset = circumference * (1 - pct);

    return (
      '<div class="ring">' +
        '<svg viewBox="0 0 92 92" aria-hidden="true">' +
          '<circle class="ring__track" cx="46" cy="46" r="' + radius + '"></circle>' +
          '<circle class="ring__fill" cx="46" cy="46" r="' + radius + '" ' +
            'stroke-dasharray="' + circumference.toFixed(2) + '" ' +
            'stroke-dashoffset="' + offset.toFixed(2) + '"></circle>' +
        '</svg>' +
        '<span class="ring__label">' + (pct * 100 >= 0 ? Math.round(pct * 100) + '%' : '0%') + '</span>' +
      '</div>'
    );
  }

  function activityStrip(history) {
    var days = Store.recentHistory(14);
    var max = Math.max.apply(null, days.map(function (d) { return d.count; }).concat([1]));
    var bars = days.map(function (d) {
      var level = d.count === 0 ? 0 : Math.min(4, Math.ceil((d.count / max) * 4));
      // An empty day still gets a visible tick, so the strip reads as a
      // calendar rather than as missing data.
      var height = d.count === 0 ? 14 : Math.max(24, Math.round((d.count / max) * 100));
      var title = U.formatRelativeDay(d.date) + ': ' + d.count + ' lượt';
      return '<div class="activity__bar" data-level="' + level + '" ' +
        'style="height:' + height + '%" title="' + U.escapeHtml(title) + '"></div>';
    }).join('');
    return '<div class="activity" role="img" aria-label="Hoạt động ôn tập 14 ngày gần nhất">' + bars + '</div>';
  }

  function render(container) {
    var stats = Store.globalStats();
    var topicCount = Store.state.topics.length;

    var goalTitle = stats.due > 0
      ? 'Có <em>' + stats.due + ' câu hỏi</em> đang chờ bạn ôn tập'
      : 'Bạn đã hoàn thành mục tiêu hôm nay';

    var goalText = stats.due > 0
      ? 'SM-2 tự động sắp xếp lại lịch ôn. Chỉ cần tập trung vào những gì đang cần nhớ nhất.'
      : 'Không còn câu hỏi nào đến hạn. Hãy ôn chủ động để củng cố kiến thức.';

    var html =
      '<main class="view">' +
        '<div class="container">' +

          '<section class="hero-grid">' +
            '<article class="hero-card hero-card--goal">' +
              '<div>' +
                '<div class="hero-card__eyebrow">' + Icons.get('target', { size: 13 }) + 'Mục tiêu hôm nay</div>' +
                '<h1 class="hero-card__title">' + goalTitle + '</h1>' +
                '<p class="hero-card__text">' + goalText + '</p>' +
              '</div>' +
              '<div class="hero-card__actions">' +
                '<button class="btn btn--primary btn--lg" data-action="study-all">' +
                  Icons.get('play', { size: 14 }) +
                  'Ôn tập ngay (' + (stats.due > 0 ? stats.due : stats.total) + ' thẻ)' +
                '</button>' +
                '<button class="btn btn--secondary btn--lg" data-action="open-palette">' +
                  Icons.get('search', { size: 14 }) + 'Tìm kiếm' +
                '</button>' +
              '</div>' +
            '</article>' +

            '<article class="stat-card">' +
              '<div class="stat-card__label">' + Icons.get('flame', { size: 13 }) + 'Chuỗi ngày liên tục</div>' +
              '<div class="stat-card__value">' + stats.streak + ' <span>ngày</span></div>' +
              '<div class="stat-card__note">' +
                (stats.reviewsToday > 0
                  ? 'Hôm nay bạn đã ôn ' + stats.reviewsToday + ' lượt.'
                  : 'Chưa ôn câu nào hôm nay.') +
              '</div>' +
              activityStrip(stats.history) +
            '</article>' +

            '<article class="stat-card stat-card--ring">' +
              ring(stats.mastered, stats.total) +
              '<div>' +
                '<div class="stat-card__label">' + Icons.get('award', { size: 13 }) + 'Đã thuộc</div>' +
                '<div class="stat-card__note" style="margin-top:4px">' +
                  stats.mastered + ' / ' + stats.total + ' câu' +
                '</div>' +
                '<div class="stat-card__note">' +
                  stats.learning + ' đang rèn · ' + stats.newCards + ' mới' +
                '</div>' +
              '</div>' +
            '</article>' +
          '</section>' +

          '<section>' +
            '<div class="section-head">' +
              '<div>' +
                '<h2 class="section-head__title">Chuyên đề</h2>' +
                '<p class="section-head__caption">' + (topicCount - 1) +
                  ' khối kiến thức · ' + stats.total + ' câu hỏi đã chuẩn hoá</p>' +
              '</div>' +
              '<button class="btn btn--secondary" data-action="open-data">' +
                Icons.get('sliders', { size: 14 }) + 'Quản lý dữ liệu' +
              '</button>' +
            '</div>' +
            '<div class="topic-grid">' + topicCards() + '</div>' +
          '</section>' +

        '</div>' +
      '</main>';

    container.innerHTML = html;
    bindHome(container);
  }

  function topicCards() {
    return Store.state.topics.map(function (topic) {
      var stats = Store.topicStats(topic.id);
      var pctMastered = stats.total ? (stats.mastered / stats.total) * 100 : 0;
      var pctLearning = stats.total ? (stats.learning / stats.total) * 100 : 0;

      return (
        '<article class="topic-card" style="--topic-hue:' + topic.hue + '">' +
          '<div class="topic-card__head">' +
            '<span class="topic-card__icon">' + Icons.get(topic.icon, { size: 18 }) + '</span>' +
            '<div>' +
              '<h3 class="topic-card__name">' + U.escapeHtml(topic.name) + '</h3>' +
              '<div class="topic-card__count">' + stats.total + ' câu hỏi</div>' +
            '</div>' +
          '</div>' +
          '<p class="topic-card__desc">' + U.escapeHtml(topic.desc) + '</p>' +
          '<div class="topic-card__progress" role="img" aria-label="Tiến độ ' +
            Math.round(pctMastered) + '% thành thạo">' +
            '<span class="is-mastered" style="width:' + pctMastered + '%"></span>' +
            '<span class="is-learning" style="width:' + pctLearning + '%"></span>' +
          '</div>' +
          '<div class="topic-card__meta">' +
            '<span>' + Math.round(pctMastered) + '% thành thạo</span>' +
            '<span>' + stats.mastered + '/' + stats.total + '</span>' +
          '</div>' +
          '<div class="topic-card__actions">' +
            '<button class="btn btn--secondary btn--sm" data-action="browse" data-topic="' + topic.id + '">' +
              Icons.get('list', { size: 13 }) + 'Danh sách</button>' +
            '<button class="btn btn--primary btn--sm" data-action="study" data-topic="' + topic.id + '">' +
              Icons.get('play', { size: 13 }) + 'Học (' + (stats.due > 0 ? stats.due : stats.total) + ')</button>' +
          '</div>' +
        '</article>'
      );
    }).join('');
  }

  function bindHome(container) {
    container.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;
      var action = btn.getAttribute('data-action');
      var topic = btn.getAttribute('data-topic');

      if (action === 'study' || action === 'study-all') {
        global.App.navigate('study', topic || 'all');
      } else if (action === 'browse') {
        global.App.navigate('browse', topic);
      } else if (action === 'open-palette') {
        global.Palette.open();
      } else if (action === 'open-data') {
        global.App.openDataModal();
      }
    });
  }

  global.HomeView = { render: render };
})(window);
