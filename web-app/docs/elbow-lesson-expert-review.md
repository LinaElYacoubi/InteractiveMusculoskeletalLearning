# Elbow lesson — Kinesiology review sheet

**Lesson:** Learn a movement / Apprendre un mouvement — bending and straightening the right elbow
**Content file:** `web-app/public/src/data/lessons/elbow-flexion.js` (version 0.1-draft, researched 2026-11-14)
**Overall status:** Pending review. Nothing below has been approved by the Kinesiology expert.

All sources are sections of *Anatomy and Physiology 2e* (Betts JG et al., OpenStax, 2022). Each section was read before use. App text paraphrases the sources rather than quoting them. Claim IDs match the keys in the content file. To record a decision, change that claim's `status` to `approved` or `needs-revision`.

## Claims and instructions

| ID | Draft claim or instruction (EN) | Source | Proposed highlight | Question for the expert | Status |
|---|---|---|---|---|---|
| `objective` | Recognize elbow flexion and extension, and name the main muscles that bend and straighten the elbow. | [9.5](https://openstax.org/books/anatomy-and-physiology-2e/pages/9-5-types-of-body-movements), [11.5](https://openstax.org/books/anatomy-and-physiology-2e/pages/11-5-muscles-of-the-pectoral-girdle-and-upper-limbs) | — | Is this objective appropriate and measurable for a short public activity? | Pending review |
| `startPosition` | Stand facing the screen with your arms relaxed by your sides. Keep your right upper arm close to your body and turn your right palm forward. | [1.6](https://openstax.org/books/anatomy-and-physiology-2e/pages/1-6-anatomical-terminology) (anatomical position: palms forward) | During "Try it yourself", the rest of the body is faded and the right humerus, ulna and radius are tinted, only to show which arm is tracked. | Is standing with the palm forward (supinated) the right starting position? Would neutral (thumb up) be better? The model's rest pose is supinated. | Pending review |
| `movement` | Slowly bend your right elbow to bring your hand toward your shoulder, as far as is comfortable. Then slowly straighten it. Keep your upper arm still. Stop if anything hurts. | [9.5](https://openstax.org/books/anatomy-and-physiology-2e/pages/9-5-types-of-body-movements) | — | Is the safety wording enough for the public? The demonstration animation flexes about 95°, not full range. Is that acceptable? | Pending review |
| `hinge` | The elbow works like a hinge between the humerus and the ulna. Flexion makes the angle between forearm and upper arm smaller; extension makes it larger. | [9.6](https://openstax.org/books/anatomy-and-physiology-2e/pages/9-6-anatomy-of-selected-synovial-joints), [9.5](https://openstax.org/books/anatomy-and-physiology-2e/pages/9-5-types-of-body-movements) | "Bones of the elbow": `Humerus.r`, `Ulna.r`, `Radius.r` | Is it acceptable to name only the humeroulnar joint and not the humeroradial joint, for simplicity? | Pending review |
| `rotation` | Turning the palm forward or backward (supination and pronation) happens where the radius rotates next to the ulna, not at the hinge. | [9.6](https://openstax.org/books/anatomy-and-physiology-2e/pages/9-6-anatomy-of-selected-synovial-joints), [9.5](https://openstax.org/books/anatomy-and-physiology-2e/pages/9-5-types-of-body-movements) | Same bone group as `hinge` | Is this simplification accurate enough? | Pending review |
| `flexors` | Biceps brachii, brachialis (deep to the biceps) and brachioradialis bend the elbow. The biceps also helps turn the palm forward. | [11.5](https://openstax.org/books/anatomy-and-physiology-2e/pages/11-5-muscles-of-the-pectoral-girdle-and-upper-limbs), [11.1](https://openstax.org/books/anatomy-and-physiology-2e/pages/11-1-interactions-of-skeletal-muscles-their-fascicle-arrangement-and-their-lever-systems) | "Elbow flexors": `Long head of biceps brachii.r`, `Short head of biceps brachii.r`, `Brachialis muscle.r`, `Brachioradialis muscle.r` | OpenStax 11.1 calls biceps brachii the prime mover and brachialis a synergist. Some clinical references describe brachialis as the main flexor. The visitor text deliberately avoids ranking them. Which framing do you prefer? Should pronator teres be added? (Its humeral and ulnar heads exist in the model.) | Pending review |
| `extensors` | Triceps brachii and anconeus straighten the elbow. Because the triceps has the opposite action to the biceps, it is called its antagonist. | [11.5](https://openstax.org/books/anatomy-and-physiology-2e/pages/11-5-muscles-of-the-pectoral-girdle-and-upper-limbs), [11.1](https://openstax.org/books/anatomy-and-physiology-2e/pages/11-1-interactions-of-skeletal-muscles-their-fascicle-arrangement-and-their-lever-systems) | "Elbow extensors": `Long head of triceps brachii.r`, `Lateral head of triceps brachii.r`, `Medial head of triceps brachii.r`, `Anconeus muscle.r` | Correct as worded? | Pending review |
| `lifting` | In this standing position, gravity pulls your forearm down. To lift your hand, the elbow flexors shorten as they contract: a concentric contraction. | [10.4](https://openstax.org/books/anatomy-and-physiology-2e/pages/10-4-nervous-system-control-of-muscle-tension), [11.5](https://openstax.org/books/anatomy-and-physiology-2e/pages/11-5-muscles-of-the-pectoral-girdle-and-upper-limbs) | None. No highlight is tied to movement phase. | OpenStax illustrates this with a hand weight. Is it correct for the unloaded forearm across the whole range? (The forearm's turning effect on the elbow is largest when the forearm is horizontal and smaller near full flexion.) | Pending review |
| `direction` | Movement direction alone does not tell you which muscles are working. When a hand weight is lowered slowly, the elbow flexors lengthen while still working to control it: an eccentric contraction. | [10.4](https://openstax.org/books/anatomy-and-physiology-2e/pages/10-4-nervous-system-control-of-muscle-tension) | None | See open question 1. | Pending review |

## Proposed highlight behaviour

- Matching uses the exact `anatomy_name` metadata in the GLB, and an automated test confirms every name exists. Only original right-sided geometry is used. If a name is missing, the lesson lists it as "not found" and never shows a substitute.
- In "Understand", the visitor picks one group at a time (flexors, extensors or bones). The chosen group is tinted and the rest of the body fades, except the elbow structures listed above.
- Highlights are static. They do not depend on demonstration phase, elbow angle, movement direction or the visitor's tracked motion. Each one is labelled "Proposed highlight, not yet reviewed. It shows where these structures are, not how active your muscles are."

## Live practice feedback (proposed, not yet reviewed)

During "Try it yourself", once the visitor has captured their starting position, the panel shows:

- **Your elbow bend (estimate):** 180° minus the camera-estimated angle at the right elbow (shoulder–elbow–wrist), smoothed, with a bar and a "Best so far" mark. Labelled "Estimated from the camera to help you practise. It is not a clinical measurement."
- **Form tip:** "Try to keep your upper arm by your side and let only your forearm move." It appears when the upper arm (shoulder→elbow) is more than **35°** away from the shoulder→hip line for 0.4 s, and clears once it is back under 27° for 0.4 s.

Questions for the expert: Is 35° a sensible limit, or should a little shoulder movement be allowed without a tip? Is showing a number in degrees helpful for the public, or would a simple bar be better?

## Learning question

**Question:** Standing with your upper arm by your side, you lift your hand toward your shoulder. Which muscles shorten to raise your forearm?

| Option | Answer | Proposed feedback |
|---|---|---|
| A | Elbow flexors at the front of the arm — **correct** | Lifting works against gravity, so biceps brachii, brachialis and brachioradialis shorten as they contract (concentric contraction). |
| B | Elbow extensors at the back of the arm | Triceps brachii and anconeus straighten the elbow. Bending it to lift the hand is flexion. |
| C | The muscles that turn the palm down | Pronator teres and pronator quadratus turn the palm. That rotation happens between the radius and ulna, not at the hinge. |

**Sources:** [10.4](https://openstax.org/books/anatomy-and-physiology-2e/pages/10-4-nervous-system-control-of-muscle-tension), [11.5](https://openstax.org/books/anatomy-and-physiology-2e/pages/11-5-muscles-of-the-pectoral-girdle-and-upper-limbs), [9.5](https://openstax.org/books/anatomy-and-physiology-2e/pages/9-5-types-of-body-movements)
**Question for the expert:** Is "shorten" acceptable wording for the public? Should option C name the pronators, or stay more general?
**Status:** Pending review.

## Open questions (left out of the visitor text because they could not be verified)

1. **Lowering the unloaded forearm.** When a standing visitor slowly straightens the elbow with no added weight, are the elbow flexors working eccentrically and the triceps mostly inactive? I could not read a source that states this directly, so the visitor text only describes the hand-weight example. A candidate source that I have **not** read (no abstract on PubMed): Basmajian JV, Latif A. *Integrated actions and functions of the chief flexors of the elbow: a detailed electromyographic analysis.* J Bone Joint Surg Am. 1957;39-A(5):1106–18. [PMID 13475410](https://pubmed.ncbi.nlm.nih.gov/13475410/).
2. **Forearm position and flexor contribution.** Does biceps or brachioradialis involvement change with palm position (supinated, neutral or pronated)? This is left out because the sources I read do not state it. Candidate sources not accessible during research: the StatPearls entries on the brachialis and the elbow joint (NCBI Bookshelf).
3. **French terminology.** Please confirm the preferred terms in Canadian French kinesiology teaching: *ulna* (rather than *cubitus*), *muscle brachio-radial* (rather than *long supinateur*), *muscle anconé*, *chef long / court / latéral / médial*.
4. **Accessibility.** Is the "use the demonstration instead" route a suitable alternative for visitors who cannot or prefer not to move?

## Technical notes for the team (not kinesiology claims)

- The visitor's right arm drives the model's right arm, with no side swap. The camera preview is shown mirrored, like a mirror.
- Elbow flexion with the arm at the side moves the forearm toward the camera. The tracker estimates that depth from a single camera, so live accuracy needs checking on the real equipment.
