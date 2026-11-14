import {AnatomyViewer} from './anatomy/viewer.js';
import {describe,displayName} from './data/knowledge.js';
import {Narration} from './ui/speech.js';
import {CameraInput,cameraError} from './motion/camera.js';
import {PoseDetection} from './motion/pose.js';
import {PoseRetargeter} from './motion/retarget.js';
import {CONNECTIONS,poseMetrics} from './motion/pose-math.js';

const $=id=>document.getElementById(id);
const LAYERS=['combined','muscles','bones'];
const LAYER_NAMES={combined:'Bones & muscles',muscles:'Muscles',bones:'Bones'};
const CLIP_NAMES={Movement_Demo:'Combined movement',Elbow_Flexion_R:'Right elbow flexion',Knee_Flexion_R:'Right knee flexion',Shoulder_Elevation_R:'Right shoulder elevation'};
let viewer,retargeter,selectedInfo,live=false,lastPose=null,lastPoseAt=0,lastReliableAt=0,lastApplyAt=0,workspace='explore',display=false,previousInspectorHidden=false;
const camera=new CameraInput($('cameraVideo'));const pose=new PoseDetection($('cameraVideo'));
const narration=new Narration($('voiceSelect'),$('speechSpeed'),$('speechState'),()=>{$('speakButton').replaceChildren(make('span','◖))'),document.createTextNode(' Listen to explanation'));});
function make(tag,text,className){const element=document.createElement(tag);element.textContent=text;if(className)element.className=className;return element;}
let toastTimer;
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,5500);}
function inspector(show){document.body.classList.toggle('inspector-hidden',!show);$('infoToggle').setAttribute('aria-expanded',String(show));}
function tab(name){
  const cameraPanel=name==='camera';$('detailsPanel').hidden=cameraPanel;$('cameraPanel').hidden=!cameraPanel;
  $('detailsTab').setAttribute('aria-selected',String(!cameraPanel));$('cameraTab').setAttribute('aria-selected',String(cameraPanel));
}
function chooseWorkspace(name){
  workspace=name;
  document.querySelectorAll('[data-workspace]').forEach(button=>{const active=button.dataset.workspace===name;button.classList.toggle('selected',active);button.setAttribute('aria-pressed',String(active));});
  tab(name==='movement'?'camera':'details');if(name==='movement')inspector(true);updateMode();
}
function updateMode(){
  $('modeBadge').textContent=live?'LIVE · ESTIMATED MOTION':workspace==='movement'?'CAMERA SETUP':'EXPLORE';$('modeBadge').classList.toggle('live',live);
  $('motionSource').textContent=live?'LIVE · ESTIMATED':'SYNTHETIC DEMO';
  $('clipSelect').disabled=live||!viewer?.clips;$('playButton').disabled=live||!viewer?.clips;$('timeline').disabled=live||!viewer?.clips;$('playbackSpeed').disabled=live;
  $('playButton').textContent=viewer?.playing?'Ⅱ':'▶';$('playButton').setAttribute('aria-label',viewer?.playing?'Pause demonstration':'Play demonstration');
}
function syncLayers(){
  if(!viewer)return;
  document.querySelectorAll('[data-layer]').forEach(button=>{const active=button.dataset.layer===viewer.layer;button.classList.toggle('selected',active);button.setAttribute('aria-pressed',String(active));});
  $('layerSlider').value=LAYERS.indexOf(viewer.layer);$('layerSlider').setAttribute('aria-valuetext',LAYER_NAMES[viewer.layer]);$('originalOnly').checked=viewer.originalOnly;
  $('stageTitle').replaceChildren(document.createTextNode(LAYER_NAMES[viewer.layer]+' '),make('span','•','subtle-dot'),make('span',`${viewer.parts.filter(p=>p.visible).length} structures`));
  $('coverageText').replaceChildren(document.createTextNode(viewer.originalOnly?'Original supplied anatomy.':'Bilateral teaching model.'),document.createElement('br'),document.createTextNode(viewer.originalOnly?'Predominantly right-sided.':'Left counterparts are mirrored.'));
}
function showPart(part){
  narration.stop();$('clearSelection').hidden=!part;$('selectionActions').hidden=!part;$('speakButton').disabled=!part;
  $('floatingLabel').hidden=!part;
  if(!part){selectedInfo=null;$('partTissue').textContent='START EXPLORING';$('partName').replaceChildren(document.createTextNode('Every movement'),document.createElement('br'),document.createTextNode('has a structure.'));$('partDescription').textContent='Select a bone or muscle on the model to see its name, role and teaching notes.';$('partFacts').replaceChildren();return;}
  selectedInfo=describe(part);$('partTissue').textContent=selectedInfo.tissue.toUpperCase()+' / '+selectedInfo.region.toUpperCase();$('partName').textContent=selectedInfo.name;
  $('partDescription').textContent=selectedInfo.description;$('floatingLabelText').textContent=selectedInfo.name;
  const facts=$('partFacts');facts.replaceChildren();
  for(const [title,value] of [['TEACHING NOTE',selectedInfo.note],['SOURCE',part.userData.source_glb],['INFORMATION LEVEL',selectedInfo.specificity]]){
    const block=document.createElement('div');block.append(make('dt',title),make('dd',value));facts.append(block);
  }
  facts.append(make('span',viewer.isMirrored(part)?'Mirrored teaching geometry':'Original source geometry','source-chip'));
  tab('details');if(!display)inspector(true);syncLayers();
}
function search(){
  const query=$('partSearch').value.trim().toLowerCase(),results=$('searchResults');results.replaceChildren();results.hidden=!query;if(!query||!viewer)return;
  const parts=viewer.parts.filter(part=>(!viewer.originalOnly||!viewer.isMirrored(part))&&displayName(part).toLowerCase().includes(query)).slice(0,25);
  for(const part of parts){const button=make('button',displayName(part));button.type='button';button.addEventListener('click',()=>{viewer.select(part,$('autoFocus').checked);results.hidden=true;$('partSearch').value='';});results.append(button);}
  if(!parts.length)results.append(make('p','No matching source structures.'));
}
function setLive(value){
  if(value && (!camera.active||!retargeter?.calibrated||performance.now()-lastPoseAt>1000)){toast('Start the camera and calibrate a visible neutral stance first.');return;}
  live=value;if(value){viewer.startLive();lastReliableAt=performance.now();}else viewer?.stopLive();
  $('startTracking').textContent=value?'Live anatomy running':'3. Start live anatomy';$('startTracking').disabled=value||!retargeter?.calibrated||!camera.active;
  $('stopTracking').disabled=!value;updateMode();
}
async function refreshDevices(){
  try{
    const devices=await camera.devices(),selected=$('cameraSelect').value;$('cameraSelect').replaceChildren(new Option('Default camera',''));
    for(const [index,device] of devices.entries())$('cameraSelect').add(new Option(device.label||`Camera ${index+1}`,device.deviceId));
    if([...$('cameraSelect').options].some(option=>option.value===selected))$('cameraSelect').value=selected;
  }catch{$('cameraMessage').textContent='Camera devices could not be listed. You can still try the default camera.';}
}
function updateCalibration(){
  const fresh=lastPose&&performance.now()-lastPoseAt<1000;
  const quality=fresh?poseMetrics(lastPose.worldLandmarks,$('mirrorInput').checked).quality:0;
  $('calibrateTracking').disabled=!viewer?.model||!camera.active||!pose.ready||quality<1;
  $('startTracking').disabled=live||!camera.active||!retargeter?.calibrated||!fresh;
}
function drawLandmarks(points){
  const video=$('cameraVideo'),canvas=$('landmarkCanvas');canvas.width=video.videoWidth||640;canvas.height=video.videoHeight||360;
  const context=canvas.getContext('2d');context.clearRect(0,0,canvas.width,canvas.height);context.strokeStyle='#f7cfda';context.lineWidth=3;context.fillStyle='#a11842';
  for(const [a,b] of CONNECTIONS){if(!points[a]||!points[b]||(points[a].visibility??1)<.55||(points[b].visibility??1)<.55)continue;context.beginPath();context.moveTo(points[a].x*canvas.width,points[a].y*canvas.height);context.lineTo(points[b].x*canvas.width,points[b].y*canvas.height);context.stroke();}
  for(const p of points){if((p.visibility??1)<.55)continue;context.beginPath();context.arc(p.x*canvas.width,p.y*canvas.height,4,0,Math.PI*2);context.fill();}
}
async function init(){
  if(window.innerWidth<=1000)inspector(false);
  try{
    viewer=new AnatomyViewer($('anatomyCanvas'),$('viewport'));
    viewer.addEventListener('progress',({detail})=>{$('loadProgress').value=detail;$('loadingText').textContent=detail?`Loading anatomical rig · ${detail}%`:'Loading the completed rig…';});
    viewer.addEventListener('visibility',syncLayers);viewer.addEventListener('selection',({detail})=>showPart(detail));
    viewer.addEventListener('failure',({detail})=>toast(detail));
    viewer.addEventListener('rotationchange',()=>{$('rotateToggle').setAttribute('aria-pressed',String(viewer.autoRotate));});
    let lastUI=0;
    viewer.addEventListener('frame',({detail})=>{
      const now=performance.now();
      if(live&&now-lastReliableAt>900){retargeter.easeToRest(detail.dt);$('modeBadge').textContent='TRACKING LOST · RETURNING TO REST';}
      if(now-lastUI>70){
        if(!live){$('timeline').value=Math.round(detail.time/detail.duration*1000);$('timeLabel').textContent=`${detail.time.toFixed(1)} / ${detail.duration.toFixed(1)} s`;}
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
    for(const clip of ordered)$('clipSelect').add(new Option(CLIP_NAMES[clip.name]||clip.name,clip.name));
    viewer.setClip($('clipSelect').value);syncLayers();updateMode();document.body.dataset.ready='true';
  }catch(error){
    console.error(error);$('loading').replaceChildren(make('h2','The 3D view could not load'),make('p',error.message));
    const button=make('button','Reload the atlas','outline-button');button.addEventListener('click',()=>location.reload());$('loading').append(button);
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
  if(selectedInfo&&narration.speak(`${selectedInfo.name}. ${selectedInfo.description} Teaching note. ${selectedInfo.note}`))$('speakButton').replaceChildren(make('span','■'),document.createTextNode(' Stop explanation'));
  else toast('No local narration voice is installed on this computer. Install a Windows speech voice to enable offline explanations.');
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
  if(display){previousInspectorHidden=document.body.classList.contains('inspector-hidden');inspector(false);try{await document.documentElement.requestFullscreen();}catch{toast('UHD layout enabled. Browser fullscreen is unavailable in this view.');}}
  else{inspector(!previousInspectorHidden);if(document.fullscreenElement)await document.exitFullscreen();}
  $('displayMode').replaceChildren(document.createTextNode(display?'Exit UHD ':'UHD display '),make('span','↗'));
});
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&display){display=false;document.body.classList.remove('display-mode');if(viewer){viewer.uhd=false;viewer.resize();}inspector(!previousInspectorHidden);$('displayMode').replaceChildren(document.createTextNode('UHD display '),make('span','↗'));}});

