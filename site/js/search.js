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
      if (!visitedSet[id]) visited.push(id);
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
          // With markers switched off the diver has no way of telling an
          // already-searched chamber from a new one, so nothing is ever
          // blocked. On any cave this makes the search non-terminating:
          // that is exactly why the notes list the visited set as an
          // ingredient of the algorithm rather than an optimisation.
          var blocked = useVisited ? visitedSet[n] : false;
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

  /* Breadth-first search: the rival team.
   *
   * One diver cannot do this. BFS needs a team spreading out level by
   * level, and every one of them is holding a rope. That is not a
   * decoration on the metaphor, it is the memory cost: the frontier is
   * the thing that grows like b^m, and here you can count the ropes.
   */
  function bfs(graph, options) {
    var opts = options || {};
    var start = opts.start || graph.root;
    var goal = opts.goal || null;
    var maxSteps = opts.maxSteps || 4000;

    var steps = [];
    var queue = [start];
    var parent = {}; parent[start] = null;
    var discovered = {}; discovered[start] = true;
    var expanded = [];
    var maxFrontier = 1;
    var found = false;

    function pathTo(id) {
      var path = [];
      while (id != null) { path.unshift(id); id = parent[id]; }
      return path;
    }

    steps.push({
      index: 0, kind: 'discover', current: start, frontier: [start],
      visited: [], stack: [start], maxStack: 1, expansions: 0, found: false,
      action: 'Discover ' + start + '. The queue starts with one chamber.'
    });

    while (queue.length > 0 && steps.length < maxSteps) {
      var node = queue.shift();
      expanded.push(node);
      found = (goal !== null && node === goal);

      var added = [];
      if (!found) {
        var neighbours = orderNeighbours(graph.nodes[node].neighbours, opts.order);
        for (var i = 0; i < neighbours.length; i++) {
          var n = neighbours[i];
          if (!graph.nodes[n] || discovered[n]) continue;
          discovered[n] = true;
          parent[n] = node;
          queue.push(n);
          added.push(n);
        }
      }
      if (queue.length > maxFrontier) maxFrontier = queue.length;

      steps.push({
        index: steps.length,
        kind: found ? 'found' : 'expand',
        current: node,
        frontier: queue.slice(),
        visited: expanded.slice(),
        stack: pathTo(node),
        maxStack: maxFrontier,
        expansions: expanded.length,
        found: found,
        action: found
          ? 'Dequeue ' + node + '. This is the treasure.'
          : 'Dequeue ' + node + '. ' + (added.length
              ? 'Add ' + added.join(', ') + ' to the back of the queue.'
              : 'Nothing new behind it.') +
            ' Queue now holds ' + queue.length + '.'
      });

      if (found) break;
    }

    return {
      algorithm: 'BFS',
      steps: steps,
      found: found,
      cutoff: false,
      exhausted: steps.length >= maxSteps,
      goal: goal,
      stats: {
        expansions: expanded.length,
        maxStack: maxFrontier,   // frontier size: BFS's memory
        visited: expanded.length,
        steps: steps.length
      }
    };
  }

  /* Iterative deepening: DFS, repeated.
   *
   * Lecture 7 asks whether an agent can keep DFS's memory and still find
   * the shallowest solution. This runs depth-limited DFS at limit 0, then
   * 1, then 2, and so on, and reports the total work across all of them,
   * which is the honest cost.
   */
  function ids(graph, options) {
    var opts = options || {};
    var maxDepth = opts.maxDepth == null ? 8 : opts.maxDepth;
    var steps = [];
    var totalExpansions = 0;
    var maxStack = 0;
    var found = false;
    var iterations = 0;
    var lastRun = null;

    for (var limit = 0; limit <= maxDepth && !found; limit++) {
      iterations++;
      var pass = dfs(graph, {
        start: opts.start, goal: opts.goal, order: opts.order,
        limit: limit, useVisited: true, maxSteps: opts.maxSteps || 4000
      });
      lastRun = pass;

      steps.push({
        index: steps.length, kind: 'iteration', current: null,
        stack: [], visited: [], frontier: [],
        maxStack: maxStack, expansions: totalExpansions, found: false,
        iteration: limit,
        action: 'Start again from the entrance with the rope limited to ' +
                limit + '.'
      });

      pass.steps.forEach(function (s) {
        var copy = {};
        for (var k in s) copy[k] = s[k];
        copy.index = steps.length;
        copy.iteration = limit;
        copy.expansions = totalExpansions + s.expansions;
        steps.push(copy);
      });

      totalExpansions += pass.stats.expansions;
      if (pass.stats.maxStack > maxStack) maxStack = pass.stats.maxStack;
      found = pass.found;
    }

    return {
      algorithm: 'IDS',
      steps: steps,
      found: found,
      cutoff: false,
      exhausted: false,
      goal: opts.goal || null,
      iterations: iterations,
      stats: {
        expansions: totalExpansions,
        maxStack: maxStack,
        visited: lastRun ? lastRun.stats.visited : 0,
        steps: steps.length
      }
    };
  }

  NS.search = {
    dfs: dfs, bfs: bfs, ids: ids,
    orderNeighbours: orderNeighbours
  };
})(window.CAVE);
