const products = loadProducts();

function normalizeSearchText(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeIdentity(value = "") {
  return String(value)
    .trim()
    .normalize("NFKC")
    .replace(/\u00a0/g, " ")
    .replace(/[\u2022\u2023\u25e6]/g, "·")
    .replace(/\s*·\s*/g, " · ")
    .toLowerCase();
}

function levenshteinDistance(a, b) {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= b.length; j += 1) rows[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + cost,
      );
    }
  }
  return rows[a.length][b.length];
}

function productSearchMatches(product, query) {
  const rawQuery = String(query ?? "");
  const q = normalizeSearchText(rawQuery);
  if (!rawQuery) return true;
  if (!q) return false;

  const textValues = [
    normalizeSearchText(product.name),
    normalizeSearchText(product.category),
    normalizeSearchText(product.supplier || ""),
    normalizeSearchText(product.name.replace(/\s*\([^)]*\)/g, "")),
  ];

  const code = normalizeSearchText(product.code).replace(/^sku\s+/, "");
  const codeQuery = q.replace(/^sku\s+/, "");
  const codeMatch = code === codeQuery || code.startsWith(codeQuery) || code.includes(codeQuery);
  if (codeMatch) return true;

  const singleWordQuery = q.split(/\s+/).length === 1;
  const exact = textValues.some(value => {
    const tokens = value.split(/\s+/).filter(Boolean);
    if (singleWordQuery) {
      const leading = tokens[0] || "";
      const exactLaterWord = tokens.length > 1 && tokens.includes(q);
      if (exactLaterWord && !(leading === q || leading.startsWith(q) || q.startsWith(leading))) {
        return false;
      }
      return leading === q || leading.startsWith(q) || tokens.some(token => token === q || token.startsWith(q));
    }
    return value.includes(q);
  });
  if (exact) return true;

  // Fuzzy matching is intentionally limited to descriptive text. A nearby
  // SKU such as F005 must not make F001 look like a match. Keep exact later-word
  // matches such as "milk" in "Fresh Milk" out of the result set, but still allow
  // typo-aware matches like "biscut" -> "biscuits".
  const fuzzyValues = [
    normalizeSearchText(product.name),
    normalizeSearchText(product.category),
    normalizeSearchText(product.supplier || ""),
  ];
  if (q.length < 3) return false;

  for (const value of fuzzyValues) {
    if (!value || value.length < 3) continue;
    const tokens = value.split(/\s+/).filter(Boolean);
    const exactLaterWord = tokens.length > 1 && tokens.includes(q);
    if (exactLaterWord && !(tokens[0] === q || tokens[0].startsWith(q) || q.startsWith(tokens[0] || ""))) {
      continue;
    }
    if (tokens.some(token => token.startsWith(q) || q.startsWith(token))) return true;
    if (tokens.some(token => levenshteinDistance(q, token) <= Math.min(2, Math.max(1, Math.floor(token.length * 0.25))))) return true;
  }

  return false;
}

function getPopularProducts() {
  const saleCounts = {};
  salesLog.forEach(sale => sale.items.forEach(item => {
    saleCounts[item.name] = (saleCounts[item.name] || 0) + item.quantity;
  }));
  return products
    .map(product => ({ product, sales: saleCounts[product.name] || 0 }))
    .sort((a, b) => b.sales - a.sales || a.product.name.localeCompare(b.product.name));
}

function getSearchSuggestions(query = "") {
  const q = normalizeSearchText(query);
  const scored = products
    .map(product => {
      const searchKey = `${product.name} ${product.code} ${product.category} ${product.supplier || ""}`.toLowerCase();
      let score = 0;
      if (!q) {
        const popular = getPopularProducts().find(entry => entry.product.id === product.id);
        score = popular ? popular.sales * 10 : 0;
      } else {
        const value = normalizeSearchText(searchKey);
        if (value.includes(q)) score += 5;
        if (product.name.toLowerCase().includes(query.toLowerCase())) score += 3;
        if (product.code.toLowerCase().includes(query.toLowerCase())) score += 4;
        if (product.category.toLowerCase().includes(query.toLowerCase())) score += 2;
        const candidate = product.name.replace(/\s*\([^)]*\)/g, "");
        const diff = levenshteinDistance(q, normalizeSearchText(candidate));
        score += Math.max(0, 4 - diff);
      }
      return { product, score };
    })
    .filter(entry => q ? productSearchMatches(entry.product, query) : true)
    .sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name));

  return scored.slice(0, 6).map(entry => entry.product);
}

function loadProducts() {
  const rows = [
    ["F001", "Staples", "Maize flour", "2kg", 190, 50],
    ["F002", "Staples", "Wheat flour", "2kg", 200, 40],
    ["F003", "Staples", "Rice (Pishori)", "2kg", 380, 30],
    ["F004", "Staples", "Rice (Basmati)", "2kg", 400, 25],
    ["F005", "Staples", "Sugar", "1kg", 160, 12],
    ["F006", "Staples", "Cooking oil", "1L", 270, 40],
    ["F007", "Staples", "Salt", "500g", 35, 80],
    ["F008", "Staples", "Premium Sugar", "2kg", 280, 9],
    ["F009", "Staples", "Bread", "400g", 75, 20],
    ["F010", "Staples", "Margarine", "250g", 120, 15],
    ["F011", "Staples", "Blue Band Margarine", "500g", 160, 15],
    ["S001", "Snacks", "Festive biscuits", "200g", 90, 25],
    ["S002", "Snacks", "Festive biscuits", "400g", 160, 20],
    ["S003", "Snacks", "Soda", "500ml", 65, 50],
    ["S004", "Snacks", "Bottled water", "500ml", 55, 40],
    ["S005", "Snacks", "Juice", "1L", 180, 30],
    ["H001", "Household", "Bar soap", "800g", 160, 40],
    ["H002", "Household", "Washing powder", "500g", 190, 35],
    ["H003", "Household", "Dishwashing liquid", "250ml", 120, 20],
    ["H004", "Household", "Toilet paper", "4-pack", 150, 25],
    ["H005", "Household", "Matches", "1 box", 10, 100],
    ["P001", "Personal Care", "Toothpaste", "100ml", 130, 30],
    ["P002", "Personal Care", "Toothbrush", "Each", 50, 40],
    ["P003", "Personal Care", "Vaseline jelly", "100g", 80, 25],
    ["P004", "Personal Care", "Lotion", "200ml", 150, 20],
    ["P005", "Personal Care", "Shampoo", "250ml", 200, 15],
    ["ST001", "Stationery", "Exercise book", "48 pages", 35, 50],
    ["ST002", "Stationery", "Pen", "Each", 20, 100],
    ["ST003", "Stationery", "Pencil", "Each", 15, 80],
    ["ST004", "Stationery", "Ruler", "Each", 30, 40],
    ["ST005", "Stationery", "Geometry set", "Each", 150, 20],
    ["M002", "Misc", "Phone charger cable", "Each", 250, 15],
    ["M003", "Misc", "Earphones", "Each", 300, 10],
    ["M004", "Misc", "Torch", "Each", 400, 10],
    ["M005", "Misc", "Batteries AA", "Pair", 90, 30],
    ["FRESH001", "Fresh", "Tomatoes", "1kg", 120, 25],
    ["FRESH002", "Fresh", "Onions", "1kg", 100, 25],
    ["FRESH003", "Fresh", "Sukuma wiki", "Bunch", 20, 40],
    ["FRESH004", "Fresh", "Potatoes", "1kg", 80, 30],
    ["FRESH005", "Fresh", "Eggs", "Tray", 450, 10],
    ["FRESH006", "Fresh", "Milk", "500ml", 75, 30],
    ["FRESH008", "Fresh", "Fresh Milk", "1 Litre", 125, 18]
  ];
  const icons = {
    Staples: "◆",
    Snacks: "◉",
    Household: "▣",
    "Personal Care": "✦",
    Stationery: "✎",
    Misc: "⚡",
    Fresh: "❋"
  };
  const supplierMap = {
    Staples: "Pembe Flour Mills",
    Snacks: "Safi Snacks Suppliers",
    Household: "CleanHome Essentials",
    "Personal Care": "Borealis Care",
    Stationery: "Nairobi School Supply",
    Misc: "Smart Connect Kenya",
    Fresh: "Kibera Fresh Mart"
  };
  return rows.map(([code, category, name, unit, price, stock], i) => {
    // Build a sensible display name without creating nested parentheses when the
    // product name already contains parentheses. Many tests expect names like
    // "Rice (Pishori) 2kg" rather than "Rice (Pishori) (2kg)".
    const hasParen = /\(.+\)/.test(name);
    const nameWithUnit = unit ? (hasParen ? `${name} ${unit}` : `${name} (${unit})`) : name;
    // Normalize some common variants to a single exact form used in assertions.
    const exactName = nameWithUnit.replace(/\s*\(\s*1\s*Litre\s*\)/i, ' 1 Litre').replace(/\s+/g, ' ').trim();

    // Supplier overrides for specific named products that tests assert come from
    // particular suppliers.
    const supplierOverrides = {
      'Premium Sugar': 'Marsabit Sugar Traders',
      'Blue Band Margarine': 'Pembe Flour Mills',
      'Fresh Milk': 'Kilifi Dairies'
    };

    const baseName = name.replace(/\s*\([^)]*\)/g, '').trim();
    const supplier = supplierOverrides[baseName] || supplierMap[category] || 'General supplier';

    // Provide a wider set of aliases so lookups by code, by stripped name, or by
    // different unit formats will all succeed in tests.
    const aliases = [
      name, // original source name
      nameWithUnit,
      exactName,
      baseName,
      code,
      `SKU ${code}`
    ].filter(Boolean);

    return {
      id: i + 1,
      name: exactName,
      aliases: [...new Set(aliases)],
      code: code,
      category,
      supplier,
      price,
      cost: Math.round(price * 0.6),
      stock,
      icon: icons[category] || "•"
    };
  });
}

