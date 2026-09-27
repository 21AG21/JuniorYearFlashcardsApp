#!/usr/bin/env python3
"""Builds out/test-chem-u2.json: the unit test for AP Chemistry unit 2 (compound structure and properties).
Every number in a stem, a key or a distractor was computed with python (see the calc notes beside each group)."""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'test-chem-u2.json')
MC, FR = [], []


def Q(q, ch, a, n, lv, ty, t, s):
    assert len(ch) == 4
    return {'q': q + '\n' + '\n'.join(f'({L}) {c}' for L, c in zip('ABCD', ch)),
            'a': a, 'n': n, 'lv': lv, 'ty': ty, 't': t, 's': s}


def G(stim, *qs):
    MC.append({'stem': stim, 'parts': list(qs)})


# ---------------------------------------------------------------- group 1: the period 3 chlorides
# calc: dEN NaCl 2.23, MgCl2 1.85, AlCl3 1.55, SiCl4 1.26, PCl3 0.97, BeCl2 1.59
#       mp/dEN: 359, 386, 124 (not proportional; in kelvin 482, 534, 300)
G("A student collects data on the chlorides of the period 3 elements sodium through phosphorus. For each compound she "
  "records the electronegativity difference between the two elements (ΔEN, Pauling scale), the melting point, and "
  "whether the liquid compound conducts electricity.\n"
  "Compound · ΔEN · melting point (°C) · liquid conducts electricity?\n"
  "NaCl · 2.23 · 801 · yes, well\n"
  "MgCl₂ · 1.85 · 714 · yes, well\n"
  "AlCl₃ · 1.55 · 192* · no, very poorly\n"
  "SiCl₄ · 1.26 · −69 · no\n"
  "PCl₃ · 0.97 · −94 · no\n"
  "*Measured under pressure; at 1 atm, solid AlCl₃ turns directly into vapor at 180 °C.\n"
  "Electronegativities: Na 0.93, Mg 1.31, Al 1.61, Si 1.90, P 2.19, Cl 3.16.",
  Q("Which conclusion is best supported by the data?",
    ["Every compound of a metal with a nonmetal has ionic bonding, as the chlorides of Na, Mg and Al all show.",
     "The melting point is proportional to ΔEN, so the ΔEN of a chloride is enough to predict its melting point.",
     "AlCl₃ is ionic, because its ΔEN is larger than the ΔEN of SiCl₄ or PCl₃, which are both molecular.",
     "ΔEN falls steadily along the series, but the properties change abruptly between MgCl₂ and AlCl₃."],
    "(D). ΔEN drops by similar steps from NaCl to PCl₃ (2.23, 1.85, 1.55, 1.26, 0.97), yet the properties split into "
    "two groups: NaCl and MgCl₂ melt above 700 °C and conduct as liquids (mobile ions, so ionic), while AlCl₃, SiCl₄ and "
    "PCl₃ melt or vaporize below 200 °C and their liquids do not conduct (no ions, so molecular). Bond character "
    "changes along a continuum, but the properties show where the compounds behave as ionic or as molecular. (A) is "
    "refuted by aluminum, a metal whose chloride has the low melting point and nonconducting liquid of a molecular "
    "substance. (B) fails on the numbers: 801/2.23 = 359 but 714/1.85 = 386 and 192/1.55 = 124, so the ratio is not "
    "constant, and melting point falls by only 87 °C from NaCl to MgCl₂ but by more than 500 °C from MgCl₂ to AlCl₃. "
    "(C) ranks AlCl₃ correctly by ΔEN but ignores its own properties: a liquid that does not conduct has no mobile ions.",
    "2.1.A.3 and 2.1.A.4 (topic 2.1), skill 6.B. Thinking: read both kinds of evidence, the steady ΔEN trend and the "
    "abrupt change in properties, and state what they show together. Trap: (A), the metal-plus-nonmetal rule, which "
    "AlCl₃ breaks.",
    'analyze', 'data', '2.1', '6.B'),
  Q("Another student uses the rule 'a bond is ionic only if ΔEN is greater than 2.0' and concludes that MgCl₂ is a "
    "molecular compound with covalent bonds. Which of the following best evaluates the conclusion?",
    ["It is correct, because the ΔEN of MgCl₂ is 1.85, below the 2.0 cutoff, so the Mg–Cl bonds are polar covalent.",
     "It is incorrect, because Mg is a metal and Cl is a nonmetal, and every compound of a metal and a nonmetal is ionic.",
     "It is incorrect, because MgCl₂ melts at 714 °C and its liquid conducts well, which is how an ionic solid behaves.",
     "It is correct, because MgCl₂ melts about 90 °C lower than NaCl does, which shows that its bonds are less ionic."],
    "(C). The properties of a compound are the best evidence of its bonding. A molecular compound held together by "
    "attractions between molecules melts far lower than 714 °C, and its liquid contains no ions to carry a current; "
    "MgCl₂'s high melting point and conducting liquid are the behavior of a lattice of ions. A ΔEN cutoff is a rough "
    "guide, and bond character is a continuum, so a line at 2.0 misclassifies MgCl₂. (A) follows the rule mechanically "
    "and ignores the measurements. (B) reaches the right verdict with a rule the same table refutes: aluminum is also a "
    "metal, yet AlCl₃ behaves as a molecular substance. (D) reads too much into a small difference: 714 °C is still high, "
    "and the liquid conducts; a slightly lower melting point does not make the compound molecular.",
    "2.1.A.4 (topic 2.1), skill 6.D. Thinking: weigh a classification rule against the measured properties, which "
    "outrank it. Trap: (B), the right verdict from the metal-plus-nonmetal rule, which the AlCl₃ row refutes.",
    'evaluate', 'claim', '2.1', '6.D'),
  Q("Beryllium chloride, BeCl₂ (electronegativity of Be = 1.57), has ΔEN = 1.59, between the values for MgCl₂ and "
    "AlCl₃. Which observation, if it were made, would be the strongest evidence that the bonding in BeCl₂ is mainly "
    "covalent rather than ionic?",
    ["BeCl₂ dissolves in water, and the solution conducts electricity well.",
     "When it is melted, BeCl₂ conducts electricity only very poorly.",
     "BeCl₂ is a white crystalline solid at room temperature.",
     "The ΔEN of BeCl₂ is smaller than that of MgCl₂, which is ionic."],
    "(B). A liquid made of ions conducts, because the ions are free to move; a liquid that barely conducts contains few "
    "ions, so it is made of molecules held together by covalent bonds, the same test that separates MgCl₂ from AlCl₃ in "
    "the table. (A) does not discriminate: ionic compounds dissolve to give conducting solutions, and many covalent "
    "compounds, such as HCl, react with water to form ions too. (C) fits both kinds of solid: NaCl is also a white "
    "crystalline solid. (D) is a calculation, not an observation, and the table already shows that ΔEN alone does not "
    "fix the type of bonding; 1.59 lies in the range where the chlorides change behavior.",
    "2.1.A.4 (topic 2.1), skill 2.C. Thinking: choose the observation whose result differs for an ionic and a covalent "
    "compound. Trap: (A), solution conductivity, which ionic and some covalent compounds share.",
    'evaluate', 'design', '2.1', '2.C'),
  Q("Two students explain why the electronegativity of the element bonded to chlorine increases from Na to P.\n"
    "Student 1: 'Across the period the atoms have more valence electrons, so they are closer to a full octet and want "
    "extra electrons more.'\n"
    "Student 2: 'Across the period the nuclear charge increases while the bonding electrons stay in the third shell, "
    "shielded by the same ten inner electrons, so the nucleus attracts them more strongly.'\n"
    "Which of the following best evaluates the two explanations?",
    ["Only Student 2 is correct, because the nucleus's Coulombic pull on the bonding electrons explains the trend.",
     "Only Student 1 is correct, because an atom's need to complete its octet is what sets how strongly it attracts "
     "electrons.",
     "Both students are correct, because they describe one effect: an atom with more valence electrons also has more "
     "protons.",
     "Neither student is correct, because atomic radius increases across a period, and a larger atom attracts "
     "electrons more."],
    "(A). Electronegativity is a Coulombic attraction: from Na (11 protons) to P (15 protons) the nuclear charge grows "
    "while the bonding electrons remain in the n = 3 shell behind the same 10 core electrons, so the net attraction "
    "grows and the radius shrinks. (B) gives a goal, not a cause: 'wanting' an octet is not a force, and the octet "
    "picture cannot say why P attracts electrons more than Na in the first place. (C) notices a true correlation, more "
    "protons along with more valence electrons, but calls Student 1's reasoning correct when only the nuclear charge "
    "explains the attraction. (D) has the radius trend backward: radius decreases across a period, and a larger radius "
    "would weaken the attraction.",
    "2.1.A.1 (topic 2.1), skill 6.D. Thinking: tell a physical cause (charge and distance in Coulomb's law) from a "
    "description of a goal. Trap: (C), which accepts the octet-desire explanation because it travels with the right "
    "trend.",
    'evaluate', 'compare', '2.1', '6.D'),
  )


