# Unit test: AP Calculus BC, Unit 2 (Differentiation: definition and fundamental properties). Builds out/test-calcbc-u2.json.
# Every number below was computed in python (sympy/mpmath/numpy); the comment above each group records the values
# and each distractor's slip. No question needs the chain rule (Unit 3): calculator questions may use the calculator's
# numerical derivative instead.
import json, os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'test-calcbc-u2.json')
MC, FR = [], []


def L(*x): return '\n'.join(x)


def q(l, text, ch, a, n, lv, ty, t, s):
    assert len(ch) == 4
    return {"l": str(l), "p": 1, "q": L(text, *[f"({k}) {c}" for k, c in zip("ABCD", ch)]),
            "a": a, "n": n, "lv": lv, "ty": ty, "t": t, "s": s}


def group(stem, calc, *parts): MC.append({"stem": stem, "calc": calc, "parts": list(parts)})


def part(l, p, qq, a, n): return {"l": l, "p": p, "q": qq, "a": a, "n": n}


# ---------------- Group 1 (Q1-3), no calculator: a draining tank, from an unevenly spaced table -----------------
# t: 0 1 4 5 8 10; V: 480 466 425 412 376 355.  Average rates: [0,1] -14, [1,4] -41/3 = -13.667, [4,5] -13, [5,8] -12,
# [8,10] -10.5, [1,8] -12.857, [4,8] -12.25, [1,5] -13.5, [0,10] -12.5.
# Q1: V'(4.5) best from [4,5] = -13.  Slips: [1,8] (symmetric about 4.5 but 7 wide) -12.857; [4,8] -12.25; [1,4] -13.667.
# Q2: equal-weight mean of -41/3 and -13 is -40/3 = -13.333; the true rate over [1,5] is (412 - 466)/4 = -13.5
#     = (3(-41/3) + 1(-13))/4.  (V(1) + V(5))/2 = 439 is the mean volume.
# Q3: V(5) = 412 > 400 > 376 = V(8): IVT on [5, 8] (V differentiable, so continuous).
group(L("Questions 1-3 refer to the following.", "",
        "Water flows into and out of a storage tank. The volume of water in the tank is V(t) liters at time t minutes, where V is a differentiable function. Selected values of V(t) are shown in the table.",
        "t (minutes) · V(t) (liters)",
        "0 · 480",
        "1 · 466",
        "4 · 425",
        "5 · 412",
        "8 · 376",
        "10 · 355"), False,
  q(1, "Based on the data in the table, which of the following is the best estimate of V′(4.5), in liters per minute?",
    ["−41/3", "−90/7", "−13", "−49/4"],
    "(C). The best estimate of a derivative from a table uses the narrowest interval of data that contains the point. The data bracket t = 4.5 most tightly with t = 4 and t = 5, and 4.5 is the midpoint of that interval, so V′(4.5) ≈ (V(5) − V(4))/(5 − 4) = (412 − 425)/1 = −13 liters per minute. "
    "(A) is the average rate over [1, 4], (425 − 466)/3, an interval that does not contain t = 4.5. "
    "(B) is the average rate over [1, 8], (376 − 466)/7; that interval is centered at 4.5 too, but it is 7 minutes wide and averages in rates from far away. "
    "(D) is the average rate over [4, 8], (376 − 425)/4, which contains 4.5 but is four times as wide as [4, 5] and is not centered at 4.5.",
    "CHA-2.D.1 (topic 2.3); skill 2.B. Thinking: choose the narrowest interval of data that brackets the point before forming the difference quotient. Trap: (B), an interval that is centered on the point but seven times too wide.",
    "analyze", "data", "2.3", "2.B"),
  q(2, "A student computes the average rate of change of V over [1, 4], which is −41/3 ≈ −13.667 liters per minute, and over [4, 5], which is −13 liters per minute. The student says, \"So the average rate of change of V over [1, 5] is the average of these two numbers, about −13.333 liters per minute.\" Which of the following best evaluates the student's statement?",
    ["It is correct: the interval [1, 5] is made up of [1, 4] and [4, 5], so its average rate is the mean of their two average rates.",
     "It is wrong: the average rate of change over [1, 5] is the rate at the midpoint, V′(3), which the table does not give.",
     "It is wrong: the average rate over [1, 5] is the mean of the two volumes, (V(1) + V(5))/2 = 439 liters.",
     "It is wrong: [1, 4] lasts three minutes and [4, 5] only one, so the rates must be weighted; the rate over [1, 5] is −13.5."],
    "(D). The average rate of change over [1, 5] is (V(5) − V(1))/(5 − 1) = (412 − 466)/4 = −13.5 liters per minute. The student gave the two rates equal weight, but the volume changed by −41 liters over the three minutes of [1, 4] and by −13 liters over the one minute of [4, 5]; the correct combination is (3(−41/3) + 1(−13))/4 = −54/4 = −13.5. "
    "(A) would be right only if the two subintervals had the same length. "
    "(B) confuses an average rate over an interval with the instantaneous rate at its midpoint; they are usually different, and the average rate is computable exactly from the table. "
    "(C) averages the volumes, which gives a volume in liters, not a rate of change in liters per minute.",
    "CHA-2.A.1 (topic 2.1); skill 3.G. Thinking: go back to the difference quotient itself (total change over total time) instead of combining rates by habit. Trap: (A), which is true only for intervals of equal length.",
    "evaluate", "error", "2.1", "3.G"),
  q(3, L("Which of the following statements must be true?",
         "I. V(t) = 400 for at least one time t in the interval 5 < t < 8.",
         "II. V′(t) < 0 for every t in the interval 0 < t < 10.",
         "III. V′(4.5) = −13"),
    ["I only", "I and II only", "I and III only", "I, II, and III"],
    "(A). I must be true: V is differentiable, and a differentiable function is continuous, so V is continuous on [5, 8]. Since V(5) = 412 and V(8) = 376, and 400 is between them, the Intermediate Value Theorem gives a time in (5, 8) with V(t) = 400. "
    "II need not be true: the table gives V at only six times and shows only that V was lower at each measurement than at the one before. Between two measurements V could rise for a while (if the inflow briefly exceeded the outflow) without changing any value in the table. "
    "III need not be true: −13 is the average rate over [4, 5], an estimate of V′(4.5), not its exact value. "
    "So (B), (C) and (D) each treat something the table only suggests as something it proves: (B) adds II, (C) adds III, and (D) adds both.",
    "FUN-2.A.1 (topic 2.4), CHA-2.D.1; skill 3.C. Thinking: separate what the hypothesis (differentiable, hence continuous) guarantees from what the data merely suggest. Trap: (B), reading 'V decreases at every time' from a table.",
    "evaluate", "infer", "2.4", "3.C"),
)