$('startCamera').addEventListener('click',async()=>{
  $('startCamera').disabled=true;$('cameraMessage').textContent='Requesting camera access…';
  try{await camera.start($('cameraSelect').value);}catch(error){$('cameraMessage').textContent=cameraError(error);toast(cameraError(error));}
  finally{$('startCamera').disabled=camera.active;}
});
$('stopCamera').addEventListener('click',()=>camera.stop());
$('cameraSelect').addEventListener('change',()=>{if(camera.active){camera.stop();toast('Camera changed. Choose Start camera to open the selected device.');}});
camera.addEventListener('started',async({detail})=>{
  $('cameraPlaceholder').hidden=true;$('stopCamera').disabled=false;$('startCamera').disabled=true;$('cameraStatus').textContent='Camera on';$('cameraStatus').classList.add('on');
  $('cameraMessage').textContent=`Local preview · ${detail.width||'—'} × ${detail.height||'—'}. No recording or upload.`;
  await refreshDevices();if(detail.deviceId)$('cameraSelect').value=detail.deviceId;
  if(pose.ready)pose.start();updateCalibration();
});
camera.addEventListener('stopped',()=>{
  if(live)setLive(false);pose.pause();retargeter?.invalidate();lastPose=null;lastPoseAt=0;
  $('cameraPlaceholder').hidden=false;$('stopCamera').disabled=true;$('startCamera').disabled=false;$('cameraStatus').textContent='Camera off';$('cameraStatus').classList.remove('on');
  $('cameraMessage').textContent='Camera stopped. Video tracks have been released.';$('landmarkCanvas').getContext('2d').clearRect(0,0,$('landmarkCanvas').width,$('landmarkCanvas').height);
  for(const id of ['poseQuality','inferenceTime','elbowAngle','kneeAngle'])$(id).textContent='—';updateCalibration();
});
$('prepareTracking').addEventListener('click',async()=>{
  $('prepareTracking').disabled=true;$('prepareTracking').textContent='Preparing local tracking…';
  try{await pose.prepare();$('prepareTracking').textContent='1. Pose tracking ready';if(camera.active)pose.start();else toast('Pose tracking is ready. Start the camera to calibrate.');updateCalibration();}
  catch(error){$('prepareTracking').textContent='1. Retry pose tracking';$('prepareTracking').disabled=false;toast(error.message);}
});
pose.addEventListener('pose',({detail})=>{
  if(!camera.active)return;lastPose=detail;lastPoseAt=performance.now();drawLandmarks(detail.landmarks);
  const metrics=poseMetrics(detail.worldLandmarks,$('mirrorInput').checked);
  $('poseQuality').textContent=metrics.quality===1?'Full body':`${Math.round(metrics.quality*100)}% visible`;
  $('inferenceTime').textContent=`${Math.round(detail.elapsed)} ms`;
  $('elbowAngle').textContent=metrics.elbowFlexion===null?'—':`${Math.round(metrics.elbowFlexion)}° flex`;
  $('kneeAngle').textContent=metrics.kneeFlexion===null?'—':`${Math.round(metrics.kneeFlexion)}° flex`;
  if(live&&metrics.quality>=.5){retargeter.apply(detail.worldLandmarks,$('mirrorInput').checked,Math.min(.2,(lastPoseAt-lastApplyAt)/1000||.08));lastApplyAt=lastPoseAt;lastReliableAt=lastPoseAt;updateMode();}
  updateCalibration();
});
pose.addEventListener('failure',({detail})=>{if(live)setLive(false);pose.dispose();retargeter?.invalidate();$('prepareTracking').disabled=false;$('prepareTracking').textContent='1. Retry pose tracking';$('cameraMessage').textContent='Tracking paused: '+detail;updateCalibration();toast('Tracking could not continue. Camera preview remains local.');});
$('calibrateTracking').addEventListener('click',()=>{
  if(!lastPose||performance.now()-lastPoseAt>1000){toast('A fresh full-body pose is needed.');return;}
  try{if(live)setLive(false);retargeter.calibrate(lastPose.worldLandmarks,$('mirrorInput').checked);$('calibrateTracking').textContent='2. Neutral stance calibrated';$('cameraMessage').textContent='Neutral stance captured. Start live anatomy to drive the rig with your movement.';updateCalibration();}
  catch(error){toast(error.message);}
});
$('startTracking').addEventListener('click',()=>setLive(true));$('stopTracking').addEventListener('click',()=>setLive(false));
function mirror(){
  $('cameraPreview').classList.toggle('mirrored',$('mirrorInput').checked);
  if(live)setLive(false);retargeter?.invalidate();$('calibrateTracking').textContent='2. Calibrate neutral stance';updateCalibration();
}
$('mirrorInput').addEventListener('change',mirror);mirror();
$('smoothing').addEventListener('input',event=>{if(retargeter)retargeter.smoothing=Number(event.target.value);});
window.addEventListener('pagehide',()=>{narration.stop();camera.stop();pose.dispose();viewer?.dispose();});
navigator.mediaDevices?.addEventListener('devicechange',()=>refreshDevices());
document.addEventListener('keydown',event=>{if(event.key==='Escape'){viewer?.select(null);$('searchResults').hidden=true;}});
init();
