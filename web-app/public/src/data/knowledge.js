const records=[
  [/biceps brachii/,'Biceps brachii','Upper arm','Helps bend the elbow and turn the forearm so the palm faces upward. Its two heads begin at the scapula and join toward the radius.','Compare elbow flexion with the forearm turned palm-up and palm-down.'],
  [/triceps brachii/,'Triceps brachii','Upper arm','The main elbow extensor. Its three heads join toward the olecranon of the ulna; the long head also crosses the shoulder.','Observe the back of the upper arm as the elbow straightens.'],
  [/deltoid/,'Deltoid','Shoulder','A shoulder muscle with anterior, middle and posterior regions. These regions contribute differently to raising the arm forward, sideways and backward.','Compare arm elevation in different planes. This rig uses simplified shoulder mechanics.'],
  [/pectoralis major/,'Pectoralis major','Chest and shoulder','Helps bring the upper arm toward the body, move it across the chest and rotate it inward. Different fibre regions contribute to different movements.','Observe how a broad chest muscle connects to the moving upper arm.'],
  [/trapezius/,'Trapezius','Upper back and neck','Contributes to positioning and rotating the scapula. Its upper, middle and lower regions support different scapular movements.','Shoulder elevation involves the shoulder girdle as well as the upper arm.'],
  [/latissimus/,'Latissimus dorsi','Back and shoulder','Helps extend, adduct and internally rotate the upper arm. It connects a broad area of the trunk to the humerus.','Compare the trunk attachment with the upper-arm attachment.'],
  [/supraspinatus|infraspinatus|subscapularis|teres minor/,'Rotator cuff','Shoulder','This muscle belongs to the rotator cuff. The group helps control shoulder rotation and contributes to stabilizing the humeral head at the shoulder.','Use the bone layer to locate the humeral head and scapula. The cuff muscles have different actions.'],
  [/\bbrachialis/,'Brachialis','Upper arm','An elbow flexor that runs from the humerus to the ulna. It lies largely deep to biceps brachii.','Compare a muscle that crosses the elbow with the rigid upper-arm and forearm bones.'],
  [/brachioradialis/,'Brachioradialis','Forearm','Contributes to elbow flexion, especially when the forearm is near its neutral position between palm-up and palm-down.','Its muscle belly is in the forearm even though it acts at the elbow.'],
  [/rectus femoris|vastus/,'Quadriceps group','Front of thigh','This muscle belongs to the quadriceps group, which extends the knee. Rectus femoris also crosses the hip; the vastus muscles do not.','Compare a muscle crossing one joint with rectus femoris crossing two.'],
  [/biceps femoris|semitendinosus|semimembranosus/,'Hamstring group','Back of thigh','This muscle belongs to the hamstring region and contributes to knee flexion. Most hamstrings also cross the hip; the short head of biceps femoris does not.','Follow the proximal and distal attachments while bending the knee.'],
  [/gastrocnemius/,'Gastrocnemius','Calf','Crosses both the knee and ankle. It contributes to ankle plantarflexion and can assist knee flexion.','Compare this two-joint calf muscle with soleus.'],
  [/soleus/,'Soleus','Calf','A deep calf muscle contributing to ankle plantarflexion. Unlike gastrocnemius, it does not cross the knee.','Compare ankle function with the knee straight and bent.'],
  [/tibialis anterior/,'Tibialis anterior','Front of lower leg','Contributes to ankle dorsiflexion and foot inversion. Its tendon passes across the front of the ankle.','Observe its path from the leg toward the medial foot.'],
  [/gluteus maximus/,'Gluteus maximus','Hip','Contributes strongly to hip extension and external rotation. Its contribution depends on hip position and the task being performed.','Consider the hip movement involved in rising from a chair.'],
  [/gluteus medius|gluteus minimus/,'Lateral gluteal muscles','Hip','These muscles contribute to hip abduction and pelvic control during single-leg support. Different fibre regions have different rotational roles.','Discuss how the pelvis is supported when the opposite foot leaves the ground.'],
  [/psoas|iliacus/,'Iliopsoas region','Trunk and hip','Iliacus and psoas major contribute to hip flexion. Psoas minor is a separate, variable muscle and does not share the same femoral insertion.','Identify which structures cross from the trunk or pelvis toward the thigh.'],
  [/adductor (?!hallucis)|gracilis|pectineus/,'Medial thigh muscles','Thigh','These muscles contribute to bringing the thigh toward the midline. Their additional actions depend on the individual muscle and joint position.','Follow each selected muscle rather than assuming the whole region has one action.'],
  [/humerus/,'Humerus','Upper arm','The long bone of the upper arm. It meets the scapula at the shoulder and the radius and ulna at the elbow.','This rig keeps the bone rigid while surrounding muscles deform.'],
  [/femur/,'Femur','Thigh','The long bone of the thigh. Its head meets the pelvis at the hip, and its distal end contributes to the knee joint.','Locate the hip and knee pivots before playing the movement demonstration.'],
  [/scapula/,'Scapula','Shoulder girdle','The shoulder blade provides the glenoid socket for the humerus and attachment sites for many shoulder muscles.','Arm elevation normally includes scapular movement; this prototype simplifies that coordination.'],
  [/clavicle/,'Clavicle','Shoulder girdle','Connects the shoulder girdle to the trunk through its articulations with the sternum and scapula.','The rig has a clavicle control separate from the upper-arm control.'],
  [/radius/,'Radius','Forearm','One of the two forearm bones, on the thumb side in anatomical position. Its movement relative to the ulna contributes to forearm rotation.','Separate radius-ulna pronation and supination are not simulated by this initial rig.'],
  [/ulna/,'Ulna','Forearm','One of the two forearm bones. Its proximal region forms a major part of the elbow joint with the humerus.','Locate the olecranon near the back of the elbow.'],
  [/tibia/,'Tibia','Lower leg','The larger, medial bone of the lower leg. It participates in the knee and ankle joints.','Compare its size and position with the fibula.'],
  [/fibula/,'Fibula','Lower leg','The slender lateral bone of the lower leg. Its distal end forms the lateral malleolus at the ankle.','The fibula is not the main weight-bearing bone of the lower leg.'],
  [/patella/,'Patella','Knee','A sesamoid bone within the quadriceps tendon that articulates with the femur and contributes to the knee extension mechanism.','This rig keeps it rigid but does not simulate physiological patellar tracking.'],
  [/hip bone|sacrum|coccyx/,'Pelvic region','Pelvis','This selected bone belongs to the pelvic region, which supports the trunk and connects it to the lower limbs.','Use the source name to distinguish the hip bone, sacrum and coccyx.'],
  [/vertebra|atlas \(|axis \(/,'Vertebral column','Spine','This structure belongs to the vertebral column. Vertebrae support the trunk, protect the spinal cord and participate in movement between spinal segments.','The teaching rig groups vertebrae into a simplified body chain.'],
  [/rib |sternum|xiphoid/,'Thoracic skeleton','Thorax','This structure belongs to the bony thorax, which protects thoracic organs and provides muscle attachments.','Breathing-related rib and sternum movement is not animated in this prototype.'],
];

export function displayName(part){
  let name=part.userData.anatomy_name || part.userData.name || part.name;
  name=name.replace(/\| mirrored left/i,'').replace(/\.([rl])\.?$/i,'').replaceAll('_',' ').trim();
  const side=part.userData.anatomical_side;
  return name+(side==='R'?' · Right':side==='L'?' · Left':'');
}
export function describe(part){
  const name=displayName(part);const record=records.find(([regex])=>regex.test(name.toLowerCase()));
  const tissue=part.userData.tissue==='bones'?'Bone':'Muscle';
  if(record)return {name,tissue,group:record[1],region:record[2],description:record[3],note:record[4],specificity:'General group context; source part name retained'};
  return {name,tissue,group:'Source anatomy',region:part.userData.source_glb==='hand.glb'?'Hand':part.userData.source_glb==='lower-limb.glb'?'Lower limb':part.userData.source_glb==='upper-limb.glb'?'Upper limb and trunk':'Skeleton',
    description:tissue==='Bone'?'A named bony structure from the supplied anatomy. Its geometry remains rigid as its assigned segment moves.':'A named muscle structure from the supplied anatomy. The rig uses skin weights to carry its shape across moving segments.',
    note:'A dedicated, reviewed anatomical description has not yet been added for this individual part. Its original source name is preserved.',specificity:'Source identification; detailed entry pending review'};
}