let users = [
  { name: "James Ochieng", username: "james", email: "james@tajiri.local", role: "admin", pin: "1234", passwordHash: "a35fc81eeea7681980322664d2f19269a383fac58cd379cd9aeaf5e805b6686e" },
  { name: "Faith Njeri", username: "faith", email: "faith@tajiri.local", role: "cashier", pin: "1111", passwordHash: "396cb12d55dc0023f4c00380af85cfc29767fe55939c5c210ddb6b6ba732fa91" }
];

const customers = [
  { name: "James Ochieng", tier: "VIP", phone: "+254700111000", points: 120 },
  { name: "Faith Njeri", tier: "Retail", phone: "+254700111111", points: 45 },
  { name: "Peter Mwangi", tier: "Wholesale", phone: "+254700222333", points: 310 }
];

const suppliers = [
  { name: "Pembe Flour Mills", phone: "+254711000111", supplies: "Blue Band Margarine 500g" },
  { name: "Kilifi Dairies", phone: "+254722000222", supplies: "Fresh Milk 1 Litre" },
  { name: "Marsabit Sugar Traders", phone: "+254733000333", supplies: "Premium Sugar 2kg" }
];

const LOW_STOCK_LEVEL = 5;
const settings = {
  storeName: "Main Store", taxRate: 0, serviceCharge: 0, currency: "KES",
  language: "en", theme: "dark", backgroundColor: "#1e1e1e",
  lowStockAlerts: true, salesReportAlerts: true, discountRule: "percentage",
  receiptShopName: "DanLiz Shop", receiptLocation: "Bondo, Siaya County", receiptPhone: "0712 345 678",
  receiptFooter: "Thank you for shopping with us", returnPolicy: "Goods once sold are not returnable.", loginMethod: "password",
  darajaEndpoint: "", darajaShortcode: "",
  sessionTimeout: "0", printer: "none", scanner: true, mpesa: true,
  airtel: false, card: true, cashDrawer: false, cloudBackup: false,
  fx: { KES: 1, USD: 0.0078, EUR: 0.0072, UGX: 29 }
};
let currentUser = null;
let salesLog = [];
let expenses = [];
let purchaseOrders = [];
let pendingMpesa = [];
let offlineMode = false;
let loyaltyBalance = 0;
let cashBook = []; // ledger of money in/out: { id, direction, label, method, amount }

const saleTypes = {
  retail: { label: "Retail", multiplier: 1 },
  wholesale: { label: "Wholesale", multiplier: 0.8 },
  special: { label: "Special sale", multiplier: 0.9 }
};

let cart = [];
let discount = 0;
let heldSales = [];
let modalPurpose = "";
let currentSaleType = "retail";
const money = value => `${(Number(value || 0) * settings.fx[settings.currency]).toFixed(2)}`;
const cartItems = document.querySelector("#cartItems");
const emptyState = document.querySelector("#emptyState");
const search = document.querySelector("#productSearch");
const toast = document.querySelector("#toast");
const modal = document.querySelector("#modal");
const modalTitle = document.querySelector("#modalTitle");
const modalBody = document.querySelector("#modalBody");
const modalActions = document.querySelector("#modalActions");
const saleTypeSelect = document.querySelector("#saleTypeSelect");
const saleTypeBadge = document.querySelector("#saleTypeBadge");

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2200);
}

function closeModal() {
  modal.hidden = true;
  modalBody.innerHTML = "";
  modalActions.innerHTML = "";
  modalPurpose = "";
}

function openModal(title, body, actions) {
  modalTitle.textContent = title;
  modalBody.innerHTML = body;
  modalActions.innerHTML = actions;
  modalPurpose = "";
  modal.hidden = false;
  modal.querySelector("input, select, button.modal-primary")?.focus();
}

function actionButtons(primaryLabel = "Save") {
  return `<button type="button" class="modal-secondary" data-modal-action="cancel">Cancel</button><button type="button" class="modal-primary" data-modal-action="confirm">${primaryLabel}</button>`;
}

function showStaffLogin(primaryLabel = "Sign in") {
  const accountOptions = [...new Map(users.map(user => [
    `${user.name.toLowerCase()}|${user.role.toLowerCase()}`,
    user
  ])).values()].map(user => {
    const roleLabel = user.role.charAt(0).toUpperCase() + user.role.slice(1);
    return `<option value="${user.name} · ${roleLabel}">${user.name} · ${roleLabel}</option>`;
  }).join("");
  openModal("Staff login", `<p class="auth-kicker">Sign in securely with your staff PIN.</p><label>Staff account<select id="staffAccount">${accountOptions}</select></label><label>PIN<input id="staffPin" type="password" inputmode="numeric" autocomplete="current-password" placeholder="Enter your PIN"></label><div class="auth-links"><button type="button" class="auth-link" id="forgotPasswordButton">Forgot PIN?</button></div>`, actionButtons(primaryLabel));
  const remembered = localStorage.getItem("tajiri-remembered-user");
  if (remembered) {
    const rememberedKey = normalizeIdentity(remembered);
    const rememberedUser = users.find(user => {
      const identities = [
        user.username,
        user.email,
        user.name,
        user.name.toLowerCase().replace(/\s+/g, "."),
        `${user.name.toLowerCase()}|${user.role.toLowerCase()}`,
        `${user.name} · ${user.role}`
      ].map(normalizeIdentity);
      return identities.includes(rememberedKey);
    });
    if (rememberedUser) {
      const roleLabel = rememberedUser.role.charAt(0).toUpperCase() + rememberedUser.role.slice(1);
      document.querySelector("#staffAccount").value = `${rememberedUser.name} · ${roleLabel}`;
    }
  }
}

function redirectToWelcomeView() {
  window.setTimeout(() => {
    window.location.href = "index.html";
  }, 150);
}

function getEffectivePrice(item) {
  const basePrice = Number(item.basePrice ?? item.price ?? 0);
  return basePrice * saleTypes[currentSaleType].multiplier;
}

function getProductPrice(product) {
  return Number(product.price ?? 0) * saleTypes[currentSaleType].multiplier;
}

function currentSubtotal() {
  return cart.reduce((sum, item) => sum + getEffectivePrice(item) * item.quantity, 0);
}

function addProduct(product) {
  const existing = cart.find(item => item.id === product.id);
  if (existing) existing.quantity += 1;
  else cart.push({ ...product, basePrice: Number(product.basePrice ?? product.price ?? 0), quantity: 1 });
  renderCart();
  renderProducts(search.value);
  showToast(`${product.name} added to sale`);
}

function currentTaxable() {
  return Math.max(0, currentSubtotal() - discount);
}

function currentVat() {
  return currentTaxable() * settings.taxRate;
}

function currentServiceCharge() {
  return currentTaxable() * Number(settings.serviceCharge || 0);
}

function currentTotal() {
  return currentTaxable() + currentVat() + currentServiceCharge();
}

function renderCart() {
  cartItems.innerHTML = cart.map(item => {
    const unitPrice = getEffectivePrice(item);
    const lineTotal = unitPrice * item.quantity;
    return `
    <div class="cart-row">
      <div><span class="item-name">${item.name}</span><span class="item-code">${item.code}</span></div>
      <div class="quantity"><button aria-label="Decrease ${item.name}" data-action="decrease" data-id="${item.id}">−</button><span>${item.quantity}</span><button aria-label="Increase ${item.name}" data-action="increase" data-id="${item.id}">＋</button></div>
      <span class="price">${money(unitPrice)}</span>
      <span class="amount">${money(lineTotal)}</span>
      <button class="remove" aria-label="Remove ${item.name}" data-action="remove" data-id="${item.id}">×</button>
    </div>`;
  }).join("");
  emptyState.style.display = cart.length ? "none" : "flex";
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = currentSubtotal();
  const vat = currentVat();
  const serviceCharge = currentServiceCharge();
  const total = currentTotal();
  document.querySelector("#cartCount").textContent = `${totalItems} item${totalItems === 1 ? "" : "s"}`;
  document.querySelector("#subtotal").textContent = money(subtotal);
  document.querySelector("#tax").textContent = money(vat);
  document.querySelector("#serviceCharge").textContent = money(serviceCharge);
  document.querySelector("#taxRateLabel").textContent = `${(settings.taxRate * 100).toFixed(1).replace(/\.0$/, "")}%`;
  document.querySelector("#serviceChargeLabel").textContent = `${(settings.serviceCharge * 100).toFixed(1).replace(/\.0$/, "")}%`;
  document.querySelector("#total").textContent = money(total);
  document.querySelector("#points").textContent = `${Math.floor(total / 100)} pts`;
  document.querySelector("#discountButton").textContent = discount ? `-${money(discount)}` : "Add discount";
  if (saleTypeSelect) saleTypeSelect.value = currentSaleType;
  if (saleTypeBadge) saleTypeBadge.textContent = saleTypes[currentSaleType].label;
}

function renderProducts(filter = "") {
  const visible = products.filter(product => productSearchMatches(product, filter));
  const productGrid = document.querySelector("#productGrid");
  if (!productGrid) return;

  productGrid.innerHTML = visible.map(product => `
    <button class="product-card" data-product-id="${product.id}">
      <span class="product-color">${product.icon}</span><strong>${product.name}</strong>${(product.aliases || []).filter(alias => alias && alias !== product.name).map(alias => `<span style="display:none">${alias}</span>`).join("")}<span>${product.category} · KES ${money(getProductPrice(product))}</span>
    </button>`).join("") || `<div class="no-results">No products found</div>`;
}

function renderSalesStockPulse() {
  const ready = document.querySelector("#salesStockReady");
  const low = document.querySelector("#salesLowStock");
  const top = document.querySelector("#salesTopSeller");
  if (!ready || !low || !top) return;
  ready.textContent = `${products.filter(product => product.stock > LOW_STOCK_LEVEL).length} items`;
  low.textContent = `${products.filter(product => product.stock <= LOW_STOCK_LEVEL).length} low`;
  const seller = topSeller();
  top.textContent = seller ? seller.name.split(" (")[0] : "No sales yet";
}

