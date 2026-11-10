/*
 * Mide el diseño de las ocho herramientas en un navegador de verdad, con el
 * ancho de un teléfono (390 px), y dice lo que no se ve leyendo el CSS:
 *
 *   - si algo se sale de la pantalla por la derecha,
 *   - qué campos harían zoom en el iPhone (letra de menos de 16 px),
 *   - qué texto no contrasta con su fondo (menos de 4,5:1),
 *   - qué botones miden menos de 36 px.
 *
 * Es la herramienta con la que se hizo la auditoría de noviembre de 2026
 * (plan/SISTEMA_DE_DISENO.md). jsdom no sirve para esto: no tiene anchos ni
 * colores calculados. scripts/probar_diseno.py vigila en el CI lo que se puede
 * comprobar sin navegador; esto es lo que hay que correr a mano después de
 * tocar la cara de una herramienta.
 *
 *     npm install playwright        (o tener Chromium con Playwright ya instalado)
 *     node scripts/medir_diseno.js              tabla de las 19 pantallas
 *     node scripts/medir_diseno.js --detalle    además, qué elemento es cada cosa
 *     node scripts/medir_diseno.js --capturas <carpeta>   y una imagen de cada una
 *
 * No toca datos reales: los contratos son de mentira, se sirven desde aquí, y lo
 * que iría a Power Automate se corta. Sale con código 1 si algo se sale de la
 * pantalla, algún campo haría zoom o algún texto no contrasta.
 */
const fs = require('fs'), path = require('path'), http = require('http');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.error('Falta Playwright. Instálalo con:\n    npm install playwright\n'); process.exit(2); }

const RAIZ = path.dirname(__dirname);
const DETALLE = process.argv.includes('--detalle');
const iCap = process.argv.indexOf('--capturas');
const CAPTURAS = iCap > 0 ? process.argv[iCap + 1] : null;

// ---------------------------------------------------------------- portafolio de mentira
function portafolio() {
  const AREAS = ['RPF Chimborazo', 'PN Machalilla', 'PN Yasuní', 'RB El Cóndor', 'PN Cotopaxi', 'RE Los Ilinizas', 'PN Sangay', 'RPFM Galera San Francisco', 'RVS Pasochoa', 'PN Podocarpus'];
  const ACS = ['Ana Pérez', 'María Guamán', 'Lucía Andrade', 'Carla Mendoza', 'Rosa Cedeño'];
  const CATS = ['Mantenimiento', 'Combustible', 'Internet', 'Limpieza', 'Seguridad', 'Consultoría', 'Adquisición de equipos de campo', 'Alimentación'];
  const PROV = ['Servitec S.A.', 'Comercial Andina Cía. Ltda.', 'José Lecaro Vera', 'Telconet S.A.', 'Limpieza Total', 'Seguridad Integral del Pacífico SEGINPAC Cía. Ltda.', 'María Fernanda Quishpe', 'Ferretería El Constructor'];
  const OBJ = ['Servicio de mantenimiento preventivo y correctivo de los vehículos del área protegida', 'Provisión de combustible para vehículos y embarcaciones', 'Servicio de internet satelital para el puesto de control', 'Servicio de limpieza de oficinas administrativas y centro de interpretación', 'Servicio de seguridad y vigilancia', 'Consultoría para la actualización del plan de manejo', 'Adquisición de equipos de campo para guardaparques', 'Servicio de alimentación para personal en patrullajes de control y vigilancia'];
  const f = d => d.toISOString().slice(0, 10);
  // Las fechas cuelgan de hoy para que siempre haya vigentes, por vencer y vencidos.
  const hoy = new Date(); const out = [];
  for (let i = 1; i <= 139; i++) {
    const k = i % 8, plazo = [45, 90, 180, 300, 350, 30, 20, 240][k];
    const ini = new Date(hoy.getTime() - ((i * 37) % 330) * 864e5);
    const fin = new Date(ini.getTime() + plazo * 864e5);
    const monto = [1150, 7800, 2400, 5600, 12500, 18000, 3900, 950][k] + i * 10;
    out.push({
      nro: 'FIAS-FAP-' + hoy.getFullYear() + '-' + String(i).padStart(3, '0'), detalle: OBJ[k] + ' — ' + AREAS[i % 10], area: AREAS[i % 10], cat: CATS[k],
      monto, montoTotal: monto, cerrado: i % 9 === 0, inicio: f(ini), firma: f(new Date(ini.getTime() - 5 * 864e5)), fin: f(fin), tipo: i % 6 === 0 ? 'Renovación' : 'Nuevo',
      proveedor: PROV[(i * 5) % 8], plazo, adenda: i % 13 === 0 ? 'Adenda 1' : '', tipoAdenda: null, modificacion: null, firmaAdenda: null,
      ac: ACS[i % 5], correo: 'ac' + (i % 5) + '@fias.org.ec', link: i % 4 ? 'https://ejemplo.org/c' + i + '.pdf' : null, fcierre: i % 9 === 0 ? f(fin) : null, liquidado: null, saldo: null,
      carpeta: i % 11 ? String(i + 3) : null, codigoProceso: i % 3 ? null : 'RPFCH-' + hoy.getFullYear() + '-' + String(i).padStart(3, '0')
    });
  }
  return out;
}

