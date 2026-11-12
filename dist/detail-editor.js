import {summarizeItems} from './financial-details.js';
import {exportDrafts, updateDraft} from './drafts.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const categories = ['Vivienda','Alimentación','Transporte','Servicios','Salud','Educación','Ocio','Otros'];
const fields = {incomeItems:{label:'Fuente de ingreso',amount:'Monto mensual'},expenseItems:{label:'Rubro',amount:'Monto mensual',note:'Nota opcional',essential:'Esencial'},debtItems:{label:'Acreedor o tipo',balance:'Saldo',rate:'Tasa anual (%)',payment:'Pago mensual',minimum:'Pago mínimo'}};
const titles = {incomeItems:'Fuentes de ingreso',expenseItems:'Gastos por rubro',debtItems:'Detalle de deudas'};

export function detailEditor(kind, profile, scope) {
  const draft = exportDrafts()[`details-${scope}-${kind}`];
  const rows = draft?.currency === profile.currency && Array.isArray(draft.rows) ? draft.rows : profile[kind] ?? initialRows(kind,profile);
  return `<fieldset class="detail-editor" data-editor="${kind}" data-scope="${scope}" data-currency="${esc(profile.currency)}"><legend>${titles[kind]}</legend><p class="chart-note">${kind==='debtItems'?'Registra saldo, tasa, pago actual y mínimo de cada deuda. Los totales se actualizan con este detalle.':'Usa una fila por concepto. Quita los rubros que no uses o escribe 0.'}</p><div data-rows>${rows.map(row=>rowHtml(kind,row)).join('')}</div><button type="button" class="secondary" data-add-row>Agregar ${kind==='incomeItems'?'fuente':kind==='debtItems'?'deuda':'rubro'}</button><p class="detail-total" data-total aria-live="polite"></p><label data-zero hidden><input type="checkbox" data-confirm-zero ${draft?.confirmed?'checked':''}> ${kind==='debtItems'?'Confirmo que ya no tengo deudas.':'Confirmo que el total es cero.'}</label><p class="field-error" data-editor-error role="alert"></p></fieldset>`;
}

function initialRows(kind, profile) {
  if (kind === 'incomeItems') return [{label:'Sueldo'}];
  if (kind === 'expenseItems') return categories.map((label,i)=>({label,essential:i<5}));
  return [{label:'',balance:profile.debt||'',payment:profile.debtPayment??''}];
}

function rowHtml(kind,row = {}) {
  return `<div class="detail-row">${Object.entries(fields[kind]).map(([key,label])=>`<label>${label}${key==='essential'?`<input type="checkbox" data-item="${key}" ${row[key]?'checked':''}>`:`<input type="text" ${['label','note'].includes(key)?'maxlength="120"':'inputmode="decimal"'} data-item="${key}" value="${esc(row[key])}">`}<small class="field-error" data-field-error="${key}"></small></label>`).join('')}<button type="button" class="text-button danger" data-remove-row>Quitar fila</button></div>`;
}

function readRows(editor) {
  return Array.from(editor.querySelectorAll('.detail-row'), row=>Object.fromEntries(Array.from(row.querySelectorAll('[data-item]'),input=>[input.dataset.item,input.type==='checkbox'?input.checked:input.value])));
}

export function editorResult(editor, showErrors = true) {
  const kind = editor.dataset.editor;
  const rows = readRows(editor);
  const confirmed = editor.querySelector('[data-confirm-zero]').checked;
  const result = summarizeItems(kind,rows,confirmed);
  const emptyDebt = kind==='debtItems' && rows.length===0;
  const editing = editor.dataset.scope==='edit';
  if(emptyDebt && editing && !confirmed) result.needsZero = true;
  const money = value => `${value.toLocaleString('es-MX',{maximumFractionDigits:2})} ${editor.dataset.currency}`;
  editor.querySelector('[data-total]').textContent = `Total: ${money(Object.values(result.totals)[0])}${kind==='expenseItems'?` · Esenciales: ${money(result.totals.essentials)}`:kind==='debtItems'?` · Pago mensual: ${money(result.totals.debtPayment)}`:''}`;
  editor.querySelector('[data-zero]').hidden = kind==='debtItems' ? !(editing && emptyDebt) : result.errors.length>0 || Object.values(result.totals)[0]!==0;
  if (!showErrors) return result;
  const rowElements = editor.querySelectorAll('.detail-row');
  editor.querySelectorAll('[aria-invalid]').forEach(input=>input.removeAttribute('aria-invalid'));
  editor.querySelectorAll('[data-field-error]').forEach(el=>el.textContent='');
  for (const {index,field,message} of result.errors) {
    rowElements[index].querySelector(`[data-item="${field}"]`).setAttribute('aria-invalid','true');
    rowElements[index].querySelector(`[data-field-error="${field}"]`).textContent = message;
  }
  editor.querySelector('[data-editor-error]').textContent = result.needsZero?'Confirma el total de cero para continuar.':emptyDebt&&!editing?'Agrega el detalle de al menos una deuda o corrige el saldo en Mis respuestas.':'';
  if(emptyDebt&&!editing) result.errors.push({message:'Falta el detalle de deuda.'});
  return result;
}

export function bindDetailEditors() {
  for (const editor of document.querySelectorAll('[data-editor]')) {
    const update = () => {
      const confirmed = editor.querySelector('[data-confirm-zero]').checked;
      updateDraft(`details-${editor.dataset.scope}-${editor.dataset.editor}`, {rows:readRows(editor),currency:editor.dataset.currency,confirmed});
      editorResult(editor,false);
    };
    editor.addEventListener('input',update);
    editor.addEventListener('click',event=>{
      if (event.target.matches('[data-add-row]')) editor.querySelector('[data-rows]').insertAdjacentHTML('beforeend',rowHtml(editor.dataset.editor));
      else if (event.target.matches('[data-remove-row]')) event.target.closest('.detail-row').remove();
      else return;
      update();
    });
    editorResult(editor,false);
  }
}
