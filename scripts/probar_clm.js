/*
 * Comprobaciones del CLM (clm/index.html).
 *
 * Cubren el puente entre el contrato y su carpeta de elaboración: que el número
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
    cat:'Servicios', monto:1150, montoTotal:1150, cerrado:false,
    inicio:'2026-01-15', firma:'2026-01-20', fin:'2030-12-31',
    tipo:'Contrato', proveedor:'Servitec', plazo:350, adenda:'',
    tipoAdenda:null, modificacion:null, firmaAdenda:null,
    ac:'Ana Pérez', correo:'ana@fias.org.ec', link:null,
    fcierre:null, liquidado:null, saldo:null,
    elaboracion:null, codigoProceso:null
  },extra);
  return [
    base(1,{elaboracion:'47', codigoProceso:'RPFCH-2026-007'}),
    base(2,{elaboracion:'48'}),
    base(3,{elaboracion:'12'}),
    base(4,{}),
    base(5,{})
  ];
}

// Carga el CLM con una sesión ya abierta y la base servida por un fetch de
// mentira, para poder probar también el portafolio de hoy —sin ninguna carpeta
// registrada— y la mirada de una administradora.
function nuevoDom(lista,ses){
  const datos=JSON.stringify(lista||contratos());
  const sesion=ses||{rol:'uo',user:'Unidad Operativa'};
  const dom=new JSDOM(HTML,{url:'http://localhost/clm/index.html',runScripts:'dangerously',
    beforeParse(win){
      win.sessionStorage.setItem('fap_clm_ses',JSON.stringify(sesion));
      win.fetch=()=>Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(datos))});
      win.scrollTo=()=>{}; win.confirm=()=>true; win.alert=()=>{};
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

(async function(){

// ---------------------------------------------------------------- 1
seccion('1 · El bloque Expediente en el detalle');
let w=await listo(nuevoDom());
w.go('detalle',0);
let t=texto(w);
ok(/Expediente/.test(t),'el bloque aparece');
ok(/N\.º de contrato\s*FIAS-FAP-2026-001/.test(t),'muestra el número de contrato');
ok(/Código del proceso\s*RPFCH-2026-007/.test(t),'muestra el código del proceso de La Mágica');
ok(/N\.º de elaboración\s*carpeta 47/.test(t),'muestra el número de la carpeta');

w.go('detalle',1);
t=texto(w);
ok(/Código del proceso\s*sin registrar/.test(t),'sin código del proceso lo dice, no lo esconde');
ok(/N\.º de elaboración\s*carpeta 48/.test(t),'y la carpeta sigue saliendo');

w.go('detalle',3);
t=texto(w);
ok(/N\.º de elaboración\s*sin registrar/.test(t),'un contrato sin carpeta lo dice');
ok(/columna Elaboracion del Excel maestro/.test(t),'y le dice a la U.O. dónde se escribe');

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
ok(r.every(c=>!c.elaboracion),'y ninguno tiene carpeta');
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
const sinNada=contratos().map(c=>Object.assign({},c,{elaboracion:null,codigoProceso:null}));
w=await listo(nuevoDom(sinNada));
w.go('contratos');
ok(!w.document.getElementById('chipSinCarp'),
   'el filtro no aparece: antes de la primera carpeta sería un cartel permanente');
ok(w.alertList().filter(a=>a.fn==='carp').length===0,'y la alerta tampoco');
ok(w.filteredContracts().length===5,'el listado se pinta completo, como siempre');
w.go('detalle',0);
ok(/N\.º de elaboración\s*sin registrar/.test(texto(w)),'el detalle lo dice sin estorbar');

// ---------------------------------------------------------------- 7
seccion('7 · Una AC no carga con el mantenimiento de la Unidad Operativa');
w=await listo(nuevoDom(contratos(),{rol:'ac',user:'Ana Pérez'}));
ok(w.myContracts().length===5,'la AC sí ve sus cinco contratos');
ok(w.alertList().filter(a=>a.fn==='carp').length===0,
   'pero la alerta es de quien tiene las carpetas, no suya');
w.go('detalle',0);
ok(/N\.º de elaboración\s*carpeta 47/.test(texto(w)),'y el número lo ve igual, que para eso está');
ok(!/columna Elaboracion del Excel maestro/.test(texto(w)),'sin la nota de dónde se escribe, que no le toca');

console.log('\n'+(fallos?`✗ ${fallos} de ${pruebas} comprobaciones fallaron`:`✓ ${pruebas} comprobaciones, todo bien`));
process.exit(fallos?1:0);

})().catch(e=>{ console.error('\nLa prueba se rompió:',e); process.exit(1); });
