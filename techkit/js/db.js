/* =========================================================
   db.js - Capa de datos con IndexedDB (envuelta en Promesas)
   Base: techkit  |  Almacén: incidentes  |  Llave: id autoincremental
   ========================================================= */
const DB = {
  NAME: 'techkit',
  VERSION: 1,
  STORE: 'incidentes',
  _db: null,

  // Abre (o crea) la base. onupgradeneeded corre solo al crearla o subir VERSION.
  open() {
    if (this._db) return Promise.resolve(this._db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.NAME, this.VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(this.STORE)) {
          const store = db.createObjectStore(this.STORE, { keyPath: 'id', autoIncrement: true });
          store.createIndex('fecha', 'fecha');
          store.createIndex('estado', 'estado');
        }
      };
      req.onsuccess = () => { this._db = req.result; resolve(this._db); };
      req.onerror = () => reject(req.error);
    });
  },

  // Ejecuta una operación sobre el almacén y regresa su resultado como Promesa
  async _tx(mode, fn) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE, mode);
      const req = fn(tx.objectStore(this.STORE));
      tx.oncomplete = () => resolve(req?.result);
      tx.onerror = () => reject(tx.error);
    });
  },

  getAll()      { return this._tx('readonly',  s => s.getAll()); },
  get(id)       { return this._tx('readonly',  s => s.get(id)); },
  add(item)     { return this._tx('readwrite', s => s.add(item)); },
  put(item)     { return this._tx('readwrite', s => s.put(item)); },
  remove(id)    { return this._tx('readwrite', s => s.delete(id)); },
  clear()       { return this._tx('readwrite', s => s.clear()); }
};
