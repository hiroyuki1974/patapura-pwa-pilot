'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const C=require('../preview-step3-20261123/core_20261123.js');
globalThis.PatapuraCore=C;
const B=require('../preview-step3-20261123/bulk_folder_core_20261123.js');
function f(track,n,kind,root='パタプラ資料'){
 const folder=Object.keys(B.TRACKS).find(k=>B.TRACKS[k]===track);
 const nn=String(n).padStart(2,'0');
 const name=track==='colloquial'?'Lesson'+nn+'-Type'+kind+'.mp3':'Review-Lesson'+nn+'.mp3';
 return {name,size:1000000,webkitRelativePath:root+'/'+folder+'/'+name};
}
function all(){
 const files=[];
 for(let i=1;i<=62;i++)files.push(f('standard',i));
 for(let i=1;i<=56;i++)files.push(f('meeting',i));
 for(let i=1;i<=19;i++)files.push(f('facilitation',i));
 for(let i=1;i<=80;i++)files.push(f('colloquial',i,'B'),f('colloquial',i,'C'));
 return files;
}
test('297 exact review tracks and no Type A/main',()=>{
 assert.equal(B.TOTAL,297);
 assert.equal(B.EXPECTED.standard.length,62);
 assert.equal(B.EXPECTED.meeting.length,56);
 assert.equal(B.EXPECTED.facilitation.length,19);
 assert.equal(B.EXPECTED.colloquial.length,160);
 const result=B.inspect(all());
 assert.equal(result.ok,true);
 assert.equal(result.selected,297);
 assert.equal(result.counts.colloquial.found,160);
});
test('one of four correct folders can be imported separately',()=>{
 const result=B.inspect(all().filter(x=>x.webkitRelativePath.includes('パタプラビジネス/')));
 assert.equal(result.ok,true);
 assert.equal(result.selected,62);
 assert.equal(result.counts.meeting.found,0);
});
test('same MP3 name across course folders stays separate',()=>{
 const result=B.inspect(all());
 assert.notEqual(result.entries.find(x=>x.id==='standard:01:review'),result.entries.find(x=>x.id==='meeting:01:review'));
});
test('old audio test folders are ignored',()=>{
 const files=all();
 files.push({name:'Review-Lesson01.mp3',size:1000000,webkitRelativePath:'パタプラ資料/会議lesson一括DL1-3/Review-Lesson01.mp3'});
 const result=B.inspect(files);
 assert.equal(result.ok,true);
 assert.equal(result.selected,297);
 assert.equal(result.ignoredCount,1);
});
test('missing selected lesson blocks upload',()=>{
 const result=B.inspect(all().filter(x=>x.webkitRelativePath!=='パタプラ資料/パタプラ会議/Review-Lesson55.mp3'));
 assert.equal(result.ok,false);
 assert.equal(result.counts.meeting.missing.length,1);
});
test('duplicate blocks upload',()=>{
 const files=all();files.push({...files[0],webkitRelativePath:'パタプラ資料/パタプラビジネス/sub/Review-Lesson01.mp3'});
 const result=B.inspect(files);
 assert.equal(result.ok,false);
 assert.equal(result.duplicates.length,1);
});
test('empty file blocks upload',()=>{
 const files=all();files[0]={...files[0],size:0};
 assert.equal(B.inspect(files).ok,false);
});
test('Type A and initial audio are ignored',()=>{
 const files=all();
 files.push({name:'Lesson01-TypeA.mp3',size:10000,webkitRelativePath:'パタプラ資料/パタプラ口語表現/Lesson01-TypeA.mp3'});
 files.push({name:'Lesson02.mp3',size:10000,webkitRelativePath:'パタプラ資料/パタプラビジネス/Lesson02.mp3'});
 const result=B.inspect(files);
 assert.equal(result.ok,true);
 assert.equal(result.ignoredCount,2);
});
