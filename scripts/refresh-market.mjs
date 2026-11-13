import {readFile,writeFile,rename} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {stockNames} from '../dist/strategy-extras.js';

export const series = {
  cetes28:'SF43936', cetes91:'SF43939', cetes182:'SF43942', cetes364:'SF43945',
  tiie28:'SF43783', objective:'SF61745', fix:'SF43718'
};
const mxDate = now => new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Mexico_City'}).format(now);
const iso = input => /^\d{4}-\d{2}-\d{2}$/.test(input || '') && Number.isFinite(Date.parse(input)) && new Date(input).toISOString().slice(0,10) === input;

export function parseRates(payload, today) {
  const rows = payload?.bmx?.series;
  if (!Array.isArray(rows)) throw Error('Banxico: formato de series inesperado.');
  return Object.fromEntries(Object.entries(series).map(([key,id])=>{
    const observations = rows.find(row=>row.idSerie===id)?.datos;
    if (!Array.isArray(observations)) throw Error('Banxico: falta la serie '+id);
    const latest = observations.map(row=>{
      const parts=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(row.fecha);
      return {fecha:parts ? parts.slice(1).reverse().join('-') : '',valor:/^-?[\d,]+(?:\.\d+)?$/.test(row.dato) ? Number(row.dato.replaceAll(',','')) : NaN};
    }).filter(row=>iso(row.fecha)&&row.fecha<=today&&Number.isFinite(row.valor)).sort((a,b)=>b.fecha.localeCompare(a.fecha))[0];
    if (!latest || (key==='fix' && latest.valor<=0)) throw Error('Banxico: observación inválida para '+id);
    return [key,{...latest,fuente:'Banxico SIE',serie:id}];
  }));
}

export function parseClose(payload, ticker, now) {
  const chart=payload?.chart?.result?.[0];
  const session=chart?.meta?.currentTradingPeriod?.regular;
  const times=chart?.timestamp;
  const closes=chart?.indicators?.quote?.[0]?.close;
  if(chart?.meta?.symbol!==ticker || chart.meta.currency!=='USD' || !session || !Number.isFinite(session.start) || !Number.isFinite(session.end) || !Array.isArray(times) || !Array.isArray(closes) || times.length!==closes.length) throw Error('Yahoo Finance: formato inesperado para '+ticker);
  const point=times.map((time,i)=>({time,close:closes[i]}))
    .filter(({time,close})=>Number.isFinite(time)&&time*1000<=+now&&Number.isFinite(close)&&close>0&&(time<session.start||session.end*1000<=+now))
    .sort((a,b)=>b.time-a.time)[0];
  if(!point) throw Error('Yahoo Finance: sin cierre confirmado para '+ticker);
  const fecha=new Intl.DateTimeFormat('sv-SE',{timeZone:chart.meta.exchangeTimezoneName || 'America/New_York'}).format(new Date(point.time*1000));
  return {valor:point.close,fecha,fuente:'Yahoo Finance',moneda:'USD'};
}

async function json(url, provider, headers) {
  try {
    const response=await fetch(url,{headers,signal:AbortSignal.timeout(18000)});
    if(!response.ok) throw Error('HTTP '+response.status);
    return await response.json();
  } catch(error) { throw Error(provider+': '+(error.message.startsWith('HTTP ') ? error.message : 'respuesta inaccesible o inválida')); }
}

export async function refresh(now=new Date(), token=process.env.BANXICO_TOKEN) {
  if(!token) throw Error('Configura BANXICO_TOKEN en los secretos de GitHub Actions.');
  const market=JSON.parse(await readFile('dist/market.json','utf8'));
  const previousRates=JSON.parse(await readFile('dist/rates.json','utf8'));
  const today=mxDate(now);
  const base='https://www.banxico.org.mx/SieAPIRest/service/v1/series/';
  const headers={'Bmx-Token':token};
  const ids=Object.values(series).join(',');
  const metadata=await json(base+ids,'Banxico SIE',headers);
  const expected={cetes28:/cetes.*28/is,cetes91:/cetes.*91/is,cetes182:/cetes.*182/is,cetes364:/cetes.*364/is,tiie28:/(?=.*(?:TIIE|Interbancaria))(?=.*(?:28|4 semanas))/is,objective:/objetivo/i,fix:/FIX|determinaci[oó]n/i};
  for(const [key,id] of Object.entries(series)){
    const entry=metadata?.bmx?.series?.find(row=>row.idSerie===id);
    if(!expected[key].test(entry?.titulo || '')) throw Error('Banxico: revisar metadatos de '+id);
  }
  const start=new Date(+now-30*86400000).toISOString().slice(0,10);
  const rates=parseRates(await json(base+ids+'/datos/'+start+'/'+today,'Banxico SIE',headers),today);
  for(const [key,datum] of Object.entries(rates)) if(previousRates.datos[key]?.fecha>datum.fecha) rates[key]=previousRates.datos[key];
  for(const row of market.filter(row=>Object.hasOwn(stockNames,row.ticker)&&Number.isFinite(row.price))){
    const url='https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(row.ticker)+'?range=5d&interval=1d';
    const close=parseClose(await json(url,'Yahoo Finance '+row.ticker),row.ticker,now);
    if(!row.cierre || close.fecha>=row.cierre.fecha) row.cierre=close;
  }
  const next={'dist/rates.json':{actualizado:today,datos:rates},'dist/market.json':market};
  for(const [file,data] of Object.entries(next)) await writeFile(file+'.tmp',JSON.stringify(data,null,2)+'\n');
  for(const file of Object.keys(next)) await rename(file+'.tmp',file);
  console.log('Fuentes validadas y archivos listos para '+today);
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  refresh().catch(error=>{console.error(error.message);process.exitCode=1;});
}
