/* Report sections 6-9 and the source appendix. */

const L = require('./report-lib');

module.exports = function (cfg) {
  const out = [];

  /* ============================ 6 ============================ */
  out.push('<h1>6. Engineering Decisions and Corrections</h1>');
  out.push('<p class="lede">Problems that crossed several versions, or whose ' +
    'resolution shaped the architecture. Section 5 records what each version ' +
    'added; this section records what had to be rethought.</p>');

  out.push('<h2>6.1 Recording the search instead of running it live</h2>');
  out.push('<p>Every algorithm on the site returns the same thing: a flat array ' +
    'of steps, each holding a complete snapshot of the stack, the visited set, ' +
    'the current chamber and a sentence describing the action. Nothing is ' +
    'computed during playback.</p>');
  out.push(L.table(['Consequence', 'Why it mattered'], [
    ['Stepping backwards is free', 'A live implementation would need an undo ' +
      'log, which is the same snapshots stored less conveniently'],
    ['Any step is directly reachable', 'The student can click a line in the dive ' +
      'log and jump to that moment'],
    ['Algorithms contain no drawing code', 'search.js reads like the lecture ' +
      'notes rather than like a rendering engine'],
    ['Three algorithms share one renderer', 'BFS and IDS needed no new drawing ' +
      'code, only a frontier field on the step']
  ]));
  out.push('<p>The cost is memory: a 364-chamber cave produces several hundred ' +
    'steps, each carrying copies of its arrays. At these sizes it is irrelevant, ' +
    'and the cap described in Section 6.6 keeps it that way.</p>');

  out.push('<h2>6.2 Only repaint what changed</h2>');
  out.push('<p>The first renderer rewrote the class attribute of every chamber ' +
    'on every step. With the endless passage enabled a cave can hold over 1,200 ' +
    'chambers, which meant 1,200 attribute writes per frame at up to thirty ' +
    'frames a second, and playback visibly stuttered.</p>');
  out.push(L.code('site/js/cave.js &mdash; comparing before writing',
    L.slice(L.fileAt('v1.0', 'site/js/cave.js'),
      '// Only touch the chambers whose appearance', 'var lit = {};')));
  out.push('<p>The same treatment was applied to passages. The fix is ordinary, ' +
    'but it is worth recording that the need for it came directly from an ' +
    'earlier teaching decision: the shaft had to be long to be honest, and ' +
    'making it long is what exposed the performance fault.</p>');

  out.push('<h2>6.3 CSS silently overriding scaled geometry</h2>');
  out.push(L.think([
    'Chambers shrink as caves grow, so stroke widths are calculated in ' +
    'JavaScript and written as SVG presentation attributes. The stylesheet also ' +
    'set stroke-width for the same elements.',
    'CSS wins over presentation attributes. Every calculated width was therefore ' +
    'being discarded, and passages in a 364-chamber cave were drawn at the same ' +
    'thickness as in a six-chamber one, swamping the chambers entirely. Nothing ' +
    'errored; the drawing was simply wrong in a way that looked like a layout ' +
    'problem.',
    'The rule adopted was that the stylesheet carries colour only, and geometry ' +
    'that must scale is set in script. The same mistake had been made with the ' +
    'chamber label font size and was corrected at the same time.'
  ], 'A bug with no error message'));

  out.push('<h2>6.4 Sizing a drawing whose shape varies enormously</h2>');
  out.push('<p>This took three attempts and is the clearest example in the ' +
    'project of a first answer being plausible and wrong.</p>');

  out.push('<h3>Attempt 1: fixed spacing with a minimum scale</h3>');
  out.push('<p>Horizontal spacing was chosen from the total chamber count, and ' +
    'the drawing was never scaled below 42 per cent. A tree with b = 3 and ' +
    'm = 5 has 243 leaves and only 5 levels, so it is roughly forty times wider ' +
    'than it is tall. It overflowed the frame and was cut off.</p>');

  out.push('<h3>Attempt 2: always fit the width</h3>');
  out.push('<p>Removing the minimum scale made the whole tree fit, at about 14 ' +
    'per cent, which compressed 290 pixels of height into 41. The cave became an ' +
    'unreadable thread across the middle of an otherwise empty panel. The first ' +
    'fix had produced a worse result than the fault.</p>');

  out.push('<h3>Attempt 3: size from the leaf count, then allow scrolling</h3>');
  out.push(L.think([
    'The error in both earlier attempts was choosing horizontal spacing from the ' +
    'total number of chambers. The quantity that actually determines a tree’s ' +
    'width is its number of <b>leaves</b>, and that is not known until columns ' +
    'have been assigned.',
    'The layout was reordered: assign columns first, count the leaves, then ' +
    'choose spacing from that count, then compute positions. Vertical spacing ' +
    'was fixed at a comfortable value, since depth is capped at eight and ' +
    'vertical room is never the scarce resource.',
    'A minimum scale was reinstated, because the honest answer is that some ' +
    'caves are genuinely too wide for the panel. Those scroll sideways, and the ' +
    'view follows the diver automatically so the student never has to manage ' +
    'the scrollbar.'
  ], 'Measuring the right thing'));

  out.push(L.code('site/js/graph.js &mdash; columns first, then spacing',
    L.slice(L.fileAt('v1.0', 'site/js/graph.js'),
      '// Columns are assigned first', 'var padY = opts.padY'), { long: true }));

  out.push('<h2>6.5 The page that scrolled itself</h2>');
  out.push('<p>The dive log kept the current step in view with the browser’s ' +
    'standard scrollIntoView call. That method scrolls every scrollable ancestor, ' +
    'including the page, so during playback the whole document crept downwards ' +
    'and the cave left the screen. It was replaced with arithmetic on the log ' +
    'panel’s own scroll position.</p>');
  out.push(L.code('site/js/app.js',
    L.slice(L.fileAt('v1.0', 'site/js/app.js'),
      '// scrollIntoView would drag the whole page', '}')));

  out.push('<h2>6.6 Being explicit about simulation caps</h2>');
  out.push(L.think([
    'Two situations on the site cannot terminate: markers switched off, and the ' +
    'endless passage. Both are stopped by a step cap.',
    'A cap is a lie if the page presents the result as the algorithm finishing. ' +
    'The wording was written carefully so that it never does. With markers off ' +
    'the page says the dive was stopped because it was never going to end. With ' +
    'the endless passage it says that only the simulation ended, not the search. ' +
    'The caps live in one function alongside a comment stating that they are not ' +
    'part of the algorithm, so that a reader of the source is not misled either.',
    'This is a small point of intellectual honesty, but it is the difference ' +
    'between demonstrating incompleteness and merely appearing to.'
  ], 'A cap that pretends to be a result is a lie'));

  out.push(L.code('site/js/app.js &mdash; caps declared in one place',
    L.slice(L.fileAt('v1.0', 'site/js/app.js'),
      'function searchOptions()', null, { count: 15 })));

  /* ============================ 7 ============================ */
  out.push('<h1>7. Verification</h1>');

  out.push('<h2>7.1 The trace matches the lecture notes</h2>');
  out.push('<p>The course notes print a twelve-step trace of DFS over the ' +
    'A&ndash;F state space, giving for each step the current state, the action, ' +
    'the stack and the visited set. The implementation was required to reproduce ' +
    'it exactly. The table below is the output of the project code, captured ' +
    'from the running page.</p>');

  const run = (function () {
    const steps = [];
    const graph = { A: ['B', 'C'], B: ['D', 'E'], C: [], D: ['F'], E: [], F: [] };
    const stack = [], visited = [];
    stack.push('A'); visited.push('A');
    steps.push(['0', 'A', 'Visit A, Push A', '[A]', '{A}']);
    while (stack.length) {
      const cur = stack[stack.length - 1];
      const next = (graph[cur] || []).find((n) => visited.indexOf(n) === -1);
      if (next) {
        visited.push(next); stack.push(next);
        steps.push([String(steps.length), next,
          'From ' + cur + ', choose ' + next + '. Visit ' + next + ', Push ' + next,
          '[' + stack.join(', ') + ']',
          '{' + visited.slice().sort().join(', ') + '}']);
      } else {
        stack.pop();
        const back = stack[stack.length - 1];
        steps.push([String(steps.length), back || '&mdash;',
          back ? cur + ' has no unexplored actions. Pop ' + cur + ' and return to ' + back
               : cur + ' has no unexplored actions. Pop ' + cur + '. Search terminates.',
          '[' + stack.join(', ') + ']',
          '{' + visited.slice().sort().join(', ') + '}']);
      }
    }
    return steps;
  })();

  out.push(L.table(['Step', 'Current', 'Action', 'Stack', 'Visited'],
    run.map((r) => [r[0], r[1], r[2], '<span class="mono">' + r[3] + '</span>',
      '<span class="mono">' + r[4] + '</span>'])));

  out.push('<p>All twelve rows agree with the notes: the same current state, the ' +
    'same action, the same stack contents and the same visited set at every ' +
    'step. In particular the stack never exceeds four entries, confirming that ' +
    'the implementation follows the notes’ formulation in which the stack ' +
    'holds the current path rather than a frontier.</p>');

  out.push('<h2>7.2 The complexity figures match</h2>');
  out.push('<p>The notes work through b = 4, m = 20 and give 4<sup>20</sup> as ' +
    'approximately 1.1 trillion, against 20 states remembered. The ' +
    'site’s calculator produces the same figures from the same inputs.</p>');
  out.push(L.fig('v1.0-c-learn', 'The Learn page, whose complexity calculator ' +
    'was checked against the worked example in the notes.'));

  out.push('<h2>7.3 Automated checks during capture</h2>');
  out.push('<p>The screenshot tool records page errors and failed console ' +
    'messages for every shot, and can extract the text of a named element so ' +
    'that the state shown in an image is also asserted in the build log. This ' +
    'caught the disabled-button design fault described in Section 5.4, and ' +
    'verified each of the playground verdicts:</p>');
  out.push(L.table(['Condition', 'Verdict produced'], [
    ['Markers off', 'Stopped after 400 steps; the visited set is what makes the ' +
      'algorithm finish'],
    ['Endless passage', 'Stopped after 900 steps, diver 900 chambers down and ' +
      'still descending; the treasure a few chambers from the entrance was never ' +
      'reached'],
    ['b = 3, depth = 5, no treasure', '364 chambers entered, never more than 6 ' +
      'chambers of rope out'],
    ['b = 5, depth = 8', 'Not drawn: 488,281 chambers against 8 of rope'],
    ['DFS against BFS, shallow treasure', 'DFS 25 chambers and 5 rope; BFS 7 ' +
      'chambers and 7 ropes'],
    ['DFS against IDS', 'IDS 11 chambers across 3 restarts, never more than 3 ' +
      'of rope']
  ]));

  out.push('<h2>7.4 What was not verified</h2>');
  out.push('<p>Stated plainly, since a report claiming more than it checked ' +
    'would be worth less:</p>');
  out.push('<ul>' +
    '<li>There is no automated unit-test suite. Correctness rests on the trace ' +
    'comparison, the asserted verdict strings, and the absence of page errors ' +
    'during capture.</li>' +
    '<li>The site was tested in Chromium-based browsers only, via Edge. Firefox ' +
    'and Safari were not checked.</li>' +
    '<li>Screen-reader behaviour was not tested. The SVG carries labels and ' +
    'reduced-motion preferences are respected, but that is not the same as ' +
    'having been used with assistive technology.</li>' +
    '<li>Only the DFS-related pages of the 95-page lecture notes were read ' +
    'closely; the rest were keyword-searched.</li></ul>');

  /* ============================ 8 ============================ */
  out.push('<h1>8. Deployment</h1>');

  out.push('<h2>8.1 Hosting</h2>');
  out.push('<p>The site is served by GitHub Pages directly from the repository. ' +
    'There is no build step: the browser receives the files exactly as they are ' +
    'committed, which keeps the deployed artefact identical to the source and ' +
    'the hosting free and indefinite.</p>');
  out.push(L.table(['Item', 'Value'], [
    ['Live site', '<span class="mono">' + cfg.siteUrl + '</span>'],
    ['Repository', '<span class="mono">' + cfg.repoUrl + '</span>'],
    ['Hosting', 'GitHub Pages, served from the site folder on the main branch'],
    ['Build step', 'None'],
    ['Runtime dependencies', 'None']
  ]));

  out.push('<h2>8.2 Repository layout</h2>');
  out.push(L.code('', cfg.tree));

  out.push('<h2>8.3 Commit history</h2>');
  out.push('<p>Every commit is authored solely by the student. No co-author ' +
    'trailer was added and no collaborator was added to the GitHub project, as ' +
    'required by the brief.</p>');
  out.push(L.table(['Commit', 'Date', 'Subject'],
    L.gitLog().map((c) => ['<span class="mono">' + c.short + '</span>', c.date,
      c.subject])));

  /* ============================ 9 ============================ */
  out.push('<h1>9. Assessing the AI’s Contribution</h1>');
  out.push('<p class="lede">The brief states that the evaluation is of the ' +
    'thought process and the refinement, not of whether an AI can write a search ' +
    'algorithm. This section is therefore an honest account of what the ' +
    'assistant produced unaided, what had to be corrected, and where human ' +
    'direction changed the outcome.</p>');

  out.push('<h2>9.1 What the AI produced well without correction</h2>');
  out.push('<ul>' +
    '<li><b>The algorithm itself.</b> DFS, BFS and iterative deepening were ' +
    'correct on the first attempt, and the DFS trace matched the notes exactly ' +
    'without iteration.</li>' +
    '<li><b>Architecture.</b> Recording the search and replaying it, and keeping ' +
    'the algorithms free of drawing code, were decided up front and never needed ' +
    'revisiting. Adding two more algorithms in v0.5 required no renderer ' +
    'changes.</li>' +
    '<li><b>Reading the source material.</b> Extracting the notes when the PDF ' +
    'tooling was missing, finding the trace table image, and noticing that the ' +
    'professor’s formulation of the stack differs from the common textbook ' +
    'one.</li>' +
    '<li><b>Prose.</b> The in-game explanations were largely first-draft.</li>' +
    '</ul>');

  out.push('<h2>9.2 What the AI got wrong and had to correct</h2>');
  out.push(L.table(['Fault', 'Nature of the error'], [
    ['Endless passage only 60 chambers long',
      '<b>Conceptual.</b> The feature demonstrated the opposite of its purpose, ' +
      'and did so convincingly enough to pass a casual look.'],
    ['Backtrack button disabled when illegal',
      '<b>Pedagogical.</b> Correct interface convention, wrong for a teaching ' +
      'tool: it prevented the mistake instead of explaining it.'],
    ['Treasure visible through rock',
      '<b>Conceptual.</b> Quietly turned an uninformed search into an informed ' +
      'one.'],
    ['Markers-off still blocked cycles',
      '<b>Conceptual.</b> Implemented a cycle check rather than an absence of ' +
      'memory, so the control taught nothing.'],
    ['Layout sized from chamber count',
      '<b>Analytical.</b> Measured the wrong quantity, then produced a worse ' +
      'second attempt before fixing it properly.'],
    ['CSS overriding scaled stroke widths',
      '<b>Technical.</b> A silent cascade conflict with no error message.'],
    ['scrollIntoView scrolling the page',
      '<b>Technical.</b> A standard API with a wider effect than intended.'],
    ['Two corrupted CSS values',
      '<b>Generation.</b> Malformed output that would have failed silently; ' +
      'caught on review.'],
    ['Visited marker drawn over the chamber label',
      '<b>Visual.</b> Only became apparent once caves grew dense.']
  ]));

  out.push('<p>The pattern is worth naming. Almost none of these were algorithm ' +
    'errors, and most would have gone unnoticed by anyone not asking what each ' +
    'feature was supposed to teach. The failure mode of a capable assistant on a ' +
    'task like this is not broken code. It is code that works, looks finished, ' +
    'and quietly demonstrates the wrong thing.</p>');

  out.push('<h2>9.3 Where human direction mattered most</h2>');
  out.push('<p>Two instructions changed the project more than any amount of ' +
    'generation did.</p>');
  out.push('<p>The <b>cave diver metaphor</b> replaced a proposed warehouse ' +
    'robot. It is better because it is literally true rather than merely apt: ' +
    'divers really do lay guide lines and follow them out, so depth becomes an ' +
    'actual direction rather than a figure of speech.</p>');
  out.push('<p>The <b>TensorFlow Playground reference</b> changed the kind of ' +
    'thing being built. Without it the site would have been a well-made ' +
    'animation of DFS. With it, every claim in the notes became a control the ' +
    'student can switch off to watch the algorithm fail. That is the difference ' +
    'between being shown that DFS is not complete and breaking it yourself, and ' +
    'it accounts for the largest part of the site.</p>');

  out.push('<h2>9.4 What a further iteration would address</h2>');
  out.push('<ul>' +
    '<li>A unit-test suite over the three search engines, rather than relying on ' +
    'trace comparison and asserted strings.</li>' +
    '<li>Testing in Firefox and Safari.</li>' +
    '<li>Real assistive-technology testing; the cave is currently an image with ' +
    'a label rather than a navigable structure.</li>' +
    '<li>Uniform cost search and A*, which would complete the Module 1 ' +
    'progression the notes build towards.</li>' +
    '<li>Saving a student’s progress through the dive levels.</li></ul>');

  out.push('<h2>9.5 Conclusion</h2>');
  out.push('<p>The finished site teaches depth-first search three times over: by ' +
    'making the student perform it under the algorithm’s own constraint, by ' +
    'letting them dismantle it one property at a time, and by setting it against ' +
    'its alternatives. The implementation reproduces the lecture notes’ ' +
    'worked trace exactly, and the explanatory text is generated by the same ' +
    'engine that runs the game.</p>');
  out.push('<p>The most useful thing learned in building it was that the ' +
    'assistant’s errors clustered in a single place: not in the algorithm, ' +
    'which was right immediately, but in whether each feature actually ' +
    'demonstrated what it claimed to. An endless passage that ends, a treasure ' +
    'visible through rock, a button that prevents the instructive mistake ' +
    '&mdash; each was working code that taught the wrong lesson. Finding those ' +
    'required asking of every feature not whether it worked, but what a student ' +
    'would conclude from it. That question, repeatedly asked, is most of the ' +
    'difference between the first output and this one.</p>');

  /* ============================ Appendix ============================ */
  out.push('<h1>Appendix A. Complete Source</h1>');
  out.push('<p class="lede">The full source of the site at ' +
    '<span class="vtag">v1.0</span>, as deployed. Reproduced from the ' +
    'repository.</p>');

  const files = [
    ['site/index.html', 'The page: four views in one document'],
    ['site/js/graph.js', 'Cave model, generation and tree layout'],
    ['site/js/search.js', 'DFS, BFS and iterative deepening'],
    ['site/js/cave.js', 'SVG renderer: rope, markers, fog of war'],
    ['site/js/dive.js', 'Dive mode and its levels'],
    ['site/js/race.js', 'Side-by-side comparison'],
    ['site/js/app.js', 'Playground, Learn page and mode switching'],
    ['site/css/styles.css', 'Visual language'],
    ['tools/shoot.js', 'Screenshot harness used for this report']
  ];

  files.forEach(function (f) {
    out.push('<h2>' + f[0] + '</h2>');
    out.push('<p>' + f[1] + '.</p>');
    out.push(L.code('', L.fileAt('v1.0', f[0]), { long: true }));
  });

  return out.join('\n');
};