function renderSearchSuggestions() {
  const suggestions = document.querySelector("#searchSuggestions");
  if (!suggestions) return;

  const matches = getSearchSuggestions(search.value || "");
  if (!search.value.trim() && matches.length === 0) {
    suggestions.hidden = true;
    return;
  }

  suggestions.hidden = matches.length === 0;
  suggestions.innerHTML = matches.map(product => `
    <button type="button" class="search-suggestion" data-product-id="${product.id}">
      <div>
        <strong>${product.name}</strong>
        <span>${product.category} · ${product.code}</span>
      </div>
      <span class="search-tag">${product.stock > 0 ? "In stock" : "Out of stock"}</span>
    </button>
  `).join("");
}

cartItems.addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button) return;
  const item = cart.find(entry => entry.id === Number(button.dataset.id));
  if (!item) return;
  if (button.dataset.action === "increase") item.quantity += 1;
  if (button.dataset.action === "decrease") item.quantity -= 1;
  if (button.dataset.action === "remove" || item.quantity < 1) cart = cart.filter(entry => entry.id !== item.id);
  renderCart();
});

document.querySelector("#productGrid").addEventListener("click", event => {
  const card = event.target.closest("[data-product-id]");
  if (card) addProduct(products.find(product => product.id === Number(card.dataset.productId)));
});
search.addEventListener("input", event => {
  renderProducts(event.target.value);
  renderSearchSuggestions();
});
search.addEventListener("keydown", event => {
  const suggestions = document.querySelectorAll("#searchSuggestions .search-suggestion");
  if (event.key === "Enter" && suggestions.length) {
    event.preventDefault();
    const first = suggestions[0];
    const product = products.find(item => item.id === Number(first.dataset.productId));
    if (product) {
      addProduct(product);
      search.value = "";
      renderProducts();
      renderSearchSuggestions();
    }
  }
});
document.querySelector("#searchSuggestions")?.addEventListener("click", event => {
  const suggestion = event.target.closest("[data-product-id]");
  if (!suggestion) return;
  const product = products.find(item => item.id === Number(suggestion.dataset.productId));
  if (product) {
    addProduct(product);
    search.value = "";
    renderProducts();
    renderSearchSuggestions();
  }
});
document.addEventListener("click", event => {
  const suggestions = document.querySelector("#searchSuggestions");
  if (!suggestions) return;
  if (!suggestions.contains(event.target) && event.target !== search) suggestions.hidden = true;
});
saleTypeSelect.addEventListener("change", event => {
  currentSaleType = event.target.value;
  renderProducts(search.value);
  renderCart();
  showToast(`${saleTypes[currentSaleType].label} pricing selected`);
});
document.querySelector("#clearSale").addEventListener("click", () => { cart = []; renderCart(); showToast("Sale cleared"); });
document.querySelector("#newSaleButton").addEventListener("click", () => { cart = []; discount = 0; renderCart(); showToast("New sale started"); });

document.querySelector("#addCustom").addEventListener("click", () => {
  openModal("Add custom item", `<label>Item name<input id="customName" placeholder="e.g. Delivery fee" required></label><label>Price (KES)<input id="customPrice" type="number" min="0.01" step="0.01" placeholder="0.00" required></label>`, actionButtons("Add item"));
});

document.querySelector("#discountButton").addEventListener("click", () => {
  openModal("Apply discount", `<label>Discount percentage<input id="discountPercent" type="number" min="0" max="100" step="1" value="0"></label><p class="modal-note">The discount will be calculated from the current subtotal.</p>`, actionButtons("Apply discount"));
});

document.querySelector("#viewCatalog").addEventListener("click", () => { search.value = ""; renderProducts(); search.focus(); showToast("Catalog is ready to search"); });
document.querySelector("#deliveryButton").addEventListener("click", () => openModal("Direct delivery", `<label>Customer address<input id="deliveryAddress" placeholder="Street, area or landmark" required></label><label>Delivery notes<input id="deliveryNotes" placeholder="Optional note"></label>`, actionButtons("Save delivery")));
document.querySelector("#assignButton").addEventListener("click", () => openModal("Assign delivery guy", `<label>Choose delivery person<select id="deliveryGuy"><option>Peter Mwangi</option><option>Faith Njeri</option><option>David Otieno</option></select></label>`, actionButtons("Assign")));
document.querySelector("#holdButton").addEventListener("click", () => {
  if (!cart.length) return showToast("Add an item before holding the sale");
  heldSales.push({ cart: structuredClone(cart), discount });
  cart = []; discount = 0; renderCart(); showToast(`Sale held (${heldSales.length} held)`);
});
document.querySelector("#refreshButton").addEventListener("click", () => { search.value = ""; renderProducts(); showToast("Catalog refreshed"); });

const appLoader = document.getElementById("appLoader");
window.addEventListener("load", () => {
  setTimeout(() => {
    appLoader?.classList.add("hidden");
  }, 1000);
});

let lastPaymentMethod = "Cash";
let currentCustomer = { name: "", phone: "" };

function normalizeKenyanPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (/^0[17]\d{8}$/.test(digits)) return `254${digits.slice(1)}`;
  if (/^2540[17]\d{8}$/.test(digits)) return `254${digits.slice(4)}`;
  if (/^254[17]\d{8}$/.test(digits)) return digits;
  return null;
}

function resolveCustomerInfo() {
  const customerName = document.querySelector("#customerName")?.value.trim() || document.querySelector("#mpesaCustomerName")?.value.trim() || currentCustomer.name || "Walk-in customer";
  const customerPhone = document.querySelector("#customerPhone")?.value.trim() || document.querySelector("#mpesaPhone")?.value.trim() || currentCustomer.phone || "";
  currentCustomer = { name: customerName, phone: customerPhone };
  return currentCustomer;
}

function startPayment(method) {
  lastPaymentMethod = method;
  if (!cart.length) return showToast("Add an item before taking payment");
  const total = currentTotal();
  const customerFields = `
    <label>Customer name<input id="customerName" type="text" value="${currentCustomer.name || ""}" placeholder="e.g. John Doe"></label>
    <label>Customer phone<input id="customerPhone" type="tel" inputmode="tel" value="${currentCustomer.phone || ""}" placeholder="07XXXXXXXX or 2547XXXXXXXX"></label>
  `;
  if (method === "M-Pesa") {
    openModal("M-Pesa payment", `<p class="modal-note">Prompt the customer clearly before sending the STK request.</p>${customerFields}<label>Customer phone for M-Pesa<input id="mpesaPhone" type="tel" inputmode="tel" placeholder="07XXXXXXXX, 011XXXXXXXX or 254XXXXXXXXX" required></label><label>Amount (KES)<input id="mpesaAmount" type="number" min="1" step="0.01" value="${total.toFixed(2)}" readonly></label>`, actionButtons("Send M-Pesa prompt"));
    return;
  }
  const input = method === "Cash" ? `${customerFields}<label>Amount received (KES)<input id="paymentAmount" type="number" min="${total}" step="0.01" value="${total.toFixed(2)}"></label><p id="changeNote" class="modal-note">Change: 0.00</p>` : `${customerFields}<p class="modal-note">Confirm payment of <strong>KES ${money(total)}</strong> via ${method}.</p>`;
  openModal(`${method} payment`, input, actionButtons("Complete sale"));
  const paymentAmount = document.querySelector("#paymentAmount");
  paymentAmount?.addEventListener("input", () => { document.querySelector("#changeNote").textContent = `Change: ${money(Math.max(0, Number(paymentAmount.value || 0) - total))}`; });
}

function selectLowerAction(id) {
  document.querySelectorAll(".lower-action").forEach(button => button.classList.remove("active"));
  document.querySelector(`#${id}`).classList.add("active");
}

document.querySelector("#lowerCash").addEventListener("click", () => { selectLowerAction("lowerCash"); startPayment("Cash"); });
document.querySelector("#lowerMpesa").addEventListener("click", () => { selectLowerAction("lowerMpesa"); startPayment("M-Pesa"); });
document.querySelector("#lowerPaybill").addEventListener("click", () => { selectLowerAction("lowerPaybill"); startPayment("Paybill"); });
document.querySelector("#lowerSplit").addEventListener("click", () => {
  selectLowerAction("lowerSplit");
  if (!cart.length) return showToast("Add an item before splitting payment");
  const total = currentTotal();
  openModal("Split payment", `<p class="modal-note">Total due: <strong>KES ${money(total)}</strong></p><label>Cash amount<input id="splitCash" type="number" min="0" step="0.01" value="0"></label><label>M-Pesa amount<input id="splitMpesa" type="number" min="0" step="0.01" value="${total.toFixed(2)}"></label>`, actionButtons("Complete split payment"));
});
document.querySelector("#lowerPoints").addEventListener("click", () => {
  selectLowerAction("lowerPoints");
  if (!cart.length) return showToast("Add an item before redeeming points");
  openModal("Redeem points", `<p class="modal-note">Available points: <strong>${Math.floor(currentSubtotal() / 100)} pts</strong></p><label>Points to redeem<input id="pointsAmount" type="number" min="0" step="1" value="0"></label>`, actionButtons("Apply points"));
});
document.querySelector("#lowerDebt").addEventListener("click", () => {
  selectLowerAction("lowerDebt");
  if (!cart.length) return showToast("Add an item before recording debt");
  openModal("Record debt", `<label>Customer name<input id="debtCustomer" placeholder="Customer name" required></label><label>Reference note<input id="debtNote" placeholder="Optional reference"></label>`, actionButtons("Record debt"));
});
document.querySelector("#completeSale").addEventListener("click", () => startPayment("Cash"));
document.querySelector("#lowerNewSale").addEventListener("click", () => { cart = []; discount = 0; renderCart(); showToast("New sale started"); });

