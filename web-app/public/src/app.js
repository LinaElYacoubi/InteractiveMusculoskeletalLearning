import {AnatomyViewer} from './anatomy/viewer.js';
import {describe,displayName} from './data/knowledge.js';
import {Narration} from './ui/speech.js';
import {CameraInput,cameraErrorKey} from './motion/camera.js';
import {PoseDetection} from './motion/pose.js';
import {PoseRetargeter} from './motion/retarget.js';
import {FULL_CONNECTIONS,HAND_CONNECTIONS,poseMetrics,calibrationReadiness} from './motion/pose-math.js';
import {project} from './motion/overlap.js';
import {LessonController} from './lesson/lesson-controller.js';
import {LessonView} from './lesson/lesson-view.js';
import {elbowLesson} from './data/lessons/elbow-flexion.js';
import {t,getLanguage,setLanguage,onLanguageChange,initialLanguage,translateDocument} from './i18n/i18n.js';

const $=id=>document.getElementById(id);
const LAYERS=['combined','muscles','bones'];
let viewer,retargeter,selectedInfo,live=false,lastPose=null,lastPoseAt=0,lastReliableAt=0,lastApplyAt=0,workspace='explore',display=false,previousInspectorHidden=false,lesson=null;
let calibrating=null,lastBody=null,lastRoi=null,lastRoiAt=0,lastAnalysisAt=0;
// UI state kept so every message can be re-rendered when the language changes.
let prepareState='idle',cameraMessage={key:'camera.intro'},loadProgress=null,trackingLost=false;
const camera=new CameraInput($('cameraVideo'));const pose=new PoseDetection($('cameraVideo'));
const narration=new Narration($('voiceSelect'),$('speechSpeed'),$('speechState'),()=>renderSpeakButton());
function make(tag,text,className){const element=document.createElement(tag);element.textContent=text;if(className)element.className=className;return element;}
let toastTimer;
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,5500);}
function number(value,digits=1){return new Intl.NumberFormat(getLanguage()==='fr'?'fr-CA':'en-CA',{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(value);}
function inspector(show){document.body.classList.toggle('inspector-hidden',!show);$('infoToggle').setAttribute('aria-expanded',String(show));}
function tab(name){
  const cameraPanel=name==='camera';$('detailsPanel').hidden=cameraPanel;$('cameraPanel').hidden=!cameraPanel;
  $('detailsTab').setAttribute('aria-selected',String(!cameraPanel));$('cameraTab').setAttribute('aria-selected',String(cameraPanel));
}
function chooseWorkspace(name){
  if(name==='lesson'&&!lesson)return;
  const leavingLesson=workspace==='lesson'&&name!=='lesson';
  workspace=name;
  document.querySelectorAll('[data-workspace]').forEach(button=>{const active=button.dataset.workspace===name;button.classList.toggle('selected',active);button.setAttribute('aria-pressed',String(active));});
  document.body.classList.toggle('lesson-mode',name==='lesson');$('lessonPanel').hidden=name!=='lesson';
  // Leaving the lesson stops lesson-owned tracking/camera and restores the viewer.
  if(leavingLesson&&lesson.active)lesson.exit();
  if(name==='lesson'){if(live)setLive(false);narration.stop();$('searchResults').hidden=true;document.querySelectorAll('[data-view]').forEach(button=>button.classList.remove('selected'));lesson.enter();}
  else{tab(name==='movement'?'camera':'details');if(name==='movement')inspector(true);}
  updateMode();
}
function updateMode(){
  const lessonLive=workspace==='lesson'&&Boolean(lesson?.state.live),liveNow=live||lessonLive;
  $('modeBadge').textContent=live&&trackingLost?t('mode.lost'):live&&performance.now()-lastAnalysisAt<600?t('mode.recheck'):liveNow?t('mode.live'):workspace==='lesson'?t('mode.lesson'):workspace==='movement'?t('mode.camera'):t('mode.explore');$('modeBadge').classList.toggle('live',liveNow);
  $('motionSource').textContent=liveNow?t('source.live'):t('source.demo');
  $('clipSelect').disabled=live||!viewer?.clips;$('playButton').disabled=live||!viewer?.clips;$('timeline').disabled=live||!viewer?.clips;$('playbackSpeed').disabled=live;
  $('playButton').textContent=viewer?.playing?'Ⅱ':'▶';$('playButton').setAttribute('aria-label',viewer?.playing?t('transport.pause'):t('transport.play'));
}
function syncLayers(){
  if(!viewer)return;
  const layerName=t(`layer.${viewer.layer}`);
  document.querySelectorAll('[data-layer]').forEach(button=>{const active=button.dataset.layer===viewer.layer;button.classList.toggle('selected',active);button.setAttribute('aria-pressed',String(active));});
  $('layerSlider').value=LAYERS.indexOf(viewer.layer);$('layerSlider').setAttribute('aria-valuetext',layerName);$('originalOnly').checked=viewer.originalOnly;
  $('stageTitle').replaceChildren(document.createTextNode(layerName+' '),make('span','•','subtle-dot'),make('span',t('stage.structures',{n:viewer.parts.filter(p=>p.visible).length})));
  const [first,second]=viewer.originalOnly?['coverage.original1','coverage.original2']:['coverage.bilateral1','coverage.bilateral2'];
  $('coverageText').replaceChildren(document.createTextNode(t(first)),document.createElement('br'),document.createTextNode(t(second)));
}
// Fills the information panel for a part in the current language (no side effects).
function renderPart(part){
  $('clearSelection').hidden=!part;$('selectionActions').hidden=!part;$('speakButton').disabled=!part;$('floatingLabel').hidden=!part;
  if(!part){selectedInfo=null;$('partTissue').textContent=t('part.startEyebrow');$('partName').innerHTML=t('part.startTitleHtml');$('partDescription').textContent=t('part.startText');$('partFacts').replaceChildren();return;}
  const lang=getLanguage();selectedInfo=describe(part,lang);
  $('partTissue').textContent=selectedInfo.tissue.toLocaleUpperCase(lang)+' / '+selectedInfo.region.toLocaleUpperCase(lang);$('partName').textContent=selectedInfo.name;
  $('partDescription').textContent=selectedInfo.description;$('floatingLabelText').textContent=selectedInfo.name;
  const facts=$('partFacts');facts.replaceChildren();
  for(const [title,value] of [[t('part.teachingNote'),selectedInfo.note],[t('part.source'),part.userData.source_glb],[t('part.level'),selectedInfo.specificity]]){
    const block=document.createElement('div');block.append(make('dt',title),make('dd',value));facts.append(block);
  }
  facts.append(make('span',viewer.isMirrored(part)?t('part.mirrored'):t('part.original'),'source-chip'));
}
function showPart(part){
  narration.stop();renderPart(part);
  if(part){tab('details');if(!display)inspector(true);syncLayers();}
}
function renderSpeakButton(){
  $('speakButton').replaceChildren(make('span',narration.speaking?'■':'◖))'),document.createTextNode(' '+t(narration.speaking?'speech.stop':'speech.listen')));
}
function search(){
  const query=$('partSearch').value.trim().toLowerCase(),results=$('searchResults');results.replaceChildren();results.hidden=!query;if(!query||!viewer)return;
  const lang=getLanguage();
  const parts=viewer.parts.filter(part=>(!viewer.originalOnly||!viewer.isMirrored(part))&&displayName(part,lang).toLowerCase().includes(query)).slice(0,25);
  for(const part of parts){const button=make('button',displayName(part,lang));button.type='button';button.addEventListener('click',()=>{viewer.select(part,$('autoFocus').checked);results.hidden=true;$('partSearch').value='';});results.append(button);}
  if(!parts.length)results.append(make('p',t('search.none')));
}
function setLive(value){
  if(value && (!camera.active||!retargeter?.calibrated||performance.now()-lastPoseAt>4000)){toast(t('tracking.needStance'));return;}
  live=value;trackingLost=false;if(value){viewer.startLive();lastReliableAt=performance.now();}else viewer?.stopLive();
  $('startTracking').disabled=value||!retargeter?.calibrated||!camera.active;
  $('stopTracking').disabled=!value;renderTracking();updateMode();
}
function renderTracking(){
  $('prepareTracking').textContent=t({idle:'tracking.prepare',preparing:'tracking.preparing',ready:'tracking.ready',retry:'tracking.retry'}[prepareState]);
  $('calibrateTracking').textContent=calibrating?t(calibrating.done?'tracking.calibrating':'tracking.holdStill',{n:calibrating.progress}):t(retargeter?.calibrated?'tracking.calibrated':'tracking.calibrate');
  $('startTracking').textContent=t(live?'tracking.running':'tracking.start');
}
// extra: further message keys appended after the main one (calibration notes).
function setCameraMessage(key,vars={},extra=[]){cameraMessage={key,vars,extra};renderCameraMessage();}
function renderCameraMessage(){$('cameraMessage').textContent=[t(cameraMessage.key,cameraMessage.vars),...(cameraMessage.extra||[]).map(key=>t(key))].join(' ');}
function renderCameraStatus(){$('cameraStatus').textContent=t(camera.active?'camera.on':'camera.off');$('cameraStatus').classList.toggle('on',camera.active);}
async function refreshDevices(){
  try{
    const devices=await camera.devices(),selected=$('cameraSelect').value;$('cameraSelect').replaceChildren(new Option(t('camera.default'),''));
    for(const [index,device] of devices.entries())$('cameraSelect').add(new Option(device.label||t('camera.numbered',{n:index+1}),device.deviceId));
    if([...$('cameraSelect').options].some(option=>option.value===selected))$('cameraSelect').value=selected;
  }catch{setCameraMessage('camera.listFailed');}
}
function updateCalibration(){
  const fresh=lastPose&&performance.now()-lastPoseAt<4000;
  const ready=fresh&&calibrationReadiness(lastPose.worldLandmarks,$('mirrorInput').checked).ready;
  $('calibrateTracking').disabled=Boolean(calibrating)||!viewer?.model||!camera.active||!pose.ready||!ready;
  $('startTracking').disabled=live||!camera.active||!retargeter?.calibrated||!fresh;
  renderTracking();
}
function drawPreview(detail,body){
  const video=$('cameraVideo'),canvas=$('landmarkCanvas'),w=video.videoWidth||640,h=video.videoHeight||360;canvas.width=w;canvas.height=h;
  const c=canvas.getContext('2d');c.clearRect(0,0,w,h);
  const points=detail.landmarks||[],seen=p=>p&&(p.visibility??1)>=.55,risk=body?.overlap?.report;
  const flagged=(a,b)=>(risk?.arms?.risk>=.35&&[13,14,15,16].some(i=>i===a||i===b))||(risk?.legs?.risk>=.35&&a>=23&&b>=25);
  c.lineWidth=3;
  for(const [a,b] of FULL_CONNECTIONS){if(!seen(points[a])||!seen(points[b]))continue;c.strokeStyle=flagged(a,b)?'#f29f05':'#f7cfda';c.beginPath();c.moveTo(points[a].x*w,points[a].y*h);c.lineTo(points[b].x*w,points[b].y*h);c.stroke();}
  c.fillStyle='#a11842';for(const p of points){if(!seen(p))continue;c.beginPath();c.arc(p.x*w,p.y*h,4,0,Math.PI*2);c.fill();}
  c.strokeStyle='#3fa7c4';c.fillStyle='#3fa7c4';c.lineWidth=2;
  for(const hand of detail.hands||[]){const q=hand.landmarks||[];for(const [a,b] of HAND_CONNECTIONS){if(!q[a]||!q[b])continue;c.beginPath();c.moveTo(q[a].x*w,q[a].y*h);c.lineTo(q[b].x*w,q[b].y*h);c.stroke();}}
  c.fillStyle='#4f9a5c';for(const p of detail.face?.points||[]){c.beginPath();c.arc(p.x*w,p.y*h,2.5,0,Math.PI*2);c.fill();}
  if(body?.projection){ // joints the tracker could not see, drawn where the prediction puts them
    const mirrorOn=$('mirrorInput').checked;c.strokeStyle='#f29f05';c.lineWidth=2;
    body.status.forEach((state,i)=>{if(state==='seen'||i<11)return;const [x,y]=project(body.projection,body.J[i]);c.beginPath();c.arc(mirrorOn?w-x:x,y,6,0,Math.PI*2);c.stroke();});
  }
  if(lastRoi&&performance.now()-lastRoiAt<700){c.setLineDash([8,6]);c.strokeStyle='#f29f05';c.lineWidth=2;c.strokeRect(lastRoi.x*w,lastRoi.y*h,lastRoi.w*w,lastRoi.h*h);c.setLineDash([]);}
}
const OVERLAP_KEYS={'swap-wrists':'overlap.swapWrists','swap-arms':'overlap.swapArms','swap-feet':'overlap.swapFeet','swap-legs':'overlap.swapLegs',predicted:'overlap.predicted',analysis:'overlap.recheck'};
function updateTrackingMetrics(detail,body){
  const metric=(id,text)=>{$(id).textContent=text;$(id).classList.add('small');};
  metric('handsState',body?t('metrics.handsLR',{l:body.hands?.L?'✓':'–',r:body.hands?.R?'✓':'–'}):detail.hands?.length?t('metrics.handsSeen',{n:detail.hands.length}):'—');
  metric('faceState',body?.face?t('metrics.jaw',{n:Math.round(body.face.jaw*100)}):detail.face?t('metrics.seen'):'—');
  if(body){const f=body.facing,n=Math.round(Math.atan2(Math.sin(f.yaw),Math.cos(f.yaw))*180/Math.PI);metric('facingState',t(f.back?'metrics.facingBack':f.profile<.45?'metrics.facingSide':'metrics.facingFront',{n}));}
  else metric('facingState','—');
  const choice=body?.overlap?.choice,active=choice&&(choice.arms!=='observed'?choice.arms:choice.legs!=='observed'?choice.legs:null);
  metric('overlapState',body?`${body.analysisFixes}${active&&OVERLAP_KEYS[active]?' · '+t(OVERLAP_KEYS[active]):''}`:'—');
}
function collectCalibration(detail){
  const session=calibrating,mirrorOn=$('mirrorInput').checked;
  if(detail.worldLandmarks?.length&&calibrationReadiness(detail.worldLandmarks,mirrorOn).ready)session.frames.push(detail);
  const elapsed=performance.now()-session.started;
  session.done=(elapsed>=1200&&session.frames.length>=3)||elapsed>=6000; // slow computers get longer
  session.progress=Math.round(Math.min(1,elapsed/1200)*100);renderTracking();
  if(!session.done)return;
  calibrating=null;
  try{
    if(!session.frames.length)throw Object.assign(new Error('No clear calibration frames.'),{code:'noFrames'});
    const result=retargeter.calibrate(session.frames,mirrorOn);
    setCameraMessage('camera.calibrated',{},(result.noteCodes||[]).map(code=>`calibration.note.${code}`));
  }catch(error){console.warn(error);toast(t({noBody:'calibration.error.noBody',shoulders:'calibration.error.shoulders',noFrames:'calibration.error.noFrames'}[error.code]||'tracking.calibrationBody'));}
  updateCalibration();
}
function trackingOptions(){return {model:$('bodyModel').value,hands:$('trackHands').checked,face:$('trackFace').checked,analysis:$('overlapAnalysis').checked,delegate:$('inferenceDevice').value};}
function syncRetargetOptions(){
  if(!retargeter)return;
  Object.assign(retargeter.options,{hands:$('trackHands').checked,face:$('trackFace').checked,predict:$('predictMotion').checked,analysis:$('overlapAnalysis').checked,toes:$('predictToes').checked});
}
function renderClipNames(){for(const option of $('clipSelect').options)if(viewer?.clips?.some(clip=>clip.name===option.value))option.textContent=t(`clip.${option.value}`);}
function renderLoading(){$('loadingText').textContent=loadProgress?t('loading.progress',{p:loadProgress}):t('loading.start');}
function renderDisplayButton(){$('displayModeText').textContent=t(display?'header.exitUhd':'header.uhd');}
function renderTimeLabel(time=viewer?.action?.time||0,duration=viewer?.currentClip?.duration||2){$('timeLabel').textContent=`${number(time)} / ${number(duration)} s`;}

// ---- language ------------------------------------------------------------------------------
function applyLanguage(lang){
  document.documentElement.lang=lang;document.title=t('doc.title');$('metaDescription').setAttribute('content',t('doc.description'));
  translateDocument(document);
  $('lessonTabAlt').lang=lang==='fr'?'en':'fr';
  document.querySelectorAll('[data-language]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.language===lang)));
  syncLayers();renderPart(viewer?.selected||null);renderSpeakButton();updateMode();renderTracking();renderCameraStatus();renderClipNames();renderLoading();renderDisplayButton();renderTimeLabel();
  renderCameraMessage();
  narration.setLanguage(lang);lesson?.setLanguage(lang);search();
  if(camera.active)refreshDevices();else $('cameraSelect').options[0].textContent=t('camera.default');
}
document.querySelectorAll('[data-language]').forEach(button=>button.addEventListener('click',()=>setLanguage(button.dataset.language)));

function createLesson(){
  lesson=new LessonController({viewer,camera,pose,content:elbowLesson,createRetargeter:()=>new PoseRetargeter(viewer),cameraDeviceId:()=>$('cameraSelect').value});
  lesson.setLanguage(getLanguage());
  new LessonView({controller:lesson,content:elbowLesson,panel:$('lessonPanel'),sourcesDialog:$('lessonSources'),cameraPreview:$('cameraPreview')});
  lesson.addEventListener('change',updateMode);
  lesson.addEventListener('exit',()=>{
    document.querySelectorAll('[data-view]').forEach(button=>button.classList.toggle('selected',button.dataset.view==='front'));
    syncLayers();if(workspace==='lesson')chooseWorkspace('explore');
  });
  const button=document.querySelector('[data-workspace="lesson"]');button.disabled=false;button.removeAttribute('title');button.removeAttribute('data-i18n-attr');
}
async function init(){
  if(window.innerWidth<=1000)inspector(false);
  try{
    viewer=new AnatomyViewer($('anatomyCanvas'),$('viewport'));
    viewer.addEventListener('progress',({detail})=>{$('loadProgress').value=detail;loadProgress=detail;renderLoading();});
    viewer.addEventListener('visibility',syncLayers);viewer.addEventListener('selection',({detail})=>showPart(detail));
    viewer.addEventListener('failure',()=>toast(t('viewer.contextLost')));
    viewer.addEventListener('rotationchange',()=>{$('rotateToggle').setAttribute('aria-pressed',String(viewer.autoRotate));});
    let lastUI=0;
    viewer.addEventListener('beforerender',({detail})=>{
      if(!live||!retargeter)return;
      if(performance.now()-lastReliableAt>900){retargeter.easeToRest(detail.dt);if(!trackingLost){trackingLost=true;updateMode();}}
      else retargeter.update(detail.dt);
    });
    viewer.addEventListener('frame',({detail})=>{
      const now=performance.now();
      if(now-lastUI>70){
        if(!live){$('timeline').value=Math.round(detail.time/detail.duration*1000);renderTimeLabel(detail.time,detail.duration);}
        const point=viewer.selectedScreenPoint();
        if(point){$('floatingLabel').hidden=!point.visible;$('floatingLabel').style.left=`${Math.max(90,Math.min(viewer.width-90,point.x))}px`;$('floatingLabel').style.top=`${Math.max(55,point.y-25)}px`;}
        lastUI=now;
      }
    });
    await viewer.load();retargeter=new PoseRetargeter(viewer);syncRetargetOptions();viewer.setSkinMode($('skinMode').value);
    $('loading').hidden=true;$('clipSelect').replaceChildren();
    // Start with a compact movement so the full-height body fills a portrait display.
    const priority=['Elbow_Flexion_R','Knee_Flexion_R','Shoulder_Elevation_R','Movement_Demo'];
    const ordered=[...viewer.clips].sort((a,b)=>priority.indexOf(a.name)-priority.indexOf(b.name));
    for(const clip of ordered)$('clipSelect').add(new Option(t(`clip.${clip.name}`)===`clip.${clip.name}`?clip.name:t(`clip.${clip.name}`),clip.name));
    viewer.setClip($('clipSelect').value);syncLayers();
    createLesson();updateMode();document.body.dataset.ready='true';
  }catch(error){
    console.error(error);$('loading').replaceChildren(make('h2',t('loading.failed')),make('p',t('loading.failedText')));
    const button=make('button',t('loading.reload'),'outline-button');button.addEventListener('click',()=>location.reload());$('loading').append(button);
  }
}

document.querySelectorAll('[data-layer]').forEach(button=>button.addEventListener('click',()=>viewer?.setLayer(button.dataset.layer)));
$('layerSlider').addEventListener('input',event=>viewer?.setLayer(LAYERS[Number(event.target.value)]));
$('originalOnly').addEventListener('change',event=>{viewer?.setLayer(viewer.layer,event.target.checked);search();});
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{viewer?.setView(button.dataset.view);document.querySelectorAll('[data-view]').forEach(other=>other.classList.toggle('selected',other===button));}));
$('rotateToggle').addEventListener('click',()=>{if(!viewer)return;viewer.autoRotate=!viewer.autoRotate;$('rotateToggle').setAttribute('aria-pressed',String(viewer.autoRotate));});
$('playButton').addEventListener('click',()=>{viewer?.setPlaying(!viewer.playing);updateMode();});
$('clipSelect').addEventListener('change',event=>{if(live)setLive(false);viewer?.setClip(event.target.value);updateMode();});
$('timeline').addEventListener('input',event=>viewer?.seek(Number(event.target.value)/1000));
$('playbackSpeed').addEventListener('change',event=>{if(viewer)viewer.speed=Number(event.target.value);});
$('partSearch').addEventListener('input',search);$('clearSelection').addEventListener('click',()=>viewer?.select(null));$('focusPart').addEventListener('click',()=>viewer?.focus());
$('speakButton').addEventListener('click',()=>{
  if(narration.speaking){narration.stop();return;}
  if(selectedInfo&&narration.speak(`${selectedInfo.name}. ${selectedInfo.description} ${t('speech.teachingNote')} ${selectedInfo.note}`))renderSpeakButton();
  else toast(t('speech.missing'));
});
$('voiceSelect').addEventListener('change',()=>narration.stop());$('speechSpeed').addEventListener('change',()=>narration.stop());
document.querySelectorAll('[data-workspace]').forEach(button=>button.addEventListener('click',()=>chooseWorkspace(button.dataset.workspace)));
$('detailsTab').addEventListener('click',()=>tab('details'));$('cameraTab').addEventListener('click',()=>{tab('camera');refreshDevices();});
$('infoToggle').addEventListener('click',()=>inspector(document.body.classList.contains('inspector-hidden')));
$('guideButton').addEventListener('click',()=>$('modelGuide').showModal());
for(const id of ['closeGuide','guideContinue'])$(id).addEventListener('click',()=>$('modelGuide').close());
$('displayMode').addEventListener('click',async()=>{
  display=!display;document.body.classList.toggle('display-mode',display);
  if(viewer){viewer.uhd=display;viewer.resize();}
  renderDisplayButton();
  if(display){previousInspectorHidden=document.body.classList.contains('inspector-hidden');inspector(false);try{await document.documentElement.requestFullscreen();}catch{toast(t('display.fullscreenUnavailable'));}}
  else{inspector(!previousInspectorHidden);if(document.fullscreenElement)await document.exitFullscreen();}
});
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&display){display=false;document.body.classList.remove('display-mode');if(viewer){viewer.uhd=false;viewer.resize();}inspector(!previousInspectorHidden);renderDisplayButton();}});

