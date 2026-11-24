/**
 * CELL CARE INDIA — SINGLE PRODUCT DETAIL PAGE ENGINE (pdp.js)
 * Driven by live Google Sheets fields (title, sku, category, brand, price,
 * available, min_quantity, description, image_url).
 * Primary action: "Enquire on WhatsApp" (+91 8505910581) with prefilled message.
 * No COD, No Razorpay. Official brand palette (#22272B, #FFFFFF, #159447).
 */

(function (window, document) {
  "use strict";

  let activeProduct = null;

  function initImageZoom() {
    const wrap = document.getElementById("pdpMainImgWrap");
    const img = document.getElementById("pdpMainImg");
    if (!wrap || !img) return;

    wrap.addEventListener("mousemove", e => {
      const rect = wrap.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      img.style.transformOrigin = `${x}% ${y}%`;
      img.style.transform = "scale(1.85)";
    });

    wrap.addEventListener("mouseleave", () => {
      img.style.transformOrigin = "center center";
      img.style.transform = "scale(1)";
    });
  }

  function renderProduct(p, allProducts) {
    activeProduct = p;
    const CC = window.CellCare;
    CC.trackRecentlyViewed(p);
    document.title = `${p.title} | Cell Care India`;

    const catSlug = p.category_slug || CC.slugify(p.category);
    const inStock = p.available !== false;
    const moq = Math.max(1, parseInt(p.min_quantity || 1, 10) || 1);
    const gallery = Array.isArray(p.gallery) && p.gallery.length ? p.gallery : [p.image_url];
    const wished = CC.isWishlisted(p.id);

    // Breadcrumb
    document.getElementById("pdpBreadcrumb").innerHTML = `
      <a href="index.html">Home</a> <span class="cc-breadcrumb-sep">/</span>
      <a href="shop.html">Products</a> <span class="cc-breadcrumb-sep">/</span>
      <a href="shop.html?category=${encodeURIComponent(catSlug)}">${CC.esc(p.category)}</a> <span class="cc-breadcrumb-sep">/</span>
      <span>${CC.esc(p.title)}</span>
    `;

    const shareUrl = encodeURIComponent(window.location.href);
    const shareText = encodeURIComponent(`Check out ${p.title} (SKU: ${p.sku}) at Cell Care India — ${CC.formatINR(p.price)}`);

    document.getElementById("pdpHeader").innerHTML = `
      <div>
        <h1 class="cc-pdp-title">${CC.esc(p.title)}</h1>
        <div class="cc-pdp-meta">
          <span>Brand: <a href="shop.html?brand=${encodeURIComponent(p.brand)}">${CC.esc(p.brand)}</a></span>
          <span>|</span>
          <span>Category: <a href="shop.html?category=${encodeURIComponent(catSlug)}">${CC.esc(p.category)}</a></span>
          <span>|</span>
          <span>SKU: <strong style="color:var(--brand-charcoal);">${CC.esc(p.sku)}</strong></span>
        </div>
      </div>
      <div class="cc-share-btns">
        <a href="https://www.facebook.com/sharer/sharer.php?u=${shareUrl}" target="_blank" rel="noopener" class="cc-share-btn" title="Share on Facebook"><i class="fab fa-facebook-f"></i></a>
        <a href="https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}" target="_blank" rel="noopener" class="cc-share-btn" title="Share on X"><i class="fab fa-x-twitter"></i></a>
        <a href="https://wa.me/?text=${shareText}%20${shareUrl}" target="_blank" rel="noopener" class="cc-share-btn" title="Share on WhatsApp"><i class="fab fa-whatsapp"></i></a>
      </div>
    `;

    // Gallery
    document.getElementById("pdpGalleryWrap").innerHTML = `
      <div class="cc-pdp-gallery">
        <div class="cc-pdp-thumbs">
          ${gallery.map((src, idx) => `
            <button type="button" class="cc-pdp-thumb ${idx === 0 ? "active" : ""}" data-src="${CC.esc(src)}">
              <img src="${CC.esc(src)}" alt="Product view ${idx + 1}" />
            </button>
          `).join("")}
        </div>
        <div>
          <div class="cc-pdp-main-img-wrap" id="pdpMainImgWrap">
            <img src="${CC.esc(gallery[0])}" id="pdpMainImg" alt="${CC.esc(p.title)}" />
          </div>
          <div class="cc-zoom-hint"><i class="fas fa-search-plus" style="margin-right:5px; color:var(--brand-green);"></i>Roll over image to zoom in</div>
        </div>
      </div>
    `;

    document.querySelectorAll(".cc-pdp-thumb").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".cc-pdp-thumb").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const mainImg = document.getElementById("pdpMainImg");
        if (mainImg) mainImg.src = btn.dataset.src;
      });
    });
    initImageZoom();

    // Right info box
    document.getElementById("pdpInfoWrap").innerHTML = `
      <div class="cc-pdp-price-row">
        <span class="cc-pdp-price">${CC.formatINR(p.price)}</span>
        ${moq > 1 ? `<span class="cc-moq-tag" style="font-size:12.5px; padding:4px 10px;">Min Order Qty: ${moq} units</span>` : ""}
      </div>

      <div class="cc-pdp-stock">
        Availability: ${inStock
          ? `<strong><i class="fas fa-check-circle"></i> In Stock</strong>`
          : `<strong style="color:var(--brand-charcoal); opacity:0.65;">Currently Out of Stock</strong>`
        }
      </div>

      <div class="cc-pdp-spec-box">
        <h3>Product Description &amp; Details</h3>
        <p>${CC.esc(p.description)}</p>

        <h3>Ordering &amp; Dispatch Note</h3>
        <p>Prepaid dispatch across India. Select your required quantity below and click <strong>Enquire on WhatsApp</strong> to confirm live stock, shipping estimate, and GST invoice directly with our New Delhi desk (+91 85059 10581).</p>
      </div>

      <div class="cc-pdp-actions">
        <div class="cc-qty-block">
          <label for="pdpQtyInput">Quantity${moq > 1 ? ` (Min ${moq})` : ""}:</label>
          <div class="cc-qty-stepper">
            <button type="button" id="pdpQtyMinus">-</button>
            <input type="number" id="pdpQtyInput" value="${moq}" min="${moq}" />
            <button type="button" id="pdpQtyPlus">+</button>
          </div>
        </div>

        <button type="button" class="cc-pdp-btn-wa" id="pdpEnquireWa" ${!inStock ? "disabled style='opacity:0.5;cursor:not-allowed;'" : ""}>
          <i class="fab fa-whatsapp" style="font-size:17px;"></i> Enquire on WhatsApp
        </button>

        <button type="button" class="cc-pdp-btn-cart" id="pdpAddToCart" ${!inStock ? "disabled style='opacity:0.5;cursor:not-allowed;'" : ""}>
          <i class="fas fa-shopping-bag"></i> Add to Cart
        </button>

        <button type="button" class="cc-btn-outline cc-wish-toggle ${wished ? "active" : ""}" data-id="${CC.esc(p.id)}" style="height:44px;" title="Save to Wishlist">
          <i class="${wished ? "fas" : "far"} fa-heart"></i>
        </button>
      </div>

      <div id="pdpLiveTotalRow" style="font-size:13.5px; color:var(--brand-charcoal); margin-bottom:16px; font-weight:600;">
        Estimated Total (<span id="pdpQtyLabel">${moq}</span> unit${moq > 1 ? "s" : ""}): <span style="color:var(--brand-green); font-weight:800;" id="pdpEstTotal">${CC.formatINR(p.price * moq)}</span>
      </div>

      <!-- Pincode Delivery Estimator -->
      <div style="background:var(--surface-subtle); border:1px solid var(--border-light); padding:14px 16px; border-radius:4px; margin-bottom:16px;">
        <div style="font-size:13px; font-weight:700; margin-bottom:8px; color:var(--brand-charcoal);">
          <i class="fas fa-truck" style="color:var(--brand-green); margin-right:6px;"></i>Check Pan-India Delivery Timeline
        </div>
        <div style="display:flex; gap:8px;">
          <input type="text" id="pdpPincodeInput" class="cc-input" maxlength="6" placeholder="Enter 6-digit Pincode (e.g. 110051)" style="height:38px; max-width:240px;" />
          <button type="button" id="pdpCheckPincodeBtn" class="cc-btn-charcoal" style="height:38px; padding:0 16px;">Check</button>
        </div>
        <div id="pdpPincodeResult" style="font-size:12.5px; margin-top:8px;"></div>
      </div>

      <div style="font-size:13px; color:var(--text-muted); line-height:1.9;">
        <div>SKU: <strong style="color:var(--brand-charcoal);">${CC.esc(p.sku)}</strong></div>
        <div>Category: <a href="shop.html?category=${encodeURIComponent(catSlug)}" style="color:var(--brand-green); font-weight:600;">${CC.esc(p.category)}</a></div>
        <div>Brand: <a href="shop.html?brand=${encodeURIComponent(p.brand)}" style="color:var(--brand-green); font-weight:600;">${CC.esc(p.brand)}</a></div>
      </div>
    `;

    // Bind qty & buttons
    const qtyInput = document.getElementById("pdpQtyInput");
    const updateEst = () => {
      const q = Math.max(moq, parseInt(qtyInput.value, 10) || moq);
      qtyInput.value = String(q);
      document.getElementById("pdpQtyLabel").textContent = String(q);
      document.getElementById("pdpEstTotal").textContent = CC.formatINR(p.price * q);
    };

    document.getElementById("pdpQtyMinus")?.addEventListener("click", () => {
      qtyInput.value = Math.max(moq, (parseInt(qtyInput.value, 10) || moq) - 1);
      updateEst();
    });
    document.getElementById("pdpQtyPlus")?.addEventListener("click", () => {
      qtyInput.value = (parseInt(qtyInput.value, 10) || moq) + 1;
      updateEst();
    });
    qtyInput?.addEventListener("change", updateEst);

    document.getElementById("pdpEnquireWa")?.addEventListener("click", () => {
      const q = Math.max(moq, parseInt(qtyInput.value, 10) || moq);
      CC.enquireProductOnWhatsApp(p, q);
    });

    document.getElementById("pdpAddToCart")?.addEventListener("click", () => {
      const q = Math.max(moq, parseInt(qtyInput.value, 10) || moq);
      CC.addToCart(p, q, true);
    });

    // Pincode check
    document.getElementById("pdpCheckPincodeBtn")?.addEventListener("click", async () => {
      const pin = document.getElementById("pdpPincodeInput").value.trim();
      const out = document.getElementById("pdpPincodeResult");
      out.innerHTML = `<span style="color:var(--text-muted);">Checking serviceability...</span>`;
      try {
        const r = await fetch("/api/payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "check_pincode", pincode: pin })
        });
        const d = await r.json();
        if (!d.ok) {
          out.innerHTML = `<span style="color:var(--brand-charcoal); font-weight:600;">${CC.esc(d.error)}</span>`;
        } else {
          out.innerHTML = `<span style="color:var(--brand-green); font-weight:600;"><i class="fas fa-check-circle"></i> Deliverable to ${CC.esc(d.pincode)} (${CC.esc(d.zone)}) — Est. ${CC.esc(d.estimated_delivery)} via ${CC.esc(d.courier_partners)}.</span>`;
        }
      } catch {
        out.innerHTML = `<span style="color:var(--text-muted);">Could not check pincode right now. Message us on WhatsApp for instant delivery confirmation.</span>`;
      }
    });

    // Tabs content
    document.getElementById("pdpTabDesc").innerHTML = `
      <div style="max-width:860px; margin:0 auto;">
        <p style="white-space:pre-line;">${CC.esc(p.description)}</p>
        <p>All products from Cell Care India are quality checked before dispatch from our New Delhi facility. For bulk/dealer quotations, contact us directly on WhatsApp at <strong>+91 85059 10581</strong>.</p>
      </div>
    `;

    document.getElementById("pdpTabSpecs").innerHTML = `
      <table class="cc-spec-table">
        <tr><th>Product Name</th><td>${CC.esc(p.title)}</td></tr>
        <tr><th>SKU</th><td>${CC.esc(p.sku)}</td></tr>
        <tr><th>Category</th><td>${CC.esc(p.category)}</td></tr>
        <tr><th>Brand</th><td>${CC.esc(p.brand)}</td></tr>
        <tr><th>Price</th><td>${CC.formatINR(p.price)}</td></tr>
        <tr><th>Minimum Order Quantity</th><td>${moq} unit${moq > 1 ? "s" : ""}</td></tr>
        <tr><th>Availability</th><td>${inStock ? "In Stock" : "Out of Stock"}</td></tr>
        <tr><th>Ordering Mode</th><td>Direct WhatsApp Enquiry (+91 85059 10581)</td></tr>
      </table>
    `;

    // Related & Also Viewed carousels (freshly shuffled on each view)
    const others = allProducts.filter(x => x.id !== p.id);
    const sameCat = CC.shuffleArray(others.filter(x => x.category === p.category));
    const diffCat = CC.shuffleArray(others.filter(x => x.category !== p.category));
    const related = [...sameCat, ...diffCat].slice(0, 6);
    const alsoViewed = [...diffCat, ...sameCat].slice(0, 6);

    const alsoEl = document.getElementById("pdpAlsoBought");
    const relEl = document.getElementById("pdpRelated");
    if (alsoEl) alsoEl.innerHTML = alsoViewed.map(x => CC.renderProductCard(x)).join("");
    if (relEl) relEl.innerHTML = related.map(x => CC.renderProductCard(x)).join("");
  }

  function bindTabs() {
    document.querySelectorAll(".cc-tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".cc-tab-btn").forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".cc-tab-pane").forEach(p => p.classList.remove("active"));
        btn.classList.add("active");
        document.getElementById(btn.dataset.tab)?.classList.add("active");
      });
    });
  }

  async function initPdp() {
    bindTabs();
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id") || params.get("slug");
    const res = await window.CellCare.fetchProducts();
    const all = res.items || [];
    if (!all.length) {
      document.getElementById("pdpHeader").innerHTML = `<h1 class="cc-pdp-title">Unable to load product details</h1>`;
      return;
    }
    let found = id
      ? all.find(
          p =>
            String(p.id).toLowerCase() === id.toLowerCase() ||
            String(p.slug || "").toLowerCase() === id.toLowerCase() ||
            String(p.sku || "").toLowerCase() === id.toLowerCase()
        )
      : all[0];
    if (!found) found = all[0];
    renderProduct(found, all);
  }

  document.addEventListener("DOMContentLoaded", () => setTimeout(initPdp, 20));
})(window, document);
