/* Browser regression checks; never reads or changes participant storage. */
(function () {
  'use strict';
  var button = document.getElementById('run'), results = document.getElementById('checks');
  function check(name, condition) { var li = document.createElement('li'); li.className = condition ? 'pass' : 'fail'; li.textContent = (condition ? 'PASS: ' : 'FAIL: ') + name; results.appendChild(li); }
  async function scenario(styles, dark, scale, reduced) {
    var css = styles;
    css = css.replaceAll('(prefers-color-scheme:dark)', dark ? '(min-width:0px)' : '(min-width:100000px)');
    css = css.replaceAll('(prefers-reduced-motion:reduce)', reduced ? '(min-width:0px)' : '(min-width:100000px)');
    var frame = document.createElement('iframe'); frame.title = 'Isolated style fixture';
    var loaded = new Promise(function (resolve) { frame.onload = resolve; });
    frame.srcdoc = '<!doctype html><html><head><base href="/future-health/app/"><style>' + css + '\nhtml{font-size:' + (16 * scale) + 'px!important}</style></head><body><div id="app"><div class="wrap"><section class="card question-stage"><div class="question-content"><h1 id="probeHeading">Một câu hỏi dễ đọc</h1><div class="answer-options compact"><button class="answer" id="probeAnswer">30–39</button><button class="answer">40–49</button></div></div><table><thead><tr><th>Measure</th><th>Value</th></tr></thead><tbody><tr><td>Reaction</td><td>350 ms</td></tr></tbody></table></section></div></div><div id="stage" style="position:relative;height:240px"><div class="stim go" id="probeGo"></div><div class="stim nogo" id="probeStop"></div><div class="stim rtstim" id="probeRT"></div><div class="memitem" id="probeMemory">●</div></div><script src="js/config.js"><\/script><script src="js/i18n.js"><\/script><script src="js/i18n-ui.js"><\/script><script src="js/accessibility.js"><\/script></body></html>';
    document.body.appendChild(frame); await loaded;
    var doc = frame.contentDocument, win = frame.contentWindow;
    win.NB.access.tables(doc.getElementById('app'));
    function style(id) { return win.getComputedStyle(doc.getElementById(id)); }
    function stimulus(id) { var s = style(id); return [s.backgroundColor, s.width, s.height, s.borderRadius, s.fontSize]; }
    var out = { body: win.getComputedStyle(doc.body).backgroundColor, heading: parseFloat(style('probeHeading').fontSize), answer: parseFloat(style('probeAnswer').fontSize), card: win.getComputedStyle(doc.querySelector('.card')).backgroundColor,
      stage: [style('stage').backgroundColor, style('stage').colorScheme, style('stage').forcedColorAdjust], go: stimulus('probeGo'), stop: stimulus('probeStop'), rt: stimulus('probeRT'), memory: style('probeMemory').fontSize,
      animation: win.getComputedStyle(doc.querySelector('.question-content')).animationName, transition: style('probeAnswer').transitionDuration,
      overflow: doc.documentElement.scrollWidth > doc.documentElement.clientWidth, caption: doc.querySelector('caption').textContent,
      columns: Array.from(doc.querySelectorAll('thead th')).every(function (th) { return th.scope === 'col'; }), row: !!doc.querySelector('tbody th[scope="row"]') };
    frame.remove(); return out;
  }
  async function run() {
    button.disabled = true; results.textContent = ''; document.getElementById('result').textContent = 'Running…';
    try {
      var sheets = await Promise.all(['app.css', 'accessibility.css'].map(function (name) { return fetch('../css/' + name).then(function (r) { if (!r.ok) throw new Error(name); return r.text(); }); }));
      var css = sheets.join('\n'), light = await scenario(css, false, 1, false), dark = await scenario(css, true, 1, false), large = await scenario(css, false, 2, false), reduced = await scenario(css, false, 1, true);
      check('Dark mode changes the interface background and cards', light.body !== dark.body && light.card !== dark.card);
      check('Measurement canvas stays white, light-schemed and colour-stable', dark.stage[0] === 'rgb(255, 255, 255)' && dark.stage[1].includes('light') && dark.stage[2] === 'none');
      check('Reaction / Go / Stop colours and sizes stay identical in dark mode', ['rt', 'go', 'stop'].every(function (k) { return JSON.stringify(light[k]) === JSON.stringify(dark[k]); }));
      check('Go is a circle and Stop is a square with different rounding', light.go[3] === '50%' && light.stop[3] === '14%' && light.go[1] === light.stop[1]);
      check('Interface text and answer labels scale to 200%', large.heading === light.heading * 2 && large.answer === light.answer * 2);
      check('200% text keeps the narrow question fixture within its viewport', !large.overflow);
      check('Memory glyph and physical stimulus geometry stay fixed when text scales', light.memory === large.memory && ['rt', 'go', 'stop'].every(function (k) { return light[k][1] === large[k][1] && light[k][2] === large[k][2]; }));
      check('Reduced-motion scenario disables transitions and entrance animation', reduced.animation === 'none' && reduced.transition === '0s');
      check('Tables receive a caption, column scopes and row scopes', !!light.caption && light.columns && light.row);
      var failed = results.querySelectorAll('.fail').length;
      document.getElementById('result').textContent = (results.children.length - failed) + '/' + results.children.length + ' checks passed.';
    } catch (error) { check('Test runner completed: ' + error.message, false); document.getElementById('result').textContent = 'Runner failed.'; }
    button.disabled = false;
  }
  button.addEventListener('click', run);
})();
