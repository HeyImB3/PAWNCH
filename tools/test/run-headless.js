'use strict';
// Headless test runner for macOS JavaScriptCore:
//   osascript -l JavaScript tools/test/run-headless.js "$PWD"
// Runs the same *.test.js suites as tools/test/index.html with no browser and
// no Node, so the suite has a shell-detectable pass/fail and exit code.
// JavaScriptCore runs classic scripts, so every ESM source has its import lines
// and leading `export ` removed and is concatenated into ONE script that is
// eval'd in a single scope — this keeps cross-file `const`/`class` bindings
// (e.g. SIM, FixedStep) visible to each other, which separate evals do not.
// Exit 0 = all passed; non-zero = a failure (named in the output).
ObjC.import('Foundation');

function read(root, rel) {
  var s = $.NSString.stringWithContentsOfFileEncodingError(root + '/' + rel, $.NSUTF8StringEncoding, null);
  var js = ObjC.unwrap(s);
  if (typeof js !== 'string') throw new Error('cannot read ' + rel);
  return js;
}

function strip(src) {
  return src
    .replace(/^\s*import\s[\s\S]*?from\s*['"][^'"]+['"];?\s*$/mg, '')
    .replace(/^\s*import\s*['"][^'"]+['"];?\s*$/mg, '')
    .replace(/^export\s+/mg, '');
}

// The assert API (mirrors tools/test/runner.js), as a source prefix so it shares
// the single eval scope with the loaded tests.
var FRAMEWORK = [
  "var __tests = [], __suite = '';",
  "function suite(n){ __suite = n; }",
  "function test(n,f){ __tests.push({ n:(__suite?__suite+' \\u203a ':'')+n, f:f }); }",
  "function assert(c,m){ if(!c) throw new Error(m||'assertion failed'); }",
  "function assertEqual(a,e,m){ if(a!==e) throw new Error((m||'not equal')+': expected '+e+', got '+a); }",
  "function assertDeepEqual(a,e,m){ if(JSON.stringify(a)!==JSON.stringify(e)) throw new Error((m||'not deep-equal')+': expected '+JSON.stringify(e)+', got '+JSON.stringify(a)); }",
  "function assertThrows(f,m){ var t=false; try{f();}catch(e){t=true;} if(!t) throw new Error(m||'expected function to throw'); }",
].join('\n');

// Load order: config + dependency-free modules first, then dependents, then the
// test files. KEEP IN SYNC with tools/test/index.html's import list.
var MODULES = [
  'src/config.js',
  'src/sim/rng.js',
  'src/sim/hash.js',
  'src/sim/clock.js',
];
var TESTS = [
  'tools/test/runner.test.js',
  'src/sim/rng.test.js',
  'src/sim/hash.test.js',
  'src/sim/clock.test.js',
];

var EPILOGUE = [
  "var __p=0,__f=0,__fails=[];",
  "__tests.forEach(function(t){ try{ t.f(); __p++; }catch(e){ __f++; __fails.push(t.n+' \\u2014 '+(e&&e.message?e.message:e)); } });",
  "console.log('[TESTS] '+__p+' passed, '+__f+' failed');",
  "__fails.forEach(function(x){ console.log('  FAIL '+x); });",
  "if(__f>0) throw new Error(__f+' test(s) failed');",
].join('\n');

// osascript -l JavaScript calls run(argv) automatically — this is the entry point.
function run(argv) {
  var root = (argv && argv[0]) || ObjC.unwrap($.NSFileManager.defaultManager.currentDirectoryPath);
  var parts = [FRAMEWORK];
  MODULES.forEach(function (m) { parts.push(strip(read(root, m))); });
  TESTS.forEach(function (t) { parts.push(strip(read(root, t))); });
  parts.push(EPILOGUE);
  (0, eval)(parts.join('\n;\n'));
  return '';
}
