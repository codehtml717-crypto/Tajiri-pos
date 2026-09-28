const fs = require("fs");
let s = fs.readFileSync("welcome.js", "utf8");
if (!s.includes('function showToast(message, kind = ') || !/^\s*function showToast/m.test(s.replace(/(function \(\) \{[\s\S]*?\n  \}\)\(\);)/, ""))) {
  // We want a single top-level showToast. First remove any inner definition.
  const inner = /  \/\* ---------- toast ---------- \*\/\n  let toastTimer;\n  function showToast[\s\S]*?\n  \}\n/;
  if (inner.test(s)) s = s.replace(inner, "  /* showToast now lives at the top level (shared with modal/download handlers) */\n");
  const anchor = "(function () {";
  const block = `/* ---------- toast (shared by auth, modal and download handlers) ---------- */
let toastTimer;
function showToast(message, kind = "") {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.className = \`auth-toast show \${kind}\`.trim();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.className = "auth-toast";
  }, 2600);
}

`;
  if (s.includes(block)) {
    console.log("top-level showToast already present");
  } else {
    s = s.replace(anchor, block + anchor);
    fs.writeFileSync("welcome.js", s);
    console.log("inserted top-level showToast");
  }
} else {
  console.log("showToast already exists");
}
