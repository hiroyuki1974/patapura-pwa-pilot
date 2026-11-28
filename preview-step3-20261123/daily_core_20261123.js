/* build:v33backup-20261128 */
/* パタプラ v0.7 日々の学習順序（個人用。教材本文を含まない） */
(function(root){
'use strict';
const business=Array.from({length:62},(_,i)=>'standard:'+(i+1));
const meeting=[];
for(let i=1;i<=56;i++){meeting.push('meeting:'+i);if(i%3===0)meeting.push('facilitation:'+(i/3));}
meeting.push('facilitation:19');
const colloquial=Array.from({length:80},(_,i)=>'colloquial:'+(i+1));
const PROGRAMS=[
 {key:'business',title:'ビジネス',sequence:business},
 {key:'meeting_facilitation',title:'会議・ファシリテーション',sequence:meeting},
 {key:'colloquial',title:'口語表現',sequence:colloquial}
];
const byKey=Object.fromEntries(PROGRAMS.map(p=>[p.key,p]));
const MAX_ROUNDS=3;
const lessonIds=new Set(PROGRAMS.flatMap(p=>p.sequence));
function validDate(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;try{return new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}catch(_){return false;}}
function normalizeRound(value){const n=Number(value);return Number.isInteger(n)&&n>=1&&n<=MAX_ROUNDS?n:1;}
function readDate(progress,id,round=1){const r=normalizeRound(round);const v=r===1?progress?.lessons?.[id]:progress?.rounds?.[r]?.[id];return validDate(v)?v:null;}
function setDate(progress,id,round,date){if(!lessonIds.has(id))throw Error('レッスンが不正です');if(!Number.isInteger(round)||round<1||round>MAX_ROUNDS)throw Error('周回が不正です');if(date!==null&&!validDate(date))throw Error('日付が不正です');if(round===1){progress.lessons=progress.lessons||{};if(date===null)delete progress.lessons[id];else progress.lessons[id]=date;}else{progress.rounds=progress.rounds||{};progress.rounds[round]=progress.rounds[round]||{};if(date===null)delete progress.rounds[round][id];else progress.rounds[round][id]=date;}}
function cleanRounds(value){const out={};for(let r=2;r<=MAX_ROUNDS;r++){const raw=value?.[r];if(raw&&typeof raw==='object')out[r]=Object.fromEntries(Object.entries(raw).filter(([id,date])=>lessonIds.has(id)&&validDate(date)));}return out;}
function activeRound(progress,key){const p=byKey[key];if(!p)return 1;for(let r=1;r<=MAX_ROUNDS;r++)if(p.sequence.some(id=>!readDate(progress,id,r)))return r;return MAX_ROUNDS;}
const MAX_VISIBLE=10;
const keyOf=e=>e.id+'@'+e.round;
function tasks(p){const visible=new Set(p?.visible||[]);return (p?.entries||[]).filter(e=>visible.has(keyOf(e)));}
function roundForLesson(progress,id,date){const p=PROGRAMS.find(p=>p.sequence.includes(id));if(!p)return 1;const item=tasks(plan(progress,date)).find(e=>e.id===id);return item?item.round:activeRound(progress,p.key);}
function validExisting(value,date){if(!value||value.date!==date||!value.ids||typeof value.ids!=='object')return false;return PROGRAMS.every(p=>(value.ids[p.key]===null||p.sequence.includes(value.ids[p.key]))&&(!value.rounds||(Number.isInteger(value.rounds[p.key])&&value.rounds[p.key]>=1&&value.rounds[p.key]<=MAX_ROUNDS)));}
function validQueue(q){
 if(q?.version!==2||!validDate(q.date)||!Array.isArray(q.entries)||q.entries.length>lessonIds.size*MAX_ROUNDS||!Array.isArray(q.visible)||q.visible.length>MAX_VISIBLE||!validExisting(q,q.date))return false;
 const keys=new Set();
 for(const e of q.entries){if(!e||!byKey[e.program]?.sequence.includes(e.id)||!Number.isInteger(e.round)||e.round<1||e.round>MAX_ROUNDS||!validDate(e.date)||e.date>q.date||keys.has(keyOf(e)))return false;keys.add(keyOf(e));}
 return new Set(q.visible).size===q.visible.length&&q.visible.every(k=>keys.has(k));
}
const nextDay=d=>new Date(Date.parse(d+'T00:00:00Z')+86400000).toISOString().slice(0,10);
function plan(progress,date){
 if(!validDate(date))throw Error('日付形式が不正です');
 const old=progress?.dailyPlan,isQueue=validQueue(old);
 if(isQueue&&old.date>date)return old; // never duplicate assignments on clock rollback
 let entries=isQueue?old.entries.slice():[],cursor=isQueue?old.date:null;
 if(!isQueue&&validDate(old?.date)&&old.date<=date&&validExisting(old,old.date)){
  cursor=old.date;
  for(const p of PROGRAMS){const id=old.ids[p.key];if(id)entries.push({program:p.key,id,round:old.rounds?.[p.key]||1,date:cursor});}
 }
 const assigned=new Set(entries.map(keyOf));
 // The first date is today's date unless a real saved plan provides an earlier anchor.
 let day=cursor?cursor===date?null:nextDay(cursor):date;
 while(day&&day<=date){
  let added=0;
  for(const p of PROGRAMS){
   const r=activeRound(progress,p.key);
   // A new round cannot be scheduled before the preceding round was completed.
   if(r>1&&p.sequence.some(id=>!readDate(progress,id,r-1)||readDate(progress,id,r-1)>day))continue;
   const id=p.sequence.find(id=>!readDate(progress,id,r)&&!assigned.has(keyOf({id,round:r})));
   if(id){const e={program:p.key,id,round:r,date:day};entries.push(e);assigned.add(keyOf(e));added++;}
  }
  if(day===date)break;
  if(!added){day=date;}else{day=nextDay(day);}
 }
 const today=entries.filter(e=>e.date===date),todayKeys=today.map(keyOf);
 const pending=entries.filter(e=>e.date<date&&!readDate(progress,e.id,e.round));
 let visible;
 if(isQueue&&old.date===date){
  // Keep the day's displayed cards, including completed catch-up cards, for review.
  visible=[...old.visible];
  for(const e of pending)if(visible.length<MAX_VISIBLE&&!visible.includes(keyOf(e)))visible.push(keyOf(e));
  if(visible.length===old.visible.length)return old;
 }else{
  visible=[...pending.slice(0,Math.max(0,MAX_VISIBLE-today.length)).map(keyOf),...todayKeys];
 }
 const ids={},rounds={};
 for(const p of PROGRAMS){const t=today.find(e=>e.program===p.key);ids[p.key]=t?.id||null;rounds[p.key]=t?.round||activeRound(progress,p.key);}
 return {version:2,date,entries,visible,ids,rounds};
}
function hiddenPending(p,progress){const visible=new Set(p.visible||[]);return p.entries.filter(e=>!visible.has(keyOf(e))&&!readDate(progress,e.id,e.round)).length;}
function lessonLabel(id){
 if(!id)return '全レッスン終了';
 const [track,no]=id.split(':');
 return (track==='meeting'?'会議編':track==='facilitation'?'ファシリテーション編':'Lesson')+(track==='meeting'||track==='facilitation'?' Lesson ':' ')+no;
}
function countFinished(daily,progress){
 return tasks(daily).filter(e=>Boolean(readDate(progress,e.id,e.round))).length;
}
const api={PROGRAMS,MAX_ROUNDS,MAX_VISIBLE,plan,tasks,hiddenPending,lessonLabel,countFinished,readDate,setDate,validDate,normalizeRound,cleanRounds,activeRound,roundForLesson};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PatapuraDailyCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
