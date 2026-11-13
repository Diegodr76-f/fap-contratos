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

// Un año de servicio que termina en `fin`: lo que hace recurrente a un contrato
// (ver esRecurrente() en clm/index.html). Las pruebas que ponen el vencimiento
// relativo a hoy lo usan, para no depender del día en que se corren.
const DIA=86400000;
const isoMas=(iso,dias)=>new Date(Date.parse(iso+'T00:00:00Z')+dias*DIA).toISOString().slice(0,10);
const anual=fin=>({inicio:isoMas(fin,-364),fin});

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
      // El registro de calificaciones: op.registro (una lista) si se da; si no, 404,
      // que es lo que hay mientras el Excel no tenga la hoja. op.registro==='falla'
      // simula la red caída.
      win.fetch=u=>{
        if(/calificaciones_export/.test(String(u))){
          if(op.registro==='falla')return Promise.reject(new Error('sin red'));
          return Promise.resolve(op.registro?{ok:true,status:200,json:()=>Promise.resolve(JSON.parse(JSON.stringify(op.registro)))}
                                            :{ok:false,status:404,json:()=>Promise.reject(new Error('404'))});
        }
        // El flujo de calificaciones: sin red, salvo que una prueba lo sustituya. Así
        // nada de lo que se hace con el modal sale de verdad.
        if(/powerplatform/.test(String(u)))return Promise.reject(new Error('sin red'));
        return Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(datos))});
      };
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
      let hay=0; try{ hay=w.eval('CONTRACTS.length') && w.eval('REG.estado')!=='cargando'; }catch(e){}
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
// el acta ahora pide antes cómo se nombra a cada uno (sección 20)
[['#gAc','F'],['#gProv','E'],['#gJefe','M']].forEach(([id,v])=>{const e=o.querySelector(id);if(e)e.value=v;});
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
Object.assign(paraRenovar[0],{...anual(enSesenta),montoTotal:1450,adenda:'Sí',area:'Reserva de Producción de Fauna Chimborazo'});
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
  Object.assign(base19[0],{cat:'Consultoría',detalle:'Consultoría de delitos ambientales',...anual(enDiez),tipo:'Nuevo'});
  // Adquisición de equipos de campo, por vencer.
  Object.assign(base19[1],{cat:'Adquisición de equipos de campo',...anual(enDiez),tipo:'Nuevo'});
  // Ya es una renovación (agotó su única vuelta), por vencer.
  Object.assign(base19[2],{tipo:'Renovación',...anual(enDiez)});
  // Sin el dato de tipo (celda vacía en el Excel), por vencer.
  Object.assign(base19[3],{tipo:'',...anual(enDiez)});
  const w19=await listo(nuevoDom(base19,{rol:'ac',user:'Ana Pérez'}));
  const textoView=()=>w19.document.getElementById('view').textContent;

  w19.go('detalle',0);
  let btn=w19.document.getElementById('a-ren');
  ok(!!btn&&btn.disabled,'una consultoría por vencer NO ofrece renovar: el botón está apagado');
  ok(/consultoría/.test(textoView()),'y dice que es por ser consultoría',textoView().slice(0,300));
  ok(!btn.onclick,'sin acción: un clic no manda nada a La Mágica');

  w19.go('detalle',1);
  btn=w19.document.getElementById('a-ren');
  ok(btn.disabled&&/una adquisición/.test(textoView()),'una adquisición de equipos tampoco se renueva',textoView().slice(0,300));

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

  // Qué es recurrente lo dicen las FECHAS, no una lista de categorías. El caso que
  // lo obligó: «Servicios logísticos» —el hospedaje de un taller de tres días—,
  // firmado como Nuevo, salía renovable y en primer lugar porque nadie había
  // excluido esa categoría.
  const base19b=contratos();
  Object.assign(base19b[0],{cat:'Servicios logísticos',detalle:'Hospedaje, alimentación y uso de instalaciones para el taller',
    inicio:isoMas(enDiez,-2),fin:enDiez,tipo:'Nuevo',plazo:3});
  // Un mantenimiento correctivo de 30 días: va por orden, es puntual.
  Object.assign(base19b[1],{cat:'Mantenimiento infraestructura',inicio:isoMas(enDiez,-29),fin:enDiez,tipo:'Nuevo'});
  // Una categoría que nadie ha clasificado, con un año de servicio: es recurrente.
  Object.assign(base19b[2],{cat:'Una categoría que todavía no existe',...anual(enDiez),tipo:'Nuevo'});
  // Un taller de tres días en DICIEMBRE: termina con el año y aun así es puntual.
  Object.assign(base19b[3],{cat:'Servicios logísticos',inicio:'2026-12-02',fin:'2026-12-04',tipo:'Nuevo'});
  const w19b=await listo(nuevoDom(base19b,{rol:'ac',user:'Ana Pérez'}));
  const tv=()=>w19b.document.getElementById('view').textContent;
  w19b.go('detalle',0);
  btn=w19b.document.getElementById('a-ren');
  ok(btn.disabled && !btn.onclick,'un servicio logístico de tres días NO ofrece renovar');
  ok(/Dura 3 días: es un servicio puntual/.test(tv()),'y dice por qué, con lo que dura',tv().slice(0,400));
  ok(!w19b.document.getElementById('a-nue'),'ni un proceso nuevo: un taller no continúa');
  ok(w19b.esRecurrente(base19b[1])===false,'treinta días o menos es puntual (va por orden)');
  w19b.go('detalle',2);
  ok(!w19b.document.getElementById('a-ren').disabled,'una categoría nueva con un año de servicio se renueva: decide la fecha, no el nombre');
  ok(w19b.esRecurrente(base19b[3])===false,'tres días en diciembre siguen siendo puntuales, aunque terminen con el año');
  const caso=(inicio,fin,cat)=>w19b.esRecurrente({inicio,fin,cat:cat||'Mantenimiento'});
  ok(caso('2026-01-01','2026-12-31') && caso('2026-02-01','2027-01-31'),'de enero a diciembre, o de febrero a enero: recurrente');
  ok(caso('2026-06-16','2026-12-31'),'un internet que empezó en junio y cierra con el año también lo es');
  ok(caso('2026-04-01','2027-03-31'),'y uno de abril a marzo, que dura un año entero');
  ok(!caso('2026-03-01','2026-05-31'),'un arriendo de tres meses que termina en mayo, no');
  ok(!caso('2026-08-28','2027-01-25','Consultoría'),'una consultoría que termina en enero no: es un producto que se entrega (FIAS-FAP-2026-165)');
  ok(!caso(null,'2026-12-31') && /Faltan las fechas/.test(w19b.motivoNoRenovable({cat:'Mantenimiento',tipo:'Nuevo',fin:'2026-12-31'})),
     'sin fecha de inicio ni de firma no se adivina, y se dice qué falta');
  w19b.go('alertas');
  const filaTaller=[...w19b.document.querySelectorAll('.alert-row')].map(r=>r.textContent).find(t=>/FIAS-FAP-2026-001/.test(t))||'';
  ok(/servicio puntual/.test(filaTaller) && !/renovación|proceso nuevo/.test(filaTaller),
     'su alerta de vencimiento no habla de renovar ni de proceso nuevo',filaTaller);

  // La misma regla en los tres sitios donde vive: se prueban las tres con los mismos casos.
  const casos=[['2026-01-01','2026-12-31','Mantenimiento'],['2026-06-16','2026-12-31','Internet'],['2026-04-01','2027-03-31','Internet'],
    ['2026-03-01','2026-05-31','Arrendamiento'],['2026-12-02','2026-12-04','Servicios logísticos'],['2026-12-01','2026-12-31','Combustible'],
    ['2026-08-28','2027-01-25','Consultoría'],['2026-08-03','2027-01-15','Adquisición de equipos de campo'],['2026-10-08','2027-01-31','Combustible']];
  const enCLM=casos.map(([i,f,c])=>w19b.esRecurrente({inicio:i,fin:f,cat:c}));
  const REN=fs.readFileSync(path.join(RAIZ,'renovaciones','index.html'),'utf8');
  const fuenteRen=REN.slice(REN.indexOf('var DIAS_PUNTUAL'),REN.indexOf('function esRenovable'));
  const esRecRen=new Function(fuenteRen+';return esRecurrente;')();
  const enRen=casos.map(([i,f,c])=>esRecRen({inicio:i,fin:f,cat:c}));
  const py=require('child_process').execFileSync('python3',['-c',
    'import sys,json,datetime;sys.path.insert(0,"scripts");from plan_renovaciones import es_recurrente as e;d=datetime.date.fromisoformat;'
    +'print(json.dumps([e(c,d(i),d(f)) for i,f,c in json.loads(sys.argv[1])]))',JSON.stringify(casos)],{cwd:RAIZ}).toString();
  const enPlan=JSON.parse(py);
  ok(JSON.stringify(enCLM)===JSON.stringify(enRen) && JSON.stringify(enCLM)===JSON.stringify(enPlan),
     'el CLM, la consulta de renovaciones y el plan clasifican igual los mismos casos',[enCLM,enRen,enPlan].map(x=>x.map(Number).join('')).join(' · '));
  ok(!/RECURRENTES\s*=\s*\[|NO_RECURRENTES/.test(HTML+REN+fs.readFileSync(path.join(RAIZ,'scripts','plan_renovaciones.py'),'utf8')),
     'y ninguno conserva una lista de categorías');

  // El caso normal — Nuevo y recurrente — sigue igual que en la sección 18.
  ok(w19.esRenovable(base19[4])===true,'un contrato Nuevo y recurrente sigue siendo renovable',JSON.stringify(base19[4].tipo));
  ok(w19.esRenovable(base19[0])===false&&w19.esRenovable(base19[1])===false&&w19.esRenovable(base19[2])===false,
     'consultoría, adquisición de equipos y ya-renovado quedan fuera de esRenovable()');
}

