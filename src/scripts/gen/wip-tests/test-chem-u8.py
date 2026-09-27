#!/usr/bin/env python3
"""Builds out/test-chem-u8.json: the unit test for AP Chemistry unit 8 (acids and bases).
Every number in a stem, a key or a distractor was computed with python (see the calc notes beside each group;
the full-curve titration values came from charge-balance solutions, scratchpad/calc8/g3.py and s3.py).
Exclusions honoured: no computed pH change on adding acid or base to a buffer (8.9); no H-H derivation (8.9);
no computed species concentrations along a polyprotic titration curve, only qualitative species reasoning (8.5);
no solubility computed as a function of pH (8.11).
Systems used in the unit's existing sets and FRQs (the 0.305 g unknown acid, the ammonia buffer, HOCl/HOBr, the
unknown weak base B, the pKa 5.00 particle-diagram acid, the diprotic H2A curve, HCl/NaOH with Kw at 50 C) are avoided."""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'test-chem-u8.json')
MC, FR = [], []


def Q(q, ch, a, n, lv, ty, t, s):
    assert len(ch) == 4
    return {'q': q + '\n' + '\n'.join(f'({L}) {c}' for L, c in zip('ABCD', ch)),
            'a': a, 'n': n, 'lv': lv, 'ty': ty, 't': t, 's': s}


def G(stim, *qs):
    MC.append({'stem': stim, 'parts': list(qs)})


