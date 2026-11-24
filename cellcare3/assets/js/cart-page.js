/**
 * CELL CARE INDIA — ORDER ENQUIRY CART PAGE ENGINE (cart-page.js)
 * Live quantity steppers, coupon support, and direct WhatsApp Order Checkout handoff.
 */

(function (window, document) {
  "use strict";

  let appliedCoupon = null;

  function renderCartPage() {
    const CC = window.CellCare;
    const items = CC.getCartItems();
    const emptyEl = document.getElementById("ccCartEmptyState");
    const filledEl = document.getElementById("ccCartFilledState");
    if (!emptyEl || !filledEl) return;

    if (!items.length) {
      emptyEl.style.display = "block";
      filledEl.style.display = "none";
      return;
    }

    emptyEl.style.display = "none";
    filledEl.style.display = "block";

    const tbody = document.getElementById("ccCartTableBody");
    tbody.innerHTML = items.map(it => {
      const lineTotal = (Number(it.price) || 0) * (Number(it.qty) || 1);
      const minQ = Number(it.min_quantity) || 1;
      return `
        <tr>
          <td>
            <div style="display:flex; align-items:center; gap:14px;">
              <a href="product.html?id=${encodeURIComponent(it.id)}" style="width:66px; height:66px; border:1px solid var(--border-light); padding:4px; background:#fff; flex-shrink:0;">
                <img src="${CC.esc(it.image_url)}" alt="${CC.esc(it.title)}" style="width:100%; height:100%; object-fit:contain;" />
              </a>
              <div>
                <a href="product.html?id=${encodeURIComponent(it.id)}" style="font-weight:600; color:var(--brand-charcoal); display:block; margin-bottom:3px;">${CC.esc(it.title)}</a>
                <span style="font-size:12px; color:var(--text-muted);">SKU: ${CC.esc(it.sku)}${minQ > 1 ? ` &bull; MOQ: ${minQ}` : ""}</span>
              </div>
            </div>
          </td>
          <td style="font-weight:600; color:var(--brand-charcoal);">${CC.formatINR(it.price)}</td>
          <td>
            <div class="cc-qty-stepper" style="height:36px;">
              <button type="button" onclick="CellCare.updateCartQty('${CC.esc(it.id)}', ${Math.max(0, it.qty - 1)})">-</button>
              <input type="number" value="${it.qty}" min="1" onchange="CellCare.updateCartQty('${CC.esc(it.id)}', this.value)" style="width:48px;" />
              <button type="button" onclick="CellCare.updateCartQty('${CC.esc(it.id)}', ${it.qty + 1})">+</button>
            </div>
          </td>
          <td style="font-weight:700; color:var(--brand-green);">${CC.formatINR(lineTotal)}</td>
          <td>
            <button type="button" onclick="CellCare.removeFromCart('${CC.esc(it.id)}')" style="background:none; border:none; color:var(--text-muted); font-size:16px; cursor:pointer;" title="Remove item"><i class="fas fa-times"></i></button>
          </td>
        </tr>
      `;
    }).join("");

    const subtotal = CC.getCartSubtotal();
    let discount = 0;
    if (appliedCoupon && subtotal >= appliedCoupon.minOrder) {
      discount = appliedCoupon.discount;
    } else if (appliedCoupon) {
      appliedCoupon = null;
    }

    const total = Math.max(0, subtotal - discount);

    document.getElementById("ccCartSub").textContent = CC.formatINR(subtotal);
    document.getElementById("ccCartDiscRow").style.display = discount > 0 ? "flex" : "none";
    document.getElementById("ccCartDisc").textContent = "-" + CC.formatINR(discount);
    document.getElementById("ccCartGrandTotal").textContent = CC.formatINR(total);
  }

  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(renderCartPage, 30);
    window.addEventListener("cellcare:cart-updated", renderCartPage);

    document.getElementById("ccCartCouponForm")?.addEventListener("submit", async e => {
      e.preventDefault();
      const code = document.getElementById("ccCartCouponInput").value.trim().toUpperCase();
      const msgEl = document.getElementById("ccCartCouponMsg");
      if (!code) return;
      try {
        const res = await fetch("/api/payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "apply_coupon", code, subtotal: window.CellCare.getCartSubtotal() })
        });
        const data = await res.json();
        if (!data.ok) {
          appliedCoupon = null;
          msgEl.innerHTML = `<span style="color:var(--brand-charcoal); font-weight:600;">${window.CellCare.esc(data.error)}</span>`;
        } else {
          appliedCoupon = { code: data.code, discount: data.discount, minOrder: 0 };
          sessionStorage.setItem("cellcare_coupon", data.code);
          msgEl.innerHTML = `<span style="color:var(--brand-green); font-weight:700;">${window.CellCare.esc(data.message)}</span>`;
        }
        renderCartPage();
      } catch {
        msgEl.innerHTML = `<span style="color:var(--text-muted);">Could not validate coupon right now.</span>`;
      }
    });
  });
})(window, document);
