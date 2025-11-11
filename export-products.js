const XLSX = require('xlsx');
const fs = require('fs');

// Load products from a JSON file or use default data
let products = [];
try {
  const data = fs.readFileSync('products.json', 'utf8');
  products = JSON.parse(data);
} catch (err) {
  // Use default data if file doesn't exist
  products = [
    { name: "iPhone 13 Battery", price: "₹3,499", desc: "Original lithium-ion replacement battery for iPhone 13.", icon: "fa-battery-full" },
    { name: "Samsung Galaxy S22 Battery", price: "₹3,799", desc: "High-capacity battery for Samsung S22 with long life.", icon: "fa-bolt" },
    { name: "EV Bike Battery 48V", price: "₹8,999", desc: "Powerful lithium battery pack for e-bikes and scooters.", icon: "fa-bicycle" },
    { name: "Solar Inverter Battery", price: "₹12,499", desc: "Efficient backup battery for solar setups.", icon: "fa-sun" },
    { name: "Universal Charger", price: "₹799", desc: "Compact fast charger compatible with most battery types.", icon: "fa-charging-station" },
  ];
}

// Prepare data for Excel
const data = products.map(product => ({
  'Product Name': product.name,
  'Product Description': product.desc,
  'Product Price': product.price,
  'Product Icon': product.icon,
  'Product Pic': product.pic || 'N/A'
}));

// Create a new workbook
const wb = XLSX.utils.book_new();

// Convert data to worksheet
const ws = XLSX.utils.json_to_sheet(data);

// Add worksheet to workbook
XLSX.utils.book_append_sheet(wb, ws, 'Products');

// Write the file
XLSX.writeFile(wb, 'products.xlsx');

console.log('Products exported to products.xlsx');
