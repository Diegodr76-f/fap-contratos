/*
 * Comprobaciones del CLM (clm/index.html).
 *
 * Cubren el puente entre el contrato y su carpeta interna: que el número
 * de carpeta se vea en el detalle y en el listado, que la búsqueda funcione en
 * las dos direcciones (del objeto a la carpeta y de la carpeta al contrato) y
 * que el filtro y la alerta de «sin carpeta» solo aparezcan cuando tienen algo
 * que decir. Comprueban de paso que un contrato sin esos campos —que es todo el
 * portafolio hasta que la columna del Excel se llene— se pinta igual que antes.
 *
 * Como el CLM es un solo HTML sin build, la forma de verificarlo sin ir
 * haciendo clic es cargarlo en un DOM de mentira y manejarlo desde fuera. Ojo
 * con un detalle: el CLM declara su estado con `let` (ST, CONTRACTS, SES), y
 * eso no cuelga del objeto window; se llega con w.eval(). Las funciones sí,
 * porque son declaraciones de función globales.
 *
 * Uso (las dependencias no se guardan en el repositorio):
 *     npm install jsdom
 *     node scripts/probar_clm.js
 *
 * Sale con código 1 si algo falla, para poder colgarlo de un workflow.
 */
const fs=require('fs'), path=require('path');
let JSDOM;
try{ JSDOM=require('jsdom').JSDOM; }
catch(e){ console.error('Falta la dependencia de la prueba. Instálala con:\n    npm install jsdom\n'); process.exit(2); }

const RAIZ=path.dirname(__dirname);
const HTML=fs.readFileSync(path.join(RAIZ,'clm','index.html'),'utf8');

let fallos=0, pruebas=0;
function ok(cond,msg,extra){ pruebas++; if(cond){ console.log('  ✓ '+msg); } else { fallos++; console.log('  ✗ '+msg+(extra!==undefined?('  → '+extra):'')); } }
function seccion(t){ console.log('\n'+t); }

// Un portafolio de mentira: tres contratos con carpeta y dos sin ella.
function contratos(){
  const base=(n,extra)=>Object.assign({
    nro:'FIAS-FAP-2026-'+String(n).padStart(3,'0'),
    detalle:'Mantenimiento de instalaciones '+n, area:'RPF Chimborazo',
    cat:'Mantenimiento', monto:1150, montoTotal:1150, cerrado:false,
    inicio:'2026-01-15', firma:'2026-01-20', fin:'2030-12-31',
    // 'Nuevo': el valor real de la columna «Tipo de contrato» que hace a un
    // contrato renovable (ver esRenovable() en clm/index.html). Los tests que
    // necesitan lo contrario (ya renovado / no recurrente) lo pisan en extra.
    tipo:'Nuevo', proveedor:'Servitec', plazo:350, adenda:'',
    tipoAdenda:null, modificacion:null, firmaAdenda:null,
    ac:'Ana Pérez', correo:'ana@fias.org.ec', link:null,
    fcierre:null, liquidado:null, saldo:null,
    carpeta:null, codigoProceso:null
  },extra);
  return [
    base(1,{carpeta:'47', codigoProceso:'RPFCH-2026-007'}),
    base(2,{carpeta:'48'}),
    base(3,{carpeta:'12'}),
    base(4,{}),
    base(5,{})
  ];
}