# ---------------- Group 2 (Q4-5), no calculator: a semicircle joined to a segment -----------------
# f = sqrt(4 - x^2) on [-2, 2]; segment (2, 0)-(5, 3) of slope 1.  f(1) = sqrt3, f'(1) = -1/sqrt3 = -sqrt3/3 (tangent
# perpendicular to the radius of slope sqrt3).  g = x f: g'(1) = f(1) + f'(1) = sqrt3 - sqrt3/3 = 2sqrt3/3 (sympy).
# Slips: f'(1) = +sqrt3/3 -> 4sqrt3/3; f'(1) = -sqrt3 (negated radius slope) -> 0; product of derivatives 1*f'(1) = -sqrt3/3.
# h = (x - 2) f: (h(2 + k) - h(2))/k = f(2 + k) -> f(2) = 0 from both sides, so h'(2) = 0 although f'(2) does not exist.
group(L("Questions 4-5 refer to the following.", "",
        "The graph of the continuous function f on the closed interval [−2, 5] consists of two pieces:",
        "• for −2 ≤ x ≤ 2, the upper half of the circle of radius 2 centered at the origin, from (−2, 0) through (0, 2) to (2, 0);",
        "• for 2 ≤ x ≤ 5, the line segment from (2, 0) to (5, 3)."), False,
  q(4, "Let g(x) = x · f(x). What is the value of g′(1)?",
    ["$\\frac{4\\sqrt{3}}{3}$", "$\\frac{2\\sqrt{3}}{3}$", "0", "$-\\frac{\\sqrt{3}}{3}$"],
    "(B). The point of the graph at x = 1 is (1, √3). A tangent line to a circle is perpendicular to the radius at the point of tangency; the radius to (1, √3) has slope √3, so f′(1) = −1/√3 = −√3/3 (the graph is falling there, just right of its top point). By the product rule, g′(1) = f(1) + 1 · f′(1) = √3 − √3/3 = 2√3/3. "
    "(A) uses f′(1) = +√3/3, a sign error: the semicircle falls to the right of x = 0. "
    "(C) uses f′(1) = −√3, the negative of the radius's slope instead of its negative reciprocal. "
    "(D) multiplies the derivatives, (1)(f′(1)), which is not the product rule.",
    "CHA-2.C.1 (topic 2.2), FUN-3.B.1; skill 2.B. Thinking: read a slope from the geometry of a described graph (tangent perpendicular to radius), then use it in the product rule. Trap: (C), negating the radius's slope instead of taking the negative reciprocal.",
    "analyze", "synthesis", "2.2", "2.B"),
  q(5, "Let h(x) = (x − 2) · f(x). A student says, \"f is not differentiable at x = 2, so the product rule cannot be used there, and h is not differentiable at x = 2 either.\" Which of the following best evaluates the student's statement?",
    ["It is wrong: (h(2 + k) − h(2))/k = f(2 + k), which approaches f(2) = 0 from both sides, so h′(2) exists and equals 0.",
     "It is correct: a product is differentiable at a point only when both of its factors are differentiable there.",
     "It is wrong: h′(2) = 1, the slope of the segment of f to the right of x = 2, since x − 2 has slope 1.",
     "It is wrong: h is continuous at x = 2, and a function that is continuous at a point is differentiable there."],
    "(A). The product rule is a sufficient condition, not the only route: go back to the definition. Since h(2) = 0, the difference quotient is (h(2 + k) − 0)/k = (k · f(2 + k))/k = f(2 + k). Because f is continuous at 2, f(2 + k) → f(2) = 0 as k → 0 from either side, so h′(2) = 0. The factor x − 2 flattens the corner. "
    "(B) turns 'both factors differentiable implies the product is differentiable' into a false converse; h is a counterexample. "
    "(C) uses only the right side and also forgets that f(2) = 0 multiplies the slope 1 of x − 2. "
    "(D) reverses the theorem: differentiability implies continuity, not the other way around.",
    "FUN-2.A.1, FUN-2.A.2 (topic 2.4), CHA-2.B.2; skill 3.E. Thinking: when a rule's hypothesis fails, return to the limit definition instead of concluding the derivative does not exist. Trap: (B), the false converse of the product rule.",
    "evaluate", "claim", "2.4", "3.E"),
)


