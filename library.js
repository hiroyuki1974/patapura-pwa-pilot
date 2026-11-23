/* Private 3-course offline JSON reader v0.5; no copyrighted material shipped. */
(function(){
'use strict';
const FORMAT='patapura-offline-library-v1';
const EXPECT={standard:62,meeting:75,colloquial:80};
const NAMES={standard:'通常版（62）',meeting:'会議＆ファシリ（75）',colloquial:'口語表現（80）'};
const ORDER=['standard','meeting','colloquial'];
const $=id=>document.getElementById(id);
const saved={};
const key=course=>'offline-library:'+course;
const report=(message,bad=false)=>{$('offlineImportStatus').textContent=message;$('offlineImportStatus').classList.toggle('study-error',bad);};
function isValid(entry){
 if(!entry||!entry.id||!entry.title||!entry.sourceUrl||!Array.isArray(entry.sections))return false;
 if(entry.sections.length<1||entry.sections.length>300)return false;
 if(!/^\s*LESSON\s*\d+/i.test(String(entry.title)))return false;
 return entry.sections.every(s=>typeof s.heading==='string'&&Array.isArray(s.lines)&&s.lines.length<2500&&s.lines.every(v=>typeof v==='string'&&v.length<50000));
}
function assertLibrary(raw){
 if(!raw||raw.format!==FORMAT||!Object.prototype.hasOwnProperty.call(EXPECT,raw.course)||!Array.isArray(raw.lessons))
   throw Error('このアプリ用の3教材本文JSONではありません');
 const course=raw.course;
 if(raw.lessons.length===0||raw.lessons.length>EXPECT[course])throw Error('レッスン件数が不正です');
 const ids=new Set();
 for(const entry of raw.lessons){
   if(!isValid(entry))throw Error('本文データの構造が正しくありません');
   if(ids.has(entry.id))throw Error('重複レッスン：'+entry.id);
   ids.add(entry.id);
 }
 return {id:key(course),format:FORMAT,course,expected:EXPECT[course],receivedAt:new Date().toISOString(),
         lessons:raw.lessons,errors:Array.isArray(raw.errors)?raw.errors.slice(0,500):[],
         missing:EXPECT[course]-raw.lessons.length};
}
function renderSummary(){
 const el=$('offlineLibrarySummary');el.replaceChildren();
 for(const course of ORDER){
   const line=document.createElement('p');line.className='library-summary-line';
   const item=saved[course];
   line.textContent=NAMES[course]+'：'+(item?(item.lessons.length+' / '+EXPECT[course]+' 件・保存済み'):'未取り込み');
   el.append(line);
 }
 const sum=ORDER.reduce((n,c)=>n+(saved[c]?.lessons.length||0),0);
 $('offlineTotalCount').textContent=sum+' / 217 レッスン';
}
function option(select,value,title){const n=document.createElement('option');n.value=value;n.textContent=title;select.append(n);}
function refreshCourses(){
 const course=$('offlineCourseSelect');const old=course.value;
 course.replaceChildren();
 for(const c of ORDER)if(saved[c]?.lessons.length)option(course,c,NAMES[c]);
 if(ORDER.includes(old)&&saved[old])course.value=old;
 refreshLessons();
}
function refreshLessons(){
 const course=$('offlineCourseSelect').value;
 const lesson=$('offlineLessonSelect');const old=lesson.value;lesson.replaceChildren();
 const items=saved[course]?.lessons||[];
 for(const item of items)option(lesson,item.id,item.title);
 if(items.some(item=>item.id===old))lesson.value=old;
 showLesson();
}
function lineClass(t){
 const ja=(t.match(/[\u3040-\u30ff\u3400-\u9fff]/g)||[]).length;
 const en=(t.match(/[A-Za-z]/g)||[]).length;
 if(/^〖/.test(t))return 'study-label';
 return en>ja*1.2?'study-en':ja>en*.7?'study-ja':'study-mixed';
}
function showLesson(){
 const reader=$('offlineLessonBody');reader.replaceChildren();
 const data=saved[$('offlineCourseSelect').value];
 const id=$('offlineLessonSelect').value;
 const lesson=data?.lessons.find(x=>x.id===id);
 if(!lesson){
   $('offlineLessonMeta').textContent='本文JSONを取り込むとここに表示されます';return;
 }
 $('offlineLessonMeta').textContent=(lesson.quality?.status||'未監査')+' / '+lesson.sections.length+'区分 / '+(lesson.quality?.chars??'—')+'文字';
 const h=document.createElement('h3');h.className='lesson-heading';h.textContent=lesson.title;reader.append(h);
 if(lesson.introduction){
   const intro=document.createElement('p');intro.className='lesson-introduction';intro.textContent=lesson.introduction;reader.append(intro);
 }
 let lastPhase='';
 for(const s of lesson.sections){
   if(s.phase!==lastPhase){
     const tag=document.createElement('div');tag.className='study-phase';tag.textContent=s.phase||'本文';reader.append(tag);lastPhase=s.phase;
   }
   const section=document.createElement('section');section.className='study-section';
   const h4=document.createElement('h4');h4.textContent=(s.reviewOnly?'【復習専用】 ':'')+s.heading;section.append(h4);
   for(const line of s.lines){
     const p=document.createElement('p');p.className='study-line '+lineClass(line);p.textContent=line;section.append(p);
   }
   reader.append(section);
 }
}
async function loadLibrary(){
 for(const c of ORDER){
   try{saved[c]=await recordGet('progress',key(c));}
   catch(err){report('本文データ読込失敗：'+err.message,true);}
 }
 renderSummary();refreshCourses();
}
async function importJson(file){
 if(file.size>16*1024*1024)throw Error(file.name+' は16MBを超えています');
 let parsed;
 try{parsed=JSON.parse(await file.text());}
 catch(err){throw Error(file.name+' のJSONを読み取れません：'+err.message);}
 const obj=assertLibrary(parsed);
 await recordPut('progress',obj);saved[obj.course]=obj;
 return NAMES[obj.course]+' '+obj.lessons.length+'/'+EXPECT[obj.course]+'件';
}
document.addEventListener('DOMContentLoaded',()=>{
 $('offlineJsonFiles').addEventListener('change',async e=>{
   const files=Array.from(e.target.files||[]);if(!files.length)return;
   const good=[],bad=[];
   for(const file of files){try{good.push(await importJson(file));}catch(err){bad.push(err.message);}}
   renderSummary();refreshCourses();
   report((good.length?'取込済み：'+good.join('、'):'')+(bad.length?' / エラー：'+bad.join('、'):''),
          bad.length>0);
   e.target.value='';
 });
 $('offlineCourseSelect').addEventListener('change',refreshLessons);
 $('offlineLessonSelect').addEventListener('change',showLesson);
 loadLibrary();
});
})();