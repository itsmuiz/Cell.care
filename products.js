// ======= GSAP Animations for Products Page =======

// Page Load Animations
gsap.from(".section-title", {
  duration: 1,
  y: 40,
  opacity: 0,
  ease: "power3.out"
});

gsap.from(".section-subtitle", {
  duration: 1,
  y: 30,
  opacity: 0,
  delay: 0.2,
  ease: "power3.out"
});

gsap.from(".product-controls", {
  duration: 1,
  y: 20,
  opacity: 0,
  delay: 0.4,
  ease: "power3.out"
});

// Animate products when they first render
function animateProducts() {
  // Clear old scroll triggers to prevent duplicate animations
  if (gsap.core.globals().ScrollTrigger) {
    ScrollTrigger.getAll().forEach(trigger => trigger.kill());
  }

  // Reset product cards opacity (important for re-render)
  gsap.set(".product-card", { opacity: 0, y: 30 });

  // Base staggered fade-in when rendered
  gsap.to(".product-card", {
    duration: 0.8,
    opacity: 1,
    y: 0,
    stagger: 0.15,
    ease: "power3.out"
  });

  // Scroll-triggered reveal (optional enhancement)
  gsap.utils.toArray(".product-card").forEach((card, i) => {
    gsap.from(card, {
      scrollTrigger: {
        trigger: card,
        start: "top 85%",
      },
      duration: 0.8,
      opacity: 0,
      y: 30,
      delay: i * 0.1,
      ease: "power3.out"
    });
  });
}


// Run initial animation
animateProducts();

// Re-run animation after search
document.getElementById("searchBar").addEventListener("input", (e) => {
  const query = e.target.value.toLowerCase();
  const filtered = products.filter((p) => p.name.toLowerCase().includes(query));
  renderProducts(filtered);
  animateProducts(); // run fresh animation for new results
});



// Smooth Page Transition In
window.onload = () => {
  gsap.from("body", {
    duration: 0.6,
    opacity: 0,
    ease: "power2.inOut"
  });
};

// Smooth Page Transition Out (optional)
document.querySelectorAll("a").forEach(link => {
  link.addEventListener("click", (e) => {
    const href = link.getAttribute("href");
    if (href && !href.startsWith("#") && !href.startsWith("javascript")) {
      e.preventDefault();
      gsap.to("body", {
        duration: 0.5,
        opacity: 0,
        ease: "power2.inOut",
        onComplete: () => (window.location = href)
      });
    }
  });
});

// Load products from localStorage or use default data
let products = JSON.parse(localStorage.getItem('products')) || [
  { name: "iPhone 13 Battery", price: "₹3,499", desc: "Original lithium-ion replacement battery for iPhone 13.", icon: "fa-battery-full" },
  { name: "Samsung Galaxy S22 Battery", price: "₹3,799", desc: "High-capacity battery for Samsung S22 with long life.", icon: "fa-bolt" },
  { name: "EV Bike Battery 48V", price: "₹8,999", desc: "Powerful lithium battery pack for e-bikes and scooters.", icon: "fa-bicycle" },
  { name: "Solar Inverter Battery", price: "₹12,499", desc: "Efficient backup battery for solar setups.", icon: "fa-sun" },
  { name: "Universal Charger", price: "₹799", desc: "Compact fast charger compatible with most battery types.", icon: "fa-charging-station" },
];

// Function to save products to localStorage
function saveProducts() {
  localStorage.setItem('products', JSON.stringify(products));
}

// Function to add a new product
function addProduct(name, price, desc, icon) {
  const newProduct = { name, price, desc, icon };
  products.push(newProduct);
  saveProducts();
  renderProducts(products);
  animateProducts();
}

// RENDER PRODUCTS
function renderProducts(list) {
  const container = document.getElementById("productsContainer");
  container.innerHTML = "";
  list.forEach((p) => {
    container.innerHTML += `
      <div class="product-card tilt">
        <div class="product-icon"><i class="fa-solid ${p.icon}"></i></div>
        <h3 class="product-title">${p.name}</h3>
        <p class="product-description">${p.desc}</p>
        <div class="product-footer">
          <span class="product-price">${p.price}</span>
          <button class="whatsapp-btn" onclick="orderOnWhatsApp('${p.name}', '${p.price}')">
            <i class="fa-brands fa-whatsapp"></i> Order Now
          </button>
        </div>
      </div>`;
  });
//   VanillaTilt.init(document.querySelectorAll(".tilt"), { max: 25, speed: 400 });
}

renderProducts(products);

// SEARCH FUNCTIONALITY
document.getElementById("searchBar").addEventListener("input", (e) => {
  const query = e.target.value.toLowerCase();
  const filtered = products.filter((p) => p.name.toLowerCase().includes(query));
  renderProducts(filtered);
});

// WhatsApp Integration
function orderOnWhatsApp(productName, price) {
  const phoneNumber = "919891504882"; // Replace with your WhatsApp number
  const message = `Hello! I'm interested in ordering \n \n ${productName} \t (${price}).`;
  const url = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank");
}

// Add Product Form Functionality
document.getElementById("addProductBtn").addEventListener("click", () => {
  document.getElementById("addProductForm").style.display = "block";
});

document.getElementById("cancelAdd").addEventListener("click", () => {
  document.getElementById("addProductForm").style.display = "none";
  clearForm();
});

document.getElementById("submitProduct").addEventListener("click", () => {
  const name = document.getElementById("productName").value.trim();
  const price = document.getElementById("productPrice").value.trim();
  const desc = document.getElementById("productDesc").value.trim();
  const icon = document.getElementById("productIcon").value.trim();

  if (name && price && desc && icon) {
    addProduct(name, price, desc, icon);
    document.getElementById("addProductForm").style.display = "none";
    clearForm();
  } else {
    alert("Please fill in all fields.");
  }
});

function clearForm() {
  document.getElementById("productName").value = "";
  document.getElementById("productPrice").value = "";
  document.getElementById("productDesc").value = "";
  document.getElementById("productIcon").value = "";
}
