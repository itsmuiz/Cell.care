// core frontend glue (integrates with Django backend)
const API_BASE = "https://artifyscreens.pythonanywhere.com"; // backend

// small helper for sanitising text when we build HTML
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------------------- Config loader ----------------------
async function getConfig() {
  try {
    const res = await fetch(`${API_BASE}/api/config/`);
    if (!res.ok) return {};
    return await res.json();
  } catch (e) {
    console.error("Failed to load config:", e);
    return {};
  }
}

async function applyFooterConfig() {
  const cfg = await getConfig();
  // email & phone
  if (cfg.site_email) document.getElementById('footer-email').textContent = cfg.site_email;
  if (cfg.whatsapp_phone) document.getElementById('footer-phone').textContent = cfg.whatsapp_phone;
  if (cfg.address) document.getElementById('footer-address').textContent = cfg.address;

  // expose WhatsApp number globally for products page
  window.WHATSAPP_PHONE = cfg.whatsapp_phone || "";

  // socials
  const fb = document.querySelector('.social-facebook');
  const tw = document.querySelector('.social-twitter');
  const ig = document.querySelector('.social-instagram');
  const li = document.querySelector('.social-linkedin');

  if (fb && cfg.social && cfg.social.facebook) fb.href = cfg.social.facebook;
  if (tw && cfg.social && cfg.social.twitter) tw.href = cfg.social.twitter;
  if (ig && cfg.social && cfg.social.instagram) ig.href = cfg.social.instagram;
  if (li && cfg.social && cfg.social.linkedin) li.href = cfg.social.linkedin;
}

// ---------------------- Stats loader ----------------------
async function loadStats() {
  try {
    const res = await fetch(`${API_BASE}/api/stats/`);
    if (!res.ok) return;
    const s = await res.json();
    const yearsEl = document.getElementById('stat-years');
    const empEl = document.getElementById('stat-employees');
    const soldEl = document.getElementById('stat-sold');
    const distEl = document.getElementById('stat-distributors');
    if (yearsEl) yearsEl.textContent = (s.years_experience ?? 0) + (s.years_experience && s.years_experience > 0 ? '+' : '');
    if (empEl) empEl.textContent = (s.employees ?? 0) + '+';
    if (soldEl) soldEl.textContent = (s.batteries_sold ?? 0) + '+';
    if (distEl) distEl.textContent = (s.distributors ?? 0) + '+';
  } catch (e) {
    console.warn("Failed to load stats:", e);
  }
}

// ---------------------- HOMEPAGE: random 6 products ----------------------
async function loadHomepageProducts() {
  const container = document.getElementById("homeProducts");
  if (!container) return; // not on homepage

  container.innerHTML =
    '<p style="color:#bbd1ea; text-align:center; grid-column:1/-1;">Loading products...</p>';

  try {
    // get up to 50 products, then we'll randomly pick 6
    const res = await fetch(`${API_BASE}/api/products/?page=1&page_size=50`);
    if (!res.ok) throw new Error("Bad status");
    const data = await res.json();
    const items = data.items || [];

    if (!items.length) {
      container.innerHTML =
        '<p style="color:#bbd1ea; text-align:center; grid-column:1/-1;">No products available yet.</p>';
      return;
    }

    // Fisher–Yates shuffle
    const arr = items.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }

    const selected = arr.slice(0, 6);
    container.innerHTML = "";

    selected.forEach((p) => {
      const card = document.createElement("div");
      card.className = "product-card";

      const iconDiv = document.createElement("div");
      iconDiv.className = "product-icon";
      iconDiv.innerHTML = '<i class="fas fa-battery-half"></i>';

      const title = document.createElement("h3");
      title.className = "product-title";
      title.textContent = p.title || "Product";

      const desc = document.createElement("p");
      desc.className = "product-description";
      desc.textContent =
        p.description ||
        "Premium quality battery / module from Cell Care India.";

      const footer = document.createElement("div");
      footer.className = "product-footer";

      const priceNum = Number(p.price) || 0;
      const priceSpan = document.createElement("span");
      priceSpan.textContent = priceNum
        ? `₹${priceNum.toLocaleString("en-IN")}`
        : "Contact for price";

      const btn = document.createElement("button");
      btn.textContent = "Order on WhatsApp";
      btn.addEventListener("click", () =>
        orderOnWhatsApp(
          p.title || "Product",
          priceNum ? `₹${priceNum.toLocaleString("en-IN")}` : "N/A"
        )
      );

      footer.appendChild(priceSpan);
      footer.appendChild(btn);

      card.appendChild(iconDiv);
      card.appendChild(title);
      card.appendChild(desc);
      card.appendChild(footer);

      container.appendChild(card);
    });
  } catch (e) {
    console.error(e);
    container.innerHTML =
      '<p style="color:#f97373; text-align:center; grid-column:1/-1;">Could not load products.</p>';
  }
}

