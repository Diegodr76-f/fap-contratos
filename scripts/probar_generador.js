/*
 * Comprobaciones de La Mágica (generador/index.html).
 *
 * La herramienta es un solo HTML sin build ni framework, así que la única forma
 * de verificar su lógica sin ir haciendo clic es cargarla en un DOM de mentira y
 * manejarla desde fuera. Esto cubre lo que se añadió para el plan de
 * renovaciones 2027: la vía de renovación, los arreglos de almacenamiento, la
 * pantalla Mis procesos y la lista de verificación que bloquea el envío — y
 * comprueba de paso que las tres vías de siempre siguen intactas.
 *
 * Uso (las dependencias no se guardan en el repositorio):
 *     npm install jsdom pizzip@3.2.0 docxtemplater@3.66.4
 *     node scripts/probar_generador.js
 *
 * Sale con código 1 si algo falla, para poder colgarlo de un workflow.
 */
const fs=require('fs'), path=require('path');
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
const HTML=fs.readFileSync(path.join(RAIZ,'generador','index.html'),'utf8');

let fallos=0, pruebas=0;
function ok(cond,msg,extra){ pruebas++; if(cond){ console.log('  ✓ '+msg); } else { fallos++; console.log('  ✗ '+msg+(extra?('  → '+extra):'')); } }
function seccion(t){ console.log('\n'+t); }

function nuevoDom(pre){
  const dom=new JSDOM(HTML,{url:'http://localhost/generador/index.html',runScripts:'dangerously',
    beforeParse(win){ win.fetch=undefined; if(pre) pre(win); }});
  const w=dom.window;
  w.PizZip=PizZip; w.docxtemplater=Docxtemplater;
  w.confirm=()=>true; w.prompt=()=>'Proceso de prueba'; w.alert=()=>{};
  return w;
}

// ---------------------------------------------------------------- 1
seccion('1 · El seed ya no se copia a localStorage');
let w=nuevoDom();
ok(Object.keys(w.ST.tpls).length===19,'las 19 plantillas están en memoria', Object.keys(w.ST.tpls).length);
ok(w.localStorage.getItem('fap_tpls')===null,'fap_tpls no existe (antes eran ~2 MB duplicados)');
const usado=w.bytesGuardados();
ok(usado<200*1024,'localStorage ocupa poco: '+w.kb(usado));
ok(!!w.ST.tpls['19_Informe_satisfaccion_renovacion.docx'],'la plantilla del informe de renovación está cargada');

// ---------------------------------------------------------------- 2
seccion('2 · Migración de una instalación vieja (fap_tpls con el seed dentro)');
w=nuevoDom(win=>{
  const falsa='UEsDBBQABgAIAAAAIQ=='.repeat(3);
  win.localStorage.setItem('fap_tpls',JSON.stringify({'7_Orden_de_compra.docx':falsa,'1_Inicio_comparacion.docx':'basura'}));
  win.localStorage.setItem('fap_tpls_propias',JSON.stringify({'7_Orden_de_compra.docx':true}));
  win.localStorage.setItem('fap_seed_v','1');
});
ok(w.localStorage.getItem('fap_tpls')===null,'fap_tpls se borró y liberó su espacio');
ok(w.localStorage.getItem('fap_seed_v')===null,'fap_seed_v se limpió');
ok(w.TPL_PROPIAS['7_Orden_de_compra.docx'] && w.TPL_PROPIAS['7_Orden_de_compra.docx'].indexOf('UEsDBBQ')===0,'la plantilla propia se rescató');
ok(w.ST.tpls['1_Inicio_comparacion.docx']===w.__SEED__.tpls['1_Inicio_comparacion.docx'],'la que no era propia volvió a la oficial');

