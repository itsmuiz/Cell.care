/* Cell Care API configuration
 * Product catalogue is powered by Google Sheets via Google Apps Script.
 * Keep the main site backend separate because config/contact/stats still use it.
 */
window.CELLCARE_API = {
  // Existing backend for site config, contact form, stats, etc.
  site: "https://artifyscreens.pythonanywhere.com",

  // Google Sheets -> Apps Script product API.
  // Use the deployed /exec URL, never the googleusercontent.com/macros/echo URL.
  products: "https://script.google.com/macros/s/AKfycbzPASrJpC5dvoFX-R6zX1AfW-pFyg8DIM6D_p9DG4QSI16qyymFXzibseq1rA9r_f-j2g/exec"
};

// Convenient global aliases for pages/scripts that need them.
window.PRODUCTS_API_URL = window.CELLCARE_API.products;
