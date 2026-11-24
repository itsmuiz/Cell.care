/**
 * CELL CARE INDIA — LIVE GOOGLE SHEETS PRODUCTS API (/api/products)
 * Single source of truth: fetches products dynamically from the live Google Sheets
 * Apps Script API, caches for 60s to avoid redundant calls, deduplicates rows,
 * filters blank spreadsheet rows, and supports search, category/brand filtering & sorting.
 */

const GSHEET_API_URL =
  process.env.GSHEET_PRODUCTS_API ||
  "https://script.google.com/macros/s/AKfycbzPASrJpC5dvoFX-R6zX1AfW-pFyg8DIM6D_p9DG4QSI16qyymFXzibseq1rA9r_f-j2g/exec";

const CACHE_TTL_MS = 60 * 1000; // 60 seconds smart cache
let memoryCache = {
  items: null,
  fetchedAt: 0
};

function slugify(str) {
  return String(str || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function formatCategoryLabel(raw) {
  const c = String(raw || "").trim();
  if (!c) return "General";
  if (c.toLowerCase() === "ather") return "Ather";
  if (c.toLowerCase() === "ola") return "OLA";
  if (c.toLowerCase() === "spare parts") return "Spare Parts";
  return c;
}

function normalizeSheetItem(raw, idx) {
  if (!raw || !raw.title || !String(raw.title).trim()) return null;

  const status = String(raw.status || "Active").trim();
  if (status && status.toLowerCase() !== "active") return null;

  const title = String(raw.title).trim();
  const id = String(raw.id !== undefined && raw.id !== "" ? raw.id : idx + 1).trim();
  const rawSku = raw.sku !== undefined && raw.sku !== null ? String(raw.sku).trim() : "";
  const sku = rawSku || `CC-${id}`;
  const category = formatCategoryLabel(raw.category);
  const brand = String(raw.brand || "CellCare").trim() || "CellCare";
  const price = Number(raw.price) || 0;
  const minQty = Math.max(1, parseInt(raw.min_quantity || 1, 10) || 1);
  const available = raw.available !== false && String(raw.available).toLowerCase() !== "false";

  // Clean out legacy COD wording if present in spreadsheet notes so UI stays consistent
  const rawDesc = String(raw.description || "").trim();
  const cleanDesc = rawDesc.replace(/no\s+cod\s*,?\s*/gi, "").trim() || title;

  return {
    id,
    sku,
    slug: `${slugify(title)}-${id}`,
    title,
    category,
    category_slug: slugify(category),
    brand,
    brands: [brand],
    description: cleanDesc,
    price,
    available,
    min_quantity: minQty,
    image_url: String(raw.image_url || "").trim(),
    gallery: raw.image_url ? [String(raw.image_url).trim()] : [],
    status
  };
}

async function fetchLiveSheetProducts(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && memoryCache.items && now - memoryCache.fetchedAt < CACHE_TTL_MS) {
    return memoryCache.items;
  }

  // Fetch all pages from Google Apps Script (page_size=100 per call)
  const collected = [];
  let page = 1;
  let totalExpected = Infinity;
  const maxPages = 10;

  while (collected.length < totalExpected && page <= maxPages) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const sep = GSHEET_API_URL.includes("?") ? "&" : "?";
      const res = await fetch(`${GSHEET_API_URL}${sep}page=${page}&page_size=100`, {
        redirect: "follow",
        signal: controller.signal
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`Google Sheets API HTTP ${res.status}`);
      const data = await res.json();
      const batch = Array.isArray(data) ? data : (data.items || data.results || []);
      if (!Array.isArray(batch) || batch.length === 0) break;

      collected.push(...batch);
      if (typeof data.total === "number") {
        totalExpected = data.total;
      } else {
        break;
      }
      if (batch.length < 100) break;
      page++;
    } catch (err) {
      clearTimeout(timer);
      if (memoryCache.items) {
        return memoryCache.items; // Serve stale cache on transient Google timeout
      }
      throw err;
    }
  }

  // Normalize, filter blank rows, and deduplicate by id / title+sku
  const seenIds = new Set();
  const seenSignatures = new Set();
  const cleanProducts = [];

  collected.forEach((row, idx) => {
    const norm = normalizeSheetItem(row, idx);
    if (!norm) return;
    const sig = `${norm.title.toLowerCase()}::${norm.sku.toLowerCase()}`;
    if (seenIds.has(norm.id) || seenSignatures.has(sig)) return;
    seenIds.add(norm.id);
    seenSignatures.add(sig);
    cleanProducts.push(norm);
  });

  memoryCache = {
    items: cleanProducts,
    fetchedAt: Date.now()
  };

  return cleanProducts;
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({
      ok: false,
      error: "Products are managed directly via Google Sheets. Update the sheet to reflect changes."
    });
  }

  try {
    const {
      id,
      slug,
      category,
      brand,
      q,
      min_price,
      max_price,
      in_stock,
      sort,
      refresh
    } = req.query || {};

    const allProducts = await fetchLiveSheetProducts(refresh === "1");

    // Single product lookup
    if (id || slug) {
      const target = String(id || slug).toLowerCase().trim();
      const found = allProducts.find(
        p =>
          String(p.id).toLowerCase() === target ||
          String(p.slug).toLowerCase() === target ||
          String(p.sku).toLowerCase() === target
      );
      if (!found) {
        return res.status(404).json({ ok: false, error: "Product not found." });
      }
      return res.status(200).json({ ok: true, item: found });
    }

    let products = [...allProducts];

    // Filter by category
    if (category && category !== "all" && category !== "0") {
      const catNorm = String(category).toLowerCase().trim();
      products = products.filter(
        p =>
          p.category.toLowerCase() === catNorm ||
          p.category_slug === catNorm ||
          p.category.toLowerCase().includes(catNorm.replace(/-/g, " "))
      );
    }

    // Filter by brand (comma-separated supported)
    if (brand) {
      const wanted = String(brand)
        .toLowerCase()
        .split(",")
        .map(s => s.trim())
        .filter(Boolean);
      if (wanted.length) {
        products = products.filter(p =>
          wanted.some(w => p.brand.toLowerCase().includes(w))
        );
      }
    }

    // Filter by availability
    if (in_stock === "1" || in_stock === "true") {
      products = products.filter(p => p.available);
    }

    // Filter by price range
    if (min_price !== undefined && min_price !== "") {
      products = products.filter(p => p.price >= Number(min_price));
    }
    if (max_price !== undefined && max_price !== "") {
      products = products.filter(p => p.price <= Number(max_price));
    }

    // Search query
    if (q) {
      const query = String(q).toLowerCase().trim();
      products = products.filter(
        p =>
          p.title.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query) ||
          p.category.toLowerCase().includes(query) ||
          p.brand.toLowerCase().includes(query) ||
          p.sku.toLowerCase().includes(query)
      );
    }

    // Sorting
    switch (String(sort || "")) {
      case "price-asc":
        products.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        products.sort((a, b) => b.price - a.price);
        break;
      case "name-asc":
        products.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "newest":
        products.sort((a, b) => Number(b.id) - Number(a.id));
        break;
    }

    // Dynamic categories & brands from full live sheet
    const catCounts = {};
    const brandCounts = {};
    allProducts.forEach(p => {
      catCounts[p.category] = (catCounts[p.category] || 0) + 1;
      if (p.brand) brandCounts[p.brand] = (brandCounts[p.brand] || 0) + 1;
    });

    const categories = Object.entries(catCounts).map(([name, count]) => ({
      name,
      slug: slugify(name),
      count
    }));

    const brands = Object.entries(brandCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return res.status(200).json({
      ok: true,
      source: "google_sheets_live",
      total: products.length,
      catalog_total: allProducts.length,
      categories,
      brands,
      items: products,
      results: products
    });
  } catch (err) {
    console.error("API /api/products Google Sheets error:", err);
    return res.status(502).json({
      ok: false,
      error: "Unable to load live products from Google Sheets right now. Please retry shortly."
    });
  }
};
