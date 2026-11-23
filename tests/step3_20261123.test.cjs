const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {File}=require('node:buffer');
const C=require('../preview-step3-20261123/core_20261123.js');
const make=(name,marker=1)=>new File([new Uint8Array([73,68,51,...new Array(256).fill(marker)])],name,{type:'audio/mpeg'});
function fixture(){return {format:'patapura-display-library-v1',trackCounts:C.COUNTS,lessons:C.ORDER.flatMap(track=>Array.from({length:C.COUNTS[track]},(_,i)=>({id:`${track}:${i+1}`,track,course:track==='facilitation'?'meeting':track,number:i+1,title:`LESSON ${i+1} public synthetic test`,introduction:'Test only',sections:[{heading:'Test',phase:'共通',reviewOnly:false,lines:['Public synthetic test.','テスト用の例文です。']}],audioCandidates:C.candidates(track,i+1)})))};}
test('217 lessons, 514 unique audio IDs; 27 sample files in four tracks',()=>{
 const data=fixture();C.validateLibrary(data);const keys=data.lessons.flatMap(l=>l.audioCandidates.map(a=>a.key));assert.equal(keys.length,514);assert.equal(new Set(keys).size,514);
 const sample=data.lessons.filter(l=>l.number<=3).flatMap(l=>l.audioCandidates.map(a=>C.parseFilename(l.track,a.filename).id));assert.equal(new Set(sample).size,27);
});
test('reject duplicate, missing lessons, wrong track and candidate ID without mutation',()=>{
 for(const alter of [d=>d.lessons.pop(),d=>d.lessons[1]=d.lessons[0],d=>d.lessons[0].track='meeting',d=>d.lessons[0].audioCandidates[0].key='meeting:01:main',d=>d.lessons[0].sections[0].lines=[12]]){
  const data=fixture();alter(data);assert.throws(()=>C.validateLibrary(data));
 }
});
test('all 514 filenames roundtrip exactly; unsupported names never guessed',()=>{
 for(const t of C.ORDER)for(let n=1;n<=C.COUNTS[t];n++)for(const a of C.candidates(t,n))assert.equal(C.parseFilename(t,a.filename).id,a.key);
 for(const [t,f] of [['standard','Lesson00.mp3'],['standard','Lesson63.mp3'],['meeting','Lesson57.mp3'],['facilitation','Lesson20.mp3'],['standard','Lesson01-TypeA.mp3'],['colloquial','Lesson01.mp3'],['colloquial','Review-Lesson01-TypeA.mp3'],['standard','Lesson01 (1).mp3'],['standard','../Lesson01.mp3'],['standard','Lesson001.mp3'],['standard','Lesson01.mp3.exe']])assert.throws(()=>C.parseFilename(t,f));
 assert.equal(C.parseFilename('standard','Review-Lesson1.MP3').id,'standard:01:review');
});
test('sequential batch / same filename across tracks / skip identical / replace changed / errors',async()=>{
 const records=new Map();let concurrent=0,max=0;
 const storage={get:async id=>records.get(id),put:async r=>{concurrent++;max=Math.max(max,concurrent);await new Promise(r=>setTimeout(r,1));records.set(r.id,r);concurrent--;}};
 for(const t of C.ORDER){const files=Array.from({length:3},(_,i)=>C.candidates(t,i+1).map(a=>make(a.filename,C.ORDER.indexOf(t)+1))).flat();const r=await C.importBatch(files,t,storage);assert.equal(r.errors.length,0);assert.equal(r.success,files.length);}
 assert.equal(records.size,27);assert.equal(max,1);assert.notEqual(records.get('standard:01:main').sha256,records.get('meeting:01:main').sha256);
 let r=await C.importBatch([make('Lesson01.mp3',1)],'standard',storage);assert.equal(r.skipped,1);
 r=await C.importBatch([make('Lesson01.mp3',99)],'standard',storage);assert.equal(r.replaced,1);assert.equal(records.size,27);
 r=await C.importBatch([make('bad.mp3'),new File(['tiny'],'Lesson01.mp3'),new File([new Uint8Array(400)],'Lesson02.mp3'),make('Review-Lesson03.mp3',9)],'standard',storage);assert.equal(r.errors.length,3);assert.equal(r.success,1);
});
test('cancel after transaction and resume; failed/quota replacement keeps original data',async()=>{
 const records=new Map(),storage={get:async id=>records.get(id),put:async r=>records.set(r.id,r)};
 let stop=false;
 let r=await C.importBatch([make('Lesson01.mp3'),make('Lesson02.mp3')],'standard',storage,{cancelled:()=>stop,onProgress:()=>stop=true});assert.equal(r.processed,1);assert.equal(r.cancelled,true);assert.equal(records.size,1);
 r=await C.importBatch([make('Lesson01.mp3'),make('Lesson02.mp3')],'standard',storage);assert.equal(r.skipped,1);assert.equal(r.success,1);
 const original=records.get('standard:01:main');
 r=await C.importBatch([make('Lesson01.mp3',8),make('Lesson03.mp3')],'standard',{get:storage.get,put:async()=>{const e=Error('quota');e.name='QuotaExceededError';throw e;}});assert.equal(r.processed,1);assert.equal(r.cancelled,true);assert.equal(records.get('standard:01:main'),original);
});
test('actual private Step 2 data, if supplied, passes exact 217/514 mapping',{skip:!process.env.PATAPURA_PRIVATE_JSON},()=>{
 const data=JSON.parse(fs.readFileSync(process.env.PATAPURA_PRIVATE_JSON,'utf8'));C.validateLibrary(data);assert.equal(data.lessons.length,217);
 assert.equal(new Set(data.lessons.flatMap(l=>l.audioCandidates.map(a=>C.parseFilename(l.track,a.filename).id))).size,514);
 assert.ok(data.lessons.some(l=>l.sections.some(s=>s.reviewOnly)));
 assert.ok(data.lessons.filter(l=>l.track==='colloquial').every(l=>l.sections.some(s=>s.sharedAudioTypes?.length===3)));
});
test('v0.5 worker delegates trial; v0.6 cache and DB isolated; Range 200/206/416/404',async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../preview-step3-20261123/sw.js'),'utf8'),old=fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8');
 assert.ok(!source.includes('patapura-pwa-audio-pilot-v1'));assert.ok(!source.includes("startsWith('patapura-pilot-shell-')"));assert.ok(!source.includes('await caches.match('));
 function worker(src){const listeners={};const context={self:{registration:{scope:'https://example.com/app/'},location:{origin:'https://example.com'},addEventListener:(n,f)=>listeners[n]=f},URL,Response,Request,Set,Number,decodeURIComponent};vm.createContext(context);vm.runInContext(src,context);return {context,listeners};}
 const root=worker(old);let intercepted=false;root.listeners.fetch({request:new Request('https://example.com/app/preview-step3-20261123/'),respondWith:()=>intercepted=true});assert.equal(intercepted,false);
 const w=worker(source);const blob=new Blob([new Uint8Array(256).map((_,i)=>i)]);
 w.context.openDB=async()=>({transaction:()=>({objectStore:()=>({get:id=>{const r={result:id==='yes'?{blob,mimeType:'audio/mpeg'}:null};queueMicrotask(()=>r.onsuccess());return r;}})}),close:()=>{}});
 for(const [range,status,size] of [[null,200,256],['bytes=0-31',206,32],['bytes=-10',206,10],['bytes=250-',206,6],['bytes=300-',416,0],['bytes=4-2',416,0],['bytes=0-2,4-5',416,0]]){const request=new Request('https://example.com/',{headers:range?{Range:range}:{}});const r=await w.context.fetchAudio(request,'yes');assert.equal(r.status,status);assert.equal((await r.arrayBuffer()).byteLength,size);}
 assert.equal((await w.context.fetchAudio(new Request('https://example.com/'),'none')).status,404);
});
