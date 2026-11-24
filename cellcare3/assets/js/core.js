/**
 * CELL CARE INDIA — CORE E-COMMERCE FRAMEWORK (v4.0)
 * Dynamic shopping cart state, interactive slide-over cart drawer with live qty steppers,
 * Buy Now instant checkout, order tracking navigation injection, and WhatsApp support.
 */

(function (window, document) {
  "use strict";

  const STORAGE_KEY = "cellcare_cart_v3";
  const CATALOG_CACHE_KEY = "cellcare_catalog_cache_v4";

  window.CellCare = {
    cart: {},
    siteConfig: null,

    // ----------------------------------------------------
    // 1. INITIALIZATION
    // ----------------------------------------------------
    init: function () {
      this.loadCartFromStorage();
      this.enhanceNavigation();
      this.initNavbar();
      this.initDrawer();
      this.loadSiteConfig();
      this.updateCartUI();
    },

    // Automatically inject "Track Order" in navbars & "Admin Console" in footers across all pages
    enhanceNavigation: function () {
      // Desktop nav menu
      document.querySelectorAll(".nav-menu").forEach(menu => {
        if (!menu.querySelector('a[href="track-order.html"]')) {
          const li = document.createElement("li");
          const isTrackPage = window.location.pathname.includes("track-order.html");
          li.innerHTML = `<a href="track-order.html" class="nav-link ${isTrackPage ? "active" : ""}">Track Order</a>`;
          menu.appendChild(li);
        }
      });

      // Mobile sidebar nav
      document.querySelectorAll(".mobile-nav-links").forEach(list => {
        if (!list.querySelector('a[href="track-order.html"]')) {
          const li = document.createElement("li");
          li.innerHTML = `<a href="track-order.html"><svg class="svg-icon" viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg> Track Order</a>`;
          list.appendChild(li);
        }
      });

      // Update Cart Pill button text from "Quote Cart" to "Cart"
      document.querySelectorAll(".open-quote-drawer span:not(.cart-badge)").forEach(span => {
        if (span.textContent.trim() === "Quote Cart") {
          span.textContent = "Cart";
        }
      });

      // Update Drawer Header title & Proceed button label
      const drawerTitle = document.querySelector("#quoteDrawer .quote-drawer-header h3");
      if (drawerTitle) {
        drawerTitle.innerHTML = `
          <svg class="svg-icon" style="color:var(--accent-primary);" viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
          Shopping Cart
        `;
      }

      const proceedBtn = document.getElementById("quoteDrawerProceed");
      if (proceedBtn) {
        proceedBtn.className = "btn btn-primary btn-lg";
        proceedBtn.style.width = "100%";
        proceedBtn.innerHTML = `
          <svg class="svg-icon" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
          Proceed to Secure Checkout
        `;
      }

      // Add Track Order & Admin Portal link to footer
      document.querySelectorAll(".footer-bottom-links").forEach(linksBox => {
        if (!linksBox.querySelector('a[href="track-order.html"]')) {
          const trackLink = document.createElement("a");
          trackLink.href = "track-order.html";
          trackLink.textContent = "Track Order";
          linksBox.prepend(trackLink);
        }
        if (!linksBox.querySelector('a[href="admin.html"]')) {
          const adminLink = document.createElement("a");
          adminLink.href = "admin.html";
          adminLink.style.color = "var(--accent-primary)";
          adminLink.textContent = "Admin Portal";
          linksBox.appendChild(adminLink);
        }
      });
    },

    // ----------------------------------------------------
    // 2. UNIFIED PRODUCT FETCHER (/api/products + Fallback)
    // ----------------------------------------------------
    fetchProducts: async function (forceRefresh = false) {
      if (!forceRefresh) {
        try {
          const cached = sessionStorage.getItem(CATALOG_CACHE_KEY);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0 && (Date.now() - (parsed.ts || 0) < 120000)) {
              return parsed;
            }
          }
        } catch (e) {}
      }

      // 1. Fetch from Vercel Serverless API (/api/products)
      try {
        const res = await fetch("/api/products");
        if (res && res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.items) && data.items.length > 0) {
            try {
              sessionStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify({ items: data.items, categories: data.categories || [], ts: Date.now() }));
            } catch (e) {}
            return data;
          }
        }
      } catch (e) {}

      // 2. Fallback to local seed file or Google Sheets if running as static file
      try {
        const seedRes = await fetch("data/seed-products.json");
        if (seedRes && seedRes.ok) {
          const seedItems = await seedRes.json();
          if (Array.isArray(seedItems) && seedItems.length > 0) {
            return { ok: true, items: seedItems };
          }
        }
      } catch (e) {}

      const gsheetUrl = (window.CELLCARE_CONFIG && window.CELLCARE_CONFIG.gsheetProductsApi) ||
        "https://script.google.com/macros/s/AKfycbzPASrJpC5dvoFX-R6zX1AfW-pFyg8DIM6D_p9DG4QSI16qyymFXzibseq1rA9r_f-j2g/exec";
      const gRes = await fetch(`${gsheetUrl}?page=1&page_size=100`);
      const gData = await gRes.json();
      return { ok: true, items: gData.items || gData.results || [] };
    },

    clearCatalogCache: function () {
      try {
        sessionStorage.removeItem(CATALOG_CACHE_KEY);
        sessionStorage.removeItem("cellcare_catalog_cache_v3");
      } catch (e) {}
    },

    // ----------------------------------------------------
    // 3. CONFIG LOADER
    // ----------------------------------------------------
    loadSiteConfig: function () {
      const cfg = (window.CELLCARE_CONFIG && window.CELLCARE_CONFIG.fallback) || {
        phone: "+91 85059 10581",
        whatsapp: "918505910581",
        email: "CellCareIndia2025@gmail.com",
        address: "Shop No. 4, B-32, New Brij Puri, Near Jagatpuri Police Station, New Delhi - 110051",
        social: {
          linkedin: "https://www.linkedin.com/in/cell-care-india-931736398",
          facebook: "https://www.facebook.com/profile.php?id=61567162763508&mibextid=ZbWKwL",
          instagram: "https://instagram.com/cellcare_india"
        }
      };
      this.siteConfig = cfg;
      this.applyConfigToDOM(cfg);
    },

    applyConfigToDOM: function (cfg) {
      if (!cfg) return;
      const email = cfg.contact_email || cfg.site_email || cfg.email || "sales@cellcareindia.com";
      const phone = cfg.whatsapp_number || cfg.whatsapp_phone || cfg.phone || "+91 85059 10581";
      const address = cfg.address || "New Delhi, India";

      document.querySelectorAll("[data-bind='site-email']").forEach(el => el.textContent = email);
      document.querySelectorAll("[data-bind='site-phone']").forEach(el => el.textContent = phone);
      document.querySelectorAll("[data-bind='site-address']").forEach(el => el.textContent = address);

      const socials = cfg.social || {};
      if (socials.facebook) document.querySelectorAll(".social-facebook").forEach(el => el.href = socials.facebook);
      if (socials.instagram) document.querySelectorAll(".social-instagram").forEach(el => el.href = socials.instagram);
      if (socials.linkedin) document.querySelectorAll(".social-linkedin").forEach(el => el.href = socials.linkedin);
    },

    getWhatsAppNumber: function () {
      if (this.siteConfig) {
        const raw = this.siteConfig.whatsapp_phone || this.siteConfig.whatsapp_number || this.siteConfig.whatsapp || "";
        const clean = raw.replace(/\D/g, "");
        if (clean.length === 10) return "91" + clean;
        if (clean.length > 10) return clean;
      }
      return "918505910581";
    },

    // ----------------------------------------------------
    // 4. CART MANAGEMENT (ADD TO CART, BUY NOW, QTY STEPPER)
    // ----------------------------------------------------
    loadCartFromStorage: function () {
      try {
        const data = localStorage.getItem(STORAGE_KEY);
        this.cart = data ? JSON.parse(data) : {};
      } catch (e) {
        this.cart = {};
      }
    },

    saveCartToStorage: function () {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.cart));
      } catch (e) {
        console.warn("Storage full or unavailable", e);
      }
      this.updateCartUI();
    },

    addToCart: function (product, qtyToAdd, silent = false) {
      const id = String(product.id || product.slug || product.title);
      const minQty = Math.max(1, parseInt(product.min_quantity || product.moq || product.min_qty || 1, 10));
      const price = parseFloat(product.price || 0);
      const mrp = parseFloat(product.mrp || price || 0);
      const addCount = Math.max(1, parseInt(qtyToAdd || minQty, 10));

      if (this.cart[id]) {
        this.cart[id].qty += addCount;
      } else {
        this.cart[id] = {
          id: id,
          sku: product.sku || `CC-${id.toUpperCase()}`,
          title: product.title || "Battery Unit",
          price: price,
          mrp: mrp,
          qty: addCount,
          minQty: minQty,
          step: 1,
          image_url: product.image_url || "assets/images/hero.svg"
        };
      }

      this.saveCartToStorage();
      if (!silent) {
        this.toast(`Added ${addCount}x ${product.title} to Cart!`, "success");
        this.openDrawer();
      }
    },

    buyNow: function (product, qtyToAdd) {
      this.addToCart(product, qtyToAdd, true);
      window.location.href = "checkout.html";
    },

    changeCartItemQty: function (id, delta) {
      if (!this.cart[id]) return;
      const min = this.cart[id].minQty || 1;
      const nextQty = (this.cart[id].qty || 1) + delta;
      if (nextQty < min) {
        delete this.cart[id];
        this.toast("Item removed from cart", "info");
      } else {
        this.cart[id].qty = nextQty;
      }
      this.saveCartToStorage();
      if (typeof window.renderCheckoutSummary === "function") {
        window.renderCheckoutSummary();
      }
    },

    updateCartItemQty: function (id, newQty) {
      if (!this.cart[id]) return;
      const min = this.cart[id].minQty || 1;
      if (newQty < min) {
        delete this.cart[id];
        this.toast("Item removed from cart", "info");
      } else {
        this.cart[id].qty = newQty;
      }
      this.saveCartToStorage();
    },

    removeFromCart: function (id) {
      if (this.cart[id]) {
        delete this.cart[id];
        this.saveCartToStorage();
        this.toast("Item removed from cart", "info");
      }
    },

    clearCart: function () {
      this.cart = {};
      this.saveCartToStorage();
    },

    getCartCount: function () {
      let count = 0;
      Object.values(this.cart).forEach(item => count += item.qty);
      return count;
    },

    getCartTotal: function () {
      let sum = 0;
      Object.values(this.cart).forEach(item => sum += (item.qty * item.price));
      return sum;
    },

    svg: {
      lightning: '<svg class="svg-icon" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>',
      whatsapp: '<svg class="svg-icon" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>',
      trash: '<svg class="svg-icon" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>',
      cart: '<svg class="svg-icon" viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>',
      info: '<svg class="svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>',
      check: '<svg class="svg-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>',
      xmark: '<svg class="svg-icon" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
      arrowRight: '<svg class="svg-icon" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>',
      boxes: '<svg class="svg-icon" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>',
      shield: '<svg class="svg-icon" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>',
      truck: '<svg class="svg-icon" viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>'
    },

    // ----------------------------------------------------
    // 5. UI SYNCHRONIZATION (BADGES & SLIDE-OVER CART DRAWER)
    // ----------------------------------------------------
    updateCartUI: function () {
      const count = this.getCartCount();
      const total = this.getCartTotal();

      document.querySelectorAll(".cart-count-badge").forEach(el => {
        el.textContent = count;
        el.style.display = count > 0 ? "inline-block" : "none";
      });

      const drawerItems = document.getElementById("quoteDrawerItems");
      const drawerTotal = document.getElementById("quoteDrawerTotal");
      const drawerSubtotalCount = document.getElementById("quoteDrawerCountText");

      if (drawerSubtotalCount) {
        drawerSubtotalCount.textContent = `Subtotal (${count} item${count === 1 ? "" : "s"})`;
      }

      if (drawerTotal) {
        drawerTotal.textContent = total > 0 ? `₹${total.toLocaleString("en-IN")}` : "₹0";
      }

      if (drawerItems) {
        const items = Object.values(this.cart);
        if (items.length === 0) {
          drawerItems.innerHTML = `
            <div style="text-align:center; padding: 48px 16px; color: var(--text-muted);">
              <div style="font-size: 2rem; opacity: 0.35; margin-bottom: 12px;">${this.svg.cart}</div>
              <p style="font-weight: 600; font-size: 0.95rem; color: #ffffff;">Your shopping cart is empty.</p>
              <p style="font-size: 0.8rem; margin: 4px 0 18px 0;">Browse our Grade-A EV & Solar Lithium battery packs to order online.</p>
              <a href="products.html" class="btn btn-primary btn-sm">Shop Battery Packs</a>
            </div>
          `;
        } else {
          const freeShipMessage = total >= 15000
            ? `<div style="background:rgba(0,229,117,0.1); border:1px solid rgba(0,229,117,0.28); color:var(--accent-primary); padding:8px 12px; border-radius:2px; font-size:0.76rem; font-family:var(--font-mono); margin-bottom:12px; display:flex; align-items:center; gap:6px;">
                 ${this.svg.truck} <span>FREE Pan-India Insured Shipping Unlocked!</span>
               </div>`
            : `<div style="background:var(--bg-card); border:1px solid var(--border-subtle); color:var(--text-muted); padding:8px 12px; border-radius:2px; font-size:0.75rem; font-family:var(--font-mono); margin-bottom:12px;">
                 Add <strong style="color:#fff;">₹${(15000 - total).toLocaleString("en-IN")}</strong> more for FREE Pan-India Delivery
               </div>`;

          drawerItems.innerHTML = freeShipMessage + items.map(item => {
            const safeId = String(item.id).replace(/'/g, "\\'");
            return `
              <div class="quote-item-row" data-id="${escapeHtml(item.id)}" style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding:12px; background:var(--bg-card); border:1px solid var(--border-subtle); border-radius:2px; margin-bottom:8px;">
                <img src="${escapeHtml(item.image_url || 'assets/images/hero.svg')}" alt="${escapeHtml(item.title)}" style="width:42px; height:42px; object-fit:contain; background:#020408; border:1px solid var(--border-subtle); border-radius:2px; flex-shrink:0;" />
                <div class="quote-item-info" style="flex:1; min-width:0;">
                  <div class="quote-item-title" style="font-size:0.84rem; font-weight:600; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(item.title)}</div>
                  <div style="display:flex; align-items:center; gap:8px; margin-top:6px;">
                    <div class="qty-stepper" style="height:26px;">
                      <button type="button" class="stepper-btn" style="width:24px; font-size:0.85rem;" onclick="CellCare.changeCartItemQty('${safeId}', -1)">−</button>
                      <input type="text" class="stepper-input" style="width:28px; font-size:0.76rem;" value="${item.qty}" readonly />
                      <button type="button" class="stepper-btn" style="width:24px; font-size:0.85rem;" onclick="CellCare.changeCartItemQty('${safeId}', 1)">+</button>
                    </div>
                    <span style="font-family:var(--font-mono); font-size:0.74rem; color:var(--text-muted);">× ₹${(item.price || 0).toLocaleString("en-IN")}</span>
                  </div>
                </div>
                <div class="quote-item-actions" style="display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
                  <div class="quote-item-price" style="font-family:var(--font-mono); font-size:0.86rem; font-weight:700; color:var(--accent-primary);">
                    ${item.price > 0 ? `₹${(item.qty * item.price).toLocaleString("en-IN")}` : "Quote"}
                  </div>
                  <button type="button" class="quote-item-remove" onclick="CellCare.removeFromCart('${safeId}')" title="Remove item" style="background:none; border:none; color:var(--text-faint); cursor:pointer; font-size:0.8rem;">
                    ${this.svg.trash}
                  </button>
                </div>
              </div>
            `;
          }).join("");
        }
      }
    },

    // ----------------------------------------------------
    // 6. NAVBAR & SIDEBAR CONTROLS
    // ----------------------------------------------------
    initNavbar: function () {
      const header = document.querySelector(".site-header");
      if (header) {
        window.addEventListener("scroll", () => {
          if (window.scrollY > 30) header.classList.add("scrolled");
          else header.classList.remove("scrolled");
        });
      }

      const hamburger = document.getElementById("hamburgerBtn");
      const sidebar = document.getElementById("mobileSidebar");
      const backdrop = document.getElementById("overlayBackdrop");
      const closeBtn = document.getElementById("closeSidebarBtn");

      if (hamburger && sidebar && backdrop) {
        hamburger.addEventListener("click", () => {
          sidebar.classList.add("open");
          backdrop.classList.add("active");
        });

        const closeSidebar = () => {
          sidebar.classList.remove("open");
          backdrop.classList.remove("active");
        };

        if (closeBtn) closeBtn.addEventListener("click", closeSidebar);
        backdrop.addEventListener("click", closeSidebar);
      }
    },

    // ----------------------------------------------------
    // 7. CART DRAWER CONTROLS
    // ----------------------------------------------------
    initDrawer: function () {
      const drawer = document.getElementById("quoteDrawer");
      const closeBtn = document.getElementById("quoteDrawerClose");
      const proceedBtn = document.getElementById("quoteDrawerProceed");

      if (closeBtn && drawer) {
        closeBtn.addEventListener("click", () => this.closeDrawer());
      }

      if (proceedBtn) {
        proceedBtn.addEventListener("click", () => {
          if (this.getCartCount() === 0) {
            this.toast("Your cart is empty. Add items first!", "error");
            return;
          }
          window.location.href = "checkout.html";
        });
      }

      document.querySelectorAll(".open-quote-drawer").forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          this.openDrawer();
        });
      });
    },

    openDrawer: function () {
      const drawer = document.getElementById("quoteDrawer");
      const backdrop = document.getElementById("overlayBackdrop");
      if (drawer && backdrop) {
        this.updateCartUI();
        drawer.classList.add("active");
        backdrop.classList.add("active");
      }
    },

    closeDrawer: function () {
      const drawer = document.getElementById("quoteDrawer");
      const backdrop = document.getElementById("overlayBackdrop");
      if (drawer && backdrop) {
        drawer.classList.remove("active");
        backdrop.classList.remove("active");
      }
    },

    // ----------------------------------------------------
    // 8. TOAST NOTIFICATIONS & WHATSAPP
    // ----------------------------------------------------
    toast: function (message, type = "info") {
      let container = document.getElementById("siteToastContainer");
      if (!container) {
        container = document.createElement("div");
        container.id = "siteToastContainer";
        container.className = "toast-container";
        document.body.appendChild(container);
      }

      const toast = document.createElement("div");
      toast.className = `toast toast-${type}`;

      let iconSvg = '<svg class="svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
      if (type === "success") {
        iconSvg = '<svg class="svg-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>';
      } else if (type === "error") {
        iconSvg = '<svg class="svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
      }

      toast.innerHTML = `${iconSvg}<span>${escapeHtml(message)}</span>`;
      container.appendChild(toast);

      setTimeout(() => {
        toast.style.animation = "toastOut 0.3s forwards";
        setTimeout(() => toast.remove(), 300);
      }, 3500);
    },

    openWhatsApp: function (message) {
      const number = this.getWhatsAppNumber();
      const text = encodeURIComponent(message);
      const url = `https://wa.me/${number}?text=${text}`;
      try {
        const win = window.open(url, "_blank");
        if (!win || win.closed || typeof win.closed === "undefined") {
          window.location.assign(url);
        }
      } catch (e) {
        window.location.assign(url);
      }
    },

    escapeHtml: function (str) {
      return escapeHtml(str);
    },

    startPreloader: function () {
      let loader = document.getElementById("cyberTopLoader");
      if (!loader) {
        loader = document.createElement("div");
        loader.id = "cyberTopLoader";
        loader.className = "cyber-top-loader";
        document.body.appendChild(loader);
      }
      loader.classList.add("loading");
      loader.style.width = "25%";
      if (this._preloaderTimer) clearInterval(this._preloaderTimer);
      this._preloaderTimer = setInterval(() => {
        const cur = parseFloat(loader.style.width) || 25;
        if (cur < 85) {
          loader.style.width = (cur + Math.random() * 10) + "%";
        }
      }, 200);
    },

    finishPreloader: function () {
      const loader = document.getElementById("cyberTopLoader");
      if (!loader) return;
      if (this._preloaderTimer) {
        clearInterval(this._preloaderTimer);
        this._preloaderTimer = null;
      }
      loader.style.width = "100%";
      setTimeout(() => {
        loader.classList.remove("loading");
        setTimeout(() => {
          loader.style.width = "0%";
        }, 400);
      }, 250);
    }
  };

  window.startPreloader = function () { if (window.CellCare) window.CellCare.startPreloader(); };
  window.finishPreloader = function () { if (window.CellCare) window.CellCare.finishPreloader(); };

  function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  try {
    window.CellCare.loadCartFromStorage();
  } catch (e) {}

  document.addEventListener("DOMContentLoaded", function () {
    window.CellCare.init();
  });

})(window, document);
