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

// hash: con qué enlace se abre (p. ej. el que arma el CLM, #precarga=…).
function nuevoDom(pre,hash){
  const dom=new JSDOM(HTML,{url:'http://localhost/generador/index.html'+(hash||''),runScripts:'dangerously',
    beforeParse(win){ win.fetch=undefined; if(pre) pre(win); }});
  const w=dom.window;
  w.PizZip=PizZip; w.docxtemplater=Docxtemplater;
  w.confirm=()=>true; w.prompt=()=>'Proceso de prueba'; w.alert=()=>{};
  return w;
}

// ---------------------------------------------------------------- 1
seccion('1 · El seed ya no se copia a localStorage');
let w=nuevoDom();
ok(Object.keys(w.ST.tpls).length===18,'las 18 plantillas están en memoria', Object.keys(w.ST.tpls).length);
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
d.provs[0].dir='Av. Quito y Napo, El Coca'; d.provs[0].genero='E';
d.clausulaRenovacion='Sí, el contrato vigente la contempla';
d.periodoDesde='2027-01-01'; d.periodoHasta='2027-12-31';
d.arranqueSucesor='2027-01-01'; d.semanaAsignada='2026-10-19';
d.partida='3.1.3.2'; d.fuente='Fondo de Áreas Protegidas - FAP'; d.plazo='30';
d.formaPago='Factura, informe de conformidad y comprobante de retención';
d.fechaInforme='2026-10-19';
d.items=[{desc:'Mantenimiento preventivo camioneta 4x4',unidad:'Servicio',cantidad:'12',punit:''}];
w.save();
ok(w.esRenov(),'el expediente es de vía renovación');
ok(w.m1Done()===true,'Momento 1 completo SIN presupuesto ni monto');
ok(!w.D().presupuesto && w.adjMonto()===0,'efectivamente no hay monto todavía');
ok(w.m2Done()===false,'Momento 2 aún no');
const docsRen=w.documents();
ok(docsRen.length===3 && docsRen[0].id==='informeRen' && docsRen[0].ready===true,'el informe de satisfacción de renovación está listo');
ok(!docsRen.some(x=>x.id==='notif'),'ya no hay documento de notificación: esa la hace el Director Ejecutivo con la Unidad');
ok(docsRen[2].id==='contratoUO' && !docsRen[2].tpl,'el contrato de renovación queda del lado de la Unidad Operativa');
ok(w.momentosNombres()[2]==='Cotización recibida','el Momento 3 es ahora la cotización recibida');
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
d2.items[0].punit='669.5652174';   // 12 x punit x 1,15 = 9240,00 d2.ivaPct='15';
w.save();
ok(w.enEsperaPAG()===false,'ya no está en espera');
ok(w.m2Done()===true,'Momento 2 completo con el PAG y la solicitud, sin la cotización');
ok(w.m3Done()===false,'Momento 3 todavía no: falta la cotización');
d2.fechaCotizacion='2027-01-26'; d2.provs[0].monto='9240';
w.save();
ok(w.m3Done()===true,'Momento 3 completo');
ok(Math.abs(w.adjMonto()-9240)<0.01,'monto de la renovación: '+w.money(w.adjMonto()));
const cuadra=Math.abs(w.adjMonto()-w.itemTotals().total);
ok(cuadra<0.5,'el monto cuadra con el detalle de ítems (dif '+cuadra.toFixed(2)+')');
const docs2=w.documents();
ok(docs2[1].ready===true,'la solicitud de cotización queda lista');

seccion('7 · Generación real de los dos documentos de renovación');
let descargas=[];
w.URL.createObjectURL=()=>'blob:x'; w.URL.revokeObjectURL=()=>{};
const realCreate=w.document.createElement.bind(w.document);
w.document.createElement=function(t){ const el=realCreate(t); if(t==='a'){ el.click=function(){ descargas.push(el.download); }; } return el; };
['informeRen','solCot'].forEach(id=>{ w.gen(id); });
ok(descargas.filter(x=>x&&x.indexOf('.docx')>0).length>=2,'se generaron los 2 .docx sin error de plantilla', descargas.join(' | '));
ok(w.cur().generated.informeRen && w.cur().generated.solCot,'quedan marcados como generados');
ok(w.loadHistorial().length===0,'ningún documento cierra la renovación: el cierre es la salida a la Unidad');
w.marcarEnviadoUO(4);
ok(w.loadHistorial().length===1,'el envío a la Unidad Operativa sí registró el cierre en el Historial');

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
ok(r.docsGen===2 && r.obligPend===0,'cuenta los documentos generados: '+r.docsGen+'/'+r.docsTot);
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
// El acta dice «se reúnen de manera…», así que sin ese dato el Momento 2 no cierra.
ok(w.m1Done()===true && w.m2Done()===false,'sin saber cómo sesionó la Comisión, el Momento 2 no cierra');
ok(w.faltan(1).some(x=>x.campo==='presencialVirtual'),'y el aviso lo nombra',
   w.faltan(1).map(x=>x.label).join(' | '));
c.presencialVirtual='presencial'; w.save();
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

seccion('16 · Orden o contrato: lo decide el plazo, no las garantías');
{
  function expediente(){
    const w4=nuevoDom();
    w4.ST.cfg.areas=[{id:'a1',ap:'PN Yasuní',siglas:'PNY',ciudad:'Quito',mae:'m',maeCargo:'c',maeGenero:'M',apGenero:'M',lugar:'l'}];
    w4.newExp('x'); const dd=w4.D();
    Object.assign(dd,{areaId:'a1',tipoProceso:'Selección directa por excepción',bienServicio:'Servicio',
      fechaInicio:'2026-11-10',numero:'7',objeto:'Servicio',causal:'Único proveedor cerca del AP',
      partida:'1.1.3',fuente:'Fondo de Áreas Protegidas - FAP',presupuesto:'12000',formaPago:'Contado',
      fechaInvitacion:'2026-11-11',fechaLimite:'2026-11-18',fechaAdj:'2026-11-20',adjudicado:'P',
      items:[{desc:'Limpieza',unidad:'Servicio',cantidad:'12',punit:'869.5652174'}]});
    dd.provs[0]={razon:'P',ruc:'1',dir:'',tel:'',monto:'12000',fof:'2026-11-15',genero:'M'};
    w4.save(); return w4;
  }
  // El caso que motivó el cambio: un contrato de enero a diciembre sin ninguna
  // garantía. Antes la tarjeta de la orden quedaba ready:true y solo avisaba.
  const anual=expediente();
  Object.assign(anual.D(),{tipoPlazo:'continuo',ejecDesde:'2027-01-01',ejecHasta:'2027-12-31',plazo:'365'});
  anual.save();
  ok(anual.diasEntre('2027-01-01','2027-12-31')===365,'del 1 de enero al 31 de diciembre son 365 días, no 364');
  ok(anual.esContrato()===true,'enero a diciembre sin garantías → contrato');
  ok(anual.puedeOrden()===false,'y la orden no aplica');
  ok(anual.documents().find(x=>x.id==='orden').ready===false,'la tarjeta de la orden queda BLOQUEADA, no solo avisada');
  ok(anual.motivoContrato()==='plazo','el motivo es el plazo, no las garantías');

  const corto=expediente();
  Object.assign(corto.D(),{tipoPlazo:'entrega',plazo:'20'}); corto.save();
  ok(corto.puedeOrden()===true && corto.documents().find(x=>x.id==='orden').ready===true,'entrega de 20 días → orden, sin marcar ninguna casilla');

  const largo=expediente();
  Object.assign(largo.D(),{tipoPlazo:'entrega',plazo:'45'}); largo.save();
  ok(largo.motivoContrato()==='plazo','45 días de entrega → contrato');

  const conGar=expediente();
  Object.assign(conGar.D(),{tipoPlazo:'entrega',plazo:'20',garFielCumpl:true}); conGar.save();
  ok(conGar.motivoContrato()==='garantias','20 días pero con fiel cumplimiento → contrato por la garantía');

  // Y la lista de verificación ya no obliga a declarar una modalidad falsa
  const pend=anual.checklistPendientes().map(x=>x.label);
  ok(pend.indexOf('Modalidad de pago o garantías definida')<0,'ya no se exige marcar una modalidad de pago');
  ok(pend.indexOf('Plazo de ejecución definido')<0,'y el plazo cuenta como definido: '+(pend.join(' | ')||'nada pendiente'));
  const sinPlazo=expediente();
  ok(sinPlazo.checklistPendientes().map(x=>x.label).indexOf('Plazo de ejecución definido')>=0,'sin plazo, la lista lo reclama');
}

