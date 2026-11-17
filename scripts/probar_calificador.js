/*
 * Comprobaciones del Calificador de Ofertas (calificacion/index.html).
 *
 * Es la herramienta que dice a quién se recomienda adjudicar, así que aquí se
 * prueba lo que decide eso: cómo se lee un precio tecleado, el puntaje, el
 * umbral, el orden de prelación y qué pasa cuando dos ofertas empatan.
 *
 * Igual que el CLM, la app declara su estado con `let S`, que no cuelga de
 * window: se llega con w.eval().
 *
 * Uso (las dependencias no se guardan en el repositorio):
 *     npm install jsdom
 *     node scripts/probar_calificador.js
 *
 * Sale con código 1 si algo falla, para poder colgarlo de un workflow.
 */
const fs = require('fs'), path = require('path');
let JSDOM, VirtualConsole;
try{
  ({ JSDOM, VirtualConsole } = require('jsdom'));
}catch(e){
  console.error('Falta jsdom. Instálalo con:\n    npm install jsdom\n');
  process.exit(2);
}

const HTML = fs.readFileSync(path.join(path.dirname(__dirname), 'calificacion', 'index.html'), 'utf8');

let fallos = 0, pruebas = 0;
function ok(cond, msg, extra){ pruebas++; if(cond){ console.log('  ✓ ' + msg); } else { fallos++; console.log('  ✗ ' + msg + (extra !== undefined ? ('  → ' + extra) : '')); } }
function seccion(t){ console.log('\n' + t); }

const errores = [];
const consola = new VirtualConsole();
consola.on('jsdomError', e => errores.push(e.message));
const dom = new JSDOM(HTML, {
  url: 'http://localhost/calificacion/index.html', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: consola,
  beforeParse(w){
    w.fetch = () => Promise.reject(new Error('sin red'));
    w.alert = () => {}; w.confirm = () => true;
    w.addEventListener('error', e => errores.push(e.message));
  }
});
const w = dom.window;
const ev = js => w.eval(js);
const texto = sel => (w.document.querySelector(sel) || {}).textContent || '';

/* Una oferta que cumple todos los requisitos del ejemplo de bienes. */
function ofertaQueCumple(nombre, precio){
  return `{id:uid('of'), nombre:${JSON.stringify(nombre)}, ruc:'', precio:${JSON.stringify(precio)}, obs:'',
    gates:Object.fromEntries([...S.reqLegales,...S.reqTecnicos].map(r=>[r.id,true])), gatesDoc:{}, scores:{}}`;
}
function bienes(ofertas){
  ev(`S = normalize(presetBienes()); S.oferentes = [${ofertas.map(o => ofertaQueCumple(o[0], o[1])).join(',')}]; render();`);
  return ev('compute()');
}

seccion('1. Un precio se lee igual en cualquier formato');
for(const [tecleado, esperado] of [
  ['12.500,00', 12500], ['12,500.00', 12500], ['1,234,567.89', 1234567.89], ['1.234.567,89', 1234567.89],
  ['$ 45.000', 45000], ['45000', 45000], ['12500.50', 12500.5], ['12,5', 12.5], ['1,250,000', 1250000], ['', 0],
]){
  ok(ev(`num(${JSON.stringify(tecleado)})`) === esperado, `«${tecleado}» → ${esperado}`, ev(`num(${JSON.stringify(tecleado)})`));
}

seccion('2. Cumple / No cumple: gana el menor precio, escriba como se escriba');
let R = bienes([['Uno', '12,500.00'], ['Dos', '11.900,00'], ['Tres', '13000']]);
ok(R.winner && R.winner.nombre === 'Dos', 'recomienda la oferta de 11.900', R.winner && R.winner.nombre);
ok(R.ranked.map(o => o.nombre).join(',') === 'Dos,Uno,Tres', 'orden de prelación Dos, Uno, Tres', R.ranked.map(o => o.nombre).join(','));
ok(/Oferta recomendada/.test(texto('#resultados')), 'el cartel dice «Oferta recomendada»');

seccion('3. Empate en el primer lugar: la herramienta no elige');
R = bienes([['Alfa', '10.000,00'], ['Beta', '10000'], ['Gamma', '12000']]);
ok(R.winner === null, 'no hay oferta recomendada', R.winner && R.winner.nombre);
ok(R.empatados.map(o => o.nombre).join(',') === 'Alfa,Beta', 'las empatadas son Alfa y Beta', R.empatados.map(o => o.nombre).join(','));
ok(/Empate en el primer lugar/.test(texto('#resultados')), 'el cartel avisa del empate');
ok(/Alfa y Beta/.test(texto('#resultados')), 'y nombra a las dos');
ok(/quedaron empatadas/.test(texto('#acta')) && !/☑ Declara desierto/.test(texto('#acta')), 'el acta deja el desempate a la Comisión, sin declarar desierto');
R = bienes([['Alfa', '10000'], ['Beta', '10500']]);
ok(R.winner && R.winner.nombre === 'Alfa' && R.empatados.length === 0, 'sin empate, recomienda como siempre');

seccion('4. Por puntos: puntaje, umbral y su motivo');
ev(`S = normalize(presetConsultoria());
    const pleno = Object.fromEntries(S.reqDocs.map(d=>[d.id,true]));
    const notas = f => Object.fromEntries(critList().map(c=>[c.id,{m1:c.max*f,m2:c.max*f,m3:c.max*f,m4:c.max*f}]));
    S.oferentes = [
      {id:'a', nombre:'Alta', ruc:'', precio:'40.000,00', gates:{}, gatesDoc:pleno, scores:notas(1)},
      {id:'b', nombre:'Barata', ruc:'', precio:'30000', gates:{}, gatesDoc:pleno, scores:notas(0.8)},
      {id:'c', nombre:'Corta', ruc:'', precio:'20000', gates:{}, gatesDoc:pleno, scores:notas(0.7)},
    ];
    render();`);
R = ev('compute()');
const por = n => R.ranked.concat(ev('S.oferentes')).find(o => o.nombre === n);
ok(por('Alta')._tec === 80 && por('Barata')._tec === 64, 'técnico: 80 y 64 sobre 80', por('Alta')._tec + ' / ' + por('Barata')._tec);
ok(!por('Barata')._pasa && !por('Corta')._pasa, 'con umbral 75 solo pasa Alta');
ok(R.winner && R.winner.nombre === 'Alta' && R.winner._total === 100, 'Alta gana con 80 + 20 = 100', R.winner && R.winner._total);
ev('S.umbralTecnico = 60; render();');
R = ev('compute()');
ok(por('Barata')._pasa && por('Barata')._eco === 20 && por('Alta')._eco === 15, 'con umbral 60 pasa Barata; económico inverso: 20 y 15', por('Barata')._eco + ' / ' + por('Alta')._eco);
ok(R.winner && R.winner.nombre === 'Alta', 'Alta sigue primera (95 contra 84)', R.winner && R.winner._total);
ok(ev("S.oferentes.find(o=>o.id==='c')._motivo") === 'No alcanza el umbral técnico (60)', 'el motivo dice el umbral real, no 75', ev("S.oferentes.find(o=>o.id==='c')._motivo"));

seccion('5. Sin errores de JavaScript');
ok(errores.length === 0, 'ningún error en todo el recorrido', errores.join(' | '));

console.log(`\n${fallos ? '✗' : '✓'} ${pruebas - fallos}/${pruebas} comprobaciones bien.`);
process.exit(fallos ? 1 : 0);
