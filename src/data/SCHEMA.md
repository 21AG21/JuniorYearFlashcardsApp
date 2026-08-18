# Deck file contract

One JSON file per chunk, written to `data/chunks/<name>.json`. Top level:

{
  "course": "chem" | "calcbc" | "apush" | "lang" | "french",
  "cards": [ Card, ... ]
}

Card:
{
  "u":    "u3",                 // unit id, must exist in the course's unit list
  "t":    "3.4",                // CED topic code or short topic label (string, may be "")
  "v":    "DEFINE",             // ACTION VERB, uppercase, one of the allowed list below
  "q":    "front text",         // the prompt. Imperative/interrogative. No answer leakage.
  "a":    "back text",          // the answer. Complete but tight.
  "hint": "→ two-word format cue" | null,   // what SHAPE the answer takes; never the answer
  "note": "one sentence of exam insight" | null,  // why it matters / classic trap. <=180 chars
  "core": true|false,           // true for the ~25% highest-yield cards
  "alt":  ["accepted alt answer", ...] | null   // optional short alternates for type-in checking
}

## Allowed verbs (pick the truest one)
DEFINE, IDENTIFY, STATE, EXPLAIN, CONTRAST, RECALL, TRANSLATE, CONJUGATE, DIFFERENTIATE,
INTEGRATE, EVALUATE, COMPUTE, DERIVE, PREDICT, BALANCE, RANK, DATE, NAME, DECIDE, APPLY

## Math markup
Prefer Unicode: ² ³ ⁿ √ ∫ Σ Π π θ Δ ∞ → ± ≤ ≥ ≠ · × ≈ ° ⇌ ⁻ ⁺ ½ ⅓ ¼
For real fractions / bounded operators, use inline `$...$` with THIS SUBSET ONLY:
  \frac{a}{b}  \sqrt{x}  x^{2}  a_{n}  \int_{a}^{b}  \sum_{n=1}^{\infty}  \lim_{x \to a}
  \pi \theta \Delta \infty \to \pm \le \ge \ne \cdot \times \approx \ln \log \sin \cos \tan
  \sec \csc \cot \arcsin \arctan \left( \right) \, \;
Nothing else. No \begin{}, no \text{}, no \displaystyle, no matrices, no \mathrm.
Example: "$\lim_{x \to 0} \frac{\sin x}{x} = 1$"

## Style rules
- Front is a task, not a topic. "State the Mean Value Theorem" not "MVT".
- Back is self-contained: a student who reads only the back learns the fact.
- No card longer than ~320 chars on the back.
- No duplicate fronts within a course.
- Plain ASCII quotes. Valid JSON, UTF-8, no trailing commas, no comments.
- Accents required and correct for French.
