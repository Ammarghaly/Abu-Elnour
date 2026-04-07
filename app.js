import { db, ref, onValue } from "./firebase.js";

const CART_STORAGE_KEY = "abu_al_nour_cart";
const PENDING_ORDER_KEY = "abu_al_nour_pending_order";
const WHATSAPP_NUMBER = "201065302088"; 

// index.html elements
const productsGrid = document.getElementById('productsGrid');
const categoryTabs = document.getElementById('categoryTabs');
const searchInput = document.getElementById('searchInput');
const loading = document.getElementById('loading');

// cart.html elements
const cartContainer = document.getElementById('cartItems');
const cartTotalEl = document.getElementById('cartTotal');
const checkoutBtn = document.getElementById('checkoutBtn');
const clearCartBtn = document.getElementById('clearCartBtn');

// Invoice elements
const invoiceBackdrop = document.getElementById('invoiceBackdrop');
const closeInvoiceBtn = document.getElementById('closeInvoiceBtn');
const confirmSendBtn = document.getElementById('confirmSendBtn');
const invoiceSummary = document.getElementById('invoiceSummary');

let allProducts = [];
let activeCategory = 'all';

// Real-time Fetch from Firebase Realtime Database
function init() {
  const productsRef = ref(db, "Abu_Elnour/products");
  
  onValue(productsRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      const actualData = data.products ? data.products : data;
      allProducts = Object.entries(actualData).map(([id, p]) => ({
        id,
        ...p
      })).reverse();
    } else {
      allProducts = [];
    }
    
    // Page specific rendering
    if (productsGrid) {
      renderCategories();
      renderProducts();
    }
    if (cartContainer) {
      buildCartView();
    }
    
    if (loading) loading.style.display = 'none';
    updateCartBadge();
  }, (error) => {
    console.error("Realtime DB error:", error);
    if (loading) loading.innerHTML = "❌ فشل تحميل المنيو. يرجى التحقق من الشبكة (Rules).";
  });
}

// ---------------- MENU PAGE LOGIC ----------------

function renderCategories() {
  if (!categoryTabs) return;
  const categories = [...new Set(allProducts.map(p => p.category))];
  const currentActive = categoryTabs.querySelector('.tab.active')?.dataset.category || 'all';
  
  categoryTabs.innerHTML = `<button class="tab ${currentActive === 'all' ? 'active' : ''}" data-category="all">الكل</button>`;
  
  categories.forEach(cat => {
    if (!cat) return;
    const btn = document.createElement('button');
    btn.className = `tab ${currentActive === cat ? 'active' : ''}`;
    btn.dataset.category = cat;
    btn.textContent = cat;
    categoryTabs.appendChild(btn);
  });

  categoryTabs.querySelectorAll('.tab').forEach(btn => {
    btn.onclick = () => {
      categoryTabs.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCategory = btn.dataset.category;
      renderProducts();
    };
  });
}

