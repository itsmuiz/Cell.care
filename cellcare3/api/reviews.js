/**
 * CELL CARE INDIA — PRODUCT REVIEWS & VISITOR STATS API (/api/reviews)
 */

const db = require("./_db");

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    if (req.method === "GET") {
      const { product_id, visitor } = req.query || {};
      if (visitor === "1") {
        const count = db.bumpVisitorCount();
        return res.status(200).json({ ok: true, visitor_count: count });
      }
      const reviews = await db.getReviews(product_id);
      return res.status(200).json({ ok: true, total: reviews.length, reviews });
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      if (!body.product_id || !body.author || !body.comment) {
        return res.status(400).json({ ok: false, error: "Name, rating, and review comment are required." });
      }
      const saved = await db.saveReview({
        product_id: body.product_id,
        author: body.author,
        rating: body.rating,
        title: body.title || "",
        comment: body.comment,
        verified: Boolean(body.verified)
      });
      return res.status(201).json({ ok: true, review: saved, message: "Thank you! Your review has been published." });
    }

    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (err) {
    console.error("API /api/reviews error:", err);
    return res.status(500).json({ ok: false, error: err.message || "Internal server error" });
  }
};
