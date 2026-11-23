'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const D=require('../preview-step3-20261123/daily_core_20261123.js');
const day='2026-11-23';
test('three user-facing programs',()=>{
 assert.deepEqual(D.PROGRAMS.map(p=>p.key),['business','meeting_facilitation','colloquial']);
 assert.equal(D.PROGRAMS[0].sequence.length,62);
 assert.equal(D.PROGRAMS[1].sequence.length,75);
 assert.equal(D.PROGRAMS[2].sequence.length,80);
});
test('meeting / facilitation alternate, then meeting continues',()=>{
 const seq=D.PROGRAMS[1].sequence;
 for(let i=0;i<19;i++){
  assert.equal(seq[i*2],'meeting:'+(i+1));
  assert.equal(seq[i*2+1],'facilitation:'+(i+1));
 }
 assert.equal(seq[38],'meeting:20');
 assert.equal(seq.at(-1),'meeting:56');
 assert.equal(new Set(seq).size,75);
});
test('day one has one from each program',()=>{
 const plan=D.plan({lessons:{}},day);
 assert.deepEqual(plan.ids,{business:'standard:1',meeting_facilitation:'meeting:1',colloquial:'colloquial:1'});
});
test('completed lessons advance next study day only',()=>{
 const p1=D.plan({lessons:{}},day);
 const status={dailyPlan:p1,lessons:{'standard:1':day,'meeting:1':day,'colloquial:1':day}};
 assert.equal(D.plan(status,day),p1);
 const p2=D.plan(status,'2026-11-24');
 assert.deepEqual(p2.ids,{business:'standard:2',meeting_facilitation:'facilitation:1',colloquial:'colloquial:2'});
});
test('incomplete programs do not skip after rest days',()=>{
 const p=D.plan({lessons:{'standard:1':day}},'2026-12-03');
 assert.equal(p.ids.business,'standard:2');
 assert.equal(p.ids.meeting_facilitation,'meeting:1');
 assert.equal(p.ids.colloquial,'colloquial:1');
});
test('meeting continues after 19 facilitation lessons completed',()=>{
 const done={};for(let i=1;i<=19;i++){done['meeting:'+i]=day;done['facilitation:'+i]=day;}
 assert.equal(D.plan({lessons:done},'2026-11-24').ids.meeting_facilitation,'meeting:20');
});
test('completed programs return null without resetting',()=>{
 const done={};for(let i=1;i<=62;i++)done['standard:'+i]=day;
 assert.equal(D.plan({lessons:done},'2026-11-24').ids.business,null);
});