seccion('17 · Concordancia: el género se resuelve solo');
{
  const w3=nuevoDom();
  w3.ST.cfg.ac='Lcda. María Salazar'; w3.ST.cfg.acGenero='F';
  w3.ST.cfg.areas=[{id:'a1',ap:'Reserva Ecológica Cotacachi Cayapas',siglas:'RECC',ciudad:'Quito',
    mae:'Ing. Rosa Tapia',maeCargo:'Jefa',maeGenero:'F',apGenero:'F',lugar:'Oficina'}];
  w3.newExp('x');
  const dd=w3.D();
  Object.assign(dd,{areaId:'a1',tipoProceso:'Comparación de precios',bienServicio:'Bien',
    fechaInicio:'2026-09-10',numero:'3',objeto:'Combustible',plazo:'20',
    items:[{desc:'Diésel',unidad:'Galón',cantidad:'100',punit:'10'}]});
  dd.provs[0]={razon:'Combustibles del Oriente S.A.',ruc:'1',dir:'',tel:'',monto:'1150',fof:'2026-09-15',genero:'E'};
  dd.adjudicado='Combustibles del Oriente S.A.';
  w3.save();
  const t=w3.buildTemplateData();
  ok(t.administradoracontadora==='administradora contadora','AC mujer → «administradora contadora»: '+t.administradoracontadora);
  ok(t.ellaadministradorAP==='la administradora','jefa mujer → «la administradora»: '+t.ellaadministradorAP);
  ok(t.dellaAP==='de la','Reserva → «de la»: '+t.dellaAP);
  ok(t.proveedorTrato==='Señores','empresa → «Señores»: '+t.proveedorTrato);
  ok(t.elLaProveedor==='la empresa proveedora','empresa → «la empresa proveedora»: '+t.elLaProveedor);
  ok(t.elLosProducto==='el producto','un solo ítem → «el producto»: '+t.elLosProducto);
  ok(t.diaContadoDiasContados==='días contados','plazo de 20 → «días contados»: '+t.diaContadoDiasContados);
  ok(t.adquisicionContratacion==='adquisición','bien → «adquisición»: '+t.adquisicionContratacion);
  ok(t.adquisicioncontrato==='adquirir','y en forma verbal, bien → «por adquirir»: '+t.adquisicioncontrato);
  // y el mismo expediente, cambiando solo lo que se elige
  w3.ST.cfg.acGenero='M'; w3.D().provs[0].genero='F'; w3.D().plazo='1';
  w3.D().items.push({desc:'Gasolina',unidad:'Galón',cantidad:'50',punit:'10'});
  const t2=w3.buildTemplateData();
  ok(t2.administradoracontadora==='administrador contador','AC hombre → «administrador contador»');
  ok(t2.proveedorTrato==='Señora','proveedora mujer → «Señora»');
  ok(t2.diaContadoDiasContados==='día contado','plazo de 1 → «día contado»');
  ok(t2.elLosProducto==='los productos','dos ítems → «los productos»');
  w3.D().bienServicio='Servicio';
  ok(w3.buildTemplateData().adquisicioncontrato==='contratar','servicio → «por contratar»');
  ok(t2.ellaadministradorAP==='la administradora','la jefa no cambió al cambiar la AC: son personas distintas');
  // el género del área se propone desde su nombre
  ok(w3.generoAreaInferido('Reserva Ecológica Cotacachi Cayapas')==='F','«Reserva…» se propone femenino');
  ok(w3.generoAreaInferido('Parque Nacional Yasuní')==='M','«Parque…» se propone masculino');
  ok(w3.generoAreaInferido('Estación Científica Coca')==='F','«Estación…» se propone femenino');
}

seccion('18 · Todas las pantallas se pintan, en las dos vías');
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

seccion('19 · Las 18 plantillas se rellenan de verdad');
// Esto es lo que faltaba el día que dos plantillas llegaron con «{monto (» —una
// llave sin cerrar— y la orden de servicio no se podía generar: el .docx abría
// perfecto en Word y validaba contra el esquema, pero docxtemplater lo rechaza
// al compilarlo. Aquí se compilan las 18 con datos reales.
{
  const w4=nuevoDom();
  w4.ST.cfg.areas=[{id:'a1',ap:'Reserva Ecológica Cotacachi',siglas:'RECC',ciudad:'Quito',
    mae:'Ing. Rosa Tapia',maeCargo:'Jefa del Área Protegida',maeGenero:'F',apGenero:'F',lugar:'Otavalo'}];
  w4.ST.cfg.ac='Lcda. María Salazar'; w4.ST.cfg.acCorreo='m@fias.org.ec';
  w4.newExp('Plantillas');
  const dp=w4.D();
  Object.assign(dp,{areaId:'a1',tipoProceso:'Comparación de precios',bienServicio:'Bien',
    tipoBien:'Activo fijo',fechaInicio:'2026-09-10',numero:'3',objeto:'Equipos de campo',
    plazo:'20',presupuesto:'2000',partida:'1.1.1',fuente:'Fondo de Áreas Protegidas - FAP',
    presencialVirtual:'virtual',periodoDesde:'2027-01-01',periodoHasta:'2027-12-31',
    montoAnterior:'8400',contratoAnterior:'FIAS-FAP-2026-114',
    items:[{desc:'GPS',unidad:'Unidad',cantidad:'2',punit:'500'}]});
  dp.provs[0]={razon:'Equipos del Norte S.A.',ruc:'1791234567001',dir:'Av. Amazonas N34',tel:'02',monto:'1150',fof:'2026-09-15',genero:'E'};
  dp.adjudicado='Equipos del Norte S.A.';
  w4.save();
  const datos=w4.buildTemplateData({invitado:'Equipos del Norte S.A.'});
  const slots=w4.TPL_SLOTS.map(x=>x.f);
  ok(slots.length===18,'la app declara 18 plantillas: '+slots.length);
  slots.forEach(function(f){
    const b64=w4.ST.tpls[f];
    if(!b64){ ok(false,f+' está en el seed'); return; }
    try{
      const doc=new Docxtemplater(new PizZip(b64,{base64:true}),
        {paragraphLoop:true,linebreaks:true,nullGetter:()=>''});
      doc.render(datos);
      ok(true,f+' se rellena');
    }catch(e){
      let msg=e.message;
      if(e.properties&&e.properties.errors) msg=e.properties.errors.map(x=>(x.properties&&x.properties.explanation)||x.message).join(' · ');
      ok(false,f+' se rellena',msg);
    }
  });
  // y las etiquetas que las plantillas nuevas estrenaron tienen dato
  ok(datos.presencialVirtual==='virtual','el acta sabe cómo sesionó la Comisión: '+datos.presencialVirtual);
  ok(datos.ubicacioncontratista==='Av. Amazonas N34','la ubicación tributaria del contratista llega a la plantilla');
  ok(datos.allaadministradorAP==='a la administradora','concordancia «al/a la administrador/a del AP»: '+datos.allaadministradorAP);
  ok(datos.ElLaContratista==='La empresa contratista','concordancia «El/La contratista»: '+datos.ElLaContratista);
  ok(datos.anioRenovacion==='2027','el año de renovación sale del período, no de la plantilla: '+datos.anioRenovacion);
  // {montoLetras} y compañía ya traen el número delante: «USD 8.400,00 (Ocho
  // mil…) incluidos impuestos». Por eso en la plantilla van solos, sin un
  // «USD {montoTotal} (» que los duplique.
  ok(datos.montoTotalLetras.indexOf('USD 8.400,00 (Ocho mil cuatrocientos')===0,
     'el monto del contrato original ya trae número y letras: '+datos.montoTotalLetras);
}

