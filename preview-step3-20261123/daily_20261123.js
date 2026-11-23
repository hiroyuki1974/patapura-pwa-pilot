/* パタプラ v0.7 今日の3レッスン／3教材プログラム */
(function(){
'use strict';
const D=PatapuraDailyCore;
const $=id=>document.getElementById(id);
let startupComplete=false;
let recordProgram='business';
const groupOf=id=>id?.startsWith('meeting:')||id?.startsWith('facilitation:')?'meeting_facilitation':id?.startsWith('colloquial:')?'colloquial':'business';
function shortLabel(id){if(!id)return '終了';const [track,n]=id.split(':');return track==='meeting'?'会議 '+n:track==='facilitation'?'ファシリ '+n:'Lesson '+n;}
function showView(view){for(const k of ['Study','Records','Settings']){$(k.toLowerCase()+'View').hidden=k!==view;$('show'+k).setAttribute('aria-pressed',String(k===view));}if(view==='Records')renderRecords();}
function syncUnified(){const select=$('unifiedLessonSelect');const actual=$('offlineLessonSelect').value;const group=actual?groupOf(actual):$('programSelect').value;const p=D.PROGRAMS.find(x=>x.key===group);select.replaceChildren();if(!p||!actual){select.disabled=true;return;}select.disabled=false;for(const [i,id] of p.sequence.entries()){const o=document.createElement('option');o.value=id;o.textContent=group==='meeting_facilitation'?String(i+1).padStart(2,'0')+'｜'+shortLabel(id):shortLabel(id);select.append(o);}select.value=actual;}
function openRecord(id){showView('Study');const track=id.split(':')[0];document.dispatchEvent(new CustomEvent('patapura:navigate',{detail:{track,id,kind:track==='colloquial'?'type_b':'review'}}));$('secOfflineLibrary').scrollIntoView({behavior:'smooth',block:'start'});}
function renderRecords(){const p=D.PROGRAMS.find(x=>x.key===recordProgram)||D.PROGRAMS[0];const dates=progress.lessons||{};const total=D.PROGRAMS.reduce((n,x)=>n+x.sequence.filter(id=>Boolean(dates[id])).length,0);$('recordsTotal').textContent=total+' / 217';$('recordSummary').textContent=p.sequence.filter(id=>Boolean(dates[id])).length+' / '+p.sequence.length+' レッスン完了';const tabs=$('recordTabs');tabs.replaceChildren();for(const x of D.PROGRAMS){const b=document.createElement('button');b.type='button';b.textContent=x.title;b.setAttribute('aria-pressed',String(x.key===p.key));b.addEventListener('click',()=>{recordProgram=x.key;renderRecords();});tabs.append(b);}const rows=$('recordRows');rows.replaceChildren();for(const [i,id] of p.sequence.entries()){const tr=document.createElement('tr');const number=document.createElement('td');number.textContent=String(i+1);const lesson=document.createElement('td');const b=document.createElement('button');b.type='button';b.className='record-link';b.textContent=shortLabel(id);b.addEventListener('click',()=>openRecord(id));lesson.append(b);const date=document.createElement('td');date.textContent=dates[id]||'—';if(dates[id])tr.className='record-complete';tr.append(number,lesson,date);rows.append(tr);}}
function setupTheme(){const modes=['auto','light','dark'],labels={auto:'自動',light:'ライト',dark:'ダーク'};let mode='auto';try{const v=localStorage.getItem('patapura-theme');if(modes.includes(v))mode=v;}catch(_){}const mq=matchMedia('(prefers-color-scheme: dark)');const apply=()=>{document.documentElement.dataset.theme=mode==='auto'?(mq.matches?'dark':'light'):mode;$('themeBtn').textContent=labels[mode];$('themeBtn').setAttribute('aria-label','表示モード：'+labels[mode]+'。押すと切り替え');};$('themeBtn').addEventListener('click',()=>{mode=modes[(modes.indexOf(mode)+1)%modes.length];try{localStorage.setItem('patapura-theme',mode);}catch(_){}apply();});mq.addEventListener?.('change',apply);apply();}

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
  document.dispatchEvent(new CustomEvent('patapura:navigate',{detail:{track,id:task.id,kind:track==='colloquial'?'type_b':'review'}}));
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
  const id=p.ids[program.key],done=id?Boolean(progress.lessons?.[id]):true;
  const article=document.createElement('article');article.className='daily-card'+(done?' daily-done':'');
  const heading=document.createElement('div');heading.className='daily-top';
  const h=document.createElement('strong');h.textContent=program.title;
  const state=document.createElement('span');state.className='daily-state';state.textContent=!id?'全課程完了':done?'完了':'未完了';
  heading.append(h);
  const target=document.createElement('p');target.className='daily-target';target.textContent=D.lessonLabel(id);
  article.append(heading,target,state,makeButton({id,done}));root.append(article);
 }
 $('dailyMessage').textContent=finished===3?'今日の学習完了':'';
 syncProgram();
}
document.addEventListener('DOMContentLoaded',async()=>{
 setupTheme();
 $('showStudy').addEventListener('click',()=>showView('Study'));
 $('showRecords').addEventListener('click',()=>showView('Records'));
 $('showSettings').addEventListener('click',()=>showView('Settings'));
 $('unifiedLessonSelect').addEventListener('change',()=>{const id=$('unifiedLessonSelect').value;if(id)openRecord(id);});
 document.addEventListener('patapura:selection',syncUnified);
 document.addEventListener('patapura:library-ready',syncUnified);
 document.addEventListener('patapura:progress',()=>{if(!$('recordsView').hidden)renderRecords();});
 await appReady;startupComplete=true;
 await ensureDaily();
 render();syncUnified();
 const p=$('programSelect');
 p.addEventListener('change',()=>{
  const program=p.value;
  const current=$('offlineCourseSelect').value;
  const planned=progress.dailyPlan?.ids?.[program];
  let track=program==='meeting_facilitation'?(current==='meeting'||current==='facilitation'?current:'meeting'):program==='business'?'standard':'colloquial';
  if(planned&&program==='meeting_facilitation')track=planned.split(':')[0];
  const id=planned?.startsWith(track+':')?planned:undefined;
  document.dispatchEvent(new CustomEvent('patapura:navigate',{detail:{track,id,kind:track==='colloquial'?'type_b':'review'}}));
 });
 document.addEventListener('patapura:progress',render);
 document.addEventListener('patapura:selection',syncProgram);
 document.addEventListener('patapura:library-ready',syncProgram);
 document.addEventListener('progressrestored',async()=>{await ensureDaily();render();});
 document.addEventListener('trialreset',render);
 window.addEventListener('pageshow',async()=>{await ensureDaily();render();});
});
})();
