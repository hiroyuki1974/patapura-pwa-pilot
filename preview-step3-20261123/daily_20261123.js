/* build:v21inline-20261125 */
/* パタプラ v0.7 今日の3レッスン／3教材プログラム */
(function(){
'use strict';
const D=PatapuraDailyCore;
const $=id=>document.getElementById(id);
let startupComplete=false;
let recordProgram='business';
let editing=null,editBusy=false;
const groupOf=id=>id?.startsWith('meeting:')||id?.startsWith('facilitation:')?'meeting_facilitation':id?.startsWith('colloquial:')?'colloquial':'business';
function shortLabel(id){if(!id)return '終了';const [track,n]=id.split(':');return track==='meeting'?'会議 '+n:track==='facilitation'?'ファシリ '+n:'Lesson '+n;}
function showView(view){for(const k of ['Study','Records','Settings']){$(k.toLowerCase()+'View').hidden=k!==view;$('show'+k).setAttribute('aria-pressed',String(k===view));}if(view==='Records')renderRecords();}
function syncUnified(){const select=$('unifiedLessonSelect');const actual=$('offlineLessonSelect').value;const group=actual?groupOf(actual):$('programSelect').value;const p=D.PROGRAMS.find(x=>x.key===group);select.replaceChildren();if(!p||!actual){select.disabled=true;return;}select.disabled=false;for(const [i,id] of p.sequence.entries()){const o=document.createElement('option');o.value=id;o.textContent=group==='meeting_facilitation'?String(i+1).padStart(2,'0')+'｜'+shortLabel(id):shortLabel(id);select.append(o);}select.value=actual;}
function openRecord(id,round){showView('Study');const track=id.split(':')[0];document.dispatchEvent(new CustomEvent('patapura:navigate',{detail:{track,id,round:round||D.roundForLesson(progress,id,localDate()),kind:track==='colloquial'?preferredColloquialKind():'review'}}));$('secOfflineLibrary').scrollIntoView({behavior:'smooth',block:'start'});}
function closeEdit(){if(editBusy)return;editing=null;$('recordEdit').hidden=true;$('recordEditStatus').textContent='';}
function openEdit(id,round){if(editBusy)return;editing={id,round};$('recordEditTitle').textContent=shortLabel(id)+'・'+round+'周目';const date=D.readDate(progress,id,round);$('recordDate').value=date||localDate();$('recordClear').disabled=!date;$('recordEditStatus').textContent='';$('recordEdit').hidden=false;$('recordEdit').scrollIntoView({behavior:'smooth',block:'nearest'});}
async function saveEdit(remove=false){
 if(!editing||editBusy)return;
 const {id,round}=editing,previous=D.readDate(progress,id,round);
 if(remove&&!confirm('この周回の学習記録を削除しますか？'))return;
 const date=remove?null:$('recordDate').value;
 if(date!==null&&!D.validDate(date)){$('recordEditStatus').textContent='正しい日付を入力してください';return;}
 editBusy=true;$('recordSave').disabled=true;$('recordClear').disabled=true;
 try{D.setDate(progress,id,round,date);await saveProgress();notice('学習記録を更新しました');editBusy=false;closeEdit();renderRecords();}
 catch(err){D.setDate(progress,id,round,previous);$('recordEditStatus').textContent='保存できませんでした';renderProgress();renderRecords();}
 finally{editBusy=false;$('recordSave').disabled=false;$('recordClear').disabled=!D.readDate(progress,id,round);}
}
function renderRecords(){
 const p=D.PROGRAMS.find(x=>x.key===recordProgram)||D.PROGRAMS[0];
 const counts=(x)=>Array.from({length:D.MAX_ROUNDS},(_,i)=>x.sequence.filter(id=>D.readDate(progress,id,i+1)).length);
 const groupCounts=counts(p),total=D.PROGRAMS.reduce((n,x)=>n+counts(x).reduce((s,c)=>s+c,0),0);
 $('recordsTotal').textContent=total+' / '+(217*D.MAX_ROUNDS);
 $('recordSummary').textContent=groupCounts.map((n,i)=>(i+1)+'周 '+n+'/'+p.sequence.length).join(' ｜ ');
 const tabs=$('recordTabs');tabs.replaceChildren();
 for(const x of D.PROGRAMS){const b=document.createElement('button');b.type='button';b.textContent=x.title;b.setAttribute('aria-pressed',String(x.key===p.key));b.addEventListener('click',()=>{if(editBusy)return;closeEdit();recordProgram=x.key;renderRecords();});tabs.append(b);}
 const rows=$('recordRows');rows.replaceChildren();
 for(const id of p.sequence){
  const tr=document.createElement('tr'),lesson=document.createElement('td'),b=document.createElement('button');b.type='button';b.className='record-link';b.textContent=shortLabel(id);b.addEventListener('click',()=>openRecord(id));lesson.append(b);tr.append(lesson);
  for(let r=1;r<=D.MAX_ROUNDS;r++){const td=document.createElement('td'),btn=document.createElement('button'),date=D.readDate(progress,id,r);btn.type='button';btn.className='record-date'+(date?' has-date':'');btn.textContent=date?date.replaceAll('-','/'):'—';btn.setAttribute('aria-label',shortLabel(id)+' '+r+'周目 '+(date||'未完了')+' 記録編集');btn.addEventListener('click',()=>openEdit(id,r));td.append(btn);tr.append(td);}
  rows.append(tr);
 }
}
function setupTheme(){const modes=['auto','light','dark'],labels={auto:'自動',light:'ライト',dark:'ダーク'};let mode='auto';try{const v=localStorage.getItem('patapura-theme');if(modes.includes(v))mode=v;}catch(_){}const mq=matchMedia('(prefers-color-scheme: dark)');const apply=()=>{document.documentElement.dataset.theme=mode==='auto'?(mq.matches?'dark':'light'):mode;$('themeBtn').textContent=labels[mode];$('themeBtn').setAttribute('aria-label','表示モード：'+labels[mode]+'。押すと切り替え');};$('themeBtn').addEventListener('click',()=>{mode=modes[(modes.indexOf(mode)+1)%modes.length];try{localStorage.setItem('patapura-theme',mode);}catch(_){}apply();});mq.addEventListener?.('change',apply);apply();}

function setupFontSize(){
 if(!$('fontMinus')||!$('fontPlus')||!$('fontReset')||!$('fontPercent'))return;
 const levels=[80,90,100,110,120,130,140,150];
 let size=100;
 try{const stored=Number(localStorage.getItem('patapura-font-percent'));if(levels.includes(stored))size=stored;}catch(_){}
 const apply=()=>{document.documentElement.style.setProperty('--study-font-scale',String(size/100));$('fontPercent').textContent=size+'%';$('fontMinus').disabled=size===levels[0];$('fontPlus').disabled=size===levels.at(-1);};
 const set=(next)=>{size=next;try{localStorage.setItem('patapura-font-percent',String(size));}catch(_){}apply();};
 $('fontMinus').addEventListener('click',()=>set(levels[Math.max(0,levels.indexOf(size)-1)]));
 $('fontPlus').addEventListener('click',()=>set(levels[Math.min(levels.length-1,levels.indexOf(size)+1)]));
 $('fontReset').addEventListener('click',()=>set(100));
 apply();
}
async function ensureDaily(){
 if(!progress.lessons)progress.lessons={};
 const selected=D.plan(progress,localDate());
 if(progress.dailyPlan!==selected){
  progress.dailyPlan=selected;
  try{await saveProgress();}catch(err){log('日別学習プラン保存失敗：'+err.message);}
 }
 return selected;
}
function syncProgram(){
 const actual=$('offlineCourseSelect').value;
 const p=$('programSelect');
 if(!p)return;
 const group=actual==='meeting'||actual==='facilitation'?'meeting_facilitation':actual==='colloquial'?'colloquial':'business';
 p.value=group;
 const detailed=$('trackDetailWrap');
 if(detailed)detailed.hidden=true;
 const trackSelect=$('offlineCourseSelect');
 for(const opt of trackSelect.options){
  const filtered=group==='meeting_facilitation'&&opt.value!=='meeting'&&opt.value!=='facilitation';
  opt.hidden=filtered;opt.disabled=filtered;
 }
}
function makeButton(task){
 const b=document.createElement('button');b.type='button';b.className='daily-open';
 b.textContent=task.done?'復習する':'学習を開く';
 b.disabled=!task.id;
 b.addEventListener('click',()=>{
  const [track]=task.id.split(':');
  document.dispatchEvent(new CustomEvent('patapura:navigate',{detail:{track,id:task.id,round:task.round,kind:track==='colloquial'?preferredColloquialKind():'review'}}));
  document.getElementById('secOfflineLibrary')?.scrollIntoView({behavior:'smooth',block:'start'});
 });
 return b;
}
function render(){
 if(!startupComplete)return;
 const p=D.plan(progress,localDate());
 const root=$('dailyCards');if(!root)return;
 root.replaceChildren();
 const finished=D.countFinished(p,progress);
 $('dailyCount').textContent=finished+' / 3 完了';
 $('dailyDate').textContent=p.date;
 for(const program of D.PROGRAMS){
  const id=p.ids[program.key],round=p.rounds[program.key],done=id?Boolean(D.readDate(progress,id,round)):true;
  const article=document.createElement('article');article.className='daily-card'+(done?' daily-done':'');
  const heading=document.createElement('div');heading.className='daily-top';
  const h=document.createElement('strong');h.textContent=program.title;
  const state=document.createElement('span');state.className='daily-state';state.textContent=!id?'全課程完了':done?'完了':'未完了';
  heading.append(h);
  const target=document.createElement('p');target.className='daily-target';target.textContent=shortLabel(id)+(id&&round>1?' · '+round+'周':'');
  article.append(heading,target,state,makeButton({id,done,round}));root.append(article);
 }
 $('dailyMessage').textContent=finished===3?'今日の学習完了':'';
 syncProgram();
}
document.addEventListener('DOMContentLoaded',async()=>{
 setupTheme();setupFontSize();
 $('backToTop')?.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
 const pref=$('colloquialPreference');
 pref?.addEventListener('change',()=>{const kind=pref.value==='type_c'?'type_c':'type_b';try{localStorage.setItem('patapura-colloquial-kind',kind);}catch(_){}document.dispatchEvent(new Event('patapura:audio-preference'));});
 $('showStudy').addEventListener('click',()=>showView('Study'));
 $('showRecords').addEventListener('click',()=>showView('Records'));
 $('showSettings').addEventListener('click',()=>showView('Settings'));
 $('recordSave').addEventListener('click',()=>saveEdit());
 $('recordClear').addEventListener('click',()=>saveEdit(true));
 $('recordCancel').addEventListener('click',closeEdit);
 document.addEventListener('patapura:home',()=>{showView('Study');$('dailyPanel').scrollIntoView({behavior:'smooth',block:'start'});});
 $('unifiedLessonSelect').addEventListener('change',()=>{const id=$('unifiedLessonSelect').value;if(id)openRecord(id);});
 document.addEventListener('patapura:selection',syncUnified);
 document.addEventListener('patapura:library-ready',syncUnified);
 document.addEventListener('patapura:progress',()=>{if(!$('recordsView').hidden)renderRecords();});
 await appReady;startupComplete=true;
 if(pref){pref.value=preferredColloquialKind();try{localStorage.setItem('patapura-colloquial-kind',pref.value);}catch(_){}}
 await ensureDaily();
 render();syncUnified();
 const p=$('programSelect');
 p.addEventListener('change',()=>{
  const program=p.value;
  const current=$('offlineCourseSelect').value;
  const planned=D.plan(progress,localDate()).ids[program];
  let track=program==='meeting_facilitation'?(current==='meeting'||current==='facilitation'?current:'meeting'):program==='business'?'standard':'colloquial';
  if(planned&&program==='meeting_facilitation')track=planned.split(':')[0];
  const id=planned?.startsWith(track+':')?planned:undefined;
  document.dispatchEvent(new CustomEvent('patapura:navigate',{detail:{track,id,round:D.plan(progress,localDate()).rounds[program],kind:track==='colloquial'?preferredColloquialKind():'review'}}));
 });
 document.addEventListener('patapura:progress',render);
 document.addEventListener('patapura:selection',syncProgram);
 document.addEventListener('patapura:library-ready',syncProgram);
 document.addEventListener('progressrestored',async()=>{await ensureDaily();render();});
 document.addEventListener('trialreset',render);
 window.addEventListener('pageshow',async()=>{await ensureDaily();render();});
});
})();
