/* =========================================================
   comandos.js - Módulo Generador de comandos (Sesión 2)
   Mismo patrón que tools.js: { title, desc, html(), mount(root) }
   Herramientas: cron, chmod, docker run, tar
   ========================================================= */
const Comandos = (() => {
  const { $, $$, escape: esc, copy } = Utils;

  // Comillas simples para valores con espacios o caracteres especiales del shell
  const q = (v) => /^[\w@%+=:,./-]+$/.test(v) ? v : `'${v.replace(/'/g, `'\\''`)}'`;

  // Une elementos en español: "a", "a y b", "a, b y c"
  const lista = (arr) => arr.length <= 1 ? (arr[0] || '')
    : arr.slice(0, -1).join(', ') + ' y ' + arr[arr.length - 1];

  // Separa un textarea en líneas no vacías
  const lineas = (txt) => txt.split('\n').map(l => l.trim()).filter(Boolean);

  /* =====================================================
     CRON
     ===================================================== */
  const MESES = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
    'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
  const NOMBRES_MES = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  const NOMBRES_DIA = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

  const CAMPOS = [
    { id: 'min',   nombre: 'Minuto',          min: 0, max: 59 },
    { id: 'hora',  nombre: 'Hora',            min: 0, max: 23 },
    { id: 'dia',   nombre: 'Día del mes',     min: 1, max: 31 },
    { id: 'mes',   nombre: 'Mes',             min: 1, max: 12, alias: NOMBRES_MES },
    { id: 'semana', nombre: 'Día de la semana', min: 0, max: 7, alias: NOMBRES_DIA }
  ];

  const MACROS = {
    '@yearly': '0 0 1 1 *', '@annually': '0 0 1 1 *', '@monthly': '0 0 1 * *',
    '@weekly': '0 0 * * 0', '@daily': '0 0 * * *', '@midnight': '0 0 * * *', '@hourly': '0 * * * *'
  };

  // Convierte un campo ("1-5", "*/15", "0,30", "mon-fri") en un Set de valores válidos
  function parseCampo(raw, campo) {
    let txt = raw.toLowerCase();
    if (campo.alias) txt = txt.replace(/[a-z]{3}/g, n => (n in campo.alias ? campo.alias[n] : n));
    const valores = new Set();
    for (const parte of txt.split(',')) {
      const m = parte.match(/^(\*|(\d+)(?:-(\d+))?)(?:\/(\d+))?$/);
      if (!m) throw new Error(`${campo.nombre}: "${parte}" no es válido`);
      let ini = campo.min, fin = campo.max;
      if (m[1] !== '*') {
        ini = Number(m[2]);
        fin = m[3] !== undefined ? Number(m[3]) : (m[4] ? campo.max : ini);
      }
      const paso = m[4] ? Number(m[4]) : 1;
      if (ini < campo.min || fin > campo.max || ini > fin || paso < 1) {
        throw new Error(`${campo.nombre}: "${parte}" fuera de rango (${campo.min}-${campo.max})`);
      }
      for (let v = ini; v <= fin; v += paso) valores.add(campo.id === 'semana' && v === 7 ? 0 : v);
    }
    return valores;
  }

  // Describe un campo con palabras: "cada 15 minutos", "de lunes a viernes", "enero y julio"
  function describir(raw, campo, nombre, unidad) {
    let txt = raw.toLowerCase();
    if (campo.alias) txt = txt.replace(/[a-z]{3}/g, n => (n in campo.alias ? campo.alias[n] : n));
    return lista(txt.split(',').map(parte => {
      const [rango, paso] = parte.split('/');
      if (rango === '*') return paso ? `cada ${paso} ${unidad}` : `cada ${unidad.replace(/s$/, '')}`;
      const [a, b] = rango.split('-');
      if (b !== undefined) return paso ? `cada ${paso} ${unidad} de ${nombre(a)} a ${nombre(b)}` : `de ${nombre(a)} a ${nombre(b)}`;
      return paso ? `cada ${paso} ${unidad} desde ${nombre(a)}` : nombre(a);
    }));
  }

  // Genera la explicación completa en español
  function explicarCron(f) {
    const esNum = (s) => /^\d+$/.test(s);
    const dos = (n) => String(n).padStart(2, '0');
    let tiempo;

    if (esNum(f.min) && /^\d+(,\d+)*$/.test(f.hora)) {
      const horas = f.hora.split(',').map(h => `${Number(h)}:${dos(f.min)}`);
      tiempo = `A las ${lista(horas)}`;
    } else if (f.min === '*' && f.hora === '*') {
      tiempo = 'Cada minuto';
    } else if (f.hora === '*') {
      const d = describir(f.min, CAMPOS[0], n => n, 'minutos');
      tiempo = esNum(f.min) ? `En el minuto ${Number(f.min)} de cada hora`
        : d.startsWith('cada') ? 'C' + d.slice(1) : `En los minutos ${d} de cada hora`;
    } else {
      const m = f.min === '*' ? 'Cada minuto'
        : esNum(f.min) ? `En el minuto ${Number(f.min)}`
        : `En los minutos ${describir(f.min, CAMPOS[0], n => n, 'minutos')}`;
      tiempo = `${m}, ${describir(f.hora, CAMPOS[1], n => `las ${Number(n)} h`, 'horas')}`;
    }

    const partes = [tiempo];
    const PLURAL = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados', 'domingos'];
    const textoDia = f.dia === '*' ? '' : esNum(f.dia) ? `el día ${f.dia} del mes`
      : /^\*\/\d+$/.test(f.dia) ? describir(f.dia, CAMPOS[2], n => n, 'días')
      : `los días ${describir(f.dia, CAMPOS[2], n => n, 'días')} del mes`;
    let textoSem = '';
    if (f.semana !== '*') {
      const sem = f.semana.toLowerCase().replace(/[a-z]{3}/g, n => (n in NOMBRES_DIA ? NOMBRES_DIA[n] : n));
      textoSem = /^\d(,\d)*$/.test(sem)
        ? 'los ' + lista([...new Set(sem.split(',').map(n => PLURAL[Number(n)]))])
        : describir(sem, CAMPOS[4], n => DIAS[Number(n)], 'días');
    }

    if (textoDia && textoSem) partes.push(`${textoDia} o ${textoSem}`);
    else if (textoDia) partes.push(textoDia);
    else if (textoSem) partes.push(textoSem);
    else if (f.hora !== '*') partes.push('todos los días');

    if (f.mes !== '*') partes.push(`en ${describir(f.mes, CAMPOS[3], n => MESES[Number(n)], 'meses')}`);
    return partes.join(', ');
  }

  // Próximas ejecuciones: avanza minuto a minuto (máximo ~1 año) y revisa si coincide
  function proximas(sets, f, n = 5) {
    const res = [];
    const d = new Date();
    d.setSeconds(0, 0);
    d.setMinutes(d.getMinutes() + 1);
    const domStar = f.dia.startsWith('*'), dowStar = f.semana.startsWith('*');
    for (let i = 0; i < 527040 && res.length < n; i++) {
      const dom = sets.dia.has(d.getDate()), dow = sets.semana.has(d.getDay());
      // Regla de cron: si se restringen día del mes Y día de semana, basta con uno
      const diaOk = domStar && dowStar ? true : domStar ? dow : dowStar ? dom : (dom || dow);
      if (sets.min.has(d.getMinutes()) && sets.hora.has(d.getHours())
          && sets.mes.has(d.getMonth() + 1) && diaOk) res.push(new Date(d));
      d.setMinutes(d.getMinutes() + 1);
    }
    return res;
  }

  const cron = {
    title: 'Cron',
    desc: 'Arma una expresión de cron, te la explica en español y muestra las próximas ejecuciones.',
    html: () => `
      <div class="card">
        <label for="cronPreset">Plantillas rápidas</label>
        <select id="cronPreset">
          <option value="">— Elegir —</option>
          <option value="* * * * *">Cada minuto</option>
          <option value="*/15 * * * *">Cada 15 minutos</option>
          <option value="0 * * * *">Cada hora</option>
          <option value="0 0 * * *">Diario a medianoche</option>
          <option value="0 8 * * 1-5">Lunes a viernes a las 8:00</option>
          <option value="30 2 * * 0">Domingos a las 2:30 (respaldo semanal)</option>
          <option value="0 0 1 * *">El día 1 de cada mes</option>
          <option value="0 9,13,18 * * *">Tres veces al día (9, 13 y 18 h)</option>
        </select>
        <div class="cron-grid">
          ${CAMPOS.map(c => `
            <div>
              <label for="cron_${c.id}">${c.nombre}</label>
              <input id="cron_${c.id}" class="mono" value="*" data-campo="${c.id}">
              <small>${c.min}-${c.max}</small>
            </div>`).join('')}
        </div>
        <label for="cronCmd">Comando a ejecutar (opcional)</label>
        <input id="cronCmd" class="mono" placeholder="/home/usuario/respaldo.sh">
      </div>

      <div class="card">
        <label for="cronExpr">Expresión (también puedes pegar una aquí)</label>
        <div class="row" style="flex-wrap:nowrap;margin-top:0">
          <input id="cronExpr" class="mono big" value="* * * * *">
          <button class="btn ghost" data-act="copy">Copiar</button>
        </div>
        <p id="cronText" class="explain"></p>
        <label>Línea para crontab (<span class="mono">crontab -e</span>)</label>
        <div id="cronLine" class="output"></div>
        <label style="margin-top:12px">Próximas 5 ejecuciones</label>
        <div id="cronNext" class="output"></div>
      </div>

      <div class="card help">
        <b>Sintaxis:</b> <span class="mono">*</span> cualquier valor ·
        <span class="mono">5</span> valor exacto · <span class="mono">1-5</span> rango ·
        <span class="mono">*/15</span> cada 15 · <span class="mono">0,30</span> lista.
        En día de la semana, 0 y 7 son domingo. También acepta <span class="mono">mon-fri</span>,
        <span class="mono">jan</span> y macros como <span class="mono">@daily</span> o <span class="mono">@reboot</span>.
      </div>`,
    mount(root) {
      const inputs = CAMPOS.map(c => $(`#cron_${c.id}`, root));
      const expr = $('#cronExpr', root);

      const pintar = () => {
        const out = { text: $('#cronText', root), line: $('#cronLine', root), next: $('#cronNext', root) };
        const cmd = $('#cronCmd', root).value.trim() || '/ruta/al/comando';
        let txt = expr.value.trim().replace(/\s+/g, ' ');

        if (txt === '@reboot') {
          out.text.className = 'explain ok';
          out.text.textContent = 'Una vez, cada vez que el sistema arranca.';
          out.line.textContent = `@reboot ${cmd}`;
          out.next.textContent = 'Depende de cuándo se reinicie el equipo.';
          return;
        }
        if (MACROS[txt]) txt = MACROS[txt];

        const partes = txt.split(' ');
        try {
          if (partes.length !== 5) throw new Error(`Se esperan 5 campos y hay ${partes.length}.`);
          const f = {}, sets = {};
          CAMPOS.forEach((c, i) => { f[c.id] = partes[i]; sets[c.id] = parseCampo(partes[i], c); });
          const exp = explicarCron(f);
          out.text.className = 'explain ok';
          out.text.textContent = exp.charAt(0).toUpperCase() + exp.slice(1) + '.';
          out.line.textContent = `${expr.value.trim()} ${cmd}`;
          const fechas = proximas(sets, f);
          out.next.textContent = fechas.length
            ? fechas.map(d => d.toLocaleString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })).join('\n')
            : 'No hay ejecuciones en los próximos 12 meses (¿fecha imposible como 31 de febrero?).';
          inputs.forEach(inp => inp.classList.remove('invalid'));
        } catch (err) {
          out.text.className = 'explain error';
          out.text.textContent = err.message;
          out.line.textContent = '';
          out.next.textContent = '';
          const campo = CAMPOS.findIndex(c => err.message.startsWith(c.nombre));
          inputs.forEach((inp, i) => inp.classList.toggle('invalid', i === campo));
        }
      };

      // Campos -> expresión
      const desdeCampos = () => {
        expr.value = inputs.map(i => i.value.trim() || '*').join(' ');
        pintar();
      };
      // Expresión -> campos (para cuando pegas una expresión)
      const desdeExpresion = () => {
        const p = (MACROS[expr.value.trim()] || expr.value.trim()).split(/\s+/);
        if (p.length === 5) inputs.forEach((inp, i) => { inp.value = p[i]; });
        pintar();
      };

      inputs.forEach(i => i.addEventListener('input', desdeCampos));
      expr.addEventListener('input', desdeExpresion);
      $('#cronCmd', root).addEventListener('input', pintar);
      $('#cronPreset', root).addEventListener('change', (e) => {
        if (!e.target.value) return;
        expr.value = e.target.value;
        desdeExpresion();
      });
      root.addEventListener('click', (e) => {
        if (e.target.dataset.act === 'copy') copy($('#cronLine', root).textContent || expr.value);
      });
      pintar();
    }
  };

  /* =====================================================
     CHMOD
     ===================================================== */
  const QUIEN = [['u', 'Propietario'], ['g', 'Grupo'], ['o', 'Otros']];
  const PERM = [['r', 'Lectura', 4], ['w', 'Escritura', 2], ['x', 'Ejecución', 1]];
  const ESPECIALES = [
    ['suid', 'SUID', 4, 'Se ejecuta con los permisos del propietario (ej. passwd)'],
    ['sgid', 'SGID', 2, 'Hereda el grupo / se ejecuta con permisos del grupo'],
    ['sticky', 'Sticky', 1, 'Solo el dueño puede borrar sus archivos (ej. /tmp)']
  ];

  const chmod = {
    title: 'chmod',
    desc: 'Calcula permisos de Linux en modo numérico (755) y simbólico (rwxr-xr-x), en ambos sentidos.',
    html: () => `
      <div class="grid-2">
        <div class="card">
          <table class="perm-table">
            <thead><tr><th></th>${PERM.map(p => `<th>${p[1]}<br><small>${p[0]} = ${p[2]}</small></th>`).join('')}<th>Valor</th></tr></thead>
            <tbody>
              ${QUIEN.map(([k, nombre]) => `
                <tr><th>${nombre}</th>
                  ${PERM.map(([p]) => `<td><input type="checkbox" data-perm="${k}${p}" aria-label="${nombre} ${p}"></td>`).join('')}
                  <td class="mono" id="val_${k}">0</td></tr>`).join('')}
            </tbody>
          </table>
          <label style="margin-top:14px">Permisos especiales</label>
          <div class="row" style="margin-top:0">
            ${ESPECIALES.map(([id, n, v, t]) => `<label title="${t}"><input type="checkbox" data-esp="${id}" style="width:auto"> ${n} (${v})</label>`).join('')}
          </div>
          <label>Presets comunes</label>
          <div class="row" style="margin-top:0">
            ${['644', '755', '600', '700', '775', '777', '1777'].map(p => `<button class="btn ghost small" data-preset="${p}">${p}</button>`).join('')}
          </div>
        </div>

        <div class="card">
          <div class="grid-2">
            <div><label for="chOct">Numérico (octal)</label><input id="chOct" class="mono big" value="755" maxlength="4"></div>
            <div><label for="chSym">Simbólico</label><input id="chSym" class="mono big" value="rwxr-xr-x" maxlength="10"></div>
          </div>
          <div class="grid-2" style="margin-top:12px">
            <div><label for="chFile">Archivo o carpeta</label><input id="chFile" class="mono" value="script.sh"></div>
            <div><label for="chTipo">Tipo</label>
              <select id="chTipo"><option value="-">Archivo</option><option value="d">Directorio</option></select></div>
          </div>
          <div class="row"><label><input type="checkbox" id="chRec" style="width:auto"> Recursivo (-R)</label></div>
          <label>Comando</label>
          <div class="row" style="flex-wrap:nowrap;margin-top:0">
            <div id="chCmd" class="output" style="flex:1"></div>
            <button class="btn ghost" data-act="copy">Copiar</button>
          </div>
          <label style="margin-top:12px">Así se ve en <span class="mono">ls -l</span></label>
          <div id="chLs" class="output"></div>
          <label style="margin-top:12px">Qué significa</label>
          <div id="chExplain" class="output" style="font-family:var(--sans)"></div>
          <p id="chWarn" class="error" style="margin:10px 0 0"></p>
        </div>
      </div>`,
    mount(root) {
      // Estado: 9 bits normales + 3 especiales
      const leerEstado = () => {
        const especial = ESPECIALES.reduce((s, [id, , v]) => s + ($(`[data-esp="${id}"]`, root).checked ? v : 0), 0);
        const digitos = QUIEN.map(([k]) => PERM.reduce((s, [p, , v]) => s + ($(`[data-perm="${k}${p}"]`, root).checked ? v : 0), 0));
        return { especial, digitos };
      };

      const escribirEstado = ({ especial, digitos }) => {
        QUIEN.forEach(([k], i) => PERM.forEach(([p, , v]) => {
          $(`[data-perm="${k}${p}"]`, root).checked = (digitos[i] & v) !== 0;  // operación AND a nivel de bits
        }));
        ESPECIALES.forEach(([id, , v]) => { $(`[data-esp="${id}"]`, root).checked = (especial & v) !== 0; });
      };

      // Construye "rwxr-xr-x" considerando s/S y t/T de los bits especiales
      const simbolico = ({ especial, digitos }) => digitos.map((d, i) => {
        let r = (d & 4 ? 'r' : '-') + (d & 2 ? 'w' : '-');
        const x = d & 1;
        const bitEsp = [especial & 4, especial & 2, especial & 1][i];
        const letra = i === 2 ? 't' : 's';
        r += bitEsp ? (x ? letra : letra.toUpperCase()) : (x ? 'x' : '-');
        return r;
      }).join('');

      const parseSimbolico = (s) => {
        s = s.trim();
        if (s.length === 10) s = s.slice(1);  // quita el tipo (-, d, l)
        if (!/^[r-][w-][xsS-][r-][w-][xsS-][r-][w-][xtT-]$/.test(s)) return null;
        let especial = 0;
        const digitos = [0, 1, 2].map(i => {
          const t = s.slice(i * 3, i * 3 + 3);
          if (/[sStT]/.test(t[2])) especial |= [4, 2, 1][i];
          return (t[0] === 'r' ? 4 : 0) + (t[1] === 'w' ? 2 : 0) + (/[xst]/.test(t[2]) ? 1 : 0);
        });
        return { especial, digitos };
      };

      const parseOctal = (s) => {
        if (!/^[0-7]{3,4}$/.test(s.trim())) return null;
        const d = s.trim().padStart(4, '0').split('').map(Number);
        return { especial: d[0], digitos: d.slice(1) };
      };

      const pintar = (origen) => {
        const est = leerEstado();
        const oct = (est.especial ? String(est.especial) : '') + est.digitos.join('');
        const sym = simbolico(est);
        if (origen !== 'oct') $('#chOct', root).value = oct;
        if (origen !== 'sym') $('#chSym', root).value = sym;
        $('#chOct', root).classList.remove('invalid');
        $('#chSym', root).classList.remove('invalid');
        QUIEN.forEach(([k], i) => { $(`#val_${k}`, root).textContent = est.digitos[i]; });

        const archivo = $('#chFile', root).value.trim() || 'archivo';
        const rec = $('#chRec', root).checked ? '-R ' : '';
        $('#chCmd', root).textContent = `chmod ${rec}${oct} ${q(archivo)}`;
        $('#chLs', root).textContent = `${$('#chTipo', root).value}${sym}  1 usuario grupo  4096  ${archivo}`;

        const verbos = (d) => {
          const v = [];
          if (d & 4) v.push('leer');
          if (d & 2) v.push('escribir');
          if (d & 1) v.push('ejecutar');
          return v.length ? lista(v) : 'sin permisos';
        };
        let expl = QUIEN.map(([, n], i) => `${n}: ${verbos(est.digitos[i])}`).join('\n');
        ESPECIALES.forEach(([, n, v, t]) => { if (est.especial & v) expl += `\n${n}: ${t}`; });
        $('#chExplain', root).textContent = expl;

        $('#chWarn', root).textContent = est.digitos[2] & 2
          ? '⚠ Cualquier usuario del sistema puede modificar esto. Evita 777 en servidores.' : '';
      };

      root.addEventListener('change', (e) => {
        if (e.target.dataset.perm || e.target.dataset.esp || e.target.id === 'chRec' || e.target.id === 'chTipo') pintar();
      });
      $('#chFile', root).addEventListener('input', () => pintar());

      $('#chOct', root).addEventListener('input', (e) => {
        const est = parseOctal(e.target.value);
        if (!est) return e.target.classList.add('invalid');
        escribirEstado(est); pintar('oct');
      });
      $('#chSym', root).addEventListener('input', (e) => {
        const est = parseSimbolico(e.target.value);
        if (!est) return e.target.classList.add('invalid');
        escribirEstado(est); pintar('sym');
      });

      root.addEventListener('click', (e) => {
        if (e.target.dataset.preset) { escribirEstado(parseOctal(e.target.dataset.preset)); pintar(); }
        if (e.target.dataset.act === 'copy') copy($('#chCmd', root).textContent);
      });

      escribirEstado(parseOctal('755'));
      pintar();
    }
  };

  /* =====================================================
     DOCKER RUN
     ===================================================== */
  const DOCKER_PRESETS = {
    nginx: { imagen: 'nginx', tag: 'alpine', nombre: 'web', puertos: '8080:80', volumenes: './sitio:/usr/share/nginx/html:ro', env: '', d: true },
    mysql: { imagen: 'mysql', tag: '8.4', nombre: 'mysql-db', puertos: '3306:3306', volumenes: 'mysql_datos:/var/lib/mysql', env: 'MYSQL_ROOT_PASSWORD=cambia_esto\nMYSQL_DATABASE=escuela', d: true, restart: 'unless-stopped' },
    postgres: { imagen: 'postgres', tag: '17', nombre: 'pg', puertos: '5432:5432', volumenes: 'pg_datos:/var/lib/postgresql/data', env: 'POSTGRES_PASSWORD=cambia_esto', d: true, restart: 'unless-stopped' },
    redis: { imagen: 'redis', tag: '', nombre: 'cache', puertos: '6379:6379', volumenes: '', env: '', d: true },
    ubuntu: { imagen: 'ubuntu', tag: '24.04', nombre: '', puertos: '', volumenes: '', env: '', it: true, rm: true, cmd: 'bash' }
  };

  const docker = {
    title: 'docker run',
    desc: 'Llena el formulario y obtén el comando docker run completo, con cada opción explicada.',
    html: () => `
      <div class="card">
        <label>Presets</label>
        <div class="row" style="margin-top:0">
          ${Object.keys(DOCKER_PRESETS).map(k => `<button class="btn ghost small" data-preset="${k}">${k}</button>`).join('')}
          <button class="btn ghost small" data-act="clear">Limpiar</button>
        </div>
      </div>
      <div class="grid-2">
        <div class="card form-stack">
          <div class="grid-2">
            <div><label for="dkImg">Imagen *</label><input id="dkImg" class="mono" placeholder="nginx"></div>
            <div><label for="dkTag">Tag (versión)</label><input id="dkTag" class="mono" placeholder="latest"></div>
          </div>
          <div class="grid-2">
            <div><label for="dkName">Nombre del contenedor</label><input id="dkName" class="mono" placeholder="mi-app"></div>
            <div><label for="dkRestart">Reinicio</label>
              <select id="dkRestart">
                <option value="">No reiniciar</option><option value="always">always</option>
                <option value="unless-stopped">unless-stopped</option><option value="on-failure">on-failure</option>
              </select></div>
          </div>
          <div class="row">
            <label title="Corre en segundo plano"><input type="checkbox" id="dkD" style="width:auto"> -d (segundo plano)</label>
            <label title="Borra el contenedor al detenerse"><input type="checkbox" id="dkRm" style="width:auto"> --rm</label>
            <label title="Terminal interactiva"><input type="checkbox" id="dkIt" style="width:auto"> -it</label>
          </div>
          <div><label for="dkPorts">Puertos <small>(host:contenedor, uno por línea)</small></label><textarea id="dkPorts" class="small-ta" placeholder="8080:80"></textarea></div>
          <div><label for="dkVols">Volúmenes <small>(origen:destino, uno por línea)</small></label><textarea id="dkVols" class="small-ta" placeholder="./datos:/app/datos"></textarea></div>
          <div><label for="dkEnv">Variables de entorno <small>(CLAVE=valor, una por línea)</small></label><textarea id="dkEnv" class="small-ta" placeholder="TZ=America/Mexico_City"></textarea></div>
          <div class="grid-2">
            <div><label for="dkNet">Red</label><input id="dkNet" class="mono" placeholder="bridge"></div>
            <div><label for="dkCmd">Comando al iniciar</label><input id="dkCmd" class="mono" placeholder="bash"></div>
          </div>
        </div>
        <div class="card">
          <div class="row" style="margin-top:0;justify-content:space-between">
            <label style="margin:0">Comando generado</label>
            <span>
              <label style="display:inline"><input type="checkbox" id="dkMulti" style="width:auto"> Multilínea</label>
              <button class="btn ghost small" data-act="copy">Copiar</button>
            </span>
          </div>
          <div id="dkOut" class="output"></div>
          <p id="dkErr" class="error" style="margin:8px 0 0"></p>
          <label style="margin-top:12px">Qué hace cada parte</label>
          <dl id="dkExplain" class="kv parts"></dl>
        </div>
      </div>`,
    mount(root) {
      const val = (id) => $(id, root).value.trim();

      const generar = () => {
        const errores = [];
        const partes = [];      // [fragmento, explicación]
        const img = val('#dkImg');

        if ($('#dkD', root).checked) partes.push(['-d', 'Corre en segundo plano y te regresa la terminal']);
        if ($('#dkRm', root).checked) partes.push(['--rm', 'Borra el contenedor cuando se detiene']);
        if ($('#dkIt', root).checked) partes.push(['-it', 'Abre una terminal interactiva dentro del contenedor']);
        if ($('#dkD', root).checked && $('#dkRm', root).checked === false && $('#dkIt', root).checked) {
          errores.push('-d con -it es poco común: el contenedor corre en segundo plano y no verás la terminal.');
        }
        if (val('#dkName')) {
          if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(val('#dkName'))) errores.push('El nombre solo admite letras, números, _ . -');
          partes.push([`--name ${val('#dkName')}`, `El contenedor se llamará "${val('#dkName')}"`]);
        }
        if (val('#dkRestart')) {
          if ($('#dkRm', root).checked) errores.push('--rm y --restart no se pueden usar juntos.');
          partes.push([`--restart ${val('#dkRestart')}`, 'Política de reinicio automático']);
        }
        lineas($('#dkPorts', root).value).forEach(p => {
          const m = p.match(/^(?:(\d{1,3}(?:\.\d{1,3}){3}):)?(\d{1,5}):(\d{1,5})(\/(tcp|udp))?$/);
          if (!m || Number(m[2]) > 65535 || Number(m[3]) > 65535) { errores.push(`Puerto inválido: "${p}"`); return; }
          partes.push([`-p ${p}`, `Puerto ${m[2]} de tu PC → puerto ${m[3]} del contenedor`]);
        });
        lineas($('#dkVols', root).value).forEach(v => {
          const [origen, destino] = v.split(':');
          if (!origen || !destino || !destino.startsWith('/')) { errores.push(`Volumen inválido: "${v}" (el destino debe ser ruta absoluta)`); return; }
          const tipo = /^[./~]/.test(origen) ? 'carpeta de tu PC' : 'volumen de Docker';
          partes.push([`-v ${q(v)}`, `${tipo} "${origen}" se monta en ${destino}${v.endsWith(':ro') ? ' (solo lectura)' : ''}`]);
        });
        lineas($('#dkEnv', root).value).forEach(e => {
          if (!/^[A-Za-z_][A-Za-z0-9_]*=/.test(e)) { errores.push(`Variable inválida: "${e}" (usa CLAVE=valor)`); return; }
          partes.push([`-e ${q(e)}`, `Variable de entorno ${e.split('=')[0]}`]);
        });
        if (val('#dkNet')) partes.push([`--network ${val('#dkNet')}`, `Se conecta a la red "${val('#dkNet')}"`]);

        if (!img) errores.unshift('Falta la imagen.');
        else {
          const ref = val('#dkTag') ? `${img}:${val('#dkTag')}` : img;
          partes.push([ref, `Imagen a usar${val('#dkTag') ? '' : ' (sin tag = latest)'}`]);
        }
        if (val('#dkCmd')) partes.push([val('#dkCmd'), 'Comando que se ejecuta al iniciar el contenedor']);

        const multi = $('#dkMulti', root).checked;
        const frags = partes.map(p => p[0]);
        $('#dkOut', root).textContent = img
          ? 'docker run' + (multi ? frags.map(f => ` \\\n  ${f}`).join('') : ' ' + frags.join(' '))
          : '';
        $('#dkErr', root).innerHTML = errores.map(esc).join('<br>');
        $('#dkExplain', root).innerHTML = partes.map(([f, t]) => `<dt>${esc(f)}</dt><dd style="font-family:var(--sans)">${esc(t)}</dd>`).join('');
      };

      const cargar = (p) => {
        $('#dkImg', root).value = p.imagen || '';
        $('#dkTag', root).value = p.tag || '';
        $('#dkName', root).value = p.nombre || '';
        $('#dkRestart', root).value = p.restart || '';
        $('#dkPorts', root).value = p.puertos || '';
        $('#dkVols', root).value = p.volumenes || '';
        $('#dkEnv', root).value = p.env || '';
        $('#dkNet', root).value = p.red || '';
        $('#dkCmd', root).value = p.cmd || '';
        $('#dkD', root).checked = !!p.d;
        $('#dkRm', root).checked = !!p.rm;
        $('#dkIt', root).checked = !!p.it;
        generar();
      };

      root.addEventListener('input', generar);
      root.addEventListener('change', generar);
      root.addEventListener('click', (e) => {
        if (e.target.dataset.preset) cargar(DOCKER_PRESETS[e.target.dataset.preset]);
        if (e.target.dataset.act === 'clear') cargar({});
        if (e.target.dataset.act === 'copy' && $('#dkOut', root).textContent) copy($('#dkOut', root).textContent);
      });
      cargar({ imagen: 'nginx', puertos: '8080:80', d: true });
    }
  };

  /* =====================================================
     TAR
     ===================================================== */
  const COMPRESION = {
    none:  { flag: '',  ext: '.tar',     nombre: 'Sin comprimir' },
    gzip:  { flag: 'z', ext: '.tar.gz',  nombre: 'gzip (rápido, el más común)' },
    bzip2: { flag: 'j', ext: '.tar.bz2', nombre: 'bzip2 (comprime más, más lento)' },
    xz:    { flag: 'J', ext: '.tar.xz',  nombre: 'xz (máxima compresión)' }
  };

  const tar = {
    title: 'tar',
    desc: 'Genera comandos tar para comprimir, extraer o listar archivos, explicando cada letra.',
    html: () => `
      <div class="grid-2">
        <div class="card form-stack">
          <div class="grid-2">
            <div><label for="tarOp">Operación</label>
              <select id="tarOp">
                <option value="c">Comprimir (crear)</option>
                <option value="x">Extraer</option>
                <option value="t">Listar contenido</option>
              </select></div>
            <div><label for="tarComp">Compresión</label>
              <select id="tarComp">${Object.entries(COMPRESION).map(([k, c]) => `<option value="${k}" ${k === 'gzip' ? 'selected' : ''}>${c.ext} · ${c.nombre}</option>`).join('')}</select></div>
          </div>
          <div><label for="tarFile">Nombre del archivo .tar</label><input id="tarFile" class="mono" value="respaldo.tar.gz"></div>
          <div id="tarSrcBox"><label for="tarSrc">Archivos o carpetas a incluir <small>(uno por línea)</small></label>
            <textarea id="tarSrc" class="small-ta">proyecto/
notas.txt</textarea></div>
          <div id="tarExclBox"><label for="tarExcl">Excluir <small>(patrones, uno por línea)</small></label>
            <textarea id="tarExcl" class="small-ta" placeholder="node_modules&#10;*.log"></textarea></div>
          <div id="tarDestBox" hidden><label for="tarDest">Extraer en la carpeta (-C)</label><input id="tarDest" class="mono" placeholder="/home/usuario/destino"></div>
          <div class="row">
            <label><input type="checkbox" id="tarV" checked style="width:auto"> -v Mostrar cada archivo</label>
            <label><input type="checkbox" id="tarDate" style="width:auto"> Agregar fecha al nombre</label>
          </div>
        </div>
        <div class="card">
          <label>Comando generado</label>
          <div class="row" style="flex-wrap:nowrap;margin-top:0">
            <div id="tarOut" class="output" style="flex:1"></div>
            <button class="btn ghost" data-act="copy">Copiar</button>
          </div>
          <p id="tarErr" class="error" style="margin:8px 0 0"></p>
          <label style="margin-top:12px">Qué hace cada letra</label>
          <dl id="tarExplain" class="kv parts"></dl>
        </div>
      </div>`,
    mount(root) {
      // Cambia la extensión del nombre al cambiar la compresión
      const ajustarExtension = () => {
        const inp = $('#tarFile', root);
        const base = inp.value.trim().replace(/\.(tar\.gz|tgz|tar\.bz2|tar\.xz|tar)$/i, '') || 'respaldo';
        inp.value = base + COMPRESION[$('#tarComp', root).value].ext;
      };

      const generar = () => {
        const op = $('#tarOp', root).value;
        const comp = COMPRESION[$('#tarComp', root).value];
        const v = $('#tarV', root).checked;
        $('#tarSrcBox', root).hidden = op !== 'c';
        $('#tarExclBox', root).hidden = op !== 'c';
        $('#tarDestBox', root).hidden = op !== 'x';

        let archivo = $('#tarFile', root).value.trim() || 'respaldo' + comp.ext;
        if ($('#tarDate', root).checked && op === 'c') {
          archivo = archivo.replace(/(\.tar.*)$/, '_$$(date +%F)$1');
        }
        const flags = op + comp.flag + (v ? 'v' : '') + 'f';
        const explica = [
          [op, { c: 'Crear un archivo nuevo', x: 'Extraer el contenido', t: 'Listar el contenido sin extraer' }[op]]
        ];
        if (comp.flag) explica.push([comp.flag, `Usar compresión ${comp.nombre.split(' ')[0]}`]);
        if (v) explica.push(['v', 'Verbose: muestra cada archivo procesado']);
        explica.push(['f', 'El siguiente parámetro es el nombre del archivo .tar']);

        const errores = [];
        let cmd = `tar -${flags} ${archivo.includes('$(') ? `"${archivo}"` : q(archivo)}`;

        if (op === 'c') {
          lineas($('#tarExcl', root).value).forEach(p => {
            cmd += ` --exclude=${q(p)}`;
            explica.push([`--exclude=${p}`, 'No incluir lo que coincida con este patrón']);
          });
          const src = lineas($('#tarSrc', root).value);
          if (!src.length) errores.push('Indica al menos un archivo o carpeta.');
          cmd += ' ' + src.map(q).join(' ');
          if (src.length) explica.push([src.join(' '), 'Lo que se va a empaquetar']);
        }
        if (op === 'x' && $('#tarDest', root).value.trim()) {
          const dest = $('#tarDest', root).value.trim();
          cmd += ` -C ${q(dest)}`;
          explica.push([`-C ${dest}`, 'Carpeta donde se extrae (debe existir)']);
        }
        if (archivo.includes('$(date')) explica.push(['$(date +%F)', 'Se reemplaza por la fecha actual, ej. 2026-11-16']);
        if (op !== 'c' && !archivo.endsWith(comp.ext) && comp.flag) {
          errores.push(`El nombre no termina en ${comp.ext}; revisa la compresión elegida.`);
        }

        $('#tarOut', root).textContent = cmd.trim();
        $('#tarErr', root).textContent = errores.join(' ');
        $('#tarExplain', root).innerHTML = explica.map(([k, t]) => `<dt>${esc(k)}</dt><dd style="font-family:var(--sans)">${esc(t)}</dd>`).join('');
      };

      $('#tarComp', root).addEventListener('change', ajustarExtension);
      root.addEventListener('input', generar);
      root.addEventListener('change', generar);
      root.addEventListener('click', (e) => {
        if (e.target.dataset.act === 'copy') copy($('#tarOut', root).textContent);
      });
      generar();
    }
  };

  return { cron, chmod, docker, tar };
})();