# ---------------------------------------------------------------- group 1: diluting a strong and a weak acid
# calc: Ka(HZ) = 1.3e-5 (exact quadratic). 0.100 M: [H3O+] 1.13e-3, pH 2.95, 1.13 %; 0.0100 M: 3.54e-4, pH 3.45, 3.5 %;
#       0.00100 M: 1.08e-4, pH 3.97, 10.8 %. From the table: $10^{-2.95}$ = 1.12e-3, $10^{-3.97}$ = 1.07e-4 (about tenfold drop
#       over a hundredfold dilution).
#       NaOH to equivalence, 25.0 mL samples, 0.100 M NaOH: HCl 0.00100 M -> 2.5e-5 mol -> 0.25 mL;
#       HZ 0.100 M -> 2.5e-3 mol -> 25.0 mL; 'ionized part only' 1.13 % of 2.5e-3 mol -> 2.8e-5 mol -> 0.28 mL
G("A student prepares 0.100 M solutions of hydrochloric acid, HCl, and of an unknown monoprotic acid, HZ. She dilutes "
  "each one tenfold, and then tenfold again, with distilled water, and measures the pH of every solution at 25 °C with "
  "a calibrated pH meter.\n"
  "Concentration of acid (M) · pH of HCl solution · pH of HZ solution\n"
  "0.100 · 1.00 · 2.95\n"
  "0.0100 · 2.00 · 3.45\n"
  "0.00100 · 3.00 · 3.97",
  Q("Which conclusion about HZ is best supported by the data?",
    ["HZ is a strong acid, but its stock solution was less concentrated than labeled, because its pH is higher than that "
     "of HCl at every concentration.",
     "HZ is a weak acid, and the fraction of HZ molecules that ionize decreases as the solution is diluted, because its "
     "pH rises with each dilution.",
     "HZ is a weak acid, and the fraction of HZ molecules that ionize increases as the solution is diluted, because its "
     "pH rises by only about 0.5 per dilution.",
     "HZ becomes about as strong an acid as HCl when it is very dilute, because the gap between the two pH values "
     "narrows with each dilution."],
    "(C). If the fraction ionized stayed the same, a tenfold dilution would lower [H₃O⁺] tenfold and raise the pH by "
    "1.00, as it does for HCl. The pH of HZ rises by only 0.50 and then 0.52, so [H₃O⁺] falls by a factor of only about "
    "3 each time: the fraction ionized grows, from $10^{-2.95}$ ÷ 0.100 = 1.1% to $10^{-3.97}$ ÷ 0.00100 = 10.7%. That is the "
    "behavior of a weak acid, whose ionization equilibrium shifts toward the ions on dilution. (A) cannot explain the "
    "pattern: a strong acid at any concentration would still rise by 1.00 per tenfold dilution. (B) reads a rising pH as "
    "a shrinking fraction ionized; the pH rises because the acid is more dilute, but it rises by less than 1.00, which "
    "means the fraction ionized increases. (D) over-reads the narrowing gap: at 0.00100 M, HZ is still only about 11% "
    "ionized, and its pH is almost a full unit above that of HCl.",
    "8.3.A.1 and 8.3.A.5 (topic 8.3), skill 6.B. Thinking: compare the pH change per tenfold dilution with the 1.00 unit "
    "a fully ionized acid would show, and turn the difference into a trend in percent ionization. Trap: (B), reading "
    "'pH goes up' as 'less ionization'.",
    'analyze', 'data', '8.3', '6.B'),
  Q("A student explains the HZ results this way: 'Diluting HZ shifts its ionization equilibrium toward the ions, so "
    "[H₃O⁺] rises when the solution is diluted.' Which of the following best evaluates the explanation?",
    ["It is correct: dilution makes Q less than Ka, and the net forward reaction that follows raises [H₃O⁺] above its "
     "value before the dilution.",
     "The shift is real but only partly offsets the dilution: over the two dilutions, [H₃O⁺] still falls, from about "
     "1.1 × 10⁻³ M to 1.1 × 10⁻⁴ M.",
     "It is incorrect: Ka is a constant, so diluting the solution cannot shift the equilibrium, and the fraction of HZ "
     "that is ionized stays the same.",
     "It is incorrect: dilution shifts the equilibrium toward un-ionized HZ, because it lowers the concentrations of "
     "H₃O⁺ and Z⁻, the products."],
    "(B). Dilution lowers [H₃O⁺], [Z⁻] and [HZ] by the same factor, and because the numerator of Q = [H₃O⁺][Z⁻]/[HZ] has "
    "two concentration terms, Q drops below Ka. Net ionization follows, so the fraction ionized rises, but the shift "
    "only partly restores [H₃O⁺]. The data show it: [H₃O⁺] = $10^{-2.95}$ = 1.1 × 10⁻³ M at 0.100 M and $10^{-3.97}$ = 1.1 × "
    "10⁻⁴ M at 0.00100 M, a tenfold fall over a hundredfold dilution. (A) takes the shift further than equilibrium "
    "allows; a shift that could raise [H₃O⁺] above its starting value would overshoot K, and the pH values rise, not "
    "fall. (C) confuses a constant K with a constant composition; Ka stays the same, but Q changes when the solution is "
    "diluted, and the fraction ionized changes with it. (D) has the direction backward: lowering the concentrations of "
    "the products makes Q smaller than K, which drives the reaction toward the products.",
    "8.3.A.2 and 8.3.A.5 (topic 8.3), skill 6.D. Thinking: separate the direction of the shift from its size, and check "
    "the size against the measured pH. Trap: (A), because 'the equilibrium shifts toward H₃O⁺' sounds like 'more H₃O⁺'.",
    'evaluate', 'claim', '8.3', '6.D'),
  Q("The student next titrates a 25.0 mL sample of 0.00100 M HCl and a 25.0 mL sample of 0.100 M HZ, each with 0.100 M "
    "NaOH. The two samples start at nearly the same pH, 3.00 and 2.95. Which prediction about the volume of NaOH needed "
    "to reach each equivalence point is correct?",
    ["The same volume for both, because the two samples start with nearly the same concentration of H₃O⁺ and NaOH "
     "reacts with H₃O⁺.",
     "More for the HCl than for the HZ, because HCl gives up all of its protons while HZ gives up only about 1% of its "
     "protons.",
     "The same volume for both, although the HZ titration reaches its equivalence point at a pH above 7 rather than at "
     "7.00.",
     "About 0.25 mL for the HCl and 25.0 mL for the HZ, because as OH⁻ removes H₃O⁺, more HZ ionizes, until all of it "
     "has reacted."],
    "(D). NaOH reacts with all of the acid, not only the part that is ionized at the start: as OH⁻ removes H₃O⁺, "
    "the HZ equilibrium shifts to replace it, and the weak acid reacts essentially completely with the strong base. The "
    "HCl sample holds 0.0250 L × 0.00100 M = 2.5 × 10⁻⁵ mol of acid and needs 0.25 mL of 0.100 M NaOH; the HZ sample "
    "holds 2.5 × 10⁻³ mol and needs 25.0 mL, a hundred times as much. (A) counts only the H₃O⁺ present at the start, "
    "which would give about 0.28 mL for HZ as well. (B) turns 'strong' into 'more protons to neutralize'; the amount of "
    "base depends on the moles of acid, and the HZ sample has a hundred times more. (C) is right that the HZ titration "
    "ends above pH 7, because Z⁻ is a weak base, but that true statement does not rescue the equal-volume prediction.",
    "8.5.A.2 and 8.4.A.2 (topic 8.5), skill 6.D. Thinking: separate the pH of a solution, which reflects ionized acid, "
    "from the amount of base it consumes, which reflects all of the acid. Trap: (A), equal pH read as equal acid.",
    'analyze', 'predict', '8.5', '6.D'),
  )