function renderProducts() {
  if (!productsGrid) return;
  const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
  
  const filtered = allProducts.filter(p => {
    const categoryName = p.category || 'عام';
    const productName = p.name || '';
    
    const matchesCategory = activeCategory === 'all' || categoryName === activeCategory;
    const matchesSearch = productName.toLowerCase().includes(searchTerm);
    return matchesCategory && matchesSearch;
  });

  productsGrid.innerHTML = '';
  
  if (filtered.length === 0) {
    productsGrid.innerHTML = '<div class="no-results">لا توجد أطباق مطابقة للبحث.</div>';
    return;
  }

  filtered.forEach(p => {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      <div class="card-img-wrapper">
        <div class="price-tag">${p.price} ج.م</div>
        <img src="${p.image}" class="card-img" alt="${p.name}" loading="lazy">
      </div>
      <div class="card-body">
        <div class="card-cat">${p.category || 'عام'}</div>
        <div class="card-title">${p.name}</div>
        <button class="add-to-cart-btn" data-add="${p.id}">
          <span>إضافة للسلة</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="9" cy="21" r="1"></circle>
            <circle cx="20" cy="21" r="1"></circle>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
          </svg>
        </button>
      </div>
    `;
    productsGrid.appendChild(card);
  });

  // Attach add to cart events
  productsGrid.querySelectorAll("[data-add]").forEach(btn => {
    btn.onclick = (e) => {
      const id = e.currentTarget.getAttribute("data-add");
      addToCart(id);
    };
  });
}

if (searchInput) {
  searchInput.oninput = renderProducts;
}

// ---------------- CART LOGIC ----------------

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
  const existing = cart.find(item => item.id === productId);
  if (existing) {
    existing.qty += 1;
  } else {
    // Only add if product exists in DB
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;
    cart.push({ id: productId, qty: 1 });
  }
  saveCart(cart);
  updateCartBadge();
  
  // Optional: show a small toast or visual feedback
  const badge = document.getElementById("cartCount");
  if(badge) {
    badge.style.transform = "scale(1.5)";
    setTimeout(() => badge.style.transform = "scale(1)", 200);
  }
}

function updateCartBadge() {
  const el = document.getElementById("cartCount");
  if (!el) return;
  const cart = loadCart();
  const count = cart.reduce((sum, item) => sum + item.qty, 0);
  el.textContent = count;
}

function buildCartView() {
  if (!cartContainer || !cartTotalEl) return;
  const cart = loadCart();

  if (!cart.length) {
    cartContainer.innerHTML = `
      <div class="empty-cart">
        <div class="empty-icon">🛒</div>
        <p>السلة فارغة الآن.</p>
        <span>أضف أطباقك المفضلة من القائمة.</span>
      </div>`;
    cartTotalEl.textContent = "0.00 ج.م";
    return;
  }

  cartContainer.innerHTML = "";
  let total = 0;

  cart.forEach((item, index) => {
    const product = allProducts.find((p) => p.id === item.id);
    if (!product) return; // if product was deleted from DB
    
    const itemTotal = product.price * item.qty;
    total += itemTotal;

    const row = document.createElement("article");
    row.className = "cart-item";
    row.style.animationDelay = `${index * 0.1}s`;
    
    row.innerHTML = `
      <div class="cart-item-image">
        <img src="${product.image}" alt="${product.name}" />
      </div>
      <div class="cart-item-info">
        <h3 class="cart-item-title">${product.name}</h3>
        <div class="cart-item-footer">
          <span class="cart-item-price">${itemTotal.toFixed(2)} ج.م</span>
          <div class="cart-item-qty">
            <button class="qty-btn" data-dec="${product.id}">-</button>
            <span>${item.qty}</span>
            <button class="qty-btn" data-inc="${product.id}">+</button>
          </div>
        </div>
      </div>
      <button class="remove-btn" data-remove="${product.id}">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button>
    `;
    cartContainer.appendChild(row);
  });

  cartTotalEl.textContent = total.toFixed(2) + " ج.م";

  cartContainer.querySelectorAll("[data-inc]").forEach(btn => {
    btn.onclick = (e) => changeQty(e.currentTarget.getAttribute("data-inc"), 1);
  });

  cartContainer.querySelectorAll("[data-dec]").forEach(btn => {
    btn.onclick = (e) => changeQty(e.currentTarget.getAttribute("data-dec"), -1);
  });

  cartContainer.querySelectorAll("[data-remove]").forEach(btn => {
    btn.onclick = (e) => removeItem(e.currentTarget.getAttribute("data-remove"));
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
}

function removeItem(productId) {
  let cart = loadCart();
  cart = cart.filter((item) => item.id !== productId);
  saveCart(cart);
  buildCartView();
}

if (clearCartBtn) {
  clearCartBtn.onclick = () => {
    if(confirm("هل أنت متأكد من تفريغ السلة؟")) {
      saveCart([]);
      buildCartView();
    }
  };
}

// ---------------- WHATSAPP CHECKOUT LOGIC ----------------

function buildOrderFromCart() {
  const cart = loadCart();
  if (!cart.length) return null;

  const items = cart.map(item => {
    const product = allProducts.find(p => p.id === item.id);
    if (!product) return null;
    return {
      name: product.name,
      qty: item.qty,
      price: product.price,
      total: product.price * item.qty,
    };
  }).filter(Boolean);

  if (!items.length) return null;
  const total = items.reduce((sum, it) => sum + it.total, 0);

  return { items, total };
}

if (checkoutBtn) {
  checkoutBtn.onclick = () => {
    const order = buildOrderFromCart();
    if (!order) {
      alert("السلة فارغة حالياً.");
      return;
    }
    
    // Show invoice modal
    if (!invoiceBackdrop || !invoiceSummary) return;
    
    const listItems = order.items.map(it => `
      <div class="receipt-item">
        <span class="receipt-item-name">${it.name} (x${it.qty})</span>
        <span class="receipt-item-total">${it.total.toFixed(2)} ج.م</span>
      </div>`).join("");

    invoiceSummary.innerHTML = `
      <div class="summary-heading">تفاصيل الطلب</div>
      ${listItems}
      <hr class="receipt-divider" />
      <div class="receipt-total-row">
        <span class="total-label">إجمالي الطلبات (بدون التوصيل)</span>
        <span class="total-amount">${order.total.toFixed(2)} ج.م</span>
      </div>
    `;
    invoiceBackdrop.classList.remove('hidden');
  };
}

if (closeInvoiceBtn) {
  closeInvoiceBtn.onclick = () => invoiceBackdrop.classList.add('hidden');
}

if (confirmSendBtn) {
  confirmSendBtn.onclick = () => {
    const nameEl = document.getElementById("customerName");
    const addressEl = document.getElementById("customerAddress");
    const notesEl = document.getElementById("customerNotes");

    const name = nameEl?.value.trim() || "";
    const address = addressEl?.value.trim() || "";
    const notes = notesEl?.value.trim() || "";

    if (!name) return alert("من فضلك اكتب اسمك للطلب.");
    if (!address) return alert("من فضلك اكتب العنوان بالتفصيل للتوصيل.");

    const order = buildOrderFromCart();
    if (!order) return;

    // Build Whatsapp Message
    const RLM = "\u200F"; 
    const orderId = Math.floor(Math.random() * 9000) + 1000;
    const now = new Date();
    const time = now.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
    const day = now.toLocaleDateString("ar-EG", { weekday: "long" });

    const lines = [];
    lines.push(`${RLM}🍟 مطعم أبو النور`);
    lines.push(`${RLM}──────────────`);
    lines.push(`${RLM}طلب رقم : #${orderId}`);
    lines.push(`${RLM}التوقيت : ${time} — ${day}`);
    lines.push(`${RLM}──────────────`);
    lines.push(`${RLM}👤 الاسم : ${name}`);
    lines.push(`${RLM}📍 العنوان : ${address}`);
    lines.push(`${RLM}──────────────`);
    lines.push(`${RLM}🧾 الطلب :`);
    lines.push("");

    order.items.forEach(it => {
      lines.push(`${RLM}🔸 ${it.name}`);
      lines.push(`${RLM}   ${it.qty}x ←  ${it.total.toFixed(2)} ج.م`);
    });

    lines.push(`${RLM}──────────────`);
    lines.push(`${RLM}💰 إجمالي الحساب : *${order.total.toFixed(2)} ج.م* (السعر بدون خدمة التوصيل)`);

    if (notes) {
      lines.push("");
      lines.push(`${RLM}📝 ملاحظات إضافية : ${notes}`);
    }

    const text = encodeURIComponent(lines.join("\n"));
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${text}`, "_blank");

    // Success clear cart
    saveCart([]);
    if (cartContainer) buildCartView();
    invoiceBackdrop.classList.add('hidden');
  };
}

// ---------------- INITIALIZE ----------------
// ---------------- PWA INSTALL LOGIC ----------------
let deferredPrompt;
const installPopup = document.getElementById('installPopup');
const installBtn = document.getElementById('installBtn');
const closeInstall = document.getElementById('closeInstall');

window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent Chrome 67 and earlier from automatically showing the prompt
  e.preventDefault();
  // Stash the event so it can be triggered later.
  deferredPrompt = e;
  // Show the install popup
  if (installPopup) {
    installPopup.classList.remove('hidden');
  }
});

if (installBtn) {
  installBtn.onclick = async () => {
    if (!deferredPrompt) return;
    // Show the prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    // We've used the prompt, and can't use it again, throw it away
    deferredPrompt = null;
    // Hide the popup
    installPopup.classList.add('hidden');
  };
}

if (closeInstall) {
  closeInstall.onclick = () => {
    installPopup.classList.add('hidden');
  };
}

init();