seccion('20 · Nadie trata de «Señores» a una persona natural');
// La solicitud de cotización salía «Señores / José Lecaro … mantiene con
// ustedes»: la plantilla llevaba el trato y el número escritos a mano, y ningún
// control lo miraba porque las etiquetas que sí tenía estaban todas bien.
{
  const w6=nuevoDom();
  const texto=b64=>{
    const zip=new PizZip(b64,{base64:true}); let t='';
    zip.file(/word\/(document|header\d*|footer\d*)\.xml/).forEach(f=>{
      t+=f.asText().replace(/<\/w:p>/g,'\n').replace(/<(?!\/?w:t[ >])[^>]*>/g,'').replace(/<\/?w:t[^>]*>/g,'')+'\n';
    });
    return t;
  };
  const trampas=[
    [/\bustedes?\b/i,'«usted/ustedes» escrito a mano (va {ustedUstedes})'],
    [/\bSeñor(?:es|a)?\b/,'«Señor/es/a» escrito a mano (va {proveedorTrato})'],
    [/\b(?:del|al|el|la)\s+\{area\}/,'artículo escrito a mano delante de {area} (va {dellaAP}, {ellaAP} o {allaAP})'],
  ];
  Object.keys(w6.ST.tpls).sort().forEach(function(f){
    const t=texto(w6.ST.tpls[f]);
    const malas=trampas.filter(([re])=>re.test(t)).map(([re,msg])=>msg+': «'+(t.match(re)||[''])[0]+'»');
    ok(malas.length===0, f+' no le pone género ni número a mano', malas.join(' · '));
  });
  // y el resultado, de punta a punta
  w6.ST.cfg.areas=[{id:'a1',ap:'Reserva Ecológica Cotacachi',siglas:'RECC',ciudad:'Quito',mae:'R. Tapia',maeCargo:'Jefa',maeGenero:'F',apGenero:'F',lugar:'Otavalo'}];
  w6.ST.cfg.ac='Lcda. María Salazar';
  w6.newExp('Combustible');
  const dc=w6.D();
  Object.assign(dc,{areaId:'a1',tipoProceso:'Renovación',bienServicio:'Servicio',
    fechaInicio:'2026-11-11',numero:'2',objeto:'Abastecimiento de combustible',
    contratoAnterior:'FIAS-FAP-2026-014',periodoDesde:'2027-01-01',periodoHasta:'2027-12-31',
    items:[{desc:'Combustible',unidad:'Galón',cantidad:'1200',punit:''}]});
  dc.provs[0]={razon:'José Lecaro',ruc:'1723551758001',dir:'Quito',tel:'',monto:'',fof:'',genero:'M'};
  w6.save();
  const sale=()=>{
    const doc=new Docxtemplater(new PizZip(w6.ST.tpls['20_Solicitud_cotizacion_renovacion.docx'],{base64:true}),
      {paragraphLoop:true,linebreaks:true,nullGetter:()=>''});
    doc.render(w6.buildTemplateData());
    return texto(doc.getZip().generate({type:'base64'}));
  };
  let out=sale();
  ok(out.indexOf('Señor')>0 && out.indexOf('Señores')<0,'a una persona natural, «Señor» — no «Señores»');
  ok(out.indexOf('mantiene con usted el contrato')>0,'y «mantiene con usted», no «con ustedes»');
  ok(out.indexOf('Plan Anual de Gasto de la Reserva')>0,'«de la Reserva», no «del Reserva»');
  dc.provs[0].genero='E'; dc.provs[0].razon='Combustibles del Oriente S.A.'; w6.save();
  out=sale();
  ok(out.indexOf('Señores')>0 && out.indexOf('mantiene con ustedes el contrato')>0,
     'y a una empresa, «Señores» y «con ustedes»');
}

