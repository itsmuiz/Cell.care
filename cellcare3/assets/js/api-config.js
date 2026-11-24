/**
 * Cell Care India — Master Dynamic E-Commerce Configuration (v4.0)
 * Connects Frontend to Vercel Serverless APIs (/api/*) + Razorpay Checkout + Database
 */
window.CELLCARE_CONFIG = {
  // Primary Dynamic Backend APIs on Vercel
  productsApi: "/api/products",
  ordersApi: "/api/orders",
  paymentApi: "/api/payment",
  adminApi: "/api/admin",

  // Legacy Google Sheets API (used by backend sync & offline fallback)
  gsheetProductsApi: "https://script.google.com/macros/s/AKfycbzPASrJpC5dvoFX-R6zX1AfW-pFyg8DIM6D_p9DG4QSI16qyymFXzibseq1rA9r_f-j2g/exec",

  // Verified official business contact details and social handles
  fallback: {
    phone: "+91 85059 10581",
    whatsapp: "918505910581",
    email: "CellCareIndia2025@gmail.com",
    supportEmail: "sales@cellcareindia.com",
    address: "Shop No. 4, B-32, New Brij Puri, Near Jagatpuri Police Station, New Delhi - 110051",
    freeShippingThreshold: 15000,
    stats: {
      years_experience: 5,
      batteries_sold: 1000,
      employees: 70,
      distributors: 20
    },
    social: {
      linkedin: "https://www.linkedin.com/in/cell-care-india-931736398",
      facebook: "https://www.facebook.com/profile.php?id=61567162763508&mibextid=ZbWKwL",
      instagram: "https://instagram.com/cellcare_india"
    }
  },

  // Cache configuration
  cacheDurationMs: 5 * 60 * 1000
};

// Global aliases for catalog access
window.PRODUCTS_API_URL = window.CELLCARE_CONFIG.productsApi;
window.CATALOG_API_URL = window.CELLCARE_CONFIG.productsApi;
window.CELLCARE_API = {
  products: window.CELLCARE_CONFIG.productsApi,
  orders: window.CELLCARE_CONFIG.ordersApi,
  payment: window.CELLCARE_CONFIG.paymentApi,
  admin: window.CELLCARE_CONFIG.adminApi
};
