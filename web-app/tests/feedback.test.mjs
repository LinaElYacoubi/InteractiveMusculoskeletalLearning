import test from 'node:test';
import assert from 'node:assert/strict';
import {MovementFeedback} from '../public/src/lesson/feedback.js';
import {elbowLesson} from '../public/src/data/lessons/elbow-flexion.js';
import {kneeLesson} from '../public/src/data/lessons/knee-flexion.js';

// MediaPipe-shaped world landmarks (y points down, -z toward the camera) for one limb:
// root → middle swings forward by `swing` degrees, middle → end bends forward by a further `bend` degrees.
function limb([root,middle,end],{bend=0,swing=0,reference=[12,24],visible=true}={}){
  const points=Array.from({length:33},()=>({x:0,y:0,z:0,visibility:0,presence:0}));
  const put=(i,x,y,z)=>{points[i]={x,y,z,visibility:.99,presence:.99};};
  const rad=d=>d*Math.PI/180,a=rad(swing),b=rad(swing+bend);
  put(reference[0],0,root===reference[0]?0:-.5,0);put(reference[1],0,root===reference[1]?0:.5,0);
  put(root,0,0,0);
  put(middle,0,.3*Math.cos(a),-.3*Math.sin(a));
  if(visible)put(end,0,.3*Math.cos(a)+.25*Math.cos(b),-.3*Math.sin(a)-.25*Math.sin(b));
  return points;
}
function run(spec,frames,stepMs=33){
  let clock=0;const fb=new MovementFeedback(spec,()=>clock);
  for(const points of frames){clock+=stepMs;fb.update(points);}
  return {fb,tick:(points,n=1)=>{for(let i=0;i<n;i++){clock+=stepMs;fb.update(points);}}};
}

test('the displayed bend follows the joint smoothly and remembers the best bend', ()=>{
  const spec=elbowLesson.feedback,joint=spec.joint;
  const {fb,tick}=run(spec,[limb(joint)]);
  assert.equal(fb.state.flexion,0);
  tick(limb(joint,{bend:90}),30);
  assert.ok(Math.abs(fb.state.flexion-90)<=1,`bent elbow reads about 90° (got ${fb.state.flexion})`);
  tick(limb(joint,{bend:30}),30);
  assert.ok(Math.abs(fb.state.flexion-30)<=1);assert.ok(Math.abs(fb.state.best-90)<=1,'best is kept after straightening');
  const one=new MovementFeedback(spec,()=>0);one.update(limb(joint));one.update(limb(joint,{bend:90}));
  assert.ok(one.state.flexion>0&&one.state.flexion<60,'a single noisy jump is smoothed, not shown at once');
});
test('a hidden end point keeps the last reading instead of showing a false value', ()=>{
  const spec=kneeLesson.feedback,{fb,tick}=run(spec,Array(30).fill(limb(kneeLesson.feedback.joint,{bend:70})));
  const before=fb.state.flexion;
  tick(limb(kneeLesson.feedback.joint,{visible:false}),10);
  assert.equal(fb.state.flexion,before);
});
for(const lesson of [elbowLesson,kneeLesson]){
  test(`${lesson.id}: the form tip appears only after the still segment moves too far for a while, then clears`, ()=>{
    const spec=lesson.feedback,joint=spec.joint,limit=spec.form.maxDeg;
    const {fb,tick}=run(spec,[limb(joint,{bend:60})]);
    tick(limb(joint,{bend:60,swing:limit-10}),30);assert.equal(fb.state.tip,false,'a small drift is fine');
    tick(limb(joint,{bend:60,swing:limit+15}),5);assert.equal(fb.state.tip,false,'a brief swing does not trigger the tip');
    tick(limb(joint,{bend:60,swing:limit+15}),15);assert.equal(fb.state.tip,true);
    tick(limb(joint,{bend:60,swing:limit-4}),30);assert.equal(fb.state.tip,true,'inside the margin the tip stays (no flicker)');
    tick(limb(joint,{bend:60,swing:0}),5);assert.equal(fb.state.tip,true,'must be fixed for a moment');
    tick(limb(joint,{bend:60,swing:0}),15);assert.equal(fb.state.tip,false);
    fb.reset();assert.deepEqual(fb.state,{flexion:null,best:null,tip:false});
  });
}
test('both lessons have the same feedback structure, pointing at their own tracked landmarks', ()=>{
  for(const lesson of [elbowLesson,kneeLesson]){
    const {joint,form,displayMax}=lesson.feedback;
    assert.deepEqual(joint,lesson.trackedLandmarks);
    assert.ok(form.segment.every(i=>joint.includes(i)),'the still segment is part of the tracked limb');
    assert.ok(form.maxDeg>10&&form.maxDeg<60);assert.ok(displayMax>=90);
  }
});