// ---------------------------------------------------------------- 3
seccion('3 · Vía de renovación — Momento 1 se cierra sin monto');
w=nuevoDom();
w.ST.cfg.areas=[{id:'a1',ap:'Parque Nacional Yasuní',siglas:'PNY',ciudad:'Quito',mae:'Jorge Andrade',maeCargo:'Jefe del Área Protegida',lugar:'El Coca'}];
w.ST.cfg.ac='Lcda. María Salazar'; w.ST.cfg.acCorreo='msalazar@fias.org.ec';
w.newExp('Mantenimiento vehículos 2027');
const d=w.D();
d.areaId='a1'; d.tipoProceso='Renovación'; d.bienServicio='Servicio';
d.fechaInicio='2026-10-19'; d.numero='14';
d.objeto='Servicio de mantenimiento de vehículos del área protegida';
d.contratoAnterior='FIAS-FAP-2026-114'; d.fechaSuscripcionAnt='2026-02-12';
d.fechaFinAnterior='2026-12-31'; d.montoAnterior='8400'; d.consumoEjecutado='9120.45';
d.provs[0].razon='Talleres del Oriente Cía. Ltda.'; d.provs[0].ruc='1791234567001';
d.clausulaRenovacion='Sí, el contrato vigente la contempla';
d.periodoDesde='2027-01-01'; d.periodoHasta='2027-12-31';
d.arranqueSucesor='2027-01-01'; d.semanaAsignada='2026-10-19';
d.partida='3.1.3.2'; d.fuente='Fondo de Áreas Protegidas - FAP'; d.plazo='30';
d.formaPago='Factura, informe de conformidad y comprobante de retención';
d.analisisTecnico='Cumplió sin observaciones.'; d.analisisGeografico='Único taller a menos de 90 km.';
d.analisisEconomico='Precios sin variación frente al mercado.'; d.fechaInforme='2026-10-19';
d.items=[{desc:'Mantenimiento preventivo camioneta 4x4',unidad:'Servicio',cantidad:'12',punit:''}];
w.save();
ok(w.esRenov(),'el expediente es de vía renovación');
ok(w.m1Done()===true,'Momento 1 completo SIN presupuesto ni monto');
ok(!w.D().presupuesto && w.adjMonto()===0,'efectivamente no hay monto todavía');
ok(w.m2Done()===false,'Momento 2 aún no');
const docsRen=w.documents();
ok(docsRen.length===4 && docsRen[0].id==='informeRen' && docsRen[0].ready===true,'el informe de satisfacción de renovación está listo');
ok(docsRen[3].id==='contratoUO' && !docsRen[3].tpl,'el contrato de renovación queda del lado de la Unidad Operativa');
ok(w.requiereUnidadOperativa()===true && w.puedeOrden()===false,'la renovación va por contrato, no por orden');

seccion('4 · El expediente se aparca esperando el PAG');
w.D().esperandoPAG=true; w.save();
ok(w.enEsperaPAG()===true,'queda en espera del PAG');
const docsEspera=w.documents();
ok(docsEspera[1].espera===true && docsEspera[1].ready===false,'la solicitud de cotización aparece EN ESPERA, no bloqueada');
ok(w.momentoAlcanzado()===1,'momento alcanzado: 1 de 4');

seccion('5 · La lista de verificación bloquea el envío');
ok(w.envioBloqueado()===true,'con el bloque 2 sin hacer, el envío está bloqueado');
const pend=w.checklistPendientes().map(x=>x.label);
ok(pend.indexOf('PAG del nuevo período aprobado')>=0,'la lista señala que falta el PAG', pend.join(' | '));
ok(pend.indexOf('Documentos obligatorios generados')>=0,'y que faltan documentos');

seccion('6 · Sale el PAG: el expediente se reactiva y se completa');
const d2=w.D();
d2.pagAprobado='2027-01-15'; d2.esperandoPAG=false;
d2.presupuesto='9500'; d2.fechaSolCotizacion='2027-01-20'; d2.fechaLimite='2027-01-27';
d2.fechaCotizacion='2027-01-26'; d2.provs[0].monto='9240';
d2.items[0].punit='669.5652174';   // 12 x punit x 1,15 = 9240,00 d2.ivaPct='15';
d2.fechaNotificacion='2027-02-02';
w.save();
ok(w.enEsperaPAG()===false,'ya no está en espera');
ok(w.m2Done()===true,'Momento 2 completo');
ok(w.m3Done()===true,'Momento 3 completo');
ok(Math.abs(w.adjMonto()-9240)<0.01,'monto de la renovación: '+w.money(w.adjMonto()));
const cuadra=Math.abs(w.adjMonto()-w.itemTotals().total);
ok(cuadra<0.5,'el monto cuadra con el detalle de ítems (dif '+cuadra.toFixed(2)+')');
const docs2=w.documents();
ok(docs2[1].ready===true && docs2[2].ready===true,'solicitud de cotización y notificación quedan listas');

seccion('7 · Generación real de los tres documentos de renovación');
let descargas=[];
w.URL.createObjectURL=()=>'blob:x'; w.URL.revokeObjectURL=()=>{};
const realCreate=w.document.createElement.bind(w.document);
w.document.createElement=function(t){ const el=realCreate(t); if(t==='a'){ el.click=function(){ descargas.push(el.download); }; } return el; };
['informeRen','solCot','notif'].forEach(id=>{ w.gen(id); });
ok(descargas.filter(x=>x&&x.indexOf('.docx')>0).length>=3,'se generaron los 3 .docx sin error de plantilla', descargas.join(' | '));
ok(w.cur().generated.informeRen && w.cur().generated.solCot && w.cur().generated.notif,'quedan marcados como generados');
ok(w.loadHistorial().length===1,'la notificación registró el cierre en el Historial');

