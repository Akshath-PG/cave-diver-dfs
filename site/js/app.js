/* Wiring: read the conditions, build the cave, record the search, replay it.
 *
 * Because the search is recorded up front, Back is as cheap as Step and the
 * playhead can be moved anywhere without re-running anything.
 *
 * Every control writes itself into the URL, so a particular cave and a
 * particular set of conditions can be handed to someone else as a link.
 */
(function (NS) {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  var dom = {
    cave: $('cave'), frame: $('cave-frame'),
    play: $('play'), step: $('step'), back: $('back'), reset: $('reset'),
    speed: $('speed'),
    status: $('status'), statusText: $('status-text'),
    stackView: $('stack-view'), stackDepth: $('stack-depth'),
    visitedView: $('visited-view'), visitedCount: $('visited-count'),
    log: $('log'), caveName: $('cave-name'), verdict: $('verdict'),
    rTotal: $('r-total'), rEntered: $('r-entered'),
    rRope: $('r-rope'), rMaxRope: $('r-maxrope'),
    branching: $('branching'), branchingOut: $('branching-out'),
    depth: $('depth'), depthOut: $('depth-out'),
    loops: $('loops'), loopsOut: $('loops-out'),
    order: $('order'), treasure: $('treasure'),
    ropeLimit: $('rope-limit'), ropeLimitOut: $('rope-limit-out'),
    markers: $('markers'), endless: $('endless'),
    newCave: $('new-cave'),
    presetNotes: $('preset-notes'), presetRandom: $('preset-random'),
    tooBig: $('too-big'), tooBigNumber: $('too-big-number'),
    tooBigText: $('too-big-text')
  };

  // Past this many chambers the page stops drawing. Not a limitation worth
  // apologising for: it is the moment the student meets b^m in person.
  var DRAW_CAP = 1400;

  var view = NS.cave.create(dom.cave, dom.frame);

  var state = {
    source: 'notes',       // 'notes' or 'generated'
    seed: 7,
    goal: null,            // chamber id, or null
    goalMode: 'none',      // preset name, or 'pinned' when clicked
    graph: null, layout: null, run: null, tooBig: false,
    index: -1, timer: null, playing: false
  };

  /* ---------- URL state ---------- */

  function writeUrl() {
    var p = new URLSearchParams();
    p.set('cave', state.source);
    if (state.source === 'generated') {
      p.set('b', dom.branching.value);
      p.set('m', dom.depth.value);
      p.set('loops', dom.loops.value);
      p.set('seed', String(state.seed));
      p.set('endless', dom.endless.checked ? '1' : '0');
    }
    p.set('order', dom.order.value);
    p.set('rope', dom.ropeLimit.value);
    p.set('markers', dom.markers.checked ? '1' : '0');
    p.set('goal', state.goalMode === 'pinned' ? ('@' + state.goal) : dom.treasure.value);
    history.replaceState(null, '', '#' + p.toString());
  }

  function readUrl() {
    if (!location.hash || location.hash.length < 2) return;
    var p = new URLSearchParams(location.hash.slice(1));
    if (p.get('cave') === 'generated') state.source = 'generated';
    if (p.get('b')) dom.branching.value = p.get('b');
    if (p.get('m')) dom.depth.value = p.get('m');
    if (p.get('loops')) dom.loops.value = p.get('loops');
    if (p.get('seed')) state.seed = Number(p.get('seed')) || 7;
    if (p.get('endless')) dom.endless.checked = p.get('endless') === '1';
    if (p.get('order')) dom.order.value = p.get('order');
    if (p.get('rope')) dom.ropeLimit.value = p.get('rope');
    if (p.get('markers')) dom.markers.checked = p.get('markers') === '1';
    var goal = p.get('goal');
    if (goal && goal.charAt(0) === '@') {
      state.goalMode = 'pinned';
      state.goal = goal.slice(1);
    } else if (goal) {
      dom.treasure.value = goal;
      state.goalMode = goal;
    }
  }

  /* ---------- building ---------- */

  function syncOutputs() {
    dom.branchingOut.textContent = dom.branching.value;
    dom.depthOut.textContent = dom.depth.value;
    dom.loopsOut.textContent = dom.loops.value;
    dom.ropeLimit.max = dom.depth.value;
    if (Number(dom.ropeLimit.value) > Number(dom.depth.value)) {
      dom.ropeLimit.value = dom.depth.value;
    }
    dom.ropeLimitOut.textContent =
      Number(dom.ropeLimit.value) === 0 ? 'none' : dom.ropeLimit.value;
    var generated = state.source === 'generated';
    [dom.branching, dom.depth, dom.loops, dom.endless].forEach(function (c) {
      c.disabled = !generated;
      c.closest('.control, .toggle').classList.toggle('is-off', !generated);
    });
  }

  function chooseGoal() {
    if (state.goalMode === 'pinned' && state.layout.positions[state.goal]) {
      return state.goal;
    }
    var mode = dom.treasure.value;
    var maxD = state.layout.maxDepth;
    if (mode === 'none') return null;
    if (mode === 'deep') return NS.graph.chamberAtDepth(state.graph, state.layout, maxD, false);
    var shallow = Math.min(2, maxD);
    return NS.graph.chamberAtDepth(state.graph, state.layout, shallow, mode === 'shallow-far');
  }

  /* One place that decides how the search is run, so Build and
   * "treasure moved" can never drift apart. */
  function searchOptions() {
    var limit = Number(dom.ropeLimit.value);
    return {
      start: state.graph.root,
      goal: state.goal,
      order: dom.order.value,
      limit: limit === 0 ? Infinity : limit,
      useVisited: dom.markers.checked,
      // Caps, not part of the algorithm: a run that cannot end has to be
      // stopped by something, and the page says so when it happens.
      maxSteps: !dom.markers.checked ? 400 : (dom.endless.checked ? 900 : 6000)
    };
  }

  /* A cave can be described long before it can be drawn. When the shape
   * asks for more chambers than the page can render, say the number out
   * loud instead of freezing. */
  function checkTooBig() {
    if (state.source !== 'generated') return false;
    var b = Number(dom.branching.value);
    var m = Number(dom.depth.value);
    var n = NS.graph.chamberCount(b, m);
    if (n <= DRAW_CAP) return false;

    state.tooBig = true;
    dom.tooBig.hidden = false;
    dom.cave.style.display = 'none';
    dom.tooBigNumber.textContent = n.toLocaleString('en-US');
    dom.tooBigText.textContent =
      'With b = ' + b + ' and m = ' + m + ' this cave holds ' +
      n.toLocaleString('en-US') + ' chambers, too many to draw. The diver would ' +
      'still only ever hold ' + m + ' chambers of rope. That is the whole trade ' +
      'in one sentence: memory O(m), time O(b^m).';
    dom.caveName.textContent = 'b = ' + b + ', depth = ' + m;
    dom.rTotal.textContent = n.toLocaleString('en-US');
    dom.rEntered.textContent = '0';
    dom.rRope.textContent = '0';
    dom.rMaxRope.textContent = '0';
    dom.log.innerHTML = '';
    dom.stackView.innerHTML = '';
    dom.visitedView.innerHTML = '';
    dom.visitedCount.textContent = '0';
    dom.stackDepth.textContent = '0';
    dom.verdict.className = 'verdict is-warn';
    dom.verdict.textContent =
      'Too large to search here. Reduce b or m to send the diver in.';
    [dom.play, dom.step, dom.back, dom.reset].forEach(function (btn) {
      btn.disabled = true;
    });
    writeUrl();
    return true;
  }

  function build() {
    pause();
    state.tooBig = false;
    dom.tooBig.hidden = true;
    dom.cave.style.display = '';
    [dom.play, dom.reset].forEach(function (btn) { btn.disabled = false; });
    if (checkTooBig()) return;

    state.graph = state.source === 'notes'
      ? NS.graph.notesCave()
      : NS.graph.generateCave({
          branching: Number(dom.branching.value),
          depth: Number(dom.depth.value),
          loops: Number(dom.loops.value),
          endless: dom.endless.checked,
          seed: state.seed
        });

    state.layout = NS.graph.layout(state.graph);
    state.goal = chooseGoal();
    state.run = NS.search.dfs(state.graph, searchOptions());

    view.setCave(state.graph, state.layout, {
      goal: state.goal,
      onChamberClick: function (id) {
        state.goalMode = 'pinned';
        state.goal = id;
        writeUrl();
        rebuildSearchOnly();
      }
    });

    dom.caveName.textContent = state.graph.label;
    // An endless passage has no chamber count, and saying 1,231 would
    // quietly contradict the lesson it exists to teach.
    dom.rTotal.textContent = (state.source === 'generated' && dom.endless.checked)
      ? '∞'
      : state.layout.count;
    renderLog();
    goTo(-1);
    writeUrl();
  }

  /* Changing only the treasure does not need the cave redrawn. */
  function rebuildSearchOnly() {
    if (state.tooBig || !state.graph) return;
    state.run = NS.search.dfs(state.graph, searchOptions());
    view.markGoal(state.goal);
    renderLog();
    goTo(-1);
  }

  /* ---------- rendering ---------- */

  function renderLog() {
    dom.log.innerHTML = '';
    var steps = state.run.steps;
    var shown = Math.min(steps.length, 400);
    for (var i = 0; i < shown; i++) {
      var row = document.createElement('div');
      row.className = 'log-row kind-' + steps[i].kind;
      row.dataset.index = i;
      row.innerHTML = '<span class="n">' + i + '</span><span>' + steps[i].action + '</span>';
      dom.log.appendChild(row);
    }
    if (steps.length > shown) {
      var more = document.createElement('div');
      more.className = 'log-row';
      more.innerHTML = '<span class="n">&hellip;</span><span>' +
        (steps.length - shown) + ' further steps not listed</span>';
      dom.log.appendChild(more);
    }
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
    var visible = stack.slice(-14);
    if (visible.length < stack.length) {
      var more = document.createElement('div');
      more.className = 'stack-empty';
      more.textContent = '+ ' + (stack.length - visible.length) + ' deeper on the rope';
      dom.stackView.appendChild(more);
    }
    visible.forEach(function (id, i) {
      var absolute = stack.length - visible.length + i;
      var item = document.createElement('div');
      item.className = 'stack-item' + (absolute === stack.length - 1 ? ' top' : '');
      item.innerHTML = '<span>' + id + '</span><span class="depth">' +
        (absolute === stack.length - 1 ? 'top &middot; depth ' + absolute : 'depth ' + absolute) +
        '</span>';
      dom.stackView.appendChild(item);
    });
  }

  function renderVisited(visited) {
    dom.visitedCount.textContent = visited.length;
    dom.visitedView.innerHTML = '';
    var shown = visited.slice(0, 80);
    shown.slice().sort().forEach(function (id) {
      var chip = document.createElement('span');
      chip.className = 'chip teal';
      chip.textContent = id;
      dom.visitedView.appendChild(chip);
    });
    if (visited.length > shown.length) {
      var rest = document.createElement('span');
      rest.className = 'chip';
      rest.textContent = '+' + (visited.length - shown.length) + ' more';
      dom.visitedView.appendChild(rest);
    }
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
    var prev = dom.log.querySelector('.log-row.is-current');
    if (prev) prev.classList.remove('is-current');
    var row = dom.log.querySelector('.log-row[data-index="' + index + '"]');
    if (!row) return;
    row.classList.add('is-current');
    // scrollIntoView would drag the whole page along with it, so the log
    // is scrolled by hand instead.
    var top = row.offsetTop;
    var box = dom.log;
    if (top < box.scrollTop || top + row.offsetHeight > box.scrollTop + box.clientHeight) {
      box.scrollTop = top - box.clientHeight / 2 + row.offsetHeight / 2;
    }
  }

  /* The sentence that turns a simulation into a lesson. */
  function renderVerdict() {
    var run = state.run;
    var s = run.stats;
    var total = state.layout.count;
    var text, tone = '';

    if (!dom.markers.checked) {
      text = 'Without markers the diver kept re-entering chambers he had already ' +
             'searched. The dive was stopped after ' + s.steps + ' steps because it ' +
             'was never going to end. The visited set is not an optimisation, it is ' +
             'what makes the algorithm finish.';
      tone = 'bad';
    } else if (run.found) {
      var depthOfGoal = state.layout.positions[run.goal].depth;
      text = 'Treasure found at depth ' + depthOfGoal + ' after entering ' +
             s.expansions + ' of ' + total + ' chambers, with at most ' +
             s.maxStack + ' chambers of rope out.';
      if (s.expansions > depthOfGoal + 1) {
        text += ' The route there was only ' + depthOfGoal + ' passages long, so DFS ' +
                'entered ' + (s.expansions - depthOfGoal - 1) + ' chambers it did not need. ' +
                'DFS finds a solution, not the shallowest one.';
        tone = 'warn';
      }
    } else if (run.exhausted) {
      text = 'Stopped after ' + s.steps + ' steps with the diver ' + s.maxStack +
             ' chambers down and still descending. He never came back to try the ' +
             'other passages, so he never reached the treasure sitting a few ' +
             'chambers from the entrance. Down one endless passage, DFS is not ' +
             'complete: only the simulation ended, not the search.';
      tone = 'bad';
    } else if (run.cutoff) {
      text = 'The rope ran out before the treasure was found. A depth limit makes ' +
             'DFS terminate, but it can now miss a solution that lies deeper.';
      tone = 'warn';
    } else if (run.goal) {
      text = 'The whole cave was searched and there was no treasure in it. ' +
             s.expansions + ' chambers entered, most rope used ' + s.maxStack + '.';
    } else {
      text = 'Full sweep finished: ' + s.expansions + ' chambers entered out of ' +
             total + ', and never more than ' + s.maxStack + ' chambers of rope out ' +
             'at once. That gap between ' + s.expansions + ' and ' + s.maxStack +
             ' is the whole point: time O(b^m), memory O(m).';
    }

    dom.verdict.className = 'verdict' + (tone ? ' is-' + tone : '');
    dom.verdict.textContent = text;
  }

  function goTo(index) {
    state.index = index;
    var steps = state.run.steps;

    if (index < 0) {
      view.setState({ stack: [], visited: [], current: null });
      renderStack([]);
      renderVisited([]);
      renderStatus(null);
      highlightLog(-1);
      dom.rEntered.textContent = '0';
      dom.rRope.textContent = '0';
      dom.rMaxRope.textContent = '0';
    } else {
      var step = steps[index];
      view.setState({ stack: step.stack, visited: step.visited, current: step.current });
      view.follow(step.current);
      renderStack(step.stack);
      renderVisited(step.visited);
      renderStatus(step);
      highlightLog(index);
      dom.rEntered.textContent = step.expansions;
      dom.rRope.textContent = step.stack.length;
      dom.rMaxRope.textContent = step.maxStack;
    }

    renderVerdict();
    dom.back.disabled = index < 0;
    dom.step.disabled = index >= steps.length - 1;
    if (index >= steps.length - 1) pause();
  }

  /* ---------- playback ---------- */

  function speedDelay() {
    var v = Number(dom.speed.value);
    return Math.round(1600 / (v * v * 0.14 + 1));
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

  /* ---------- events ---------- */

  function rebuildFromControls() {
    pause();
    syncOutputs();
    build();
  }

  [dom.branching, dom.depth, dom.loops, dom.endless].forEach(function (c) {
    c.addEventListener('input', rebuildFromControls);
  });

  [dom.order, dom.ropeLimit, dom.markers].forEach(function (c) {
    c.addEventListener('input', function () {
      pause();
      syncOutputs();
      rebuildSearchOnly();
      writeUrl();
    });
  });

  dom.treasure.addEventListener('input', function () {
    pause();
    state.goalMode = dom.treasure.value;
    state.goal = chooseGoal();
    rebuildSearchOnly();
    writeUrl();
  });

  dom.newCave.addEventListener('click', function () {
    state.source = 'generated';
    state.seed = Math.floor(Math.random() * 100000);
    rebuildFromControls();
  });

  dom.presetNotes.addEventListener('click', function () {
    state.source = 'notes';
    state.goalMode = dom.treasure.value;
    rebuildFromControls();
  });

  dom.presetRandom.addEventListener('click', function () {
    state.source = 'generated';
    rebuildFromControls();
  });

  dom.play.addEventListener('click', function () { state.playing ? pause() : play(); });
  dom.step.addEventListener('click', function () {
    pause();
    if (state.index < state.run.steps.length - 1) goTo(state.index + 1);
  });
  dom.back.addEventListener('click', function () {
    pause();
    if (state.index >= 0) goTo(state.index - 1);
  });
  dom.reset.addEventListener('click', function () { pause(); goTo(-1); });
  dom.speed.addEventListener('input', function () { if (state.playing) tick(); });
  dom.log.addEventListener('click', function (e) {
    var row = e.target.closest('.log-row');
    if (!row || !row.dataset.index) return;
    pause();
    goTo(Number(row.dataset.index));
  });

  document.addEventListener('keydown', function (e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (e.key === ' ') { e.preventDefault(); state.playing ? pause() : play(); }
    if (e.key === 'ArrowRight') dom.step.click();
    if (e.key === 'ArrowLeft') dom.back.click();
  });

  readUrl();
  syncOutputs();
  build();

  /* ---------- modes ---------- */

  var dive = NS.dive.create({
    dom: {
      svg: $('dive-cave'), frame: $('dive-frame'),
      levelName: $('level-name'), levelBrief: $('level-brief'),
      levels: $('levels'), message: $('dive-message'),
      entered: $('d-entered'), rope: $('d-rope'),
      maxRope: $('d-maxrope'), wrong: $('d-wrong'),
      stackView: $('dive-stack'),
      lesson: $('dive-lesson'), lessonText: $('dive-lesson-text'),
      popBtn: $('dive-pop'), restart: $('dive-restart'), next: $('dive-next')
    }
  });
  dive.start();

  var views = {
    dive: $('view-dive'),
    playground: $('view-playground')
  };

  document.getElementById('modes').addEventListener('click', function (e) {
    var btn = e.target.closest('.mode');
    if (!btn) return;
    pause();
    var wanted = btn.dataset.view;
    Object.keys(views).forEach(function (name) {
      views[name].hidden = name !== wanted;
    });
    Array.prototype.forEach.call(this.querySelectorAll('.mode'), function (b) {
      b.classList.toggle('is-active', b === btn);
    });
    // A hidden frame has no width, so anything drawn while it was hidden
    // was scaled against zero. Re-fit now that it is on screen.
    window.dispatchEvent(new Event('resize'));
  });

  // The playground starts hidden, so its first fit happened against a
  // zero-width frame. Correct it once layout has settled.
  requestAnimationFrame(function () {
    window.dispatchEvent(new Event('resize'));
  });
})(window.CAVE);