// ---------------------------------------------------------------- servidor del repositorio
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.css': 'text/css' };
function servir() {
  return new Promise(res => {
    const s = http.createServer((q, r) => {
      let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
      const f = path.join(RAIZ, p);
      if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
      r.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
    }).listen(0, '127.0.0.1', () => res(s));
  });
}

// ---------------------------------------------------------------- la medición, dentro de la página
function medirEnPagina() {
  const vw = document.documentElement.clientWidth;
  const vis = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const desc = e => (e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '') + ' «' + (e.innerText || e.value || e.placeholder || e.title || '').trim().slice(0, 28).replace(/\n/g, ' ') + '»');
  // 1. lo que se sale por la derecha (lo que vive en un contenedor con su propio desplazamiento no cuenta)
  const enScroll = e => { for (let x = e.parentElement; x && x !== document.body; x = x.parentElement) { const o = getComputedStyle(x).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') return true; } return false; };
  const fuera = [...document.querySelectorAll('body *')].filter(e => vis(e) && e.getBoundingClientRect().right > vw + 1 && !enScroll(e)).map(e => desc(e) + ' →' + Math.round(e.getBoundingClientRect().right)).slice(0, 6);
  // 2. lo que se toca
  const tocables = [...document.querySelectorAll('button,a[href],select,input:not([type=hidden]):not([type=checkbox]):not([type=radio]),textarea,[role=button]')].filter(vis);
  const chicos = tocables.filter(e => { const r = e.getBoundingClientRect(); return r.height < 36 || r.width < 36; });
  // 3. campos que hacen zoom en iOS
  const campos = [...document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=file]):not([type=range]),select,textarea')].filter(vis);
  const zoom = campos.filter(e => parseFloat(getComputedStyle(e).fontSize) < 16);
  // 4. contraste real del texto
  const hojas = [...document.querySelectorAll('body *')].filter(e => vis(e) && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1));
  const lum = c => { const a = c.map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * a[0] + .7152 * a[1] + .0722 * a[2]; };
  const rgb = s => { const m = s.match(/rgba?\(([^)]+)\)/); return m ? m[1].split(',').map(Number) : null; };
  // Fondo opaco más cercano. Con una imagen o un degradado detrás, o un fondo a medio
  // transparentar, no se puede saber sin pintarlo: ese texto no se juzga.
  const fondo = e => { for (let x = e; x; x = x.parentElement) { const s = getComputedStyle(x); if (s.backgroundImage && s.backgroundImage !== 'none') return null; const c = rgb(s.backgroundColor); if (c && (c.length < 4 || c[3] > .95)) return c.slice(0, 3); if (c && c.length === 4 && c[3] > .05) return null; } return [255, 255, 255]; };
  const bajo = {}; let nbajo = 0;
  hojas.forEach(e => {
    const s = getComputedStyle(e), c = rgb(s.color), bg = fondo(e);
    if (!c || !bg || (c.length === 4 && c[3] < .95) || e.closest('#preview,.acta-doc,[contenteditable]') || e.disabled) return;
    const L1 = lum(c.slice(0, 3)), L2 = lum(bg), cr = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05);
    const f = parseFloat(s.fontSize), negrita = parseInt(s.fontWeight) >= 700, lim = (f >= 24 || (f >= 18.66 && negrita)) ? 3 : 4.5;
    if (cr < lim) { nbajo++; const k = s.color + ' sobre rgb(' + bg.join(', ') + ') ' + cr.toFixed(2) + ':1 a ' + f + 'px'; (bajo[k] = bajo[k] || { n: 0, ej: [] }).n++; if (bajo[k].ej.length < 2) bajo[k].ej.push((e.innerText || '').trim().slice(0, 24)); }
  });
  return {
    desborda: document.documentElement.scrollWidth - vw, fuera, tocables: tocables.length, chicos: chicos.length,
    chicosEj: chicos.slice(0, 6).map(e => desc(e) + ' ' + Math.round(e.getBoundingClientRect().width) + '×' + Math.round(e.getBoundingClientRect().height)),
    campos: campos.length, zoom: zoom.length, textos: hojas.length, bajo: nbajo,
    bajoEj: Object.keys(bajo).sort((a, b) => bajo[b].n - bajo[a].n).slice(0, 6).map(k => bajo[k].n + '× ' + k + ' — «' + bajo[k].ej.join('», «') + '»')
  };
}

