// Run the real TypeScript helpers without adding a test runner dependency.
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const assert = require("node:assert/strict");
const ts = require("typescript");
function load(file) {
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(compiled, { exports, require: (name) => {
    if (name === "@/lib/format") return load("src/lib/format.ts");
    if (name === "@/lib/commission") return load("src/lib/commission.ts");
    if (name === "@/components/ui/form-dialog") return load("src/components/ui/form-dialog.tsx");
    if (name.startsWith("@/")) throw new Error(`Unexpected dependency: ${name}`);
    return require(name);
  } });
  return exports;
}
const { commissionError, commissionValue, commissionLabel } = load("src/lib/commission.ts");
assert.equal(commissionValue({ commissionAmount: 300000 }, 10000000), 300000);
assert.equal(commissionValue({ commissionAmount: 300000 }, 20000000), 300000);
assert.equal(commissionValue({ commissionPct: 5 }, 10000000), 500000);
assert.equal(commissionValue({ commissionPct: 5 }, 20000000), 1000000);
assert.equal(commissionValue({ commissionAmount: 0 }, 20000000), 0);
assert.match(commissionLabel({ commissionAmount: 300000 }), /300\.000.*fijos/);
assert.match(commissionLabel({ commissionPct: 5 }), /5% sobre la venta/);
assert.ok(commissionError("percentage", "1000"));
assert.equal(commissionError("fixed", "1000"), null);
assert.ok(commissionError("fixed", "1000.5"));
assert.ok(commissionError("fixed", "-1"));
console.log("Commission calculation, labels and validation: OK");

const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { CommissionInput } = load("src/components/acquisitions/commission-input.tsx");
function render(type, value) {
  return renderToStaticMarkup(React.createElement(CommissionInput, { type, value, onTypeChange() {}, onChange() {} }));
}
const fixed = render("fixed", "300000");
assert.match(fixed, /Comisión fija \(CLP\)/);
assert.match(fixed, /step="1"/);
assert.doesNotMatch(fixed, /max="100"/);
assert.doesNotMatch(fixed, /role="alert"/);
const percentage = render("percentage", "1000");
assert.match(percentage, /max="100"/);
assert.match(percentage, /role="alert"/);
assert.match(percentage, /selecciona Monto fijo/);
console.log("Commission input: fixed fee accepts pesos; percentage explains invalid values: OK");
