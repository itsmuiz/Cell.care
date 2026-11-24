/**
 * CELL CARE INDIA — MY ACCOUNT (LOGIN, REGISTER, DASHBOARD, ORDERS, PROFILE)
 * Replicates aowbike.com/my-account/ layout and adds full authenticated dashboard.
 */

(function (window, document) {
  "use strict";

  async function renderDashboard() {
    const CC = window.CellCare;
    const authView = document.getElementById("ccAuthView");
    const dashView = document.getElementById("ccDashboardView");
    if (!authView || !dashView) return;

    if (!CC.userToken || !CC.user) {
      authView.style.display = "block";
      dashView.style.display = "none";
      return;
    }

    authView.style.display = "none";
    dashView.style.display = "block";

    let orders = [];
    try {
      const res = await fetch("/api/users", {
        headers: { Authorization: "Bearer " + CC.userToken }
      });
      const data = await res.json();
      if (data.ok) {
        CC.setSession(CC.userToken, data.user);
        orders = data.orders || [];
      } else if (res.status === 401) {
        CC.logout();
        renderDashboard();
        return;
      }
    } catch {}

    const u = CC.user;
    document.getElementById("dashWelcome").textContent = `Hello, ${u.name}!`;
    document.getElementById("dashEmail").textContent = u.email;
    document.getElementById("dashOrderCount").textContent = String(orders.length);
    document.getElementById("dashWishCount").textContent = String(CC.wishlist.length);

    // Fill profile form
    document.getElementById("profName").value = u.name || "";
    document.getElementById("profPhone").value = u.phone || "";
    document.getElementById("profAddress").value = u.address || "";
    document.getElementById("profCity").value = u.city || "";
    document.getElementById("profState").value = u.state || "";
    document.getElementById("profPincode").value = u.pincode || "";
    document.getElementById("profGstin").value = u.gstin || "";

    // Render Orders
    const ordersBox = document.getElementById("dashOrdersList");
    if (!orders.length) {
      ordersBox.innerHTML = `<div class="cc-empty-notice">No order enquiries placed yet. <a href="shop.html" style="color:var(--brand-green); font-weight:700; margin-left:6px;">Browse Products &rarr;</a></div>`;
    } else {
      ordersBox.innerHTML = orders.map(o => `
        <div style="border:1px solid var(--border-light); border-radius:4px; padding:16px; margin-bottom:14px; background:var(--brand-white);">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; padding-bottom:10px; border-bottom:1px solid var(--border-light);">
            <div>
              <strong>Order #${CC.esc(o.order_id)}</strong>
              <span style="font-size:12px; color:var(--text-muted); margin-left:10px;">${new Date(o.created_at).toLocaleDateString("en-IN")}</span>
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
              <span style="background:var(--brand-green-tint); color:var(--brand-green); font-size:11.5px; font-weight:700; padding:3px 9px; border-radius:3px; text-transform:uppercase;">${CC.esc(o.status)}</span>
              <a href="track-order.html?order_id=${encodeURIComponent(o.order_id)}" class="cc-btn-primary" style="padding:5px 12px; font-size:12px;">Track</a>
            </div>
          </div>
          <div style="padding-top:10px; font-size:13.5px; color:var(--text-body);">
            ${(o.items || []).map(i => `<div>${CC.esc(i.title)} &times; ${i.qty} — <strong>${CC.formatINR(i.price * i.qty)}</strong></div>`).join("")}
            <div style="margin-top:8px; font-weight:700; color:var(--brand-green);">Estimated Total: ${CC.formatINR(o.pricing?.total || 0)}</div>
          </div>
        </div>
      `).join("");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(renderDashboard, 30);

    // Login / Register Tab Switcher
    document.querySelectorAll(".cc-auth-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".cc-auth-tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        const mode = tab.dataset.mode;
        document.getElementById("ccLoginFormWrap").style.display = mode === "login" ? "block" : "none";
        document.getElementById("ccRegisterFormWrap").style.display = mode === "register" ? "block" : "none";
      });
    });

    // Show / Hide password toggle
    document.querySelectorAll(".cc-pass-toggle").forEach(btn => {
      btn.addEventListener("click", () => {
        const input = document.getElementById(btn.dataset.target);
        if (!input) return;
        const isPass = input.type === "password";
        input.type = isPass ? "text" : "password";
        btn.innerHTML = isPass ? '<i class="far fa-eye-slash"></i>' : '<i class="far fa-eye"></i>';
      });
    });

    // Login Submit
    document.getElementById("ccLoginForm")?.addEventListener("submit", async e => {
      e.preventDefault();
      const email = document.getElementById("loginEmail").value.trim();
      const password = document.getElementById("loginPass").value;
      const errEl = document.getElementById("loginError");
      errEl.style.display = "none";

      try {
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "login", email, password })
        });
        const data = await res.json();
        if (!data.ok) {
          errEl.textContent = data.error || "Login failed.";
          errEl.style.display = "block";
          return;
        }
        window.CellCare.setSession(data.token, data.user);
        window.CellCare.toast(data.message || "Signed in!");
        renderDashboard();
      } catch {
        errEl.textContent = "Network error. Please try again.";
        errEl.style.display = "block";
      }
    });

    // Demo login shortcut
    document.getElementById("ccDemoLoginBtn")?.addEventListener("click", () => {
      document.getElementById("loginEmail").value = "demo@cellcareindia.com";
      document.getElementById("loginPass").value = "cellcare123";
      document.getElementById("ccLoginForm").dispatchEvent(new Event("submit"));
    });

    // Register Submit
    document.getElementById("ccRegisterForm")?.addEventListener("submit", async e => {
      e.preventDefault();
      const name = document.getElementById("regName").value.trim();
      const email = document.getElementById("regEmail").value.trim();
      const phone = document.getElementById("regPhone").value.trim();
      const password = document.getElementById("regPass").value;
      const errEl = document.getElementById("regError");
      errEl.style.display = "none";

      try {
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "register",
            name,
            email,
            phone,
            password,
            wishlist: window.CellCare.wishlist
          })
        });
        const data = await res.json();
        if (!data.ok) {
          errEl.textContent = data.error || "Registration failed.";
          errEl.style.display = "block";
          return;
        }
        window.CellCare.setSession(data.token, data.user);
        window.CellCare.toast(data.message || "Account created!");
        renderDashboard();
      } catch {
        errEl.textContent = "Network error. Please try again.";
        errEl.style.display = "block";
      }
    });

    // Forgot Password
    document.getElementById("ccForgotLink")?.addEventListener("click", async e => {
      e.preventDefault();
      const email = document.getElementById("loginEmail").value.trim() || prompt("Enter your registered email address:");
      if (!email) return;
      try {
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "forgot_password", email })
        });
        const data = await res.json();
        window.CellCare.toast(data.message || data.error);
      } catch {}
    });

    // Dashboard Section Tabs
    document.querySelectorAll(".dash-nav-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        if (btn.dataset.pane === "logout") {
          window.CellCare.logout();
          renderDashboard();
          return;
        }
        document.querySelectorAll(".dash-nav-btn").forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".dash-pane").forEach(p => p.style.display = "none");
        btn.classList.add("active");
        const target = document.getElementById("dashPane_" + btn.dataset.pane);
        if (target) target.style.display = "block";
      });
    });

    // Profile Update Submit
    document.getElementById("ccProfileForm")?.addEventListener("submit", async e => {
      e.preventDefault();
      const msgEl = document.getElementById("profSaveMsg");
      try {
        const res = await fetch("/api/users", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + window.CellCare.userToken
          },
          body: JSON.stringify({
            name: document.getElementById("profName").value.trim(),
            phone: document.getElementById("profPhone").value.trim(),
            address: document.getElementById("profAddress").value.trim(),
            city: document.getElementById("profCity").value.trim(),
            state: document.getElementById("profState").value.trim(),
            pincode: document.getElementById("profPincode").value.trim(),
            gstin: document.getElementById("profGstin").value.trim()
          })
        });
        const data = await res.json();
        if (data.ok) {
          window.CellCare.setSession(window.CellCare.userToken, data.user);
          msgEl.innerHTML = `<span style="color:#16a34a; font-weight:600;">Profile &amp; shipping address saved!</span>`;
          document.getElementById("dashWelcome").textContent = `Hello, ${data.user.name}!`;
        } else {
          msgEl.innerHTML = `<span style="color:#dc2626;">${window.CellCare.esc(data.error)}</span>`;
        }
      } catch {
        msgEl.innerHTML = `<span style="color:#dc2626;">Could not save profile right now.</span>`;
      }
    });
  });
})(window, document);
