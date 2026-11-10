/*
 * Comprobaciones del Calificador (calificacion/index.html) y de sus dos actas Word.
 *
 * El acta del Calificador se había quedado atrás de la de La Mágica: «se reúnen de manera
 * [nada] los miembros», un cuadro «el/la ordenador/a» sin resolver, «Presidente/a» y
 * «Secretario/a» con barra en un papel que se firma. Esto comprueba que ya no:
 *   · el género de cada miembro resuelve las barras del rol y del cargo (y no se adivina);
 *   · «¿Cómo sesionó la Comisión?» llega al acta como {presencialVirtual};
 *   · el género de quien preside resuelve {elLaOrdenador}, igual que en La Mágica;
 *   · sin género elegido el Word NO se genera;
 *   · lo que sale abre en Word (lo pasa por scripts/validar_docx.py).
 * «Cumple / No cumple» NO se toca: aquí sale de la evaluación de cada oferta, no de un cuadro.
 *
 * Uso (las dependencias no se guardan en el repositorio):
 *     npm install jsdom pizzip@3.2.0 docxtemplater@3.66.4
 *     node scripts/probar_calificador.js
 *
 * Sale con código 1 si algo falla, para poder colgarlo de un workflow.
 */
const fs=require('fs'), path=require('path'), os=require('os'), cp=require('child_process');
let JSDOM, PizZip, Docxtemplater;
try{
  JSDOM=require('jsdom').JSDOM;
  PizZip=require('pizzip');
  Docxtemplater=require('docxtemplater');
}catch(e){
  console.error('Faltan las dependencias de la prueba. Instálalas con:\n'
    +'    npm install jsdom pizzip@3.2.0 docxtemplater@3.66.4\n');
  process.exit(2);
}
const RAIZ=path.dirname(__dirname);
const HTML=fs.readFileSync(path.join(RAIZ,'calificacion','index.html'),'utf8');
const PLANTILLAS=path.join(RAIZ,'calificacion','plantillas');

let fallos=0;
function ok(cond,msg,extra){ if(cond){ console.log('  ✓ '+msg); } else { fallos++; console.log('  ✗ '+msg+(extra?('  → '+extra):'')); } }
function seccion(t){ console.log('\n'+t); }

function nuevo(){
  const dom=new JSDOM(HTML,{url:'http://localhost/calificacion/index.html',runScripts:'dangerously',
    beforeParse(win){ win.fetch=undefined; }});
  const w=dom.window;
  w.PizZip=PizZip; w.docxtemplater=Docxtemplater;
  w.confirm=()=>true; w.alert=()=>{};
  w.__avisos=[];
  w.eval('toast=function(m){ window.__avisos.push(m); }');
  w.HTMLAnchorElement.prototype.click=function(){};
  w.__blob=null;
  w.URL.createObjectURL=b=>{ w.__blob=b; return 'blob:prueba'; };
  w.fetch=u=>{
    const f=path.join(RAIZ,'calificacion',String(u));
    if(!fs.existsSync(f)) return Promise.resolve({ok:false});
    const b=fs.readFileSync(f);
    return Promise.resolve({ok:true,arrayBuffer:()=>Promise.resolve(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength))});
  };
  return w;
}
const esperar=ms=>new Promise(r=>setTimeout(r,ms));
// Genera el Word y devuelve {texto,xml,ruta} (o null si no salió).
async function generar(w){
  w.__blob=null; w.__avisos.length=0;
  w.generarActaWord();
  for(let i=0;i<60 && !w.__blob;i++){ await esperar(25); if(w.__avisos.length) break; }
  if(!w.__blob) return null;
  const buf=Buffer.from(await w.__blob.arrayBuffer());
  const xml=new PizZip(buf).file('word/document.xml').asText();
  const texto=xml.replace(/<\/w:p>/g,'\n').replace(/<[^>]+>/g,'');
  const ruta=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'calif-')),'acta.docx');
  fs.writeFileSync(ruta,buf);
  return {texto,xml,ruta};
}
function abreEnWord(ruta){
  const r=cp.spawnSync('python3',[path.join(RAIZ,'scripts','validar_docx.py'),ruta],{encoding:'utf8'});
  return {ok:r.status===0,salida:(r.stdout||'')+(r.stderr||'')};
}
const BARRA=/[A-Za-zÁÉÍÓÚáéíóúñ]\/a(?![A-Za-zÁÉÍÓÚáéíóúñ])/;

