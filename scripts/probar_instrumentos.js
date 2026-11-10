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

  {
    seccion('18. Exportar e importar variables: el género viaja con ellas');
    // Las variables de concordancia sin sus grupos quedaban como campos sueltos
    // y la AC tenía que configurar el género otra vez.
    const app4 = abrir();
    for(let i = 0; i < 50 && !app4.w.eval('plantillas.length'); i++) await espera(100);
    await espera(300);
    const w = app4.w, E = s => w.eval(s);
    let json = null;
    w.URL.createObjectURL = (b) => { json = b; return 'blob:x'; }; w.URL.revokeObjectURL = () => {};
    w.HTMLAnchorElement.prototype.click = function(){};
    const nGrupos = E('concordancias.length');
    w.exportarVariables();
    const texto = await new Promise(r => { const fr = new w.FileReader(); fr.onload = () => r(fr.result); fr.readAsText(json); });
    const datos = JSON.parse(texto);
    ok(nGrupos > 0 && Array.isArray(datos.concordancias) && datos.concordancias.length === nGrupos, 'el archivo de variables lleva los grupos de concordancia', nGrupos + ' / ' + (datos.concordancias||[]).length);
    // instalación nueva: sin grupos ni variables
    w.eval('concordancias = []; variablesRepo = [];');
    w.alert = () => {};
    w.importarBiblioteca({ target: { files: [new w.File([texto], 'v.json', { type: 'application/json' })], value: 'x' } });
    await espera(250);
    ok(E('concordancias.length') === nGrupos, 'al importar, los grupos quedan listos para usar', E('concordancias.length'));
    ok(E('concordanciasHuerfanas().length') === 0, 'y ninguna variable de concordancia queda huérfana (sin selector)');
  }

  {
    seccion('19. Tomar los datos de un documento para hacer otro');
    // Del acta al informe sin teclear de nuevo: lo que se llama igual pasa tal
    // cual, con el género, y lo que no se sabe no se adivina.
    const a = abrir();
    for(let i = 0; i < 50 && !a.w.eval('plantillas.length'); i++) await espera(100);
    await espera(300);
    const w = a.w, E = s => w.eval(s);
    w.URL.createObjectURL = () => 'blob:x'; w.URL.revokeObjectURL = () => {};
    w.HTMLAnchorElement.prototype.click = function(){};
    const acta = E('plantillas').find(p => p.seedKey === 'acta_terminacion');
    const informe = E('plantillas').find(p => p.seedKey === 'informe_adenda');
    ok(!!acta && !!informe, 'están las dos plantillas Word de fábrica');
    w.seleccionar(acta.id);
    w.eval(`Object.assign(datosForm, { contratoNro:'FIAS-FAP-2026-041', proveedor:'Ferretería El Roble Cía. Ltda.', proveedorRuc:'1790012345001',
      objeto:'Mantenimiento de la guardianía', fechaContrato:'2026-03-02', area:'Reserva Ecológica de Prueba', ac:'Ana Prueba', montoTotal:'1150', ciudad:'Quito' })`);
    w.aplicarConcordancia('contratista', 2);   // empresa
    const idxAC = E(`concordanciasDe(varsDe(plActual())).findIndex(g => g.nombre !== 'contratista' && (g.opciones||[]).length > 1)`);
    const grupoAC = E(`concordanciasDe(varsDe(plActual()))[${idxAC}].nombre`);
    w.aplicarConcordancia(grupoAC, 1);
    await w.descargarWord();
    await espera(100);
    ok(E('historial.length') === 1 && E('historial[0].conc.contratista') === 2, 'el historial guarda con qué género se generó el documento', JSON.stringify(E('historial[0] && historial[0].conc')));
    ok(/usarUltimaDescargaEnOtra/.test(w.htmlAvisoDescarga()), 'tras descargar se ofrece «Usar estos datos en otra plantilla»');
    w.usarUltimaDescargaEnOtra();
    ok(/Informe de adenda/.test(w.document.getElementById('pt-lista').textContent), 'y la lista propone el informe de adenda, con cuántos campos llena', w.document.getElementById('pt-lista').textContent.replace(/\s+/g, ' ').slice(0, 200));
    w.usarDatosEn(informe.id);
    ok(E('seleccion') === informe.id && E('tabActual') === 'generar', 'al elegirla se abre esa plantilla en Generar');
    ok(E('datosForm.contratoNro') === 'FIAS-FAP-2026-041' && E('datosForm.proveedorRuc') === '1790012345001' && E('datosForm.fechaContrato') === '2026-03-02',
      'con el contrato, el RUC y la fecha ya escritos', JSON.stringify(E('datosForm')).slice(0, 200));
    ok(E('concSel.contratista') === 2 && E('datosForm.contratistaTrato') === E(`concordancias.find(g => g.nombre === 'contratista').tags.contratistaTrato[2]`),
      'y el género del contratista: sigue siendo empresa', E('datosForm.contratistaTrato'));
    // En el informe el total es montoOriginal + montoAumento: se calcula, no se copia.
    ok(!E('datosForm.montoTotal'), 'el total, que el informe calcula solo, no se copia del acta', E('datosForm.montoTotal'));
    w.actualizarCampo('montoOriginal', '1000'); w.actualizarCampo('montoAumento', '150');
    ok(Number(E('datosForm.montoTotal')) === 1150 && /ciento cincuenta/i.test(E('datosForm.montoTotalLetras') || ''), 'y se rehace, con sus letras, al escribir las dos cifras', E('datosForm.montoTotal') + ' / ' + E('datosForm.montoTotalLetras'));
    ok(!E('datosForm.fechaActa') && !E('datosForm.cedulaAc'), 'lo que el informe no pide no viaja');
    ok(/Se trajeron \d+ datos/.test(w.document.getElementById('aviso-traidos').textContent) && /Faltan? \d+ por llenar/.test(w.document.getElementById('aviso-traidos').textContent),
      'el aviso dice cuántos datos llegaron y cuántos faltan', w.document.getElementById('aviso-traidos').textContent.replace(/\s+/g, ' '));

    // Desde el formulario: «Tomar datos de otro documento»
    w.limpiarForm();
    ok(!E('datosForm.contratoNro'), 'formulario del informe en blanco');
    w.abrirPickerDocumento();
    ok(w.document.querySelectorAll('#pd-lista .reg-fila').length === 1 && /llena \d+ de \d+/.test(w.document.getElementById('pd-lista').textContent),
      'el selector lista el acta descargada y cuánto llena', w.document.getElementById('pd-lista').textContent.replace(/\s+/g, ' ').slice(0, 160));
    w.tomarDatosDe(0);
    ok(E('datosForm.proveedor') === 'Ferretería El Roble Cía. Ltda.' && E('concSel.contratista') === 2, 'y al elegirlo llegan los datos y el género');

    // Un nombre que solo difiere en mayúsculas o guiones bajos es el mismo dato; otro nombre, no.
    w.eval(`historial.unshift({ fecha: new Date().toISOString(), plantilla: 'Otra', archivo: 'otra.docx', datos: { contratonro: 'FIAS-FAP-2026-077', fecha_contrato: '2026-05-05', nombre_del_proveedor: 'No debe pasar' } })`);
    w.limpiarForm(); w.tomarDatosDe(0);
    ok(E('datosForm.contratoNro') === 'FIAS-FAP-2026-077' && E('datosForm.fechaContrato') === '2026-05-05', '«contratonro» y «fecha_contrato» llenan {contratoNro} y {fechaContrato}');
    ok(!E('datosForm.proveedor'), 'pero nada pasa por parecido: «nombre_del_proveedor» no es {proveedor}', E('datosForm.proveedor'));
    ok(E('avisoDatosTraidos.sinGenero.length') > 0, 'y si el origen no dice el género, no se elige: se avisa', JSON.stringify(E('avisoDatosTraidos.sinGenero')));

    // Historial de antes (sin la elección guardada): se lee de lo que quedó escrito
    const tagsEmpresa = E(`JSON.stringify(Object.fromEntries(Object.entries(concordancias.find(g => g.nombre === 'contratista').tags).map(([t, o]) => [t, o[1]])))`);
    w.eval(`historial.unshift({ fecha: new Date().toISOString(), plantilla: ${JSON.stringify(informe.nombre)}, archivo: 'viejo.docx', datos: Object.assign({ contratoNro: 'V-1' }, ${tagsEmpresa}) })`);
    w.eval('concSel = {}');
    w.reusar(0);
    ok(E('concSel.contratista') === 1, '«Reusar datos» de un documento antiguo recupera su género en vez de quedarse con el de pantalla', E('concSel.contratista'));

    // Historial de otra persona: se abre solo para tomar datos
    const ajeno = JSON.stringify({ tipo: 'historial_fap', version: 1, historial: [{ fecha: '2026-06-01T10:00:00Z', plantilla: 'Acta ajena', archivo: 'ajena.docx', datos: { contratoNro: 'AJ-9', proveedor: 'Otra Persona' } }] });
    const nHist = E('historial.length');
    w.abrirPickerDocumento();
    w.abrirHistorialAjeno({ target: { files: [new w.File([ajeno], 'h.json', { type: 'application/json' })], value: 'x' } });
    await espera(250);
    ok(/de otro historial/.test(w.document.getElementById('pd-lista').textContent) && E('historial.length') === nHist, 'el historial que pasa otra persona se puede usar sin que se mezcle con el propio');
    ok(!a.errores.length, 'sin errores de JavaScript', a.errores.join(' | '));
  }

  {
    seccion('20. Texto largo: varios párrafos que salen como párrafos');
    const a = abrir();
    for(let i = 0; i < 50 && !a.w.eval('plantillas.length'); i++) await espera(100);
    await espera(300);
    const w = a.w, E = s => w.eval(s);
    const S = w.SALTO_PARRAFO || E('SALTO_PARRAFO');
    ok(E(`buscarVar('justificacion').tipo`) === 'parrafo' && E(`buscarVar('antecedentes').tipo`) === 'parrafo', 'las variables de «texto libre» de fábrica nacen como texto largo');
    ok(E(`buscarVar('proveedor').tipo`) === 'texto', 'y las cortas siguen siendo de una línea');

    // El motor, con un párrafo de lista, justificado y con ids de Word
    const par = `<w:p w14:paraId="1A2B3C4D" w:rsidR="00AA"><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="3"/></w:numPr><w:jc w:val="both"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Antes: Uno.${S}Dos.${S}${S}Tres. Después</w:t></w:r></w:p>`;
    const partido = w.partirParrafosXml(par);
    const ps = partido.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || [];
    ok(ps.length === 4 && !partido.includes(S), 'tres saltos dan cuatro párrafos (la línea en blanco se respeta) y la marca no queda en el documento', ps.length);
    ok(/Antes: Uno\.<\/w:t>/.test(ps[0]) && />Dos\.<\/w:t>/.test(ps[1]) && />Tres\. Después<\/w:t>/.test(ps[3]), 'el texto de alrededor se queda con el primero y el último');
    ok(ps.every(p => /<w:jc w:val="both"\/>/.test(p)) && ps.slice(1).every(p => /<w:rPr><w:b\/><\/w:rPr>/.test(p)), 'cada párrafo nuevo repite el formato del párrafo y la letra de la etiqueta');
    ok(/<w:numPr>/.test(ps[0]) && ps.slice(1).every(p => !/<w:numPr>/.test(p) && !/paraId/.test(p)), 'pero no repite el número de lista ni los ids del original');
    ok(!/<w:br\/>/.test(partido), 'y no usa saltos de línea, que en un texto justificado estiran la última línea');
    const enlace = `<w:p><w:hyperlink r:id="rId9"><w:r><w:t>a${S}b</w:t></w:r></w:hyperlink></w:p>`;
    ok(/a<\/w:t><w:br\/><w:t xml:space="preserve">b/.test(w.partirParrafosXml(enlace)) && (w.partirParrafosXml(enlace).match(/<w:p>/g) || []).length === 1,
      'dentro de un hipervínculo no se parte el párrafo: queda un salto de línea');

    // En un Word de verdad: el informe de adenda, con {objeto} largo
    const informe = E('plantillas').find(p => p.seedKey === 'informe_adenda');
    w.seleccionar(informe.id);
    ok(w.document.getElementById('f_objeto').tagName === 'INPUT' && /btn-largo/.test(w.document.getElementById('f_objeto').closest('.campo').innerHTML), 'un campo de texto corto trae el botón para volverlo largo');
    // Pegar varios párrafos en la casilla lo convierte solo
    const inp = w.document.getElementById('f_objeto');
    inp.value = ''; inp.selectionStart = inp.selectionEnd = 0;
    let evitado = false;
    w.pegarEnCampo({ target: inp, preventDefault(){ evitado = true; }, clipboardData: { getData: () => 'Primer párrafo del objeto.\r\nSegundo párrafo.\n\n' } }, 'objeto');
    ok(evitado && E(`tipoDe('objeto')`) === 'parrafo' && w.document.getElementById('f_objeto').tagName === 'TEXTAREA', 'pegar dos párrafos en una casilla la vuelve de texto largo');
    ok(E('datosForm.objeto') === 'Primer párrafo del objeto.\nSegundo párrafo.', 'y conserva los párrafos, sin líneas en blanco colgando', JSON.stringify(E('datosForm.objeto')));
    evitado = false;
    w.pegarEnCampo({ target: w.document.getElementById('f_proveedor'), preventDefault(){ evitado = true; }, clipboardData: { getData: () => 'Una sola línea' } }, 'proveedor');
    ok(!evitado && E(`tipoDe('proveedor')`) === 'texto', 'pegar una sola línea no cambia nada');
    const blob = w.generarBlobDocx(informe, w.datosDocx(informe, E('datosForm')));
    const b64 = await new Promise(r => { const fr = new w.FileReader(); fr.onload = () => r(String(fr.result).split(',')[1]); fr.readAsDataURL(blob); });
    const xmlG = xmlDe(b64);
    const pObj = (xmlG.match(/<w:p[ >](?:(?!<w:p[ >])[\s\S])*?<\/w:p>/g) || []);
    const i1 = pObj.findIndex(p => p.includes('Primer párrafo del objeto.')), i2 = pObj.findIndex(p => p.includes('Segundo párrafo.'));
    ok(i1 >= 0 && i2 === i1 + 1 && !xmlG.includes(S), 'en el Word generado son dos párrafos seguidos', i1 + ' / ' + i2);
    const vL = validarConPython(b64, 'largo');
    if(vL.saltada) console.log('  · (sin python3: no se pasó por validar_docx.py)');
    else ok(vL.ok, 'validar_docx.py dice que Word lo abre', vL.salida.trim().split('\n').slice(-3).join(' | '));
    // Volver a una línea junta los párrafos
    w.alternarLargo('objeto');
    ok(E(`tipoDe('objeto')`) === 'texto' && E('datosForm.objeto') === 'Primer párrafo del objeto. Segundo párrafo.', 'volver a una línea junta los párrafos en uno', JSON.stringify(E('datosForm.objeto')));

    // Plantillas HTML: el acta de ajuste de monto y su justificación
    const html = w.rellenarDatos('<p style="text-align:justify">Motivo: {{justificacion}} Fin.</p><ul><li>{{justificacion}}</li></ul>', { justificacion: 'Uno.\nDos.' }, false);
    const d = w.document.createElement('div'); d.innerHTML = html;
    ok(d.querySelectorAll('p').length === 2 && d.querySelectorAll('p')[1].getAttribute('style') === 'text-align:justify' && d.querySelectorAll('p')[1].textContent === 'Dos. Fin.',
      'en una plantilla HTML el párrafo también se parte, con su mismo estilo', html);
    ok(d.querySelectorAll('li').length === 1 && d.querySelector('li br') && !/data-salto/.test(html), 'y en un punto de lista se queda como salto de línea, sin crear otro punto');
    ok(!a.errores.length, 'sin errores de JavaScript', a.errores.join(' | '));
  }

  {
    seccion('21. Contrapartes: los datos salen del Excel, leído aquí');
    const a = abrir();
    for(let i = 0; i < 50 && !a.w.eval('plantillas.length'); i++) await espera(100);
    await espera(300);
    const w = a.w, E = s => w.eval(s);
    // Un Excel como el maestro: la hoja de contratos (encabezados en la fila 2, con
    // el correo de la AC) y la de proveedores. Los datos son inventados.
    const textos = ['Registro de contratos', 'Nro. de contrato', 'Nombre del proveedor', 'Correo electrónico AC', 'FIAS-FAP-2026-001', 'FERRETERIA EL ROBLE CIA LTDA', 'ac@fias.org.ec',
      'Razón social', 'RUC', 'Representante legal', 'Correo', 'Dirección', 'Ferretería El Roble Cía. Ltda.', 'Rosa Prueba', 'roble@ejemplo.ec', 'Av. Siempre Viva 123 &amp; Sucre',
      'María Pérez Andrade', 'maria@ejemplo.ec', 'Taller Nuevo S.A.', 'Calle 1'];
    const T = t => textos.indexOf(t);
    const c = (ref, v, t) => `<c r="${ref}"${t ? ` t="${t}"` : ''}><v>${v}</v></c>`;
    const hoja = filas => `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${filas.map((f, i) => `<row r="${i + 1}">${f}</row>`).join('')}</sheetData></worksheet>`;
    const zx = new PizZip();
    zx.file('xl/workbook.xml', `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="2026" sheetId="1" r:id="rId1"/><sheet name="Proveedores" sheetId="2" r:id="rId2"/></sheets></workbook>`);
    zx.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="x" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="x" Target="worksheets/sheet2.xml"/></Relationships>`);
    zx.file('xl/sharedStrings.xml', `<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${textos.map((t, i) => i === 12 ? `<si><r><t>Ferretería El Roble </t></r><r><t>Cía. Ltda.</t></r></si>` : `<si><t>${t}</t></si>`).join('')}</sst>`);
    zx.file('xl/worksheets/sheet1.xml', hoja([
      c('A1', T('Registro de contratos'), 's'),
      c('A2', T('Nro. de contrato'), 's') + c('B2', T('Nombre del proveedor'), 's') + c('C2', T('Correo electrónico AC'), 's'),
      c('A3', T('FIAS-FAP-2026-001'), 's') + c('B3', T('FERRETERIA EL ROBLE CIA LTDA'), 's') + c('C3', T('ac@fias.org.ec'), 's')]));
    zx.file('xl/worksheets/sheet2.xml', hoja([
      c('A1', T('Razón social'), 's') + c('B1', T('RUC'), 's') + c('C1', T('Representante legal'), 's') + c('D1', T('Correo'), 's') + c('E1', T('Dirección'), 's'),
      c('A2', 12, 's') + c('B2', '1.790012345001E12') + c('C2', T('Rosa Prueba'), 's') + c('D2', T('roble@ejemplo.ec'), 's') + c('E2', T('Av. Siempre Viva 123 &amp; Sucre'), 's'),
      c('A3', T('María Pérez Andrade'), 's') + c('B3', '102030405') + c('D3', T('maria@ejemplo.ec'), 's'),
      c('A4', T('Taller Nuevo S.A.'), 's') + c('B4', '190012345001') + c('E4', T('Calle 1'), 's')]));
    const hojas = w.leerXlsx(zx.generate({ type: 'nodebuffer' }).toString('binary'));
    ok(hojas.length === 2 && hojas[1].nombre === 'Proveedores' && hojas[1].filas.length === 4, 'lee las hojas del .xlsx sin librerías nuevas', hojas.map(h => h.nombre + ':' + h.filas.length).join(' '));
    ok(hojas[1].filas[1][0] === 'Ferretería El Roble Cía. Ltda.' && hojas[1].filas[1][1] === '1790012345001' && hojas[1].filas[1][4] === 'Av. Siempre Viva 123 & Sucre',
      'con los textos partidos en trozos, los RUC en notación científica y los «&»', JSON.stringify(hojas[1].filas[1]));
    const m2026 = w.adivinarColumnasCp(hojas[0].filas[1]);
    ok(m2026.nombre === 1 && m2026.email === -1, 'en la hoja de contratos, el «Correo electrónico AC» no se toma por el correo del proveedor', JSON.stringify(m2026));

    w.eval(`contrapartes = [
      { nombre:'FERRETERIA EL ROBLE CIA LTDA', identificacion:'', representante:'', email:'', direccion:'' },
      { nombre:'María Pérez Andrade', identificacion:'', representante:'', email:'yo.lo.escribi@ejemplo.ec', direccion:'' }]`);
    w.eval(`tabActual = 'contrapartes'`); w.renderTabs(); w.renderContenido();
    ok(/abrirContrapartesExcel/.test(w.document.getElementById('contenido').innerHTML) && /2 de 2 contrapartes no tienen cédula ni RUC/.test(w.document.getElementById('contenido').textContent),
      'la pestaña ofrece traerlos del Excel y dice cuántas están incompletas');
    w.prepararContrapartesExcel(hojas);
    ok(E('cpExcel.hoja') === 1 && E('cpExcel.filaEnc') === 0, 'propone la hoja «Proveedores» y su fila de encabezados', E('cpExcel.hoja') + '/' + E('cpExcel.filaEnc'));
    ok(JSON.stringify(E('cpExcel.mapa')) === JSON.stringify({ representante: 2, identificacion: 1, email: 3, direccion: 4, nombre: 0 }), 'y de qué columna sale cada dato', JSON.stringify(E('cpExcel.mapa')));
    const res = w.document.getElementById('cpx-resumen').textContent.replace(/\s+/g, ' ');
    ok(/3 filas con nombre/.test(res) && /2 de tus contrapartes se completan/.test(res) && /1 son nuevas/.test(res) && /En 1 ya tenías un dato distinto/.test(res) && /A 2 cédula/.test(res),
      'antes de traer nada dice qué va a pasar', res);
    ok(E('contrapartes.length') === 2 && !E('contrapartes[0].identificacion'), 'y mientras tanto no ha tocado nada');
    w.aplicarContrapartesExcel();
    const cps = E('contrapartes');
    ok(cps[0].identificacion === '1790012345001' && cps[0].representante === 'Rosa Prueba' && cps[0].nombre === 'FERRETERIA EL ROBLE CIA LTDA',
      'empareja por nombre sin contar tildes ni puntos, y completa lo vacío', JSON.stringify(cps[0]));
    ok(cps[1].identificacion === '0102030405' && cps[1].email === 'yo.lo.escribi@ejemplo.ec', 'repone el cero que Excel quita a la cédula y conserva el correo que ya estaba escrito', JSON.stringify(cps[1]));
    ok(cps.length === 3 && cps[2].nombre === 'Taller Nuevo S.A.' && cps[2].identificacion === '0190012345001', 'y añade el proveedor que faltaba', JSON.stringify(cps[2]));
    w.prepararContrapartesExcel(hojas); w.aplicarContrapartesExcel();
    ok(E('contrapartes.length') === 3, 'traerlo otra vez no duplica nada');

    // Pegado desde Excel, con una celda entre comillas
    const pegado = w.leerPegadoTabla('Proveedor\tCédula\tDomicilio\r\nJuan Prueba\t1712345678\t"Calle A\nPiso 2"\r\n');
    ok(pegado.length === 2 && pegado[1][2] === 'Calle A Piso 2', 'las filas pegadas se leen igual, también una celda con salto de línea', JSON.stringify(pegado));
    ok(JSON.stringify(w.adivinarColumnasCp(pegado[0])) === JSON.stringify({ representante: -1, identificacion: 1, email: -1, direccion: 2, nombre: 0 }), 'y sus encabezados se reconocen');

    // Al tomar un contrato del registro, el RUC del proveedor llega con él
    w.eval(`registro = [{ nro:'FIAS-FAP-2026-001', proveedor:'Ferretería El Roble Cía. Ltda.', detalle:'Mantenimiento', area:'Reserva de Prueba', monto:1150, firma:'2026-03-02' },
                        { nro:'FIAS-FAP-2026-002', proveedor:'Proveedor Sin Ficha', detalle:'Otro', area:'Reserva de Prueba', monto:500, firma:'2026-04-01' }]; registroEstado = 'ok'`);
    const acta = E('plantillas').find(p => p.seedKey === 'acta_terminacion');
    w.seleccionar(acta.id); w.limpiarForm();
    w.elegirDelRegistro(0);
    ok(E('datosForm.contratoNro') === 'FIAS-FAP-2026-001' && E('datosForm.proveedorRuc') === '1790012345001', '«Tomar datos del registro» trae también el RUC de la contraparte guardada', E('datosForm.proveedorRuc'));
    w.elegirDelRegistro(1);
    ok(E('datosForm.proveedor') === 'Proveedor Sin Ficha' && !E('datosForm.proveedorRuc'), 'y al cambiar a un proveedor sin ficha no deja el RUC del anterior', E('datosForm.proveedorRuc'));
    ok(!a.errores.length, 'sin errores de JavaScript', a.errores.join(' | '));
  }

  {
    seccion('22. Proveedores del Excel maestro: con su propia frase, y solo aquí');
    // Lo que publica el robot (instrumentos/proveedores_export.json), cifrado como él:
    // AES-256-GCM con la clave derivada por PBKDF2-SHA256 de la frase de proveedores.
    const wc = require('crypto').webcrypto;
    const FRASE = 'frase-de-proveedores', FRASE_AC = 'frase-del-registro';
    const lista = [
      { nombre: 'Ferretería El Roble Cía. Ltda.', identificacion: '1790012345001', representante: 'Rosa Prueba', email: 'roble@ejemplo.ec', direccion: 'Av. 1' },
      { nombre: 'Taller Solo En Excel S.A.', identificacion: '0190012345001' }];
    const salt = wc.getRandomValues(new Uint8Array(16)), iv = wc.getRandomValues(new Uint8Array(12));
    const base = await wc.subtle.importKey('raw', new TextEncoder().encode(FRASE), 'PBKDF2', false, ['deriveKey']);
    const key = await wc.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 1000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
    const ct = new Uint8Array(await wc.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(lista))));
    const b64 = u => Buffer.from(u).toString('base64');
    const SOBRE = { fap_enc: 1, kdf: 'PBKDF2-SHA256', iter: 1000, salt: b64(salt), iv: b64(iv), ct: b64(ct), generado: new Date().toISOString() };

    const pedidas = [];
    const { JSDOM, VirtualConsole } = require('jsdom');
    const errs = []; const vc = new VirtualConsole(); vc.on('jsdomError', e => errs.push(e.message));
    const dom = new JSDOM(HTML, { url: 'http://localhost/instrumentos/index.html', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
      beforeParse(w){
        w.fetch = (url) => { pedidas.push(String(url));
          return /proveedores_export\.json$/.test(url) ? Promise.resolve({ ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(SOBRE)) }) : Promise.reject(new Error('sin red')); };
        w.alert = () => {}; w.confirm = () => true;
        if(!w.crypto.subtle) Object.defineProperty(w, 'crypto', { value: wc, configurable: true });
        w.addEventListener('error', e => errs.push(e.message));
      } });
    const w = dom.window, E = s => w.eval(s);
    for(let i = 0; i < 50 && !E('plantillas.length'); i++) await espera(100);
    for(let i = 0; i < 50 && E('provEstado') === 'cargando'; i++) await espera(100);
    ok(pedidas.some(u => /^\.\/proveedores_export\.json$|instrumentos\/proveedores_export\.json$/.test(u)), 'al arrancar pide los proveedores publicados', pedidas.join(' | '));
    ok(E('provEstado') === 'protegido' && E('provExcel.length') === 0, 'sin frase quedan cerrados: no hay nada descifrado', E('provEstado'));
    w.eval(`contrapartes = [{ nombre:'FERRETERIA EL ROBLE CIA LTDA', identificacion:'', representante:'', email:'yo@ejemplo.ec', direccion:'' }]; tabActual = 'contrapartes'`);
    w.renderTabs(); w.renderContenido();
    ok(/desbloquearProveedores/.test(w.document.getElementById('contenido').innerHTML), 'la pestaña Contrapartes ofrece abrirlos');

    // La frase del registro no sirve; la de proveedores, sí
    const responder = frase => { setTimeout(() => { const i = w.document.querySelector('#modal input[type="password"], #modal input'); i.value = frase; i.dispatchEvent(new w.Event('input', { bubbles: true }));
      const b = Array.from(w.document.querySelectorAll('#modal .m-pie .btn')).pop(); b.click(); }, 30); };
    const prom = w.desbloquearProveedores();
    responder(FRASE_AC);
    await espera(400);
    ok(E('provEstado') === 'protegido' && /Frase incorrecta/.test(w.document.getElementById('modal').textContent), 'la frase del registro, la de las ACs, no los abre');
    responder(FRASE);
    const abrio = await prom;
    ok(abrio && E('provEstado') === 'ok' && E('provExcel.length') === 2, 'con la frase de proveedores se abren', E('provEstado'));
    ok(E(`localStorage.getItem('fap_gen_clave_proveedores')`) === FRASE && E(`localStorage.getItem('fap_data_key')`) !== FRASE,
      'la frase queda guardada aparte de la del registro');
    ok(!Object.keys(w.localStorage).some(k => /1790012345001/.test(w.localStorage.getItem(k) || '')), 'y nada descifrado se guarda en el navegador');

    const vista = E('contrapartesVista()');
    ok(vista.length === 2 && vista[0].x.identificacion === '1790012345001' && vista[0].x.email === 'yo@ejemplo.ec' && vista[0].delExcel.join() === 'identificacion,representante,direccion',
      'la contraparte guardada se completa con el Excel, pero lo que ya tenía escrito manda', JSON.stringify(vista[0]));
    ok(vista[1].i === -1 && vista[1].x.nombre === 'Taller Solo En Excel S.A.', 'y el proveedor que solo está en el Excel aparece igual', JSON.stringify(vista[1]));
    w.renderContenido();
    const txt = w.document.getElementById('contenido').textContent;
    ok(/2 proveedores del Excel maestro/.test(txt) && /Excel maestro/.test(txt) && /las ACs no los ven/.test(txt), 'la pestaña dice cuántos hay y de dónde viene cada uno');
    ok(E('contrapartes.length') === 1, 'abrirlos no copia nada a las contrapartes guardadas');

    // Editar uno del Excel guarda una copia que manda
    w.editarContraparte(-1, 1);
    ok(w.document.getElementById('cp-id').value === '0190012345001', 'editar uno del Excel abre sus datos');
    w.document.getElementById('cp-email').value = 'nuevo@ejemplo.ec';
    w.guardarContraparte(-1);
    ok(E('contrapartes.length') === 2 && E('contrapartesVista().length') === 2 && E(`contraparteDe('Taller Solo En Excel S.A.').email`) === 'nuevo@ejemplo.ec',
      'y lo guarda como contraparte propia, sin duplicarlo en la lista');

    // Tomar un contrato del registro trae el RUC del Excel
    w.eval(`registro = [{ nro:'FIAS-FAP-2026-001', proveedor:'Ferretería El Roble Cía. Ltda.', detalle:'Mantenimiento', area:'Reserva', monto:1150, firma:'2026-03-02' }]; registroEstado = 'ok'`);
    const acta = E('plantillas').find(p => p.seedKey === 'acta_terminacion');
    w.seleccionar(acta.id); w.limpiarForm(); w.elegirDelRegistro(0);
    ok(E('datosForm.proveedorRuc') === '1790012345001', '«Tomar datos del registro» trae el RUC del Excel maestro', E('datosForm.proveedorRuc'));
    w.abrirPickerContraparte();
    ok(w.document.querySelectorAll('#pc-lista .reg-fila').length === 2, '«Usar contraparte guardada» también los lista');

    // Sin archivo publicado (falta el secreto) no es un error
    const a2 = abrir(); const w2 = a2.w;
    w2.fetch = (url) => Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    for(let i = 0; i < 50 && !w2.eval('plantillas.length'); i++) await espera(100);
    await w2.cargarProveedores();
    w2.eval(`tabActual = 'contrapartes'`); w2.renderTabs(); w2.renderContenido();
    ok(w2.eval('provEstado') === 'sin' && !/prov-estado/.test(w2.document.getElementById('contenido').innerHTML) && /abrirContrapartesExcel/.test(w2.document.getElementById('contenido').innerHTML),
      'sin archivo publicado no hay aviso de error, y queda «Traer datos del Excel maestro»', w2.eval('provEstado'));
    const sw = fs.readFileSync(path.join(RAIZ, 'instrumentos', 'sw.js'), 'utf8');
    ok(/proveedores\)?_export|\(contratos\|proveedores\)_export/.test(sw), 'el service worker no guarda el archivo de proveedores en su caché');
    ok(!errs.length, 'sin errores de JavaScript', errs.join(' | '));
  }

  ok(!errores.length, 'ningún error de JavaScript en todo el recorrido', errores.join(' | '));
  console.log(`\n${pruebas - fallos}/${pruebas} comprobaciones bien.`);
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
