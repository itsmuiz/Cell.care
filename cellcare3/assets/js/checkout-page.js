/**
 * CELL CARE INDIA — WHATSAPP ORDER CHECKOUT ENGINE (checkout-page.js)
 * Cash on Delivery (COD) removed. Razorpay temporarily disabled.
 * Collects customer & delivery details, logs order enquiry, builds a complete
 * formatted WhatsApp message, and redirects to +91 8505910581.
 */

(function (window, document) {
  "use strict";

  let activeCoupon = null;
  let activeDiscount = 0;

  function renderOrderSummary() {
    const CC = window.CellCare;
    const items = CC.getCartItems();
    const listEl = document.getElementById("chkItemsList");
    const emptyAlert = document.getElementById("chkEmptyAlert");
    const mainGrid = document.getElementById("chkMainGrid");

    if (!items.length) {
      if (emptyAlert) emptyAlert.style.display = "block";
      if (mainGrid) mainGrid.style.display = "none";
      return;
    }

    if (emptyAlert) emptyAlert.style.display = "none";
    if (mainGrid) mainGrid.style.display = "grid";

    listEl.innerHTML = items.map(it => `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; padding:10px 0; border-bottom:1px solid var(--border-light);">
        <div style="display:flex; align-items:center; gap:10px; min-width:0;">
          <img src="${CC.esc(it.image_url)}" alt="${CC.esc(it.title)}" style="width:44px; height:44px; object-fit:contain; border:1px solid var(--border-light); padding:2px; background:#fff; flex-shrink:0;" />
          <div style="min-width:0;">
            <div style="font-size:13px; font-weight:600; color:var(--brand-charcoal); line-height:1.3;">${CC.esc(it.title)}</div>
            <div style="font-size:11.5px; color:var(--text-muted);">SKU: ${CC.esc(it.sku)} &bull; Qty: ${it.qty} × ${CC.formatINR(it.price)}</div>
          </div>
        </div>
        <strong style="font-size:13.5px; white-space:nowrap; color:var(--brand-charcoal);">${CC.formatINR(it.price * it.qty)}</strong>
      </div>
    `).join("");

    const subtotal = CC.getCartSubtotal();
    const total = Math.max(0, subtotal - activeDiscount);

    document.getElementById("chkSub").textContent = CC.formatINR(subtotal);
    document.getElementById("chkDiscRow").style.display = activeDiscount > 0 ? "flex" : "none";
    document.getElementById("chkDisc").textContent = "-" + CC.formatINR(activeDiscount);
    document.getElementById("chkTotal").textContent = CC.formatINR(total);
  }

  function prefillLoggedInUser() {
    const u = window.CellCare.user;
    if (!u) return;
    const setVal = (id, v) => { const el = document.getElementById(id); if (el && !el.value && v) el.value = v; };
    setVal("chkName", u.name);
    setVal("chkPhone", u.phone);
    setVal("chkEmail", u.email);
    setVal("chkAddress", u.address);
    setVal("chkCity", u.city);
    setVal("chkState", u.state);
    setVal("chkPincode", u.pincode);
    setVal("chkGstin", u.gstin);
  }

  function showEnquiryConfirmation(order, waUrl) {
    const CC = window.CellCare;
    document.getElementById("chkMainGrid").style.display = "none";
    const conf = document.getElementById("chkConfirmation");
    conf.style.display = "block";
    conf.innerHTML = `
      <div style="max-width:740px; margin:0 auto; background:var(--brand-white); border:1px solid var(--border-color); border-top:4px solid var(--brand-green); border-radius:6px; padding:34px;">
        <div style="text-align:center; margin-bottom:24px;">
          <div style="width:62px; height:62px; border-radius:50%; background:var(--brand-green-tint); color:var(--brand-green); display:inline-flex; align-items:center; justify-content:center; font-size:28px; margin-bottom:12px;">
            <i class="fab fa-whatsapp"></i>
          </div>
          <h2 style="margin:0 0 6px; font-family:var(--font-heading); font-size:24px; color:var(--brand-charcoal);">WhatsApp Order Enquiry Ready!</h2>
          <p style="margin:0; color:var(--text-muted);">Enquiry Reference: <strong style="color:var(--brand-charcoal); font-size:16px;">${CC.esc(order.order_id)}</strong></p>
        </div>

        <div style="background:var(--surface-subtle); padding:16px 20px; border-radius:4px; margin-bottom:20px; display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:14px; font-size:13.5px;">
          <div>
            <strong>Customer &amp; Delivery:</strong><br/>
            ${CC.esc(order.customer.name)}<br/>
            Phone: ${CC.esc(order.customer.phone)}<br/>
            ${CC.esc([order.customer.address, order.customer.city, order.customer.state].filter(Boolean).join(", "))}${order.customer.pincode ? ` - ${CC.esc(order.customer.pincode)}` : ""}
          </div>
          <div>
            <strong>Order Summary:</strong><br/>
            Mode: Direct WhatsApp Ordering (+91 85059 10581)<br/>
            Subtotal: ${CC.formatINR(order.pricing.subtotal)}<br/>
            ${order.pricing.discount > 0 ? `Discount: -${CC.formatINR(order.pricing.discount)}<br/>` : ""}
            <strong style="color:var(--brand-green);">Estimated Total: ${CC.formatINR(order.pricing.total)}</strong>
          </div>
        </div>

        <div style="margin-bottom:22px;">
          <h4 style="margin:0 0 10px; font-size:14px; text-transform:uppercase; color:var(--brand-charcoal);">Enquired Products</h4>
          ${(order.items || []).map(it => `
            <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--border-light); font-size:13.5px;">
              <span>${CC.esc(it.title)} <span style="color:var(--text-muted);">(SKU: ${CC.esc(it.sku)})</span> &times; ${it.qty}</span>
              <strong>${CC.formatINR(it.price * it.qty)}</strong>
            </div>
          `).join("")}
        </div>

        <div style="display:flex; gap:12px; flex-wrap:wrap; justify-content:center;">
          <a href="${CC.esc(waUrl)}" target="_blank" rel="noopener" class="cc-btn-primary" style="padding:12px 24px;">
            <i class="fab fa-whatsapp" style="font-size:17px;"></i> Open WhatsApp Message
          </a>
          <a href="track-order.html?order_id=${encodeURIComponent(order.order_id)}" class="cc-btn-charcoal">Track Enquiry</a>
          <a href="shop.html" class="cc-btn-outline">Continue Browsing</a>
        </div>
      </div>
    `;
    window.scrollTo({ top: 100, behavior: "smooth" });
  }

  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
      prefillLoggedInUser();
      const savedCoupon = sessionStorage.getItem("cellcare_coupon");
      if (savedCoupon) {
        const inp = document.getElementById("chkCouponInput");
        if (inp) inp.value = savedCoupon;
      }
      renderOrderSummary();
    }, 30);

    document.getElementById("chkApplyCouponBtn")?.addEventListener("click", async () => {
      const code = document.getElementById("chkCouponInput").value.trim().toUpperCase();
      const msgEl = document.getElementById("chkCouponMsg");
      if (!code) return;
      try {
        const res = await fetch("/api/payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "apply_coupon", code, subtotal: window.CellCare.getCartSubtotal() })
        });
        const data = await res.json();
        if (!data.ok) {
          activeCoupon = null;
          activeDiscount = 0;
          msgEl.innerHTML = `<span style="color:var(--brand-charcoal); font-weight:600;">${window.CellCare.esc(data.error)}</span>`;
        } else {
          activeCoupon = data.code;
          activeDiscount = Number(data.discount) || 0;
          msgEl.innerHTML = `<span style="color:var(--brand-green); font-weight:700;">${window.CellCare.esc(data.message)}</span>`;
        }
        renderOrderSummary();
      } catch {
        msgEl.innerHTML = `<span style="color:var(--text-muted);">Coupon service unavailable.</span>`;
      }
    });

    document.getElementById("ccCheckoutForm")?.addEventListener("submit", async e => {
      e.preventDefault();
      const CC = window.CellCare;
      const errBox = document.getElementById("chkFormError");
      errBox.style.display = "none";

      const customer = {
        name: document.getElementById("chkName").value.trim(),
        phone: document.getElementById("chkPhone").value.replace(/\D/g, ""),
        email: document.getElementById("chkEmail").value.trim(),
        address: document.getElementById("chkAddress").value.trim(),
        city: document.getElementById("chkCity").value.trim(),
        state: document.getElementById("chkState").value.trim(),
        pincode: document.getElementById("chkPincode").value.replace(/\D/g, ""),
        gstin: document.getElementById("chkGstin").value.trim().toUpperCase()
      };

      if (customer.name.length < 2) {
        errBox.textContent = "Please enter your full name.";
        errBox.style.display = "block";
        return;
      }
      if (customer.phone.length !== 10) {
        errBox.textContent = "Please enter a valid 10-digit mobile / WhatsApp number.";
        errBox.style.display = "block";
        return;
      }
      if (!customer.address || !customer.city || customer.pincode.length !== 6) {
        errBox.textContent = "Please enter your delivery address, city, and 6-digit pincode.";
        errBox.style.display = "block";
        return;
      }

      const notes = document.getElementById("chkNotes").value.trim();
      const cartItems = CC.getCartItems();
      const subtotal = CC.getCartSubtotal();
      const pricing = {
        subtotal,
        discount: activeDiscount,
        coupon_code: activeCoupon,
        total: Math.max(0, subtotal - activeDiscount)
      };

      const btn = document.getElementById("chkPlaceOrderBtn");
      btn.disabled = true;
      btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Preparing WhatsApp Order...`;

      let order = {
        order_id: `CCI-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        customer,
        items: cartItems,
        pricing
      };

      // Log enquiry to /api/orders (graceful fallback if static)
      try {
        const orderRes = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customer,
            items: cartItems,
            payment_method: "whatsapp",
            coupon_code: activeCoupon,
            notes
          })
        });
        const orderData = await orderRes.json();
        if (orderData.ok && orderData.order) {
          order = orderData.order;
        }
      } catch {}

      const waMsg = CC.buildOrderWhatsAppMessage({
        orderId: order.order_id,
        customer,
        items: order.items,
        pricing: order.pricing,
        notes
      });
      const waUrl = CC.buildWhatsAppUrl(waMsg);

      CC.clearCart();
      showEnquiryConfirmation(order, waUrl);
      CC.openWhatsApp(waMsg);
    });
  });
})(window, document);