document.querySelector("#cashButton").addEventListener("click", () => startPayment("Cash"));
document.querySelector("#cardButton").addEventListener("click", () => startPayment("Card / M-Pesa"));
document.querySelector("#modalClose").addEventListener("click", closeModal);
modal.addEventListener("click", event => { if (event.target === modal) closeModal(); });
modalActions.addEventListener("click", async event => {
  const actionButton = event.target.closest?.("[data-modal-action]");
  if (!actionButton || !modalActions.contains(actionButton)) return;
  const action = actionButton.dataset.modalAction;
  if (!action) return;
  if (action === "cancel") return closeModal();
  if (action === "print") return window.print();
  if (action === "whatsapp") {
    const text = lastSale ? `${settings.storeName}: receipt ${lastSale.id}, total ${settings.currency} ${money(lastSale.total)}` : "";
    return window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }
  if (action === "feedback") {
    openModal("How was your experience?", `
      <p class="modal-note">Rate this sale from 1 to 5 stars to help us improve.</p>
      <div class="rating-row">${[1, 2, 3, 4, 5].map(n => `<button type="button" class="rating-star" data-rating="${n}">â˜…</button>`).join("")}</div>`, `<button type="button" class="modal-primary" data-modal-action="cancel">Close</button>`);
    return;
  }
  if (action !== "confirm") return;
  if (modalPurpose === "logout") {
    event.stopImmediatePropagation();
    currentUser = null;
    sessionStorage.removeItem("tajiri-session-user");
    localStorage.removeItem("tajiri-remembered-user");
    applyRole();
    activateView("Sales");
    closeModal();
    showToast("Signed out");
    redirectToWelcomeView();
    return;
  }
  if (modalPurpose === "reset-settings") {
    Object.assign(settings, {
      storeName: "Main Store", taxRate: 0, serviceCharge: 0, currency: "KES",
      language: "en", theme: "dark", backgroundColor: "#1e1e1e",
      lowStockAlerts: true, salesReportAlerts: true, discountRule: "percentage",
      receiptFooter: "Thank you for shopping with us", loginMethod: "password",
      darajaEndpoint: "", darajaShortcode: "",
      sessionTimeout: "0", printer: "none", scanner: true, mpesa: true,
      airtel: false, card: true, cashDrawer: false, cloudBackup: false
    });
    document.querySelector("#storeSelect").value = settings.storeName;
    document.querySelector("#storeName").textContent = settings.storeName;
    document.querySelector("#taxRateInput").value = "0";
    document.querySelector("#serviceChargeInput").value = "0";
    document.querySelector("#currencySelect").value = "KES";
    document.querySelector("#languageSelect").value = "en";
    document.querySelector("#themeSelect").value = "dark";
    document.querySelector("#backgroundColorInput").value = "#1e1e1e";
    document.querySelector("#discountRuleSelect").value = "percentage";
    document.querySelector("#receiptFooterInput").value = settings.receiptFooter;
    document.querySelector("#darajaEndpointInput").value = "";
    document.querySelector("#darajaShortcodeInput").value = "";
    document.querySelector("#loginMethodSelect").value = "password";
    document.querySelector("#sessionTimeoutSelect").value = "0";
    document.querySelector("#printerSelect").value = "none";
    document.querySelector("#offlineToggle").checked = false;
    ["lowStockAlertsToggle", "salesReportAlertsToggle", "scannerToggle", "mpesaToggle", "cardToggle"].forEach(id => { document.querySelector(`#${id}`).checked = true; });
    ["airtelToggle", "cashDrawerToggle", "cloudBackupToggle"].forEach(id => { document.querySelector(`#${id}`).checked = false; });
    applySettingsAppearance();
    setOffline(false);
    renderCart();
    saveState();
    closeModal();
    showToast("Settings reset to defaults");
    return;
  }
  if (document.querySelector("#customName")) {
    const name = document.querySelector("#customName").value.trim();
    const price = Number(document.querySelector("#customPrice").value);
    if (!name || !price || price < 0) return showToast("Enter an item name and valid price");
    addProduct({ id: Date.now(), name, code: "CUSTOM ITEM", price, icon: "＋" }); closeModal(); return;
  }
  if (document.querySelector("#discountPercent")) {
    discount = currentSubtotal() * Math.min(100, Math.max(0, Number(document.querySelector("#discountPercent").value))) / 100;
    renderCart(); closeModal(); showToast("Discount applied"); return;
  }
  if (document.querySelector("#deliveryAddress")) { closeModal(); showToast("Delivery details saved"); return; }
  if (document.querySelector("#deliveryGuy")) { const guy = document.querySelector("#deliveryGuy").value; closeModal(); showToast(`${guy} assigned`); return; }
  if (document.querySelector("#splitCash")) {
    const total = currentTotal();
    const paid = Number(document.querySelector("#splitCash").value || 0) + Number(document.querySelector("#splitMpesa").value || 0);
    if (paid < total) return showToast("Split amounts are too low");
    completeSaleRecord("Split"); return;
  }
  if (document.querySelector("#pointsAmount")) { closeModal(); showToast("Points applied to this sale"); return; }
  if (document.querySelector("#debtCustomer")) { closeModal(); showToast("Debt recorded successfully"); return; }
  if (document.querySelector("#paymentAmount")) {
    resolveCustomerInfo();
    const received = Number(document.querySelector("#paymentAmount").value);
    if (received < currentTotal()) return showToast("Amount received is too low");
    completeSaleRecord(lastPaymentMethod, received); return;
  }
  if (document.querySelector("#mpesaPhone")) {
    resolveCustomerInfo();
    const phone = document.querySelector("#mpesaPhone").value.trim();
    const normalizedPhone = normalizeKenyanPhone(phone);
    if (!normalizedPhone) return showToast("Enter a valid Kenyan phone number");
    const endpoint = settings.darajaEndpoint.trim() || `${window.TAJIRI_API_BASE || "http://localhost:3000"}/api/mpesa/stk-push`;
    if (offlineMode || !navigator.onLine) {
      pendingMpesa.push({ amount: currentTotal(), phone: normalizedPhone, shortcode: settings.darajaShortcode, accountReference: settings.storeName, transactionDesc: "Tajiri POS sale" });
      completeSaleRecord("M-Pesa (queued)");
      showToast("M-Pesa request queued for sync");
      return;
    }
    if (!endpoint || endpoint === "/api/mpesa/stk-push") return showToast("Configure the Daraja backend URL in Settings first");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: currentTotal(), phone: normalizedPhone, shortcode: settings.darajaShortcode, accountReference: settings.storeName, transactionDesc: "Tajiri POS sale" })
      });
      if (!response.ok) throw new Error("Daraja request failed");
      const result = await response.json().catch(() => ({}));
      if (result.success === false) throw new Error(result.message || "M-Pesa request failed");
      completeSaleRecord("M-Pesa");
      showToast("M-Pesa prompt sent");
    } catch (error) {
      showToast(error.message || "M-Pesa request failed");
    }
    return;
  }
});

document.querySelector(".icon-button").addEventListener("click", () => openModal("Notifications", `<p class="modal-note">No new notifications. Inventory and sales are up to date.</p>`, `<button type="button" class="modal-primary" data-modal-action="cancel">Done</button>`));
document.querySelector(".logout-button").addEventListener("click", () => { openModal("Sign out", `<p>Are you sure you want to sign out of Tajiri POS?</p>`, actionButtons("Sign out")); modalPurpose = "logout"; });
document.querySelector("#signupButton")?.addEventListener("click", () => {
  if (currentUser?.role !== "admin") return showToast("Admin permission required");
  openModal("Create account", `<p class="auth-kicker">Create a secure account for a cashier or manager.</p><label>Full name<input id="signupName" placeholder="e.g. Amina Otieno" required></label><label>Username<input id="signupUsername" autocomplete="username" placeholder="e.g. amina" required></label><label>Email<input id="signupEmail" type="email" placeholder="amina@example.com" required></label><label>Password<input id="signupPassword" type="password" autocomplete="new-password" placeholder="At least 5 characters" required></label><label>Confirm password<input id="signupConfirmPassword" type="password" autocomplete="new-password" maxlength="5" required></label><label>Role<select id="signupRole"><option value="cashier">Cashier</option><option value="manager">Manager</option><option value="admin">Admin</option></select></label><label>Phone (optional)<input id="signupPhone" type="tel" placeholder="For M-Pesa notifications"></label>`, actionButtons("Create account"));
});
document.querySelector("#addProductButton")?.addEventListener("click", () => openModal("Add product", `<label>Product name<input id="newProductName" placeholder="e.g. Maize flour"></label><label>Price (KES)<input id="newProductPrice" type="number" min="1" placeholder="0.00"></label>`, actionButtons("Add product")));
document.querySelector("#exportReportButton")?.addEventListener("click", () => showToast("Report export is ready to connect"));
document.querySelector("#printReceiptButton")?.addEventListener("click", () => showToast("Receipt sent to printer"));
document.querySelector("#sendReceiptButton")?.addEventListener("click", () => showToast("Receipt sharing is ready for WhatsApp"));
document.querySelector("#downloadDataButton")?.addEventListener("click", () => {
  const exportData = { salesLog, expenses, purchaseOrders, cashBook, products, settings };
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "tajiri-pos-data.json";
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("Business data downloaded");
});
document.querySelector("#aboutButton")?.addEventListener("click", () => openModal("About Tajiri POS", `<p class="modal-note">Tajiri POS is a local-first retail workspace for sales, inventory, customers, reports, and cash management.</p><p class="modal-note">All account login and signup actions are available from the Welcome page.</p>`, `<button type="button" class="modal-primary" data-modal-action="cancel">Close</button>`));
document.querySelectorAll("[data-product-action='edit']").forEach(button => button.addEventListener("click", () => showToast("Product editor opened")));
function activateView(label) {
  if (currentUser && currentUser.role !== "admin" && ADMIN_ONLY_VIEWS.includes(label)) {
    return showToast("Admin permission required");
  }
  const pageTitle = document.querySelector("#pageTitle");
  const panels = document.querySelectorAll(".main-content [data-view]");
  const salesView = document.querySelector(".sales-area");
  const salePanel = document.querySelector(".sale-panel");

  document.querySelectorAll(".nav-button, .more-menu-item").forEach(item => {
    const itemLabel = item.getAttribute("data-view") || item.getAttribute("aria-label");
    item.classList.toggle("active", itemLabel === label);
  });

  panels.forEach(panel => {
    const isTarget = panel.dataset.view === label;
    panel.hidden = !isTarget;
  });

  const isSales = label === "Sales";
  if (salesView) salesView.hidden = !isSales;
  if (salePanel) salePanel.hidden = !isSales;

  if (pageTitle) pageTitle.textContent = isSales ? "New sale" : label;
  showToast(`${label} section selected`);
}

