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

  function create(svg, frame) {
    var state = {
      svg: svg,
      frame: frame || svg.parentNode,
      graph: null,
      layout: null,
      goal: null,
      chambers: {},
      edges: {},
      edgeEnds: {},
      walls: {},
      prevClass: {},
      prevLit: {},
      scale: 1,
      onChamberClick: null
    };

    function clear() {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      state.chambers = {};
      state.edges = {};
      state.edgeEnds = {};
      state.walls = {};
      state.prevClass = {};
      state.prevLit = {};
    }

    function defs() {
      var d = el('defs');
      d.innerHTML =
        '<radialGradient id="lampGlow">' +
        '  <stop offset="0%" stop-color="#ffe9a8" stop-opacity="0.5"/>' +
        '  <stop offset="55%" stop-color="#ffc15e" stop-opacity="0.14"/>' +
        '  <stop offset="100%" stop-color="#ffc15e" stop-opacity="0"/>' +
        '</radialGradient>' +
        '<filter id="softGlow" x="-80%" y="-80%" width="260%" height="260%">' +
        '  <feGaussianBlur stdDeviation="3" result="b"/>' +
        '  <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>' +
        '</filter>';
      return d;
    }

    /* Fit the drawing to the frame, but never shrink chambers into dust:
     * past a point it is better to let the cave scroll, the way a real
     * dive goes further than one screenful. */
    function applyScale() {
      if (!state.layout) return;
      // Always fit the width. A wide cave shrinking to a dense triangle is
      // not a rendering failure, it is the combinatorial explosion showing
      // itself, so it is worth seeing whole.
      var avail = (state.frame.clientWidth || 900) - 18;
      // Fit the width where that still leaves chambers big enough to see;
      // past that, let the cave scroll sideways rather than shrink into a
      // thread. The diver is followed automatically, so scrolling is not
      // something the student has to manage.
      var scale = Math.min(1, avail / state.layout.width);
      scale = Math.max(scale, 0.38);
      state.scale = scale;
      svg.setAttribute('width', Math.round(state.layout.width * scale));
      svg.setAttribute('height', Math.round(state.layout.height * scale));
    }

    function setCave(graph, lay, options) {
      var opts = options || {};
      state.graph = graph;
      state.layout = lay;
      state.goal = opts.goal || null;
      state.onChamberClick = opts.onChamberClick || null;

      var r = lay.nodeRadius;
      clear();
      svg.setAttribute('viewBox', '0 0 ' + lay.width + ' ' + lay.height);
      svg.appendChild(defs());

      var groups = {};
      ['passages', 'crawl', 'rope', 'chambers', 'diver'].forEach(function (name) {
        groups[name] = el('g', { class: 'layer-' + name });
        svg.appendChild(groups[name]);
      });
      state.groups = groups;

      var P = lay.positions;

      lay.treeEdges.forEach(function (edge) {
        var a = P[edge[0]], b = P[edge[1]];
        if (!a || !b) return;
        var key = edge[0] + '>' + edge[1];
        var wall = el('line', {
          class: 'passage-wall', x1: a.x, y1: a.y, x2: b.x, y2: b.y,
          'stroke-width': Math.max(6, r * 0.9)
        });
        groups.passages.appendChild(wall);
        state.walls[key] = wall;
        var inner = el('line', {
          class: 'passage', x1: a.x, y1: a.y, x2: b.x, y2: b.y,
          'data-edge': key, 'stroke-width': Math.max(2.5, r * 0.36)
        });
        groups.passages.appendChild(inner);
        state.edges[key] = inner;
        state.edgeEnds[key] = edge;
      });

      lay.crossEdges.forEach(function (edge) {
        var a = P[edge[0]], b = P[edge[1]];
        if (!a || !b) return;
        var mx = (a.x + b.x) / 2 + (b.y - a.y) * 0.18;
        var my = (a.y + b.y) / 2 - (b.x - a.x) * 0.18;
        groups.crawl.appendChild(el('path', {
          class: 'crawlway',
          d: 'M' + a.x + ',' + a.y + ' Q' + mx + ',' + my + ' ' + b.x + ',' + b.y
        }));
      });

      state.ropeGlow = el('polyline', {
        class: 'rope-glow', points: '', 'stroke-width': Math.max(8, r * 0.8)
      });
      state.ropeLine = el('polyline', {
        class: 'rope', points: '', 'stroke-width': Math.max(2.2, r * 0.27)
      });
      groups.rope.appendChild(state.ropeGlow);
      groups.rope.appendChild(state.ropeLine);

      Object.keys(P).forEach(function (id) {
        var p = P[id];
        var shaft = p.endless;
        var cr = shaft ? Math.min(r, 3.4) : r;
        var g = el('g', {
          class: 'chamber' + (shaft ? ' is-shaft' : ''), 'data-id': id,
          transform: 'translate(' + p.x + ',' + p.y + ')'
        });

        if (!shaft) g.appendChild(el('circle', { class: 'chamber-halo', r: r * 1.8 }));
        g.appendChild(el('circle', { class: 'chamber-body', r: cr }));
        // The marker sits as a badge on the rim, not in the middle, where
        // it would sit on top of the chamber's label.
        g.appendChild(el('circle', {
          class: 'chamber-marker',
          r: Math.max(1.6, cr * 0.26),
          cx: cr * 0.78, cy: -cr * 0.78
        }));

        if (lay.showLabels && !shaft) {
          var label = el('text', {
            class: 'chamber-label', y: r * 0.34, 'font-size': Math.max(9, r * 0.82)
          });
          label.textContent = id.length > 3 ? id.slice(-2) : id;
          g.appendChild(label);
        }

        // Clicking a chamber moves the treasure there. Not offered in the
        // shaft, where the hit areas would all sit on top of each other.
        if (state.onChamberClick && !shaft) {
          g.classList.add('is-clickable');
          g.appendChild(el('circle', { class: 'chamber-hit', r: Math.max(r * 1.7, 13) }));
          g.addEventListener('click', function () { state.onChamberClick(id); });
        }

        groups.chambers.appendChild(g);
        state.chambers[id] = g;
      });

      state.lamp = el('circle', { class: 'lamp', r: Math.max(34, r * 3.6), fill: 'url(#lampGlow)' });
      state.diver = el('g', { class: 'diver' });
      var dr = Math.max(7, r * 0.62);
      state.diver.appendChild(el('path', {
        class: 'diver-fin',
        d: 'M' + (-dr * 0.75) + ',0 L' + (-dr * 1.5) + ',' + (-dr * 0.55) +
           ' L' + (-dr * 1.5) + ',' + (dr * 0.55) + ' Z'
      }));
      state.diver.appendChild(el('ellipse', {
        class: 'diver-body', rx: dr, ry: dr * 0.66
      }));
      state.diver.appendChild(el('circle', {
        class: 'diver-head', r: dr * 0.42, cx: dr * 0.72, cy: -dr * 0.2
      }));
      state.diver.appendChild(el('circle', {
        class: 'diver-mask', r: dr * 0.17, cx: dr * 0.92, cy: -dr * 0.24
      }));
      groups.diver.appendChild(state.lamp);
      groups.diver.appendChild(state.diver);

      applyScale();
      markGoal(state.goal);
    }

    function markGoal(goal) {
      state.goal = goal;
      var r = state.layout ? state.layout.nodeRadius : 14;
      Object.keys(state.chambers).forEach(function (id) {
        var g = state.chambers[id];
        var existing = g.querySelector('.treasure');
        if (existing) existing.remove();
        if (id === goal) {
          var s = r * 0.72;
          g.insertBefore(el('path', {
            class: 'treasure',
            d: 'M0,' + (-s) + ' L' + (s * 0.82) + ',' + (-s * 0.25) +
               ' L0,' + s + ' L' + (-s * 0.82) + ',' + (-s * 0.25) + ' Z'
          }), g.querySelector('.chamber-hit'));
        }
      });
    }

    /* Apply one recorded step. */
    function setState(view) {
      if (!state.layout) return;
      var P = state.layout.positions;
      var stack = view.stack || [];
      var visited = view.visited || [];
      var current = view.current;

      var onRope = {}, isVisited = {};
      stack.forEach(function (id) { onRope[id] = true; });
      visited.forEach(function (id) { isVisited[id] = true; });

      var seen = view.seen || null;
      var legal = view.legal || {};
      // BFS passes a frontier: chambers discovered but not yet expanded.
      var frontier = {};
      (view.frontier || []).forEach(function (id) { frontier[id] = true; });

      // Only touch the chambers whose appearance actually changed. With an
      // endless shaft a cave can hold well over a thousand chambers, and
      // rewriting every class on every step made playback stutter.
      Object.keys(state.chambers).forEach(function (id) {
        var shaft = P[id] && P[id].endless;
        var classes = ['chamber'];
        if (shaft) classes.push('is-shaft');
        if (state.onChamberClick && !shaft) classes.push('is-clickable');
        // Dive mode passes `seen` and `legal`; without them everything is
        // visible, which is what the playground wants.
        if (seen) {
          if (!seen[id]) classes.push('is-hidden');
          else if (!isVisited[id]) classes.push('is-glimpsed');
          if (legal[id]) classes.push('is-legal');
        }
        if (id === state.goal && (!seen || isVisited[id])) classes.push('is-goal');
        if (isVisited[id]) classes.push('is-visited');
        if (frontier[id]) classes.push('is-frontier');
        if (onRope[id]) classes.push('is-on-rope');
        if (id === current) classes.push('is-current');
        if (isVisited[id] && !onRope[id]) classes.push('is-finished');
        var joined = classes.join(' ');
        if (state.prevClass[id] !== joined) {
          state.chambers[id].setAttribute('class', joined);
          state.prevClass[id] = joined;
        }
      });

      var lit = {};
      for (var i = 0; i < stack.length - 1; i++) {
        lit[stack[i] + '>' + stack[i + 1]] = true;
        lit[stack[i + 1] + '>' + stack[i]] = true;
      }
      Object.keys(state.edges).forEach(function (key) {
        var ends = state.edgeEnds[key];
        var hidden = seen ? !(seen[ends[0]] && seen[ends[1]]) : false;
        var want = (lit[key] ? 'lit' : '') + (hidden ? ' hidden' : '');
        if (state.prevLit[key] !== want) {
          state.edges[key].classList.toggle('is-lit', !!lit[key]);
          state.edges[key].classList.toggle('is-hidden', hidden);
          state.walls[key].classList.toggle('is-hidden', hidden);
          state.prevLit[key] = want;
        }
      });

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
        state.diver.setAttribute('transform',
          'translate(' + here.x + ',' + (here.y - state.layout.nodeRadius * 1.55) + ')');
        state.diver.style.opacity = '1';
      } else {
        state.lamp.style.opacity = '0';
        state.diver.style.opacity = '0';
      }
    }

    /* Keep the diver on screen in caves taller than the frame. */
    function follow(id) {
      if (!state.layout || !id) return;
      var p = state.layout.positions[id];
      if (!p) return;
      var f = state.frame;
      var y = p.y * state.scale;
      var x = p.x * state.scale;
      if (y < f.scrollTop + 70 || y > f.scrollTop + f.clientHeight - 70) {
        f.scrollTop = Math.max(0, y - f.clientHeight * 0.45);
      }
      if (x < f.scrollLeft + 60 || x > f.scrollLeft + f.clientWidth - 60) {
        f.scrollLeft = Math.max(0, x - f.clientWidth * 0.5);
      }
    }

    window.addEventListener('resize', applyScale);

    return {
      setCave: setCave,
      setState: setState,
      markGoal: markGoal,
      follow: follow,
      applyScale: applyScale
    };
  }

  NS.cave = { create: create };
})(window.CAVE);
