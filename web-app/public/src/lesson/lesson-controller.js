// Guided "Learn a movement" flow. DOM-free so it can be tested in Node with stand-in objects.
//
// Ownership rules
// - The lesson only stops a camera stream or pose loop that it started itself.
// - Lesson tracking uses its own PoseRetargeter (calibrated on the lesson's one limb only), never the Movement lab one.
// - All lesson event listeners share one AbortController per tracking session; aborting it
//   removes them, so repeated retries cannot stack listeners.
// - The viewer's single render loop is reused; the lesson never starts another.
import {resolveHighlights} from './highlight.js';
import {MovementFeedback} from './feedback.js';
import {LANGUAGES} from './lesson-content.js';
import {landmark} from '../motion/pose-math.js';

export const STEPS=['intro','watch','try','understand','check'];
export const TRY_STATES=['idle','requesting','preparing','position','tracking','demo','denied','noCamera','cameraError','trackingError','cameraStopped'];
// Default camera direction when a lesson does not give its own `view` (the elbow's right-side oblique).
// The model faces +Z and its right side is at -X.
export const LESSON_VIEW=[-.9,.15,.42];
const LOST_AFTER_MS=900,FRESH_POSE_MS=1000;

export class LessonController extends EventTarget {
  // `lessons` lists every available lesson; `content` (optional) is the one shown first.
  constructor({viewer,camera,pose,createRetargeter,content,lessons=[content],cameraDeviceId=()=>'',now=()=>performance.now()}){
    super();
    lessons=lessons.filter(Boolean);
    Object.assign(this,{viewer,camera,pose,createRetargeter,lessons,content:content||lessons[0],cameraDeviceId,now});
    this.active=false;this.lang='en';this.step='intro';this.session=0;this.tracking=null;this.ownership=null;
    this.resolved=new Map();this.saved=null;this.resetProgress();
  }
  resetProgress(){this.tryState='idle';this.trackStatus=null;this.armVisible=false;this.notice=null;this.group=null;this.answer=null;this.attempts=0;}
  get stepIndex(){return STEPS.indexOf(this.step);}
  get missingStructures(){return [...this.resolved.values()].flatMap(group=>group.missing);}
  get state(){
    const option=this.content.question.options.find(item=>item.id===this.answer);
    return {active:this.active,lang:this.lang,lessonId:this.content.id,lessonIds:this.lessons.map(lesson=>lesson.id),step:this.step,stepIndex:this.stepIndex,stepCount:STEPS.length,
      tryState:this.tryState,trackStatus:this.trackStatus,armVisible:this.armVisible,notice:this.notice,
      group:this.group,groupMissing:this.group?this.resolved.get(this.group)?.missing||[]:[],
      answer:this.answer,correct:option?Boolean(option.correct):null,attempts:this.attempts,
      missingStructures:this.missingStructures,live:Boolean(this.tracking&&this.tryState==='tracking'),
      feedback:this.tracking?.feedback&&this.tryState==='tracking'?this.tracking.feedback.state:null};
  }
  emit(){this.dispatchEvent(new CustomEvent('change',{detail:this.state}));}

  // ---- lifecycle -------------------------------------------------------------------------
  enter(){
    if(this.active)return;
    const viewer=this.viewer;
    this.saved={layer:viewer.layer,originalOnly:viewer.originalOnly,clip:viewer.currentClip?.name,speed:viewer.speed,autoRotate:viewer.autoRotate};
    this.resolved=resolveHighlights(viewer.parts,this.content.highlightGroups,this.content.side);
    this.active=true;this.resetProgress();this.step='intro';this.enterStep('intro');this.emit();
  }
  exit(){
    if(!this.active)return;
    this.leaveStep(this.step);
    const viewer=this.viewer,saved=this.saved||{};
    viewer.clearHighlight();viewer.clearGhost();viewer.select(null);
    viewer.speed=saved.speed??1;
    viewer.setLayer(saved.layer||'combined',Boolean(saved.originalOnly));
    if(saved.clip)viewer.setClip(saved.clip);
    viewer.setView('front');viewer.fit();viewer.autoRotate=Boolean(saved.autoRotate);
    this.active=false;this.step='intro';this.resetProgress();this.saved=null;
    this.emit();this.dispatchEvent(new Event('exit'));
  }
  // Switches to another lesson. While active this leaves the current step (releasing any lesson-owned
  // camera) and starts the new lesson from its introduction.
  setLesson(id){
    const next=this.lessons.find(lesson=>lesson.id===id);
    if(!next)return false;
    if(next===this.content)return true;
    if(this.active)this.leaveStep(this.step);
    this.content=next;
    if(this.active){
      this.resolved=resolveHighlights(this.viewer.parts,next.highlightGroups,next.side);
      this.resetProgress();this.step='intro';this.enterStep('intro');
    }
    this.emit();
    return true;
  }
  setLanguage(lang){
    if(!LANGUAGES.includes(lang))return false;
    if(lang!==this.lang){this.lang=lang;this.emit();}
    return true;
  }

