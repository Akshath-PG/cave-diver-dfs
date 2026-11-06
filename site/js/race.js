/* Race mode: DFS against a rival, on the same cave.
 *
 * The notes put it as a choice rather than a ranking - "intelligence is
 * about choosing the right strategy for the situation" - so this view
 * refuses to declare a winner. It runs both searches on an identical
 * cave and shows the two numbers that actually differ: how many chambers
 * each entered, and how much memory each needed to do it.
 *
 * DFS says Stack. BFS says Queue. One rope versus a team of ropes.
 */
window.CAVE = window.CAVE || {};
(function (NS) {
  'use strict';

  function create(opts) {
    var dom = opts.dom;

    var left = {
      view: NS.cave.create(dom.leftSvg, dom.leftFrame),
      svg: dom.leftSvg, run: null, index: -1,
      entered: dom.leftEntered, mem: dom.leftMem, maxMem: dom.leftMaxMem,
      memLabel: dom.leftMemLabel, maxMemLabel: dom.leftMaxMemLabel,
      status: dom.leftStatus, title: dom.leftTitle
    };
    var right = {
      view: NS.cave.create(dom.rightSvg, dom.rightFrame),
      svg: dom.rightSvg, run: null, index: -1,
      entered: dom.rightEntered, mem: dom.rightMem, maxMem: dom.rightMaxMem,
      memLabel: dom.rightMemLabel, maxMemLabel: dom.rightMaxMemLabel,
      status: dom.rightStatus, title: dom.rightTitle
    };

    var S = { graph: null, layout: null, goal: null, timer: null, playing: false };

    var WORDING = {
      DFS: {
        title: 'DFS &mdash; one diver, one rope',
        mem: 'Rope out now', maxMem: 'Most rope used'
      },
      BFS: {
        title: 'BFS &mdash; a team, spreading out',
        mem: 'Ropes in the water', maxMem: 'Most ropes at once'
      },
      IDS: {
        title: 'Iterative deepening &mdash; DFS, repeated',
        mem: 'Rope out now', maxMem: 'Most rope used'
      }
    };

    function build() {
      pause();
      var b = Number(dom.branching.value);
      var m = Number(dom.depth.value);
      dom.branchingOut.textContent = b;
      dom.depthOut.textContent = m;

      S.graph = NS.graph.generateCave({ branching: b, depth: m, seed: 42 });
      S.layout = NS.graph.layout(S.graph);
      S.goal = dom.treasure.value === 'deep'
        ? NS.graph.chamberAtDepth(S.graph, S.layout, m, true)
        : NS.graph.chamberAtDepth(S.graph, S.layout, Math.min(2, m), true);

      left.run = NS.search.dfs(S.graph, {
        start: S.graph.root, goal: S.goal, useVisited: true, maxSteps: 6000
      });

      var rival = dom.rival.value;
      right.run = rival === 'bfs'
        ? NS.search.bfs(S.graph, { start: S.graph.root, goal: S.goal, maxSteps: 6000 })
        : NS.search.ids(S.graph, {
            start: S.graph.root, goal: S.goal, maxDepth: m, maxSteps: 6000
          });

      right.svg.classList.toggle('mode-bfs', rival === 'bfs');

      [left, right].forEach(function (side) {
        var w = WORDING[side.run.algorithm];
        side.title.innerHTML = w.title;
        side.memLabel.textContent = w.mem;
        side.maxMemLabel.textContent = w.maxMem;
        side.view.setCave(S.graph, S.layout, { goal: S.goal });
        side.index = -1;
        paint(side);
      });

      dom.caveNote.textContent =
        'Same cave for both: b = ' + b + ', depth = ' + m + ', ' +
        S.layout.count + ' chambers, treasure ' +
        S.layout.positions[S.goal].depth + ' passages from the entrance.';
      renderVerdict();
      window.dispatchEvent(new Event('resize'));
    }

    function paint(side) {
      if (side.index < 0) {
        side.view.setState({ stack: [], visited: [], current: null, frontier: [] });
        side.entered.textContent = '0';
        side.mem.textContent = '0';
        side.maxMem.textContent = '0';
        side.status.textContent = 'Waiting at the entrance.';
        return;
      }
      var step = side.run.steps[side.index];
      side.view.setState({
        stack: step.stack, visited: step.visited,
        current: step.current, frontier: step.frontier || []
      });
      side.view.follow(step.current);
      side.entered.textContent = step.expansions;
      side.mem.textContent = (step.frontier ? step.frontier.length : step.stack.length);
      side.maxMem.textContent = step.maxStack;
      side.status.textContent = step.action;
    }

    function done(side) { return side.index >= side.run.steps.length - 1; }

    function renderVerdict() {
      var d = left.run, r = right.run;
      if (!done(left) || !done(right)) {
        dom.verdict.className = 'verdict';
        dom.verdict.textContent =
          'Both are searching the same cave for the same treasure. Watch the ' +
          'two memory figures, not the speed.';
        return;
      }
      var depth = S.layout.positions[S.goal].depth;
      var text;
      if (r.algorithm === 'BFS') {
        text = 'DFS entered ' + d.stats.expansions + ' chambers holding at most ' +
               d.stats.maxStack + ' chambers of rope. BFS entered ' +
               r.stats.expansions + ' holding at most ' + r.stats.maxStack +
               ' ropes at once. BFS reached the treasure by the shortest route, ' +
               depth + ' passages, because it never looks deeper until it has ' +
               'looked everywhere nearer. It paid for that in memory, and the ' +
               'gap widens with every extra level of cave.';
      } else {
        text = 'Plain DFS entered ' + d.stats.expansions + ' chambers. Iterative ' +
               'deepening entered ' + r.stats.expansions + ' across ' +
               r.iterations + ' restarts, and still never held more than ' +
               r.stats.maxStack + ' chambers of rope. It repeats the shallow ' +
               'work, but the shallow levels are the cheap ones: almost every ' +
               'chamber lives in the deepest level, and that level is searched ' +
               'once.';
      }
      dom.verdict.className = 'verdict is-warn';
      dom.verdict.textContent = text;
    }

    function stepBoth() {
      var moved = false;
      [left, right].forEach(function (side) {
        if (!done(side)) { side.index++; paint(side); moved = true; }
      });
      renderVerdict();
      return moved;
    }

    function tick() {
      clearTimeout(S.timer);
      if (!S.playing) return;
      if (!stepBoth()) { pause(); return; }
      S.timer = setTimeout(tick, Math.round(1500 / Number(dom.speed.value)));
    }

    function play() {
      if (done(left) && done(right)) reset();
      S.playing = true;
      dom.play.textContent = 'Pause';
      tick();
    }

    function pause() {
      S.playing = false;
      clearTimeout(S.timer);
      dom.play.textContent = 'Play';
    }

    function reset() {
      pause();
      [left, right].forEach(function (side) { side.index = -1; paint(side); });
      renderVerdict();
    }

    dom.play.addEventListener('click', function () { S.playing ? pause() : play(); });
    dom.step.addEventListener('click', function () { pause(); stepBoth(); });
    dom.reset.addEventListener('click', reset);
    dom.speed.addEventListener('input', function () { if (S.playing) tick(); });
    [dom.branching, dom.depth, dom.treasure, dom.rival].forEach(function (c) {
      c.addEventListener('input', build);
    });

    return { start: build };
  }

  NS.race = { create: create };
})(window.CAVE);
