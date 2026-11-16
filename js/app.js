(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const KEYS = {
    sets: 'gym-series-v1', exercises: 'gym-ejercicios-v1',
    routines: 'gym-rutinas-v1', body: 'gym-cuerpo-v1',
    theme: 'gym-tema-v1'
  };
  const BASE = ['Press de banca','Sentadilla','Peso muerto','Press militar','Remo con barra','Dominadas','Press inclinado con mancuernas','Prensa de piernas','Hip thrust','Curl de bíceps','Extensión de tríceps'];
  const muscleMap = {'Press de banca':'Pecho','Press inclinado con mancuernas':'Pecho','Aperturas':'Pecho','Sentadilla':'Piernas','Peso muerto':'Espalda','Remo con barra':'Espalda','Dominadas':'Espalda','Press militar':'Hombros','Elevaciones laterales':'Hombros','Curl de bíceps':'Brazos','Extensión de tríceps':'Brazos','Hip thrust':'Piernas','Prensa de piernas':'Piernas'};
  const safeRead = (key, fallback) => { try { const value = JSON.parse(localStorage.getItem(key)); return value ?? fallback; } catch { return fallback; } };
  let sets = safeRead(KEYS.sets, []);
  let custom = safeRead(KEYS.exercises, []);
  let routines = safeRead(KEYS.routines, []);
  let bodyLogs = safeRead(KEYS.body, []);
  let selectedDate = new Date();
  let calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let timerRemaining = 90, timerInterval = null, timerRunning = false;
  let currentView = 'dashboard', pendingConfirm = null;
  const today = () => localDate(new Date());
  function localDate(d) { const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}`; }
  const parseDate = s => { const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d); };
  const fmtDate = s => s ? parseDate(s).toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric'}) : '—';
  const fmtNum = n => Number(n||0).toLocaleString('es-AR',{maximumFractionDigits:1});
  const e1rm = (w,r) => r<=1 ? w : w*(1+r/30);
  const pct = (a,b) => b ? (a-b)/b*100 : null;
  const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  function persist() {
    try {
      localStorage.setItem(KEYS.sets,JSON.stringify(sets));
      localStorage.setItem(KEYS.exercises,JSON.stringify(custom));
      localStorage.setItem(KEYS.routines,JSON.stringify(routines));
      localStorage.setItem(KEYS.body,JSON.stringify(bodyLogs));
      return true;
    } catch { toast('No se pudieron guardar los datos. Liberá espacio o exportá un respaldo.',true); return false; }
  }
  function toast(message,error=false) {
    const el=document.createElement('div'); el.className=`toast${error?' error':''}`; el.textContent=message;
    $('toastRegion').append(el); setTimeout(()=>el.remove(),3600);
  }
  function allExercises(){ return [...new Set([...BASE,...custom])]; }
  function muscle(ex){ return muscleMap[ex] || 'Otro'; }
  function sessionsOf(ex) {
    const grouped={};
    sets.filter(s=>s.exercise===ex).forEach(s=>(grouped[s.date] ||= []).push(s));
    return Object.keys(grouped).sort().map(date=>{
      const list=grouped[date], top=list.reduce((a,b)=>e1rm(b.weight,b.reps)>e1rm(a.weight,a.reps)?b:a);
      const rirs=list.filter(s=>s.rir!==null&&s.rir!==undefined);
      return {date,list,top,count:list.length,e1rm:e1rm(top.weight,top.reps),volume:list.reduce((t,s)=>t+s.weight*s.reps,0),maxW:Math.max(...list.map(s=>s.weight)),rir:rirs.length?rirs.reduce((t,s)=>t+Number(s.rir),0)/rirs.length:null};
    });
  }
  function allSessionDates(){ return [...new Set(sets.map(s=>s.date))].sort(); }
  function sessionCount(){ return allSessionDates().length; }
  function totalVolume(){ return sets.reduce((t,s)=>t+s.weight*s.reps,0); }
  function fillSelect(id,selected) {
    const el=$(id); if(!el)return;
    const old=selected ?? el.value;
    el.innerHTML=allExercises().map(e=>`<option value="${esc(e)}">${esc(e)}</option>`).join('');
    if(old && allExercises().includes(old)) el.value=old;
  }
  function fillExerciseSelects() {
    ['exercise','dashExercise','progressExercise','setFilter'].forEach(id=>fillSelect(id));
    $('setFilter').insertAdjacentHTML('afterbegin','<option value="__all">Todos los ejercicios</option>');
    $('setFilter').value='__all';
  }
  function showView(name) {
    if(!$(`view-${name}`)) name='dashboard';
    currentView=name;
    document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${name}`));
    document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
    const labels={dashboard:'Inicio',training:'Entrenamiento',routines:'Rutinas',exercises:'Ejercicios',progress:'Progreso',records:'Récords',calendar:'Calendario',body:'Seguimiento corporal',achievements:'Logros',assistant:'Asistente',settings:'Configuración'};
    $('pageCrumb').textContent=labels[name]||name;
    $('sidebar').classList.remove('open');
    if(name==='progress')renderProgress();
    if(name==='calendar')renderCalendar();
    if(name==='assistant')renderAssistant();
    if(name==='records')renderRecords();
    if(name==='achievements')renderAchievements();
    if(name==='body')renderBody();
  }
  function drawChart(canvasId,values,colorVar='--green') {
    const c=$(canvasId); if(!c)return;
    const w=Math.max(250,c.clientWidth||500),h=c.clientHeight||220,dpr=window.devicePixelRatio||1;
    c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);
    const ctx=c.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    const css=getComputedStyle(document.body),color=css.getPropertyValue(colorVar).trim(),muted=css.getPropertyValue('--muted').trim(),line=css.getPropertyValue('--line').trim();
    const pad={l:43,r:14,t:15,b:30};
    if(!values.length){ctx.fillStyle=muted;ctx.font='12px sans-serif';ctx.textAlign='center';ctx.fillText('Todavía no hay datos suficientes',w/2,h/2);return;}
    const vals=values.map(v=>Number(v.value)||0),min0=Math.min(...vals),max0=Math.max(...vals),range=max0-min0||Math.max(1,max0*.1),min=Math.max(0,min0-range*.16),max=max0+range*.16;
    const x=i=>values.length===1?(pad.l+w-pad.l-pad.r)/2:pad.l+i*(w-pad.l-pad.r)/(values.length-1);
    const y=v=>pad.t+(h-pad.t-pad.b)*(1-(v-min)/(max-min));
    ctx.strokeStyle=line;ctx.fillStyle=muted;ctx.lineWidth=1;ctx.font='10px sans-serif';ctx.textAlign='right';
    for(let i=0;i<=4;i++){const v=min+(max-min)*i/4,yy=y(v);ctx.beginPath();ctx.moveTo(pad.l,yy);ctx.lineTo(w-pad.r,yy);ctx.stroke();ctx.fillText(fmtNum(v),pad.l-7,yy+3);}
    ctx.beginPath();values.forEach((v,i)=>i?ctx.lineTo(x(i),y(v.value)):ctx.moveTo(x(i),y(v.value)));ctx.strokeStyle=color;ctx.lineWidth=2.5;ctx.lineJoin='round';ctx.stroke();
    values.forEach((v,i)=>{ctx.beginPath();ctx.arc(x(i),y(v.value),4,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();});
    ctx.fillStyle=muted;ctx.textAlign='center';const step=Math.max(1,Math.ceil(values.length/6));
    values.forEach((v,i)=>{if(i%step===0||i===values.length-1)ctx.fillText(v.label||'',x(i),h-8);});
  }
  function renderDashboard() {
    const dates=allSessionDates(),weekStart=new Date();weekStart.setDate(weekStart.getDate()-((weekStart.getDay()+6)%7));weekStart.setHours(0,0,0,0);
    const weekDates=dates.filter(d=>parseDate(d)>=weekStart),weekSets=sets.filter(s=>weekDates.includes(s.date));
    const prs=allExercises().map(ex=>({ex,best:Math.max(0,...sets.filter(s=>s.exercise===ex).map(s=>e1rm(s.weight,s.reps)))})).filter(x=>x.best>0);
    const best=prs.sort((a,b)=>b.best-a.best)[0];
    const stats=[
      ['◷','Sesiones',sessionCount(),'sesiones registradas'],
      ['↗','Series totales',sets.length,'series guardadas'],
      ['▥','Volumen acumulado',`${fmtNum(totalVolume())} <small>kg</small>`,'peso × repeticiones'],
      ['♜','Mejor 1RM',best?`${fmtNum(best.best)} <small>kg</small>`:'—',best?best.ex:'Todavía sin registros']
    ];
    $('dashboardStats').innerHTML=stats.map(([icon,label,value,foot])=>`<div class="stat-card"><div class="stat-top"><span>${label}</span><span class="stat-icon">${icon}</span></div><div class="stat-value">${value}</div><div class="stat-foot">${foot}</div></div>`).join('');
    const ex=$('dashExercise').value||allExercises()[0],ss=sessionsOf(ex);
    drawChart('dashChart',ss.map(s=>({value:s.e1rm,label:fmtDate(s.date).slice(0,5)})));
    $('chartSummary').textContent=ss.length?`${ss.length} sesiones · último 1RM ${fmtNum(ss.at(-1).e1rm)} kg`:'Registrá una serie para comenzar';
    $('weekCount').textContent=`${weekDates.length} sesiones`;
    $('weekVolume').textContent=`${fmtNum(weekSets.reduce((t,s)=>t+s.weight*s.reps,0))} kg`;
    const dayNames=['L','M','X','J','V','S','D'],now=new Date(),monday=new Date(now);monday.setDate(now.getDate()-((now.getDay()+6)%7));
    $('weekDays').innerHTML=dayNames.map((d,i)=>{const dt=new Date(monday);dt.setDate(monday.getDate()+i);const key=localDate(dt);return `<div class="week-day ${dates.includes(key)?'done':''}">${d}<i>${dt.getDate()}</i></div>`;}).join('');
    let streak=0,cur=new Date();if(!dates.includes(localDate(cur)))cur.setDate(cur.getDate()-1);while(dates.includes(localDate(cur))&&streak<365){streak++;cur.setDate(cur.getDate()-1);}
    $('streakValue').textContent=`${streak} ${streak===1?'día':'días'}`;
    const latest=dates.at(-1);
    $('recentSession').innerHTML=latest?sets.filter(s=>s.date===latest).slice(0,4).map(s=>`<div class="recent-item"><span class="recent-icon">↗</span><div><strong>${esc(s.exercise)}</strong><small>${fmtNum(s.weight)} kg × ${s.reps} · ${fmtDate(s.date)}</small></div></div>`).join(''):`<div class="recent-empty">Todavía no registraste entrenamientos. Tu primera sesión empieza acá.</div>`;
  }
  function renderHint() {
    const ex=$('exercise').value,ss=sessionsOf(ex),last=ss.at(-1);
    $('lastHint').textContent=last?`Última sesión (${fmtDate(last.date)}): ${last.list.map(s=>`${fmtNum(s.weight)} kg × ${s.reps}`).join(' · ')}. Intentá progresar gradualmente manteniendo una técnica sólida.`:'Todavía no hay registros para este ejercicio.';
  }
  function renderSets() {
    const ex=$('setFilter').value;
    const list=sets.filter(s=>ex==='__all'||s.exercise===ex).slice().sort((a,b)=>b.date.localeCompare(a.date));
    $('setCount').textContent=`${list.length} registros`;
    $('setsTable').innerHTML=list.length?`<thead><tr><th>FECHA</th><th>EJERCICIO</th><th>PESO</th><th>REPS</th><th>RIR</th><th>DESCANSO</th><th>TIPO</th><th>NOTAS</th><th>ACCIONES</th></tr></thead><tbody>${list.map(s=>`<tr><td>${fmtDate(s.date)}</td><td>${esc(s.exercise)}</td><td>${fmtNum(s.weight)} kg</td><td>${s.reps}</td><td>${s.rir??'—'}</td><td>${s.rest??'—'} s</td><td>${esc(s.type||'Efectiva')}</td><td>${esc(s.note)}</td><td><button class="table-action" data-edit="${esc(s.id)}">Editar</button><button class="table-action delete" data-delete="${esc(s.id)}">Borrar</button></td></tr>`).join('')}</tbody>`:'<tbody><tr><td class="empty-cell" colspan="9">No hay series para mostrar todavía.</td></tr></tbody>';
  }
  function clearEdit(){ $('editingId').value='';$('formTitle').textContent='Anotar una serie';$('saveSet').innerHTML='Guardar serie <span>→</span>';$('cancelEdit').classList.add('hidden'); }
  function editSet(id) {
    const s=sets.find(x=>x.id===id);if(!s)return;
    fillSelect('exercise',s.exercise);$('editingId').value=id;$('date').value=s.date;$('weight').value=s.weight;$('reps').value=s.reps;$('rir').value=s.rir??'';$('rest').value=s.rest??'';$('note').value=s.note||'';$('setType').value=s.type||'Efectiva';
    $('formTitle').textContent='Editar serie';$('saveSet').textContent='Guardar cambios';$('cancelEdit').classList.remove('hidden');showView('training');$('weight').focus();
  }
  function handleSetSubmit(e) {
    e.preventDefault();
    const weight=Number($('weight').value),reps=Number($('reps').value),rir=$('rir').value===''?null:Number($('rir').value),rest=$('rest').value===''?null:Number($('rest').value);
    if(!Number.isFinite(weight)||weight<0||!Number.isInteger(reps)||reps<1|| (rir!==null&&(rir<0||rir>10)) || (rest!==null&&rest<0)){toast('Revisá los valores ingresados.',true);return;}
    const item={id:$('editingId').value||uid(),date:$('date').value||today(),exercise:$('exercise').value,weight,reps,rir,rest,note:$('note').value.trim(),type:$('setType').value};
    const idx=sets.findIndex(s=>s.id===item.id);if(idx>=0)sets[idx]=item;else sets.push(item);
    persist();$('note').value='';clearEdit();$('formStatus').textContent='Registro guardado correctamente.';renderAll();toast(idx>=0?'Serie actualizada.':'¡Serie registrada!');
    if(rest!==null&&rest>0){setTimer(rest);showView('training');}
  }
  function renderProgress() {
    fillSelect('progressExercise');const ex=$('progressExercise').value||allExercises()[0],ss=sessionsOf(ex),metric=$('metric').value;
    const label={e1rm:'1RM estimado',maxW:'Peso máximo',volume:'Volumen'}[metric];
    $('progressTitle').textContent=ex;$('progressInsight').textContent=ss.length>1?`${label}: ${fmtNum(ss.at(-1)[metric])} · ${pct(ss.at(-1)[metric],ss[0][metric])===null?'':`${pct(ss.at(-1)[metric],ss[0][metric])>=0?'+':''}${fmtNum(pct(ss.at(-1)[metric],ss[0][metric]))}% desde el primer registro`}`:'Necesitás al menos dos sesiones para comparar.';
    drawChart('progressChart',ss.map(s=>({value:s[metric],label:fmtDate(s.date).slice(0,5)})));
    const best=ss.length?Math.max(...ss.map(s=>s.e1rm)):0,vol=ss.reduce((t,s)=>t+s.volume,0);
    $('progressStats').innerHTML=[['Sesiones',ss.length],['Mejor 1RM',`${fmtNum(best)} kg`],['Volumen acumulado',`${fmtNum(vol)} kg`],['Peso máximo',`${fmtNum(Math.max(0,...ss.map(s=>s.maxW)))} kg`]].map(x=>`<div class="stat-card"><div class="stat-top">${x[0]}</div><div class="stat-value">${x[1]}</div></div>`).join('');
    $('sessionsTable').innerHTML=ss.length?`<thead><tr><th>FECHA</th><th>SERIES</th><th>MEJOR SERIE</th><th>1RM EST.</th><th>VOLUMEN</th><th>RIR MEDIO</th><th>CAMBIO</th></tr></thead><tbody>${ss.slice().reverse().map((s,i,arr)=>{const prev=arr[i+1],p=prev?pct(s.e1rm,prev.e1rm):null;return `<tr><td>${fmtDate(s.date)}</td><td>${s.count}</td><td>${fmtNum(s.top.weight)} × ${s.top.reps}</td><td>${fmtNum(s.e1rm)} kg</td><td>${fmtNum(s.volume)} kg</td><td>${s.rir===null?'—':fmtNum(s.rir)}</td><td class="${p>0?'up':p<0?'down':''}">${p===null?'—':`${p>0?'+':''}${fmtNum(p)}%`}</td></tr>`}).join('')}</tbody>`:'<tbody><tr><td class="empty-cell" colspan="7">No hay sesiones registradas para este ejercicio.</td></tr></tbody>';
  }
  function renderRecords() {
    const records=allExercises().map(ex=>{const rows=sets.filter(s=>s.exercise===ex);if(!rows.length)return null;const best=rows.reduce((a,b)=>e1rm(a.weight,a.reps)>e1rm(b.weight,b.reps)?a:b),maxW=rows.reduce((a,b)=>a.weight>b.weight?a:b);return {ex,best,maxW};}).filter(Boolean);
    $('recordsGrid').innerHTML=records.length?records.map(r=>`<article class="record-card"><span class="eyebrow">${esc(muscle(r.ex))}</span><h3>${esc(r.ex)}</h3><div class="record-value">${fmtNum(e1rm(r.best.weight,r.best.reps))} <small>kg</small></div><strong>1RM estimado</strong><small>Mejor serie: ${fmtNum(r.best.weight)} kg × ${r.best.reps} · ${fmtDate(r.best.date)}</small><div class="divider"></div><small>Peso máximo levantado: <b>${fmtNum(r.maxW.weight)} kg</b></small></article>`).join(''):'<div class="card muted">Todavía no hay récords. Registrá tus primeras series para construir tu historial.</div>';
  }
  function renderCalendar() {
    const year=calendarMonth.getFullYear(),month=calendarMonth.getMonth(),first=new Date(year,month,1),offset=(first.getDay()+6)%7,days=new Date(year,month+1,0).getDate(),prevDays=new Date(year,month,0).getDate();
    $('monthTitle').textContent=calendarMonth.toLocaleDateString('es-AR',{month:'long',year:'numeric'});
    const cells=[];
    for(let i=0;i<42;i++){let day,dt,other=false;if(i<offset){day=prevDays-offset+i+1;dt=new Date(year,month-1,day);other=true;}else if(i>=offset+days){day=i-offset-days+1;dt=new Date(year,month+1,day);other=true;}else{day=i-offset+1;dt=new Date(year,month,day);}
      const key=localDate(dt),has=sets.some(s=>s.date===key),isToday=key===today(),selected=key===localDate(selectedDate);
      cells.push(`<button class="calendar-day ${other?'muted-day':''} ${has?'has-workout':''} ${isToday?'today':''} ${selected?'selected':''}" data-day="${key}"><span>${day}</span></button>`);
    }
    $('calendarGrid').innerHTML=cells.join('');renderDayDetails(localDate(selectedDate));
  }
  function renderDayDetails(date) {
    const rows=sets.filter(s=>s.date===date);$('selectedDateTitle').textContent=fmtDate(date);
    $('dayDetails').innerHTML=rows.length?`<strong>${rows.length} series registradas</strong><br>${[...new Set(rows.map(s=>s.exercise))].map(ex=>`<b>${esc(ex)}</b>: ${rows.filter(s=>s.exercise===ex).map(s=>`${fmtNum(s.weight)} kg × ${s.reps}`).join(' · ')}`).join('<br>')}<br><br><span class="muted">Volumen del día: ${fmtNum(rows.reduce((t,s)=>t+s.weight*s.reps,0))} kg</span>`:'No hay entrenamiento registrado para esta fecha.';
  }
  function renderBody() {
    const latest=bodyLogs.slice().sort((a,b)=>a.date.localeCompare(b.date)).at(-1);
    const fields=[['Peso corporal','weight','kg'],['Altura','height','cm'],['Cintura','waist','cm'],['Pecho','chest','cm'],['Brazo','arm','cm'],['Muslo','leg','cm']];
    $('bodySummary').innerHTML=latest?fields.filter(f=>latest[f[1]]!==null&&latest[f[1]]!==undefined).map(f=>`<div class="body-metric"><span>${f[0]}</span><strong>${fmtNum(latest[f[1]])} <small>${f[2]}</small></strong></div>`).join(''):'<p class="muted">Todavía no hay mediciones.</p>';
    const rows=bodyLogs.slice().sort((a,b)=>b.date.localeCompare(a.date));
    $('bodyTable').innerHTML=rows.length?`<thead><tr><th>FECHA</th>${fields.map(f=>`<th>${f[0].toUpperCase()}</th>`).join('')}<th>NOTAS</th><th></th></tr></thead><tbody>${rows.map(r=>`<tr><td>${fmtDate(r.date)}</td>${fields.map(f=>`<td>${r[f[1]]??'—'} ${r[f[1]]!=null?f[2]:''}</td>`).join('')}<td>${esc(r.note)}</td><td><button class="table-action delete" data-body-delete="${r.id}">Borrar</button></td></tr>`).join('')}</tbody>`:'<tbody><tr><td colspan="9" class="empty-cell">No hay mediciones registradas.</td></tr></tbody>';
  }
  const achievements=[
    ['first','✦','Primer paso','Registrá tu primera serie.',()=>sets.length>=1],
    ['ten','↗','En movimiento','Acumulá 10 series registradas.',()=>sets.length>=10],
    ['fifty','▥','Construyendo fuerza','Acumulá 50 series registradas.',()=>sets.length>=50],
    ['hundred','♜','Disciplina','Acumulá 100 series registradas.',()=>sets.length>=100],
    ['five-days','▦','Ritmo constante','Entrená en 5 días diferentes.',()=>sessionCount()>=5],
    ['ten-days','◷','Hábito en marcha','Entrená en 10 días diferentes.',()=>sessionCount()>=10],
    ['three-ex','◈','Versatilidad','Registrá 3 ejercicios diferentes.',()=>new Set(sets.map(s=>s.exercise)).size>=3],
    ['routine','▤','Planificador','Creá tu primera rutina.',()=>routines.length>=1],
    ['body','◎','Seguimiento','Guardá tu primera medición corporal.',()=>bodyLogs.length>=1],
    ['pr','♛','Marca personal','Registrá una serie de 1RM estimado de 100 kg o más.',()=>sets.some(s=>e1rm(s.weight,s.reps)>=100)]
  ];
  function renderAchievements() {
    const unlocked=achievements.filter(a=>a[3]()).length,p=Math.round(unlocked/achievements.length*100);
    $('achievementCount').textContent=`${unlocked} de ${achievements.length} logros desbloqueados`;$('achievementPercent').textContent=`${p}%`;$('achievementRing').style.setProperty('--progress',`${p}%`);
    $('achievementGrid').innerHTML=achievements.map(a=>`<article class="achievement-card ${a[3]?'unlocked':''}"><div class="achievement-icon">${a[1]}</div><h3>${a[2]}</h3><p>${a[3]?'¡Logro desbloqueado!':a[2]==='Primer paso'?'Registrá una serie para comenzar.':a[4]}</p><small>${a[3]?'✓ CONSEGUIDO':'○ BLOQUEADO'}</small></article>`).join('');
  }
  function renderAssistant() {
    const dates=allSessionDates(),exCount=new Set(sets.map(s=>s.exercise)).size,volume=totalVolume(),best=sets.slice().sort((a,b)=>e1rm(b.weight,b.reps)-e1rm(a.weight,a.reps))[0];
    const stagnant=allExercises().map(ex=>({ex,ss:sessionsOf(ex)})).filter(x=>x.ss.length>=3).sort((a,b)=>{const pa=pct(a.ss.at(-1).e1rm,a.ss.at(-3).e1rm)||0,pb=pct(b.ss.at(-1).e1rm,b.ss.at(-3).e1rm)||0;return pa-pb;})[0];
    const insights=[
      ['↗','Tu actividad',dates.length?`Registraste entrenamientos en ${dates.length} días distintos y trabajaste ${exCount} ejercicios.`:'Todavía no hay sesiones. Empezá con un registro simple y construí tu línea de base.'],
      ['♜','Tu mejor marca',best?`Tu mejor 1RM estimado es ${fmtNum(e1rm(best.weight,best.reps))} kg en ${best.exercise} (${fmtNum(best.weight)} kg × ${best.reps}).`:'Aún no hay marcas para comparar.'],
      ['▥','Volumen acumulado',`Llevás ${fmtNum(volume)} kg de volumen total registrado (peso × repeticiones).`],
      ['◎','Oportunidad de análisis',stagnant?`${stagnant.ex} tiene al menos tres sesiones para comparar. Revisá técnica, descanso y recuperación antes de cambiar la carga.`:'Con tres o más sesiones por ejercicio vas a poder detectar tendencias con mayor contexto.']
    ];
    $('assistantInsights').innerHTML=insights.map(i=>`<article class="insight-card"><span>${i[0]}</span><h3>${i[1]}</h3><p>${i[2]}</p></article>`).join('');
  }
  function answerPrompt(type) {
    const dates=allSessionDates(),sorted=allExercises().map(ex=>({ex,ss:sessionsOf(ex)})).filter(x=>x.ss.length);
    let answer='';
    if(type==='progress') {
      const changed=sorted.filter(x=>x.ss.length>=2).map(x=>({ex:x.ex,p:pct(x.ss.at(-1).e1rm,x.ss[0].e1rm)}));
      answer=changed.length?changed.map(x=>`${x.ex}: ${x.p>=0?'+':''}${fmtNum(x.p)}% de 1RM estimado desde el primer registro`).join('<br>'):'Todavía faltan al menos dos sesiones de un mismo ejercicio para comparar progreso. Registrá tus marcas con condiciones similares.';
    } else if(type==='stalled') {
      const candidates=sorted.filter(x=>x.ss.length>=3).map(x=>({ex:x.ex,p:pct(x.ss.at(-1).e1rm,x.ss.at(-3).e1rm)})).sort((a,b)=>a.p-b.p);
      answer=candidates.length?`El ejercicio con menor cambio en las últimas tres sesiones disponibles es <b>${esc(candidates[0].ex)}</b> (${candidates[0].p>=0?'+':''}${fmtNum(candidates[0].p)}%). Es una señal para revisar, no una prueba de estancamiento: mirá también técnica, RIR, sueño y recuperación.`:'Necesitás al menos tres sesiones del mismo ejercicio para estimar una tendencia reciente.';
    } else if(type==='volume') {
      const byDate={};sets.forEach(s=>byDate[s.date]=(byDate[s.date]||0)+s.weight*s.reps);
      const top=Object.entries(byDate).sort((a,b)=>b[1]-a[1])[0];
      answer=`Volumen acumulado: <b>${fmtNum(totalVolume())} kg</b> en ${sets.length} series. ${top?`Tu día de mayor volumen registrado fue ${fmtDate(top[0])}, con ${fmtNum(top[1])} kg.`:''} Compará semanas equivalentes y evitá subir el volumen de golpe.`;
    } else {
      const latest=dates.at(-1),rows=sets.filter(s=>s.date===latest);
      answer=latest?`En tu última fecha registrada (${fmtDate(latest)}) hiciste ${rows.length} series en ${new Set(rows.map(s=>s.exercise)).size} ejercicios. Revisá si anotaste RIR y descansos, compará la carga con sesiones anteriores y priorizá una técnica consistente.`:'Todavía no hay datos de entrenamiento. Registrá una sesión y volvé para recibir un análisis.';
    }
    $('assistantAnswer').innerHTML=answer;
  }
  function renderRoutines() {
    $('routineList').innerHTML=routines.length?routines.map(r=>`<article class="card routine-card"><span class="eyebrow">${esc(r.day||'RUTINA PERSONALIZADA')}</span><h3>${esc(r.name)}</h3><div class="routine-count">${r.exercises.length}</div><p>ejercicios incluidos</p><div class="hint-box">${r.exercises.slice(0,5).map(esc).join(' · ')}${r.exercises.length>5?' · …':''}</div><div class="routine-actions"><button class="btn btn-primary" data-routine-start="${r.id}">Iniciar rutina</button><button class="btn btn-secondary" data-routine-edit="${r.id}">Editar</button><button class="table-action delete" data-routine-delete="${r.id}">Eliminar</button></div></article>`).join(''):'<div class="card muted">Todavía no creaste rutinas. Usá “Crear rutina” para armar tu primer plan.</div>';
  }
  function openRoutine(r=null) {
    $('routineEditor').classList.remove('hidden');$('routineId').value=r?.id||'';$('routineName').value=r?.name||'';$('routineDay').value=r?.day||'';$('routineExercises').value=(r?.exercises||[]).join('\n');$('routineEditorTitle').textContent=r?'Editar rutina':'Nueva rutina';$('routineEditor').scrollIntoView({behavior:'smooth',block:'center'});
  }
  function renderExercises() {
    const q=$('exerciseSearch').value.toLowerCase(),m=$('muscleFilter').value;
    const list=allExercises().filter(ex=>ex.toLowerCase().includes(q)&&(!m||muscle(ex)===m));
    $('exerciseLibrary').innerHTML=list.map(ex=>{const count=sets.filter(s=>s.exercise===ex).length;return `<div class="exercise-item"><strong>${esc(ex)}</strong><small>${count} series registradas</small><span class="muscle-tag">${esc(muscle(ex))}</span></div>`}).join('')||'<p class="muted">No se encontraron ejercicios.</p>';
  }
  function setTimer(seconds) {
    clearInterval(timerInterval);timerRunning=false;timerRemaining=Math.max(1,Math.floor(seconds));updateTimer();$('timerStart').textContent='Iniciar';
  }
  function updateTimer() {$('timerDisplay').textContent=`${String(Math.floor(timerRemaining/60)).padStart(2,'0')}:${String(timerRemaining%60).padStart(2,'0')}`;}
  function toggleTimer() {
    if(timerRunning){clearInterval(timerInterval);timerRunning=false;$('timerStart').textContent='Continuar';return;}
    timerRunning=true;$('timerStart').textContent='Pausar';
    timerInterval=setInterval(()=>{timerRemaining--;updateTimer();if(timerRemaining<=0){clearInterval(timerInterval);timerRunning=false;$('timerStart').textContent='Iniciar';toast('¡Descanso finalizado! Prepará la próxima serie.');try{if('vibrate'in navigator)navigator.vibrate([180,100,180]);}catch{}}},1000);
  }
  function exportCsv() {
    const rows=[['fecha','ejercicio','peso_kg','repeticiones','rir','descanso_segundos','tipo','1rm_estimado','nota']];
    sets.slice().sort((a,b)=>a.date.localeCompare(b.date)).forEach(s=>rows.push([s.date,s.exercise,s.weight,s.reps,s.rir??'',s.rest??'',s.type||'Efectiva',e1rm(s.weight,s.reps).toFixed(1),s.note||'']));
    downloadBlob('\ufeff'+rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(';')).join('\n'),'progresionpage-series.csv','text/csv;charset=utf-8');
  }
  function downloadBlob(content,name,type) {
    const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1200);
  }
  function exportBackup() {
    const data={app:'ProgresionPage',version:2,exportedAt:new Date().toISOString(),sets,customExercises:custom,routines,bodyLogs};
    downloadBlob(JSON.stringify(data,null,2),'progresionpage-respaldo.json','application/json');
    $('backupStatus').textContent='Respaldo descargado correctamente.';
  }
  function importBackup(file) {
    const reader=new FileReader();reader.onload=()=>{
      try{const d=JSON.parse(reader.result);if(!d||!Array.isArray(d.sets)||!Array.isArray(d.customExercises))throw new Error('Formato no válido');
        sets=d.sets;custom=d.customExercises;routines=Array.isArray(d.routines)?d.routines:[];bodyLogs=Array.isArray(d.bodyLogs)?d.bodyLogs:[];
        persist();fillExerciseSelects();renderAll();$('backupStatus').textContent='Respaldo importado correctamente.';toast('Datos importados.');
      }catch(err){$('backupStatus').textContent='No se pudo importar: archivo inválido.';toast('El archivo no es un respaldo válido.',true);}
    };reader.readAsText(file);
  }
  function printReport() {
    const w=window.open('','_blank');if(!w){toast('Permití las ventanas emergentes para generar el informe.',true);return;}
    const rows=allExercises().map(ex=>({ex,ss:sessionsOf(ex)})).filter(x=>x.ss.length);
    w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Informe ProgresionPage</title><style>body{font:13px Arial;color:#17221a;margin:35px}h1{font-size:26px}h2{margin-top:28px}p{color:#56645a}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.box{border:1px solid #ccd6cb;padding:13px;border-radius:8px}.box b{display:block;font-size:21px;margin-top:5px}table{width:100%;border-collapse:collapse;margin-top:12px}td,th{text-align:left;border-bottom:1px solid #ddd;padding:8px;font-size:11px}th{background:#f0f4ed}@media print{button{display:none}}</style></head><body><h1>ProgresionPage · Informe de progreso</h1><p>Generado el ${fmtDate(today())}. Datos registrados en este dispositivo.</p><div class="grid"><div class="box">Sesiones<b>${sessionCount()}</b></div><div class="box">Series<b>${sets.length}</b></div><div class="box">Volumen acumulado<b>${fmtNum(totalVolume())} kg</b></div></div>${rows.map(x=>`<h2>${esc(x.ex)}</h2><table><thead><tr><th>Fecha</th><th>Series</th><th>Mejor serie</th><th>1RM estimado</th><th>Volumen</th></tr></thead><tbody>${x.ss.map(s=>`<tr><td>${fmtDate(s.date)}</td><td>${s.count}</td><td>${fmtNum(s.top.weight)} × ${s.top.reps}</td><td>${fmtNum(s.e1rm)} kg</td><td>${fmtNum(s.volume)} kg</td></tr>`).join('')}</tbody></table>`).join('')}<p>El 1RM es una estimación orientativa. Este informe no constituye una evaluación médica o deportiva profesional.</p><script>window.onload=()=>window.print()<\\/script></body></html>`);
    w.document.close();
  }
  function showConfirm(title,message,action) {
    $('modalTitle').textContent=title;$('modalText').textContent=message;$('modalBackdrop').classList.remove('hidden');pendingConfirm=action;
  }
  function closeConfirm(){ $('modalBackdrop').classList.add('hidden');pendingConfirm=null; }
  function renderAll() {
    fillExerciseSelects();renderDashboard();renderHint();renderSets();renderRoutines();renderExercises();renderProgress();renderRecords();renderCalendar();renderBody();renderAchievements();renderAssistant();
  }
  function bindEvents() {
    document.addEventListener('click',e=>{
      const nav=e.target.closest('[data-view]');if(nav){e.preventDefault();showView(nav.dataset.view);return;}
      const go=e.target.closest('[data-go]');if(go){showView(go.dataset.go);return;}
    });
    $('mobileMenu').addEventListener('click',()=>$('sidebar').classList.toggle('open'));
    $('themeToggle').addEventListener('click',toggleTheme);
    $('darkMode').addEventListener('change',e=>setTheme(e.target.checked?'dark':'light'));
    $('setForm').addEventListener('submit',handleSetSubmit);
    $('cancelEdit').addEventListener('click',()=>{clearEdit();$('setForm').reset();$('date').value=today();});
    $('exercise').addEventListener('change',renderHint);
    $('dashExercise').addEventListener('change',renderDashboard);
    $('progressExercise').addEventListener('change',renderProgress);
    $('metric').addEventListener('change',renderProgress);
    $('setFilter').addEventListener('change',renderSets);
    $('addExercise').addEventListener('click',()=>{
      const name=$('newExercise').value.trim();if(!name)return;
      const existing=allExercises().find(x=>x.toLowerCase()===name.toLowerCase());
      if(!existing)custom.push(name);persist();fillSelect('exercise',existing||name);fillExerciseSelects();$('exercise').value=existing||name;$('newExercise').value='';renderAll();toast(existing?'Ese ejercicio ya existía.':'Ejercicio agregado.');
    });
    $('newExercise').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('addExercise').click();}});
    $('setsTable').addEventListener('click',e=>{
      const edit=e.target.closest('[data-edit]'),del=e.target.closest('[data-delete]');
      if(edit)editSet(edit.dataset.edit);
      if(del)showConfirm('Eliminar serie','Esta acción no se puede deshacer.',()=>{sets=sets.filter(s=>s.id!==del.dataset.delete);persist();renderAll();toast('Serie eliminada.');});
    });
    $('newRoutine').addEventListener('click',()=>openRoutine());
    $('closeRoutine').addEventListener('click',()=>$('routineEditor').classList.add('hidden'));
    $('routineForm').addEventListener('submit',e=>{
      e.preventDefault();const id=$('routineId').value||uid(),item={id,name:$('routineName').value.trim(),day:$('routineDay').value.trim(),exercises:$('routineExercises').value.split('\n').map(x=>x.trim()).filter(Boolean)};
      const idx=routines.findIndex(r=>r.id===id);if(idx>=0)routines[idx]=item;else routines.push(item);
      persist();$('routineEditor').classList.add('hidden');renderRoutines();renderAchievements();toast('Rutina guardada.');
    });
    $('routineList').addEventListener('click',e=>{
      const edit=e.target.closest('[data-routine-edit]'),del=e.target.closest('[data-routine-delete]'),start=e.target.closest('[data-routine-start]');
      if(edit)openRoutine(routines.find(r=>r.id===edit.dataset.routineEdit));
      if(del)showConfirm('Eliminar rutina','Se eliminará esta rutina, pero tus registros de entrenamiento se conservarán.',()=>{routines=routines.filter(r=>r.id!==del.dataset.routineDelete);persist();renderRoutines();renderAchievements();});
      if(start){const r=routines.find(x=>x.id===start.dataset.routineStart);if(r){showView('training');if(r.exercises[0]){fillSelect('exercise',r.exercises[0]);$('exercise').value=r.exercises[0];renderHint();}$('formStatus').textContent=`Rutina iniciada: ${r.name}. Registrá cada serie de sus ejercicios.`;}}
    });
    $('exerciseSearch').addEventListener('input',renderExercises);$('muscleFilter').addEventListener('change',renderExercises);
    $('timerStart').addEventListener('click',toggleTimer);$('timerReset').addEventListener('click',()=>setTimer(90));$('startTimerTop').addEventListener('click',()=>{showView('training');$('timerDisplay').scrollIntoView({behavior:'smooth',block:'center'});});
    document.querySelectorAll('[data-seconds]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-seconds]').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');setTimer(Number(b.dataset.seconds));}));
    $('setCustomTimer').addEventListener('click',()=>{const n=Number($('customSeconds').value);if(n>0&&n<=3600)setTimer(n);else toast('Ingresá un tiempo entre 1 y 3600 segundos.',true);});
    $('prevMonth').addEventListener('click',()=>{calendarMonth.setMonth(calendarMonth.getMonth()-1);renderCalendar();});
    $('nextMonth').addEventListener('click',()=>{calendarMonth.setMonth(calendarMonth.getMonth()+1);renderCalendar();});
    $('calendarGrid').addEventListener('click',e=>{const b=e.target.closest('[data-day]');if(!b)return;selectedDate=parseDate(b.dataset.day);calendarMonth=new Date(selectedDate.getFullYear(),selectedDate.getMonth(),1);renderCalendar();});
    $('bodyForm').addEventListener('submit',e=>{
      e.preventDefault();const fields=['Weight','Height','Waist','Chest','Arm','Leg'],keys=['weight','height','waist','chest','arm','leg'],item={id:uid(),date:$('bodyDate').value||today(),note:$('bodyNote').value.trim()};
      fields.forEach((f,i)=>{const v=$(`body${f}`).value;item[keys[i]]=v===''?null:Number(v);});
      if(keys.every(k=>item[k]===null)){toast('Ingresá al menos una medida.',true);return;}
      bodyLogs.push(item);try{localStorage.setItem(KEYS.body,JSON.stringify(bodyLogs));}catch{}
      $('bodyForm').reset();$('bodyDate').value=today();$('bodyStatus').textContent='Medición guardada.';renderBody();renderAchievements();toast('Medición registrada.');
    });
    $('bodyTable').addEventListener('click',e=>{const b=e.target.closest('[data-body-delete]');if(b)showConfirm('Eliminar medición','Se eliminará este registro corporal.',()=>{bodyLogs=bodyLogs.filter(x=>x.id!==b.dataset.bodyDelete);try{localStorage.setItem(KEYS.body,JSON.stringify(bodyLogs));}catch{}renderBody();renderAchievements();});});
    $('achievementGrid').addEventListener('click',()=>{});
    $('assistantInsights').addEventListener('click',()=>{});
    document.querySelectorAll('[data-prompt]').forEach(b=>b.addEventListener('click',()=>answerPrompt(b.dataset.prompt)));
    $('exportCsv').addEventListener('click',exportCsv);
    $('backupExport').addEventListener('click',exportBackup);
    $('backupImport').addEventListener('change',e=>{if(e.target.files[0])importBackup(e.target.files[0]);e.target.value='';});
    $('pdfReport').addEventListener('click',printReport);
    $('resetAll').addEventListener('click',()=>showConfirm('Restablecer aplicación','Se eliminarán todos tus registros, ejercicios personalizados, rutinas y mediciones. Esta acción no se puede deshacer.',()=>{sets=[];custom=[];routines=[];bodyLogs=[];persist();renderAll();toast('Aplicación restablecida.');}));
    $('modalClose').addEventListener('click',closeConfirm);$('modalCancel').addEventListener('click',closeConfirm);
    $('modalConfirm').addEventListener('click',()=>{const fn=pendingConfirm;closeConfirm();if(fn)fn();});
    $('modalBackdrop').addEventListener('click',e=>{if(e.target===$('modalBackdrop'))closeConfirm();});
    window.addEventListener('resize',()=>{if(currentView==='dashboard')renderDashboard();if(currentView==='progress')renderProgress();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('sidebar').classList.remove('open');closeConfirm();}});
  }
  function setTheme(theme) {
    document.body.classList.toggle('light',theme==='light');localStorage.setItem(KEYS.theme,theme);
    $('darkMode').checked=theme==='dark';$('themeToggle').textContent=theme==='dark'?'☼':'☾';
    $('themeToggle').title=theme==='dark'?'Cambiar a modo claro':'Cambiar a modo oscuro';
    if(currentView==='dashboard')renderDashboard();if(currentView==='progress')renderProgress();
  }
  function toggleTheme(){setTheme(document.body.classList.contains('light')?'dark':'light');}
  function init() {
    $('date').value=today();$('bodyDate').value=today();
    $('todayLabel').textContent=new Date().toLocaleDateString('es-AR',{weekday:'short',day:'numeric',month:'short'});
    setTheme(localStorage.getItem(KEYS.theme) || 'dark');
    fillExerciseSelects();bindEvents();renderAll();showView('dashboard');updateTimer();
  }
  init();
})();