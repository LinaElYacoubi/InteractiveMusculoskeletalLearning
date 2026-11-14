import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Object3D,Bone,Vector3,Quaternion} from '../public/vendor/three/three.module.js';
import {PoseRetargeter} from '../public/src/motion/retarget.js';

test('actual GLB rest hierarchy retargets neutral and flexed elbow poses without axis drift',async()=>{
  const file=await readFile(new URL('../public/assets/INNOVA-Musculoskeletal-Rig.glb',import.meta.url));
  const data=JSON.parse(file.toString('utf8',20,20+file.readUInt32LE(12))),joints=new Set(data.skins[0].joints);
  const objects=data.nodes.map((node,index)=>{
    const object=joints.has(index)?new Bone():new Object3D();object.name=node.name||String(index);
    if(node.translation)object.position.fromArray(node.translation);if(node.rotation)object.quaternion.fromArray(node.rotation);if(node.scale)object.scale.fromArray(node.scale);return object;
  });
  data.nodes.forEach((node,index)=>{for(const child of node.children||[])objects[index].add(objects[child]);});
  const model=new Object3D();for(const index of data.scenes[data.scene||0].nodes)model.add(objects[index]);model.updateMatrixWorld(true);
  const bones=new Map(),rest=new Map();
  for(const index of joints){const bone=objects[index];bones.set(bone.name,bone);rest.set(bone.name,{position:bone.position.clone(),quaternion:bone.quaternion.clone(),scale:bone.scale.clone(),world:bone.getWorldQuaternion(new Quaternion())});}
  const viewer={bones,rest,model,resetPose(){for(const [name,bone] of bones){bone.quaternion.copy(rest.get(name).quaternion);}model.updateMatrixWorld(true);}};
  const input=Array.from({length:33},()=>({x:0,y:0,z:0,visibility:1,presence:1}));
  for(const [index,name] of [[11,'upper_arm.L'],[12,'upper_arm.R'],[13,'forearm.L'],[14,'forearm.R'],[15,'hand.L'],[16,'hand.R'],[23,'thigh.L'],[24,'thigh.R'],[25,'shin.L'],[26,'shin.R'],[27,'foot.L'],[28,'foot.R']]){
    const world=bones.get(name).getWorldPosition(new Vector3());input[index]={x:world.x,y:-world.y,z:-world.z,visibility:1,presence:1};
  }
  const rig=new PoseRetargeter(viewer);rig.calibrate(input,false);rig.apply(input,false,10);
  for(const [name,bone] of bones)assert.ok(bone.quaternion.clone().normalize().angleTo(rest.get(name).quaternion.clone().normalize())<1e-5,`${name} drifted in neutral pose`);
  const elbow=bones.get('forearm.R').getWorldPosition(new Vector3()),wrist=bones.get('hand.R').getWorldPosition(new Vector3());
  const relative=wrist.clone().sub(elbow).applyAxisAngle(new Vector3(1,0,0),Math.PI/2),newWrist=elbow.clone().add(relative);
  input[16]={x:newWrist.x,y:-newWrist.y,z:-newWrist.z,visibility:1,presence:1};rig.apply(input,false,10);
  const actualDirection=new Vector3(0,1,0).applyQuaternion(bones.get('forearm.R').getWorldQuaternion(new Quaternion()));
  assert.ok(actualDirection.angleTo(relative.normalize())<1e-4,'World-space forearm direction must match the flexed input');
});
