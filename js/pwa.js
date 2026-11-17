/* =========================================================
   pwa.js - Registro del Service Worker, instalación,
   indicador sin conexión y aviso de actualización (Sesión 3)
   ========================================================= */
(() => {
  const btnInstalar = document.getElementById('installBtn');
  const badgeOffline = document.getElementById('offlineBadge');
  const banner = document.getElementById('updateBanner');
  let promptInstalacion = null;

  /* ---------- 1. Registro del Service Worker ---------- */
  // Solo funciona en https:// o en localhost (contexto seguro)
  if ('serviceWorker' in navigator && window.isSecureContext) {
    window.addEventListener('load', async () => {
      try {
        const reg = await navigator.serviceWorker.register('sw.js');

        // Si ya hay una versión nueva esperando, avisa
        if (reg.waiting && navigator.serviceWorker.controller) mostrarActualizacion(reg.waiting);

        // Cuando se descarga una versión nueva del sw.js
        reg.addEventListener('updatefound', () => {
          const nuevo = reg.installing;
          nuevo.addEventListener('statechange', () => {
            if (nuevo.state === 'installed' && navigator.serviceWorker.controller) {
              mostrarActualizacion(nuevo);
            }
          });
        });
      } catch (err) {
        console.warn('No se pudo registrar el Service Worker:', err);
      }
    });

    // Cuando la versión nueva toma el control, recarga una sola vez
    let recargado = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (recargado) return;
      recargado = true;
      location.reload();
    });
  }

  function mostrarActualizacion(worker) {
    banner.hidden = false;
    banner.querySelector('button').onclick = () => worker.postMessage('SKIP_WAITING');
  }

  /* ---------- 2. Botón "Instalar app" ---------- */
  // El navegador lanza este evento cuando la app cumple los requisitos de PWA
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();          // evita el aviso automático
    promptInstalacion = e;       // se guarda para lanzarlo con nuestro botón
    btnInstalar.hidden = false;
  });

  btnInstalar.addEventListener('click', async () => {
    if (!promptInstalacion) return;
    promptInstalacion.prompt();
    const { outcome } = await promptInstalacion.userChoice;
    if (outcome === 'accepted') Utils.toast('Instalando TechKit…');
    promptInstalacion = null;
    btnInstalar.hidden = true;
  });

  window.addEventListener('appinstalled', () => {
    btnInstalar.hidden = true;
    Utils.toast('TechKit instalada');
  });

  // Ya abierta como app instalada: no mostrar el botón
  if (window.matchMedia('(display-mode: standalone)').matches) btnInstalar.hidden = true;

  /* ---------- 3. Indicador sin conexión ---------- */
  const actualizarConexion = () => { badgeOffline.hidden = navigator.onLine; };
  window.addEventListener('online', () => { actualizarConexion(); Utils.toast('Conexión restablecida'); });
  window.addEventListener('offline', actualizarConexion);
  actualizarConexion();
})();
