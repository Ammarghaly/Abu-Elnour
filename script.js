const API_URL = "https://script.google.com/macros/s/AKfycbyWcvE5oAnepW-1Rr9b-KylFKCOCTP0W08M3P1ZQla958gkTuLRfWZqcZHc53r6PCkG/exec";
const DATA_SOURCE_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSPx3sBqlsb5CF94sqq9fOYBiqPTfOu7XF5TFAwE3CrlzAA59V2Q3xsccp2L13PEZmht9vHP_32CICI/pub?output=csv";
const CART_STORAGE_KEY = "abu_al_nour_cart";
const PENDING_ORDER_KEY = "abu_al_nour_pending_order";
const WHATSAPP_NUMBER = "201120660784"; 
const CURRENCY_LABEL = "ج.م";

let PRODUCTS = [];

/**
 * دالة بسيطة لتحويل نصوص الـ CSV إلى مصفوفة كائنات
 */
function parseCSV(csvText) {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  
  return lines.slice(1).map(line => {
    // معالجة بسيطة للفواصل (لا تدعم الفواصل داخل الاقتباسات بشكل معقد ولكن كافية لهيكلية المنيو)
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const item = {};
    headers.forEach((h, i) => {
      item[h] = values[i] || "";
    });
    return item;
  });
}

function normalizeCategoryKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي");
}

function parsePrice(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value == null) return 0;

  const normalized = String(value).replace(",", ".");
  const numeric = normalized.match(/-?\d+(\.\d+)?/);
  if (!numeric) return 0;

  const result = Number(numeric[0]);
  return Number.isFinite(result) ? result : 0;
}

function formatPrice(value) {
  const n = Number(value || 0);
  return `${n.toFixed(2)} ${CURRENCY_LABEL}`;
}

function normalizeImageUrl(value, name, category) {
  let raw = String(value || "").trim();
  if (!raw) return svgDataUri({ title: name, subtitle: category });

  // إذا الرابط بدأ بدون بروتوكول
  if (raw.startsWith("//")) raw = `https:${raw}`;
  if (!/^https?:\/\//i.test(raw) && /^images\./i.test(raw)) {
    raw = `https://${raw}`;
  }

  // تنظيف خاص بروابط Unsplash الناقصة
  if (raw.includes("images.unsplash.com/photo-")) {
    const match = raw.match(/photo-([^?&/]+)/);
    if (match) {
      raw = `https://images.unsplash.com/photo-${match[1]}?w=800&q=80&fit=crop&auto=format`;
    }
  }

  return raw;
}

