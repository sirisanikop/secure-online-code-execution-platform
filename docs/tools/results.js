// Reads real test results (pytest junit xml + vitest json) and aggregates them per SRS test-case id.
const fs = require("fs");
const S = __dirname + "/results";

const tc = {}; // "TC-AUTH-01" -> {pass, fail, names[]}
const add = (id, ok, name) => { const t = (tc[id] ||= { pass: 0, fail: 0, names: [] }); ok ? t.pass++ : t.fail++; t.names.push(name); };

const xml = fs.readFileSync(`${S}/junit.xml`, "utf8");
const suite = /<testsuite [^>]*?tests="(\d+)"[^>]*?time="([\d.]+)"/.exec(xml);
const pyTotal = +suite[1], pySeconds = +suite[2];
const re = /<testcase ([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/g;
let m;
while ((m = re.exec(xml))) {
  const name = / name="([^"]+)"/.exec(m[1])[1];
  const failed = m[3] && /<(failure|error)/.test(m[3]);
  const id = /TC_([A-Z]+)_(\d+)/.exec(name);
  if (id) add(`TC-${id[1]}-${id[2]}`, !failed, name);
}
const vt = JSON.parse(fs.readFileSync(`${S}/vitest.json`, "utf8"));
for (const f of vt.testResults) for (const a of f.assertionResults) {
  const id = /TC-([A-Z]+)-(\d+)/.exec(a.title);
  if (id) add(`TC-${id[1]}-${id[2]}`, a.status === "passed", a.title);
}
// manual / non-automated cases, recorded honestly
const manual = {
  "TC-MNT-01": { status: "Passed", note: "Executed manually: fresh venv + requirements install in an empty folder, then auth/execution suites run (18 passed); npm install/build/test and server start verified per HOW_TO_RUN.md." },
  "TC-UX-01": { status: "Not executed", note: "Requires 3 human participants for a timed walkthrough; not performed by the development team yet." },
};
function status(id) {
  if (manual[id]) return manual[id].status;
  const t = tc[id];
  if (!t) return "No result";
  return t.fail ? "Failed" : "Passed";
}
module.exports = { tc, status, manual, pyTotal, pySeconds, vtTotal: vt.numTotalTests, vtPassed: vt.numPassedTests };
