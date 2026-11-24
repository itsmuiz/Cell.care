/**
 * CELL CARE INDIA — PUBLIC INQUIRIES & STATS API (/api/admin)
 * Note: Admin Panel login & dashboard routes are disabled for now (ADMIN_PANEL_ENABLED = false).
 * Public contact, training, and startup consultation inquiry submissions remain active.
 */

const db = require("./_db");

const ADMIN_PANEL_ENABLED = false;

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    if (req.method === "GET") {
      const { view } = req.query || {};

      // Public homepage stats (still allowed)
      if (view === "public_stats") {
        const orders = await db.getOrders();
        return res.status(200).json({
          ok: true,
          stats: {
            years_experience: 5,
            batteries_sold: 1000 + orders.length,
            distributors: 20,
            employees: 70
          }
        });
      }

      if (!ADMIN_PANEL_ENABLED) {
        return res.status(403).json({ ok: false, error: "Admin panel is currently disabled." });
      }

      if (!db.isAuthorizedAdmin(req)) {
        return res.status(401).json({ ok: false, error: "Admin login required." });
      }

      const products = await db.getProducts();
      const orders = await db.getOrders();
      const inquiries = await db.getInquiries();
      return res.status(200).json({ ok: true, orders, inquiries, total_products: products.length });
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const action = body.action || "";

      // 1. Public Contact / Training / Consultation Inquiry Submission (kept active)
      if (action === "submit_inquiry") {
        if (!body.name || !body.phone) {
          return res.status(400).json({ ok: false, error: "Name and phone number are required." });
        }
        const saved = await db.saveInquiry(body);
        return res.status(201).json({
          ok: true,
          inquiry: saved,
          message: "Your inquiry has been logged in our system."
        });
      }

      // 2. Admin Login (disabled when ADMIN_PANEL_ENABLED = false)
      if (action === "login") {
        if (!ADMIN_PANEL_ENABLED) {
          return res.status(403).json({ ok: false, error: "Admin panel is currently disabled." });
        }
        if (!db.checkAdminPassword(body.password)) {
          return res.status(401).json({ ok: false, error: "Invalid Admin Password." });
        }
        const token = db.generateAdminToken();
        return res.status(200).json({ ok: true, token });
      }

      return res.status(400).json({ ok: false, error: "Invalid action." });
    }

    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (err) {
    console.error("API /api/admin error:", err);
    return res.status(500).json({ ok: false, error: err.message || "Internal server error" });
  }
};
