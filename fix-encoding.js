// One-off: repair double-encoded characters in the business tests, then delete this file.
const fs = require("fs");
const p = "__tests__/app.business.test.js";
const bytes = fs.readFileSync(p);
let s = bytes.toString("latin1"); // byte-level view

// c3 82 c2 b7 -> c2 b7  (double-encoded ·)
s = s.replace(/\u00c3\u0082\u00c2\u00b7/g, "\u00c2\u00b7");
// c3 83 e2 80 94 (a? followed by em dash bytes) -> e2 80 94
s = s.replace(/\u00c3\u0083\u00e2\u0080\u0094/g, "\u00e2\u0080\u0094");

fs.writeFileSync(p, Buffer.from(s, "latin1"));
console.log("fixed");
