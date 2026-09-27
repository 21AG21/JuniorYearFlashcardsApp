#!/usr/bin/env python3
"""Builds out/test-chem-u9.json: the unit test for AP Chemistry unit 9 (thermodynamics and electrochemistry).
Every number in a stem, a key or a distractor was computed with python (see the calc notes beside each group).
Exclusion honoured: no electrode is labelled positive or negative (9.8). Nernst reasoning is kept qualitative (9.10.A.4)."""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'test-chem-u9.json')
MC, FR = [], []


def Q(q, ch, a, n, lv, ty, t, s):
    assert len(ch) == 4
    return {'q': q + '\n' + '\n'.join(f'({L}) {c}' for L, c in zip('ABCD', ch)),
            'a': a, 'n': n, 'lv': lv, 'ty': ty, 't': t, 's': s}


def G(stim, *qs):
    MC.append({'stem': stim, 'parts': list(qs)})


# ---------------------------------------------------------------- group 1: solubility of KNO3 against temperature
# calc: data made from dH = +34.0 kJ/mol, dS = +118 J/(mol K); T0 = dH/dS = 288 K
#       T 343 333 323 313 303 -> s 3.11 2.60 2.15 1.76 1.42; Ksp 9.68 6.77 4.63 3.09 2.01; dG -6.47 -5.29 -4.11 -2.93 -1.75
#       slope -0.118 kJ/K -> dS +118; dH = -1.75 + 303(0.118) = +34.0; slips: slope as dS -> dH = -1.75 - 35.75 = -37.5;
#       Celsius 30 C -> -1.75 + 3.54 = +1.8; units -> 0.118 J
#       280 K: dG = +0.96 kJ, Ksp = 0.66, s = 0.81 M
#       salt Y: Ksp 2.6e-5 at 290 K, 1.0e-5 at 330 K -> dG +25.4, +31.6 kJ -> dS ~ -150 J/K, dH ~ -18 kJ
G("A student measures how the solubility of potassium nitrate changes with temperature. She dissolves 5.00 g of KNO₃ "
  "(101.10 g/mol) in a small volume of hot water in a large test tube, reads the volume of the solution, then lets it cool "
  "slowly while stirring with a thermometer and records the temperature at which crystals first appear. She then adds a "
  "little more water, redissolves the crystals and repeats. At the moment crystals appear the solution is saturated, so "
  "s = [K⁺] = [NO₃⁻] = (mol KNO₃) ÷ (volume of solution) and Ksp = s². She calculates ΔG° = −RT ln Ksp for each trial, "
  "with R = 8.314 J/(mol·K). The test tube feels cold whenever solid KNO₃ dissolves.\n"
  "Trial · T when crystals appear (K) · s (M) · Ksp · ΔG° (kJ/mol)\n"
  "1 · 343 · 3.11 · 9.68 · −6.47\n"
  "2 · 333 · 2.60 · 6.77 · −5.29\n"
  "3 · 323 · 2.15 · 4.63 · −4.11\n"
  "4 · 313 · 1.76 · 3.09 · −2.93\n"
  "5 · 303 · 1.42 · 2.01 · −1.75\n"
  "Assume that ΔH° and ΔS° for KNO₃(s) ⇌ K⁺(aq) + NO₃⁻(aq) do not change with temperature.",
  Q("Which values of ΔH° and ΔS° for the dissolving of KNO₃ are best supported by the data?",
    ["ΔH° = −37.5 kJ/mol and ΔS° = −118 J/(mol·K)",
     "ΔH° = +34.0 kJ/mol and ΔS° = +118 J/(mol·K)",
     "ΔH° = +1.8 kJ/mol and ΔS° = +118 J/(mol·K)",
     "ΔH° = +34.0 kJ/mol and ΔS° = +0.118 J/(mol·K)"],
    "(B). Because ΔG° = ΔH° − TΔS°, a graph of ΔG° against T is a straight line with slope −ΔS°. Every 10 K rise lowers "
    "ΔG° by 1.18 kJ/mol, so the slope is −0.118 kJ/(mol·K) and ΔS° = +118 J/(mol·K). Then ΔH° = ΔG° + TΔS° = −1.75 kJ/mol "
    "+ (303 K)(0.118 kJ/(mol·K)) = +34.0 kJ/mol, and every row gives the same value; the positive sign agrees with the "
    "cold test tube. (A) takes the slope itself as ΔS°, dropping the minus sign in −TΔS°, and then carries the wrong sign "
    "into ΔH°; a negative ΔH° also contradicts the cold test tube. (C) finds ΔS° correctly but puts the Celsius "
    "temperature, 30 °C, into ΔH° = ΔG° + TΔS°. (D) has the right ΔH° but reports the slope, which is in kJ/(mol·K), as "
    "if it were in J/(mol·K).",
    "9.3.A.5 and 9.2.A.1 (topic 9.3), skill 5.D. Thinking: see ΔG° = ΔH° − TΔS° as a straight line in T, read ΔS° from "
    "the slope and ΔH° from any row. Trap: (A), the slope taken as +ΔS°.",
    'analyze', 'data', '9.3', '5.D'),
  Q("A classmate extends the trend and says: 'Below about 288 K, ΔG° for dissolving KNO₃ is positive, so at 280 K no "
    "KNO₃ at all would dissolve in water.' Which of the following best evaluates the classmate's claim?",
    ["It is correct, because a process with ΔG° > 0 is not thermodynamically favored and so does not take place.",
     "It is incorrect, because ΔG° becomes more negative as the temperature falls, so more KNO₃ dissolves at 280 K.",
     "It is incorrect, because ΔG° > 0 means only that Ksp < 1; at 280 K, Ksp ≈ 0.66, and s is still about 0.8 M.",
     "It is incorrect, because ΔS° is positive, so dissolving KNO₃ is thermodynamically favored at every temperature."],
    "(C). At 280 K, ΔG° = 34.0 kJ/mol − (280 K)(0.118 kJ/(mol·K)) = +0.96 kJ/mol, so Ksp = e^(−ΔG°/RT) = "
    "e^(−960/(8.314 × 280)) = 0.66 and s = √0.66 ≈ 0.81 M. A positive ΔG° means that K < 1, so reactants are favored "
    "compared with the standard state of 1 M ions; it does not mean that nothing dissolves. A saturated solution at 280 K "
    "still holds a good deal of KNO₃. (A) reads 'not thermodynamically favored under standard conditions' as 'does not "
    "happen at all'; a small K is not zero. (B) reads the table backwards: ΔG° rises as T falls. (D) ignores ΔH°: with "
    "ΔH° > 0 and ΔS° > 0 the process is favored under standard conditions only above ΔH°/ΔS° = 288 K, as the classmate "
    "correctly says.",
    "9.5.A.1, 9.5.A.3 and 9.5.A.4 (topic 9.5), skill 6.D. Thinking: turn a positive ΔG° into a K below 1, and a K below 1 "
    "into a solubility that is small but not zero. Trap: (A), 'not favored' read as 'does not occur'.",
    'evaluate', 'claim', '9.5', '6.D'),
  Q("In trial 3 the student read the volume of the hot solution, but she left the test tube unstoppered, and some water "
    "evaporated before crystals appeared. How does this error affect the value of ΔG° she reports for trial 3?",
    ["It is too negative, because the Ksp she calculates is larger than the true Ksp at that temperature.",
     "It is unaffected, because ΔG° depends only on the temperature and not on the concentration.",
     "It is too positive, because evaporating water absorbs heat, so crystals appear at too low a temperature.",
     "It is too positive, because the s she calculates is lower than the true [K⁺] when crystals appear."],
    "(D). The temperature she records is the true saturation temperature of the solution actually in the tube, but after "
    "evaporation that solution is more concentrated than 5.00 g of KNO₃ in the volume she read. Her s, and so her Ksp = "
    "s², is too small for that temperature, and ΔG° = −RT ln Ksp comes out less negative, that is, too positive. (A) gets "
    "the direction of the concentration error backwards: less water means a higher true concentration. (B) is true of the "
    "true ΔG°, which is fixed by the temperature, but she calculates ΔG° from a measured Ksp, and that measurement is "
    "wrong. (C) has the right direction for the wrong reason: the temperature at which a solution saturates depends on "
    "its concentration, not on how it was cooled, and a more concentrated solution saturates at a higher temperature, "
    "not a lower one.",
    "9.5.A.2 (topic 9.5), skill 6.G. Thinking: follow the error through s, then Ksp, then −RT ln Ksp, while keeping the "
    "measured temperature as correct. Trap: (A), the direction of the concentration error reversed.",
    'evaluate', 'error', '9.5', '6.G'),
  Q("The student then studies a salt Y made of small ions with charges 2+ and 2−. Y dissolves with the release of heat, "
    "and its Ksp is 2.6 × 10⁻⁵ at 290 K and 1.0 × 10⁻⁵ at 330 K. Which of the following gives the sign of ΔS° for "
    "dissolving Y with a justification consistent with the data?",
    ["Negative; ΔG° rises from +25.4 to +31.6 kJ/mol as T rises, and water is held in ordered shells around the ions.",
     "Negative; Ksp falls as the temperature rises, and a Ksp can fall with temperature only when ΔS° < 0.",
     "Positive; the ions leave the ordered crystal lattice and spread out through the whole solution.",
     "Negative; dissolving Y releases heat, and an exothermic process always lowers the entropy of the system."],
    "(A). ΔG° = −RT ln Ksp gives +25.4 kJ/mol at 290 K and +31.6 kJ/mol at 330 K. Because ΔG° = ΔH° − TΔS°, ΔG° can "
    "rise with T only if ΔS° < 0 (here about −150 J/(mol·K)). At the particulate level, small ions with 2+ and 2− charges "
    "hold nearby water molecules tightly and in fixed orientations, and that ordering of the solvent outweighs the "
    "dispersal of the ions. (B) has the right sign for a wrong reason: K falls with rising temperature for every "
    "exothermic process, whatever the sign of ΔS°, so the Ksp trend alone cannot fix the sign of ΔS°. (C) counts only the "
    "dispersal of the ions and ignores the solvent, which the ΔG° values show dominates here. (D) ties the signs of ΔH° "
    "and ΔS° together, but they are independent: many exothermic reactions, such as the burning of a hydrocarbon into more "
    "moles of gas, have ΔS° > 0.",
    "9.6.A.1 and 9.3.A.5 (topic 9.6), skill 6.C. Thinking: turn two K values into two ΔG° values, read the sign of ΔS° "
    "from how ΔG° changes with T, then explain it by the ordering of water around small, highly charged ions. Trap: (B), "
    "the right sign from a trend that ΔH° alone explains.",
    'analyze', 'predict', '9.6', '6.C'),
  )


