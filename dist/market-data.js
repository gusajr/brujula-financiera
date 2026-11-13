const repo='https://raw.githubusercontent.com/gusajr/brujula-financiera/master/dist/';
export const archiveDate='2026-10-29';
export const rateNames={cetes28:'CETES 28 días',cetes91:'CETES 91 días',cetes182:'CETES 182 días',cetes364:'CETES 364 días',tiie28:'TIIE 28 días',objective:'Tasa objetivo',fix:'Tipo de cambio FIX'};
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const dataDate=date=>date ? new Intl.DateTimeFormat('es-MX',{dateStyle:'medium',timeZone:'UTC'}).format(new Date(date+'T00:00:00Z')) : 'sin fecha';
const dated=(item,source)=>item && /^\d{4}-\d{2}-\d{2}$/.test(item.fecha) && Number.isFinite(Date.parse(item.fecha)) && item.fuente===source && Number.isFinite(item.valor);
export const quote=row=>row.cierre || {valor:row.price,fecha:archiveDate,fuente:'StockEx · CSV'};
export const citeDatum=item=>`${dataDate(item.fecha)} · ${escape(item.fuente)}`;
export function ratesPanel(data){
  return `<div class="table-scroll"><table><thead><tr><th>Indicador</th><th>Valor</th><th>Observación y fuente</th></tr></thead><tbody>${Object.entries(rateNames).map(([key,label])=>{
    const item=data?.datos?.[key];
    const valid=dated(item,'Banxico SIE');
    const value=valid ? key==='fix' ? item.valor.toFixed(4)+' MXN/USD' : item.valor.toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:4})+'%' : 'sin datos';
    return `<tr><td>${label}</td><td>${value}</td><td>${item?.fecha ? citeDatum(item) : 'sin fecha · Banxico SIE'}</td></tr>`;
  }).join('')}</tbody></table></div><p class="chart-note"><a href="https://www.banxico.org.mx/SieAPIRest/swagger/index.html">Banco de México · SIE</a> · <a href="https://www.cetesdirecto.com/sites/portal/productos.cetesdirecto">Cetesdirecto · productos y plazos</a></p>`;
}

export function mergeMarket(previous, next){
  if(!Array.isArray(next) || next.length!==previous.length) throw Error('Universo de mercado inesperado');
  const rows=new Map(next.map(row=>[row.ticker,row]));
  if(rows.size!==previous.length) throw Error('Símbolos duplicados');
  return previous.map(row=>{
    const remote=rows.get(row.ticker);
    if(!remote || (remote.cierre && (!dated(remote.cierre,'Yahoo Finance') || remote.cierre.valor<=0 || remote.cierre.moneda!=='USD'))) throw Error('Cierre inválido');
    return remote.cierre && remote.cierre.fecha>=quote(row).fecha ? {...row,cierre:remote.cierre} : row;
  });
}
async function readJson(url){
  const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(9000)});
  if(!response.ok) throw Error('Datos inaccesibles');
  return response.json();
}
function cacheRead(){
  try{return JSON.parse(localStorage.getItem('brujula-market-cache-v1'))||{};}catch{return {};}
}
export async function refreshData(show){
  const cached=cacheRead();
  const results=await Promise.allSettled([readJson('market.json'),readJson('rates.json'),readJson('loans.json')]);
  let market=results[0].value || cached.market || [];
  let rates=results[1].value || cached.rates;
  const loans=results[2].value;
  if(cached.market && market.length) try{market=mergeMarket(market,cached.market);}catch{}
  if(cached.rates?.actualizado && cached.rates.actualizado>(rates?.actualizado||'')) rates=cached.rates;
  const cutoff=()=>[...market.map(row=>quote(row).fecha),...Object.values(rates?.datos||{}).map(row=>row.fecha)].filter(Boolean).sort().at(-1);
  show({market,rates,loans,status:cutoff()?'Datos disponibles al '+dataDate(cutoff()):'Sin datos de mercado disponibles'});
  try{
    const [incomingMarket,incomingRates]=await Promise.all([readJson(repo+'market.json'),readJson(repo+'rates.json')]);
    if(!incomingRates?.actualizado || !Object.keys(rateNames).every(key=>dated(incomingRates.datos?.[key],'Banxico SIE'))) throw Error('Tasas aún no actualizadas');
    if(incomingRates.actualizado<(rates?.actualizado||'')) throw Error('Publicación anterior');
    market=mergeMarket(market,incomingMarket);
    rates=incomingRates;
    try{localStorage.setItem('brujula-market-cache-v1',JSON.stringify({market,rates}));}catch{}
    const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Mexico_City'}).format(new Date());
    const businessDay=!['Sat','Sun'].includes(new Intl.DateTimeFormat('en-US',{weekday:'short',timeZone:'America/Mexico_City'}).format(new Date()));
    show({market,rates,loans,status:businessDay&&rates.actualizado<today ? 'No se pudo actualizar hoy, se muestra el dato del '+dataDate(cutoff()) : 'Datos actualizados al '+dataDate(cutoff())});
  }catch{
    show({market,rates,loans,status:'No se pudo actualizar hoy, se muestra el dato del '+dataDate(cutoff())});
  }
}
