// Get the button:
let mybutton = document.getElementById("myBtn");

// Footer copyright year
document.getElementById("year").textContent = new Date().getFullYear();

// When the user scrolls down 20px from the top of the document, show the button.
// Only touch the DOM when the visibility actually changes.
let buttonVisible = false;
window.addEventListener("scroll", scrollFunction, { passive: true });
scrollFunction();

function scrollFunction() {
  let shouldShow = window.scrollY > 20;
  if (shouldShow !== buttonVisible) {
    buttonVisible = shouldShow;
    mybutton.style.display = shouldShow ? "block" : "none";
  }
}

// When the user clicks on the button, scroll to the top of the document
function topFunction() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}