function svgDataUri({ title, subtitle }) {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
  <defs>
    <rect id="rect" width="1200" height="800" fill="#000"/>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#d4af37"/>
      <stop offset="60%" stop-color="#b4883b"/>
      <stop offset="100%" stop-color="#000"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="15" flood-color="#d4af37" flood-opacity="0.1"/>
    </filter>
  </defs>
  <rect width="1200" height="800" fill="#000"/>
  <circle cx="980" cy="160" r="220" fill="rgba(212,175,55,0.05)"/>
  <circle cx="220" cy="650" r="260" fill="rgba(255,255,255,0.02)"/>

  <g filter="url(#shadow)">
    <rect x="84" y="92" width="1032" height="616" rx="80" fill="#111" stroke="#d4af37" stroke-width="4"/>
    <rect x="120" y="140" width="180" height="180" rx="40" fill="url(#gold)"/>
    <text x="210" y="248" text-anchor="middle" font-size="86" font-family="Segoe UI, Arial" fill="#000">🍟</text>

    <text x="340" y="220" font-size="66" font-weight="900" font-family="Cairo, Segoe UI, Arial" fill="#d4af37">${escapeXml(
      title,
    )}</text>
    <text x="340" y="290" font-size="34" font-family="Cairo, Segoe UI, Arial" fill="rgba(255,255,255,0.5)">${escapeXml(
      subtitle,
    )}</text>
  </g>
</svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function escapeXml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function normalizeProduct(raw, index) {
  // مطابقة الحقول من الـ CSV (حيث الحروف كبيرة وصغيرة حسب الجدول)
  const name = raw.Name || raw.name || "منتج";
  const price = parsePrice(raw.price || raw.Price || 0);
  const description = raw.description || raw.Description || "";
  const category = raw.Category || raw.category || "عام";
  const categoryKey = normalizeCategoryKey(category);
  const image = normalizeImageUrl(raw.Image || raw.image, name, category);

  return {
    id: `api-${index}`,
    name,
    nameAr: name,
    category,
    categoryKey,
    price,
    description,
    image,
  };
}
async function ensureProductsLoaded() {
  if (PRODUCTS.length) return PRODUCTS;

  try {
    // نستخدم الـ CSV كونه يدعم الـ CORS بشكل ممتاز ومستقر
    const url = `${DATA_SOURCE_CSV}&t=${Date.now()}`;
    const res = await fetch(url, { cache: "no-store" });
    const csvText = await res.text();
    const data = parseCSV(csvText);
    
    PRODUCTS = Array.isArray(data)
      ? data.map((item, idx) => normalizeProduct(item, idx))
      : [];
  } catch (err) {
    console.error("Failed to fetch products via CSV", err);
    PRODUCTS = [];
  }

  return PRODUCTS;
}


function loadCart() {
  try {
    const data = localStorage.getItem(CART_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
}

function addToCart(productId) {
  const cart = loadCart();
  const existing = cart.find((item) => item.id === productId);
  if (existing) {
    existing.qty += 1;
  } else {
    const product = PRODUCTS.find((p) => p.id === productId);
    if (!product) return;
    cart.push({ id: product.id, qty: 1 });
  }
  saveCart(cart);
  updateCartBadge();
}

function updateCartBadge() {
  const el = document.getElementById("cartCount");
  if (!el) return;
  const cart = loadCart();
  const count = cart.reduce((sum, item) => sum + item.qty, 0);
  el.textContent = count;
}

function buildCategoryTabs() {
  const nav = document.getElementById("categoryTabs");
  if (!nav) return;

  nav.innerHTML = "";

  const allBtn = document.createElement("button");
  allBtn.className = "tab active";
  allBtn.dataset.category = "all";
  allBtn.textContent = "الكل";
  nav.appendChild(allBtn);

  const uniqueCategories = [];
  const seen = new Set();
  PRODUCTS.forEach((p) => {
    const key = p.categoryKey || normalizeCategoryKey(p.category);
    if (!key || seen.has(key)) return;
    seen.add(key);
    uniqueCategories.push({ key, label: p.category });
  });

  uniqueCategories.forEach((cat) => {
    const btn = document.createElement("button");
    btn.className = "tab";
    btn.dataset.category = cat.key;
    btn.textContent = cat.label;
    nav.appendChild(btn);
  });

  const tabs = nav.querySelectorAll(".tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      renderProducts();
    });
  });
}

function renderProducts() {
  const grid = document.getElementById("productsGrid");
  if (!grid) return;

  const activeTab = document.querySelector(".tab.active");
  const category = activeTab ? activeTab.dataset.category : "all";

  const search = document
    .getElementById("searchInput")
    ?.value.toLowerCase()
    .trim();

  const filtered = PRODUCTS.filter((p) => {
    const matchesCategory = category === "all" || p.categoryKey === category;
    const text = (
      p.name +
      " " +
      (p.nameAr || "") +
      " " +
      p.description
    ).toLowerCase();
    const matchesSearch = !search || text.includes(search);
    return matchesCategory && matchesSearch;
  });

  grid.innerHTML = "";
  
  const fragment = document.createDocumentFragment();

  filtered.forEach((product) => {
    const card = document.createElement("article");
    card.className = "product-card";
    card.innerHTML = `
      <div class="product-image-wrapper">
      <img src="${product.image}" 
     alt="${product.name}" 
     class="product-image" 
     loading="lazy"
     referrerpolicy="no-referrer" />
        <div class="product-overlay"></div>
        <div class="price-badge">${formatPrice(product.price)}</div>
      </div>
      <div class="product-content">
        <h2 class="product-title">${product.name}</h2>
        <div class="card-actions">
          <button class="primary-btn" data-add="${product.id}">إضافة للسلة</button>
        </div>
      </div>
    `;
    fragment.appendChild(card);

    const img = card.querySelector(".product-image");
    if (img) {
      img.addEventListener("error", () => {
        img.src = svgDataUri({
          title: product.name,
          subtitle: product.category || "Menu item",
        });
      });
    }
  });
  
  grid.appendChild(fragment);

  grid.querySelectorAll("[data-add]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = e.currentTarget.getAttribute("data-add");
      if (!id) return;
      addToCart(id);
    });
  });
}

function setupSearch() {
  const input = document.getElementById("searchInput");
  if (!input) return;
  
  let debounceTimeout;
  input.addEventListener("input", () => {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      renderProducts();
    }, 300);
  });
}

