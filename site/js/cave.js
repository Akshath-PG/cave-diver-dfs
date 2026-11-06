/* Drawing the cave.
 *
 * The structure (passages and chambers) is built once. Replaying a search
 * only changes classes and the rope's points, which keeps stepping smooth
 * and lets CSS handle the transitions.
 *
 * The rope is the whole point of this view: it is drawn from the stack,
 * so what the student sees hanging in the water *is* the data structure.
 */
window.CAVE = window.CAVE || {};
(function (NS) {
  'use strict';

  var SVGNS = 'http://www.w3.org/2000/svg';

  function el(name, attrs) {
    var node = document.createElementNS(SVGNS, name);
    for (var k in attrs) node.setAttribute(k, attrs[k]);
    return node;
  }

  function create(svg) {
    var state = {
      svg: svg,
      graph: null,
      layout: null,
      goal: null,
      chambers: {},
      labels: {},
      edges: {},
      groups: {}
    };

    function clear() {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      state.chambers = {};
      state.labels = {};
      state.edges = {};
    }

    function defs() {
      var d = el('defs');
      d.innerHTML =
        '<radialGradient id="lampGlow">' +
        '  <stop offset="0%" stop-color="#ffe9a8" stop-opacity="0.55"/>' +
        '  <stop offset="55%" stop-color="#ffc15e" stop-opacity="0.16"/>' +
        '  <stop offset="100%" stop-color="#ffc15e" stop-opacity="0"/>' +
        '</radialGradient>' +
        '<radialGradient id="waterGlow">' +
        '  <stop offset="0%" stop-color="#1d5f7d" stop-opacity="0.45"/>' +
        '  <stop offset="100%" stop-color="#0a1a24" stop-opacity="0"/>' +
        '</radialGradient>' +
        '<filter id="softGlow" x="-80%" y="-80%" width="260%" height="260%">' +
        '  <feGaussianBlur stdDeviation="4" result="b"/>' +
        '  <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>' +
        '</filter>';
      return d;
    }

    function setCave(graph, layout, options) {
      var opts = options || {};
      state.graph = graph;
      state.layout = layout;
      state.goal = opts.goal || null;

      clear();
      svg.setAttribute('viewBox', '0 0 ' + layout.width + ' ' + layout.height);
      svg.appendChild(defs());

      var gWater = el('g', { class: 'layer-water' });
      var gPassages = el('g', { class: 'layer-passages' });
      var gCrawl = el('g', { class: 'layer-crawlways' });
      var gRope = el('g', { class: 'layer-rope' });
      var gChambers = el('g', { class: 'layer-chambers' });
      var gDiver = el('g', { class: 'layer-diver' });
      [gWater, gPassages, gCrawl, gRope, gChambers, gDiver].forEach(function (g) {
        svg.appendChild(g);
      });
      state.groups = {
        water: gWater, passages: gPassages, crawl: gCrawl,
        rope: gRope, chambers: gChambers, diver: gDiver
      };

      var P = layout.positions;

      // Passages of the spanning tree: the routes the search can take.
      layout.treeEdges.forEach(function (edge) {
        var a = P[edge[0]], b = P[edge[1]];
        if (!a || !b) return;
        var key = edge[0] + '>' + edge[1];
        var tunnel = el('line', {
          class: 'passage-wall', x1: a.x, y1: a.y, x2: b.x, y2: b.y
        });
        var inner = el('line', {
          class: 'passage', x1: a.x, y1: a.y, x2: b.x, y2: b.y,
          'data-edge': key
        });
        gPassages.appendChild(tunnel);
        gPassages.appendChild(inner);
        state.edges[key] = inner;
      });

      // Crawl-ways: edges that loop back to an already discovered chamber.
      layout.crossEdges.forEach(function (edge) {
        var a = P[edge[0]], b = P[edge[1]];
        if (!a || !b) return;
        var mx = (a.x + b.x) / 2 + (b.y - a.y) * 0.18;
        var my = (a.y + b.y) / 2 - (b.x - a.x) * 0.18;
        gCrawl.appendChild(el('path', {
          class: 'crawlway',
          d: 'M' + a.x + ',' + a.y + ' Q' + mx + ',' + my + ' ' + b.x + ',' + b.y
        }));
      });

      // The rope. One polyline, repointed on every step.
      state.ropeLine = el('polyline', { class: 'rope', points: '' });
      state.ropeGlow = el('polyline', { class: 'rope-glow', points: '' });
      gRope.appendChild(state.ropeGlow);
      gRope.appendChild(state.ropeLine);

      // Chambers.
      Object.keys(P).forEach(function (id) {
        var p = P[id];
        var g = el('g', { class: 'chamber', 'data-id': id, transform: 'translate(' + p.x + ',' + p.y + ')' });

        g.appendChild(el('circle', { class: 'chamber-halo', r: 30 }));
        g.appendChild(el('circle', { class: 'chamber-body', r: 17 }));
        g.appendChild(el('circle', { class: 'chamber-marker', r: 5, cy: 0 }));

        var label = el('text', { class: 'chamber-label', y: 5 });
        label.textContent = id;
        g.appendChild(label);

        if (id === state.goal) {
          g.setAttribute('class', 'chamber is-goal');
          var gem = el('path', {
            class: 'treasure',
            d: 'M0,-11 L9,-3 L0,11 L-9,-3 Z'
          });
          g.appendChild(gem);
        }

        gChambers.appendChild(g);
        state.chambers[id] = g;
        state.labels[id] = label;
      });

      // The diver's lamp and body, moved to the current chamber.
      state.lamp = el('circle', { class: 'lamp', r: 62, fill: 'url(#lampGlow)' });
      state.diver = el('g', { class: 'diver' });
      state.diver.appendChild(el('circle', { class: 'diver-body', r: 9 }));
      state.diver.appendChild(el('circle', { class: 'diver-eye', r: 3, cx: 3, cy: -2 }));
      gDiver.appendChild(state.lamp);
      gDiver.appendChild(state.diver);
    }

    /* Apply one step of a recorded search. */
    function setState(view) {
      if (!state.layout) return;
      var P = state.layout.positions;
      var stack = view.stack || [];
      var visited = view.visited || [];
      var current = view.current;

      var onRope = {};
      stack.forEach(function (id) { onRope[id] = true; });
      var isVisited = {};
      visited.forEach(function (id) { isVisited[id] = true; });

      Object.keys(state.chambers).forEach(function (id) {
        var g = state.chambers[id];
        var classes = ['chamber'];
        if (id === state.goal) classes.push('is-goal');
        if (isVisited[id]) classes.push('is-visited');
        if (onRope[id]) classes.push('is-on-rope');
        if (id === current) classes.push('is-current');
        if (isVisited[id] && !onRope[id]) classes.push('is-finished');
        g.setAttribute('class', classes.join(' '));
      });

      // Light the passages the rope currently runs through.
      Object.keys(state.edges).forEach(function (key) {
        state.edges[key].classList.remove('is-lit');
      });
      for (var i = 0; i < stack.length - 1; i++) {
        var fwd = state.edges[stack[i] + '>' + stack[i + 1]];
        var rev = state.edges[stack[i + 1] + '>' + stack[i]];
        if (fwd) fwd.classList.add('is-lit');
        if (rev) rev.classList.add('is-lit');
      }

      var points = stack.map(function (id) {
        var p = P[id];
        return p ? p.x + ',' + p.y : '';
      }).filter(Boolean).join(' ');
      state.ropeLine.setAttribute('points', points);
      state.ropeGlow.setAttribute('points', points);

      var here = current && P[current];
      if (here) {
        state.lamp.setAttribute('cx', here.x);
        state.lamp.setAttribute('cy', here.y);
        state.lamp.style.opacity = '1';
        state.diver.setAttribute('transform', 'translate(' + here.x + ',' + (here.y - 24) + ')');
        state.diver.style.opacity = '1';
      } else {
        state.lamp.style.opacity = '0';
        state.diver.style.opacity = '0';
      }
    }

    return { setCave: setCave, setState: setState, el: el };
  }

  NS.cave = { create: create };
})(window.CAVE);