# ---------------------------------------------------------------- group 2: oxidizing ammonia (Ostwald process)
# calc: dS = 4(210.8) + 6(188.8) - 4(192.5) - 5(205.0) = +181.0 J/K; dH = 4(90.3) + 6(-241.8) - 4(-46.1) = -905.2 kJ
#       dG(298) = -905.2 - 298(0.1810) = -959.1 kJ; log10 K = 168
#       slips: O2 as zero -> +1206.0; no coefficients -> +2.1; H2O(l) -> -532.4; reversed -> -181.0
G("Nitric acid is made industrially by first oxidizing ammonia:\n"
  "4 NH₃(g) + 5 O₂(g) → 4 NO(g) + 6 H₂O(g)\n"
  "A mixture of ammonia and air is passed over a hot platinum-rhodium gauze at about 1100 K, where the reaction is "
  "complete within a few milliseconds. A mixture of ammonia and air kept in a closed flask at 25 °C shows no "
  "detectable NO after several weeks. Standard data at 298 K:\n"
  "Substance · ΔH°f (kJ/mol) · S° (J/(mol·K))\n"
  "NH₃(g) · −46.1 · 192.5\n"
  "O₂(g) · 0 · 205.0\n"
  "NO(g) · +90.3 · 210.8\n"
  "H₂O(g) · −241.8 · 188.8\n"
  "H₂O(l) · −285.8 · 69.9",
  Q("A student calculates ΔS° for the reaction as written and reports +1206 J/(mol·K). Which mistake accounts for the "
    "student's value?",
    ["Leaving out the coefficients and using one mole of each substance",
     "Using S° of H₂O(l) instead of S° of H₂O(g) for the water that forms",
     "Taking S° of O₂(g) as zero, as ΔH°f is zero for an element",
     "Subtracting the entropies of the products from those of the reactants"],
    "(C). The correct value is ΔS° = [4(210.8) + 6(188.8)] − [4(192.5) + 5(205.0)] = 1976.0 − 1795.0 = +181.0 "
    "J/(mol·K). Leaving out the 5(205.0) = 1025.0 J/(mol·K) for O₂ gives 1976.0 − 770.0 = +1206.0 J/(mol·K), the "
    "student's value. Unlike ΔH°f, the absolute entropy of an element is not zero: every substance above 0 K has a "
    "positive S°. (A) gives 210.8 + 188.8 − 192.5 − 205.0 = +2.1 J/(mol·K). (B) gives 4(210.8) + 6(69.9) − 1795.0 = "
    "−532.4 J/(mol·K). (D) gives −181.0 J/(mol·K). None of these is +1206.",
    "9.2.A.1 (topic 9.2), skill 5.F. Thinking: work the calculation forward under each suspected slip and match the "
    "reported number. Trap: (A) or (D), picked on a hunch without testing them against +1206.",
    'evaluate', 'error', '9.2', '5.F'),
  Q("Suppose the reaction were carried out so that the water forms as H₂O(l) instead of H₂O(g). Which prediction about "
    "ΔS° for the new reaction, with its reason, is correct?",
    ["ΔS° becomes negative, because the products now hold fewer moles of gas than the reactants.",
     "ΔS° stays positive but is smaller, because only the phase of one product has changed.",
     "ΔS° becomes negative, because condensing the water releases heat to the surroundings.",
     "ΔS° becomes more positive, because molecules of liquid water form hydrogen bonds to each other."],
    "(A). With liquid water, the gases go from 4 + 5 = 9 mol of reactants to only 4 mol of NO. Most of the matter "
    "ends up far less dispersed, and ΔS° = 4(210.8) + 6(69.9) − 1795.0 = −532.4 J/(mol·K). (B) underestimates the "
    "change: condensing 6 mol of water lowers the entropy of the products by 6(188.8 − 69.9) = 713.4 J/(mol·K), much "
    "more than the +181.0 J/(mol·K) of the original reaction. (C) has the right sign for the wrong reason: the heat "
    "released changes the entropy of the surroundings, but ΔS° of the reaction counts only the dispersal of the "
    "reacting matter itself. (D) reverses the effect: hydrogen bonds hold molecules close together and restrict their "
    "motion, which lowers entropy.",
    "9.1.A.1 (topic 9.1), skill 6.C. Thinking: count moles of gas on each side after the change of phase, and tie the "
    "sign to the dispersal of matter. Trap: (C), the right sign justified by heat flow.",
    'analyze', 'predict', '9.1', '6.C'),
  Q("A student says: 'The flask at 25 °C shows that the oxidation of ammonia is not thermodynamically favored at room "
    "temperature. The hot gauze makes it favored.' Which best evaluates the student's claim?",
    ["It is correct: because ΔS° > 0, the reaction becomes thermodynamically favored only at high temperature.",
     "It is incorrect: ΔG° ≈ −959 kJ/mol at 298 K, so the reaction is favored but has a high activation energy.",
     "It is incorrect: the flask at 25 °C is at equilibrium, and the hot gauze shifts the equilibrium toward NO.",
     "It is incorrect: ΔG° < 0 at 298 K, but K is so small that no measurable NO forms at equilibrium."],
    "(B). ΔH° = 4(90.3) + 6(−241.8) − 4(−46.1) = −905.2 kJ/mol, and with ΔS° = +0.1810 kJ/(mol·K), ΔG° = −905.2 − "
    "(298)(0.1810) = −959.1 kJ/mol. With ΔH° < 0 and ΔS° > 0, the reaction is favored at every temperature. A "
    "favored reaction that does not proceed is under kinetic control: its activation energy is high. The hot catalyst "
    "gives a path of lower activation energy, and the high temperature gives more collisions enough energy; neither "
    "changes ΔG°. (A) looks only at ΔS° and ignores the negative ΔH°, which makes the reaction favored at every "
    "temperature. (C) mistakes 'no change' for equilibrium: K = e^(959,100/(8.314 × 298)) ≈ 10¹⁶⁸, so a mixture with "
    "no NO is nowhere near equilibrium, and a catalyst never shifts an equilibrium. (D) contradicts itself: ΔG° < 0 "
    "means K > 1, here enormously so.",
    "9.4.A.1 and 9.4.A.2 (topic 9.4), skill 6.E. Thinking: compute ΔG° to show the reaction is favored, then explain "
    "the lack of reaction by kinetics, not thermodynamics. Trap: (C), no visible change read as equilibrium.",
    'evaluate', 'claim', '9.4', '6.E'),
  )