# ---------------- Q6 standalone, no calculator: what a symmetric difference quotient does not show -----------------
# Counterexamples: f(x) = 4x + 1 for x != 3, f(3) = 7 -> symmetric quotient 4, lim f = 13 != 7 (not continuous).
# f(x) = 7 + 4(x - 3) + |x - 3| -> symmetric quotient (8k)/(2k) = 4, corner at 3 (not differentiable).
# If f'(3) exists, symmetric quotient = average of forward and backward quotients -> f'(3).
group("", False,
  q(6, L("A function f is defined for all real numbers, and f(3) = 7. A student finds that",
         "$\\lim_{h \\to 0} \\frac{f(3+h) - f(3-h)}{2h} = 4$.",
         "Which of the following must be true?",
         "I. f is continuous at x = 3.",
         "II. f is differentiable at x = 3.",
         "III. If f is differentiable at x = 3, then f′(3) = 4."),
    ["I only", "III only", "I and III only", "I, II, and III"],
    "(B). III: if f′(3) exists, the symmetric quotient is the average of (f(3 + h) − f(3))/h and (f(3) − f(3 − h))/h, and both approach f′(3), so f′(3) = 4. "
    "I fails: the symmetric quotient never uses f(3). For f(x) = 4x + 1 when x ≠ 3 and f(3) = 7, the quotient is exactly 4 for every h, but the limit of f at 3 is 13 ≠ 7, so f is not continuous there. "
    "II fails: for f(x) = 7 + 4(x − 3) + |x − 3| the quotient is (8h)/(2h) = 4, but the graph has a corner at x = 3 (one-sided slopes 3 and 5). "
    "(A) and (C) assume the symmetric quotient says something about f(3); it does not. (D) treats the symmetric limit as the definition of the derivative, which is exactly what a calculator's numerical derivative gets wrong at a corner.",
    "CHA-2.B.1, CHA-2.B.2 (topic 2.2), FUN-2.A.2 (topic 2.4); skill 3.C. Thinking: test each statement with a counterexample built to satisfy the hypothesis. Trap: (D), taking the symmetric quotient for the derivative.",
    "evaluate", "claim", "2.4", "3.C"),
)


