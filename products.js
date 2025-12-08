/* products.js — grid cards + min-qty stepper + quote cart */

// Base URL for your API
const BASE_URL =
  typeof API_BASE !== "undefined"
    ? API_BASE
    : "https://artifyscreens.pythonanywhere.com";

// DOM elements
const container = document.getElementById("productsGrid");
const searchBar = document.getElementById("searchBar");
const categorySelect = document.getElementById("categorySelect");
const paginationEl = document.getElementById("pagination");

// Cart UI
const cartBar = document.getElementById("cartBar");
const cartBarButton = document.getElementById("cartBarButton");
const cartCountEl = document.getElementById("cartCount");
const cartTotalEl = document.getElementById("cartTotal");

const cartDrawer = document.getElementById("cartDrawer");
const cartItemsEl = document.getElementById("cartItems");
const cartSubtotalText = document.getElementById("cartSubtotalText");
const cartSubtotalAmount = document.getElementById("cartSubtotalAmount");
const cartDrawerClose = document.getElementById("cartDrawerClose");
const cartProceedBtn = document.getElementById("cartProceed");

// State
let state = {
  query: "",
  category: "",
  page: 1,
  pageSize: 12
};

// Cart: key -> { name, price, qty, minQty }
let cart = {};
let siteWhatsApp = "919999999999";

/* ---------- HELPERS ---------- */
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getProductKey(p) {
  return p.id ?? p.slug ?? p.sku ?? p.title;
}

/* ---------- DESCRIPTION CLAMP + IMAGE MODAL ---------- */
const extraStyle = document.createElement("style");
extraStyle.innerHTML = `
  .desc-clamp {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    cursor: pointer;
    transition: all 0.3s ease;
  }
  .desc-expanded {
    -webkit-line-clamp: unset !important;
  }
  #imgModal {
    display: none;
    position: fixed;
    z-index: 10000;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0,0,0,0.9);
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.3s ease;
  }
  #imgModal.show { opacity: 1; }
  #imgModal img {
    max-width: 90%;
    max-height: 90%;
    border-radius: 8px;
    box-shadow: 0 0 20px rgba(0,0,0,0.5);
    transform: scale(0.9);
    transition: transform 0.3s ease;
  }
  #imgModal.show img { transform: scale(1); }
  #imgModal .close {
    position: absolute;
    top: 20px;
    right: 35px;
    color: #f1f1f1;
    font-size: 40px;
    font-weight: bold;
    cursor: pointer;
    z-index: 10001;
  }
`;
document.head.appendChild(extraStyle);

const modalHtml = `
<div id="imgModal">
  <span class="close" onclick="closeModal()">&times;</span>
  <img id="fullImage" src="" alt="Fullscreen" />
</div>`;
document.body.insertAdjacentHTML("beforeend", modalHtml);

window.toggleDesc = function (el) {
  el.classList.toggle("desc-expanded");
};
window.openModal = function (url) {
  if (!url) return;
  const modal = document.getElementById("imgModal");
  const img = document.getElementById("fullImage");
  img.src = url;
  modal.style.display = "flex";
  setTimeout(() => modal.classList.add("show"), 10);
};
window.closeModal = function () {
  const modal = document.getElementById("imgModal");
  modal.classList.remove("show");
  setTimeout(() => {
    modal.style.display = "none";
  }, 300);
};
document.addEventListener("click", (e) => {
  const modal = document.getElementById("imgModal");
  if (e.target === modal) window.closeModal();
});

/* ---------- LOAD CONFIG / CATEGORIES / PRODUCTS ---------- */
async function loadConfig() {
  try {
    const res = await fetch(`${BASE_URL}/api/config/`);
    if (res.ok) {
      const data = await res.json();
      if (data.whatsapp_phone) siteWhatsApp = data.whatsapp_phone;
    }
  } catch (e) {
    console.warn("Config load error", e);
  }
}

async function loadCategories() {
  if (!categorySelect) return;
  try {
    const res = await fetch(`${BASE_URL}/api/categories/`);
    if (res.ok) {
      const data = await res.json();
      categorySelect.innerHTML = '<option value="">All Categories</option>';
      if (data.categories) {
        data.categories.forEach((cat) => {
          const opt = document.createElement("option");
          opt.value = cat.slug;
          opt.textContent = cat.name;
          categorySelect.appendChild(opt);
        });
      }
    }
  } catch (e) {
    console.warn("Categories error", e);
  }
}