seccion('21 · Ningún documento se marca LISTO con un hueco dentro');
// El informe de renovación decía «suscrito el , cuyo objeto es…»: la fecha de
// suscripción se IMPRIME pero el Momento 1 se cerraba sin ella, así que el
// documento quedaba listo con el hueco dentro. Esto llena solo lo que la app
// exige para cerrar cada momento —nada de más— y comprueba que cada etiqueta de
// cada documento listo tenga dato.
{
  const etiquetasDe=b64=>{
    const zip=new PizZip(b64,{base64:true}); let t='';
    zip.file(/word\/(document|header\d*|footer\d*)\.xml/).forEach(f=>{
      t+=f.asText().replace(/<\/w:p>/g,'\n').replace(/<(?!\/?w:t[ >])[^>]*>/g,'').replace(/<\/?w:t[^>]*>/g,'')+'\n';
    });
    const out=[]; let m, dentro=null; const re=/\{([^{}]+)\}/g;
    while((m=re.exec(t))){ const g=m[1].trim();
      if(g[0]==='#'||g[0]==='^'){dentro=g.slice(1);continue;}
      if(g[0]==='/'){dentro=null;continue;}
      if(!dentro) out.push(g); }
    return [...new Set(out)];
  };
  // Vacíos legítimos: el acta compara hasta tres ofertas y puede haber una sola.
  const PERDONADAS={'5_Acta_adjudicacion.docx':['monto2','monto3']};
  const base=w7=>{
    w7.ST.cfg.areas=[{id:'a1',ap:'Reserva Ecológica Cotacachi',siglas:'RECC',ciudad:'Quito',
      mae:'R. Tapia',maeCargo:'Jefa del Área',maeGenero:'F',apGenero:'F',lugar:'Otavalo'}];
    w7.ST.cfg.ac='Lcda. María Salazar'; w7.ST.cfg.acCorreo='m@fias.org.ec';
    w7.ST.cfg.director='Ing. Luis Vega'; w7.ST.cfg.directorCargo='Director Ejecutivo';
  };
  const revisa=(nombre,llena,extra,despues)=>{
    const w7=nuevoDom(); base(w7); w7.newExp(nombre); llena(w7.D(), w7);
    if(despues) despues(w7);
    w7.save();
    ok(w7.doneArr().every(Boolean), nombre+': los cuatro momentos se cierran con lo que la app exige',
       w7.doneArr().join('·'));
    const datos=w7.buildTemplateData(extra||{});
    w7.documents().filter(x=>x.tpl&&x.ready).forEach(doc=>{
      const perdon=PERDONADAS[doc.tpl]||[];
      const vacias=etiquetasDe(w7.ST.tpls[doc.tpl]).filter(t=>
        perdon.indexOf(t)<0 && (datos[t]===undefined||String(datos[t]).trim()===''));
      ok(vacias.length===0, nombre+' · '+doc.tpl+' sale sin huecos',
         vacias.map(x=>'{'+x+'}').join(', '));
    });
  };

  revisa('Renovación', d=>{
    Object.assign(d,{areaId:'a1',tipoProceso:'Renovación',bienServicio:'Servicio',
      fechaInicio:'2026-11-11',numero:'2',objeto:'Abastecimiento de combustible',
      contratoAnterior:'FIAS-FAP-2026-014',fechaSuscripcionAnt:'2026-02-12',fechaFinAnterior:'2026-12-31',
      montoAnterior:'10000',clausulaRenovacion:'Sí, el contrato vigente la contempla',
      periodoDesde:'2027-01-01',periodoHasta:'2027-12-31',arranqueSucesor:'2027-01-01',
      partida:'1.1.1',fuente:'Fondo de Áreas Protegidas - FAP',plazo:'365',formaPago:'Factura',
      consumoEjecutado:'9120.45',fechaInforme:'2026-11-11',
      pagAprobado:'2027-01-15',presupuesto:'12000',fechaSolCotizacion:'2026-11-11',
      fechaLimite:'2026-11-20',fechaCotizacion:'2026-11-19',
      items:[{desc:'Combustible',unidad:'Galón',cantidad:'1200',punit:'8.3333333'}]});
    d.provs[0]={razon:'José Lecaro',ruc:'1723551758001',dir:'Quito, Av. Amazonas',tel:'',monto:'11500',fof:'',genero:'M'};
  }, null, w7=>{ w7.cur().enviadoUO={fecha:new Date().toISOString(),archivos:3,por:'AC'}; });
  revisa('Comparación de precios', d=>{
    Object.assign(d,{areaId:'a1',tipoProceso:'Comparación de precios',bienServicio:'Bien',tipoBien:'Activo fijo',
      fechaInicio:'2026-09-10',numero:'3',objeto:'Equipos de campo',plazo:'20',presupuesto:'2000',
      partida:'1.1.1',fuente:'Fondo de Áreas Protegidas - FAP',formaPago:'Factura',
      fechaInvitacion:'2026-09-11',fechaLimite:'2026-09-18',fechaAdj:'2026-09-20',
      adjudicado:'Equipos del Norte S.A.',fechaRecepcion:'2026-10-01',
      garantiaAplica:'Aplica',garantiaMeses:'12',cedulaJefe:'1712345678',correoJefe:'j@mae.gob.ec',
      presencialVirtual:'presencial',items:[{desc:'GPS',unidad:'Unidad',cantidad:'2',punit:'500'}]});
    d.provs[0]={razon:'Equipos del Norte S.A.',ruc:'1791234567001',dir:'Av. Amazonas',tel:'02',monto:'1150',fof:'2026-09-15',genero:'E'};
  }, {invitado:'Equipos del Norte S.A.'});
  revisa('Selección directa', d=>{
    Object.assign(d,{areaId:'a1',tipoProceso:'Selección directa por excepción',bienServicio:'Servicio',
      fechaInicio:'2026-09-10',numero:'4',objeto:'Mantenimiento',plazo:'20',presupuesto:'2000',
      causal:'Proveedor único',partida:'1.1.1',fuente:'Fondo de Áreas Protegidas - FAP',formaPago:'Factura',
      fechaInvitacion:'2026-09-11',fechaLimite:'2026-09-18',fechaAdj:'2026-09-20',
      adjudicado:'Talleres del Oriente',fechaRecepcion:'2026-10-01',
      items:[{desc:'Mantenimiento',unidad:'Servicio',cantidad:'1',punit:'1000'}]});
    d.provs[0]={razon:'Talleres del Oriente',ruc:'1791234567001',dir:'Napo y Quito',tel:'02',monto:'1150',fof:'2026-09-15',genero:'E'};
  }, {invitado:'Talleres del Oriente'});
  revisa('Compra directa', d=>{
    Object.assign(d,{areaId:'a1',tipoProceso:'Compra directa',bienServicio:'Bien',tipoBien:'Bien de control',
      fechaInicio:'2026-09-10',numero:'5',objeto:'Insumos de oficina',plazo:'10',presupuesto:'500',
      partida:'1.1.1',fuente:'Fondo de Áreas Protegidas - FAP',formaPago:'Factura',
      fechaRecepcion:'2026-10-01',garantiaAplica:'No aplica',cedulaJefe:'1712345678',correoJefe:'j@mae.gob.ec',
      items:[{desc:'Insumos',unidad:'Unidad',cantidad:'5',punit:'20'}]});
    d.provs[0]={razon:'Bazar Central',ruc:'1791234567001',dir:'Sucre y Bolívar',tel:'02',monto:'115',fof:'',genero:'E'};
  });
}

seccion('22 · El aviso dice QUÉ falta, no solo que falta algo');
// Antes la AC veía el momento sin palomita y tenía que adivinar cuál de los
// veinte campos era. Ahora la lista de requisitos es una sola: de ella salen el
// ✓ del momento, el aviso de arriba y la marca de cada campo, así que no pueden
// contradecirse.
{
  const w8=nuevoDom();
  w8.ST.cfg.areas=[{id:'a1',ap:'Parque Nacional Yasuní',siglas:'PNY',ciudad:'Quito',mae:'J. Andrade',maeCargo:'Jefe',lugar:'El Coca'}];
  w8.newExp('Aviso');
  const da=w8.D();
  Object.assign(da,{areaId:'a1',tipoProceso:'Comparación de precios',bienServicio:'Bien'});
  w8.save();
  // el ✓ y el aviso no pueden decir cosas distintas, en ningún momento
  [0,1,2,3].forEach(i=>ok(w8.doneArr()[i]===(w8.faltan(i).length===0),
    'momento '+(i+1)+': el ✓ y la lista de lo que falta coinciden'));
  const pendientes=w8.faltan(0).map(x=>x.label);
  ok(pendientes.indexOf('Objeto del proceso')>=0,'el aviso nombra el objeto con el mismo rótulo que el formulario', pendientes.join(' | '));
  ok(pendientes.indexOf('Tipo de bien')>=0,'y el tipo de bien, que solo aplica a bienes');
  ok(w8.faltan(0).every(x=>x.label&&x.label.length>3),'todo lo que falta tiene nombre legible');
  w8.ST.nav='captura'; w8.ST.step=0; w8.render();
  let html=w8.document.getElementById('app').innerHTML;
  ok(html.indexOf('Faltan '+pendientes.length+' datos en este momento')>0,
     'la captura lo anuncia arriba: «Faltan '+pendientes.length+' datos»');
  ok(html.indexOf('Objeto del proceso')>0,'y lista el campo por su nombre');
  // el campo pendiente queda marcado en su sitio
  const objeto=w8.document.querySelector("[data-k='objeto']");
  ok(objeto && /E5C98A/.test(objeto.getAttribute('style')||''),'el campo pendiente se marca en el formulario');
  // y al llenarlo, deja de estar marcado y desaparece de la lista
  da.objeto='Adquisición de combustible'; w8.save(); w8.render();
  ok(w8.faltan(0).every(x=>x.campo!=='objeto'),'al llenarlo, sale de la lista');
  const objeto2=w8.document.querySelector("[data-k='objeto']");
  ok(objeto2 && !/E5C98A/.test(objeto2.getAttribute('style')||''),'y el campo deja de estar marcado');
  // en Documentos se dice por qué está bloqueado
  w8.ST.nav='documentos'; w8.render();
  html=w8.document.getElementById('app').innerHTML;
  ok(html.indexOf('Falta por llenar:')>0,'en Documentos, cada documento bloqueado dice qué falta');
  // momento completo: el aviso cambia de tono
  Object.assign(da,{tipoBien:'Activo fijo',fechaInicio:'2026-09-10',numero:'3',plazo:'20',
    presupuesto:'2000',partida:'1.1.1',fuente:'Fondo de Áreas Protegidas - FAP',formaPago:'Factura',
    fechaInvitacion:'2026-09-11',fechaLimite:'2026-09-18',
    items:[{desc:'Diésel',unidad:'Galón',cantidad:'100',punit:'20'}]});
  da.provs[0]={razon:'Proveedor A',ruc:'1',dir:'',tel:'',monto:'2000',fof:'2026-09-15',genero:'E'};
  w8.save();
  ok(w8.faltan(0).length===0,'con todo lleno no falta nada', w8.faltan(0).map(x=>x.label).join(' | '));
  w8.ST.nav='captura'; w8.render();
  ok(w8.document.getElementById('app').innerHTML.indexOf('Este momento está completo')>0,
     'y el aviso lo dice: «Este momento está completo»');
}

