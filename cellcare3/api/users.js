/**
 * CELL CARE INDIA — CUSTOMER ACCOUNTS & PROFILE API (/api/users)
 * Handles registration, login, profile updates, saved address, wishlist sync, and order history.
 */

const db = require("./_db");

function sanitizeUser(u) {
  if (!u) return null;
  const { password_hash, ...safe } = u;
  return safe;
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // GET: Current authenticated customer profile + matching orders
    if (req.method === "GET") {
      const userId = db.getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ ok: false, error: "Not signed in." });
      }
      const user = await db.findUserById(userId);
      if (!user) {
        return res.status(404).json({ ok: false, error: "Account not found." });
      }
      const allOrders = await db.getOrders();
      const userPhone = String(user.phone || "").replace(/\D/g, "").slice(-10);
      const userEmail = String(user.email || "").toLowerCase();
      const orders = allOrders.filter(o => {
        const oPhone = String(o.customer?.phone || "").replace(/\D/g, "").slice(-10);
        const oEmail = String(o.customer?.email || "").toLowerCase();
        return (userEmail && oEmail === userEmail) || (userPhone.length === 10 && oPhone === userPhone);
      });

      return res.status(200).json({
        ok: true,
        user: sanitizeUser(user),
        orders
      });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});

    // POST: register, login, forgot_password
    if (req.method === "POST") {
      const action = String(body.action || "login").toLowerCase();

      if (action === "register") {
        const name = String(body.name || "").trim();
        const email = String(body.email || "").trim().toLowerCase();
        const phone = String(body.phone || "").replace(/\D/g, "").slice(-10);
        const password = String(body.password || "");

        if (!name || name.length < 2) {
          return res.status(400).json({ ok: false, error: "Please enter your full name." });
        }
        if (!email || !email.includes("@")) {
          return res.status(400).json({ ok: false, error: "Please enter a valid email address." });
        }
        if (password.length < 6) {
          return res.status(400).json({ ok: false, error: "Password must be at least 6 characters." });
        }

        const existing = await db.findUserByEmail(email);
        if (existing) {
          return res.status(409).json({ ok: false, error: "An account with this email already exists. Please log in." });
        }

        const created = await db.saveUser({
          name,
          email,
          phone,
          password_hash: db.hashPassword(password),
          address: String(body.address || "").trim(),
          city: String(body.city || "").trim(),
          state: String(body.state || "").trim(),
          pincode: String(body.pincode || "").trim(),
          wishlist: Array.isArray(body.wishlist) ? body.wishlist : []
        });

        const token = db.generateUserToken(created.id);
        return res.status(201).json({
          ok: true,
          token,
          user: sanitizeUser(created),
          message: "Account created successfully! Welcome to Cell Care India."
        });
      }

      if (action === "login") {
        const identifier = String(body.email || body.username || "").trim().toLowerCase();
        const password = String(body.password || "");

        if (!identifier || !password) {
          return res.status(400).json({ ok: false, error: "Please enter your email and password." });
        }

        const users = await db.getUsers();
        const user = users.find(
          u =>
            String(u.email || "").toLowerCase() === identifier ||
            String(u.phone || "").replace(/\D/g, "").slice(-10) === identifier.replace(/\D/g, "").slice(-10)
        );

        if (!user || !db.verifyPassword(password, user.password_hash)) {
          return res.status(401).json({ ok: false, error: "Invalid email/phone or password." });
        }

        const token = db.generateUserToken(user.id);
        return res.status(200).json({
          ok: true,
          token,
          user: sanitizeUser(user),
          message: `Welcome back, ${user.name}!`
        });
      }

      if (action === "forgot_password") {
        const email = String(body.email || "").trim().toLowerCase();
        if (!email || !email.includes("@")) {
          return res.status(400).json({ ok: false, error: "Enter a valid registered email address." });
        }
        return res.status(200).json({
          ok: true,
          message: `If an account exists for ${email}, password reset instructions have been queued. You can also contact WhatsApp Support at +91 85059 10581.`
        });
      }

      return res.status(400).json({ ok: false, error: "Unknown action." });
    }

    // PUT: Update profile, address, or wishlist
    if (req.method === "PUT") {
      const userId = db.getAuthenticatedUserId(req);
      if (!userId) {
        return res.status(401).json({ ok: false, error: "Please log in to update your profile." });
      }
      const user = await db.findUserById(userId);
      if (!user) {
        return res.status(404).json({ ok: false, error: "User not found." });
      }

      const updated = {
        ...user,
        name: body.name !== undefined ? String(body.name).trim() : user.name,
        phone: body.phone !== undefined ? String(body.phone).replace(/\D/g, "").slice(-10) : user.phone,
        address: body.address !== undefined ? String(body.address).trim() : user.address,
        city: body.city !== undefined ? String(body.city).trim() : user.city,
        state: body.state !== undefined ? String(body.state).trim() : user.state,
        pincode: body.pincode !== undefined ? String(body.pincode).trim() : user.pincode,
        gstin: body.gstin !== undefined ? String(body.gstin).trim().toUpperCase() : user.gstin,
        wishlist: Array.isArray(body.wishlist) ? body.wishlist : user.wishlist
      };

      if (body.new_password && String(body.new_password).length >= 6) {
        updated.password_hash = db.hashPassword(body.new_password);
      }

      const saved = await db.saveUser(updated);
      return res.status(200).json({
        ok: true,
        user: sanitizeUser(saved),
        message: "Profile updated successfully."
      });
    }

    return res.status(405).json({ ok: false, error: "Method not allowed." });
  } catch (err) {
    console.error("API /api/users error:", err);
    return res.status(500).json({ ok: false, error: err.message || "Internal server error" });
  }
};
