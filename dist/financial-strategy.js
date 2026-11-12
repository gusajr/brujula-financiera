import {clearDraft} from './drafts.js';
import {allocationAmounts, allocationLabels, orderDebts, payoff, suggestedAllocation} from './financial-details.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const money = (value, currency) => `${value.toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2})} ${esc(currency)}`;

export function debtPanel(profile, diagnosis) {
  if (!profile.debt && !profile.debtPayment) return '<p class="muted">Sin deudas registradas.</p>';
  if (!profile.debtItems?.length) return '<section class="card strategy-card"><h2>Orden de pago de deudas</h2><p>Completa las tasas y pagos mínimos para comparar costos y plazos.</p><button class="secondary" data-go="diagnostico">Completar detalle de deudas</button></section>';
  const method = profile.debtMethod || 'avalanche';
  const ordered = orderDebts(profile.debtItems,method);
  const mostExpensive = orderDebts(profile.debtItems)[0];
  const free = Math.max(0,diagnosis.free);
  const current = payoff(mostExpensive.balance,mostExpensive.rate,mostExpensive.payment);
  const accelerated = payoff(mostExpensive.balance,mostExpensive.rate,mostExpensive.payment+free);
  const first = ordered[0];
  const weights = profile.allocationChoices?.monthly || suggestedAllocation(profile,diagnosis,free || 1,0).weights;
  const extra = Math.min(first.balance,allocationAmounts(free,weights).debt);
  const estimate = current && accelerated && free>0 ? `En ${esc(mostExpensive.label)}, aplicar ${money(free,profile.currency)} extra al mes reduciría el plazo de ${current.months} a ${accelerated.months} meses y evitaría aproximadamente ${money(Math.max(0,current.interest-accelerated.interest),profile.currency)} de interés.` : 'Para comparar el interés evitado hacen falta excedente mensual y un pago actual que reduzca el saldo.';
  return `<section class="card strategy-card"><h2>Orden de pago de deudas</h2><p>Mantén los pagos mínimos de todas las deudas. El método elegido indica dónde concentrar el pago extra.</p><label>Método <select id="debt-method"><option value="avalanche" ${method==='avalanche'?'selected':''}>Avalancha · tasa más alta primero</option><option value="snowball" ${method==='snowball'?'selected':''}>Bola de nieve · saldo más bajo primero</option></select></label><p style="margin-top:16px"><b>Primero: ${esc(first.label)}</b>. Saldo ${money(first.balance,profile.currency)}. Pago actual ${money(first.payment,profile.currency)} al mes. La distribución mensual asigna ${money(extra,profile.currency)} de pago extra. ${method==='snowball'?'Es el saldo más pequeño.':`Tiene la tasa más alta registrada (${first.rate}% anual).`}</p><div class="table-scroll"><table><thead><tr><th>Deuda</th><th>Saldo</th><th>Tasa anual</th><th>Pago actual / mínimo</th><th>Meses estimados</th></tr></thead><tbody>${ordered.map(item=>{const estimate=payoff(item.balance,item.rate,item.payment);return `<tr><td>${esc(item.label)}</td><td>${money(item.balance,profile.currency)}</td><td>${item.rate}%</td><td>${money(item.payment,profile.currency)} / ${money(item.minimum,profile.currency)}</td><td>${estimate?.months ?? 'Pago insuficiente o plazo mayor a 100 años'}</td></tr>`;}).join('')}</tbody></table></div><p style="margin-top:14px">${estimate}</p><p class="chart-note">Estimación con tasa anual nominal dividida entre 12, interés mensual sobre el saldo y pagos constantes al cierre de cada mes. Excluye comisiones, compras nuevas y penalizaciones por prepago.</p><a class="text-button" href="https://files.consumerfinance.gov/f/documents/cfpb_ymyg_a-financial-empowerment-toolkit_large-print.pdf" target="_blank" rel="noopener">Métodos de pago · CFPB ↗</a></section>`;
}

export function fixedIncomePanel(profile) {
  const short = profile.horizon==='Menos de 1 año';
  const currency = esc(profile.currency);
  const instruments = [
    [profile.currency==='MXN'?'CETES / deuda gubernamental':'Deuda gubernamental de corto plazo',`Para compromisos con fecha en ${currency}.`,`Busca un vencimiento previo a tu fecha objetivo.`, 'Disponibilidad al vencimiento. La venta previa depende del canal.', 'Riesgo de precio si vendes antes y de inflación.'],
    ['Bonos', 'Para flujos periódicos o una meta con fecha.',short?'Considera solo vencimientos compatibles con tu horizonte corto.':'Pueden evaluarse para plazos de varios años.', 'Venta sujeta a mercado y precio.', 'Riesgo de tasas y de incumplimiento del emisor.'],
    ['Fondos de deuda', 'Para invertir en una cartera de títulos de deuda.',short?'Revisa fondos de duración corta.':'Compara duración y calidad crediticia.', 'Consulta horarios y plazo de retiro en el prospecto.', 'El valor puede bajar por tasas o deterioro del crédito.'],
    ['Pagarés', 'Para separar dinero hasta una fecha acordada.',`Compara plazos en ${currency} compatibles con tu objetivo.`, 'Por lo general se dispone del dinero al vencimiento. Revisa el contrato.', 'Riesgo del emisor y restricciones de retiro.']
  ];
  return `<section class="card strategy-card"><h2>Renta fija y deuda</h2><p class="muted">Compara alternativas denominadas en ${currency} y acordes con tu horizonte. Estas fichas describen categorías de instrumentos.</p><div class="fixed-grid">${instruments.map(([title,use,horizon,liquidity,risk])=>`<article class="candidate"><h3>${title}</h3><p>${use}</p><dl><dt>Horizonte</dt><dd>${horizon}</dd><dt>Liquidez</dt><dd>${liquidity}</dd><dt>Riesgo</dt><dd>${risk}</dd></dl></article>`).join('')}</div><p class="chart-note"><a href="https://www.cetesdirecto.com/sites/portal/productos.cetesdirecto" target="_blank" rel="noopener">Cetesdirecto</a> · <a href="https://www.investor.gov/introduction-investing/investing-basics/glossary/bond-funds-and-income-funds" target="_blank" rel="noopener">Investor.gov</a></p></section><section class="card strategy-card"><h2>Préstamos: ¿pedir prestado para invertir?</h2><p>La deuda añade un pago obligatorio aunque la inversión pierda valor. Con deuda cara, reserva insuficiente o un horizonte corto, el costo y el riesgo de liquidez pesan más. Brújula no recomienda apalancarse ni ofrece préstamos.</p></section>`;
}

