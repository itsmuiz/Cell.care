/**
 * CELL CARE INDIA — UNIFIED E-COMMERCE & WHATSAPP ORDER ENGINE (store-core.js)
 * Single source of truth: Live Google Sheets API (/api/products -> Apps Script).
 * Ordering: 100% Direct WhatsApp Enquiry (+91 8505910581). No COD, No Razorpay.
 * Brand Theme: Charcoal (#22272B), White (#FFFFFF), Green (#159447).
 */

(function (window, document) {
  "use strict";

  const CART_KEY = "cellcare_cart_v4";
  const WISHLIST_KEY = "cellcare_wishlist_v1";
  const RECENT_KEY = "cellcare_recent_v1";
  const USER_TOKEN_KEY = "cellcare_user_token_v1";
  const USER_DATA_KEY = "cellcare_user_data_v1";
  const CATALOG_CACHE_KEY = "cellcare_gsheet_cache_v6";
  const CACHE_TTL_MS = 60 * 1000;

  const GSHEET_EXEC_FALLBACK =
    (window.CELLCARE_CONFIG && window.CELLCARE_CONFIG.gsheetProductsApi) ||
    "https://script.google.com/macros/s/AKfycbzPASrJpC5dvoFX-R6zX1AfW-pFyg8DIM6D_p9DG4QSI16qyymFXzibseq1rA9r_f-j2g/exec";

  const SITE = {
    name: "Cell Care India",
    domain: "cellcareindia.com",
    phone: "+91 85059 10581",
    whatsapp: "918505910581",
    email: "CellCareIndia2025@gmail.com",
    address: "Shop No. 4, B-32, New Brij Puri, Near Jagatpuri Police Station, New Delhi - 110051",
    hours: "Mon – Sat: 9:30 AM – 7:00 PM",
    social: {
      facebook: "https://www.facebook.com/profile.php?id=61567162763508&mibextid=ZbWKwL",
      instagram: "https://instagram.com/cellcare_india",
      linkedin: "https://www.linkedin.com/in/cell-care-india-931736398",
      youtube: "https://www.youtube.com/@cellcareindia"
    }
  };

  function esc(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatINR(num) {
    const n = Number(num) || 0;
    return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  function formatINRWhole(num) {
    const n = Number(num) || 0;
    return "₹" + Math.round(n).toLocaleString("en-IN");
  }

  function slugify(str) {
    return String(str || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  function shuffleArray(list) {
    const arr = Array.isArray(list) ? [...list] : [];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function formatCategoryLabel(raw) {
    const c = String(raw || "").trim();
    if (!c) return "General";
    if (c.toLowerCase() === "ather") return "Ather";
    if (c.toLowerCase() === "ola") return "OLA";
    if (c.toLowerCase() === "spare parts") return "Spare Parts";
    return c;
  }

  function normalizeClientItem(raw, idx) {
    if (!raw || !raw.title || !String(raw.title).trim()) return null;
    const status = String(raw.status || "Active").trim();
    if (status && status.toLowerCase() !== "active") return null;

    const title = String(raw.title).trim();
    const id = String(raw.id !== undefined && raw.id !== "" ? raw.id : idx + 1).trim();
    const rawSku = raw.sku !== undefined && raw.sku !== null ? String(raw.sku).trim() : "";
    const sku = rawSku || `CC-${id}`;
    const category = formatCategoryLabel(raw.category);
    const brand = String(raw.brand || "CellCare").trim() || "CellCare";
    const price = Number(raw.price) || 0;
    const minQty = Math.max(1, parseInt(raw.min_quantity || 1, 10) || 1);
    const available = raw.available !== false && String(raw.available).toLowerCase() !== "false";
    const rawDesc = String(raw.description || "").trim();
    const cleanDesc = rawDesc.replace(/no\s+cod\s*,?\s*/gi, "").trim() || title;
    const img = String(raw.image_url || "").trim();

    return {
      id,
      sku,
      slug: raw.slug || `${slugify(title)}-${id}`,
      title,
      category,
      category_slug: raw.category_slug || slugify(category),
      brand,
      brands: [brand],
      description: cleanDesc,
      price,
      available,
      min_quantity: minQty,
      image_url: img,
      gallery: img ? [img] : [],
      status
    };
  }

  function getProductUrl(product) {
    const id = encodeURIComponent(product.id);
    try {
      const origin = window.location.origin && window.location.origin !== "null"
        ? window.location.origin
        : "https://cellcareindia.com";
      return `${origin}/product.html?id=${id}`;
    } catch {
      return `https://cellcareindia.com/product.html?id=${id}`;
    }
  }

  let inflightCatalogPromise = null;

  const CellCare = {
    SITE,
    CATEGORIES: [],
    BRANDS: [],
    cart: {},
    wishlist: [],
    recent: [],
    productsCache: [],
    user: null,
    userToken: null,
    esc,
    formatINR,
    formatINRWhole,
    slugify,
    shuffleArray,
    getProductUrl,

    init: function () {
      this.loadState();
      this.injectShell();
      this.bindGlobalEvents();
      this.updateCartUI();
      this.updateWishlistUI();
      this.updateAuthUI();

      this.fetchProducts().then(data => {
        this.productsCache = data.items || [];
        this.populateDynamicNavigation(data.categories || [], data.brands || []);
        this.renderRecentlyViewed();
      });
    },

    // ----------------------------------------------------
    // STATE PERSISTENCE
    // ----------------------------------------------------
    loadState: function () {
      try {
        const rawCart = localStorage.getItem(CART_KEY);
        if (rawCart) this.cart = JSON.parse(rawCart) || {};
      } catch { this.cart = {}; }

      try {
        const rawWish = localStorage.getItem(WISHLIST_KEY);
        if (rawWish) this.wishlist = JSON.parse(rawWish) || [];
      } catch { this.wishlist = []; }

      try {
        const rawRec = localStorage.getItem(RECENT_KEY);
        if (rawRec) this.recent = JSON.parse(rawRec) || [];
      } catch { this.recent = []; }

      try {
        this.userToken = localStorage.getItem(USER_TOKEN_KEY) || null;
        const rawUser = localStorage.getItem(USER_DATA_KEY);
        this.user = rawUser ? JSON.parse(rawUser) : null;
      } catch {
        this.userToken = null;
        this.user = null;
      }
    },

    saveCart: function () {
      try { localStorage.setItem(CART_KEY, JSON.stringify(this.cart)); } catch {}
      this.updateCartUI();
    },

    saveWishlist: function () {
      try { localStorage.setItem(WISHLIST_KEY, JSON.stringify(this.wishlist)); } catch {}
      this.updateWishlistUI();
      if (this.userToken) {
        fetch("/api/users", {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + this.userToken },
          body: JSON.stringify({ wishlist: this.wishlist })
        }).catch(() => {});
      }
    },

    setSession: function (token, user) {
      this.userToken = token;
      this.user = user;
      try {
        if (token) localStorage.setItem(USER_TOKEN_KEY, token);
        else localStorage.removeItem(USER_TOKEN_KEY);
        if (user) localStorage.setItem(USER_DATA_KEY, JSON.stringify(user));
        else localStorage.removeItem(USER_DATA_KEY);
      } catch {}
      this.updateAuthUI();
      this.updateWishlistUI();
    },

    logout: function () {
      this.setSession(null, null);
      this.toast("You have been logged out.");
    },

    // ----------------------------------------------------
    // DYNAMIC GOOGLE SHEETS PRODUCT FETCHER (DEDUPLICATED)
    // ----------------------------------------------------
    deriveFacets: function (items) {
      const catCounts = {};
      const brandCounts = {};
      items.forEach(p => {
        catCounts[p.category] = (catCounts[p.category] || 0) + 1;
        if (p.brand) brandCounts[p.brand] = (brandCounts[p.brand] || 0) + 1;
      });
      const categories = Object.entries(catCounts).map(([name, count]) => ({
        name,
        slug: slugify(name),
        count
      }));
      const brands = Object.entries(brandCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
      return { categories, brands };
    },

    fetchProducts: async function (forceRefresh = false) {
      if (!forceRefresh && this.productsCache.length > 0) {
        const facets = this.deriveFacets(this.productsCache);
        return { ok: true, items: this.productsCache, ...facets };
      }

      if (!forceRefresh) {
        try {
          const cached = sessionStorage.getItem(CATALOG_CACHE_KEY);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0 && Date.now() - (parsed.ts || 0) < CACHE_TTL_MS) {
              this.productsCache = parsed.items;
              this.CATEGORIES = parsed.categories || this.deriveFacets(parsed.items).categories;
              this.BRANDS = parsed.brands || this.deriveFacets(parsed.items).brands;
              return parsed;
            }
          }
        } catch {}
      }

      // Prevent duplicate concurrent API requests on the same page
      if (!forceRefresh && inflightCatalogPromise) {
        return inflightCatalogPromise;
      }

      inflightCatalogPromise = (async () => {
        try {
          // 1. Primary: Live Google Sheets via serverless /api/products
          const apiUrl = forceRefresh ? "/api/products?refresh=1" : "/api/products";
          const res = await fetch(apiUrl);
          if (res && res.ok) {
            const data = await res.json();
            if (data && data.ok && Array.isArray(data.items)) {
              const items = data.items;
              const facets = this.deriveFacets(items);
              const payload = {
                ok: true,
                source: "google_sheets_live",
                items,
                categories: data.categories || facets.categories,
                brands: data.brands || facets.brands,
                ts: Date.now()
              };
              this.productsCache = items;
              this.CATEGORIES = payload.categories;
              this.BRANDS = payload.brands;
              try { sessionStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(payload)); } catch {}
              return payload;
            }
          }
        } catch (err) {
          console.warn("Primary /api/products fetch fallback:", err.message);
        }

        // 2. Fallback: Direct Google Sheets Apps Script API (for static/offline preview)
        try {
          const gRes = await fetch(`${GSHEET_EXEC_FALLBACK}?page=1&page_size=200`, { redirect: "follow" });
          if (gRes && gRes.ok) {
            const gData = await gRes.json();
            const rawList = Array.isArray(gData) ? gData : (gData.items || gData.results || []);
            const seen = new Set();
            const items = [];
            rawList.forEach((row, i) => {
              const norm = normalizeClientItem(row, i);
              if (!norm || seen.has(norm.id)) return;
              seen.add(norm.id);
              items.push(norm);
            });
            const facets = this.deriveFacets(items);
            const payload = { ok: true, source: "google_sheets_direct", items, ...facets, ts: Date.now() };
            this.productsCache = items;
            this.CATEGORIES = facets.categories;
            this.BRANDS = facets.brands;
            try { sessionStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(payload)); } catch {}
            return payload;
          }
        } catch (err) {
          console.error("Direct Google Sheets fetch failed:", err.message);
        }

        return { ok: false, items: [], categories: [], brands: [], error: "Unable to load products from Google Sheets." };
      })();

      try {
        return await inflightCatalogPromise;
      } finally {
        inflightCatalogPromise = null;
      }
    },

    // ----------------------------------------------------
    // WHATSAPP ORDERING SYSTEM (+91 8505910581)
    // ----------------------------------------------------
    buildWhatsAppUrl: function (message) {
      return `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(message)}`;
    },

    openWhatsApp: function (message) {
      const msg = message || "Hello Cell Care India! I would like to enquire about your EV & battery products.";
      const url = this.buildWhatsAppUrl(msg);
      const win = window.open(url, "_blank", "noopener");
      if (!win) {
        window.location.href = url;
      }
      return url;
    },

    enquireProductOnWhatsApp: function (product, qty) {
      if (!product) return;
      const quantity = Math.max(product.min_quantity || 1, parseInt(qty || product.min_quantity || 1, 10) || 1);
      const unitPrice = Number(product.price) || 0;
      const estTotal = unitPrice * quantity;
      const productLink = getProductUrl(product);
      const customerLine = this.user && this.user.name
        ? `Customer Name: ${this.user.name}${this.user.phone ? `\nPhone: ${this.user.phone}` : ""}\n`
        : "";

      const lines = [
        "Hello Cell Care India,",
        "I would like to enquire / place an order for the following product:",
        "",
        ...(customerLine ? [customerLine.trim(), ""] : []),
        `Product Name: ${product.title}`,
        `SKU: ${product.sku}`,
        `Category: ${product.category}`,
        `Quantity: ${quantity}${product.min_quantity > 1 ? ` (MOQ: ${product.min_quantity})` : ""}`,
        `Unit Price: ${formatINR(unitPrice)}`,
        `Estimated Total: ${formatINR(estTotal)}`,
        `Product Link: ${productLink}`,
        "",
        "Please confirm availability, final quotation, and dispatch details."
      ];

      this.openWhatsApp(lines.join("\n"));
    },

    enquireProductById: function (id, qty) {
      const prod = this.productsCache.find(p => String(p.id) === String(id));
      if (prod) {
        this.enquireProductOnWhatsApp(prod, qty || prod.min_quantity || 1);
      }
    },

    buildOrderWhatsAppMessage: function ({ orderId, customer, items, pricing, notes }) {
      const addressParts = [
        customer.address,
        customer.city,
        customer.state,
        customer.pincode ? `- ${customer.pincode}` : ""
      ].filter(Boolean).join(", ").replace(", -", " -");

      const itemBlocks = (items || []).map((it, idx) => {
        const lineTotal = (Number(it.price) || 0) * (Number(it.qty) || 1);
        const link = it.product_url || getProductUrl(it);
        return [
          `${idx + 1}. ${it.title}`,
          `   SKU: ${it.sku || "N/A"} | Qty: ${it.qty} | Unit Price: ${formatINR(it.price)} | Subtotal: ${formatINR(lineTotal)}`,
          `   Link: ${link}`
        ].join("\n");
      }).join("\n\n");

      const lines = [
        "Hello Cell Care India,",
        `New Order Enquiry${orderId ? ` (#${orderId})` : ""}:`,
        "",
        `Customer Name: ${customer.name}`,
        `Phone Number: ${customer.phone}`,
        ...(customer.email ? [`Email: ${customer.email}`] : []),
        ...(addressParts ? [`Delivery Address: ${addressParts}`] : []),
        ...(customer.gstin ? [`GSTIN: ${customer.gstin}`] : []),
        "",
        "Ordered Products:",
        itemBlocks,
        "",
        `Subtotal: ${formatINR(pricing.subtotal)}`,
        ...(pricing.discount > 0 ? [`Discount (${pricing.coupon_code || "Coupon"}): -${formatINR(pricing.discount)}`] : []),
        `Estimated Total: ${formatINR(pricing.total)}`,
        ...(notes ? ["", `Customer Notes: ${notes}`] : []),
        "",
        "Please confirm stock availability, delivery charges, and payment instructions."
      ];

      return lines.join("\n");
    },

    // ----------------------------------------------------
    // CART METHODS
    // ----------------------------------------------------
    getCartItems: function () {
      return Object.values(this.cart || {});
    },

    getCartCount: function () {
      return this.getCartItems().reduce((sum, it) => sum + (Number(it.qty) || 1), 0);
    },

    getCartSubtotal: function () {
      return this.getCartItems().reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.qty) || 1), 0);
    },

    addToCart: function (product, qty, openDrawer = false) {
      if (!product || !product.id) return;
      const id = String(product.id);
      const minQ = Math.max(1, parseInt(product.min_quantity || 1, 10) || 1);
      const addQty = Math.max(minQ, parseInt(qty || minQ, 10) || minQ);

      if (this.cart[id]) {
        this.cart[id].qty = (Number(this.cart[id].qty) || minQ) + addQty;
      } else {
        this.cart[id] = {
          id,
          sku: product.sku || `CC-${id}`,
          slug: product.slug || id,
          title: product.title,
          price: Number(product.price) || 0,
          min_quantity: minQ,
          image_url: product.image_url || "",
          category: product.category || "EV Parts",
          product_url: getProductUrl(product),
          qty: addQty
        };
      }
      this.saveCart();
      this.toast(`Added "${product.title.slice(0, 40)}" (Qty: ${addQty}) to enquiry cart`);
      if (openDrawer) this.openCartDrawer();
      window.dispatchEvent(new CustomEvent("cellcare:cart-updated"));
    },

    addToCartById: function (id, qty, openDrawer = false) {
      const prod = this.productsCache.find(p => String(p.id) === String(id));
      if (prod) {
        this.addToCart(prod, qty || prod.min_quantity || 1, openDrawer);
      }
    },

    updateCartQty: function (id, newQty) {
      const key = String(id);
      if (!this.cart[key]) return;
      const q = parseInt(newQty, 10);
      if (!q || q <= 0) {
        delete this.cart[key];
      } else {
        this.cart[key].qty = q;
      }
      this.saveCart();
      window.dispatchEvent(new CustomEvent("cellcare:cart-updated"));
    },

    removeFromCart: function (id) {
      delete this.cart[String(id)];
      this.saveCart();
      this.toast("Item removed from cart");
      window.dispatchEvent(new CustomEvent("cellcare:cart-updated"));
    },

    clearCart: function () {
      this.cart = {};
      this.saveCart();
      window.dispatchEvent(new CustomEvent("cellcare:cart-updated"));
    },

    // ----------------------------------------------------
    // WISHLIST & RECENTLY VIEWED
    // ----------------------------------------------------
    isWishlisted: function (id) {
      return this.wishlist.includes(String(id));
    },

    toggleWishlist: function (id) {
      const sid = String(id);
      if (this.wishlist.includes(sid)) {
        this.wishlist = this.wishlist.filter(x => x !== sid);
        this.toast("Removed from Wishlist");
      } else {
        this.wishlist.unshift(sid);
        this.toast("Saved to Wishlist");
      }
      this.saveWishlist();
      document.querySelectorAll(`.cc-wish-toggle[data-id="${sid}"]`).forEach(btn => {
        const active = this.isWishlisted(sid);
        btn.classList.toggle("active", active);
        const icon = btn.querySelector("i");
        if (icon) icon.className = active ? "fas fa-heart" : "far fa-heart";
      });
      window.dispatchEvent(new CustomEvent("cellcare:wishlist-updated"));
    },

    trackRecentlyViewed: function (product) {
      if (!product || !product.id) return;
      const sid = String(product.id);
      this.recent = [sid, ...this.recent.filter(x => x !== sid)].slice(0, 8);
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(this.recent)); } catch {}
      this.renderRecentlyViewed();
    },

    renderRecentlyViewed: function () {
      const body = document.getElementById("ccRecentBody");
      const countEl = document.getElementById("ccRecentCount");
      if (!body) return;
      const items = this.recent
        .map(id => this.productsCache.find(p => String(p.id) === String(id)))
        .filter(Boolean);

      if (countEl) countEl.textContent = items.length ? `(${items.length})` : "";
      if (!items.length) {
        body.innerHTML = `<div style="font-size:12.5px; color:var(--text-muted); padding:6px 0;">Browse products to see your recently viewed items here.</div>`;
        return;
      }

      body.innerHTML = items.map(p => `
        <a href="product.html?id=${encodeURIComponent(p.id)}" style="display:flex; align-items:center; gap:10px; padding:7px 0; border-bottom:1px solid var(--border-light);">
          <img src="${esc(p.image_url)}" alt="${esc(p.title)}" style="width:42px; height:42px; object-fit:contain; border:1px solid var(--border-light); padding:2px;" />
          <div style="min-width:0; flex:1;">
            <div style="font-size:12px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:var(--brand-charcoal);">${esc(p.title)}</div>
            <div style="font-size:12px; font-weight:700; color:var(--brand-green);">${formatINR(p.price)}</div>
          </div>
        </a>
      `).join("");
    },

    // ----------------------------------------------------
    // PRODUCT CARD RENDERER (WHATSAPP + ENQUIRY CART)
    // ----------------------------------------------------
    renderProductCard: function (p) {
      const inStock = p.available !== false;
      const wished = this.isWishlisted(p.id);
      const url = `product.html?id=${encodeURIComponent(p.id)}`;
      const moq = Number(p.min_quantity) || 1;

      return `
        <article class="cc-product-card" data-product-id="${esc(p.id)}">
          <div class="cc-card-thumb">
            <a href="${url}" aria-label="${esc(p.title)}">
              <img src="${esc(p.image_url)}" alt="${esc(p.title)}" loading="lazy" />
            </a>
            <span class="cc-card-badge ${inStock ? "in-stock" : ""}">${inStock ? "In Stock" : "Out of Stock"}</span>
            <div class="cc-card-float-actions ${wished ? "has-active" : ""}">
              <button type="button" class="cc-float-btn cc-wish-toggle ${wished ? "active" : ""}" data-id="${esc(p.id)}" title="Save to Wishlist" aria-label="Wishlist">
                <i class="${wished ? "fas" : "far"} fa-heart"></i>
              </button>
              <button type="button" class="cc-float-btn cc-quickview-btn" data-id="${esc(p.id)}" title="Quick View" aria-label="Quick View">
                <i class="far fa-eye"></i>
              </button>
            </div>
          </div>

          <div class="cc-card-body" style="display:flex; flex-direction:column; flex:1;">
            <div class="cc-card-meta">
              <span>${esc(p.category)}</span>
              <span>SKU: ${esc(p.sku)}</span>
            </div>

            <div class="cc-card-price">
              <span class="cc-price-now">${formatINR(p.price)}</span>
              ${moq > 1 ? `<span class="cc-moq-tag">MOQ: ${moq}</span>` : ""}
            </div>

            <h3 class="cc-card-title">
              <a href="${url}">${esc(p.title)}</a>
            </h3>

            <div class="cc-card-actions">
              ${inStock
                ? `<button type="button" class="cc-btn-atc cc-wa-enquire-trigger" data-id="${esc(p.id)}"><i class="fab fa-whatsapp"></i> Enquire on WhatsApp</button>
                   <button type="button" class="cc-btn-atc secondary cc-atc-trigger" data-id="${esc(p.id)}">Add to Cart</button>`
                : `<button type="button" class="cc-btn-atc out-of-stock" disabled>Currently Out of Stock</button>`
              }
            </div>
          </div>
        </article>
      `;
    },

    // ----------------------------------------------------
    // DYNAMIC NAVIGATION POPULATION FROM LIVE GOOGLE SHEETS
    // ----------------------------------------------------
    populateDynamicNavigation: function (categories, brands) {
      // Search category dropdown
      const catSelect = document.getElementById("ccSearchCat");
      if (catSelect && categories.length) {
        const currentVal = catSelect.value;
        catSelect.innerHTML = `<option value="all">All Categories</option>` +
          categories.map(c => `<option value="${esc(c.slug)}">${esc(c.name)} (${c.count})</option>`).join("");
        if (currentVal) catSelect.value = currentVal;
      }

      // Desktop All Categories dropdown
      const catMenu = document.getElementById("ccNavCategoriesMenu");
      if (catMenu && categories.length) {
        catMenu.innerHTML = categories.map(c => `
          <a href="shop.html?category=${encodeURIComponent(c.slug)}">
            <span>${esc(c.name)}</span>
            <span style="font-size:11.5px; color:var(--text-muted);">(${c.count})</span>
          </a>
        `).join("") + `<a href="shop.html" style="font-weight:700; color:var(--brand-green); border-top:1px solid var(--border-light); margin-top:4px; padding-top:10px;">View All Products &rarr;</a>`;
      }

      // Desktop Shop by Brand dropdown
      const brandMenu = document.getElementById("ccNavBrandsMenu");
      if (brandMenu && brands.length) {
        brandMenu.innerHTML = brands.map(b => `
          <a href="shop.html?brand=${encodeURIComponent(b.name)}">
            <span>${esc(b.name)}</span>
            <span style="font-size:11.5px; color:var(--text-muted);">(${b.count})</span>
          </a>
        `).join("");
      }

      // Mobile drawer category links
      const mobCatHost = document.getElementById("ccMobileCatMount");
      if (mobCatHost && categories.length) {
        mobCatHost.innerHTML = categories.map(c =>
          `<li><a href="shop.html?category=${encodeURIComponent(c.slug)}" style="padding-left:28px; font-weight:500; font-size:13px;">${esc(c.name)} <span style="color:var(--text-muted);">(${c.count})</span></a></li>`
        ).join("");
      }
    },

    // ----------------------------------------------------
    // SHARED HEADER, FOOTER & DRAWERS INJECTION
    // ----------------------------------------------------
    injectShell: function () {
      const current = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();

      const headerHost = document.getElementById("ccHeaderMount");
      if (headerHost) {
        headerHost.innerHTML = `
          <header class="cc-header">
            <div class="cc-header-main">
              <div class="container">
                <div class="cc-header-row">
                  <a href="index.html" class="cc-logo" aria-label="Cell Care India Home">
                    <div>
                      <span class="cc-logo-wordmark">CellCare<span class="cc-logo-dot"></span><span class="cc-logo-tld">India</span></span>
                      <span class="cc-logo-sub">EV Parts &amp; Battery Solutions</span>
                    </div>
                  </a>

                  <div class="cc-search-wrap">
                    <form class="cc-search-form" id="ccDesktopSearchForm" action="shop.html" method="get" autocomplete="off">
                      <select class="cc-search-cat" name="category" id="ccSearchCat" aria-label="Category">
                        <option value="all">All Categories</option>
                      </select>
                      <input type="text" class="cc-search-input" name="q" id="ccSearchInput" placeholder="Search EV spare parts, lithium cells, BMS, tools, SKU..." />
                      <button type="submit" class="cc-search-btn">Search</button>
                    </form>
                    <div class="cc-search-results" id="ccSearchDropdown"></div>
                  </div>

                  <div class="cc-header-actions">
                    <a href="wishlist.html" class="cc-icon-action" title="Wishlist" aria-label="Wishlist">
                      <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                      <span class="cc-icon-badge" id="ccWishBadge">0</span>
                    </a>

                    <button type="button" class="cc-icon-action" id="ccOpenCartBtn" title="Order Enquiry Cart" aria-label="Order Enquiry Cart">
                      <svg viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
                      <span class="cc-icon-badge" id="ccCartBadge">0</span>
                    </button>

                    <a href="account.html" class="cc-icon-action" id="ccAccountLink">
                      <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                      <div class="cc-account-links" id="ccAccountText">
                        <span>Log in</span>
                        <span>Register</span>
                      </div>
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <!-- CHARCOAL NAVIGATION BAR WITH GREEN ACCENTS -->
            <nav class="cc-nav-bar" aria-label="Primary Navigation">
              <div class="container">
                <ul class="cc-nav-list">
                  <li class="cc-nav-item"><a href="index.html" class="cc-nav-link ${current === "index.html" || current === "" ? "active" : ""}">HOME</a></li>

                  <li class="cc-nav-item">
                    <a href="shop.html" class="cc-nav-link ${current === "shop.html" || current === "products.html" ? "active" : ""}">
                      ALL CATEGORIES <i class="fas fa-caret-down cc-nav-caret"></i>
                    </a>
                    <div class="cc-dropdown" id="ccNavCategoriesMenu">
                      <a href="shop.html">Loading categories...</a>
                    </div>
                  </li>

                  <li class="cc-nav-item">
                    <a href="shop.html" class="cc-nav-link">
                      SHOP BY BRAND <i class="fas fa-caret-down cc-nav-caret"></i>
                    </a>
                    <div class="cc-dropdown" id="ccNavBrandsMenu">
                      <a href="shop.html">Loading brands...</a>
                    </div>
                  </li>

                  <li class="cc-nav-item"><a href="shop.html" class="cc-nav-link">ALL PRODUCTS</a></li>
                  <li class="cc-nav-item"><a href="services.html" class="cc-nav-link ${current === "services.html" ? "active" : ""}">SERVICES</a></li>
                  <li class="cc-nav-item"><a href="about.html" class="cc-nav-link ${current === "about.html" ? "active" : ""}">ABOUT US</a></li>
                  <li class="cc-nav-item"><a href="track-order.html" class="cc-nav-link ${current === "track-order.html" ? "active" : ""}">TRACK ORDER</a></li>
                  <li class="cc-nav-item"><a href="contact.html" class="cc-nav-link ${current === "contact.html" ? "active" : ""}">SUPPORT</a></li>
                </ul>
              </div>
            </nav>

            <!-- MOBILE HEADER -->
            <div class="cc-mobile-bar">
              <div class="cc-mobile-top">
                <a href="index.html" class="cc-logo">
                  <span class="cc-logo-wordmark" style="font-size:21px;">CellCare<span class="cc-logo-dot"></span><span class="cc-logo-tld">India</span></span>
                </a>
                <div style="display:flex; align-items:center; gap:16px;">
                  <a href="wishlist.html" class="cc-icon-action" aria-label="Wishlist">
                    <svg viewBox="0 0 24 24" style="width:22px;height:22px;"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                    <span class="cc-icon-badge" id="ccWishBadgeMob">0</span>
                  </a>
                  <button type="button" class="cc-icon-action" id="ccOpenCartBtnMob" aria-label="Cart">
                    <svg viewBox="0 0 24 24" style="width:22px;height:22px;"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
                    <span class="cc-icon-badge" id="ccCartBadgeMob">0</span>
                  </button>
                  <a href="account.html" class="cc-icon-action" aria-label="My Account">
                    <svg viewBox="0 0 24 24" style="width:22px;height:22px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                  </a>
                </div>
              </div>
              <div class="cc-mobile-search-row">
                <button type="button" class="cc-hamburger" id="ccOpenMobileMenu" aria-label="Menu">
                  <i class="fas fa-bars" style="font-size:18px;"></i>
                </button>
                <form class="cc-search-form" action="shop.html" method="get" style="flex:1; height:40px;">
                  <input type="text" class="cc-search-input" name="q" placeholder="Search EV parts, cells, SKU..." />
                  <button type="submit" class="cc-search-btn" style="padding:0 14px;"><i class="fas fa-search"></i></button>
                </form>
              </div>
            </div>
          </header>
        `;
      }

      const footerHost = document.getElementById("ccFooterMount");
      if (footerHost) {
        footerHost.innerHTML = `
          <footer class="cc-footer">
            <div class="cc-footer-trust">
              <div class="container">
                <div class="cc-trust-grid">
                  <div class="cc-trust-item">
                    <i class="fas fa-shield-alt"></i>
                    <div>
                      <h3>Genuine Quality</h3>
                      <p>QC Tested EV &amp; Battery Parts</p>
                    </div>
                  </div>
                  <div class="cc-trust-item">
                    <i class="fab fa-whatsapp"></i>
                    <div>
                      <h3>Direct WhatsApp Ordering</h3>
                      <p>Fast Quotes on +91 85059 10581</p>
                    </div>
                  </div>
                  <div class="cc-trust-item">
                    <i class="fas fa-boxes-stacked"></i>
                    <div>
                      <h3>Retail &amp; Wholesale</h3>
                      <p>Factory-Direct B2B Pricing</p>
                    </div>
                  </div>
                  <div class="cc-trust-item">
                    <i class="fas fa-truck"></i>
                    <div>
                      <h3>Pan-India Dispatch</h3>
                      <p>Insured Express Surface Delivery</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="cc-footer-main">
              <div class="container">
                <div class="cc-footer-grid">
                  <div>
                    <a href="index.html" class="cc-logo">
                      <span class="cc-logo-wordmark" style="font-size:23px; color:#ffffff;">CellCare<span class="cc-logo-dot"></span><span class="cc-logo-tld">India</span></span>
                    </a>
                    <p class="cc-footer-story">
                      Cell Care India supplies genuine EV spare parts, Grade-A lithium cells, battery assembly components, and testing tools directly from New Delhi to riders, workshops, and OEMs across India.
                    </p>
                  </div>

                  <div>
                    <div class="cc-address-chip"><strong>New Delhi Warehouse &amp; Sales Desk</strong></div>
                    <ul class="cc-footer-contact">
                      <li><i class="fas fa-map-marker-alt"></i> ${esc(SITE.address)}</li>
                      <li><i class="fab fa-whatsapp"></i> <a href="https://wa.me/${SITE.whatsapp}" target="_blank" rel="noopener">${esc(SITE.phone)} (WhatsApp Ordering)</a></li>
                      <li><i class="fas fa-envelope"></i> <a href="mailto:${esc(SITE.email)}">${esc(SITE.email)}</a></li>
                      <li><i class="far fa-clock"></i> ${esc(SITE.hours)}</li>
                    </ul>
                  </div>

                  <div class="cc-footer-col">
                    <h3>Useful Links</h3>
                    <ul class="cc-footer-links">
                      <li><a href="about.html">About Us</a></li>
                      <li><a href="shop.html">All Products</a></li>
                      <li><a href="services.html">Custom Pack Services</a></li>
                      <li><a href="track-order.html">Track Order</a></li>
                      <li><a href="faq.html">FAQ</a></li>
                      <li><a href="contact.html">Support &amp; Contact</a></li>
                      <li><a href="return-policy.html">Return &amp; Warranty Policy</a></li>
                      <li><a href="privacy.html">Privacy Policy</a></li>
                      <li><a href="terms.html">Terms &amp; Conditions</a></li>
                    </ul>
                    <div class="cc-footer-socials">
                      <a href="${SITE.social.facebook}" target="_blank" rel="noopener" aria-label="Facebook"><i class="fab fa-facebook-f"></i></a>
                      <a href="${SITE.social.youtube}" target="_blank" rel="noopener" aria-label="YouTube"><i class="fab fa-youtube"></i></a>
                      <a href="${SITE.social.instagram}" target="_blank" rel="noopener" aria-label="Instagram"><i class="fab fa-instagram"></i></a>
                      <a href="${SITE.social.linkedin}" target="_blank" rel="noopener" aria-label="LinkedIn"><i class="fab fa-linkedin-in"></i></a>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="cc-footer-bottom">
              <div class="container">
                <div class="cc-footer-bottom-row">
                  <div>&copy; 2026 Cell Care India. All Rights Reserved. | Made in India</div>
                  <div class="cc-pay-badges">
                    <span class="cc-pay-badge"><i class="fab fa-whatsapp" style="color:var(--brand-green); margin-right:5px;"></i>DIRECT WHATSAPP ORDERING</span>
                    <span class="cc-pay-badge">PREPAID DISPATCH</span>
                    <span class="cc-pay-badge">GST INVOICE</span>
                  </div>
                </div>
              </div>
            </div>
          </footer>
        `;
      }

      if (!document.getElementById("ccGlobalOverlays")) {
        const div = document.createElement("div");
        div.id = "ccGlobalOverlays";
        div.innerHTML = `
          <div class="cc-backdrop" id="ccBackdrop"></div>

          <aside class="cc-mobile-drawer" id="ccMobileDrawer" aria-label="Mobile Navigation">
            <div class="cc-drawer-head">
              <span>CELL CARE INDIA</span>
              <button type="button" class="cc-drawer-close" id="ccCloseMobileMenu">&times;</button>
            </div>
            <ul class="cc-mobile-nav">
              <li><a href="index.html">Home <i class="fas fa-angle-right"></i></a></li>
              <li><a href="shop.html">All Products <i class="fas fa-angle-right"></i></a></li>
              <div id="ccMobileCatMount"></div>
              <li><a href="services.html">Services <i class="fas fa-angle-right"></i></a></li>
              <li><a href="cart.html">Order Enquiry Cart <i class="fas fa-angle-right"></i></a></li>
              <li><a href="wishlist.html">My Wishlist <i class="fas fa-angle-right"></i></a></li>
              <li><a href="account.html">My Account <i class="fas fa-angle-right"></i></a></li>
              <li><a href="track-order.html">Track Order <i class="fas fa-angle-right"></i></a></li>
              <li><a href="about.html">About Us <i class="fas fa-angle-right"></i></a></li>
              <li><a href="faq.html">FAQ <i class="fas fa-angle-right"></i></a></li>
              <li><a href="contact.html">Support / Contact <i class="fas fa-angle-right"></i></a></li>
            </ul>
          </aside>

          <aside class="cc-cart-drawer" id="ccCartDrawer" aria-label="Order Enquiry Cart">
            <div class="cc-drawer-head">
              <span><i class="fas fa-shopping-bag" style="margin-right:8px;"></i>Enquiry Cart (<span id="ccDrawerCount">0</span>)</span>
              <button type="button" class="cc-drawer-close" id="ccCloseCartDrawer">&times;</button>
            </div>
            <div class="cc-cart-drawer-body" id="ccCartDrawerItems"></div>
            <div class="cc-cart-drawer-foot">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; font-size:15px;">
                <span style="color:var(--text-muted);">Estimated Total:</span>
                <strong id="ccDrawerSubtotal" style="font-size:18px; color:var(--brand-charcoal);">₹0</strong>
              </div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <a href="cart.html" class="cc-btn-outline" style="width:100%;">View Cart</a>
                <a href="checkout.html" class="cc-btn-primary" style="width:100%;"><i class="fab fa-whatsapp"></i> Order Now</a>
              </div>
            </div>
          </aside>

          <div class="cc-modal" id="ccQuickViewModal" role="dialog" aria-modal="true">
            <div class="cc-modal-card">
              <button type="button" class="cc-modal-close" id="ccCloseQuickView">&times;</button>
              <div id="ccQuickViewContent"></div>
            </div>
          </div>

          <a href="https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent("Hello Cell Care India! I would like to enquire about EV & battery products.")}"
             target="_blank" rel="noopener" class="cc-wa-float" title="Chat on WhatsApp (+91 8505910581)" aria-label="Chat on WhatsApp">
            <i class="fab fa-whatsapp"></i>
          </a>

          <div class="cc-recent-bar" id="ccRecentBar">
            <button type="button" class="cc-recent-toggle" id="ccRecentToggle">
              <span>Your Recently Viewed <span id="ccRecentCount"></span></span>
              <i class="fas fa-chevron-up" id="ccRecentChevron"></i>
            </button>
            <div class="cc-recent-body" id="ccRecentBody"></div>
          </div>

          <div class="cc-toast-stack" id="ccToastStack"></div>
        `;
        document.body.appendChild(div);
      }
    },

    bindGlobalEvents: function () {
      const openCart = () => this.openCartDrawer();
      const closeAll = () => {
        document.getElementById("ccCartDrawer")?.classList.remove("open");
        document.getElementById("ccMobileDrawer")?.classList.remove("open");
        document.getElementById("ccBackdrop")?.classList.remove("open");
      };

      document.getElementById("ccOpenCartBtn")?.addEventListener("click", openCart);
      document.getElementById("ccOpenCartBtnMob")?.addEventListener("click", openCart);
      document.getElementById("ccCloseCartDrawer")?.addEventListener("click", closeAll);
      document.getElementById("ccOpenMobileMenu")?.addEventListener("click", () => {
        document.getElementById("ccMobileDrawer")?.classList.add("open");
        document.getElementById("ccBackdrop")?.classList.add("open");
      });
      document.getElementById("ccCloseMobileMenu")?.addEventListener("click", closeAll);
      document.getElementById("ccBackdrop")?.addEventListener("click", closeAll);

      document.getElementById("ccCloseQuickView")?.addEventListener("click", () => {
        document.getElementById("ccQuickViewModal")?.classList.remove("open");
      });
      document.getElementById("ccQuickViewModal")?.addEventListener("click", e => {
        if (e.target.id === "ccQuickViewModal") e.target.classList.remove("open");
      });

      document.getElementById("ccRecentToggle")?.addEventListener("click", () => {
        const bar = document.getElementById("ccRecentBar");
        const icon = document.getElementById("ccRecentChevron");
        if (!bar) return;
        const isOpen = bar.classList.toggle("open");
        if (icon) icon.className = isOpen ? "fas fa-chevron-down" : "fas fa-chevron-up";
      });

      // Live Search Autocomplete
      const searchInput = document.getElementById("ccSearchInput");
      const searchCat = document.getElementById("ccSearchCat");
      const dropdown = document.getElementById("ccSearchDropdown");

      if (searchInput && dropdown) {
        const runLiveSearch = () => {
          const q = searchInput.value.trim().toLowerCase();
          const cat = searchCat ? searchCat.value : "all";
          if (q.length < 2) {
            dropdown.classList.remove("open");
            return;
          }
          const matches = this.productsCache.filter(p => {
            const catOk = cat === "all" || slugify(p.category) === cat;
            if (!catOk) return false;
            return (
              p.title.toLowerCase().includes(q) ||
              p.category.toLowerCase().includes(q) ||
              p.brand.toLowerCase().includes(q) ||
              p.sku.toLowerCase().includes(q) ||
              p.description.toLowerCase().includes(q)
            );
          }).slice(0, 6);

          if (!matches.length) {
            dropdown.innerHTML = `<div style="padding:14px; font-size:13px; color:var(--text-muted);">No products matching "${esc(searchInput.value)}". <a href="shop.html" style="color:var(--brand-green);font-weight:700;">Browse all products</a></div>`;
          } else {
            dropdown.innerHTML = matches.map(p => `
              <a href="product.html?id=${encodeURIComponent(p.id)}" class="cc-search-item">
                <img src="${esc(p.image_url)}" alt="${esc(p.title)}" />
                <div class="cc-search-item-info">
                  <div class="cc-search-item-title">${esc(p.title)}</div>
                  <div class="cc-search-item-meta">${formatINR(p.price)} &bull; SKU: ${esc(p.sku)}</div>
                </div>
              </a>
            `).join("") + `<a href="shop.html?q=${encodeURIComponent(searchInput.value)}&category=${encodeURIComponent(cat)}" style="display:block; text-align:center; padding:10px; font-size:12.5px; font-weight:700; background:var(--surface-subtle); color:var(--brand-green);">View all results for "${esc(searchInput.value)}" &rarr;</a>`;
          }
          dropdown.classList.add("open");
        };

        searchInput.addEventListener("input", runLiveSearch);
        searchCat?.addEventListener("change", runLiveSearch);
        document.addEventListener("click", e => {
          if (!e.target.closest(".cc-search-wrap")) dropdown.classList.remove("open");
        });
      }

      // Delegated clicks across all product cards
      document.addEventListener("click", e => {
        const waBtn = e.target.closest(".cc-wa-enquire-trigger");
        if (waBtn) {
          e.preventDefault();
          this.enquireProductById(waBtn.dataset.id);
          return;
        }
        const atc = e.target.closest(".cc-atc-trigger");
        if (atc) {
          e.preventDefault();
          this.addToCartById(atc.dataset.id, null, false);
          return;
        }
        const wish = e.target.closest(".cc-wish-toggle");
        if (wish) {
          e.preventDefault();
          this.toggleWishlist(wish.dataset.id);
          return;
        }
        const qv = e.target.closest(".cc-quickview-btn");
        if (qv) {
          e.preventDefault();
          this.openQuickView(qv.dataset.id);
          return;
        }
      });
    },

    openCartDrawer: function () {
      this.updateCartUI();
      document.getElementById("ccCartDrawer")?.classList.add("open");
      document.getElementById("ccBackdrop")?.classList.add("open");
    },

    openQuickView: function (id) {
      const p = this.productsCache.find(x => String(x.id) === String(id));
      const modal = document.getElementById("ccQuickViewModal");
      const box = document.getElementById("ccQuickViewContent");
      if (!p || !modal || !box) return;
      const moq = Number(p.min_quantity) || 1;

      box.innerHTML = `
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(250px, 1fr)); gap:24px; align-items:start;">
          <div style="border:1px solid var(--border-light); padding:16px; background:#fff; text-align:center; border-radius:4px;">
            <img src="${esc(p.image_url)}" alt="${esc(p.title)}" style="max-height:290px; margin:0 auto; object-fit:contain;" />
          </div>
          <div>
            <div style="font-size:12px; color:var(--text-muted); margin-bottom:4px;">SKU: ${esc(p.sku)} &bull; ${esc(p.category)} &bull; ${esc(p.brand)}</div>
            <h2 style="font-size:20px; font-weight:700; margin:0 0 10px 0; color:var(--brand-charcoal);">${esc(p.title)}</h2>
            <div style="font-size:22px; font-weight:800; color:var(--brand-green); margin-bottom:10px;">${formatINR(p.price)}</div>
            <div style="font-size:13px; margin-bottom:12px;">
              Availability: <strong style="color:var(--brand-green);">${p.available ? "In Stock" : "Out of Stock"}</strong>
              ${moq > 1 ? ` &bull; Minimum Order Qty: <strong>${moq}</strong>` : ""}
            </div>
            <p style="font-size:13.5px; color:var(--text-body); margin-bottom:16px; white-space:pre-line; max-height:130px; overflow-y:auto;">${esc(p.description)}</p>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              ${p.available
                ? `<button type="button" class="cc-btn-primary" id="ccQvWa" style="flex:1;"><i class="fab fa-whatsapp"></i> Enquire on WhatsApp</button>
                   <button type="button" class="cc-btn-charcoal" id="ccQvAdd">Add to Cart</button>`
                : `<button type="button" class="cc-btn-outline" disabled>Out of Stock</button>`
              }
              <a href="product.html?id=${encodeURIComponent(p.id)}" class="cc-btn-outline" style="width:100%;">View Full Details</a>
            </div>
          </div>
        </div>
      `;
      modal.classList.add("open");
      document.getElementById("ccQvWa")?.addEventListener("click", () => {
        this.enquireProductOnWhatsApp(p, moq);
      });
      document.getElementById("ccQvAdd")?.addEventListener("click", () => {
        this.addToCart(p, moq, true);
        modal.classList.remove("open");
      });
    },

    updateCartUI: function () {
      const count = this.getCartCount();
      const subtotal = this.getCartSubtotal();
      ["ccCartBadge", "ccCartBadgeMob", "ccDrawerCount"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(count);
      });

      const subEl = document.getElementById("ccDrawerSubtotal");
      if (subEl) subEl.textContent = formatINR(subtotal);

      const listEl = document.getElementById("ccCartDrawerItems");
      if (!listEl) return;

      const items = this.getCartItems();
      if (!items.length) {
        listEl.innerHTML = `
          <div style="text-align:center; padding:42px 12px; color:var(--text-muted);">
            <i class="fas fa-shopping-bag" style="font-size:38px; opacity:0.35; margin-bottom:12px;"></i>
            <p style="margin:0 0 16px;">Your enquiry cart is empty.</p>
            <a href="shop.html" class="cc-btn-primary">Browse Products</a>
          </div>
        `;
        return;
      }

      listEl.innerHTML = items.map(it => `
        <div style="display:flex; gap:12px; padding:12px 0; border-bottom:1px solid var(--border-light); align-items:flex-start;">
          <a href="product.html?id=${encodeURIComponent(it.id)}" style="width:58px; height:58px; border:1px solid var(--border-light); padding:3px; flex-shrink:0; background:#fff;">
            <img src="${esc(it.image_url)}" alt="${esc(it.title)}" style="width:100%; height:100%; object-fit:contain;" />
          </a>
          <div style="flex:1; min-width:0;">
            <a href="product.html?id=${encodeURIComponent(it.id)}" style="font-size:13px; font-weight:600; color:var(--brand-charcoal); display:block; margin-bottom:3px; line-height:1.35;">${esc(it.title)}</a>
            <div style="font-size:11.5px; color:var(--text-muted); margin-bottom:4px;">SKU: ${esc(it.sku)}</div>
            <div style="font-size:13px; font-weight:700; color:var(--brand-green); margin-bottom:6px;">${formatINR(it.price)}</div>
            <div style="display:flex; align-items:center; justify-content:space-between;">
              <div style="display:inline-flex; border:1px solid var(--border-color); height:28px; border-radius:3px;">
                <button type="button" onclick="CellCare.updateCartQty('${esc(it.id)}', ${it.qty - 1})" style="width:26px; border:none; background:#fff; cursor:pointer;">-</button>
                <span style="min-width:30px; display:inline-flex; align-items:center; justify-content:center; font-size:12.5px; font-weight:700;">${it.qty}</span>
                <button type="button" onclick="CellCare.updateCartQty('${esc(it.id)}', ${it.qty + 1})" style="width:26px; border:none; background:#fff; cursor:pointer;">+</button>
              </div>
              <button type="button" onclick="CellCare.removeFromCart('${esc(it.id)}')" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:13px;" title="Remove"><i class="fas fa-trash-alt"></i></button>
            </div>
          </div>
        </div>
      `).join("");
    },

    updateWishlistUI: function () {
      const n = this.wishlist.length;
      ["ccWishBadge", "ccWishBadgeMob"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(n);
      });
    },

    updateAuthUI: function () {
      const box = document.getElementById("ccAccountText");
      if (!box) return;
      if (this.user && this.user.name) {
        const first = this.user.name.split(" ")[0];
        box.innerHTML = `<span style="color:var(--brand-green);">Hi, ${esc(first)}</span><span>My Account</span>`;
      } else {
        box.innerHTML = `<span>Log in</span><span>Register</span>`;
      }
    },

    toast: function (message) {
      const stack = document.getElementById("ccToastStack");
      if (!stack) return;
      const t = document.createElement("div");
      t.className = "cc-toast";
      t.textContent = message;
      stack.appendChild(t);
      setTimeout(() => {
        t.style.opacity = "0";
        t.style.transition = "opacity 0.25s";
        setTimeout(() => t.remove(), 260);
      }, 2800);
    }
  };

  window.CellCare = CellCare;
  document.addEventListener("DOMContentLoaded", () => CellCare.init());
})(window, document);