async function loadProducts() {
  if (!container) return;
  container.innerHTML =
    '<p style="color:white; text-align:center; grid-column:1/-1;">Loading products...</p>';

  try {
    let url = `${BASE_URL}/api/products/?page=${state.page}&page_size=${state.pageSize}`;
    if (state.query) url += `&q=${encodeURIComponent(state.query)}`;
    if (state.category) url += `&category=${encodeURIComponent(state.category)}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Server status: ${res.status}`);

    const data = await res.json();
    renderProducts(data.items || []);
    renderPagination(data.total || 0);
  } catch (e) {
    console.error(e);
    container.innerHTML = `<div style="color:red; text-align:center; grid-column:1/-1;">
      <p>Could not load products.</p>
    </div>`;
  }
}

/* ---------- RENDER PRODUCTS ---------- */
function renderProducts(items) {
  container.innerHTML = "";

  if (!items || items.length === 0) {
    container.innerHTML =
      '<p style="color:#ccc; text-align:center; grid-column:1/-1;">No products found.</p>';
    return;
  }

  items.forEach((p) => {
    const card = document.createElement("article");
    card.className = "product-card-new";

    const imgUrl = p.image_url || "";
    const imgStyle = imgUrl
      ? `background-image: url('${imgUrl}')`
      : "background-color: #0d1117";
    const imgTag = imgUrl
      ? `<img src="${imgUrl}" class="product-img" alt="${escapeHtml(
          p.title
        )}" loading="lazy" onclick="openModal('${imgUrl}')" style="cursor:zoom-in;">`
      : "";

    const priceNum = Number(p.price) || 0;
    const price = priceNum ? `₹${priceNum.toLocaleString("en-IN")}` : "Contact";

    const isAvailable = p.available !== false;
    const stockClass = isAvailable ? "available" : "unavailable";
    const stockText = isAvailable ? "Available" : "Out of Stock";

    const minQty =
      p.min_quantity ||
      p.min_qty ||
      p.moq ||
      p.minimum_order_quantity ||
      1;

    const key = getProductKey(p);
    const existing = cart[key];
    const currentQty = existing ? existing.qty : 0;

    const descHtml = p.description
      ? `<p class="product-mini desc-clamp" title="Click to expand" onclick="toggleDesc(this)">${escapeHtml(
          p.description
        )}</p>`
      : "";

    const lineTotal =
      currentQty && priceNum
        ? `₹${(currentQty * priceNum).toLocaleString("en-IN")}`
        : "";

    card.innerHTML = `
      <div class="img-wrap" style="${imgStyle}">
        ${imgTag}
      </div>
      <div class="product-info">
        <h3 class="product-name">${escapeHtml(p.title)}</h3>
        ${descHtml}
        <p class="min-qty-label">Minimum quantity <strong>${minQty}</strong></p>
        <div class="meta-row">
          <span class="status ${stockClass}">${stockText}</span>
          <span class="price">${price}</span>
        </div>
        <div class="qty-row">
          <div class="qty-control"
               data-id="${escapeHtml(key)}"
               data-min="${minQty}"
               data-step="${minQty}"
               data-price="${priceNum}"
               data-name="${escapeHtml(p.title)}">
            <button class="qty-btn qty-minus">−</button>
            <input class="qty-input" type="text" value="${currentQty || 0}" readonly>
            <button class="qty-btn qty-plus"${
              !isAvailable ? " disabled" : ""
            }>+</button>
          </div>
          <span class="line-total">${lineTotal}</span>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

/* ---------- PAGINATION ---------- */
function renderPagination(totalItems) {
  if (!paginationEl) return;
  paginationEl.innerHTML = "";
  const totalPages = Math.ceil(totalItems / state.pageSize);
  if (totalPages <= 1) return;

  const prev = document.createElement("button");
  prev.className = "page-btn";
  prev.textContent = "<";
  prev.disabled = state.page === 1;
  prev.onclick = () => {
    state.page--;
    loadProducts();
  };
  paginationEl.appendChild(prev);

  const info = document.createElement("span");
  info.style.color = "#fff";
  info.style.margin = "0 10px";
  info.textContent = `${state.page} / ${totalPages}`;
  paginationEl.appendChild(info);

  const next = document.createElement("button");
  next.className = "page-btn";
  next.textContent = ">";
  next.disabled = state.page === totalPages;
  next.onclick = () => {
    state.page++;
    loadProducts();
  };
  paginationEl.appendChild(next);
}

/* ---------- CART + DRAWER ---------- */
function updateCartSummary() {
  let totalItems = 0;
  let totalAmount = 0;

  Object.values(cart).forEach((item) => {
    totalItems += item.qty;
    totalAmount += item.qty * item.price;
  });

  const hasItems = totalItems > 0;
  const drawerOpen = !cartDrawer.classList.contains("cart-hidden");

  if (hasItems && !drawerOpen) {
    cartBar.classList.add("cart-show");
  } else {
    cartBar.classList.remove("cart-show");
  }

  cartCountEl.textContent = totalItems;
  cartTotalEl.textContent = `₹${totalAmount.toLocaleString("en-IN")}`;

  cartSubtotalText.textContent = `Subtotal (${totalItems} items)`;
  cartSubtotalAmount.textContent = `₹${totalAmount.toLocaleString("en-IN")}`;
}

function rebuildCartDrawerItems() {
  cartItemsEl.innerHTML = "";
  const entries = Object.values(cart);
  if (!entries.length) {
    cartItemsEl.innerHTML =
      '<p style="color:#9ca3af; padding:10px 0;">Cart is empty.</p>';
    return;
  }
  entries.forEach((item) => {
    const row = document.createElement("div");
    row.className = "cart-item-row";
    row.innerHTML = `
      <div class="cart-item-main">
        <div class="cart-item-name">${escapeHtml(item.name)}</div>
        <div class="cart-item-meta">Qty: ${item.qty} (step ${item.minQty})</div>
      </div>
      <div class="cart-item-total">₹${(
        item.qty * item.price
      ).toLocaleString("en-IN")}</div>
    `;
    cartItemsEl.appendChild(row);
  });
}

function openCartDrawer() {
  rebuildCartDrawerItems();
  cartDrawer.classList.remove("cart-hidden");
  cartBar.classList.remove("cart-show"); // hide bar while drawer open
  updateCartSummary();
}

function closeCartDrawer() {
  cartDrawer.classList.add("cart-hidden");
  updateCartSummary(); // show bar again if items
}

/* Stepper clicks */
if (container) {
  container.addEventListener("click", (e) => {
    const plus = e.target.closest(".qty-plus");
    const minus = e.target.closest(".qty-minus");
    if (!plus && !minus) return;

    const control = e.target.closest(".qty-control");
    if (!control) return;

    const key = control.dataset.id;
    const minQty = parseInt(control.dataset.min || "1", 10);
    const step = parseInt(control.dataset.step || "1", 10);
    const price = parseFloat(control.dataset.price || "0");
    const name = control.dataset.name || "";

    const input = control.querySelector(".qty-input");
    let qty = parseInt(input.value || "0", 10) || 0;

    if (plus) {
      qty = qty === 0 ? minQty : qty + step;
    } else if (minus) {
      if (qty <= minQty) qty = 0;
      else qty = qty - step;
    }

    input.value = qty;
    const lineTotalEl = control.parentElement.querySelector(".line-total");

    if (!qty) {
      delete cart[key];
      if (lineTotalEl) lineTotalEl.textContent = "";
    } else {
      cart[key] = { name, price, qty, minQty };
      if (lineTotalEl && price) {
        const total = qty * price;
        lineTotalEl.textContent = `₹${total.toLocaleString("en-IN")}`;
      }
    }

    updateCartSummary();
  });
}

/* Drawer open/close */
if (cartBarButton) cartBarButton.addEventListener("click", openCartDrawer);
if (cartDrawerClose) cartDrawerClose.addEventListener("click", closeCartDrawer);
if (cartDrawer) {
  cartDrawer.addEventListener("click", (e) => {
    if (e.target === cartDrawer) closeCartDrawer();
  });
}

/* ---------- NEW: GO TO CHECKOUT PAGE ---------- */
function goToCheckoutPage() {
  const items = Object.values(cart);
  if (!items.length) return;

  let totalAmount = 0;
  items.forEach((i) => (totalAmount += i.qty * i.price));

  const payload = {
    cart: items,
    totalAmount,
    whatsapp: siteWhatsApp
  };

  try {
    localStorage.setItem("cc_checkout_cart", JSON.stringify(payload));
  } catch (err) {
    console.warn("Could not save checkout data", err);
  }

  window.location.href = "checkout.html";
}

if (cartProceedBtn) {
  cartProceedBtn.addEventListener("click", goToCheckoutPage);
}

/* ---------- SEARCH / FILTER EVENTS ---------- */
if (categorySelect) {
  categorySelect.addEventListener("change", (e) => {
    state.category = e.target.value;
    state.page = 1;
    loadProducts();
  });
}
if (searchBar) {
  let t;
  searchBar.addEventListener("input", (e) => {
    clearTimeout(t);
    t = setTimeout(() => {
      state.query = e.target.value.trim();
      state.page = 1;
      loadProducts();
    }, 400);
  });
}

/* ---------- INIT ---------- */
document.addEventListener("DOMContentLoaded", () => {
  loadConfig();
  loadCategories();
  loadProducts();
});