export function suggestedPanel(profile, diagnosis, rules) {
  const sources = {monthly:Math.max(0,diagnosis.free),capital:profile.capital};
  const active = sources[profile.allocationSource]>0 ? profile.allocationSource : sources.monthly>0 ? 'monthly' : 'capital';
  const amount = sources[active];
  if (!amount) return '<section class="card strategy-card"><h2>Tu distribución sugerida</h2><p>Cuando registres excedente mensual o capital adicional podrás distribuirlo aquí.</p></section>';
  const suggestion = suggestedAllocation(profile,diagnosis,amount,rules.months);
  const weights = profile.allocationChoices?.[active] || suggestion.weights;
  const amounts = allocationAmounts(amount,weights);
  const first = orderDebts(profile.debtItems||[], profile.debtMethod)[0];
  const notes = {reserve:`Meta de ${rules.months} meses`,debt:first?`Primero a ${esc(first.label)}`:'Según el método de pago',fixed:'Según moneda y horizonte',stocks:'Sujeto a los límites de riesgo',cash:'Disponible para necesidades próximas'};
  return `<section class="card strategy-card"><h2>Tu distribución sugerida</h2><p>Orientación de presupuesto. Revisa cada instrumento y sus riesgos antes de decidir.</p><label>Distribuir <select id="allocation-source">${Object.entries(sources).filter(([,total])=>total>0).map(([key,total])=>`<option value="${key}" ${key===active?'selected':''}>${key==='monthly'?'Excedente mensual':'Capital adicional'} · ${money(total,profile.currency)}</option>`).join('')}</select></label><p class="chart-note" style="margin-top:12px">Cada base es un escenario separado. Si combinas ambas, revisa cuánto falta para cada meta antes de asignar dinero.</p><p class="muted">${esc(suggestion.reason)} ${profile.allocationChoices?.[active]?'Estás viendo tus porcentajes guardados.':''}</p><form id="allocation-${active}" data-allocation-form data-source="${active}" data-amount="${amount}"><div class="table-scroll"><table><thead><tr><th>Destino</th><th>Porcentaje</th><th>Monto</th></tr></thead><tbody>${Object.entries(allocationLabels).map(([key,label])=>`<tr><td>${label}<br><small class="muted">${notes[key]}</small></td><td><input name="${key}" type="number" aria-label="Porcentaje de ${label}" min="0" max="100" step="0.01" value="${weights[key]}" required> %</td><td data-allocation="${key}">${money(amounts[key],profile.currency)}</td></tr>`).join('')}</tbody></table></div><p data-weight-total role="status">Total: 100% · ${money(amount,profile.currency)}</p><button class="primary">Guardar distribución</button> <button type="button" class="secondary" id="restore-suggestion">Usar porcentajes sugeridos</button></form><p class="chart-note" style="margin-top:12px">Revisa esta distribución cuando cambie tu ingreso, tu deuda o tu reserva.</p></section>`;
}

export function bindFinancialStrategy(profile, commit) {
  const method = document.querySelector('#debt-method');
  if (method) method.onchange = () => commit({...profile,debtMethod:method.value});
  const source = document.querySelector('#allocation-source');
  if (source) source.onchange = () => commit({...profile,allocationSource:source.value});
  const form = document.querySelector('[data-allocation-form]');
  if (!form) return;
  const amount = Number(form.dataset.amount);
  const key = form.dataset.source;
  const refresh = () => {
    const fields = Object.keys(allocationLabels);
    const weights = Object.fromEntries(fields.map(field=>[field,form.elements[field].valueAsNumber]));
    const valid = fields.every(field=>Number.isFinite(weights[field])&&weights[field]>=0&&weights[field]<=100);
    const sum = fields.reduce((total,field)=>total+(weights[field]||0),0);
    const complete = valid && Math.abs(sum-100)<1e-7;
    const amounts = complete ? allocationAmounts(amount,weights) : Object.fromEntries(fields.map(field=>[field,amount*(weights[field]||0)/100]));
    for (const field of fields) form.querySelector(`[data-allocation="${field}"]`).textContent = money(amounts[field],profile.currency);
    form.querySelector('[data-weight-total]').textContent = `Total: ${Number(sum.toFixed(2))}% · ${money(amount*sum/100,profile.currency)}${complete?'':'. Ajusta los porcentajes para que sumen 100%.'}`;
    form.querySelector('button.primary').disabled = !complete;
    return complete ? weights : null;
  };
  form.oninput = refresh;
  form.onsubmit = event => {
    event.preventDefault();
    const weights = refresh();
    if (weights) commit({...profile,allocationChoices:{...profile.allocationChoices,[key]:weights}});
  };
  document.querySelector('#restore-suggestion').onclick = () => {
    const allocationChoices = {...profile.allocationChoices};
    delete allocationChoices[key];
    clearDraft(form.id);
    commit({...profile,allocationChoices});
  };
  refresh();
}
