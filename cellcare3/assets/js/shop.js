/**
 * CELL CARE INDIA — DYNAMIC SHOP & CATALOG ENGINE (shop.js)
 * Powered 100% by live Google Sheets API categories, brands, prices, search,
 * availability filter, sorting, grid/list view, and pagination.
 */

(function (window, document) {
  "use strict";

  const PAGE_SIZE = 12;

  const state = {
    allProducts: [],
    categories: [],
    brandsList: [],
    filtered: [],
    category: "all",
    brands: new Set(),
    q: "",
    maxPrice: 50000,
    absMaxPrice: 50000,
    inStockOnly: false,
    sort: "default",
    view: "grid",
    page: 1
  };

  function readUrlParams() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("category")) state.category = params.get("category").toLowerCase();
    if (params.get("q")) state.q = params.get("q").trim();
    if (params.get("brand")) {
      params.get("brand").split(",").forEach(b => {
        if (b.trim()) state.brands.add(b.trim());
      });
    }
    if (params.get("sort")) state.sort = params.get("sort");

    const searchInput = document.getElementById("ccSearchInput");
    if (searchInput && state.q) searchInput.value = state.q;
    const sortEl = document.getElementById("ccShopSort");
    if (sortEl) sortEl.value = state.sort;
  }

  function renderSidebarCategories() {
    const list = document.getElementById("ccSidebarCategories");
    if (!list) return;
    const CC = window.CellCare;

    list.innerHTML = `
      <li>
        <a href="#" data-cat="all" class="${state.category === "all" ? "active" : ""}">
          <span>All Products</span>
          <span class="cc-cat-count">(${state.allProducts.length})</span>
        </a>
      </li>
      ${state.categories.map(c => `
        <li>
          <a href="#" data-cat="${CC.esc(c.slug)}" class="${state.category === c.slug ? "active" : ""}">
            <span>${CC.esc(c.name)}</span>
            <span class="cc-cat-count">(${c.count})</span>
          </a>
        </li>
      `).join("")}
    `;

    list.querySelectorAll("a[data-cat]").forEach(a => {
      a.addEventListener("click", e => {
        e.preventDefault();
        state.category = a.dataset.cat;
        state.page = 1;
        applyFiltersAndRender();
      });
    });
  }

  function renderSidebarBrands(filterText = "") {
    const box = document.getElementById("ccSidebarBrands");
    if (!box) return;
    const CC = window.CellCare;
    const entries = state.brandsList.filter(b =>
      !filterText || b.name.toLowerCase().includes(filterText.toLowerCase())
    );

    if (!entries.length) {
      box.innerHTML = `<div style="font-size:12.5px; color:var(--text-muted);">No matching brands.</div>`;
      return;
    }

    box.innerHTML = entries.map(b => {
      const checked = Array.from(state.brands).some(x => x.toLowerCase() === b.name.toLowerCase());
      return `
        <label class="cc-check-label">
          <input type="checkbox" value="${CC.esc(b.name)}" ${checked ? "checked" : ""} class="cc-brand-cb" />
          <span>${CC.esc(b.name)} <span style="color:var(--text-muted);">(${b.count})</span></span>
        </label>
      `;
    }).join("");

    box.querySelectorAll(".cc-brand-cb").forEach(cb => {
      cb.addEventListener("change", () => {
        if (cb.checked) state.brands.add(cb.value);
        else {
          Array.from(state.brands).forEach(x => {
            if (x.toLowerCase() === cb.value.toLowerCase()) state.brands.delete(x);
          });
        }
        state.page = 1;
        applyFiltersAndRender();
      });
    });
  }

  function updatePriceReadout() {
    const el = document.getElementById("ccPriceReadout");
    if (el) el.textContent = `Price: ₹0 — ${window.CellCare.formatINRWhole(state.maxPrice)}`;
  }

  function renderActiveChips() {
    const wrap = document.getElementById("ccActiveFilters");
    if (!wrap) return;
    const CC = window.CellCare;
    const chips = [];

    if (state.category !== "all") {
      const catObj = state.categories.find(c => c.slug === state.category);
      chips.push({ label: `Category: ${catObj ? catObj.name : state.category}`, clear: () => { state.category = "all"; } });
    }
    if (state.q) {
      chips.push({ label: `Search: "${state.q}"`, clear: () => { state.q = ""; const i = document.getElementById("ccSearchInput"); if (i) i.value = ""; } });
    }
    state.brands.forEach(b => {
      chips.push({ label: `Brand: ${b}`, clear: () => { state.brands.delete(b); } });
    });
    if (state.maxPrice < state.absMaxPrice) {
      chips.push({ label: `Max Price: ${CC.formatINRWhole(state.maxPrice)}`, clear: () => { state.maxPrice = state.absMaxPrice; const s = document.getElementById("ccPriceRange"); if (s) s.value = state.absMaxPrice; updatePriceReadout(); } });
    }
    if (state.inStockOnly) {
      chips.push({ label: "In Stock Only", clear: () => { state.inStockOnly = false; const el = document.getElementById("ccInStockOnly"); if (el) el.checked = false; } });
    }

    if (!chips.length) {
      wrap.innerHTML = "";
      return;
    }

    wrap.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:16px;">
        ${chips.map((c, idx) => `
          <button type="button" data-chip="${idx}" style="background:var(--brand-green-tint); border:1px solid var(--brand-green); color:var(--brand-charcoal); font-size:12.5px; font-weight:600; padding:4px 10px; border-radius:4px; cursor:pointer;">
            ${CC.esc(c.label)} &times;
          </button>
        `).join("")}
        <button type="button" id="ccClearAllFilters" style="background:none; border:none; color:var(--brand-green); font-size:12.5px; font-weight:700; cursor:pointer; text-decoration:underline;">Clear all</button>
      </div>
    `;

    wrap.querySelectorAll("[data-chip]").forEach(btn => {
      btn.addEventListener("click", () => {
        chips[Number(btn.dataset.chip)].clear();
        state.page = 1;
        applyFiltersAndRender();
      });
    });

    document.getElementById("ccClearAllFilters")?.addEventListener("click", () => {
      state.category = "all";
      state.brands.clear();
      state.q = "";
      state.maxPrice = state.absMaxPrice;
      state.inStockOnly = false;
      state.page = 1;
      const s = document.getElementById("ccPriceRange");
      if (s) s.value = state.absMaxPrice;
      const cb = document.getElementById("ccInStockOnly");
      if (cb) cb.checked = false;
      updatePriceReadout();
      applyFiltersAndRender();
    });
  }

  function applyFiltersAndRender() {
    const CC = window.CellCare;
    let items = [...state.allProducts];

    if (state.category && state.category !== "all") {
      items = items.filter(p => p.category_slug === state.category || CC.slugify(p.category) === state.category);
    }

    if (state.brands.size > 0) {
      const wanted = Array.from(state.brands).map(b => b.toLowerCase());
      items = items.filter(p => wanted.some(w => p.brand.toLowerCase().includes(w)));
    }

    if (state.q) {
      const q = state.q.toLowerCase();
      items = items.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q)
      );
    }

    if (state.inStockOnly) {
      items = items.filter(p => p.available);
    }

    items = items.filter(p => Number(p.price) <= state.maxPrice);

    switch (state.sort) {
      case "price-asc": items.sort((a, b) => a.price - b.price); break;
      case "price-desc": items.sort((a, b) => b.price - a.price); break;
      case "name-asc": items.sort((a, b) => a.title.localeCompare(b.title)); break;
      case "newest": items.sort((a, b) => Number(b.id) - Number(a.id)); break;
    }

    state.filtered = items;
    renderSidebarCategories();
    renderSidebarBrands(document.getElementById("ccBrandSearch")?.value || "");
    renderActiveChips();

    const countEl = document.getElementById("ccProductsFound");
    if (countEl) countEl.innerHTML = `<strong>${items.length}</strong> Products found`;

    const crumbEl = document.getElementById("ccShopCrumb");
    if (crumbEl) {
      const catObj = state.categories.find(c => c.slug === state.category);
      crumbEl.textContent = state.q ? `Search: "${state.q}"` : (catObj ? catObj.name : "All Products");
    }

    const grid = document.getElementById("ccShopGrid");
    if (!grid) return;
    grid.classList.toggle("list-view", state.view === "list");

    const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    if (state.page > totalPages) state.page = totalPages;
    const start = (state.page - 1) * PAGE_SIZE;
    const slice = items.slice(start, start + PAGE_SIZE);

    if (!slice.length) {
      grid.innerHTML = `
        <div class="cc-loading-box">
          <i class="fas fa-search" style="font-size:32px; color:var(--brand-green); margin-bottom:10px;"></i>
          <h3 style="margin:0 0 8px; color:var(--brand-charcoal);">No matching products found</h3>
          <p style="margin:0 0 18px;">Try adjusting your filters or search by product name, category, or SKU.</p>
          <button type="button" class="cc-btn-primary" onclick="window.location.href='shop.html'">Show All Products</button>
        </div>
      `;
    } else {
      grid.innerHTML = slice.map(p => CC.renderProductCard(p)).join("");
    }

    renderPagination(totalPages);
  }

  function renderPagination(totalPages) {
    const pag = document.getElementById("ccPagination");
    if (!pag) return;
    if (totalPages <= 1) {
      pag.innerHTML = "";
      return;
    }
    let html = `<button type="button" class="cc-page-btn" ${state.page === 1 ? "disabled" : ""} data-page="${state.page - 1}">&lsaquo; Prev</button>`;
    for (let i = 1; i <= totalPages; i++) {
      html += `<button type="button" class="cc-page-btn ${i === state.page ? "active" : ""}" data-page="${i}">${i}</button>`;
    }
    html += `<button type="button" class="cc-page-btn" ${state.page === totalPages ? "disabled" : ""} data-page="${state.page + 1}">Next &rsaquo;</button>`;
    pag.innerHTML = html;

    pag.querySelectorAll("[data-page]").forEach(btn => {
      btn.addEventListener("click", () => {
        const next = Number(btn.dataset.page);
        if (next >= 1 && next <= totalPages) {
          state.page = next;
          applyFiltersAndRender();
          window.scrollTo({ top: 180, behavior: "smooth" });
        }
      });
    });
  }

  async function initShop() {
    readUrlParams();
    const grid = document.getElementById("ccShopGrid");
    if (grid) {
      grid.innerHTML = `
        <div class="cc-loading-box">
          <i class="fas fa-spinner fa-spin" style="font-size:24px; color:var(--brand-green); margin-bottom:10px;"></i>
          <div>Loading live products from Google Sheets...</div>
        </div>
      `;
    }

    const res = await window.CellCare.fetchProducts();
    if (!res.ok && !res.items.length) {
      if (grid) {
        grid.innerHTML = `
          <div class="cc-loading-box">
            <h3 style="margin:0 0 8px; color:var(--brand-charcoal);">Could not load products</h3>
            <p style="margin:0 0 16px;">${window.CellCare.esc(res.error || "Please try refreshing the page.")}</p>
            <button type="button" class="cc-btn-primary" onclick="location.reload()">Retry</button>
          </div>
        `;
      }
      return;
    }

    // Shuffle catalog fresh on each page visit for Default sorting (stable across pagination within the visit)
    state.allProducts = window.CellCare.shuffleArray(res.items || []);
    state.categories = res.categories || [];
    state.brandsList = res.brands || [];

    const maxP = Math.max(...state.allProducts.map(p => Number(p.price) || 0), 10000);
    state.absMaxPrice = Math.ceil(maxP / 500) * 500;
    state.maxPrice = state.absMaxPrice;

    const slider = document.getElementById("ccPriceRange");
    if (slider) {
      slider.max = String(state.absMaxPrice);
      slider.step = "50";
      slider.value = String(state.absMaxPrice);
      slider.addEventListener("input", () => {
        state.maxPrice = Number(slider.value);
        updatePriceReadout();
      });
    }
    updatePriceReadout();

    document.getElementById("ccApplyPriceBtn")?.addEventListener("click", () => {
      state.page = 1;
      applyFiltersAndRender();
    });

    document.getElementById("ccBrandSearch")?.addEventListener("input", e => {
      renderSidebarBrands(e.target.value);
    });

    document.getElementById("ccInStockOnly")?.addEventListener("change", e => {
      state.inStockOnly = e.target.checked;
      state.page = 1;
      applyFiltersAndRender();
    });

    document.getElementById("ccShopSort")?.addEventListener("change", e => {
      state.sort = e.target.value;
      state.page = 1;
      applyFiltersAndRender();
    });

    document.getElementById("ccViewGrid")?.addEventListener("click", () => {
      state.view = "grid";
      document.getElementById("ccViewGrid").classList.add("active");
      document.getElementById("ccViewList").classList.remove("active");
      applyFiltersAndRender();
    });

    document.getElementById("ccViewList")?.addEventListener("click", () => {
      state.view = "list";
      document.getElementById("ccViewList").classList.add("active");
      document.getElementById("ccViewGrid").classList.remove("active");
      applyFiltersAndRender();
    });

    applyFiltersAndRender();
  }

  document.addEventListener("DOMContentLoaded", () => setTimeout(initShop, 20));
})(window, document);
