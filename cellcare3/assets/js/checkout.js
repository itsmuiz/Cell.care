/**
 * CELL CARE INDIA — DYNAMIC CHECKOUT & RAZORPAY GATEWAY ENGINE (v4.0)
 * Handles live cart quantity controls, coupon codes, shipping & GST breakdown,
 * Razorpay online payment + signature verification, COD, and Order Receipt generation.
 */

(function () {
  "use strict";

  let activeCoupon = null; // { code, discount, description }

  function bootCheckout() {
    if (window.CellCare && typeof window.CellCare.loadCartFromStorage === "function") {
      window.CellCare.loadCartFromStorage();
    }
    renderCheckoutSummary();
    initPaymentMethodCards();
    initCouponHandler();
    initCheckoutForm();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootCheckout);
  } else {
    bootCheckout();
  }

  window.removeCheckoutItem = function (id) {
    if (window.CellCare) {
      window.CellCare.removeFromCart(id);
      renderCheckoutSummary();
    }
  };

  window.changeCheckoutQty = function (id, delta) {
    if (window.CellCare && typeof window.CellCare.changeCartItemQty === "function") {
      window.CellCare.changeCartItemQty(id, delta);
      renderCheckoutSummary();
    }
  };

  function getSelectedPaymentMethod() {
    const checked = document.querySelector('input[name="payment_method"]:checked');
    return checked ? checked.value : "razorpay";
  }

  function updateSubmitButtonLabel() {
    const submitBtn = document.getElementById("checkoutSubmitBtn");
    if (!submitBtn) return;
    const method = getSelectedPaymentMethod();
    const { total } = getFinancialTotals();
    const totalFmt = total > 0 ? `₹${total.toLocaleString("en-IN")}` : "";

    if (method === "razorpay") {
      submitBtn.className = "btn btn-primary btn-lg";
      submitBtn.innerHTML = `<svg class="svg-icon" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg> Pay Now ${totalFmt} via Razorpay`;
    } else if (method === "cod") {
      submitBtn.className = "btn btn-primary btn-lg";
      submitBtn.innerHTML = `<svg class="svg-icon" viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg> Place COD Order (${totalFmt})`;
    } else {
      submitBtn.className = "btn btn-whatsapp btn-lg";
      submitBtn.innerHTML = `${(window.CellCare && window.CellCare.svg && window.CellCare.svg.whatsapp) || ""} Generate B2B Order &amp; Open WhatsApp`;
    }
  }

  function initPaymentMethodCards() {
    const cards = document.querySelectorAll(".payment-option-card");
    cards.forEach(card => {
      card.addEventListener("click", () => {
        cards.forEach(c => {
          c.classList.remove("active");
          c.style.borderColor = "var(--border-subtle)";
        });
        card.classList.add("active");
        card.style.borderColor = "var(--accent-primary)";
        const radio = card.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
        updateSubmitButtonLabel();
      });
    });
  }

  function getFinancialTotals() {
    const items = Object.values((window.CellCare && window.CellCare.cart) || {});
    let subtotal = 0;
    items.forEach(item => {
      subtotal += (Number(item.qty) || 1) * (Number(item.price) || 0);
    });

    const discount = activeCoupon ? Math.min(subtotal, Number(activeCoupon.discount) || 0) : 0;
    const shipping = subtotal === 0 ? 0 : subtotal >= 15000 ? 0 : 350;
    const total = Math.max(0, subtotal - discount + shipping);
    const gstIncluded = Math.round(total - total / 1.18);

    return { items, subtotal, discount, shipping, total, gstIncluded };
  }

  function renderCheckoutSummary() {
    const listContainer = document.getElementById("checkoutItemList");
    const subtotalEl = document.getElementById("checkoutSubtotalVal");
    const discountRow = document.getElementById("checkoutDiscountRow");
    const discountLabel = document.getElementById("checkoutDiscountLabel");
    const discountVal = document.getElementById("checkoutDiscountVal");
    const shippingEl = document.getElementById("checkoutShippingVal");
    const gstEl = document.getElementById("checkoutGstVal");
    const totalEl = document.getElementById("checkoutTotalVal");
    const submitBtn = document.getElementById("checkoutSubmitBtn");

    if (!listContainer || !window.CellCare) return;

    const { items, subtotal, discount, shipping, total, gstIncluded } = getFinancialTotals();
    const svg = (window.CellCare && window.CellCare.svg) || {};

    if (!items.length) {
      listContainer.innerHTML = `
        <div style="text-align:center; padding: 28px 10px; color: var(--text-muted);">
          <p style="font-size: 0.9rem; margin-bottom: 12px;">Your shopping cart is currently empty.</p>
          <a href="products.html" class="btn btn-primary btn-sm">Browse Battery Catalog</a>
        </div>
      `;
      if (subtotalEl) subtotalEl.textContent = "₹0";
      if (shippingEl) shippingEl.textContent = "₹0";
      if (gstEl) gstEl.textContent = "₹0";
      if (totalEl) totalEl.textContent = "₹0";
      if (submitBtn) submitBtn.disabled = true;
      return;
    }

    if (submitBtn) submitBtn.disabled = false;

    listContainer.innerHTML = items.map(item => {
      const lineTotal = item.qty * (item.price || 0);
      const safeId = String(item.id || item.slug || item.title).replace(/'/g, "\\'");

      return `
        <div class="order-item-card">
          <img src="${item.image_url || 'assets/images/hero.svg'}" class="order-item-thumb" alt="${escapeHtml(item.title)}" />
          <div class="order-item-details">
            <div class="order-item-title">${escapeHtml(item.title)}</div>
            <div style="display:flex; align-items:center; gap:8px; margin-top:4px;">
              <div class="qty-stepper" style="height:24px;">
                <button type="button" class="stepper-btn" style="width:22px; font-size:0.8rem;" onclick="changeCheckoutQty('${safeId}', -1)">−</button>
                <input type="text" class="stepper-input" style="width:26px; font-size:0.75rem;" value="${item.qty}" readonly />
                <button type="button" class="stepper-btn" style="width:22px; font-size:0.8rem;" onclick="changeCheckoutQty('${safeId}', 1)">+</button>
              </div>
              <span class="order-item-pricing">× ₹${(item.price || 0).toLocaleString("en-IN")}</span>
            </div>
          </div>
          <div class="order-item-total">
            ${lineTotal > 0 ? `₹${lineTotal.toLocaleString("en-IN")}` : "Quote"}
          </div>
          <button type="button" class="order-item-remove-btn" onclick="removeCheckoutItem('${safeId}')" title="Remove item">
            ${svg.xmark || '×'}
          </button>
        </div>
      `;
    }).join("");

    if (subtotalEl) subtotalEl.textContent = `₹${subtotal.toLocaleString("en-IN")}`;
    if (discountRow && discount > 0) {
      discountRow.style.display = "flex";
      if (discountLabel) discountLabel.textContent = `Coupon (${activeCoupon.code})`;
      if (discountVal) discountVal.textContent = `−₹${discount.toLocaleString("en-IN")}`;
    } else if (discountRow) {
      discountRow.style.display = "none";
    }

    if (shippingEl) {
      shippingEl.textContent = shipping === 0 ? "FREE" : `₹${shipping.toLocaleString("en-IN")}`;
      shippingEl.style.color = shipping === 0 ? "var(--accent-primary)" : "#ffffff";
    }

    if (gstEl) gstEl.textContent = `₹${gstIncluded.toLocaleString("en-IN")}`;
    if (totalEl) totalEl.textContent = `₹${total.toLocaleString("en-IN")}`;

    updateSubmitButtonLabel();
  }

  window.renderCheckoutSummary = renderCheckoutSummary;

  function initCouponHandler() {
    const input = document.getElementById("couponCodeInput");
    const btn = document.getElementById("applyCouponBtn");
    const feedback = document.getElementById("couponFeedback");
    if (!input || !btn || !feedback) return;

    btn.addEventListener("click", async () => {
      const code = input.value.trim().toUpperCase();
      if (!code) return;
      const { subtotal } = getFinancialTotals();

      btn.disabled = true;
      btn.textContent = "...";
      try {
        const res = await fetch("/api/payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "apply_coupon", code, subtotal })
        });
        const data = await res.json();
        feedback.style.display = "block";
        if (res.ok && data.ok) {
          activeCoupon = { code: data.code, discount: data.discount, description: data.description };
          feedback.style.color = "var(--accent-primary)";
          feedback.textContent = `✓ ${data.message}`;
          renderCheckoutSummary();
        } else {
          activeCoupon = null;
          feedback.style.color = "var(--accent-red)";
          feedback.textContent = data.error || "Invalid coupon code.";
          renderCheckoutSummary();
        }
      } catch (err) {
        feedback.style.display = "block";
        feedback.style.color = "var(--accent-red)";
        feedback.textContent = "Could not verify coupon right now.";
      } finally {
        btn.disabled = false;
        btn.textContent = "Apply";
      }
    });
  }

  function initCheckoutForm() {
    const form = document.getElementById("checkoutOrderForm");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const { items } = getFinancialTotals();
      if (!items.length) {
        window.CellCare.toast("Your cart is empty. Add products first!", "error");
        return;
      }

      const name = (document.getElementById("custName")?.value || "").trim();
      const phoneRaw = (document.getElementById("custPhone")?.value || "").trim();
      const email = (document.getElementById("custEmail")?.value || "").trim();
      const gstin = (document.getElementById("custGstin")?.value || "").trim();
      const address = (document.getElementById("custAddress")?.value || "").trim();
      const city = (document.getElementById("custCity")?.value || "").trim();
      const state = (document.getElementById("custState")?.value || "").trim();
      const pincode = (document.getElementById("custPincode")?.value || "").trim();
      const notes = (document.getElementById("custNotes")?.value || "").trim();
      const paymentMethod = getSelectedPaymentMethod();

      if (!name) {
        window.CellCare.toast("Please enter your full name.", "error");
        document.getElementById("custName")?.focus();
        return;
      }

      const phoneDigits = phoneRaw.replace(/\D/g, "");
      if (phoneDigits.length < 10) {
        window.CellCare.toast("Please enter a valid 10-digit mobile number.", "error");
        document.getElementById("custPhone")?.focus();
        return;
      }

      if (!address || !city || !state || pincode.replace(/\D/g, "").length !== 6) {
        window.CellCare.toast("Please fill in your complete shipping address and 6-digit pincode.", "error");
        document.getElementById("custAddress")?.focus();
        return;
      }

      const submitBtn = document.getElementById("checkoutSubmitBtn");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Creating Order...";
      }

      try {
        // 1. Create Order in Backend Database (/api/orders)
        const orderRes = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customer: {
              name,
              phone: phoneDigits.slice(-10),
              email,
              gstin,
              address,
              city,
              state,
              pincode: pincode.replace(/\D/g, "")
            },
            items,
            payment_method: paymentMethod,
            coupon_code: activeCoupon ? activeCoupon.code : null,
            notes
          })
        });

        const orderData = await orderRes.json();
        if (!orderRes.ok || !orderData.ok || !orderData.order) {
          throw new Error(orderData.error || "Could not create order.");
        }

        const createdOrder = orderData.order;

        // 2. Handle Payment Flow by Selected Method
        if (paymentMethod === "razorpay") {
          await handleRazorpayPayment(createdOrder);
        } else if (paymentMethod === "cod") {
          window.CellCare.clearCart();
          window.CellCare.clearCatalogCache();
          showOrderConfirmation(createdOrder);
        } else {
          // WhatsApp B2B Proforma
          dispatchWhatsAppOrderMessage(createdOrder);
          window.CellCare.clearCart();
          showOrderConfirmation(createdOrder);
        }
      } catch (err) {
        window.CellCare.toast(err.message || "Checkout failed. Please try again.", "error");
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          updateSubmitButtonLabel();
        }
      }
    });
  }

  async function handleRazorpayPayment(order) {
    // Initialize Razorpay order via /api/payment
    const payRes = await fetch("/api/payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_order",
        order_id: order.order_id,
        amount: order.pricing.total
      })
    });
    const payData = await payRes.json();
    if (!payRes.ok || !payData.ok) {
      throw new Error(payData.error || "Failed to initialize Razorpay gateway.");
    }

    // Live / Test Razorpay Popup when key_id is configured
    if (payData.mode === "razorpay" && typeof window.Razorpay === "function") {
      return new Promise((resolve, reject) => {
        const options = {
          key: payData.key_id,
          amount: payData.amount,
          currency: payData.currency || "INR",
          name: "Cell Care India",
          description: `Order #${order.order_id}`,
          order_id: payData.razorpay_order_id,
          prefill: {
            name: order.customer.name,
            email: order.customer.email || "customer@cellcareindia.com",
            contact: "+91" + order.customer.phone
          },
          theme: { color: "#00e575" },
          handler: async function (response) {
            try {
              const verifyRes = await fetch("/api/payment", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "verify",
                  order_id: order.order_id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature
                })
              });
              const verifyData = await verifyRes.json();
              if (!verifyRes.ok || !verifyData.ok) {
                throw new Error(verifyData.error || "Payment verification failed.");
              }
              window.CellCare.clearCart();
              window.CellCare.clearCatalogCache();
              showOrderConfirmation(verifyData.order);
              resolve();
            } catch (e) {
              reject(e);
            }
          },
          modal: {
            ondismiss: function () {
              reject(new Error("Payment window was closed before completion."));
            }
          }
        };
        const rzp = new window.Razorpay(options);
        rzp.open();
      });
    }

    // Interactive Demo Gateway Modal when live keys aren't set yet
    return new Promise((resolve, reject) => {
      const modal = document.getElementById("rzpDemoModal");
      const amountEl = document.getElementById("rzpDemoAmount");
      const cancelBtn = document.getElementById("rzpDemoCancelBtn");
      const approveBtn = document.getElementById("rzpDemoApproveBtn");

      if (!modal || !approveBtn) {
        reject(new Error("Payment modal unavailable"));
        return;
      }

      if (amountEl) amountEl.textContent = `₹${Number(order.pricing.total).toLocaleString("en-IN")}`;
      modal.style.display = "flex";

      cancelBtn.onclick = () => {
        modal.style.display = "none";
        reject(new Error("Payment cancelled by user."));
      };

      approveBtn.onclick = async () => {
        approveBtn.disabled = true;
        approveBtn.textContent = "Verifying...";
        try {
          const verifyRes = await fetch("/api/payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "verify",
              order_id: order.order_id,
              razorpay_order_id: payData.razorpay_order_id,
              razorpay_payment_id: `pay_sim_${Date.now()}`,
              demo_mode: true
            })
          });
          const verifyData = await verifyRes.json();
          modal.style.display = "none";
          if (!verifyRes.ok || !verifyData.ok) {
            throw new Error(verifyData.error || "Verification error");
          }
          window.CellCare.clearCart();
          window.CellCare.clearCatalogCache();
          showOrderConfirmation(verifyData.order);
          resolve();
        } catch (err) {
          modal.style.display = "none";
          reject(err);
        } finally {
          approveBtn.disabled = false;
          approveBtn.textContent = "Approve Payment ✓";
        }
      };
    });
  }

  function dispatchWhatsAppOrderMessage(order) {
    let msg = `*New Order — Cell Care India*\n`;
    msg += `*Order ID:* ${order.order_id}\n`;
    msg += `*Customer:* ${order.customer.name} (${order.customer.phone})\n`;
    msg += `*Address:* ${order.customer.address}, ${order.customer.city}, ${order.customer.state} - ${order.customer.pincode}\n`;
    if (order.customer.gstin) msg += `*GSTIN:* ${order.customer.gstin}\n`;
    msg += `\n*Ordered Items:*\n`;
    order.items.forEach(it => {
      msg += `• ${it.title} × ${it.qty} = ₹${(it.qty * it.price).toLocaleString("en-IN")}\n`;
    });
    msg += `\n*Total Payable:* ₹${Number(order.pricing.total).toLocaleString("en-IN")} (GST Incl.)`;
    if (window.CellCare && typeof window.CellCare.openWhatsApp === "function") {
      window.CellCare.openWhatsApp(msg);
    }
  }

  function showOrderConfirmation(order) {
    const mainGrid = document.getElementById("checkoutMainGrid");
    const successScreen = document.getElementById("orderSuccessScreen");
    if (mainGrid) mainGrid.style.display = "none";
    if (!successScreen) return;

    window.scrollTo({ top: 0, behavior: "smooth" });
    window.CellCare.toast(`Order ${order.order_id} Confirmed!`, "success");

    const payBadge =
      order.payment_status === "paid"
        ? `<span class="badge badge-success">PAID ONLINE (${escapeHtml(order.razorpay_payment_id || "Razorpay")})</span>`
        : order.payment_method === "cod"
        ? `<span class="badge badge-cyan">CASH ON DELIVERY (CONFIRMED)</span>`
        : `<span class="badge badge-amber">B2B PROFORMA / WHATSAPP</span>`;

    successScreen.style.display = "block";
    successScreen.innerHTML = `
      <div style="text-align:center; padding-bottom:24px; border-bottom:1px solid var(--border-subtle); margin-bottom:24px;">
        <div style="width:54px; height:54px; margin:0 auto 14px; border-radius:2px; background:rgba(0,229,117,0.12); border:1px solid var(--accent-primary); display:flex; align-items:center; justify-content:center; color:var(--accent-primary); font-size:1.6rem;">
          ✓
        </div>
        <div style="font-family:var(--font-mono); font-size:0.78rem; color:var(--accent-primary); text-transform:uppercase; letter-spacing:0.08em;">Order Successfully Registered</div>
        <h2 style="font-family:var(--font-display); font-size:1.8rem; color:#ffffff; margin:6px 0;">Order ID: <span style="color:var(--accent-primary); font-family:var(--font-mono);">${escapeHtml(order.order_id)}</span></h2>
        <p style="color:var(--text-muted); font-size:0.9rem;">Save your Order ID to track live factory testing, packing, and courier AWB status anytime.</p>
        <div style="margin-top:12px;">${payBadge}</div>
      </div>

      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:16px; margin-bottom:24px; font-size:0.86rem;">
        <div style="background:var(--bg-surface); border:1px solid var(--border-subtle); padding:16px; border-radius:2px;">
          <div style="font-family:var(--font-mono); font-size:0.72rem; color:var(--text-faint); text-transform:uppercase; margin-bottom:6px;">Shipping Destination</div>
          <strong style="color:#fff; display:block;">${escapeHtml(order.customer.name)}</strong>
          <div style="color:var(--text-muted); margin-top:4px;">
            ${escapeHtml(order.customer.address)}<br/>
            ${escapeHtml(order.customer.city)}, ${escapeHtml(order.customer.state)} — ${escapeHtml(order.customer.pincode)}<br/>
            Phone: +91 ${escapeHtml(order.customer.phone)}
            ${order.customer.gstin ? `<br/>GSTIN: ${escapeHtml(order.customer.gstin)}` : ""}
          </div>
        </div>
        <div style="background:var(--bg-surface); border:1px solid var(--border-subtle); padding:16px; border-radius:2px;">
          <div style="font-family:var(--font-mono); font-size:0.72rem; color:var(--text-faint); text-transform:uppercase; margin-bottom:6px;">Payment &amp; Dispatch Summary</div>
          <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span style="color:var(--text-muted);">Subtotal:</span><span style="font-family:var(--font-mono);">₹${Number(order.pricing.subtotal).toLocaleString("en-IN")}</span></div>
          ${order.pricing.discount > 0 ? `<div style="display:flex; justify-content:space-between; margin-bottom:4px; color:var(--accent-primary);"><span>Discount:</span><span style="font-family:var(--font-mono);">−₹${Number(order.pricing.discount).toLocaleString("en-IN")}</span></div>` : ""}
          <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span style="color:var(--text-muted);">Shipping:</span><span style="font-family:var(--font-mono);">${order.pricing.shipping === 0 ? "FREE" : `₹${order.pricing.shipping}`}</span></div>
          <div style="display:flex; justify-content:space-between; padding-top:8px; border-top:1px solid var(--border-subtle); font-weight:800; color:var(--accent-primary); font-size:1rem;">
            <span>Total (GST Incl.):</span>
            <span style="font-family:var(--font-mono);">₹${Number(order.pricing.total).toLocaleString("en-IN")}</span>
          </div>
        </div>
      </div>

      <div style="display:flex; gap:12px; flex-wrap:wrap; justify-content:center;">
        <a href="track-order.html?order_id=${encodeURIComponent(order.order_id)}" class="btn btn-primary btn-lg">
          <svg class="svg-icon" viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
          Track Live Order Status
        </a>
        <button type="button" onclick="window.print()" class="btn btn-secondary btn-lg">
          Print Tax Invoice / Receipt
        </button>
        <a href="products.html" class="btn btn-outline btn-lg">Continue Shopping</a>
      </div>
    `;
  }

  function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

})();
