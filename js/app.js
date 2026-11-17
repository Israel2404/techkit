/* =========================================================
   app.js - Router por hash y arranque de la aplicación
   Ruta "#/json" -> busca el módulo en ROUTES y lo monta en <main>.
   ========================================================= */
const ROUTES = { ...Tools, ...Comandos, bitacora: Bitacora };
const DEFAULT_ROUTE = 'json';

function router() {
  const name = location.hash.replace('#/', '') || DEFAULT_ROUTE;
  const view = ROUTES[name] || ROUTES[DEFAULT_ROUTE];
  const app = document.getElementById('app');

  // Se reemplaza el contenedor completo para soltar los listeners de la vista anterior
  const fresh = app.cloneNode(false);
  app.replaceWith(fresh);

  fresh.innerHTML = `
    <header class="view-header">
      <h1>${view.title}</h1>
      <p>${view.desc}</p>
    </header>
    <section class="view-body">${view.html()}</section>`;
  view.mount(fresh);

  // Marca el enlace activo en la barra lateral
  document.querySelectorAll('.nav a').forEach(a =>
    a.classList.toggle('active', a.dataset.route === name));

  document.title = `${view.title} · TechKit`;
  fresh.focus();
}

/* ---------- Tema claro / oscuro con preferencia guardada ---------- */
function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem('techkit-theme'); } catch {}
  if (saved) document.documentElement.dataset.theme = saved;

  document.getElementById('themeToggle').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('techkit-theme', next); } catch {}
    window.dispatchEvent(new Event('themechange'));   // avisa a las gráficas para redibujarse
  });
}

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', () => {
  initTheme();
  router();
});
