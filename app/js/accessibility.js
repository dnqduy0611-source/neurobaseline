/* Shared semantics for the non-measurement interface. */
(function () {
  'use strict';
  var NB = window.NB, timer;
  function clear() {
    clearTimeout(timer);
    var live = document.getElementById('uiStatus'); if (live) live.textContent = '';
  }
  function announce(text) {
    var live = document.getElementById('uiStatus'); if (!live) return;
    clearTimeout(timer); live.textContent = '';
    timer = setTimeout(function () { live.textContent = text; }, 150);
  }
  function tables(root, prefix) {
    root.querySelectorAll('table').forEach(function (table) {
      var section = table.closest('section'), heading = section && section.querySelector('h2,h3');
      var title = heading ? heading.textContent : NB.i18n.t(table.classList.contains('list') ? 'ui.c.title' : 'ui.table');
      if (!table.caption) {
        var caption = table.createCaption(); caption.className = 'sr-only';
        caption.textContent = (prefix ? prefix + ' — ' : '') + title;
      }
      table.querySelectorAll('thead th').forEach(function (th) { th.scope = 'col'; });
      table.querySelectorAll('tr').forEach(function (row) {
        if (row.closest('thead')) return;
        var first = row.firstElementChild;
        if (!first || first.tagName !== 'TD') return;
        var th = document.createElement('th'); th.scope = 'row';
        th.className = first.className;
        while (first.firstChild) th.appendChild(first.firstChild);
        row.replaceChild(th, first);
      });
    });
  }
  NB.access = { announce: announce, clear: clear, tables: tables };
})();
