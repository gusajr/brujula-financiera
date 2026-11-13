export function simulatorUrl(amount,months){
  const format=value=>new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(value);
  const params=new URLSearchParams({a:'7',idix:'',ingresos:'10,000',monto:format(amount),mostrar:'2',ordenar_por:'7',periodicidad:'mensual',plazo:String(months),proviene:'captura'});
  params.append('nomina_url','');params.append('nomina_url','1');
  params.append('personal_url','');params.append('personal_url','1');
  return 'https://phpapps.condusef.gob.mx/condusef_personalnomina/comparativo.php?'+params;
}
export function matchingLoans(data,amount,months){
  return data?.monto===amount && data?.plazo===months ? data.filas : [];
}

export function loanPanel(profile,d,loans){
  const amount=profile.currency==='MXN' && d.free>0 ? Math.max(1,Math.round(d.free)) : 20000;
  return `<section class="card strategy-card"><h2>Comparativo histórico de préstamos</h2><p>Datos históricos CONDUSEF, base de cálculo ${loans?.mes==='2026-10'?'octubre de 2026':'sin datos'}. No son ofertas vigentes.</p><form id="loan-scenario" class="settings"><label>Monto (MXN)<input name="amount" type="number" min="1" step="1" value="${amount}" required></label><label>Plazo (meses)<input name="months" type="number" min="1" step="1" value="12" required></label></form><div id="loan-data"></div><p class="chart-note">La deuda añade un pago obligatorio aunque la inversión pierda valor. Con deuda cara, reserva insuficiente o un horizonte corto, el costo y el riesgo de liquidez pesan más. Brújula no recomienda apalancarse ni ofrece préstamos.</p></section>`;
}

export function bindLoanPanel(loans){
  const form=document.querySelector('#loan-scenario');
  if(!form)return;
  const refresh=()=>{
    const amount=form.elements.amount.valueAsNumber, months=form.elements.months.valueAsNumber;
    const target=document.querySelector('#loan-data');
    if(!Number.isInteger(amount)||amount<=0||!Number.isInteger(months)||months<=0){target.textContent='Escribe un monto y un plazo válidos.';return;}
    const money=value=>Number.isFinite(value)?value.toLocaleString('es-MX',{style:'currency',currency:'MXN'})+' MXN':'sin datos';
    const rate=value=>Number.isFinite(value)?value.toFixed(2)+'%':'sin datos';
    const rows=matchingLoans(loans,amount,months);
    target.innerHTML=(rows.length ? `<p class="chart-note">Escenario publicado: ingreso de referencia de ${money(loans.ingresoReferencia)}, pagos mensuales.</p><div class="table-scroll"><table><thead><tr><th>Institución</th><th>Tipo</th><th>Tasa anual</th><th>CAT</th><th>Pago mensual publicado</th><th>Pago total</th></tr></thead><tbody>${rows.map(([institution,type,annual,cat,payment,total])=>`<tr><td>${institution}</td><td>${type}</td><td>${rate(annual)}</td><td>${rate(cat)}</td><td>${money(payment)}</td><td>${money(total)}</td></tr>`).join('')}</tbody></table></div>` : '<p>Sin datos históricos para este monto y plazo. El archivo de octubre de 2026 cubre $20,000 MXN a 12 meses.</p>')+`<p><a href="${simulatorUrl(amount,months).replaceAll('&','&amp;')}" target="_blank" rel="noopener">Consultar este monto y plazo en CONDUSEF ↗</a></p>`;
  };
  form.oninput=refresh;
  form.onsubmit=event=>event.preventDefault();
  refresh();
}
