/**
 * Search core.
 *
 * Both the command palette and the browse filter go through this module, so
 * the two surfaces can never return different result sets for the same
 * query. Matching is accent-insensitive, fuzzy, and expanded with domain
 * synonyms.
 *
 * The index is built once, off the critical path, so opening the palette
 * never pays for folding ~1.2 M characters of question and answer text.
 */
(function (global) {
  'use strict';

  var U = global.U;
  var Store = global.Store;
  var Synonyms = global.Synonyms;

  var index = { ready: false, entries: [] };
  var MAX_RESULTS = 40;

  function buildIndex() {
    var cards = Store.state.allCards;
    var entries = new Array(cards.length);

    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      entries[i] = {
        card: c,
        q: U.fold(c.q),
        qEn: U.fold(c.q_en),
        sub: U.fold(c.subcategory),
        a: U.fold(c.a),
        aEn: U.fold(c.a_en),
        keywords: U.fold(Synonyms.keywordsFor(c.topicId))
      };
    }

    index.entries = entries;
    index.ready = true;
  }

  function warmIndex() {
    if (index.ready) return;
    var run = function () { buildIndex(); };
    if (global.requestIdleCallback) global.requestIdleCallback(run, { timeout: 3000 });
    else setTimeout(run, 200);
  }

  /** Score one indexed entry against a single query variant. */
  function scoreEntry(entry, query) {
    if (!query) return null;

    var best = null;

    // Question text — full fuzzy scoring.
    var rq = U.fuzzy(query, entry.card.q);
    if (rq) {
      best = { score: rq.score, indices: rq.indices, field: 'q' };
    }

    var ren = U.fuzzy(query, entry.card.q_en);
    if (ren && (!best || ren.score * 0.92 > best.score)) {
      best = { score: ren.score * 0.92, indices: ren.indices, field: 'q_en' };
    }

    // Subcategory — exact substring.
    if (entry.sub.text && entry.sub.text.indexOf(query) !== -1) {
      var pos = entry.sub.text.indexOf(query);
      var subScore = (700 - Math.min(pos, 40) * 2) * 0.75;
      if (!best || subScore > best.score) {
        best = { score: subScore, indices: null, field: 'sub' };
      }
    }

    // Topic keywords — lets a learner reach a topic with a word that never
    // appears in the question itself.
    if (entry.keywords.text && entry.keywords.text.indexOf(query) !== -1) {
      var kwScore = (620 - Math.min(entry.keywords.text.indexOf(query), 40) * 2) * 0.55;
      if (!best || kwScore > best.score) {
        best = { score: kwScore, indices: null, field: 'keywords' };
      }
    }

    // Answer body — substring match, ranked below the question itself.
    var answerHit = null;
    var posA = entry.a.text ? entry.a.text.indexOf(query) : -1;
    var posB = entry.aEn.text ? entry.aEn.text.indexOf(query) : -1;
    if (posA !== -1 || posB !== -1) {
      var pos = posA !== -1 ? posA : posB;
      answerHit = { pos: pos, isEn: posA === -1 };
      var ansScore = (520 - Math.min(pos, 60) * 2) * 0.62;
      if (!best || ansScore > best.score) {
        best = { score: ansScore, indices: null, field: 'answer' };
      }
    }

    return best ? { entry: entry, score: best.score, indices: best.indices,
      field: best.field, answerHit: answerHit } : null;
  }

  /**
   * Search the corpus.
   * @param {string} text raw user query
   * @returns {Array<{card, score, indices, field, answerHit}>}
   */
  function query(text) {
    var folded = U.foldText(text).trim();
    if (!folded) return [];

    var variants = Synonyms.expand(folded);
    var best = new Map();

    for (var v = 0; v < variants.length; v++) {
      // An expanded variant is a weaker signal than the literal query.
      var weight = v === 0 ? 1 : 0.9;

      for (var i = 0; i < index.entries.length; i++) {
        var hit = scoreEntry(index.entries[i], variants[v]);
        if (!hit) continue;
        hit.score *= weight;

        var key = hit.entry.card.topicId + '_' + hit.entry.card.id;
        var previous = best.get(key);
        if (!previous || hit.score > previous.score) best.set(key, hit);
      }
    }

    var results = [];
    best.forEach(function (hit) { results.push(hit); });
    results.sort(function (a, b) { return b.score - a.score; });
    return results.slice(0, MAX_RESULTS);
  }

  /** Snippet of the answer around the first match. */
  function answerSnippet(hit) {
    var source = hit.answerHit && hit.answerHit.isEn ? hit.entry.card.a_en : hit.entry.card.a;
    var pos = hit.answerHit ? hit.answerHit.pos : 0;
    var start = Math.max(0, pos - 45);
    var text = source.slice(start, start + 150).replace(/\s+/g, ' ').trim();
    return (start > 0 ? '…' : '') + text + '…';
  }

  /** The text a result's match ranges refer to. */
  function matchedText(hit) {
    if (hit.field === 'q_en') return hit.entry.card.q_en;
    return hit.entry.card.q;
  }

  global.Search = {
    query: query,
    answerSnippet: answerSnippet,
    matchedText: matchedText,
    warmIndex: warmIndex,
    buildIndex: buildIndex,
    isReady: function () { return index.ready; }
  };
})(window);
