/*
 * Comprobaciones del Generador de Instrumentos (instrumentos/index.html).
 *
 * Cubren el traspaso de cláusulas: al subir la versión mejorada de una
 * plantilla Word, la herramienta detecta qué cláusulas cambiaron y ofrece
 * llevar la mejora a las demás plantillas Word que tenían el mismo texto y al
 * repositorio de cláusulas. Es la parte que reescribe el XML de un Word ajeno,
 * así que se prueba con una plantilla de verdad —el acta de terminación del
 * CRM, que trae listas numeradas, tablas, comentarios y control de cambios— y
 * lo que sale se pasa por scripts/validar_docx.py, que es lo que dice si Word
 * lo abriría.
 *
 * Igual que el CLM, la app declara su estado con `let` (plantillas, clausulas),
 * que no cuelga de window: se llega con w.eval().
 *
 * Uso (las dependencias no se guardan en el repositorio):
 *     npm install jsdom pizzip@3.2.0 docxtemplater@3.66.4
 *     node scripts/probar_instrumentos.js
 *
 * Sale con código 1 si algo falla, para poder colgarlo de un workflow.
 */
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
let JSDOM, VirtualConsole, PizZip, Docxtemplater;
try{
  ({ JSDOM, VirtualConsole } = require('jsdom'));
  PizZip = require('pizzip');
  Docxtemplater = require('docxtemplater');
}catch(e){
  console.error('Faltan las dependencias de la prueba. Instálalas con:\n    npm install jsdom pizzip@3.2.0 docxtemplater@3.66.4\n');
  process.exit(2);
}

const RAIZ = path.dirname(__dirname);
const HTML = fs.readFileSync(path.join(RAIZ, 'instrumentos', 'index.html'), 'utf8');

let fallos = 0, pruebas = 0;
function ok(cond, msg, extra){ pruebas++; if(cond){ console.log('  ✓ ' + msg); } else { fallos++; console.log('  ✗ ' + msg + (extra !== undefined ? ('  → ' + extra) : '')); } }
function seccion(t){ console.log('\n' + t); }
const espera = ms => new Promise(r => setTimeout(r, ms));

function abrir(){
  const avisos = [], alertas = [], errores = [];
  // docxtemplater escribe en la consola cada plantilla que no compila, también
  // las que la prueba rompe a propósito: se calla todo menos los errores de verdad.
  const consola = new VirtualConsole();
  consola.on('jsdomError', e => errores.push(e.message));
  const dom = new JSDOM(HTML, {
    url: 'http://localhost/instrumentos/index.html', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: consola,
    beforeParse(w){
      w.fetch = () => Promise.reject(new Error('sin red'));
      w.alert = m => alertas.push(String(m));
      w.confirm = () => true;
      w.addEventListener('error', e => errores.push(e.message));
    }
  });
  return { w: dom.window, avisos, alertas, errores };
}

// Helpers sobre los .docx, del lado de node
const xmlDe = b64 => new PizZip(Buffer.from(b64, 'base64')).file('word/document.xml').asText();
function conXml(b64, cambiar, otros){
  const zip = new PizZip(Buffer.from(b64, 'base64'));
  zip.file('word/document.xml', cambiar(zip.file('word/document.xml').asText()));
  Object.entries(otros || {}).forEach(([n, f]) => zip.file(n, f(zip.file(n).asText())));
  return zip.generate({ type: 'base64', compression: 'DEFLATE' });
}
function reemplazarUna(xml, de, a){
  if(xml.split(de).length !== 2) throw new Error('El texto de prueba no aparece una sola vez: ' + de);
  return xml.replace(de, a);
}
function validarConPython(b64, nombre){
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'instr-'));
  const f = path.join(dir, nombre + '.docx');
  fs.writeFileSync(f, Buffer.from(b64, 'base64'));
  const r = spawnSync('python3', [path.join(RAIZ, 'scripts', 'validar_docx.py'), f], { encoding: 'utf8' });
  if(r.error) return { saltada: true };
  return { ok: r.status === 0, salida: (r.stdout || '') + (r.stderr || '') };
}