(async()=>{
  // ------------------------------------------------------------ 1
  seccion('1 · concordarGenero(): la barra se resuelve con el género elegido, sin adivinar');
  let w=nuevo();
  const c=(t,g)=>w.concordarGenero(t,g);
  ok(c('Presidente/a de la Comisión','F')==='Presidenta de la Comisión','Presidente/a → Presidenta',c('Presidente/a de la Comisión','F'));
  ok(c('Presidente/a de la Comisión','M')==='Presidente de la Comisión','Presidente/a → Presidente');
  ok(c('Secretario/a','F')==='Secretaria' && c('Secretario/a','M')==='Secretario','Secretario/a → Secretaria / Secretario');
  ok(c('Administrador/a del Parque Nacional Machalilla — MAE','F')==='Administradora del Parque Nacional Machalilla — MAE','Administrador/a → Administradora');
  ok(c('Delegado/a técnico/a FAP-FIAS','F')==='Delegada técnica FAP-FIAS','dos barras en un mismo cargo',c('Delegado/a técnico/a FAP-FIAS','F'));
  ok(c('Administrador/a contador/a (AC)','M')==='Administrador contador (AC)','Administrador/a contador/a (AC)');
  ok(c('Presidente/a','')==='Presidente/a' && c('Presidente/a',undefined)==='Presidente/a','sin género elegido la barra se queda (no se adivina)');
  ok(c('Miembro técnico','F')==='Miembro técnico','lo que no lleva barra no se toca');
  ok(c('FAP/ALERTA y 1/2 de la mitad','F')==='FAP/ALERTA y 1/2 de la mitad','«1/2», «FAP/ALERTA» no son barras de género',c('FAP/ALERTA y 1/2 de la mitad','F'));

  // ------------------------------------------------------------ 2
  seccion('2 · Sin género elegido, el Word NO se genera');
  w.eval("S=presetBienes(); render();");
  const falta=w.faltanGeneros().map(m=>m.rol);
  ok(falta.length===3,'en la plantilla de ejemplo faltan los 3 miembros (todos llevan barra)',JSON.stringify(falta));
  ok(/género/.test(w.document.getElementById('cmGeneroAviso').textContent),'el formulario dice qué falta');
  let r=await generar(w);
  ok(r===null,'no se generó nada');
  ok(w.__avisos.some(a=>/género/.test(a)),'y se explica por qué',w.__avisos.join(' | '));

  // ------------------------------------------------------------ 3
  seccion('3 · Cumple / No cumple (comparación de precios): sale sin barras y con la sesión');
  w.eval("S.comision[0].genero='F'; S.comision[1].genero='M'; S.comision[2].genero='F'; render();");
  ok(w.faltanGeneros().length===0,'con los tres elegidos ya no falta nada');
  ok(w.document.getElementById('cmGeneroAviso').textContent.trim()==='','y el aviso desaparece');
  r=await generar(w);
  ok(!!r,'se generó el Word');
  if(r){
    ok(!BARRA.test(r.texto),'ninguna «palabra/a» queda impresa',(r.texto.match(BARRA)||[])[0]);
    ok(/se reúnen de manera virtual los miembros/.test(r.texto),'«se reúnen de manera virtual los miembros»');
    ok(/la ordenadora de gasto solicitó/.test(r.texto),'la ordenadora de gasto (género de quien preside)');
    ok(/Presidenta de la Comisión/.test(r.texto),'Presidenta de la Comisión');
    ok(/Secretaria/.test(r.texto) && !/Secretario/.test(r.texto),'Secretaria');
    ok(/Administradora del Parque Nacional Machalilla/.test(r.texto),'el cargo del área con su género');
    ok(/Administradora contadora/.test(r.texto),'Administradora contadora (cargo de la Secretaria)');
    ok(!/undefined|\{[A-Za-z#/]|\}/.test(r.texto),'ninguna etiqueta suelta ni «undefined»');
    ok(/los miembros de la Comisión de Calificación suscriben/.test(r.texto),'«los miembros … suscriben», sin «los/las»');
    ok(/Cumple|No cumple/.test(r.texto),'el Cumple / No cumple sale de la evaluación de cada oferta');
    ok(/Modalidad de selección\s*Comparación de precios/.test(r.texto.replace(/\n/g,'')),'la modalidad sale de la herramienta');
    ok(!/tres cotizaciones|a la cual se sumaron/.test(r.texto),'sin las cifras de un caso concreto en el relato');
    ok(!/<w:sdt>(?:(?!<\/w:sdt>).)*ordenador/s.test(r.xml),'el cuadro «el/la ordenador/a» ya no está');
    const a=abreEnWord(r.ruta); ok(a.ok,'el .docx generado abre en Word',a.salida.slice(0,300));
  }

  // ------------------------------------------------------------ 4
  seccion('4 · El género de quien preside decide «el ordenador / la ordenadora»; la sesión se puede cambiar');
  w.eval("S.comision[0].genero='M'; S.sesion='presencial'; render();");
  r=await generar(w);
  ok(r && /el ordenador de gasto solicitó/.test(r.texto) && /Presidente de la Comisión/.test(r.texto),'él: «el ordenador de gasto», «Presidente»');
  ok(r && /se reúnen de manera presencial los miembros/.test(r.texto),'«de manera presencial»');
  w.eval("S.sesion=''; render();");
  r=await generar(w);
  ok(r && /se reúnen de manera ____________ los miembros/.test(r.texto),'sin elegir la sesión queda el espacio para completar, como las demás fechas');

  // ------------------------------------------------------------ 5
  seccion('5 · Por puntos (consultoría): misma lógica en su acta');
  w=nuevo();
  w.eval("S=presetConsultoria(); render();");
  const faltaP=w.faltanGeneros().map(m=>m.rol);
  ok(faltaP.length>=2,'la consultoría también pide el género de quien lleva barra: '+JSON.stringify(faltaP));
  r=await generar(w);
  ok(r===null,'sin género tampoco sale');
  w.eval("S.comision.forEach(function(m,i){ m.genero=(i%2?'M':'F'); }); S.sesion='virtual'; render();");
  ok(w.faltanGeneros().length===0,'elegidos, no falta nada');
  r=await generar(w);
  ok(!!r,'se generó el Word por puntos');
  if(r){
    ok(!BARRA.test(r.texto),'ninguna «palabra/a» queda impresa',(r.texto.match(BARRA)||[])[0]);
    ok(/se reúnen de manera virtual los miembros/.test(r.texto),'«de manera virtual»');
    ok(/la ordenadora de gasto solicitó/.test(r.texto),'la ordenadora de gasto (y no «de gasto de gasto»)');
    ok(!/undefined|\{[A-Za-z#/]|\}/.test(r.texto),'ninguna etiqueta suelta ni «undefined»');
    ok(/Modalidad de selección\s*Concurso de ofertas/.test(r.texto.replace(/\n/g,'')),'la modalidad de la consultoría ya no dice «Comparación de precios»');
    const a=abreEnWord(r.ruta); ok(a.ok,'el .docx por puntos abre en Word',a.salida.slice(0,300));
  }

  // ------------------------------------------------------------ 6
  seccion('6 · Vista previa / PDF: lo mismo, sin barras');
  w=nuevo();
  w.eval("S=presetBienes(); S.comision.forEach(function(m){ m.genero='F'; }); S.sesion='virtual'; render();");
  const prev=w.document.getElementById('actaDoc').textContent;
  ok(!BARRA.test(prev),'la vista previa no imprime barras',(prev.match(BARRA)||[])[0]);
  ok(/se reúnen de manera virtual los miembros/.test(prev),'la vista previa dice cómo sesionó');
  ok(!/los\/las/.test(prev),'ni «los/las»');

  // ------------------------------------------------------------ 7
  seccion('7 · Lo guardado de antes se abre sin romperse');
  w=nuevo();
  w.eval("(function(){ var v=presetBienes(); delete v.sesion; v.comision.forEach(function(m){ delete m.genero; }); S=normalize(v); render(); })()");
  ok(w.eval('S.sesion')==='' && w.eval("S.comision.every(function(m){return m.genero===''})"),'un proceso guardado antes llega con sesión y género vacíos, sin adivinar');

  console.log('\n'+(fallos?('✗ '+fallos+' comprobación(es) fallaron'):'✓ todo bien'));
  process.exit(fallos?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