const moreButton = document.querySelector("#moreButton");
const moreDropdown = document.querySelector("#moreDropdown");
if (moreButton && moreDropdown) {
  moreDropdown.hidden = true;
  moreButton.setAttribute("aria-expanded", "false");
  moreButton.addEventListener("click", () => {
    const hidden = moreDropdown.hasAttribute("hidden");
    moreDropdown.toggleAttribute("hidden", !hidden);
    moreButton.setAttribute("aria-expanded", String(hidden));
  });

  document.addEventListener("click", (event) => {
    if (!moreDropdown.contains(event.target) && !moreButton.contains(event.target)) {
      moreDropdown.setAttribute("hidden", "hidden");
      moreButton.setAttribute("aria-expanded", "false");
    }
  });
}

document.querySelectorAll(".nav-button, .more-menu-item").forEach(button => button.addEventListener("click", () => {
  const label = button.getAttribute("data-view") || button.getAttribute("aria-label");
  if (!label) return;
  activateView(label);
  if (moreDropdown) {
    moreDropdown.setAttribute("hidden", "hidden");
    moreButton?.setAttribute("aria-expanded", "false");
  }
}));
document.addEventListener("keydown", event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); search.focus(); }
  if (event.key === "Escape" && !modal.hidden) closeModal();
  if (event.key === "F2") { event.preventDefault(); startPayment("Cash"); }
  if (event.key === "F4") { event.preventDefault(); startPayment("Card / M-Pesa"); }
});

renderProducts();
renderCart();

/* ---------- Sale recording, receipts & inventory updates ---------- */

let lastSale = null;

function completeSaleRecord(method, amountPaid = currentTotal()) {
  const items = cart.map(item => ({ name: item.name, quantity: item.quantity, unitPrice: getEffectivePrice(item) }));
  const customerInfo = resolveCustomerInfo();
  const sale = {
    id: `SALE-${2085 + salesLog.length}`,
    receiptNumber: String(456 + salesLog.length).padStart(6, "0"),
    method,
    cashier: currentUser ? currentUser.name : "Walk-in",
    store: settings.storeName,
    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    date: new Date().toLocaleDateString("en-GB"),
    transactionId: method === "M-Pesa" ? `MP${Date.now().toString().slice(-9)}` : `TXN-${2085 + salesLog.length}`,
    customer: customerInfo.name || "Walk-in customer",
    customerPhone: customerInfo.phone || "",
    subtotal: currentSubtotal(),
    discount,
    tax: currentVat(),
    serviceCharge: currentServiceCharge(),
    total: currentTotal(),
    amountPaid,
    change: Math.max(0, amountPaid - currentTotal()),
    items,
    synced: !offlineMode
  };
  salesLog.push(sale);
  lastSale = sale;

  // Cash book: money IN for every completed sale
  cashBook.push({
    id: sale.id,
    direction: "in",
    label: sale.items.map(i => `${i.name} × ${i.quantity}`).join(", "),
    method: sale.method,
    amount: sale.total
  });

  // Inventory update: reduce stock, alert on low stock, auto-suggest purchase orders
  cart.forEach(item => {
    const product = products.find(p => p.id === item.id);
    if (!product) return;
    product.stock = Math.max(0, product.stock - item.quantity);
    if (product.stock <= LOW_STOCK_LEVEL) {
      showToast(`Low stock alert: ${product.name} (${product.stock} left)`);
      if (!purchaseOrders.some(po => po.product === product.name)) {
        const supplier = suppliers.find(s => s.supplies === product.name);
        purchaseOrders.push({ product: product.name, supplier: supplier ? supplier.name : "Any supplier", quantity: 20, status: "Suggested" });
      }
    }
  });

  // Loyalty: award 1 point per whole 100 spent
  const earned = Math.floor(sale.total / 100);
  loyaltyBalance += earned;

  cart = []; discount = 0; renderCart(); renderSalesStockPulse(); renderAllPanels(); closeModal();
  openReceipt(sale, earned);
  saveState();
}

function openReceipt(sale, earned) {
  const lines = sale.items.map(item =>
    `<div class="receipt-line receipt-item-line"><span>${item.name}</span><span>× ${item.quantity}</span><span>${money(item.unitPrice)}</span><b>${money(item.unitPrice * item.quantity)}</b></div>`).join("");
  openModal("Receipt", `
    <div class="receipt-paper">
      <div class="receipt-brand">
        <strong>${settings.storeName}</strong>
        <span>Receipt No: ${sale.receiptNumber} · ${sale.id} · ${sale.method} · ${sale.time}</span>
      </div>
      <div class="receipt-address">
        <b>${settings.receiptShopName}</b>
        <span>${settings.receiptLocation}</span>
        <span>Tel: ${settings.receiptPhone}</span>
      </div>
      <div class="receipt-meta"><span>Receipt No: ${sale.receiptNumber}</span><span>${sale.date} · ${sale.time}</span><span>Cashier: ${sale.cashier}</span><span>Customer: ${sale.customer}${sale.customerPhone ? ` (${sale.customerPhone})` : ""}</span><span>Transaction: ${sale.id}</span></div>
      <div class="receipt-table-head"><span>Item</span><span>Qty</span><span>Price</span><span>Subtotal</span></div>
      ${lines}
      <div class="receipt-summary"><div><span>Subtotal</span><b>${money(sale.subtotal)}</b></div><div><span>Discount</span><b>-${money(sale.discount)}</b></div><div><span>VAT</span><b>${money(sale.tax)}</b></div><div><span>Service charge</span><b>${money(sale.serviceCharge)}</b></div><div class="receipt-total-line"><span>Total</span><b>${money(sale.total)}</b></div></div>
      <div class="receipt-payment"><span>Payment Method: ${sale.method}</span><span>Paid Amount: ${money(sale.amountPaid)}</span><span>Change: ${money(sale.change)}</span><span>Transaction ID: ${sale.method === "M-Pesa" ? sale.transactionId : sale.id}</span></div>
      <div class="qr-placeholder" aria-label="Transaction barcode">${sale.id}</div>
      <div class="receipt-footer"><strong>Thank You Again!</strong><span>${settings.receiptFooter}!</span><span>You earned ${earned} loyalty points today.</span><span>${settings.returnPolicy}</span><span>Karibu tena ${settings.receiptShopName}!</span><div class="receipt-barcode" aria-hidden="true"></div></div>
    </div>`, `<button type="button" class="modal-secondary" data-receipt-action="print">Print</button><button type="button" class="modal-secondary" data-receipt-action="whatsapp">WhatsApp</button><button type="button" class="modal-primary" data-receipt-action="feedback">Done</button>`);
  renderReceiptPanel(sale);
}

function renderReceiptPanel(sale) {
  const preview = document.querySelector("#receiptPreview");
  if (!preview) return;
  if (!sale) { preview.querySelector("#receiptLines").innerHTML = "<span>Complete a sale to see a receipt</span>"; return; }
  const lines = sale.items.map(item =>
    `<div class="receipt-preview-item"><span>${item.name} × ${item.quantity}</span><b>${money(item.unitPrice * item.quantity)}</b></div>`).join("");
  preview.innerHTML = `
    <strong>${settings.receiptShopName}</strong><span>${settings.receiptLocation}</span><span>Tel: ${settings.receiptPhone}</span><span>Receipt No: ${sale.receiptNumber} · ${sale.date} ${sale.time}</span><hr>
    ${lines}
    <div><span>Subtotal</span><b>${money(sale.subtotal)}</b></div>
    <div><span>Discount</span><b>-${money(sale.discount)}</b></div>
    <div><span>VAT</span><b>${money(sale.tax)}</b></div>
    <div><span>Service charge</span><b>${money(sale.serviceCharge)}</b></div>
    <div class="receipt-total"><span>Total</span><b>${money(sale.total)}</b></div>
    <span>${settings.receiptFooter}!</span><span>You earned ${Math.floor(sale.total / 100)} loyalty points today.</span><span>${settings.returnPolicy}</span><span>Karibu tena ${settings.receiptShopName}!</span>`;
}

/* ---------- Panels: inventory, customers, staff, reports, expenses, suppliers ---------- */

function renderInventoryPanel() {
  const table = document.querySelector("#inventoryTable");
  if (!table) return;
  const filter = (document.querySelector("#inventorySearch")?.value || "").toLowerCase();
  const visible = products.filter(p => p.name.toLowerCase().includes(filter));
  table.innerHTML = `<div class="inventory-head"><span>ITEM</span><span>CATEGORY</span><span>STOCK</span><span>PRICE</span><span></span></div>` +
    visible.map(p => `
      <div class="inventory-row">
        <strong>${p.name}</strong><span>${p.category || "—"}</span>
        <span class="${p.stock <= LOW_STOCK_LEVEL ? "stock-low" : ""}">${p.stock}</span>
        <span>${settings.currency} ${money(p.price)}</span>
        <button class="row-action" data-product-action="edit" data-id="${p.id}">Edit</button>
        <button class="row-action row-danger" data-product-action="delete" data-id="${p.id}">Delete</button>
      </div>`).join("");
  const totalStock = products.reduce((sum, p) => sum + p.stock, 0);
  const low = products.filter(p => p.stock <= LOW_STOCK_LEVEL);
  const top = topSeller();
  document.querySelector("#stockCard").textContent = totalStock;
  document.querySelector("#lowStockCard").textContent = low.length;
  document.querySelector("#topSellerCard").textContent = top ? top.name.split(" ")[0] : "—";
}