  // ---- navigation ------------------------------------------------------------------------
  goTo(step){
    if(!this.active||!STEPS.includes(step))return;
    this.leaveStep(this.step);this.step=step;this.enterStep(step);this.emit();
  }
  next(){const step=STEPS[this.stepIndex+1];if(step)this.goTo(step);}
  back(){const step=STEPS[this.stepIndex-1];if(step)this.goTo(step);}
  restart(){if(!this.active)return;this.leaveStep(this.step);this.resetProgress();this.step='intro';this.enterStep('intro');this.emit();}

  leaveStep(step){
    if(step==='try')this.stopTry();
    this.viewer.setPlaying(false);this.viewer.clearHighlight();
  }
  enterStep(step){
    this.viewer.select(null);this.notice=null;
    if(step==='intro')this.stageDemo({play:false});
    if(step==='watch')this.stageDemo({play:true});
    if(step==='try'){this.tryState='idle';this.trackStatus=null;this.armVisible=false;this.stageDemo({play:false});this.highlight(this.content.trackedGroup);}
    if(step==='understand'){this.stageDemo({play:false,at:.5});this.showGroup(this.content.highlightGroups[0].id,false);}
    if(step==='check'){this.answer=null;this.stageDemo({play:false});}
  }
  get viewDirection(){return this.content.view||LESSON_VIEW;}
  // Scripted demonstration, framed on the lesson's structures (including the clip's peak flexion).
  stageDemo({play,at=0}){
    const viewer=this.viewer;
    if(viewer.live)viewer.stopLive();
    viewer.setLayer('combined',false);viewer.speed=.5;viewer.setClip(this.content.clip);
    if(at)viewer.seek(at);
    viewer.setGhost(this.lessonParts());viewer.lookFrom(this.viewDirection);viewer.frameParts(this.lessonParts(),{includeClipPeak:true});
    viewer.setPlaying(play);
  }
  lessonParts(){return [...this.resolved.values()].flatMap(group=>group.found);}
  highlight(groupId){
    const group=this.content.highlightGroups.find(item=>item.id===groupId),resolved=this.resolved.get(groupId);
    if(!group||!resolved)return;
    this.viewer.setHighlight(resolved.found,group.color);
  }
  replay(){
    if(!(this.step==='watch'||(this.step==='try'&&this.tryState==='demo')))return;
    this.viewer.seek(0);this.viewer.setPlaying(true);this.emit();
  }

