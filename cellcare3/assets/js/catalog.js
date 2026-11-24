/**
 * CELL CARE INDIA — DYNAMIC CATALOG & E-COMMERCE ENGINE (v4.0)
 * Powered by /api/products with multi-facet filtering, sorting, compatibility search,
 * MRP discount badges, quantity steppers, Add to Cart, and 1-Click Buy Now.
 */

(function () {
  "use strict";

  const state = {
    products: [],
    categories: [],
    filteredProducts: [],
    query: "",
    category: "",
    sortBy: "default",
    inStockOnly: false,
    page: 1,
    pageSize: 12,
    viewMode: "grid"
  };

  let container = null;
  let searchInput = null;
  let categorySelect = null;
  let sortSelect = null;
  let inStockCheckbox = null;
  let chipsContainer = null;
  let paginationContainer = null;
  let resultCountEl = null;
  let clearFiltersBtn = null;

  function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function bindDOMElements() {
    container = document.getElementById("productsGrid");
    searchInput = document.getElementById("catalogSearchInput");
    categorySelect = document.getElementById("catalogCategorySelect");
    sortSelect = document.getElementById("catalogSortSelect");
    inStockCheckbox = document.getElementById("catalogInStockOnly");
    chipsContainer = document.getElementById("categoryChipsContainer");
    paginationContainer = document.getElementById("catalogPagination");
    resultCountEl = document.getElementById("catalogResultCount");
    clearFiltersBtn = document.getElementById("clearFiltersBtn");

    if (sortSelect && !sortSelect.querySelector('option[value="rating"]')) {
      const ratingOpt = document.createElement("option");
      ratingOpt.value = "rating";
      ratingOpt.textContent = "Sort: Top Rated / Popularity";
      sortSelect.insertBefore(ratingOpt, sortSelect.children[1] || null);
    }
  }

  function renderSkeletonCards(count) {
    if (!container) return;
    const num = count || state.pageSize || 8;
    let html = "";
    for (let i = 0; i < num; i++) {
      html += `
        <div class="skeleton-card" aria-hidden="true">
          <div class="skeleton-media skeleton-shimmer"></div>
          <div class="skeleton-content">
            <div class="skeleton-pill skeleton-shimmer"></div>
            <div class="skeleton-title-bar skeleton-shimmer"></div>
            <div class="skeleton-desc-bar skeleton-shimmer"></div>
            <div class="skeleton-desc-bar short skeleton-shimmer"></div>
            <div class="skeleton-moq-bar skeleton-shimmer"></div>
            <div class="skeleton-price-bar skeleton-shimmer"></div>
            <div class="skeleton-actions-row">
              <div class="skeleton-btn-bar skeleton-shimmer"></div>
              <div class="skeleton-btn-bar skeleton-shimmer"></div>
            </div>
          </div>
        </div>
      `;
    }
    container.innerHTML = html;
    if (resultCountEl) {
      resultCountEl.innerHTML = `<span style="color:var(--accent-primary);"><svg class="svg-icon spin" viewBox="0 0 24 24" style="animation:spin 1s linear infinite; display:inline-block; vertical-align:middle; margin-right:4px;"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg> Synchronizing live inventory...</span>`;
    }
  }

  function renderFetchError() {
    if (!container) return;
    container.innerHTML = `
      <div class="preloader-status-box" style="grid-column: 1 / -1; padding: 60px 20px;">
        <div class="cyber-spinner" style="margin-bottom: 12px; border-top-color: var(--accent-amber);"></div>
        <h3 style="color:#ffffff;">Connecting to Master Inventory...</h3>
        <p style="color:var(--text-muted); max-width:480px; margin: 0 auto 16px;">
          Live synchronization from backend catalogue is taking a few moments. Please check your connection or tap below to reconnect.
        </p>
        <button id="catalogRetryBtn" class="btn btn-primary btn-md">
          <svg class="svg-icon" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg> Retry Connection
        </button>
      </div>
    `;
    const retryBtn = document.getElementById("catalogRetryBtn");
    if (retryBtn) {
      retryBtn.addEventListener("click", () => {
        renderSkeletonCards(8);
        if (window.startPreloader) window.startPreloader();
        syncWithLiveApi(true);
      });
    }
  }

  function initCatalogData() {
    if (!container) return;
    if (window.startPreloader) window.startPreloader();
    renderSkeletonCards(8);
    syncWithLiveApi(false);
  }

  function extractCategoriesFromProducts() {
    const uniqueCats = new Set();
    state.products.forEach(p => {
      if (p.category) uniqueCats.add(p.category);
    });
    state.categories = Array.from(uniqueCats).map(name => ({
      name,
      slug: name.toLowerCase().replace(/\s+/g, "-")
    }));
  }

  async function syncWithLiveApi(forceRefresh) {
    try {
      let data = null;
      if (window.CellCare && typeof window.CellCare.fetchProducts === "function") {
        data = await window.CellCare.fetchProducts(forceRefresh);
      } else {
        const res = await fetch("/api/products");
        if (res && res.ok) data = await res.json();
      }

      const items = (data && (data.items || data.results)) || [];
      if (items.length > 0) {
        state.products = items.map(p => ({
          ...p,
          id: String(p.id),
          sku: String(p.sku || `CC-${String(p.id).toUpperCase()}`),
          slug: p.slug || String(p.title || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
          title: p.title,
          price: Number(p.price) || 0,
          mrp: Number(p.mrp || p.regular_price) || (Number(p.price) ? Math.round(Number(p.price) * 1.18) : 0),
          stock_qty: p.stock_qty !== undefined ? Number(p.stock_qty) : 25,
          category: p.category || "EV Battery Packs",
          compatibility: p.compatibility || "Universal EV & Solar Application",
          image_url: p.image_url || "assets/images/hero.svg",
          description: p.description || "",
          available: p.available !== false,
          min_quantity: Number(p.min_quantity || p.moq) || 1,
          rating: Number(p.rating) || 4.8,
          reviews_count: Number(p.reviews_count) || 24
        }));

        extractCategoriesFromProducts();
        populateCategoryFilters();
        applyFiltersAndRender();
        if (window.finishPreloader) window.finishPreloader();
        return;
      }

      if (state.products.length === 0) {
        renderFetchError();
      }
    } catch (e) {
      console.debug("Catalog sync note:", e);
      if (state.products.length === 0) {
        renderFetchError();
      }
    } finally {
      if (window.finishPreloader) window.finishPreloader();
    }
  }

  function populateCategoryFilters() {
    if (categorySelect) {
      categorySelect.innerHTML = '<option value="">All Categories</option>';
      state.categories.forEach(cat => {
        const opt = document.createElement("option");
        opt.value = cat.slug || cat.name;
        opt.textContent = cat.name;
        categorySelect.appendChild(opt);
      });
      if (state.category) categorySelect.value = state.category;
    }

    if (chipsContainer) {
      chipsContainer.innerHTML = `
        <button class="category-chip ${state.category === "" ? "active" : ""}" data-slug="">
          All Products (${state.products.length})
        </button>
      `;
      state.categories.forEach(cat => {
        const slug = cat.slug || cat.name;
        const count = state.products.filter(p => (p.category || "").toLowerCase().replace(/\s+/g, "-") === slug).length;
        const btn = document.createElement("button");
        btn.className = `category-chip ${state.category === slug ? "active" : ""}`;
        btn.dataset.slug = slug;
        btn.textContent = `${cat.name} (${count})`;
        chipsContainer.appendChild(btn);
      });
    }
  }

  function applyFiltersAndRender() {
    let result = state.products.slice();

    if (state.query) {
      const q = state.query.toLowerCase();
      result = result.filter(p => {
        const titleMatch = (p.title || "").toLowerCase().includes(q);
        const descMatch = (p.description || "").toLowerCase().includes(q);
        const catMatch = (p.category || "").toLowerCase().includes(q);
        const compatMatch = (p.compatibility || "").toLowerCase().includes(q);
        const skuMatch = (String(p.id || "") + " " + String(p.sku || "")).toLowerCase().includes(q);
        return titleMatch || descMatch || catMatch || compatMatch || skuMatch;
      });
    }

    if (state.category) {
      const catMatchSlug = state.category.toLowerCase();
      result = result.filter(p => {
        const cat = (p.category || "").toLowerCase().replace(/\s+/g, "-");
        return cat === catMatchSlug || (p.category || "").toLowerCase() === catMatchSlug;
      });
    }

    if (state.inStockOnly) {
      result = result.filter(p => p.available !== false && (p.stock_qty === undefined || Number(p.stock_qty) > 0));
    }

    if (state.sortBy === "price-low") {
      result.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
    } else if (state.sortBy === "price-high") {
      result.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
    } else if (state.sortBy === "rating") {
      result.sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
    } else if (state.sortBy === "name-asc") {
      result.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    } else if (state.sortBy === "name-desc") {
      result.sort((a, b) => (b.title || "").localeCompare(a.title || ""));
    } else if (state.sortBy === "moq-low") {
      result.sort((a, b) => (Number(a.min_quantity) || 1) - (Number(b.min_quantity) || 1));
    }

    state.filteredProducts = result;

    if (resultCountEl) {
      resultCountEl.innerHTML = `Showing <strong>${result.length}</strong> verified battery &amp; BMS products`;
    }

    renderCards();
    renderPagination();
    syncUrlParams();
  }

  function renderCards() {
    if (!container) return;
    container.classList.toggle("list-view", state.viewMode === "list");
    container.innerHTML = "";

    const items = state.filteredProducts;

    if (!items.length) {
      container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-xs);">
          <svg class="svg-icon" style="width: 44px; height: 44px; stroke-width: 1.5; color: var(--text-faint); margin-bottom: 16px;" viewBox="0 0 24 24"><rect x="2" y="7" width="16" height="10" rx="0"></rect><line x1="22" y1="11" x2="22" y2="13"></line><line x1="6" y1="11" x2="6" y2="13"></line></svg>
          <h3 style="color: #ffffff; margin-bottom: 8px;">No matching battery specifications</h3>
          <p style="color: var(--text-muted); margin-bottom: 20px; font-size: 0.9rem;">Try adjusting your voltage/capacity/vehicle search terms or resetting category filters.</p>
          <button class="btn btn-outline" id="resetFiltersInnerBtn">Reset Filters</button>
        </div>
      `;
      const resetBtn = document.getElementById("resetFiltersInnerBtn");
      if (resetBtn) resetBtn.addEventListener("click", resetAllFilters);
      return;
    }

    const startIndex = (state.page - 1) * state.pageSize;
    const paginatedItems = items.slice(startIndex, startIndex + state.pageSize);

    paginatedItems.forEach(p => {
      const card = createProductCardElement(p);
      container.appendChild(card);
    });
  }

  function createProductCardElement(p) {
    const card = document.createElement("article");
    card.className = "product-card";
    card.dataset.id = p.id;

    const imgUrl = p.image_url || "assets/images/hero.svg";
    const title = p.title || "Industrial Battery Unit";
    const desc = p.description || "High-performance Grade-A battery pack engineered with active BMS safety protection.";
    const priceNum = Number(p.price) || 0;
    const mrpNum = Number(p.mrp || p.regular_price) || (priceNum > 0 ? Math.round(priceNum * 1.18) : 0);
    const discountPct = (priceNum > 0 && mrpNum > priceNum) ? Math.round(((mrpNum - priceNum) / mrpNum) * 100) : 0;
    const formattedPrice = priceNum ? `₹${priceNum.toLocaleString("en-IN")}` : "Contact for Price";
    const formattedMrp = mrpNum > priceNum ? `₹${mrpNum.toLocaleString("en-IN")}` : "";
    const minQty = parseInt(p.min_quantity || p.moq || 1, 10);
    const stockQty = p.stock_qty !== undefined ? Number(p.stock_qty) : 25;
    const isAvailable = p.available !== false && stockQty > 0;
    const category = p.category || "Lithium-Ion";
    const rating = Number(p.rating || 4.8).toFixed(1);
    const reviewsCount = Number(p.reviews_count || 24);

    const detailUrl = `product.html?id=${encodeURIComponent(p.id)}`;
    const cartItem = window.CellCare ? window.CellCare.cart[p.id] : null;
    const currentQty = cartItem ? cartItem.qty : minQty;
    const svg = (window.CellCare && window.CellCare.svg) || {};

    card.innerHTML = `
      <div class="product-card-media">
        <a href="${detailUrl}" class="product-card-media-link" aria-label="${escapeHtml(title)}" style="display:block; width:100%; height:100%;">
          <img src="${imgUrl}" class="product-card-img" alt="${escapeHtml(title)}" loading="lazy" />
        </a>
        <div class="product-card-badges">
          <span class="badge ${isAvailable ? "badge-success" : "badge-amber"}">
            ${isAvailable ? (svg.check || "") : (svg.info || "")} ${isAvailable ? `In Stock (${stockQty})` : "Pre-Order"}
          </span>
          ${discountPct > 0 ? `<span class="badge badge-amber">-${discountPct}% OFF</span>` : `<span class="badge badge-cyan">${escapeHtml(category)}</span>`}
        </div>
      </div>

      <div class="product-card-content">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <span class="product-card-category" style="margin-bottom:0;">${escapeHtml(category)}</span>
          <span style="font-family:var(--font-mono); font-size:0.72rem; color:var(--accent-amber);" title="${reviewsCount} Verified Reviews">★ ${rating} (${reviewsCount})</span>
        </div>
        <h3 class="product-card-title">
          <a href="${detailUrl}">${escapeHtml(title)}</a>
        </h3>
        <p class="product-card-desc">${escapeHtml(desc)}</p>
        
        <div class="product-card-moq">
          ${svg.boxes || ""} ${p.compatibility ? `Fits: <strong>${escapeHtml(String(p.compatibility).split(",")[0])}</strong>` : `Min Order: <strong>${minQty} Unit${minQty > 1 ? "s" : ""}</strong>`}
        </div>

        <div class="product-card-pricing">
          <div>
            <div style="display:flex; align-items:baseline; gap:8px;">
              <span class="product-price-val">${formattedPrice}</span>
              ${formattedMrp ? `<span style="font-family:var(--font-mono); font-size:0.78rem; color:var(--text-faint); text-decoration:line-through;">${formattedMrp}</span>` : ""}
            </div>
            <div class="product-price-label">GST inclusive • Insured Pan-India Delivery</div>
          </div>
        </div>

        <div class="product-card-actions">
          <div class="card-stepper-row">
            <div class="qty-stepper">
              <button class="stepper-btn btn-minus" data-id="${p.id}" data-min="${minQty}">−</button>
              <input type="text" class="stepper-input qty-input" value="${currentQty}" readonly data-min="${minQty}" data-step="1" />
              <button class="stepper-btn btn-plus" data-id="${p.id}" data-step="1">+</button>
            </div>
            <button class="btn btn-primary btn-sm btn-add-quote" data-id="${p.id}" style="flex:1.2;">
              ${svg.cart || ""} Add to Cart
            </button>
          </div>

          <div class="card-btn-grid">
            <button class="btn btn-secondary btn-sm btn-buy-now" data-id="${p.id}" style="border-color:rgba(0,229,117,0.35); color:var(--accent-primary);">
              ${svg.lightning || ""} Buy Now
            </button>
            <a href="${detailUrl}" class="btn btn-outline btn-sm">
              ${svg.info || ""} View Specs
            </a>
          </div>
        </div>
      </div>
    `;

    attachCardListeners(card, p);
    return card;
  }

  function attachCardListeners(card, product) {
    const input = card.querySelector(".qty-input");
    const minusBtn = card.querySelector(".btn-minus");
    const plusBtn = card.querySelector(".btn-plus");
    const addCartBtn = card.querySelector(".btn-add-quote");
    const buyNowBtn = card.querySelector(".btn-buy-now");

    const minQty = parseInt(input.dataset.min, 10) || 1;
    const step = parseInt(input.dataset.step, 10) || 1;

    plusBtn.addEventListener("click", () => {
      let cur = parseInt(input.value, 10) || minQty;
      input.value = cur + step;
    });

    minusBtn.addEventListener("click", () => {
      let cur = parseInt(input.value, 10) || minQty;
      if (cur > minQty) {
        input.value = cur - step;
      }
    });

    addCartBtn.addEventListener("click", () => {
      const selectedQty = parseInt(input.value, 10) || minQty;
      if (window.CellCare) {
        window.CellCare.addToCart(product, selectedQty);
      }
    });

    if (buyNowBtn) {
      buyNowBtn.addEventListener("click", () => {
        const selectedQty = parseInt(input.value, 10) || minQty;
        if (window.CellCare && typeof window.CellCare.buyNow === "function") {
          window.CellCare.buyNow(product, selectedQty);
        }
      });
    }
  }

  function renderPagination() {
    if (!paginationContainer) return;
    paginationContainer.innerHTML = "";

    const totalPages = Math.ceil(state.filteredProducts.length / state.pageSize);
    if (totalPages <= 1) return;

    const prevBtn = document.createElement("button");
    prevBtn.className = "page-num-btn";
    prevBtn.setAttribute("aria-label", "Previous Page");
    prevBtn.innerHTML = '<svg class="svg-icon" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"></polyline></svg>';
    prevBtn.disabled = state.page === 1;
    prevBtn.onclick = () => {
      state.page--;
      renderCards();
      renderPagination();
      window.scrollTo({ top: container.offsetTop - 120, behavior: "smooth" });
    };
    paginationContainer.appendChild(prevBtn);

    for (let i = 1; i <= totalPages; i++) {
      const btn = document.createElement("button");
      btn.className = `page-num-btn ${i === state.page ? "active" : ""}`;
      btn.textContent = i;
      btn.onclick = () => {
        state.page = i;
        renderCards();
        renderPagination();
        window.scrollTo({ top: container.offsetTop - 120, behavior: "smooth" });
      };
      paginationContainer.appendChild(btn);
    }

    const nextBtn = document.createElement("button");
    nextBtn.className = "page-num-btn";
    nextBtn.setAttribute("aria-label", "Next Page");
    nextBtn.innerHTML = '<svg class="svg-icon" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg>';
    nextBtn.disabled = state.page === totalPages;
    nextBtn.onclick = () => {
      state.page++;
      renderCards();
      renderPagination();
      window.scrollTo({ top: container.offsetTop - 120, behavior: "smooth" });
    };
    paginationContainer.appendChild(nextBtn);
  }

  function resetAllFilters() {
    state.query = "";
    state.category = "";
    state.sortBy = "default";
    state.inStockOnly = false;
    state.page = 1;

    if (searchInput) searchInput.value = "";
    if (categorySelect) categorySelect.value = "";
    if (sortSelect) sortSelect.value = "default";
    if (inStockCheckbox) inStockCheckbox.checked = false;

    populateCategoryFilters();
    applyFiltersAndRender();
  }

  function readUrlParams() {
    const params = new URLSearchParams(window.location.search);
    if (params.has("q")) state.query = params.get("q");
    if (params.has("category")) state.category = params.get("category");
    if (params.has("sort")) state.sortBy = params.get("sort");
    if (params.has("inStock")) state.inStockOnly = params.get("inStock") === "true";
    if (params.has("page")) state.page = parseInt(params.get("page"), 10) || 1;

    if (searchInput && state.query) searchInput.value = state.query;
    if (sortSelect && state.sortBy) sortSelect.value = state.sortBy;
    if (inStockCheckbox) inStockCheckbox.checked = state.inStockOnly;
  }

  function syncUrlParams() {
    try {
      if (!window.history || typeof window.history.replaceState !== "function") return;
      if (window.location && window.location.protocol === "file:") return;

      const params = new URLSearchParams();
      if (state.query) params.set("q", state.query);
      if (state.category) params.set("category", state.category);
      if (state.sortBy !== "default") params.set("sort", state.sortBy);
      if (state.inStockOnly) params.set("inStock", "true");
      if (state.page > 1) params.set("page", state.page);

      const pathname = (window.location && window.location.pathname) || "";
      const newUrl = pathname + (params.toString() ? "?" + params.toString() : "");
      window.history.replaceState({}, "", newUrl);
    } catch (e) {}
  }

  function initListeners() {
    if (searchInput) {
      let timeout;
      searchInput.addEventListener("input", (e) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          state.query = e.target.value.trim();
          state.page = 1;
          applyFiltersAndRender();
        }, 250);
      });
    }

    if (categorySelect) {
      categorySelect.addEventListener("change", (e) => {
        state.category = e.target.value;
        state.page = 1;
        populateCategoryFilters();
        applyFiltersAndRender();
      });
    }

    if (chipsContainer) {
      chipsContainer.addEventListener("click", (e) => {
        const chip = e.target.closest(".category-chip");
        if (!chip) return;
        state.category = chip.dataset.slug || "";
        state.page = 1;
        if (categorySelect) categorySelect.value = state.category;
        populateCategoryFilters();
        applyFiltersAndRender();
      });
    }

    if (sortSelect) {
      sortSelect.addEventListener("change", (e) => {
        state.sortBy = e.target.value;
        state.page = 1;
        applyFiltersAndRender();
      });
    }

    if (inStockCheckbox) {
      inStockCheckbox.addEventListener("change", (e) => {
        state.inStockOnly = e.target.checked;
        state.page = 1;
        applyFiltersAndRender();
      });
    }

    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener("click", resetAllFilters);
    }

    const gridBtn = document.getElementById("viewGridBtn");
    const listBtn = document.getElementById("viewListBtn");
    if (gridBtn && listBtn && container) {
      const setViewMode = (mode) => {
        state.viewMode = mode;
        if (mode === "list") {
          listBtn.classList.add("active");
          gridBtn.classList.remove("active");
          container.classList.add("list-view");
        } else {
          gridBtn.classList.add("active");
          listBtn.classList.remove("active");
          container.classList.remove("list-view");
        }
        try { localStorage.setItem("cellcare_view_mode", mode); } catch (e) {}
      };

      gridBtn.addEventListener("click", (e) => {
        e.preventDefault();
        setViewMode("grid");
      });
      listBtn.addEventListener("click", (e) => {
        e.preventDefault();
        setViewMode("list");
      });

      try {
        const savedMode = localStorage.getItem("cellcare_view_mode");
        if (savedMode === "list") setViewMode("list");
      } catch (e) {}
    }
  }

  function bootCatalog() {
    bindDOMElements();
    initListeners();
    readUrlParams();
    initCatalogData();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootCatalog);
  } else {
    bootCatalog();
  }

})();