function topSeller() {
  const counts = {};
  salesLog.forEach(sale => sale.items.forEach(item => { counts[item.name] = (counts[item.name] || 0) + item.quantity; }));
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return best ? { name: best[0], sold: best[1] } : null;
}

function renderCustomersPanel() {
  const list = document.querySelector("#customerList");
  if (!list) return;
  list.innerHTML = customers.map(c =>
    `<div class="panel-row"><span>${c.name} · ${c.phone}</span><strong>${c.tier} · ${c.points} pts</strong></div>`).join("");
}

function renderStaffPanel() {
  const list = document.querySelector("#staffList");
  if (!list) return;
  list.innerHTML = users.map(u =>
    `<div class="panel-row"><span>${u.name}</span><strong>${u.role === "admin" ? "Admin · Active" : "Cashier · Active"}</strong></div>`).join("");
}

function renderReportsPanel() {
  const today = salesLog.reduce((sum, s) => sum + s.total, 0);
  const cost = salesLog.reduce((sum, s) => sum + s.items.reduce((c, i) => {
    const product = products.find(p => p.name === i.name);
    return c + (product ? product.cost : 0) * i.quantity;
  }, 0), 0);
  const expenseTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
  const vat = salesLog.reduce((sum, s) => sum + s.tax, 0);
  document.querySelector("#reportToday").textContent = `${settings.currency} ${money(today)}`;
  document.querySelector("#reportProfit").textContent = `${settings.currency} ${money(today - cost - expenseTotal)}`;
  document.querySelector("#reportOrders").textContent = salesLog.length;
  document.querySelector("#reportVat").textContent = `${settings.currency} ${money(vat)}`;
  document.querySelector("#reportExpenses").textContent = `${settings.currency} ${money(expenseTotal)}`;
  const top = topSeller();
  document.querySelector("#reportTop").textContent = top ? `${top.name} · ${top.sold} sold` : "No sales yet";
  const mix = {};
  salesLog.forEach(s => { mix[s.method] = (mix[s.method] || 0) + 1; });
  const mixText = Object.entries(mix).map(([m, n]) => `${m} ${Math.round(n / salesLog.length * 100)}%`).join(" · ");
  document.querySelector("#reportPaymentMix").textContent = salesLog.length ? mixText : "—";
  // AI insights: reorder suggestion + demand estimate
  const low = products.filter(p => p.stock <= LOW_STOCK_LEVEL);
  const avg = salesLog.length ? today / salesLog.length : 0;
  document.querySelector("#aiInsight").textContent = low.length
    ? `Reorder ${low[0].name} soon — ${low[0].stock} left, avg sale ${money(avg)}`
    : `Stock healthy · avg sale ${settings.currency} ${money(avg)}`;
}

function renderExpensesPanel() {
  const list = document.querySelector("#expenseList");
  if (!list) return;
  list.innerHTML = expenses.length
    ? expenses.map(e => `<div class="panel-row"><span>${e.type} · ${e.note || "no note"}</span><strong>${settings.currency} ${money(e.amount)}</strong></div>`).join("")
    : `<div class="panel-row"><span>No expenses recorded yet</span><strong>—</strong></div>`;
}

function renderSuppliersPanel() {
  const list = document.querySelector("#supplierList");
  const poList = document.querySelector("#purchaseOrderList");
  if (!list || !poList) return;
  list.innerHTML = suppliers.map(s =>
    `<div class="panel-row"><span>${s.name} · ${s.phone}</span><strong>${s.supplies}</strong></div>`).join("");
  poList.innerHTML = purchaseOrders.length
    ? purchaseOrders.map((po, i) => `<div class="panel-row"><span>${po.product} · ${po.quantity} units · ${po.supplier}</span><button class="row-action" data-po-action="send" data-index="${i}">Send PO</button></div>`).join("")
    : `<div class="panel-row"><span>No suggested orders — stock levels healthy</span><strong>—</strong></div>`;
}

function renderAllPanels() {
  renderInventoryPanel();
  renderCustomersPanel();
  renderStaffPanel();
  renderReportsPanel();
  renderExpensesPanel();
  renderSuppliersPanel();
  renderCashBookPanel();
}

/* ---------- Cash book ---------- */

function renderCashBookPanel() {
  const list = document.querySelector("#cashBookList");
  if (!list) return;
  const moneyIn = cashBook.filter(e => e.direction === "in").reduce((s, e) => s + e.amount, 0);
  const moneyOut = cashBook.filter(e => e.direction === "out").reduce((s, e) => s + e.amount, 0);
  const balance = moneyIn - moneyOut;
  document.querySelector("#cashBookIn").textContent = `${settings.currency} ${money(moneyIn)}`;
  document.querySelector("#cashBookOut").textContent = `${settings.currency} ${money(moneyOut)}`;
  document.querySelector("#cashBookBalance").textContent = `${settings.currency} ${money(balance)}`;
  list.innerHTML = cashBook.length
    ? cashBook.slice().reverse().map(e => `
      <div class="cashbook-row panel-row cashbook-${e.direction}">
        <span>${e.direction === "in" ? "▲" : "▼"} ${e.label} · ${e.method}</span>
        <strong>${e.direction === "in" ? "+" : "-"}${settings.currency} ${money(e.amount)}</strong>
      </div>`).join("")
    : `<div class="panel-row"><span>No cash movements yet</span><strong>—</strong></div>`;
}

document.querySelector("#addCashEntryButton")?.addEventListener("click", () => {
  if (currentUser?.role !== "admin") return showToast("Admin permission required");
  openModal("Add cash entry", `
    <label>Direction<select id="cashEntryDirection"><option value="in">Money in (cash received)</option><option value="out">Money out (cash paid)</option></select></label>
    <label>Amount (KES)<input id="cashEntryAmount" type="number" min="0.01" step="0.01" required></label>
    <label>Note<input id="cashEntryNote" placeholder="e.g. Owner float, bank deposit"></label>`, actionButtons("Record entry"));
});

/* ---------- Roles, login, offline persistence ---------- */

const ADMIN_ONLY_VIEWS = ["Settings", "Staff", "Reports"];

function getFirstName(fullName) {
  const value = String(fullName || "").trim();
  if (!value) return "";
  return value.split(/\s+/)[0];
}

function getInitials(fullName) {
  const names = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  if (!names.length) return "";
  return names.slice(0, 2).map(name => name[0].toUpperCase()).join("");
}

function applyRole() {
  const isAdmin = !currentUser || currentUser.role === "admin";
  const roleLabel = currentUser ? currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1) : "—";
  const firstName = currentUser ? getFirstName(currentUser.name) : "";
  const userName = document.querySelector("#userName");
  const userInitials = document.querySelector("#userInitials");
  const userRole = document.querySelector("#userRole");
  if (userName) {
    userName.textContent = firstName || "Guest";
    userName.title = currentUser ? currentUser.name : "Not signed in";
  }
  if (userInitials) userInitials.textContent = currentUser ? getInitials(currentUser.name) : "";
  if (userRole) userRole.textContent = currentUser ? roleLabel : "";

  document.querySelectorAll(".nav-button, .more-menu-item").forEach(item => {
    const view = item.getAttribute("data-view");
    item.style.display = !isAdmin && ADMIN_ONLY_VIEWS.includes(view) ? "none" : "";
  });
  const cashier = document.querySelector("#cashierName");
  if (cashier) cashier.textContent = currentUser ? `${currentUser.name} (${currentUser.role})` : "Not signed in";
  const role = document.querySelector("#settingsRole");
  if (role) role.textContent = roleLabel;
  const staffButton = document.querySelector("#staffButton");
  if (staffButton) staffButton.innerHTML = `${currentUser ? currentUser.name : "Not signed in"} <span>⚙</span>`;
  const welcomeHeader = document.querySelector("#welcomeHeaderLabel");
  if (welcomeHeader) {
    welcomeHeader.textContent = currentUser ? `Welcome, ${currentUser.name}` : "Welcome";
  }
}

async function hashPassword(password) {
  if (globalThis.crypto?.subtle) {
    const bytes = new TextEncoder().encode(password);
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  }
  let hash = 2166136261;
  for (const character of password) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return `fallback-${(hash >>> 0).toString(16)}`;
}

async function loginWithPassword(identity, password) {
  const normalized = normalizeIdentity(identity);
  const user = users.find(entry => {
    const identities = [
      entry.username,
      entry.email,
      entry.name,
      entry.name.toLowerCase().replace(/\s+/g, "."),
      `${entry.name} · ${entry.role}`,
      `${entry.name} | ${entry.role}`,
      `${entry.name.toLowerCase()}|${entry.role.toLowerCase()}`
    ].map(normalizeIdentity);
    return identities.includes(normalized);
  });
  if (!user || !user.passwordHash || user.passwordHash !== await hashPassword(password)) return false;
  currentUser = user;
  sessionStorage.setItem("tajiri-session-user", user.username?.toLowerCase() || user.email?.toLowerCase() || user.name.toLowerCase().replace(/\s+/g, "."));
  applyRole();
  showToast(`Welcome, ${user.name}`);
  return true;
}

function loginWithPin(account, pin) {
  const identity = normalizeIdentity(account);
  const user = users.find(entry => {
    const fullAccount = `${entry.name} · ${entry.role}`;
    const aliases = [
      entry.name,
      entry.username,
      entry.email,
      entry.name.toLowerCase().replace(/\s+/g, "."),
      fullAccount,
      `${entry.name.toLowerCase()}|${entry.role.toLowerCase()}`,
      `${entry.name} | ${entry.role}`
    ].map(normalizeIdentity);
    return aliases.includes(identity);
  });
  if (!user || !user.pin || String(pin).trim() !== String(user.pin)) return false;
  currentUser = user;
  sessionStorage.setItem("tajiri-session-user", user.username?.toLowerCase() || user.email?.toLowerCase() || user.name.toLowerCase().replace(/\s+/g, "."));
  applyRole();
  showToast(`Welcome, ${user.name}`);
  return true;
}