// ---------------------------------------------------------------- 20
seccion('20 · La adenda y el acta salen sin «el/la» ni «undefined»');
{
  // Se rellenan las plantillas REALES (crm/plantillas/) con el motor que usa el
  // navegador (clm/vendor/), pasando por los formularios del CLM, y se lee el
  // Word que sale. Hasta septiembre llevaban 20 cuadros combinados que imprimían
  // «Administrador/a contador/a» si la AC no los tocaba, y la adenda decía «la
  // administración undefined Reserva…» porque nadie le entregaba {dellaAP}.
  const leer=f=>fs.readFileSync(path.join(RAIZ,f));
  const base20=contratos();
  Object.assign(base20[0],{proveedor:'Servitec',area:'Reserva de Producción de Fauna Chimborazo',ac:'Ana Pérez'});
  Object.assign(base20[1],{proveedor:'María Lema',area:'Parque Nacional Cotopaxi',ac:'Ana Pérez'});
  const w20=await listo(nuevoDom(base20,{rol:'ac',user:'Ana Pérez'}));
  w20.eval(leer('clm/vendor/pizzip.min.js').toString());
  w20.eval(leer('clm/vendor/docxtemplater.min.js').toString());
  w20.fetch=url=>{
    const m=String(url).match(/plantillas\/(.+)$/);
    if(!m)return Promise.reject(new Error('no esperado: '+url));
    const b=leer('crm/plantillas/'+decodeURIComponent(m[1]));
    return Promise.resolve({ok:true,arrayBuffer:()=>Promise.resolve(new w20.Uint8Array(b).buffer)});
  };
  const salidas=[],avisos=[];
  w20.URL.createObjectURL=blob=>{salidas.push(blob);return 'blob:prueba';};
  w20.URL.revokeObjectURL=()=>{};
  w20.alert=m=>avisos.push(m);
  w20.HTMLAnchorElement.prototype.click=function(){};   // la descarga: jsdom no navega
  // El texto del Word, párrafo por párrafo.
  const textoWord=async blob=>{
    const zip=new w20.PizZip(await blob.arrayBuffer());
    return zip.file('word/document.xml').asText().split('</w:p>')
      .map(p=>(p.match(/<w:t[^>]*>[^<]*<\/w:t>/g)||[]).map(t=>t.replace(/<[^>]+>/g,'')).join(''))
      .filter(t=>t.trim()).join('\n');
  };
  // Lo que no puede salir en un documento que se firma.
  const huecos=t=>{
    const r=[];
    if(/undefined/.test(t))r.push('undefined');
    const barras=t.match(/\b[A-Za-zÁÉÍÓÚáéíóúñ]+\/(a|la|as)\b/g); if(barras)r.push(barras.join(','));
    if(/\{[A-Za-z]+\}/.test(t))r.push('etiqueta sin rellenar');
    if(/COMPLETAR: dato/.test(t))r.push('etiqueta sin dato: '+(t.match(/COMPLETAR: dato «[^»]+»/g)||[]).join(','));
    return r;
  };
  const elegir=(o,id,v)=>{const s=o.querySelector('#'+id);s.value=v;s.dispatchEvent(new w20.Event('change',{bubbles:true}));};

  // --- Informe de adenda
  w20.modalModificar(w20.eval('CONTRACTS[0]'));
  let o=w20.document.querySelector('.overlay');
  o.querySelector('#inc').value='300'; o.querySelector('#inc').dispatchEvent(new w20.Event('input'));
  ok(o.querySelector('#gAc').value===''&&o.querySelector('#gProv').value==='',
     'la primera vez no se adivina: ni la AC ni una persona natural traen género puesto');
  await o.querySelector('#gen').onclick(); await pausa(30);
  ok(salidas.length===0&&/Falta elegir: La AC firma como · El proveedor es/.test(avisos.pop()||''),
     'sin elegirlos no se genera, y dice QUÉ falta');
  elegir(o,'gAc','F'); elegir(o,'gProv','E');
  await o.querySelector('#gen').onclick(); await pausa(60);
  ok(salidas.length===1,'con los dos elegidos, el informe se genera',avisos.join(' | '));
  let t=await textoWord(salidas[0]);
  ok(huecos(t).length===0,'el informe no trae barras, huecos ni «undefined»',huecos(t).join(' · '));
  ok(/la administración de la Reserva de Producción de Fauna Chimborazo/.test(t),
     '«de la Reserva»: el género del área sale de su nombre, sin preguntar');
  ok(/el FIAS y la empresa Servitec, suscribieron/.test(t),'«la empresa Servitec», no «el señor/señora/empresa»');
  ok(/y la empresa Servitec, para el/.test(t),'y ya no dice «y por el Sr.» a una empresa');
  ok(/prestados por la empresa Servitec, con RUC/.test(t)&&!/"\.la empresa/.test(t),
     'el cuadro que estaba arrastrado al final del párrafo vuelve delante del nombre');
  ok(/Administradora Contadora/.test(t),'y firma la «Administradora Contadora», como en La Mágica');
  o.remove();

  // Lo elegido se recuerda: la próxima vez ya aparece.
  w20.modalModificar(w20.eval('CONTRACTS[0]'));
  o=w20.document.querySelector('.overlay');
  ok(o.querySelector('#gAc').value==='F'&&o.querySelector('#gProv').value==='E','la segunda vez ya viene elegido');
  o.remove();

  // --- Acta de terminación: otra área, otro proveedor, jefa de área
  w20.modalTerminar(w20.eval('CONTRACTS[1]'));
  o=w20.document.querySelector('.overlay');
  ok(o.querySelector('#gAc').value==='F','la AC ya no se vuelve a preguntar: se recuerda en el acta también');
  o.querySelector('#jefe').value='Luisa Paca';
  await o.querySelector('#gen').onclick(); await pausa(30);
  ok(salidas.length===1&&/El proveedor es · Quien administra el área por el MAE es/.test(avisos.pop()||''),
     'el acta tampoco sale sin el género del proveedor y de quien administra el área');
  elegir(o,'gProv','F'); elegir(o,'gJefe','F');
  await o.querySelector('#gen').onclick(); await pausa(60);
  ok(salidas.length===2,'con todo elegido, el acta se genera',avisos.join(' | '));
  t=await textoWord(salidas[1]);
  ok(huecos(t).length===0,'el acta no trae barras, huecos ni «undefined»',huecos(t).join(' · '));
  ok(/en calidad de administradora contadora, con cédula/.test(t),'«en calidad de administradora contadora»');
  ok(/Luisa Paca, en calidad de administradora del Parque Nacional Cotopaxi/.test(t),'«administradora del Parque»: jefa, y el área en masculino');
  ok(/del FIAS y de la administradora del área protegida/.test(t),'«de la administradora del área», no «del Administrador/a»');
  ok(/La CONTRATISTA ejecutó/.test(t)&&/por parte de la CONTRATISTA/.test(t)&&/certifica que la CONTRATISTA/.test(t),
     '«la CONTRATISTA» en las cuatro apariciones, también la que estaba escrita a mano');
  ok(/aprobación por la administradora del área protegida y\/o por la administradora del contrato\./.test(t),
     'y se corrige «aprobación por del administrador»');
  ok(/\nProveedora(\n|$)/.test(t),'bajo la firma del proveedor: «Proveedora»');
  o.remove();
  // El nombre de quien administra el área se recuerda por área, con su género.
  w20.modalTerminar(w20.eval('CONTRACTS[1]'));
  o=w20.document.querySelector('.overlay');
  ok(o.querySelector('#jefe').value==='Luisa Paca'&&o.querySelector('#gJefe').value==='F','el nombre y el género de la jefa del área ya vienen puestos');
  o.remove();

  // --- Lo que se propone y lo que no
  ok(w20.pareceEmpresa('Limpiezas Andinas Cía. Ltda.')&&w20.pareceEmpresa('Servitec S.A.')&&!w20.pareceEmpresa('María Lema')&&!w20.pareceEmpresa('Luisa Sánchez'),
     'una empresa se reconoce por su forma jurídica; un nombre de persona no');
  ok(['Reserva Biológica El Cóndor','Área Nacional de Recreación Isla Santay','Dirección de Áreas Protegidas y Otras Formas de Conservación'].every(a=>w20.generoAreaDe(a)==='F')
     &&['Parque Nacional Cotopaxi','Refugio de Vida Silvestre Pasochoa'].every(a=>w20.generoAreaDe(a)==='M'),
     'el género del área: la Reserva, el Área, la Dirección; el Parque, el Refugio');

  // --- Una etiqueta sin dato ya no imprime «undefined»
  salidas.length=0;
  await w20.generarDocx('14_Informe_adenda.docx',{},'prueba'); await pausa(30);
  t=await textoWord(salidas[0]);
  ok(!/undefined/.test(t)&&/«COMPLETAR: dato «dellaAP»»/.test(t),'lo que falte sale «COMPLETAR», visible, y no «undefined»');

  // --- Los valores son los de scripts/concordancia.py: una sola fuente
  const py=fs.readFileSync(path.join(RAIZ,'scripts','concordancia.py'),'utf8');
  const grupo=(nombre)=>{const m=py.match(new RegExp("'"+nombre+"':\\s*\\{[\\s\\S]*?'tags':\\s*\\{([\\s\\S]*?)\\}\\}"));
    const tags={};(m?m[1]:'').replace(/'(\w+)':\s*\[([^\]]*)\]/g,(_,k,v)=>{tags[k]=v.match(/'([^']*)'/g).map(x=>x.slice(1,-1));});return tags;};
  const ejes={generoAC:['ac',['M','F']],generoJefeAP:['jefe',['M','F']],generoContratista:['prov',['M','F','E']],
    generoAP:['area',['M','F']],generoProveedor:['prov',['M','F','E']]};
  const distintos=[];
  for(const [g,[eje,vals]] of Object.entries(ejes)){
    const tags=grupo(g);
    vals.forEach((v,i)=>{
      const d=w20.concordanciasDoc(Object.assign({ac:'M',jefe:'M',prov:'M',area:'M'},{[eje]:v}));
      for(const k of Object.keys(tags))if(k in d&&d[k]!==tags[k][i])distintos.push(`${k}[${v}]: ${d[k]} ≠ ${tags[k][i]}`);
    });
  }
  ok(distintos.length===0,'cada valor coincide con el de concordancia.py',distintos.join(' | '));
}

// ---------------------------------------------------------------- 21
seccion('21 · La lista: «Abrir» nunca queda fuera de vista');
{
  // La tabla llegó a tener nueve columnas y, en una pantalla normal, «Contrato»
  // —donde está «Abrir»— quedaba más allá del borde, con la barra para
  // desplazarse al pie de una lista de 139 filas. jsdom no calcula anchos: aquí se
  // comprueba la estructura que lo evita; el ancho real se miró en Chromium.
  const l=conTildes();
  l[1].fin='2020-01-01';                                          // vencido
  l[2].cerrado=true; l[2].fcierre='2026-03-01'; l[2].liquidado=1000; l[2].saldo=150;
  const w21=await listo(nuevoDom(l));
  w21.go('contratos');
  const doc=w21.document;
  const cab=()=>[...doc.querySelectorAll('table.list thead th')].map(t=>t.textContent.trim());
  const fila=nro=>doc.querySelector(`table.list tbody tr[data-open="${w21.eval(`CONTRACTS.findIndex(c=>c.nro==='${nro}')`)}"]`);
  ok(cab().join('|')==='N.º|Objeto|Área|Proveedor|Monto|Estado|Contrato','siete columnas: categoría y vencimiento viven dentro de otras',cab().join('|'));
  const ths=[...doc.querySelectorAll('table.list thead th')], filas=[...doc.querySelectorAll('table.list tbody tr')];
  ok(ths[ths.length-1].classList.contains('td-sig') && filas.every(r=>r.lastElementChild.classList.contains('td-sig')),
     '«Contrato» es la última columna y es la que se queda fija');
  ok(/table\.list \.td-sig\{position:sticky;right:0/.test(HTML),'y la regla que la fija a la derecha está en el CSS');
  const f1=fila('FIAS-FAP-2026-001');
  ok(!!f1.querySelector('.td-sig a.signed[href="https://ejemplo.org/contrato-001.pdf"]'),'«Abrir» está en esa columna');
  ok(f1.querySelector('.td-obj .catchip').textContent==='Mantenimiento' && doc.querySelectorAll('table.list tbody .catchip').length===filas.length,
     'la categoría va bajo el objeto, una por fila');
  const f3=fila('FIAS-FAP-2026-003');
  ok(f3.querySelector('.td-area').textContent==='Reserva Biológica El Cóndor' && f3.querySelector('.td-obj .oa').textContent==='Reserva Biológica El Cóndor',
     'el área está en su columna y, para pantallas angostas, también bajo el objeto');
  ok(/@media\(max-width:1280px\)\{table\.list \.td-area\{display:none\}\.td-obj \.oa\{display:block\}\}/.test(HTML),
     'y la regla que cambia una por otra está en el CSS');
  const e=nro=>fila(nro).querySelector('.td-est');
  ok(/días restantes/.test(e('FIAS-FAP-2026-001').textContent) && !/~/.test(e('FIAS-FAP-2026-001').textContent)
     && e('FIAS-FAP-2026-001').querySelector('.sub').textContent==='Vence 31 dic 2030',
     'el estado va corto («93 días restantes») y la fecha de fin debajo',e('FIAS-FAP-2026-001').textContent);
  ok(/Vencido hace/.test(e('FIAS-FAP-2026-002').textContent) && e('FIAS-FAP-2026-002').querySelector('.sub').textContent==='Venció 1 ene 2020',
     'un vencido dice «Venció»',e('FIAS-FAP-2026-002').textContent);
  ok(/Contrato cerrado/.test(e('FIAS-FAP-2026-003').textContent) && e('FIAS-FAP-2026-003').querySelector('.sub').textContent==='Fin 31 dic 2030',
     'un cerrado dice «Fin»',e('FIAS-FAP-2026-003').textContent);
  ok(/~\d+ meses/.test(w21.vigenciaText(w21.eval('CONTRACTS[0]'))) && !/~/.test(w21.vigenciaText(w21.eval('CONTRACTS[0]'),true)),
     'el texto largo («· ~N meses») sigue existiendo para el detalle y las tarjetas');

  w21.eval("ST.filter='ter'"); w21.go('contratos');
  ok(cab().join('|')==='N.º|Objeto|Área|Proveedor|Monto|Liquidado|Cierre|Estado|Contrato' && doc.querySelector('table.list').classList.contains('ter'),
     '«Terminados» trae liquidado y cierre, y sigue terminando en «Contrato»',cab().join('|'));
  ok(!doc.querySelector('table.list .td-est .sub') && !!doc.querySelector('table.list .td-sig'),
     'sin repetir la fecha de fin, que ahí es la de cierre');
  ok(/@media\(max-width:1460px\)\{table\.list\.ter \.td-area\{display:none\}/.test(HTML),
     'y el área baja antes, porque hay dos columnas más');
  ok(/\.navitem\{all:unset;box-sizing:border-box/.test(HTML),
     'la barra lateral no se pasa de ancho: «all:unset» deja la caja en content-box');
}

// ---------------------------------------------------------------- 22
seccion('22 · El pool de proveedores');
{
  // La alerta «Proveedor sin calificar» se pedía para todo lo terminado, de
  // cualquier año, y a la Unidad Operativa le llegaba una por contrato del
  // portafolio entero. Y no había dónde ver a un proveedor como tal.
  const pool=()=>{
    const l=contratos();
    l[0].proveedor='Servitec S.A.';                                    // vivo, de Ana
    Object.assign(l[1],{proveedor:'SERVITEC SA',cerrado:true,fcierre:'2026-03-10'});        // debe calificación
    Object.assign(l[2],{proveedor:'servitec s. a.',cerrado:true,fcierre:'2025-11-30'});     // de 2025: no alerta
    Object.assign(l[3],{proveedor:'Servitel',cerrado:true,fcierre:'2026-05-01',ac:'María Guamán',area:'Parque Nacional Yasuní'});
    Object.assign(l[4],{proveedor:'Limpiezas Andinas Cía. Ltda.',cat:'Limpieza',monto:9000,montoTotal:9000});
    return l;
  };
  let w22=await listo(nuevoDom(pool()));
  const cp=n=>w22.claveProv(n);
  ok(cp('Servitec S.A.')===cp('SERVITEC SA') && cp('SERVITEC SA')===cp('servitec s. a.') && cp('Servitec')===cp('Servitec S.A.'),
     'mayúsculas, puntos y «S.A.» no separan a un proveedor',[cp('Servitec S.A.'),cp('SERVITEC SA'),cp('servitec s. a.')].join('|'));
  ok(cp('Limpiezas Andinas Cía. Ltda.')===cp('LIMPIEZAS ANDINAS CIA LTDA') && cp('Construcciones S.A.S.')===cp('construcciones'),
     'tampoco «Cía. Ltda.» ni «S.A.S.», con o sin tilde');
  ok(cp('Servitel')!==cp('Servitec') && cp('Andina Sanitaria')!==cp('Andina'),
     'pero dos nombres distintos siguen siendo dos: no se une por parecido');

  const provs=w22.proveedores(), serv=provs.find(p=>p.clave==='servitec');
  ok(provs.length===3,'tres proveedores en el portafolio',provs.map(p=>p.nombre).join(' | '));
  ok(serv && serv.contratos.length===3 && serv.activos===1 && serv.variantes.length===3,
     'Servitec junta sus tres contratos y recuerda las tres escrituras',serv&&JSON.stringify(serv.variantes));
  ok(serv.porCalificar===1,'y debe una sola calificación: la de 2025 no se pide',serv.porCalificar);

  let al=w22.alertList(), cal=al.filter(a=>/sin calificar/.test(a.t));
  ok(cal.length===1 && cal[0].fn==='pcal' && /^2 contratos de 2026/.test(cal[0].t),
     'la Unidad Operativa recibe UNA alerta agregada, no una por contrato',cal.map(a=>a.t).join(' | '));
  ok(!al.some(a=>/Proveedor sin calificar — /.test(a.t)),'y ninguna suelta');
  w22.go('panel');
  w22.document.querySelector('.alert-row .go[data-fn="pcal"]').onclick();
  ok(w22.eval('ST.view')==='proveedores' && w22.eval('ST.provFiltro')==='pend','su botón abre el pool filtrado en «Por calificar»');
  ok(w22.document.querySelectorAll('table.list.prov tbody tr').length===2,'donde están los dos proveedores que deben calificación');
  ok(/Proveedores/.test(w22.document.querySelector('aside.side').textContent) && w22.document.querySelector('.navitem.on').dataset.go==='proveedores',
     'Proveedores está en el menú, y marcado');

  // La administradora: una por contrato, solo los suyos y solo de 2026.
  w22=await listo(nuevoDom(pool(),{rol:'ac',user:'Ana Pérez'}));
  al=w22.alertList().filter(a=>/sin calificar/.test(a.t));
  ok(al.length===1 && al[0].t==='Proveedor sin calificar — FIAS-FAP-2026-002' && al[0].fn==='cal',
     'la AC recibe la de su contrato de 2026, y no la de 2025',al.map(a=>a.t).join(' | '));
  w22.go('detalle',2);
  ok(/Terminó antes del 1 ene 2026/.test(texto(w22)) && !w22.document.getElementById('a-cal').disabled,
     'el de 2025 dice por qué no se exige, y deja calificarlo igual');

  // Calificar desde el propio modal: 0 en todo da 0/100, «No recomendado».
  w22.go('detalle',1);
  w22.document.getElementById('a-cal').onclick();
  let m=w22.document.querySelector('.overlay');
  m.querySelectorAll('.scorebtn[data-v="0"]').forEach(b=>b.onclick());
  m.querySelector('#rev').onclick();
  m.querySelector('#conf').onclick(); await pausa(30);
  w22.document.querySelector('#okpasos').onclick();
  const q=w22.calificacionDe(w22.eval('CONTRACTS[1]'));
  ok(q && q.score===0 && !q.elegible && q.fecha===w22.todayISO() && q.aportes.length===4,
     'la calificación queda con su fecha y sus cuatro aportes',JSON.stringify(q));
  ok(!w22.alertList().some(a=>/sin calificar/.test(a.t)),'y su alerta se apaga');
  ok(w22.proveedores().find(p=>p.clave==='servitec').porCalificar===0,'también el contador del pool');

  // El proveedor quedó no elegible: se ve en su otro contrato, el vivo.
  w22.go('detalle',0);
  const av=w22.document.querySelector('.provaviso');
  ok(av && av.classList.contains('r') && /Proveedor no elegible/.test(av.textContent) && /FIAS-FAP-2026-002/.test(av.textContent),
     'el detalle de su contrato vivo lo avisa en rojo, diciendo de dónde sale la nota',av&&av.textContent.replace(/\s+/g,' '));
  ok(/este navegador/.test(av.textContent),'y que solo cuenta lo calificado en este navegador');
  w22._responde=false; const antes=w22._confirmas;
  w22.document.getElementById('a-ren').onclick();
  ok(w22._confirmas===antes+1 && w22.eval('ST.view')==='detalle' && !w22.localStorage.getItem('fap_precarga'),
     'renovarlo pide confirmación, y si la AC dice que no, no se abre nada');
  w22._responde=true;
  w22.document.getElementById('a-ren').onclick();
  ok(w22.eval('ST.view')==='magica' && JSON.parse(w22.localStorage.getItem('fap_precarga')).id==='ren:FIAS-FAP-2026-001',
     'si dice que sí, sigue: la decisión es suya');

  // «Observado» (70 a 79,99) avisa en ámbar.
  w22.eval("Object.assign(ov(CONTRACTS[1]),{score:'75.00',sem:'Aceptable – Observado'})");
  w22.go('detalle',0);
  ok(w22.document.querySelector('.provaviso.a'),'un proveedor observado se avisa en ámbar');
  w22.eval("Object.assign(ov(CONTRACTS[1]),{score:'85.00',sem:'Satisfactorio'})");
  w22.go('detalle',0);
  ok(!w22.document.querySelector('.provaviso'),'y uno satisfactorio no lleva cartel');

  // Los cortes son los del formulario FO-AD-ABC-017, una sola tabla.
  const T=s=>w22.tierCalificacion(s);
  ok(T(90).sem==='Confiable (Preferente)' && T(89.99).sem==='Satisfactorio' && T(80).elegible && T(79.99).observado
     && T(70).elegible && !T(69.99).elegible && T(60).sem==='Deficiente – Inaceptable' && T(59.99).sem==='No recomendado',
     'los cortes 90 / 80 / 70 / 60 no cambiaron');
  ok(!/function tier\(s\)\{/.test(HTML),'y el modal ya no lleva su propia copia de la tabla');

  // La ficha, su enlace y el buscador.
  w22.abrirProv('servitec');
  ok(w22.location.hash==='#/proveedor/servitec' && w22.eval('ST.view')==='proveedor','la ficha tiene su propio enlace',w22.location.hash);
  ok(/Servitec S\.A\./.test(texto(w22)) && /También escrito en el Excel como/.test(texto(w22)) && w22.document.querySelectorAll('#view tr[data-open]').length===3,
     'con su nombre, las otras escrituras y sus tres contratos');
  ok(/85,00 · Satisfactorio/.test(texto(w22)) && w22.document.querySelectorAll('.histcal').length>=5,
     'su calificación, el promedio por indicador y la historia');
  let w22b=await listo(nuevoDom(pool(),{rol:'ac',user:'Ana Pérez'},{hash:'#/proveedor/servitec'}));
  ok(w22b.eval('ST.view')==='proveedor' && /Servitec/.test(texto(w22b)),'un enlace a la ficha abre la ficha');
  w22b=await listo(nuevoDom(pool(),{rol:'ac',user:'Ana Pérez'},{hash:'#/proveedor/nadie'}));
  ok(w22b.eval('ST.view')==='proveedores','un proveedor que no está devuelve al listado',w22b.eval('ST.view'));
  ok(w22.buscarProv('servitec').length===1 && w22.buscarProv('limpiezas cia').length===1,'el buscador de arriba encuentra proveedores');
  w22.abrirProv('servitel');
  ok(!w22.document.querySelector('#view [data-cal]') && /pendiente/.test(w22.document.querySelector('#view tr[data-open] td:last-child').textContent),
     'en la ficha, el contrato de otra AC dice «pendiente» sin ofrecer «Calificar»: lo califica su AC');
  ok(/1 contrato · 0 tuyos/.test(texto(w22)),'y el contador separa lo que le toca a ella',texto(w22).match(/Por calificar[^A-Z]*/)&&texto(w22).match(/Por calificar[^A-Z]*/)[0]);
  {
    // El nombre sale del portafolio entero: la AC que escribió «Radio Andes» una
    // vez ve el mismo nombre que la Unidad Operativa y que la ficha.
    const l=contratos().slice(0,3);
    l[0].proveedor='Radio Andes';
    Object.assign(l[1],{proveedor:'RADIO ANDES S.A.',ac:'María Guamán'});
    Object.assign(l[2],{proveedor:'RADIO ANDES S.A.',ac:'María Guamán'});
    const wn=await listo(nuevoDom(l,{rol:'ac',user:'Ana Pérez'}));
    const lista=wn.proveedores();
    ok(lista.length===1 && lista[0].nombre==='RADIO ANDES S.A.' && wn.fichaProv('radio andes').nombre==='RADIO ANDES S.A.',
       'el proveedor se llama igual en la lista de cada AC y en su ficha: la escritura más repetida',lista.map(p=>p.nombre).join('|'));
    ok(lista[0].contratos.length===1,'aunque la lista de la AC cuente solo su contrato');
  }

  // Lo que se midió en Chromium (jsdom no tiene anchos): la tabla de la ficha va
  // en dos columnas, porque con cinco «Calificar» quedaba fuera de vista a 1280
  // px, y los hijos del grid pueden encoger, porque si no la ficha empujaba la
  // página a 761 px en un celular de 375.
  w22.abrirProv('servitec');
  ok([...w22.document.querySelectorAll('table.fp-tab thead th')].map(t=>t.textContent).join('|')==='Contrato|Calificación',
     'la tabla de la ficha tiene dos columnas: contrato y calificación');
  ok(/\.detail>\*\{min-width:0\}/.test(HTML) && /\.dl>div\{min-width:0\}/.test(HTML),
     'y el CSS deja encoger las columnas del detalle y de la ficha');

  // El listado: columnas, filtros y búsqueda sin tildes.
  w22.eval("ST.provFiltro='all';ST.provQ='';ST.viewMode='table'");
  w22.go('proveedores');
  const cab=[...w22.document.querySelectorAll('table.list.prov thead th')].map(t=>t.textContent.trim()).join('|');
  ok(cab==='Proveedor|Contratos|Monto contratado|Áreas|Última calificación|Por calificar','seis columnas',cab);
  ok(w22.document.querySelector('table.list.prov tbody tr').dataset.prov==='limpiezas andinas','por omisión, el de mayor monto primero');
  w22.eval("ST.provQ='limpieza cia'"); w22.go('proveedores');
  ok(w22.document.querySelectorAll('table.list.prov tbody tr').length===1,'la búsqueda perdona tildes y puntos');
  w22.eval("ST.provQ='';ST.provFiltro='noeleg'"); w22.go('proveedores');
  ok(/Ningún proveedor con ese filtro/.test(texto(w22)) && w22.document.getElementById('limpiarProv'),
     'un filtro vacío dice por qué y ofrece salir');
}

// ---------------------------------------------------------------- 23
seccion('23 · El Registro de Calificaciones compartido');
{
  // La calificación vivía solo en el navegador donde se hizo: en otra computadora
  // el contrato seguía «sin calificar» y la alerta no se apagaba nunca. Ahora el
  // robot publica la hoja «Registro de Calificaciones» del Excel maestro y el CLM
  // la mira primero.
  const port=()=>{
    const l=contratos();
    Object.assign(l[1],{cerrado:true,fcierre:'2026-03-10'});                        // calificado en el Registro
    Object.assign(l[2],{cerrado:true,fcierre:'2026-04-10'});                        // calificado solo aquí
    Object.assign(l[3],{cerrado:true,fcierre:'2026-05-01'});                        // pendiente
    return l;
  };
  const registro=[
    {nro:'FIAS-FAP-2026-002',score:88,fecha:'2026-06-01',aportes:[36,26,4,22]},
    {nro:'FIAS-FAP-2026-002',score:62,fecha:'2026-10-20',aportes:[25,20,2,15],obs:'Retrasos'},   // la más nueva manda
    {nro:'',score:50},{nro:'FIAS-FAP-2026-005'},                                    // filas rotas: se ignoran
  ];
  const ana={rol:'ac',user:'Ana Pérez'};
  let w=await listo(nuevoDom(port(),ana,{registro}));
  const C=i=>w.eval(`CONTRACTS[${i}]`);
  ok(w.eval('REG.estado')==='ok','el CLM lee el registro al arrancar');
  let q=w.calificacionDe(C(1));
  ok(q && q.fuente==='registro' && q.score===62 && q.fecha==='2026-10-20' && q.obs==='Retrasos',
     'un contrato del registro está calificado, con la fila más nueva',JSON.stringify(q));
  ok(!w.calificacionDe(C(4)),'una fila sin puntaje no califica a nadie');
  let al=w.alertList().map(a=>a.t);
  ok(!al.some(t=>/sin calificar — FIAS-FAP-2026-002/.test(t)) && al.some(t=>/sin calificar — FIAS-FAP-2026-004/.test(t)),
     'su alerta se apaga en ESTE navegador, que nunca lo calificó; la del pendiente sigue',al.join(' | '));
  w.go('detalle',1);
  ok(/en el Registro/.test(texto(w)) && w.document.getElementById('a-cal').disabled,'el detalle lo dice y no deja calificar de nuevo');
  w.go('detalle',0);
  ok(/Proveedor no elegible/.test(texto(w)),'y la nota del registro (62) avisa en los contratos vivos del proveedor');
  w.eval("Object.assign(ov(CONTRACTS[1]),{evaluado:true,score:'95.00',sem:'Confiable (Preferente)'})");
  ok(w.calificacionDe(C(1)).fuente==='registro' && w.calificacionDe(C(1)).score===62,'si también hay una local, manda el registro');

  // Confirmado aquí y todavía no enviado (sin señal): no pide calificar, avisa que falta enviarlo.
  w.eval("Object.assign(ov(CONTRACTS[2]),{evaluado:true,score:'80.50',sem:'Satisfactorio',fechaCalif:'2026-10-25',aportes:[32,24.5,4,20],envio:{estado:'pendiente',id:'x|1'}})");
  al=w.alertList();
  const pend=al.find(a=>/sin enviar al Registro — FIAS-FAP-2026-003/.test(a.t));
  ok(pend && /no se pudo enviar/.test(pend.d) && !al.some(a=>/sin calificar — FIAS-FAP-2026-003/.test(a.t)),
     'confirmado aquí y sin enviar: no pide calificar, avisa que falta enviarlo',pend&&pend.d);
  w.go('detalle',2);
  ok(/Todavía no se envió al Registro/.test(texto(w)),'y el detalle lo dice');
  const enc=w.eval('CSV_CALIF_ENC');
  ok(enc[0]==='Nro. Contrato' && enc.includes('PUNTAJE TOTAL'),'las columnas de la tabla traen las que el robot busca («Nro. Contrato», «PUNTAJE TOTAL»)');
  const ROBOT=fs.readFileSync(path.join(RAIZ,'scripts','actualizar_datos.py'),'utf8');
  ok(/encabezado\(ws, "nro", "puntaje"\)/.test(ROBOT),'y el robot de verdad busca esas dos columnas');

  // La Unidad Operativa: su alerta agregada cuenta con el registro.
  let u=await listo(nuevoDom(port(),undefined,{registro}));
  const ag=u.alertList().find(a=>a.fn==='pcal');
  ok(ag && /^2 contratos/.test(ag.t),'la alerta agregada de la Unidad no cuenta lo que ya está en el registro',ag&&ag.t);

  // Sin la hoja todavía (404): todo como antes.
  w=await listo(nuevoDom(port(),ana));
  ok(w.eval('REG.estado')==='sin','sin la hoja en el Excel, el archivo no existe y el CLM lo sabe');
  w.eval("Object.assign(ov(CONTRACTS[2]),{evaluado:true,score:'80.50',sem:'Satisfactorio'})");
  w.go('proveedores');
  ok(/Todavía no hay un Registro/.test(texto(w)),'el pool dice de dónde salen las calificaciones');

  // Red caída: las alertas de calificar se pausan en vez de pedir lo ya hecho.
  w=await listo(nuevoDom(port(),ana,{registro:'falla'}));
  ok(w.eval('REG.estado')==='falla' && !w.alertList().some(a=>/sin calificar/.test(a.t)),
     'si el registro no se pudo leer, la AC no recibe alertas de calificar');
  u=await listo(nuevoDom(port(),undefined,{registro:'falla'}));
  ok(!u.alertList().some(a=>a.fn==='pcal'),'ni la Unidad la suya');
  u.go('proveedores');
  ok(/No pude leer el Registro/.test(texto(u)),'y el pool lo dice');
  ok(/const reg=abrirRegistro\(pedido\);\s*await Promise\.race\(\[reg,new Promise\(r=>setTimeout\(r,1500\)\)\]\)/.test(HTML),
      'la primera pantalla espera al registro como mucho un segundo y medio');
}

// ---------------------------------------------------------------- 24
seccion('24 · Califica la AC, confirma, y la calificación llega sola al Registro');
{
  // Pegar a mano cada calificación en el Excel no era un proceso: se olvidaba.
  // Ahora la AC del contrato confirma y el CLM la manda a un flujo de Power
  // Automate que agrega la fila al Registro; sin señal, queda pendiente y se
  // reintenta. Y solo la AC del contrato califica.
  const port=()=>{const l=contratos();
    Object.assign(l[1],{cerrado:true,fcierre:'2026-03-10'});
    Object.assign(l[3],{cerrado:true,fcierre:'2026-05-01',ac:'María Guamán',correo:'maria@fias.org.ec'});
    return l;};
  // La Unidad Operativa ve, pero no califica.
  let u=await listo(nuevoDom(port()));
  u.go('detalle',1);
  ok(u.document.getElementById('a-cal').disabled && /La califica Ana Pérez/.test(texto(u)),'la Unidad Operativa no puede calificar: el botón dice quién lo hace');
  u.modalCalificar(u.eval('CONTRACTS[1]'));
  ok(!u.document.querySelector('.overlay'),'ni abriendo el formulario por otro camino');
  ok(!u.alertList().some(a=>a.fn==='cal'),'y no recibe alertas para calificar uno por uno');
  // Una AC no califica el contrato de otra.
  let w=await listo(nuevoDom(port(),{rol:'ac',user:'Ana Pérez'}));
  w.go('detalle',3);
  ok(w.document.getElementById('a-cal').disabled && /La califica María Guamán/.test(texto(w)),'una AC no califica el contrato de otra');
  w.abrirProv('servitec');
  ok(w.document.querySelectorAll('#view [data-cal]').length===1,'en la ficha, «Calificar» solo en el contrato propio');

  // Dos pasos: revisar y confirmar.
  const posts=[];let red='ok';
  w.fetch=(u2,o2)=>{ if(/flujo/.test(String(u2))){ posts.push(JSON.parse(o2.body));
      return red==='ok'?Promise.resolve({ok:true,status:200}):Promise.reject(new Error('sin red')); }
    return Promise.resolve({ok:false,status:404}); };
  w.eval("FLOW_CALIF_URL='https://flujo.test/calificaciones'");
  w.go('detalle',1);
  w.document.getElementById('a-cal').onclick();
  let m=w.document.querySelector('.overlay');
  m.querySelectorAll('.scorebtn[data-g="0"][data-v="2"]').forEach(b=>b.onclick());
  m.querySelector('#rev').onclick();
  ok(m.querySelector('#paso1').style.display==='none' && /Confirma la calificación/.test(m.textContent) && /Ya no se puede cambiar/.test(m.textContent),
     '«Revisar» muestra el resumen y avisa que confirmada no se cambia');
  ok(!w.eval('ov(CONTRACTS[1]).evaluado') && !posts.length,'revisar todavía no registra ni envía nada');
  m.querySelector('#volver').onclick();
  ok(m.querySelector('#paso1').style.display==='','«Corregir» vuelve a los criterios sin perder lo marcado');
  m.querySelector('#rev').onclick();
  m.querySelector('#cObs').value='Entregó tarde dos veces';
  const conf=m.querySelector('#conf');
  conf.onclick(); conf.onclick(); await pausa(40);
  ok(posts.length===1,'confirmar envía UNA vez, aunque se pulse dos',posts.length);
  const p=posts[0]||{};
  ok(p.contratoNro==='FIAS-FAP-2026-002' && p.ac==='Ana Pérez' && p.acCorreo==='ana@fias.org.ec' && p.observaciones==='Entregó tarde dos veces'
     && p.puntaje===Number(w.eval('ov(CONTRACTS[1]).score')) && p.calidad!=null && p.fechaEvaluacion===w.todayISO() && p.idCalificacion,
     'el flujo recibe la fila completa: contrato, AC, su correo, puntajes y observación',JSON.stringify(p));
  ok(w.eval('ov(CONTRACTS[1]).envio.estado')==='enviada' && /confirmada y enviada/.test(w.document.querySelector('.overlay').textContent),
     'queda como enviada y la pantalla final lo dice');
  w.document.querySelector('#okpasos').onclick();
  ok(!w.alertList().some(a=>/FIAS-FAP-2026-002/.test(a.t)),'y no queda ninguna alerta de ese contrato');

  // Sin señal: no se pierde, se avisa y se reintenta.
  const l=port();Object.assign(l[2],{cerrado:true,fcierre:'2026-04-01'});
  w=await listo(nuevoDom(l,{rol:'ac',user:'Ana Pérez'}));
  posts.length=0;red='no';
  w.fetch=(u2,o2)=>{ if(/flujo/.test(String(u2))){ posts.push(JSON.parse(o2.body));
      return red==='ok'?Promise.resolve({ok:true,status:200}):Promise.reject(new Error('sin red')); }
    return Promise.resolve({ok:false,status:404}); };
  w.eval("FLOW_CALIF_URL='https://flujo.test/calificaciones'");
  w.go('detalle',2);
  w.document.getElementById('a-cal').onclick();
  m=w.document.querySelector('.overlay');
  m.querySelector('#rev').onclick(); m.querySelector('#conf').onclick(); await pausa(40);
  ok(w.eval('ov(CONTRACTS[2]).evaluado') && w.eval('ov(CONTRACTS[2]).envio.estado')==='pendiente' && /no se pudo enviar/.test(m.textContent),
     'sin señal la calificación queda guardada como pendiente, y se dice');
  const al=w.alertList().find(a=>/sin enviar al Registro — FIAS-FAP-2026-003/.test(a.t));
  ok(al && al.fn==='reenv' && al.act==='Reintentar','la AC tiene una alerta con «Reintentar»');
  const id1=posts[0].idCalificacion;
  red='ok';
  const n=await w.reintentarEnvios();
  ok(n===1 && posts.length===2 && posts[1].idCalificacion===id1,'al volver la señal se envía sola, con el mismo identificador',JSON.stringify([n,posts.length]));
  ok(!w.alertList().some(a=>/sin enviar/.test(a.t)),'y la alerta se apaga');
  await w.reintentarEnvios();
  ok(posts.length===2,'lo ya enviado no se vuelve a mandar');
  // El esquema de la guía es el que se pega en Power Automate, y Power Automate solo
  // genera contenido dinámico para tipos simples: con ["number","null"] los campos
  // calidad, plazo, atención y cumplimiento NO aparecían en «Agregar una fila».
  const guia=fs.readFileSync(path.join(RAIZ,'plan','FLUJO_CALIFICACIONES.md'),'utf8');
  const esq=JSON.parse((guia.match(/```json\n([\s\S]*?)\n```/)||[])[1]||'null');
  ok(esq && Object.values(esq.properties).every(v=>typeof v.type==='string'),
     'el esquema de la guía solo usa tipos simples: Power Automate no entiende ["number","null"]',
     esq&&Object.entries(esq.properties).filter(([k,v])=>typeof v.type!=='string').map(e=>e[0]).join(','));
  const c3=w.eval('CONTRACTS[2]');
  const env=w.payloadCalif(c3);
  ok(Object.keys(JSON.parse(JSON.stringify(env))).every(k=>k in esq.properties),
     'y trae un campo por cada cosa que el CLM envía',Object.keys(env).filter(k=>!(k in esq.properties)).join(','));
  ok(esq.required.every(k=>env[k]!=null),'y lo obligatorio siempre viaja');
  w.eval("ov(CONTRACTS[2]).aportes=null");
  const sin=JSON.parse(JSON.stringify(w.payloadCalif(c3)));
  ok(!('calidad' in sin) && !('cumplimiento' in sin) && sin.puntaje===Number(w.eval('ov(CONTRACTS[2]).score')),
     'una calificación sin desglose no manda los aportes como null: los omite');
  // Una AC no manda las calificaciones de otra, aunque estén en este navegador.
  w.eval("Object.assign(ov(CONTRACTS[3]),{evaluado:true,score:'70.00',sem:'Aceptable – Observado',envio:{estado:'pendiente',id:'y|1'}})");
  const antes=posts.length; await w.reintentarEnvios();
  ok(posts.length===antes,'una AC solo manda las calificaciones de sus contratos, no las de otra que haya en el navegador');
  // La URL del flujo de calificaciones está puesta y no es la del envío de documentos.
  const fu=(HTML.match(/var FLOW_CALIF_URL = '([^']*)'/)||[])[1]||'',fd=(HTML.match(/var FLOW_DOCS_URL = '([^']*)'/)||[])[1]||'';
  ok(/^https:\/\/[^/]+\.powerplatform\.com:443\/powerautomate\/.+\/triggers\/manual\/paths\/invoke\?.*sig=/.test(fu) && fu!==fd,
     'FLOW_CALIF_URL es la URL firmada de un flujo, y no la del flujo de documentos');
  // Algo ya en el Registro no se reenvía aunque en este navegador conste como pendiente.
  w.eval("REG.porNro['FIAS-FAP-2026-002']=[{nro:'FIAS-FAP-2026-002',score:70,fecha:'2026-10-01'}];Object.assign(ov(CONTRACTS[1]),{evaluado:true,score:'90.00'})");
  await w.reintentarEnvios();
  ok(posts.length===2,'ni lo que ya está en el Registro');
}

// ---------------------------------------------------------------- 25
seccion('25 · Si la calificación ya no está en el Registro, la AC puede calificar de nuevo');
{
  // Para repetir una prueba, o corregir un error: la Unidad borra la fila de la tabla
  // del Excel y, cuando el robot publica, el contrato vuelve a quedar por calificar.
  const l=contratos();Object.assign(l[1],{cerrado:true,fcierre:'2026-03-10'});
  const ana={rol:'ac',user:'Ana Pérez'};
  const w=await listo(nuevoDom(l,ana,{registro:[{nro:'FIAS-FAP-2026-005',score:80,fecha:'2026-10-01'}]}));
  const hace=h=>new Date(Date.now()-h*3600000).toISOString();
  const haceMin=m=>new Date(Date.now()-m*60000).toISOString();
  const poner=(enISO,estado)=>w.eval(`Object.keys(CLM.overlay).forEach(k=>delete CLM.overlay[k]);
    Object.assign(ov(CONTRACTS[1]),{evaluado:true,score:'90.00',sem:'Confiable (Preferente)',fechaCalif:'2026-10-26',aportes:[36,27,4.5,22.5],
      envio:{estado:${JSON.stringify(estado||'enviada')},id:'x',en:'2026-10-26',enISO:${JSON.stringify(enISO)}}})`);
  const C1=()=>w.eval('CONTRACTS[1]');

  // El Registro se publicó DESPUÉS de enviarla y no la trae: se retiró.
  poner(hace(30)); w.eval(`REG.generado=${JSON.stringify(hace(2))}`);
  ok(w.calificacionRetirada(C1()),'enviada hace 30 h y el Registro de hace 2 h no la trae: está retirada');
  ok(w.liberarCalificacionesRetiradas()===1 && !w.calificacionDe(C1()) && !w.eval('ov(CONTRACTS[1]).envio'),
     'se libera: ya no consta como calificada en este navegador');
  ok(/se puede calificar de nuevo/.test(w.eval('CLM.log[0].txt')),'y queda en la bitácora');
  w.go('detalle',1);
  ok(!w.document.getElementById('a-cal').disabled,'«Calificar proveedor» vuelve a estar habilitado para la AC');
  ok(w.alertList().some(a=>/sin calificar — FIAS-FAP-2026-002/.test(a.t)),'y vuelve su alerta de calificar');
  w.document.getElementById('a-cal').onclick();
  ok(!!w.document.querySelector('.overlay #paso1'),'y se puede abrir el formulario');
  w.document.querySelector('.overlay').remove();

  // Lo que NO es una retirada.
  poner(haceMin(10)); w.eval(`REG.generado=${JSON.stringify(haceMin(9.5))}`);
  ok(!w.calificacionRetirada(C1()),'el robot leyó el Excel medio minuto después de enviarla: aún no podía traerla, no es una retirada');
  poner(haceMin(10)); w.eval(`REG.generado=${JSON.stringify(haceMin(5))}`);
  ok(w.calificacionRetirada(C1()),'si lo leyó 5 minutos después y no la trae, sí: quien repite una prueba no espera al día siguiente');
  poner(hace(30)); w.eval(`REG.generado=${JSON.stringify(hace(40))}`);
  ok(!w.calificacionRetirada(C1()),'enviada DESPUÉS de la última publicación del Registro: aún no tenía por qué estar');
  poner(hace(30)); w.eval(`REG.generado=${JSON.stringify(hace(2))};REG.porNro['FIAS-FAP-2026-002']=[{nro:'FIAS-FAP-2026-002',score:90,fecha:'2026-10-26'}]`);
  ok(!w.calificacionRetirada(C1()),'si el Registro la trae, sigue calificada');
  w.eval("delete REG.porNro['FIAS-FAP-2026-002']");
  poner(hace(30),'pendiente'); w.eval(`REG.generado=${JSON.stringify(hace(2))}`);
  ok(!w.calificacionRetirada(C1()),'una que nunca se envió no es una retirada: sigue pendiente');
  poner(hace(30)); w.eval(`REG.generado=${JSON.stringify(hace(2))};REG.estado='falla'`);
  ok(!w.calificacionRetirada(C1()),'si el Registro no se pudo leer, no se toca nada');
  w.eval("REG.estado='sin'");
  ok(!w.calificacionRetirada(C1()),'ni mientras la hoja no exista');

  // Al arrancar, con un Registro vacío (borraron la única fila de prueba).
  const w2=await listo(nuevoDom(l,ana,{registro:[],
    ls:{fap_clm_v1:JSON.stringify({overlay:{'FIAS-FAP-2026-002':{terminado:true,evaluado:true,score:'90.00',sem:'Confiable (Preferente)',
      envio:{estado:'enviada',id:'x',en:'2026-10-01',enISO:'2026-10-01T10:00:00Z'}}},solicitudes:[],log:[]})}}));
  // El simulador no pone «generado» (es del sobre cifrado del robot): se fija como lo haría el robot.
  w2.eval("REG.generado='2026-10-27T11:30:00Z'");
  ok(w2.liberarCalificacionesRetiradas()===1 && !w2.calificacionDe(w2.eval('CONTRACTS[1]')),
     'con un Registro vacío publicado después, la calificación de prueba se libera');
}

// ---------------------------------------------------------------- 26
seccion('26 · Lo calificado con el formulario de antes no se envía solo');
{
  // El id «FIAS-FAP-2026-035|2026-10-22|mw3tcs3s» de un envío real delató el problema:
  // una calificación hecha el 22 de octubre con el formulario de antes de «Confirmar»
  // se mandó al flujo el 5 de noviembre, con el nombre y el correo de la AC del contrato,
  // porque alguien abrió el CLM eligiendo su nombre. La entrada no pide contraseña.
  const l=contratos();
  Object.assign(l[1],{cerrado:true,fcierre:'2026-03-10'});
  Object.assign(l[2],{cerrado:true,fcierre:'2026-04-10'});
  const ana={rol:'ac',user:'Ana Pérez'};
  const vieja=()=>`Object.keys(CLM.overlay).forEach(k=>delete CLM.overlay[k]);
    Object.assign(ov(CONTRACTS[1]),{evaluado:true,score:'100.00',sem:'Confiable (Preferente)',fechaCalif:'2026-10-22',aportes:[40,30,5,25]})`;
  const w=await listo(nuevoDom(l,ana));
  const posts=[];
  w.fetch=(u,o)=>{ if(/flujo/.test(String(u))){ posts.push(JSON.parse(o.body)); return Promise.resolve({ok:true,status:200}); } return Promise.resolve({ok:false,status:404}); };
  w.eval("FLOW_CALIF_URL='https://flujo.test/calificaciones'");
  w.eval(vieja());
  const C1=()=>w.eval('CONTRACTS[1]');

  ok(w.anteriorSinConfirmar(C1()) && !w.sinEnviar(C1()),'una calificación sin «Confirmar» es «anterior sin confirmar», no «pendiente de envío»');
  ok(await w.reintentarEnvios()===0 && posts.length===0,'abrir el CLM, o volver la señal, NO la envía');
  ok(await w.enviarCalificacion(C1())===false && posts.length===0,'ni aunque alguien llame al envío directamente: nada sale sin «Confirmar»');
  const al=w.alertList().find(a=>/anterior sin confirmar — FIAS-FAP-2026-002/.test(a.t));
  ok(al && al.fn==='ant' && /nunca enviada/.test(al.d),'la AC recibe un aviso para revisarla',al&&al.d);
  w.go('detalle',1);
  ok(/nunca confirmada ni enviada/.test(texto(w)) && w.document.getElementById('a-ant') && /anterior sin confirmar/.test(w.document.getElementById('a-cal').textContent),
     'y el contrato lo dice, con el botón «Revisar y confirmar»');
  // Otra persona (Unidad, o una AC que no es la del contrato) no puede confirmarla.
  const u=await listo(nuevoDom(l)); u.eval(vieja());
  u.modalCalifAnterior(u.eval('CONTRACTS[1]'));
  ok(!u.document.querySelector('.overlay'),'la Unidad Operativa no puede confirmar la calificación de una AC');
  ok(!u.alertList().some(a=>a.fn==='ant'),'y no recibe el aviso');

  // Descartar: el contrato queda libre para calificarlo de nuevo.
  w.document.getElementById('a-ant').onclick();
  let m=w.document.querySelector('.overlay');
  ok(/Calificación anterior sin confirmar/.test(m.textContent) && /100,00/.test(m.textContent) && /22 oct 2026/.test(m.textContent),
     'el formulario muestra la calificación y de cuándo es');
  w._responde=false; m.querySelector('#desc').onclick();
  ok(w.anteriorSinConfirmar(C1()),'descartar pide confirmación: con «Cancelar» no se borra nada');
  w._responde=true; m.querySelector('#desc').onclick();
  ok(!w.calificacionDe(C1()) && !w.eval('ov(CONTRACTS[1]).evaluado') && /descartada/.test(w.eval('CLM.log[0].txt')),
     'descartarla libera el contrato y queda en la bitácora');
  w.go('detalle',1);
  ok(!w.document.getElementById('a-cal').disabled,'«Calificar proveedor» vuelve a estar habilitado');

  // Confirmar: se envía a nombre de quien la confirma, y el envío dice quién fue.
  w.eval(vieja()); w.go('detalle',1);
  w.document.getElementById('a-ant').onclick();
  m=w.document.querySelector('.overlay');
  m.querySelector('#conf').onclick(); await pausa(40);
  ok(posts.length===1,'confirmar la envía, una vez');
  const p=posts[0]||{};
  ok(p.via==='anterior' && p.enviadoPor==='Ana Pérez' && p.rolEnvio==='ac' && p.ac==='Ana Pérez' && p.fechaEvaluacion==='2026-10-22' && p.puntaje===100,
     'el envío dice que viene de una calificación anterior, quién la envió y su rol, y conserva la fecha original',JSON.stringify(p));
  ok(/^FIAS-FAP-2026-002\|\d{4}-\d\d-\d\dT/.test(p.idCalificacion||''),'y su id lleva la hora del envío, no un sufijo al azar');
  ok(w.eval('ov(CONTRACTS[1]).envio.estado')==='enviada','queda enviada');

  // Lo confirmado de la manera normal dice quién y por qué camino.
  w.eval("Object.keys(CLM.overlay).forEach(k=>delete CLM.overlay[k])");
  posts.length=0; w.go('detalle',2);
  w.document.getElementById('a-cal').onclick();
  m=w.document.querySelector('.overlay'); m.querySelector('#rev').onclick(); m.querySelector('#conf').onclick(); await pausa(40);
  ok(posts.length===1 && posts[0].via==='nueva' && posts[0].enviadoPor==='Ana Pérez' && posts[0].rolEnvio==='ac',
     'una calificación nueva viaja con via «nueva», quién la envió y su rol');
}

// ---------------------------------------------------------------- 27
seccion('27 · El servicio que no se puede renovar continúa por proceso nuevo');
{
  // De 126 contratos consultados para 2027, 84 ya eran una renovación: el FIAS
  // renueva una sola vez, así que continúan por proceso administrativo nuevo, y 74
  // con el mismo proveedor. El CLM tenía el objeto, el área y el proveedor delante
  // y lo único que ofrecía era un botón apagado.
  const enVeinte=new Date(Date.now()+20*86400000).toISOString().slice(0,10);
  const base=contratos();
  Object.assign(base[0],{tipo:'Renovación',...anual(enVeinte),montoTotal:5600,adenda:'Sí',proveedor:'Talleres del Oriente Cía. Ltda.',
    detalle:'Mantenimiento preventivo y correctivo de vehículos',area:'Reserva de Producción de Fauna Chimborazo'});
  Object.assign(base[1],{tipo:'Renovación',cat:'Combustible',...anual(enVeinte),proveedor:'Gasolinera El Cóndor'});
  Object.assign(base[2],{tipo:'Nuevo',...anual(enVeinte)});                       // renovable
  Object.assign(base[3],{tipo:'Renovación',fin:'2030-12-31'});              // lejos del vencimiento
  Object.assign(base[4],{tipo:'Renovación',...anual(enVeinte),ac:'María Guamán'});
  let w27=await listo(nuevoDom(base,{rol:'ac',user:'Ana Pérez'}));
  const bz=()=>JSON.parse(w27.localStorage.getItem('fap_precarga')||'null');
  const src=()=>{const f=w27.document.getElementById('toolframe');return f?f.getAttribute('src'):'';};
  const ids=()=>[...w27.document.querySelectorAll('.act .actbtn')].map(b=>b.id);
  const modal=()=>w27.document.querySelector('.overlay');

  w27.go('detalle',0);
  ok(ids()[0]==='a-nue','ya renovado y por vencer: «Proceso nuevo en La Mágica» es la primera acción',ids().join(','));
  ok(w27.document.getElementById('a-ren').disabled && /una sola vez/.test(texto(w27)),'«Renovar» sigue apagado y dice por qué');
  w27.document.getElementById('a-nue').onclick();
  let m=modal();
  ok(!!m && /proceso administrativo nuevo/.test(m.textContent) && /FIAS-FAP-2026-001/.test(m.textContent),'se abre el cuadro, que explica por qué no es una renovación');
  let ops=[...m.querySelectorAll('input[name=pn]')];
  ok(ops.map(x=>x.value).join(',')==='mismo,comparar' && ops[0].checked,'dos caminos: con el mismo proveedor (marcado) o comparación de precios',ops.map(x=>x.value).join(','));
  ok(/Talleres del Oriente/.test(m.querySelector('.radio').textContent),'el primero nombra al proveedor del contrato');
  ok(/el área y el proveedor ya puestos/.test(m.querySelector('#pnViaja').textContent) && /presupuesto no viaja/.test(m.textContent),
     'dice qué viaja, y que el presupuesto no');
  ok(bz()===null,'abrir el cuadro todavía no manda nada');
  m.querySelector('#okPN').onclick();
  let b=bz();
  ok(b && b.id==='nue:FIAS-FAP-2026-001' && b.via==='nuevo','al confirmar deja los datos en el buzón, como proceso nuevo',JSON.stringify(b&&{id:b.id,via:b.via}));
  ok(b.datos.tipo_proceso==='Selección directa por excepción' && b.datos.proveedor==='Talleres del Oriente Cía. Ltda.'
     && b.datos.objeto==='Mantenimiento preventivo y correctivo de vehículos' && b.datos.area==='Reserva de Producción de Fauna Chimborazo',
     'selección directa por excepción, con objeto, área y proveedor',JSON.stringify(b.datos));
  ok(b.datos.contratoNro==='FIAS-FAP-2026-001' && b.datos.fechaFin===enVeinte && b.datos.montoTotal===5600 && b.datos.bienServicio==='Servicio',
     'más el contrato que continúa, su vencimiento, el monto vigente (de referencia) y que es un servicio');
  ok(!('presupuesto' in b.datos) && !('fechaContrato' in b.datos),'no manda presupuesto ni los campos de una renovación');
  ok(w27.eval('ST.view')==='magica' && /generador\/index\.html#precarga=nue%3AFIAS-FAP-2026-001$/.test(src()),'y abre La Mágica con solo el número en el enlace',src());
  ok(!/Talleres|5600|Chimborazo/.test(src()),'ningún dato del contrato viaja en la URL');
  ok(/Proceso nuevo abierto en La Mágica \(mismo proveedor\)/.test(w27.eval('CLM.log[0].txt')),'queda en la bitácora');

  // La segunda vez no pregunta: La Mágica ya tiene el expediente y no lo duplica.
  w27.localStorage.removeItem('fap_precarga');
  const enLog=w27.eval('CLM.log.length');
  w27.go('detalle',0);
  ok(/Abierto el/.test(w27.document.getElementById('a-nue').textContent),'el botón recuerda que ya se abrió');
  w27.document.getElementById('a-nue').onclick();
  ok(!modal() && bz().id==='nue:FIAS-FAP-2026-001' && w27.eval('CLM.log.length')===enLog,'y vuelve directo al expediente, sin otro cuadro ni otra línea en la bitácora');

  // Combustible: bien o servicio según cómo se contrate. No se marca.
  w27.go('detalle',1);
  w27.document.getElementById('a-nue').onclick();
  m=modal(); m.querySelector('input[value=comparar]').checked=true; m.querySelector('input[value=comparar]').onchange();
  ok(m._sucio===false,'elegir una opción no hace que cerrar pregunte «¿cerrar sin terminar?»');
  ok(!/proveedor ya puestos/.test(m.querySelector('#pnViaja').textContent),'y el cuadro deja de decir que el proveedor viaja');
  m.querySelector('#okPN').onclick();
  b=bz();
  ok(b.datos.tipo_proceso==='Comparación de precios' && b.datos.proveedor==='','por comparación de precios el proveedor vigente no viaja',JSON.stringify(b.datos));
  ok(b.datos.bienServicio==='','y en combustible no se marca si es bien o servicio');

  // Un contrato renovable: primero «Renovar»; el proceso nuevo queda para quien cambia de proveedor.
  w27.go('detalle',2);
  ok(ids()[0]==='a-ren' && ids().indexOf('a-nue')>ids().indexOf('a-ren'),'en un contrato renovable, «Renovar» va primero y el proceso nuevo detrás',ids().join(','));
  ok(/solo si no vas a renovar/.test(w27.document.getElementById('a-nue').textContent),'y dice para qué es');
  w27.document.getElementById('a-nue').onclick();
  m=modal(); ops=[...m.querySelectorAll('input[name=pn]')];
  ok(ops.map(x=>x.value).join(',')==='otro,comparar' && /todavía se puede renovar/.test(m.textContent),
     'no ofrece «con el mismo proveedor»: para eso está la renovación',ops.map(x=>x.value).join(','));
  m.querySelector('#okPN').onclick();
  ok(bz().datos.proveedor==='' && bz().datos.tipo_proceso==='Selección directa por excepción','con otro proveedor: selección directa, sin copiar al actual');

  w27.go('detalle',3);
  ok(ids().indexOf('a-nue')>0,'lejos del vencimiento se ofrece igual, pero no en primer lugar',ids().join(','));
  w27.eval("ov(CONTRACTS[3]).terminado=true"); w27.go('detalle',3);
  ok(!w27.document.getElementById('a-nue'),'un contrato terminado ya no lo ofrece');

  // La alerta de vencimiento lleva a la AC directo al cuadro.
  w27.eval("delete CLM.overlay['FIAS-FAP-2026-002']"); w27.go('alertas');
  let fila=[...w27.document.querySelectorAll('.alert-row')].find(r=>/FIAS-FAP-2026-002/.test(r.textContent)&&/Vence en/.test(r.textContent));
  ok(fila && /no se renueva — prepara el proceso nuevo ya/.test(fila.textContent) && fila.querySelector('.go').textContent==='Proceso nuevo',
     'la alerta de un contrato ya renovado ofrece «Proceso nuevo»',fila&&fila.textContent);
  fila.querySelector('.go').onclick(); await pausa(120);
  ok(!!modal() && /FIAS-FAP-2026-002/.test(modal().textContent),'y abre el cuadro de ese contrato');
  modal().querySelector('#cancel').onclick();
  ok(!modal() && !w27.eval("ov(CONTRACTS[1]).sucesor"),'cancelar no deja nada marcado');
  // A la Unidad Operativa, que ve todo el portafolio, la alerta la lleva al contrato.
  const wUO=await listo(nuevoDom(base,{rol:'uo',user:'Unidad Operativa'}));
  wUO.go('alertas');
  fila=[...wUO.document.querySelectorAll('.alert-row')].find(r=>/FIAS-FAP-2026-001/.test(r.textContent)&&/Vence en/.test(r.textContent));
  ok(fila && fila.querySelector('.go').textContent==='Abrir','a la Unidad Operativa la misma alerta le dice «Abrir»');

  // Un proveedor no elegible: no se prohíbe, pero no pasa sin que la AC lo vea.
  const reg=[{nro:'FIAS-FAP-2026-005',score:42,fecha:'2026-10-01',aportes:[15,12,2,13]}];
  const conMalo=contratos();
  Object.assign(conMalo[0],{tipo:'Renovación',...anual(enVeinte),proveedor:'Mal Servicio S.A.'});
  Object.assign(conMalo[4],{proveedor:'Mal Servicio S.A.',cerrado:true,fin:'2026-09-30'});
  w27=await listo(nuevoDom(conMalo,{rol:'ac',user:'Ana Pérez'},{registro:reg}));
  w27.go('detalle',0); w27.document.getElementById('a-nue').onclick();
  m=modal();
  ok(/no elegible/.test(m.querySelector('#pnProv').textContent),'con el mismo proveedor calificado como no elegible, el cuadro lo advierte',m.querySelector('#pnProv').textContent);
  m.querySelector('input[value=comparar]').checked=true; m.querySelector('input[value=comparar]').onchange();
  ok(m.querySelector('#pnProv').textContent==='','y la advertencia se va al elegir comparación de precios');
  ok(w27._confirmas===0,'sin un confirm() de por medio');

}

// ---------------------------------------------------------------- 28
seccion('28 · La lista de pendientes se acorta a medida que la AC avanza');
{
  // Un contrato cuyo proceso nuevo ya se abrió seguía diciendo «prepara el proceso
  // nuevo» al día siguiente: la lista nunca se acortaba ni mostraba avance.
  const enVeinte=new Date(Date.now()+20*86400000).toISOString().slice(0,10);
  const base=contratos();
  Object.assign(base[0],{tipo:'Renovación',...anual(enVeinte)});
  Object.assign(base[1],{tipo:'Renovación',...anual(enVeinte)});
  Object.assign(base[2],{tipo:'Nuevo',...anual(enVeinte)});
  const w29=await listo(nuevoDom(base,{rol:'ac',user:'Ana Pérez'}));
  const badge=()=>{const b=[...w29.document.querySelectorAll('.navitem')].find(x=>/Alertas/.test(x.textContent)).querySelector('.nbadge');return b?b.textContent:'';};
  ok(w29.alertasPendientes().length===3 && badge()==='3','tres contratos por vencer: tres pendientes',badge());
  // Sin actividad, lo que hay que atender ocupa todo el ancho.
  ok(w29.document.querySelector('.atencion.solo') && !/Actividad reciente/.test(texto(w29)),'sin actividad registrada, el panel no gasta media pantalla en decirlo');
  ok(/3 pendientes/.test(texto(w29)),'y dice cuántos pendientes hay');

  // Abre el proceso nuevo del primero.
  w29.go('detalle',0); w29.document.getElementById('a-nue').onclick();
  w29.document.querySelector('.overlay #okPN').onclick();
  w29.go('panel');
  ok(w29.alertasPendientes().length===2 && badge()==='2','al abrirlo en La Mágica deja de contar como pendiente',badge());
  let filas=[...w29.document.querySelectorAll('.alert-row')];
  let f1=filas.find(r=>/FIAS-FAP-2026-001/.test(r.textContent));
  ok(f1 && f1.classList.contains('encurso') && /Proceso nuevo en curso/.test(f1.textContent) && f1.querySelector('.go').textContent==='Continuar',
     'pasa a «en curso», con un botón para continuar',f1&&f1.textContent);
  ok(filas.indexOf(f1)===filas.filter(r=>!/Actividad/.test(r.textContent)).length-1,'y baja al final de la lista: primero lo que falta');
  ok(/2 pendientes · 1 en curso en La Mágica/.test(texto(w29)),'el panel resume el avance');
  ok(/Actividad reciente/.test(texto(w29)),'y con actividad registrada vuelve la columna de actividad');
  w29.localStorage.removeItem('fap_precarga');
  f1.querySelector('.go').onclick(); await pausa(120);
  ok(!w29.document.querySelector('.overlay') && JSON.parse(w29.localStorage.getItem('fap_precarga')).id==='nue:FIAS-FAP-2026-001',
     '«Continuar» vuelve directo al expediente, sin preguntar otra vez');

  // La renovación también se recuerda.
  w29.go('detalle',2); w29.document.getElementById('a-ren').onclick();
  ok(!!w29.eval("ov(CONTRACTS[2]).renov"),'renovar deja anotado que se abrió');
  w29.go('detalle',2);
  ok(/Abierta el/.test(w29.document.getElementById('a-ren').textContent),'el botón lo dice');
  const nLog=w29.eval('CLM.log.length');
  w29.document.getElementById('a-ren').onclick();
  ok(w29.eval('CLM.log.length')===nLog,'y volver a entrar no repite la línea en la bitácora');
  w29.go('alertas');
  const f3=[...w29.document.querySelectorAll('.alert-row')].find(r=>/FIAS-FAP-2026-003/.test(r.textContent));
  ok(f3 && /Renovación en curso/.test(f3.textContent) && badge()==='1','su alerta pasa a «Renovación en curso» y queda un solo pendiente',badge());
  w29.localStorage.removeItem('fap_precarga'); f3.querySelector('.go').onclick();
  ok(JSON.parse(w29.localStorage.getItem('fap_precarga')).id==='ren:FIAS-FAP-2026-003','y «Continuar» abre la renovación');

  // En el teléfono: las acciones antes de la línea de tiempo, lo pendiente antes de las cifras.
  ok(/\.detail>div:first-child\{display:contents\}/.test(HTML) && /\.detail>div:last-child\{order:2\}/.test(HTML),'en una columna, las acciones van antes de la línea de tiempo');
  ok(/\.panelv>\.atencion\{order:1\}\.panelv>\.kpis\{order:2\}/.test(HTML),'y en el panel, lo pendiente va antes de las cifras');
}

console.log('\n'+(fallos?`✗ ${fallos} de ${pruebas} comprobaciones fallaron`:`✓ ${pruebas} comprobaciones, todo bien`));
process.exit(fallos?1:0);

})().catch(e=>{ console.error('\nLa prueba se rompió:',e); process.exit(1); });
