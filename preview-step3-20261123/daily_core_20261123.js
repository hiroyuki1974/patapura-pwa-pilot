/* パタプラ v0.7 日々の学習順序（個人用。教材本文を含まない） */
(function(root){
'use strict';
const business=Array.from({length:62},(_,i)=>'standard:'+(i+1));
const meeting=[];
for(let i=1;i<=56;i++){meeting.push('meeting:'+i);if(i<=19)meeting.push('facilitation:'+i);}
const colloquial=Array.from({length:80},(_,i)=>'colloquial:'+(i+1));
const PROGRAMS=[
 {key:'business',title:'ビジネス',sequence:business},
 {key:'meeting_facilitation',title:'会議・ファシリテーション',sequence:meeting},
 {key:'colloquial',title:'口語表現',sequence:colloquial}
];
const byKey=Object.fromEntries(PROGRAMS.map(p=>[p.key,p]));
function validExisting(value,date){
 if(!value||value.date!==date||!value.ids||typeof value.ids!=='object')return false;
 return PROGRAMS.every(p=>value.ids[p.key]===null||p.sequence.includes(value.ids[p.key]));
}
function plan(progress,date){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('日付形式が不正です');
 if(validExisting(progress?.dailyPlan,date))return progress.dailyPlan;
 const done=progress?.lessons||{};
 const ids={};
 for(const p of PROGRAMS)ids[p.key]=p.sequence.find(id=>typeof done[id]!=='string'||!done[id])||null;
 return {date,ids};
}
function lessonLabel(id){
 if(!id)return '全レッスン終了';
 const [track,no]=id.split(':');
 return (track==='meeting'?'会議編':track==='facilitation'?'ファシリテーション編':'Lesson')+(track==='meeting'||track==='facilitation'?' Lesson ':' ')+no;
}
function countFinished(daily,progress){
 return PROGRAMS.filter(p=>{const id=daily.ids[p.key];return !id||Boolean(progress.lessons?.[id]);}).length;
}
const api={PROGRAMS,plan,lessonLabel,countFinished};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PatapuraDailyCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