# ---------------------------------------------------------------- group 2: potential-energy curves of the halogens
# calc: kJ per gram = E/M: F2 159/38.00 = 4.184; Cl2 243/70.90 = 3.427; Br2 1.208; I2 0.595
#       slip: x2 for two atoms -> F2 8.37; per-mole reading -> Cl2 243
#       BrCl: mean of 199 and 228 = 213.5 pm (measured 213.6); mean of 243 and 193 = 218
G("The graph described below shows potential energy as a function of the distance between the two nuclei for four "
  "halogen molecules: F₂, Cl₂, Br₂ and I₂. The x-axis is internuclear distance, from 0 to 400 pm; the y-axis is "
  "potential energy, from −300 to +300 kJ/mol, where zero means the two atoms are infinitely far apart. Each curve is "
  "steep and positive at short distances, falls to a single minimum, then rises gradually and levels off toward zero "
  "at large distances. The minima are:\n"
  "Molecule · distance at the minimum (pm) · potential energy at the minimum (kJ/mol)\n"
  "F₂ · 142 · −159\n"
  "Cl₂ · 199 · −243\n"
  "Br₂ · 228 · −193\n"
  "I₂ · 267 · −151\n"
  "Molar masses (g/mol): F₂ 38.00, Cl₂ 70.90, Br₂ 159.80, I₂ 253.80.",
  Q("Separate 1.00 g samples of each of the four gases are to be converted completely into atoms. Which sample requires "
    "the most energy, and about how much?",
    ["Cl₂, 3.43 kJ", "F₂, 4.18 kJ", "Cl₂, 243 kJ", "F₂, 8.37 kJ"],
    "(B). The depth of each well is the bond energy per mole of molecules, so the energy per gram is (bond energy) ÷ "
    "(molar mass): F₂ 159 ÷ 38.00 = 4.18 kJ/g, Cl₂ 243 ÷ 70.90 = 3.43 kJ/g, Br₂ 193 ÷ 159.80 = 1.21 kJ/g and I₂ 151 ÷ "
    "253.80 = 0.595 kJ/g. F₂ wins because a gram of it holds almost twice as many molecules as a gram of Cl₂, which more "
    "than makes up for its weaker bond. (A) compares the samples mole for mole: Cl₂ has the deepest well, but a gram of "
    "Cl₂ is only 0.0141 mol. (C) reads the well depth as the energy for the sample, forgetting that 243 kJ is for a whole "
    "mole. (D) doubles the right value because each molecule gives two atoms, but breaking one bond releases both atoms.",
    "2.2.A.1 (topic 2.2), skill 5.F. Thinking: convert a per-mole bond energy to a per-gram energy, and see that the "
    "ranking changes. Trap: (A), ranking by the deepest well without converting grams to moles.",
    'apply', 'data', '2.2', '5.F'),
  Q("A student states: 'A shorter bond is always a stronger bond, so F₂ has the strongest bond of the four molecules.' "
    "Which of the following best evaluates the statement?",
    ["It is supported, because the F₂ curve has its minimum at the shortest distance, and that position shows how strong "
     "the bond is.",
     "It is supported, because fluorine is the most electronegative element, so it holds a shared pair of electrons "
     "most tightly.",
     "It is refuted, because the data show that bond energy increases steadily as bond length increases across the four "
     "molecules.",
     "It is refuted, because F₂ has the shortest bond but a shallower well than Cl₂ or Br₂, so length alone does not set "
     "strength."],
    "(D). On a potential-energy curve, the position of the minimum is the bond length and its depth is the bond energy. "
    "F₂ has the shortest bond (142 pm) but a well only 159 kJ/mol deep, shallower than Cl₂ (243) and Br₂ (193). 'Shorter "
    "is stronger' is reliable when bond order changes between the same two atoms (C–C, C=C, C≡C); across different "
    "elements, bond length alone does not predict bond energy. (A) reads the wrong feature of the graph: the position of "
    "the minimum gives length, not strength. (B) states a true fact about fluorine that the bond energies contradict. "
    "(C) overcorrects: from Cl₂ to Br₂ to I₂ the bonds get longer and weaker, so energy does not rise with length.",
    "2.2.A.1 and 2.2.A.2 (topic 2.2), skill 5.D. Thinking: read length from the position of each minimum and energy "
    "from its depth, then test the rule against all four molecules. Trap: (A), taking the position of the minimum as "
    "the bond strength.",
    'evaluate', 'claim', '2.2', '5.D'),
  Q("The bond energy of BrCl is 216 kJ/mol. If the potential-energy curve of BrCl were added to the graph, where would "
    "its minimum lie, and why?",
    ["Near 214 pm, because bond length reflects the sizes of the two bonded atoms, here one Cl and one Br.",
     "Near 214 pm, because a bond's length is fixed by its bond energy, and 216 kJ/mol lies between the Cl₂ and Br₂ "
     "values.",
     "Near 199 pm, because the more electronegative Cl atom pulls the shared pair toward itself and so sets the bond "
     "length.",
     "Near 267 pm, because a polar bond is weaker than a nonpolar bond, and a weaker bond is always a longer bond."],
    "(A). A single bond's length depends on the sizes of the two atoms it joins. Half of the Cl–Cl distance, 99.5 pm, "
    "plus half of the Br–Br distance, 114 pm, gives about 214 pm (the measured value is 214 pm). (B) has the right "
    "number but a false reason: the table shows that bond energy does not fix length, since F₂ has the shortest bond "
    "yet a weaker bond than Cl₂. (C) makes the more electronegative atom set the length, but electronegativity sets which "
    "atom carries the partial negative charge, not how far apart the nuclei sit; the larger Br atom stretches the bond "
    "beyond 199 pm. (D) chains two false rules: BrCl is not weaker than I₂'s 151 kJ/mol bond, and weaker bonds are not "
    "always longer (compare F₂ and I₂).",
    "2.2.A.2 (topic 2.2), skill 4.A. Thinking: predict a bond length from the sizes of the two bonded atoms, and reject a "
    "reason the data refute. Trap: (B), the right estimate reached by assuming energy fixes length.",
    'analyze', 'predict', '2.2', '4.A'),
  Q("Natural bromine is a mixture of ⁷⁹Br and ⁸¹Br atoms. How would the potential-energy curve for molecules made only "
    "of ⁸¹Br atoms compare with the Br₂ curve described above?",
    ["Its minimum would be deeper, because heavier nuclei attract the shared electrons more strongly.",
     "Its minimum would lie at a greater distance, because atoms with more neutrons are larger atoms.",
     "It would be essentially the same, because neutrons carry no charge and do not change the attractions.",
     "It would be essentially the same, because the two isotopes have equal masses once electrons are counted."],
    "(C). The curve is set by Coulombic interactions: the attraction of each nucleus for the electrons and the "
    "repulsions between the nuclei and between the electrons. ⁷⁹Br and ⁸¹Br have the same nuclear charge (35+) and the "
    "same electrons; the two extra neutrons are uncharged, so the curve is essentially unchanged. (A) confuses mass with "
    "charge: a heavier nucleus with the same number of protons attracts the electrons no more strongly. (B) supposes "
    "that neutrons swell the atom, but an atom's size is set by its electrons and nuclear charge, not by the nucleus's "
    "mass. (D) has the right prediction for a false reason: the isotopes differ in mass by about 2 u, and electrons do "
    "not make up the difference.",
    "2.2.A.1 and 2.2.A.3 (topic 2.2), skill 4.A. Thinking: identify what sets the shape of the curve (charges and "
    "distances) and check whether the change touches it. Trap: (A), treating a heavier nucleus as a stronger attractor.",
    'analyze', 'counter', '2.2', '4.A'),
  )