seccion('8 · Con todo hecho, el envío se desbloquea');
const pend2=w.checklistPendientes().map(x=>x.label);
ok(w.envioBloqueado()===false,'el expediente ya puede enviarse a la Unidad Operativa', pend2.join(' | '));

seccion('9 · Mis procesos');
const html=w.renderProcesos();
ok(html.indexOf('Mantenimiento vehículos 2027')>0,'la fila del expediente aparece');
ok(html.indexOf('Renovación')>0,'se distingue la vía');
ok(html.indexOf('FIAS-FAP-2026-114')>0,'muestra el contrato que reemplaza');
ok(html.indexOf('01/01/2027')>0,'muestra cuándo arranca el sucesor');
ok(html.indexOf('19/10/2026')>0,'muestra la semana asignada');
const r=w.resumenExp(w.cur());
ok(r.docsGen===3 && r.obligPend===0,'cuenta los documentos generados: '+r.docsGen+'/'+r.docsTot);
w.go('procesos');
ok(w.document.getElementById('app').innerHTML.indexOf('Mis procesos')>0,'la pantalla se pinta sin romper el render');

seccion('10 · El fallo de cuota se ve (se llena de verdad el almacenamiento)');
// Se llena hasta el borde: trozos grandes primero y cada vez más finos, para
// que no quede hueco donde quepa el expediente.
let llenos=0;
[100000,10000,1000,100,10,1].forEach(function(tam){
  for(let i=0;i<600;i++){
    try{ w.localStorage.setItem('relleno'+(llenos),'x'.repeat(tam)); llenos++; }
    catch(e){ break; }
  }
});
// Y ahora la AC sigue escribiendo: el expediente crece y ya no cabe.
const objetoOriginal=w.ST.exps[0].data.objeto;
w.ST.exps[0].data.objeto='x'.repeat(40000);
const guardado=w.save();
ok(guardado===false,'save() devuelve false cuando no pudo guardar');
ok(w.ESPACIO.fallo!=='','queda marcado el fallo de espacio: "'+w.ESPACIO.fallo+'"');
ok(w.bannerEspacioHTML().indexOf('sin espacio')>0,'la barra roja avisa a la AC');
w.render();
ok(w.document.getElementById('espaciobar').innerHTML.indexOf('Descargar respaldo ahora')>0,'y ofrece descargar el respaldo ahí mismo');
w.ST.exps[0].data.objeto=objetoOriginal;
for(let i=0;i<llenos;i++) w.localStorage.removeItem('relleno'+i);
ok(w.save()===true,'al liberarse, vuelve a guardar');
ok(w.ESPACIO.fallo==='','y la barra se apaga sola');

seccion('11 · Respaldo y restauración');
let respaldo=null;
w.downloadBlob=function(txt,nombre){ respaldo=JSON.parse(txt); };
w.exportRespaldo();
ok(respaldo && respaldo.exps.length===1,'el respaldo lleva los expedientes en curso');
ok(respaldo.historial.length===1,'y el historial');
ok(w.diasSinRespaldo()===0,'queda registrado el último respaldo');
const idViejo=w.ST.exps[0].id;
w.ST.exps=[]; w.ST.curId=null; w.save();
w.confirm=()=>false;                       // Cancelar = combinar
w.restaurarRespaldo(respaldo);
ok(w.ST.exps.length===1 && w.ST.exps[0].id===idViejo,'restaurar recupera el expediente perdido');
ok(w.ST.exps[0].data.contratoAnterior==='FIAS-FAP-2026-114','con todos sus datos');

seccion('12 · Topes de cola e historial');
w.savePendientes([]);
for(let i=0;i<310;i++) w.encolarPendiente({idRegistro:'x'+i});
const cola=w.loadPendientes();
ok(cola.length===300,'la cola se queda en 300, no crece sin fin: '+cola.length);
ok(cola[cola.length-1].idRegistro==='x309','conserva lo más reciente');
ok(Number(w.localStorage.getItem('fap_pendientes_perdidos'))===10,'y deja constancia de los 10 que salieron');
let archivados=null; w.downloadBlob=function(txt,n){ archivados=n; };
const h=[]; for(let i=0;i<2005;i++) h.push({expId:'e'+i,fecha:'2026-01-01T00:00:0'+(i%10)+'.000Z'});
w.saveHistorial(h);
ok(w.loadHistorial().length===2000,'el historial se recorta a 2000');
ok(archivados && archivados.indexOf('FAP_historial_archivado')===0,'y descarga los antiguos antes de soltarlos: '+archivados);

