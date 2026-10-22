/**
 * Markdown rendering for answer bodies.
 *
 * Answers are authored as markdown and rendered through `marked`, then
 * post-processed so that:
 *   - fenced code blocks get a language label and a copy button,
 *   - tables are wrapped in a horizontally scrollable container,
 *   - callouts (pitfall / warning blockquotes) are visually distinguished.
 */
(function (global) {
  'use strict';

  var U = global.U;

  var CODE_LABEL = {
    java: 'Java', javascript: 'JavaScript', js: 'JavaScript', typescript: 'TypeScript',
    ts: 'TypeScript', python: 'Python', bash: 'Shell', sh: 'Shell', shell: 'Shell',
    sql: 'SQL', yaml: 'YAML', yml: 'YAML', json: 'JSON', xml: 'XML', html: 'HTML',
    css: 'CSS', dockerfile: 'Docker', docker: 'Docker', kotlin: 'Kotlin', go: 'Go',
    rust: 'Rust', c: 'C', cpp: 'C++', 'c++': 'C++', ruby: 'Ruby', php: 'PHP',
    swift: 'Swift', text: 'Text', plaintext: 'Text', txt: 'Text', diff: 'Diff',
    properties: 'Properties', ini: 'INI', toml: 'TOML', graphql: 'GraphQL'
  };

  function labelFor(lang) {
    if (!lang) return 'Code';
    var key = String(lang).toLowerCase();
    return CODE_LABEL[key] || key.toUpperCase();
  }

  function languageOf(className) {
    if (!className) return '';
    var m = className.match(/language-([\w+#-]+)/i);
    return m ? m[1] : '';
  }

  /** Render markdown to an HTML string. */
  function render(markdown) {
    if (!markdown) return '';

    var html;
    if (global.marked && typeof global.marked.parse === 'function') {
      html = global.marked.parse(markdown, { breaks: false, gfm: true });
    } else {
      html = fallback(markdown);
    }

    var host = document.createElement('div');
    host.innerHTML = html;

    // Code blocks -----------------------------------------------------------
    Array.prototype.forEach.call(host.querySelectorAll('pre'), function (pre) {
      var code = pre.querySelector('code');
      var lang = languageOf(code ? code.className : '');
      var text = (code || pre).textContent;

      var wrap = document.createElement('div');
      wrap.className = 'code-block';

      var head = document.createElement('div');
      head.className = 'code-block__head';

      var langEl = document.createElement('span');
      langEl.className = 'code-block__lang';
      langEl.textContent = labelFor(lang);

      var copy = document.createElement('button');
      copy.type = 'button';
      copy.className = 'code-block__copy';
      copy.setAttribute('data-copy-code', text);
      copy.setAttribute('aria-label', 'Sao chép đoạn mã');
      copy.innerHTML = global.Icons.get('copy', { size: 13 }) + '<span>Copy</span>';

      // Long lines should be able to wrap on demand rather than always.
      var wrap = document.createElement('button');
      wrap.type = 'button';
      wrap.className = 'code-block__copy';
      wrap.setAttribute('aria-label', 'Bật xuống dòng cho đoạn mã');
      wrap.setAttribute('aria-pressed', 'false');
      wrap.innerHTML = global.Icons.get('wrapText', { size: 13 });
      wrap.addEventListener('click', function () {
        var block = wrap.closest('.code-block');
        if (!block) return;
        var on = block.classList.toggle('is-wrapped');
        wrap.setAttribute('aria-pressed', on ? 'true' : 'false');
        wrap.classList.toggle('is-active', on);
      });

      head.appendChild(langEl);
      head.appendChild(wrap);
      head.appendChild(copy);
      wrap.appendChild(head);
      wrap.appendChild(pre);

      pre.parentNode.insertBefore(wrap, pre);
      if (code && code.className) code.className = code.className;
    });

    // Tables ---------------------------------------------------------------
    Array.prototype.forEach.call(host.querySelectorAll('table'), function (table) {
      if (table.parentNode && table.parentNode.classList.contains('table-wrap')) return;
      var wrap = document.createElement('div');
      wrap.className = 'table-wrap';
      table.parentNode.insertBefore(wrap, table);
      wrap.appendChild(table);
    });

    // Callouts -------------------------------------------------------------
    Array.prototype.forEach.call(host.querySelectorAll('blockquote'), function (bq) {
      var text = (bq.textContent || '').toLowerCase();
      if (/lỗi thường gặp|pitfall|lưu ý|warning|chú ý/.test(text)) {
        bq.classList.add('is-warning');
      }
    });

    return host.innerHTML;
  }

  /** Minimal markdown fallback when `marked` is unavailable. */
  function fallback(md) {
    var escaped = U.escapeHtml(md);
    return escaped
      .replace(/```([\w+#-]*)\n([\s\S]*?)```/g, function (_, lang, code) {
        return '<pre><code class="language-' + lang + '">' + code + '</code></pre>';
      })
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/^\s*[-*]\s+(.*)$/gim, '<li>$1</li>')
      .replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/g, '<ul>$1</ul>')
      .replace(/\n{2,}/g, '</p><p>')
      .replace(/\n/g, '<br>');
  }

  /**
   * Extract a hint from an answer: the opening sentence or two, with the
   * markdown syntax stripped.
   *
   * A good hint narrows the search space; a bad hint is the answer in
   * disguise. This returns only enough of the answer to orient the learner
   * towards the right idea, never the whole thing.
   */
  function extractHint(markdown) {
    if (!markdown) return '';

    // Only the first block of prose — headings and code blocks make poor hints.
    var block = String(markdown).split(/\n\s*\n/)[0] || '';

    var text = block
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/^#{1,6}\s*/gm, '')
      .replace(/^\s*[-*+]\s+/gm, '')
      .replace(/^\s*>\s?/gm, '')
      .replace(/^\s*\|.*\|\s*$/gm, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!text) return '';

    // One sentence is the hint; a second is added only if the first was too
    // short to be worth showing. A hint that hands over the whole paragraph
    // is the answer in disguise.
    var sentences = text.match(/[^.!?…]+[.!?…]+(?:\s|$)|[^.!?…]+$/g) || [text];
    var hint = '';
    for (var i = 0; i < sentences.length; i++) {
      hint += (hint ? ' ' : '') + sentences[i].trim();
      if (hint.length >= 45) break;
    }
    hint = hint.trim();

    if (!hint) return text.slice(0, 200);
    if (hint.length > 280) hint = hint.slice(0, 280).trim() + '…';
    return hint;
  }

  global.Markdown = { render: render, labelFor: labelFor, extractHint: extractHint };
})(window);