# ---------------------------------------------------------------- group 3: lattice energies and Coulomb's law
# calc: r = sum of radii: LiF 209, NaCl 283, MgO 212, CaO 240, BaO 275
#       LiF vs MgO: predicted 4 x 209/212 = 3.94, measured 3795/1036 = 3.66 (radii differ by 1.4%)
#       NaCl vs CaO: 283 vs 240 (15% apart) and charges differ
#       student (cation radius only): (4/72)/(4/135) = 1.88; centers: 275/212 = 1.30; measured 3795/3029 = 1.25
#       r^2 slip: (135/72)^2 = 3.52
G("The table gives ionic radii and lattice energies for five ionic solids. The lattice energy is the energy needed to "
  "separate one mole of the solid into its gaseous ions. For two ions, Coulomb's law gives the energy of attraction "
  "as E ∝ q₁q₂/r, where q₁ and q₂ are the charges of the ions and r is the distance between their centers.\n"
  "Compound · cation radius (pm) · anion radius (pm) · lattice energy (kJ/mol)\n"
  "LiF · 76 · 133 · 1036\n"
  "NaCl · 102 · 181 · 786\n"
  "MgO · 72 · 140 · 3795\n"
  "CaO · 100 · 140 · 3414\n"
  "BaO · 135 · 140 · 3029",
  Q("A student wants to use two compounds from the table to show the effect of ionic charge alone on lattice energy. "
    "Which pair should she compare?",
    ["NaCl and MgO", "MgO and BaO", "NaCl and CaO", "LiF and MgO"],
    "(D). To isolate charge, the two compounds must differ in charge but not in the distance between ion centers. LiF "
    "(76 + 133 = 209 pm) and MgO (72 + 140 = 212 pm) differ in distance by only 1.4%, while the charge product rises "
    "from 1 to 4; Coulomb's law predicts a ratio of 4 × 209/212 = 3.9, and the measured ratio is 3795/1036 = 3.7. (A) "
    "gives the largest change in lattice energy, but the distance also changes, from 283 to 212 pm, so the effects of "
    "charge and size are mixed together. (B) holds charge constant and varies size, the opposite of what is wanted. (C) "
    "also changes both variables: 283 pm for NaCl against 240 pm for CaO.",
    "2.2.A.3 (topic 2.2), skill 2.C. Thinking: pick the comparison that changes one variable while holding the other "
    "fixed. Trap: (A), the pair with the biggest difference in lattice energy.",
    'evaluate', 'design', '2.2', '2.C'),
  Q("A student tests Coulomb's law against the data for MgO and BaO:\n"
    "'E ∝ q₁q₂/r. For MgO, (2)(2)/72 = 0.0556. For BaO, (2)(2)/135 = 0.0296. Predicted ratio for MgO : BaO = 1.88. "
    "Measured ratio = 3795/3029 = 1.25. Because 1.88 is far from 1.25, Coulomb's law does not describe these solids.'\n"
    "Which of the following identifies the flaw in the student's reasoning?",
    ["She should have used the sum of the charges, 2 + 2 = 4, rather than their product, in each expression.",
     "She should have used the distance between ion centers, 212 pm and 275 pm, which predicts a ratio of 1.30.",
     "She should have divided by r², because an attraction falls off with the square of the distance between charges.",
     "Her method is sound; the law fails here because Ba²⁺ has many more electrons shielding its nuclear charge."],
    "(B). In Coulomb's law r is the distance between the centers of the two ions, the sum of the cation and anion radii: "
    "72 + 140 = 212 pm for MgO and 135 + 140 = 275 pm for BaO. The predicted ratio is then (4/212)/(4/275) = 275/212 = "
    "1.30, close to the measured 1.25, so the law describes the trend well. Using the cation radius alone exaggerates "
    "the size effect. (A) changes nothing: both compounds have charges of +2 and −2, so any consistent use of the charges "
    "cancels in the ratio. (C) treats the energy expression as a force: the equation given is E ∝ q₁q₂/r, and using r² "
    "with the cation radii would give (135/72)² = 3.52, even further from 1.25. (D) keeps the error and blames the ion: "
    "the Ba²⁺ ion's inner electrons are already accounted for in its net charge of +2.",
    "2.2.A.3 and 2.3.A.1 (topic 2.3), skill 5.B. Thinking: check each quantity substituted into the equation against its "
    "definition. Trap: (D), which accepts the faulty calculation and blames the law.",
    'evaluate', 'error', '2.3', '5.B'),
  Q("A student is asked to draw a two-dimensional slice of solid CaO containing 16 ions. Which description matches a "
    "drawing that is consistent with the data and with Coulomb's law?",
    ["Equal numbers of Ca²⁺ and O²⁻, alternating so every ion's nearest neighbors have the opposite charge; the Ca²⁺ "
     "circles are the larger ones",
     "Equal numbers of Ca²⁺ and O²⁻ in alternating rows, so that along its row each ion sits between two ions of the same "
     "charge",
     "Equal numbers of Ca²⁺ and O²⁻, alternating so every ion's nearest neighbors have the opposite charge; the O²⁻ "
     "circles are the larger ones",
     "Separate CaO units, each a Ca atom and an O atom sharing a pair of electrons, packed side by side with gaps between "
     "the units"],
    "(C). The formula CaO requires equal numbers of the two ions. Alternating the ions so each is surrounded by ions of "
    "opposite charge maximizes attractions and minimizes repulsions, and the radii in the table (Ca²⁺ 100 pm, O²⁻ 140 "
    "pm) require the oxide ions to be drawn larger. (A) has the right arrangement but reverses the sizes, assuming the "
    "atom with more protons makes the bigger ion; Ca²⁺ has lost its outer shell, while O²⁻ has gained electrons. (B) "
    "places like charges side by side along every row, which Coulomb's law makes unfavorable. (D) draws a molecular "
    "substance with shared electrons, which cannot account for a lattice energy of 3414 kJ/mol between ions of charge "
    "+2 and −2.",
    "2.3.A.1 (topic 2.3), skill 3.C. Thinking: build the particulate picture from the formula, the ionic radii and "
    "Coulomb's law. Trap: (A), drawing the calcium ion larger because calcium has more protons.",
    'apply', 'data', '2.3', '3.C'),
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
    t = {'course': 'chem', 'unit': 'u2', 'minutes': 90, 'calc': True,
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
