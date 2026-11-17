/* =========================================================
   bitacora.js - Módulo Bitácora técnica de incidentes
   CRUD sobre IndexedDB + búsqueda, filtros, estadísticas
   y exportación (Markdown, JSON, impresión/PDF).
   ========================================================= */
const Bitacora = {
  title: 'Bitácora técnica',
  desc: 'Registra incidentes por cliente o equipo: problema, causa y solución. Todo se guarda en tu navegador.',
  items: [],
  MAX_ADJ: 5,          // máximo de imágenes por incidente
  MAX_MB: 2,           // tamaño máximo por imagen
  adjuntosForm: [],    // adjuntos del formulario abierto
  _urls: [],           // object URLs de la lista (se liberan al redibujar)
  _formUrls: [],       // object URLs de las miniaturas del formulario

  /* ---------- Plantillas de fallas comunes ---------- */
  PLANTILLAS: {
    red: {
      nombre: 'Sin red', titulo: 'Equipo sin conexión a la red', categoria: 'Redes', prioridad: 'alta',
      problema: 'El equipo no tiene acceso a internet ni a recursos de la red.',
      causa: 'Revisar: cable/Wi-Fi, IP 169.254.x.x (sin DHCP), puerta de enlace, DNS.',
      solucion: 'ipconfig /release && ipconfig /renew\nping a la puerta de enlace y a 8.8.8.8\nnslookup google.com',
      etiquetas: 'red, dhcp, conectividad'
    },
    impresora: {
      nombre: 'Impresora', titulo: 'La impresora no imprime', categoria: 'Hardware', prioridad: 'media',
      problema: 'Los trabajos se quedan en la cola y no salen.',
      causa: 'Revisar: cola de impresión atascada, papel/tóner, impresora en pausa o desconectada.',
      solucion: 'net stop spooler\nBorrar C:\\Windows\\System32\\spool\\PRINTERS\\*\nnet start spooler',
      etiquetas: 'impresora, spooler'
    },
    bloqueado: {
      nombre: 'Usuario bloqueado', titulo: 'Cuenta de usuario bloqueada', categoria: 'Seguridad', prioridad: 'media',
      problema: 'El usuario no puede iniciar sesión: cuenta bloqueada por intentos fallidos.',
      causa: 'Revisar: contraseña vencida, intentos fallidos, sesión guardada con contraseña anterior.',
      solucion: 'Desbloquear en Active Directory (Usuarios y equipos de AD)\nRestablecer contraseña y pedir cambio en el siguiente inicio',
      etiquetas: 'active directory, cuenta, contraseña'
    },
    lento: {
      nombre: 'Equipo lento', titulo: 'Equipo funciona muy lento', categoria: 'Software', prioridad: 'baja',
      problema: 'El equipo tarda en abrir programas y se congela.',
      causa: 'Revisar: uso de CPU/RAM/disco en el Administrador de tareas, programas al inicio, espacio libre, malware.',
      solucion: 'Desactivar programas de inicio\nLiberar espacio en disco\nAnálisis antivirus',
      etiquetas: 'rendimiento, mantenimiento'
    },
    disco: {
      nombre: 'Disco lleno', titulo: 'Disco del servidor lleno', categoria: 'Servidores', prioridad: 'alta',
      problema: 'El servidor se quedó sin espacio y los servicios fallan.',
      causa: 'Revisar: logs que crecen sin rotación, respaldos viejos, archivos temporales.',
      solucion: 'df -h\ndu -sh /var/log/* | sort -h\nConfigurar logrotate',
      etiquetas: 'linux, disco, logs'
    }
  },

  /* ---------- Vista ---------- */
  html() {
    return `
      <div class="stats" id="bitStats"></div>

      <div class="charts" id="bitCharts" hidden>
        <div class="card">
          <label>Incidentes por categoría <small>(según filtros)</small></label>
          <canvas id="chartCat" aria-label="Gráfica de barras de incidentes por categoría" role="img"></canvas>
        </div>
        <div class="card">
          <label>Abiertos vs resueltos <small>(según filtros)</small></label>
          <canvas id="chartEstado" aria-label="Gráfica de dona de incidentes abiertos y resueltos" role="img"></canvas>
        </div>
      </div>

      <div class="card no-print">
        <div class="toolbar">
          <input id="bitSearch" aria-label="Buscar incidentes" placeholder="Buscar en título, cliente, problema, solución o etiquetas...">
          <select id="bitOrden" aria-label="Ordenar">
            <option value="reciente">Más recientes</option>
            <option value="antiguo">Más antiguos</option>
            <option value="prioridad">Prioridad (alta primero)</option>
            <option value="abiertos">Abiertos primero</option>
            <option value="titulo">Título (A-Z)</option>
          </select>
          <select id="bitEstado" aria-label="Filtrar por estado">
            <option value="">Todos los estados</option>
            <option value="abierto">Abierto</option>
            <option value="resuelto">Resuelto</option>
          </select>
          <select id="bitPrioridad" aria-label="Filtrar por prioridad">
            <option value="">Todas las prioridades</option>
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
          </select>
          <select id="bitCategoria" aria-label="Filtrar por categoría">
            <option value="">Todas las categorías</option>
          </select>
        </div>
        <div class="row">
          <button class="btn" data-act="new">+ Nuevo incidente</button>
          <button class="btn ghost" data-act="md">Exportar Markdown</button>
          <button class="btn ghost" data-act="json">Respaldo JSON</button>
          <label class="btn ghost" style="margin:0">Importar JSON
            <input type="file" id="bitImport" accept=".json" hidden>
          </label>
          <button class="btn ghost" data-act="print">Imprimir / PDF</button>
        </div>
      </div>

      <div id="bitList"></div>

      <dialog id="bitDialog">
        <form method="dialog" id="bitForm">
          <h2 id="bitFormTitle">Nuevo incidente</h2>
          <div id="bitTplBox">
            <label>Usar plantilla</label>
            <div class="row" style="margin:0">
              ${Object.entries(this.PLANTILLAS).map(([k, p]) =>
                `<button type="button" class="btn ghost small" data-tpl="${k}">${p.nombre}</button>`).join('')}
            </div>
          </div>
          <input type="hidden" name="id">
          <div>
            <label for="f_titulo">Título *</label>
            <input id="f_titulo" name="titulo" required maxlength="120" placeholder="Impresora de recepción no imprime">
          </div>
          <div class="grid-2">
            <div><label for="f_cliente">Cliente / equipo *</label><input id="f_cliente" name="cliente" required placeholder="Oficina RH · PC-07"></div>
            <div><label for="f_fecha">Fecha</label><input id="f_fecha" name="fecha" type="datetime-local" required></div>
          </div>
          <div class="grid-2">
            <div><label for="f_categoria">Categoría</label>
              <select id="f_categoria" name="categoria">
                <option>Hardware</option><option>Software</option><option>Redes</option>
                <option>Servidores</option><option>Seguridad</option><option>Base de datos</option><option>Otro</option>
              </select></div>
            <div class="grid-2">
              <div><label for="f_prioridad">Prioridad</label>
                <select id="f_prioridad" name="prioridad"><option value="alta">Alta</option><option value="media" selected>Media</option><option value="baja">Baja</option></select></div>
              <div><label for="f_estado">Estado</label>
                <select id="f_estado" name="estado"><option value="abierto">Abierto</option><option value="resuelto">Resuelto</option></select></div>
            </div>
          </div>
          <div><label for="f_problema">Problema *</label><textarea id="f_problema" name="problema" required></textarea></div>
          <div><label for="f_causa">Causa</label><textarea id="f_causa" name="causa"></textarea></div>
          <div><label for="f_solucion">Solución</label><textarea id="f_solucion" name="solucion"></textarea></div>
          <div><label for="f_etiquetas">Etiquetas (separadas por coma)</label><input id="f_etiquetas" name="etiquetas" placeholder="dhcp, switch, piso 2"></div>
          <div>
            <label for="bitFiles">Capturas de pantalla <small>(hasta ${this.MAX_ADJ} imágenes de ${this.MAX_MB} MB)</small></label>
            <div class="drop" id="bitDrop">
              <p>Arrastra imágenes aquí, <b>pégalas con Ctrl+V</b> o
                <label for="bitFiles" class="link">elige archivos</label></p>
              <input type="file" id="bitFiles" accept="image/*" multiple hidden>
            </div>
            <div id="bitThumbs" class="thumbs"></div>
          </div>
          <div class="row" style="justify-content:flex-end">
            <button class="btn ghost" value="cancel" formnovalidate>Cancelar</button>
            <button class="btn" value="save">Guardar</button>
          </div>
        </form>
      </dialog>

      <dialog id="bitViewer" class="viewer" aria-label="Vista de la captura">
        <img id="viewerImg" alt="">
        <div class="row" style="justify-content:space-between;margin:10px 0 0">
          <span id="viewerInfo" class="meta"></span>
          <span>
            <a id="viewerDown" class="btn ghost small" download>Descargar</a>
            <button class="btn small" type="button" data-act="closeViewer">Cerrar</button>
          </span>
        </div>
      </dialog>`;
  },

  /* ---------- Conexión de eventos ---------- */
  async mount(root) {
    const { $ } = Utils;
    this.root = root;
    // Se oculta hasta tener los datos para que la página no "brinque" al cargar (CLS)
    root.style.visibility = 'hidden';
    const dialog = $('#bitDialog', root);
    const form = $('#bitForm', root);

    // Botones de la barra
    root.addEventListener('click', async (e) => {
      const act = e.target.dataset.act;
      const id = Number(e.target.dataset.id);
      if (act === 'new') this.openForm();
      if (act === 'edit') this.openForm(await DB.get(id));
      if (act === 'toggle') await this.toggleEstado(id);
      if (act === 'delete') await this.remove(id);
      if (act === 'md') this.exportMarkdown();
      if (act === 'json') this.exportJSON();
      if (act === 'print') window.print();
      if (e.target.dataset.tpl) this.aplicarPlantilla(e.target.dataset.tpl);
      if (act === 'closeViewer') $('#bitViewer', root).close();

      // Quitar un adjunto del formulario
      const quitar = e.target.closest('[data-quitar]');
      if (quitar) {
        this.adjuntosForm.splice(Number(quitar.dataset.quitar), 1);
        this.pintarAdjuntosForm();
      }
      // Ver una captura en grande
      const ver = e.target.closest('[data-ver]');
      if (ver) {
        const [id, i] = ver.dataset.ver.split(':').map(Number);
        this.verAdjunto(this.items.find(x => x.id === id).adjuntos[i]);
      }
    });

    /* ----- Adjuntos: seleccionar, arrastrar o pegar ----- */
    const drop = $('#bitDrop', root);
    $('#bitFiles', root).addEventListener('change', (e) => {
      this.agregarAdjuntos(e.target.files);
      e.target.value = '';             // permite volver a elegir el mismo archivo
    });
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', (e) => {
      e.preventDefault();
      drop.classList.remove('over');
      this.agregarAdjuntos(e.dataTransfer.files);
    });
    dialog.addEventListener('paste', (e) => {
      const imgs = [...e.clipboardData.files].filter(f => f.type.startsWith('image/'));
      if (!imgs.length) return;        // si es texto, se pega normal
      e.preventDefault();
      this.agregarAdjuntos(imgs);
    });
    // Cerrar el visor al hacer clic fuera de la imagen
    $('#bitViewer', root).addEventListener('click', (e) => {
      if (e.target.id === 'bitViewer') e.target.close();
    });

    // Filtros y orden en vivo
    ['#bitSearch', '#bitOrden', '#bitEstado', '#bitPrioridad', '#bitCategoria'].forEach(sel =>
      $(sel, root).addEventListener('input', () => this.render()));

    // Guardar al cerrar el diálogo con el botón "save"
    dialog.addEventListener('close', async () => {
      if (dialog.returnValue !== 'save') return;
      await this.save(new FormData(form));
    });

    $('#bitImport', root).addEventListener('change', (e) => this.importJSON(e.target.files[0]));

    await this.load();
    root.style.visibility = '';
  },

  /* ---------- Datos ---------- */
  async load() {
    this.items = (await DB.getAll()).sort((a, b) => b.fecha.localeCompare(a.fecha));
    this.render();
  },

  async save(fd) {
    const data = Object.fromEntries(fd.entries());
    const item = {
      titulo: data.titulo.trim(),
      cliente: data.cliente.trim(),
      fecha: data.fecha,
      categoria: data.categoria,
      prioridad: data.prioridad,
      estado: data.estado,
      problema: data.problema.trim(),
      causa: data.causa.trim(),
      solucion: data.solucion.trim(),
      etiquetas: data.etiquetas.split(',').map(t => t.trim().toLowerCase()).filter(Boolean),
      adjuntos: this.adjuntosForm,     // los Blob se guardan directo en IndexedDB
      actualizado: new Date().toISOString()
    };
    if (data.id) {
      item.id = Number(data.id);
      await DB.put(item);
      Utils.toast('Incidente actualizado');
    } else {
      await DB.add(item);
      Utils.toast('Incidente guardado');
    }
    await this.load();
  },

  async toggleEstado(id) {
    const item = await DB.get(id);
    item.estado = item.estado === 'abierto' ? 'resuelto' : 'abierto';
    item.actualizado = new Date().toISOString();
    await DB.put(item);
    await this.load();
  },

  async remove(id) {
    if (!confirm('¿Eliminar este incidente? No se puede deshacer.')) return;
    await DB.remove(id);
    Utils.toast('Incidente eliminado');
    await this.load();
  },

  /* ---------- Formulario (crear / editar) ---------- */
  openForm(item = null) {
    const { $ } = Utils;
    const form = $('#bitForm', this.root);
    form.reset();
    $('#bitFormTitle', this.root).textContent = item ? 'Editar incidente' : 'Nuevo incidente';
    $('#bitTplBox', this.root).hidden = !!item;   // plantillas solo al crear

    // Fecha local actual en formato yyyy-MM-ddTHH:mm para datetime-local
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    form.fecha.value = now.toISOString().slice(0, 16);
    form.id.value = '';

    if (item) {
      ['id', 'titulo', 'cliente', 'fecha', 'categoria', 'prioridad', 'estado', 'problema', 'causa', 'solucion']
        .forEach(k => { form[k].value = item[k] ?? ''; });
      form.etiquetas.value = item.etiquetas.join(', ');
    }
    this.adjuntosForm = [...(item?.adjuntos || [])];
    this.pintarAdjuntosForm();
    $('#bitDialog', this.root).showModal();
  },

  /* ---------- Adjuntos (Sesión 3) ---------- */
  agregarAdjuntos(archivos) {
    const errores = [];
    for (const f of archivos) {
      if (!f.type.startsWith('image/')) { errores.push(`${f.name}: no es una imagen`); continue; }
      if (f.size > this.MAX_MB * 1024 * 1024) { errores.push(`${f.name}: pesa más de ${this.MAX_MB} MB`); continue; }
      if (this.adjuntosForm.length >= this.MAX_ADJ) { errores.push(`Máximo ${this.MAX_ADJ} imágenes por incidente`); break; }
      this.adjuntosForm.push({
        nombre: f.name && f.name !== 'image.png' ? f.name : `captura-${Date.now()}.png`,
        tipo: f.type,
        tamano: f.size,
        blob: f                           // File hereda de Blob
      });
    }
    if (errores.length) Utils.toast(errores[0]);
    this.pintarAdjuntosForm();
  },

  pintarAdjuntosForm() {
    this._formUrls.forEach(u => URL.revokeObjectURL(u));
    this._formUrls = [];
    const box = Utils.$('#bitThumbs', this.root);
    box.innerHTML = this.adjuntosForm.map((a, i) => {
      const url = URL.createObjectURL(a.blob);
      this._formUrls.push(url);
      return `<figure class="thumb">
          <img src="${url}" alt="${Utils.escape(a.nombre)}">
          <button type="button" class="thumb-x" data-quitar="${i}" aria-label="Quitar ${Utils.escape(a.nombre)}">×</button>
          <figcaption>${Utils.escape(a.nombre)} · ${this.tamano(a.tamano)}</figcaption>
        </figure>`;
    }).join('');
  },

  verAdjunto(a) {
    const { $ } = Utils;
    const url = URL.createObjectURL(a.blob);
    this._urls.push(url);
    $('#viewerImg', this.root).src = url;
    $('#viewerImg', this.root).alt = a.nombre;
    $('#viewerInfo', this.root).textContent = `${a.nombre} · ${this.tamano(a.tamano)}`;
    $('#viewerDown', this.root).href = url;
    $('#viewerDown', this.root).download = a.nombre;
    $('#bitViewer', this.root).showModal();
  },

  tamano(bytes) {
    return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1048576).toFixed(1)} MB`;
  },

  /* ---------- Plantillas: llena el formulario sin tocar cliente ni fecha ---------- */
  aplicarPlantilla(clave) {
    const p = this.PLANTILLAS[clave];
    const form = Utils.$('#bitForm', this.root);
    ['titulo', 'categoria', 'prioridad', 'problema', 'causa', 'solucion', 'etiquetas']
      .forEach(k => { form[k].value = p[k]; });
    form.estado.value = 'abierto';
    form.cliente.focus();
  },

  /* ---------- Ordenamiento ---------- */
  ordenar(lista) {
    const modo = Utils.$('#bitOrden', this.root).value;
    const peso = { alta: 0, media: 1, baja: 2 };
    const porFecha = (a, b) => b.fecha.localeCompare(a.fecha);
    const comparadores = {
      reciente: porFecha,
      antiguo: (a, b) => a.fecha.localeCompare(b.fecha),
      prioridad: (a, b) => peso[a.prioridad] - peso[b.prioridad] || porFecha(a, b),
      abiertos: (a, b) => (a.estado === 'abierto' ? 0 : 1) - (b.estado === 'abierto' ? 0 : 1) || porFecha(a, b),
      titulo: (a, b) => a.titulo.localeCompare(b.titulo, 'es', { sensitivity: 'base' })
    };
    return [...lista].sort(comparadores[modo] || porFecha);   // copia: no altera this.items
  },

  /* ---------- Gráficas (Canvas, ver charts.js) ---------- */
  renderCharts(lista = this.filtered()) {
    const cat = document.getElementById('chartCat');
    if (!cat) return;
    document.getElementById('bitCharts').hidden = !this.items.length;
    if (!this.items.length) return;

    const conteo = {};
    lista.forEach(i => { conteo[i.categoria] = (conteo[i.categoria] || 0) + 1; });
    const datos = Object.entries(conteo)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
    Charts.bars(cat, datos);

    const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
    const abiertos = lista.filter(i => i.estado === 'abierto').length;
    Charts.donut(document.getElementById('chartEstado'), [
      { label: 'Abiertos', value: abiertos, color: css('--warn') },
      { label: 'Resueltos', value: lista.length - abiertos, color: css('--accent') }
    ], { centro: 'incidentes' });
  },

  /* ---------- Filtrado ---------- */
  filtered() {
    const { $ } = Utils;
    const q = $('#bitSearch', this.root).value.trim().toLowerCase();
    const estado = $('#bitEstado', this.root).value;
    const prioridad = $('#bitPrioridad', this.root).value;
    const categoria = $('#bitCategoria', this.root).value;

    return this.items.filter(it => {
      if (estado && it.estado !== estado) return false;
      if (prioridad && it.prioridad !== prioridad) return false;
      if (categoria && it.categoria !== categoria) return false;
      if (!q) return true;
      const texto = [it.titulo, it.cliente, it.problema, it.causa, it.solucion, ...it.etiquetas]
        .join(' ').toLowerCase();
      return texto.includes(q);
    });
  },

  /* ---------- Render ---------- */
  render() {
    const { $, escape: esc, formatDate } = Utils;
    if (!$('#bitList', this.root)) return;

    // Estadísticas generales
    const abiertos = this.items.filter(i => i.estado === 'abierto').length;
    const altas = this.items.filter(i => i.prioridad === 'alta' && i.estado === 'abierto').length;
    $('#bitStats', this.root).innerHTML = `
      <div class="stat"><b>${this.items.length}</b><span>Total</span></div>
      <div class="stat"><b>${abiertos}</b><span>Abiertos</span></div>
      <div class="stat"><b>${this.items.length - abiertos}</b><span>Resueltos</span></div>
      <div class="stat"><b>${altas}</b><span>Alta prioridad abiertos</span></div>`;

    // Categorías disponibles en el filtro (sin perder la selección actual)
    const sel = $('#bitCategoria', this.root);
    const actual = sel.value;
    const cats = [...new Set(this.items.map(i => i.categoria))].sort();
    sel.innerHTML = '<option value="">Todas las categorías</option>' +
      cats.map(c => `<option ${c === actual ? 'selected' : ''}>${esc(c)}</option>`).join('');

    // Libera las URLs de las imágenes del dibujo anterior (evita fugas de memoria)
    this._urls.forEach(u => URL.revokeObjectURL(u));
    this._urls = [];
    const miniatura = (it, a, i) => {
      const url = URL.createObjectURL(a.blob);
      this._urls.push(url);
      return `<button class="thumb" data-ver="${it.id}:${i}" title="${esc(a.nombre)}">
        <img src="${url}" alt="${esc(a.nombre)}" loading="lazy"></button>`;
    };

    const filtrados = this.filtered();
    this.renderCharts(filtrados);
    const list = this.ordenar(filtrados);
    $('#bitList', this.root).innerHTML = list.length ? list.map(it => `
      <article class="entry p-${it.prioridad}">
        <div class="entry-head">
          <div>
            <h3>${esc(it.titulo)}</h3>
            <div class="meta">${esc(it.cliente)} · ${formatDate(it.fecha)} · ${esc(it.categoria)}</div>
          </div>
          <div>
            <span class="badge ${it.estado}">${it.estado}</span>
            <span class="badge">prioridad ${it.prioridad}</span>
          </div>
        </div>
        <p><b>Problema:</b> ${esc(it.problema)}</p>
        ${it.causa ? `<p><b>Causa:</b> ${esc(it.causa)}</p>` : ''}
        ${it.solucion ? `<p><b>Solución:</b> ${esc(it.solucion)}</p>` : ''}
        ${it.etiquetas.length ? `<p>${it.etiquetas.map(t => `<span class="badge tag">#${esc(t)}</span>`).join('')}</p>` : ''}
        ${it.adjuntos?.length ? `<div class="thumbs">${it.adjuntos.map((a, i) => miniatura(it, a, i)).join('')}</div>` : ''}
        <div class="row no-print">
          <button class="btn ghost small" data-act="edit" data-id="${it.id}">Editar</button>
          <button class="btn ghost small" data-act="toggle" data-id="${it.id}">
            Marcar ${it.estado === 'abierto' ? 'resuelto' : 'abierto'}</button>
          <button class="btn danger small" data-act="delete" data-id="${it.id}">Eliminar</button>
        </div>
      </article>`).join('')
      : `<div class="empty">${this.items.length ? 'Ningún incidente coincide con el filtro.' : 'Aún no hay incidentes. Crea el primero con “+ Nuevo incidente”.'}</div>`;
  },

  /* ---------- Exportación / importación ---------- */
  exportMarkdown() {
    const list = this.ordenar(this.filtered());
    if (!list.length) return Utils.toast('No hay incidentes para exportar');
    const md = [
      '# Bitácora técnica',
      `_Generado: ${Utils.formatDate(Date.now())} · ${list.length} incidente(s)_`,
      ''
    ];
    list.forEach(it => {
      md.push(
        `## ${it.titulo}`,
        `- **Cliente / equipo:** ${it.cliente}`,
        `- **Fecha:** ${Utils.formatDate(it.fecha)}`,
        `- **Categoría:** ${it.categoria} · **Prioridad:** ${it.prioridad} · **Estado:** ${it.estado}`,
        it.etiquetas.length ? `- **Etiquetas:** ${it.etiquetas.map(t => '`' + t + '`').join(' ')}` : '',
        it.adjuntos?.length ? `- **Capturas:** ${it.adjuntos.map(a => `${a.nombre} (${this.tamano(a.tamano)})`).join(', ')}` : '',
        '', '**Problema**', '', it.problema, '',
        it.causa ? `**Causa**\n\n${it.causa}\n` : '',
        it.solucion ? `**Solución**\n\n${it.solucion}\n` : '',
        '---', ''
      );
    });
    Utils.download(`bitacora-${new Date().toISOString().slice(0, 10)}.md`,
      md.filter(l => l !== null).join('\n'), 'text/markdown');
  },

  // Las imágenes (Blob) no caben en JSON: se convierten a texto Base64 (data URL) y viceversa
  blobADataURL(blob) {
    return new Promise((resolve, reject) => {
      const lector = new FileReader();
      lector.onload = () => resolve(lector.result);
      lector.onerror = () => reject(lector.error);
      lector.readAsDataURL(blob);
    });
  },

  dataURLABlob(dataURL) {
    const [cabecera, base64] = dataURL.split(',');
    const tipo = cabecera.match(/data:([^;]+)/)?.[1] || 'application/octet-stream';
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    return new Blob([bytes], { type: tipo });
  },

  async exportJSON() {
    Utils.toast('Preparando respaldo…');
    const incidentes = await Promise.all(this.items.map(async it => ({
      ...it,
      adjuntos: await Promise.all((it.adjuntos || []).map(async a => ({
        nombre: a.nombre, tipo: a.tipo, tamano: a.tamano,
        datos: await this.blobADataURL(a.blob)
      })))
    })));
    const payload = { app: 'techkit', version: 2, exportado: new Date().toISOString(), incidentes };
    Utils.download(`techkit-respaldo-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(payload, null, 2), 'application/json');
  },

  async importJSON(file) {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const lista = Array.isArray(data) ? data : data.incidentes;
      if (!Array.isArray(lista)) throw new Error('Formato no reconocido');
      let n = 0;
      for (const it of lista) {
        if (!it.titulo || !it.problema) continue; // validación mínima
        const { id, ...resto } = it;             // se ignora el id para no pisar registros
        const adjuntos = (Array.isArray(it.adjuntos) ? it.adjuntos : [])
          .filter(a => typeof a.datos === 'string' && a.datos.startsWith('data:image/'))
          .map(a => ({ nombre: a.nombre, tipo: a.tipo, tamano: a.tamano, blob: this.dataURLABlob(a.datos) }));
        await DB.add({ ...resto, etiquetas: Array.isArray(it.etiquetas) ? it.etiquetas : [], adjuntos });
        n++;
      }
      Utils.toast(`${n} incidente(s) importado(s)`);
      await this.load();
    } catch (err) {
      alert('No se pudo importar: ' + err.message);
    }
  }
};

/* Redibuja las gráficas al cambiar el tema o el tamaño de la ventana.
   Se registran una sola vez; si la bitácora no está abierta, no hacen nada. */
window.addEventListener('themechange', () => Bitacora.renderCharts());
window.addEventListener('resize', () => {
  clearTimeout(Bitacora._resizeTimer);
  Bitacora._resizeTimer = setTimeout(() => Bitacora.renderCharts(), 150);
});