seccion('13 · Las otras vías siguen funcionando');
w=nuevoDom();
w.ST.cfg.areas=[{id:'a1',ap:'Parque Nacional Yasuní',siglas:'PNY',ciudad:'Quito',mae:'J. Andrade',maeCargo:'Jefe',lugar:'El Coca'}];
w.newExp('Combustible Q1');
const c=w.D();
c.areaId='a1'; c.tipoProceso='Comparación de precios'; c.bienServicio='Bien'; c.tipoBien='Activo fijo';
c.fechaInicio='2026-09-10'; c.numero='3'; c.objeto='Adquisición de combustible';
c.partida='3.1.3.1'; c.fuente='Fondo de Áreas Protegidas - FAP'; c.plazo='20';
c.presupuesto='5000'; c.formaPago='Factura'; c.fechaInvitacion='2026-09-11'; c.fechaLimite='2026-09-18';
c.pagoContraEntrega=true;
c.provs[0]={razon:'Proveedor A',ruc:'1',dir:'',tel:'',monto:'4000',fof:'2026-09-15'};
c.provs[1]={razon:'Proveedor B',ruc:'2',dir:'',tel:'',monto:'4500',fof:'2026-09-15'};
c.provs[2]={razon:'Proveedor C',ruc:'3',dir:'',tel:'',monto:'4800',fof:'2026-09-15'};
c.items=[{desc:'Diésel',unidad:'Galón',cantidad:'100',punit:'34.7826087'}];
c.fechaAdj='2026-09-16'; c.adjudicado='Proveedor A';
w.save();
ok(w.m1Done()===true && w.m2Done()===true,'comparación de precios: momentos 1 y 2 siguen cerrando');
const dc=w.documents();
ok(dc.map(x=>x.id).join(',')==='inicio,invit,acta,orden,recep,entrega','los documentos de siempre siguen ahí: '+dc.map(x=>x.id).join(','));
ok(w.momentosNombres()[1]==='Adjudicación','los rótulos de momento no cambiaron para esta vía');
ok(w.esRenov()===false,'no se confunde con renovación');
const mn=w.renderProcesos();
ok(mn.indexOf('Proceso nuevo')>0,'Mis procesos la clasifica como proceso nuevo');

seccion('14 · Cada expediente es suyo (ids únicos)');
w=nuevoDom();
w.ST.cfg.areas=[{id:'a1',ap:'Parque Nacional Yasuní',siglas:'PNY',ciudad:'Quito',mae:'J. Andrade',maeCargo:'Jefe',lugar:'El Coca'}];
// Creados de corrido: antes compartían 'e'+Date.now() y cur() devolvía siempre el
// primero, así que en Mis procesos las tres filas mostraban lo mismo.
w.newExp('A'); w.D().areaId='a1'; w.D().tipoProceso='Renovación'; w.D().numero='1'; w.D().fechaInicio='2026-10-19'; w.D().contratoAnterior='CONTRATO-A';
w.newExp('B'); w.D().areaId='a1'; w.D().tipoProceso='Compra directa'; w.D().numero='2'; w.D().fechaInicio='2026-10-19'; w.D().contratoAnterior='CONTRATO-B';
w.newExp('C'); w.D().areaId='a1'; w.D().tipoProceso='Comparación de precios'; w.D().numero='3'; w.D().fechaInicio='2026-10-19'; w.D().contratoAnterior='CONTRATO-C';
w.save();
const ids=w.ST.exps.map(e=>e.id);
ok(new Set(ids).size===3,'los tres ids son distintos: '+ids.join(', '));
const res=w.ST.exps.map(w.resumenExp);
ok(res.map(x=>x.via).join('|')==='Renovación|Compra directa|Comparación de precios','cada fila muestra SU vía: '+res.map(x=>x.via).join('|'));
ok(res.map(x=>x.contrato).join('|')==='CONTRATO-A|CONTRATO-B|CONTRATO-C','y SU contrato anterior');
ok(res.map(x=>x.codigo).join('|')==='PNY-2026-001|PNY-2026-002|PNY-2026-003','y SU código: '+res.map(x=>x.codigo).join('|'));
ok(w.ST.curId===ids[2] && w.cur().nombre==='C','el expediente activo sigue siendo el último creado');
// y una instalación vieja con ids repetidos se repara sola al cargar
w=nuevoDom(win=>{
  win.localStorage.setItem('fap_v3',JSON.stringify({cfg:{areas:[{id:'a1',ap:'PNY',siglas:'PNY'}]},
    exps:[{id:'e1',nombre:'viejo A',data:{},generated:{}},{id:'e1',nombre:'viejo B',data:{},generated:{}}],curId:'e1'}));
});
const idsRep=w.ST.exps.map(e=>e.id);
ok(new Set(idsRep).size===2,'los ids repetidos de una versión anterior se separan: '+idsRep.join(', '));
ok(w.ST.exps[0].id==='e1','el primero conserva el id al que apunta el historial');

