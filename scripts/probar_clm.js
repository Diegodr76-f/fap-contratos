/*
 * Comprobaciones del CLM (clm/index.html).
 *
 * Cubren dos cosas.
 *
 * El puente entre el contrato y su carpeta interna: que el número de carpeta se
 * vea en el detalle y en el listado, que la búsqueda funcione en las dos
 * direcciones (del objeto a la carpeta y de la carpeta al contrato) y que el
 * filtro y la alerta de «sin carpeta» solo aparezcan cuando tienen algo que
 * decir. Comprueban de paso que un contrato sin esos campos —que es todo el
 * portafolio hasta que la columna del Excel se llene— se pinta igual que antes.
 *
 * Y el listado de proveedores: que se arme solo con los contratos aunque el
 * maestro no traiga la hoja «Proveedores», que las variantes de escritura de un
 * mismo nombre se junten, que el RUC de una persona natural salga enmascarado
 * —porque es su cédula y el sitio es público— y que la verificación periódica
 * cuente su ciclo y avise cuando vence.
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
    cat:'Servicios', monto:1150, montoTotal:1150, cerrado:false,
    inicio:'2026-01-15', firma:'2026-01-20', fin:'2030-12-31',
    tipo:'Contrato', proveedor:'Servitec', plazo:350, adenda:'',
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

// Un portafolio con varios proveedores: uno escrito de dos formas (que es lo
// que pasa de verdad en el maestro), uno en dos áreas y dos categorías, y uno
// suelto. Sirve para el listado de proveedores.
function contratosProv(){
  const base=(n,extra)=>Object.assign({
    nro:'FIAS-FAP-2026-'+String(n).padStart(3,'0'),
    detalle:'Objeto del contrato '+n, area:'RPF Chimborazo',
    cat:'Mantenimiento', monto:1000, montoTotal:1000, cerrado:false,
    inicio:'2026-01-15', firma:'2026-01-20', fin:'2030-12-31',
    tipo:'Contrato', proveedor:'Servitec', plazo:350, adenda:'',
    tipoAdenda:null, modificacion:null, firmaAdenda:null,
    ac:'Ana Pérez', correo:'ana@fias.org.ec', link:null,
    fcierre:null, liquidado:null, saldo:null, carpeta:null, codigoProceso:null
  },extra);
  return [
    base(10,{proveedor:'RIVERJARDÍN CÍA. LTDA.',area:'Parque Nacional Cotopaxi',
             cat:'Combustible',monto:8000,montoTotal:8000}),
    base(11,{proveedor:'RIVERJARDIN CIA LTDA',area:'Refugio de Vida Silvestre Pasochoa',
             cat:'Combustible',monto:4000,montoTotal:4000}),
    base(12,{proveedor:'Edwin Klever Sinchiguano',area:'Parque Nacional Cotopaxi',
             cat:'Mantenimiento',monto:5000,montoTotal:5000}),
    base(13,{proveedor:'Edwin Klever Sinchiguano',area:'RPF Chimborazo',
             cat:'Limpieza',monto:3000,montoTotal:3000}),
    base(14,{proveedor:'PETROGOLDEN COMBUSTIBLES CÍA. LTDA.',area:'Parque Nacional Machalilla',
             cat:'Combustible',monto:9000,montoTotal:9000})
  ];
}

// Las fichas tal como las publicaría el robot desde la hoja «Proveedores»: el
// RUC de la sociedad entero y el de la persona natural ya enmascarado, que es
// lo único que sale del Excel.
function fichas(){
  return [
    {nombre:'RIVERJARDIN CÍA. LTDA.',ruc:'1790123456001',rucTipo:'Sociedad',
     actividad:'Venta al por menor de combustibles',verificacion:'2026-08-01',
     verificadoPor:'Ana Pérez',resultado:'Vigente',periodicidad:'Anual',observaciones:''},
    {nombre:'Edwin Klever Sinchiguano',ruc:'0603•••••6001',
     rucTipo:'Persona natural',actividad:'Mantenimiento de instalaciones',
     verificacion:'2024-01-01',verificadoPor:'Ana Pérez',resultado:'Vigente',
     periodicidad:'Anual',observaciones:''}
  ];
}

// Carga el CLM con una sesión ya abierta y la base servida por un fetch de
// mentira, para poder probar también el portafolio de hoy —sin ninguna carpeta
// registrada— y la mirada de una administradora.
//
// El fetch reparte por URL: el CLM pide dos archivos y el de proveedores es
// opcional. Cuando no se pasan fichas responde 404, que es el caso de hoy —el
// maestro todavía no trae la hoja— y es el que más importa que funcione.
function nuevoDom(lista,ses,fichasLista){
  const datos=JSON.stringify(lista||contratos());
  const provs=fichasLista?JSON.stringify(fichasLista):null;
  const sesion=ses||{rol:'uo',user:'Unidad Operativa'};
  const dom=new JSDOM(HTML,{url:'http://localhost/clm/index.html',runScripts:'dangerously',
    beforeParse(win){
      win.sessionStorage.setItem('fap_clm_ses',JSON.stringify(sesion));
      win.fetch=(url)=>{
        if(String(url).indexOf('proveedores_export')>=0){
          return provs?Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(provs))})
                      :Promise.resolve({ok:false,status:404,json:()=>Promise.reject(new Error('404'))});
        }
        return Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(datos))});
      };
      win.scrollTo=()=>{}; win.confirm=()=>true; win.alert=()=>{};
      // Descargar un CSV no se puede en un DOM de mentira, pero su contenido sí
      // es lo que se prueba: es la fila que termina pegada en el Excel.
      win.URL.createObjectURL=()=>'blob:prueba'; win.URL.revokeObjectURL=()=>{};
      win.HTMLAnchorElement.prototype.click=function(){};
      const B=win.Blob;
      win.__csv=null;
      win.Blob=function(partes,op){ win.__csv=String(partes[0]); return new B(partes,op); };
    }});
  return dom.window;
}
// boot() es asíncrono y ahora pide dos archivos: se espera a que haya pintado,
// que es lo que ocurre cuando los dos terminaron. Esperar solo a CONTRACTS
// dejaba las fichas de proveedor a medio cargar.
function listo(w){
  return new Promise((res,rej)=>{
    let n=0;
    (function esperar(){
      let hay=0;
      try{ const v=w.document.getElementById('view');
           hay=w.eval('CONTRACTS.length') && v && v.children.length; }catch(e){}
      if(hay) return res(w);
      if(++n>80) return rej(new Error('el CLM no cargó la base'));
      setTimeout(esperar,10);
    })();
  });
}
const texto=w=>w.document.getElementById('view').textContent.replace(/\s+/g,' ');
const $HTML=w=>w.document.getElementById('view').innerHTML;

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
seccion('8 · El listado de proveedores se arma solo con los contratos');
w=await listo(nuevoDom(contratosProv()));          // sin hoja «Proveedores»
let P=w.proveedores();
ok(P.length===3,'cinco contratos, tres proveedores',P.length);
let river=P.find(p=>/RIVERJ/i.test(p.nombre));
ok(!!river && river.contratos.length===2,
   'las dos formas de escribir «RIVERJARDÍN CÍA. LTDA.» son un solo proveedor',
   river&&river.contratos.length);
ok(river.areas.length===2,'con sus dos áreas juntas',river.areas.length);
ok(river.monto===12000,'y sus montos sumados',river.monto);
let edwin=P.find(p=>/Edwin/.test(p.nombre));
ok(edwin.cats.length===2 && edwin.cats.join()==='Limpieza,Mantenimiento',
   'un proveedor con dos categorías las lleva las dos',edwin.cats.join());
w.go('proveedores');
t=texto(w);
ok(/3 proveedores/.test(t),'el listado dice cuántos son');
ok(/sin registrar/.test(t),'sin la hoja del Excel, el RUC dice «sin registrar»');
ok(/hoja <b>2026<\/b> del Excel maestro/.test($HTML(w))&&/una sola vez/.test(t),
   'y explica dónde se escribe el RUC, y que es una sola vez');
ok(w.alertList().filter(a=>a.fn==='prov').length===0,
   'y no hay alerta de verificación: antes de la primera sería un cartel permanente');

// ---------------------------------------------------------------- 9
seccion('9 · La ficha del Excel, y el RUC que no puede salir entero');
w=await listo(nuevoDom(contratosProv(),null,fichas()));
P=w.proveedores();
river=P.find(p=>/RIVERJ/i.test(p.nombre));
edwin=P.find(p=>/Edwin/.test(p.nombre));
ok(!!river.ficha,'la ficha se pega al proveedor aunque el Excel lo escriba distinto');
ok(river.ficha.ruc==='1790123456001','una sociedad lleva el RUC completo',river.ficha.ruc);
ok(/•/.test(edwin.ficha.ruc),'una persona natural lo lleva enmascarado: su RUC es su cédula',edwin.ficha.ruc);
w.eval("ST.prov='"+river.key+"'"); w.go('provdet');
t=texto(w);
ok(/Venta al por menor de combustibles/.test(t),'la ficha muestra la actividad económica registrada');
ok(/Parque Nacional Cotopaxi/.test(t)&&/Pasochoa/.test(t),'y las áreas donde tuvo contrato');
ok(/Escrito de varias formas/.test(t),'avisa de que el nombre está escrito de varias formas');
ok(/Combustible/.test(t),'y la actividad por la que se le contrató');
w.eval("ST.prov='"+edwin.key+"'"); w.go('provdet');
ok(/parcial/.test(texto(w)),'y marca «parcial» el RUC que no se publica entero');

// ---------------------------------------------------------------- 10
seccion('10 · La verificación periódica y su ciclo');
ok(w.verifEstado(river).key==='aldia','una verificación de hace un mes está al día',w.verifEstado(river).key);
ok(w.verifEstado(edwin).key==='vencida','una de hace dos años, con ciclo anual, está vencida',w.verifEstado(edwin).key);
const petro=P.find(p=>/PETRO/.test(p.nombre));
ok(w.verifEstado(petro).key==='nunca','y el que no tiene ficha dice «sin verificar»');
w.eval("ST.prov='"+edwin.key+"'"); w.go('provdet');
w.document.getElementById('verifBtn').onclick();
let modal=w.document.querySelector('.overlay');
ok(!!modal,'el botón abre el formulario de verificación');
modal.querySelectorAll('#checks input').forEach(i=>{i.checked=true;});
modal.querySelector('#vper').value='Semestral';
modal.querySelector('#vobs').value='RUC activo, actividad coincide';
modal.querySelector('#vok').onclick();
ok(w.eval(`(CLM.prov['${edwin.key}'].verifs||[]).length`)===1,'al registrarla queda guardada');
let e2=w.verifEstado(w.provPorKey(edwin.key));
ok(e2.key==='aldia','y el proveedor pasa a estar al día',e2.key);
ok(/182|18\d/.test(String(w.ciclodias(w.ultimaVerif(w.provPorKey(edwin.key))))),
   'con el ciclo semestral que se eligió',w.ciclodias(w.ultimaVerif(w.provPorKey(edwin.key))));
ok(w.ultimaVerif(w.provPorKey(edwin.key)).pendiente===true,
   'marcada como pendiente de pasar al Excel: el equipo todavía no la ve');
w.go('provdet');
ok(/solo en este navegador/.test(texto(w)),'y la ficha lo dice');

// ---------------------------------------------------------------- 11
seccion('11 · Las alertas de proveedor');
let av=w.alertList().filter(a=>a.fn==='prov');
ok(av.length===0,'con todo verificado y al día, no hay alerta pendiente',av.length);
w.eval(`CLM.prov['${edwin.key}'].verifs[0].fecha='2024-02-01';saveCLM();`);
av=w.alertList().filter(a=>a.fn==='prov');
ok(av.length===1,'una sola alerta agregada cuando hay verificaciones vencidas',av.length);
ok(/1 proveedor con la verificación vencida/.test(av[0].t),'y dice cuántos son',av[0]&&av[0].t);
w.go('alertas');
const bprov=[...w.document.querySelectorAll('.alert-row .go')].find(b=>b.dataset.fn==='prov');
ok(!!bprov,'la alerta se pinta con su botón');
bprov.onclick();
ok(w.eval('ST.view')==='proveedores'&&w.eval('ST.pVerif')==='vencida','y lleva al listado ya filtrado');
w.eval(`CLM.prov['${edwin.key}'].verifs[0].resultado='No continuar';saveCLM();`);
const corte=w.alertList().filter(a=>a.fn==='provdet');
ok(corte.length===1&&corte[0].sev===0,
   'un proveedor «No continuar» con contrato vivo es alerta roja, no un aviso',corte.length);
ok(corte[0].pk===edwin.key,'y el botón abre su ficha, no otra');

// ---------------------------------------------------------------- 12
seccion('12 · Un contrato nuevo trae un proveedor al que nadie le puso el RUC');
// El proveedor nuevo aparece solo —el listado se arma con los contratos— y lo
// único que le falta es el RUC, que se escribe en la hoja 2026 en cualquiera de
// sus filas. Eso es lo que hay que ver, no una ficha que crear.
const conNuevo=contratosProv().concat([Object.assign({},contratosProv()[0],{
  nro:'FIAS-FAP-2026-900',proveedor:'FERRETERÍA EL CÓNDOR S.A.',
  area:'RPF Chimborazo',cat:'Mantenimiento',monto:2200,montoTotal:2200})]);
w=await listo(nuevoDom(conNuevo,null,fichas()));
P=w.proveedores();
ok(P.length===4,'el proveedor nuevo entra al listado sin tocar nada',P.length);
const ferre=P.find(p=>/FERRETER/.test(p.nombre));
ok(!!ferre && !w.datosProv(ferre).ruc,'y se ve que todavía no tiene RUC');
w.go('proveedores');
ok(!!w.document.getElementById('chipSinRuc'),'aparece el filtro «Sin RUC»');
ok(/Sin RUC · 2/.test(texto(w)),'y dice cuántos son (el nuevo y el que nunca lo tuvo)');
w.document.getElementById('chipSinRuc').onclick();
ok(w.filtraProveedores().every(p=>!w.datosProv(p).ruc),'al pulsarlo deja solo los que no lo tienen');
w.eval('ST.pSinRuc=false');
let af=w.alertList().filter(a=>a.fn==='provruc');
ok(af.length===1,'una sola alerta agregada, no una por proveedor',af.length);
ok(/hoja 2026/.test(af[0].d)&&/una sola vez/.test(af[0].d),
   'y dice dónde se escribe y que es una sola vez');
w.go('alertas');
const bficha=[...w.document.querySelectorAll('.alert-row .go')].find(b=>b.dataset.fn==='provruc');
bficha.onclick();
ok(w.eval('ST.view')==='proveedores'&&w.eval('ST.pSinRuc')===true,'y lleva al listado ya filtrado');
// Y el caso de hoy: ningún RUC escrito todavía, ni filtro ni alerta — serían
// 225 avisos de algo que aún no empieza.
w=await listo(nuevoDom(conNuevo));
w.go('proveedores');
ok(!w.document.getElementById('chipSinRuc'),'sin ningún RUC todavía, el filtro no aparece');
ok(w.alertList().filter(a=>a.fn==='provruc').length===0,'y la alerta tampoco');
ok(w.proveedores().length===4,'pero el listado se pinta completo, como siempre');
ok(/se escriben en la hoja <b>2026<\/b>/.test($HTML(w)),
   'y explica dónde se escribe el RUC');

// ---------------------------------------------------------------- 13
seccion('13 · El RUC se captura donde alguien lo tiene delante');
// Para un proveedor nuevo nadie debería teclear nada en Excel: el nombre viene
// del contrato y el RUC lo escribe la AC cuando lo verifica, que es el momento
// en que lo tiene en la mano. La fila del CSV sale completa y pegarla crea la
// ficha entera.
w=await listo(nuevoDom(conNuevo,null,fichas()));
ok(w.rucValido('1790123456001')===true,'un RUC de sociedad bien formado pasa');
ok(w.rucValido('1790123457001')===false,'con un dígito cambiado, no');
ok(w.rucValido('0603123456001')===true,'y el de una persona natural también se comprueba');
ok(w.rucValido('123')===null,'lo que no es un RUC no dice ni sí ni no');
let nuevo=w.proveedores().find(p=>/FERRETER/.test(p.nombre));
w.eval("ST.prov='"+nuevo.key+"'"); w.go('provdet');
w.document.getElementById('verifBtn').onclick();
modal=w.document.querySelector('.overlay');
ok(!!modal.querySelector('#vruc'),'sin ficha, el formulario pide el RUC');
ok(!!modal.querySelector('#vact'),'y la actividad económica');
modal.querySelector('#vruc').value='0603123456001';
modal.querySelector('#vact').value='Ferretería y materiales de construcción';
modal.querySelectorAll('#checks input').forEach(i=>{i.checked=true;});
modal.querySelector('#vok').onclick();
nuevo=w.provPorKey(nuevo.key);
ok(w.eval(`CLM.prov['${nuevo.key}'].ruc`)==='0603123456001','el RUC queda guardado entero');
w.go('provdet');
t=texto(w);
ok(/0603•••••6001/.test(t),'pero la ficha lo pinta enmascarado: es una persona natural');
ok(/sin pasar/.test(t),'marcado como que todavía no está en el Excel');
ok(/Ferretería y materiales/.test(t),'y la actividad se ve igual');
ok(/hoja <b>2026<\/b>/.test($HTML(w))&&/cualquier contrato<\/b> de este proveedor/.test($HTML(w)),
   'la ficha dice a qué fila del Excel va el CSV');
const filaCsv=String(w.eval('__csv')||'').split('\r\n')[1]||'';
ok(/FERRETER/.test(filaCsv),'el CSV lleva el nombre tal como está en el contrato');
ok(filaCsv.indexOf('0603123456001')>=0,'y el RUC entero, que el Excel sí puede guardar');
ok(filaCsv.indexOf('•')<0,'nunca el enmascarado: escribirlo pisaría el bueno con bolitas');
ok(/Ferretería y materiales/.test(filaCsv),'y la actividad');
// Con ficha ya publicada no vuelve a preguntar: el Excel manda.
let conRuc=w.proveedores().find(p=>/RIVERJ/i.test(p.nombre));
w.eval("ST.prov='"+conRuc.key+"'"); w.go('provdet');
w.document.getElementById('verifBtn').onclick();
modal=w.document.querySelector('.overlay');
ok(!modal.querySelector('#vruc'),'si el Excel ya tiene el RUC, no lo vuelve a pedir');
modal.querySelector('#vcancel').onclick();

// ---------------------------------------------------------------- 14
seccion('14 · Cada quien ve sus proveedores');
w=await listo(nuevoDom(contratosProv(),{rol:'area',user:'Parque Nacional Cotopaxi'},fichas()));
P=w.proveedores();
ok(P.length===2,'un área ve solo los proveedores que trabajaron con ella',P.length);
ok(P.every(p=>p.areas.length===1&&p.areas[0]==='Parque Nacional Cotopaxi'),
   'y sus contratos, no los de las otras áreas');

console.log('\n'+(fallos?`✗ ${fallos} de ${pruebas} comprobaciones fallaron`:`✓ ${pruebas} comprobaciones, todo bien`));
process.exit(fallos?1:0);

})().catch(e=>{ console.error('\nLa prueba se rompió:',e); process.exit(1); });
