/* =========================================================
   charts.js - Gráficas dibujadas a mano con Canvas 2D (sin librerías)
   Charts.bars(canvas, datos, opciones)   -> barras horizontales
   Charts.donut(canvas, segmentos, opc.)  -> dona con total al centro
   Los colores se leen de las variables CSS, así respetan el tema.
   ========================================================= */
const Charts = (() => {
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

  // Ajusta el canvas a la pantalla (nitidez en pantallas HiDPI) y regresa el contexto
  function preparar(canvas, alto) {
    const ratio = window.devicePixelRatio || 1;
    const ancho = canvas.clientWidth || canvas.parentElement.clientWidth;
    canvas.style.height = alto + 'px';
    canvas.width = Math.round(ancho * ratio);
    canvas.height = Math.round(alto * ratio);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, ancho, alto);
    return { ctx, ancho, alto };
  }

  // Rectángulo con esquinas redondeadas solo del lado derecho (extremo del dato)
  function barra(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.fill();
  }

  /* ---------- Tooltip compartido ---------- */
  let tip;
  function tooltip(texto, e) {
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'chart-tip';
      document.body.appendChild(tip);
    }
    if (!texto) { tip.style.opacity = 0; return; }
    tip.textContent = texto;
    tip.style.opacity = 1;
    tip.style.left = Math.min(e.clientX + 12, window.innerWidth - tip.offsetWidth - 8) + 'px';
    tip.style.top = (e.clientY + 12) + 'px';
  }

  // Conecta el hover una sola vez por canvas; las zonas se actualizan en cada dibujo
  function hover(canvas) {
    if (canvas._hover) return;
    canvas._hover = true;
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      const zona = (canvas._zonas || []).find(z => z.hit(x, y));
      canvas.style.cursor = zona ? 'pointer' : 'default';
      tooltip(zona ? zona.texto : '', e);
    });
    canvas.addEventListener('mouseleave', () => tooltip(''));
  }

  /* ---------- Barras horizontales ---------- */
  function bars(canvas, datos, { color = css('--info'), unidad = 'incidente(s)' } = {}) {
    const FILA = 30, PAD = 8;
    const { ctx, ancho, alto } = preparar(canvas, Math.max(datos.length, 1) * FILA + PAD * 2);
    hover(canvas);
    canvas._zonas = [];
    ctx.font = `13px ${FONT}`;
    ctx.textBaseline = 'middle';

    if (!datos.length) {
      ctx.fillStyle = css('--muted');
      ctx.fillText('Sin datos', PAD, alto / 2);
      return;
    }

    const etiquetaW = Math.max(...datos.map(d => ctx.measureText(d.label).width)) + 12;
    const valorW = 28;
    const plotW = Math.max(ancho - etiquetaW - valorW - PAD, 20);
    const max = Math.max(...datos.map(d => d.value), 1);

    datos.forEach((d, i) => {
      const y = PAD + i * FILA;
      const h = 16;
      const w = Math.max((d.value / max) * plotW, 3);
      // Etiqueta (texto en color de texto, no en el color de la serie)
      ctx.fillStyle = css('--muted');
      ctx.textAlign = 'right';
      ctx.fillText(d.label, etiquetaW - 10, y + FILA / 2);
      // Barra
      ctx.fillStyle = color;
      barra(ctx, etiquetaW, y + (FILA - h) / 2, w, h, 4);
      // Valor al final de la barra
      ctx.fillStyle = css('--text');
      ctx.textAlign = 'left';
      ctx.fillText(String(d.value), etiquetaW + w + 6, y + FILA / 2);

      canvas._zonas.push({
        hit: (x, yy) => yy >= y && yy < y + FILA,
        texto: `${d.label}: ${d.value} ${unidad}`
      });
    });
  }

  /* ---------- Dona ---------- */
  function donut(canvas, segmentos, { centro = 'total' } = {}) {
    const ALTO = 170;
    const { ctx, ancho } = preparar(canvas, ALTO);
    hover(canvas);
    canvas._zonas = [];
    const total = segmentos.reduce((s, x) => s + x.value, 0);
    const radio = ALTO / 2 - 8, grosor = 24;
    const cx = radio + 8, cy = ALTO / 2;

    if (!total) {
      ctx.strokeStyle = css('--border');
      ctx.lineWidth = grosor;
      ctx.beginPath(); ctx.arc(cx, cy, radio - grosor / 2, 0, Math.PI * 2); ctx.stroke();
    } else {
      let ang = -Math.PI / 2;
      const huecoAng = segmentos.filter(s => s.value).length > 1 ? 0.03 : 0; // separación de 2px aprox.
      segmentos.forEach(s => {
        if (!s.value) return;
        const barrido = (s.value / total) * Math.PI * 2;
        const ini = ang, fin = ang + barrido;
        ctx.strokeStyle = s.color;
        ctx.lineWidth = grosor;
        ctx.beginPath();
        ctx.arc(cx, cy, radio - grosor / 2, ini + huecoAng / 2, fin - huecoAng / 2);
        ctx.stroke();
        canvas._zonas.push({
          hit: (x, y) => {
            const dist = Math.hypot(x - cx, y - cy);
            if (dist < radio - grosor || dist > radio) return false;
            let a = Math.atan2(y - cy, x - cx);
            if (a < -Math.PI / 2) a += Math.PI * 2;
            return a >= ini && a < fin;
          },
          texto: `${s.label}: ${s.value} (${Math.round(s.value / total * 100)}%)`
        });
        ang = fin;
      });
    }

    // Total al centro
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = css('--text');
    ctx.font = `700 26px ${FONT}`;
    ctx.fillText(String(total), cx, cy - 6);
    ctx.fillStyle = css('--muted');
    ctx.font = `12px ${FONT}`;
    ctx.fillText(centro, cx, cy + 16);

    // Leyenda a la derecha: muestra de color + nombre + valor
    ctx.textAlign = 'left';
    const lx = cx + radio + 24;
    segmentos.forEach((s, i) => {
      const ly = cy - (segmentos.length - 1) * 14 + i * 28;
      ctx.fillStyle = s.color;
      ctx.beginPath(); ctx.arc(lx + 5, ly, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = css('--text');
      ctx.font = `13px ${FONT}`;
      const pct = total ? ` · ${Math.round(s.value / total * 100)}%` : '';
      if (lx + 16 < ancho) ctx.fillText(`${s.label}: ${s.value}${pct}`, lx + 16, ly);
    });
  }

  return { bars, donut };
})();