seccion('15 · La Mágica habla el idioma del catálogo de variables');
// El otro extremo de scripts/variables.py: aquel comprueba las plantillas, este
// comprueba lo que La Mágica les entrega. Si divergen, una etiqueta queda vacía
// en el Word sin que nadie se entere hasta que el documento está firmado.
{
  const cat=JSON.parse(fs.readFileSync(path.join(RAIZ,'generador','variables_fap.json'),'utf8'));
  const conocidas=new Set(cat.variables.map(v=>v.nombre));
  cat.variables.filter(v=>v.tipo==='repetible').forEach(v=>{
    const m=/(?:[Cc]ampos:?)\s+([a-zA-Z0-9_,\s]+)/.exec(v.descripcion||'');
    if(m) m[1].split(',').map(x=>x.trim()).filter(Boolean).forEach(c=>conocidas.add(c));
  });
  const w2=nuevoDom();
  w2.ST.cfg.areas=[{id:'a1',ap:'PNY',siglas:'PNY',ciudad:'Quito',mae:'m',maeCargo:'c',lugar:'l'}];
  w2.newExp('x'); w2.D().areaId='a1'; w2.D().tipoProceso='Renovación';
  const datos=w2.buildTemplateData();
  const fuera=Object.keys(datos).filter(k=>!conocidas.has(k));
  ok(fuera.length===0,'las '+Object.keys(datos).length+' claves que emite buildTemplateData están catalogadas', fuera.join(', '));
  const subItems=Object.keys((datos.items&&datos.items[0])||{});
  const fueraItems=subItems.filter(k=>!conocidas.has(k));
  ok(fueraItems.length===0,'y los subcampos de {#items} también', fueraItems.join(', '));
}

seccion('16 · Todas las pantallas se pintan, en las dos vías');
function pintaTodo(w,etiqueta){
  ['guia','plantillas','captura','documentos','historial','datos','procesos','unidad'].forEach(function(nav){
    [0,1,2,3].forEach(function(step){
      if(nav!=='captura' && step>0) return;
      try{
        w.ST.nav=nav; w.ST.step=step; w.render();
        const html=w.document.getElementById('app').innerHTML;
        ok(html.length>500, etiqueta+' · '+nav+(nav==='captura'?(' momento '+(step+1)):'')+' se pinta');
      }catch(e){ ok(false, etiqueta+' · '+nav+' se pinta', e.message); }
    });
  });
}
pintaTodo(w,'comparación de precios');
// vuelve al expediente de renovación completo
w=nuevoDom();
w.ST.cfg.areas=[{id:'a1',ap:'Parque Nacional Yasuní',siglas:'PNY',ciudad:'Quito',mae:'J. Andrade',maeCargo:'Jefe',lugar:'El Coca'}];
w.newExp('Renovación de prueba');
const dr=w.D();
dr.areaId='a1'; dr.tipoProceso='Renovación'; dr.bienServicio='Servicio';
dr.fechaInicio='2026-10-19'; dr.numero='2'; dr.objeto='Servicio recurrente';
dr.contratoAnterior='FIAS-FAP-2026-090'; dr.clausulaRenovacion='No, el contrato vigente no la contempla';
dr.esperandoPAG=true; dr.partida='OTRO'; dr.partidaOtroCod='3.4.5'; dr.partidaOtroNom='Otro';
w.save();
pintaTodo(w,'renovación');
const capt=(w.ST.nav='captura', w.ST.step=0, w.render(), w.document.getElementById('app').innerHTML);
ok(capt.indexOf('Sin cláusula no hay renovación')>0,'sin cláusula, la captura avisa que pasa a proceso nuevo');
w.ST.step=1; w.render();
ok(w.document.getElementById('app').innerHTML.indexOf('en espera del PAG')>0,'el Momento 2 explica la espera del PAG');

console.log('\n'+(fallos?('✗ '+fallos+' fallo(s) de '+pruebas):('✓ '+pruebas+' comprobaciones, todas pasan')));
process.exit(fallos?1:0);