# ---------------- Q7 standalone, no calculator: which limit is not f'(2) -----------------
# With f'(2) = 5: (f(x) - f(2))/(x - 2) -> 5; (f(2) - f(2 - h))/h -> 5; symmetric -> 5 (f differentiable);
# (f(2 + 2h) - f(2))/h = 2 (f(2 + 2h) - f(2))/(2h) -> 10.
group("", False,
  q(7, "A function f is differentiable at x = 2, and f′(2) = 5. Each of the following limits exists. Which of the following limits is NOT equal to 5?",
    ["$\\lim_{x \\to 2} \\frac{f(x) - f(2)}{x - 2}$",
     "$\\lim_{h \\to 0} \\frac{f(2) - f(2-h)}{h}$",
     "$\\lim_{h \\to 0} \\frac{f(2+h) - f(2-h)}{2h}$",
     "$\\lim_{h \\to 0} \\frac{f(2+2h) - f(2)}{h}$"],
    "(D). Write the quotient as $2 \\cdot \\frac{f(2+2h) - f(2)}{2h}$. As h → 0, 2h → 0 too, so the second factor approaches f′(2) = 5 and the limit is 2 · 5 = 10. The change in input is 2h, but the quotient divides by only h. "
    "(A) is the definition of f′(2) in the x → a form, so it equals 5. "
    "(B) is the definition with the step taken to the left: the change in f from 2 − h to 2 divided by the change in x, h; it equals 5. "
    "(C) is the symmetric quotient, the average of a forward and a backward quotient; because f is differentiable at 2, both approach 5, so it equals 5.",
    "CHA-2.B.1, CHA-2.B.2 (topic 2.2); skill 2.C. Thinking: match each quotient's numerator change to its denominator change. Trap: (B), where the reversed order in the numerator looks like a sign error but is not.",
    "analyze", "except", "2.2", "2.C"),
)


# ---------------- Q8 standalone, no calculator: a power-rule slip with a negative exponent -----------------
# f = (x^3 - 4 sqrt x)/(2x) = x^2/2 - 2x^(-1/2); f' = x + x^(-3/2); f'(4) = 4 + 1/8 = 33/8 (sympy).
# Student: exponent -1/2 + 1 = 1/2 -> f' = x + x^(1/2), f'(4) = 6.  Coefficient slip -1 with exponent 1/2 -> 4 - 2 = 2.
group("", False,
  q(8, L("A student finds f′(4) for $f(x) = \\frac{x^{3} - 4\\sqrt{x}}{2x}$ as follows.",
         "Line 1: $f(x) = \\frac{x^{3}}{2x} - \\frac{4\\sqrt{x}}{2x}$",
         "Line 2: $f(x) = \\frac{1}{2}x^{2} - 2x^{-1/2}$",
         "Line 3: $f'(x) = x - 2\\left(-\\frac{1}{2}\\right)x^{1/2} = x + x^{1/2}$",
         "Line 4: f′(4) = 4 + 2 = 6",
         "Which of the following best describes the student's work?"),
    ["Line 1 is the first error: a quotient must be differentiated with the quotient rule, so it may not be split into two fractions.",
     "There is no error: rewriting the quotient as a sum of powers of x is valid, and f′(4) = 6.",
     "Line 3 is the first error: the new exponent should be −3/2, not 1/2, and the correct value is f′(4) = 33/8.",
     "Line 3 is the first error: the coefficient 2 times −1/2 gives −1, not +1, and the correct value is f′(4) = 2."],
    "(C). Lines 1 and 2 are correct algebra: 4√x/(2x) = 2x^(1/2 − 1) = 2x^(−1/2). The power rule lowers the exponent by 1, and −1/2 − 1 = −3/2, so the derivative of −2x^(−1/2) is −2(−1/2)x^(−3/2) = x^(−3/2). Then f′(x) = x + x^(−3/2) and f′(4) = 4 + 4^(−3/2) = 4 + 1/8 = 33/8. The student raised the exponent (−1/2 + 1) instead of lowering it. "
    "(A) is wrong: splitting a fraction over a common denominator changes only the form of f, and any correct method gives the same derivative. "
    "(B) accepts the exponent slip; checking Line 3 against the rule nx^(n − 1) exposes it. "
    "(D) finds the right line for the wrong reason: −2 · (−1/2) = +1 is correct, and keeping the wrong exponent 1/2 gives the wrong value 2.",
    "FUN-3.A.1 (topic 2.5), FUN-3.A.2; skill 3.G. Thinking: check each line of a solution against the rule it uses, especially with negative exponents. Trap: (B), missing that −1/2 − 1 is −3/2.",
    "evaluate", "error", "2.5", "3.G"),
)


