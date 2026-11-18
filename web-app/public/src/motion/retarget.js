import {Quaternion,Vector3} from '../../vendor/three/three.module.js';
import {segmentDirections,poseMetrics} from './pose-math.js';

const ORDER=['spine.upper','upper_arm.R','forearm.R','upper_arm.L','forearm.L','thigh.R','shin.R','thigh.L','shin.L'];
export class PoseRetargeter {
  constructor(viewer){this.viewer=viewer;this.offsets=new Map();this.smoothing=.15;this.lastGood=0;this.calibrated=false;}
  // Default: full-body calibration (Movement lab). A guided activity may pass a subset of segments
  // (e.g. one arm); only calibrated segments are driven by apply().
  calibrate(points,mirror,segments=ORDER){
    const metrics=poseMetrics(points,mirror),directions=segmentDirections(points,mirror),fullBody=segments===ORDER;
    if((fullBody&&metrics.quality<1) || segments.some(name=>!directions[name]))throw new Error(fullBody?'Keep shoulders, hips, elbows, wrists, knees and ankles visible for calibration. Stand still with your arms relaxed.':'Keep the tracked shoulder, elbow and wrist visible for calibration.');
    this.viewer.resetPose();this.offsets.clear();
    for(const name of segments){
      const rest=this.viewer.rest.get(name);if(!rest)continue;
      const restDirection=new Vector3(0,1,0).applyQuaternion(rest.world).normalize();
      this.offsets.set(name,new Quaternion().setFromUnitVectors(new Vector3(...directions[name]),restDirection));
    }
    this.calibrated=true;this.lastGood=performance.now();return metrics;
  }
  invalidate(){this.calibrated=false;this.offsets.clear();}
  apply(points,mirror,dt=.08){
    if(!this.calibrated)return;
    const directions=segmentDirections(points,mirror),alpha=1-Math.exp(-dt/this.smoothing);
    if(Object.keys(directions).length)this.lastGood=performance.now();
    for(const name of ORDER){
      const bone=this.viewer.bones.get(name),rest=this.viewer.rest.get(name),input=directions[name],offset=this.offsets.get(name);if(!bone||!rest||!input||!offset)continue;
      const desiredDirection=new Vector3(...input).applyQuaternion(offset).normalize();
      const restDirection=new Vector3(0,1,0).applyQuaternion(rest.world).normalize();
      const world=new Quaternion().setFromUnitVectors(restDirection,desiredDirection).multiply(rest.world.clone().normalize());
      const parentWorld=bone.parent.getWorldQuaternion(new Quaternion()).normalize();
      const local=parentWorld.invert().multiply(world).normalize();
      bone.quaternion.slerp(local,alpha);bone.updateMatrixWorld(true);
    }
  }
  easeToRest(dt){
    const alpha=1-Math.exp(-dt/.45);
    for(const name of ORDER){const bone=this.viewer.bones.get(name);bone?.quaternion.slerp(this.viewer.rest.get(name).quaternion,alpha);}
    this.viewer.model?.updateMatrixWorld(true);
  }
}
