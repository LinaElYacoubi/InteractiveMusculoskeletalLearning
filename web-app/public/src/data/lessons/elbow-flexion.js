// Editable educational content for the guided elbow lesson.
//
// DRAFT — every educational claim, instruction and highlight rule below is awaiting
// review by the project's Kinesiology expert. Nothing here has been approved.
//
// Editing rules
// - Every visitor-facing string is an {en, fr} pair. Both languages are required.
// - Every educational claim lists the ids of the sources that support it (see `sources`).
// - Highlight rules name meshes by their exact `anatomy_name` metadata in
//   assets/INNOVA-Musculoskeletal-Rig.glb. Missing names are reported, never substituted.
// - When a claim is reviewed, change its `status` and record the reviewer in `review`.
// - Run `.\runtime\node.exe --test tests/*.test.mjs` after editing: the content checks fail
//   on missing translations, unknown source ids or claims without sources.

export const REVIEW = Object.freeze({PENDING:'pending-review', APPROVED:'approved', REVISE:'needs-revision'});

const OPENSTAX = {publisher:'OpenStax', work:'Anatomy and Physiology 2e', authors:'Betts JG, Young KA, Wise JA, Johnson E, Poe B, Kruse DH, Korol O, Johnson JE, Womble M, DeSaix P', year:2022, accessed:'2026-11-14'};