# ---------------- Q9 standalone, no calculator: the product rule predicts revenue -----------------
# R = pN; R'(12) = N(12) + 12 N'(12) = 800 - 1080 = -280.  Slips: forget pN' -> 800; product of derivatives (1)(-90) = -90;
# quotient-rule minus sign 800 - 12(-90) = 1880.
group("", False,
  q(9, "A theater sells N(p) tickets per week when the ticket price is p dollars, so its weekly revenue is R(p) = p · N(p) dollars. At a price of $12, the theater sells 800 tickets per week, and N′(12) = −90 tickets per dollar. The manager is considering raising the price slightly above $12. Which of the following is the correct prediction, with the correct reason?",
    ["Revenue will increase, because R′(12) = N(12) = 800 dollars per dollar, which is positive.",
     "Revenue will decrease, because R′(12) = N(12) + 12N′(12) = −280 dollars per dollar.",
     "Revenue will decrease, because R′(12) = (1)(N′(12)) = −90 dollars per dollar.",
     "Revenue will increase, because R′(12) = N(12) − 12N′(12) = 1,880 dollars per dollar."],
    "(B). By the product rule, R′(p) = (1)N(p) + p · N′(p), so R′(12) = 800 + 12(−90) = 800 − 1,080 = −280. Revenue is falling at about $280 per dollar of price increase: the $1 more from each of the 800 tickets is outweighed by the 90 fewer tickets, each worth $12. "
    "(A) differentiates only the factor p, forgetting that the number of tickets also changes with price. "
    "(C) multiplies the two derivatives; the prediction is right, but the reason and the size of the change are wrong. "
    "(D) subtracts the second term, as in the quotient rule's numerator, which reverses the prediction.",
    "FUN-3.B.1 (topic 2.8); skill 3.F. Thinking: see that revenue is a product of two changing quantities, and let the product rule weigh the two effects. Trap: (A), holding N fixed.",
    "analyze", "predict", "2.8", "3.F"),
)


# ---------------- Q10 standalone, no calculator: two methods for sec x cot x -----------------
# y = sec x cot x = csc x where defined.  P: -csc x cot x.  Q: sec x tan x cot x - sec x csc^2 x = sec x - sec x csc^2 x
# = -sec x cot^2 x = -cos x/sin^2 x = -csc x cot x (sympy difference 0).  At pi/4 both give -sqrt2.
group("", False,
  q(10, L("Two students differentiate y = sec x · cot x.",
          "Student P rewrites y = (1/cos x)(cos x/sin x) = 1/sin x = csc x, so y′ = −csc x cot x.",
          "Student Q uses the product rule: y′ = (sec x tan x)(cot x) + (sec x)(−csc²x) = sec x − sec x csc²x.",
          "Which of the following best evaluates the two students' work?"),
    ["Both are correct: where y is defined, sec x − sec x csc²x = −sec x cot²x, and this equals −csc x cot x.",
     "Only P is correct: Q made a sign error, because the derivative of cot x is csc²x, not −csc²x.",
     "Only Q is correct: y is undefined where cos x = 0 but csc x is defined there, so P differentiated a different function.",
     "Neither is correct: by the product rule, the derivative of sec x · cot x is (sec x tan x)(−csc²x)."],
    "(A). Q's expression simplifies: sec x − sec x csc²x = sec x(1 − csc²x) = −sec x cot²x = −(1/cos x)(cos²x/sin²x) = −cos x/sin²x = −csc x cot x, which is P's answer. At x = π/4, for example, both give −√2. "
    "(B) misremembers the derivative of cot x; it is −csc²x, as Q used. "
    "(C) makes a true point about domains, since y is undefined at x = π/2 while csc x is defined there, but it does not make P wrong: wherever y is defined, y equals csc x, so the two have the same derivative there. "
    "(D) multiplies the two derivatives, which is not the product rule.",
    "FUN-3.B.3 (topic 2.10), FUN-3.B.1; skill 3.G. Thinking: decide whether two different-looking answers agree by simplifying one into the other, and weigh a domain objection. Trap: (C), a true fact about domains that does not change the derivative.",
    "evaluate", "compare", "2.10", "3.G"),
)


