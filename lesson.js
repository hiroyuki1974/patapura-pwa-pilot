/* Private lesson text importer v0.4. No proprietary lesson content is bundled or uploaded. */
(function(){
'use strict';
const KEY='lesson:standard:1';
const SOURCE='https://patapura.com/lesson/1/';
const FORMAT='patapura-local-lesson-v1';
const el=id=>document.getElementById(id);
let saved=null;
function info(msg,isError){
  const target=el('lessonImportStatus');
  target.textContent=msg;
  target.classList.toggle('study-error',!!isError);
}
function asText(s){return String(s==null?'':s).replace(/\r\n?/g,'\n').replace(/\u00a0/g,' ').trim();}
function cleanLines(s){
 return asText(s).replace(/\t/g,' ').replace(/([^\n])([◇〖])/g,'$1\n$2')
  .split('\n').map(x=>x.trim()).filter(Boolean);
}
function documentToText(markup){
 const doc=new DOMParser().parseFromString(markup,'text/html');
 doc.querySelectorAll('script,style,noscript,svg,iframe,canvas,template').forEach(n=>n.remove());
 doc.querySelectorAll('br,hr').forEach(n=>n.replaceWith(doc.createTextNode('\n')));
 doc.querySelectorAll('h1,h2,h3,h4,p,li,dt,dd,section,article,div').forEach(n=>{
   n.insertBefore(doc.createTextNode('\n'),n.firstChild);
 });
 return doc.body?doc.body.textContent||'':'';
}
function isControlLine(line){
 return /^(再生速度（|再生速度\(|音声を再生するには|前のレッスンへ|一覧に戻る)/.test(line)
  || /^音声の書き起こしテキスト/.test(line);
}
function structureText(input){
 if(typeof input!=='string'||input.length>3000000)throw Error('本文が長すぎるか、テキストではありません');
 const s=/<\s*(?:!doctype|html|body|main|article|div|p|h[1-6]|section)\b/i.test(input)?documentToText(input):input;
 const lines=cleanLines(s);
 const transcriptIndex=lines.findIndex(x=>/音声の書き起こしテキスト/.test(x));
 if(transcriptIndex<0)throw Error('「音声の書き起こしテキスト」が見つかりません。公式ページで折りたたみを開いてから全文をコピーしてください。');
 const titleCandidates=[];
 for(let i=0;i<transcriptIndex;i++)if(/^LESSON\s*1\s+/.test(lines[i]))titleCandidates.push(i);
 const titleIndex=titleCandidates.length?titleCandidates[titleCandidates.length-1]:-1;
 const title=titleIndex>=0?lines[titleIndex]:'LESSON 1 タスクの依頼と確認 (1)';
 let introduction='';
 if(titleIndex>=0){
   const beforeAudio=lines.findIndex((x,i)=>i>titleIndex&&i<transcriptIndex&&/^初回音声/.test(x));
   const end=beforeAudio>0?beforeAudio:transcriptIndex;
   introduction=lines.slice(titleIndex+1,end).filter(x=>!isControlLine(x)).join('\n').slice(0,10000);
 }
 let endIndex=lines.findIndex((x,i)=>i>transcriptIndex&&/^復習音声[（(]/.test(x));
 if(endIndex<0)endIndex=Math.min(lines.length,transcriptIndex+1200);
 const body=lines.slice(transcriptIndex+1,endIndex).filter(x=>!isControlLine(x));
 if(body.join('').length<90)throw Error('本文が短すぎます。公式ページの「音声の書き起こしテキスト」を展開してコピーしてください。');
 const sections=[];
 let inReview=false;
 let section={heading:'レッスン本文',lines:[],reviewOnly:false};
 for(const line of body){
   if(/^◇/.test(line)){
     if(section.lines.length)sections.push(section);
     section={heading:line.replace(/^◇/,'').trim(),lines:[],reviewOnly:inReview};
   }else if(/^〖復習音声にのみ〗/.test(line)){
     if(section.lines.length)sections.push(section);
     inReview=true;
     section={heading:'復習音声専用',lines:[],reviewOnly:true};
   }else{
     section.lines.push(line);
   }
 }
 if(section.lines.length)sections.push(section);
 if(!sections.length)throw Error('本文区分を解析できませんでした');
 return {id:KEY,format:FORMAT,course:'standard',lesson:1,title,sourceUrl:SOURCE,
    introduction,sections,importedAt:new Date().toISOString()};
}
function ensureLessonData(obj){
 if(!obj||obj.format!==FORMAT||obj.course!=='standard'||obj.lesson!==1||
    !Array.isArray(obj.sections)||obj.sections.length===0||obj.sections.length>200)
   throw Error('通常版Lesson 1の本文JSONではありません');
 const sections=obj.sections.map(s=>{
   if(typeof s.heading!=='string'||!Array.isArray(s.lines)||s.lines.length>2000)
     throw Error('本文JSONの構造が不正です');
   const lines=s.lines.map(x=>{if(typeof x!=='string'||x.length>20000)throw Error('本文行が不正です');return x;});
   return {heading:s.heading.slice(0,300),lines,reviewOnly:!!s.reviewOnly};
 });
 return {id:KEY,format:FORMAT,course:'standard',lesson:1,
   title:String(obj.title||'LESSON 1').slice(0,300),
   sourceUrl:SOURCE,introduction:String(obj.introduction||'').slice(0,20000),
   sections,importedAt:new Date().toISOString()};
}
function lineClass(t){
 if(/^〖/.test(t))return 'study-label';
 const ja=(t.match(/[\u3040-\u30ff\u3400-\u9fff]/g)||[]).length;
 const en=(t.match(/[A-Za-z]/g)||[]).length;
 return en>ja*1.2?'study-en':ja>en*.7?'study-ja':'study-mixed';
}
function render(){
 const area=el('lessonDisplay');area.replaceChildren();
 if(!saved){
   el('lessonState').textContent='未取り込み（音声と学習記録には影響しません）';
   const p=document.createElement('p');p.className='hint';
   p.textContent='公式本文をこの端末に取り込むと、ここで音声を聞きながら読めます。';
   area.append(p);return;
 }
 el('lessonState').textContent='端末内に保存済み：'+saved.sections.length+'区分／'+saved.sections.reduce((n,s)=>n+s.lines.length,0)+'行';
 const h=document.createElement('h3');h.textContent=saved.title;h.className='lesson-heading';area.append(h);
 if(saved.introduction){
   const p=document.createElement('p');p.className='lesson-introduction';p.textContent=saved.introduction;area.append(p);
 }
 for(const sect of saved.sections){
   const section=document.createElement('section');section.className='study-section';
   const heading=document.createElement('h4');heading.textContent=(sect.reviewOnly?'【復習音声専用】 ':'')+sect.heading;section.append(heading);
   for(const raw of sect.lines){
      const p=document.createElement('p');p.className='study-line '+lineClass(raw);
      p.textContent=raw;section.append(p);
   }
   area.append(section);
 }
}
async function store(obj){
 const normalized=ensureLessonData(obj);
 await recordPut('progress',normalized);
 saved=normalized;render();
 info('本文を端末内に保存しました。再起動後も残ります。');
}
async function fromText(value){
 const obj=structureText(value);await store(obj);
}
function download(obj){
 const b=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(b);
 const a=document.createElement('a');a.href=url;
 a.download='PATAPURA_STANDARD_L01_PRIVATE_'+new Date().toISOString().slice(0,10).replace(/-/g,'')+'.json';
 document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),10000);
}
async function init(){
 try{saved=await recordGet('progress',KEY);render();if(saved)info('以前保存した本文を復元しました');}
 catch(e){info('本文保存領域を確認できません：'+e.message,true);}
 el('lessonImportPaste').addEventListener('click',async()=>{
   const str=el('lessonPaste').value;
   if(!str.trim()){info('先に公式ページの本文を貼り付けてください',true);return;}
   try{await fromText(str);el('lessonPaste').value='';}
   catch(e){info('取り込みできません：'+e.message,true);}
 });
 el('lessonLocalFile').addEventListener('change',async e=>{
   const file=e.target.files?.[0];if(!file)return;
   try{
     if(file.size>3000000)throw Error('3MB以下のHTML・テキスト・JSONにしてください');
     const str=await file.text();
     if(/\.json$/i.test(file.name))await store(JSON.parse(str));else await fromText(str);
   }catch(err){info('ファイル取り込み失敗：'+err.message,true);}
   e.target.value='';
 });
 el('lessonAutoFetch').addEventListener('click',async()=>{
   info('公式ページに直接接続しています…');
   try{
     const response=await fetch(SOURCE,{credentials:'omit',redirect:'follow'});
     if(!response.ok)throw Error('HTTP '+response.status);
     const html=await response.text();
     await fromText(html);
   }catch(e){
     info('このブラウザから公式サイトを直接読めませんでした（サイト間通信制限の可能性）。公式ページの本文コピーかHTMLファイル取り込みをご利用ください。',true);
   }
 });
 el('lessonExport').addEventListener('click',()=>{
   if(!saved){info('保存する本文がありません',true);return;}
   download(saved);info('本文JSONをファイルとして保存しました（音声は含みません）');
 });
}
document.addEventListener('DOMContentLoaded',init);
})();
