/* Patapura PWA audio pilot, 2026-11-23. Only shell assets are cached; audio never leaves IndexedDB. */
'use strict';
const VERSION='patapura-step3-trial-shell-v10-20261124';
const SHELL=['./','./index.html','./style_20261123.css','./app_20261123.js','./library_20261123.js','./core_20261123.js','./daily_core_20261123.js','./daily_20261123.js','./bulk_folder_core_20261123.js','./bulk_folder_20261123.js','./manifest.webmanifest','./icon.svg'];
const DB='patapura-pwa-step3-trial-v1';
self.addEventListener('install', event=>{
  event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith('patapura-step3-trial-shell-')&&k!==VERSION).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});
function openDB(){return new Promise((resolve,reject)=>{
  const req=indexedDB.open(DB,1);
  req.onupgradeneeded=()=>{
    const db=req.result;
    if(!db.objectStoreNames.contains('audio'))db.createObjectStore('audio',{keyPath:'id'});
    if(!db.objectStoreNames.contains('progress'))db.createObjectStore('progress',{keyPath:'id'});
  };
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error);
});}
async function fetchAudio(req,id){
  let db;
  try{
    db=await openDB();
    const stored=await new Promise((resolve,reject)=>{
      const tx=db.transaction('audio','readonly');
      const r=tx.objectStore('audio').get(id);
      r.onsuccess=()=>resolve(r.result);
      r.onerror=()=>reject(r.error);
    });
    if(!stored||!stored.blob)return new Response('No local audio',{status:404});
    const blob=stored.blob;
    const total=blob.size;
    if(total===0)return new Response('Empty audio',{status:422});
    const type=stored.mimeType||'audio/mpeg';
    const common={'Content-Type':type,'Accept-Ranges':'bytes','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'};
    const range=req.headers.get('range');
    if(!range){
      return new Response(req.method==='HEAD'?null:blob,{status:200,headers:{...common,'Content-Length':String(total)}});
    }
    // For HTML audio, support a single RFC 7233 byte range including suffix / open-ended requests.
    const m=/^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if(!m||(!m[1]&&!m[2]))return new Response(null,{status:416,headers:{...common,'Content-Range':`bytes */${total}`}});
    let start,end;
    if(!m[1]){
      const suffix=Number(m[2]);
      if(!Number.isSafeInteger(suffix)||suffix<=0)return new Response(null,{status:416,headers:{...common,'Content-Range':`bytes */${total}`}});
      start=Math.max(0,total-suffix);end=total-1;
    }else{
      start=Number(m[1]);end=m[2]?Number(m[2]):total-1;
      if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=total||start>end)return new Response(null,{status:416,headers:{...common,'Content-Range':`bytes */${total}`}});
      end=Math.min(end,total-1);
    }
    const slice=blob.slice(start,end+1,type);
    return new Response(req.method==='HEAD'?null:slice,{status:206,headers:{...common,'Content-Range':`bytes ${start}-${end}/${total}`,'Content-Length':String(end-start+1)}});
  }catch(err){return new Response('Local audio read failed',{status:500});}
  finally{try{db?.close();}catch(_){}}
}
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  const base=new URL(self.registration.scope).pathname;
  const route=base+'_local_audio/';
  if(url.pathname.startsWith(route)){
    const id=decodeURIComponent(url.pathname.slice(route.length));
    event.respondWith(fetchAudio(event.request,id));return;
  }
  if(event.request.method!=='GET')return;
  // Offline-first: use precached app shell without first trying the network.
  // This avoids avoidable connection attempts that may trigger iOS airplane-mode alerts.
  if(event.request.mode==='navigate'){
    event.respondWith((async()=>{
      const cached=await (await caches.open(VERSION)).match(new URL('./index.html',self.registration.scope).href,{ignoreSearch:true});
      if(cached)return cached;
      try{
        const fresh=await fetch(event.request);
        if(fresh.ok){const c=await caches.open(VERSION);await c.put('./index.html',fresh.clone());}
        return fresh;
      }catch(_){return new Response('アプリを一度オンラインで起動してキャッシュを準備してください。',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});}
    })());return;
  }
  const allowed=new Set(SHELL.map(u=>new URL(u,self.registration.scope).pathname));
  if(allowed.has(url.pathname)){
    event.respondWith((async()=>{
      const cached=await (await caches.open(VERSION)).match(event.request,{ignoreSearch:true});
      if(cached)return cached;
      try{
        const fresh=await fetch(event.request);
        if(fresh.ok){const c=await caches.open(VERSION);await c.put(event.request,fresh.clone());}
        return fresh;
      }catch(_){return Response.error();}
    })());
  }
});