# ---------------- Q11 standalone, no calculator: a tangent line through the origin -----------------
# Tangent to ln x at c: y = ln c + (1/c)(x - c); through (0, 0): ln c - 1 = 0 -> c = e, k = 1/e (sympy).
# Slips: ln c + 1 = 0 -> c = 1/e, k = e; tangent at c = 1 (y = x - 1) -> k = 1; c = e with k = e (slope of e^x).
group("", False,
  q(11, "The line y = kx, where k is a constant, is tangent to the graph of y = ln x at the point (c, ln c). What are the values of c and k?",
    ["c = 1 and k = 1", "c = 1/e and k = e", "c = e and k = e", "c = e and k = 1/e"],
    "(D). Two conditions must hold at x = c: the slopes match, so k = 1/c, and the point is on the line, so ln c = kc = (1/c)c = 1. Then c = e and k = 1/e; the tangent line y = x/e passes through (e, 1) and the origin. "
    "(A) uses the tangent line at x = 1, y = x − 1, which has slope 1 but does not pass through the origin. "
    "(B) comes from a sign slip, ln c = −1, when the tangent line's y-intercept, ln c − 1, is set equal to 0. "
    "(C) finds the right point but takes its slope from y = eˣ, whose derivative at 1 is e, instead of from y = ln x.",
    "CHA-2.C.1 (topic 2.2), FUN-3.A.4 (topic 2.7); skill 1.D. Thinking: turn 'tangent through the origin' into two equations, one for the slope and one for the point, and solve them together. Trap: (A), a tangent line that does not pass through the origin.",
    "apply", "synthesis", "2.7", "1.D"),
)


# ---------------- Q12 standalone, no calculator: horizontal tangents of a trig quotient -----------------
# y = sin x/(2 + cos x): y' = (cos x(2 + cos x) + sin^2 x)/(2 + cos x)^2 = (2cos x + 1)/(2 + cos x)^2 -> 2pi/3, 4pi/3 (sympy).
# Slips: dropping + sin^2 x -> cos x (2 + cos x) = 0 -> pi/2, 3pi/2; cos x = +1/2 -> pi/3, 5pi/3; y = 0 -> pi.
group("", False,
  q(12, "Let $y = \\frac{\\sin x}{2 + \\cos x}$. At which values of x in the open interval 0 < x < 2π does the graph of y have a horizontal tangent line?",
    ["x = π only",
     "x = π/2 and x = 3π/2 only",
     "x = 2π/3 and x = 4π/3 only",
     "x = π/3 and x = 5π/3 only"],
    "(C). By the quotient rule, $y' = \\frac{\\cos x(2 + \\cos x) - \\sin x(-\\sin x)}{(2 + \\cos x)^{2}} = \\frac{2\\cos x + \\cos^{2}x + \\sin^{2}x}{(2 + \\cos x)^{2}} = \\frac{2\\cos x + 1}{(2 + \\cos x)^{2}}$. The denominator is never 0, so y′ = 0 exactly where cos x = −1/2, at x = 2π/3 and x = 4π/3. "
    "(A) sets y itself equal to 0 (sin x = 0), which gives where the graph crosses the x-axis, not where it is flat. "
    "(B) loses the second term of the numerator, −sin x(−sin x) = sin²x, leaving cos x(2 + cos x) = 0. "
    "(D) solves 2cos x + 1 = 0 with the wrong sign, cos x = 1/2.",
    "FUN-3.B.2 (topic 2.9), FUN-3.A.4; skill 1.E. Thinking: carry the quotient rule through, simplify with sin²x + cos²x = 1, then solve y′ = 0. Trap: (B), dropping the sin²x term.",
    "apply", "synthesis", "2.9", "1.E"),
)