// ---------------------- Contact form + general init ----------------------
document.addEventListener('DOMContentLoaded', () => {
  // menu / toggle
  function toggleMenuInit() {
    const menu = document.querySelector(".hamburger");
    const close = document.querySelector(".close-menu");
    const sidebar = document.querySelector(".sidebar");
    if (menu) menu.addEventListener("click", () => sidebar.classList.toggle("sidebar-active"));
    if (close) close.addEventListener("click", () => sidebar.classList.remove("sidebar-active"));
  }

  toggleMenuInit();

  // GSAP animations (kept)
  try {
    gsap.from(".hero-content h1", { duration: 1, y: 50, opacity: 0, ease: "power3.out" });
    gsap.from(".hero-content p", { duration: 1, y: 30, opacity: 0, delay: 0.3, ease: "power3.out" });
    gsap.from(".buttons", { duration: 1, y: 20, opacity: 0, delay: 0.6, ease: "power3.out" });
    gsap.from(".hero-image", { duration: 1.5, scale: 0.8, opacity: 0, delay: 0.9, ease: "power3.out" });
  } catch (e) {
    // gsap not critical
  }

  // Vanilla tilt init (if available)
  try {
    if (window.VanillaTilt) VanillaTilt.init(document.querySelectorAll(".tilt"), { max:25, speed:400 });
  } catch (e){}

  // Contact form submit
  const form = document.getElementById('site-contact-form');
  if (form) {
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const name = document.getElementById('name').value.trim();
      const email = document.getElementById('email').value.trim();
      const message = document.getElementById('message').value.trim();
      if (!name || !email || !message) { alert('Please fill all fields'); return; }

      try {
        const resp = await fetch(`${API_BASE}/api/contact/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, message })
        });
        if (!resp.ok) {
          const err = await resp.json().catch(()=>null);
          alert('Failed to send message: ' + (err?.error || resp.statusText));
          return;
        }
        const data = await resp.json();
        if (data.ok) { alert('Message sent successfully'); form.reset(); }
        else alert('Error: ' + (data.error || 'unknown'));
      } catch (e) {
        console.error(e);
        alert('Could not send message. Try again later.');
      }
    });
  }

  // run loaders
  applyFooterConfig();
  loadStats();
  loadHomepageProducts(); // <- home product tiles (max 6, random)
});

// ---------------------- Helper: open WhatsApp ----------------------
function orderOnWhatsApp(productName, price) {
  const phoneNumber = window.WHATSAPP_PHONE || document.getElementById('footer-phone')?.textContent || '';
  if (!phoneNumber) {
    alert('WhatsApp number not configured.');
    return;
  }
  const message = `Hello! I'm interested in ${productName} (${price}). Please share details.`;
  const url = `https://wa.me/${phoneNumber.replace(/\D/g,'')}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
}

document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    const pid = params.get("product_id");
    if (!pid) return;

    const observer = new MutationObserver(() => {
        const card = document.querySelector(`[data-product-id="${pid}"]`);
        if (card) {
            card.scrollIntoView({ behavior: "smooth", block: "center" });
            card.classList.add("highlight-product");
            observer.disconnect();

            setTimeout(() => card.classList.remove("highlight-product"), 3000);
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
});	