function buildCartView() {
  const container = document.getElementById("cartItems");
  const totalEl = document.getElementById("cartTotal");
  if (!container || !totalEl) return;

  const cart = loadCart();

  if (!cart.length) {
    container.innerHTML =
      '<div class="empty-state">السلة فارغة الآن.<br /><span class="pill-highlight">أضف أطباقك المفضلة من القائمة.</span></div>';
    totalEl.textContent = formatPrice(0);
    return;
  }

  container.innerHTML = "";
  let total = 0;

  cart.forEach((item, index) => {
    const product = PRODUCTS.find((p) => p.id === item.id);
    if (!product) return;
    const itemTotal = product.price * item.qty;
    total += itemTotal;

    const row = document.createElement("article");
    row.className = "cart-item";
    row.style.animationDelay = `${index * 0.1}s`; // Staggered entrance
    row.innerHTML = `
      <div class="cart-item-image">
        <img src="${product.image}" alt="${product.name}" />
      </div>
      <div class="cart-item-info">
        <h3 class="cart-item-title">${product.name}</h3>
        <div class="cart-item-footer">
          <span class="cart-item-price">${formatPrice(itemTotal)}</span>
          <div class="cart-item-qty">
            <button class="qty-btn" data-dec="${product.id}">-</button>
            <span style="min-width: 20px; text-align: center; color: var(--primary-gold); font-weight: 700;">${item.qty}</span>
            <button class="qty-btn" data-inc="${product.id}">+</button>
            <button class="remove-btn" data-remove="${product.id}" style="border: none; background: transparent; color: #ff4757; font-size: 11px; cursor: pointer; margin-inline-start: 10px;">حذف</button>
          </div>
        </div>
      </div>
    `;
    container.appendChild(row);
  });

  totalEl.textContent = formatPrice(total);

  container.querySelectorAll("[data-inc]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = e.currentTarget.getAttribute("data-inc");
      changeQty(id, 1);
    });
  });

  container.querySelectorAll("[data-dec]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = e.currentTarget.getAttribute("data-dec");
      changeQty(id, -1);
    });
  });

  container.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = e.currentTarget.getAttribute("data-remove");
      removeItem(id);
    });
  });
}

function changeQty(productId, delta) {
  let cart = loadCart();
  const idx = cart.findIndex((item) => item.id === productId);
  if (idx === -1) return;
  cart[idx].qty += delta;
  if (cart[idx].qty <= 0) {
    cart.splice(idx, 1);
  }
  saveCart(cart);
  buildCartView();
  updateCartBadge();
}

function removeItem(productId) {
  let cart = loadCart();
  cart = cart.filter((item) => item.id !== productId);
  saveCart(cart);
  buildCartView();
  updateCartBadge();
}

function clearCart() {
  saveCart([]);
  buildCartView();
  updateCartBadge();
}

function buildOrderFromCart() {
  const cart = loadCart();
  if (!cart.length) return null;

  const items = cart
    .map((item) => {
      const product = PRODUCTS.find((p) => p.id === item.id);
      if (!product) return null;
      const lineTotal = product.price * item.qty;
      return {
        id: product.id,
        name: product.name,
        qty: item.qty,
        price: product.price,
        total: lineTotal,
      };
    })
    .filter(Boolean);

  if (!items.length) return null;

  const total = items.reduce((sum, it) => sum + it.total, 0);

  return {
    createdAt: new Date().toISOString(),
    items,
    total,
  };
}

function showInvoice(order) {
  const backdrop = document.getElementById("invoiceBackdrop");
  const summaryEl = document.getElementById("invoiceSummary");
  const addressEl = document.getElementById("customerAddress");
  if (!backdrop || !summaryEl || !order || !Array.isArray(order.items)) return;

  const listItems = order.items
    .map(
      (it) =>
        `<li><span>${it.name} × ${it.qty}</span><span>${formatPrice(
          it.total,
        )}</span></li>`,
    )
    .join("");

  summaryEl.innerHTML = `
    <p>سيتم إرسال الطلب التالي إلى الواتساب:</p>
    <ul>${listItems}</ul>
    <div class="invoice-total-row">
      <span>الإجمالي</span>
      <span>${formatPrice(order.total)}</span>
    </div>
  `;

  if (addressEl) {
    addressEl.value = order.address || "";
  }

  backdrop.hidden = false;
}

function hideInvoice() {
  const backdrop = document.getElementById("invoiceBackdrop");
  if (backdrop) backdrop.hidden = true;
}