# ---------------- Q13 standalone, no calculator: designing a counterexample -----------------
# |x| + (x - |x|) = x (differentiable); neither |x| nor x - |x| is differentiable at 0 (corners).
# x|x| is differentiable at 0 (quotient |h| -> 0), so (x|x|, -x|x|) does not meet the hypothesis.
# 2|x| and cbrt x + |x| are not differentiable at 0, so they agree with the claim.
group("", False,
  q(13, "A student claims, \"If neither f nor g is differentiable at x = 0, then f + g is not differentiable at x = 0.\" Which of the following pairs of functions shows that the student's claim is false?",
    ["f(x) = |x| and g(x) = |x|",
     "f(x) = |x| and g(x) = x − |x|",
     "f(x) = x|x| and g(x) = −x|x|",
     "f(x) = ∛x and g(x) = |x|"],
    "(B). Each function has a corner at x = 0: |x| has one-sided slopes −1 and 1, and x − |x| (which is 2x for x < 0 and 0 for x > 0) has one-sided slopes 2 and 0. So neither is differentiable at 0, yet their sum is x, which is differentiable everywhere. The pair meets the claim's hypothesis and breaks its conclusion. "
    "(A) gives 2|x|, which is not differentiable at 0, so it agrees with the claim. "
    "(C) has a differentiable sum, 0, but x|x| is differentiable at 0 (its difference quotient h|h|/h = |h| → 0), so this pair does not satisfy the hypothesis. "
    "(D) gives ∛x + |x|, whose difference quotient h^(−2/3) + |h|/h grows without bound, so it is not differentiable at 0 and agrees with the claim.",
    "FUN-2.A.2 (topic 2.4), CHA-2.B.2; skill 3.E. Thinking: a counterexample must satisfy the hypothesis and violate the conclusion; check both. Trap: (C), a sum that is differentiable built from functions that already are.",
    "evaluate", "design", "2.4", "3.E"),
)


# ---------------- Q14 standalone, no calculator: a limit recognized as a derivative -----------------
# ln x/(x^2 - 1) = (ln x/(x - 1)) * 1/(x + 1); ln x/(x - 1) -> (ln)'(1) = 1; limit 1/2 (sympy).
# Student uses ln 1 = 0 -> 0.  Slips: 'fix' Step 3 but drop the 1/(x + 1) -> 1; 0/0 means no limit.
group("", False,
  q(14, L("A student evaluates $\\lim_{x \\to 1} \\frac{\\ln x}{x^{2} - 1}$ as follows.",
          "Step 1: Substituting x = 1 gives 0/0.",
          "Step 2: $\\frac{\\ln x}{x^{2} - 1} = \\frac{\\ln x}{x - 1} \\cdot \\frac{1}{x + 1}$ for x ≠ 1.",
          "Step 3: Since ln 1 = 0, $\\frac{\\ln x}{x - 1} = \\frac{\\ln x - \\ln 1}{x - 1}$, which approaches the derivative of ln x at x = 1, and that is ln 1 = 0.",
          "Step 4: So the limit is 0 · (1/2) = 0.",
          "Which of the following best describes the student's work?"),
    ["Step 3 is the first error: the derivative of ln x at x = 1 is 1/1 = 1, so the limit is 1 · (1/2) = 1/2.",
     "Step 1 is the first error: a limit that gives 0/0 on substitution does not exist.",
     "Step 2 is the first error: ln x cannot be separated from x² − 1, so the limit must be found from a table.",
     "Step 3 is the first error: the limit of ln x/(x − 1) is the derivative of ln x at 1, which is 1, so the limit is 1."],
    "(A). Steps 1 and 2 are correct: 0/0 signals more work, and x² − 1 = (x − 1)(x + 1). Step 3 correctly recognizes (ln x − ln 1)/(x − 1) as the difference quotient of ln x at x = 1, but then evaluates the function instead of its derivative: the derivative of ln x is 1/x, which is 1 at x = 1. So the limit is 1 · 1/(1 + 1) = 1/2. "
    "(B) reads 0/0 as 'no limit'; it is an indeterminate form, and this limit exists. "
    "(C) objects to Step 2, but factoring the denominator is ordinary algebra, valid for every x ≠ 1. "
    "(D) makes the right repair to Step 3 but forgets the factor 1/(x + 1) from Step 2, which approaches 1/2.",
    "LIM-3.A.1, FUN-3.A.4 (topic 2.7); skill 3.G. Thinking: see a difference quotient inside the limit and evaluate the derivative, not the function, at the point. Trap: (D), fixing Step 3 but dropping the other factor.",
    "evaluate", "error", "2.7", "3.G"),
)


