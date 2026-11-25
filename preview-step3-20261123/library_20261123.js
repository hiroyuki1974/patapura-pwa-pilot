/* build:v18topplayer-20261125 */
/* v0.6 / 2026-11-23. Adapted from the v0.5 offline reader. */
(function(){
'use strict';
const C=PatapuraCore, $=id=>document.getElementById(id);
const KEY='display-library:all217';
let library=null,audioKeys=new Set(),busy=false,cancelImport=false,selectionToken=0;
const report=(message,bad=false)=>{$('offlineImportStatus').textContent=message;$('offlineImportStatus').classList.toggle('study-error',bad);};
function option(select,value,title){const n=document.createElement('option');n.value=value;n.textContent=title;select.append(n);}
function currentLesson(){return library?.lessons.find(l=>l.id===$('offlineLessonSelect').value&&l.track===$('offlineCourseSelect').value);}
function renderSummary(){
 $('offlineLibrarySummary').replaceChildren();
 const groups=[{label:'ビジネス',tracks:['standard']},{label:'会議・ファシリテーション',tracks:['meeting','facilitation']},{label:'口語表現',tracks:['colloquial']}];
 for(const g of groups){
  const p=document.createElement('p');p.className='library-summary-line';
  const count=library?.lessons.filter(l=>g.tracks.includes(l.track)).length||0;
  const total=g.tracks.reduce((n,t)=>n+C.COUNTS[t],0);
  const expectedKeys=g.tracks.flatMap(t=>Array.from({length:C.COUNTS[t]},(_,i)=>(t==='colloquial'?['type_b','type_c']:['review']).map(k=>C.audioId(t,i+1,k))).flat());
  const loaded=expectedKeys.filter(k=>audioKeys.has(k)).length;
  p.textContent=`${g.label}：本文 ${count} / ${total}件・復習音声 ${loaded} / ${expectedKeys.length}本`;
  $('offlineLibrarySummary').append(p);
 }
 $('offlineTotalCount').textContent=(library?.lessons.length||0)+' / 217 レッスン';
}
function renderBody(lesson){
 const reader=$('offlineLessonBody');reader.replaceChildren();
 if(!lesson){$('offlineLessonMeta').textContent='統合JSONを取り込むと本文を表示します';return;}
 $('offlineLessonMeta').textContent=C.NAMES[lesson.track]+' / '+lesson.sections.length+'区分';
 const h=document.createElement('h3');h.className='lesson-heading';h.textContent=lesson.title;reader.append(h);
 if(lesson.introduction){const p=document.createElement('p');p.className='lesson-introduction';p.textContent=lesson.introduction;reader.append(p);}
 let lastPhase='';
 for(const s of lesson.sections){
  if((s.phase||'本文')!==lastPhase){const tag=document.createElement('div');tag.className='study-phase';tag.textContent=s.phase||'本文';reader.append(tag);lastPhase=s.phase||'本文';}
  const section=document.createElement('section');section.className='study-section';
  const h4=document.createElement('h4');h4.textContent=(s.reviewOnly?'【復習専用】 ':'')+s.heading;section.append(h4);
  for(const line of s.lines){
   const p=document.createElement('p');
   const ja=(line.match(/[\u3040-\u30ff\u3400-\u9fff]/g)||[]).length,en=(line.match(/[A-Za-z]/g)||[]).length;
   p.className='study-line '+(/^【/.test(line)?'study-label':en>ja*1.2?'study-en':ja>en*.7?'study-ja':'study-mixed');p.textContent=line;section.append(p);
  }
  reader.append(section);
 }
}
async function loadAudioKeys(){
 const db=await openDB();try{audioKeys=new Set(await new Promise((resolve,reject)=>{const r=db.transaction('audio','readonly').objectStore('audio').getAllKeys();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);}));}finally{db.close();}
}
async function selectAudio(persist=true){
 const token=++selectionToken,lesson=currentLesson(),kind=$('audioKindSelect').value;
 audioRecord=null;refreshAudio();renderStorage();
 MEDIA_ID=lesson?C.audioId(lesson.track,lesson.number,kind):'unselected';
 const status=$('selectedAudioStatus'),row=status.closest('.audio-kind-row');
 status.hidden=false;if(row)row.hidden=false;
 status.textContent=lesson?'音声を確認中…':'本文JSONを先に取り込んでください';
 if(!lesson)return;
 const id=MEDIA_ID;
 try{
  const record=await recordGet('audio',id);
  if(token!==selectionToken)return;
  audioRecord=record;renderStorage();refreshAudio();
  status.textContent=record?'':`${C.label(kind)}：未登録`;
  status.hidden=Boolean(record);
  if(row)row.hidden=Boolean(record);
  if(persist){progress.selection={track:lesson.track,id:lesson.id,kind,round:selectedRound};await saveProgress();}
 }catch(err){if(token===selectionToken){$('selectedAudioStatus').textContent='音声読込失敗：'+err.message;log('音声読込失敗：'+err.message);}}
}
function refreshAudioKinds(preferred){
 const lesson=currentLesson(),select=$('audioKindSelect');select.replaceChildren();
 select.hidden=true;
 if(lesson){
  const allowed=lesson.track==='colloquial'?['type_b','type_c']:['review'];
  for(const a of C.candidates(lesson.track,lesson.number).filter(a=>allowed.includes(a.kind)))option(select,a.kind,a.label+(audioKeys.has(a.key)?'':'・未登録'));
  select.value=lesson.track==='colloquial'?preferredColloquialKind():'review';
 }
}
async function showLesson(persist=true,preferred){
 const lesson=currentLesson();selectedLessonId=lesson?.id||'';
 renderBody(lesson);refreshAudioKinds(preferred);renderProgress();await selectAudio(persist);
 document.dispatchEvent(new Event('patapura:selection'));
}
async function refreshLessons(preferred,persist=true,kind,round){
 const select=$('offlineLessonSelect');select.replaceChildren();
 for(const l of library?.lessons.filter(l=>l.track===$('offlineCourseSelect').value).sort((a,b)=>a.number-b.number)||[])option(select,l.id,l.title);
 if([...select.options].some(o=>o.value===preferred))select.value=preferred;
 const lesson=currentLesson();
 selectedRound=lesson?PatapuraDailyCore.roundForLesson(progress,lesson.id,localDate()):1;
 await showLesson(persist,kind);
}
async function refreshCourses(selection=progress.selection,persist=true){
 const select=$('offlineCourseSelect');select.replaceChildren();
 for(const t of C.ORDER)if(library)option(select,t,C.NAMES[t]);
 if(C.ORDER.includes(selection?.track))select.value=selection.track;
 await refreshLessons(selection?.id,persist,selection?.kind,selection?.round);
}
function setBusy(value){
 busy=value;
 for(const id of ['offlineJsonFiles','audioFile','audioImportCourse','offlineCourseSelect','offlineLessonSelect','audioKindSelect','resetData','backupFile','programSelect','unifiedLessonSelect','colloquialPreference'])if($(id))$(id).disabled=value;
 $('cancelAudioImport').disabled=!value;
}
function batchStatus(r){
 $('audioImportStatus').textContent=`${r.processed} / ${r.total}件処理・成功 ${r.success}（置換 ${r.replaced}）・同一のため省略 ${r.skipped}・エラー ${r.errors.length}`+(r.cancelled?`・中断／未処理 ${r.total-r.processed}件`:'');
 $('audioImportProgress').max=Math.max(1,r.total);$('audioImportProgress').value=r.processed;
}
document.addEventListener('DOMContentLoaded',async()=>{
 await appReady;
 for(const t of C.ORDER)option($('audioImportCourse'),t,C.NAMES[t]);
 try{const record=await recordGet('progress',KEY);if(record)library=C.validateLibrary(record.payload);await loadAudioKeys();renderSummary();await refreshCourses(undefined,false);document.dispatchEvent(new Event('patapura:library-ready'));}
 catch(err){report('保存データの読込失敗：'+err.message,true);}
 $('offlineJsonFiles').addEventListener('change',async e=>{
  const file=e.target.files?.[0];if(!file||busy)return;setBusy(true);
  try{
   if(file.size>16*1024*1024)throw Error('16 MB以下の統合JSONを選択してください');
   const parsed=C.validateLibrary(JSON.parse(await file.text()));
   await recordPut('progress',{id:KEY,payload:parsed,receivedAt:new Date().toISOString()});
   library=parsed;renderSummary();await refreshCourses();report('全217レッスンを端末内に保存しました');
  }catch(err){report('本文取り込み失敗：'+err.message,true);}
  finally{setBusy(false);e.target.value='';}
 });
 $('audioFile').addEventListener('change',async e=>{
  const files=Array.from(e.target.files||[]),track=$('audioImportCourse').value;if(!files.length||busy)return;
  setBusy(true);cancelImport=false;$('audioImportErrors').replaceChildren();
  try{
   const result=await C.importBatch(files,track,{get:id=>recordGet('audio',id),put:r=>recordPut('audio',r)},{cancelled:()=>cancelImport,onProgress:batchStatus});
   batchStatus(result);
   for(const error of result.errors){const p=document.createElement('p');p.textContent=error.filename+'：'+error.message;$('audioImportErrors').append(p);}
   await loadAudioKeys();renderSummary();refreshAudioKinds($('audioKindSelect').value);await selectAudio(false);await showDiagnostics();
  }catch(err){$('audioImportStatus').textContent='取り込み失敗：'+err.message;}
  finally{setBusy(false);e.target.value='';}
 });
 $('cancelAudioImport').addEventListener('click',()=>{cancelImport=true;});
 $('offlineCourseSelect').addEventListener('change',()=>refreshLessons().catch(e=>report(e.message,true)));
 $('offlineLessonSelect').addEventListener('change',()=>showLesson().catch(e=>report(e.message,true)));
 $('audioKindSelect').addEventListener('change',()=>selectAudio().catch(e=>report(e.message,true)));
 document.addEventListener('patapura:audio-preference',()=>{if(currentLesson()?.track==='colloquial'&&!busy){refreshAudioKinds();selectAudio().catch(e=>report(e.message,true));}});
 document.addEventListener('patapura:bulk-start',()=>setBusy(true));
 document.addEventListener('patapura:bulk-done',async()=>{try{await loadAudioKeys();renderSummary();refreshAudioKinds($('audioKindSelect').value);await selectAudio(false);await showDiagnostics();}catch(err){report('音声一覧の更新失敗：'+err.message,true);}finally{setBusy(false);}});
 document.addEventListener('patapura:navigate',e=>{
  const choice=e.detail||{};
  if(!library||!C.ORDER.includes(choice.track))return;
  refreshCourses({track:choice.track,id:choice.id,kind:choice.kind||(choice.track==='colloquial'?'type_b':'review'),round:choice.round},true).catch(err=>report(err.message,true));
 });
 document.addEventListener('progressrestored',()=>refreshCourses().catch(e=>report(e.message,true)));
 document.addEventListener('trialreset',()=>{library=null;audioKeys.clear();renderSummary();refreshCourses(undefined,false);});
});
})();