function loadPendingOrder() {
  try {
    const raw = localStorage.getItem(PENDING_ORDER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // تجاهل أي نسخة قديمة/فاسدة من الفاتورة
    if (!parsed || !Array.isArray(parsed.items) || !parsed.items.length) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function savePendingOrder(order) {
  localStorage.setItem(PENDING_ORDER_KEY, JSON.stringify(order));
}

function clearPendingOrder() {
  localStorage.removeItem(PENDING_ORDER_KEY);
}

function sendOrderViaWhatsApp(order) {
  if (!order || !order.items?.length) return;

  const RLM = "\u200F"; // يجبر كل سطر يبدأ من اليمين
  const orderId = Math.floor(Math.random() * 9000) + 1000;
  const now = new Date();
  const time = now.toLocaleTimeString("ar-EG", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const day = now.toLocaleDateString("ar-EG", { weekday: "long" });

  const lines = [];

  lines.push(`${RLM}🍟 مطعم أبو النور`);
  lines.push(`${RLM}──────────────`);
  lines.push(`${RLM}طلب رقم : #${orderId}`);
  lines.push(`${RLM}التوقيت : ${time} — ${day}`);
  lines.push(`${RLM}──────────────`);
  lines.push(`${RLM}👤 الاسم`);
  lines.push(`${RLM}   ${order.customerName}`);
  lines.push(`${RLM}📍 العنوان`);
  lines.push(`${RLM}   ${order.address}`);
  lines.push(`${RLM}──────────────`);
  lines.push(`${RLM}🧾 الطلب`);
  lines.push("");

  order.items.forEach((it) => {
    lines.push(`${RLM}   ${it.name}`);
    lines.push(`${RLM}   ${it.qty}  ←  ${formatPrice(it.total)}`);
    lines.push("");
  });

  lines.push(`${RLM}──────────────`);
  lines.push(`${RLM}💰 الإجمالي الكلي : *${formatPrice(order.total)}*`);

  if (order.notes) {
    lines.push("");
    lines.push(`${RLM}📝 ملاحظات : ${order.notes}`);
  }

  const text = encodeURIComponent(lines.join("\n"));
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${text}`, "_blank");
}

document.addEventListener("DOMContentLoaded", () => {
  updateCartBadge();

  // صفحة القائمة
  if (document.getElementById("productsGrid")) {
    (async () => {
      const grid = document.getElementById("productsGrid");
      grid.innerHTML = '<div style="text-align:center; padding: 40px; color: #d4af37;">جاري تحميل القائمة...</div>';
      await ensureProductsLoaded();
      buildCategoryTabs();
      setupSearch();
      renderProducts();
    })();
  }

  // صفحة السلة
  if (document.getElementById("cartItems")) {
    (async () => {
      await ensureProductsLoaded();
      buildCartView();

      const clearBtn = document.getElementById("clearCartBtn");
      const checkoutBtn = document.getElementById("checkoutBtn");
      const closeInvoiceBtn = document.getElementById("closeInvoiceBtn");
      const confirmSendBtn = document.getElementById("confirmSendBtn");

      if (clearBtn) {
        clearBtn.addEventListener("click", () => {
          clearCart();
          clearPendingOrder();
        });
      }

      if (checkoutBtn) {
        checkoutBtn.addEventListener("click", () => {
          const order = buildOrderFromCart();
          if (!order) {
            alert("السلة فارغة حالياً.");
            return;
          }
          savePendingOrder(order);
          showInvoice(order);
        });
      }

      if (closeInvoiceBtn) {
        closeInvoiceBtn.addEventListener("click", hideInvoice);
      }

      if (confirmSendBtn) {
        confirmSendBtn.addEventListener("click", () => {
          const nameEl = document.getElementById("customerName");
          const addressEl = document.getElementById("customerAddress");
          const notesEl = document.getElementById("customerNotes");

          const name = nameEl?.value.trim() || "";
          const address = addressEl?.value.trim() || "";
          const notes = notesEl?.value.trim() || "";

          if (!name) {
            alert("من فضلك اكتب اسم العميل.");
            return;
          }
          if (!address) {
            alert("من فضلك اكتب العنوان.");
            return;
          }

          const order = loadPendingOrder() || buildOrderFromCart();
          if (!order) return;

          order.customerName = name;
          order.address = address;
          order.notes = notes;

          savePendingOrder(order);
          sendOrderViaWhatsApp(order);
          clearCart();
          clearPendingOrder();
          hideInvoice();
        });
      }

      // إذا كان هناك طلب محفوظ مسبقاً أعد عرضه
      const existingOrder = loadPendingOrder();
      if (existingOrder) {
        showInvoice(existingOrder);
      }
    })();
  }
});

