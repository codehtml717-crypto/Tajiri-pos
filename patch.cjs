const fs = require("fs");
let s = fs.readFileSync("app.js", "utf8");
let applied = 0;
function rep(find, replace, label) {
  if (s.includes(find)) { s = s.replace(find, replace); applied++; }
  else console.error("NOT FOUND: " + label);
}

/* 1. Show the signed-in user's full name in the top bar */
rep(
`  const staffButton = document.querySelector("#staffButton");
  if (staffButton) staffButton.innerHTML = \`\${currentUser ? currentUser.name : "Not signed in"} <span>⚙</span>\`;`,
`  const staffButton = document.querySelector("#staffButton");
  if (staffButton) staffButton.innerHTML = \`\${currentUser ? currentUser.name : "Not signed in"} <span>⚙</span>\`;
  const userName = document.querySelector("#userName");
  if (userName) {
    userName.textContent = currentUser ? currentUser.name.trim() : "";
  }`,
"userName display");

/* 2. Hook cloud sync into saveState */
rep(
`      users, salesLog, expenses, purchaseOrders, pendingMpesa, loyaltyBalance, cashBook, productsStock: products.map(p => ({ id: p.id, stock: p.stock })), settings
    }));
  } catch (e) { /* storage unavailable — stay in-memory */ }
}`,
`      users, salesLog, expenses, purchaseOrders, pendingMpesa, loyaltyBalance, cashBook, productsStock: products.map(p => ({ id: p.id, stock: p.stock })), settings
    }));
    queueCloudSync();
  } catch (e) { /* storage unavailable — stay in-memory */ }
}

/* ---------- Cloud backup (Firestore) ---------- */
/* Data is pushed to the "tajiri/backup" Firestore document whenever saveState()
   runs (debounced 4s), and restored on boot if the local copy is missing — e.g.
   after reinstalling or moving to a new device. Passwords are only ever stored
   as SHA-256 hashes, never in plain text. */
let cloudSyncTimer = null;
let cloudSyncBusy = false;

function cloudSyncAvailable() {
  return Boolean(window.firebaseDb && settings.cloudBackup && navigator.onLine);
}

function queueCloudSync() {
  if (!cloudSyncAvailable()) return;
  clearTimeout(cloudSyncTimer);
  cloudSyncTimer = setTimeout(performCloudSync, 4000);
}

async function performCloudSync() {
  if (!cloudSyncAvailable() || cloudSyncBusy) return;
  cloudSyncBusy = true;
  try {
    await window.firebaseDb.collection("tajiri").doc("backup").set({
      updatedAt: Date.now(),
      users,
      salesLog,
      expenses,
      purchaseOrders,
      pendingMpesa,
      loyaltyBalance,
      cashBook,
      productsStock: products.map(p => ({ id: p.id, stock: p.stock })),
      settings
    });
    localStorage.setItem("tajiri-last-cloud-sync", String(Date.now()));
    const sync = document.querySelector("#syncStatus");
    if (sync) sync.textContent = "Cloud synced";
  } catch (e) {
    console.warn("Cloud backup failed:", e);
    showToast("Cloud backup failed — data stays safe locally");
  } finally {
    cloudSyncBusy = false;
  }
}

async function restoreFromCloudIfLocalEmpty() {
  if (!window.firebaseDb) return false;
  try {
    const snapshot = await window.firebaseDb.collection("tajiri").doc("backup").get();
    if (!snapshot.exists) return false;
    const data = snapshot.data();
    if (!data || !Array.isArray(data.users) || !data.users.length) return false;
    users = data.users;
    salesLog = data.salesLog || [];
    expenses = data.expenses || [];
    purchaseOrders = data.purchaseOrders || [];
    pendingMpesa = data.pendingMpesa || [];
    loyaltyBalance = data.loyaltyBalance || 0;
    cashBook = data.cashBook || [];
    Object.assign(settings, data.settings || {});
    (data.productsStock || []).forEach(st => {
      const product = products.find(p => p.id === st.id);
      if (product) product.stock = st.stock;
    });
    try {
      localStorage.setItem("tajiri-pos", JSON.stringify({
        users, salesLog, expenses, purchaseOrders, pendingMpesa, loyaltyBalance, cashBook, productsStock: data.productsStock || [], settings
      }));
    } catch (e) { /* storage unavailable — stay in-memory */ }
    return true;
  } catch (e) {
    console.warn("Cloud restore skipped:", e);
    return false;
  }
}`,
"cloud backup block");

/* 3. Boot: applyRole for the header name + cloud restore for fresh devices */
rep(
`if (!currentUser) {
  showStaffLogin();
} else {
  renderAllPanels();
  renderProducts();
  renderCart();
  renderSalesStockPulse();
}`,
`if (!currentUser) {
  showStaffLogin();
} else {
  renderAllPanels();
  renderProducts();
  renderCart();
  renderSalesStockPulse();
}
applyRole();

/* Cloud: pull data into a fresh/empty device, then keep it in sync. */
(async () => {
  if (!window.firebaseDb) return;
  try {
    const snapshot = await window.firebaseDb.collection("tajiri").doc("backup").get();
    if (!localStorage.getItem("tajiri-pos") && snapshot.exists) {
      const restored = await restoreFromCloudIfLocalEmpty();
      if (restored) {
        loadState();
        renderAllPanels();
        renderProducts();
        renderCart();
        renderSalesStockPulse();
        applyRole();
        showToast("Data restored from cloud backup");
      }
    }
    if (settings.cloudBackup && navigator.onLine) performCloudSync();
  } catch (e) {
    console.warn("Cloud boot sync skipped:", e);
  }
})();`,
"boot cloud hook");

fs.writeFileSync("app.js", s, "utf8");
console.log("applied:", applied, "/3");
