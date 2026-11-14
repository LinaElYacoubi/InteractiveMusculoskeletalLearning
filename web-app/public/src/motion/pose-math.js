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
