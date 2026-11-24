/**
 * CELL CARE INDIA — ADMIN DASHBOARD CONTROLLER (assets/js/admin.js)
 * Connects to /api/admin, /api/products, and /api/orders for full store management.
 */

(function () {
  "use strict";

  const TOKEN_KEY = "cellcare_admin_token_v4";
  let adminToken = localStorage.getItem(TOKEN_KEY) || "";
  let cachedProducts = [];
  let cachedOrders = [];
  let cachedInquiries = [];
  let activeEditingOrder = null;

  function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function authHeaders() {
    return {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${adminToken}`
    };
  }

  function bootAdmin() {
    initLoginForm();
    initNavigationTabs();
    initProductModal();
    initOrderModal();

    if (adminToken) {
      loadDashboardData();
    } else {
      showLoginScreen();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootAdmin);
  } else {
    bootAdmin();
  }

  function showLoginScreen() {
    document.getElementById("adminLoginScreen").style.display = "flex";
    document.getElementById("adminAppContainer").style.display = "none";
    document.getElementById("adminLogoutBtn").style.display = "none";
  }

  function showDashboardScreen() {
    document.getElementById("adminLoginScreen").style.display = "none";
    document.getElementById("adminAppContainer").style.display = "grid";
    document.getElementById("adminLogoutBtn").style.display = "inline-flex";
  }

  function initLoginForm() {
    const form = document.getElementById("adminLoginForm");
    const logoutBtn = document.getElementById("adminLogoutBtn");
    const refreshBtn = document.getElementById("refreshDashboardBtn");

    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const password = document.getElementById("adminPassInput").value;
        const btn = document.getElementById("adminLoginSubmit");
        btn.disabled = true;
        btn.textContent = "Verifying...";

        try {
          const res = await fetch("/api/admin", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "login", password })
          });
          const data = await res.json();
          if (!res.ok || !data.ok) {
            throw new Error(data.error || "Invalid password");
          }
          adminToken = data.token;
          localStorage.setItem(TOKEN_KEY, adminToken);
          window.CellCare.toast("Logged in to Admin Console", "success");
          await loadDashboardData();
        } catch (err) {
          window.CellCare.toast(err.message || "Login failed", "error");
        } finally {
          btn.disabled = false;
          btn.textContent = "Sign In to Admin Console";
        }
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        adminToken = "";
        localStorage.removeItem(TOKEN_KEY);
        showLoginScreen();
      });
    }

    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => loadDashboardData());
    }
  }

  function initNavigationTabs() {
    const btns = document.querySelectorAll(".admin-nav-btn");
    const panes = {
      overview: document.getElementById("tabOverview"),
      products: document.getElementById("tabProducts"),
      orders: document.getElementById("tabOrders"),
      inquiries: document.getElementById("tabInquiries")
    };

    btns.forEach(btn => {
      btn.addEventListener("click", () => {
        const target = btn.dataset.tab;
        btns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        Object.keys(panes).forEach(k => {
          if (panes[k]) panes[k].style.display = k === target ? "block" : "none";
        });
      });
    });

    const filterSelect = document.getElementById("adminOrderFilterSelect");
    if (filterSelect) {
      filterSelect.addEventListener("change", () => renderOrdersTable());
    }
  }

  async function loadDashboardData() {
    try {
      const [adminRes, prodRes, ordRes] = await Promise.all([
        fetch("/api/admin", { headers: authHeaders() }),
        fetch("/api/products"),
        fetch("/api/orders", { headers: authHeaders() })
      ]);

      if (adminRes.status === 401) {
        adminToken = "";
        localStorage.removeItem(TOKEN_KEY);
        showLoginScreen();
        return;
      }

      const adminData = await adminRes.json();
      const prodData = await prodRes.json();
      const ordData = await ordRes.json();

      showDashboardScreen();

      if (adminData.system) {
        document.getElementById("sysDbMode").textContent = adminData.system.database_mode;
        document.getElementById("sysRzpMode").textContent =
          adminData.system.razorpay_mode === "live"
            ? "LIVE Mode Active"
            : adminData.system.razorpay_mode === "test"
            ? "TEST Key Active"
            : "Interactive Demo Gateway (Set RAZORPAY_KEY_ID in Vercel for Live)";
      }

      if (adminData.metrics) {
        document.getElementById("kpiRevenue").textContent = `₹${Number(adminData.metrics.total_revenue || 0).toLocaleString("en-IN")}`;
        document.getElementById("kpiOrders").textContent = adminData.metrics.total_orders || 0;
        document.getElementById("kpiPending").textContent = adminData.metrics.pending_orders || 0;
        document.getElementById("kpiProducts").textContent = adminData.metrics.total_products || 0;
        document.getElementById("kpiInquiries").textContent = adminData.metrics.total_inquiries || 0;
      }

      cachedProducts = prodData.items || [];
      cachedOrders = ordData.orders || adminData.recent_orders || [];
      cachedInquiries = adminData.inquiries || [];

      renderOverviewOrders();
      renderProductsTable();
      renderOrdersTable();
      renderInquiriesTable();
    } catch (err) {
      console.error("Dashboard load error:", err);
      window.CellCare.toast("Error loading dashboard data", "error");
    }
  }

  function renderOverviewOrders() {
    const tbody = document.getElementById("overviewRecentOrdersBody");
    if (!tbody) return;
    if (!cachedOrders.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:24px;">No orders placed yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = cachedOrders.slice(0, 8).map(o => `
      <tr>
        <td style="font-family:var(--font-mono); font-weight:700; color:var(--accent-primary);">${escapeHtml(o.order_id)}</td>
        <td>
          <strong style="color:#fff;">${escapeHtml(o.customer?.name)}</strong>
          <div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(o.customer?.phone)} • ${escapeHtml(o.customer?.city)}</div>
        </td>
        <td>${(o.items || []).length} item(s)</td>
        <td style="font-family:var(--font-mono); font-weight:700;">₹${Number(o.pricing?.total || 0).toLocaleString("en-IN")}</td>
        <td><span class="badge ${o.payment_status === "paid" ? "badge-success" : "badge-cyan"}">${escapeHtml(o.payment_status || "pending")}</span></td>
        <td><span class="badge badge-amber">${escapeHtml((o.status || "placed").toUpperCase())}</span></td>
        <td>
          <button type="button" class="btn btn-secondary btn-sm" onclick="window.openOrderModal('${escapeHtml(o.order_id)}')">Manage</button>
        </td>
      </tr>
    `).join("");
  }

  function renderProductsTable() {
    const tbody = document.getElementById("adminProductsTableBody");
    if (!tbody) return;
    if (!cachedProducts.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:24px;">No products in catalog.</td></tr>`;
      return;
    }

    tbody.innerHTML = cachedProducts.map(p => {
      const safeId = String(p.id).replace(/'/g, "\\'");
      return `
        <tr>
          <td>
            <div style="display:flex; align-items:center; gap:10px;">
              <img src="${escapeHtml(p.image_url || 'assets/images/hero.svg')}" alt="" style="width:38px; height:38px; object-fit:contain; background:#020408; border:1px solid var(--border-subtle); border-radius:2px;" />
              <div>
                <strong style="color:#fff; display:block;">${escapeHtml(p.title)}</strong>
                <span style="font-size:0.74rem; color:var(--text-muted);">${escapeHtml(p.voltage || "")} ${escapeHtml(p.capacity || "")}</span>
              </div>
            </div>
          </td>
          <td>
            <div style="font-family:var(--font-mono); font-size:0.76rem; color:var(--accent-cyan);">${escapeHtml(p.sku || p.id)}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(p.category)}</div>
          </td>
          <td style="font-family:var(--font-mono); font-weight:700; color:var(--accent-primary);">₹${Number(p.price || 0).toLocaleString("en-IN")}</td>
          <td style="font-family:var(--font-mono); color:var(--text-faint); text-decoration:line-through;">₹${Number(p.mrp || 0).toLocaleString("en-IN")}</td>
          <td style="font-family:var(--font-mono); font-weight:700; color:${Number(p.stock_qty) <= 5 ? 'var(--accent-amber)' : '#fff'};">${p.stock_qty !== undefined ? p.stock_qty : 25} units</td>
          <td>
            <span class="badge ${p.available !== false ? "badge-success" : "badge-amber"}">${p.available !== false ? "In Stock" : "Out of Stock"}</span>
          </td>
          <td>
            <div style="display:flex; gap:6px;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.editProduct('${safeId}')">Edit</button>
              <button type="button" class="btn btn-outline btn-sm" style="color:var(--accent-red); border-color:rgba(239,68,68,0.3);" onclick="window.deleteProductItem('${safeId}')">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  }

  function renderOrdersTable() {
    const tbody = document.getElementById("adminOrdersTableBody");
    const filterVal = (document.getElementById("adminOrderFilterSelect")?.value || "").toLowerCase();
    if (!tbody) return;

    const list = filterVal
      ? cachedOrders.filter(o => String(o.status || "").toLowerCase() === filterVal)
      : cachedOrders;

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:24px; color:var(--text-muted);">No matching orders found.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(o => `
      <tr>
        <td>
          <strong style="font-family:var(--font-mono); color:var(--accent-primary);">${escapeHtml(o.order_id)}</strong>
          <div style="font-size:0.72rem; color:var(--text-faint);">${new Date(o.created_at).toLocaleDateString("en-IN")}</div>
        </td>
        <td>
          <strong style="color:#fff;">${escapeHtml(o.customer?.name)}</strong>
          <div style="font-size:0.75rem; color:var(--text-muted);">+91 ${escapeHtml(o.customer?.phone)}</div>
          <div style="font-size:0.74rem; color:var(--text-faint);">${escapeHtml(o.customer?.city)}, ${escapeHtml(o.customer?.state)} (${escapeHtml(o.customer?.pincode)})</div>
        </td>
        <td>
          ${(o.items || []).map(i => `<div style="font-size:0.78rem;">• ${escapeHtml(i.title)} (×${i.qty})</div>`).join("")}
        </td>
        <td style="font-family:var(--font-mono); font-weight:700; color:#fff;">₹${Number(o.pricing?.total || 0).toLocaleString("en-IN")}</td>
        <td>
          <span class="badge ${o.payment_status === "paid" ? "badge-success" : "badge-cyan"}">${escapeHtml(o.payment_status || "pending")}</span>
          <div style="font-size:0.7rem; font-family:var(--font-mono); color:var(--text-faint); margin-top:2px;">${escapeHtml(o.payment_method || "")}</div>
        </td>
        <td>
          <span class="badge badge-amber">${escapeHtml((o.status || "placed").toUpperCase())}</span>
          ${o.tracking?.awb ? `<div style="font-family:var(--font-mono); font-size:0.72rem; color:var(--accent-cyan); margin-top:4px;">AWB: ${escapeHtml(o.tracking.awb)}</div>` : ""}
        </td>
        <td>
          <button type="button" class="btn btn-primary btn-sm" onclick="window.openOrderModal('${escapeHtml(o.order_id)}')">Update Dispatch</button>
        </td>
      </tr>
    `).join("");
  }

  function renderInquiriesTable() {
    const tbody = document.getElementById("adminInquiriesTableBody");
    if (!tbody) return;
    if (!cachedInquiries.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:24px; color:var(--text-muted);">No customer inquiries logged yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = cachedInquiries.map(inq => `
      <tr>
        <td style="font-family:var(--font-mono); font-size:0.75rem; color:var(--text-muted);">${new Date(inq.created_at).toLocaleString("en-IN")}</td>
        <td>
          <strong style="color:#fff;">${escapeHtml(inq.name)}</strong>
          <div style="font-size:0.76rem; color:var(--accent-primary); font-family:var(--font-mono);">${escapeHtml(inq.phone)}</div>
        </td>
        <td><span class="badge badge-cyan">${escapeHtml(inq.category)}</span></td>
        <td style="max-width:340px; font-size:0.82rem; color:var(--text-muted);">${escapeHtml(inq.message)}</td>
        <td>
          <button type="button" class="btn btn-whatsapp btn-sm" onclick="CellCare.openWhatsApp('Hello ${escapeHtml(inq.name)}, regarding your inquiry at Cell Care India:')">Reply on WhatsApp</button>
        </td>
      </tr>
    `).join("");
  }

  // ----------------------------------------------------
  // PRODUCT MODAL & GOOGLE SHEETS SYNC
  // ----------------------------------------------------
  function initProductModal() {
    const modal = document.getElementById("productEditorModal");
    const openBtn = document.getElementById("openAddProductBtn");
    const closeBtn = document.getElementById("closeProductModalBtn");
    const cancelBtn = document.getElementById("cancelProductModalBtn");
    const form = document.getElementById("productEditorForm");
    const syncBtn = document.getElementById("syncGsheetBtn");

    const closeModal = () => modal.classList.remove("active");

    if (openBtn) {
      openBtn.addEventListener("click", () => {
        form.reset();
        document.getElementById("prodId").value = "";
        document.getElementById("productModalTitle").textContent = "Add New Battery Product";
        modal.classList.add("active");
      });
    }
    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    if (cancelBtn) cancelBtn.addEventListener("click", closeModal);

    if (syncBtn) {
      syncBtn.addEventListener("click", async () => {
        syncBtn.disabled = true;
        syncBtn.textContent = "Syncing Google Sheets...";
        try {
          const res = await fetch("/api/products", {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ action: "sync_gsheet" })
          });
          const data = await res.json();
          if (!res.ok || !data.ok) throw new Error(data.error || "Sync failed");
          window.CellCare.clearCatalogCache();
          window.CellCare.toast(data.message || "Google Sheets synced!", "success");
          await loadDashboardData();
        } catch (err) {
          window.CellCare.toast(err.message || "Could not sync Google Sheets", "error");
        } finally {
          syncBtn.disabled = false;
          syncBtn.textContent = "⇄ Sync from Google Sheets";
        }
      });
    }

    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const payload = {
          id: document.getElementById("prodId").value || undefined,
          title: document.getElementById("prodTitle").value.trim(),
          sku: document.getElementById("prodSku").value.trim(),
          category: document.getElementById("prodCategory").value.trim(),
          compatibility: document.getElementById("prodCompat").value.trim(),
          price: Number(document.getElementById("prodPrice").value) || 0,
          mrp: Number(document.getElementById("prodMrp").value) || 0,
          stock_qty: Number(document.getElementById("prodStock").value) || 0,
          min_quantity: Number(document.getElementById("prodMoq").value) || 1,
          voltage: document.getElementById("prodVoltage").value.trim(),
          capacity: document.getElementById("prodCapacity").value.trim(),
          warranty: document.getElementById("prodWarranty").value.trim(),
          image_url: document.getElementById("prodImage").value.trim() || "assets/images/hero.svg",
          description: document.getElementById("prodDesc").value.trim(),
          available: document.getElementById("prodAvailable").checked,
          featured: document.getElementById("prodFeatured").checked
        };

        try {
          const res = await fetch("/api/products", {
            method: payload.id ? "PUT" : "POST",
            headers: authHeaders(),
            body: JSON.stringify(payload)
          });
          const data = await res.json();
          if (!res.ok || !data.ok) throw new Error(data.error || "Failed to save product");
          window.CellCare.clearCatalogCache();
          window.CellCare.toast("Product saved to database!", "success");
          closeModal();
          await loadDashboardData();
        } catch (err) {
          window.CellCare.toast(err.message || "Error saving product", "error");
        }
      });
    }
  }

  window.editProduct = function (id) {
    const p = cachedProducts.find(item => String(item.id) === String(id));
    if (!p) return;
    document.getElementById("prodId").value = p.id;
    document.getElementById("prodTitle").value = p.title || "";
    document.getElementById("prodSku").value = p.sku || "";
    document.getElementById("prodCategory").value = p.category || "";
    document.getElementById("prodCompat").value = p.compatibility || "";
    document.getElementById("prodPrice").value = p.price || 0;
    document.getElementById("prodMrp").value = p.mrp || 0;
    document.getElementById("prodStock").value = p.stock_qty !== undefined ? p.stock_qty : 25;
    document.getElementById("prodMoq").value = p.min_quantity || 1;
    document.getElementById("prodVoltage").value = p.voltage || "";
    document.getElementById("prodCapacity").value = p.capacity || "";
    document.getElementById("prodWarranty").value = p.warranty || "";
    document.getElementById("prodImage").value = p.image_url || "assets/images/hero.svg";
    document.getElementById("prodDesc").value = p.description || "";
    document.getElementById("prodAvailable").checked = p.available !== false;
    document.getElementById("prodFeatured").checked = p.featured !== false;

    document.getElementById("productModalTitle").textContent = `Edit Product: ${p.title}`;
    document.getElementById("productEditorModal").classList.add("active");
  };

  window.deleteProductItem = async function (id) {
    if (!confirm("Are you sure you want to delete this product from the catalog?")) return;
    try {
      const res = await fetch(`/api/products?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: authHeaders()
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Could not delete");
      window.CellCare.clearCatalogCache();
      window.CellCare.toast("Product deleted", "info");
      await loadDashboardData();
    } catch (err) {
      window.CellCare.toast(err.message || "Delete failed", "error");
    }
  };

  // ----------------------------------------------------
  // ORDER DISPATCH MODAL
  // ----------------------------------------------------
  function initOrderModal() {
    const modal = document.getElementById("orderEditorModal");
    const closeBtn = document.getElementById("closeOrderModalBtn");
    const cancelBtn = document.getElementById("cancelOrderModalBtn");
    const form = document.getElementById("orderEditorForm");
    const waBtn = document.getElementById("notifyCustomerWaBtn");

    const closeModal = () => modal.classList.remove("active");
    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    if (cancelBtn) cancelBtn.addEventListener("click", closeModal);

    if (waBtn) {
      waBtn.addEventListener("click", () => {
        if (!activeEditingOrder) return;
        const phone = String(activeEditingOrder.customer?.phone || "").replace(/\D/g, "").slice(-10);
        const status = document.getElementById("editOrderStatus").value.toUpperCase();
        const courier = document.getElementById("editOrderCourier").value.trim();
        const awb = document.getElementById("editOrderAwb").value.trim();
        const trackUrl = `${window.location.origin}/track-order.html?order_id=${encodeURIComponent(activeEditingOrder.order_id)}`;

        let msg = `Hello *${activeEditingOrder.customer?.name}*, update from *Cell Care India* regarding your Order *${activeEditingOrder.order_id}*:\n\n`;
        msg += `• *Current Status:* ${status}\n`;
        if (courier) msg += `• *Courier Partner:* ${courier}\n`;
        if (awb) msg += `• *Tracking AWB No:* ${awb}\n`;
        msg += `\nTrack live status here: ${trackUrl}`;

        window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, "_blank");
      });
    }

    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const order_id = document.getElementById("editOrderId").value;
        const status = document.getElementById("editOrderStatus").value;
        const payment_status = document.getElementById("editPaymentStatus").value;
        const courier = document.getElementById("editOrderCourier").value.trim();
        const awb = document.getElementById("editOrderAwb").value.trim();
        const estimated_delivery = document.getElementById("editOrderEta").value.trim();

        try {
          const res = await fetch("/api/orders", {
            method: "PATCH",
            headers: authHeaders(),
            body: JSON.stringify({
              order_id,
              status,
              payment_status,
              tracking: { courier, awb, estimated_delivery }
            })
          });
          const data = await res.json();
          if (!res.ok || !data.ok) throw new Error(data.error || "Update failed");
          window.CellCare.toast(`Order ${order_id} updated!`, "success");
          closeModal();
          await loadDashboardData();
        } catch (err) {
          window.CellCare.toast(err.message || "Error updating order", "error");
        }
      });
    }
  }

  window.openOrderModal = function (orderId) {
    const o = cachedOrders.find(item => item.order_id === orderId);
    if (!o) return;
    activeEditingOrder = o;

    document.getElementById("editOrderId").value = o.order_id;
    document.getElementById("orderModalTitle").textContent = `Manage Order: ${o.order_id}`;
    document.getElementById("orderModalCustomerSummary").innerHTML = `
      <strong style="color:#fff;">${escapeHtml(o.customer?.name)}</strong> (+91 ${escapeHtml(o.customer?.phone)})<br/>
      <span style="color:var(--text-muted);">${escapeHtml(o.customer?.address)}, ${escapeHtml(o.customer?.city)}, ${escapeHtml(o.customer?.state)} - ${escapeHtml(o.customer?.pincode)}</span><br/>
      <span style="color:var(--accent-primary); font-family:var(--font-mono); font-weight:700;">Total: ₹${Number(o.pricing?.total || 0).toLocaleString("en-IN")}</span>
    `;

    document.getElementById("editOrderStatus").value = o.status || "placed";
    document.getElementById("editPaymentStatus").value = o.payment_status || "pending";
    document.getElementById("editOrderCourier").value = o.tracking?.courier || "";
    document.getElementById("editOrderAwb").value = o.tracking?.awb || "";
    document.getElementById("editOrderEta").value = o.tracking?.estimated_delivery || "3–5 Working Days";

    document.getElementById("orderEditorModal").classList.add("active");
  };

})();
