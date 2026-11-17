/* =========================================================
   utils.js - funciones compartidas por todos los módulos
   ========================================================= */
const Utils = {
  // Atajo para document.querySelector dentro de un contenedor
  $(sel, root = document) { return root.querySelector(sel); },
  $$(sel, root = document) { return [...root.querySelectorAll(sel)]; },

  // Escapa HTML para evitar inyección (XSS) al pintar texto del usuario
  escape(str = '') {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  // Notificación breve en la esquina
  toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(Utils._toastTimer);
    Utils._toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
  },

  // Copiar al portapapeles (API asíncrona con respaldo)
  async copy(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    Utils.toast('Copiado al portapapeles');
  },

  // Descarga un texto como archivo (Blob + enlace temporal)
  download(filename, content, type = 'text/plain') {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  // Base64 compatible con UTF-8 (btoa solo acepta Latin-1)
  b64encode(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    bytes.forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin);
  },
  b64decode(b64) {
    const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, ''));
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  },

  // Fecha legible en español
  formatDate(value) {
    return new Date(value).toLocaleString('es-MX', {
      dateStyle: 'medium', timeStyle: 'short'
    });
  }
};
