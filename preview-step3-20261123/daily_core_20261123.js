/* build:v19topalign-20261125 */
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
function roundForLesson(progress,id,date){const p=PROGRAMS.find(p=>p.sequence.includes(id));if(!p)return 1;const today=plan(progress,date);return today.ids[p.key]===id?today.rounds[p.key]:activeRound(progress,p.key);}
function validExisting(value,date){if(!value||value.date!==date||!value.ids||typeof value.ids!=='object')return false;return PROGRAMS.every(p=>(value.ids[p.key]===null||p.sequence.includes(value.ids[p.key]))&&(!value.rounds||(Number.isInteger(value.rounds[p.key])&&value.rounds[p.key]>=1&&value.rounds[p.key]<=MAX_ROUNDS)));}
function plan(progress,date){
 if(!validDate(date))throw Error('日付形式が不正です');
 const old=progress?.dailyPlan;
 if(validExisting(old,date)){
  if(old.rounds)return old;
  const rounds=Object.fromEntries(PROGRAMS.map(p=>[p.key,1]));
  return {...old,rounds};
 }
 const ids={},rounds={};
 for(const p of PROGRAMS){const r=activeRound(progress,p.key);rounds[p.key]=r;ids[p.key]=p.sequence.find(id=>!readDate(progress,id,r))||null;}
 return {date,ids,rounds};
}
function lessonLabel(id){
 if(!id)return '全レッスン終了';
 const [track,no]=id.split(':');
 return (track==='meeting'?'会議編':track==='facilitation'?'ファシリテーション編':'Lesson')+(track==='meeting'||track==='facilitation'?' Lesson ':' ')+no;
}
function countFinished(daily,progress){
 return PROGRAMS.filter(p=>{const id=daily.ids[p.key];return !id||Boolean(readDate(progress,id,daily.rounds?.[p.key]||1));}).length;
}
const api={PROGRAMS,MAX_ROUNDS,plan,lessonLabel,countFinished,readDate,setDate,validDate,normalizeRound,cleanRounds,activeRound,roundForLesson};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PatapuraDailyCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