# ---------------------------------------------------------------- group 3: a sodium acetate hand warmer
# no numbers: signs only. Crystallization of the trihydrate: dH < 0, dS < 0 (favored at low T only).
G("A reusable hand warmer is a sealed plastic pouch that holds a supersaturated solution of sodium acetate in water "
  "and a small metal disk. Clicking the disk starts crystallization: within seconds, solid sodium acetate trihydrate "
  "forms throughout the pouch, and the pouch warms to about 54 °C.\n"
  "Na⁺(aq) + CH₃COO⁻(aq) + 3 H₂O(l) → NaCH₃COO·3H₂O(s)\n"
  "To reuse the pouch, it is held in boiling water until every crystal has dissolved, then cooled to room "
  "temperature, where it stays liquid for months until the disk is clicked again.",
  Q("A student claims: 'Because this crystallization is thermodynamically favored at 25 °C, its entropy change, ΔS "
    "for the process as written at 25 °C, must be positive.' Which best evaluates the claim?",
    ["It is correct, because every thermodynamically favored process increases the entropy of the system.",
     "It is correct, because the heat released makes the particles move faster, and that disperses energy.",
     "It is incorrect, because the process releases heat, and every exothermic process has ΔS < 0.",
     "It is incorrect: ions and water are locked into a solid, so ΔS < 0, and a negative ΔH makes ΔG < 0."],
    "(D). Dissolved ions that move freely and liquid water molecules become fixed in the lattice of a crystal, so the "
    "matter is far less dispersed and ΔS < 0. The process is still favored because it is strongly exothermic: in "
    "ΔG = ΔH − TΔS, the negative ΔH outweighs the positive −TΔS at 25 °C. (A) is false: a favored process can lower "
    "the entropy of the system when ΔH is negative enough, as freezing water below 0 °C does. (B) confuses the "
    "process with its surroundings: ΔS at constant temperature counts the change in the arrangement of the reacting "
    "particles, and the heat released leaves the system. (C) has the right sign for a wrong reason: the signs of ΔH "
    "and ΔS are independent, and many exothermic processes, such as burning a fuel into more moles of gas, have "
    "ΔS > 0.",
    "9.1.A.1 and 9.3.A.4 (topic 9.1), skill 6.C. Thinking: read the sign of ΔS from the particles, then reconcile a "
    "negative ΔS with a favored process through ΔH. Trap: (A), 'favored' taken to require ΔS > 0.",
    'evaluate', 'claim', '9.1', '6.C'),
  Q("In boiling water the crystals dissolve completely, but at 25 °C the solid remains in the pouch. Which best "
    "explains why crystallization is favored at 25 °C but not at 100 °C?",
    ["At 100 °C the ions move too fast to stick to a growing crystal, so crystallization becomes too slow to see.",
     "ΔH and ΔS for crystallization are both negative, so at 100 °C the −TΔS term is large enough to make ΔG > 0.",
     "ΔH for crystallization becomes positive at 100 °C, because the pouch then absorbs heat from the boiling water.",
     "ΔS for crystallization becomes positive at 100 °C, because the particles have more energy at the higher "
     "temperature."],
    "(B). Crystallization releases heat (ΔH < 0) and orders the particles (ΔS < 0). In ΔG = ΔH − TΔS, the term −TΔS "
    "is positive and grows with temperature; at 25 °C the negative ΔH wins and ΔG < 0, while at 100 °C −TΔS "
    "outweighs ΔH and ΔG > 0, so the reverse process, dissolving, is favored. (A) offers a rate argument for a "
    "thermodynamic observation: a slow crystallization could not make crystals that already exist dissolve "
    "completely. (C) confuses ΔH, a property of the process, with the direction of heat flow from the bath; ΔH for "
    "crystallization stays negative. (D) would make crystallization more favored, not less: a positive ΔS makes "
    "−TΔS negative.",
    "9.3.A.4 and 9.3.A.6 (topic 9.3), skill 6.D. Thinking: infer the signs of ΔH and ΔS from the observations, then "
    "use ΔG = ΔH − TΔS to explain the temperature switch. Trap: (A), a kinetic answer to a thermodynamic question.",
    'apply', 'cause', '9.3', '6.D'),
  )