seccion('23 · La Hoja de Datos avisa de lo suyo: sale impresa en todo');
{
  const w9=nuevoDom();
  // La app viene con un área y una AC de ejemplo; esto simula a quien las borra.
  w9.ST.cfg.ac=''; w9.ST.cfg.acCorreo='';
  w9.ST.cfg.areas=[{id:'a1',ap:'Parque Nacional Yasuní',siglas:'',ciudad:'Quito',mae:'J. Andrade',maeCargo:'Jefe',lugar:'El Coca'}];
  w9.newExp('Sin hoja de datos');
  Object.assign(w9.D(),{areaId:'a1',tipoProceso:'Compra directa',bienServicio:'Servicio'});
  w9.save();
  const fd=w9.faltanDeDatos().map(x=>x.label);
  ok(fd.indexOf('Nombre de la administradora contadora')>=0,'sin AC, la Hoja de Datos lo pide', fd.join(' | '));
  ok(fd.indexOf('Siglas del área')>=0,'y las siglas, que arman el código del expediente');
  w9.ST.nav='datos'; w9.render();
  ok(w9.document.getElementById('app').innerHTML.indexOf('Faltan '+fd.length+' datos aquí')>0,
     'la Hoja de Datos lo anuncia arriba');
  // y desde el Momento 1 se ve que el problema está allá
  ok(w9.faltan(0).some(x=>x.nav==='datos'),'el Momento 1 remite a la Hoja de Datos',
     w9.faltan(0).map(x=>x.label).join(' | '));
  w9.ST.cfg.ac='Lcda. María Salazar'; w9.ST.cfg.acCorreo='m@fias.org.ec';
  w9.ST.cfg.areas=[{id:'a1',ap:'Parque Nacional Yasuní',siglas:'PNY',ciudad:'Quito',mae:'J. Andrade',maeCargo:'Jefe',lugar:'El Coca'}];
  w9.D().areaId='a1'; w9.save(); w9.render();
  ok(w9.faltanDeDatos().length===0,'completa, ya no falta nada', w9.faltanDeDatos().map(x=>x.label).join(' | '));
  ok(!w9.faltan(0).some(x=>x.nav==='datos'),'y el Momento 1 deja de remitir allá');
}

seccion('24 · Al cambiar de momento la vista sube');
{
  const w5=nuevoDom();
  w5.ST.cfg.areas=[{id:'a1',ap:'Parque Nacional Yasuní',siglas:'PNY',ciudad:'Quito',mae:'J. Andrade',maeCargo:'Jefe',lugar:'El Coca'}];
  w5.newExp('Subir');
  Object.assign(w5.D(),{areaId:'a1',tipoProceso:'Compra directa',bienServicio:'Servicio',
    fechaInicio:'2026-09-10',numero:'3',objeto:'Servicio'});
  w5.ST.nav='captura'; w5.render();
  const main=w5.document.querySelector('main');
  main.scrollTop=900;                       // la AC estaba abajo, junto al botón
  w5.setStep(1);
  ok(w5.document.querySelector('main').scrollTop===0,'el contenedor vuelve al principio');
  const foco=w5.document.activeElement;
  ok(foco && foco.classList && foco.classList.contains('inp') && !foco.disabled,
     'el cursor queda en un campo por llenar: '+(foco&&(foco.dataset.k||foco.dataset.pk||foco.dataset.ik||foco.tagName)));
  ok(String(foco.value||'')==='','y ese campo está vacío, que es el que toca llenar');
}

