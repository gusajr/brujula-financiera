import test from 'node:test';import assert from 'node:assert/strict';import {candidates,allocation} from '../dist/strategy-extras.js';
import {readFileSync} from 'node:fs';
import {stockNames} from '../dist/strategy-extras.js';
import {debtPanel,debtProjection,suggestedPanel} from '../dist/financial-strategy.js';
import {detailEditor} from '../dist/detail-editor.js';

test('La selección real usa el movimiento y la tolerancia antes de elegir las seis',()=>{
  const rows=JSON.parse(readFileSync(new URL('../dist/market.json',import.meta.url),'utf8'));
  const historic=rows.filter(row=>Object.hasOwn(stockNames,row.ticker)&&row.price>0&&Number.isFinite(row[12]))
    .sort((a,b)=>b[12]-a[12]).slice(0,6).map(row=>row.ticker);
  const conservative=candidates(rows,'Más de 3 años','Hasta 5%').map(row=>row.ticker);
  const higherTolerance=candidates(rows,'Más de 3 años','Más de 15%').map(row=>row.ticker);
  assert.equal(conservative.length,6);
  assert.notDeepEqual([...conservative].sort(),historic.sort());
  assert.notDeepEqual([...conservative].sort(),higherTolerance.sort());
});

test('El monto mensual sugerido y el usado para proyectar la deuda coinciden',()=>{
  const profile={currency:'MXN',debt:45000,debtPayment:5000,capital:1000,tolerance:'Hasta 5%',horizon:'Más de 3 años',debtItems:[{label:'Tarjeta',balance:45000,rate:30,payment:5000,minimum:2500}]};
  const diagnosis={free:12000,gap:20000,coverage:1.3,priority:true};
  const rules={months:3};
  assert.match(suggestedPanel(profile,diagnosis,rules),/data-allocation="debt">7,200\.00 MXN/);
  assert.match(debtPanel(profile,diagnosis,rules),/Pago extra mensual según la distribución: 7,200\.00 MXN/);
  const edited={...profile,allocationChoices:{monthly:{reserve:35,debt:30,fixed:0,stocks:0,cash:35}}};
  assert.match(debtPanel(edited,diagnosis,rules),/3,600\.00 MXN/);
  assert.ok(debtProjection(edited,3600).accelerated.months>debtProjection(profile,7200).accelerated.months);
  const second={label:'Préstamo',balance:10000,rate:12,payment:1000,minimum:700};
  assert.equal(debtProjection({...profile,debtItems:[...profile.debtItems,second],debtMethod:'snowball'},7200).first.label,'Préstamo');
});

test('Mis respuestas muestra las deudas guardadas aunque exista un borrador antiguo vacío',t=>{
  let draft={currency:'MXN',rows:[{label:'',balance:'',rate:'',payment:'',minimum:''}]};
  const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:key=>{
    assert.equal(key,'brujula-single-user-drafts-v1');
    return JSON.stringify({'details-edit-debtItems':draft});
  }}});
  t.after(()=>original?Object.defineProperty(globalThis,'localStorage',original):delete globalThis.localStorage);
  const profile={currency:'MXN',debtItems:[{label:'Tarjeta',balance:45000,rate:30,payment:5000,minimum:2500},{label:'Préstamo',balance:10000,rate:12,payment:1000,minimum:700}]};
  const html=detailEditor('debtItems',profile,'edit');
  for(const [field,value] of Object.entries(profile.debtItems[0])) assert.ok(html.includes(`data-item="${field}" value="${value}"`));
  assert.match(html,/data-item="label" value="Préstamo"/);
  assert.equal((html.match(/data-item="label"/g)||[]).length,2);
  draft={...draft,baseline:JSON.stringify(profile.debtItems),rows:[{...profile.debtItems[0],rate:'32'},profile.debtItems[1]]};
  assert.match(detailEditor('debtItems',profile,'edit'),/data-item="rate" value="32"/);
});
test('Preselección ordena por ventana, excluye ETF y no inventa datos',()=>{const rows=[{ticker:'CAT',price:100,'1':10,'6':30,'12':5},{ticker:'NET',price:50,'1':5,'6':10,'12':100},{ticker:'SOXL',price:20,'1':500,'6':100,'12':600},{ticker:'NIO',price:0,'1':300,'12':200}];assert.equal(candidates(rows,'Menos de 1 año')[0].ticker,'CAT');assert.equal(candidates(rows,'Más de 3 años')[0].ticker,'NET');assert.equal(candidates(rows,'Más de 3 años').length,2);});
test('Distribución suma el capital sin añadir reserva ni presupuesto de pérdida',()=>{const r={currency:'MXN',period:'noviembre',budget:500,perTrade:100,realized:0,openRisk:0,invested:2000,concentration:20,entry:10,stop:9,cost:0,fx:20};const a=allocation(10000,r,'MXN');assert.equal(a.invested,2000);assert.equal(a.simulated,1000);assert.equal(a.available,7000);assert.equal(a.invested+a.simulated+a.available,10000);assert.equal(allocation(10000,r,'USD').invested,0);assert.equal(allocation(0,r,'MXN'),null);assert.equal(allocation(1000,r,'MXN'),null);});
