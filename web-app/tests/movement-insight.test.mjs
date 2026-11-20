import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Object3D,Bone,Vector3,Quaternion} from '../public/vendor/three/three.module.js';
import {JOINTS,MovementTracker,measureJoint,limbPlane,partsForMovements} from '../public/src/motion/movement-insight.js';

async function loadRig(){
  const file=await readFile(new URL('../public/assets/INNOVA-Musculoskeletal-Rig.glb',import.meta.url));
  const data=JSON.parse(file.toString('utf8',20,20+file.readUInt32LE(12))),joints=new Set(data.skins[0].joints);
  const objects=data.nodes.map((node,index)=>{
    const object=joints.has(index)?new Bone():new Object3D();object.name=node.name||String(index);object.userData={...(node.extras||{})};
    if(node.translation)object.position.fromArray(node.translation);if(node.rotation)object.quaternion.fromArray(node.rotation);if(node.scale)object.scale.fromArray(node.scale);return object;
  });
  data.nodes.forEach((node,index)=>{for(const child of node.children||[])objects[index].add(objects[child]);});
  const model=new Object3D();for(const index of data.scenes[data.scene||0].nodes)model.add(objects[index]);model.updateMatrixWorld(true);
  const bones=new Map();for(const index of joints)bones.set(objects[index].name,objects[index]);
  const parts=data.nodes.map((node,index)=>node.mesh!==undefined&&['bones','muscles'].includes(node.extras?.tissue)?objects[index]:null).filter(Boolean);
  return {model,bones,parts};
}
const nameOf=part=>String(part.userData.anatomy_name||part.name).replace(/\| mirrored left/i,'').replace(/\.([rl])\.?$/i,'').toLowerCase();

// Steps the tracker through a bone rotation and returns what it reports at the end.
function animate(tracker,rig,boneName,axis,totalRadians,seconds=.6,fps=60){
  const bone=rig.bones.get(boneName),step=new Quaternion().setFromAxisAngle(axis,totalRadians/(seconds*fps));let now=1000,result=[];
  tracker.update(rig.bones,1/fps,now);
  for(let i=0;i<seconds*fps;i++){bone.quaternion.multiply(step);rig.model.updateMatrixWorld(true);now+=1000/fps;result=tracker.update(rig.bones,1/fps,now);}
  return {result,now};
}

test('every joint the tracker measures exists in the rig, and the rest pose is close to neutral',async()=>{
  const rig=await loadRig();
  for(const joint of JOINTS){
    const m=measureJoint(joint,rig.bones);assert.ok(m,`${joint.id} could not be measured`);
    if(joint.kind!=='ball')assert.ok(m.angle<40,`${joint.id} rest angle ${m.angle.toFixed(1)} should be near straight`);
  }
});

test('a still rig reports no movement',async()=>{
  const rig=await loadRig(),tracker=new MovementTracker();let now=0,result;
  for(let i=0;i<60;i++){now+=16;result=tracker.update(rig.bones,1/60,now);}
  assert.deepEqual(result,[]);
});

test('bending the right elbow is reported as right elbow flexion with the elbow flexors and arm bones',async()=>{
  const rig=await loadRig(),tracker=new MovementTracker();
  const {result}=animate(tracker,rig,'forearm.R',new Vector3(1,0,0),Math.PI/2);
  assert.equal(result[0]?.id,'elbow.R');assert.equal(result[0].movement,'Elbow flexion');
  assert.ok(!result.some(r=>r.side==='L'),'left side must not light up');
  const labels=result[0].muscles.map(m=>m.label);
  assert.ok(labels.includes('Biceps brachii')&&labels.includes('Brachialis'));
  const highlighted=partsForMovements([result[0]],rig.parts,nameOf),names=[...highlighted].map(([part,kind])=>`${kind}:${nameOf(part)}:${part.userData.anatomical_side}`);
  for(const expected of ['bone:humerus:R','bone:radius:R','bone:ulna:R','muscle:brachialis muscle:R','muscle:long head of biceps brachii:R','muscle:short head of biceps brachii:R','muscle:brachioradialis muscle:R'])
    assert.ok(names.includes(expected),`${expected} should be highlighted; got ${names.join(', ')}`);
  assert.ok(!names.some(n=>n.includes('coracobrachialis')),'coracobrachialis is a shoulder muscle and must not match brachialis');
  assert.ok(names.every(n=>n.endsWith(':R')));
});

test('straightening is reported as extension, and highlighting clears after the movement stops',async()=>{
  const rig=await loadRig(),tracker=new MovementTracker({hold:500});
  animate(tracker,rig,'forearm.R',new Vector3(1,0,0),Math.PI/2);
  const {result,now}=animate(tracker,rig,'forearm.R',new Vector3(1,0,0),-Math.PI/2);
  assert.equal(result[0]?.movement,'Elbow extension');
  assert.ok(result[0].muscles.some(m=>m.label==='Triceps brachii'));
  let later=now,after;for(let i=0;i<60;i++){later+=16;after=tracker.update(rig.bones,1/60,later);}
  assert.deepEqual(after,[]);
});

test('an instant pose jump, such as a clip restarting, is not reported as movement',async()=>{
  const rig=await loadRig(),tracker=new MovementTracker();let now=0;
  tracker.update(rig.bones,1/60,now);
  rig.bones.get('shin.R').quaternion.multiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),1.4));rig.model.updateMatrixWorld(true);
  let result=[];for(let i=0;i<10;i++){now+=16;result=tracker.update(rig.bones,1/60,now);}
  assert.deepEqual(result,[]);
});

test('every listed muscle and bone matches at least one part of the model on each side',async()=>{
  const rig=await loadRig();
  for(const joint of JOINTS)for(const entry of [...joint.bones,...Object.values(joint.moves).flatMap(m=>m.muscles)]){
    const found=rig.parts.some(part=>(!joint.side||part.userData.anatomical_side===joint.side)&&entry.match.test(nameOf(part)));
    assert.ok(found,`${entry.label} has no matching part for ${joint.id}`);
  }
});

test('limb plane uses anatomical sides: right is toward -X, anterior is +Z',()=>{
  assert.equal(limbPlane(new Vector3(0,0,1),'R'),'forward');
  assert.equal(limbPlane(new Vector3(-1,0,0),'R'),'sideways');
  assert.equal(limbPlane(new Vector3(1,0,0),'L'),'sideways');
  assert.equal(limbPlane(new Vector3(0,0,-1),'L'),'backward');
});
