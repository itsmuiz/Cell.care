/* checkout.js — collect customer info, send WhatsApp */

function loadCheckoutData() {
  let data = null;
  try {
    const raw = localStorage.getItem("cc_checkout_cart");
    if (raw) data = JSON.parse(raw);
  } catch (e) {
    console.warn("Could not parse checkout data", e);
  }
  return (
    data || {
      cart: [],
      totalAmount: 0,
      whatsapp: "919999999999"
    }
  );
}

function renderSummary(data) {
  const items = data.cart || [];
  const wrapper = document.getElementById("summaryItems");
  const subtotalEl = document.getElementById("summarySubtotal");

  if (!wrapper || !subtotalEl) return;

  wrapper.innerHTML = "";

  if (!items.length) {
    wrapper.innerHTML =
      '<p style="color:#9ca3af; font-size:0.9rem;">No items in cart. Please go back to the products page.</p>';
    subtotalEl.textContent = "₹0";
    return;
  }

  let total = 0;
  items.forEach((item) => {
    total += item.qty * item.price;
    const row = document.createElement("div");
    row.className = "summary-item";
    row.innerHTML = `
      <div class="summary-item-main">
        <div class="summary-item-name">${item.name}</div>
        <div class="summary-item-meta">Qty: ${item.qty} (step ${item.minQty})</div>
      </div>
      <div class="summary-item-total">₹${(item.qty * item.price).toLocaleString(
        "en-IN"
      )}</div>
    `;
    wrapper.appendChild(row);
  });

  subtotalEl.textContent = `₹${total.toLocaleString("en-IN")}`;
}

function validateForm() {
  const name = document.getElementById("custName").value.trim();
  const phoneRaw = document.getElementById("custPhone").value.trim();
  const email = document.getElementById("custEmail").value.trim();
  const address = document.getElementById("custAddress").value.trim();
  const pincodeRaw = document.getElementById("custPincode").value.trim();
  const confirmCheck = document.getElementById("confirmCheck").checked;
  const errorEl = document.getElementById("checkoutError");

  function setError(msg) {
    if (errorEl) errorEl.textContent = msg || "";
  }

  if (!name || !phoneRaw || !address || !pincodeRaw) {
    setError("Please fill all required fields marked with *.");
    return null;
  }

  // Phone: allow +91 / 0 etc, keep last 10 digits
  const phoneDigits = phoneRaw.replace(/\D/g, "");
  if (phoneDigits.length < 10) {
    setError("Please enter a valid mobile number (at least 10 digits).");
    return null;
  }
  const phone = phoneDigits.slice(-10); // store clean 10-digit number

  // Pincode: 6 digits
  const pinDigits = pincodeRaw.replace(/\D/g, "");
  if (pinDigits.length !== 6) {
    setError("Please enter a valid 6-digit pincode.");
    return null;
  }
  const pincode = pinDigits;

  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    setError("Please enter a valid email address.");
    return null;
  }

  if (!confirmCheck) {
    setError("Please confirm that all details are cross-checked.");
    return null;
  }

  setError("");
  return { name, phone, phoneRaw, email, address, pincode };
}

function buildWhatsAppUrl(data, userDetails) {
  const items = data.cart || [];
  let total = 0;
  items.forEach((i) => (total += i.qty * i.price));

  let text = "*Order enquiry from website*\n\n";
  text += "*Customer details:*\n";
  text += `Name: ${userDetails.name}\n`;
  text += `Phone: ${userDetails.phoneRaw} (clean: ${userDetails.phone})\n`;
  text += `Email: ${userDetails.email || "-"}\n`;
  text += `Address: ${userDetails.address}\n`;
  text += `Pincode: ${userDetails.pincode}\n\n`;

  text += "*Items:*\n";
  items.forEach((item) => {
    text += `• ${item.name} — Qty: ${item.qty} (step ${item.minQty}) = ₹${
      item.qty * item.price
    }\n`;
  });

  text += `\n*Subtotal:* ₹${total.toLocaleString("en-IN")}\n`;

  const number = (data.whatsapp || "919999999999").replace(/\D/g, "");
  const encoded = encodeURIComponent(text);
  return `https://wa.me/${number}?text=${encoded}`;
}

document.addEventListener("DOMContentLoaded", () => {
  const data = loadCheckoutData();
  renderSummary(data);

  const form = document.getElementById("checkoutForm");
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault(); // we handle validation manually

    const details = validateForm();
    if (!details) return;

    const url = buildWhatsAppUrl(data, details);

    try {
      localStorage.removeItem("cc_checkout_cart");
    } catch (err) {
      console.warn("Could not clear checkout data", err);
    }

    window.open(url, "_blank");
  });
});
