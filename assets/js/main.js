// Simple JS: mobile menu + year
const toggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.nav');
if (toggle && nav){
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
}
const y = document.getElementById('year');
if (y){ y.textContent = new Date().getFullYear(); }
