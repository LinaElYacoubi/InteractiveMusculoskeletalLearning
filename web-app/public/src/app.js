import {AnatomyViewer} from './anatomy/viewer.js';
import {describe,displayName} from './data/knowledge.js';
import {Narration} from './ui/speech.js';
import {CameraInput,cameraErrorKey} from './motion/camera.js';
import {PoseDetection} from './motion/pose.js';
import {PoseRetargeter} from './motion/retarget.js';
import {CONNECTIONS,poseMetrics} from './motion/pose-math.js';
import {LessonController} from './lesson/lesson-controller.js';
import {LessonView} from './lesson/lesson-view.js';
import {elbowLesson} from './data/lessons/elbow-flexion.js';
import {t,getLanguage,setLanguage,onLanguageChange,initialLanguage,translateDocument} from './i18n/i18n.js';

const $=id=>document.getElementById(id);
const LAYERS=['combined','muscles','bones'];
let viewer,retargeter,selectedInfo,live=false,lastPose=null,lastPoseAt=0,lastReliableAt=0,lastApplyAt=0,workspace='explore',display=false,previousInspectorHidden=false,lesson=null;
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
  $('modeBadge').textContent=live&&trackingLost?t('mode.lost'):liveNow?t('mode.live'):workspace==='lesson'?t('mode.lesson'):workspace==='movement'?t('mode.camera'):t('mode.explore');$('modeBadge').classList.toggle('live',liveNow);
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
  if(value && (!camera.active||!retargeter?.calibrated||performance.now()-lastPoseAt>1000)){toast(t('tracking.needStance'));return;}
  live=value;trackingLost=false;if(value){viewer.startLive();lastReliableAt=performance.now();}else viewer?.stopLive();
  $('stopTracking').disabled=!value;renderTracking();updateMode();
}
function renderTracking(){
  $('prepareTracking').textContent=t({idle:'tracking.prepare',preparing:'tracking.preparing',ready:'tracking.ready',retry:'tracking.retry'}[prepareState]);
  $('calibrateTracking').textContent=t(retargeter?.calibrated?'tracking.calibrated':'tracking.calibrate');
  $('startTracking').textContent=t(live?'tracking.running':'tracking.start');
}
function setCameraMessage(key,vars={}){cameraMessage={key,vars};$('cameraMessage').textContent=t(key,vars);}
function renderCameraStatus(){$('cameraStatus').textContent=t(camera.active?'camera.on':'camera.off');$('cameraStatus').classList.toggle('on',camera.active);}
async function refreshDevices(){
  try{
    const devices=await camera.devices(),selected=$('cameraSelect').value;$('cameraSelect').replaceChildren(new Option(t('camera.default'),''));
    for(const [index,device] of devices.entries())$('cameraSelect').add(new Option(device.label||t('camera.numbered',{n:index+1}),device.deviceId));
    if([...$('cameraSelect').options].some(option=>option.value===selected))$('cameraSelect').value=selected;
  }catch{setCameraMessage('camera.listFailed');}
}
function updateCalibration(){
  const fresh=lastPose&&performance.now()-lastPoseAt<1000;
  const quality=fresh?poseMetrics(lastPose.worldLandmarks,$('mirrorInput').checked).quality:0;
  $('calibrateTracking').disabled=!viewer?.model||!camera.active||!pose.ready||quality<1;
  $('startTracking').disabled=live||!camera.active||!retargeter?.calibrated||!fresh;
  renderTracking();
}
function drawLandmarks(points){
  const video=$('cameraVideo'),canvas=$('landmarkCanvas');canvas.width=video.videoWidth||640;canvas.height=video.videoHeight||360;
  const context=canvas.getContext('2d');context.clearRect(0,0,canvas.width,canvas.height);context.strokeStyle='#f7cfda';context.lineWidth=3;context.fillStyle='#a11842';
  for(const [a,b] of CONNECTIONS){if(!points[a]||!points[b]||(points[a].visibility??1)<.55||(points[b].visibility??1)<.55)continue;context.beginPath();context.moveTo(points[a].x*canvas.width,points[a].y*canvas.height);context.lineTo(points[b].x*canvas.width,points[b].y*canvas.height);context.stroke();}
  for(const p of points){if((p.visibility??1)<.55)continue;context.beginPath();context.arc(p.x*canvas.width,p.y*canvas.height,4,0,Math.PI*2);context.fill();}
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
  $('cameraMessage').textContent=t(cameraMessage.key,cameraMessage.vars);
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
    viewer.addEventListener('frame',({detail})=>{
      const now=performance.now();
      if(live&&now-lastReliableAt>900){retargeter.easeToRest(detail.dt);if(!trackingLost){trackingLost=true;updateMode();}}
      if(now-lastUI>70){
        if(!live){$('timeline').value=Math.round(detail.time/detail.duration*1000);renderTimeLabel(detail.time,detail.duration);}
        const point=viewer.selectedScreenPoint();
        if(point){$('floatingLabel').hidden=!point.visible;$('floatingLabel').style.left=`${Math.max(90,Math.min(viewer.width-90,point.x))}px`;$('floatingLabel').style.top=`${Math.max(55,point.y-25)}px`;}
        lastUI=now;
      }
    });
    await viewer.load();retargeter=new PoseRetargeter(viewer);
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
  if(live)setLive(false);pose.pause();retargeter?.invalidate();lastPose=null;lastPoseAt=0;
  $('cameraPlaceholder').hidden=false;$('stopCamera').disabled=true;$('startCamera').disabled=false;renderCameraStatus();
  setCameraMessage('camera.stopped');$('landmarkCanvas').getContext('2d').clearRect(0,0,$('landmarkCanvas').width,$('landmarkCanvas').height);
  for(const id of ['poseQuality','inferenceTime','elbowAngle','kneeAngle'])$(id).textContent='—';updateCalibration();
});
$('prepareTracking').addEventListener('click',async()=>{
  $('prepareTracking').disabled=true;prepareState='preparing';renderTracking();
  try{await pose.prepare();prepareState='ready';if(camera.active)pose.start();else toast(t('tracking.readyToast'));updateCalibration();}
  catch(error){console.warn(error);prepareState='retry';$('prepareTracking').disabled=false;renderTracking();toast(t('tracking.prepareFailed'));}
});
pose.addEventListener('pose',({detail})=>{
  if(!camera.active)return;lastPose=detail;lastPoseAt=performance.now();drawLandmarks(detail.landmarks);
  const metrics=poseMetrics(detail.worldLandmarks,$('mirrorInput').checked);
  $('poseQuality').textContent=metrics.quality===1?t('metrics.fullBody'):t('metrics.visible',{n:Math.round(metrics.quality*100)});
  $('inferenceTime').textContent=`${Math.round(detail.elapsed)} ms`;
  $('elbowAngle').textContent=metrics.elbowFlexion===null?'—':t('metrics.flex',{n:Math.round(metrics.elbowFlexion)});
  $('kneeAngle').textContent=metrics.kneeFlexion===null?'—':t('metrics.flex',{n:Math.round(metrics.kneeFlexion)});
  if(live&&metrics.quality>=.5){retargeter.apply(detail.worldLandmarks,$('mirrorInput').checked,Math.min(.2,(lastPoseAt-lastApplyAt)/1000||.08));lastApplyAt=lastPoseAt;lastReliableAt=lastPoseAt;if(trackingLost){trackingLost=false;updateMode();}}
  updateCalibration();
});
pose.addEventListener('failure',({detail})=>{if(live)setLive(false);pose.dispose();retargeter?.invalidate();prepareState='retry';$('prepareTracking').disabled=false;setCameraMessage('camera.trackingPaused',{detail});updateCalibration();toast(t('tracking.failed'));});
$('calibrateTracking').addEventListener('click',()=>{
  if(!lastPose||performance.now()-lastPoseAt>1000){toast(t('tracking.needFresh'));return;}
  try{if(live)setLive(false);retargeter.calibrate(lastPose.worldLandmarks,$('mirrorInput').checked);setCameraMessage('camera.calibrated');updateCalibration();}
  catch{toast(t('tracking.calibrationBody'));}
});
$('startTracking').addEventListener('click',()=>setLive(true));$('stopTracking').addEventListener('click',()=>setLive(false));
function mirror(){
  $('cameraPreview').classList.toggle('mirrored',$('mirrorInput').checked);
  if(live)setLive(false);retargeter?.invalidate();updateCalibration();
}
$('mirrorInput').addEventListener('change',mirror);
window.addEventListener('pagehide',()=>{lesson?.exit();narration.stop();camera.stop();pose.dispose();viewer?.dispose();});
navigator.mediaDevices?.addEventListener('devicechange',()=>refreshDevices());
document.addEventListener('keydown',event=>{if(event.key==='Escape'){viewer?.select(null);$('searchResults').hidden=true;}});

setLanguage(initialLanguage(),{persist:false});applyLanguage(getLanguage());onLanguageChange(applyLanguage);mirror();
init();
