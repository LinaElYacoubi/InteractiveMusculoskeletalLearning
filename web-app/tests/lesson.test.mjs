import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {elbowLesson} from '../public/src/data/lessons/elbow-flexion.js';
import {validateLessonContent,t,LANGUAGES} from '../public/src/lesson/lesson-content.js';
import {resolveHighlightGroup} from '../public/src/lesson/highlight.js';
import {LessonController,STEPS} from '../public/src/lesson/lesson-controller.js';

// ---- stand-ins that count live listeners (including AbortSignal removal) -------------------
class Tracked extends EventTarget {
  constructor(){super();this.listeners=0;}
  addEventListener(type,listener,options){
    super.addEventListener(type,listener,options);this.listeners++;
    options?.signal?.addEventListener('abort',()=>this.listeners--,{once:true});
  }
}
const part=(name,side=name.endsWith('.l')?'L':'R')=>({userData:{anatomy_name:name,anatomical_side:side,provenance:side==='L'?'mirrored teaching geometry':'original'}});
const allNames=elbowLesson.highlightGroups.flatMap(group=>group.anatomyNames);
class FakeViewer extends Tracked {
  constructor(names=allNames){
    super();this.parts=names.map(name=>part(name));this.layer='muscles';this.originalOnly=true;this.currentClip={name:'Knee_Flexion_R',duration:2};
    this.speed=1.5;this.autoRotate=true;this.live=false;this.playing=false;this.highlighted=[];this.highlightColor=null;this.selected=null;
  }
  setLayer(layer,originalOnly=this.originalOnly){this.layer=layer;this.originalOnly=originalOnly;}
  setClip(name){this.currentClip={name,duration:2};this.live=false;this.playing=false;}
  setPlaying(value){if(!this.live)this.playing=value;}
  seek(ratio){this.seekRatio=ratio;}
  lookFrom(direction){this.direction=direction;this.autoRotate=false;}
  frameParts(parts){this.framed=parts;}
  setHighlight(parts,color){this.highlighted=parts;this.highlightColor=color;}
  clearHighlight(){this.highlighted=[];this.highlightColor=null;}
  setGhost(keep){this.ghostKeep=keep;}
  clearGhost(){this.ghostKeep=null;}
  select(value){this.selected=value;}
  startLive(){this.live=true;this.playing=false;}
  stopLive(){this.live=false;}
  setView(view){this.view=view;this.autoRotate=false;}
  fit(){this.fitted=true;}
  frame(dt=.016){this.dispatchEvent(new CustomEvent('frame',{detail:{dt,time:0,duration:2}}));}
}
class FakeCamera extends Tracked {
  constructor(){super();this.active=false;this.generation=0;this.starts=0;this.stops=0;this.error=null;this.gate=null;}
  async start(){
    this.starts++;const generation=++this.generation;
    if(this.gate)await this.gate;
    if(this.error)throw this.error;
    if(generation!==this.generation)return; // mirrors CameraInput: a stop() during start cancels it
    this.active=true;this.dispatchEvent(new Event('started'));
  }
  stop(){++this.generation;this.stops++;if(this.active){this.active=false;this.dispatchEvent(new Event('stopped'));}}
}
class FakePose extends Tracked {
  constructor(){super();this.ready=false;this.running=false;this.error=null;}
  async prepare(){if(this.error)throw this.error;this.ready=true;}
  start(){this.running=true;}
  pause(){this.running=false;}
  emit(visible=true){
    const points=Array.from({length:33},()=>({x:0,y:0,z:0,visibility:0,presence:0}));
    if(visible)for(const [i,x,y] of [[12,-.2,-.5],[14,-.25,-.2],[16,-.3,.1]])points[i]={x,y,z:0,visibility:.99,presence:.99};
    this.dispatchEvent(new CustomEvent('pose',{detail:{landmarks:points,worldLandmarks:points,elapsed:20}}));
  }
}
function fakeRetargeter(){return {calibrated:false,applied:0,eased:0,calibrate(points,mirror,segments){this.calibrated=true;this.mirror=mirror;this.segments=segments;},apply(){this.applied++;},invalidate(){this.calibrated=false;this.invalidated=true;},easeToRest(){this.eased++;}};}
function setup({names,cameraActive=false}={}){
  const viewer=new FakeViewer(names),camera=new FakeCamera(),pose=new FakePose(),retargeters=[];let clock=1000;
  if(cameraActive){camera.active=true;pose.ready=true;pose.running=true;}
  const lesson=new LessonController({viewer,camera,pose,content:elbowLesson,now:()=>clock,createRetargeter:()=>{const r=fakeRetargeter();retargeters.push(r);return r;}});
  return {viewer,camera,pose,lesson,retargeters,tick:ms=>{clock+=ms;}};
}
const listenerTotal=({viewer,camera,pose})=>viewer.listeners+camera.listeners+pose.listeners;

