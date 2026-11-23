/* v0.6 / 2026-11-23. Schema and audio naming only; no purchased content. */
(function(root){
'use strict';
const COUNTS={standard:62,meeting:56,facilitation:19,colloquial:80};
const NAMES={standard:'通常版',meeting:'会議版',facilitation:'ファシリテーション',colloquial:'口語表現'};
const ORDER=Object.keys(COUNTS);
const kinds=track=>track==='colloquial'?['type_a','type_b','type_c']:['main','review'];
const label=kind=>({main:'通常',review:'復習',type_a:'Type A',type_b:'Type B',type_c:'Type C'})[kind];
function audioId(track,number,kind){return `${track}:${String(number).padStart(2,'0')}:${kind}`;}
function candidates(track,number){return kinds(track).map(kind=>({key:audioId(track,number,kind),kind,label:label(kind),filename:kind.startsWith('type_')?`Lesson${String(number).padStart(2,'0')}-Type${kind.slice(-1).toUpperCase()}.mp3`:`${kind==='review'?'Review-':''}Lesson${String(number).padStart(2,'0')}.mp3`}));}
function parseFilename(track,filename){
 if(!ORDER.includes(track))throw Error('取り込み先の教材区分を選択してください');
 let name;try{name=decodeURIComponent(filename);}catch(_){name=filename;}
 const m=/^(Review-)?Lesson(\d{1,2})(?:-Type([ABC]))?\.mp3$/i.exec(name);
 if(!m)throw Error('未対応のファイル名');
 const number=Number(m[2]);
 if(number<1||number>COUNTS[track])throw Error('この教材のレッスン番号範囲外');
 let kind;
 if(track==='colloquial'){
  if(m[1]||!m[3])throw Error('口語表現にはType A/B/CのMP3を選択してください');
  kind='type_'+m[3].toLowerCase();
 }else{
  if(m[3])throw Error('この教材には通常・復習のMP3を選択してください');
  kind=m[1]?'review':'main';
 }
 return {id:audioId(track,number,kind),track,number,kind};
}
function validateLibrary(raw){
 if(!raw||raw.format!=='patapura-display-library-v1'||!Array.isArray(raw.lessons)||raw.lessons.length!==217)throw Error('Step 2表示用統合JSON（全217件）を選択してください');
 const seen=new Set(),counts=Object.fromEntries(ORDER.map(t=>[t,0]));
 const text=(s,max)=>typeof s==='string'&&s.length<=max;
 for(const lesson of raw.lessons){
  const t=lesson.track,n=lesson.number;
  if(!ORDER.includes(t)||!Number.isInteger(n)||n<1||n>COUNTS[t]||lesson.id!==`${t}:${n}`||seen.has(lesson.id))throw Error('教材区分・レッスンIDの不整合または重複');
  if(lesson.course!==(t==='facilitation'?'meeting':t))throw Error('教材グループの不整合');
  if(!text(lesson.title,1000)||!lesson.title.trim()||!text(lesson.introduction||'',50000)||!Array.isArray(lesson.sections)||!lesson.sections.length||lesson.sections.length>300)throw Error('本文構造が不正：'+lesson.id);
  for(const s of lesson.sections){
   if(!text(s.heading,1000)||!text(s.phase||'',100)||typeof s.reviewOnly!=='boolean'||!Array.isArray(s.lines)||s.lines.length>2500||!s.lines.every(l=>text(l,50000)))throw Error('本文区分が不正：'+lesson.id);
  }
  const expected=candidates(t,n);
  if(!Array.isArray(lesson.audioCandidates)||lesson.audioCandidates.length!==expected.length||expected.some(e=>!lesson.audioCandidates.some(a=>a.key===e.key&&a.kind===e.kind&&a.filename===e.filename)))throw Error('音声候補IDの不整合：'+lesson.id);
  seen.add(lesson.id);counts[t]++;
 }
 for(const t of ORDER)if(counts[t]!==COUNTS[t]||raw.trackCounts?.[t]!==COUNTS[t])throw Error('教材別件数が一致しません：'+t);
 return raw;
}
async function importBatch(files,track,storage,options={}){
 if(!ORDER.includes(track))throw Error('取り込み先の教材区分を選択してください');
 const result={total:files.length,processed:0,success:0,replaced:0,skipped:0,errors:[],cancelled:false};
 for(const file of files){
  if(options.cancelled?.()){result.cancelled=true;break;}
  try{
   const info=parseFilename(track,file.name);
   if(file.size<128)throw Error('MP3が小さすぎます');
   const head=new Uint8Array(await file.slice(0,3).arrayBuffer());
   if(!(head[0]===73&&head[1]===68&&head[2]===51)&&!(head[0]===255&&(head[1]&224)===224))throw Error('MP3ヘッダーを確認できません');
   const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))).map(b=>b.toString(16).padStart(2,'0')).join('');
   const old=await storage.get(info.id);
   if(old?.sha256===digest&&old.size===file.size)result.skipped++;
   else{
    await storage.put({...info,filename:file.name,size:file.size,mimeType:'audio/mpeg',sha256:digest,blob:file,updatedAt:new Date().toISOString()});
    result.success++;if(old)result.replaced++;
   }
  }catch(err){
   result.errors.push({filename:file.name,message:err.message});
   if(err.name==='QuotaExceededError'){result.cancelled=true;result.processed++;options.onProgress?.(result);break;}
  }
  result.processed++;options.onProgress?.(result);
 }
 return result;
}
const api={COUNTS,NAMES,ORDER,kinds,label,audioId,candidates,parseFilename,validateLibrary,importBatch};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PatapuraCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
