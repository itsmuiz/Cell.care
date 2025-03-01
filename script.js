// GSAP Animation
gsap.from(".hero-content h1", { duration: 1, y: 50, opacity: 0, ease: "power3.out" });
gsap.from(".hero-content p", { duration: 1, y: 30, opacity: 0, delay: 0.3, ease: "power3.out" });
gsap.from(".buttons", { duration: 1, y: 20, opacity: 0, delay: 0.6, ease: "power3.out" });
gsap.from(".hero-image", { duration: 1.5, scale: 0.8, opacity: 0, delay: 0.9, ease: "power3.out" });


function toggleMenu() {
    let menu = document.querySelector(".hamburger");
    let close = document.querySelector(".close-menu");
    let sidebar = document.querySelector(".sidebar");

    menu.addEventListener("click", () => {
        sidebar.classList.toggle("sidebar-active");
    })
    close.addEventListener("click", () => {
        sidebar.classList.remove("sidebar-active");
    })

}
toggleMenu();

VanillaTilt.init(document.querySelectorAll(".tilt"), {
    max: 25,
    speed: 400
});
