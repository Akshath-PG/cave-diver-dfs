/* Wiring: run the search once, then replay it.
 *
 * Because the search is recorded up front, Back is as cheap as Step and
 * the playhead can be dragged anywhere without re-running anything.
 */
(function (NS) {
  'use strict';

  var dom = {
    cave: document.getElementById('cave'),
    play: document.getElementById('play'),
    step: document.getElementById('step'),
    back: document.getElementById('back'),
    reset: document.getElementById('reset'),
    speed: document.getElementById('speed'),
    status: document.getElementById('status'),
    statusText: document.getElementById('status-text'),
    stackView: document.getElementById('stack-view'),
    stackDepth: document.getElementById('stack-depth'),
    visitedView: document.getElementById('visited-view'),
    visitedCount: document.getElementById('visited-count'),
    log: document.getElementById('log')
  };

  var view = NS.cave.create(dom.cave);

  var state = {
    graph: null,
    layout: null,
    run: null,
    index: -1,
    timer: null,
    playing: false
  };

  function speedDelay() {
    // Slider 1..10 maps to a slow-to-fast delay.
    var v = Number(dom.speed.value);
    return Math.round(1500 / v);
  }

  function build() {
    state.graph = NS.graph.notesCave();
    state.layout = NS.graph.layout(state.graph, { gapX: 120, gapY: 104 });
    state.run = NS.search.dfs(state.graph, { start: 'A' });
    view.setCave(state.graph, state.layout, {});
    renderLog();
    goTo(-1);
  }

  function renderLog() {
    dom.log.innerHTML = '';
    state.run.steps.forEach(function (s, i) {
      var row = document.createElement('div');
      row.className = 'log-row kind-' + s.kind;
      row.dataset.index = i;
      row.innerHTML = '<span class="n">' + i + '</span><span>' + s.action + '</span>';
      dom.log.appendChild(row);
    });
  }

  function renderStack(stack) {
    dom.stackView.innerHTML = '';
    dom.stackDepth.textContent = stack.length;

    if (stack.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'stack-empty';
      empty.textContent = 'Rope fully wound in.';
      dom.stackView.appendChild(empty);
      return;
    }

    stack.forEach(function (id, i) {
      var item = document.createElement('div');
      item.className = 'stack-item' + (i === stack.length - 1 ? ' top' : '');
      item.innerHTML = '<span>' + id + '</span><span class="depth">' +
        (i === stack.length - 1 ? 'top &middot; depth ' + i : 'depth ' + i) + '</span>';
      dom.stackView.appendChild(item);
    });
  }

  function renderVisited(visited) {
    dom.visitedView.innerHTML = '';
    dom.visitedCount.textContent = visited.length;
    visited.slice().sort().forEach(function (id) {
      var chip = document.createElement('span');
      chip.className = 'chip teal';
      chip.textContent = id;
      dom.visitedView.appendChild(chip);
    });
  }

  function renderStatus(step) {
    var tag = dom.status.querySelector('.tag');
    if (!step) {
      tag.className = 'tag';
      tag.textContent = 'ready';
      dom.statusText.textContent = 'Press Play to send the diver in.';
      return;
    }
    tag.className = 'tag ' + step.kind;
    tag.textContent = step.kind === 'visit' ? 'swim' : step.kind;
    dom.statusText.textContent = step.action;
  }

  function highlightLog(index) {
    var rows = dom.log.querySelectorAll('.log-row');
    for (var i = 0; i < rows.length; i++) {
      rows[i].classList.toggle('is-current', Number(rows[i].dataset.index) === index);
    }
    var active = dom.log.querySelector('.log-row.is-current');
    if (active) active.scrollIntoView({ block: 'nearest' });
  }

  function goTo(index) {
    state.index = index;

    if (index < 0) {
      view.setState({ stack: [], visited: [], current: null });
      renderStack([]);
      renderVisited([]);
      renderStatus(null);
      highlightLog(-1);
    } else {
      var step = state.run.steps[index];
      view.setState({ stack: step.stack, visited: step.visited, current: step.current });
      renderStack(step.stack);
      renderVisited(step.visited);
      renderStatus(step);
      highlightLog(index);
    }

    dom.back.disabled = index < 0;
    dom.step.disabled = index >= state.run.steps.length - 1;
    if (index >= state.run.steps.length - 1) pause();
  }

  function play() {
    if (state.index >= state.run.steps.length - 1) goTo(-1);
    state.playing = true;
    dom.play.textContent = 'Pause';
    tick();
  }

  function tick() {
    clearTimeout(state.timer);
    if (!state.playing) return;
    if (state.index >= state.run.steps.length - 1) { pause(); return; }
    goTo(state.index + 1);
    state.timer = setTimeout(tick, speedDelay());
  }

  function pause() {
    state.playing = false;
    clearTimeout(state.timer);
    dom.play.textContent = 'Play';
  }

  dom.play.addEventListener('click', function () {
    state.playing ? pause() : play();
  });
  dom.step.addEventListener('click', function () {
    pause();
    if (state.index < state.run.steps.length - 1) goTo(state.index + 1);
  });
  dom.back.addEventListener('click', function () {
    pause();
    if (state.index >= 0) goTo(state.index - 1);
  });
  dom.reset.addEventListener('click', function () {
    pause();
    goTo(-1);
  });
  dom.speed.addEventListener('input', function () {
    if (state.playing) tick();
  });
  dom.log.addEventListener('click', function (e) {
    var row = e.target.closest('.log-row');
    if (!row) return;
    pause();
    goTo(Number(row.dataset.index));
  });

  build();
})(window.CAVE);
