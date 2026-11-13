import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseRates,parseClose,series} from '../scripts/refresh-market.mjs';
import {mergeMarket,quote} from '../dist/market-data.js';
import {matchingLoans,simulatorUrl} from '../dist/loan-comparison.js';
import {reconcileAllocation} from '../dist/financial-details.js';
import {suggestedPanel} from '../dist/financial-strategy.js';

test('Banxico toma la última observación válida, con fecha y serie',()=>{
  const input={bmx:{series:Object.values(series).map(idSerie=>({idSerie,datos:[
    {fecha:'13/11/2026',dato:'99'},{fecha:'12/11/2026',dato:'N/E'},{fecha:'11/11/2026',dato:'6.20'}
  ]}))}};
  assert.deepEqual(parseRates(input,'2026-11-12').cetes28,{valor:6.2,fecha:'2026-11-11',fuente:'Banxico SIE',serie:'SF43936'});
  input.bmx.series.pop();
  assert.throws(()=>parseRates(input,'2026-11-12'),/falta la serie/);
});

test('Yahoo omite la sesión en curso y el archivo conserva el cierre ante fallas',()=>{
  const epoch=s=>Date.parse(s)/1000;
  const start=epoch('2026-11-12T14:30:00Z'), end=epoch('2026-11-12T21:00:00Z');
  const chart={chart:{result:[{meta:{symbol:'CAT',currency:'USD',currentTradingPeriod:{regular:{start,end}}},timestamp:[start-86400,start],indicators:{quote:[{close:[100,105]}]}}]}};
  const close=parseClose(chart,'CAT',new Date('2026-11-12T19:00:00Z'));
  assert.equal(close.valor,100);
  const previous=[{ticker:'CAT',price:90,cierre:close}];
  assert.equal(quote(mergeMarket(previous,[{ticker:'CAT',price:90}])[0]).valor,100);
  assert.throws(()=>mergeMarket(previous,[{ticker:'CAT',cierre:{valor:'error'}}]),/Cierre inválido/);
  assert.equal(quote(previous[0]).fecha,'2026-11-11');
});

test('Retirar la deuda reasigna sus 60 puntos sin borrar las demás asignaciones',()=>{
  const saved={reserve:0,debt:60,fixed:10,stocks:5,cash:25};
  const profile={currency:'MXN',debt:0,debtPayment:0,debtItems:[],capital:5000,horizon:'Más de 3 años',tolerance:'Hasta 5%',allocationChoices:{monthly:saved}};
  const diagnosis={free:17000,gap:0,coverage:3,priority:false};
  const html=suggestedPanel(profile,diagnosis,{months:3});
  assert.match(html,/name="debt"[^>]*value="0" disabled/);
  assert.match(html,/data-allocation="debt">0\.00 MXN/);
  const result=reconcileAllocation(saved,{reserve:0,debt:0,fixed:64,stocks:20,cash:16},false);
  assert.equal(Math.round(Object.values(result).reduce((a,b)=>a+b,0)*100),10000);
  assert.ok(result.fixed>=saved.fixed && result.stocks>=saved.stocks && result.cash>=saved.cash);
  assert.equal(saved.debt,60);
});

test('CONDUSEF usa el escenario publicado y enlaza monto y plazo exactos',()=>{
  const snapshot=JSON.parse(readFileSync(new URL('../dist/loans.json',import.meta.url),'utf8'));
  const rows=matchingLoans(snapshot,20000,12);
  assert.ok(new Set(rows.map(row=>row[0])).size>=3);
  assert.equal(rows.find(row=>row[0]==='HSBC')[5],25596.90);
  assert.deepEqual(matchingLoans(snapshot,21000,12),[]);
  const query=new URL(simulatorUrl(21000,24)).searchParams;
  assert.equal(query.get('monto'),'21,000');
  assert.equal(query.get('plazo'),'24');
});
