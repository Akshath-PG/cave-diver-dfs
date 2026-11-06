/* The search engines.
 *
 * Every algorithm here returns the same thing: a flat list of steps. The
 * page never runs a search live, it replays a recorded list. That makes
 * stepping backwards as easy as stepping forwards, and it keeps the
 * drawing code completely separate from the algorithm.
 *
 * The DFS below is the algorithm exactly as the lecture notes state it:
 *
 *     Visit current state. Mark it visited. Push it onto the stack.
 *     If an unvisited neighbouring state exists, go there.
 *     Otherwise pop. Return. Repeat.
 *
 * Note what the stack holds: only the current path, not every discovered
 * node. That is the version in the notes, and it is the reason DFS memory
 * is O(m) rather than O(b*m).
 */
window.CAVE = window.CAVE || {};
(function (NS) {
  'use strict';

  function orderNeighbours(list, order) {
    var copy = list.slice();
    if (order === 'right') return copy.reverse();
    if (order === 'random') {
      for (var i = copy.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = copy[i]; copy[i] = copy[j]; copy[j] = t;
      }
      return copy;
    }
    return copy; // 'left' - the order given in the state space
  }

  function dfs(graph, options) {
    var opts = options || {};
    var start = opts.start || graph.root;
    var goal = opts.goal || null;
    var limit = (opts.limit == null) ? Infinity : opts.limit;
    var useVisited = opts.useVisited !== false;
    var maxSteps = opts.maxSteps || 4000;

    var steps = [];
    var stack = [];
    var visited = [];
    var visitedSet = {};
    var expansions = 0;
    var maxStack = 0;
    var cutoff = false;
    var found = false;

    function snapshot(fields) {
      var step = {
        index: steps.length,
        stack: stack.slice(),
        visited: visited.slice(),
        maxStack: maxStack,
        expansions: expansions,
        found: found
      };
      for (var k in fields) step[k] = fields[k];
      steps.push(step);
      return step;
    }

    function markVisited(id) {
      visited.push(id);
      visitedSet[id] = true;
    }

    // Step 0: visit the start chamber and push it.
    markVisited(start);
    stack.push(start);
    maxStack = 1;
    expansions = 1;
    found = (goal !== null && start === goal);
    snapshot({
      kind: 'visit',
      current: start,
      from: null,
      action: 'Visit ' + start + ', Push ' + start
    });

    while (stack.length > 0 && steps.length < maxSteps) {
      if (found) break;

      var current = stack[stack.length - 1];
      var depth = stack.length - 1;
      var next = null;

      if (depth < limit) {
        var neighbours = orderNeighbours(graph.nodes[current].neighbours, opts.order);
        for (var i = 0; i < neighbours.length; i++) {
          var n = neighbours[i];
          if (!graph.nodes[n]) continue;
          var blocked = useVisited ? visitedSet[n] : (stack.indexOf(n) !== -1);
          if (!blocked) { next = n; break; }
        }
      } else if (graph.nodes[current].neighbours.length > 0) {
        cutoff = true;
        snapshot({
          kind: 'cutoff',
          current: current,
          action: 'Rope limit reached at depth ' + depth + '. ' + current +
                  ' cannot be explored further.'
        });
      }

      if (next !== null) {
        markVisited(next);
        stack.push(next);
        expansions++;
        if (stack.length > maxStack) maxStack = stack.length;
        found = (goal !== null && next === goal);
        snapshot({
          kind: 'visit',
          current: next,
          from: current,
          action: 'From ' + current + ', choose ' + next + '. Visit ' + next +
                  ', Push ' + next
        });
      } else {
        var popped = stack.pop();
        var back = stack.length > 0 ? stack[stack.length - 1] : null;
        snapshot({
          kind: 'pop',
          current: back,
          popped: popped,
          action: back === null
            ? popped + ' has no unexplored actions. Pop ' + popped +
              '. Search terminates.'
            : popped + ' has no unexplored actions. Pop ' + popped +
              ' and return to ' + back
        });
      }
    }

    var exhausted = steps.length >= maxSteps;

    return {
      algorithm: 'DFS',
      steps: steps,
      found: found,
      cutoff: cutoff && !found,
      exhausted: exhausted,
      goal: goal,
      stats: {
        expansions: expansions,
        maxStack: maxStack,
        visited: visited.length,
        steps: steps.length
      }
    };
  }

  NS.search = { dfs: dfs, orderNeighbours: orderNeighbours };
})(window.CAVE);
