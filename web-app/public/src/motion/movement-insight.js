import {Quaternion,Vector3} from '../../vendor/three/three.module.js';

// Teaching associations between a joint movement and the structures involved.
// Muscle lists are the main movers textbooks associate with each movement direction.
// They are NOT measured activity: lowering against gravity is often controlled by the opposite group.
const M={
  biceps:{label:'Biceps brachii',match:/biceps brachii/},
  brachialis:{label:'Brachialis',match:/\bbrachialis/},
  brachioradialis:{label:'Brachioradialis',match:/brachioradialis/},
  triceps:{label:'Triceps brachii',match:/triceps brachii/},
  anconeus:{label:'Anconeus',match:/anconeus/},
  deltoid:{label:'Deltoid',match:/deltoid/},
  supraspinatus:{label:'Supraspinatus',match:/supraspinatus/},
  pecMajor:{label:'Pectoralis major',match:/pectoralis major/},
  coracobrachialis:{label:'Coracobrachialis',match:/coracobrachialis/},
  latissimus:{label:'Latissimus dorsi',match:/latissimus/},
  teresMajor:{label:'Teres major',match:/teres major/},
  trapezius:{label:'Trapezius',match:/trapezius/},
  serratus:{label:'Serratus anterior',match:/serratus anterior/},
  iliopsoas:{label:'Iliopsoas (iliacus, psoas major)',match:/iliacus|psoas major/},
  rectusFemoris:{label:'Rectus femoris',match:/rectus femoris/},
  vasti:{label:'Vastus lateralis, medialis, intermedius',match:/vastus/},
  sartorius:{label:'Sartorius',match:/sartorius/},
  pectineus:{label:'Pectineus',match:/pectineus/},
  gluteusMax:{label:'Gluteus maximus',match:/gluteus maximus/},
  gluteusMedMin:{label:'Gluteus medius & minimus',match:/gluteus medius|gluteus minimus/},
  adductors:{label:'Adductor longus, brevis, magnus',match:/adductor (longus|brevis|magnus)/},
  gracilis:{label:'Gracilis',match:/gracilis/},
  hamstrings:{label:'Hamstrings (biceps femoris, semitendinosus, semimembranosus)',match:/biceps femoris|semitendinosus|semimembranosus/},
  gastrocnemius:{label:'Gastrocnemius',match:/gastrocnemius/},
  popliteus:{label:'Popliteus',match:/popliteus/},
};
const B={
  humerus:{label:'Humerus',match:/humerus/},radius:{label:'Radius',match:/^radius/},ulna:{label:'Ulna',match:/^ulna/},
  scapula:{label:'Scapula',match:/scapula/},clavicle:{label:'Clavicle',match:/clavicle/},
  hipBone:{label:'Hip bone',match:/hip bone/},femur:{label:'Femur',match:/femur/},tibia:{label:'Tibia',match:/tibia(?!lis)/},patella:{label:'Patella',match:/patella/},
  lumbar:{label:'Lumbar vertebrae',match:/lumbar vertebra/},thoracic:{label:'Thoracic vertebrae',match:/thoracic vertebra/},sacrum:{label:'Sacrum',match:/sacrum/},
};

const SHOULDER_MOVES={
  flexion:{name:'Shoulder flexion',muscles:[M.deltoid,M.pecMajor,M.coracobrachialis,M.biceps]},
  extension:{name:'Shoulder extension',muscles:[M.latissimus,M.teresMajor,M.deltoid,M.triceps]},
  abduction:{name:'Shoulder abduction',muscles:[M.deltoid,M.supraspinatus,M.trapezius,M.serratus]},
  adduction:{name:'Shoulder adduction',muscles:[M.pecMajor,M.latissimus,M.teresMajor]},
};
const HIP_MOVES={
  flexion:{name:'Hip flexion',muscles:[M.iliopsoas,M.rectusFemoris,M.sartorius,M.pectineus]},
  extension:{name:'Hip extension',muscles:[M.gluteusMax,M.hamstrings]},
  abduction:{name:'Hip abduction',muscles:[M.gluteusMedMin]},
  adduction:{name:'Hip adduction',muscles:[M.adductors,M.gracilis,M.pectineus]},
};
// Raising the limb in a plane, and lowering it back from that plane.
const RAISE={forward:'flexion',sideways:'abduction',backward:'extension'};
const LOWER={forward:'extension',sideways:'adduction',backward:'flexion'};

function side(def,s){return {...def,side:s,id:`${def.id}.${s}`,label:`${s==='R'?'Right':'Left'} ${def.label}`,parent:def.parent&&`${def.parent}.${s}`,child:`${def.child}.${s}`};}
const ELBOW={id:'elbow',label:'elbow',kind:'hinge',parent:'upper_arm',child:'forearm',bones:[B.humerus,B.radius,B.ulna],
  moves:{increase:{name:'Elbow flexion',verb:'Bending',muscles:[M.biceps,M.brachialis,M.brachioradialis]},decrease:{name:'Elbow extension',verb:'Straightening',muscles:[M.triceps,M.anconeus]}}};
const KNEE={id:'knee',label:'knee',kind:'hinge',parent:'thigh',child:'shin',bones:[B.femur,B.tibia,B.patella],
  moves:{increase:{name:'Knee flexion',verb:'Bending',muscles:[M.hamstrings,M.gastrocnemius,M.popliteus]},decrease:{name:'Knee extension',verb:'Straightening',muscles:[M.rectusFemoris,M.vasti]}}};
