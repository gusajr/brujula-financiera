export function sizePosition(capital,r){
 const keys=['budget','perTrade','realized','openRisk','invested','concentration','entry','stop','fx','cost'];
 if(!Number.isFinite(capital)||capital<=0)return {error:'Registra capital adicional mayor a cero en tu diagnóstico.'};
 if(keys.some(k=>!Number.isFinite(r[k])||r[k]<0))return {error:'Completa todos los montos. Usa 0 donde no haya pérdidas, exposición o costos.'};
 if(!r.period?.trim())return {error:'Define el periodo al que aplica tu presupuesto de pérdida.'};
 if(r.budget<=0||r.budget>capital)return {error:'El presupuesto de pérdida debe ser mayor a cero y no superar tu capital adicional.'};
 if(r.perTrade<=0||r.perTrade>r.budget)return {error:'La pérdida por operación debe ser mayor a cero y no superar el presupuesto total.'};
 if(r.concentration<=0||r.concentration>100)return {field:'concentration',error:`El porcentaje para esta posición es ${r.concentration}%. Escribe un porcentaje mayor a 0 y hasta 100. Por ejemplo, 20 significa 20% del capital; aquí no se escribe un monto en dinero.`};
 if(r.invested>capital)return {field:'invested',error:`Registraste ${r.invested.toLocaleString('es-MX')} ya comprometidos, pero el capital adicional de tu diagnóstico es ${capital.toLocaleString('es-MX')}. Este campo solo incluye la parte comprometida de ese capital, en la misma moneda. Si tu capital disponible cambió, actualízalo en Diagnóstico.`};
 if(r.entry<=0||r.stop<=0||r.stop>=r.entry||r.fx<=0)return {error:'Para una compra al contado, la entrada y el cambio deben ser positivos; el stop debe ser menor a la entrada.'};
 const remaining=Math.max(0,r.budget-r.realized-r.openRisk),available=Math.max(0,capital-r.invested),tradeBudget=Math.min(r.perTrade,remaining),unitRisk=(r.entry-r.stop+r.cost)*r.fx,unitCapital=(r.entry+r.cost)*r.fx;
 const qty=Math.max(0,Math.floor(Math.min(tradeBudget/unitRisk,available/unitCapital,(capital*r.concentration/100)/unitCapital)));
 return {remaining,available,tradeBudget,unitRisk,qty,allocation:qty*unitCapital,estimatedLoss:qty*unitRisk,totalPlannedRisk:r.realized+r.openRisk+qty*unitRisk,fullLoss:qty*unitCapital,budgetPercent:r.budget/capital*100};
}
