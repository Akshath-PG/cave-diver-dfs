/* Cave model, cave generation and layout.
 *
 * A cave is just a state space wearing a costume: chambers are states and
 * passages are actions. This file builds that graph and works out where to
 * draw each chamber.
 *
 * The drawing uses the depth-first spanning tree, walked in the same
 * neighbour order the search uses. That matters: depth on screen is the
 * depth the algorithm experiences, so "going deeper" is literally
 * downward movement.
 */
window.CAVE = window.CAVE || {};
(function (NS) {
  'use strict';

  /* Seeded random, so a cave can be rebuilt exactly from its seed.
   * Without this, sharing a link to "this cave" would be impossible. */
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function create(adjacency, root, meta) {
    var ids = Object.keys(adjacency);
    var nodes = {};
    ids.forEach(function (id) {
      nodes[id] = { id: id, neighbours: (adjacency[id] || []).slice() };
    });
    var g = { nodes: nodes, ids: ids, root: root || ids[0], adjacency: adjacency };
    for (var k in (meta || {})) g[k] = meta[k];
    return g;
  }

  /* Depth-first spanning tree. Any edge leading back to an already
   * discovered chamber is a "crawl-way" (a loop) and is drawn differently,
   * because the search will never travel down it. */
  function spanningTree(graph) {
    var parent = {}, children = {}, depth = {}, seen = {};
    var crossKeys = {}, crossEdges = [];

    graph.ids.forEach(function (id) { children[id] = []; });

    var order = [];
    function walk(id) {
      order.push(id);
      var neighbours = graph.nodes[id].neighbours;
      for (var i = 0; i < neighbours.length; i++) {
        var n = neighbours[i];
        if (!graph.nodes[n]) continue;
        if (!seen[n]) {
          seen[n] = true;
          parent[n] = id;
          depth[n] = depth[id] + 1;
          children[id].push(n);
          walk(n);
        } else if (parent[id] !== n) {
          var key = [id, n].sort().join('~');
          if (!crossKeys[key]) {
            crossKeys[key] = true;
            crossEdges.push([id, n]);
          }
        }
      }
    }

    seen[graph.root] = true;
    depth[graph.root] = 0;
    parent[graph.root] = null;
    walk(graph.root);

    return {
      parent: parent, children: children, depth: depth,
      crossEdges: crossEdges, reachable: order
    };
  }

  /* Tidy tree layout: leaves get consecutive columns, every parent is
   * centred over its children. */
  function layout(graph, options) {
    var opts = options || {};
    var tree = spanningTree(graph);

    // The endless shaft is excluded from the sizing maths. It is drawn
    // tightly packed, so letting its 1200 chambers shrink the real cave
    // to dust would be the wrong trade.
    var isEndless = function (id) { return id.charAt(0) === 'e'; };
    var count = tree.reachable.filter(function (id) { return !isEndless(id); }).length;
    var totalCount = tree.reachable.length;

    // Columns are assigned first, because the sensible horizontal spacing
    // depends on how many leaves the tree actually has. A tree with 243
    // leaves and 5 levels is 40 times wider than it is tall; spacing it
    // like a small tree produces an unreadable thread.
    var col = {};
    var nextLeaf = 0;
    function place(id) {
      var kids = tree.children[id];
      if (!kids || kids.length === 0) { col[id] = nextLeaf++; return; }
      kids.forEach(place);
      col[id] = (col[kids[0]] + col[kids[kids.length - 1]]) / 2;
    }
    place(graph.root);
    var leaves = Math.max(1, nextLeaf);

    var gapX = opts.gapX ||
      (leaves <= 10 ? 120 : leaves <= 32 ? 56 : leaves <= 90 ? 30 : leaves <= 260 ? 18 : 12);
    var size = opts.nodeRadius || Math.max(3.5, Math.min(17, gapX * 0.42));
    // Depth is capped at 8, so vertical room is never the scarce resource.
    var gapY = opts.gapY || Math.max(size * 3.4, 92);
    var padX = opts.padX || Math.max(40, size * 3);
    var padY = opts.padY || Math.max(46, size * 3);

    // The endless shaft is packed tightly so that a 1200-chamber descent
    // is still a scrollable drawing rather than a mile of blank water.
    var shaftStep = 7;
    var positions = {};
    var maxCol = 0, maxDepth = 0, maxY = 0;
    tree.reachable.forEach(function (id) {
      var c = col[id] || 0, d = tree.depth[id] || 0;
      var y = isEndless(id)
        ? padY + gapY + (d - 1) * shaftStep
        : padY + d * gapY;
      if (c > maxCol) maxCol = c;
      if (!isEndless(id) && d > maxDepth) maxDepth = d;
      if (y > maxY) maxY = y;
      positions[id] = {
        x: padX + c * gapX, y: y, depth: d, col: c, endless: isEndless(id)
      };
    });

    var treeEdges = [];
    tree.reachable.forEach(function (id) {
      (tree.children[id] || []).forEach(function (kid) { treeEdges.push([id, kid]); });
    });

    return {
      positions: positions,
      treeEdges: treeEdges,
      crossEdges: tree.crossEdges,
      depthOf: tree.depth,
      parentOf: tree.parent,
      childrenOf: tree.children,
      nodeRadius: size,
      showLabels: totalCount <= 60,
      count: count,
      totalCount: totalCount,
      isEndless: isEndless,
      width: padX * 2 + maxCol * gapX,
      height: maxY + padY,
      maxDepth: maxDepth
    };
  }

  /* The state space from Lecture 3 of the notes. */
  function notesCave() {
    return create({
      A: ['B', 'C'], B: ['D', 'E'], C: [], D: ['F'], E: [], F: []
    }, 'A', { label: 'Lecture 3 state space', generated: false });
  }

  /* Build a cave with a given branching factor and depth.
   *
   * Exact branching (rather than random) is deliberate: it lets the page
   * state honestly that the cave holds (b^(m+1)-1)/(b-1) chambers, which
   * is the number the complexity discussion depends on.
   */
  function generateCave(options) {
    var opts = options || {};
    var b = Math.max(1, Math.min(5, opts.branching || 2));
    var depth = Math.max(1, Math.min(8, opts.depth || 4));
    var loops = Math.max(0, opts.loops || 0);
    var endless = !!opts.endless;
    var random = rng(opts.seed == null ? 1 : opts.seed);

    var adjacency = {};
    var byDepth = [];
    var next = 0;
    function newId() { return 'c' + (next++); }

    var root = newId();
    adjacency[root] = [];
    byDepth[0] = [root];

    for (var d = 0; d < depth; d++) {
      byDepth[d + 1] = [];
      byDepth[d].forEach(function (parent) {
        for (var i = 0; i < b; i++) {
          var child = newId();
          adjacency[child] = [];
          adjacency[parent].push(child);
          byDepth[d + 1].push(child);
        }
      });
    }

    // The endless passage: a very long corridor attached as the FIRST
    // choice out of the cave mouth. DFS commits to it and never comes
    // back, which is the completeness failure described in Lecture 4.
    // Long enough that the search is still descending when the page stops
    // it. Anything shorter and DFS eventually comes back, which would
    // quietly teach the opposite of the lesson.
    var endlessIds = [];
    if (endless) {
      var prev = root;
      for (var e = 0; e < 1200; e++) {
        var id = 'e' + e;
        adjacency[id] = [];
        adjacency[prev].push(id);
        if (prev === root) adjacency[root].unshift(adjacency[root].pop());
        endlessIds.push(id);
        prev = id;
      }
    }

    // Crawl-ways: extra passages that lead back to chambers already
    // discovered. Harmless with markers, fatal without them.
    var all = Object.keys(adjacency);
    for (var l = 0; l < loops; l++) {
      var from = all[Math.floor(random() * all.length)];
      var to = all[Math.floor(random() * all.length)];
      if (from === to || from === root) continue;
      if (adjacency[from].indexOf(to) !== -1) continue;
      adjacency[from].push(to);
    }

    var chambers = all.length;
    return create(adjacency, root, {
      label: 'b = ' + b + ', depth = ' + depth,
      generated: true,
      branching: b,
      maxDepth: depth,
      endlessIds: endlessIds,
      chamberCount: chambers
    });
  }

  /* How many chambers a perfect cave of this shape holds. */
  function chamberCount(b, depth) {
    if (b === 1) return depth + 1;
    return Math.round((Math.pow(b, depth + 1) - 1) / (b - 1));
  }

  /* Pick a chamber at roughly the requested depth. */
  function chamberAtDepth(graph, lay, wanted, preferLast) {
    var candidates = Object.keys(lay.positions).filter(function (id) {
      return lay.positions[id].depth === wanted && id.charAt(0) !== 'e';
    });
    if (!candidates.length) return null;
    candidates.sort(function (a, b) { return lay.positions[a].col - lay.positions[b].col; });
    return preferLast ? candidates[candidates.length - 1] : candidates[0];
  }

  NS.graph = {
    create: create,
    layout: layout,
    spanningTree: spanningTree,
    notesCave: notesCave,
    generateCave: generateCave,
    chamberCount: chamberCount,
    chamberAtDepth: chamberAtDepth,
    rng: rng
  };
})(window.CAVE);