export const elbowLesson = {
  id:'elbow-flexion-right',
  version:'0.1-draft',
  researched:'2026-11-14',
  review:{status:REVIEW.PENDING, reviewer:null, date:null},
  side:'R',
  clip:'Elbow_Flexion_R',
  // Anatomical mapping: the visitor's RIGHT arm drives the model's RIGHT arm (no side swap).
  // The camera preview is still displayed like a mirror, which visitors find natural.
  mirrorTracking:false,
  trackedSegments:['upper_arm.R','forearm.R'],
  trackedLandmarks:[12,14,16], // MediaPipe: right shoulder, right elbow, right wrist (subject's own right)
  // Right-side oblique: shows the anterior arm and the forearm's forward flexion arc in one view.
  // The model faces +Z and its right side is at -X.
  view:[-.9,.15,.42],

  notice:{
    en:'Educational prototype — content awaiting Kinesiology review.',
    fr:'Prototype pédagogique — contenu en attente de validation en kinésiologie.',
  },

  sources:[
    {id:'os-1-6', ...OPENSTAX, section:'1.6 Anatomical Terminology', url:'https://openstax.org/books/anatomy-and-physiology-2e/pages/1-6-anatomical-terminology',
      used:'Anatomical position (palms facing forward); left and right are the subject’s own sides.'},
    {id:'os-9-5', ...OPENSTAX, section:'9.5 Types of Body Movements', url:'https://openstax.org/books/anatomy-and-physiology-2e/pages/9-5-types-of-body-movements',
      used:'Definitions of flexion and extension (sagittal plane; joint angle decreases or increases); supination and pronation.'},
    {id:'os-9-6', ...OPENSTAX, section:'9.6 Anatomy of Selected Synovial Joints', url:'https://openstax.org/books/anatomy-and-physiology-2e/pages/9-6-anatomy-of-selected-synovial-joints',
      used:'Elbow as a uniaxial hinge (humeroulnar joint: trochlea of humerus, trochlear notch of ulna); proximal radioulnar pivot joint for pronation/supination.'},
    {id:'os-10-4', ...OPENSTAX, section:'10.4 Nervous System Control of Muscle Tension', url:'https://openstax.org/books/anatomy-and-physiology-2e/pages/10-4-nervous-system-control-of-muscle-tension',
      used:'Concentric contraction (biceps brachii shortens, elbow angle decreases) and eccentric contraction (hand weight lowered slowly while the muscle lengthens).'},
    {id:'os-11-1', ...OPENSTAX, section:'11.1 Interactions of Skeletal Muscles, Their Fascicle Arrangement, and Their Lever Systems', url:'https://openstax.org/books/anatomy-and-physiology-2e/pages/11-1-interactions-of-skeletal-muscles-their-fascicle-arrangement-and-their-lever-systems',
      used:'Prime mover, synergist and antagonist, using biceps brachii, brachialis, brachioradialis and triceps brachii at the elbow.'},
    {id:'os-11-5', ...OPENSTAX, section:'11.5 Muscles of the Pectoral Girdle and Upper Limbs', url:'https://openstax.org/books/anatomy-and-physiology-2e/pages/11-5-muscles-of-the-pectoral-girdle-and-upper-limbs',
      used:'Forearm flexors (biceps brachii, brachialis deep to biceps, brachioradialis) and extensors (triceps brachii, anconeus).'},
  ],

  // Each claim is a short, paraphrased statement with its supporting source ids.
  claims:{
    objective:{sources:['os-9-5','os-11-5'], status:REVIEW.PENDING,
      en:'Recognize elbow flexion and extension, and name the main muscles that bend and straighten the elbow.',
      fr:'Reconnaître la flexion et l’extension du coude, et nommer les principaux muscles qui fléchissent et étendent le coude.'},
    startPosition:{sources:['os-1-6'], status:REVIEW.PENDING,
      en:'Stand facing the screen with your arms relaxed by your sides. Keep your right upper arm close to your body and turn your right palm forward.',
      fr:'Placez-vous debout face à l’écran, les bras détendus le long du corps. Gardez le bras droit près du corps et tournez la paume droite vers l’avant.'},
    movement:{sources:['os-9-5'], status:REVIEW.PENDING,
      en:'Slowly bend your right elbow to bring your hand toward your shoulder, as far as is comfortable. Then slowly straighten it. Keep your upper arm still. Stop if anything hurts.',
      fr:'Pliez lentement le coude droit pour amener la main vers l’épaule, aussi loin que c’est confortable. Puis tendez-le lentement. Gardez le bras immobile. Arrêtez si vous ressentez une douleur.'},
    hinge:{sources:['os-9-6','os-9-5'], status:REVIEW.PENDING,
      en:'The elbow works like a hinge between the humerus and the ulna. Bending it is flexion: the angle between the forearm and upper arm gets smaller. Straightening it is extension: the angle gets larger.',
      fr:'Le coude fonctionne comme une charnière entre l’humérus et l’ulna. Le plier, c’est la flexion : l’angle entre l’avant-bras et le bras diminue. Le tendre, c’est l’extension : l’angle augmente.'},
    rotation:{sources:['os-9-6','os-9-5'], status:REVIEW.PENDING,
      en:'Turning the palm forward or backward (supination and pronation) happens where the radius rotates next to the ulna, not at the hinge.',
      fr:'Tourner la paume vers l’avant ou vers l’arrière (supination et pronation) se fait là où le radius pivote contre l’ulna, et non à la charnière.'},
    flexors:{sources:['os-11-5','os-11-1'], status:REVIEW.PENDING,
      en:'Three muscles bend the elbow: biceps brachii, brachialis (lying deep to the biceps) and brachioradialis. The biceps also helps turn the palm forward.',
      fr:'Trois muscles fléchissent le coude : le biceps brachial, le muscle brachial (situé sous le biceps) et le muscle brachio-radial. Le biceps aide aussi à tourner la paume vers l’avant.'},
    extensors:{sources:['os-11-5','os-11-1'], status:REVIEW.PENDING,
      en:'Triceps brachii and anconeus straighten the elbow. Because the triceps has the opposite action to the biceps, it is called its antagonist.',
      fr:'Le triceps brachial et le muscle anconé étendent le coude. Comme le triceps a l’action opposée à celle du biceps, on l’appelle son antagoniste.'},
    lifting:{sources:['os-10-4','os-11-5'], status:REVIEW.PENDING,
      en:'In this standing position, gravity pulls your forearm down. To lift your hand, the elbow flexors shorten as they contract: a concentric contraction.',
      fr:'Dans cette position debout, la gravité tire l’avant-bras vers le bas. Pour lever la main, les fléchisseurs du coude raccourcissent en se contractant : c’est une contraction concentrique.'},
    direction:{sources:['os-10-4'], status:REVIEW.PENDING,
      en:'The direction of a movement alone does not tell you which muscles are working. When a hand weight is lowered slowly, the elbow flexors lengthen while still working to control it: an eccentric contraction.',
      fr:'La direction d’un mouvement ne suffit pas à savoir quels muscles travaillent. Quand on descend lentement un poids tenu dans la main, les fléchisseurs du coude s’allongent tout en travaillant pour contrôler la descente : c’est une contraction excentrique.'},
  },

  // Proposed highlight rules (unreviewed). Names must match `anatomy_name` exactly.
  // Highlights show WHERE structures are. They are not linked to movement phase, joint angle or
  // the visitor's tracked motion, and they are not a measurement of muscle activity.
  highlightGroups:[
    {id:'flexors', claims:['flexors'], color:'#b62749', status:REVIEW.PENDING,
      label:{en:'Elbow flexors', fr:'Fléchisseurs du coude'},
      anatomyNames:['Long head of biceps brachii.r','Short head of biceps brachii.r','Brachialis muscle.r','Brachioradialis muscle.r'],
      structures:[
        {en:'Biceps brachii (long and short heads)', fr:'Biceps brachial (chefs long et court)'},
        {en:'Brachialis', fr:'Muscle brachial'},
        {en:'Brachioradialis', fr:'Muscle brachio-radial'},
      ]},
    {id:'extensors', claims:['extensors'], color:'#2f6f9f', status:REVIEW.PENDING,
      label:{en:'Elbow extensors', fr:'Extenseurs du coude'},
      anatomyNames:['Long head of triceps brachii.r','Lateral head of triceps brachii.r','Medial head of triceps brachii.r','Anconeus muscle.r'],
      structures:[
        {en:'Triceps brachii (long, lateral and medial heads)', fr:'Triceps brachial (chefs long, latéral et médial)'},
        {en:'Anconeus', fr:'Muscle anconé'},
      ]},
    {id:'bones', claims:['hinge','rotation'], color:'#c08a2b', status:REVIEW.PENDING,
      label:{en:'Bones of the elbow', fr:'Os du coude'},
      anatomyNames:['Humerus.r','Ulna.r','Radius.r'],
      structures:[
        {en:'Humerus', fr:'Humérus'},
        {en:'Ulna', fr:'Ulna'},
        {en:'Radius', fr:'Radius'},
      ]},
  ],
  // During "Try it yourself" the bones of the tracked arm are tinted only to identify the arm.
  trackedGroup:'bones',

  question:{
    status:REVIEW.PENDING, sources:['os-10-4','os-11-5','os-9-5'],
    prompt:{
      en:'Standing with your upper arm by your side, you lift your hand toward your shoulder. Which muscles shorten to raise your forearm?',
      fr:'Debout, le bras le long du corps, vous levez la main vers l’épaule. Quels muscles raccourcissent pour lever l’avant-bras?',
    },
    options:[
      {id:'flexors', correct:true,
        text:{en:'The elbow flexors at the front of the arm', fr:'Les fléchisseurs du coude, à l’avant du bras'},
        feedback:{en:'Correct. Lifting your hand works against gravity, so biceps brachii, brachialis and brachioradialis shorten as they contract (a concentric contraction).',
          fr:'Exact. Lever la main se fait contre la gravité : le biceps brachial, le muscle brachial et le muscle brachio-radial raccourcissent en se contractant (contraction concentrique).'}},
      {id:'extensors', correct:false,
        text:{en:'The elbow extensors at the back of the arm', fr:'Les extenseurs du coude, à l’arrière du bras'},
        feedback:{en:'Not quite. Triceps brachii and anconeus straighten the elbow. Bending the elbow to lift the hand is flexion.',
          fr:'Pas tout à fait. Le triceps brachial et le muscle anconé étendent le coude. Plier le coude pour lever la main, c’est une flexion.'}},
      {id:'rotators', correct:false,
        text:{en:'The muscles that turn the palm down', fr:'Les muscles qui tournent la paume vers le bas'},
        feedback:{en:'Not quite. Pronator teres and pronator quadratus turn the palm; that rotation happens between the radius and ulna, not at the elbow hinge.',
          fr:'Pas tout à fait. Le rond pronateur et le carré pronateur tournent la paume; cette rotation se fait entre le radius et l’ulna, et non à la charnière du coude.'}},
    ],
  },

  // Interface text (not educational claims, so no sources required).
  ui:{
    tab:{en:'Learn a movement', fr:'Apprendre un mouvement'},
    shortName:{en:'Elbow', fr:'Coude'},
    chooseLesson:{en:'Choose a movement', fr:'Choisir un mouvement'},
    stepNames:{
      intro:{en:'Introduction', fr:'Introduction'},
      watch:{en:'Watch the movement', fr:'Observer le mouvement'},
      try:{en:'Try it yourself', fr:'À vous d’essayer'},
      understand:{en:'Understand the movement', fr:'Comprendre le mouvement'},
      check:{en:'Check your understanding', fr:'Vérifier vos connaissances'},
    },
    stepOf:{en:'Step {n} of {total}', fr:'Étape {n} sur {total}'},
    title:{en:'Bending and straightening the elbow', fr:'Plier et tendre le coude'},
    objectiveLabel:{en:'Learning objective', fr:'Objectif d’apprentissage'},
    whatYouWillDo:{en:'Watch a short demonstration, try the movement with your right arm, explore the structures involved, then answer one question. There is no timer.',
      fr:'Regardez une courte démonstration, essayez le mouvement avec le bras droit, explorez les structures en jeu, puis répondez à une question. Il n’y a pas de minuterie.'},
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
    watchIntro:{en:'Watch the model’s right elbow bend and straighten. This is a scripted demonstration, not your movement.',
      fr:'Observez le coude droit du modèle se plier et se tendre. Il s’agit d’une démonstration préenregistrée, pas de votre mouvement.'},
    demoLabel:{en:'Demonstration · scripted animation', fr:'Démonstration · animation préenregistrée'},
    liveLabel:{en:'Live · your estimated movement', fr:'En direct · votre mouvement estimé'},
    limbLabel:{en:'Use your RIGHT arm. The arm that stands out on the model is its right arm.', fr:'Utilisez votre bras DROIT. Le bras mis en évidence sur le modèle est son bras droit.'},
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
      position:{en:'Get into the starting position. Make sure your head, shoulders and right hand are visible in the preview.', fr:'Prenez la position de départ. Assurez-vous que votre tête, vos épaules et votre main droite sont visibles dans l’aperçu.'},
      notVisible:{en:'We can’t see your right shoulder, elbow and wrist yet. Step back a little or turn to face the screen.', fr:'Nous ne voyons pas encore votre épaule, votre coude et votre poignet droits. Reculez un peu ou placez-vous face à l’écran.'},
      tracking:{en:'Tracking your right arm. Bend and straighten your elbow at your own pace.', fr:'Suivi de votre bras droit. Pliez et tendez le coude à votre rythme.'},
      lost:{en:'Your right arm is out of view. The model is returning to rest. Step back into view to continue.', fr:'Votre bras droit n’est plus visible. Le modèle revient au repos. Revenez dans le champ pour continuer.'},
      denied:{en:'Camera access was not allowed. You can use the demonstration instead, or allow the camera in the browser and try again.', fr:'L’accès à la caméra n’a pas été autorisé. Vous pouvez utiliser la démonstration, ou autoriser la caméra dans le navigateur et réessayer.'},
      noCamera:{en:'No camera is available. You can use the demonstration instead.', fr:'Aucune caméra n’est disponible. Vous pouvez utiliser la démonstration.'},
      cameraError:{en:'The camera could not start. You can use the demonstration instead, or try again.', fr:'La caméra n’a pas pu démarrer. Vous pouvez utiliser la démonstration ou réessayer.'},
      trackingError:{en:'Movement tracking stopped. You can use the demonstration instead, or try again.', fr:'Le suivi du mouvement s’est arrêté. Vous pouvez utiliser la démonstration ou réessayer.'},
      cameraStopped:{en:'The camera stopped. You can use the demonstration instead, or try again.', fr:'La caméra s’est arrêtée. Vous pouvez utiliser la démonstration ou réessayer.'},
      demo:{en:'Follow along with the demonstration using your right arm, if you wish.', fr:'Suivez la démonstration avec votre bras droit, si vous le souhaitez.'},
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
    finished:{en:'You have finished the elbow activity.', fr:'Vous avez terminé l’activité sur le coude.'},
  },
};
