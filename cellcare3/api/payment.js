/**
 * CELL CARE INDIA — DELIVERY PINCODE & COUPON UTILITY API (/api/payment)
 * Note: Razorpay gateway is temporarily disabled (RAZORPAY_ENABLED = false).
 * Structure preserved for future re-integration without exposing keys or secrets.
 * Cash on Delivery (COD) is completely disabled.
 */

const RAZORPAY_ENABLED = false;

const COUPONS = {
  CELLCARE5: { code: "CELLCARE5", type: "percent", value: 5, minOrder: 5000, description: "5% Direct Factory Discount" },
  WELCOME500: { code: "WELCOME500", type: "flat", value: 500, minOrder: 10000, description: "₹500 Discount on ₹10,000+" },
  B2BBULK: { code: "B2BBULK", type: "percent", value: 8, minOrder: 50000, description: "8% B2B Wholesale Discount on ₹50,000+" }
};

function getPincodeEstimate(pincode) {
  const clean = String(pincode || "").replace(/\D/g, "");
  if (clean.length !== 6) {
    return { valid: false, error: "Please enter a valid 6-digit Indian Pincode." };
  }
  const prefix = parseInt(clean.substring(0, 2), 10);
  let zone = "Pan-India Surface Express";
  let days = "4–6 Working Days";

  if (prefix >= 11 && prefix <= 13) {
    zone = "Delhi NCR & Haryana Express";
    days = "1–2 Working Days (Direct Dispatch)";
  } else if (prefix >= 14 && prefix <= 34) {
    zone = "North & West Zone (Punjab, UP, Rajasthan, Gujarat)";
    days = "2–4 Working Days";
  } else if (prefix >= 40 && prefix <= 49) {
    zone = "Western & Central Hub (Maharashtra, MP)";
    days = "3–5 Working Days";
  } else if (prefix >= 50 && prefix <= 69) {
    zone = "Southern EV Hub (Karnataka, TN, Telangana, Kerala)";
    days = "4–6 Working Days";
  } else if (prefix >= 70 && prefix <= 85) {
    zone = "Eastern Zone (WB, Bihar, Odisha, Northeast)";
    days = "4–6 Working Days";
  }

  return {
    valid: true,
    pincode: clean,
    zone,
    estimated_delivery: days,
    courier_partners: "Delhivery Surface / BlueDart / VRL Logistics"
  };
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const action = String(body.action || "").trim();

    if (action === "check_pincode") {
      const result = getPincodeEstimate(body.pincode);
      if (!result.valid) {
        return res.status(400).json({ ok: false, error: result.error });
      }
      return res.status(200).json({ ok: true, ...result });
    }

    if (action === "apply_coupon") {
      const code = String(body.code || "").trim().toUpperCase();
      const subtotal = Number(body.subtotal) || 0;
      const coupon = COUPONS[code];

      if (!coupon) {
        return res.status(400).json({
          ok: false,
          error: "Invalid coupon code. Try CELLCARE5, WELCOME500, or B2BBULK."
        });
      }
      if (subtotal < coupon.minOrder) {
        return res.status(400).json({
          ok: false,
          error: `Coupon ${code} requires a minimum order of ₹${coupon.minOrder.toLocaleString("en-IN")}.`
        });
      }
      const discount =
        coupon.type === "percent" ? Math.round((subtotal * coupon.value) / 100) : coupon.value;

      return res.status(200).json({
        ok: true,
        code: coupon.code,
        discount,
        description: coupon.description,
        message: `Applied ${coupon.code}: Saved ₹${discount.toLocaleString("en-IN")}!`
      });
    }

    // Razorpay endpoints disabled for now — preserved cleanly for future re-integration
    if (action === "create_order" || action === "verify" || action === "verify_payment") {
      if (!RAZORPAY_ENABLED) {
        return res.status(503).json({
          ok: false,
          disabled: true,
          error: "Online payment gateway is temporarily disabled. Please complete your order via WhatsApp (+91 8505910581)."
        });
      }
    }

    return res.status(400).json({ ok: false, error: "Invalid action." });
  } catch (err) {
    console.error("API /api/payment error:", err);
    return res.status(500).json({ ok: false, error: err.message || "Server error" });
  }
};