$('startCamera').addEventListener('click',async()=>{
  $('startCamera').disabled=true;setCameraMessage('camera.requesting');
  try{await camera.start($('cameraSelect').value);}catch(error){setCameraMessage(cameraErrorKey(error));toast(t(cameraErrorKey(error)));}
  finally{$('startCamera').disabled=camera.active;}
});
$('stopCamera').addEventListener('click',()=>camera.stop());
$('cameraSelect').addEventListener('change',()=>{if(camera.active){camera.stop();toast(t('camera.changed'));}});
camera.addEventListener('started',async({detail})=>{
  $('cameraPlaceholder').hidden=true;$('stopCamera').disabled=false;$('startCamera').disabled=true;renderCameraStatus();
  setCameraMessage('camera.preview',{w:detail.width||'—',h:detail.height||'—'});
  await refreshDevices();if(detail.deviceId)$('cameraSelect').value=detail.deviceId;
  if(pose.ready)pose.start();updateCalibration();
});
camera.addEventListener('stopped',()=>{
  if(live)setLive(false);pose.pause();retargeter?.invalidate();lastPose=null;lastPoseAt=0;lastBody=null;calibrating=null;
  $('cameraPlaceholder').hidden=false;$('stopCamera').disabled=true;$('startCamera').disabled=false;renderCameraStatus();
  setCameraMessage('camera.stopped');$('landmarkCanvas').getContext('2d').clearRect(0,0,$('landmarkCanvas').width,$('landmarkCanvas').height);
  for(const id of ['poseQuality','inferenceTime','elbowAngle','kneeAngle','handsState','faceState','facingState','overlapState'])$(id).textContent='—';updateCalibration();
});
$('prepareTracking').addEventListener('click',async()=>{
  $('prepareTracking').disabled=true;prepareState='preparing';renderTracking();
  try{await pose.prepare(trackingOptions());prepareState='ready';if(camera.active)pose.start();else toast(t('tracking.readyToast'));updateCalibration();}
  catch(error){console.warn(error);prepareState='retry';$('prepareTracking').disabled=false;renderTracking();toast(t('tracking.prepareFailed'));}
});
pose.addEventListener('pose',({detail})=>{
  if(!camera.active)return;lastPose=detail;lastPoseAt=performance.now();
  const mirrorOn=$('mirrorInput').checked,metrics=poseMetrics(detail.worldLandmarks,mirrorOn);
  $('poseQuality').textContent=metrics.quality===1?t('metrics.fullBody'):t('metrics.visible',{n:Math.round(metrics.quality*100)});
  $('inferenceTime').textContent=`${Math.round(detail.elapsed)} ms`;
  $('elbowAngle').textContent=metrics.elbowFlexion===null?'—':t('metrics.flex',{n:Math.round(metrics.elbowFlexion)});
  $('kneeAngle').textContent=metrics.kneeFlexion===null?'—':t('metrics.flex',{n:Math.round(metrics.kneeFlexion)});
  if(calibrating)collectCalibration(detail);
  let body=null;
  if(live&&detail.worldLandmarks?.length&&metrics.quality>=.25){
    body=retargeter.ingest(detail,mirrorOn,Math.min(.25,(lastPoseAt-lastApplyAt)/1000||.08));lastApplyAt=lastPoseAt;
    if(body){
      lastReliableAt=lastPoseAt;trackingLost=false;
      const request=retargeter.takeAnalysisRequest();
      if(request&&$('overlapAnalysis').checked){pose.requestAnalysis(request.roi);lastRoi=request.roi;lastRoiAt=performance.now();}
    }
    updateMode();
  }
  lastBody=body;drawPreview(detail,body);updateTrackingMetrics(detail,body);updateCalibration();
});
pose.addEventListener('analysis',({detail})=>{if(!live||!retargeter)return;retargeter.ingestAnalysis(detail,$('mirrorInput').checked);lastAnalysisAt=performance.now();updateMode();});
pose.addEventListener('analysis-failure',({detail})=>{toast(t('tracking.analysisUnavailable',{detail}));});
pose.addEventListener('fallback',()=>toast(t('tracking.gpuFallback')));
pose.addEventListener('failure',({detail})=>{if(live)setLive(false);pose.dispose();retargeter?.invalidate();prepareState='retry';$('prepareTracking').disabled=false;setCameraMessage('camera.trackingPaused',{detail});updateCalibration();toast(t('tracking.failed'));});
$('calibrateTracking').addEventListener('click',()=>{
  if(!lastPose||performance.now()-lastPoseAt>4000){toast(t('tracking.needFresh'));return;}
  if(live)setLive(false);
  calibrating={frames:[],started:performance.now(),progress:0,done:false};$('calibrateTracking').disabled=true;renderTracking();
});
$('startTracking').addEventListener('click',()=>setLive(true));$('stopTracking').addEventListener('click',()=>setLive(false));
function mirror(){
  $('cameraPreview').classList.toggle('mirrored',$('mirrorInput').checked);
  if(live)setLive(false);retargeter?.invalidate();updateCalibration();
}
$('mirrorInput').addEventListener('change',mirror);
for(const id of ['trackHands','trackFace','predictMotion','overlapAnalysis','predictToes'])$(id).addEventListener('change',()=>{
  syncRetargetOptions();pose.configure(trackingOptions());if(!$('overlapAnalysis').checked)pose.disposeAnalysis();
});
async function reloadTracking(){
  if(!pose.ready&&!pose.preparing){Object.assign(pose.options,trackingOptions());return;} // used by the next prepare, including the lesson's
  const wasLive=live;if(live)setLive(false);pose.dispose();
  $('prepareTracking').disabled=true;prepareState='preparing';renderTracking();
  try{await pose.prepare(trackingOptions());prepareState='ready';if(camera.active)pose.start();if(wasLive)toast(t('tracking.modelChanged'));}
  catch(error){console.warn(error);prepareState='retry';$('prepareTracking').disabled=false;toast(t('tracking.prepareFailed'));}
  updateCalibration();
}
$('bodyModel').addEventListener('change',reloadTracking);$('inferenceDevice').addEventListener('change',reloadTracking);
$('skinMode').addEventListener('change',event=>viewer?.setSkinMode(event.target.value));
// The guided lesson prepares tracking on its own, so it uses the same settings as the Movement lab panel.
Object.assign(pose.options,trackingOptions());
if(new URLSearchParams(location.search).has('debug'))window.atlasDebug={get viewer(){return viewer;},get retargeter(){return retargeter;},pose,camera,get lastBody(){return lastBody;},get lastPose(){return lastPose;},get lesson(){return lesson;}};
window.addEventListener('pagehide',()=>{lesson?.exit();narration.stop();camera.stop();pose.dispose();viewer?.dispose();});
navigator.mediaDevices?.addEventListener('devicechange',()=>refreshDevices());
document.addEventListener('keydown',event=>{if(event.key==='Escape'){viewer?.select(null);$('searchResults').hidden=true;}});

setLanguage(initialLanguage(),{persist:false});applyLanguage(getLanguage());onLanguageChange(applyLanguage);mirror();
init();