seccion('25 · Lo que viene del CLM no se vuelve a teclear');
{
  // Lo que ya tenía la AC en este navegador: dos áreas en la Hoja de Datos, y
  // la del contrato escrita a su manera («RPF Chimborazo»).
  const areas=[
    {id:'a1',ap:'Parque Nacional Yasuní',siglas:'PNY',ciudad:'Quito',mae:'J. Andrade',maeCargo:'Jefe',lugar:'El Coca',maeGenero:'M',apGenero:'M'},
    {id:'a2',ap:'RPF Chimborazo',siglas:'RPFCH',ciudad:'Riobamba',mae:'L. Paca',maeCargo:'Jefa',lugar:'Riobamba',maeGenero:'F',apGenero:'F'}];
  const hoja=exps=>JSON.stringify({cfg:{ac:'Lcda. María Salazar',acCorreo:'msalazar@fias.org.ec',acGenero:'F',areas:areas},exps:exps||[],curId:null});
  const buzonRen={id:'ren:FIAS-FAP-2026-114',via:'renovacion',desde:'CLM',datos:{
    contratoNro:'FIAS-FAP-2026-114',fechaContrato:'2026-02-12',fechaFin:'2026-12-31',montoTotal:8400,
    objeto:'Servicio de mantenimiento de vehículos del área protegida',proveedor:'Talleres del Oriente Cía. Ltda.',
    area:'Reserva de Producción de Fauna Chimborazo'}};
  const conBuzon=(buzon,exps)=>win=>{
    win.localStorage.setItem('fap_v3',hoja(exps));
    if(buzon) win.localStorage.setItem('fap_precarga',JSON.stringify(buzon));
  };

  // --- Renovación
  let wp=nuevoDom(conBuzon(buzonRen),'#precarga=ren%3AFIAS-FAP-2026-114');
  ok(wp.ST.exps.length===1,'el enlace del CLM crea el expediente, sin «+ Nuevo proceso»',wp.ST.exps.length);
  let dp=wp.D();
  ok(dp.tipoProceso==='Renovación','ya es de vía renovación');
  ok(dp.contratoAnterior==='FIAS-FAP-2026-114' && dp.fechaSuscripcionAnt==='2026-02-12'
     && dp.fechaFinAnterior==='2026-12-31' && dp.montoAnterior==='8400',
     'con los cuatro datos del contrato vigente puestos',
     [dp.contratoAnterior,dp.fechaSuscripcionAnt,dp.fechaFinAnterior,dp.montoAnterior].join(' | '));
  ok(dp.provs[0].razon==='Talleres del Oriente Cía. Ltda.' && /mantenimiento de vehículos/.test(dp.objeto),'y el proveedor y el objeto');
  ok(dp.areaId==='a2','«Reserva de Producción de Fauna Chimborazo» se reconoce como «RPF Chimborazo»',dp.areaId);
  const tdP=wp.buildTemplateData();
  ok(tdP.contratoNro==='FIAS-FAP-2026-114' && tdP.fechaContrato==='12 de febrero de 2026'
     && tdP.fechaFin==='31 de diciembre de 2026' && tdP.montoTotal==='8.400,00',
     'llegan al Word con los nombres del catálogo',[tdP.contratoNro,tdP.fechaContrato,tdP.fechaFin,tdP.montoTotal].join(' | '));
  const faltaP=wp.faltan(0).map(x=>x.label);
  ok(!faltaP.some(l=>/contrato vigente|Monto contratado|Razón social/.test(l)),'el aviso ya no pide lo que se trajo',faltaP.join(' | '));
  ok(faltaP.indexOf('Consumo ejecutado del período')>=0 && wp.m1Done()===false,
     'pero lo que no se trajo se sigue exigiendo: el momento no se cierra con huecos');
  ok(wp.localStorage.getItem('fap_precarga')===null,'el buzón se vacía al usarlo');
  ok(wp.location.hash==='','y el enlace se limpia: recargar no vuelve a precargar',wp.location.hash);
  ok(wp.ST.nav==='captura' && /Traído del CLM/.test(wp.document.getElementById('app').textContent),
     'la AC cae en la captura, con el aviso de qué se trajo');
  const btnEnt=[...wp.document.querySelectorAll('button')].find(b=>b.textContent==='Entendido');
  btnEnt.onclick();
  ok(wp.cur().precarga.visto===true && !/Traído del CLM/.test(wp.document.getElementById('app').textContent),'y el aviso se va con «Entendido»');

  // --- Pulsar otra vez no duplica
  const guardado=wp.localStorage.getItem('fap_v3');
  wp=nuevoDom(win=>{win.localStorage.setItem('fap_v3',guardado);},'#precarga=ren%3AFIAS-FAP-2026-114');
  ok(wp.ST.exps.length===1 && wp.cur().origen==='ren:FIAS-FAP-2026-114','volver a pulsar «Renovar» abre el mismo expediente, no otro');
  ok(/Ya tenías este expediente/.test(wp.document.getElementById('toast').textContent),'y lo dice');

  // --- Una renovación empezada a mano, antes del botón
  wp=nuevoDom(conBuzon(buzonRen,[{id:'e1',nombre:'Mantenimiento 2027 (a mano)',generated:{},
    data:Object.assign(nuevoDom().dataDef(),{tipoProceso:'Renovación',contratoAnterior:'FIAS-FAP-2026-114',areaId:'a2'})}]),
    '#precarga=ren%3AFIAS-FAP-2026-114');
  ok(wp.ST.exps.length===1 && wp.ST.curId==='e1','si la AC ya la había empezado a mano, se abre esa y no se duplica');

  // --- Solicitud
  const buzonSol={id:'sol:s1726',via:'solicitud',desde:'CLM',datos:{objeto:'Mantenimiento de senderos 2027',
    area:'Parque Nacional Yasuní',bienServicio:'Servicio',presupuesto:4500,plazo:45,garantias:true}};
  wp=nuevoDom(conBuzon(buzonSol),'#precarga=sol%3As1726');
  dp=wp.D();
  ok(wp.ST.exps.length===1 && wp.cur().nombre==='Mantenimiento de senderos 2027','la solicitud abre su expediente, con su nombre');
  ok(dp.objeto==='Mantenimiento de senderos 2027' && dp.bienServicio==='Servicio' && dp.presupuesto==='4500'
     && dp.plazo==='45' && dp.tipoPlazo==='entrega' && dp.areaId==='a1','objeto, bien/servicio, presupuesto, plazo y área puestos');
  ok(!dp.tipoProceso,'la vía no se inventa: la elige la AC entre las tres');
  ok(wp.diasEjecucion()===45 && wp.motivoContrato()==='plazo','45 días de plazo: La Mágica deriva «contrato», como el CLM');
  ok(!dp.garAnticipo && !dp.garFielCumpl,'las garantías no se marcan a ciegas: el CLM no dice cuál');
  ok(wp.cur().precarga.notas.some(n=>/garantías/.test(n)),'pero se le avisa que la solicitud las pedía');

  // --- Sin buzón: no se crea nada vacío
  wp=nuevoDom(conBuzon(null),'#precarga=sol%3Aperdida');
  ok(wp.ST.exps.length===0,'un enlace sin datos detrás no crea un expediente vacío');
  ok(/No llegaron los datos desde el CLM/.test(wp.document.getElementById('toast').textContent),'y dice qué hacer');

  // --- Área dudosa: no se adivina
  wp=nuevoDom(win=>{
    win.localStorage.setItem('fap_v3',JSON.stringify({cfg:{ac:'A',acCorreo:'a@b',areas:[
      {id:'x1',ap:'PN Cotopaxi',siglas:'PNC'},{id:'x2',ap:'Parque Nacional Cotopaxi',siglas:'PNCX'}]},exps:[]}));
    win.localStorage.setItem('fap_precarga',JSON.stringify(Object.assign({},buzonSol,{id:'sol:s2',datos:Object.assign({},buzonSol.datos,{area:'Parque Nacional Cotopaxi'})})));
  },'#precarga=sol%3As2');
  ok(wp.D().areaId==='x2','con el nombre exacto, esa área',wp.D().areaId);
  wp=nuevoDom(win=>{
    win.localStorage.setItem('fap_v3',JSON.stringify({cfg:{ac:'A',acCorreo:'a@b',areas:[
      {id:'x1',ap:'PN Cotopaxi',siglas:'PNC'},{id:'x2',ap:'Cotopaxi',siglas:'PNCX'}]},exps:[]}));
    win.localStorage.setItem('fap_precarga',JSON.stringify(Object.assign({},buzonSol,{id:'sol:s3',datos:Object.assign({},buzonSol.datos,{area:'Parque Nacional Cotopaxi'})})));
  },'#precarga=sol%3As3');
  ok(wp.D().areaId==='' && wp.cur().precarga.notas.some(n=>/elígela arriba/.test(n)),
     'con dos candidatas no se elige: se le pide a la AC',wp.D().areaId);

  // --- Sin enlace, La Mágica arranca como siempre
  wp=nuevoDom(conBuzon(buzonRen));
  ok(wp.ST.exps.length===0 && wp.localStorage.getItem('fap_precarga')!==null,'sin #precarga no se toca nada, aunque haya un buzón');
}

