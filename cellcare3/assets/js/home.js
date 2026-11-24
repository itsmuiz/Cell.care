/**
 * CELL CARE INDIA — DYNAMIC HOMEPAGE ENGINE (home.js)
 * Renders Hero Slider, Dynamic Brand/Category Strip, Featured Shelf,
 * and Automatic Category Shelves directly from live Google Sheets data.
 */

(function (window, document) {
  "use strict";

  let currentSlide = 0;
  let slideTimer = null;

  function initHeroSlider() {
    const slides = document.querySelectorAll(".cc-hero-slide");
    const dots = document.querySelectorAll(".cc-hero-dot");
    if (!slides.length) return;

    function goTo(idx) {
      currentSlide = (idx + slides.length) % slides.length;
      slides.forEach((s, i) => s.classList.toggle("active", i === currentSlide));
      dots.forEach((d, i) => d.classList.toggle("active", i === currentSlide));
    }

    document.getElementById("ccHeroPrev")?.addEventListener("click", () => {
      goTo(currentSlide - 1);
      restartTimer();
    });
    document.getElementById("ccHeroNext")?.addEventListener("click", () => {
      goTo(currentSlide + 1);
      restartTimer();
    });
    dots.forEach((d, i) => d.addEventListener("click", () => {
      goTo(i);
      restartTimer();
    }));

    function restartTimer() {
      if (slideTimer) clearInterval(slideTimer);
      slideTimer = setInterval(() => goTo(currentSlide + 1), 6500);
    }
    restartTimer();
  }

  function bindCarouselArrows() {
    document.querySelectorAll(".cc-carousel-nav").forEach(btn => {
      btn.addEventListener("click", () => {
        const targetId = btn.dataset.target;
        const dir = btn.classList.contains("next") ? 1 : -1;
        const track = document.getElementById(targetId);
        if (!track) return;
        const step = Math.max(260, track.clientWidth * 0.78);
        track.scrollBy({ left: dir * step, behavior: "smooth" });
      });
    });
  }

  function buildShelfSection(title, linkUrl, shelfId, items) {
    const CC = window.CellCare;
    return `
      <section class="cc-shelf-section">
        <div class="container">
          <div class="cc-shelf-header">
            <h2 class="cc-shelf-title">${CC.esc(title)}</h2>
            <div class="cc-shelf-links">
              <a href="${linkUrl}">View All (${items.length}) &rsaquo;</a>
            </div>
          </div>
          <div class="cc-carousel-wrap">
            <button type="button" class="cc-carousel-nav prev" data-target="${shelfId}" aria-label="Scroll left"><i class="fas fa-chevron-left"></i></button>
            <div class="cc-carousel-track" id="${shelfId}">
              ${items.slice(0, 12).map(p => CC.renderProductCard(p)).join("")}
            </div>
            <button type="button" class="cc-carousel-nav next" data-target="${shelfId}" aria-label="Scroll right"><i class="fas fa-chevron-right"></i></button>
          </div>
        </div>
      </section>
    `;
  }

  async function initHomepage() {
    initHeroSlider();

    const CC = window.CellCare;
    const shelvesHost = document.getElementById("ccDynamicShelves");
    const stripHost = document.getElementById("ccDynamicBrandStrip");

    if (shelvesHost) {
      shelvesHost.innerHTML = `
        <div class="container" style="padding:36px 15px;">
          <div class="cc-loading-box">
            <i class="fas fa-spinner fa-spin" style="font-size:24px; color:var(--brand-green); margin-bottom:10px;"></i>
            <div>Loading live catalog from Cell Care India inventory...</div>
          </div>
        </div>
      `;
    }

    const res = await CC.fetchProducts();
    const all = res.items || [];
    const categories = res.categories || [];
    const brands = res.brands || [];

    // Populate dynamic Brand + Category quick strip below hero
    if (stripHost) {
      const catPills = categories.map(c =>
        `<a href="shop.html?category=${encodeURIComponent(c.slug)}" class="cc-brand-pill">${CC.esc(c.name)} (${c.count})</a>`
      );
      const brandPills = brands.map(b =>
        `<a href="shop.html?brand=${encodeURIComponent(b.name)}" class="cc-brand-pill">${CC.esc(b.name)}</a>`
      );
      stripHost.innerHTML = [...catPills, ...brandPills, `<a href="shop.html" class="cc-brand-more">VIEW ALL (${all.length}) &rarr;</a>`].join("");
    }

    if (!shelvesHost) return;

    if (!all.length) {
      shelvesHost.innerHTML = `
        <div class="container" style="padding:40px 15px;">
          <div class="cc-loading-box">
            <h3 style="margin:0 0 8px; color:var(--brand-charcoal);">Products temporarily unavailable</h3>
            <p style="margin:0 0 16px;">We could not reach our live inventory feed. Please retry or contact us directly on WhatsApp.</p>
            <button type="button" class="cc-btn-primary" onclick="location.reload()">Retry</button>
          </div>
        </div>
      `;
      return;
    }

    // Shuffle products dynamically on every page load so items are always fresh
    const byCat = {};
    categories.forEach(c => {
      byCat[c.name] = CC.shuffleArray(all.filter(p => p.category === c.name));
    });

    // Build a freshly shuffled cross-category "Featured Products & New Arrivals" shelf
    const featured = [];
    const shuffledCats = CC.shuffleArray(categories);
    for (let round = 0; round < 3; round++) {
      shuffledCats.forEach(c => {
        const candidate = (byCat[c.name] || [])[round];
        if (candidate && candidate.available !== false && !featured.some(f => f.id === candidate.id)) {
          featured.push(candidate);
        }
      });
    }
    CC.shuffleArray(all.filter(p => p.available !== false)).forEach(p => {
      if (featured.length < 12 && !featured.some(f => f.id === p.id)) featured.push(p);
    });

    let html = buildShelfSection("Featured Products & New Arrivals", "shop.html", "shelfFeatured", CC.shuffleArray(featured));

    // Dynamic shelf for every live category from Google Sheets (each shelf freshly shuffled)
    const sortedCats = [...categories].sort((a, b) => b.count - a.count);
    sortedCats.forEach((cat, idx) => {
      const catItems = byCat[cat.name] || [];
      if (!catItems.length) return;
      html += buildShelfSection(
        cat.name,
        `shop.html?category=${encodeURIComponent(cat.slug)}`,
        `shelfCat_${idx}`,
        catItems
      );
    });

    shelvesHost.innerHTML = html;
    bindCarouselArrows();
  }

  document.addEventListener("DOMContentLoaded", () => setTimeout(initHomepage, 20));
})(window, document);