const SHOULDER={id:'shoulder',label:'shoulder',kind:'ball',child:'upper_arm',bones:[B.humerus,B.scapula,B.clavicle],moves:SHOULDER_MOVES};
const HIP={id:'hip',label:'hip',kind:'ball',child:'thigh',bones:[B.hipBone,B.femur],moves:HIP_MOVES};
export const JOINTS=[
  ...['R','L'].flatMap(s=>[side(SHOULDER,s),side(ELBOW,s),side(HIP,s),side(KNEE,s)]),
  {id:'trunk',label:'Trunk',side:null,kind:'trunk',child:'spine.upper',bones:[B.lumbar,B.thoracic,B.sacrum],
    moves:{increase:{name:'Trunk lean',verb:'Leaning',muscles:[]},decrease:{name:'Trunk returning upright',verb:'Returning upright',muscles:[]}},
    gap:'Abdominal and back muscles are not in this model yet.'},
];

const DOWN=new Vector3(0,-1,0),UP=new Vector3(0,1,0);
const q=new Quaternion(),modelInverse=new Quaternion();
// A bone's long axis (local +Y) expressed in model space: +Y up, anterior +Z, anatomical right toward -X.
function axis(bone){return new Vector3(0,1,0).applyQuaternion(bone.getWorldQuaternion(q)).applyQuaternion(modelInverse).normalize();}
const degrees=(a,b)=>a.angleTo(b)*180/Math.PI;

// Classifies the plane of a limb raised away from the body.
export function limbPlane(direction,limbSide){
  const forward=direction.z,backward=-direction.z,sideways=limbSide==='R'?-direction.x:direction.x;
  return forward>=sideways&&forward>=backward?'forward':sideways>=backward?'sideways':'backward';
}

// Returns {angle, plane} for a joint, or null when its bones are missing.
export function measureJoint(joint,bones){
  const child=bones.get(joint.child);if(!child)return null;
  const d=axis(child);
  if(joint.kind==='hinge'){const parent=bones.get(joint.parent);return parent?{angle:degrees(axis(parent),d),plane:null}:null;}
  if(joint.kind==='trunk')return {angle:degrees(d,UP),plane:null};
  return {angle:degrees(d,DOWN),plane:limbPlane(d,joint.side)};
}

export class MovementTracker {
  constructor({threshold=28,hold=700,smoothing=.12,maxRate=1500}={}){this.threshold=threshold;this.hold=hold;this.smoothing=smoothing;this.maxRate=maxRate;this.state=new Map();}
  reset(){this.state.clear();}
  // dt in seconds, now in milliseconds. Returns the joints currently moving, fastest first.
  update(bones,dt,now,modelQuaternion){
    modelInverse.copy(modelQuaternion||new Quaternion()).invert();
    const active=[];
    for(const joint of JOINTS){
      const m=measureJoint(joint,bones);if(!m)continue;
      let s=this.state.get(joint.id);
      if(!s){s={angle:m.angle,velocity:0,activeUntil:0,direction:null,plane:m.plane};this.state.set(joint.id,s);continue;}
      if(dt>0){
        const raw=(m.angle-s.angle)/dt,alpha=1-Math.exp(-dt/this.smoothing);
        // A jump faster than any human joint (a clip restarting, a pose reset) is not a movement.
        if(Math.abs(raw)>this.maxRate){s.velocity=0;s.activeUntil=0;}
        else s.velocity+=(raw-s.velocity)*alpha;
      }
      s.angle=m.angle;
      if(Math.abs(s.velocity)>=this.threshold){
        s.activeUntil=now+this.hold;s.direction=s.velocity>0?'increase':'decrease';
        // Only re-classify the plane while the limb is clearly away from the side of the body.
        if(m.plane&&m.angle>20)s.plane=m.plane;
      }
      if(now<s.activeUntil&&s.direction)active.push(describeMovement(joint,s));
    }
    return active.sort((a,b)=>Math.abs(b.velocity)-Math.abs(a.velocity));
  }
}

export function describeMovement(joint,s){
  let move,verb;
  if(joint.kind==='ball'){
    const plane=s.plane||'sideways',type=(s.direction==='increase'?RAISE:LOWER)[plane];
    move=joint.moves[type];
    verb=s.direction==='increase'?`Raising ${plane==='backward'?'backward':plane==='forward'?'forward':'sideways'}`:'Lowering';
  }else{move=joint.moves[s.direction];verb=move.verb;}
  return {id:joint.id,joint,side:joint.side,label:joint.label,movement:move.name,verb,angle:s.angle,velocity:s.velocity,
    muscles:move.muscles,bones:joint.bones,gap:joint.gap||null,key:`${joint.id}:${move.name}`};
}

// Finds the model meshes for a list of movements. nameOf(part) returns a lower-case display name.
export function partsForMovements(movements,parts,nameOf){
  const result=new Map();
  for(const movement of movements){
    for(const part of parts){
      const partSide=part.userData.anatomical_side;
      if(movement.side&&partSide!==movement.side)continue;
      const name=nameOf(part);
      const tissue=part.userData.tissue;
      const list=tissue==='muscles'?movement.muscles:tissue==='bones'?movement.bones:[];
      if(list.some(entry=>entry.match.test(name)))result.set(part,tissue==='muscles'?'muscle':'bone');
    }
  }
  return result;
}
