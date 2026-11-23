'use strict';
const DB_NAME='patapura-pwa-step3-trial-v1';
const DB_VERSION=1;
let MEDIA_ID='unselected';
let selectedLessonId='';
const PROGRESS_ID='pilot';
const CASES=['import','seek','lock','offline','restart','update'];
const $=id=>document.getElementById(id);
const audio=$('audioPlayer');
const logLines=[];
let audioRecord=null, progress={id:PROGRESS_ID,completedOn:null,checks:{}};
let playMode='blob', objectURL=null, serviceWorkerReady=false;
let toastHandle=0;
function log(message){
 const line=new Date().toLocaleTimeString('ja-JP',{hour12:false})+' '+message;
 logLines.push(line);if(logLines.length>120)logLines.shift();$('log').textContent=logLines.join('\n');
}
function notice(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastHandle);toastHandle=setTimeout(()=>$('toast').hidden=true,3400);}
function localDate(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
function formatDuration(s){if(!Number.isFinite(s))return '0:00';s=Math.max(0,Math.round(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');}
function openDB(){return new Promise((resolve,reject)=>{
 const req=indexedDB.open(DB_NAME,DB_VERSION);
 req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('audio'))db.createObjectStore('audio',{keyPath:'id'});if(!db.objectStoreNames.contains('progress'))db.createObjectStore('progress',{keyPath:'id'});};
 req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
});}
async function recordGet(store,id){const db=await openDB();try{return await new Promise((resolve,reject)=>{
 const request=db.transaction(store,'readonly').objectStore(store).get(id);
 request.onsuccess=()=>resolve(request.result??null);request.onerror=()=>reject(request.error);
});}finally{db.close();}}
async function recordPut(store,value){const db=await openDB();try{return await new Promise((resolve,reject)=>{
 const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value);
 tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('IDB transaction aborted'));
});}finally{db.close();}}
async function recordDelete(store,id){const db=await openDB();try{return await new Promise((resolve,reject)=>{
 const tx=db.transaction(store,'readwrite');tx.objectStore(store).delete(id);
 tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
});}finally{db.close();}}
async function saveProgress(){await recordPut('progress',progress);renderProgress();document.dispatchEvent(new Event('patapura:progress'));}
function renderProgress(){
 $('todayDate').textContent='日本時間：'+localDate();
 const completed=progress.lessons?.[selectedLessonId]||null;
 const done=completed===localDate();
 $('completeBtn').disabled=!selectedLessonId;
 $('completeBtn').textContent=done?'完了取消':'学習完了にする';$('completeBtn').classList.toggle('done',done);
 $('completeState').textContent=completed?`このレッスンの完了日：${completed}`:'このレッスンは未完了';
 CASES.forEach(key=>{const input=document.querySelector(`[data-check="${key}"]`);if(input)input.checked=!!progress.checks[key];});
 $('checkedCount').textContent=CASES.filter(k=>progress.checks[k]).length+' / 6';
}
function readableFilename(name){
 // Downloads may arrive with a percent-encoded filename. Decode for display only.
 // Keep the original file metadata and stored audio unchanged.
 try{return decodeURIComponent(name);}catch(_){return name;}
}
function renderStorage(){
 if(audioRecord){const filename=readableFilename(audioRecord.filename);
 $('fileStatus').textContent=`保存済み：${filename}（${(audioRecord.size/1024/1024).toFixed(2)} MB）`;
 $('trackTitle').textContent=filename;}
 else{$('fileStatus').textContent='未取り込み';$('trackTitle').textContent='音声未登録';}
}
function urlForSW(){return new URL('./_local_audio/'+encodeURIComponent(MEDIA_ID),location.href).href;}
function chooseMode(mode){
 playMode=mode;
 $('blobMode').classList.toggle('selected',mode==='blob');$('blobMode').setAttribute('aria-pressed',String(mode==='blob'));
 $('swMode').classList.toggle('selected',mode==='sw');$('swMode').setAttribute('aria-pressed',String(mode==='sw'));
 refreshAudio();
}
function refreshAudio(){
 audio.pause();audio.removeAttribute('src');audio.load();
 if(objectURL){URL.revokeObjectURL(objectURL);objectURL=null;}
 if(!audioRecord)return;
 if(playMode==='sw'){
   if(!serviceWorkerReady){$('playbackState').textContent='SW未制御：再読み込みしてください';log('SW経由モード未制御（再読み込みで改善する場合あり）');return;}
   audio.src=urlForSW();log('音声ソース：SW Range '+urlForSW());
 }else{
   objectURL=URL.createObjectURL(audioRecord.blob);audio.src=objectURL;log('音声ソース：IndexedDB Blob URL');
 }
 audio.load();$('playbackState').textContent='再生準備中';
 if('mediaSession'in navigator){try{navigator.mediaSession.metadata=new MediaMetadata({title:selectedLessonId+' / '+readableFilename(audioRecord.filename),artist:'パタプラ個人学習',album:'Step 4 v0.7'});}catch(err){log('MediaSessionメタデータ不可：'+err.message);}}
}
async function showDiagnostics(){
 const isStandalone=window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
 $('modeLabel').textContent=isStandalone?'ホーム画面PWA':'Safari等のブラウザ';
 serviceWorkerReady=!!navigator.serviceWorker?.controller;
 $('swStatus').textContent='Service Worker：'+(serviceWorkerReady?'制御中（SW音声試験可）':navigator.serviceWorker?'未制御（初回は再読み込み）':'非対応');
 let text='起動：'+(isStandalone?'ホーム画面PWA':'ブラウザ')+'\nHTTPS：'+(location.protocol==='https:'?'はい':location.hostname==='localhost'?'localhost試験':'いいえ')+'\nSW：'+(serviceWorkerReady?'制御中':'未制御');
 try{if(navigator.storage?.estimate){const v=await navigator.storage.estimate();text+='\n推定使用量：'+((v.usage||0)/1024/1024).toFixed(1)+' MB / 推定上限：'+((v.quota||0)/1024/1024).toFixed(1)+' MB';}
 if(navigator.storage?.persisted)text+='\n永続化設定：'+(await navigator.storage.persisted()?'有効':'未設定または非対応');}
 catch(err){text+='\n容量確認エラー：'+err.message;}
 $('diagnostics').textContent=text;
 $('storageStatus').textContent=serviceWorkerReady?'オフライン用アプリ制御：有効':'※ ホーム画面追加後、初回は再読み込みが必要な場合があります';
}
async function setupServiceWorker(){
 if(!('serviceWorker'in navigator)){log('このブラウザはService Worker非対応');await showDiagnostics();return;}
 if(location.protocol!=='https:'&&location.hostname!=='localhost'&&location.hostname!=='127.0.0.1'){
 log('HTTPSではないためSW登録できません');await showDiagnostics();return;
 }
 // When offline, keep the already-installed worker; do not explicitly recheck the network.
 if(navigator.onLine===false && navigator.serviceWorker.controller){
   log('オフライン：既存Service Workerを利用し、登録・更新チェックを省略');
   await showDiagnostics();return;
 }
 navigator.serviceWorker.addEventListener('controllerchange',()=>{log('Service Worker controllerchange');showDiagnostics().then(()=>{if(playMode==='sw')refreshAudio();});});
 try{const reg=await navigator.serviceWorker.register('./sw.js',{scope:'./'});
 log('Service Worker登録：'+reg.scope);
 await navigator.serviceWorker.ready;
 await showDiagnostics();}
 catch(err){log('SW登録エラー：'+err.message);$('swStatus').textContent='SW登録エラー：'+err.message;}
}
function downloadBlob(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),12000);}
async function startup(){
 log('アプリ起動：'+location.href);log('バージョン：2026-11-23 v0.7');
 if(!('indexedDB'in window)){notice('IndexedDBに対応しない環境です');log('IDBなし：続行不可');return;}
 try{progress=(await recordGet('progress',PROGRESS_ID))||progress;audioRecord=await recordGet('audio',MEDIA_ID);renderStorage();renderProgress();refreshAudio();log('IDB復元：'+(audioRecord?'音声あり':'音声なし')+'／'+(progress.completedOn||'進捗なし'));}
 catch(err){notice('保存領域の読込に失敗しました');log('IDB読込エラー：'+err.message);}
 await showDiagnostics();setupServiceWorker();
}
$('blobMode').addEventListener('click',()=>chooseMode('blob'));
$('swMode').addEventListener('click',()=>chooseMode('sw'));
$('reloadAudio').addEventListener('click',()=>{refreshAudio();notice('音声ソースを再読み込みしました');});
$('rangeCheck').addEventListener('click',async()=>{
 if(!audioRecord){notice('先にMP3を取り込んでください');return;}
 if(!serviceWorkerReady){notice('SW未制御です。ページ再読み込み後にお試しください');return;}
 try{const r=await fetch(urlForSW(),{headers:{Range:'bytes=0-31'},cache:'no-store'});const body=await r.arrayBuffer();
 const ok=r.status===206&&body.byteLength===32&&/^bytes 0-31\//.test(r.headers.get('Content-Range')||'');
 log(`Range応答：${r.status} / ${r.headers.get('Content-Range')} / ${body.byteLength} bytes ${ok?'PASS':'FAIL'}`);
 notice(ok?'Range試験 PASS（206）':'Range試験 FAIL：診断ログを確認');}
 catch(err){log('Range試験エラー：'+err.message);notice('Range試験に失敗しました');}
});
$('completeBtn').addEventListener('click',async()=>{
 if(!selectedLessonId)return;
 progress.lessons=progress.lessons||{};
 progress.lessons[selectedLessonId]=progress.lessons[selectedLessonId]===localDate()?null:localDate();
 progress.completedOn=progress.lessons[selectedLessonId];
 try{await saveProgress();notice('進捗を端末内に保存しました');log('完了変更：'+(progress.completedOn||'取消'));}catch(err){notice('進捗保存失敗');log('進捗保存失敗：'+err.message);}
});
$('checkList').addEventListener('change',async e=>{
 const key=e.target?.dataset?.check;if(!CASES.includes(key))return;
 progress.checks[key]=!!e.target.checked;
 try{await saveProgress();log('チェック保存：'+key+' = '+progress.checks[key]);}catch(err){notice('チェック保存に失敗');}
});
$('exportBackup').addEventListener('click',()=>{
 const payload={format:'patapura-pwa-pilot-progress-v1',exportedAt:new Date().toISOString(),progress};
 downloadBlob(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),'PATAPURA_PWA_TEST_PROGRESS_'+localDate()+'.json');
 log('バックアップ出力');notice('学習記録のJSONを保存しました（音声は含みません）');
});
$('backupFile').addEventListener('change',async e=>{
 const file=e.target.files?.[0];if(!file)return;
 try{const obj=JSON.parse(await file.text());if(obj.format!=='patapura-pwa-pilot-progress-v1'||!obj.progress||obj.progress.id!==PROGRESS_ID||typeof obj.progress.checks!=='object')throw Error('この試験版のバックアップではありません');
 progress={id:PROGRESS_ID,completedOn:typeof obj.progress.completedOn==='string'?obj.progress.completedOn:null,checks:Object.fromEntries(CASES.map(k=>[k,!!obj.progress.checks[k]]))};
 progress.lessons=Object.fromEntries(Object.entries(obj.progress.lessons||{}).filter(([k,v])=>/^(standard|meeting|facilitation|colloquial):[1-9]\d?$/.test(k)&&(v===null||typeof v==='string')));
 progress.selection=obj.progress.selection;
 progress.dailyPlan=obj.progress.dailyPlan;
 await saveProgress();document.dispatchEvent(new Event('progressrestored'));notice('バックアップから復元しました');log('進捗JSON復元');}
 catch(err){notice('復元失敗：'+err.message);log('復元失敗：'+err.message);}e.target.value='';
});
$('requestPersist').addEventListener('click',async()=>{
 try{if(!navigator.storage?.persist)throw Error('APIが利用できません');const approved=await navigator.storage.persist();log('Storage.persist(): '+approved);notice(approved?'保存保護を有効化':'保存保護は許可されませんでした');await showDiagnostics();}
 catch(err){log('保存保護要求：'+err.message);notice('保存保護を要求できません');}
});
$('copyLog').addEventListener('click',async()=>{
 try{await navigator.clipboard.writeText($('diagnostics').textContent+'\n'+logLines.join('\n'));notice('診断ログをコピーしました');}
 catch(err){notice('コピーできませんでした');}
});
$('resetData').addEventListener('click',async()=>{
 if(!confirm('この試験版で取り込んだ音声と試験用の進捗を消去します。元のMP3ファイルは消しません。よろしいですか？'))return;
 try{const db=await openDB();try{await new Promise((resolve,reject)=>{const tx=db.transaction(['audio','progress'],'readwrite');tx.objectStore('audio').clear();tx.objectStore('progress').clear();tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);});}finally{db.close();}
 audioRecord=null;progress={id:PROGRESS_ID,completedOn:null,checks:{}};refreshAudio();renderStorage();renderProgress();await showDiagnostics();notice('試験データを消去しました');log('試験データ削除');document.dispatchEvent(new Event('trialreset'));}
 catch(err){log('削除失敗：'+err.message);notice('削除できませんでした');}
});
audio.addEventListener('error',()=>{if(audio.error){$('playbackState').textContent='再生エラー（診断ログ参照）';log('audio.error code='+audio.error.code+' message='+audio.error.message);}});
audio.addEventListener('loadedmetadata',()=>{log('音声読込：'+formatDuration(audio.duration));updateTime();});
audio.addEventListener('play',()=>{log('音声再生開始：'+playMode);$('playbackState').textContent='再生中';});
audio.addEventListener('pause',()=>{$('playbackState').textContent='一時停止';});
audio.addEventListener('ended',()=>{$('playbackState').textContent='再生終了';log('音声再生終了');});
function updateTime(){$('audioTime').textContent=formatDuration(audio.currentTime)+' / '+formatDuration(audio.duration);}
audio.addEventListener('timeupdate',updateTime);
window.addEventListener('pageshow',()=>{showDiagnostics();renderProgress();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)showDiagnostics();});
const appReady=startup();
if('mediaSession' in navigator){
 for(const [action,handler] of Object.entries({play:()=>audio.play().catch(e=>log(e.message)),pause:()=>audio.pause(),seekto:d=>{if(Number.isFinite(d.seekTime))audio.currentTime=d.seekTime;},seekbackward:d=>{audio.currentTime=Math.max(0,audio.currentTime-(d.seekOffset||10));},seekforward:d=>{audio.currentTime=Math.min(audio.duration||0,audio.currentTime+(d.seekOffset||10));}})){try{navigator.mediaSession.setActionHandler(action,handler);}catch(_){}}
}