  // ---- try it yourself -------------------------------------------------------------------
  async startCamera(){
    if(!this.active||this.step!=='try'||['requesting','preparing'].includes(this.tryState))return;
    this.stopTracking();this.releaseDevices();
    const session=++this.session,camera=this.camera,pose=this.pose;
    this.viewer.setPlaying(false);
    this.ownership={camera:!camera.active,pose:!pose.running};
    this.tryState='requesting';this.notice=null;this.emit();
    try{
      if(this.ownership.camera)await camera.start(this.cameraDeviceId());
      if(session!==this.session)return;
      if(!camera.active)throw Object.assign(new Error('Camera did not start.'),{name:'CameraInactive'});
      this.tryState='preparing';this.emit();
      try{await pose.prepare();}catch(error){throw Object.assign(error instanceof Error?error:new Error(String(error)),{stage:'tracking'});}
      if(session!==this.session)return;
      pose.start();this.beginTracking();
    }catch(error){
      if(session!==this.session)return;
      this.stopTracking();this.releaseDevices();
      const name=error?.name;
      this.tryState=error?.stage==='tracking'?'trackingError':['NotAllowedError','SecurityError'].includes(name)?'denied':['NotFoundError','OverconstrainedError'].includes(name)?'noCamera':'cameraError';
      this.emit();
    }
  }
  beginTracking(){
    const abort=new AbortController(),signal=abort.signal;
    this.tracking={abort,retargeter:this.createRetargeter(),lastPose:null,lastPoseAt:0,lastReliableAt:this.now(),lastApplyAt:0,
      feedback:this.content.feedback?new MovementFeedback(this.content.feedback,this.now):null};
    this.pose.addEventListener('pose',({detail})=>this.onPose(detail),{signal});
    this.pose.addEventListener('failure',()=>this.fail('trackingError'),{signal});
    this.camera.addEventListener('stopped',()=>this.fail('cameraStopped'),{signal});
    this.viewer.addEventListener('frame',({detail})=>this.onFrame(detail),{signal});
    this.tryState='position';this.armVisible=false;this.emit();
  }
  armIsVisible(points){return this.content.trackedLandmarks.every(index=>landmark(points,index,this.content.mirrorTracking));}
  onPose(detail){
    const tracking=this.tracking;if(!tracking)return;
    const now=this.now(),visible=this.armIsVisible(detail.worldLandmarks);
    tracking.lastPose=detail;tracking.lastPoseAt=now;
    let changed=visible!==this.armVisible;this.armVisible=visible;
    if(visible&&this.notice==='notVisible'){this.notice=null;changed=true;}
    if(this.tryState==='tracking'&&visible){
      tracking.retargeter.apply(detail.worldLandmarks,this.content.mirrorTracking,Math.min(.2,(now-tracking.lastApplyAt)/1000||.08));
      tracking.lastApplyAt=now;tracking.lastReliableAt=now;
      if(this.trackStatus!=='ok'){this.trackStatus='ok';changed=true;}
      // Angle updates arrive many times a second, so they get their own lightweight event;
      // a full 'change' (panel re-render) only happens when something else changed.
      if(tracking.feedback?.update(detail.worldLandmarks,this.content.mirrorTracking)&&!changed)
        this.dispatchEvent(new CustomEvent('feedback',{detail:tracking.feedback.state}));
    }
    if(changed)this.emit();
  }
  onFrame(detail){
    const tracking=this.tracking;
    if(!tracking||this.tryState!=='tracking')return;
    if(this.now()-tracking.lastReliableAt>LOST_AFTER_MS){
      tracking.retargeter.easeToRest(detail.dt);
      if(this.trackStatus!=='lost'){this.trackStatus='lost';this.emit();}
    }
  }
  // Captures the visitor's relaxed starting position as the tracked limb's neutral reference.
  captureStart(){
    const tracking=this.tracking;
    if(!tracking||this.tryState!=='position')return false;
    const fresh=tracking.lastPose&&this.now()-tracking.lastPoseAt<FRESH_POSE_MS;
    if(!fresh||!this.armIsVisible(tracking.lastPose.worldLandmarks)){this.notice='notVisible';this.emit();return false;}
    try{tracking.retargeter.calibrate(tracking.lastPose.worldLandmarks,this.content.mirrorTracking,this.content.trackedSegments);}
    catch{this.notice='notVisible';this.emit();return false;}
    const viewer=this.viewer;
    viewer.setPlaying(false);viewer.startLive();viewer.lookFrom(this.viewDirection);viewer.frameParts(this.lessonParts(),{padding:2.1});
    tracking.feedback?.reset();tracking.lastReliableAt=this.now();this.tryState='tracking';this.trackStatus='ok';this.notice=null;this.emit();
    return true;
  }
  fail(kind){
    if(!this.active||this.step!=='try')return;
    this.stopTracking();this.releaseDevices();this.tryState=kind;this.emit();
  }
  useDemonstration(){
    if(!this.active||this.step!=='try')return;
    this.session++;this.stopTracking();this.releaseDevices();
    this.tryState='demo';this.notice=null;this.stageDemo({play:true});this.highlight(this.content.trackedGroup);this.emit();
  }
  readyToContinue(){
    if(this.step==='try'&&['tracking','demo','position'].includes(this.tryState))this.next();
  }
  stopTracking(){
    const tracking=this.tracking;if(!tracking)return;
    tracking.abort.abort();tracking.retargeter.invalidate();this.tracking=null;
    if(this.viewer.live)this.viewer.stopLive();
    this.trackStatus=null;this.armVisible=false;
  }
  releaseDevices(){
    const owned=this.ownership;this.ownership=null;if(!owned)return;
    if(owned.pose)this.pose.pause();
    if(owned.camera)this.camera.stop();
  }
  stopTry(){this.session++;this.stopTracking();this.releaseDevices();this.tryState='idle';}

  // ---- understand ------------------------------------------------------------------------
  showGroup(groupId,notify=true){
    if(this.step!=='understand'||!this.resolved.has(groupId))return;
    this.group=groupId;this.highlight(groupId);
    if(notify)this.emit();
  }

  // ---- check -----------------------------------------------------------------------------
  choose(optionId){
    if(this.step!=='check'||this.answer)return; // one answer per attempt; retryQuestion() opens another
    if(!this.content.question.options.some(option=>option.id===optionId))return;
    this.answer=optionId;this.attempts++;this.emit();
  }
  retryQuestion(){if(this.step==='check'&&this.answer){this.answer=null;this.emit();}}
}