# ---------------- Group 3 (Q15-16), no calculator: a table of f, f', g, g' -----------------
# x: 1 2 3; f: 2 0 4; f': 3 5 -2; g: -3 2 1; g': 4 -1 6.
# k = fg: k'(2) = f'(2)g(2) + f(2)g'(2) = 10 + 0 = 10.  With f + 5: 10 + 5(-1) = 5 (decrease 5).
# Slips: 'no change' (derivative of f + 5 is f'); +5; +5 g(2) = +10.
# |f|: f(2) = 0, f'(2) = 5 -> f changes sign at 2 -> one-sided slopes -5 and 5 (corner).  f(3) = 4 > 0 -> |f|'(3) = f'(3) = -2.
group(L("Questions 15-16 refer to the following.", "",
        "The functions f and g are differentiable for all real numbers. The table gives values of f, f′, g and g′ at selected values of x.",
        "x · f(x) · f′(x) · g(x) · g′(x)",
        "1 · 2 · 3 · −3 · 4",
        "2 · 0 · 5 · 2 · −1",
        "3 · 4 · −2 · 1 · 6"), False,
  q(15, "Let k(x) = f(x) · g(x). Suppose f were replaced by the function f(x) + 5, and g were unchanged. How would the value of k′(2) change?",
    ["It would not change, because f(x) + 5 has the same derivative as f(x).",
     "It would increase by 5, because 5 is added to one factor of the product.",
     "It would increase by 10, because the product rule adds 5 · g(2) = 10.",
     "It would decrease by 5, from 10 to 5, because the product rule adds 5 · g′(2) = −5."],
    "(D). By the product rule, k′(2) = f′(2)g(2) + f(2)g′(2) = (5)(2) + (0)(−1) = 10. With f + 5 in place of f, the derivative of the first factor is still f′, but the first factor's value becomes f(2) + 5 = 5, so the new value is (5)(2) + (5)(−1) = 5. The extra 5 multiplies g′(2) = −1, lowering k′(2) by 5. "
    "(A) is right that f + 5 and f have the same derivative, but the product rule also uses the value of f, which did change. "
    "(B) treats the derivative of the product as if the 5 were added to it. "
    "(C) attaches the extra 5 to g(2) instead of g′(2).",
    "FUN-3.B.1 (topic 2.8); skill 2.D. Thinking: trace a change in one factor through both terms of the product rule. Trap: (A), true about f′ but not about the product.",
    "analyze", "counter", "2.8", "2.D"),
  q(16, "Let h(x) = |f(x)|. Which of the following statements about h is true?",
    ["h′(3) = 2, because the derivative of |f(x)| is |f′(x)|.",
     "h is not differentiable at x = 3, because f′(3) is negative.",
     "h′(2) = 5, because f′(2) = 5 and f(2) = 0 is not negative.",
     "h is not differentiable at x = 2, because f changes sign at x = 2 while f′(2) ≠ 0."],
    "(D). Since f(2) = 0 and f′(2) = 5 > 0, the difference quotient f(x)/(x − 2) approaches 5, so f(x) has the sign of x − 2 near 2: negative just to the left and positive just to the right. So h(x) = −f(x) to the left of 2 and f(x) to the right, and h has one-sided slopes −5 and 5 at x = 2: a corner. "
    "(A) invents a rule: near x = 3, f is positive (f(3) = 4), so h = f there and h′(3) = f′(3) = −2. "
    "(B) confuses a negative slope with a corner; |f| has corners only where f crosses 0 with nonzero slope. "
    "(C) uses only the right side of x = 2; from the left, h is −f and its slope is −5.",
    "FUN-2.A.2 (topic 2.4), CHA-2.B.2; skill 2.D. Thinking: use f(2) = 0 with f′(2) ≠ 0 to see that f changes sign, so |f| folds the graph into a corner. Trap: (C), checking only one side.",
    "analyze", "infer", "2.4", "2.D"),
)


def save():
    t = {"course": "calcbc", "unit": "u2", "minutes": 90,
         "intro": "Multiple-choice questions 17-24 and free-response question 1 allow a graphing calculator; all other questions are no calculator.",
         "mc": MC, "fr": FR}
    json.dump(t, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('wrote', OUT, sum(len(g['parts']) for g in MC), 'MC', len(FR), 'FR')


save()