seccion('26 · IVA por ítem: una compra puede mezclar 15 % y 0 %');
// Antes había un solo IVA para todo el detalle. Una compra de víveres y
// combustible —arroz al 0 %, gasolina al 15 %— salía con IVA de más: el total
// no cuadraba con la oferta, la orden decía una cifra en letras y otra en la
// tabla, y podía cruzar en falso el umbral de USD 8.000 del Director.
{
  const textoDocx=b64=>{
    const zip=new PizZip(b64,{base64:true}); let t='';
    zip.file(/word\/document\.xml/).forEach(f=>{
      t+=f.asText().replace(/<\/w:p>/g,'\n').replace(/<(?!\/?w:t[ >])[^>]*>/g,'').replace(/<\/?w:t[^>]*>/g,'')+'\n';
    });
    return t;
  };
  const rellena=(w,slot)=>{
    const doc=new Docxtemplater(new PizZip(w.ST.tpls[slot],{base64:true}),{paragraphLoop:true,linebreaks:true,nullGetter:()=>''});
    doc.render(w.buildTemplateData());
    return textoDocx(doc.getZip().generate({type:'base64'}));
  };
  const viveres=()=>{
    const wi=nuevoDom();
    wi.ST.cfg.areas=[{id:'a1',ap:'Parque Nacional Yasuní',siglas:'PNY',ciudad:'Quito',mae:'J. Andrade',maeCargo:'Jefe',maeGenero:'M',apGenero:'M',lugar:'El Coca'}];
    wi.ST.cfg.ac='Lcda. María Salazar'; wi.ST.cfg.acCorreo='m@fias.org.ec';
    wi.newExp('Víveres y combustible');
    Object.assign(wi.D(),{areaId:'a1',tipoProceso:'Compra directa',bienServicio:'Bien',tipoBien:'Activo fijo',
      fechaInicio:'2026-10-20',numero:'9',objeto:'Víveres y combustible para patrullaje',plazo:'5',presupuesto:'2000',fechaRecepcion:'2026-10-25',
      partida:'3.1.2.2',fuente:'Fondo de Áreas Protegidas - FAP',formaPago:'Factura',
      items:[{desc:'Arroz 50 kg',unidad:'Unidad',cantidad:'10',punit:'48',iva:'0'},
             {desc:'Gasolina súper',unidad:'Galón',cantidad:'150',punit:'3.9',iva:'15'},
             {desc:'Repelente 200 ml',unidad:'Unidad',cantidad:'40',punit:'4.5',iva:'15'}]});
    wi.D().provs[0]={razon:'Comercial Orellana',ruc:'1790012345001',dir:'Av. 9 de Octubre',tel:'',monto:'1365.75',fof:'',genero:'E'};
    wi.save(); return wi;
  };
  const wi=viveres();
  const t=wi.itemTotals();
  ok(t.sub===1245 && t.iva===114.75 && t.total===1359.75,'subtotal 1.245,00 · IVA 114,75 · total 1.359,75',[t.sub,t.iva,t.total].join(' · '));
  ok(t.tarifas.length===2 && t.tarifas[0].pct===15 && t.tarifas[0].base===765 && t.tarifas[1].pct===0 && t.tarifas[1].base===480,
     'el IVA se agrupa por tarifa, de la mayor a la menor: 15 % sobre 765,00 y 0 % sobre 480,00');
  // La oferta de 1.365,75 no cuadra con el detalle: el momento no se cierra y dice por qué
  ok(wi.m2Done()===false,'si el detalle no cuadra con el monto, el Momento 2 no se cierra');
  const fc=wi.faltan(1).find(x=>x.campo==='cuadre');
  ok(fc && /cuadre con el monto del proveedor/.test(fc.label) && /6,00/.test(fc.label),'y el aviso dice qué falta y por cuánto: '+(fc&&fc.label));
  ok(wi.documents().find(x=>x.id==='entrega').ready===false,'el acta que imprime la tabla de valores no sale con dos cifras distintas');
  ok(wi.checklistPendientes().some(x=>x.label==='El monto cuadra con el detalle de ítems'),'y la lista de verificación también lo frena');
  wi.ST.nav='captura'; wi.ST.step=1; wi.render();
  let html=wi.document.getElementById('app').innerHTML;
  ok(/No cuadra con el monto del proveedor/.test(html),'el recuadro de totales lo avisa en el momento, al lado de los números');
  // Con el monto bien puesto, cuadra
  wi.D().provs[0].monto='1359.75'; wi.save(); wi.render();
  ok(wi.m2Done()===true,'con la oferta real (1.359,75) el Momento 2 se cierra',wi.faltan(1).map(x=>x.label).join(' | '));
  ok(/Cuadra con el monto del proveedor/.test(wi.document.getElementById('app').innerHTML),'y el recuadro lo confirma en verde');
  ok(wi.documents().find(x=>x.id==='entrega').ready===true,'y el acta ya se puede generar');
  const iv=wi.checklistEnvio().find(x=>x.label==='IVA aplicado y declarado');
  ok(iv.ok && /15 % sobre USD 765,00 y del 0 % sobre USD 480,00/.test(iv.detalle),'la lista de verificación declara cada tarifa con su base: '+iv.detalle);

  // Lo que recibe la plantilla
  const datos=wi.buildTemplateData();
  ok(datos.ivaMixto===true && datos.ivas.length===2,'{#ivas} trae una fila por tarifa e {ivaMixto} es verdadero');
  ok(datos.ivas[0].ivaPct==='15' && datos.ivas[0].subtotal==='765,00' && datos.ivas[0].iva==='114,75'
     && datos.ivas[1].ivaPct==='0' && datos.ivas[1].subtotal==='480,00' && datos.ivas[1].iva==='0,00',
     'cada fila con su tarifa, su base y su IVA',JSON.stringify(datos.ivas));
  ok(datos.ivaPct==='15% y 0','{ivaPct} suelto enumera las tarifas, para la plantilla que no use el bloque: '+datos.ivaPct);
  ok(datos.items.map(x=>x.ivaPct).join(',')==='0,15,15','y cada ítem lleva la suya en {#items}');
  // El documento de verdad
  const out=rellena(wi,'7_Orden_de_compra.docx');
  ok(/IVA \(15%\) sobre USD 765,00\s*114,75/.test(out),'la orden imprime «IVA (15%) sobre USD 765,00 · 114,75»');
  ok(/IVA \(0%\) sobre USD 480,00\s*0,00/.test(out),'y «IVA (0%) sobre USD 480,00 · 0,00»');
  ok(/TOTAL\s*1\.359,75/.test(out),'con el total que cuadra con la oferta');

  // Con una sola tarifa, el documento sale exactamente como antes
  wi.ivaATodos('15');
  ok(wi.D().items.every(x=>x.iva==='15') && wi.D().ivaPct==='15','«Todos al 15 %» pone la misma tarifa a todos los ítems');
  const out1=rellena(wi,'7_Orden_de_compra.docx');
  ok(/IVA \(15%\)\s*186,75/.test(out1) && !/sobre USD/.test(out1),'con una sola tarifa: «IVA (15%) · 186,75», sin «sobre», igual que siempre');
  ok(wi.buildTemplateData().ivaPct==='15' && wi.buildTemplateData().ivaMixto===false,'y {ivaPct} vuelve a ser «15»');
  // Un ítem nuevo nace con la última tarifa aplicada a todos
  wi.ivaATodos('0'); wi.addItem();
  ok(wi.D().items[3].iva==='0','un ítem nuevo nace con la tarifa que se aplicó a todos');

  // Las ocho plantillas con tabla de valores se rellenan con tarifas mezcladas
  const wm=viveres(); wm.D().provs[0].monto='1359.75'; wm.save();
  ['7_Orden_de_compra.docx','8_Orden_de_servicio.docx','9_Acta_entrega_recepcion.docx','10_Informe_satisfaccion.docx',
   '12_Acta_entrega_area_protegida.docx','16_Orden_de_compra_director.docx','17_Orden_de_servicio.docx','18_Informe_satisfaccion_CD.docx']
  .forEach(f=>{
    let o=''; try{ o=rellena(wm,f); }catch(e){ o='ERROR '+e.message; }
    ok(/IVA \(15%\) sobre USD 765,00/.test(o) && /IVA \(0%\) sobre USD 480,00/.test(o), f+' imprime una fila de IVA por tarifa', o.slice(0,80));
  });

  // «Otra…»: cualquier porcentaje, validado
  wm.ST.nav='captura'; wm.ST.step=1; wm.render();
  wm.prompt=()=>'8';
  const sel=wm.document.querySelector("select[data-ik='iva'][data-i='2']");
  sel.value='otra'; wm.onItem(sel);
  ok(wm.D().items[2].iva==='8','«Otra…» acepta una tarifa que no está en la lista: 8 %');
  ok([...wm.document.querySelectorAll("select[data-ik='iva'][data-i='0'] option")].some(o=>o.value==='8'),'y desde ahí se ofrece en todos los ítems');
  wm.prompt=()=>'ciento';
  const sel2=wm.document.querySelector("select[data-ik='iva'][data-i='1']");
  sel2.value='otra'; wm.onItem(sel2);
  ok(wm.D().items[1].iva==='15' && /no es válida/.test(wm.document.getElementById('toast').textContent),'una tarifa que no es número se rechaza y el ítem queda como estaba');
  // Cambiar la tarifa en el desplegable recalcula en el momento
  const sel3=wm.document.querySelector("select[data-ik='iva'][data-i='1']");
  sel3.value='0'; wm.onItem(sel3);
  ok(wm.itemTotals().iva===round2js(180*0.08) && /IVA \(8 %\) sobre USD 180,00/.test(wm.document.getElementById('a_totales').textContent),
     'cambiar la tarifa de un ítem recalcula el recuadro sin recargar: '+wm.document.getElementById('a_totales').textContent.replace(/\s+/g,' ').slice(0,120));

  // El umbral de USD 8.000 se mide con el IVA real
  const wd=viveres();
  wd.D().items=[{desc:'Raciones de campaña',unidad:'Unidad',cantidad:'500',punit:'14',iva:'0'},{desc:'Fundas',unidad:'Unidad',cantidad:'100',punit:'1',iva:'15'}];
  wd.save();
  ok(wd.montoConIva()===7115 && wd.firmaDirector()===false,'7.000 al 0 % y 100 al 15 %: total 7.115,00, la firma la AC (con un 15 % único eran 8.165,00 y pasaba al Director)');

  // Un expediente viejo no cambia ni un centavo
  const wv=nuevoDom(win=>{
    win.localStorage.setItem('fap_v3',JSON.stringify({cfg:{areas:[{id:'a1',ap:'PNY',siglas:'PNY'}]},
      exps:[{id:'e1',nombre:'viejo',generated:{},data:{ivaPct:'12',items:[{desc:'A',unidad:'Unidad',cantidad:'2',punit:'100'}]}}],curId:'e1'}));
  });
  ok(wv.D().items[0].iva==='12','un expediente de antes hereda su IVA único en cada ítem (12 %)');
  ok(wv.itemTotals().total===224,'y su total sigue siendo el mismo: 224,00');
  // Un ítem cargado sin tarifa (a mano, desde fuera) toma la del expediente
  const ws=viveres(); ws.D().ivaPct='15'; ws.D().items=[{desc:'X',unidad:'Unidad',cantidad:'1',punit:'100'}];
  ok(ws.itemTotals().total===115,'un ítem sin tarifa propia lleva la del expediente');
  // y el subtotal + IVA impresos suman exactamente el total
  ws.D().items=[{desc:'X',unidad:'Unidad',cantidad:'3',punit:'0.333',iva:'15'},{desc:'Y',unidad:'Unidad',cantidad:'7',punit:'1.115',iva:'5'}];
  const tr=ws.itemTotals();
  ok(round2js(tr.sub+tr.iva)===tr.total,'subtotal + IVA = total, al centavo, también con precios de tres decimales');
}
function round2js(n){ return Math.round((n+Number.EPSILON)*100)/100; }

