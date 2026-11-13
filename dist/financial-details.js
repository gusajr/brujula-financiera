export function parseAmount(raw) {
  const input = String(raw).trim().replace(/^(?:MXN|USD|EUR|\$|€)\s*/i, '').replace(/\s*(?:MXN|USD|EUR)$/i, '');
  let normalized;
  if (/^\d+(?:[.,]\d+)?$/.test(input) && !/^\d{1,3},\d{3}$/.test(input)) normalized = input.replace(',', '.');
  else if (/^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(input)) normalized = input.replaceAll(',', '');
  else if (/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(input)) normalized = input.replaceAll('.', '').replace(',', '.');
  const number = Number(normalized);
  return Number.isFinite(number) && number >= 0 && number <= 1e12 ? number : null;
}

export function summarizeItems(kind, rows, confirmedZero = false) {
  const items = [];
  const errors = [];
  rows.forEach((row, index) => {
    const label = row.label?.trim() || '';
    if (!label) errors.push({index, field:'label', message:'Escribe el nombre de este rubro.'});
    const item = {label};
    const fields = kind === 'debtItems' ? {balance:'Saldo', rate:'Tasa anual', payment:'Pago mensual', minimum:'Pago mínimo'} : {amount:'Monto mensual'};
    for (const [field, title] of Object.entries(fields)) {
      const value = parseAmount(row[field] ?? '');
      if (value === null || (field === 'balance' && value === 0)) {
        const example = label || (kind === 'incomeItems' ? 'Sueldo' : kind === 'debtItems' ? 'Tarjeta' : 'Vivienda');
        errors.push({index, field, message:`${title} de ${example}: ${field === 'balance' ? 'escribe un monto mayor a cero' : 'escribe un número mayor o igual a cero'}, por ejemplo ${field === 'rate' ? '40' : '8000'}. Usa una fila por rubro.`});
      }
      item[field] = value;
    }
    if (kind === 'expenseItems') Object.assign(item, {essential:!!row.essential, note:row.note?.trim() || ''});
    items.push(item);
  });
  const sum = (field, filter = () => true) => Math.round(items.filter(filter).reduce((total, item) => total + (item[field] ?? 0), 0) * 100) / 100;
  const totals = kind === 'debtItems' ? {debt:sum('balance'), debtPayment:sum('payment')}
    : kind === 'expenseItems' ? {expenses:sum('amount'), essentials:sum('amount', item => item.essential)} : {income:sum('amount')};
  return {items, totals, errors, needsZero:kind !== 'debtItems' && !errors.length && Object.values(totals)[0] === 0 && !confirmedZero};
}

export function migrateProfile(profile) {
  const result = {...profile};
  if (!Array.isArray(result.incomeItems) && Number.isFinite(result.income)) result.incomeItems = [{label:'Ingresos anteriores', amount:result.income}];
  if (!Array.isArray(result.expenseItems) && Number.isFinite(result.expenses)) {
    if (Number.isFinite(result.essentials)) {
      const essential = Math.max(0, Math.min(result.expenses, result.essentials));
      result.expenseItems = [{label:'Gastos anteriores', amount:essential, essential:true, note:'Subtotal esencial del diagnóstico anterior'}];
      if (result.expenses > essential) result.expenseItems.push({label:'Gastos anteriores no esenciales', amount:result.expenses-essential, essential:false, note:''});
    }
  }
  return result;
}

export function orderDebts(debts, method = 'avalanche') {
  return [...debts].sort((a,b) => method === 'snowball' ? a.balance-b.balance || b.rate-a.rate : b.rate-a.rate || a.balance-b.balance);
}

export function payoff(balance, annualRate, payment) {
  if (![balance,annualRate,payment].every(Number.isFinite) || balance < 0 || annualRate < 0 || payment <= 0) return null;
  const rate = annualRate / 1200;
  if (balance === 0) return {months:0, interest:0};
  if (payment <= balance*rate) return null;
  let remaining = balance;
  let interest = 0;
  for (let months = 1; months <= 1200; months++) {
    const accrued = remaining * rate;
    interest += accrued;
    remaining += accrued - payment;
    if (remaining < 1e-8) return {months, interest:Math.round(interest*100)/100};
  }
  return null;
}

