/**
 * CELL CARE INDIA — WHATSAPP ORDER ENQUIRY & TRACKING API (/api/orders)
 * Note: Cash on Delivery (COD) is completely disabled.
 * Razorpay online gateway is temporarily disabled; all orders flow via WhatsApp Enquiry (+91 8505910581).
 */

const db = require("./_db");

const VALID_COUPONS = {
  CELLCARE5: { code: "CELLCARE5", type: "percent", value: 5, minOrder: 5000, label: "5% Direct Factory Discount" },
  WELCOME500: { code: "WELCOME500", type: "flat", value: 500, minOrder: 10000, label: "₹500 Instant Welcome Discount" },
  B2BBULK: { code: "B2BBULK", type: "percent", value: 8, minOrder: 50000, label: "8% B2B Wholesale Tier Discount" }
};

function calculateOrderPricing(items, couponCode) {
  let subtotal = 0;
  const cleanItems = (Array.isArray(items) ? items : []).map(it => {
    const price = Math.max(0, Number(it.price) || 0);
    const qty = Math.max(1, parseInt(it.qty || 1, 10));
    const lineTotal = price * qty;
    subtotal += lineTotal;
    return {
      id: String(it.id || it.slug || it.title),
      sku: String(it.sku || ""),
      title: String(it.title || "Product"),
      price,
      qty,
      line_total: lineTotal,
      image_url: it.image_url || "",
      product_url: it.product_url || ""
    };
  });

  let discount = 0;
  let appliedCoupon = null;
  if (couponCode) {
    const normCode = String(couponCode).trim().toUpperCase();
    const c = VALID_COUPONS[normCode];
    if (c && subtotal >= c.minOrder) {
      discount = c.type === "percent" ? Math.round((subtotal * c.value) / 100) : c.value;
      appliedCoupon = c.code;
    }
  }

  const total = Math.max(0, subtotal - discount);

  return {
    cleanItems,
    pricing: {
      subtotal,
      discount,
      coupon_code: appliedCoupon,
      shipping: 0,
      total
    }
  };
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // GET: Customer Order Tracking OR Admin Order List
    if (req.method === "GET") {
      const { order_id, id, phone } = req.query || {};
      const lookupId = order_id || id;

      if (lookupId || phone) {
        const allOrders = await db.getOrders();
        const cleanOrderId = String(lookupId || "").trim().toUpperCase();
        const cleanPhone = String(phone || "").replace(/\D/g, "").slice(-10);

        const matches = allOrders.filter(o => {
          const idMatch = cleanOrderId && String(o.order_id || "").toUpperCase() === cleanOrderId;
          const oPhone = String(o.customer?.phone || "").replace(/\D/g, "").slice(-10);
          const phoneMatch = cleanPhone && cleanPhone.length === 10 && oPhone === cleanPhone;
          return idMatch || phoneMatch;
        });

        if (!matches.length) {
          return res.status(404).json({
            ok: false,
            error: "No matching order found. Please check your Order ID or 10-digit Mobile Number."
          });
        }

        return res.status(200).json({ ok: true, order: matches[0], orders: matches });
      }

      if (!db.isAuthorizedAdmin(req)) {
        return res.status(401).json({ ok: false, error: "Admin authorization required." });
      }

      const orders = await db.getOrders();
      return res.status(200).json({ ok: true, total: orders.length, orders });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});

    // POST: Create WhatsApp Order Enquiry (COD & Razorpay disabled)
    if (req.method === "POST") {
      const { customer, items, payment_method, coupon_code, notes } = body;
      const method = String(payment_method || "whatsapp").toLowerCase().trim();

      if (method === "cod" || method === "cash_on_delivery") {
        return res.status(400).json({
          ok: false,
          error: "Cash on Delivery is not available. Please submit your order via WhatsApp Enquiry."
        });
      }

      if (method === "razorpay") {
        return res.status(400).json({
          ok: false,
          error: "Online payment gateway is temporarily unavailable. Please confirm your order on WhatsApp."
        });
      }

      if (!customer || !customer.name || !customer.phone) {
        return res.status(400).json({ ok: false, error: "Customer name and phone number are required." });
      }

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ ok: false, error: "Your cart is empty." });
      }

      const { cleanItems, pricing } = calculateOrderPricing(items, coupon_code);

      const newOrder = await db.saveOrder({
        customer: {
          name: String(customer.name).trim(),
          phone: String(customer.phone).replace(/\D/g, "").slice(-10),
          email: String(customer.email || "").trim(),
          address: String(customer.address || "").trim(),
          city: String(customer.city || "").trim(),
          state: String(customer.state || "").trim(),
          pincode: String(customer.pincode || "").trim(),
          gstin: String(customer.gstin || "").trim().toUpperCase()
        },
        items: cleanItems,
        pricing,
        payment_method: "whatsapp",
        payment_status: "whatsapp_enquiry",
        status: "placed",
        notes: String(notes || "").trim(),
        tracking: {
          courier: "Confirmed via WhatsApp",
          awb: "Pending Confirmation",
          estimated_delivery: "Confirmed on WhatsApp",
          notes: "Order enquiry sent to CellCare India WhatsApp desk (+91 8505910581)."
        }
      });

      return res.status(201).json({
        ok: true,
        order: newOrder,
        message: "Order enquiry logged. Redirecting to WhatsApp..."
      });
    }

    // PUT: Admin Order Status Update
    if (req.method === "PUT") {
      if (!db.isAuthorizedAdmin(req)) {
        return res.status(401).json({ ok: false, error: "Admin authorization required." });
      }
      const existing = await db.getOrderById(body.order_id);
      if (!existing) {
        return res.status(404).json({ ok: false, error: "Order not found." });
      }
      const updated = await db.saveOrder({
        ...existing,
        status: body.status || existing.status,
        payment_status: body.payment_status || existing.payment_status,
        tracking: { ...(existing.tracking || {}), ...(body.tracking || {}) }
      });
      return res.status(200).json({ ok: true, order: updated });
    }

    return res.status(405).json({ ok: false, error: "Method not allowed." });
  } catch (err) {
    console.error("API /api/orders error:", err);
    return res.status(500).json({ ok: false, error: err.message || "Internal server error" });
  }
};
