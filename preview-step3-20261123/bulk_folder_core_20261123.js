/* パタプラ v0.8 復習MP3フォルダ一括登録・事前検査（購入教材を含まない） */
(function(root){
'use strict';
const TRACKS={
 'パタプラビジネス':'standard',
 'パタプラ会議':'meeting',
 'パタプラファシリテーション':'facilitation',
 'パタプラ口語表現':'colloquial'
};
const EXPECTED={
 standard:Array.from({length:62},(_,i)=>'standard:'+String(i+1).padStart(2,'0')+':review'),
 meeting:Array.from({length:56},(_,i)=>'meeting:'+String(i+1).padStart(2,'0')+':review'),
 facilitation:Array.from({length:19},(_,i)=>'facilitation:'+String(i+1).padStart(2,'0')+':review'),
 colloquial:Array.from({length:80},(_,i)=>['type_b','type_c'].map(k=>'colloquial:'+String(i+1).padStart(2,'0')+':'+k)).flat()
};
const LABELS={standard:'ビジネス',meeting:'会議編',facilitation:'ファシリテーション編',colloquial:'口語表現'};
const TOTAL=Object.values(EXPECTED).reduce((s,a)=>s+a.length,0);
function inspect(files){
 const C=root.PatapuraCore;
 if(!C)throw Error('音声ファイル解析が使えません');
 const grouped=Object.fromEntries(Object.keys(EXPECTED).map(t=>[t,[]]));
 const invalid=[],duplicates=[],ignored=[];
 const seen=new Set();
 for(const file of Array.from(files||[])){
  const path=String(file.webkitRelativePath||file.relativePath||'').normalize('NFC');
  const components=path.split(/[\/\\]+/).filter(Boolean);
  const matches=components.slice(0,-1).map(s=>TRACKS[s]).filter(Boolean);
  if(matches.length!==1){ignored.push(file.name);continue;}
  const track=matches[0];
  if(!/\.mp3$/i.test(file.name)){ignored.push(file.name);continue;}
  let parsed;
  try{parsed=C.parseFilename(track,file.name);}catch(e){invalid.push(file.name+'：'+e.message);continue;}
  if(!EXPECTED[track].includes(parsed.id)){ignored.push(file.name);continue;} // 初回用は不要
  if(file.size<128){invalid.push(file.name+'：音声データが小さすぎます');continue;}
  if(seen.has(parsed.id)){duplicates.push(parsed.id);continue;}
  seen.add(parsed.id);
  grouped[track].push({file,track,id:parsed.id});
 }
 const counts={};let ok=true,selected=0;
 for(const [t,expected] of Object.entries(EXPECTED)){
  const got=grouped[t].length;
  counts[t]={found:got,expected:expected.length,missing:expected.filter(k=>!seen.has(k))};
  if(got>0){selected+=got;if(got!==expected.length)ok=false;}
 }
 const entries=Object.values(grouped).flat();
 return {ok:ok&&selected>0&&!invalid.length&&!duplicates.length,entries,counts,selected,invalid,duplicates,ignoredCount:ignored.length,totalExpected:TOTAL};
}
const api={TRACKS,EXPECTED,LABELS,TOTAL,inspect};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PatapuraBulkCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