(async () => {
  const srv = await servir(), BASE = 'http://127.0.0.1:' + srv.address().port + '/';
  const b = await chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const datos = JSON.stringify(portafolio());
  await ctx.route('**/contratos_export.json', r => r.fulfill({ contentType: 'application/json', body: datos }));
  await ctx.route('**/calificaciones_export.json', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ generado: new Date().toISOString(), calificaciones: [] }) }));
  await ctx.route(/powerplatform|login\.microsoftonline/, r => r.abort());
  // El instantáneo embebido del CRM va cifrado y pediría la frase: para medir se salta.
  await ctx.route('**/crm/', r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: fs.readFileSync(path.join(RAIZ, 'crm', 'index.html'), 'utf8').replace('fapMaybe(EMBEDDED)', 'fapMaybe([])') }));
  await ctx.addInitScript(() => { try { sessionStorage.setItem('fap_clm_ses', JSON.stringify({ rol: 'ac', user: 'Ana Pérez' })); } catch (e) { } });

  const out = {}; const errores = [];
  const abrir = async u => { const p = await ctx.newPage(); p.on('pageerror', e => errores.push(u + ': ' + String(e).slice(0, 140))); p.on('dialog', d => d.accept('x').catch(() => { })); await p.goto(BASE + u, { waitUntil: 'load' }); await p.waitForTimeout(1500); return p; };
  const medir = async (p, nombre) => { await p.waitForTimeout(300); out[nombre] = await p.evaluate(medirEnPagina); if (CAPTURAS) { fs.mkdirSync(CAPTURAS, { recursive: true }); await p.screenshot({ path: path.join(CAPTURAS, nombre.replace('/', '_') + '.png') }); } };

  let p = await abrir('clm/');
  for (const v of ['panel', 'contratos', 'proveedores', 'solicitudes', 'alertas', 'reportes']) { await p.evaluate(v => go(v), v); await medir(p, 'clm/' + v); }
  await p.evaluate(() => go('detalle', 0)); await medir(p, 'clm/detalle'); await p.close();

  p = await abrir('generador/');
  await p.evaluate(() => {
    ST.cfg.areas = [{ id: 'a1', ap: 'Parque Nacional Yasuní', siglas: 'PNY', ciudad: 'Quito', mae: 'Jorge Andrade', maeCargo: 'Jefe del Área Protegida', lugar: 'El Coca' }];
    ST.cfg.ac = 'Lcda. María Salazar'; ST.cfg.acCorreo = 'msalazar@fias.org.ec'; crearExp();
    var d = D(); d.areaId = 'a1'; d.tipoProceso = 'Compra directa'; d.bienServicio = 'Bien'; d.fechaInicio = '2026-10-19'; d.numero = '14';
    d.objeto = 'Adquisición de llantas'; d.presupuesto = '820'; d.items = [{ desc: 'Llanta 265/70 R16', unidad: 'Unidad', cantidad: '4', punit: '178.26', iva: 15 }]; save(); render();
  });
  await medir(p, 'generador/captura');
  for (const v of ['documentos', 'procesos', 'datos', 'plantillas']) { await p.evaluate(v => go(v), v); await medir(p, 'generador/' + v); }
  await p.close();

  p = await abrir('crm/'); await p.selectOption('select', { index: 1 }).catch(() => { });
  await p.evaluate(() => { const e = [...document.querySelectorAll('button')].find(x => /entrar|ingresar|continuar/i.test(x.textContent)); if (e) e.click(); });
  await medir(p, 'crm/lista');
  await p.evaluate(() => { const r = document.querySelector('[data-open]'); if (r) r.click(); }); await medir(p, 'crm/detalle'); await p.close();

  p = await abrir('renovaciones/'); await p.selectOption('select', { index: 1 }); await p.click('text=Ver mis contratos'); await medir(p, 'renovaciones/lista'); await p.close();
  p = await abrir('calificacion/'); await medir(p, 'calificacion/proceso'); await p.close();
  p = await abrir('bienes/'); await medir(p, 'bienes/ingreso'); await p.close();
  p = await abrir('planificador/'); await p.click('text=Renovaciones FAP 2027').catch(() => { }); await medir(p, 'planificador/plan'); await p.close();
  p = await abrir('instrumentos/');
  await p.evaluate(() => { const it = [...document.querySelectorAll('div,li')].find(x => /Acta de terminación de contrato \(Word\)/.test(x.textContent) && x.children.length < 6 && x.offsetHeight < 120); if (it) it.click(); });
  await p.waitForTimeout(500); await medir(p, 'instrumentos/generar'); await p.close();

  await b.close(); srv.close();

  let fallos = 0;
  console.log('\nPantalla'.padEnd(27) + 'se sale   botones <36 px   campos con zoom   texto <4,5:1');
  for (const k in out) {
    const m = out[k]; const mal = m.desborda > 0 || m.zoom > 0 || m.bajo > 0; if (mal) fallos++;
    console.log((mal ? '✗ ' : '✓ ') + k.padEnd(24) + String(m.desborda > 0 ? m.desborda + ' px' : '—').padEnd(10) + (m.chicos + ' de ' + m.tocables).padEnd(18) + (m.zoom + ' de ' + m.campos).padEnd(18) + m.bajo + ' de ' + m.textos);
    if (DETALLE || mal) {
      m.fuera.forEach(l => console.log('      se sale: ' + l));
      if (DETALLE) m.chicosEj.forEach(l => console.log('      pequeño: ' + l));
      m.bajoEj.forEach(l => console.log('      contraste: ' + l));
    }
  }
  errores.forEach(e => console.log('✗ error de página — ' + e));
  if (fallos || errores.length) { console.log('\n✗ ' + (fallos + errores.length) + ' pantallas con algo que arreglar'); process.exit(1); }
  console.log('\n✓ ' + Object.keys(out).length + ' pantallas: nada se sale, ningún campo hace zoom y todo el texto contrasta');
})();
