import test from 'node:test';
import assert from 'node:assert/strict';
import {landmark,direction,jointAngle,segmentDirections,poseMetrics} from '../public/src/motion/pose-math.js';
import {PoseRetargeter} from '../public/src/motion/retarget.js';
import {Bone,Object3D,Vector3,Quaternion} from '../public/vendor/three/three.module.js';

const p=(x,y,z=0,visibility=1)=>({x,y,z,visibility,presence:1});
function fixture(){
  const a=Array.from({length:33},()=>p(0,0));
  a[11]=p(.2,-.6);a[12]=p(-.2,-.6);a[13]=p(.25,-.3);a[14]=p(-.25,-.3);a[15]=p(.3,0);a[16]=p(-.3,0);
  a[23]=p(.12,0);a[24]=p(-.12,0);a[25]=p(.13,.4);a[26]=p(-.13,.4);a[27]=p(.13,.8);a[28]=p(-.13,.8);return a;
}
test('joint angles distinguish straight limbs from 90 degree flexion',()=>{
  assert.equal(jointAngle([0,1,0],[0,0,0],[0,-1,0]),180);
  assert.equal(jointAngle([0,1,0],[0,0,0],[1,0,0]),90);
  assert.equal(jointAngle([0,0,0],[0,0,0],[1,0,0]),null);
});
test('mirroring swaps anatomical sides and reflects only the horizontal coordinate',()=>{
  const a=fixture();a[11]=p(.25,-.7,.2);a[12]=p(-.15,-.6,.1);
  assert.deepEqual(landmark(a,12,true),[-.25,.7,-.2]);
  assert.deepEqual(landmark(a,12,false),[-.15,.6,-.1]);
});
test('missing and low-confidence landmarks cannot drive a rig segment',()=>{
  const a=fixture();a[16].visibility=.1;
  const d=segmentDirections(a);
  assert.ok(d['upper_arm.R']);assert.equal(d['forearm.R'],undefined);
  assert.equal(poseMetrics(a).elbowFlexion,null);
  assert.ok(poseMetrics(a).quality<1);
  assert.equal(direction([0,0,0],[.001,0,0]),null);
});
test('neutral calibration leaves a model at rest; changed limb direction rotates its bone',()=>{
  const model=new Object3D(),bones=new Map(),rest=new Map();
  for(const name of ['spine.upper','upper_arm.R','forearm.R','upper_arm.L','forearm.L','thigh.R','shin.R','thigh.L','shin.L']){
    const bone=new Bone();model.add(bone);bones.set(name,bone);rest.set(name,{world:new Quaternion(),quaternion:new Quaternion()});
  }
  const viewer={bones,rest,model,resetPose(){for(const bone of bones.values())bone.quaternion.identity();model.updateMatrixWorld(true);}};
  const rig=new PoseRetargeter(viewer),pose=fixture();rig.calibrate(pose,false);rig.apply(pose,false,10);
  assert.ok(bones.get('forearm.R').quaternion.angleTo(new Quaternion())<1e-6);
  pose[16]=p(-.55,-.3);rig.apply(pose,false,10);
  assert.ok(bones.get('forearm.R').quaternion.angleTo(new Quaternion())>.8);
  rig.invalidate();assert.equal(rig.calibrated,false);
});
