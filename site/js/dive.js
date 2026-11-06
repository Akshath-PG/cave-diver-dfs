/* Dive mode: the player is the diver.
 *
 * The playground shows DFS being run. This makes the student run it. The
 * cave is dark, so choices have to be made without knowing what lies
 * ahead, which is the actual definition of an uninformed search.
 *
 * The rule the game enforces is the one line from the notes that students
 * most often skip:
 *
 *     If an unvisited neighbouring state exists, go there. Otherwise pop.
 *
 * Which unexplored passage you take is free. Turning back while one is
 * still unexplored is not. Refusing that move, and saying why, teaches
 * the invariant better than any amount of prose next to it.
 */
window.CAVE = window.CAVE || {};
(function (NS) {
  'use strict';

  var LEVELS = [
    {
      name: 'First Dive',
      brief: 'The cave from the lecture notes. Follow the rule and reach the ' +
             'treasure at the bottom of the first passage.',
      lesson: 'Every move you just made was a push. Every time you turned back, ' +
              'that was a pop. The rope in the corner was the stack all along.',
      cave: function () { return NS.graph.notesCave(); },
      goal: 'F'
    },
    {
      name: 'The Long Way Round',
      brief: 'The treasure is close to the entrance, but it is not down the ' +
             'first passage. The rule still applies.',
      lesson: 'The treasure was only a couple of passages from the entrance, yet ' +
              'you had to search a whole branch first. DFS finds a solution, not ' +
              'the nearest one. That is what "not optimal" means.',
      cave: function () {
        return NS.graph.generateCave({ branching: 2, depth: 4, seed: 11 });
      },
      goalPick: function (g, lay) { return NS.graph.chamberAtDepth(g, lay, 2, true); }
    },
    {
      name: 'Crawl-ways',
      brief: 'This cave loops back on itself. Your markers are the only thing ' +
             'telling you where you have already been.',
      lesson: 'Some passages led back into chambers you had already searched. ' +
              'Your markers made those dead ends instantly. Without them you ' +
              'would still be swimming in circles.',
      cave: function () {
        return NS.graph.generateCave({ branching: 2, depth: 4, loops: 6, seed: 23 });
      },
      goalPick: function (g, lay) { return NS.graph.chamberAtDepth(g, lay, 4, true); }
    },
    {
      name: 'Deep Water',
      brief: 'A bigger cave, and the treasure is at the very bottom. Watch how ' +
             'little rope you ever need, however many chambers you enter.',
      lesson: 'Look at the two numbers: chambers entered against most rope used. ' +
              'The first grows like b^m, the second never passes m. One diver, ' +
              'one rope, an enormous cave.',
      cave: function () {
        return NS.graph.generateCave({ branching: 3, depth: 4, seed: 5 });
      },
      goalPick: function (g, lay) { return NS.graph.chamberAtDepth(g, lay, 4, true); }
    }
  ];

  function create(opts) {
    var dom = opts.dom;
    var view = NS.cave.create(dom.svg, dom.frame);

    var S = {
      levelIndex: 0,
      graph: null, layout: null, goal: null,
      stack: [], visited: [], visitedSet: {}, seen: {},
      entered: 0, maxRope: 0, wrong: 0,
      status: 'playing'
    };

    /* A chamber is "seen" once the diver has been in a chamber next to it:
     * you can make out an opening from where you are, but not what is
     * behind it. */
    function reveal(id) {
      S.seen[id] = true;
      (S.graph.nodes[id].neighbours || []).forEach(function (n) {
        if (S.graph.nodes[n]) S.seen[n] = true;
      });
    }

    function current() { return S.stack[S.stack.length - 1] || null; }

    function unexploredFrom(id) {
      return (S.graph.nodes[id].neighbours || []).filter(function (n) {
        return S.graph.nodes[n] && !S.visitedSet[n];
      });
    }

    function legalTargets() {
      var legal = {};
      if (S.status !== 'playing') return legal;
      var here = current();
      if (!here) return legal;
      unexploredFrom(here).forEach(function (n) { legal[n] = true; });
      return legal;
    }

    function loadLevel(index) {
      var level = LEVELS[index];
      S.levelIndex = index;
      S.graph = level.cave();
      S.layout = NS.graph.layout(S.graph);
      S.goal = level.goal || level.goalPick(S.graph, S.layout);
      S.stack = [S.graph.root];
      S.visited = [S.graph.root];
      S.visitedSet = {};
      S.visitedSet[S.graph.root] = true;
      S.seen = {};
      S.entered = 1;
      S.maxRope = 1;
      S.wrong = 0;
      S.status = 'playing';
      reveal(S.graph.root);

      view.setCave(S.graph, S.layout, {
        goal: S.goal,
        onChamberClick: onChamberClick
      });

      dom.levelName.textContent = level.name;
      dom.levelBrief.textContent = level.brief;
      dom.lesson.hidden = true;
      renderLevelTabs();
      say('You are at the cave mouth. Pick a passage and swim.', 'info');
      render();
    }

    function onChamberClick(id) {
      if (S.status !== 'playing') return;
      var here = current();
      var neighbours = S.graph.nodes[here].neighbours || [];
      var unexplored = unexploredFrom(here);

      if (id === here) {
        say('You are already in this chamber.', 'info');
        return;
      }

      // Winding the rope in by clicking the chamber you came from.
      if (S.stack.length > 1 && id === S.stack[S.stack.length - 2]) {
        popBack();
        return;
      }

      if (neighbours.indexOf(id) === -1) {
        S.wrong++;
        say('No passage runs from here to that chamber. A diver can only move ' +
            'along a passage out of the chamber he is in, which is why the ' +
            'algorithm only ever looks at the neighbours of the current state.',
            'bad');
        render();
        return;
      }

      if (S.visitedSet[id]) {
        S.wrong++;
        say('Your marker is already in that chamber, so there is nothing left to ' +
            'find down there. The visited set exists to make that answer instant.',
            'bad');
        render();
        return;
      }

      // A legal push.
      S.visitedSet[id] = true;
      S.visited.push(id);
      S.stack.push(id);
      S.entered++;
      if (S.stack.length > S.maxRope) S.maxRope = S.stack.length;
      reveal(id);

      if (id === S.goal) {
        S.status = 'won';
        finish();
      } else if (unexploredFrom(id).length === 0) {
        say('Dead end. Nothing leads out of here that you have not already ' +
            'searched, so the only move left is to wind the rope in.', 'warn');
      } else {
        say('Pushed ' + id + ' onto the rope. ' + unexplored.length +
            ' unexplored passage' + (unexplored.length === 1 ? '' : 's') +
            ' behind you, ' + unexploredFrom(id).length + ' ahead.', 'good');
      }
      render();
    }

    function popBack() {
      if (S.status !== 'playing') return;
      var here = current();
      if (S.stack.length === 1) {
        say('You are back at the cave mouth with the rope fully wound in. ' +
            'The search is over.', 'info');
        return;
      }
      var left = unexploredFrom(here);
      if (left.length > 0) {
        S.wrong++;
        say('Not yet. There ' + (left.length === 1 ? 'is' : 'are') + ' still ' +
            left.length + ' unexplored passage' + (left.length === 1 ? '' : 's') +
            ' out of this chamber. Depth-first search only backtracks when the ' +
            'current chamber has nothing unexplored left.', 'bad');
        render();
        return;
      }
      S.stack.pop();
      say('Popped ' + here + '. You follow the rope back to ' + current() + '.', 'good');
      render();
    }

    function finish() {
      var level = LEVELS[S.levelIndex];
      var depth = S.layout.positions[S.goal].depth;
      dom.lesson.hidden = false;
      dom.lessonText.textContent = level.lesson;
      say('Treasure found. ' + S.entered + ' chambers entered, most rope out ' +
          S.maxRope + ', treasure sitting ' + depth + ' passages from the entrance.',
          'win');
    }

    function say(text, tone) {
      dom.message.textContent = text;
      dom.message.className = 'dive-message is-' + (tone || 'info');
    }

    function renderLevelTabs() {
      dom.levels.innerHTML = '';
      LEVELS.forEach(function (level, i) {
        var b = document.createElement('button');
        b.className = 'mini' + (i === S.levelIndex ? ' is-active' : '');
        b.textContent = (i + 1) + '. ' + level.name;
        b.addEventListener('click', function () { loadLevel(i); });
        dom.levels.appendChild(b);
      });
    }

    function render() {
      view.setState({
        stack: S.stack,
        visited: S.visited,
        current: current(),
        seen: S.seen,
        legal: legalTargets()
      });
      view.follow(current());

      dom.entered.textContent = S.entered;
      dom.rope.textContent = S.stack.length;
      dom.maxRope.textContent = S.maxRope;
      dom.wrong.textContent = S.wrong;

      dom.stackView.innerHTML = '';
      S.stack.slice(-12).forEach(function (id, i, arr) {
        var item = document.createElement('div');
        item.className = 'stack-item' + (i === arr.length - 1 ? ' top' : '');
        var realDepth = S.stack.length - arr.length + i;
        item.innerHTML = '<span>' + id + '</span><span class="depth">depth ' +
          realDepth + '</span>';
        dom.stackView.appendChild(item);
      });

      // Deliberately still clickable when the move is illegal. Greying it
      // out would prevent the mistake; letting it be made and explaining
      // the refusal is what actually teaches the invariant.
      var here = current();
      var canPop = S.status === 'playing' && S.stack.length > 1 &&
                   unexploredFrom(here).length === 0;
      dom.popBtn.disabled = S.status !== 'playing';
      dom.popBtn.classList.toggle('is-blocked', !canPop);
    }

    dom.popBtn.addEventListener('click', popBack);
    dom.restart.addEventListener('click', function () { loadLevel(S.levelIndex); });
    dom.next.addEventListener('click', function () {
      loadLevel((S.levelIndex + 1) % LEVELS.length);
    });

    return {
      start: function () { loadLevel(0); },
      resize: function () { view.applyScale(); }
    };
  }

  NS.dive = { create: create, LEVELS: LEVELS };
})(window.CAVE);
