/* build:v33backup-20261128 */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const KEY='patapura-push-vapid-v1';
let reg=null,pair=null,subscription=null,working=false,available=false;
function b64(bytes){return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function unb64(value){const s=value.replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(atob(s+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));}
function readPair(){try{const p=JSON.parse(localStorage.getItem(KEY)||'null');if(p&&unb64(p.publicKey).length===65&&unb64(p.privateKey).length===32)return p;}catch(_){}return null;}
function status(s){$('pushState').textContent=s;}
function buttons(){const prep=$('pushPrepare'),allow=$('pushAllow'),copy=$('pushCopy'),stop=$('pushStop');prep.hidden=!!pair||!!subscription;prep.disabled=working||!available;allow.hidden=!pair||!!subscription;allow.disabled=working||!available;copy.hidden=!subscription||!pair;copy.disabled=working||!subscription||!pair;stop.hidden=!subscription;stop.disabled=working||!subscription;$('pushHelp').hidden=!subscription||!pair;}
async function badge(){
 if(!subscription||!available||typeof Notification==='undefined'||Notification.permission!=='granted')return;
 try{const d=PatapuraDailyCore.plan(progress,localDate());const done=PatapuraDailyCore.countFinished(d,progress);
 const outstanding=PatapuraDailyCore.tasks(d).length-done+PatapuraDailyCore.hiddenPending(d,progress);
 if(outstanding===0&&navigator.clearAppBadge)await navigator.clearAppBadge();
 else if(outstanding>0&&navigator.setAppBadge)await navigator.setAppBadge(1);
 }catch(_){}
}
async function init(){
 if(!window.matchMedia('(display-mode: standalone)').matches&&!navigator.standalone){status('ホーム画面のパタプラから設定してください。');return;}
 if(!('serviceWorker'in navigator)||!('PushManager'in window)||!window.crypto?.subtle||!('Notification'in window)){status('この起動環境はWeb Pushに対応していません。');return;}
 try{
  reg=await navigator.serviceWorker.getRegistration();
  if(!reg?.active){status('オンラインでアプリを開き直してから設定してください。');return;}
  if(!reg.pushManager){status('通知機能は利用できません。');return;}
  available=true;pair=readPair();subscription=await reg.pushManager.getSubscription();
  if(subscription&&!pair)status('登録済みですが鍵が見つかりません。停止後に再登録してください。');
  else if(subscription)status('この端末は通知登録済み（配信設定・受信試験は別途必要）。');
  else if(Notification.permission==='denied')status('iPhoneの設定 → 通知 → パタプラで通知を許可してください。');
  else status(pair?'準備完了。「通知を許可」を押してください。':'未登録。通知を準備してください。');
  buttons();await badge();
 }catch(_){status('通知の状態を取得できません。オンラインで開き直してください。');}
}
async function prepare(){
 if(working||!available||subscription)return;
 working=true;buttons();
 try{
  const k=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const pub=await crypto.subtle.exportKey('raw',k.publicKey),priv=await crypto.subtle.exportKey('jwk',k.privateKey);
  const p={publicKey:b64(pub),privateKey:priv.d};
  if(unb64(p.publicKey).length!==65||unb64(p.privateKey).length!==32)throw Error('invalid key');
  localStorage.setItem(KEY,JSON.stringify(p));pair=p;status('準備完了。「通知を許可」を押してください。');
 }catch(_){status('通知の準備に失敗しました。');}
 finally{working=false;buttons();}
}
async function allow(){
 if(working||!available||!pair||subscription)return;
 if(!navigator.onLine){status('オンラインで通知を登録してください。');return;}
 working=true;buttons();
 try{
  // Invoke subscribe directly in the button gesture; no asynchronous preflight.
  subscription=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:unb64(pair.publicKey)});
  status('通知登録済み。次に登録情報をGitHubの非公開Secretに設定してください。');await badge();
 }catch(_){status('通知の登録に失敗しました。iPhoneの通知設定を確認してください。');}
 finally{working=false;buttons();}
}
async function copy(){
 if(!pair||!subscription||working)return;
 try{
  const cfg=JSON.stringify({publicKey:pair.publicKey,privateKey:pair.privateKey,subscription:subscription.toJSON()});
  await navigator.clipboard.writeText(cfg);
  status('登録情報をコピーしました。GitHubのActions Secretにだけ貼り付けてください。');
 }catch(_){status('コピーできませんでした。もう一度お試しください。');}
}
async function stop(){
 if(working||!subscription||!confirm('この端末への通知を停止しますか？教材・音声・学習記録は消えません。'))return;
 working=true;buttons();
 try{await subscription.unsubscribe();subscription=null;pair=null;localStorage.removeItem(KEY);if(navigator.clearAppBadge)await navigator.clearAppBadge();status('通知を停止しました。GitHubの通知用Secretも削除してください。');}
 catch(_){status('停止できませんでした。オンラインで再試行してください。');}
 finally{working=false;buttons();}
}
document.addEventListener('DOMContentLoaded',()=>{
 $('pushPrepare')?.addEventListener('click',prepare);$('pushAllow')?.addEventListener('click',allow);$('pushCopy')?.addEventListener('click',copy);$('pushStop')?.addEventListener('click',stop);
 $('showSettings')?.addEventListener('click',()=>{if(!working)init();});
 document.addEventListener('patapura:progress',badge);
 window.addEventListener('pageshow',badge);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)badge();});
 navigator.serviceWorker?.addEventListener('message',e=>{if(e.data?.type==='patapura:notification')document.dispatchEvent(new Event('patapura:home'));});
 appReady.then(init).catch(()=>{status('通知設定を読み込めませんでした。');});
});
})();