// Carga el CLM con una sesión ya abierta y la base servida por un fetch de
// mentira, para poder probar también el portafolio de hoy —sin ninguna carpeta
// registrada— y la mirada de una administradora.
// ses === false: entra sin sesión (pantalla de ingreso). op.hash: con qué enlace
// se abre. op.ls: lo que ya había guardado en el navegador. op.confirma: qué
// responde la AC a los confirm() — se cuentan en w._confirmas.
function nuevoDom(lista,ses,op){
  op=op||{};
  const datos=JSON.stringify(lista||contratos());
  const sesion=ses===false?null:(ses||{rol:'uo',user:'Unidad Operativa'});
  const dom=new JSDOM(HTML,{url:'http://localhost/clm/index.html'+(op.hash||''),runScripts:'dangerously',
    beforeParse(win){
      if(sesion) win.sessionStorage.setItem('fap_clm_ses',JSON.stringify(sesion));
      Object.keys(op.ls||{}).forEach(k=>win.localStorage.setItem(k,op.ls[k]));
      win.fetch=()=>Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(datos))});
      win.scrollTo=()=>{}; win.alert=()=>{};
      win._confirmas=0; win._responde=op.confirma===undefined?true:op.confirma;
      win.confirm=()=>{ win._confirmas++; return win._responde; };
    }});
  return dom.window;
}
// boot() es asíncrono: se espera a que la base esté cargada.
function listo(w){
  return new Promise((res,rej)=>{
    let n=0;
    (function esperar(){
      let hay=0; try{ hay=w.eval('CONTRACTS.length'); }catch(e){}
      if(hay) return res(w);
      if(++n>80) return rej(new Error('el CLM no cargó la base'));
      setTimeout(esperar,10);
    })();
  });
}
const texto=w=>w.document.getElementById('view').textContent.replace(/\s+/g,' ');
const pausa=ms=>new Promise(r=>setTimeout(r,ms));
// Un portafolio con tildes y dos administradoras, para la búsqueda y el ingreso.
function conTildes(){
  const l=contratos();
  l[2].area='Reserva Biológica El Cóndor'; l[2].detalle='Servicio de limpieza de oficinas';
  l[4].ac='María Guamán';
  l[0].link='https://ejemplo.org/contrato-001.pdf';
  return l;
}