# ---------------------------------------------------------------- group 2: chlorine position and halogen identity in carboxylic acids
# calc: Ka = 10^-pKa: butanoic 1.51e-5, 2-Cl 1.38e-3. Kb of the anions = Kw/Ka: butanoate 6.6e-10, 2-chlorobutanoate
#       7.2e-12. 0.10 M salts: [OH-] = sqrt(Kb x 0.10): 8.1e-6 -> pH 8.91; 8.5e-7 -> pH 7.93 (exact with water 7.93)
G("The table gives pKa values at 25 °C for some carboxylic acids. In each name, the number is the carbon atom that "
  "carries the halogen, counting the carbon of the –COOH group as carbon 1. Pauling electronegativities: F 4.0, Cl 3.2, "
  "Br 3.0, I 2.7.\n"
  "Acid · condensed formula · pKa\n"
  "butanoic acid · CH₃CH₂CH₂COOH · 4.82\n"
  "4-chlorobutanoic acid · ClCH₂CH₂CH₂COOH · 4.52\n"
  "3-chlorobutanoic acid · CH₃CHClCH₂COOH · 4.05\n"
  "2-chlorobutanoic acid · CH₃CH₂CHClCOOH · 2.86\n"
  "fluoroacetic acid · FCH₂COOH · 2.59\n"
  "chloroacetic acid · ClCH₂COOH · 2.87\n"
  "bromoacetic acid · BrCH₂COOH · 2.90\n"
  "iodoacetic acid · ICH₂COOH · 3.18",
  Q("Which conclusion is best supported by the data for butanoic acid and the three chlorobutanoic acids?",
    ["A Cl atom strengthens the acid most when it is closest to the –COOH group, because its pull on electron density "
     "weakens with distance.",
     "A Cl atom strengthens the acid most when it is farthest from the –COOH group, because the pKa is highest when Cl "
     "is on carbon 4.",
     "A Cl atom weakens the acid wherever it is placed, because Cl donates electron density to the –COOH group through "
     "the carbon chain.",
     "The position of the Cl atom has little effect on acid strength, because all four compounds are weak acids with "
     "pKa values above 2."],
    "(A). Every chlorobutanoic acid has a lower pKa, and so a larger Ka, than butanoic acid, and the effect shrinks as "
    "Cl moves away from –COOH: the pKa drops by 1.96 units with Cl on carbon 2, by 0.77 on carbon 3 and by only 0.30 on "
    "carbon 4. Electronegative Cl pulls electron density through the chain and spreads out the negative charge of the "
    "carboxylate ion, stabilizing it; this inductive effect fades with each bond it passes through. (B) reads pKa as if "
    "a larger value meant a stronger acid; the highest pKa belongs to the weakest acid. (C) has the effect backward: "
    "every Cl compound is more acidic than butanoic acid, so Cl withdraws electron density. (D) is a true statement "
    "that ignores the data; the Ka values span a factor of about 90 ($10^{1.96}$), which is not a small effect.",
    "8.6.A.1 (topic 8.6), skill 6.C. Thinking: turn a pKa pattern into a structural explanation, the inductive effect "
    "and its fall-off with distance. Trap: (B), treating a higher pKa as a stronger acid.",
    'analyze', 'data', '8.6', '6.C'),
  Q("A student notes that HI is a much stronger acid than HF, and predicts that iodoacetic acid should therefore be a "
    "stronger acid than fluoroacetic acid. The data show the opposite. Which of the following best explains why the "
    "trend reverses?",
    ["The larger I atom spreads the charge of the carboxylate ion over a bigger volume, so ICH₂COOH should be the "
     "stronger acid, and the data must contain an error.",
     "In aqueous solution HF is actually a stronger acid than HI, because F⁻ is small and is held more strongly by "
     "the surrounding water molecules.",
     "In HX the H–X bond itself breaks, and it gets weaker as X gets larger; in XCH₂COOH an O–H bond breaks in every "
     "case, and X acts only by pulling electron density.",
     "In XCH₂COOH the acidic hydrogen atoms are those on the CH₂ carbon next to X, and a C–H bond is weakest when "
     "it is next to the most electronegative X."],
    "(C). The two trends measure different things. For a binary acid the proton leaves from the halogen itself, so "
    "bond strength and the size of X dominate, and HI is strongest. In every haloacetic acid the proton leaves the same "
    "O–H group, so the halogen affects acidity only through its electronegativity: F, the most electronegative, pulls "
    "most strongly and best stabilizes the carboxylate ion, giving the lowest pKa (2.59), while I gives the highest "
    "(3.18). (A) applies the size argument to the wrong atom: the negative charge sits on the carboxylate oxygens, not "
    "on I, so the size of I does not spread it. (B) states a false fact; HF is a weak acid in water and HI a strong one, "
    "which is what the student's premise says. (D) puts the acidic proton in the wrong place; the acidic hydrogen of a "
    "carboxylic acid is the one bonded to oxygen.",
    "8.6.A.1 (topic 8.6), skill 6.C. Thinking: ask which bond breaks in each family before carrying a trend from one "
    "family to another. Trap: (A), the size argument from binary acids applied to a charge that is not on the halogen.",
    'evaluate', 'compare', '8.6', '6.C'),
  Q("A student prepares 0.10 M solutions of sodium butanoate, NaCH₃CH₂CH₂COO, and sodium 2-chlorobutanoate, "
    "NaCH₃CH₂CHClCOO, at 25 °C. Which statement correctly compares the two solutions?",
    ["Sodium 2-chlorobutanoate has the higher pH, about 8.9 compared with 7.9, because a stronger acid has a stronger "
     "conjugate base.",
     "Sodium butanoate has the higher pH, about 8.9 compared with 7.9, because its anion is the conjugate base of the "
     "weaker acid.",
     "Both solutions have a pH of 7.00, because each salt is formed from a carboxylic acid and a strong base, NaOH, "
     "which neutralize each other.",
     "Sodium butanoate has the higher pH, because the Cl atom pushes electron density onto the –COO⁻ group of "
     "2-chlorobutanoate and makes it a better base."],
    "(B). Each anion is a weak base: A⁻ + H₂O ⇌ HA + OH⁻, with Kb = Kw/Ka. Butanoic acid is the weaker acid (Ka = "
    "$10^{-4.82}$ = 1.5 × 10⁻⁵), so butanoate has the larger Kb, 1.0 × 10⁻¹⁴ ÷ 1.5 × 10⁻⁵ = 6.6 × 10⁻¹⁰, giving [OH⁻] = "
    "√(6.6 × 10⁻¹⁰ × 0.10) = 8.1 × 10⁻⁶ M and pH 8.91. For 2-chlorobutanoate, Kb = 1.0 × 10⁻¹⁴ ÷ 1.38 × 10⁻³ = 7.2 × "
    "10⁻¹², so [OH⁻] = 8.5 × 10⁻⁷ M and pH 7.93. (A) reverses the conjugate relationship: the stronger the acid, the "
    "weaker its conjugate base. (C) treats every salt as neutral; the anion of a weak acid removes protons from water, "
    "so the solution is basic. (D) has the right comparison with the wrong reason: Cl pulls electron density away from "
    "–COO⁻, which is why 2-chlorobutanoate is the weaker base.",
    "8.3.A.6 and 8.6.A.1 (topic 8.3), skill 5.C. Thinking: connect structure to Ka, then Ka to the Kb of the conjugate "
    "base and to the pH of the salt. Trap: (A), 'strong acid, strong conjugate base'.",
    'apply', 'synthesis', '8.3', '5.C'),
  )


# ---------------------------------------------------------------- build
def build():
    k, out = 0, []
    for g in MC:
        a = k + 1
        k += len(g['parts'])
        stem = g['stem']
        if stem:
            stem = f'Questions {a}-{k} refer to the following.\n\n' + stem
        out.append({'stem': stem, 'parts': [{'l': str(a + i), 'p': 1, **p} for i, p in enumerate(g['parts'])]})
    t = {'course': 'chem', 'unit': 'u8', 'minutes': 90, 'calc': True,
         'intro': 'A periodic table and the AP Chemistry equations sheet are allowed, and a calculator may be used throughout.',
         'mc': out, 'fr': FR}
    json.dump(t, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    keys, longest = [], []
    for g in out:
        for p in g['parts']:
            L = p['a'][1]
            keys.append(L)
            ch = {c[1]: len(c[4:]) for c in p['q'].split('\n') if c[:1] == '(' and c[2:3] == ')'}
            if ch and ch[L] > max(v for x, v in ch.items() if x != L):
                longest.append(p['l'])
    print(len(keys), 'MC keys', ''.join(keys), {L: keys.count(L) for L in 'ABCD'}, 'longest-is-key', longest)


build()
