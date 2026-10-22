/**
 * Shared utilities: DOM helpers, Vietnamese-aware text folding,
 * fuzzy search scoring, and small runtime niceties (debounce, toast).
 */
(function (global) {
  'use strict';

  // ---------------------------------------------------------------------------
  // DOM helpers
  // ---------------------------------------------------------------------------

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /** Create an element with props/attrs and children. */
  function el(tag, props, children) {
    var node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        var v = props[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') node.className = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else if (k === 'dataset') Object.assign(node.dataset, v);
        else node.setAttribute(k, v === true ? '' : v);
      });
    }
    (children || []).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function escapeHtml(str) {
    return String(str === null || str === undefined ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function debounce(fn, wait) {
    var t;
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, wait);
    };
  }

  function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

  // ---------------------------------------------------------------------------
  // Vietnamese-aware text folding
  //
  // "đ" has no canonical decomposition, so it is mapped explicitly; the rest of
  // the Vietnamese diacritics decompose under NFD and the combining marks are
  // stripped. Folding is length-preserving for Vietnamese, so character offsets
  // stay valid for match highlighting (an index map handles the rare cases
  // where they are not).
  // ---------------------------------------------------------------------------

  var COMBINING = /[̀-ͯ]/g;

  function foldChar(ch) {
    if (ch === 'đ') return 'd';
    if (ch === 'Đ') return 'D';
    var lower = ch.toLowerCase();
    if (lower.length !== 1) return ch;          // exotic char: keep as-is
    return lower.normalize('NFD').replace(COMBINING, '');
  }

  /**
   * Fold a string for accent-insensitive comparison.
   * @returns {{text: string, map: number[]}} folded text + map back to source indices
   */
  function fold(str) {
    var src = String(str === null || str === undefined ? '' : str);
    var out = '';
    var map = [];
    for (var i = 0; i < src.length; i++) {
      var folded = foldChar(src[i]);
      for (var k = 0; k < folded.length; k++) {
        out += folded[k];
        map.push(i);
      }
    }
    return { text: out, map: map };
  }

  function foldText(str) { return fold(str).text; }

  // ---------------------------------------------------------------------------
  // Fuzzy search
  //
  // Two tiers:
  //   1. Contiguous substring match — always ranks above fuzzy matches.
  //   2. Subsequence match with bonuses for word boundaries and consecutive
  //      characters, penalties for gaps (a simplified fzf/Sublime scorer).
  // Multi-word queries are AND-ed: every term must match, and the scores sum.
  // ---------------------------------------------------------------------------

  var BOUNDARY = /[\s\-_/.,:;()[\]{}·•|]/;

  /**
   * Score a single term against a target string.
   * @returns {{score: number, indices: number[]}|null} null when the term does not match
   */
  function scoreTerm(term, targetFolded, targetRaw) {
    if (!term) return { score: 0, indices: [] };
    if (targetFolded.indexOf(term) !== -1) {
      var pos = targetFolded.indexOf(term);
      var indices = [];
      for (var i = 0; i < term.length; i++) indices.push(pos + i);
      var score = 1000;
      if (pos === 0) score += 220;                                  // prefix
      else if (BOUNDARY.test(targetFolded.charAt(pos - 1))) score += 130;  // word start
      score -= Math.min(pos, 40) * 2;                               // earlier is better
      score -= Math.min(targetFolded.length, 140) * 0.45;          // shorter is better
      if (targetRaw.substr(pos, term.length) === term) score += 70; // exact case
      return { score: score, indices: indices };
    }

    // Subsequence match
    var idx = [];
    var cursor = 0;
    var total = 0;
    var streak = 0;
    var prev = -1;
    for (var q = 0; q < term.length; q++) {
      var ch = term.charAt(q);
      var found = -1;
      while (cursor < targetFolded.length) {
        if (targetFolded.charAt(cursor) === ch) { found = cursor; break; }
        cursor++;
      }
      if (found === -1) return null;
      if (found === 0) total += 60;
      else if (BOUNDARY.test(targetFolded.charAt(found - 1))) total += 42;
      if (prev === found - 1) { streak++; total += 26 + streak * 6; }
      else streak = 0;
      total -= Math.min(found - (prev >= 0 ? prev : 0), 30) * 1.3;  // gap penalty
      idx.push(found);
      prev = found;
      cursor = found + 1;
    }
    total -= Math.min(targetFolded.length, 140) * 0.35;
    return { score: total, indices: idx };
  }

  /**
   * Score a query (possibly multi-word) against a candidate.
   * @param {string} query
   * @param {string} candidate
   * @returns {{score: number, indices: number[]}|null}
   */
  function fuzzy(query, candidate) {
    var q = foldText(query).trim();
    if (!q) return { score: 0, indices: [] };
    var target = fold(candidate);
    var terms = q.split(/\s+/).filter(Boolean);
    var sum = 0;
    var indices = [];
    for (var i = 0; i < terms.length; i++) {
      var r = scoreTerm(terms[i], target.text, candidate);
      if (!r) return null;
      sum += r.score;
      indices = indices.concat(r.indices);
    }
    indices.sort(function (a, b) { return a - b; });
    // Collapse duplicates produced by multi-term overlap.
    var seen = {}, unique = [];
    for (var j = 0; j < indices.length; j++) {
      if (!seen[indices[j]]) { seen[indices[j]] = 1; unique.push(indices[j]); }
    }
    return { score: sum / terms.length, indices: unique };
  }

  /**
   * Wrap the matched characters of `text` in <mark>.
   * Indices refer to the folded string, so they are mapped back to the source.
   */
  function highlight(text, foldedIndices) {
    var f = fold(text);
    var set = {};
    for (var i = 0; i < foldedIndices.length; i++) {
      var src = f.map[foldedIndices[i]];
      if (src !== undefined) set[src] = true;
    }
    var html = '';
    var open = false;
    for (var j = 0; j < text.length; j++) {
      var hit = !!set[j];
      if (hit && !open) { html += '<mark>'; open = true; }
      else if (!hit && open) { html += '</mark>'; open = false; }
      html += escapeHtml(text.charAt(j));
    }
    if (open) html += '</mark>';
    return html;
  }

  // ---------------------------------------------------------------------------
  // Misc
  // ---------------------------------------------------------------------------

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function addDays(dateStr, days) {
    var d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function formatRelativeDay(dateStr) {
    if (!dateStr) return '';
    var today = todayStr();
    if (dateStr === today) return 'Hôm nay';
    if (dateStr === addDays(today, 1)) return 'Ngày mai';
    if (dateStr === addDays(today, -1)) return 'Hôm qua';
    var d = new Date(dateStr + 'T00:00:00');
    return d.getDate() + '/' + (d.getMonth() + 1);
  }

  /**
   * Transient notification toast.
   * @param {string} message
   * @param {string} [tone]     'danger' for errors, otherwise neutral
   * @param {object} [opts]     { label, onClick } adds an inline action button
   */
  function toast(message, tone, opts) {
    var host = $('#toast-host');
    if (!host) {
      host = el('div', { id: 'toast-host', class: 'toast-host', role: 'status', 'aria-live': 'polite' });
      document.body.appendChild(host);
    }

    var toneClass = tone ? ' toast--' + tone : '';
    var children = [
      el('span', { class: 'toast__icon', html: global.Icons ? global.Icons.get(tone === 'danger' ? 'triangleAlert' : 'check', { size: 15 }) : '' }),
      el('span', { class: 'toast__text', text: message })
    ];

    if (opts && opts.label && typeof opts.onClick === 'function') {
      children.push(el('button', {
        class: 'toast__action',
        type: 'button',
        text: opts.label,
        onclick: function () {
          opts.onClick();
          dismiss();
        }
      }));
    }

    var node = el('div', { class: 'toast' + toneClass }, children);
    host.appendChild(node);

    requestAnimationFrame(function () { node.classList.add('is-visible'); });

    var timer = setTimeout(dismiss, opts && opts.onClick ? 5000 : 2600);

    function dismiss() {
      clearTimeout(timer);
      node.classList.remove('is-visible');
      setTimeout(function () { node.remove(); }, 260);
    }

    return dismiss;
  }

  function downloadFile(filename, text, mime) {
    var blob = new Blob([text], { type: mime || 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = el('a', { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /**
   * Run a callback inside a View Transition when the browser supports it,
   * otherwise run it directly. Keeps DOM mutations batched so the browser can
   * animate old -> new states.
   */
  function withViewTransition(update, opts) {
    if (!document.startViewTransition || global.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      update();
      return;
    }
    document.startViewTransition(function () { update(); });
  }

  global.U = {
    $: $, $$: $$, el: el, escapeHtml: escapeHtml, debounce: debounce, clamp: clamp,
    fold: fold, foldText: foldText, fuzzy: fuzzy, highlight: highlight,
    todayStr: todayStr, addDays: addDays, formatRelativeDay: formatRelativeDay,
    toast: toast, downloadFile: downloadFile, withViewTransition: withViewTransition
  };
})(window);