seccion('27 · Pegar el detalle desde Excel');
{
  const wx=nuevoDom();
  wx.ST.cfg.areas=[{id:'a1',ap:'Parque Nacional Yasuní',siglas:'PNY',ciudad:'Quito',mae:'J. Andrade',maeCargo:'Jefe',lugar:'El Coca'}];
  wx.newExp('Pegado');
  Object.assign(wx.D(),{areaId:'a1',tipoProceso:'Compra directa',bienServicio:'Bien'});
  wx.save();
  const pega=(texto,modo)=>{ wx.PASTE_OPEN=true; wx.ST.nav='captura'; wx.ST.step=1; wx.render();
    wx.document.getElementById('pastebox').value=texto; wx.procesarPaste(modo||'reemplazar'); };
  // La proforma del proveedor, copiada con su fila de títulos y en su orden
  pega(['Ítem\tCant.\tDescripción\tUnidad\tP. Unitario\tIVA %\tTotal',
        '1\t10\tArroz 50 kg\tu\t48,00\t0%\t480,00',
        '2\t150\tGasolina súper\tgal\t3,90\t15%\t585,00',
        '3\t2\tCaja de clavos\tCaja\t1.150,50\tExento\t2.301,00',
        '\t\tSUBTOTAL\t\t\t\t3.366,00',
        '\t\tTOTAL\t\t\t\t3.453,75'].join('\n'));
  const it=wx.D().items;
  ok(it.length===3,'se leen los 3 ítems; la fila de títulos y las de totales no son ítems',it.map(x=>x.desc).join(' | '));
  ok(it[0].desc==='Arroz 50 kg' && it[0].cantidad==='10' && it[0].punit==='48','las columnas se reconocen por su título, en cualquier orden');
  ok(it[0].unidad==='Unidad' && it[1].unidad==='Galón','«u» y «gal» se vuelven Unidad y Galón');
  ok(it[2].unidad==='Caja','una unidad que no está en la lista se conserva');
  ok(wx.document.querySelector("select[data-i='2'][data-ik='unidad']").value==='Caja','y el desplegable la muestra, no se queda en «—»');
  ok(it[2].punit==='1150.5' && it[1].punit==='3.9','«1.150,50» y «3,90» se leen como en Ecuador');
  ok(it[0].iva==='0' && it[1].iva==='15' && it[2].iva==='0','la columna IVA trae la tarifa de cada ítem («0%», «15%», «Exento»)');
  // Una columna «IVA» con el VALOR del impuesto no se toma por tarifa: «12,00»
  // parecería un 12 %, pero «3,75» delata que la columna es de valores.
  pega('Descripción\tCantidad\tPrecio\tIVA\nBotas\t2\t40\t12,00\nPoncho\t1\t25\t3,75');
  ok(wx.D().items.length===2 && wx.D().items[0].punit==='40','«Precio» a secas se lee como precio unitario');
  ok(wx.D().items.every(x=>x.iva===wx.tarifaNueva()),'una columna IVA con valores y no tarifas se ignora entera: los ítems toman la de siempre',
     wx.D().items.map(x=>x.iva).join(','));
  // Sin títulos, el orden de siempre
  pega('Linterna\tUnidad\t4\t12.5\t15\nPilas AA\tunid\t24\t0,80\t15');
  ok(wx.D().items.length===2 && wx.D().items[1].desc==='Pilas AA' && wx.D().items[1].punit==='0.8' && wx.D().items[1].cantidad==='24',
     'sin fila de títulos: Descripción · Unidad · Cantidad · Precio · IVA');
  // Una primera fila que parece de títulos pero trae cifras es un ítem
  pega('Servicio de mantenimiento\tUnidad\t1\t500\nRevisión de frenos\tServicio\t2\t80');
  ok(wx.D().items.length===2 && wx.D().items[0].desc==='Servicio de mantenimiento' && wx.D().items[0].punit==='500',
     'una primera fila con cifras no se toma por títulos: no se pierde el primer ítem',wx.D().items.map(x=>x.desc).join(' | '));
  pega('Linterna\tUnidad\t4\t12.5\t15\nPilas AA\tunid\t24\t0,80\t15');
  // Agregar no borra lo que había
  pega('3 Machetes\n2 Limas','agregar');
  ok(wx.D().items.length===4 && wx.D().items[2].desc==='Machetes' && wx.D().items[2].cantidad==='3','«Agregar al final» suma a lo que había');
  // Reemplazar lo que ya tiene descripción, solo si la AC confirma
  wx.confirm=()=>false;
  pega('1 Otra cosa');
  ok(wx.D().items.length===4,'reemplazar el detalle pide confirmación y, si la AC dice que no, no toca nada');
  wx.confirm=()=>true;
  pega('');
  ok(/vacío/.test(wx.document.getElementById('toast').textContent),'pegar nada avisa, sin alert');
}

console.log('\n'+(fallos?('✗ '+fallos+' fallo(s) de '+pruebas):('✓ '+pruebas+' comprobaciones, todas pasan')));
process.exit(fallos?1:0);