(async () => {
  const { w, alertas, errores } = abrir();
  for(let i = 0; i < 50 && !w.eval('plantillas').length; i++) await espera(100);
  await espera(300);
  const E = s => w.eval(s);

  seccion('1. La app arranca');
  ok(!errores.length, 'sin errores de JavaScript al cargar', errores.join(' | '));
  const SEED = w.__DOCX_SEEDS__ && w.__DOCX_SEEDS__.acta_terminacion;
  ok(!!SEED, 'trae la plantilla Word del acta de terminación embebida');
  if(!SEED){ console.log('\nSin la plantilla de prueba no se puede seguir.'); process.exit(1); }
  const fabrica = E('plantillas').find(p => p.seedKey === 'acta_terminacion');
  ok(!!fabrica, 'la plantilla de fábrica del acta está en la lista');

  seccion('2. Leer las cláusulas del Word');
  const xmlActa = xmlDe(SEED);
  const bloques = w.bloquesCuerpoXml(xmlActa);
  const cuerpo = xmlActa.slice(xmlActa.indexOf('<w:body>') + 8, xmlActa.lastIndexOf('</w:body>'));
  let resto = cuerpo; bloques.forEach(b => { resto = resto.replace(b.xml, ''); });
  ok(bloques.length > 50 && !resto.trim(), 'los bloques de primer nivel cubren todo el cuerpo, sin solaparse', `${bloques.length} bloques, sobran ${resto.trim().length} caracteres`);
  ok(bloques[bloques.length - 1].tag === 'w:sectPr', 'el último bloque es el sectPr del cuerpo');
  const cls = w.clausulasXml(xmlActa);
  ok(cls.length === 9, 'encuentra las 9 cláusulas del acta', cls.length);
  ok(cls[0].titulo === 'ANTECEDENTES' && cls[8].titulo === 'ACEPTACIÓN Y RATIFICACIÓN', 'con sus títulos limpios, sin «CLÁUSULA PRIMERA:»', cls.map(c => c.titulo).join(' | '));
  ok(cls.every(c => !c.cuerpo.some(b => b.tag === 'w:sectPr')), 'el sectPr final no se cuenta como parte de la última cláusula');
  // La huella tiene que ser la del repositorio: la misma que sale al indexar.
  const pA = { id: 'x', tipo: 'docx', nombre: 'x', archivoB64: SEED };
  const bloquesCompo = w.migrarABloques({ cuerpo: w.docxABodyHtml(pA) }).filter(b => b.tipo === 'clausula');
  ok(bloquesCompo.length === 9 && bloquesCompo.every((b, i) => w.huellaClausula(b.cuerpo) === cls[i].huella),
    'la huella de cada cláusula coincide con la que guarda el repositorio al indexar');

  seccion('3. Revisiones: una marca vacía no se come el texto');
  const conMarca = '<w:p><w:pPr><w:rPr><w:del w:id="9" w:author="A" w:date="2026-01-01T00:00:00Z"/></w:rPr></w:pPr><w:r><w:t>Texto que se queda</w:t></w:r></w:p><w:p><w:del w:id="10" w:author="A" w:date="2026-01-01T00:00:00Z"><w:r><w:delText>borrado</w:delText></w:r></w:del></w:p>';
  const aceptado = w.aceptarRevisionesXml(conMarca);
  ok(aceptado.includes('Texto que se queda') && !aceptado.includes('borrado'), 'aceptarRevisionesXml quita la marca de párrafo sin llevarse el texto de en medio', aceptado);

  // ---- El escenario: cinco plantillas Word del mismo acta ----
  const A1 = conXml(SEED, x => {
    x = reemplazarUna(x, '>Con la suscripción del presente instrumento,', '>Con la firma del presente instrumento,');                 // SEXTA
    x = reemplazarUna(x, '>Factura(s), RUC del proveedor y respaldos de pago o consumo<', '>Factura(s), RUC del proveedor y comprobantes de pago<');   // SÉPTIMA (lista)
    x = reemplazarUna(x, 'impulsar entre sí, cualquier tipo', 'impulsar entre sí cualquier tipo');                                         // OCTAVA: solo una coma
    return x;
  });
  // C: la SEXTA con otra redacción → es otra variante, no se toca
  const C = conXml(SEED, x => reemplazarUna(x, '>Con la suscripción del presente instrumento,', '>Al suscribir este instrumento,'));
  // D: la SEXTA con una imagen → no se puede copiar sin arrastrar el archivo
  const D = conXml(SEED, x => reemplazarUna(x, '<w:t>Con la suscripción del presente instrumento,', '<w:t>Con la suscripción del presente instrumento,</w:t></w:r><w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"/></w:drawing></w:r><w:r><w:t>'));
  // E: la misma acta, pero sus listas tienen otros números (como pasa entre dos Word distintos)
  const E5 = conXml(SEED, x => x.replace(/<w:numId w:val="(1[01])"\/>/g, (m, n) => `<w:numId w:val="${+n + 100}"/>`),
    { 'word/numbering.xml': x => x.replace(/<w:num w:numId="(1[01])"/g, (m, n) => `<w:num w:numId="${+n + 100}"`) });

  // F: un cuadro combinado de la NOVENA con el mismo id que el de la OCTAVA.
  // Al pegar la OCTAVA nueva su id chocaría con el de la NOVENA: hay que darle otro.
  const idOctava = (xmlDe(A1).match(/DECLARACIÓN DE CONFORMIDAD[\s\S]*?<w:id w:val="(-?\d+)"\/>/) || [])[1];
  const F = conXml(SEED, x => reemplazarUna(x, '<w:id w:val="-1880614466"/>', `<w:id w:val="${idOctava}"/>`));

  E(`window.__nuevaDocx = (nombre, b64) => { const p = { id: uid(), nombre, carpetaId: null, descripcion: '', actualizado: hoy(), tipo: 'docx', archivoB64: b64 }; plantillas.unshift(p); return p; }`);
  const pAct = w.__nuevaDocx('Acta A (Word)', SEED);
  const pB = w.__nuevaDocx('Acta B (Word)', SEED);
  const pC = w.__nuevaDocx('Acta C (Word)', C);
  const pD = w.__nuevaDocx('Acta D (Word)', D);
  const pE = w.__nuevaDocx('Acta E (Word)', E5);
  const pF = w.__nuevaDocx('Acta F (Word)', F);

  seccion('4. Indexar dos veces no duplica la composición');
  w.importarDocxAComposicion(pAct);
  const compo = w.composicionDe(pAct);
  ok(!!compo && compo.origenId === pAct.id, 'la composición queda atada a su Word (origenId)');
  const nCompos = () => E('plantillas').filter(p => p.tipo !== 'docx' && /\(composición\)$/.test(p.nombre)).length;
  const antesDe = nCompos();
  w.importarDocxAComposicion(pAct);
  ok(nCompos() === antesDe && w.composicionDe(pAct) === compo, 'indexar otra vez rehace la misma, no crea otra', `${antesDe} → ${nCompos()}`);
  const varSexta = () => E('clausulas').flatMap(cl => cl.variantes.map(v => ({ cl, v }))).find(({ v }) => w.huellaClausula(v.cuerpo) === cls[5].huella);
  ok(!!varSexta(), 'la SEXTA quedó en el repositorio con el texto del Word');

  seccion('5. Detectar qué cambió');
  const cambios = w.cambiosDeClausulas(xmlActa, xmlDe(A1));
  ok(cambios.length === 3, 'tres cláusulas cambiadas', cambios.map(c => c.titulo).join(' | '));
  ok(cambios.some(c => c.titulo === 'DECLARACIÓN DE CONFORMIDAD'), 'una coma también cuenta como cambio');
  ok(w.cambiosDeClausulas(xmlActa, xmlActa).length === 0, 'sin cambios, no ofrece nada');
  const diff = w.diffPalabrasHtml(cambios[0].antes.exacto, cambios[0].ahora.exacto);
  ok(/<del>suscripción<\/del>/.test(diff) && /<ins>firma<\/ins>/.test(diff) && diff.includes('…'), 'el «Ver qué cambió» marca solo las palabras distintas y resume el resto', diff.slice(0, 160));

  seccion('6. Subir la versión mejorada ofrece llevarla');
  await w.recibirVersionDocx(pAct, A1);
  ok(xmlDe(pAct.archivoB64) === xmlDe(A1), 'la versión nueva queda guardada');
  const modal = w.document.getElementById('modal');
  ok(w.document.getElementById('modal-fondo').classList.contains('abierto') && /Cambiaste 3 cláusulas/.test(modal.textContent), 'abre el aviso con las tres cláusulas');
  const caja = (pl, c) => modal.querySelector(`input[data-pl="${pl.id}"][data-c="${c}"]`);
  const iSexta = E('traspaso').cambios.findIndex(c => c.titulo === 'EXTINCIÓN DE OBLIGACIONES');
  ok(caja(pB, iSexta) && !caja(pB, iSexta).disabled && caja(pB, iSexta).checked, 'la otra plantilla con el mismo texto sale marcada');
  ok(caja(fabrica, iSexta) && !caja(fabrica, iSexta).disabled, 'también la plantilla de fábrica');
  ok(!caja(pC, iSexta) && modal.textContent.includes('Con otra redacción de esta cláusula, no se tocan: Acta C (Word)'), 'la de otra redacción no se ofrece: se nombra como «no se tocan»');
  ok(caja(pD, iSexta) && caja(pD, iSexta).disabled && /imágenes/.test(caja(pD, iSexta).closest('label').textContent), 'la que tiene una imagen en la cláusula sale apagada y dice por qué');
  ok(!!modal.querySelector(`input[data-var="${varSexta().v.id}"]`), 'ofrece también la variante del repositorio');
  ok(modal.textContent.includes(compo.nombre), 'y nombra la composición que se actualiza con ella');

  seccion('7. Llevar la mejora');
  const antesC = pC.archivoB64, antesD = pD.archivoB64, xmlBAntes = xmlDe(pB.archivoB64);
  await w.aplicarTraspaso();
  ok(/Mejora llevada/.test(modal.textContent), 'confirma lo que hizo', modal.textContent.slice(0, 200));
  const nuevasA = w.clausulasXml(xmlDe(A1));
  for(const p of [pB, fabrica, pE, pF]){
    const b64 = w.archivoDocxDe(p);
    const cl = w.clausulasXml(xmlDe(b64));
    ok(cl.length === 9 && cl.every((c, i) => c.exacto === nuevasA[i].exacto), `${p.nombre}: sus 9 cláusulas dicen ahora lo mismo que la versión mejorada`);
    let error = '';
    try{
      const doc = new Docxtemplater(new PizZip(Buffer.from(b64, 'base64')), { paragraphLoop: true, linebreaks: true, nullGetter: () => '' });
      doc.render({ contratoNro: 'FIAS-FAP-2026-001' });
    }catch(e){ error = e.message; }
    ok(!error, `${p.nombre}: se sigue rellenando`, error);
    const ids = (xmlDe(b64).match(/<w:id w:val="-?\d+"\/>/g) || []);
    ok(ids.length > 10 && new Set(ids).size === ids.length, `${p.nombre}: ningún cuadro combinado repite id`, `${ids.length} ids, ${new Set(ids).size} distintos`);
    const v = validarConPython(b64, p.nombre.replace(/\W+/g, '_'));
    if(v.saltada) console.log('  · (sin python3: no se pasó por validar_docx.py)');
    else ok(v.ok, `${p.nombre}: validar_docx.py dice que Word lo abre`, v.salida.trim().split('\n').slice(-4).join(' | '));
  }
  // C y D no tenían la SEXTA como el original, pero la SÉPTIMA y la OCTAVA sí:
  // esas dos les llegan; la SEXTA de cada una se queda como estaba.
  for(const [p, antes] of [[pC, antesC], [pD, antesD]]){
    const a = w.clausulasXml(xmlDe(antes)), d = w.clausulasXml(xmlDe(p.archivoB64));
    ok(d[5].exacto === a[5].exacto && d[6].exacto === nuevasA[6].exacto && d[7].exacto === nuevasA[7].exacto,
      `${p.nombre}: su SEXTA no se toca y las otras dos cláusulas sí le llegan`);
  }
  ok(!fabrica.seedKey && !!fabrica.archivoB64, 'la de fábrica pasa a tener su propio archivo');
  // Fuera de las cláusulas cambiadas, ni un byte distinto
  const xmlB = xmlDe(pB.archivoB64);
  const antesCl = w.clausulasXml(xmlBAntes), ahoraCl = w.clausulasXml(xmlB);
  const cambiadas = cambios.map(c => antesCl.findIndex(x => x.clave === c.clave)).sort((a, b) => a - b);
  ok(xmlB.slice(0, ahoraCl[cambiadas[0]].ini) === xmlBAntes.slice(0, antesCl[cambiadas[0]].ini), 'todo lo anterior a la primera cláusula cambiada queda idéntico');
  const ultima = cambiadas[cambiadas.length - 1];
  ok(xmlB.slice(ahoraCl[ultima].fin) === xmlBAntes.slice(antesCl[ultima].fin), 'todo lo posterior a la última, también');
  ok(w.clausulasXml(xmlB).every((c, i) => c.titulo === antesCl[i].titulo), 'cada plantilla conserva sus encabezados de cláusula');
  ok(!/w14:paraId/.test(xmlB.slice(ahoraCl[5].ini, ahoraCl[5].fin)), 'lo pegado no trae ids del otro archivo');
  // Las listas de E apuntan a SU numeración, no a la del Word de origen
  const septimaE = w.clausulasXml(xmlDe(pE.archivoB64))[6];
  const idsE = w.numIdsDe(septimaE.cuerpo.map(b => b.xml).join(''));
  ok(idsE.length && idsE.every(id => +id > 100), 'en un Word con otra numeración, la lista pegada usa la del destino', idsE.join(','));
  // Repositorio y composición
  const enRepo = E('clausulas').flatMap(cl => cl.variantes).find(v => w.textoDeHtml(v.cuerpo) === nuevasA[5].exacto);
  ok(!!enRepo, 'la variante del repositorio tiene el texto nuevo');
  const compoAhora = E('plantillas').find(p => p.id === compo.id);
  ok(/Con la firma del presente instrumento/.test(compoAhora.cuerpo) && !/Con la suscripción del presente instrumento/.test(compoAhora.cuerpo), 'y la composición que la usa, también');

  seccion('8. Deshacer');
  await w.deshacerTraspaso();
  ok(xmlDe(pB.archivoB64) === xmlBAntes, 'la otra plantilla vuelve a como estaba');
  ok(fabrica.seedKey === 'acta_terminacion' && !fabrica.archivoB64, 'la de fábrica vuelve a ser la de fábrica');
  ok(!E('clausulas').flatMap(cl => cl.variantes).some(v => w.textoDeHtml(v.cuerpo) === nuevasA[5].exacto), 'el repositorio vuelve a la redacción anterior');
  ok(/Con la suscripción del presente instrumento/.test(E('plantillas').find(p => p.id === compo.id).cuerpo), 'y la composición');
  ok(xmlDe(pAct.archivoB64) === xmlDe(A1), 'el Word que se subió se queda con su versión nueva');

  seccion('9. Lo que no se puede, no se hace');
  // Una versión que añade una lista nueva a la cláusula: el destino no tiene con qué numerarla
  const conLista = conXml(SEED, x => reemplazarUna(x, '>Con la suscripción del presente instrumento,', '>Con la suscripción del presente instrumento,</w:t></w:r></w:p><w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="77"/></w:numPr></w:pPr><w:r><w:t>Un punto nuevo.</w:t></w:r></w:p><w:p><w:r><w:t>'));
  const cLista = w.cambiosDeClausulas(xmlActa, xmlDe(conLista)).find(c => c.titulo === 'EXTINCIÓN DE OBLIGACIONES');
  const destB = w.clausulasXml(xmlDe(pB.archivoB64))[5];
  const rLista = w.pegarClausulaXml(xmlDe(pB.archivoB64), destB, cLista);
  ok(rLista.error && /lista numerada/.test(rLista.error), 'una lista que el destino no tiene se rechaza con su razón', rLista.error);
  // Una versión cuyo texto rompería los {tags} del destino
  const roto = conXml(SEED, x => reemplazarUna(x, '>Con la suscripción del presente instrumento,', '>Con la suscripción {del presente instrumento,'));
  const cRoto = w.cambiosDeClausulas(xmlActa, xmlDe(roto)).find(c => c.titulo === 'EXTINCIÓN DE OBLIGACIONES');
  const rRoto = w.llevarCambiosAWord(pB, [cRoto]);
  ok(!rRoto.b64 && rRoto.fallos.length === 1 && /tags/.test(rRoto.fallos[0].motivo), 'si los {tags} dejarían de compilar, no se guarda nada', rRoto.fallos.map(f => f.motivo).join(' | '));

  seccion('10. Una versión sin cambios de texto no pregunta nada');
  w.cerrarModal();
  await w.recibirVersionDocx(pB, pB.archivoB64);
  ok(!w.document.getElementById('modal-fondo').classList.contains('abierto'), 'no abre el aviso');
  ok(/Versión nueva guardada/.test((w.document.getElementById('toast') || {}).textContent || ''), 'avisa que se guardó');

  ok(!errores.length, 'ningún error de JavaScript en todo el recorrido', errores.join(' | '));
  console.log(`\n${pruebas - fallos}/${pruebas} comprobaciones bien.`);
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
