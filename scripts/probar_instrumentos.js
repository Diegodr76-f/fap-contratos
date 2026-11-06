/*
 * Comprobaciones del Generador de Instrumentos (instrumentos/index.html).
 *
 * Cubren las dos piezas que reescriben el XML de un Word: «Texto del
 * documento», que edita una plantilla Word en la propia herramienta y guarda
 * solo lo que cambió con el formato del Word, y el traspaso de cláusulas, que
 * lleva un cambio —hecho aquí, en Word o en el repositorio— a las demás
 * plantillas Word que tenían el mismo texto. Como es la parte que reescribe XML,
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
/* El acta de fábrica ya no trae cuadros combinados (sus géneros salen de variables),
   pero las plantillas que sube la Unidad Legal sí los traen: se le ponen dos, uno en
   la OCTAVA y otro en la NOVENA, con ids de Word, para probar que se conservan. */
function conCuadros(b64){
  const cuadro = (x, texto, id) => {
    const i = x.indexOf(texto); if(i < 0) throw new Error('No aparece: ' + texto);
    const ini = Math.max(x.lastIndexOf('<w:r>', i), x.lastIndexOf('<w:r ', i));
    const fin = x.indexOf('</w:r>', i) + 6;
    return x.slice(0, ini) + `<w:sdt><w:sdtPr><w:id w:val="${id}"/><w:comboBox><w:listItem w:displayText="a" w:value="a"/></w:comboBox></w:sdtPr><w:sdtContent>` + x.slice(ini, fin) + '</w:sdtContent></w:sdt>' + x.slice(fin);
  };
  return conXml(b64, x => cuadro(cuadro(x, 'Con base en los antecedentes expuestos', 111111111), 'Los comparecientes, libre y voluntariamente', 222222222));
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
  const SEED_APP = w.__DOCX_SEEDS__ && w.__DOCX_SEEDS__.acta_terminacion;
  ok(!!SEED_APP, 'trae la plantilla Word del acta de terminación embebida');
  ok(!/<w:sdt>/.test(xmlDe(SEED_APP)), 'y sin cuadros combinados: sus géneros salen de variables, no de un control que imprime «Administrador/a»');
  const SEED = SEED_APP && conCuadros(SEED_APP);
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
  const F = conXml(SEED, x => reemplazarUna(x, '<w:id w:val="222222222"/>', '<w:id w:val="111111111"/>'));

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
  const idsDe = b64 => xmlDe(b64).match(/<w:id w:val="-?\d+"\/>/g) || [];
  const idsAntes = new Map([[pB, idsDe(pB.archivoB64)], [fabrica, idsDe(SEED_APP)], [pE, idsDe(E5)], [pF, idsDe(F)]]);
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
    // El cambio se aplica sobre los párrafos de cada plantilla: sus cuadros
    // combinados siguen siendo los suyos, con sus ids (también los de F, que
    // ya traía uno repetido y no es cosa de este cambio arreglarlo).
    const ids = idsDe(b64);
    ok(ids.join() === idsAntes.get(p).join(), `${p.nombre}: sus cuadros combinados siguen siendo los suyos`, `${ids.length} ids`);
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
  // Solo cambia el párrafo tocado: en la SÉPTIMA cambió un punto de cuatro
  const septimaAntes = antesCl[6].cuerpo.map(b => b.xml), septimaAhora = ahoraCl[6].cuerpo.map(b => b.xml);
  ok(septimaAhora.length === septimaAntes.length && septimaAhora.filter(x => septimaAntes.includes(x)).length === septimaAntes.length - 1,
    'en la cláusula cambiada, los párrafos que no se tocaron quedan byte por byte', `${septimaAhora.filter(x => septimaAntes.includes(x)).length}/${septimaAntes.length}`);
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
  // Una versión que añade una lista a una cláusula que no tenía: en el destino
  // estrena su propia numeración, en vez de continuar la de otra cláusula
  const conLista = conXml(SEED, x => reemplazarUna(x, '>Con la suscripción del presente instrumento,', '>Con la suscripción del presente instrumento,</w:t></w:r></w:p><w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="77"/></w:numPr></w:pPr><w:r><w:t>Un punto nuevo.</w:t></w:r></w:p><w:p><w:r><w:t>'));
  const cLista = w.cambiosDeClausulas(xmlActa, xmlDe(conLista)).find(c => c.titulo === 'EXTINCIÓN DE OBLIGACIONES');
  const zB = new PizZip(Buffer.from(pB.archivoB64, 'base64')), xB = zB.file('word/document.xml').asText();
  const ctxB = w.contextoWord(zB, xB);
  const rLista = w.pegarClausulaXml(xB, w.clausulasXml(xB)[5], cLista, ctxB);
  ok(rLista.xml && ctxB.numsNuevos.length === 1 && /w:startOverride w:val="1"/.test(ctxB.numsNuevos[0]), 'una lista nueva en el destino estrena su numeración, que empieza en 1', rLista.error);
  // Un párrafo con imagen que cambió no se puede reescribir: lo dice, y no toca nada
  const cImagen = w.cambiosDeClausulas(xmlActa, xmlDe(A1)).find(c => c.titulo === 'EXTINCIÓN DE OBLIGACIONES');
  const zD = new PizZip(Buffer.from(D, 'base64')), xD = zD.file('word/document.xml').asText();
  const rImagen = w.pegarClausulaXml(xD, w.clausulasXml(xD)[5], cImagen, w.contextoWord(zD, xD));
  ok(rImagen.error && /imágenes/.test(rImagen.error), 'un párrafo con imagen que cambió se rechaza con su razón', rImagen.error);
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


  seccion('11. Abrir una sección en el editor y guardarla sin tocar deja el Word igual');
  // Todas las plantillas del repositorio: si el ida y vuelta cambiara algo, cada
  // «Guardar» reescribiría párrafos que nadie tocó.
  const todas = { 'acta (instrumentos)': SEED, 'adenda (instrumentos)': w.__DOCX_SEEDS__.informe_adenda };
  for(const dir of ['generador/plantillas', 'crm/plantillas'])
    fs.readdirSync(path.join(RAIZ, dir)).filter(f => f.endsWith('.docx')).forEach(f => { todas[dir + '/' + f] = fs.readFileSync(path.join(RAIZ, dir, f)).toString('base64'); });
  const malas = [];
  for(const [nombre, b64] of Object.entries(todas)){
    const zip = new PizZip(Buffer.from(b64, 'base64')), xml = zip.file('word/document.xml').asText();
    const ctx = w.contextoWord(zip, xml);
    const plan = w.seccionesWord(xml).secciones.map((s, i) => {
      const div = w.document.createElement('div');
      div.innerHTML = w.htmlEditableDeBloques(s.cuerpo, ctx);   // como lo deja el navegador
      return { s: i, html: div.innerHTML };
    });
    try{
      const cuerpo = x => w.bloquesCuerpoXml(x).map(b => b.xml).join('');
      if(cuerpo(w.componerWordXml(xml, plan, ctx)) !== cuerpo(xml)) malas.push(nombre);
    }catch(e){ malas.push(nombre + ' (' + e.message + ')'); }
  }
  ok(!malas.length, `las ${Object.keys(todas).length} plantillas Word del repositorio salen byte por byte iguales`, malas.join(', '));

  seccion('12. «Texto del documento»: editar una cláusula aquí');
  w.cerrarModal();
  const pG = w.__nuevaDocx('Contrato G (Word)', SEED);
  const pH = w.__nuevaDocx('Contrato H (Word)', SEED);
  w.seleccionar(pG.id); w.cambiarTab('editar');
  const tarjetas = w.document.querySelectorAll('.ew .eb');
  ok(tarjetas.length === 10, 'la plantilla Word muestra su texto por secciones: el inicio y sus 9 cláusulas', tarjetas.length);
  w.abrirSeccionWord(6);
  let ed = w.document.getElementById('editor');
  ok(ed && ed.classList.contains('ed-word') && /Titillium/.test(ed.getAttribute('style')), 'abre la SEXTA en el editor con la letra de ese Word', ed && ed.getAttribute('style'));
  ok(ed && !/\{\{/.test(ed.innerHTML) && /\{contratoNro\}/.test(ed.innerHTML), 'los {tags} se ven como en el Word');
  const seccionesG = b64 => w.seccionesWord(xmlDe(b64)).secciones.map(s => (s.cab ? s.cab.xml : '') + s.cuerpo.map(b => b.xml).join(''));
  const antesG = seccionesG(pG.archivoB64);
  ed.innerHTML = ed.innerHTML.replace('Con la suscripción del presente instrumento', 'Con la firma del presente instrumento');
  await w.guardarSeccionWord();
  const ahoraG = seccionesG(pG.archivoB64);
  ok(/Con la firma del presente instrumento/.test(ahoraG[6]) && !/Con la suscripción del presente/.test(ahoraG[6]), 'el cambio queda en el Word');
  ok(ahoraG.every((x, i) => i === 6 || x === antesG[i]), 'las demás secciones quedan byte por byte');
  const vG = validarConPython(pG.archivoB64, 'editor_G');
  if(!vG.saltada) ok(vG.ok, 'validar_docx.py dice que Word lo abre', vG.salida.trim().split('\n').slice(-3).join(' | '));
  ok(!w.document.getElementById('editor'), 'al guardar se cierra el editor');
  ok(/Cambiaste una cláusula/.test(modal.textContent) && caja(pH, 0) && !caja(pH, 0).disabled, 'y ofrece llevar el cambio a las otras plantillas Word con el mismo texto');
  modal.querySelectorAll('.tr-op input').forEach(i => { if(i.dataset.pl !== pH.id) i.checked = false; });
  await w.aplicarTraspaso();
  ok(/Con la firma del presente instrumento/.test(seccionesG(pH.archivoB64)[6]), 'la otra plantilla recibe el cambio');
  w.cerrarModal();
  w.abrirSeccionWord(6);
  ed = w.document.getElementById('editor');
  ed.innerHTML = ed.innerHTML.replace('cabal cumplimiento', '<b>cabal cumplimiento</b>');
  await w.guardarSeccionWord();
  const runCabal = (seccionesG(pG.archivoB64)[6].match(/<w:r>(?:(?!<\/w:r>).)*>cabal<(?:(?!<\/w:r>).)*<\/w:r>/) || [''])[0];
  ok(/<w:rFonts[^>]*\/><w:b\/><w:sz /.test(runCabal), 'la negrita del editor llega al Word, en el orden que exige el esquema', runCabal);
  w.cerrarModal();
  await w.deshacerWord();
  await w.deshacerWord();
  ok(xmlDe(pG.archivoB64) === xmlDe(SEED), '«Deshacer» devuelve el Word a como estaba, paso a paso');

  seccion('13. Mover, quitar y añadir cláusulas');
  const titulos = b64 => w.seccionesWord(xmlDe(b64)).secciones.slice(1).map(s => s.textoCab);
  w.moverSeccionWord(6, 1);
  await espera(50);
  let t = titulos(pG.archivoB64);
  ok(t[5] === 'CLÁUSULA SEXTA: DOCUMENTOS HABILITANTES' && t[6] === 'CLÁUSULA SÉPTIMA: EXTINCIÓN DE OBLIGACIONES', 'al mover, los encabezados se renumeran', t.slice(5, 7).join(' | '));
  w.cerrarModal();
  w.quitarSeccionWord(3);
  await espera(50);
  t = titulos(pG.archivoB64);
  ok(t.length === 8 && t[2] === 'CLÁUSULA TERCERA: VERIFICACIÓN DE PLAZO Y CAUSAL DE CIERRE', 'al quitar una, las siguientes suben de número', t.slice(2, 3).join());
  w.cerrarModal();
  await w.insertarSeccionWord('Garantías', '<p>El contratista entrega la garantía por {montoTotal}.</p><ol><li>Garantía técnica.</li><li>Garantía de buen uso del anticipo.</li></ol>');
  await espera(50);
  t = titulos(pG.archivoB64);
  ok(t.length === 9 && t[7] === 'CLÁUSULA OCTAVA: GARANTÍAS' && t[8] === 'CLÁUSULA NOVENA: ACEPTACIÓN Y RATIFICACIÓN', 'una cláusula nueva entra antes de la última, numerada y en mayúsculas como las demás', t.slice(7).join(' | '));
  const secsG = w.seccionesWord(xmlDe(pG.archivoB64)).secciones;
  const pprCab = s => w.leerParrafo(s.cab.limpio).pPr;
  ok(pprCab(secsG[8]) === pprCab(secsG[7]) && w.leerParrafo(secsG[8].cab.limpio).dominante === w.leerParrafo(secsG[7].cab.limpio).dominante, 'su encabezado tiene el formato de los demás');
  const numGar = (secsG[8].cuerpo.map(b => b.xml).join('').match(/<w:numId w:val="(\d+)"\/>/g) || []);
  const numAntes = new Set((xmlDe(SEED).match(/<w:numId w:val="\d+"\/>/g) || []));
  ok(numGar.length === 2 && !numAntes.has(numGar[0]), 'su lista estrena numeración en vez de seguir la de otra cláusula', numGar.join(' '));
  ok(E('edWord') && E('edWord').k === 8 && w.document.getElementById('editor'), 'y se abre para escribir su texto');
  const vG2 = validarConPython(pG.archivoB64, 'editor_G_estructura');
  if(!vG2.saltada) ok(vG2.ok, 'validar_docx.py dice que Word lo abre', vG2.salida.trim().split('\n').slice(-3).join(' | '));
  w.cancelarSeccionWord();
  w.cerrarModal();

  seccion('14. Listas y tablas');
  const editar = (k, cambiar) => {
    const zip = new PizZip(Buffer.from(SEED, 'base64')), xml = zip.file('word/document.xml').asText();
    const ctx = w.contextoWord(zip, xml);
    ctx.permitirBorrarFijos = true;
    const secs = w.seccionesWord(xml).secciones;
    const div = w.document.createElement('div');
    div.innerHTML = w.htmlEditableDeBloques(secs[k].cuerpo, ctx);
    cambiar(div);
    const plan = secs.map((s, i) => ({ s: i }));
    plan[k].html = div.innerHTML;
    const nuevo = w.componerWordXml(xml, plan, ctx);
    const problema = w.problemaDeWord(zip, xml, nuevo);
    w.aplicarNumeracion(zip, ctx);
    zip.file('word/document.xml', nuevo);
    return { xml: nuevo, secs: w.seccionesWord(nuevo).secciones, problema, b64: zip.generate({ type: 'base64' }) };
  };
  let r = editar(7, d => { const li = w.document.createElement('li'); li.textContent = 'Acta de entrega-recepción del {fechaRecepcion};'; d.querySelector('ol,ul').appendChild(li); });
  const nums7 = r.secs[7].cuerpo.map(b => b.xml).join('').match(/<w:numId w:val="\d+"\/>/g) || [];
  ok(!r.problema && nums7.length === 5 && new Set(nums7).size === 1, 'un punto nuevo de lista sigue la lista de al lado', nums7.join(' '));
  r = editar(4, d => { Array.from(d.querySelectorAll('td')).find(td => /Fecha de inicio de ejecución/.test(td.textContent)).querySelector('p').textContent = 'Fecha de inicio de la ejecución'; });
  const tabla = r.secs[4].cuerpo.find(b => b.tag === 'w:tbl').xml, tablaAntes = w.seccionesWord(xmlActa).secciones[4].cuerpo.find(b => b.tag === 'w:tbl').xml;
  const celdas = x => w.hijosXml(x).filter(h => h.tag === 'w:tr').flatMap(tr => w.hijosXml(tr.xml).filter(h => h.tag === 'w:tc').map(h => h.xml));
  ok(!r.problema && /Fecha de inicio de la ejecución/.test(tabla) && celdas(tabla).filter((c, i) => c !== celdas(tablaAntes)[i]).length === 1, 'en una tabla cambia solo la celda tocada');
  r = editar(4, d => { const tr = d.querySelector('tr:last-child'), nt = tr.cloneNode(true); nt.cells[0].innerHTML = '<p>Fecha de la adenda</p>'; nt.cells[1].innerHTML = '<p>{fechaAdenda}</p>'; tr.after(nt); });
  const filas = x => w.hijosXml(x).filter(h => h.tag === 'w:tr');
  const tabla2 = r.secs[4].cuerpo.find(b => b.tag === 'w:tbl').xml;
  const tcPrDe = tr => w.hijosXml(tr.xml).filter(h => h.tag === 'w:tc').map(tc => (w.hijosXml(tc.xml).find(h => h.tag === 'w:tcPr') || {}).xml).join('');
  ok(!r.problema && filas(tabla2).length === filas(tablaAntes).length + 1 && tcPrDe(filas(tabla2).slice(-1)[0]) === tcPrDe(filas(tablaAntes).slice(-1)[0]), 'una fila nueva copia la estructura de la de al lado');
  const vT = validarConPython(r.b64, 'editor_tabla');
  if(!vT.saltada) ok(vT.ok, 'validar_docx.py dice que Word lo abre', vT.salida.trim().split('\n').slice(-3).join(' | '));
  r = editar(1, d => { const p = d.querySelector('li'); p.innerHTML = p.innerHTML.replace('Fondo de Inversión', 'Fondo de Inversión Ambiental'); });
  ok(!r.problema && (r.xml.match(/<w:sdt>/g) || []).length === (xmlActa.match(/<w:sdt>/g) || []).length, 'los cuadros combinados del párrafo editado siguen ahí');

  seccion('15. Una cláusula editada en el repositorio llega a los Word, con el formato de cada uno');
  const vRepo = E('clausulas').flatMap(cl => cl.variantes.map(v => ({ cl, v }))).find(({ v }) => w.huellaClausula(v.cuerpo) === cls[5].huella);
  ok(!!vRepo, 'la variante de la SEXTA está en el repositorio');
  w.cambiarTab('repositorio');
  w.seleccionarVariante(vRepo.cl.id, vRepo.v.id);
  const repEd = w.document.getElementById('rep-editor');
  repEd.innerHTML = repEd.innerHTML.replace('Con la suscripción del presente instrumento', 'Con la firma de este instrumento');
  const antesE = xmlDe(pE.archivoB64), antesCrepo = pC.archivoB64;
  w.guardarVariante();
  ok(/Cambiaste «EXTINCIÓN DE OBLIGACIONES» en el repositorio/.test(modal.textContent) && caja(pE, 0) && !caja(pE, 0).disabled, 'al guardar la variante, ofrece las plantillas Word que tienen el texto anterior');
  ok(!caja(pC, 0), 'no la que tiene otra redacción');
  await w.aplicarTraspaso();
  const sextaE = w.seccionesWord(xmlDe(pE.archivoB64)).secciones[6];
  ok(/Con la firma de este instrumento/.test(sextaE.cuerpo.map(b => b.xml).join('')), 'la plantilla recibe el cambio');
  const fueraDeSexta = x => { const ss = w.seccionesWord(x).secciones; return ss.filter((s, i) => i !== 6).map(s => (s.cab ? s.cab.xml : '') + s.cuerpo.map(b => b.xml).join('')).join(''); };
  ok(fueraDeSexta(xmlDe(pE.archivoB64)) === fueraDeSexta(antesE), 'y nada fuera de esa cláusula se mueve, ni su numeración propia');
  ok(pC.archivoB64 === antesCrepo, 'la de otra redacción queda intacta');
  w.cerrarModal();


  {
  seccion('16. Las plantillas de fábrica salen sin barras de género');
  // Instalación nueva: las del recorrido de arriba ya tocaron las plantillas de fábrica.
  const app2 = abrir();
  for(let i = 0; i < 50 && !app2.w.eval('plantillas').length; i++) await espera(100);
  await espera(300);
  const w = app2.w, E = s => w.eval(s);
  // Un papel que se firma no puede decir «Administrador/a» ni «del/la»: el Word de
  // fábrica pide el género de cada firmante y lo escribe completo.
  const textoGenerado = (p) => {
    const datos = w.datosDocx(p, E('datosForm'));
    const zip = new PizZip(Buffer.from(w.archivoDocxDe(p), 'base64'));
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true, nullGetter: () => '⟦FALTA⟧' });   // las líneas de firma también son guiones: se marca lo que falta aparte
    doc.render(datos);
    return doc.getZip().file('word/document.xml').asText().replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '');
  };
  const actaFab = E('plantillas').find(p => p.seedKey === 'acta_terminacion');
  for(const clave of ['acta_terminacion', 'informe_adenda']){
    const f = E('plantillas').find(p => p.seedKey === clave);
    w.seleccionar(f.id);
    const escalares = w.estructuraDocx(f).escalares;
    const gob = new Set(Array.from(E('tagsGobernados()')));
    ok(escalares.every(t => gob.has(t) || E('buscarVar')(t)), `${f.nombre}: todo tag tiene un origen (grupo de concordancia o variable)`, escalares.filter(t => !gob.has(t) && !E('buscarVar')(t)).join(','));
    E('concordancias').forEach(g => w.aplicarConcordanciaUI(g.nombre, 1));   // femenino / persona natural femenina
    escalares.filter(t => !gob.has(t)).forEach(t => { E('datosForm')[t] = /fecha/i.test(t) ? '2026-03-05' : /monto|total/i.test(t) ? '1150' : 'Dato ' + t; });
    const txt = textoGenerado(f).replace(/\by\/o\b/g, 'y o');   // «y/o» es redacción, no género
    ok(!/[a-záéíóú]\/[ao]\b|\bdel\/la\b|\bel\/la\b|\bal\/la\b|undefined|⟦FALTA⟧/i.test(txt), `${f.nombre}: sin barras de género, sin «undefined» y sin huecos`, (txt.match(/.{20}([a-záéíóú]\/[ao]\b|\bdel\/la\b|\bel\/la\b|undefined|⟦FALTA⟧).{20}/i) || [''])[0]);
    ok(/la administradora|de la administradora|Administradora Contadora|de la CONTRATISTA|del? /.test(txt), `${f.nombre}: y usa el género elegido`);
  }
  w.seleccionar(E('plantillas').find(p => p.seedKey === 'acta_terminacion').id);
  E('concordancias').forEach(g => w.aplicarConcordanciaUI(g.nombre, 0));
  ok(/Administrador Contador/.test(textoGenerado(E('plantillas').find(p => p.seedKey === 'acta_terminacion'))), 'al cambiar la elección, el texto cambia con ella');

    // El lote: cada documento puede traer su propio género / tipo de persona
    w.cambiarTab('lote');
    E('concordancias').forEach(g => w.aplicarConcordanciaUI(g.nombre, 0));
    w.document.getElementById('lt-pegar').value = ['contratoNro\tproveedor\tcontratista\tadministradorAP', 'FIAS-1\tServitec S.A.\tempresa\tfemenino', 'FIAS-2\tJosé Lecaro\tPersona natural — masculino\tM', 'FIAS-3\tAna Ruiz\t\t'].join('\n');
    w.procesarPegado();
    const filasLote = E('loteFilas');
    ok(filasLote.length === 3 && filasLote[0]._conc.contratista === 2 && filasLote[0]._conc.administradorAP === 1 && filasLote[1]._conc.contratista === 0 && filasLote[1]._conc.administradorAP === 0 && !filasLote[2]._conc,
      'al pegar desde Excel, las columnas «contratista» y «administradorAP» fijan el género de cada documento', JSON.stringify(filasLote.map(f => f._conc)));
    const varsActa = w.varsDe(actaFab);
    const base0 = E('conConcordancias')({ ...filasLote[0] }, varsActa), base1 = E('conConcordancias')({ ...filasLote[1] }, varsActa), base2 = E('conConcordancias')({ ...filasLote[2] }, varsActa);
    ok(base0.ProveedorTitulo === 'Proveedora' && base0.ElLaContratista === 'La CONTRATISTA' && base0.administradorAP === 'administradora', 'una empresa sale como «la CONTRATISTA» y una administradora, en su documento', JSON.stringify([base0.ProveedorTitulo, base0.ElLaContratista, base0.administradorAP]));
    ok(base1.ProveedorTitulo === 'Proveedor' && base1.ElLaContratista === 'El CONTRATISTA' && base1.administradorAP === 'administrador', 'y una persona natural masculina, en el suyo');
    ok(base2.ProveedorTitulo === 'Proveedor', 'sin columna, vale la elección de la pestaña Generar');
    ok(!('_conc' in base0), 'y la elección por fila no se cuela en los datos del documento');
    const celdas = w.document.querySelectorAll('.lote-tabla select.lt-conc');
    ok(celdas.length === 3 * 5 && celdas[0].value === '2', 'cada fila muestra sus selectores de género, con lo pegado ya elegido', celdas.length);

  }

  {
    seccion('17. Importar una biblioteca: cancelar no borra nada');
    // Antes era un confirm(): «Cancelar» REEMPLAZABA toda la biblioteca.
    const app3 = abrir();
    for(let i = 0; i < 50 && !app3.w.eval('plantillas').length; i++) await espera(100);
    await espera(300);
    const w = app3.w, E = s => w.eval(s);
    let descargas = 0;
    w.URL.createObjectURL = () => 'blob:x'; w.URL.revokeObjectURL = () => {};
    w.HTMLAnchorElement.prototype.click = function(){ if(this.download) descargas++; };
    const archivo = datos => new w.File([JSON.stringify(datos)], 'biblioteca.json', { type: 'application/json' });
    const biblioteca = { tipo: 'biblioteca_fap', version: 6, plantillas: [{ id: 'z1', nombre: 'Plantilla del archivo', tipo: 'html', cuerpo: '<p>x</p>', actualizado: '2026-01-01' }], clausulas: [], contrapartes: [{ id: 'c1', nombre: 'Del archivo' }] };
    const importar = async (datos) => { w.importarBiblioteca({ target: { files: [archivo(datos)], value: 'x' } }); await espera(250); };
    const antes = E('plantillas.length');
    await importar(biblioteca);
    const modal3 = w.document.getElementById('modal');
    ok(w.document.getElementById('modal-fondo').classList.contains('abierto') && /Fusionar/.test(modal3.textContent) && /Reemplazar todo/.test(modal3.textContent) && /Cancelar/.test(modal3.textContent), 'pregunta con tres opciones: Fusionar, Reemplazar todo y Cancelar');
    ok(E('plantillas.length') === antes, 'y mientras no elijas, no toca nada');
    w.cancelarImportacion();
    ok(E('plantillas.length') === antes && E('contrapartes.length') === 0 && descargas === 0, 'Cancelar deja la biblioteca como estaba');
    await importar(biblioteca);
    w.ejecutarImportacion(true);
    ok(E('plantillas.length') === antes + 1 && E('contrapartes.length') === 1 && descargas === 0, 'Fusionar suma lo nuevo y conserva lo que había');
    await importar(biblioteca);
    w.ejecutarImportacion(false);
    ok(E('plantillas.length') === 1 && E('plantillas')[0].nombre === 'Plantilla del archivo', 'Reemplazar todo deja solo lo del archivo');
    ok(descargas === 1, 'y antes baja una copia de lo que había');
  }

  ok(!errores.length, 'ningún error de JavaScript en todo el recorrido', errores.join(' | '));
  console.log(`\n${pruebas - fallos}/${pruebas} comprobaciones bien.`);
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
