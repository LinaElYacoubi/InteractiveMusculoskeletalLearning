export const CONNECTIONS=[[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28],[27,29],[29,31],[28,30],[30,32]];
const SWAP={11:12,12:11,13:14,14:13,15:16,16:15,23:24,24:23,25:26,26:25,27:28,28:27,29:30,30:29,31:32,32:31};
export function reliable(point,threshold=.55){return Boolean(point&&Number.isFinite(point.x)&&Number.isFinite(point.y)&&Number.isFinite(point.z)&&(point.visibility??1)>=threshold&&(point.presence??1)>=threshold);}
export function landmark(points,index,mirror=false){
  const point=points?.[mirror?(SWAP[index]??index):index];
  if(!reliable(point))return null;
  return [mirror?-point.x:point.x,-point.y,-point.z];
}
export function direction(a,b){
  if(!a||!b)return null;
  const d=b.map((v,i)=>v-a[i]),length=Math.hypot(...d);
  return length>.015?d.map(v=>v/length):null;
}
export function midpoint(a,b){return a&&b?a.map((v,i)=>(v+b[i])/2):null;}
export function jointAngle(a,b,c){
  const first=direction(b,a),second=direction(b,c);if(!first||!second)return null;
  return Math.acos(Math.max(-1,Math.min(1,first.reduce((sum,v,i)=>sum+v*second[i],0))))*180/Math.PI;
}
export function segmentDirections(points,mirror=false){
  const get=i=>landmark(points,i,mirror),result={};
  for(const [bone,a,b] of [['upper_arm.R',12,14],['forearm.R',14,16],['upper_arm.L',11,13],['forearm.L',13,15],['thigh.R',24,26],['shin.R',26,28],['thigh.L',23,25],['shin.L',25,27]]){
    const d=direction(get(a),get(b));if(d)result[bone]=d;
  }
  const torso=direction(midpoint(get(23),get(24)),midpoint(get(11),get(12)));if(torso)result['spine.upper']=torso;
  return result;
}
export function poseMetrics(points,mirror=false){
  const get=i=>landmark(points,i,mirror);
  const ids=[11,12,13,14,15,16,23,24,25,26,27,28];
  const reliableCount=ids.filter(i=>get(i)).length;
  const elbow=jointAngle(get(12),get(14),get(16)),knee=jointAngle(get(24),get(26),get(28));
  return {quality:reliableCount/ids.length,elbowFlexion:elbow===null?null:180-elbow,kneeFlexion:knee===null?null:180-knee};
}

// ---- Full-body constants shared by the upgraded tracker ----------------------------------------
/** Mirror partner for every MediaPipe pose landmark (face, hands and feet included). */
export const SWAP33 = [0, 4, 5, 6, 1, 2, 3, 8, 7, 10, 9, 12, 11, 14, 13, 16, 15, 18, 17, 20, 19, 22, 21, 24, 23, 26, 25, 28, 27, 30, 29, 32, 31];
/** Calibrated segment lengths, keyed by name: [parent landmark, child landmark]. */
export const BONE_PAIRS = {
  shoulders: [12, 11], hips: [24, 23], torsoL: [23, 11], torsoR: [24, 12],
  upperArmL: [11, 13], forearmL: [13, 15], upperArmR: [12, 14], forearmR: [14, 16],
  thighL: [23, 25], shinL: [25, 27], thighR: [24, 26], shinR: [26, 28],
  heelL: [27, 29], footL: [29, 31], heelR: [28, 30], footR: [30, 32],
};
export const FULL_CONNECTIONS = [...CONNECTIONS, [15, 17], [15, 19], [15, 21], [17, 19], [16, 18], [16, 20], [16, 22], [18, 20], [27, 31], [28, 32], [0, 2], [0, 5], [2, 7], [5, 8], [9, 10]];
export const HAND_CONNECTIONS = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]];

/** What a calibration frame can see. Shoulders are required; arms, knees and feet are optional and inferred when hidden. */
export function calibrationReadiness(points, mirror = false) {
  const get = i => landmark(points, i, mirror);
  const shoulders = Boolean(get(11) && get(12));
  const arms = [13, 14, 15, 16].every(i => get(i));
  const knees = Boolean(get(25) && get(26));
  const ankles = Boolean(get(27) && get(28));
  return {ready: shoulders, shoulders, arms, knees, ankles};
}