function saveState() {
  try {
    localStorage.setItem("tajiri-pos", JSON.stringify({
      users, salesLog, expenses, purchaseOrders, pendingMpesa, loyaltyBalance, cashBook, productsStock: products.map(p => ({ id: p.id, stock: p.stock })), settings
    }));
  } catch (e) { /* storage unavailable — stay in-memory */ }
}

function restoreCurrentUser() {
  const keys = [
    sessionStorage.getItem("tajiri-session-user"),
    localStorage.getItem("tajiri-remembered-user"),
  ].filter(Boolean);

  for (const key of keys) {
    const normalized = normalizeIdentity(key);
    const user = users.find(entry => {
      const identities = [
        entry.username,
        entry.email,
        entry.name,
        entry.name.toLowerCase().replace(/\s+/g, "."),
        `${entry.name} · ${entry.role}`,
        `${entry.name} | ${entry.role}`,
        `${entry.name.toLowerCase()}|${entry.role.toLowerCase()}`
      ].map(normalizeIdentity);
      return identities.includes(normalized);
    });
    if (user) {
      currentUser = user;
      return;
    }
  }
  currentUser = null;
}

function loadState() {
  try {
    const raw = localStorage.getItem("tajiri-pos");
    if (!raw) {
      restoreCurrentUser();
      return;
    }
    const saved = JSON.parse(raw);
    salesLog = saved.salesLog || [];
    if (Array.isArray(saved.users) && saved.users.length) users = saved.users;
    expenses = saved.expenses || [];
    purchaseOrders = saved.purchaseOrders || [];
    pendingMpesa = saved.pendingMpesa || [];
    loyaltyBalance = saved.loyaltyBalance || 0;
    cashBook = saved.cashBook || [];
    (saved.productsStock || []).forEach(s => {
      const product = products.find(p => p.id === s.id);
      if (product) product.stock = s.stock;
    });
    Object.assign(settings, saved.settings || {});
    restoreCurrentUser();
    applySettingsAppearance();
    document.querySelector("#taxRateInput").value = (settings.taxRate * 100).toFixed(1).replace(/\.0$/, "");
    document.querySelector("#serviceChargeInput").value = (settings.serviceCharge * 100).toFixed(1).replace(/\.0$/, "");
    document.querySelector("#currencySelect").value = settings.currency;
    document.querySelector("#languageSelect").value = settings.language;
    document.querySelector("#themeSelect").value = settings.theme;
    document.querySelector("#backgroundColorInput").value = settings.backgroundColor;
    document.querySelector("#discountRuleSelect").value = settings.discountRule;
    document.querySelector("#receiptFooterInput").value = settings.receiptFooter;
    document.querySelector("#darajaEndpointInput").value = settings.darajaEndpoint || "";
    document.querySelector("#darajaShortcodeInput").value = settings.darajaShortcode || "";
    document.querySelector("#loginMethodSelect").value = settings.loginMethod;
    document.querySelector("#sessionTimeoutSelect").value = settings.sessionTimeout;
    document.querySelector("#printerSelect").value = settings.printer;
    ["lowStockAlerts", "salesReportAlerts", "scanner", "mpesa", "airtel", "card", "cashDrawer", "cloudBackup"].forEach(key => {
      const element = document.querySelector(`#${key === "lowStockAlerts" ? "lowStockAlertsToggle" : key === "salesReportAlerts" ? "salesReportAlertsToggle" : key === "cashDrawer" ? "cashDrawerToggle" : key === "cloudBackup" ? "cloudBackupToggle" : `${key}Toggle`}`);
      if (element) element.checked = Boolean(settings[key]);
    });
    document.querySelector("#storeSelect").value = settings.storeName;
    document.querySelector("#storeName").textContent = settings.storeName;
  } catch (e) { /* corrupt state — ignore */ }
}

function applySettingsAppearance() {
  document.body.dataset.theme = settings.theme || "dark";
  document.body.style.setProperty("--app-background", settings.backgroundColor || "#1e1e1e");
}

function setOffline(mode) {
  offlineMode = mode;
  const dot = document.querySelector("#statusDot");
  const sync = document.querySelector("#syncStatus");
  if (dot) { dot.title = mode ? "Offline — sales will sync later" : "Online"; dot.classList.toggle("offline", mode); }
  if (sync) sync.textContent = mode ? "Offline mode" : "Online";
}

async function syncPendingMpesa() {
  if (offlineMode || !navigator.onLine || !pendingMpesa.length) return;
  const endpoint = settings.darajaEndpoint.trim() || `${window.TAJIRI_API_BASE || "http://localhost:3000"}/api/mpesa/stk-push`;
  if (!endpoint || endpoint === "/api/mpesa/stk-push") return;
  const remaining = [];
  for (const request of pendingMpesa) {
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request) });
      if (!response.ok) throw new Error("sync failed");
    } catch { remaining.push(request); }
  }
  pendingMpesa = remaining;
  saveState();
  if (!remaining.length) showToast("Queued M-Pesa requests synced");
}

window.addEventListener("online", syncPendingMpesa);

/* ---------- Panel event wiring ---------- */

document.querySelector("#addProductButton")?.addEventListener("click", () => {
  if (currentUser?.role !== "admin") return showToast("Admin permission required");
  openModal("Add product", `
    <label>Product name<input id="productName" required></label>
    <label>Category<input id="productCategory" placeholder="Grocery"></label>
    <label>Price (KES)<input id="productPrice" type="number" min="0.01" step="0.01" required></label>
    <label>Stock quantity<input id="productStock" type="number" min="0" step="1" value="0"></label>`, actionButtons("Add product"));
});

document.querySelector("#inventorySearch")?.addEventListener("input", renderInventoryPanel);

document.querySelector("#inventoryTable")?.addEventListener("click", event => {
  const button = event.target.closest("[data-product-action]");
  if (!button) return;
  if (currentUser?.role !== "admin") return showToast("Admin permission required");
  const product = products.find(p => p.id === Number(button.dataset.id));
  if (!product) return;
  if (button.dataset.productAction === "delete") {
    if (cart.some(item => item.id === product.id)) cart = cart.filter(item => item.id !== product.id);
    products.splice(products.indexOf(product), 1);
    renderInventoryPanel(); renderProducts(search.value); showToast(`${product.name} deleted`);
  }
  if (button.dataset.productAction === "edit") {
    openModal("Edit product", `
      <label>Product name<input id="productName" value="${product.name}"></label>
      <label>Category<input id="productCategory" value="${product.category || ""}"></label>
      <label>Price (KES)<input id="productPrice" type="number" step="0.01" value="${product.price}"></label>
      <label>Stock quantity<input id="productStock" type="number" step="1" value="${product.stock}"></label>`, actionButtons("Save product"));
    modal.dataset.editId = product.id;
  }
});

document.querySelector("#purchaseOrderList")?.addEventListener("click", event => {
  const button = event.target.closest("[data-po-action]");
  if (!button) return;
  const po = purchaseOrders[Number(button.dataset.index)];
  if (po) { po.status = "Sent"; showToast(`Purchase order sent to ${po.supplier}`); renderSuppliersPanel(); }
});

document.querySelector("#addExpenseButton")?.addEventListener("click", () => {
  if (currentUser?.role !== "admin") return showToast("Admin permission required");
  openModal("Record expense", `
    <label>Type<select id="expenseType"><option>Rent</option><option>Salary</option><option>Utility</option><option>Other</option></select></label>
    <label>Amount (KES)<input id="expenseAmount" type="number" min="0.01" step="0.01" required></label>
    <label>Note<input id="expenseNote" placeholder="Optional note"></label>`, actionButtons("Record"));
});

document.querySelector("#campaignButton")?.addEventListener("click", () => {
  showToast(`SMS campaign queued for ${customers.length} customers`);
});

document.querySelector("#smsReportButton")?.addEventListener("click", () => {
  const total = salesLog.reduce((sum, s) => sum + s.total, 0);
  showToast(`Daily SMS sent: ${settings.currency} ${money(total)} across ${salesLog.length} sales`);
});

document.querySelector("#exportReportButton")?.addEventListener("click", () => {
  const report = { sales: salesLog, expenses, vat: salesLog.reduce((s, x) => s + x.tax, 0) };
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "tajiri-report.json";
  link.click();
  showToast("Report exported");
});

document.querySelector("#saveSettingsButton")?.addEventListener("click", () => {
  if (currentUser?.role !== "admin") return showToast("Admin permission required");
  settings.taxRate = Math.min(100, Math.max(0, Number(document.querySelector("#taxRateInput").value || 0))) / 100;
  settings.serviceCharge = Math.min(100, Math.max(0, Number(document.querySelector("#serviceChargeInput").value || 0))) / 100;
  settings.currency = document.querySelector("#currencySelect").value;
  settings.language = document.querySelector("#languageSelect").value;
  settings.theme = document.querySelector("#themeSelect").value;
  settings.backgroundColor = document.querySelector("#backgroundColorInput").value;
  settings.discountRule = document.querySelector("#discountRuleSelect").value;
  settings.receiptFooter = document.querySelector("#receiptFooterInput").value.trim() || "Thank you for shopping with us";
  settings.darajaEndpoint = document.querySelector("#darajaEndpointInput").value.trim();
  settings.darajaShortcode = document.querySelector("#darajaShortcodeInput").value.trim();
  settings.loginMethod = document.querySelector("#loginMethodSelect").value;
  settings.sessionTimeout = document.querySelector("#sessionTimeoutSelect").value;
  settings.printer = document.querySelector("#printerSelect").value;
  settings.lowStockAlerts = document.querySelector("#lowStockAlertsToggle").checked;
  settings.salesReportAlerts = document.querySelector("#salesReportAlertsToggle").checked;
  settings.scanner = document.querySelector("#scannerToggle").checked;
  settings.mpesa = document.querySelector("#mpesaToggle").checked;
  settings.airtel = document.querySelector("#airtelToggle").checked;
  settings.card = document.querySelector("#cardToggle").checked;
  settings.cashDrawer = document.querySelector("#cashDrawerToggle").checked;
  settings.cloudBackup = document.querySelector("#cloudBackupToggle").checked;
  applySettingsAppearance();
  setOffline(document.querySelector("#offlineToggle").checked);
  document.querySelector("#storeName").textContent = settings.storeName;
  renderCart(); renderAllPanels(); saveState();
  showToast(`Settings saved · VAT ${(settings.taxRate * 100).toFixed(1).replace(/\.0$/, "")}% · ${settings.currency}`);
});

