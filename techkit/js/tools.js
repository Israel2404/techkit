/* =========================================================
   tools.js - Módulo DevToolbox
   Cada herramienta es un objeto con:
     title  -> título de la vista
     desc   -> descripción corta
     html   -> función que regresa el marcado
     mount  -> función que conecta los eventos (recibe el contenedor)
   ========================================================= */
const { $, escape: esc, copy, b64encode, b64decode } = Utils;

const Tools = {

  /* ---------- 1. Formateador / validador JSON ---------- */
  json: {
    title: 'JSON',
    desc: 'Formatea, minifica y valida JSON. Indica la posición del error.',
    html: () => `
      <div class="card">
        <label for="jsonIn">Entrada</label>
        <textarea id="jsonIn" placeholder='{"nombre":"Israel","activo":true}'></textarea>
        <div class="row">
          <button class="btn" data-act="format">Formatear</button>
          <button class="btn ghost" data-act="minify">Minificar</button>
          <button class="btn ghost" data-act="copy">Copiar resultado</button>
          <select id="jsonIndent" style="width:auto" aria-label="Indentación">
            <option value="2">2 espacios</option>
            <option value="4">4 espacios</option>
            <option value="\t">Tab</option>
          </select>
        </div>
        <div id="jsonOut" class="output"></div>
      </div>`,
    mount(root) {
      const input = $('#jsonIn', root);
      const out = $('#jsonOut', root);

      const run = (minify) => {
        try {
          const data = JSON.parse(input.value);
          const indentVal = $('#jsonIndent', root).value;
          const indent = indentVal === '\\t' ? '\t' : Number(indentVal);
          out.className = 'output';
          out.textContent = minify ? JSON.stringify(data) : JSON.stringify(data, null, indent);
        } catch (err) {
          out.className = 'output error';
          out.textContent = 'JSON inválido: ' + err.message;
        }
      };

      root.addEventListener('click', (e) => {
        const act = e.target.dataset.act;
        if (act === 'format') run(false);
        if (act === 'minify') run(true);
        if (act === 'copy' && out.textContent) copy(out.textContent);
      });
    }
  },

  /* ---------- 2. Base64 y codificación URL ---------- */
  base64: {
    title: 'Base64 / URL',
    desc: 'Codifica y decodifica texto en Base64 (con soporte UTF-8) y en formato URL.',
    html: () => `
      <div class="card">
        <label for="b64In">Texto</label>
        <textarea id="b64In" placeholder="Hola, ¿qué tal?"></textarea>
        <div class="row">
          <button class="btn" data-act="b64enc">Base64 → codificar</button>
          <button class="btn ghost" data-act="b64dec">Base64 → decodificar</button>
          <button class="btn" data-act="urlenc">URL → codificar</button>
          <button class="btn ghost" data-act="urldec">URL → decodificar</button>
          <button class="btn ghost" data-act="copy">Copiar</button>
        </div>
        <div id="b64Out" class="output"></div>
      </div>`,
    mount(root) {
      const input = $('#b64In', root);
      const out = $('#b64Out', root);
      const ops = {
        b64enc: v => b64encode(v),
        b64dec: v => b64decode(v),
        urlenc: v => encodeURIComponent(v),
        urldec: v => decodeURIComponent(v)
      };
      root.addEventListener('click', (e) => {
        const act = e.target.dataset.act;
        if (act === 'copy') return out.textContent && copy(out.textContent);
        if (!ops[act]) return;
        try {
          out.className = 'output';
          out.textContent = ops[act](input.value);
        } catch {
          out.className = 'output error';
          out.textContent = 'La entrada no es válida para esta operación.';
        }
      });
    }
  },

  /* ---------- 3. Decodificador JWT ---------- */
  jwt: {
    title: 'Decodificar JWT',
    desc: 'Muestra el header y el payload de un token y revisa su expiración. No verifica la firma.',
    html: () => `
      <div class="card">
        <label for="jwtIn">Token</label>
        <textarea id="jwtIn" style="min-height:110px" placeholder="eyJhbGciOiJIUzI1NiIs..."></textarea>
        <div class="row"><button class="btn" data-act="decode">Decodificar</button></div>
        <div id="jwtStatus"></div>
      </div>
      <div class="grid-2">
        <div class="card"><label>Header</label><div id="jwtHead" class="output"></div></div>
        <div class="card"><label>Payload</label><div id="jwtBody" class="output"></div></div>
      </div>`,
    mount(root) {
      root.addEventListener('click', (e) => {
        if (e.target.dataset.act !== 'decode') return;
        const status = $('#jwtStatus', root);
        const parts = $('#jwtIn', root).value.trim().split('.');
        try {
          if (parts.length !== 3) throw new Error('Un JWT debe tener 3 partes separadas por punto.');
          const header = JSON.parse(b64decode(parts[0]));
          const payload = JSON.parse(b64decode(parts[1]));
          $('#jwtHead', root).textContent = JSON.stringify(header, null, 2);
          $('#jwtBody', root).textContent = JSON.stringify(payload, null, 2);

          // Revisión de fechas estándar (exp / iat en segundos Unix)
          if (payload.exp) {
            const exp = new Date(payload.exp * 1000);
            const vigente = exp > new Date();
            status.innerHTML = `<p class="${vigente ? 'ok' : 'error'}">
              ${vigente ? 'Vigente' : 'Expirado'} · expira: ${exp.toLocaleString('es-MX')}</p>`;
          } else {
            status.innerHTML = '<p class="ok">Decodificado (sin campo exp).</p>';
          }
        } catch (err) {
          status.innerHTML = `<p class="error">${esc(err.message)}</p>`;
        }
      });
    }
  },

  /* ---------- 4. Hash con Web Crypto API ---------- */
  hash: {
    title: 'Hash SHA',
    desc: 'Genera hashes SHA-1, SHA-256, SHA-384 y SHA-512 con la Web Crypto API del navegador.',
    html: () => `
      <div class="card">
        <label for="hashIn">Texto</label>
        <textarea id="hashIn" style="min-height:110px"></textarea>
        <div class="row"><button class="btn" data-act="hash">Generar hashes</button></div>
        <dl id="hashOut" class="kv"></dl>
      </div>`,
    mount(root) {
      // crypto.subtle.digest regresa un ArrayBuffer -> lo pasamos a hexadecimal
      const digest = async (algo, text) => {
        const buf = await crypto.subtle.digest(algo, new TextEncoder().encode(text));
        return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
      };
      root.addEventListener('click', async (e) => {
        if (e.target.dataset.act !== 'hash') return;
        const out = $('#hashOut', root);
        if (!window.crypto?.subtle) {
          out.innerHTML = '<dd class="error">Web Crypto requiere HTTPS o localhost.</dd>';
          return;
        }
        const text = $('#hashIn', root).value;
        const algos = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'];
        const results = await Promise.all(algos.map(a => digest(a, text)));
        out.innerHTML = algos.map((a, i) =>
          `<dt>${a}</dt><dd><span>${results[i]}</span>
           <button class="btn ghost small" data-copy="${results[i]}">Copiar</button></dd>`
        ).join('');
      });
      root.addEventListener('click', (e) => {
        if (e.target.dataset.copy) copy(e.target.dataset.copy);
      });
    }
  },

  /* ---------- 5. Generador de UUID (v4 y v7) ---------- */
  uuid: {
    title: 'UUID',
    desc: 'Genera identificadores únicos v7 (ordenados por tiempo, ideales para bases de datos) o v4 (aleatorios).',
    html: () => `
      <div class="grid-2">
        <div class="card">
          <div class="grid-2">
            <div>
              <label for="uuidVer">Versión</label>
              <select id="uuidVer">
                <option value="7" selected>v7 (recomendado)</option>
                <option value="4">v4 (aleatorio)</option>
              </select>
            </div>
            <div>
              <label for="uuidQty">Cantidad</label>
              <input id="uuidQty" type="number" min="1" max="1000" value="5">
            </div>
          </div>
          <div class="row">
            <label><input type="checkbox" id="uuidUpper" style="width:auto"> Mayúsculas</label>
            <label><input type="checkbox" id="uuidNoDash" style="width:auto"> Sin guiones</label>
          </div>
          <div class="row">
            <button class="btn" data-act="gen">Generar</button>
            <button class="btn ghost" data-act="copy">Copiar todos</button>
            <button class="btn ghost" data-act="txt">Descargar .txt</button>
          </div>
          <div id="uuidOut" class="output"></div>
        </div>

        <div class="card">
          <label for="uuidInspect">Inspeccionar un UUID</label>
          <input id="uuidInspect" class="mono" placeholder="Pega un UUID para ver su versión y, si es v7, su fecha">
          <dl id="uuidInfo" class="kv" style="margin-top:12px"></dl>
          <hr style="border:0;border-top:1px solid var(--border);margin:16px 0">
          <p style="margin:0 0 6px"><b>¿v4 o v7?</b></p>
          <p style="margin:0;color:var(--muted);font-size:14px">
            <b>v4</b> es 100% aleatorio: como llave primaria se inserta en posiciones al azar del índice,
            lo que fragmenta la tabla y vuelve lentas las inserciones.<br><br>
            <b>v7</b> empieza con la fecha en milisegundos y luego lleva bits aleatorios:
            los registros nuevos quedan al final del índice (como un autoincremental),
            se pueden ordenar por fecha de creación y siguen siendo únicos entre servidores.
          </p>
        </div>
      </div>`,
    mount(root) {
      const hex = (bytes) => [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
      const format = (h) => `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;

      // UUID v4: 122 bits aleatorios (lo implementa el navegador)
      const uuidv4 = () => crypto.randomUUID();

      // UUID v7 (RFC 9562):
      //  48 bits  -> timestamp Unix en milisegundos
      //   4 bits  -> versión (0111 = 7)
      //  12 bits  -> contador para mantener el orden dentro del mismo milisegundo
      //   2 bits  -> variante (10)
      //  62 bits  -> aleatorios
      let lastMs = -1, seq = 0;
      const uuidv7 = () => {
        const b = new Uint8Array(16);
        crypto.getRandomValues(b);
        let ms = Date.now();
        if (ms > lastMs) {
          lastMs = ms;
          seq = ((b[6] << 8) | b[7]) & 0x7ff;   // contador inicial aleatorio, con margen
        } else {
          seq++;                                 // mismo milisegundo: se incrementa
          if (seq > 0xfff) { lastMs++; seq = 0; } // se desborda: avanza 1 ms
          ms = lastMs;
        }
        for (let i = 0; i < 6; i++) b[i] = Math.floor(ms / 2 ** (8 * (5 - i))) % 256;
        b[6] = 0x70 | (seq >> 8);                // versión 7 + 4 bits altos del contador
        b[7] = seq & 0xff;
        b[8] = (b[8] & 0x3f) | 0x80;             // variante RFC
        return format(hex(b));
      };

      const generar = () => {
        const n = Math.min(Math.max(Math.floor(Number($('#uuidQty', root).value)) || 1, 1), 1000);
        $('#uuidQty', root).value = n;
        const fn = $('#uuidVer', root).value === '7' ? uuidv7 : uuidv4;
        let list = Array.from({ length: n }, fn);
        if ($('#uuidNoDash', root).checked) list = list.map(u => u.replace(/-/g, ''));
        if ($('#uuidUpper', root).checked) list = list.map(u => u.toUpperCase());
        $('#uuidOut', root).textContent = list.join('\n');
      };

      // Detecta versión y, si es v7, extrae la fecha de los primeros 48 bits
      const inspeccionar = () => {
        const info = $('#uuidInfo', root);
        const raw = $('#uuidInspect', root).value.trim().toLowerCase().replace(/[{}]/g, '');
        if (!raw) { info.innerHTML = ''; return; }
        const h = raw.replace(/-/g, '');
        if (!/^[0-9a-f]{32}$/.test(h)) {
          info.innerHTML = '<dt>Estado</dt><dd class="error">No es un UUID válido</dd>';
          return;
        }
        const ver = parseInt(h[12], 16);
        let html = `<dt>Formato</dt><dd>${format(h)}</dd><dt>Versión</dt><dd>v${ver}</dd>`;
        if (ver === 7) {
          const fecha = new Date(parseInt(h.slice(0, 12), 16));
          html += `<dt>Creado (local)</dt><dd>${fecha.toLocaleString('es-MX')}</dd>
                   <dt>Creado (ISO)</dt><dd>${fecha.toISOString()}</dd>`;
        } else if (ver === 4) {
          html += '<dt>Fecha</dt><dd>v4 no guarda fecha, es aleatorio</dd>';
        }
        info.innerHTML = html;
      };

      root.addEventListener('click', (e) => {
        const act = e.target.dataset.act;
        const out = $('#uuidOut', root).textContent;
        if (act === 'gen') generar();
        if (act === 'copy' && out) copy(out);
        if (act === 'txt' && out) Utils.download('uuids.txt', out);
      });
      $('#uuidInspect', root).addEventListener('input', inspeccionar);
      generar();
    }
  },

  /* ---------- 6. Generador de contraseñas ---------- */
  password: {
    title: 'Contraseñas',
    desc: 'Genera varias contraseñas seguras a la vez, por ejemplo una para cada usuario nuevo.',
    html: () => `
      <div class="card">
        <div class="grid-2">
          <div>
            <label for="pwQty">Cantidad de contraseñas (usuarios)</label>
            <input id="pwQty" type="number" min="1" max="500" value="5">
          </div>
          <div>
            <label for="pwLen">Longitud de cada contraseña</label>
            <input id="pwLen" type="number" min="6" max="128" value="16">
          </div>
        </div>
        <div class="row">
          <label><input type="checkbox" id="pwLower" checked style="width:auto"> Minúsculas</label>
          <label><input type="checkbox" id="pwUpper" checked style="width:auto"> Mayúsculas</label>
          <label><input type="checkbox" id="pwNum" checked style="width:auto"> Números</label>
          <label><input type="checkbox" id="pwSym" checked style="width:auto"> Símbolos</label>
          <label><input type="checkbox" id="pwAmb" style="width:auto"> Excluir parecidos (0 O l 1 I)</label>
        </div>
        <div class="row">
          <button class="btn" data-act="gen">Generar</button>
          <button class="btn ghost" data-act="copy">Copiar todas</button>
          <button class="btn ghost" data-act="csv">Descargar CSV</button>
        </div>
        <p id="pwStrength" style="margin:0 0 10px;font-size:14px"></p>
        <div id="pwOut" class="output"></div>
      </div>`,
    mount(root) {
      const SETS = {
        pwLower: 'abcdefghijklmnopqrstuvwxyz',
        pwUpper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        pwNum: '0123456789',
        pwSym: '!@#$%^&*()-_=+[]{};:,.?'
      };
      let generadas = [];

      // Número aleatorio uniforme en [0, max) SIN sesgo de módulo (rechaza valores sobrantes)
      const randomInt = (max) => {
        const limit = Math.floor(0x100000000 / max) * max;
        const arr = new Uint32Array(1);
        do { crypto.getRandomValues(arr); } while (arr[0] >= limit);
        return arr[0] % max;
      };

      // Mezcla Fisher-Yates con aleatoriedad criptográfica
      const shuffle = (a) => {
        for (let i = a.length - 1; i > 0; i--) {
          const j = randomInt(i + 1);
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
      };

      const generar = () => {
        const qty = Math.min(Math.max(Math.floor(Number($('#pwQty', root).value)) || 1, 1), 500);
        const len = Math.min(Math.max(Math.floor(Number($('#pwLen', root).value)) || 16, 6), 128);
        $('#pwQty', root).value = qty;
        $('#pwLen', root).value = len;

        const sinParecidos = $('#pwAmb', root).checked;
        const grupos = Object.keys(SETS)
          .filter(id => $('#' + id, root).checked)
          .map(id => sinParecidos ? SETS[id].replace(/[0Ol1I]/g, '') : SETS[id]);

        if (!grupos.length) {
          $('#pwOut', root).innerHTML = '<span class="error">Selecciona al menos un tipo de carácter.</span>';
          $('#pwStrength', root).textContent = '';
          generadas = [];
          return;
        }
        const todos = grupos.join('');

        // Cada contraseña lleva al menos un carácter de cada tipo elegido
        const una = () => {
          const chars = grupos.map(g => g[randomInt(g.length)]);
          while (chars.length < len) chars.push(todos[randomInt(todos.length)]);
          return shuffle(chars).join('');
        };
        generadas = Array.from({ length: qty }, una);
        $('#pwOut', root).textContent = generadas.join('\n');

        // Entropía aproximada = longitud × log2(tamaño del alfabeto)
        const bits = Math.round(len * Math.log2(todos.length));
        const nivel = bits >= 100 ? ['Muy fuerte', 'ok'] : bits >= 70 ? ['Fuerte', 'ok']
                    : bits >= 50 ? ['Media', ''] : ['Débil', 'error'];
        $('#pwStrength', root).innerHTML =
          `Fortaleza: <b class="${nivel[1]}">${nivel[0]}</b> · ~${bits} bits de entropía · ${todos.length} caracteres posibles`;
      };

      root.addEventListener('click', (e) => {
        const act = e.target.dataset.act;
        if (act === 'gen') generar();
        if (act === 'copy' && generadas.length) copy(generadas.join('\n'));
        if (act === 'csv' && generadas.length) {
          // Comillas dobles escapadas por si la contraseña trae comas o comillas
          const filas = generadas.map((p, i) => `usuario${i + 1},"${p.replace(/"/g, '""')}"`);
          Utils.download('contrasenas.csv', 'usuario,contrasena\n' + filas.join('\n'), 'text/csv');
        }
      });
      root.addEventListener('change', (e) => { if (e.target.type === 'checkbox') generar(); });
      generar();
    }
  },

  /* ---------- 7. Conversor de timestamp ---------- */
  time: {
    title: 'Timestamp',
    desc: 'Convierte entre timestamp Unix (segundos o milisegundos) y fecha legible.',
    html: () => `
      <div class="card">
        <p>Ahora: <span id="nowTs" class="mono"></span></p>
      </div>
      <div class="grid-2">
        <div class="card">
          <label for="tsIn">Timestamp Unix</label>
          <input id="tsIn" class="mono" placeholder="1762732800">
          <div class="row"><button class="btn" data-act="toDate">A fecha</button></div>
          <dl id="tsOut" class="kv"></dl>
        </div>
        <div class="card">
          <label for="dateIn">Fecha y hora</label>
          <input id="dateIn" type="datetime-local">
          <div class="row"><button class="btn" data-act="toTs">A timestamp</button></div>
          <dl id="dateOut" class="kv"></dl>
        </div>
      </div>`,
    mount(root) {
      // Reloj en vivo; se limpia solo cuando la vista deja de existir
      const tick = () => {
        const el = $('#nowTs', root);
        if (!el) return clearInterval(timer);
        el.textContent = `${Math.floor(Date.now() / 1000)} s  ·  ${Date.now()} ms`;
      };
      const timer = setInterval(tick, 1000);
      tick();

      root.addEventListener('click', (e) => {
        const act = e.target.dataset.act;
        if (act === 'toDate') {
          const raw = $('#tsIn', root).value.trim();
          if (!/^\d+$/.test(raw)) {
            $('#tsOut', root).innerHTML = '<dd class="error">Escribe solo dígitos.</dd>';
            return;
          }
          // Más de 12 dígitos = milisegundos
          const ms = raw.length > 12 ? Number(raw) : Number(raw) * 1000;
          const d = new Date(ms);
          $('#tsOut', root).innerHTML = `
            <dt>Local</dt><dd>${d.toLocaleString('es-MX')}</dd>
            <dt>UTC</dt><dd>${d.toUTCString()}</dd>
            <dt>ISO 8601</dt><dd>${d.toISOString()}</dd>`;
        }
        if (act === 'toTs') {
          const v = $('#dateIn', root).value;
          if (!v) return;
          const d = new Date(v);
          $('#dateOut', root).innerHTML = `
            <dt>Segundos</dt><dd>${Math.floor(d.getTime() / 1000)}</dd>
            <dt>Milisegundos</dt><dd>${d.getTime()}</dd>
            <dt>ISO 8601</dt><dd>${d.toISOString()}</dd>`;
        }
      });
    }
  },

  /* ---------- 8. Probador de expresiones regulares ---------- */
  regex: {
    title: 'Regex',
    desc: 'Prueba expresiones regulares en vivo: resalta coincidencias y muestra grupos.',
    html: () => `
      <div class="card">
        <div class="row" style="flex-wrap:nowrap">
          <input id="rxPattern" class="mono" aria-label="Patrón de la expresión regular" placeholder="(\\d{1,3}\\.){3}\\d{1,3}">
          <input id="rxFlags" class="mono" aria-label="Flags" value="g" style="width:90px" title="Flags: g i m s u">
        </div>
        <label for="rxText">Texto de prueba</label>
        <textarea id="rxText">Servidor 192.168.1.10 ok
Gateway 10.0.0.1 ok
Equipo sin IP asignada</textarea>
      </div>
      <div class="card">
        <label>Resultado <span id="rxCount"></span></label>
        <div id="rxOut" class="output"></div>
        <label style="margin-top:12px">Coincidencias y grupos</label>
        <div id="rxGroups" class="output"></div>
      </div>`,
    mount(root) {
      const run = () => {
        const pattern = $('#rxPattern', root).value;
        const text = $('#rxText', root).value;
        const out = $('#rxOut', root);
        const groups = $('#rxGroups', root);
        if (!pattern) { out.textContent = text; groups.textContent = ''; return; }

        let rx;
        try {
          let flags = $('#rxFlags', root).value.replace(/[^gimsuy]/g, '');
          if (!flags.includes('g')) flags += 'g'; // matchAll requiere g
          rx = new RegExp(pattern, flags);
        } catch (err) {
          out.innerHTML = `<span class="error">${esc(err.message)}</span>`;
          return;
        }

        const matches = [...text.matchAll(rx)].filter(m => m[0] !== '');
        $('#rxCount', root).textContent = `(${matches.length})`;

        // Construimos el HTML resaltado recorriendo los índices de cada match
        let html = '', last = 0;
        matches.forEach(m => {
          html += esc(text.slice(last, m.index)) + `<mark>${esc(m[0])}</mark>`;
          last = m.index + m[0].length;
        });
        out.innerHTML = html + esc(text.slice(last));

        groups.textContent = matches.map((m, i) =>
          `#${i + 1} "${m[0]}" en ${m.index}` +
          (m.length > 1 ? '  grupos: ' + m.slice(1).map(g => JSON.stringify(g)).join(', ') : '')
        ).join('\n') || 'Sin coincidencias';
      };
      root.addEventListener('input', run);
      run();
    }
  }
};
