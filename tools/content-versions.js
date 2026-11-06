/* Report section 5: the version history. */

const L = require('./report-lib');

module.exports = function () {
  const out = [];

  out.push('<h1>5. Version History</h1>');
  out.push('<p class="lede">Six versions, each a single tagged commit. For each ' +
    'one: what it set out to add, the reasoning, the code that resulted, ' +
    'screenshots of it running, and what turned out to be wrong with it.</p>');

  out.push(L.table(['Tag', 'Added', 'Site files', 'Lines of JS'], [
    ['<span class="vtag">v0.1</span>', 'Correct DFS, printed as a table', '1', '~95'],
    ['<span class="vtag">v0.2</span>', 'The cave, the rope, playback', '6', '~520'],
    ['<span class="vtag">v0.3</span>', 'Live conditions', '6', '~900'],
    ['<span class="vtag">v0.4</span>', 'Dive mode', '7', '~1,250'],
    ['<span class="vtag">v0.5</span>', 'Race mode, BFS, IDS', '8', '~1,700'],
    ['<span class="vtag">v1.0</span>', 'Learn mode, pseudocode, polish', '8', '~1,850']
  ]));

  /* ---------------------------- v0.1 ---------------------------- */
  out.push('<h2>5.1 <span class="vtag">v0.1</span> The base</h2>');

  out.push('<h3>Goal</h3>');
  out.push('<p>Run depth-first search over the state space from the lecture ' +
    'notes and print the trace. No styling, no graphics, no interaction beyond a ' +
    'single button. The entire purpose of this version is to be checkable.</p>');

  out.push(L.think([
    'The temptation at this point is to build the cave immediately, because the ' +
    'cave is the interesting part. That temptation was refused.',
    'The reasoning is about what a bug looks like. Once there is a visualisation, ' +
    'a wrong search and a wrong drawing produce the same symptom: something moves ' +
    'when it should not. Separating them afterwards means debugging two systems ' +
    'at once. By rendering the trace as unstyled text first, the output can be ' +
    'compared line by line against the table printed in the notes. If the twelve ' +
    'rows match, the algorithm is correct, and every subsequent bug is by ' +
    'elimination a presentation bug.',
    'There is a second benefit, which is specific to this report. It makes the ' +
    'Clash of Clans analogy the brief asked for honest. This really is the ' +
    'level-one base: it works, it is correct, and it is plain.'
  ], 'Why start with something this plain'));

  out.push('<h3>The state space</h3>');
  out.push(L.code('v0.1 &mdash; site/index.html',
    L.slice(L.fileAt('v0.1', 'site/index.html'), 'var GRAPH = {', '};')));

  out.push('<h3>The algorithm</h3>');
  out.push('<p>Written to follow the notes line for line, including the detail ' +
    'that the stack holds only the current path.</p>');
  out.push(L.code('v0.1 &mdash; site/index.html',
    L.slice(L.fileAt('v0.1', 'site/index.html'),
      'function runDFS(graph, start)', null, { count: 48 }), { long: true }));

  out.push('<h3>Result</h3>');
  out.push(L.fig('v0.1-a-initial', '<b>v0.1</b> on load. A heading, the state ' +
    'space written out, and a button. This is the base before any upgrade.'));
  out.push(L.fig('v0.1-b-trace', '<b>v0.1</b> after pressing Run DFS. Twelve ' +
    'steps, each with the action performed, the stack as a path, and the visited ' +
    'set. This output was compared row by row with the trace table in the ' +
    'lecture notes and matched exactly.'));

  out.push(L.note(['The verification is set out in full in Section 7.1. The ' +
    'short version is that all twelve rows agree: same current state, same ' +
    'action, same stack contents and same visited set at every step. That ' +
    'agreement is what made the rest of the project safe to build.']));

  /* ---------------------------- v0.2 ---------------------------- */
  out.push('<h2>5.2 <span class="vtag">v0.2</span> The cave appears</h2>');

  out.push('<h3>Goal</h3>');
  out.push('<p>Replace the table with a drawn cave, where the stack is rendered ' +
    'as the diver’s rope, and add playback controls so the search can be ' +
    'stepped through in both directions.</p>');

  out.push(L.think([
    'Two architectural decisions were taken here that everything later depends ' +
    'on, and both were made for reasons worth stating.',
    'The first: the search is <b>recorded, then replayed</b>. Rather than running ' +
    'the algorithm live and drawing as it goes, the search runs to completion ' +
    'immediately and returns a flat list of steps, each holding a complete ' +
    'snapshot of the stack and visited set. Playback is then just an index into ' +
    'that list. This makes stepping backwards exactly as cheap as stepping ' +
    'forwards, which a live implementation cannot offer without storing undo ' +
    'information anyway; it allows the student to click any line of the log and ' +
    'jump there; and it keeps the algorithm completely free of drawing code, so ' +
    'the file that implements DFS reads like the notes rather than like a ' +
    'rendering engine.',
    'The second: the cave is laid out along the <b>depth-first spanning tree</b>, ' +
    'walked in the same neighbour order the search uses. This means depth on the ' +
    'screen is the depth the algorithm actually experiences, so "going deeper" ' +
    'is literally downward movement. Any edge that leads back to an already ' +
    'discovered chamber is drawn differently, as a dashed crawl-way, because the ' +
    'search will never travel down it.'
  ], 'Record and replay, and why the layout follows the search'));

  out.push('<h3>The search engine, extracted</h3>');
  out.push(L.code('v0.2 &mdash; site/js/search.js, the main loop',
    L.slice(L.fileAt('v0.2', 'site/js/search.js'),
      'while (stack.length > 0 && steps.length < maxSteps)',
      'var exhausted'), { long: true }));

  out.push('<h3>Drawing the stack as a rope</h3>');
  out.push('<p>This is the line that carries the whole metaphor. The rope is not ' +
    'an illustration of the stack; its geometry is read directly out of the ' +
    'stack array on every step.</p>');
  out.push(L.code('v0.2 &mdash; site/js/cave.js',
    L.slice(L.fileAt('v0.2', 'site/js/cave.js'),
      'var points = stack.map', 'state.ropeGlow.setAttribute')));

  out.push('<h3>Result</h3>');
  out.push(L.fig('v0.2-b-deepest', '<b>v0.2</b> three steps in. The amber rope ' +
    'runs A to B to D, the stack panel shows the same three entries with their ' +
    'depths, teal markers show the visited set, and the lamp glow marks the ' +
    'diver. The same information appears three times over, in three different ' +
    'forms, which is the point.'));
  out.push(L.fig('v0.2-c-backtracked', '<b>v0.2</b> after backtracking. D has ' +
    'been popped, the rope has shortened to A to B, but D and F keep their teal ' +
    'markers. This picture is the distinction between the stack and the visited ' +
    'set, which students routinely conflate.'));

  out.push(L.note(['A deliberate colour rule was set here and held for the rest ' +
    'of the project: everything cold and blue belongs to the cave, which is the ' +
    'problem, and everything warm and amber belongs to the diver’s own ' +
    'memory, which is the stack. A student should be able to tell the data ' +
    'structure from the state space by colour alone, without reading a legend.']));

  /* ---------------------------- v0.3 ---------------------------- */
  out.push('<h2>5.3 <span class="vtag">v0.3</span> The playground</h2>');

  out.push('<h3>Goal</h3>');
  out.push('<p>Implement the TensorFlow Playground idea: make the cave itself ' +
    'adjustable, and let the student discover the properties of DFS by changing ' +
    'conditions rather than by being told.</p>');

  out.push(L.think([
    'The design rule adopted was that <b>no control exists for its own sake</b>. ' +
    'Each one had to make a specific claim from the lecture notes falsifiable by ' +
    'the student.',
    'Switching markers off makes the search fail to terminate, which demonstrates ' +
    'that the visited set is part of the algorithm and not an optimisation. ' +
    'Adding an endless passage makes DFS commit and never return, demonstrating ' +
    'that it is not complete. Placing the treasure shallow but on the last branch ' +
    'makes DFS find it the long way round, demonstrating that it is not optimal. ' +
    'Limiting the rope makes the search terminate but miss deeper solutions, ' +
    'which is depth-limited search and the doorway to Lecture 7.',
    'Every condition is also written into the URL, so a particular cave with a ' +
    'particular set of conditions can be handed to someone else as a link. Caves ' +
    'are generated from a seed for the same reason: a shared link has to rebuild ' +
    'the identical cave, not a similar one.'
  ], 'Every control has to prove something'));

  out.push('<h3>Generating caves</h3>');
  out.push('<p>Exact branching was chosen over random branching so that the page ' +
    'can state honestly how many chambers a cave holds, which the complexity ' +
    'discussion depends on.</p>');
  out.push(L.code('v0.3 &mdash; site/js/graph.js, seeded random',
    L.slice(L.fileAt('v0.3', 'site/js/graph.js'),
      'function rng(seed)', null, { count: 11 })));

  out.push(L.code('v0.3 &mdash; site/js/graph.js, the endless passage',
    L.slice(L.fileAt('v0.3', 'site/js/graph.js'),
      'var endlessIds = [];', null, { count: 13 })));

  out.push('<h3>Result</h3>');
  out.push(L.fig('v0.3-a-playground', '<b>v0.3</b> with the lecture notes cave ' +
    'loaded. Conditions on the left, the cave in the middle, readings and the ' +
    'dive log on the right.'));

  out.push(L.fig('v0.3-b-big-cave', '<b>v0.3</b> with b = 3 and depth = 5: 364 ' +
    'chambers. The reading that matters is the pair at the top right &mdash; 364 ' +
    'chambers entered against a maximum of 6 chambers of rope. That gap is ' +
    'O(b<sup>m</sup>) against O(m), shown rather than asserted.'));

  out.push('<h3>Problem: the search that would not end</h3>');
  out.push('<p>Switching markers off initially did nothing interesting, because ' +
    'the first implementation still blocked re-entry to anything on the current ' +
    'path. That is a cycle check, not an absence of memory, and it taught the ' +
    'wrong lesson. The code was changed so that switching markers off removes ' +
    'the check entirely.</p>');
  out.push(L.code('v0.3 &mdash; site/js/search.js',
    L.slice(L.fileAt('v0.3', 'site/js/search.js'),
      '// With markers switched off', 'if (!blocked) { next = n; break; }')));
  out.push('<p>The consequence is correct and slightly surprising: without ' +
    'markers the search fails to terminate even on a cave with no loops at all, ' +
    'because after backtracking the diver has no way of knowing he has already ' +
    'searched the branch he just left. The page says so in those words.</p>');
  out.push(L.fig('v0.3-c-no-markers', '<b>v0.3</b> with markers switched off. ' +
    'The run is stopped after 400 steps and the verdict explains that the ' +
    'visited set is what makes the algorithm finish.'));

  out.push('<h3>Problem: the endless passage that ended</h3>');
  out.push(L.think([
    'The first endless passage was sixty chambers long. The diver went down it, ' +
    'reached the bottom, came back, and found the treasure. The verdict then ' +
    'reported success.',
    'This is worse than useless. The control is called "endless passage" and ' +
    'exists to demonstrate that DFS is not complete, and it was demonstrating ' +
    'that DFS is complete and merely slow. A sixty-chamber corridor is not an ' +
    'infinite branch; it is a long finite one.',
    'The fix needed the passage to be long enough that the search is still ' +
    'descending when the page stops it, which means over a thousand chambers. ' +
    'That created a drawing problem: at normal spacing, 1,200 chambers is a ' +
    'drawing roughly 70,000 pixels tall. The solution was to pack the shaft ' +
    'tightly &mdash; seven pixels per chamber instead of ninety-two &mdash; and ' +
    'draw its chambers small and dim. It reads as a bottomless shaft descending ' +
    'into the dark, which is exactly what it represents, and the real cave keeps ' +
    'its normal proportions because the shaft is excluded from the sizing maths.'
  ], 'A control that demonstrated the opposite of its purpose'));

  out.push(L.code('v0.3 &mdash; site/js/graph.js, compressing the shaft',
    L.slice(L.fileAt('v0.3', 'site/js/graph.js'),
      '// The endless shaft is packed tightly', 'maxY = y;')));

  out.push(L.fig('v0.3-d-endless', '<b>v0.3</b> with the endless passage ' +
    'enabled. The shaft descends at the far left; the treasure sits two passages ' +
    'from the entrance on the right, untouched. The diver is 900 chambers down ' +
    'and still going. The chamber count reads as the infinity symbol rather than ' +
    'a number, because printing 1,231 would have contradicted the lesson.'));

  out.push('<h3>Problem: caves too large to draw</h3>');
  out.push(L.think([
    'With b = 5 and m = 8 the generator is asked for 488,281 chambers. Building ' +
    'that graph and attempting to draw it would hang the browser.',
    'The obvious response is to clamp the sliders. That was rejected, because the ' +
    'number itself is the most important thing on the page. Combinatorial ' +
    'explosion is the reason the whole of Module 1 exists, and a student who ' +
    'drags a slider to five and is quietly prevented from doing so learns ' +
    'nothing.',
    'So the page refuses to draw and prints the figure instead, next to the rope ' +
    'length. A cave can be described long before it can be drawn, and the gap ' +
    'between 488,281 and 8 is the entire trade-off in two numbers. A limitation ' +
    'of the renderer was turned into the clearest statement of complexity on the ' +
    'site.'
  ], 'Turning a rendering limit into the lesson'));

  out.push(L.fig('v0.3-e-too-big', '<b>v0.3</b> with b = 5 and m = 8. No cave ' +
    'is drawn. The page states the chamber count against the rope the diver ' +
    'would need, which is O(b<sup>m</sup>) against O(m) in one sentence.'));

  out.push('<h3>Problem: the layout collapsed, twice</h3>');
  out.push('<p>Two separate layout faults appeared in this version and both took ' +
    'more than one attempt. They are documented in full in Section 6.4, because ' +
    'the second one required rewriting how the drawing is sized.</p>');

  /* ---------------------------- v0.4 ---------------------------- */
  out.push('<h2>5.4 <span class="vtag">v0.4</span> Dive mode</h2>');

  out.push('<h3>Goal</h3>');
  out.push('<p>Let the student be the diver. The cave is dark, choices are made ' +
    'without knowing what lies ahead, and the game enforces the rule from the ' +
    'notes.</p>');

  out.push(L.think([
    'The design question here is what exactly to enforce. Depth-first search ' +
    'does not specify which unexplored passage to take; it specifies only that ' +
    'you must take one if one exists. So the game gives the player complete ' +
    'freedom over which passage, and refuses only two things: moving to a chamber ' +
    'with no passage from where you are, and turning back while an unexplored ' +
    'passage remains.',
    'Fog of war is not decoration either. Without it the player can see the ' +
    'treasure and walk to it, which is an informed search and therefore the wrong ' +
    'algorithm. Chambers become visible only once the diver has been somewhere ' +
    'adjacent to them: you can make out an opening from where you stand, but not ' +
    'what lies behind it.'
  ], 'Deciding what the game should refuse'));

  out.push('<h3>Problem: the disabled button that taught nothing</h3>');
  out.push(L.think([
    'The first implementation disabled the backtrack button whenever backtracking ' +
    'was illegal. This is conventional interface design and it is exactly wrong ' +
    'here.',
    'A greyed-out button prevents the mistake. It does not explain it. The ' +
    'student learns that the button is sometimes grey, which is a fact about the ' +
    'website rather than a fact about depth-first search. The single most ' +
    'important invariant in the algorithm &mdash; that you may only backtrack ' +
    'from a chamber with nothing unexplored left &mdash; was being hidden behind ' +
    'an interface convention.',
    'The button was made permanently clickable. Pressing it when the move is ' +
    'illegal now produces a refusal naming the number of unexplored passages ' +
    'remaining and restating the rule. Being told why the cave will not let you ' +
    'turn back teaches the invariant; being unable to click does not.',
    'This was caught by the screenshot tool, which could not click the disabled ' +
    'button and failed the build. A test that could not perform the most ' +
    'instructive action in the game turned out to be a design review.'
  ], 'Prevention versus explanation'));

  out.push(L.code('v0.4 &mdash; site/js/dive.js, refusing a move',
    L.slice(L.fileAt('v0.4', 'site/js/dive.js'),
      'function popBack()', null, { count: 24 }), { long: true }));

  out.push(L.code('v0.4 &mdash; site/js/dive.js, keeping the button live',
    L.slice(L.fileAt('v0.4', 'site/js/dive.js'),
      '// Deliberately still clickable', null, { count: 8 })));

  out.push('<h3>Result</h3>');
  out.push(L.fig('v0.4-b-dive-moved', '<b>v0.4</b> two moves in. Dashed outlines ' +
    'are chambers glimpsed but not entered; the gold chamber is a legal next ' +
    'move. The player’s own rope is on the right.'));
  out.push(L.fig('v0.4-c-refused', '<b>v0.4</b> after attempting to backtrack ' +
    'too early. The move is refused, the reason is given in terms of the ' +
    'algorithm, and the refusal is counted.'));

  out.push('<h3>Problem: treasure visible through rock</h3>');
  out.push('<p>Because the treasure was drawn whenever its chamber had been ' +
    'glimpsed, a player could see the gold marker one chamber ahead and make a ' +
    'beeline for it. That silently converts the game from an uninformed search ' +
    'into an informed one, which is the opposite of what it is demonstrating. ' +
    'The treasure is now hidden until its chamber is actually entered.</p>');
  out.push(L.code('v1.0 &mdash; site/css/styles.css',
    L.slice(L.fileAt('v1.0', 'site/css/styles.css'),
      '/* You cannot see treasure through rock', '}')));

  /* ---------------------------- v0.5 ---------------------------- */
  out.push('<h2>5.5 <span class="vtag">v0.5</span> Race mode</h2>');

  out.push('<h3>Goal</h3>');
  out.push('<p>Place DFS in context by running it against breadth-first search ' +
    'and against iterative deepening over an identical cave.</p>');

  out.push(L.think([
    'The notes are careful not to rank these algorithms. They frame the choice as ' +
    'situational: if memory is scarce, DFS; if you need the shortest solution, ' +
    'BFS; if the search space is enormous, probably not BFS. The view was built ' +
    'to match that framing, so it declares no winner. It reports two numbers for ' +
    'each &mdash; chambers entered, and memory held &mdash; and says what each ' +
    'bought.',
    'Representing BFS honestly required breaking the metaphor on purpose. One ' +
    'diver cannot expand a frontier; he cannot be in nine chambers at once. ' +
    'Drawing BFS as a single diver teleporting around would have concealed ' +
    'precisely the thing that makes it expensive. It is drawn as a team, each ' +
    'member holding a rope, so the frontier is visibly many ropes. The path to ' +
    'the chamber currently being expanded is still drawn, but faintly, so that it ' +
    'is not mistaken for the queue.',
    'Iterative deepening is reported with its total cost across all restarts ' +
    'rather than just the final pass, which is the honest figure and the one that ' +
    'makes the comparison meaningful.'
  ], 'Reporting a comparison without declaring a winner'));

  out.push(L.code('v0.5 &mdash; site/js/search.js, breadth-first expansion',
    L.slice(L.fileAt('v0.5', 'site/js/search.js'),
      'while (queue.length > 0 && steps.length < maxSteps)',
      null, { count: 20 }), { long: true }));

  out.push('<h3>Result</h3>');
  out.push(L.fig('v0.5-a-race-bfs', '<b>v0.5</b> DFS against BFS on the same ' +
    '31-chamber cave with the treasure two passages from the entrance. DFS ' +
    'entered 25 chambers; BFS entered 7 and found the shorter route, but held ' +
    'seven ropes at once where DFS held at most five. The teal ring on the right ' +
    'is the frontier.'));
  out.push(L.fig('v0.5-b-race-ids', '<b>v0.5</b> DFS against iterative ' +
    'deepening. IDS entered 11 chambers across 3 restarts and never held more ' +
    'than 3 chambers of rope, which is the Lecture 7 argument in numbers.'));

  /* ---------------------------- v1.0 ---------------------------- */
  out.push('<h2>5.6 <span class="vtag">v1.0</span> Learn mode and polish</h2>');

  out.push('<h3>Goal</h3>');
  out.push('<p>Add the written explanation the brief asked for, connect the ' +
    'pseudocode to the animation, and fix the remaining visual faults.</p>');

  out.push(L.think([
    'The Learn page could have been written as static prose. It was not, in one ' +
    'respect that matters: the worked trace table is generated at page load by ' +
    'the same search engine the game runs.',
    'The reason is drift. Hand-written documentation and the code it documents ' +
    'separate over time, and a report that claims the implementation matches the ' +
    'notes should not then print a trace copied by hand. Generating it means the ' +
    'explanation cannot disagree with the implementation, because it is produced ' +
    'by the implementation.',
    'The same thinking produced the pseudocode panel. The algorithm and the ' +
    'picture are the same thing said twice, and lighting the executing line as ' +
    'the diver moves is what joins them up for a student who can follow one but ' +
    'not the other.'
  ], 'Generating the explanation from the implementation'));

  out.push(L.code('v1.0 &mdash; site/js/app.js, the trace table is generated',
    L.slice(L.fileAt('v1.0', 'site/js/app.js'),
      '// The trace table is generated', 'body.appendChild(row);')));

  out.push(L.code('v1.0 &mdash; site/js/app.js, lighting the executing line',
    L.slice(L.fileAt('v1.0', 'site/js/app.js'),
      'function highlightPseudo(step)', null, { count: 14 })));

  out.push('<h3>Result</h3>');
  out.push(L.fig('v1.0-b-playground-pseudocode', '<b>v1.0</b> playground with ' +
    'the algorithm panel. The highlighted line is the one being executed by the ' +
    'current step &mdash; here the pop that follows the rope back.'));
  out.push(L.fig('v1.0-c-learn', '<b>v1.0</b> Learn mode: the three ingredients ' +
    'from Lecture 3, the algorithm, and the worked trace below.'));
  out.push(L.fig('v1.0-d-learn-trace', '<b>v1.0</b> the generated trace table ' +
    'and the complexity calculator, which reproduces the notes’ own example ' +
    'of b = 4 and m = 20 giving 1.1 trillion chambers against 20 remembered.'));

  out.push('<h3>Smaller corrections in this version</h3>');
  out.push(L.table(['Fault', 'Fix'], [
    ['The visited marker was drawn at the centre of a chamber, on top of its ' +
      'label, making both hard to read',
      'Moved to the chamber rim as a badge'],
    ['The diver was a plain circle, indistinguishable from a chamber',
      'Drawn as a figure with a fin, body, head and mask'],
    ['On a phone, the controls panel pushed the cave below the fold',
      'The cave is ordered first under 860 pixels wide'],
    ['Two CSS values were corrupted during generation, one colour and one ' +
      'background, which would have failed silently',
      'Caught on review and corrected before the first screenshot']
  ]));

  out.push(L.fig('v1.0-e-mobile', '<b>v1.0</b> at 420 pixels wide. The mode ' +
    'tabs wrap, the panels stack, and the cave is reachable without scrolling ' +
    'past the whole control panel.'));

  return out.join('\n');
};