export const allocationLabels = {reserve:'Reserva de emergencia', debt:'Pago extra a deudas', fixed:'Renta fija / deuda', stocks:'Bolsa (acciones)', cash:'Sin asignar / liquidez'};
export const hasRecordedDebt = profile => profile.debt > 0 || profile.debtPayment > 0 || Boolean(profile.debtItems?.length);

export function reconcileAllocation(weights, suggested, hasDebt) {
  if (!weights) return suggested;
  if (hasDebt || weights.debt === 0) return weights;
  const cents = Math.round(weights.debt * 100);
  const eligible = Object.keys(allocationLabels).filter(key => key !== 'debt' && suggested[key] > 0);
  const total = eligible.reduce((sum,key) => sum + suggested[key],0);
  const result = {...weights,debt:0};
  let remaining = cents;
  eligible.forEach((key,index)=>{
    const add = index===eligible.length-1 ? remaining : Math.floor(cents*suggested[key]/total);
    remaining -= add;
    result[key] = (Math.round(weights[key]*100)+add)/100;
  });
  return result;
}

export function suggestedAllocation(profile, diagnosis, amount, monthCount) {
  const topRate = orderDebts(profile.debtItems || [])[0]?.rate;
  const expensiveDebt = profile.debt > 0 && (topRate === undefined || topRate >= 20);
  const shortHorizon = profile.horizon === 'Menos de 1 año';
  const lowTolerance = /^hasta\s+5\s*%/i.test(profile.tolerance || '');
  const guarded = diagnosis.priority;
  const reserveShare = diagnosis.gap > 0 ? (expensiveDebt ? 35 : 75) : 0;
  const debtShare = profile.debt > 0 ? (expensiveDebt || guarded ? (diagnosis.gap > 0 ? 60 : 90) : 25) : 0;
  const reserve = Math.min(reserveShare, Math.floor(diagnosis.gap / amount * 100) || 0);
  const debt = Math.min(debtShare, 100-reserve, Math.floor(profile.debt / amount * 100) || 0);
  const remaining = 100-reserve-debt;
  const stocks = guarded || shortHorizon || expensiveDebt ? 0 : Math.floor(remaining * (lowTolerance ? 0.2 : 0.5));
  const fixed = guarded || expensiveDebt ? 0 : Math.floor((remaining-stocks)*0.8);
  const reason = [diagnosis.gap > 0 && `Tu reserva cubre ${(diagnosis.coverage ?? 0).toFixed(1)} de ${monthCount} meses`, topRate !== undefined && profile.debt > 0 && `la mayor tasa registrada es ${topRate}% anual`, shortHorizon && 'el horizonte menor a un año deja la bolsa en 0%', lowTolerance && !guarded && !shortHorizon && 'tu tolerancia baja da más peso a renta fija', guarded && 'la regla de prioridad deja la bolsa en 0%'].filter(Boolean);
  return {weights:{reserve,debt,fixed,stocks,cash:100-reserve-debt-fixed-stocks}, reason:reason.length ? `${reason.join('. ')}.` : 'Tu horizonte, tolerancia y liquidez orientan esta distribución.'};
}

export function allocationAmounts(total, weights) {
  const keys = Object.keys(allocationLabels);
  const cents = Math.round(total*100);
  const amounts = {};
  let assigned = 0;
  for (const key of keys) {
    amounts[key] = Math.floor(cents * weights[key] / 100 + 1e-7);
    assigned += amounts[key];
  }
  const remainder = keys.find(key => weights[key] > 0);
  if (remainder) amounts[remainder] += cents-assigned;
  return Object.fromEntries(keys.map(key=>[key,amounts[key]/100]));
}
