/* パタプラ v0.7 今日の3レッスン／3教材プログラム */
(function(){
'use strict';
const D=PatapuraDailyCore;
const $=id=>document.getElementById(id);
let startupComplete=false;
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
 if(detailed)detailed.hidden=group!=='meeting_facilitation';
}
function makeButton(task){
 const b=document.createElement('button');b.type='button';b.className='daily-open';
 b.textContent=task.done?'復習する':'学習を開く';
 b.disabled=!task.id;
 b.addEventListener('click',()=>{
  const [track]=task.id.split(':');
  document.dispatchEvent(new CustomEvent('patapura:navigate',{detail:{track,id:task.id,kind:'main'}}));
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
  heading.append(h,state);
  const target=document.createElement('p');target.className='daily-target';target.textContent=D.lessonLabel(id);
  article.append(heading,target,makeButton({id,done}));root.append(article);
 }
 $('dailyMessage').textContent=finished===3?'今日の3プログラムは完了です。次の学習日は未完了分から進みます。':'完了したレッスンだけ次の学習日に進みます。休んだ日は飛ばしません。';
 syncProgram();
}
document.addEventListener('DOMContentLoaded',async()=>{
 await appReady;startupComplete=true;
 await ensureDaily();
 render();
 const p=$('programSelect');
 p.addEventListener('change',()=>{
  const program=p.value;
  const current=$('offlineCourseSelect').value;
  let track=program==='meeting_facilitation'?(current==='meeting'||current==='facilitation'?current:'meeting'):program==='business'?'standard':'colloquial';
  const planned=progress.dailyPlan?.ids?.[program];
  const id=planned?.startsWith(track+':')?planned:undefined;
  document.dispatchEvent(new CustomEvent('patapura:navigate',{detail:{track,id,kind:'main'}}));
  syncProgram();
 });
 document.addEventListener('patapura:progress',render);
 document.addEventListener('patapura:selection',syncProgram);
 document.addEventListener('patapura:library-ready',syncProgram);
 document.addEventListener('progressrestored',async()=>{await ensureDaily();render();});
 document.addEventListener('trialreset',render);
 window.addEventListener('pageshow',async()=>{await ensureDaily();render();});
});
})();