(async function(){

// ---------------------------------------------------------------- 1
seccion('1 · El bloque Expediente en el detalle');
let w=await listo(nuevoDom());
w.go('detalle',0);
let t=texto(w);
ok(/Expediente/.test(t),'el bloque aparece');
ok(/N\.º de contrato\s*FIAS-FAP-2026-001/.test(t),'muestra el número de contrato');
ok(/Código del proceso\s*RPFCH-2026-007/.test(t),'muestra el código del proceso de La Mágica');
ok(/N\.º de carpeta interna\s*carpeta 47/.test(t),'muestra el número de la carpeta');

w.go('detalle',1);
t=texto(w);
ok(/Código del proceso\s*sin registrar/.test(t),'sin código del proceso lo dice, no lo esconde');
ok(/N\.º de carpeta interna\s*carpeta 48/.test(t),'y la carpeta sigue saliendo');

w.go('detalle',3);
t=texto(w);
ok(/N\.º de carpeta interna\s*sin registrar/.test(t),'un contrato sin carpeta lo dice');
ok(/columna Numero de carpeta interna del Excel maestro/.test(t),'y le dice a la U.O. dónde se escribe');

// ---------------------------------------------------------------- 2
seccion('2 · La búsqueda, en las dos direcciones');
w=await listo(nuevoDom());
w.go('contratos');
w.eval("ST.q='47'");
let r=w.filteredContracts();
ok(r.length===1 && r[0].nro==='FIAS-FAP-2026-001','buscar el número de carpeta encuentra su contrato',r.length);
w.eval("ST.q='RPFCH-2026-007'");
ok(w.filteredContracts().length===1,'buscar el código del proceso también');
w.eval("ST.q='Chimborazo'");
ok(w.filteredContracts().length===5,'buscar por área sigue trayendo todo el portafolio');
w.eval("ST.q=''");

// ---------------------------------------------------------------- 3
seccion('3 · El listado enseña la carpeta sin abrir el detalle');
w.go('contratos');
t=texto(w);
ok(/carpeta 47/.test(t) && /carpeta 48/.test(t) && /carpeta 12/.test(t),
   'las tres carpetas se ven en el listado');
w.eval("ST.viewMode='cards'"); w.go('contratos');
ok(/📁 47/.test(texto(w)),'y también en la vista de tarjetas');
w.eval("ST.viewMode='table'");

// ---------------------------------------------------------------- 4
seccion('4 · El filtro «Sin carpeta»');
w.go('contratos');
ok(!!w.document.getElementById('chipSinCarp'),'el filtro aparece: hay carpetas registradas y faltan dos');
ok(/Sin carpeta · 2/.test(texto(w)),'y dice cuántas faltan');
w.document.getElementById('chipSinCarp').onclick();
ok(w.eval('ST.sinCarpeta')===true,'al pulsarlo se enciende');
r=w.filteredContracts();
ok(r.length===2,'deja solo los dos que faltan',r.length);
ok(r.every(c=>!c.carpeta),'y ninguno tiene carpeta');
w.eval('ST.sinCarpeta=false');

// ---------------------------------------------------------------- 5
seccion('5 · La alerta agregada, no una por contrato');
const alertas=w.alertList().filter(a=>a.fn==='carp');
ok(alertas.length===1,'es una sola alerta, no una por contrato',alertas.length);
ok(/2 contratos sin carpeta/.test(alertas[0].t),'y dice cuántos son',alertas[0]&&alertas[0].t);
w.go('alertas');
const boton=[...w.document.querySelectorAll('.alert-row .go')].find(b=>b.dataset.fn==='carp');
ok(!!boton,'la alerta se pinta con su botón');
boton.onclick();
ok(w.eval('ST.view')==='contratos' && w.eval('ST.sinCarpeta')===true,'y lleva al listado ya filtrado');

// ---------------------------------------------------------------- 6
seccion('6 · El portafolio de hoy: ninguna carpeta registrada todavía');
const sinNada=contratos().map(c=>Object.assign({},c,{carpeta:null,codigoProceso:null}));
w=await listo(nuevoDom(sinNada));
w.go('contratos');
ok(!w.document.getElementById('chipSinCarp'),
   'el filtro no aparece: antes de la primera carpeta sería un cartel permanente');
ok(w.alertList().filter(a=>a.fn==='carp').length===0,'y la alerta tampoco');
ok(w.filteredContracts().length===5,'el listado se pinta completo, como siempre');
w.go('detalle',0);
ok(/N\.º de carpeta interna\s*sin registrar/.test(texto(w)),'el detalle lo dice sin estorbar');

// ---------------------------------------------------------------- 7
seccion('7 · Una AC no carga con el mantenimiento de la Unidad Operativa');
w=await listo(nuevoDom(contratos(),{rol:'ac',user:'Ana Pérez'}));
ok(w.myContracts().length===5,'la AC sí ve sus cinco contratos');
ok(w.alertList().filter(a=>a.fn==='carp').length===0,
   'pero la alerta es de quien tiene las carpetas, no suya');
w.go('detalle',0);
ok(/N\.º de carpeta interna\s*carpeta 47/.test(texto(w)),'y el número lo ve igual, que para eso está');
ok(!/columna Numero de carpeta interna del Excel maestro/.test(texto(w)),'sin la nota de dónde se escribe, que no le toca');

// ---------------------------------------------------------------- 8
seccion('8 · La búsqueda perdona tildes y el orden de las palabras');
w=await listo(nuevoDom(conTildes()));
w.go('contratos');
w.eval("ST.q='condor'");
r=w.filteredContracts();
ok(r.length===1 && r[0].nro==='FIAS-FAP-2026-003','«condor» sin tilde encuentra «El Cóndor»',r.length);
w.eval("ST.q='limpieza condor'");
ok(w.filteredContracts().length===1,'dos palabras de campos distintos, en cualquier orden');
w.eval("ST.q='CÓNDOR   Limpieza'");
ok(w.filteredContracts().length===1,'mayúsculas, tildes y espacios de más no estorban');
w.eval("ST.q='limpieza chimborazo'");
ok(w.filteredContracts().length===0,'pero cada palabra tiene que estar: no es un «o»');
w.eval("ST.q='zzz'"); w.go('contratos');
ok(/Estás filtrando por la búsqueda «zzz»/.test(texto(w)),'sin resultados dice qué filtro está puesto');
const limpiar=w.document.getElementById('limpiarFiltros');
ok(!!limpiar,'y ofrece quitar los filtros');
limpiar.onclick();
ok(w.eval('ST.q')==='' && w.filteredContracts().length===5,'que deja el listado completo');
let g=w.buscarGlobal('47');
ok(g.length===1 && g[0].c.nro==='FIAS-FAP-2026-001','el buscador de arriba también encuentra la carpeta');
g=w.buscarGlobal('guaman');
ok(g.length===1 && g[0].c.ac==='María Guamán','y busca por AC, sin tilde');
ok(/📄 Abrir/.test(texto(w)) && !!w.document.querySelector('a.signed[href="https://ejemplo.org/contrato-001.pdf"]'),
   'el contrato firmado se abre desde el listado, a un clic');

// ---------------------------------------------------------------- 9
seccion('9 · El enlace de un contrato lleva su número, no su posición');
w=await listo(nuevoDom());
w.go('detalle',1);
ok(w.location.hash==='#/detalle/FIAS-FAP-2026-002','el enlace dice qué contrato es',w.location.hash);
// Al día siguiente el robot rehízo la base y el orden cambió.
w=await listo(nuevoDom(contratos().reverse(),null,{hash:'#/detalle/FIAS-FAP-2026-002'}));
ok(w.eval('ST.view')==='detalle' && w.eval('CONTRACTS[ST.cur].nro')==='FIAS-FAP-2026-002',
   'con la base reordenada, el enlace abre el MISMO contrato',w.eval('ST.cur'));
w=await listo(nuevoDom(null,null,{hash:'#/detalle/3'}));
ok(w.eval('CONTRACTS[ST.cur].nro')==='FIAS-FAP-2026-004','los enlaces viejos por posición siguen sirviendo');
w=await listo(nuevoDom(null,null,{hash:'#/detalle/FIAS-FAP-2026-999'}));
ok(w.eval('ST.view')==='contratos','un número que ya no existe lleva al repositorio, no a otro contrato');

// ---------------------------------------------------------------- 10
seccion('10 · «Volver» regresa a donde estabas');
w=await listo(nuevoDom());
w.go('alertas'); w.go('detalle',0);
let back=w.document.getElementById('back');
ok(/Volver a las alertas/.test(back.textContent),'desde Alertas dice «Volver a las alertas»',back.textContent);
back.onclick();
ok(w.eval('ST.view')==='alertas','y vuelve ahí');
w.go('contratos'); w.go('detalle',0);
ok(/Volver al repositorio/.test(w.document.getElementById('back').textContent),'desde el repositorio, al repositorio');

// ---------------------------------------------------------------- 11
seccion('11 · Entrar con un clic: se recuerda quién entró');
w=await listo(nuevoDom(conTildes(),false,{ls:{fap_clm_ultimo:JSON.stringify({rol:'ac',user:'María Guamán'})}}));
ok(w.document.getElementById('selac').value==='María Guamán','su nombre ya viene elegido');
ok(/Entrar como María Guamán/.test(w.document.getElementById('enter').textContent),'y el botón dice con qué nombre entra');
w.document.getElementById('enter').onclick();
ok(w.eval('SES&&SES.user')==='María Guamán' && w.eval('ST.view')==='panel','entra a su panel');
w=await listo(nuevoDom(conTildes(),false));
w.document.getElementById('selac').value='Ana Pérez';
w.document.getElementById('enter').onclick();
ok(JSON.parse(w.localStorage.getItem('fap_clm_ultimo')).user==='Ana Pérez','al entrar queda recordada para la próxima');
w=await listo(nuevoDom(conTildes(),false,{ls:{fap_clm_ultimo:JSON.stringify({rol:'ac',user:'Alguien que se fue'})}}));
ok(w.document.getElementById('enter').textContent.trim()==='Entrar','si ya no está en la base, no se inventa');
w=await listo(nuevoDom(conTildes(),false,{hash:'#/detalle/FIAS-FAP-2026-002'}));
w.document.getElementById('enter').onclick();
ok(w.eval('ST.view')==='detalle' && w.eval('CONTRACTS[ST.cur].nro')==='FIAS-FAP-2026-002',
   'si llegó por el enlace de un contrato, al entrar se abre ese contrato');

// ---------------------------------------------------------------- 12
seccion('12 · Un clic fuera no bota lo que se escribió');
w=await listo(nuevoDom(null,null,{confirma:false}));
const fondo=o=>o.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
w.modalNota(w.eval('CONTRACTS[0]'));
let o=w.document.querySelector('.overlay');
fondo(o);
ok(!o.isConnected && w._confirmas===0,'sin nada escrito se cierra como antes, sin preguntar');
w.modalNota(w.eval('CONTRACTS[0]'));
o=w.document.querySelector('.overlay');
const nota=o.querySelector('#ntxt'); nota.value='el proveedor avisa retraso';
nota.dispatchEvent(new w.Event('input',{bubbles:true}));
fondo(o);
ok(o.isConnected && w._confirmas===1,'con algo escrito pregunta, y si dice que no, sigue ahí');
w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape'}));
ok(o.isConnected && w._confirmas===2,'Escape pregunta igual');
w._responde=true; fondo(o);
ok(!o.isConnected,'y si confirma, se cierra');

// ---------------------------------------------------------------- 13
seccion('13 · Sin doble generación ni doble envío');
w=await listo(nuevoDom());
let generaciones=0;
w.generarDocx=()=>{ generaciones++; return new Promise(()=>{}); };   // un Word que tarda
w.modalTerminar(w.eval('CONTRACTS[0]'));
o=w.document.querySelector('.overlay');
let gen=o.querySelector('#gen');
gen.onclick(); gen.onclick();
await pausa(20);
ok(generaciones===1,'dos clics en «Terminar y generar acta» generan una sola',generaciones);
ok(gen.disabled && /Generando/.test(gen.textContent),'el botón queda apagado y dice qué pasa',gen.textContent);
o.remove();
let envios=0;
w.fetch=(url)=>{ if(String(url).indexOf('powerautomate')>=0) envios++; return new Promise(()=>{}); };
w.modalEnvioUO(w.eval('CONTRACTS[0]'),{tipoEnvio:'Acta de terminación (FAP-2026-12)',instrumento:'Acta'});
o=w.document.querySelector('.overlay');
Object.defineProperty(o.querySelector('#uoFiles'),'files',{value:[new w.File(['hola'],'acta.docx')]});
const send=o.querySelector('#send');
send.onclick(); send.onclick(); send.onclick();
await pausa(80);
ok(envios===1,'tres clics en «Enviar» mandan un solo envío a la Unidad Operativa',envios);
ok(send.disabled,'y el botón no se puede volver a pulsar mientras sube');
o.remove();
w.fetch=()=>Promise.reject(new Error('sin señal'));
w.modalEnvioUO(w.eval('CONTRACTS[0]'),{tipoEnvio:'Acta',instrumento:'Acta'});
o=w.document.querySelector('.overlay');
Object.defineProperty(o.querySelector('#uoFiles'),'files',{value:[new w.File(['hola'],'acta.docx')]});
o.querySelector('#send').onclick();
await pausa(80);
ok(!o.querySelector('#send').disabled && /vuelve a pulsar Enviar/.test(o.textContent),
   'si falla, el botón vuelve y le dice qué hacer');
o.remove();

// ---------------------------------------------------------------- 14
seccion('14 · Si no se puede guardar, se dice');
w=await listo(nuevoDom());
const setOrig=w.Storage.prototype.setItem;
w.Storage.prototype.setItem=function(){ throw new Error('QuotaExceededError'); };
ok(w.saveCLM()===false,'saveCLM informa el fallo');
ok([...w.document.querySelectorAll('.toast')].some(t=>/no dejó guardar/.test(t.textContent)),'y la AC lo ve en pantalla');
w.Storage.prototype.setItem=setOrig;
ok(w.saveCLM()===true,'cuando vuelve a poder, guarda');

// ---------------------------------------------------------------- 15
seccion('15 · La píldora dice de cuándo es la base');
const hace=d=>new Date(Date.now()-d*86400000).toISOString();
let e=w.edadBase(hace(0));
ok(/^actualizada hoy/.test(e.txt) && !e.vieja,'la del robot de esta mañana: «actualizada hoy»',e.txt);
e=w.edadBase(hace(3));
ok(e.txt==='actualizada hace 3 días' && e.vieja,'la de hace 3 días se marca como vieja',e.txt);
ok(w.edadBase(null)===null && w.edadBase('basura')===null,'sin fecha (copia embebida) no inventa nada');
w.eval("dataSource.edad=edadBase(new Date(Date.now()-3*86400000).toISOString())");
const pill=w.srcPillHTML();
ok(/Base sin actualizar/.test(pill) && /class="srcpill old"/.test(pill),'con la base vieja no dice «viva»: avisa en ámbar');

// ---------------------------------------------------------------- 16
seccion('16 · Una terminación por error se puede deshacer');
w=await listo(nuevoDom());
w.eval("Object.assign(ov(CONTRACTS[0]),{terminado:true,causal:'Mutuo acuerdo',fter:'2026-09-01',pendienteEnvio:{tipoEnvio:'Acta de terminación (FAP-2026-12)'}})");
w.go('detalle',0);
const reabrir=w.document.getElementById('a-reabrir');
ok(!!reabrir,'un contrato terminado en el CLM ofrece reabrirlo');
reabrir.onclick();
ok(w.eval('statusLive(CONTRACTS[0]).key')==='vigente','al reabrirlo vuelve a ejecución');
ok(!w.eval('ov(CONTRACTS[0]).pendienteEnvio'),'y el acta pendiente de envío deja de estar pendiente');
ok(/Terminación deshecha/.test(w.eval('CLM.log[0].txt')),'queda en la bitácora');
w.eval("Object.assign(ov(CONTRACTS[1]),{terminado:true,evaluado:true,score:'90.00',sem:'Confiable'})");
w.go('detalle',1);
ok(!w.document.getElementById('a-reabrir'),'ya calificado el proveedor, no se ofrece');

// ---------------------------------------------------------------- 17
seccion('17 · Palabras de todos los días');
const menu=w.document.querySelector('aside.side').textContent;
ok(/Etapas/.test(menu) && !/Pipeline/.test(menu),'el menú dice «Etapas», no «Pipeline»');
w.go('panel');
ok(/Lo registrado en este navegador/.test(texto(w)),'la actividad no promete ser del equipo: es de este navegador');
const orden=texto(w);
ok(orden.indexOf('Requiere atención')<orden.indexOf('Estado del portafolio'),'lo urgente va antes que los gráficos');

// ---------------------------------------------------------------- 18
seccion('18 · Lo que el CLM ya sabe viaja a La Mágica');
// Contrato 1: vence en 60 días y tuvo adenda (el monto vigente no es el original).
const enSesenta=new Date(Date.now()+60*86400000).toISOString().slice(0,10);
const paraRenovar=contratos();
Object.assign(paraRenovar[0],{fin:enSesenta,montoTotal:1450,adenda:'Sí',area:'Reserva de Producción de Fauna Chimborazo'});
w=await listo(nuevoDom(paraRenovar,{rol:'ac',user:'Ana Pérez'}));
const buzon=()=>JSON.parse(w.localStorage.getItem('fap_precarga')||'null');
const srcMagica=()=>{const f=w.document.getElementById('toolframe');return f?f.getAttribute('src'):'';};

w.go('detalle',0);
let acciones=[...w.document.querySelectorAll('.act .actbtn')].map(b=>b.id);
ok(acciones[0]==='a-ren','por vencer, «Renovar en La Mágica» es la primera acción',acciones.join(','));
w.document.getElementById('a-ren').onclick();
let bz=buzon();
ok(bz && bz.id==='ren:FIAS-FAP-2026-001' && bz.via==='renovacion','al pulsarla deja los datos en el buzón');
ok(bz.datos.contratoNro==='FIAS-FAP-2026-001' && bz.datos.fechaContrato==='2026-01-20'
   && bz.datos.fechaFin===enSesenta && bz.datos.montoTotal===1450,
   'con los nombres del catálogo, y el monto vigente CON la adenda',JSON.stringify(bz.datos));
ok(bz.datos.proveedor==='Servitec' && bz.datos.area==='Reserva de Producción de Fauna Chimborazo','más el proveedor y el área');
ok(w.eval('ST.view')==='magica' && /generador\/index\.html#precarga=ren%3AFIAS-FAP-2026-001$/.test(srcMagica()),
   'y abre La Mágica con solo el número en el enlace',srcMagica());
ok(!/Servitec|1450|Chimborazo/.test(srcMagica()),'ningún dato del contrato viaja en la URL');
ok(/Renovación abierta en La Mágica/.test(w.eval('CLM.log[0].txt')),'queda en la bitácora');
w.go('panel'); w.go('magica');
ok(!/precarga/.test(srcMagica()),'volver a La Mágica por el menú no repite la precarga');

w.go('detalle',1);
acciones=[...w.document.querySelectorAll('.act .actbtn')].map(b=>b.id);
ok(acciones.indexOf('a-ren')>0,'lejos del vencimiento se ofrece igual (campaña 2027), pero no en primer lugar',acciones.join(','));
w.eval("ov(CONTRACTS[2]).terminado=true");
w.go('detalle',2);
ok(!w.document.getElementById('a-ren'),'un contrato terminado no se renueva desde aquí');

w.eval(`CLM.solicitudes.unshift({id:'s77',fecha:'2026-09-22',area:'Parque Nacional Yasuní',objeto:'Mantenimiento de senderos 2027',
  tipoBS:'servicio',monto:4500,plazo:45,garantias:true,estado:'borrador',owner:'Ana Pérez',ac:'Ana Pérez',via:'contrato'})`);
w.go('solicitudes');
let iniciar=w.document.querySelector('[data-mv="magica"][data-id="s77"]');
iniciar.onclick();
bz=buzon();
ok(bz && bz.id==='sol:s77' && bz.via==='solicitud','«Iniciar en La Mágica» deja la solicitud en el buzón');
ok(bz.datos.objeto==='Mantenimiento de senderos 2027' && bz.datos.bienServicio==='Servicio' && bz.datos.presupuesto===4500
   && bz.datos.plazo===45 && bz.datos.area==='Parque Nacional Yasuní' && bz.datos.garantias===true,
   'con objeto, bien/servicio, presupuesto, plazo, área y garantías',JSON.stringify(bz.datos));
ok(/#precarga=sol%3As77$/.test(srcMagica()),'y abre La Mágica con el identificador de la solicitud',srcMagica());
ok(w.eval("CLM.solicitudes.find(s=>s.id==='s77').estado")==='magica','la solicitud pasa a «En La Mágica»');
w.go('solicitudes');
const abrir=w.document.querySelector('[data-abrir="s77"]');
ok(!!abrir,'y desde ahí se puede volver a abrir su expediente');
w.localStorage.removeItem('fap_precarga');
abrir.onclick();
ok(buzon().id==='sol:s77' && /#precarga=sol%3As77$/.test(srcMagica()),'con el mismo identificador: La Mágica abre el que ya existe');

// ---------------------------------------------------------------- 19
seccion('19 · No todo lo que vence se renueva');
{
  // El plan de renovaciones 2027 ya lo dice (plan/PLAN_RENOVACIONES_2027.md,
  // scripts/plan_renovaciones.py, renovaciones/index.html): solo se renueva
  // un servicio recurrente cuyo «tipo de contrato» todavía sea «Nuevo». Una
  // consultoría, una adquisición de equipos o un contrato que ya es una
  // renovación (el FIAS permite renovar una sola vez) van por proceso nuevo,
  // vengan cuando vengan. «Renovar en La Mágica» tiene que respetar la misma
  // regla, no solo mirar si el contrato está por vencer.
  const enDiez=new Date(Date.now()+10*86400000).toISOString().slice(0,10);
  const base19=contratos();
  // Consultoría puntual y vencida — como «Delitos Ambientales y Procesos Sancionatorios».
  Object.assign(base19[0],{cat:'Consultoría',detalle:'Consultoría de delitos ambientales',fin:enDiez,tipo:'Nuevo'});
  // Adquisición de equipos de campo, por vencer.
  Object.assign(base19[1],{cat:'Adquisición de equipos de campo',fin:enDiez,tipo:'Nuevo'});
  // Ya es una renovación (agotó su única vuelta), por vencer.
  Object.assign(base19[2],{tipo:'Renovación',fin:enDiez});
  // Sin el dato de tipo (celda vacía en el Excel), por vencer.
  Object.assign(base19[3],{tipo:'',fin:enDiez});
  const w19=await listo(nuevoDom(base19,{rol:'ac',user:'Ana Pérez'}));
  const textoView=()=>w19.document.getElementById('view').textContent;

  w19.go('detalle',0);
  let btn=w19.document.getElementById('a-ren');
  ok(!!btn&&btn.disabled,'una consultoría por vencer NO ofrece renovar: el botón está apagado');
  ok(/consultoría/.test(textoView()),'y dice que es por ser consultoría',textoView().slice(0,300));
  ok(!btn.onclick,'sin acción: un clic no manda nada a La Mágica');

  w19.go('detalle',1);
  btn=w19.document.getElementById('a-ren');
  ok(btn.disabled&&/adquisición de equipos/.test(textoView()),'una adquisición de equipos tampoco se renueva',textoView().slice(0,300));

  w19.go('detalle',2);
  btn=w19.document.getElementById('a-ren');
  ok(btn.disabled,'un contrato que ya es una renovación no se vuelve a renovar');
  ok(/una sola vez/.test(textoView()),'y explica el límite del FIAS: una sola renovación');

  w19.go('detalle',3);
  btn=w19.document.getElementById('a-ren');
  ok(btn.disabled,'sin el dato de tipo de contrato tampoco se ofrece — no se adivina');
  ok(/Tipo de contrato/.test(textoView()),'y dice qué dato falta y dónde corregirlo',textoView().slice(0,400));

  // Las alertas de vencimiento tampoco pueden prometer una renovación que no aplica.
  w19.go('alertas');
  const filas=[...w19.document.querySelectorAll('.alert-row')].map(r=>r.textContent);
  ok(filas.some(t=>/FIAS-FAP-2026-001/.test(t)&&/no se renueva/.test(t)),
     'la alerta de la consultoría por vencer dice que no se renueva',filas.find(t=>/FIAS-FAP-2026-001/.test(t)));
  ok(!filas.some(t=>/FIAS-FAP-2026-001/.test(t)&&/ventana de renovación abierta/.test(t)),
     'y ya no dice «ventana de renovación abierta»');

  // El caso normal — Nuevo y recurrente — sigue igual que en la sección 18.
  ok(w19.esRenovable(base19[4])===true,'un contrato Nuevo y recurrente sigue siendo renovable',JSON.stringify(base19[4].tipo));
  ok(w19.esRenovable(base19[0])===false&&w19.esRenovable(base19[1])===false&&w19.esRenovable(base19[2])===false,
     'consultoría, adquisición de equipos y ya-renovado quedan fuera de esRenovable()');
}

console.log('\n'+(fallos?`✗ ${fallos} de ${pruebas} comprobaciones fallaron`:`✓ ${pruebas} comprobaciones, todo bien`));
process.exit(fallos?1:0);

})().catch(e=>{ console.error('\nLa prueba se rompió:',e); process.exit(1); });
