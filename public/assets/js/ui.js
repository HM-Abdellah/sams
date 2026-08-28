import { state } from './state.js';
import { DAYS, PERIODS, attendanceKey, countsForStudent, attendanceRate, isRisk, displayName } from './logic.js';

const esc = value => { const d = document.createElement('div'); d.textContent = String(value ?? ''); return d.innerHTML; };
function addDays(iso, offset) { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + offset); return d.toISOString().slice(0, 10); }
function monthDays(month) { const [y,m] = month.split('-').map(Number); return new Date(Date.UTC(y,m,0)).getUTCDate(); }

export const ui = {
 toast(message,error=false){const el=document.querySelector('#toast');if(!el)return;el.textContent=message;el.className=`toast show${error?' error-toast':''}`;clearTimeout(el._timer);el._timer=setTimeout(()=>el.className='toast',2800);},
 classes(){const s=document.querySelector('#classSelect');if(!s)return;s.innerHTML='';for(const c of state.classes){const o=document.createElement('option');o.value=c.id;o.textContent=c.name;s.appendChild(o);}if(state.classId)s.value=String(state.classId);},
 attendance(){
  const head=document.querySelector('#attendanceHead'),body=document.querySelector('#attendanceBody');if(!head||!body)return;
  const days=Array.from({length:monthDays(state.month)},(_,i)=>{const date=`${state.month}-${String(i+1).padStart(2,'0')}`;const d=new Date(`${date}T00:00:00Z`);return {date,label:d.toLocaleDateString('fr-FR',{weekday:'short',day:'2-digit',timeZone:'UTC'})};});
  const map=new Map(state.attendance.map(r=>[attendanceKey(r.student_id,r.attendance_date,Number(r.period)),r.status]));
  head.innerHTML='<tr><th class="sticky student-col">Élève</th>'+days.map(day=>`<th colspan="8" class="day-group">${esc(day.label)}<small>${day.date}</small></th>`).join('')+'</tr><tr><th class="sticky student-col">&nbsp;</th>'+days.map(()=>PERIODS.map(p=>`<th class="period-head">${p}</th>`).join('')).join('')+'</tr>';
  const search=state.search.trim().toLowerCase();
  const filtered=state.students.filter(st=>{const n=displayName(st).toLowerCase();if(search&&!n.includes(search))return false;if(state.filter==='risk'&&!isRisk(st.id,state.attendance))return false;if(state.filter==='committed'){const c=countsForStudent(st.id,state.attendance);if(c.absent>0)return false;}return true;});
  body.innerHTML='';
  for(const [index,st] of filtered.entries()){
   const tr=document.createElement('tr'),c=countsForStudent(st.id,state.attendance),name=document.createElement('th');name.className='sticky student-col';name.innerHTML=`<span>${index+1}. ${esc(displayName(st))}</span><small>${c.absent} absence(s)</small>`;tr.appendChild(name);
   for(const day of days)for(let p=1;p<=8;p++){const td=document.createElement('td'),status=map.get(attendanceKey(st.id,day.date,p))||'';td.className=`attendance-cell ${status}`;td.dataset.student=st.id;td.dataset.date=day.date;td.dataset.period=p;td.textContent=status==='present'?'✓':status==='absent'?'✕':status==='late'?'L':status==='excused'?'E':'·';td.title=`${displayName(st)} · ${day.date} · ${PERIODS[p-1]} · ${status||'non marqué'}`;tr.appendChild(td);}
   body.appendChild(tr);
  }
  if(!filtered.length)body.innerHTML=`<tr><td class="empty-state" colspan="${1+days.length*8}">Aucun élève ne correspond aux filtres.</td></tr>`;
  this.stats();
 },
 students(){const box=document.querySelector('#studentsList'),count=document.querySelector('#studentCount');if(!box)return;if(count)count.textContent=`${state.students.length} élève(s)`;box.innerHTML='';for(const st of state.students){const item=document.createElement('article');item.className='student-card';item.innerHTML=`<div><strong>${esc(displayName(st))}</strong><small>${esc(st.student_number||'Sans numéro')}</small></div><button class="btn danger small" data-delete-student="${st.id}" type="button">Désactiver</button>`;box.appendChild(item);}},
 stats(){let present=0,absent=0,other=0;for(const r of state.attendance){if(r.status==='present')present++;else if(r.status==='absent')absent++;else other++;}const total=present+absent+other;document.querySelector('#statPresent').textContent=present;document.querySelector('#statAbsent').textContent=absent;document.querySelector('#statOther').textContent=other;document.querySelector('#statRate').textContent=`${attendanceRate(present,total)}%`;},
 statistics(){const box=document.querySelector('#statisticsGrid');if(!box)return;box.innerHTML='';for(const st of state.students){const c=countsForStudent(st.id,state.attendance),total=c.present+c.absent+c.other,card=document.createElement('article');card.className=`stat-card ${c.absent>=8?'risk':''}`;card.innerHTML=`<strong>${esc(displayName(st))}</strong><span>${c.absent} absence(s)</span><span>${c.present} présence(s)</span><span>${c.other} autre(s)</span><b>${attendanceRate(c.present,total)}%</b>`;box.appendChild(card);}}
};
export function renderAll(){ui.classes();ui.attendance();ui.students();ui.statistics();}
