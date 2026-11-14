import * as THREE from '../../vendor/three/three.module.js';
import { OrbitControls } from '../../vendor/three/OrbitControls.js';
import { GLTFLoader } from '../../vendor/three/GLTFLoader.js';

export class AnatomyViewer extends EventTarget {
  constructor(canvas,container) {
    super();this.canvas=canvas;this.container=container;this.parts=[];this.bones=new Map();this.rest=new Map();
    this.layer='combined';this.originalOnly=false;this.playing=false;this.speed=1;this.autoRotate=false;this.selected=null;this.live=false;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#ffffff');
    this.camera=new THREE.OrthographicCamera(-1,1,1,-1,.01,100);this.camera.position.set(0,.88,4);
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.75));this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.05;
    this.scene.add(new THREE.HemisphereLight(0xffffff,0x9b8a82,2.05));
    for(const [color,power,pos] of [[0xffffff,2.5,[-2,3,4]],[0xffffff,1.35,[3,1,2]],[0xfff8f4,1.8,[0,3,-3]]]){
      const light=new THREE.DirectionalLight(color,power);light.position.set(...pos);this.scene.add(light);
    }
    this.controls=new OrbitControls(this.camera,canvas);this.controls.target.set(0,.85,0);this.controls.enableDamping=true;this.controls.dampingFactor=.08;
    this.controls.minZoom=.3;this.controls.maxZoom=12;this.controls.enablePan=true;this.controls.autoRotateSpeed=.6;
    this.controls.addEventListener('start',()=>{this.tween=null;});
    this.raycaster=new THREE.Raycaster();this.pointer=new THREE.Vector2();this.clock=new THREE.Clock();
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);
    let down;
    canvas.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY];});
    canvas.addEventListener('pointerup',e=>{if(down && Math.hypot(e.clientX-down[0],e.clientY-down[1])<5)this.pick(e);down=null;});
    this.resize();this.animate();
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();this.dispatchEvent(new CustomEvent('failure',{detail:'The graphics context was lost. Reload the page to reconnect the 3D display.'}));});
  }
  async load() {
    const failed=[],manager=new THREE.LoadingManager();manager.onError=url=>failed.push(url);
    const loader=new GLTFLoader(manager);
    const gltf=await loader.loadAsync('./assets/INNOVA-Musculoskeletal-Rig.glb',event=>{
      this.dispatchEvent(new CustomEvent('progress',{detail:event.total?Math.round(event.loaded/event.total*100):0}));
    });
    if(failed.length)throw new Error('Some anatomical textures could not load. Reload the atlas to restore the complete model.');
    this.model=gltf.scene;this.scene.add(this.model);this.model.updateMatrixWorld(true);
    this.model.traverse(object=>{
      if(object.isBone){
        const name=object.userData.name || object.name;this.bones.set(name,object);
        this.rest.set(name,{position:object.position.clone(),quaternion:object.quaternion.clone(),scale:object.scale.clone(),world:object.getWorldQuaternion(new THREE.Quaternion())});
      }
      if(object.isMesh && ['bones','muscles'].includes(object.userData.tissue)){
        object.frustumCulled=false;
        object.material=Array.isArray(object.material)?object.material.map(m=>m.clone()):object.material.clone();
        for(const material of this.materials(object)){
          material.metalness=0;material.roughness=.67;material.transparent=false;material.opacity=1;
          material.userData.originalEmissive=material.emissive.clone();
        }
        object.userData.originalAnatomyName=object.userData.anatomy_name;
        this.parts.push(object);
      }
    });
    this.mixer=new THREE.AnimationMixer(this.model);this.clips=gltf.animations;
    this.fullBounds=this.computeBounds(this.parts);this.frameBounds=this.fullBounds.clone();this.fit(false);
    this.dispatchEvent(new CustomEvent('loaded',{detail:{parts:this.parts,clips:this.clips,bones:this.bones}}));
    return this;
  }
  materials(mesh){return Array.isArray(mesh.material)?mesh.material:[mesh.material];}
  computeBounds(parts){
    const box=new THREE.Box3();
    for(const mesh of parts){if(mesh.isSkinnedMesh){mesh.computeBoundingBox();box.union(mesh.boundingBox.clone().applyMatrix4(mesh.matrixWorld));}else box.expandByObject(mesh);}
    return box;
  }
  resize(){
    const {width,height}=this.container.getBoundingClientRect();if(width<2||height<2)return;
    this.width=width;this.height=height;this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,this.uhd?2:1.75));this.renderer.setSize(width,height,false);
    this.updateFrustum();
  }
  updateFrustum(){
    if(!this.width||!this.height)return;
    const size=(this.frameBounds || new THREE.Box3(new THREE.Vector3(-.4,0,-.2),new THREE.Vector3(.4,1.75,.2))).getSize(new THREE.Vector3());
    const aspect=this.width/this.height;
    const height=Math.max(size.y*1.11,Math.hypot(size.x,size.z)*1.13/aspect);
    this.camera.left=-height*aspect/2;this.camera.right=height*aspect/2;this.camera.top=height/2;this.camera.bottom=-height/2;this.camera.updateProjectionMatrix();
  }
  fit(smooth=true){
    if(!this.fullBounds)return;
    this.frameBounds=this.fullBounds.clone();this.updateFrustum();
    this.moveCamera(this.fullBounds.getCenter(new THREE.Vector3()),1,smooth);
  }
  moveCamera(target,zoom,smooth=true){
    const offset=this.camera.position.clone().sub(this.controls.target);
    if(!smooth){this.controls.target.copy(target);this.camera.position.copy(target).add(offset);this.camera.zoom=zoom;this.camera.updateProjectionMatrix();this.controls.update();return;}
    this.tween={start:performance.now(),duration:650,fromTarget:this.controls.target.clone(),toTarget:target.clone(),fromPosition:this.camera.position.clone(),toPosition:target.clone().add(offset),fromZoom:this.camera.zoom,toZoom:zoom};
  }
  setView(view){
    if(view==='fit'){this.fit();return;}
    this.tween=null;this.controls.autoRotate=false;this.autoRotate=false;
    const target=this.controls.target, d=4;
    this.camera.position.copy(target).add(view==='side'?new THREE.Vector3(d,0,0):view==='back'?new THREE.Vector3(0,0,-d):new THREE.Vector3(0,0,d));
    this.camera.up.set(0,1,0);this.controls.update();this.dispatchEvent(new Event('rotationchange'));
  }
  setLayer(layer,originalOnly=this.originalOnly){
    this.layer=layer;this.originalOnly=originalOnly;
    for(const part of this.parts)part.visible=(layer==='combined'||part.userData.tissue===layer)&&(!originalOnly||!this.isMirrored(part));
    if(this.selected&&!this.selected.visible)this.select(null);
    this.dispatchEvent(new CustomEvent('visibility',{detail:this.parts.filter(p=>p.visible).length}));
  }
  isMirrored(part){return String(part.userData.provenance).startsWith('mirrored');}
  select(part,focus=false){
    if(this.selected)for(const material of this.materials(this.selected))material.emissive.copy(material.userData.originalEmissive);
    this.selected=part;
    if(part){
      if(!part.visible){this.setLayer('combined',this.isMirrored(part)?false:this.originalOnly);}
      for(const material of this.materials(part))material.emissive.setRGB(.23,.012,.035);
      if(focus)this.focus(part);
    }
    this.dispatchEvent(new CustomEvent('selection',{detail:part}));
  }
  focus(part=this.selected){
    if(!part)return;this.model.updateMatrixWorld(true);
    const box=this.computeBounds([part]),size=box.getSize(new THREE.Vector3());
    const aspect=this.width/this.height;
    const wanted=Math.max(size.y*1.8,size.x*1.8/aspect,.23);
    const fullHeight=this.camera.top-this.camera.bottom;
    this.moveCamera(box.getCenter(new THREE.Vector3()),Math.min(7,Math.max(1.2,fullHeight/wanted)));
  }
  pick(event){
    if(!this.model)return;
    const rect=this.canvas.getBoundingClientRect();this.pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
    this.raycaster.setFromCamera(this.pointer,this.camera);
    const visible=this.parts.filter(p=>p.visible);
    for(const part of visible)if(part.isSkinnedMesh)part.computeBoundingSphere();
    const hit=this.raycaster.intersectObjects(visible,false)[0];
    if(hit)this.select(hit.object,document.querySelector('#autoFocus').checked);else this.select(null);
  }
  resetPose(){
    this.mixer?.stopAllAction();
    for(const [name,bone] of this.bones){const rest=this.rest.get(name);bone.position.copy(rest.position);bone.quaternion.copy(rest.quaternion);bone.scale.copy(rest.scale);}
    this.model?.updateMatrixWorld(true);
  }
  setClip(name){
    this.live=false;this.playing=false;this.resetPose();
    const clip=this.clips.find(c=>c.name===name);if(!clip)return;
    this.currentClip=clip;this.action=this.mixer.clipAction(clip);this.action.reset().play();this.action.paused=true;this.mixer.update(0);
    // Fit neutral + peak movement so wide poses stay inside a portrait viewport.
    const bounds=this.fullBounds.clone();
    this.action.time=clip.duration/2;this.mixer.update(0);this.model.updateMatrixWorld(true);bounds.union(this.computeBounds(this.parts));
    this.action.time=0;this.mixer.update(0);this.model.updateMatrixWorld(true);
    this.frameBounds=bounds;this.updateFrustum();this.moveCamera(bounds.getCenter(new THREE.Vector3()),1);
  }
  setPlaying(value){if(this.live)return;this.playing=value;if(this.action)this.action.paused=!value;}
  seek(ratio){if(this.action&&!this.live){this.action.time=ratio*this.currentClip.duration;this.mixer.update(0);}}
  startLive(){this.playing=false;this.live=true;this.resetPose();this.frameBounds=this.fullBounds.clone().expandByScalar(.12);this.updateFrustum();this.moveCamera(this.fullBounds.getCenter(new THREE.Vector3()),.85);}
  stopLive(){this.live=false;this.resetPose();if(this.currentClip)this.setClip(this.currentClip.name);}
  animate=()=>{
    this.frame=requestAnimationFrame(this.animate);const dt=Math.min(this.clock.getDelta(),.05);
    if(this.mixer&&!this.live)this.mixer.update(dt*this.speed);
    if(this.tween){
      const t=Math.min(1,(performance.now()-this.tween.start)/this.tween.duration),s=t*t*(3-2*t),v=this.tween;
      this.controls.target.lerpVectors(v.fromTarget,v.toTarget,s);this.camera.position.lerpVectors(v.fromPosition,v.toPosition,s);
      this.camera.zoom=THREE.MathUtils.lerp(v.fromZoom,v.toZoom,s);this.camera.updateProjectionMatrix();if(t===1)this.tween=null;
    }
    this.controls.autoRotate=this.autoRotate&&!this.live;this.controls.update();this.renderer.render(this.scene,this.camera);
    this.dispatchEvent(new CustomEvent('frame',{detail:{time:this.action?.time||0,duration:this.currentClip?.duration||2,dt}}));
  };
  selectedScreenPoint(){
    if(!this.selected)return null;
    // Labels follow the skin in its current pose; a sampled vertex avoids a full bounding-box pass per frame.
    const point=new THREE.Vector3();const geo=this.selected.geometry;
    this.selected.getVertexPosition(Math.floor(geo.attributes.position.count/2),point);point.applyMatrix4(this.selected.matrixWorld).project(this.camera);
    return {x:(point.x*.5+.5)*this.width,y:(-point.y*.5+.5)*this.height,visible:point.z>-1&&point.z<1&&Math.abs(point.x)<1.1&&Math.abs(point.y)<1.1};
  }
  dispose(){cancelAnimationFrame(this.frame);this.resizeObserver.disconnect();this.controls.dispose();this.renderer.dispose();}
}
