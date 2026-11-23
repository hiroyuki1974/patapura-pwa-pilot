/* パタプラ v0.8 iPhoneフォルダ取り込み */
(function(){
'use strict';
const B=PatapuraBulkCore,C=PatapuraCore,$=id=>document.getElementById(id);
let snapshot=null,working=false,cancel=false;
const store={get:id=>recordGet('audio',id),put:v=>recordPut('audio',v)};
const names=['standard','meeting','facilitation','colloquial'];
function write(msg,bad=false){$('bulkStatus').textContent=msg;$('bulkStatus').classList.toggle('study-error',bad);}
function detail(snapshot){
 const el=$('bulkReport');el.replaceChildren();
 for(const track of names){
  const p=document.createElement('p');p.className='library-summary-line';
  const c=snapshot.counts[track];
  p.textContent=B.LABELS[track]+'：'+c.found+' / '+c.expected+'本'+(c.found&&c.missing.length?'（不足'+c.missing.length+'本）':'');
  el.append(p);
 }
 const msg=document.createElement('p');msg.className='small-muted';
 msg.textContent='認識した復習音声 '+snapshot.selected+'本／対象外 '+snapshot.ignoredCount+'件／重複 '+snapshot.duplicates.length+'件／不適合 '+snapshot.invalid.length+'件';
 el.append(msg);
 if(snapshot.invalid.length||snapshot.duplicates.length){
  const note=document.createElement('p');note.className='study-error';note.textContent=[...snapshot.invalid,...snapshot.duplicates].slice(0,6).join('、');el.append(note);
 }
 if(!snapshot.ok){
  const note=document.createElement('p');note.className='study-error';
  note.textContent='選択された教材の復習音声が揃っていないか、ファイル名が不正です。ファイルはまだ登録していません。';
  el.append(note);
 }
}
document.addEventListener('DOMContentLoaded',()=>{
 const input=$('bulkFolderFile'),button=$('bulkConfirmBtn'),stop=$('bulkCancelBtn'),meter=$('bulkProgress');
 input.addEventListener('change',()=>{
  if(working)return;
  snapshot=null;button.disabled=true;meter.max=1;meter.value=0;
  const files=Array.from(input.files||[]);
  if(!files.length){write('フォルダが選択されていません');return;}
  try{
   const result=B.inspect(files);
   detail(result);
   snapshot=result;
   button.disabled=!result.ok;
   const anyPaths=files.some(f=>!!f.webkitRelativePath);
   if(!anyPaths){write('iPhoneからフォルダのパスを取得できません。下の「MP3を複数選択」を使用してください。',true);button.disabled=true;return;}
   if(result.ok)write('登録可能：'+result.selected+'本。教材別の本数を確認して「登録開始」を押してください。');
   else write('登録前の検査で不足・重複を検出しました。元ファイルには変更していません。',true);
  }catch(err){write('フォルダの検査に失敗：'+err.message,true);}
 });
 stop.addEventListener('click',()=>{cancel=true;stop.disabled=true;write('停止要求を受け付けました。現在の1本の保存後に中断します。');});
 button.addEventListener('click',async()=>{
  if(working||!snapshot?.ok)return;
  working=true;cancel=false;button.disabled=true;stop.disabled=false;input.disabled=true;
  document.dispatchEvent(new Event('patapura:bulk-start'));
  const entries=snapshot.entries.slice(),total=entries.length;
  let processed=0,saved=0,skipped=0,errors=0,stoppedByError=false;
  meter.max=total;meter.value=0;
  write('復習音声を端末内に保存中：0 / '+total+'本。完了までアプリを開いたままにしてください。');
  try{
   for(const entry of entries){
    if(cancel)break;
    const outcome=await C.importBatch([entry.file],entry.track,store);
    processed++;meter.value=processed;
    saved+=outcome.success;skipped+=outcome.skipped;errors+=outcome.errors.length;
    if(outcome.errors.length){const p=document.createElement('p');p.className='study-error';p.textContent=entry.track+' / '+entry.file.name+'：'+outcome.errors.map(e=>e.message).join('、');$('bulkErrors').append(p);}
    write('保存処理 '+processed+' / '+total+'本（新規・置換 '+saved+'、同一スキップ '+skipped+'、エラー '+errors+'）');
    if(outcome.cancelled||outcome.errors.some(e=>/QuotaExceededError|容量|storage/i.test(e.message))){
     stoppedByError=true;break;
    }
    if(processed%4===0)await new Promise(resolve=>setTimeout(resolve,0));
   }
   if(stoppedByError)write('保存容量エラーの可能性があるため停止しました。登録済みの音声は維持されています。',true);
   else if(cancel)write('中断しました：'+processed+' / '+total+'本。登録済みの音声は維持されています。');
   else if(errors)write('処理終了：エラー '+errors+'件。詳細を確認し、再度フォルダを選ぶと既存音声はスキップできます。',true);
   else write('登録完了：'+processed+' / '+total+'本（新規・置換 '+saved+'、同一スキップ '+skipped+'）。');
  }catch(err){write('登録を中断しました：'+err.message+'。保存済み音声は維持しています。',true);}
  finally{
   working=false;stop.disabled=true;input.disabled=false;button.disabled=true;snapshot=null;input.value='';
   document.dispatchEvent(new Event('patapura:bulk-done'));
  }
 });
});
})();