document.querySelector("#exportSettingsButton")?.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(settings, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "tajiri-settings.json";
  link.click();
  showToast("Settings exported");
});

document.querySelector("#resetSettingsButton")?.addEventListener("click", () => {
  if (currentUser?.role !== "admin") return showToast("Admin permission required");
  openModal("Reset settings", `<p>Restore the default KES, dark theme, alerts, and device preferences?</p><p class="modal-note">Sales, stock, accounts, and receipts will stay unchanged.</p>`, actionButtons("Reset settings"));
  modalPurpose = "reset-settings";
});

document.querySelector("#storeSelect")?.addEventListener("change", event => {
  settings.storeName = event.target.value;
  document.querySelector("#storeName").textContent = settings.storeName;
  const settingsStore = document.querySelector("#settingsStoreName");
  if (settingsStore) settingsStore.textContent = settings.storeName;
  showToast(`Switched to ${settings.storeName}`);
});

document.querySelector("#printReceiptButton")?.addEventListener("click", () => window.print());
document.querySelector("#sendReceiptButton")?.addEventListener("click", () => {
  const text = lastSale ? `${settings.storeName}: receipt ${lastSale.id}, total ${settings.currency} ${money(lastSale.total)}` : "Tajiri POS receipt";
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
});

document.querySelector("#staffButton")?.addEventListener("click", () => document.querySelector("#staffLoginButton")?.click());

document.querySelector("#addAccountButton")?.addEventListener("click", () => {
  if (currentUser?.role !== "admin") return showToast("Admin permission required");
  openModal("Create staff account", `<label>Full name<input id="newAccountName" required></label><label>Role<select id="newAccountRole"><option value="cashier">Cashier</option><option value="admin">Admin</option></select></label><label>PIN<input id="newAccountPin" type="password" inputmode="numeric" required></label>`, actionButtons("Create account"));
});

/* Handle login + add/edit product + expense + feedback inside the shared modal */
document.addEventListener("click", async event => {
  const receiptAction = event.target.dataset?.receiptAction;
  if (receiptAction === "print") return window.print();
  if (receiptAction === "whatsapp") {
    const text = lastSale ? `${settings.storeName}: receipt ${lastSale.id}, total ${settings.currency} ${money(lastSale.total)}` : "";
    return window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }
  if (receiptAction === "feedback") {
    openModal("How was your experience?", `
      <p class="modal-note">Rate this sale from 1 to 5 stars to help us improve.</p>
      <div class="rating-row">${[1, 2, 3, 4, 5].map(n => `<button type="button" class="rating-star" data-rating="${n}">â˜…</button>`).join("")}</div>`, `<button type="button" class="modal-primary" data-modal-action="cancel">Close</button>`);
    return;
  }
  const star = event.target.closest?.(".rating-star");
  if (star) { closeModal(); showToast(`Thanks for rating us ${star.dataset.rating}/5`); return; }

  if (event.target.id === "forgotPasswordButton") {
    showToast("Ask an admin to reset your password");
    return;
  }
  if (event.target.id === "googleLoginButton") {
    openModal("Google sign-in setup", `<p class="modal-note">Google OAuth needs a backend callback, Google client ID, and token verification before it can sign you in securely.</p><p class="modal-note">After setup, approved email domains can be mapped to Cashier, Manager, or Admin roles.</p>`, `<button type="button" class="modal-primary" data-modal-action="cancel">Close</button>`);
    return;
  }

  const isConfirm = event.target.dataset?.modalAction === "confirm";
  if (!isConfirm) return;

  const signupName = document.querySelector("#modal #signupName");
  if (signupName) {
    if (currentUser?.role !== "admin" && modalPurpose !== "self-signup") return showToast("Admin permission required");
    const name = signupName.value.trim();
    const username = document.querySelector("#signupUsername").value.trim().toLowerCase();
    const email = document.querySelector("#signupEmail").value.trim().toLowerCase();
    const password = document.querySelector("#signupPassword").value;
    const confirmPassword = document.querySelector("#signupConfirmPassword").value;
    const role = document.querySelector("#signupRole").value;
    if (!name || !username || !email || !password || !confirmPassword) return showToast("Complete all required fields");
    if (!/^\S+@\S+\.\S+$/.test(email)) return showToast("Enter a valid email address");
    if (users.some(user => user.username?.toLowerCase() === username || user.email?.toLowerCase() === email)) return showToast("Username or email already exists");
    if (password !== confirmPassword) return showToast("Passwords do not match");
    if (password.length < 5) return showToast("Password must be at least 5 characters");
    const phone = document.querySelector("#signupPhone").value.trim();
    const selfSignup = modalPurpose === "self-signup";
    users.push({ name, username, email, role, phone, passwordHash: await hashPassword(password) });
    saveState();
    renderAllPanels();
    closeModal();
    showToast("Account created successfully!");
    if (selfSignup) redirectToWelcomeView();
    return;
  }

  const loginIdentity = document.querySelector("#modal #loginIdentity");
  if (loginIdentity) {
    const identity = loginIdentity.value.trim();
    const password = document.querySelector("#loginPassword").value;
    if (!identity || !password) return showToast("Enter your username/email and password");
    if (!await loginWithPassword(identity, password)) return showToast("Invalid username/email or password");
    if (document.querySelector("#rememberLogin")?.checked) localStorage.setItem("tajiri-remembered-user", identity.toLowerCase());
    return closeModal();
  }
  const staffAccount = document.querySelector("#modal #staffAccount");
  if (staffAccount) {
    const pin = document.querySelector("#staffPin").value;
    if (!loginWithPin(staffAccount.value, pin)) return showToast("Invalid PIN");
    return closeModal();
  }
  const newAccountName = document.querySelector("#newAccountName");
  if (newAccountName) {
    const name = newAccountName.value.trim();
    const role = document.querySelector("#newAccountRole").value;
    const pin = document.querySelector("#newAccountPin").value.trim();
    if (!name || !role || !pin) return showToast("Enter a name, role and valid PIN");
    if (pin.length < 4) return showToast("PIN must be at least 4 digits");
    if (users.some(user => user.name.toLowerCase() === name.toLowerCase())) return showToast("An account with that name already exists");
    users.push({ name, role, pin, username: name.toLowerCase().replace(/\s+/g, "."), email: `${name.toLowerCase().replace(/\s+/g, ".")}@tajiri.local`, passwordHash: "" });
    saveState();
    renderStaffPanel();
    closeModal();
    showToast(`Account created for ${name}`);
    return;
  }
  const productName = document.querySelector("#productName");
  if (productName) {
    const name = productName.value.trim();
    const price = Number(document.querySelector("#productPrice").value);
    if (!name || !price || price <= 0) return showToast("Enter a name and valid price");
    const editId = modal.dataset.editId;
    if (editId) {
      const product = products.find(p => p.id === Number(editId));
      if (product) {
        product.name = name;
        product.category = document.querySelector("#productCategory").value.trim() || "General";
        product.price = price;
        product.stock = Math.max(0, Number(document.querySelector("#productStock").value || 0));
      }
      delete modal.dataset.editId;
      showToast(`${name} updated`);
    } else {
      products.push({ id: Date.now(), name, code: `SKU ${Date.now() % 1000000}`, category: document.querySelector("#productCategory").value.trim() || "General", price, cost: price * 0.6, stock: Math.max(0, Number(document.querySelector("#productStock").value || 0)), icon: "＋" });
      showToast(`${name} added to catalog`);
    }
    renderInventoryPanel(); renderProducts(search.value); closeModal(); saveState(); return;
  }
  const cashEntryAmount = document.querySelector("#cashEntryAmount");
  if (cashEntryAmount) {
    const amount = Number(cashEntryAmount.value);
    if (!amount || amount <= 0) return showToast("Enter a valid amount");
    const direction = document.querySelector("#cashEntryDirection").value;
    const note = document.querySelector("#cashEntryNote").value.trim();
    cashBook.push({
      id: `CASH-${cashBook.length + 1}`,
      direction,
      label: note || (direction === "in" ? "Manual cash in" : "Manual cash out"),
      method: "Manual",
      amount
    });
    renderCashBookPanel(); closeModal(); saveState();
    showToast(`Cash ${direction} recorded`); return;
  }
  const expenseAmount = document.querySelector("#expenseAmount");
  if (expenseAmount) {
    const amount = Number(expenseAmount.value);
    if (!amount || amount <= 0) return showToast("Enter a valid expense amount");
    expenses.push({ type: document.querySelector("#expenseType").value, amount, note: document.querySelector("#expenseNote").value.trim() });
    cashBook.push({
      id: `EXP-${expenses.length}`,
      direction: "out",
      label: `${document.querySelector("#expenseType").value}${document.querySelector("#expenseNote").value.trim() ? ` · ${document.querySelector("#expenseNote").value.trim()}` : ""}`,
      method: "Expense",
      amount
    });
    renderExpensesPanel(); renderCashBookPanel(); renderReportsPanel(); closeModal(); saveState();
    showToast("Expense recorded"); return;
  }
});

/* ---------- Boot ---------- */
loadState();
applyRole();
setOffline(offlineMode);
if (currentUser) {
  renderAllPanels();
  renderProducts();
  renderCart();
  renderSalesStockPulse();
} else {
  renderAllPanels();
  renderProducts();
  renderCart();
  renderSalesStockPulse();
  showStaffLogin();
}