# ---------------------------------------------------------------- group 4: phosphate transfer in cells
# calc (298 K): PCr + ADP -> Cr + ATP: dG = -43.0 + 30.5 = -12.5 kJ -> K = e^(12500/(8.314*298)) = 155
#       slips: sign -> 6.4e-3; magnitudes added (-73.5) -> 7.7e12; kJ with R in J -> 1.005
#       glucose + ATP -> G6P + ADP: +13.8 - 30.5 = -16.7 kJ; K(glucose + Pi -> G6P) = e^(-13800/RT) = 3.8e-3
G("Cells move phosphate groups from one molecule to another. The table gives ΔG° at 298 K, under the standard "
  "conditions biochemists use (pH 7), for the hydrolysis of four phosphate compounds, each written as compound + H₂O "
  "→ product + Pᵢ, where Pᵢ is inorganic phosphate.\n"
  "Compound hydrolyzed · Product · ΔG° (kJ/mol)\n"
  "Phosphoenolpyruvate · Pyruvate · −61.9\n"
  "Phosphocreatine · Creatine · −43.0\n"
  "ATP · ADP · −30.5\n"
  "Glucose 6-phosphate · Glucose · −13.8\n"
  "A transfer such as phosphocreatine + ADP → creatine + ATP is the sum of the hydrolysis of phosphocreatine and the "
  "reverse of the hydrolysis of ATP. In a cell, an enzyme carries out each transfer through an intermediate shared "
  "by the two reactions. Use R = 8.314 J/(mol·K).",
  Q("During a sprint, muscle cells regenerate ATP by the transfer phosphocreatine + ADP → creatine + ATP. What is the "
    "equilibrium constant for this transfer at 298 K?",
    ["1.6 × 10²", "6.4 × 10⁻³", "7.7 × 10¹²", "1.0"],
    "(A). ΔG° = −43.0 kJ/mol + 30.5 kJ/mol = −12.5 kJ/mol, since the ATP hydrolysis is reversed. Then K = "
    "e^(−ΔG°/RT) = e^(12,500/(8.314 × 298)) = e^(5.05) = 1.6 × 10². (B) keeps the sign of ΔG° positive, giving "
    "e^(−5.05). (C) adds the two magnitudes, −43.0 − 30.5 = −73.5 kJ/mol, forgetting to reverse the ATP reaction. (D) "
    "puts ΔG° in kJ/mol while R is in J/(mol·K), so the exponent is only 0.005.",
    "9.5.A.2 and 9.7.A.2 (topic 9.5), skill 5.F. Thinking: build the transfer from a forward and a reversed "
    "hydrolysis, then turn ΔG° into K. Trap: (C), both ΔG° values added without reversing one.",
    'apply', 'transfer', '9.5', '5.F'),
  Q("Glucose + Pᵢ → glucose 6-phosphate + H₂O is thermodynamically unfavored (ΔG° = +13.8 kJ/mol). A student claims: "
    "'If ATP is added to a glucose solution with no enzyme present, glucose 6-phosphate will form, because the sum of "
    "this reaction and ATP hydrolysis has ΔG° = −16.7 kJ/mol.' Which best evaluates the claim?",
    ["It is correct: free energy released by any reaction in a solution can drive any other reaction in it.",
     "It is incorrect: the enzyme is needed because it makes ΔG° for the phosphorylation of glucose negative.",
     "It is correct: a negative ΔG° for the sum means K > 1, so the product forms, though slowly with no enzyme.",
     "It is incorrect: with no shared intermediate the reactions are not coupled, and ATP hydrolysis alone gives "
     "off heat."],
    "(D). Coupling works only when the two reactions share an intermediate, here a phosphorylated enzyme complex, so "
    "that the favored step cannot happen without the unfavored one. With no enzyme, any ATP that reacts is simply "
    "hydrolyzed to ADP and Pᵢ, and its free energy is released as heat. Glucose + Pᵢ on its own still has K = "
    "e^(−13,800/(8.314 × 298)) = 3.8 × 10⁻³. (A) treats free energy as a shared pool; two reactions in the same "
    "beaker are independent unless they are linked by a common species. (B) gives the enzyme a thermodynamic role: a "
    "catalyst changes the path and the rate, not ΔG°. (C) applies K to an overall equation that nothing links: with "
    "time the ATP would simply hydrolyze, leaving glucose 6-phosphate at the tiny level set by its own K.",
    "9.7.A.2 (topic 9.7), skill 4.D. Thinking: see that adding equations on paper couples them only when a shared "
    "intermediate links them in the flask. Trap: (C), K > 1 for a sum that no mechanism connects.",
    'evaluate', 'claim', '9.7', '4.D'),
  Q("A biology text says: 'ATP stores energy because energy is released when its high-energy phosphate bond is "
    "broken.' Which best evaluates the statement, in light of the data and of what is known about bond enthalpies?",
    ["It is accurate: ΔG° for the hydrolysis of ATP is negative, so breaking the P-O bond is exothermic.",
     "It is accurate: the P-O bond in ATP is weak, and breaking a weak bond releases energy.",
     "It is inaccurate: breaking any bond absorbs energy; hydrolysis is favored by the bonds and interactions formed.",
     "It is inaccurate: breaking the bond absorbs energy, so ATP hydrolysis happens only with an energy input."],
    "(C). Breaking a bond always requires energy, since bond enthalpies are positive. ΔG° = −30.5 kJ/mol belongs to "
    "the whole reaction: bonds broken in ATP and water, bonds formed in ADP and Pᵢ, and the changes in hydration and "
    "entropy. The products are more stable overall, and that, not the breaking of one bond, is why hydrolysis is "
    "favored. The table also shows that ATP is not special: phosphocreatine and phosphoenolpyruvate release more free "
    "energy on hydrolysis. (A) credits the free energy of the whole reaction to one bond-breaking step. (B) is wrong "
    "because breaking a weak bond absorbs less energy than breaking a strong one, but it still absorbs energy. (D) "
    "starts from a true statement but contradicts the data: ΔG° < 0, so hydrolysis is favored with no energy input.",
    "9.7.A.2 (topic 9.7) with 6.7 (bond enthalpies), skill 6.D. Thinking: separate the energy of one bond-breaking "
    "step from the free energy of the whole reaction. Trap: (D), the right physics carried to the wrong conclusion.",
    'evaluate', 'synthesis', '9.7', '6.D'),
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
    t = {'course': 'chem', 'unit': 'u9', 'minutes': 90, 'calc': True,
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
            lens = sorted(ch.values())
    print(len(keys), 'MC keys', ''.join(keys), {L: keys.count(L) for L in 'ABCD'}, 'longest-is-key', longest)


build()
