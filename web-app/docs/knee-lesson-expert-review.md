# Knee lesson — Kinesiology review sheet

**Lesson:** Learn a movement / Apprendre un mouvement — bending and straightening the right knee (standing knee curl)
**Content file:** `web-app/public/src/data/lessons/knee-flexion.js` (version 0.1-draft, researched 2026-11-28)
**Overall status:** Pending review. Nothing below has been approved by the Kinesiology expert.

All sources are sections of *Anatomy and Physiology 2e* (Betts JG et al., OpenStax, 2022). Each section was read before use. App text paraphrases the sources rather than quoting them. Claim IDs match the keys in the content file. To record a decision, change that claim's `status` to `approved` or `needs-revision`.

Why a standing knee curl: the model's `Knee_Flexion_R` animation bends the right shin about 80° while the thigh stays still, and the rig's root is fixed. A squat would need the whole body to move down, which the app does not show.

## Claims and instructions

| ID | Draft claim or instruction (EN) | Source | Proposed highlight | Question for the expert | Status |
|---|---|---|---|---|---|
| `objective` | Recognize knee flexion and extension, and name the main muscle groups that bend and straighten the knee. | [9.5](https://openstax.org/books/anatomy-and-physiology-2e/pages/9-5-types-of-body-movements), [11.6](https://openstax.org/books/anatomy-and-physiology-2e/pages/11-6-appendicular-muscles-of-the-pelvic-girdle-and-lower-limbs) | — | Is this objective appropriate for a short public activity? | Pending review |
| `startPosition` | Stand facing the screen, far enough back that your whole body is in view. Hold the back of a chair or a wall with your left hand for balance, and rest your weight on your left leg. | [1.6](https://openstax.org/books/anatomy-and-physiology-2e/pages/1-6-anatomical-terminology) (left and right are the subject's own sides) | During "Try it yourself", the rest of the body is faded and the right femur, tibia, patella and fibula are tinted, only to show which leg is tracked. | Is holding a support enough for balance in the capsule? Should the lesson require a chair to be present? | Pending review |
| `movement` | Slowly bend your right knee to bring your heel toward your buttock, as far as is comfortable. Keep your knees side by side and your right thigh pointing down. Then slowly lower your foot. Stop if anything hurts or you feel unsteady. | [9.5](https://openstax.org/books/anatomy-and-physiology-2e/pages/9-5-types-of-body-movements) ("knee flexion is the bending of the knee to bring the foot toward the posterior thigh") | — | Is the safety wording enough for the public? The demonstration flexes about 80°. Is that acceptable? | Pending review |
| `hinge` | The knee works mainly like a hinge between the femur and the tibia. Bending it is flexion: the foot moves toward the back of the thigh. Straightening it is extension. | [9.6](https://openstax.org/books/anatomy-and-physiology-2e/pages/9-6-anatomy-of-selected-synovial-joints) ("functions primarily as a hinge joint"), [9.5](https://openstax.org/books/anatomy-and-physiology-2e/pages/9-5-types-of-body-movements), [8.4](https://openstax.org/books/anatomy-and-physiology-2e/pages/8-4-bones-of-the-lower-limb) | "Bones of the knee": `Femur.r`, `Tibia.r`, `Patella.r`, `Fibula.r` | Is it acceptable to leave out the femoropatellar joint here and mention the patella separately (`kneecap`)? | Pending review |
| `rotation` | Unlike a simple hinge, the knee allows some rotation of the leg when it is bent, but not when it is straight. | [9.6](https://openstax.org/books/anatomy-and-physiology-2e/pages/9-6-anatomy-of-selected-synovial-joints) | Same bone group as `hinge` | Is this level of detail useful for the public, or should it be dropped? | Pending review |
| `kneecap` | The patella (kneecap) sits inside the tendon of the quadriceps and slides in a groove on the femur, protecting the tendon from friction. The fibula, the thin bone beside the tibia, does not bear weight. | [8.4](https://openstax.org/books/anatomy-and-physiology-2e/pages/8-4-bones-of-the-lower-limb), [9.6](https://openstax.org/books/anatomy-and-physiology-2e/pages/9-6-anatomy-of-selected-synovial-joints) | Same bone group as `hinge` | The fibula is highlighted with the knee bones but is not part of the knee joint. Is that confusing, or should it be removed from the group? | Pending review |
| `flexors` | The hamstrings at the back of the thigh bend the knee: biceps femoris, semitendinosus and semimembranosus. Sartorius and gracilis also bend the knee, and the gastrocnemius in the calf assists. | [11.6](https://openstax.org/books/anatomy-and-physiology-2e/pages/11-6-appendicular-muscles-of-the-pelvic-girdle-and-lower-limbs) | "Knee flexors": `Long head of biceps femoris.r`, `Short head of biceps femoris.r`, `Semitendinosus muscle.r`, `Semimembranosus muscle.r`, `Sartorius muscle.r`, `Gracilis muscle.r`, `Medial head of gastrocnemius.r`, `Lateral head of gastrocnemius.r` | 11.6 says gastrocnemius "assists in moving the back of the lower legs up and back toward the buttocks" but does not use the word flexion, so the text says "assists". Is that right? Should popliteus be added (present in the model as `Popliteus muscle.r`)? 11.6 only says it assists rotation. | Pending review |
| `extensors` | The four muscles of the quadriceps femoris (rectus femoris and the three vastus muscles) straighten and stabilize the knee. Their shared tendon holds the patella and continues as the patellar ligament to the tibia. Because they act opposite to the hamstrings, they are their antagonists. | [11.6](https://openstax.org/books/anatomy-and-physiology-2e/pages/11-6-appendicular-muscles-of-the-pelvic-girdle-and-lower-limbs), [11.1](https://openstax.org/books/anatomy-and-physiology-2e/pages/11-1-interactions-of-skeletal-muscles-their-fascicle-arrangement-and-their-lever-systems) | "Knee extensors": `Rectus femoris.r`, `Vastus lateralis muscle.r`, `Vastus medialis muscle.r`, `Vastus intermedius muscle.r` | Should the text mention that rectus femoris also crosses the hip? (11.6 says it "assists in raising the knee" but not "at the hip", so it was left out.) | Pending review |
| `lifting` | Standing on your left leg, gravity pulls your right lower leg down. To lift your heel, the hamstrings shorten as they contract: a concentric contraction. | [10.4](https://openstax.org/books/anatomy-and-physiology-2e/pages/10-4-nervous-system-control-of-muscle-tension), [11.6](https://openstax.org/books/anatomy-and-physiology-2e/pages/11-6-appendicular-muscles-of-the-pelvic-girdle-and-lower-limbs) | None. No highlight is tied to movement phase. | Correct for the unloaded lower leg across the whole range? | Pending review |
| `direction` | The direction of a movement alone does not tell you which muscles are working. When a load is lowered slowly, the muscles that lifted it can lengthen while still working to control it: an eccentric contraction. | [10.4](https://openstax.org/books/anatomy-and-physiology-2e/pages/10-4-nervous-system-control-of-muscle-tension) | None | See open question 1. | Pending review |

## Proposed highlight behaviour

The same rules as the elbow lesson:

- Matching uses the exact `anatomy_name` metadata in the GLB, and an automated test confirms every name exists as original right-sided geometry. Missing names are listed as "not found" and never substituted.
- In "Understand", the visitor picks one group at a time (flexors, extensors or bones). The chosen group is tinted and the rest of the body fades, except the knee structures listed above.
- Highlights are static and labelled "Proposed highlight, not yet reviewed. It shows where these structures are, not how active your muscles are."
- The camera looks at the right leg from the side and slightly behind, so the hamstrings and the heel's arc are both visible.

## Learning question

**Question:** Standing on your left leg, you bend your right knee to bring your heel toward your buttock. Which muscles shorten to lift your lower leg?

| Option | Answer | Proposed feedback |
|---|---|---|
| A | The hamstrings at the back of the thigh — **correct** | Lifting the heel works against gravity, so biceps femoris, semitendinosus and semimembranosus shorten as they contract (concentric contraction). |
| B | The quadriceps at the front of the thigh | The quadriceps femoris straightens the knee. Bending it to lift the heel is flexion. |
| C | The muscles at the front of the shin | Tibialis anterior and its neighbours raise the front of the foot at the ankle; they do not bend the knee. (11.6: anterior compartment muscles "contribute to raising the front of the foot".) |

**Sources:** [10.4](https://openstax.org/books/anatomy-and-physiology-2e/pages/10-4-nervous-system-control-of-muscle-tension), [11.6](https://openstax.org/books/anatomy-and-physiology-2e/pages/11-6-appendicular-muscles-of-the-pelvic-girdle-and-lower-limbs), [9.5](https://openstax.org/books/anatomy-and-physiology-2e/pages/9-5-types-of-body-movements)
**Question for the expert:** The correct-answer feedback names only the hamstrings, not sartorius, gracilis or gastrocnemius. Is that acceptable?
**Status:** Pending review.

## Open questions (left out of the visitor text because they could not be verified)

1. **Lowering the unloaded lower leg.** When the visitor slowly lowers the foot, are the hamstrings working eccentrically? The visitor text only gives the general rule from 10.4 (a load lowered slowly).
2. **Knee "locking".** OpenStax 9.6 describes the screw-home mechanism in two places that contradict each other (femur rotating medially vs. tibia rotating externally). It was left out of the visitor text. Should the lesson mention it, and with which wording?
3. **French terminology.** Please confirm the preferred terms in Canadian French kinesiology teaching: *patella* (rather than *rotule*, given in brackets), *fibula* (rather than *péroné*), *ischio-jambiers*, *muscle droit fémoral*, *gastrocnémien* (rather than *jumeaux*), *gracile*.
4. **Accessibility.** Standing on one leg is harder than the elbow movement. Is "use the demonstration instead" enough, or should a seated version be offered?

## Technical notes for the team (not kinesiology claims)

- The visitor's right leg drives the model's right leg, with no side swap. The camera preview is shown mirrored.
- The lesson tracks the right hip, knee and ankle (MediaPipe landmarks 24, 26, 28) and drives only `thigh.R` and `shin.R`. The whole leg must be in view, so the visitor stands further back than for the elbow lesson.
- Facing the camera, the heel moves away from it. The tracker estimates that depth from a single camera; the upgraded tracker restores it from the calibrated shin length, which the tracking test checks with a synthetic person. Live accuracy still needs checking on the real equipment.
