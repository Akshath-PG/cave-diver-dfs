/* Cave model and layout.
 *
 * A cave is just a state space wearing a costume: chambers are states and
 * passages are actions. This file builds that graph and works out where to
 * draw each chamber.
 *
 * The drawing uses the depth-first spanning tree, walked in the same
 * neighbour order the search itself uses. That matters: it means depth on
 * screen is the same depth the algorithm experiences, so "going deeper"
 * is literally downward movement.
 */
window.CAVE = window.CAVE || {};
(function (NS) {
  'use strict';

  /* Build a graph from an adjacency map: { A: ['B','C'], ... } */
  function create(adjacency, root) {
    var ids = Object.keys(adjacency);
    var nodes = {};
    ids.forEach(function (id) {
      nodes[id] = { id: id, neighbours: (adjacency[id] || []).slice() };
    });
    return { nodes: nodes, ids: ids, root: root || ids[0], adjacency: adjacency };
  }

  /* Depth-first spanning tree. Any edge that leads back to an already
   * discovered chamber is a "crawl-way" (a loop in the cave) and is drawn
   * differently, because the search will never travel down it. */
  function spanningTree(graph) {
    var parent = {}, children = {}, depth = {}, seen = {};
    var crossKeys = {}, crossEdges = [];

    graph.ids.forEach(function (id) { children[id] = []; });

    function walk(id) {
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
      parent: parent,
      children: children,
      depth: depth,
      crossEdges: crossEdges,
      reachable: Object.keys(seen)
    };
  }

  /* Tidy tree layout: leaves get consecutive columns, every parent is
   * centred over its children. Simple, stable, and good enough for the
   * cave sizes this page draws. */
  function layout(graph, options) {
    var opts = options || {};
    var gapX = opts.gapX || 86;
    var gapY = opts.gapY || 96;
    var padX = opts.padX || 70;
    var padY = opts.padY || 64;

    var tree = spanningTree(graph);
    var col = {};
    var nextLeaf = 0;

    function place(id) {
      var kids = tree.children[id];
      if (!kids || kids.length === 0) {
        col[id] = nextLeaf++;
        return;
      }
      kids.forEach(place);
      col[id] = (col[kids[0]] + col[kids[kids.length - 1]]) / 2;
    }
    place(graph.root);

    var positions = {};
    var maxCol = 0, maxDepth = 0;
    tree.reachable.forEach(function (id) {
      var c = col[id] || 0;
      var d = tree.depth[id] || 0;
      if (c > maxCol) maxCol = c;
      if (d > maxDepth) maxDepth = d;
      positions[id] = { x: padX + c * gapX, y: padY + d * gapY, depth: d, col: c };
    });

    var treeEdges = [];
    tree.reachable.forEach(function (id) {
      (tree.children[id] || []).forEach(function (kid) {
        treeEdges.push([id, kid]);
      });
    });

    return {
      positions: positions,
      treeEdges: treeEdges,
      crossEdges: tree.crossEdges,
      depthOf: tree.depth,
      parentOf: tree.parent,
      childrenOf: tree.children,
      width: padX * 2 + maxCol * gapX,
      height: padY * 2 + maxDepth * gapY,
      maxDepth: maxDepth
    };
  }

  /* The state space from Lecture 3 of the notes. */
  function notesCave() {
    return create({
      A: ['B', 'C'],
      B: ['D', 'E'],
      C: [],
      D: ['F'],
      E: [],
      F: []
    }, 'A');
  }

  NS.graph = {
    create: create,
    layout: layout,
    spanningTree: spanningTree,
    notesCave: notesCave
  };
})(window.CAVE);
