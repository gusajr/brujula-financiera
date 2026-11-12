import test from 'node:test';
import assert from 'node:assert/strict';
import {allocationAmounts,migrateProfile,orderDebts,parseAmount,payoff,suggestedAllocation,summarizeItems} from '../dist/financial-details.js';
import {diagnose,plan} from '../dist/model.js';
import {zeroPositionReason} from '../dist/risk-ui.js';
import {sizePosition} from '../dist/risk-model.js';

const profile = {goal:'Crear una reserva',currency:'MXN',income:30000,expenses:18000,essentials:12000,debtPayment:0,debt:0,savings:20000,capital:5000,horizon:'Más de 3 años',experience:'Estoy empezando',tolerance:'Hasta 5%'};

test('Suma gastos, esenciales, ingresos y conserva los subtotales de perfiles anteriores',()=>{
  const expenses=summarizeItems('expenseItems',[{label:'Renta',amount:'8,000',essential:true},{label:'Comida',amount:'5000',essential:true},{label:'Transporte',amount:'2000',essential:false,note:'Metro y autobús'}]);
  assert.deepEqual(expenses.totals,{expenses:15000,essentials:13000});
  assert.equal(expenses.items[2].note,'Metro y autobús');
  assert.deepEqual(summarizeItems('incomeItems',[{label:'Sueldo',amount:'26000'},{label:'Honorarios',amount:'4000'}]).totals,{income:30000});
  const migrated=migrateProfile(profile);
  assert.deepEqual(summarizeItems('expenseItems',migrated.expenseItems).totals,{expenses:18000,essentials:12000});
  assert.equal(migrated.incomeItems[0].amount,30000);
  assert.equal(diagnose(migrated).target,36000);
});

test('Detecta filas incompletas, listas en un solo importe y ceros por confirmar',()=>{
  assert.equal(parseAmount('8,000, 5,000'),null);
  assert.equal(parseAmount('8,000.50'),8000.5);
  assert.match(summarizeItems('expenseItems',[{label:'Renta',amount:'renta 8000, comida 5000'}]).errors[0].message,/Monto mensual de Renta/);
  assert.deepEqual(summarizeItems('incomeItems',[{label:'',amount:''}]).errors.map(x=>x.field),['label','amount']);
  assert.equal(summarizeItems('incomeItems',[]).needsZero,true);
  assert.equal(summarizeItems('incomeItems',[],true).needsZero,false);
  assert.equal(summarizeItems('debtItems',[{label:'Tarjeta',balance:45000,payment:5000,minimum:2500}]).errors[0].field,'rate');
});

test('Ordena deudas y estima amortización con pagos actuales y extra',()=>{
  const card={label:'Tarjeta',balance:45000,rate:40,payment:5000,minimum:2500};
  const loan={label:'Préstamo',balance:10000,rate:12,payment:800,minimum:700};
  assert.deepEqual(orderDebts([loan,card]).map(x=>x.label),['Tarjeta','Préstamo']);
  assert.deepEqual(orderDebts([card,loan],'snowball').map(x=>x.label),['Préstamo','Tarjeta']);
  assert.deepEqual(summarizeItems('debtItems',[card,loan]).totals,{debt:55000,debtPayment:5800});
  assert.equal(payoff(45000,40,5000).months,11);
  assert.equal(payoff(45000,40,12000).months,5);
  assert.ok(payoff(45000,40,5000).interest > payoff(45000,40,12000).interest);
  assert.equal(payoff(45000,40,1500),null);
  assert.deepEqual(payoff(10000,0,3000),{months:4,interest:0});
});

test('Prioriza deuda y reserva con carga superior a 30%, flujo insuficiente o reserva incompleta',()=>{
  const debt={...profile,debt:45000,debtPayment:10000,savings:100000,debtItems:[{label:'Tarjeta',balance:45000,rate:40,payment:10000,minimum:5000}]};
  const d=diagnose(debt);
  assert.equal(d.priority,true);
  assert.equal(plan(debt,d,{months:3})[0][0],'Pagar deudas por costo');
  assert.equal(suggestedAllocation(debt,d,5000,3).weights.stocks,0);
  assert.equal(diagnose({...profile,income:18000,savings:50000}).priority,true);
  const clean=diagnose({...profile,savings:50000});
  assert.equal(clean.priority,false);
  assert.equal(plan(profile,clean,{months:3}).some(([title])=>title.includes('Pagar deudas')),false);
});

test('Distribución cierra en 100% y conserva los centavos',()=>{
  const d=diagnose(profile);
  const {weights}=suggestedAllocation(profile,d,12000,3);
  assert.equal(weights.reserve,75);
  assert.equal(weights.stocks,0);
  assert.equal(Object.values(weights).reduce((a,b)=>a+b),100);
  assert.deepEqual(allocationAmounts(12000,weights),{reserve:9000,debt:0,fixed:0,stocks:0,cash:3000});
  const clean={...profile,savings:50000};
  const open=suggestedAllocation(clean,diagnose(clean),5000,3).weights;
  assert.ok(open.fixed>open.stocks);
  assert.equal(suggestedAllocation({...clean,horizon:'Menos de 1 año'},diagnose(clean),5000,3).weights.stocks,0);
  assert.equal(Object.values(allocationAmounts(100.03,open)).reduce((a,b)=>a+Math.round(b*100),0),10003);
});

test('El simulador explica qué presupuesto impide comprar una acción',()=>{
  const r={period:'Noviembre',budget:600,perTrade:375,realized:0,openRisk:0,invested:0,concentration:100,entry:214.16,stop:180,fx:19,cost:0};
  const result=sizePosition(10000,r);
  assert.equal(result.qty,0);
  assert.match(zeroPositionReason(result,r,n=>n.toFixed(2)),/649.04.*375.00/);
});
