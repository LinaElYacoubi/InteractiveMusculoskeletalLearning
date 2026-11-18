// Information bank text for selected structures, in English and Canadian French.
// Each record: [pattern on the English source name, {en:[group, region, description, note], fr:[...]}].
// The French is a translation of the existing English entries; it has not yet been reviewed.
const records=[
  [/biceps brachii/,{en:['Biceps brachii','Upper arm','Helps bend the elbow and turn the forearm so the palm faces upward. Its two heads begin at the scapula and join toward the radius.','Compare elbow flexion with the forearm turned palm-up and palm-down.'],
    fr:['Biceps brachial','Bras','Aide à fléchir le coude et à tourner l’avant-bras pour que la paume soit vers le haut. Ses deux chefs naissent de la scapula et se rejoignent vers le radius.','Comparez la flexion du coude avec l’avant-bras paume vers le haut et paume vers le bas.']}],
  [/triceps brachii/,{en:['Triceps brachii','Upper arm','The main elbow extensor. Its three heads join toward the olecranon of the ulna; the long head also crosses the shoulder.','Observe the back of the upper arm as the elbow straightens.'],
    fr:['Triceps brachial','Bras','Le principal extenseur du coude. Ses trois chefs se rejoignent vers l’olécrâne de l’ulna; le chef long croise aussi l’épaule.','Observez l’arrière du bras quand le coude se tend.']}],
  [/deltoid/,{en:['Deltoid','Shoulder','A shoulder muscle with anterior, middle and posterior regions. These regions contribute differently to raising the arm forward, sideways and backward.','Compare arm elevation in different planes. This rig uses simplified shoulder mechanics.'],
    fr:['Deltoïde','Épaule','Un muscle de l’épaule avec des parties antérieure, moyenne et postérieure. Ces parties contribuent différemment à lever le bras vers l’avant, sur le côté et vers l’arrière.','Comparez l’élévation du bras dans différents plans. Ce modèle simplifie la mécanique de l’épaule.']}],
  [/pectoralis major/,{en:['Pectoralis major','Chest and shoulder','Helps bring the upper arm toward the body, move it across the chest and rotate it inward. Different fibre regions contribute to different movements.','Observe how a broad chest muscle connects to the moving upper arm.'],
    fr:['Grand pectoral','Poitrine et épaule','Aide à rapprocher le bras du corps, à le déplacer devant la poitrine et à le tourner vers l’intérieur. Différentes régions de fibres contribuent à différents mouvements.','Observez comment un large muscle de la poitrine se rattache au bras en mouvement.']}],
  [/trapezius/,{en:['Trapezius','Upper back and neck','Contributes to positioning and rotating the scapula. Its upper, middle and lower regions support different scapular movements.','Shoulder elevation involves the shoulder girdle as well as the upper arm.'],
    fr:['Trapèze','Haut du dos et cou','Contribue à positionner et à faire pivoter la scapula. Ses parties supérieure, moyenne et inférieure soutiennent différents mouvements de la scapula.','L’élévation de l’épaule fait intervenir la ceinture scapulaire autant que le bras.']}],
  [/latissimus/,{en:['Latissimus dorsi','Back and shoulder','Helps extend, adduct and internally rotate the upper arm. It connects a broad area of the trunk to the humerus.','Compare the trunk attachment with the upper-arm attachment.'],
    fr:['Grand dorsal','Dos et épaule','Aide à étendre le bras, à le rapprocher du corps et à le tourner vers l’intérieur. Il relie une grande partie du tronc à l’humérus.','Comparez l’attache sur le tronc et l’attache sur le bras.']}],
  [/supraspinatus|infraspinatus|subscapularis|teres minor/,{en:['Rotator cuff','Shoulder','This muscle belongs to the rotator cuff. The group helps control shoulder rotation and contributes to stabilizing the humeral head at the shoulder.','Use the bone layer to locate the humeral head and scapula. The cuff muscles have different actions.'],
    fr:['Coiffe des rotateurs','Épaule','Ce muscle fait partie de la coiffe des rotateurs. Ce groupe aide à contrôler la rotation de l’épaule et contribue à stabiliser la tête de l’humérus dans l’épaule.','Utilisez la couche des os pour repérer la tête de l’humérus et la scapula. Les muscles de la coiffe ont des actions différentes.']}],
  [/brachialis/,{en:['Brachialis','Upper arm','An elbow flexor that runs from the humerus to the ulna. It lies largely deep to biceps brachii.','Compare a muscle that crosses the elbow with the rigid upper-arm and forearm bones.'],
    fr:['Muscle brachial','Bras','Un fléchisseur du coude qui va de l’humérus à l’ulna. Il se trouve en grande partie sous le biceps brachial.','Comparez un muscle qui croise le coude avec les os rigides du bras et de l’avant-bras.']}],
  [/brachioradialis/,{en:['Brachioradialis','Forearm','Contributes to elbow flexion, especially when the forearm is near its neutral position between palm-up and palm-down.','Its muscle belly is in the forearm even though it acts at the elbow.'],
    fr:['Muscle brachio-radial','Avant-bras','Contribue à la flexion du coude, surtout quand l’avant-bras est près de sa position neutre, entre paume vers le haut et paume vers le bas.','Son corps musculaire se trouve dans l’avant-bras, même s’il agit sur le coude.']}],
  [/rectus femoris|vastus/,{en:['Quadriceps group','Front of thigh','This muscle belongs to the quadriceps group, which extends the knee. Rectus femoris also crosses the hip; the vastus muscles do not.','Compare a muscle crossing one joint with rectus femoris crossing two.'],
    fr:['Groupe du quadriceps','Avant de la cuisse','Ce muscle fait partie du quadriceps, qui étend le genou. Le droit fémoral croise aussi la hanche; les vastes, non.','Comparez un muscle qui croise une articulation avec le droit fémoral, qui en croise deux.']}],
  [/biceps femoris|semitendinosus|semimembranosus/,{en:['Hamstring group','Back of thigh','This muscle belongs to the hamstring region and contributes to knee flexion. Most hamstrings also cross the hip; the short head of biceps femoris does not.','Follow the proximal and distal attachments while bending the knee.'],
    fr:['Groupe des ischio-jambiers','Arrière de la cuisse','Ce muscle fait partie de la région des ischio-jambiers et contribue à la flexion du genou. La plupart des ischio-jambiers croisent aussi la hanche; le chef court du biceps fémoral, non.','Suivez les attaches proximales et distales en pliant le genou.']}],
  [/gastrocnemius/,{en:['Gastrocnemius','Calf','Crosses both the knee and ankle. It contributes to ankle plantarflexion and can assist knee flexion.','Compare this two-joint calf muscle with soleus.'],
    fr:['Gastrocnémien','Mollet','Croise le genou et la cheville. Il contribue à la flexion plantaire de la cheville et peut aider à la flexion du genou.','Comparez ce muscle du mollet qui croise deux articulations avec le soléaire.']}],
  [/soleus/,{en:['Soleus','Calf','A deep calf muscle contributing to ankle plantarflexion. Unlike gastrocnemius, it does not cross the knee.','Compare ankle function with the knee straight and bent.'],
    fr:['Soléaire','Mollet','Un muscle profond du mollet qui contribue à la flexion plantaire de la cheville. Contrairement au gastrocnémien, il ne croise pas le genou.','Comparez la fonction de la cheville avec le genou tendu et le genou plié.']}],
  [/tibialis anterior/,{en:['Tibialis anterior','Front of lower leg','Contributes to ankle dorsiflexion and foot inversion. Its tendon passes across the front of the ankle.','Observe its path from the leg toward the medial foot.'],
    fr:['Tibial antérieur','Avant de la jambe','Contribue à la flexion dorsale de la cheville et à l’inversion du pied. Son tendon passe devant la cheville.','Observez son trajet de la jambe vers le côté médial du pied.']}],
  [/gluteus maximus/,{en:['Gluteus maximus','Hip','Contributes strongly to hip extension and external rotation. Its contribution depends on hip position and the task being performed.','Consider the hip movement involved in rising from a chair.'],
    fr:['Grand fessier','Hanche','Contribue fortement à l’extension et à la rotation externe de la hanche. Sa contribution dépend de la position de la hanche et de la tâche effectuée.','Pensez au mouvement de la hanche nécessaire pour se lever d’une chaise.']}],
  [/gluteus medius|gluteus minimus/,{en:['Lateral gluteal muscles','Hip','These muscles contribute to hip abduction and pelvic control during single-leg support. Different fibre regions have different rotational roles.','Discuss how the pelvis is supported when the opposite foot leaves the ground.'],
    fr:['Muscles fessiers latéraux','Hanche','Ces muscles contribuent à l’abduction de la hanche et au contrôle du bassin en appui sur une jambe. Leurs différentes régions de fibres ont des rôles de rotation différents.','Discutez de la façon dont le bassin est soutenu quand le pied opposé quitte le sol.']}],
  [/psoas|iliacus/,{en:['Iliopsoas region','Trunk and hip','Iliacus and psoas major contribute to hip flexion. Psoas minor is a separate, variable muscle and does not share the same femoral insertion.','Identify which structures cross from the trunk or pelvis toward the thigh.'],
    fr:['Région de l’iliopsoas','Tronc et hanche','L’iliaque et le grand psoas contribuent à la flexion de la hanche. Le petit psoas est un muscle distinct et variable qui n’a pas la même insertion sur le fémur.','Repérez les structures qui passent du tronc ou du bassin vers la cuisse.']}],
  [/adductor (?!hallucis)|gracilis|pectineus/,{en:['Medial thigh muscles','Thigh','These muscles contribute to bringing the thigh toward the midline. Their additional actions depend on the individual muscle and joint position.','Follow each selected muscle rather than assuming the whole region has one action.'],
    fr:['Muscles médiaux de la cuisse','Cuisse','Ces muscles contribuent à rapprocher la cuisse de la ligne médiane. Leurs autres actions dépendent du muscle et de la position de l’articulation.','Suivez chaque muscle sélectionné plutôt que de supposer que toute la région a une seule action.']}],
  [/humerus/,{en:['Humerus','Upper arm','The long bone of the upper arm. It meets the scapula at the shoulder and the radius and ulna at the elbow.','This rig keeps the bone rigid while surrounding muscles deform.'],
    fr:['Humérus','Bras','L’os long du bras. Il s’articule avec la scapula à l’épaule, et avec le radius et l’ulna au coude.','Ce modèle garde l’os rigide pendant que les muscles autour se déforment.']}],
  [/femur/,{en:['Femur','Thigh','The long bone of the thigh. Its head meets the pelvis at the hip, and its distal end contributes to the knee joint.','Locate the hip and knee pivots before playing the movement demonstration.'],
    fr:['Fémur','Cuisse','L’os long de la cuisse. Sa tête s’articule avec le bassin à la hanche, et son extrémité distale participe à l’articulation du genou.','Repérez les pivots de la hanche et du genou avant de lancer la démonstration du mouvement.']}],
  [/scapula/,{en:['Scapula','Shoulder girdle','The shoulder blade provides the glenoid socket for the humerus and attachment sites for many shoulder muscles.','Arm elevation normally includes scapular movement; this prototype simplifies that coordination.'],
    fr:['Scapula','Ceinture scapulaire','L’omoplate fournit la cavité glénoïdale pour l’humérus et des zones d’attache pour de nombreux muscles de l’épaule.','L’élévation du bras comprend normalement un mouvement de la scapula; ce prototype simplifie cette coordination.']}],
  [/clavicle/,{en:['Clavicle','Shoulder girdle','Connects the shoulder girdle to the trunk through its articulations with the sternum and scapula.','The rig has a clavicle control separate from the upper-arm control.'],
    fr:['Clavicule','Ceinture scapulaire','Relie la ceinture scapulaire au tronc par ses articulations avec le sternum et la scapula.','Le modèle a une commande pour la clavicule, distincte de celle du bras.']}],
  [/radius/,{en:['Radius','Forearm','One of the two forearm bones, on the thumb side in anatomical position. Its movement relative to the ulna contributes to forearm rotation.','Separate radius-ulna pronation and supination are not simulated by this initial rig.'],
    fr:['Radius','Avant-bras','Un des deux os de l’avant-bras, du côté du pouce en position anatomique. Son mouvement par rapport à l’ulna contribue à la rotation de l’avant-bras.','La pronation et la supination entre le radius et l’ulna ne sont pas simulées séparément dans ce premier modèle.']}],
  [/ulna/,{en:['Ulna','Forearm','One of the two forearm bones. Its proximal region forms a major part of the elbow joint with the humerus.','Locate the olecranon near the back of the elbow.'],
    fr:['Ulna','Avant-bras','Un des deux os de l’avant-bras. Sa région proximale forme une grande partie de l’articulation du coude avec l’humérus.','Repérez l’olécrâne près de l’arrière du coude.']}],
  [/tibia/,{en:['Tibia','Lower leg','The larger, medial bone of the lower leg. It participates in the knee and ankle joints.','Compare its size and position with the fibula.'],
    fr:['Tibia','Jambe','L’os le plus gros et le plus médial de la jambe. Il participe aux articulations du genou et de la cheville.','Comparez sa taille et sa position avec celles de la fibula.']}],
  [/fibula/,{en:['Fibula','Lower leg','The slender lateral bone of the lower leg. Its distal end forms the lateral malleolus at the ankle.','The fibula is not the main weight-bearing bone of the lower leg.'],
    fr:['Fibula','Jambe','L’os mince et latéral de la jambe. Son extrémité distale forme la malléole latérale à la cheville.','La fibula n’est pas le principal os porteur de la jambe.']}],
  [/patella/,{en:['Patella','Knee','A sesamoid bone within the quadriceps tendon that articulates with the femur and contributes to the knee extension mechanism.','This rig keeps it rigid but does not simulate physiological patellar tracking.'],
    fr:['Patella','Genou','Un os sésamoïde situé dans le tendon du quadriceps, qui s’articule avec le fémur et contribue au mécanisme d’extension du genou.','Ce modèle la garde rigide, mais ne simule pas son glissement physiologique.']}],
  [/hip bone|sacrum|coccyx/,{en:['Pelvic region','Pelvis','This selected bone belongs to the pelvic region, which supports the trunk and connects it to the lower limbs.','Use the source name to distinguish the hip bone, sacrum and coccyx.'],
    fr:['Région du bassin','Bassin','Cet os fait partie de la région du bassin, qui soutient le tronc et le relie aux membres inférieurs.','Utilisez le nom source pour distinguer l’os coxal, le sacrum et le coccyx.']}],
  [/vertebra|atlas \(|axis \(/,{en:['Vertebral column','Spine','This structure belongs to the vertebral column. Vertebrae support the trunk, protect the spinal cord and participate in movement between spinal segments.','The teaching rig groups vertebrae into a simplified body chain.'],
    fr:['Colonne vertébrale','Colonne','Cette structure fait partie de la colonne vertébrale. Les vertèbres soutiennent le tronc, protègent la moelle épinière et participent au mouvement entre les segments de la colonne.','Le modèle pédagogique regroupe les vertèbres en une chaîne simplifiée.']}],
  [/rib |sternum|xiphoid/,{en:['Thoracic skeleton','Thorax','This structure belongs to the bony thorax, which protects thoracic organs and provides muscle attachments.','Breathing-related rib and sternum movement is not animated in this prototype.'],
    fr:['Squelette thoracique','Thorax','Cette structure fait partie du thorax osseux, qui protège les organes thoraciques et fournit des zones d’attache aux muscles.','Le mouvement des côtes et du sternum lié à la respiration n’est pas animé dans ce prototype.']}],
];

const TEXT={
  en:{right:'Right',left:'Left',bone:'Bone',muscle:'Muscle',
    groupSpecificity:'General group context; source part name retained',sourceGroup:'Source anatomy',
    regions:{'hand.glb':'Hand','lower-limb.glb':'Lower limb','upper-limb.glb':'Upper limb and trunk',other:'Skeleton'},
    boneText:'A named bony structure from the supplied anatomy. Its geometry remains rigid as its assigned segment moves.',
    muscleText:'A named muscle structure from the supplied anatomy. The rig uses skin weights to carry its shape across moving segments.',
    pendingNote:'A dedicated, reviewed anatomical description has not yet been added for this individual part. Its original source name is preserved.',
    pendingSpecificity:'Source identification; detailed entry pending review'},
  fr:{right:'droit',left:'gauche',bone:'Os',muscle:'Muscle',
    groupSpecificity:'Contexte général du groupe; nom source de la partie conservé',sourceGroup:'Anatomie source',
    regions:{'hand.glb':'Main','lower-limb.glb':'Membre inférieur','upper-limb.glb':'Membre supérieur et tronc',other:'Squelette'},
    boneText:'Une structure osseuse nommée de l’anatomie fournie. Sa géométrie reste rigide quand son segment se déplace.',
    muscleText:'Une structure musculaire nommée de l’anatomie fournie. Le modèle utilise des pondérations d’enveloppe pour que sa forme suive les segments en mouvement.',
    pendingNote:'Aucune description anatomique dédiée et révisée n’a encore été ajoutée pour cette partie. Son nom source original est conservé.',
    pendingSpecificity:'Identification source; fiche détaillée en attente de révision'},
};
const text=lang=>TEXT[lang]||TEXT.en;

// Structure names stay in the model's source (English/Latin) names; only the side label is translated.
function sourceName(part){
  return (part.userData.anatomy_name || part.userData.name || part.name).replace(/\| mirrored left/i,'').replace(/\.([rl])\.?$/i,'').replaceAll('_',' ').trim();
}
export function displayName(part,lang='en'){
  const side=part.userData.anatomical_side,words=text(lang);
  return sourceName(part)+(side==='R'?` · ${words.right}`:side==='L'?` · ${words.left}`:'');
}
export function describe(part,lang='en'){
  const words=text(lang),name=displayName(part,lang),key=sourceName(part).toLowerCase();
  const record=records.find(([regex])=>regex.test(key));
  const tissue=part.userData.tissue==='bones'?words.bone:words.muscle;
  if(record){const [group,region,description,note]=record[1][lang]||record[1].en;return {name,tissue,group,region,description,note,specificity:words.groupSpecificity};}
  return {name,tissue,group:words.sourceGroup,region:words.regions[part.userData.source_glb]||words.regions.other,
    description:part.userData.tissue==='bones'?words.boneText:words.muscleText,note:words.pendingNote,specificity:words.pendingSpecificity};
}
export const KNOWLEDGE_RECORDS=records;
