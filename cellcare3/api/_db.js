/**
 * CELL CARE INDIA — UNIFIED DATABASE & AUTH LAYER (api/_db.js)
 * Supports Vercel Postgres / Neon / Supabase (via POSTGRES_URL or DATABASE_URL)
 * with automatic table initialization, plus zero-config persistent JSON store
 * and live Google Sheets catalog synchronization.
 * Supports: Products, Orders, Inquiries, Customer Users (Auth/Profile/Wishlist), Reviews, Visitor Counter.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const TMP_DB_FILE = path.join(os.tmpdir(), "cellcare_dynamic_db_v5.json");
const SEED_FILE = path.join(process.cwd(), "data", "seed-products.json");
const GSHEET_API = process.env.GSHEET_PRODUCTS_API ||
  "https://script.google.com/macros/s/AKfycbzPASrJpC5dvoFX-R6zX1AfW-pFyg8DIM6D_p9DG4QSI16qyymFXzibseq1rA9r_f-j2g/exec";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "cellcare@admin2026";
const TOKEN_SECRET = process.env.ADMIN_TOKEN_SECRET || "cellcare-india-secret-key-2026-hms";

let pgPool = null;
let pgInitDone = false;

function getPgPool() {
  const connStr = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connStr) return null;
  if (!pgPool) {
    try {
      const { Pool } = require("pg");
      pgPool = new Pool({
        connectionString: connStr,
        ssl: connStr.includes("localhost") ? false : { rejectUnauthorized: false },
        max: 5
      });
    } catch (err) {
      console.warn("pg module load note:", err.message);
      return null;
    }
  }
  return pgPool;
}

async function ensurePgTables(pool) {
  if (pgInitDone || !pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cc_products (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS cc_orders (
      order_id TEXT PRIMARY KEY,
      phone TEXT,
      status TEXT,
      payment_status TEXT,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS cc_inquiries (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS cc_users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS cc_reviews (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  pgInitDone = true;
}

function loadSeedProducts() {
  try {
    if (fs.existsSync(SEED_FILE)) {
      const raw = fs.readFileSync(SEED_FILE, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn("Seed file read note:", e.message);
  }
  return [];
}

function normalizeProduct(p, index = 0) {
  const title = String(p.title || "Industrial Battery Pack").trim();
  const slug = p.slug || title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const id = String(p.id || p.sku || slug || `cc-item-${index + 1}`);
  const price = Number(p.price) || 0;
  const mrp = Number(p.mrp || p.regular_price) || (price > 0 ? Math.round(price * 1.18) : 0);
  const stockQty = p.stock_qty !== undefined ? Number(p.stock_qty) : (p.available === false ? 0 : 25);
  const img = p.image_url || "assets/images/products/ev-scooter-battery-48v.jpg";

  return {
    id,
    sku: String(p.sku || `CC-${id.toUpperCase().replace(/^CC-/, "")}`),
    slug,
    title,
    category: p.category || "EV Scooter Batteries",
    brand: p.brand || "Universal EV",
    brands: Array.isArray(p.brands) ? p.brands : [p.brand || "Universal EV"],
    compatibility: p.compatibility || p.model || "Universal EV & Solar Application",
    price,
    mrp,
    stock_qty: stockQty,
    min_quantity: Math.max(1, parseInt(p.min_quantity || p.moq || 1, 10)),
    available: p.available !== false && stockQty > 0,
    featured: Boolean(p.featured !== undefined ? p.featured : index < 8),
    is_deal: Boolean(p.is_deal !== undefined ? p.is_deal : mrp > price),
    is_new: Boolean(p.is_new !== undefined ? p.is_new : index < 10),
    rating: Number(p.rating) || 4.8,
    reviews_count: Number(p.reviews_count) || 24,
    image_url: img,
    gallery: Array.isArray(p.gallery) && p.gallery.length ? p.gallery : [img],
    description: p.description || "Grade-A Lithium battery pack & EV component with Smart Active BMS thermal and short-circuit protection.",
    key_features: Array.isArray(p.key_features) ? p.key_features : [],
    package_includes: p.package_includes || `1 × ${title}`,
    voltage: p.voltage || "",
    capacity: p.capacity || "",
    chemistry: p.chemistry || "LiFePO4 / NMC",
    warranty: p.warranty || "1–3 Years Manufacturer Warranty",
    dimensions: p.dimensions || "",
    weight: p.weight || "",
    material: p.material || "Industrial Grade Enclosure",
    specs: p.specs || {},
    updated_at: p.updated_at || new Date().toISOString()
  };
}

function hashPassword(password, salt) {
  const s = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(String(password), s, 10000, 32, "sha256").toString("hex");
  return `${s}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, origHash] = stored.split(":");
  const hash = crypto.pbkdf2Sync(String(password), salt, 10000, 32, "sha256").toString("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(origHash, "hex"), Buffer.from(hash, "hex"));
  } catch {
    return false;
  }
}

function readLocalStore() {
  try {
    if (fs.existsSync(TMP_DB_FILE)) {
      const raw = fs.readFileSync(TMP_DB_FILE, "utf8");
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.products) && data.products.length > 0) {
        if (!Array.isArray(data.users)) data.users = [];
        if (!Array.isArray(data.reviews)) data.reviews = [];
        if (!data.visitor_count) data.visitor_count = 148920;
        return data;
      }
    }
  } catch (e) {}

  const seeded = loadSeedProducts().map((p, idx) => normalizeProduct(p, idx));
  const initialStore = {
    products: seeded,
    orders: [
      {
        order_id: "CCI-2026-1001",
        created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
        updated_at: new Date(Date.now() - 3600000 * 5).toISOString(),
        customer: {
          name: "Rajesh Sharma",
          phone: "9876543210",
          email: "demo@cellcareindia.com",
          address: "Plot 14, Industrial Area Phase 2",
          city: "Jaipur",
          state: "Rajasthan",
          pincode: "302001",
          gstin: "08ABCDE1234F1Z5"
        },
        items: [
          {
            id: "cc-48v-30ah-lfp",
            sku: "CC-48V30-LFP",
            title: "48V 30Ah LiFePO4 EV Scooter Battery Pack (Smart BMS)",
            price: 16500,
            qty: 2,
            image_url: "assets/images/products/ev-scooter-battery-48v.jpg"
          }
        ],
        pricing: {
          subtotal: 33000,
          discount: 0,
          shipping: 0,
          gst_included: 5034,
          total: 33000
        },
        payment_method: "razorpay",
        payment_status: "paid",
        razorpay_order_id: "order_demo_1001",
        razorpay_payment_id: "pay_demo_998877",
        status: "shipped",
        tracking: {
          courier: "Delhivery Surface Heavy",
          awb: "DLV883920194IN",
          estimated_delivery: "Within 3-4 Working Days",
          notes: "Dispatched from New Delhi Factory Warehouse after QC load test."
        }
      }
    ],
    inquiries: [],
    users: [
      {
        id: "usr-demo-1",
        name: "Rajesh Sharma",
        email: "demo@cellcareindia.com",
        phone: "9876543210",
        password_hash: hashPassword("cellcare123"),
        address: "Plot 14, Industrial Area Phase 2",
        city: "Jaipur",
        state: "Rajasthan",
        pincode: "302001",
        wishlist: ["cc-48v-30ah-lfp", "cc-jk-bms-100a"],
        created_at: new Date(Date.now() - 86400000 * 10).toISOString()
      }
    ],
    reviews: [
      {
        id: "rev-1",
        product_id: "cc-48v-30ah-lfp",
        author: "Amit Verma",
        rating: 5,
        title: "Genuine 75+ km range on Hero Optima",
        comment: "Installed directly in my Hero Electric Optima. Zero heating, Bluetooth BMS readings are rock steady and delivery to Lucknow took 3 days.",
        verified: true,
        created_at: new Date(Date.now() - 86400000 * 14).toISOString()
      },
      {
        id: "rev-2",
        product_id: "cc-48v-30ah-lfp",
        author: "Sandeep EV Garage",
        rating: 5,
        title: "Best factory-direct build quality",
        comment: "We order 10+ packs every month for customer upgrades. Clean spot welds, genuine Grade-A LiFePO4 cells and proper QC sheet inside.",
        verified: true,
        created_at: new Date(Date.now() - 86400000 * 5).toISOString()
      },
      {
        id: "rev-3",
        product_id: "cc-jk-bms-100a",
        author: "Vikram Patel",
        rating: 5,
        title: "Balanced my 16S pack within 2 hours",
        comment: "Original JK BMS with 1A active balancer. App paired instantly on Android and brought my cell delta down from 85mV to 4mV.",
        verified: true,
        created_at: new Date(Date.now() - 86400000 * 9).toISOString()
      }
    ],
    visitor_count: 148920,
    last_gsheet_sync: null
  };

  writeLocalStore(initialStore);
  return initialStore;
}

function writeLocalStore(store) {
  try {
    fs.writeFileSync(TMP_DB_FILE, JSON.stringify(store, null, 2), "utf8");
  } catch (e) {
    console.warn("Write tmp db note:", e.message);
  }
}

// ----------------------------------------------------
// PRODUCTS CRUD & GOOGLE SHEETS SYNC
// ----------------------------------------------------
async function getProducts() {
  const pool = getPgPool();
  if (pool) {
    try {
      await ensurePgTables(pool);
      const { rows } = await pool.query("SELECT data FROM cc_products ORDER BY updated_at DESC");
      if (rows.length > 0) {
        return rows.map(r => normalizeProduct(r.data));
      }
      const seed = loadSeedProducts().map((p, i) => normalizeProduct(p, i));
      for (const item of seed) {
        await pool.query(
          "INSERT INTO cc_products (id, data, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (id) DO NOTHING",
          [item.id, JSON.stringify(item)]
        );
      }
      return seed;
    } catch (err) {
      console.warn("Postgres getProducts fallback:", err.message);
    }
  }
  const store = readLocalStore();
  return store.products;
}

async function saveProduct(productInput) {
  const normalized = normalizeProduct(productInput);
  const pool = getPgPool();
  if (pool) {
    try {
      await ensurePgTables(pool);
      await pool.query(
        `INSERT INTO cc_products (id, data, updated_at) VALUES ($1, $2, NOW())
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        [normalized.id, JSON.stringify(normalized)]
      );
      return normalized;
    } catch (err) {
      console.warn("Postgres saveProduct fallback:", err.message);
    }
  }

  const store = readLocalStore();
  const idx = store.products.findIndex(p => String(p.id) === String(normalized.id));
  if (idx >= 0) {
    store.products[idx] = { ...store.products[idx], ...normalized, updated_at: new Date().toISOString() };
  } else {
    store.products.unshift(normalized);
  }
  writeLocalStore(store);
  return normalized;
}

async function deleteProduct(id) {
  const targetId = String(id || "").trim();
  if (!targetId) return false;

  const pool = getPgPool();
  if (pool) {
    try {
      await ensurePgTables(pool);
      await pool.query("DELETE FROM cc_products WHERE id = $1", [targetId]);
    } catch (err) {
      console.warn("Postgres deleteProduct fallback:", err.message);
    }
  }

  const store = readLocalStore();
  const prevLen = store.products.length;
  store.products = store.products.filter(p => String(p.id) !== targetId);
  writeLocalStore(store);
  return store.products.length < prevLen || Boolean(pool);
}

async function syncProductsFromGoogleSheets() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${GSHEET_API}?page=1&page_size=100`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`Google Sheets returned HTTP ${res.status}`);
    const data = await res.json();
    const gItems = data.items || data.results || [];
    let syncedCount = 0;

    for (let i = 0; i < gItems.length; i++) {
      const gp = gItems[i];
      if (!gp || !gp.title || !String(gp.title).trim()) continue;
      await saveProduct(gp);
      syncedCount++;
    }

    const store = readLocalStore();
    store.last_gsheet_sync = new Date().toISOString();
    writeLocalStore(store);

    return { synced: syncedCount, total: (await getProducts()).length };
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

// ----------------------------------------------------
// ORDERS CRUD & STOCK MANAGEMENT
// ----------------------------------------------------
async function getOrders() {
  const pool = getPgPool();
  if (pool) {
    try {
      await ensurePgTables(pool);
      const { rows } = await pool.query("SELECT data FROM cc_orders ORDER BY created_at DESC");
      return rows.map(r => r.data);
    } catch (err) {
      console.warn("Postgres getOrders fallback:", err.message);
    }
  }
  const store = readLocalStore();
  return store.orders || [];
}

async function getOrderById(orderId) {
  const cleanId = String(orderId || "").trim().toUpperCase();
  const orders = await getOrders();
  return orders.find(o => String(o.order_id).toUpperCase() === cleanId) || null;
}

async function saveOrder(orderObj) {
  const now = new Date().toISOString();
  const order = {
    ...orderObj,
    order_id: orderObj.order_id || `CCI-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    created_at: orderObj.created_at || now,
    updated_at: now
  };

  const pool = getPgPool();
  if (pool) {
    try {
      await ensurePgTables(pool);
      await pool.query(
        `INSERT INTO cc_orders (order_id, phone, status, payment_status, data, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         ON CONFLICT (order_id) DO UPDATE SET
           status = EXCLUDED.status,
           payment_status = EXCLUDED.payment_status,
           data = EXCLUDED.data,
           updated_at = NOW()`,
        [
          order.order_id,
          order.customer?.phone || "",
          order.status || "placed",
          order.payment_status || "pending",
          JSON.stringify(order)
        ]
      );
      return order;
    } catch (err) {
      console.warn("Postgres saveOrder fallback:", err.message);
    }
  }

  const store = readLocalStore();
  if (!Array.isArray(store.orders)) store.orders = [];
  const idx = store.orders.findIndex(o => o.order_id === order.order_id);
  if (idx >= 0) {
    store.orders[idx] = order;
  } else {
    store.orders.unshift(order);
  }
  writeLocalStore(store);
  return order;
}

async function decrementProductStock(items) {
  if (!Array.isArray(items) || !items.length) return;
  const allProducts = await getProducts();
  for (const cartItem of items) {
    const prod = allProducts.find(p => String(p.id) === String(cartItem.id));
    if (prod) {
      const newStock = Math.max(0, (Number(prod.stock_qty) || 0) - (Number(cartItem.qty) || 1));
      prod.stock_qty = newStock;
      prod.available = newStock > 0;
      await saveProduct(prod);
    }
  }
}

// ----------------------------------------------------
// INQUIRIES CRUD
// ----------------------------------------------------
async function getInquiries() {
  const pool = getPgPool();
  if (pool) {
    try {
      await ensurePgTables(pool);
      const { rows } = await pool.query("SELECT data FROM cc_inquiries ORDER BY created_at DESC");
      return rows.map(r => r.data);
    } catch (err) {
      console.warn("Postgres getInquiries fallback:", err.message);
    }
  }
  const store = readLocalStore();
  return store.inquiries || [];
}

async function saveInquiry(inquiryInput) {
  const inquiry = {
    id: inquiryInput.id || `INQ-${Date.now()}`,
    name: String(inquiryInput.name || "").trim(),
    phone: String(inquiryInput.phone || "").trim(),
    email: String(inquiryInput.email || "").trim(),
    category: String(inquiryInput.category || inquiryInput.subject || "General Inquiry").trim(),
    message: String(inquiryInput.message || "").trim(),
    status: inquiryInput.status || "new",
    created_at: new Date().toISOString()
  };

  const pool = getPgPool();
  if (pool) {
    try {
      await ensurePgTables(pool);
      await pool.query(
        "INSERT INTO cc_inquiries (id, data, created_at) VALUES ($1, $2, NOW()) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data",
        [inquiry.id, JSON.stringify(inquiry)]
      );
      return inquiry;
    } catch (err) {
      console.warn("Postgres saveInquiry fallback:", err.message);
    }
  }

  const store = readLocalStore();
  if (!Array.isArray(store.inquiries)) store.inquiries = [];
  store.inquiries.unshift(inquiry);
  writeLocalStore(store);
  return inquiry;
}

// ----------------------------------------------------
// CUSTOMER USERS CRUD & TOKEN AUTH
// ----------------------------------------------------
async function getUsers() {
  const pool = getPgPool();
  if (pool) {
    try {
      await ensurePgTables(pool);
      const { rows } = await pool.query("SELECT data FROM cc_users ORDER BY created_at DESC");
      return rows.map(r => r.data);
    } catch (err) {
      console.warn("Postgres getUsers fallback:", err.message);
    }
  }
  const store = readLocalStore();
  return store.users || [];
}

async function findUserByEmail(email) {
  const norm = String(email || "").trim().toLowerCase();
  const users = await getUsers();
  return users.find(u => String(u.email || "").toLowerCase() === norm) || null;
}

async function findUserById(id) {
  const users = await getUsers();
  return users.find(u => String(u.id) === String(id)) || null;
}

async function saveUser(userObj) {
  const now = new Date().toISOString();
  const user = {
    ...userObj,
    id: userObj.id || `usr-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    email: String(userObj.email || "").trim().toLowerCase(),
    updated_at: now,
    created_at: userObj.created_at || now
  };

  const pool = getPgPool();
  if (pool) {
    try {
      await ensurePgTables(pool);
      await pool.query(
        `INSERT INTO cc_users (id, email, data, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())
         ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, data = EXCLUDED.data, updated_at = NOW()`,
        [user.id, user.email, JSON.stringify(user)]
      );
      return user;
    } catch (err) {
      console.warn("Postgres saveUser fallback:", err.message);
    }
  }

  const store = readLocalStore();
  if (!Array.isArray(store.users)) store.users = [];
  const idx = store.users.findIndex(u => u.id === user.id || u.email === user.email);
  if (idx >= 0) {
    store.users[idx] = user;
  } else {
    store.users.unshift(user);
  }
  writeLocalStore(store);
  return user;
}

function generateUserToken(userId) {
  const payload = `user:${userId}:${Date.now()}`;
  const sig = crypto.createHmac("sha256", TOKEN_SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64");
}

function verifyUserToken(token) {
  if (!token) return null;
  try {
    const decoded = Buffer.from(String(token), "base64").toString("utf8");
    const parts = decoded.split(":");
    if (parts.length !== 4) return null;
    const [role, userId, ts, sig] = parts;
    if (role !== "user") return null;
    const expected = crypto.createHmac("sha256", TOKEN_SECRET).update(`${role}:${userId}:${ts}`).digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    return userId;
  } catch {
    return null;
  }
}

function getAuthenticatedUserId(req) {
  const headers = (req && req.headers) || {};
  const authHeader = headers["authorization"] || headers["x-user-token"] || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  return verifyUserToken(token);
}

// ----------------------------------------------------
// PRODUCT REVIEWS CRUD
// ----------------------------------------------------
async function getReviews(productId) {
  const pool = getPgPool();
  if (pool) {
    try {
      await ensurePgTables(pool);
      const { rows } = productId
        ? await pool.query("SELECT data FROM cc_reviews WHERE product_id = $1 ORDER BY created_at DESC", [String(productId)])
        : await pool.query("SELECT data FROM cc_reviews ORDER BY created_at DESC");
      return rows.map(r => r.data);
    } catch (err) {
      console.warn("Postgres getReviews fallback:", err.message);
    }
  }
  const store = readLocalStore();
  const list = store.reviews || [];
  return productId ? list.filter(r => String(r.product_id) === String(productId)) : list;
}

async function saveReview(reviewInput) {
  const review = {
    id: `rev-${Date.now()}`,
    product_id: String(reviewInput.product_id || "").trim(),
    author: String(reviewInput.author || "Verified Buyer").trim(),
    rating: Math.min(5, Math.max(1, Number(reviewInput.rating) || 5)),
    title: String(reviewInput.title || "").trim(),
    comment: String(reviewInput.comment || "").trim(),
    verified: Boolean(reviewInput.verified),
    created_at: new Date().toISOString()
  };

  const pool = getPgPool();
  if (pool) {
    try {
      await ensurePgTables(pool);
      await pool.query(
        "INSERT INTO cc_reviews (id, product_id, data, created_at) VALUES ($1, $2, $3, NOW())",
        [review.id, review.product_id, JSON.stringify(review)]
      );
      return review;
    } catch (err) {
      console.warn("Postgres saveReview fallback:", err.message);
    }
  }

  const store = readLocalStore();
  if (!Array.isArray(store.reviews)) store.reviews = [];
  store.reviews.unshift(review);
  writeLocalStore(store);
  return review;
}

function bumpVisitorCount() {
  const store = readLocalStore();
  store.visitor_count = (Number(store.visitor_count) || 148920) + 1;
  writeLocalStore(store);
  return store.visitor_count;
}

// ----------------------------------------------------
// ADMIN AUTHENTICATION
// ----------------------------------------------------
function generateAdminToken() {
  const payload = `admin:${Date.now()}`;
  const sig = crypto.createHmac("sha256", TOKEN_SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64");
}

function verifyAdminToken(token) {
  if (!token) return false;
  try {
    const decoded = Buffer.from(String(token), "base64").toString("utf8");
    const parts = decoded.split(":");
    if (parts.length !== 3) return false;
    const [role, ts, sig] = parts;
    if (role !== "admin") return false;
    const expected = crypto.createHmac("sha256", TOKEN_SECRET).update(`${role}:${ts}`).digest("hex");
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch (e) {
    return false;
  }
}

function isAuthorizedAdmin(req) {
  const headers = (req && req.headers) || {};
  const authHeader = headers["authorization"] || headers["x-admin-token"] || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  return verifyAdminToken(token);
}

function checkAdminPassword(inputPassword) {
  return String(inputPassword || "").trim() === ADMIN_PASSWORD;
}

function getSystemConfigStatus() {
  const hasPostgres = Boolean(process.env.POSTGRES_URL || process.env.DATABASE_URL);
  const hasRazorpayLive = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
  return {
    database_mode: hasPostgres ? "PostgreSQL (Production)" : "Serverless Persistent Engine (Ready)",
    razorpay_configured: hasRazorpayLive,
    razorpay_key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_CellCareDemoKey",
    razorpay_mode: hasRazorpayLive
      ? (String(process.env.RAZORPAY_KEY_ID).startsWith("rzp_live") ? "live" : "test")
      : "demo"
  };
}

module.exports = {
  getProducts,
  saveProduct,
  deleteProduct,
  syncProductsFromGoogleSheets,
  getOrders,
  getOrderById,
  saveOrder,
  decrementProductStock,
  getInquiries,
  saveInquiry,
  getUsers,
  findUserByEmail,
  findUserById,
  saveUser,
  hashPassword,
  verifyPassword,
  generateUserToken,
  getAuthenticatedUserId,
  getReviews,
  saveReview,
  bumpVisitorCount,
  generateAdminToken,
  isAuthorizedAdmin,
  checkAdminPassword,
  getSystemConfigStatus,
  normalizeProduct
};
