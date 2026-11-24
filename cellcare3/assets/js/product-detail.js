/**
 * CELL CARE INDIA — DEDICATED PRODUCT DETAIL ENGINE (v4.0)
 * Dynamic rendering via /api/products, MRP savings badge, Pincode delivery checker,
 * SEO schema injection, gallery zoom, specs table, Buy Now & Add to Cart.
 */

(function () {
  "use strict";

  let currentProduct = null;

  function renderDetailSkeleton() {
    const titleEl = document.getElementById("detailTitle");
    const priceEl = document.getElementById("detailPrice");
    const descEl = document.getElementById("detailDesc");
    const catTag = document.getElementById("detailCategoryTag");
    const relatedGrid = document.getElementById("detailRelatedGrid");
    const mainImg = document.getElementById("detailMainImg");

    if (titleEl) {
      titleEl.innerHTML = `<div class="skeleton-title-bar skeleton-shimmer" style="height:32px; width:75%; margin-bottom:12px;"></div>`;
    }
    if (priceEl) {
      priceEl.innerHTML = `<div class="skeleton-price-bar skeleton-shimmer" style="height:34px; width:45%;"></div>`;
    }
    if (descEl) {
      descEl.innerHTML = `
        <div class="skeleton-desc-bar skeleton-shimmer" style="margin-bottom:8px;"></div>
        <div class="skeleton-desc-bar skeleton-shimmer" style="margin-bottom:8px;"></div>
        <div class="skeleton-desc-bar short skeleton-shimmer"></div>
      `;
    }
    if (catTag) {
      catTag.innerHTML = `<div class="skeleton-pill skeleton-shimmer" style="display:inline-block; width:90px; height:18px;"></div>`;
    }
    if (mainImg) {
      mainImg.classList.add("skeleton-shimmer");
    }

    if (relatedGrid) {
      relatedGrid.innerHTML = Array.from({ length: 4 }).map(() => `
        <div class="skeleton-card" aria-hidden="true">
          <div class="skeleton-media skeleton-shimmer"></div>
          <div class="skeleton-content">
            <div class="skeleton-pill skeleton-shimmer"></div>
            <div class="skeleton-title-bar skeleton-shimmer"></div>
            <div class="skeleton-price-bar skeleton-shimmer"></div>
            <div class="skeleton-actions-row">
              <div class="skeleton-btn-bar skeleton-shimmer"></div>
            </div>
          </div>
        </div>
      `).join("");
    }
  }

  function clearDetailSkeleton() {
    const mainImg = document.getElementById("detailMainImg");
    if (mainImg) mainImg.classList.remove("skeleton-shimmer");
  }

  function matchProduct(targetStr, list) {
    if (!targetStr || !Array.isArray(list) || !list.length) return null;
    let norm = "";
    try { norm = decodeURIComponent(targetStr).toLowerCase().trim(); } catch (e) { norm = targetStr.toLowerCase().trim(); }
    const cleanNorm = norm.replace(/^cc-/, "").trim();

    let match = list.find(p => String(p.id).toLowerCase() === norm || String(p.id).toLowerCase() === cleanNorm);
    if (match) return match;

    if (cleanNorm) {
      match = list.find(p => p.sku && (String(p.sku).toLowerCase() === norm || String(p.sku).toLowerCase() === cleanNorm));
      if (match) return match;
    }

    match = list.find(p => p.slug && p.slug.toLowerCase() === norm);
    if (match) return match;

    match = list.find(p => p.title && p.title.toLowerCase().trim() === norm);
    if (match) return match;

    const normSlug = norm.replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    if (normSlug.length > 3) {
      match = list.find(p => p.slug && p.slug.toLowerCase() === normSlug);
      if (match) return match;
    }

    return null;
  }

  async function loadProduct() {
    const params = new URLSearchParams(window.location.search);
    const target = (params.get("id") || params.get("slug") || "").trim();

    renderDetailSkeleton();
    if (window.startPreloader) window.startPreloader();

    try {
      let data = null;
      if (window.CellCare && typeof window.CellCare.fetchProducts === "function") {
        data = await window.CellCare.fetchProducts();
      } else {
        const res = await fetch("/api/products");
        if (res && res.ok) data = await res.json();
      }

      const allProducts = (data && (data.items || data.results)) || [];
      if (allProducts.length > 0) {
        const resolved = (target ? matchProduct(target, allProducts) : allProducts[0]) || allProducts[0];
        currentProduct = resolved;
        clearDetailSkeleton();
        renderProductDetails(resolved);
        loadRelatedProducts(allProducts, resolved);
      } else {
        showErrorState("Product Unavailable", "The requested product specification could not be retrieved from the catalog.");
      }
    } catch (err) {
      console.debug("Live detail fetch note:", err);
      showErrorState("Connection Error", "Could not load product details. Please check your internet connection.");
    } finally {
      if (window.finishPreloader) window.finishPreloader();
    }
  }

  function renderProductDetails(p) {
    const title = p.title || "Industrial Product Specification";
    const category = p.category || "EV Battery Pack";
    const desc = p.description || p.mini_desc || "";
    const priceNum = Number(p.price) || 0;
    const mrpNum = Number(p.mrp || p.regular_price) || (priceNum > 0 ? Math.round(priceNum * 1.18) : 0);
    const discountPct = (priceNum > 0 && mrpNum > priceNum) ? Math.round(((mrpNum - priceNum) / mrpNum) * 100) : 0;
    const formattedPrice = priceNum ? `₹${priceNum.toLocaleString("en-IN")}` : "Contact for B2B Pricing";
    const minQty = parseInt(p.min_quantity || p.moq || 1, 10);
    const stockQty = p.stock_qty !== undefined ? Number(p.stock_qty) : 25;
    const imgUrl = p.image_url || "assets/images/hero.svg";
    const isAvailable = p.available !== false && stockQty > 0;

    document.title = `${title} | Cell Care India`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.content = desc ? `${desc.substring(0, 150)}... Official supply by Cell Care India.` : `Buy ${title} online from Cell Care India.`;
    }

    injectProductSchema(p);

    const breadcrumbTitle = document.getElementById("breadcrumbProductTitle");
    if (breadcrumbTitle) breadcrumbTitle.textContent = title;

    const mainImg = document.getElementById("detailMainImg");
    if (mainImg) {
      mainImg.src = imgUrl;
      mainImg.alt = title;
    }

    const badgeStock = document.getElementById("detailStockBadge");
    if (badgeStock) {
      badgeStock.className = `badge ${isAvailable ? "badge-success" : "badge-amber"}`;
      const checkSvg = '<svg class="svg-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>';
      const clockSvg = '<svg class="svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>';
      badgeStock.innerHTML = `${isAvailable ? checkSvg : clockSvg} ${isAvailable ? `In Stock (${stockQty} Units Ready)` : "Advance Order / Lead Time"}`;
    }

    const badgeCategory = document.getElementById("detailCategoryBadge");
    if (badgeCategory) badgeCategory.textContent = category;

    const catTag = document.getElementById("detailCategoryTag");
    if (catTag) catTag.textContent = category;
    const catMeta = document.getElementById("detailCategoryMeta");
    if (catMeta) catMeta.textContent = category;
    const titleEl = document.getElementById("detailTitle");
    if (titleEl) titleEl.textContent = title;
    const skuEl = document.getElementById("detailSku");
    if (skuEl) skuEl.textContent = `SKU: ${p.sku || `CC-${p.id}`}`;
    const priceEl = document.getElementById("detailPrice");
    if (priceEl) priceEl.textContent = formattedPrice;

    const mrpEl = document.getElementById("detailMrp");
    const discBadge = document.getElementById("detailDiscountBadge");
    if (mrpEl && discBadge && discountPct > 0) {
      mrpEl.textContent = `MRP ₹${mrpNum.toLocaleString("en-IN")}`;
      mrpEl.style.display = "inline-block";
      discBadge.textContent = `Save ₹${(mrpNum - priceNum).toLocaleString("en-IN")} (${discountPct}% OFF)`;
      discBadge.style.display = "inline-flex";
    } else {
      if (mrpEl) mrpEl.style.display = "none";
      if (discBadge) discBadge.style.display = "none";
    }

    const descEl = document.getElementById("detailDesc");
    if (descEl) {
      descEl.textContent = desc || "Official manufacturer product specification by Cell Care India. Direct factory supply with pan-India distribution.";
    }
    const moqEl = document.getElementById("detailMoqNumber");
    if (moqEl) moqEl.textContent = `${minQty} Unit${minQty > 1 ? "s" : ""}`;
    const compatEl = document.getElementById("detailCompatText");
    if (compatEl) compatEl.textContent = p.compatibility || "Universal EV & Solar Application";

    // Stepper Setup
    const stepperInput = document.getElementById("detailQtyInput");
    const subtotalText = document.getElementById("detailSubtotalText");
    const minusBtn = document.getElementById("detailQtyMinus");
    const plusBtn = document.getElementById("detailQtyPlus");

    if (stepperInput) {
      stepperInput.value = minQty;

      const updateSubtotal = () => {
        const qty = parseInt(stepperInput.value, 10) || minQty;
        if (priceNum > 0 && subtotalText) {
          subtotalText.innerHTML = `Subtotal: <strong>₹${(qty * priceNum).toLocaleString("en-IN")}</strong> (GST Incl.)`;
        } else if (subtotalText) {
          subtotalText.innerHTML = `Order Quantity: <strong>${qty} Unit${qty > 1 ? "s" : ""}</strong>`;
        }
      };

      updateSubtotal();

      if (plusBtn) {
        plusBtn.onclick = () => {
          let cur = parseInt(stepperInput.value, 10) || minQty;
          stepperInput.value = cur + 1;
          updateSubtotal();
        };
      }

      if (minusBtn) {
        minusBtn.onclick = () => {
          let cur = parseInt(stepperInput.value, 10) || minQty;
          if (cur > minQty) {
            stepperInput.value = cur - 1;
            updateSubtotal();
          }
        };
      }
    }

    // Buy Now Button
    const buyNowBtn = document.getElementById("detailBuyNowBtn");
    if (buyNowBtn) {
      buyNowBtn.onclick = () => {
        const qty = parseInt(stepperInput ? stepperInput.value : minQty, 10) || minQty;
        if (window.CellCare && typeof window.CellCare.buyNow === "function") {
          window.CellCare.buyNow(p, qty);
        }
      };
    }

    // Add to Cart Button
    const addQuoteBtn = document.getElementById("detailAddQuoteBtn");
    if (addQuoteBtn) {
      addQuoteBtn.onclick = () => {
        const qty = parseInt(stepperInput ? stepperInput.value : minQty, 10) || minQty;
        if (window.CellCare) {
          window.CellCare.addToCart(p, qty);
        }
      };
    }

    // WhatsApp B2B Inquiry Button
    const waQuoteBtn = document.getElementById("detailWaQuoteBtn");
    if (waQuoteBtn) {
      waQuoteBtn.onclick = () => {
        const qty = parseInt(stepperInput ? stepperInput.value : minQty, 10) || minQty;
        const msg = `Hello Cell Care India! I would like to inquire about:\n\n• Product: *${title}*\n• SKU: *${p.sku || `CC-${p.id}`}*\n• Required Quantity: *${qty} Unit(s)*\n• Listed Price: *${formattedPrice}*\n\nPlease share bulk B2B pricing and delivery schedule.`;
        if (window.CellCare && typeof window.CellCare.openWhatsApp === "function") {
          window.CellCare.openWhatsApp(msg);
        }
      };
    }

    populateSpecificationsTable(p);
  }

  function initPincodeChecker() {
    const input = document.getElementById("detailPincodeInput");
    const btn = document.getElementById("detailPincodeBtn");
    const resBox = document.getElementById("detailPincodeResult");
    if (!input || !btn || !resBox) return;

    async function checkPin() {
      const pin = input.value.replace(/\D/g, "");
      if (pin.length !== 6) {
        resBox.style.display = "block";
        resBox.innerHTML = `<span style="color:var(--accent-red);">Please enter a valid 6-digit Indian Pincode.</span>`;
        return;
      }

      btn.disabled = true;
      btn.textContent = "Checking...";
      try {
        const res = await fetch("/api/payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "check_pincode", pincode: pin })
        });
        const data = await res.json();
        resBox.style.display = "block";
        if (res.ok && data.ok) {
          resBox.innerHTML = `
            <div style="color:var(--accent-primary); font-weight:600; margin-bottom:2px;">
              ✓ Deliverable to ${escapeHtml(data.pincode)} — ${escapeHtml(data.estimated_delivery)}
            </div>
            <div style="color:var(--text-muted); font-size:0.75rem; font-family:var(--font-mono);">
              Zone: ${escapeHtml(data.zone)} • COD &amp; Online Payment Available • Free Shipping on ₹15,000+
            </div>
          `;
        } else {
          resBox.innerHTML = `<span style="color:var(--accent-red);">${escapeHtml(data.error || "Invalid pincode")}</span>`;
        }
      } catch (e) {
        resBox.style.display = "block";
        resBox.innerHTML = `<span style="color:var(--accent-primary);">✓ Pan-India Surface Delivery Available to ${escapeHtml(pin)} (3–5 Working Days).</span>`;
      } finally {
        btn.disabled = false;
        btn.textContent = "Check";
      }
    }

    btn.addEventListener("click", checkPin);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        checkPin();
      }
    });
  }

  function populateSpecificationsTable(p) {
    const tableBody = document.getElementById("detailSpecsTableBody");
    if (!tableBody) return;

    const minQty = parseInt(p.min_quantity || p.moq || 1, 10);
    const priceNum = Number(p.price) || 0;

    const specs = [
      { label: "Product Name", value: p.title || "Industrial Unit" },
      { label: "Category", value: p.category || "General" },
      { label: "Part Reference / SKU", value: p.sku || `CC-${p.slug || p.id || "IND"}` },
      { label: "Compatible Vehicles / Systems", value: p.compatibility || "Universal EV & Solar Application" },
      { label: "Minimum Order Quantity (MOQ)", value: `${minQty} Unit${minQty > 1 ? "s" : ""}` },
      { label: "Stock Availability", value: p.available !== false ? `In Stock (${p.stock_qty !== undefined ? p.stock_qty : 25} Units Ready for Pan-India Dispatch)` : "Available on Advance Order" }
    ];

    if (priceNum > 0) {
      specs.push({ label: "Online Direct Factory Price", value: `₹${priceNum.toLocaleString("en-IN")} / Unit (GST Incl.)` });
    }

    if (p.voltage) specs.push({ label: "Nominal Voltage", value: String(p.voltage) });
    if (p.capacity) specs.push({ label: "Rated Capacity", value: String(p.capacity) });
    if (p.chemistry) specs.push({ label: "Cell Chemistry", value: String(p.chemistry) });
    if (p.dimensions) specs.push({ label: "Dimensions (L×W×H)", value: String(p.dimensions) });
    if (p.weight) specs.push({ label: "Net Weight", value: String(p.weight) });
    if (p.warranty) specs.push({ label: "Manufacturer Warranty", value: String(p.warranty) });
    if (p.material) specs.push({ label: "Enclosure / Casing", value: String(p.material) });

    if (p.specs && typeof p.specs === "object") {
      Object.entries(p.specs).forEach(([k, v]) => {
        if (v && typeof v !== "object") {
          const readableKey = k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
          if (!specs.some(s => s.label.toLowerCase() === readableKey.toLowerCase())) {
            specs.push({ label: readableKey, value: String(v) });
          }
        }
      });
    }

    tableBody.innerHTML = specs.map(s => `
      <tr>
        <td style="width:38%; text-align:left; padding:12px 14px; color:var(--text-muted); font-weight:500; border-right:1px solid var(--border-subtle);">${escapeHtml(s.label)}</td>
        <td style="padding:12px 14px; color:#ffffff; font-family:var(--font-mono); font-weight:600;">${escapeHtml(s.value)}</td>
      </tr>
    `).join("");
  }

  function injectProductSchema(p) {
    const priceNum = Number(p.price) || 0;
    const schemaData = {
      "@context": "https://schema.org/",
      "@type": "Product",
      "name": p.title,
      "image": [
        window.location.origin + "/" + (p.image_url || "assets/images/hero.svg")
      ],
      "description": p.description || "Grade-A Lithium and EV battery pack by Cell Care India.",
      "sku": p.sku || `CC-${p.id || "IND-01"}`,
      "brand": { "@type": "Brand", "name": "Cell Care India" },
      "offers": {
        "@type": "Offer",
        "url": window.location.href,
        "priceCurrency": "INR",
        "price": priceNum > 0 ? priceNum : 5000,
        "priceValidUntil": "2027-12-31",
        "itemCondition": "https://schema.org/NewCondition",
        "availability": p.available !== false ? "https://schema.org/InStock" : "https://schema.org/PreOrder"
      }
    };

    const existing = document.getElementById("dynamicProductJsonLd");
    if (existing) existing.remove();
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "dynamicProductJsonLd";
    script.textContent = JSON.stringify(schemaData);
    if (document.head) document.head.appendChild(script);
  }

  function loadRelatedProducts(allProducts, current) {
    const container = document.getElementById("detailRelatedGrid");
    if (!container) return;

    const others = (allProducts || []).filter(p =>
      String(p.id) !== String(current.id) &&
      (!p.slug || !current.slug || p.slug !== current.slug)
    );

    if (!others.length) {
      const sec = document.getElementById("detailRelatedSection");
      if (sec) sec.style.display = "none";
      return;
    }

    let related = others.filter(p => p.category && current.category && String(p.category).toLowerCase() === String(current.category).toLowerCase());
    if (related.length < 4) {
      const remaining = others.filter(p => !related.includes(p));
      related = related.concat(remaining.slice(0, 4 - related.length));
    }
    related = related.slice(0, 4);

    container.innerHTML = "";

    related.forEach(p => {
      const priceNum = Number(p.price) || 0;
      const formattedPrice = priceNum ? "₹" + priceNum.toLocaleString("en-IN") : "Contact for Price";
      const imgUrl = p.image_url || "assets/images/hero.svg";
      const targetParam = String(p.id);
      const detailUrl = "product.html?id=" + encodeURIComponent(targetParam);
      const minQ = parseInt(p.min_quantity || p.moq || 1, 10);

      const card = document.createElement("article");
      card.className = "product-card";
      card.style.cursor = "pointer";

      const infoIcon = (window.CellCare && window.CellCare.svg && window.CellCare.svg.info) || "";
      const cartIcon = (window.CellCare && window.CellCare.svg && window.CellCare.svg.cart) || "";

      card.innerHTML = `
        <div class="product-card-media" style="aspect-ratio: 4/3;">
          <img src="${imgUrl}" class="product-card-img" alt="${escapeHtml(p.title)}" loading="lazy" />
        </div>
        <div class="product-card-content">
          <span class="product-card-category">${escapeHtml(p.category || "Components")}</span>
          <h4 class="product-card-title" style="font-size: 1rem; height: auto;">
            <a href="${detailUrl}">${escapeHtml(p.title)}</a>
          </h4>
          <div style="font-size: 1.15rem; font-weight: 800; color: var(--accent-primary); margin: 8px 0 14px 0;">
            ${formattedPrice}
          </div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 8px; width: 100%;">
            <a href="${detailUrl}" class="btn btn-secondary btn-sm btn-related-view" style="width: 100%; justify-content: center;">
              ${infoIcon} Specs
            </a>
            <button type="button" class="btn btn-primary btn-sm btn-related-quote" style="width: 100%; justify-content: center;">
              ${cartIcon} Add
            </button>
          </div>
        </div>
      `;

      function openRelatedProduct(e) {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        if (window.history && window.history.pushState) {
          window.history.pushState({ id: targetParam }, "", detailUrl);
        } else {
          window.location.href = detailUrl;
        }
        window.scrollTo({ top: 0, behavior: "smooth" });
        loadProduct();
      }

      card.addEventListener("click", (e) => {
        if (e.target && e.target.closest && e.target.closest(".btn-related-quote")) return;
        openRelatedProduct(e);
      });

      const viewBtn = card.querySelector(".btn-related-view");
      if (viewBtn) viewBtn.addEventListener("click", openRelatedProduct);

      const titleLink = card.querySelector(".product-card-title a");
      if (titleLink) titleLink.addEventListener("click", openRelatedProduct);

      const quoteBtn = card.querySelector(".btn-related-quote");
      if (quoteBtn) {
        quoteBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (window.CellCare && typeof window.CellCare.addToCart === "function") {
            window.CellCare.addToCart(p, minQ);
          }
        });
      }

      container.appendChild(card);
    });
  }

  function initProductZoom() {
    const galleryWrap = document.getElementById("galleryMainWrap");
    const mainImg = document.getElementById("detailMainImg");
    const zoomTrigger = document.getElementById("galleryZoomTrigger");
    const modal = document.getElementById("productZoomModal");
    const modalImg = document.getElementById("productZoomImg");
    const closeBtn = document.getElementById("productZoomClose");
    const backdrop = document.getElementById("productZoomBackdrop");

    if (!modal || !modalImg) return;

    function openZoom(e) {
      if (e && e.target && e.target.closest && e.target.closest(".gallery-badges-overlay a")) return;
      const activeSrc = (mainImg && (mainImg.currentSrc || mainImg.src)) || "";
      if (!activeSrc) return;
      modalImg.src = activeSrc;
      modalImg.alt = (mainImg && mainImg.alt) || "Enlarged Product View";
      modal.classList.add("active");
      modal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    }

    function closeZoom() {
      modal.classList.remove("active");
      modal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    }

    if (galleryWrap) galleryWrap.addEventListener("click", openZoom);
    if (mainImg) mainImg.addEventListener("click", openZoom);
    if (zoomTrigger) {
      zoomTrigger.addEventListener("click", (e) => {
        e.stopPropagation();
        openZoom();
      });
    }
    if (closeBtn) {
      closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        closeZoom();
      });
    }
    if (backdrop) backdrop.addEventListener("click", closeZoom);
    if (modalImg) modalImg.addEventListener("click", closeZoom);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.classList.contains("active")) closeZoom();
    });
  }

  function showErrorState(title, msg) {
    const layout = document.querySelector(".product-detail-layout");
    if (layout) {
      layout.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 80px 20px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-xs);">
          <h2 style="color: #ffffff; margin-bottom: 8px;">${escapeHtml(title)}</h2>
          <p style="color: var(--text-muted); margin-bottom: 24px;">${escapeHtml(msg)}</p>
          <a href="products.html" class="btn btn-primary">Browse Complete Catalogue</a>
        </div>
      `;
    }
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function bootProductDetail() {
    initProductZoom();
    initPincodeChecker();
    loadProduct();
    if (typeof window.addEventListener === "function") {
      window.addEventListener("popstate", loadProduct);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootProductDetail);
  } else {
    bootProductDetail();
  }

})();