// ---- content ------------------------------------------------------------------------------
test('lesson content is complete in English and French with traceable sources and pending review',()=>{
  assert.deepEqual(validateLessonContent(elbowLesson),[]);
  assert.equal(elbowLesson.review.status,'pending-review');
  for(const claim of Object.values(elbowLesson.claims))assert.equal(claim.status,'pending-review');
  assert.equal(elbowLesson.notice.en,'Educational prototype — content awaiting Kinesiology review.');
  assert.equal(elbowLesson.notice.fr,'Prototype pédagogique — contenu en attente de validation en kinésiologie.');
  for(const source of elbowLesson.sources)assert.match(source.url,/^https:\/\//);
});
test('content validation reports missing translations, unknown sources and unsupported claims',()=>{
  const broken=structuredClone(elbowLesson);
  delete broken.claims.hinge.fr;broken.claims.flexors.sources=['not-a-source'];broken.claims.extensors.sources=[];
  broken.ui.start={en:'Start'};broken.highlightGroups[0].claims=['nope'];broken.question.options[1].correct=true;
  const problems=validateLessonContent(broken).join('\n');
  for(const expected of ['claims.hinge: missing fr text','claims.flexors: unknown source "not-a-source"','claims.extensors: no supporting source','ui.start: missing fr text','claim "nope" does not exist','exactly one option must be correct'])
    assert.ok(problems.includes(expected),`expected: ${expected}\n${problems}`);
});
test('every proposed highlight name exists exactly in the real GLB as original right-sided anatomy',async()=>{
  const file=await readFile(new URL('../public/assets/INNOVA-Musculoskeletal-Rig.glb',import.meta.url));
  const data=JSON.parse(file.toString('utf8',20,20+file.readUInt32LE(12)));
  const parts=data.nodes.filter(node=>node.extras?.anatomy_name).map(node=>({userData:node.extras}));
  for(const group of elbowLesson.highlightGroups){
    const {found,missing}=resolveHighlightGroup(parts,group,'R');
    assert.deepEqual(missing,[],`${group.id} has names missing from the model`);
    for(const item of found){assert.equal(item.userData.anatomical_side,'R');assert.equal(item.userData.provenance,'original');}
  }
  assert.ok(data.animations.some(animation=>animation.name===elbowLesson.clip));
});
test('missing structures are reported and never substituted by a mirrored or similar part',()=>{
  const names=allNames.filter(name=>name!=='Brachialis muscle.r').concat('Brachialis muscle.l');
  const parts=names.map(name=>part(name)),group=elbowLesson.highlightGroups.find(item=>item.id==='flexors');
  const result=resolveHighlightGroup(parts,group,'R');
  assert.deepEqual(result.missing,['Brachialis muscle.r']);
  assert.ok(result.found.every(item=>item.userData.anatomy_name.endsWith('.r')));
  // A wrong-side part carrying the right-side name is rejected too.
  const mislabelled=[{userData:{anatomy_name:'Brachialis muscle.r',anatomical_side:'L'}}];
  assert.deepEqual(resolveHighlightGroup(mislabelled,{anatomyNames:['Brachialis muscle.r']},'R').missing,['Brachialis muscle.r']);
});

// ---- flow -----------------------------------------------------------------------------------
test('lesson steps move forward and back, restart resets and exit restores the viewer once',()=>{
  const {viewer,lesson}=setup();let exits=0;lesson.addEventListener('exit',()=>exits++);
  lesson.next();assert.equal(lesson.active,false,'navigation is ignored before entering');
  lesson.enter();assert.equal(lesson.step,'intro');assert.equal(viewer.currentClip.name,'Elbow_Flexion_R');assert.equal(viewer.layer,'combined');assert.equal(viewer.ghostKeep.length,allNames.length,'only the elbow structures stay opaque');
  lesson.next();assert.equal(lesson.step,'watch');assert.equal(viewer.playing,true,'demonstration plays on the watch step');
  lesson.next();assert.equal(lesson.step,'try');assert.equal(viewer.playing,false);assert.ok(viewer.highlighted.length,'tracked arm is identified');
  lesson.back();assert.equal(lesson.step,'watch');
  for(let i=0;i<10;i++)lesson.next();assert.equal(lesson.step,STEPS.at(-1),'cannot advance past the last step');
  lesson.goTo('nowhere');assert.equal(lesson.step,'check');
  lesson.restart();assert.equal(lesson.step,'intro');
  lesson.exit();lesson.exit();
  assert.equal(exits,1);assert.equal(lesson.active,false);
  assert.equal(viewer.layer,'muscles');assert.equal(viewer.originalOnly,true);assert.equal(viewer.currentClip.name,'Knee_Flexion_R');
  assert.equal(viewer.speed,1.5);assert.equal(viewer.autoRotate,true);assert.deepEqual(viewer.highlighted,[]);assert.equal(viewer.ghostKeep,null,'surrounding anatomy is restored');assert.equal(viewer.view,'front');
});
test('camera practice requires an explicit continue, tracks one arm anatomically and cleans up on exit',async()=>{
  const ctx=setup(),{viewer,camera,pose,lesson,retargeters,tick}=ctx;
  lesson.enter();lesson.goTo('try');
  await lesson.startCamera();
  assert.equal(camera.active,true);assert.equal(pose.running,true);assert.equal(lesson.tryState,'position');
  pose.emit(false);assert.equal(lesson.armVisible,false);assert.equal(lesson.captureStart(),false);assert.equal(lesson.notice,'notVisible');
  pose.emit(true);assert.equal(lesson.armVisible,true);
  assert.equal(lesson.captureStart(),true);assert.equal(lesson.tryState,'tracking');assert.equal(viewer.live,true);
  assert.deepEqual(retargeters[0].segments,['upper_arm.R','forearm.R']);assert.equal(retargeters[0].mirror,false);
  for(let i=0;i<5;i++){tick(80);pose.emit(true);viewer.frame();}
  assert.equal(retargeters[0].applied,5);assert.equal(lesson.step,'try','running the camera never completes the activity');
  tick(1500);viewer.frame();assert.equal(lesson.trackStatus,'lost');assert.ok(retargeters[0].eased>0);
  tick(80);pose.emit(true);assert.equal(lesson.trackStatus,'ok');
  assert.ok(listenerTotal(ctx)>0);
  lesson.exit();
  assert.equal(camera.active,false);assert.equal(pose.running,false);assert.equal(viewer.live,false);
  assert.equal(listenerTotal(ctx),0,'all lesson listeners are removed');assert.equal(retargeters[0].invalidated,true);
});
test('the explicit continue button advances; leaving the step releases the lesson-owned camera',async()=>{
  const ctx=setup(),{camera,lesson}=ctx;
  lesson.enter();lesson.goTo('try');await lesson.startCamera();
  lesson.readyToContinue();assert.equal(lesson.step,'understand');
  assert.equal(camera.active,false);assert.equal(listenerTotal(ctx),0);
});
test('retrying the camera does not stack listeners or streams',async()=>{
  const ctx=setup(),{camera,lesson}=ctx;
  lesson.enter();lesson.goTo('try');
  await lesson.startCamera();const once=listenerTotal(ctx);
  lesson.fail('trackingError');assert.equal(lesson.tryState,'trackingError');assert.equal(listenerTotal(ctx),0);assert.equal(camera.active,false);
  await lesson.startCamera();await lesson.startCamera();
  assert.equal(listenerTotal(ctx),once);assert.equal(camera.active,true);
});
test('camera refusal, missing camera and tracking failure keep the lesson usable with the demonstration',async()=>{
  for(const [error,expected] of [[{name:'NotAllowedError'},'denied'],[{name:'NotFoundError'},'noCamera'],[{name:'AbortError'},'cameraError']]){
    const ctx=setup(),{camera,viewer,lesson}=ctx;camera.error=error;
    lesson.enter();lesson.goTo('try');await lesson.startCamera();
    assert.equal(lesson.tryState,expected);assert.equal(listenerTotal(ctx),0);
    lesson.useDemonstration();assert.equal(lesson.tryState,'demo');assert.equal(viewer.playing,true);assert.equal(viewer.currentClip.name,'Elbow_Flexion_R');
    lesson.readyToContinue();assert.equal(lesson.step,'understand');
  }
  const ctx=setup(),{pose,camera,lesson}=ctx;pose.error=new Error('wasm failed');
  lesson.enter();lesson.goTo('try');await lesson.startCamera();
  assert.equal(lesson.tryState,'trackingError');assert.equal(camera.active,false,'camera released when tracking cannot start');
});
test('a camera that stops unexpectedly ends tracking cleanly',async()=>{
  const ctx=setup(),{camera,viewer,lesson}=ctx;
  lesson.enter();lesson.goTo('try');await lesson.startCamera();ctx.pose.emit(true);lesson.captureStart();
  camera.stop();
  assert.equal(lesson.tryState,'cameraStopped');assert.equal(viewer.live,false);assert.equal(listenerTotal(ctx),0);
});
test('exiting while camera permission is pending cancels the stream when it arrives',async()=>{
  const ctx=setup(),{camera,lesson}=ctx;let release;camera.gate=new Promise(resolve=>{release=resolve;});
  lesson.enter();lesson.goTo('try');const pending=lesson.startCamera();
  assert.equal(lesson.tryState,'requesting');
  lesson.exit();release();await pending;
  assert.equal(camera.active,false);assert.equal(listenerTotal(ctx),0);
});
test('a camera already running in Movement lab is reused and left running',async()=>{
  const ctx=setup({cameraActive:true}),{camera,pose,lesson}=ctx;
  lesson.enter();lesson.goTo('try');await lesson.startCamera();
  assert.equal(camera.starts,0);lesson.exit();
  assert.equal(camera.active,true);assert.equal(pose.running,true);assert.equal(listenerTotal(ctx),0);
});
test('language switching updates state and every visitor string resolves in both languages',()=>{
  const {lesson}=setup();const languages=[];lesson.addEventListener('change',({detail})=>languages.push(detail.lang));
  lesson.enter();lesson.goTo('understand');
  assert.equal(lesson.setLanguage('fr'),true);assert.equal(lesson.state.lang,'fr');assert.equal(lesson.step,'understand','switching language keeps progress');
  assert.equal(lesson.setLanguage('de'),false);assert.equal(lesson.lang,'fr');
  assert.equal(languages.at(-1),'fr');
  assert.equal(t(elbowLesson.ui.continue,'fr'),'Continuer');assert.equal(t(elbowLesson.ui.continue,'en'),'Continue');
  assert.equal(t({en:'Only English'},'fr'),'Only English','gaps fall back visibly rather than blanking the UI');
  for(const lang of LANGUAGES)for(const option of elbowLesson.question.options)assert.ok(t(option.feedback,lang).length>20);
});
test('understanding step highlights exact structures and lists missing ones without substitutes',()=>{
  const names=allNames.filter(name=>name!=='Anconeus muscle.r');
  const {viewer,lesson}=setup({names});
  lesson.enter();lesson.goTo('understand');
  assert.equal(lesson.group,'flexors');assert.equal(viewer.highlighted.length,4);
  lesson.showGroup('extensors');
  assert.equal(viewer.highlighted.length,3);assert.deepEqual(lesson.state.groupMissing,['Anconeus muscle.r']);
  assert.deepEqual(lesson.missingStructures,['Anconeus muscle.r']);
  lesson.next();assert.deepEqual(viewer.highlighted,[],'highlights clear when leaving the step');
});
test('the learning question gives feedback, allows another attempt and resets on restart',()=>{
  const {lesson}=setup();lesson.enter();lesson.goTo('check');
  lesson.choose('extensors');assert.equal(lesson.state.correct,false);
  lesson.choose('flexors');assert.equal(lesson.answer,'extensors','an answer is locked until another attempt is requested');
  lesson.retryQuestion();assert.equal(lesson.answer,null);
  lesson.choose('unknown');assert.equal(lesson.answer,null);
  lesson.choose('flexors');assert.equal(lesson.state.correct,true);assert.equal(lesson.attempts,2);
  lesson.restart();assert.equal(lesson.step,'intro');assert.equal(lesson.answer,null);assert.equal(lesson.attempts,0);
});
