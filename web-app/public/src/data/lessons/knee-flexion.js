// Editable educational content for the guided knee lesson (standing knee curl, right leg).
//
// DRAFT — every educational claim, instruction and highlight rule below is awaiting
// review by the project's Kinesiology expert. Nothing here has been approved.
//
// Editing rules: the same as data/lessons/elbow-flexion.js.
// - Every visitor-facing string is an {en, fr} pair. Both languages are required.
// - Every educational claim lists the ids of the sources that support it (see `sources`).
// - Highlight rules name meshes by their exact `anatomy_name` metadata in
//   assets/INNOVA-Musculoskeletal-Rig.glb. Missing names are reported, never substituted.
// - When a claim is reviewed, change its `status` and record the reviewer in `review`.
// - Run `.\runtime\node.exe --test tests/*.test.mjs` after editing.
import {REVIEW} from './elbow-flexion.js';

const OPENSTAX = {publisher:'OpenStax', work:'Anatomy and Physiology 2e', authors:'Betts JG, Young KA, Wise JA, Johnson E, Poe B, Kruse DH, Korol O, Johnson JE, Womble M, DeSaix P', year:2022, accessed:'2026-11-28'};
const BOOK = 'https://openstax.org/books/anatomy-and-physiology-2e/pages/';

export const kneeLesson = {
  id:'knee-flexion-right',
  version:'0.1-draft',
  researched:'2026-11-28',
  review:{status:REVIEW.PENDING, reviewer:null, date:null},
  side:'R',
  clip:'Knee_Flexion_R', // the shin bends about 80° while the thigh stays still: a standing knee curl
  // The visitor's RIGHT leg drives the model's RIGHT leg (no side swap); the preview is shown like a mirror.
  mirrorTracking:false,
  trackedSegments:['thigh.R','shin.R'],
  trackedLandmarks:[24,26,28], // MediaPipe: right hip, right knee, right ankle (subject's own right)
  // Right side, slightly from behind: shows the hamstrings and the heel's backward arc in one view.
  // The model faces +Z and its right side is at -X.
  view:[-.9,.12,-.45],
  // Live feedback during "Try it yourself" (estimates for practice, not clinical measurement; thresholds await review).
  // joint: landmarks [a, b, c]; the displayed bend is 180° minus the angle at b.
  // form: the tip appears when the segment's direction is more than maxDeg away from the reference direction.
  feedback:{
    joint:[24,26,28],                                         // right hip, knee, ankle
    form:{segment:[24,26], reference:[12,24], maxDeg:30},     // thigh vs. shoulder→hip line
    displayMax:140,
  },

  notice:{
    en:'Educational prototype — content awaiting Kinesiology review.',
    fr:'Prototype pédagogique — contenu en attente de validation en kinésiologie.',
  },

  sources:[
    {id:'os-1-6', ...OPENSTAX, section:'1.6 Anatomical Terminology', url:BOOK+'1-6-anatomical-terminology',
      used:'Left and right are the subject’s own sides.'},
    {id:'os-8-4', ...OPENSTAX, section:'8.4 Bones of the Lower Limb', url:BOOK+'8-4-bones-of-the-lower-limb',
      used:'Patella as the largest sesamoid bone, in the quadriceps femoris tendon; the fibula does not bear weight; the femoral condyles articulate with the tibia to form the knee joint.'},
    {id:'os-9-5', ...OPENSTAX, section:'9.5 Types of Body Movements', url:BOOK+'9-5-types-of-body-movements',
      used:'Knee flexion brings the foot toward the posterior thigh; extension straightens the knee.'},
    {id:'os-9-6', ...OPENSTAX, section:'9.6 Anatomy of Selected Synovial Joints', url:BOOK+'9-6-anatomy-of-selected-synovial-joints',
      used:'Knee functions primarily as a hinge (tibiofemoral and femoropatellar joints); some rotation of the leg when flexed but not when extended; patella protects the quadriceps tendon and slides in a groove on the femur.'},
    {id:'os-10-4', ...OPENSTAX, section:'10.4 Nervous System Control of Muscle Tension', url:BOOK+'10-4-nervous-system-control-of-muscle-tension',
      used:'Concentric contraction (muscle shortens) and eccentric contraction (muscle lengthens while a load is lowered slowly).'},
    {id:'os-11-1', ...OPENSTAX, section:'11.1 Interactions of Skeletal Muscles, Their Fascicle Arrangement, and Their Lever Systems', url:BOOK+'11-1-interactions-of-skeletal-muscles-their-fascicle-arrangement-and-their-lever-systems',
      used:'Prime mover, synergist and antagonist.'},
    {id:'os-11-6', ...OPENSTAX, section:'11.6 Appendicular Muscles of the Pelvic Girdle and Lower Limbs', url:BOOK+'11-6-appendicular-muscles-of-the-pelvic-girdle-and-lower-limbs',
      used:'Hamstrings (biceps femoris, semitendinosus, semimembranosus) flex the knee; sartorius and gracilis flex the leg at the knee; gastrocnemius assists moving the lower leg back toward the buttocks; quadriceps femoris (rectus femoris, vastus lateralis, medialis, intermedius) extends and stabilizes the knee; quadriceps tendon, patella, patellar ligament to the tibial tuberosity; tibialis anterior raises the front of the foot.'},
  ],

  // Each claim is a short, paraphrased statement with its supporting source ids.
  claims:{
    objective:{sources:['os-9-5','os-11-6'], status:REVIEW.PENDING,
      en:'Recognize knee flexion and extension, and name the main muscle groups that bend and straighten the knee.',
      fr:'Reconnaître la flexion et l’extension du genou, et nommer les principaux groupes de muscles qui fléchissent et étendent le genou.'},
    startPosition:{sources:['os-1-6'], status:REVIEW.PENDING,
      en:'Stand facing the screen, far enough back that your whole body is in view. Hold the back of a chair or a wall with your left hand for balance, and rest your weight on your left leg.',
      fr:'Placez-vous debout face à l’écran, assez loin pour que tout votre corps soit visible. Tenez le dossier d’une chaise ou un mur avec la main gauche pour garder l’équilibre, et appuyez votre poids sur la jambe gauche.'},
    movement:{sources:['os-9-5'], status:REVIEW.PENDING,
      en:'Slowly bend your right knee to bring your heel toward your buttock, as far as is comfortable. Keep your knees side by side and your right thigh pointing down. Then slowly lower your foot. Stop if anything hurts or you feel unsteady.',
      fr:'Pliez lentement le genou droit pour amener le talon vers la fesse, aussi loin que c’est confortable. Gardez les genoux côte à côte et la cuisse droite pointée vers le sol. Puis redescendez lentement le pied. Arrêtez si vous ressentez une douleur ou perdez l’équilibre.'},
    hinge:{sources:['os-9-6','os-9-5','os-8-4'], status:REVIEW.PENDING,
      en:'The knee works mainly like a hinge between the femur and the tibia. Bending it is flexion: the foot moves toward the back of the thigh. Straightening it is extension.',
      fr:'Le genou fonctionne surtout comme une charnière entre le fémur et le tibia. Le plier, c’est la flexion : le pied se rapproche de l’arrière de la cuisse. Le tendre, c’est l’extension.'},
    rotation:{sources:['os-9-6'], status:REVIEW.PENDING,
      en:'Unlike a simple hinge, the knee allows some rotation of the leg when it is bent, but not when it is straight.',
      fr:'Contrairement à une simple charnière, le genou permet une certaine rotation de la jambe quand il est plié, mais pas quand il est tendu.'},
    kneecap:{sources:['os-8-4','os-9-6'], status:REVIEW.PENDING,
      en:'The patella (kneecap) sits inside the tendon of the quadriceps and slides in a groove on the femur, protecting the tendon from friction. The fibula, the thin bone beside the tibia, does not bear weight.',
      fr:'La patella (rotule) se trouve dans le tendon du quadriceps et glisse dans une gorge du fémur, ce qui protège le tendon contre le frottement. La fibula, l’os mince à côté du tibia, ne supporte pas le poids du corps.'},
    flexors:{sources:['os-11-6'], status:REVIEW.PENDING,
      en:'The hamstrings at the back of the thigh bend the knee: biceps femoris, semitendinosus and semimembranosus. Sartorius and gracilis also bend the knee, and the gastrocnemius in the calf assists.',
      fr:'Les ischio-jambiers, à l’arrière de la cuisse, fléchissent le genou : le biceps fémoral, le semi-tendineux et le semi-membraneux. Le sartorius et le gracile fléchissent aussi le genou, et le gastrocnémien, dans le mollet, y contribue.'},
    extensors:{sources:['os-11-6','os-11-1'], status:REVIEW.PENDING,
      en:'The four muscles of the quadriceps femoris (rectus femoris and the three vastus muscles) straighten and stabilize the knee. Their shared tendon holds the patella and continues as the patellar ligament to the tibia. Because they act opposite to the hamstrings, they are their antagonists.',
      fr:'Les quatre muscles du quadriceps fémoral (le droit fémoral et les trois vastes) étendent et stabilisent le genou. Leur tendon commun contient la patella et se prolonge par le ligament patellaire jusqu’au tibia. Comme ils ont l’action opposée à celle des ischio-jambiers, ce sont leurs antagonistes.'},
    lifting:{sources:['os-10-4','os-11-6'], status:REVIEW.PENDING,
      en:'Standing on your left leg, gravity pulls your right lower leg down. To lift your heel, the hamstrings shorten as they contract: a concentric contraction.',
      fr:'Debout sur la jambe gauche, la gravité tire la jambe droite vers le bas. Pour lever le talon, les ischio-jambiers raccourcissent en se contractant : c’est une contraction concentrique.'},
    direction:{sources:['os-10-4'], status:REVIEW.PENDING,
      en:'The direction of a movement alone does not tell you which muscles are working. When a load is lowered slowly, the muscles that lifted it can lengthen while still working to control it: an eccentric contraction.',
      fr:'La direction d’un mouvement ne suffit pas à savoir quels muscles travaillent. Quand on descend lentement une charge, les muscles qui l’ont levée peuvent s’allonger tout en travaillant pour contrôler la descente : c’est une contraction excentrique.'},
  },

  // Proposed highlight rules (unreviewed). Names must match `anatomy_name` exactly.
  // Highlights show WHERE structures are. They are not linked to movement phase, joint angle or
  // the visitor's tracked motion, and they are not a measurement of muscle activity.
  highlightGroups:[
    {id:'flexors', claims:['flexors'], color:'#b62749', status:REVIEW.PENDING,
      label:{en:'Knee flexors', fr:'Fléchisseurs du genou'},
      anatomyNames:['Long head of biceps femoris.r','Short head of biceps femoris.r','Semitendinosus muscle.r','Semimembranosus muscle.r',
        'Sartorius muscle.r','Gracilis muscle.r','Medial head of gastrocnemius.r','Lateral head of gastrocnemius.r'],
      structures:[
        {en:'Biceps femoris (long and short heads)', fr:'Biceps fémoral (chefs long et court)'},
        {en:'Semitendinosus', fr:'Muscle semi-tendineux'},
        {en:'Semimembranosus', fr:'Muscle semi-membraneux'},
        {en:'Sartorius and gracilis (also bend the knee)', fr:'Sartorius et gracile (fléchissent aussi le genou)'},
        {en:'Gastrocnemius, medial and lateral heads (assists)', fr:'Gastrocnémien, chefs médial et latéral (contribue)'},
      ]},
    {id:'extensors', claims:['extensors'], color:'#2f6f9f', status:REVIEW.PENDING,
      label:{en:'Knee extensors', fr:'Extenseurs du genou'},
      anatomyNames:['Rectus femoris.r','Vastus lateralis muscle.r','Vastus medialis muscle.r','Vastus intermedius muscle.r'],
      structures:[
        {en:'Rectus femoris', fr:'Muscle droit fémoral'},
        {en:'Vastus lateralis', fr:'Muscle vaste latéral'},
        {en:'Vastus medialis', fr:'Muscle vaste médial'},
        {en:'Vastus intermedius (deep to rectus femoris)', fr:'Muscle vaste intermédiaire (sous le droit fémoral)'},
      ]},
    {id:'bones', claims:['hinge','rotation','kneecap'], color:'#c08a2b', status:REVIEW.PENDING,
      label:{en:'Bones of the knee', fr:'Os du genou'},
      anatomyNames:['Femur.r','Tibia.r','Patella.r','Fibula.r'],
      structures:[
        {en:'Femur', fr:'Fémur'},
        {en:'Tibia', fr:'Tibia'},
        {en:'Patella (kneecap)', fr:'Patella (rotule)'},
        {en:'Fibula', fr:'Fibula'},
      ]},
  ],
  // During "Try it yourself" the bones of the tracked leg are tinted only to identify the leg.
  trackedGroup:'bones',

  question:{
    status:REVIEW.PENDING, sources:['os-10-4','os-11-6','os-9-5'],
    prompt:{
      en:'Standing on your left leg, you bend your right knee to bring your heel toward your buttock. Which muscles shorten to lift your lower leg?',
      fr:'Debout sur la jambe gauche, vous pliez le genou droit pour amener le talon vers la fesse. Quels muscles raccourcissent pour lever la jambe?',
    },
    options:[
      {id:'flexors', correct:true,
        text:{en:'The hamstrings at the back of the thigh', fr:'Les ischio-jambiers, à l’arrière de la cuisse'},
        feedback:{en:'Correct. Lifting your heel works against gravity, so biceps femoris, semitendinosus and semimembranosus shorten as they contract (a concentric contraction).',
          fr:'Exact. Lever le talon se fait contre la gravité : le biceps fémoral, le semi-tendineux et le semi-membraneux raccourcissent en se contractant (contraction concentrique).'}},
      {id:'extensors', correct:false,
        text:{en:'The quadriceps at the front of the thigh', fr:'Le quadriceps, à l’avant de la cuisse'},
        feedback:{en:'Not quite. The quadriceps femoris straightens the knee. Bending the knee to lift the heel is flexion.',
          fr:'Pas tout à fait. Le quadriceps fémoral étend le genou. Plier le genou pour lever le talon, c’est une flexion.'}},
      {id:'shin', correct:false,
        text:{en:'The muscles at the front of the shin', fr:'Les muscles à l’avant du tibia'},
        feedback:{en:'Not quite. Tibialis anterior and its neighbours raise the front of the foot at the ankle; they do not bend the knee.',
          fr:'Pas tout à fait. Le muscle tibial antérieur et ses voisins relèvent l’avant du pied à la cheville; ils ne fléchissent pas le genou.'}},
    ],
  },

  // Interface text (not educational claims, so no sources required).
  ui:{
    tab:{en:'Learn a movement', fr:'Apprendre un mouvement'},
    shortName:{en:'Knee', fr:'Genou'},
    chooseLesson:{en:'Choose a movement', fr:'Choisir un mouvement'},
    stepNames:{
      intro:{en:'Introduction', fr:'Introduction'},
      watch:{en:'Watch the movement', fr:'Observer le mouvement'},
      try:{en:'Try it yourself', fr:'À vous d’essayer'},
      understand:{en:'Understand the movement', fr:'Comprendre le mouvement'},
      check:{en:'Check your understanding', fr:'Vérifier vos connaissances'},
    },
    stepOf:{en:'Step {n} of {total}', fr:'Étape {n} sur {total}'},
    title:{en:'Bending and straightening the knee', fr:'Plier et tendre le genou'},
    objectiveLabel:{en:'Learning objective', fr:'Objectif d’apprentissage'},
    whatYouWillDo:{en:'Watch a short demonstration, try the movement with your right leg, explore the structures involved, then answer one question. There is no timer. You will need something steady to hold, such as a chair or a wall.',
      fr:'Regardez une courte démonstration, essayez le mouvement avec la jambe droite, explorez les structures en jeu, puis répondez à une question. Il n’y a pas de minuterie. Vous aurez besoin d’un appui stable, comme une chaise ou un mur.'},
    start:{en:'Start', fr:'Commencer'},
    returnToExplore:{en:'Return to exploration', fr:'Retour à l’exploration'},
    continue:{en:'Continue', fr:'Continuer'},
    back:{en:'Back', fr:'Retour'},
    restart:{en:'Restart', fr:'Recommencer'},
    exit:{en:'Exit', fr:'Quitter'},
    replay:{en:'Replay', fr:'Rejouer'},
    sources:{en:'Sources', fr:'Sources'},
    sourcesTitle:{en:'Sources for this lesson', fr:'Sources de cette leçon'},
    sourcesIntro:{en:'Draft content prepared from these open references. It is awaiting review by a Kinesiology expert.',
      fr:'Contenu provisoire préparé à partir de ces références ouvertes. Il est en attente de validation par une ou un spécialiste en kinésiologie.'},
    supports:{en:'Supports', fr:'Appuie'},
    close:{en:'Close', fr:'Fermer'},
    language:{en:'Language', fr:'Langue'},
    watchIntro:{en:'Watch the model’s right knee bend and straighten while its thigh stays still. This is a scripted demonstration, not your movement.',
      fr:'Observez le genou droit du modèle se plier et se tendre pendant que la cuisse reste immobile. Il s’agit d’une démonstration préenregistrée, pas de votre mouvement.'},
    demoLabel:{en:'Demonstration · scripted animation', fr:'Démonstration · animation préenregistrée'},
    liveLabel:{en:'Live · your estimated movement', fr:'En direct · votre mouvement estimé'},
    limbLabel:{en:'Use your RIGHT leg. The leg that stands out on the model is its right leg.', fr:'Utilisez votre jambe DROITE. La jambe mise en évidence sur le modèle est sa jambe droite.'},
    angleLabel:{en:'Your knee bend (estimate)', fr:'Flexion de votre genou (estimation)'},
    bestLabel:{en:'Best so far: {n}°', fr:'Maximum atteint : {n}°'},
    angleNote:{en:'Estimated from the camera to help you practise. It is not a clinical measurement.', fr:'Estimation faite par la caméra pour vous aider à pratiquer. Ce n’est pas une mesure clinique.'},
    formTip:{en:'Try to keep your right thigh pointing down, knees side by side, and let only your lower leg move.', fr:'Essayez de garder la cuisse droite pointée vers le sol, les genoux côte à côte, et de ne bouger que la jambe.'},
    previewNote:{en:'The preview works like a mirror. Video stays on this computer; nothing is recorded.', fr:'L’aperçu fonctionne comme un miroir. La vidéo reste sur cet ordinateur; rien n’est enregistré.'},
    startCamera:{en:'Start camera', fr:'Démarrer la caméra'},
    useDemo:{en:'Use the demonstration instead', fr:'Utiliser plutôt la démonstration'},
    tryCamera:{en:'Try with the camera', fr:'Essayer avec la caméra'},
    retry:{en:'Try again', fr:'Réessayer'},
    capture:{en:'I’m in the starting position', fr:'Je suis en position de départ'},
    ready:{en:'I’m ready to continue', fr:'Je veux continuer'},
    status:{
      idle:{en:'The camera starts only when you choose.', fr:'La caméra démarre seulement si vous le choisissez.'},
      requesting:{en:'Requesting camera access…', fr:'Demande d’accès à la caméra…'},
      preparing:{en:'Preparing local movement tracking…', fr:'Préparation du suivi local du mouvement…'},
      position:{en:'Get into the starting position. Make sure your hips, knees and feet are visible in the preview.', fr:'Prenez la position de départ. Assurez-vous que vos hanches, vos genoux et vos pieds sont visibles dans l’aperçu.'},
      notVisible:{en:'We can’t see your right hip, knee and ankle yet. Step back until your feet are in view, and face the screen.', fr:'Nous ne voyons pas encore votre hanche, votre genou et votre cheville droits. Reculez jusqu’à ce que vos pieds soient visibles, face à l’écran.'},
      tracking:{en:'Tracking your right leg. Bend and straighten your knee at your own pace, holding on for balance.', fr:'Suivi de votre jambe droite. Pliez et tendez le genou à votre rythme, en vous tenant pour garder l’équilibre.'},
      lost:{en:'Your right leg is out of view. The model is returning to rest. Step back into view to continue.', fr:'Votre jambe droite n’est plus visible. Le modèle revient au repos. Revenez dans le champ pour continuer.'},
      denied:{en:'Camera access was not allowed. You can use the demonstration instead, or allow the camera in the browser and try again.', fr:'L’accès à la caméra n’a pas été autorisé. Vous pouvez utiliser la démonstration, ou autoriser la caméra dans le navigateur et réessayer.'},
      noCamera:{en:'No camera is available. You can use the demonstration instead.', fr:'Aucune caméra n’est disponible. Vous pouvez utiliser la démonstration.'},
      cameraError:{en:'The camera could not start. You can use the demonstration instead, or try again.', fr:'La caméra n’a pas pu démarrer. Vous pouvez utiliser la démonstration ou réessayer.'},
      trackingError:{en:'Movement tracking stopped. You can use the demonstration instead, or try again.', fr:'Le suivi du mouvement s’est arrêté. Vous pouvez utiliser la démonstration ou réessayer.'},
      cameraStopped:{en:'The camera stopped. You can use the demonstration instead, or try again.', fr:'La caméra s’est arrêtée. Vous pouvez utiliser la démonstration ou réessayer.'},
      demo:{en:'Follow along with the demonstration using your right leg, if you wish. Hold on to something steady.', fr:'Suivez la démonstration avec la jambe droite, si vous le souhaitez. Tenez-vous à un appui stable.'},
    },
    startPositionLabel:{en:'Starting position', fr:'Position de départ'},
    movementLabel:{en:'Movement', fr:'Mouvement'},
    structuresLabel:{en:'Structures', fr:'Structures'},
    positionTitle:{en:'Position, gravity and effort', fr:'Position, gravité et effort'},
    draft:{en:'Draft · pending review', fr:'Ébauche · en attente de validation'},
    sourceRef:{en:'Source {n}', fr:'Source {n}'},
    lessonNav:{en:'Lesson navigation', fr:'Navigation de la leçon'},
    understandIntro:{en:'Choose a group to see where it is on the model.', fr:'Choisissez un groupe pour le repérer sur le modèle.'},
    highlightDisclaimer:{en:'Proposed highlight, not yet reviewed. It shows where these structures are, not how active your muscles are.',
      fr:'Surlignage proposé, pas encore validé. Il montre où se trouvent ces structures, et non l’activité de vos muscles.'},
    missingStructures:{en:'Not found in this model (no substitute shown):', fr:'Introuvable dans ce modèle (aucun substitut affiché) :'},
    check:{en:'Check answer', fr:'Vérifier'},
    tryAnother:{en:'Try another answer', fr:'Essayer une autre réponse'},
    tryAgain:{en:'Try again', fr:'Recommencer'},
    exploreAnatomy:{en:'Explore anatomy', fr:'Explorer l’anatomie'},
    finished:{en:'You have finished the knee activity.', fr:'Vous avez terminé l’activité sur le genou.'},
  },
};
