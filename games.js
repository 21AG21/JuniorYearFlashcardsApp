/* ==========================================================================
   games.js — subject games. One mechanic family per subject:
   order (timeline / ranking), match (pairs), circle (the unit circle).
   Content is text on the ground; feedback is shade and weight, never color.
   ========================================================================== */
(function () {
  'use strict';

  var ctx = null;                 // {mount, esc, go, toast, nice, backbar}
  var TIMELINE = null;            // the real APUSH timeline, 171 dated events
  var FRVOCAB = null;             // AP French vocabulary, 558 pairs
  var S = null, T = null;
  var st = null;                  // live game state
  var timer = null;

  /* ---------------- registry --------------------------------------------- */
  var GAMES = {
    timeline:   { name: 'Timeline',         deck: 'apush',  kind: 'order'  },
    presorder:  { name: 'Presidents',       deck: 'apush',  kind: 'order'  },
    periodquiz: { name: 'Periods',          deck: 'apush',  kind: 'quiz'   },
    yearquiz:   { name: 'Years',          deck: 'apush',  kind: 'quiz'   },
    chemorder:  { name: 'Order',         deck: 'chem',   kind: 'order'  },
    chemformula:{ name: 'Formulas',         deck: 'chem',   kind: 'match'  },
    ionmatch:   { name: 'Ions',  deck: 'chem',   kind: 'match'  },
    elemmatch:  { name: 'Elements',         deck: 'chem',   kind: 'match'  },
    sigfigs:    { name: 'Sig figs',         deck: 'chem',   kind: 'quiz'   },
    econfig:    { name: 'Configurations',   deck: 'chem',   kind: 'quiz'   },
    langmatch:  { name: 'Devices',     deck: 'lang',   kind: 'match'  },
    langboard:  { name: 'Terms',            deck: 'lang',   kind: 'board'  },
    frmatch:    { name: 'Vocab',      deck: 'french', kind: 'match'  },
    frconj:     { name: 'Conjugation',      deck: 'french', kind: 'board'  },
    frgender:   { name: 'Le or la',         deck: 'french', kind: 'quiz'   },
    frnumbers:  { name: 'Numbers',          deck: 'french', kind: 'quiz'   },
    frtime:     { name: 'L’heure',          deck: 'french', kind: 'quiz'   },
    unitcircle: { name: 'Unit circle',      deck: 'calcbc', kind: 'circle' },
    degcircle:  { name: 'Degrees', deck: 'calcbc', kind: 'circle' },
    triggraphs: { name: 'Graphs',  deck: 'calcbc', kind: 'graph'  },
    identities: { name: 'Identities',       deck: 'calcbc', kind: 'board'  },
    derivmatch: { name: 'Derivatives', deck: 'calcbc', kind: 'match'  },
    antideriv:  { name: 'Antiderivatives',  deck: 'calcbc', kind: 'match'  },
    seriesmatch:{ name: 'Series',           deck: 'calcbc', kind: 'match'  },
    radmatch:   { name: 'Radians',          deck: 'calcbc', kind: 'match'  },
    limitsquiz: { name: 'Limits',           deck: 'calcbc', kind: 'quiz'   }
  };
  var ORDER_BY_DECK = ['lang', 'chem', 'french', 'calcbc', 'apush'];

  /* ==========================================================================
     Content is GENERATED, never a hardcoded question list. The only tables
     below are reference facts (a periodic table, the 16 standard angles,
     identity facts) — the questions built from them are random every round.
     ========================================================================== */

  /* elements: symbol, atomic number, atomic mass (u), Pauling EN (0 = n/a) */
  var ELEMENTS = [
    ['H', 1, 1.0, 2.20], ['He', 2, 4.0, 0], ['Li', 3, 6.9, 0.98], ['Be', 4, 9.0, 1.57],
    ['B', 5, 10.8, 2.04], ['C', 6, 12.0, 2.55], ['N', 7, 14.0, 3.04], ['O', 8, 16.0, 3.44],
    ['F', 9, 19.0, 3.98], ['Ne', 10, 20.2, 0], ['Na', 11, 23.0, 0.93], ['Mg', 12, 24.3, 1.31],
    ['Al', 13, 27.0, 1.61], ['Si', 14, 28.1, 1.90], ['P', 15, 31.0, 2.19], ['S', 16, 32.1, 2.58],
    ['Cl', 17, 35.5, 3.16], ['Ar', 18, 39.9, 0], ['K', 19, 39.1, 0.82], ['Ca', 20, 40.1, 1.00],
    ['Sc', 21, 45.0, 1.36], ['Ti', 22, 47.9, 1.54], ['V', 23, 50.9, 1.63], ['Cr', 24, 52.0, 1.66],
    ['Mn', 25, 54.9, 1.55], ['Fe', 26, 55.8, 1.83], ['Co', 27, 58.9, 1.88], ['Ni', 28, 58.7, 1.91],
    ['Cu', 29, 63.5, 1.90], ['Zn', 30, 65.4, 1.65], ['Ga', 31, 69.7, 1.81], ['Ge', 32, 72.6, 2.01],
    ['As', 33, 74.9, 2.18], ['Se', 34, 79.0, 2.55], ['Br', 35, 79.9, 2.96],
    ['Ag', 47, 107.9, 1.93], ['Sn', 50, 118.7, 1.96], ['I', 53, 126.9, 2.66], ['Cs', 55, 132.9, 0.79],
    ['Ba', 56, 137.3, 0.89], ['Au', 79, 197.0, 2.54], ['Hg', 80, 200.6, 2.00], ['Pb', 82, 207.2, 1.87]
  ];

  /* equivalence facts for the identities board: prompt → the tile it equals.
     Third slot is the family; fractions use the ⁄ stack marker ({num}⁄{den})
     so every one renders as a real built-up fraction, never a slash. */
  var EQUIV = [
    /* reciprocal */
    ['sec x', '1⁄{cos x}', 'rec'], ['csc x', '1⁄{sin x}', 'rec'], ['cot x', '1⁄{tan x}', 'rec'],
    ['sin x', '1⁄{csc x}', 'rec'], ['cos x', '1⁄{sec x}', 'rec'], ['tan x', '1⁄{cot x}', 'rec'],
    /* quotient */
    ['tan x', '{sin x}⁄{cos x}', 'quo'], ['cot x', '{cos x}⁄{sin x}', 'quo'],
    /* Pythagorean, and every rearrangement */
    ['1', 'sin²x + cos²x', 'pyt'], ['sec²x', '1 + tan²x', 'pyt'], ['csc²x', '1 + cot²x', 'pyt'],
    ['sin²x', '1 − cos²x', 'pyt'], ['cos²x', '1 − sin²x', 'pyt'],
    ['tan²x', 'sec²x − 1', 'pyt'], ['cot²x', 'csc²x − 1', 'pyt'],
    ['sec²x − tan²x', '1', 'pyt'], ['csc²x − cot²x', '1', 'pyt'],
    /* even and odd */
    ['sin(−x)', '−sin x', 'evo'], ['cos(−x)', 'cos x', 'evo'], ['tan(−x)', '−tan x', 'evo'],
    ['csc(−x)', '−csc x', 'evo'], ['sec(−x)', 'sec x', 'evo'], ['cot(−x)', '−cot x', 'evo'],
    /* simplifications worth knowing cold */
    ['tan x · cot x', '1', 'sim'], ['sin x · csc x', '1', 'sim'], ['cos x · sec x', '1', 'sim'],
    ['{sin x}⁄{tan x}', 'cos x', 'sim'], ['cos x · tan x', 'sin x', 'sim'],
    ['{sec x}⁄{csc x}', 'tan x', 'sim'],
    /* cofunction */
    ['sin(90° − x)', 'cos x', 'cof'], ['cos(90° − x)', 'sin x', 'cof'], ['tan(90° − x)', 'cot x', 'cof'],
    ['cot(90° − x)', 'tan x', 'cof'], ['sec(90° − x)', 'csc x', 'cof'], ['csc(90° − x)', 'sec x', 'cof'],
    /* supplementary and shifted */
    ['sin(180° − x)', 'sin x', 'shf'], ['cos(180° − x)', '−cos x', 'shf'], ['tan(180° − x)', '−tan x', 'shf'],
    ['sin(180° + x)', '−sin x', 'shf'], ['cos(180° + x)', '−cos x', 'shf'], ['tan(180° + x)', 'tan x', 'shf'],
    ['sin(x + 360°)', 'sin x', 'shf'], ['cos(x + 360°)', 'cos x', 'shf'], ['tan(x + 180°)', 'tan x', 'shf'],
    /* double angle */
    ['sin 2x', '2 sin x cos x', 'dbl'], ['cos 2x', 'cos²x − sin²x', 'dbl'],
    ['cos 2x', '2 cos²x − 1', 'dbl'], ['cos 2x', '1 − 2 sin²x', 'dbl'],
    ['tan 2x', '{2 tan x}⁄{1 − tan²x}', 'dbl'],
    /* half angle */
    ['tan({x}⁄{2})', '{1 − cos x}⁄{sin x}', 'hlf'], ['tan({x}⁄{2})', '{sin x}⁄{1 + cos x}', 'hlf'],
    ['sin²({x}⁄{2})', '{1 − cos x}⁄2', 'hlf'], ['cos²({x}⁄{2})', '{1 + cos x}⁄2', 'hlf'],
    /* power reduction */
    ['sin²x', '{1 − cos 2x}⁄2', 'pwr'], ['cos²x', '{1 + cos 2x}⁄2', 'pwr'],
    ['tan²x', '{1 − cos 2x}⁄{1 + cos 2x}', 'pwr'],
    /* triple angle */
    ['sin 3x', '3 sin x − 4 sin³x', 'tri'], ['cos 3x', '4 cos³x − 3 cos x', 'tri'],
    /* sum and difference */
    ['sin(x + y)', 'sin x cos y + cos x sin y', 'sum'],
    ['sin(x − y)', 'sin x cos y − cos x sin y', 'sum'],
    ['cos(x + y)', 'cos x cos y − sin x sin y', 'sum'],
    ['cos(x − y)', 'cos x cos y + sin x sin y', 'sum'],
    ['tan(x + y)', '{tan x + tan y}⁄{1 − tan x tan y}', 'sum'],
    ['tan(x − y)', '{tan x − tan y}⁄{1 + tan x tan y}', 'sum'],
    /* product to sum */
    ['2 sin x cos y', 'sin(x + y) + sin(x − y)', 'pts'],
    ['2 cos x cos y', 'cos(x + y) + cos(x − y)', 'pts'],
    ['2 sin x sin y', 'cos(x − y) − cos(x + y)', 'pts'],
    /* more Pythagorean shapes */
    ['sin²x − 1', '−cos²x', 'pyt'], ['cos²x − 1', '−sin²x', 'pyt'],
    ['sin²3x + cos²3x', '1', 'pyt'],
    /* more products worth knowing cold */
    ['sin x · sec x', 'tan x', 'sim'], ['cos x · csc x', 'cot x', 'sim'],
    ['tan x · csc x', 'sec x', 'sim'], ['cot x · sec x', 'csc x', 'sim'],
    /* cofunction, radian form */
    ['sin({π}⁄{2} − x)', 'cos x', 'cof'], ['cos({π}⁄{2} − x)', 'sin x', 'cof'],
    ['tan({π}⁄{2} − x)', 'cot x', 'cof'], ['cot({π}⁄{2} − x)', 'tan x', 'cof'],
    ['sec({π}⁄{2} − x)', 'csc x', 'cof'], ['csc({π}⁄{2} − x)', 'sec x', 'cof'],
    /* shifts, radian form, and the rest of the periodicity table */
    ['sin(π − x)', 'sin x', 'shf'], ['cos(π − x)', '−cos x', 'shf'],
    ['tan(π − x)', '−tan x', 'shf'], ['sin(π + x)', '−sin x', 'shf'],
    ['cos(π + x)', '−cos x', 'shf'],
    ['sec(x + 360°)', 'sec x', 'shf'], ['csc(x + 360°)', 'csc x', 'shf'],
    ['cot(x + 180°)', 'cot x', 'shf'],
    /* everything through tan 2x and cos 2x in terms of tan */
    ['tan x', '{sin 2x}⁄{1 + cos 2x}', 't2x'], ['tan x', '{1 − cos 2x}⁄{sin 2x}', 't2x'],
    ['cos 2x', '{1 − tan²x}⁄{1 + tan²x}', 't2x'], ['sin 2x', '{2 tan x}⁄{1 + tan²x}', 't2x'],
    /* triple angle for tangent */
    ['tan 3x', '{3 tan x − tan³x}⁄{1 − 3 tan²x}', 'tri'],
    /* half angle with the radical */
    ['sin({x}⁄{2})', '±√({1 − cos x}⁄2)', 'rad'], ['cos({x}⁄{2})', '±√({1 + cos x}⁄2)', 'rad']
  ];
  /* the board runs four stages of twelve, easy families first */
  var STAGES = [
    ['Fundamentals', ['rec', 'quo', 'pyt', 'evo', 'sim']],
    ['Angles and shifts', ['cof', 'shf']],
    ['Double and half', ['dbl', 'hlf', 'pwr', 't2x']],
    ['Advanced', ['tri', 'sum', 'pts', 'rad']]
  ];

  /* graph base functions; every question is a generated A·f(Bx) with a sign */
  var GFNS = [
    ['sin', Math.sin], ['cos', Math.cos], ['tan', Math.tan],
    ['sec', function (x) { return 1 / Math.cos(x); }],
    ['csc', function (x) { return 1 / Math.sin(x); }],
    ['cot', function (x) { return Math.cos(x) / Math.sin(x); }]
  ];

  /* ---------------- data: the unit circle -------------------------------- */
  /* label, cos display, sin display, tan display, cos value, sin value */
  var ANGLES = [
    ['0',     '1',     '0',     '0',          1,      0],
    ['π⁄6',   '√3⁄2',  '1⁄2',   '√3⁄3',       0.866,  0.5],
    ['π⁄4',   '√2⁄2',  '√2⁄2',  '1',          0.707,  0.707],
    ['π⁄3',   '1⁄2',   '√3⁄2',  '√3',         0.5,    0.866],
    ['π⁄2',   '0',     '1',     'undefined',  0,      1],
    ['2π⁄3',  '−1⁄2',  '√3⁄2',  '−√3',       -0.5,    0.866],
    ['3π⁄4',  '−√2⁄2', '√2⁄2',  '−1',        -0.707,  0.707],
    ['5π⁄6',  '−√3⁄2', '1⁄2',   '−√3⁄3',     -0.866,  0.5],
    ['π',     '−1',    '0',     '0',         -1,      0],
    ['7π⁄6',  '−√3⁄2', '−1⁄2',  '√3⁄3',      -0.866, -0.5],
    ['5π⁄4',  '−√2⁄2', '−√2⁄2', '1',         -0.707, -0.707],
    ['4π⁄3',  '−1⁄2',  '−√3⁄2', '√3',        -0.5,   -0.866],
    ['3π⁄2',  '0',     '−1',    'undefined',  0,     -1],
    ['5π⁄3',  '1⁄2',   '−√3⁄2', '−√3',        0.5,   -0.866],
    ['7π⁄4',  '√2⁄2',  '−√2⁄2', '−1',         0.707, -0.707],
    ['11π⁄6', '√3⁄2',  '−1⁄2',  '−√3⁄3',      0.866, -0.5]
  ];
  /* degree labels, index-parallel to ANGLES */
  var DEG = ['0°', '30°', '45°', '60°', '90°', '120°', '135°', '150°', '180°',
             '210°', '225°', '240°', '270°', '300°', '315°', '330°'];
  /* the same angles as fractions of π, for generating coterminal labels */
  var FRAC = [[0, 1], [1, 6], [1, 4], [1, 3], [1, 2], [2, 3], [3, 4], [5, 6], [1, 1],
              [7, 6], [5, 4], [4, 3], [3, 2], [5, 3], [7, 4], [11, 6]];

  /* element names, index-parallel to ELEMENTS */
  var ELEM_NAMES = ['Hydrogen', 'Helium', 'Lithium', 'Beryllium', 'Boron', 'Carbon',
    'Nitrogen', 'Oxygen', 'Fluorine', 'Neon', 'Sodium', 'Magnesium', 'Aluminum',
    'Silicon', 'Phosphorus', 'Sulfur', 'Chlorine', 'Argon', 'Potassium', 'Calcium',
    'Scandium', 'Titanium', 'Vanadium', 'Chromium', 'Manganese', 'Iron', 'Cobalt',
    'Nickel', 'Copper', 'Zinc', 'Gallium', 'Germanium', 'Arsenic', 'Selenium',
    'Bromine', 'Silver', 'Tin', 'Iodine', 'Cesium', 'Barium', 'Gold', 'Mercury', 'Lead'];

  /* the common polyatomic ions: name, formula */
  var IONS = [
    ['ammonium', 'NH₄⁺'], ['hydronium', 'H₃O⁺'], ['acetate', 'C₂H₃O₂⁻'],
    ['nitrate', 'NO₃⁻'], ['nitrite', 'NO₂⁻'], ['hydroxide', 'OH⁻'],
    ['cyanide', 'CN⁻'], ['permanganate', 'MnO₄⁻'], ['perchlorate', 'ClO₄⁻'],
    ['chlorate', 'ClO₃⁻'], ['chlorite', 'ClO₂⁻'], ['hypochlorite', 'ClO⁻'],
    ['bicarbonate', 'HCO₃⁻'], ['carbonate', 'CO₃²⁻'], ['sulfate', 'SO₄²⁻'],
    ['sulfite', 'SO₃²⁻'], ['chromate', 'CrO₄²⁻'], ['dichromate', 'Cr₂O₇²⁻'],
    ['peroxide', 'O₂²⁻'], ['oxalate', 'C₂O₄²⁻'], ['phosphate', 'PO₄³⁻'],
    ['thiosulfate', 'S₂O₃²⁻'], ['thiocyanate', 'SCN⁻'], ['cyanate', 'OCN⁻']
  ];

  /* every president: name, first year in office */
  var PRES = [
    ['Washington', 1789], ['J. Adams', 1797], ['Jefferson', 1801], ['Madison', 1809],
    ['Monroe', 1817], ['J. Q. Adams', 1825], ['Jackson', 1829], ['Van Buren', 1837],
    ['W. H. Harrison', 1841], ['Tyler', 1841], ['Polk', 1845], ['Taylor', 1849],
    ['Fillmore', 1850], ['Pierce', 1853], ['Buchanan', 1857], ['Lincoln', 1861],
    ['A. Johnson', 1865], ['Grant', 1869], ['Hayes', 1877], ['Garfield', 1881],
    ['Arthur', 1881], ['Cleveland', 1885], ['B. Harrison', 1889], ['McKinley', 1897],
    ['T. Roosevelt', 1901], ['Taft', 1909], ['Wilson', 1913], ['Harding', 1921],
    ['Coolidge', 1923], ['Hoover', 1929], ['F. D. Roosevelt', 1933], ['Truman', 1945],
    ['Eisenhower', 1953], ['Kennedy', 1961], ['L. B. Johnson', 1963], ['Nixon', 1969],
    ['Ford', 1974], ['Carter', 1977], ['Reagan', 1981], ['G. H. W. Bush', 1989],
    ['Clinton', 1993], ['G. W. Bush', 2001], ['Obama', 2009], ['Trump', 2017],
    ['Biden', 2021]
  ];

  /* the APUSH periods; events are quizzed only where exactly one period fits */
  var PERIODS = [
    ['Period 1', 1491, 1607], ['Period 2', 1607, 1754], ['Period 3', 1754, 1800],
    ['Period 4', 1800, 1848], ['Period 5', 1844, 1877], ['Period 6', 1865, 1898],
    ['Period 7', 1890, 1945], ['Period 8', 1945, 1980], ['Period 9', 1980, 2030]
  ];

  /* the Maclaurin series every BC student memorizes */
  var SERIES = [
    ['eˣ', '1 + x + {x²}⁄{2!} + {x³}⁄{3!} + ⋯'],
    ['sin x', 'x − {x³}⁄{3!} + {x⁵}⁄{5!} − ⋯'],
    ['cos x', '1 − {x²}⁄{2!} + {x⁴}⁄{4!} − ⋯'],
    ['1⁄{1 − x}', '1 + x + x² + x³ + ⋯'],
    ['1⁄{1 + x}', '1 − x + x² − x³ + ⋯'],
    ['ln(1 + x)', 'x − {x²}⁄2 + {x³}⁄3 − ⋯'],
    ['arctan x', 'x − {x³}⁄3 + {x⁵}⁄5 − ⋯'],
    ['e⁻ˣ', '1 − x + {x²}⁄{2!} − {x³}⁄{3!} + ⋯'],
    ['x eˣ', 'x + x² + {x³}⁄{2!} + {x⁴}⁄{3!} + ⋯'],
    ['sin(x²)', 'x² − {x⁶}⁄{3!} + {x¹⁰}⁄{5!} − ⋯'],
    ['x sin x', 'x² − {x⁴}⁄{3!} + {x⁶}⁄{5!} − ⋯'],
    ['cos(2x)', '1 − 2x² + {2x⁴}⁄3 − ⋯']
  ];

  /* irregular-verb kernel: présent forms plus futur and imparfait stems —
     every question is a generated person × verb × tense, never a fixed list */
  var CONJ = {
    'être':    { pr: ['suis', 'es', 'est', 'sommes', 'êtes', 'sont'], fu: 'ser', im: 'ét' },
    'avoir':   { pr: ['ai', 'as', 'a', 'avons', 'avez', 'ont'], fu: 'aur', im: 'av' },
    'aller':   { pr: ['vais', 'vas', 'va', 'allons', 'allez', 'vont'], fu: 'ir', im: 'all' },
    'faire':   { pr: ['fais', 'fais', 'fait', 'faisons', 'faites', 'font'], fu: 'fer', im: 'fais' },
    'pouvoir': { pr: ['peux', 'peux', 'peut', 'pouvons', 'pouvez', 'peuvent'], fu: 'pourr', im: 'pouv' },
    'vouloir': { pr: ['veux', 'veux', 'veut', 'voulons', 'voulez', 'veulent'], fu: 'voudr', im: 'voul' },
    'venir':   { pr: ['viens', 'viens', 'vient', 'venons', 'venez', 'viennent'], fu: 'viendr', im: 'ven' },
    'prendre': { pr: ['prends', 'prends', 'prend', 'prenons', 'prenez', 'prennent'], fu: 'prendr', im: 'pren' },
    'savoir':  { pr: ['sais', 'sais', 'sait', 'savons', 'savez', 'savent'], fu: 'saur', im: 'sav' },
    'devoir':  { pr: ['dois', 'dois', 'doit', 'devons', 'devez', 'doivent'], fu: 'devr', im: 'dev' },
    'voir':    { pr: ['vois', 'vois', 'voit', 'voyons', 'voyez', 'voient'], fu: 'verr', im: 'voy' },
    'dire':    { pr: ['dis', 'dis', 'dit', 'disons', 'dites', 'disent'], fu: 'dir', im: 'dis' }
  };
  var PERSONS = ['je', 'tu', 'il', 'nous', 'vous', 'ils'];
  var FUT_END = ['ai', 'as', 'a', 'ons', 'ez', 'ont'];
  var IMP_END = ['ais', 'ais', 'ait', 'ions', 'iez', 'aient'];

  /* ions for building formulas: name, symbol, charge, needs-parentheses */
  var CATS = [
    ['sodium', 'Na', 1, false], ['potassium', 'K', 1, false], ['lithium', 'Li', 1, false],
    ['silver', 'Ag', 1, false], ['ammonium', 'NH₄', 1, true], ['calcium', 'Ca', 2, false],
    ['magnesium', 'Mg', 2, false], ['barium', 'Ba', 2, false], ['zinc', 'Zn', 2, false],
    ['aluminum', 'Al', 3, false], ['iron(II)', 'Fe', 2, false], ['iron(III)', 'Fe', 3, false],
    ['copper(II)', 'Cu', 2, false], ['lead(II)', 'Pb', 2, false]
  ];
  var ANIONS = [
    ['chloride', 'Cl', 1, false], ['bromide', 'Br', 1, false], ['iodide', 'I', 1, false],
    ['fluoride', 'F', 1, false], ['oxide', 'O', 2, false], ['sulfide', 'S', 2, false],
    ['nitride', 'N', 3, false], ['nitrate', 'NO₃', 1, true], ['nitrite', 'NO₂', 1, true],
    ['sulfate', 'SO₄', 2, true], ['carbonate', 'CO₃', 2, true], ['phosphate', 'PO₄', 3, true],
    ['hydroxide', 'OH', 1, true], ['acetate', 'C₂H₃O₂', 1, true],
    ['chlorate', 'ClO₃', 1, true], ['bicarbonate', 'HCO₃', 1, true]
  ];
  function gcd(a, b) { return b ? gcd(b, a % b) : a; }
  function radLabel(i, k) {
    var num = FRAC[i][0] + 2 * k * FRAC[i][1], den = FRAC[i][1];
    if (!num) return '0';
    var g = gcd(Math.abs(num), den); num /= g; den /= g;
    var sign = num < 0 ? '−' : ''; num = Math.abs(num);
    var top = sign + (num === 1 ? '' : num) + 'π';
    return den === 1 ? top : top + '⁄' + den;
  }
  function degLabel(i, k) {
    var d = parseInt(DEG[i], 10) + 360 * k;
    return (d < 0 ? '−' : '') + Math.abs(d) + '°';   // typographic minus, like every label
  }

  /* ---------------- helpers ---------------------------------------------- */
  function loadTimeline() {
    if (TIMELINE) return Promise.resolve(TIMELINE);
    return fetch('data/timeline.json', { cache: 'no-cache' })
      .then(function (r) { return r.json(); })
      .then(function (j) { TIMELINE = j; return j; })
      .catch(function () { return (TIMELINE = []); });
  }

  function loadVocab() {
    if (FRVOCAB) return Promise.resolve(FRVOCAB);
    return fetch('data/fr-vocab.json', { cache: 'no-cache' })
      .then(function (r) { return r.json(); })
      .then(function (j) { FRVOCAB = j; return j; })
      .catch(function () { return (FRVOCAB = []); });
  }

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function sample(arr, n) { return shuffle(arr.slice()).slice(0, n); }
  function esc(s) { return ctx.esc(s); }

  /* '⁄' stacks a real fraction: A⁄B or {multi word}⁄{multi word}.
     fx() renders a display string to HTML; plain() flattens it for tests,
     labels, and length checks. */
  var FRAC_RE = /(\{[^}]*\}|[^\s{}⁄]+)⁄(\{[^}]*\}|[^\s{}⁄]+)/g;
  function unbrace(t) { return t.charAt(0) === '{' ? t.slice(1, -1) : t; }
  function fx(s) {
    var out = '', last = 0, m;
    FRAC_RE.lastIndex = 0;
    while ((m = FRAC_RE.exec(s)) !== null) {
      out += esc(s.slice(last, m.index));
      out += '<span class="mfrac"><span>' + esc(unbrace(m[1])) + '</span><span>' + esc(unbrace(m[2])) + '</span></span>';
      last = FRAC_RE.lastIndex;
    }
    return out + esc(s.slice(last));
  }
  function flat(s) { return String(s).replace(/[{}]/g, '').replace(/⁄/g, '/'); }
  function estLen(s) {   // rendered width: a fraction is only as wide as its widest half
    var n = 0, last = 0, m;
    FRAC_RE.lastIndex = 0;
    while ((m = FRAC_RE.exec(s)) !== null) {
      n += s.slice(last, m.index).length;
      n += Math.max(unbrace(m[1]).length, unbrace(m[2]).length);
      last = FRAC_RE.lastIndex;
    }
    return n + (s.length - last);
  }

  function best() { return S.getSettings().gameBest || {}; }
  function saveBest(id, n, label) {
    var b = best();
    if (!b[id] || n > b[id].n) { b[id] = { n: n, label: label }; S.setSetting('gameBest', b); }
  }

  /* ---------------- hub ---------------------------------------------------- */
  function hub() {
    st = null;
    var b = best();
    var html = '<div class="head"><h1>Games</h1></div>';
    ORDER_BY_DECK.forEach(function (deckId) {
      var rows = '';
      Object.keys(GAMES).forEach(function (id) {
        if (GAMES[id].deck !== deckId) return;
        rows += '<li><button class="ledger mid" data-go="#/game/' + id + '">' +
          '<span class="lname">' + esc(GAMES[id].name) + '</span>' +
          (b[id] ? '<span class="lsub">best ' + esc(b[id].label) + '</span>' : '') +
          '</button></li>';
      });
      if (rows) html += '<div class="ulabel">' + esc(ctx.nice(deckId)) + '</div><ul class="list" style="gap:0">' + rows + '</ul>';
    });
    if (window.__reqHTML) html += '<div style="margin-top:var(--s-5)">' + window.__reqHTML('Request a game') + '</div>';
    ctx.mount(html);
  }

  function play(id) {
    var g = GAMES[id];
    if (!g) return ctx.go('#/games');
    clearTimeout(timer);
    if ((id === 'timeline' || id === 'periodquiz' || id === 'yearquiz') && !TIMELINE) {
      return loadTimeline().then(function () {
        if (location.hash.indexOf('#/game/' + id) === 0) play(id);
      });
    }
    if ((id === 'frmatch' || id === 'frgender') && !FRVOCAB) {
      return loadVocab().then(function () {
        if (location.hash.indexOf('#/game/' + id) === 0) play(id);
      });
    }
    if (g.kind === 'order') startOrder(id);
    else if (g.kind === 'match') startMatch(id);
    else if (g.kind === 'graph') startGraph(id);
    else if (g.kind === 'board') startBoard(id);
    else if (g.kind === 'quiz') startQuiz(id);
    else startCircle(id);
  }

  /* ==========================================================================
     BOARD — one prompt at a time over a persistent field of expressions;
     tap the one it equals. First-try hits score.
     ========================================================================== */
  function boardRound(n, stage) {
    var picked = [], used = {};
    var pool;
    if (stage != null) {
      var fams = STAGES[stage][1];
      pool = EQUIV.filter(function (f) { return fams.indexOf(f[2]) > -1; });
      if (stage === 0) {
        // exact values, generated fresh, belong with the fundamentals
        var vals = [];
        shuffle(ANGLES.map(function (_, i) { return i; })).slice(0, 6).forEach(function (i) {
          var fn = ['sin', 'cos', 'tan'][Math.floor(Math.random() * 3)];
          var v = fn === 'sin' ? ANGLES[i][2] : fn === 'cos' ? ANGLES[i][1] : ANGLES[i][3];
          var lbl = Math.random() < 0.5 ? DEG[i] : ANGLES[i][0];
          if (v !== 'undefined') vals.push([fn + ' ' + lbl, v]);
        });
        pool = pool.concat(vals);
      }
    } else {
      pool = EQUIV.slice();
    }
    shuffle(pool.slice()).forEach(function (f) {
      if (estLen(f[0]) > 26 || estLen(f[1]) > 26) return;
      var pl = flat(f[0]), tl = flat(f[1]);
      if (picked.length >= n) return;
      // prompts and tiles must all be distinct — and no tile may read the
      // same as any prompt in the round, or the board answers itself
      if (used[pl] || used[tl]) return;
      used[pl] = used[tl] = 1;
      picked.push(f);
    });
    return picked;
  }
  /* conjugation board: person × verb × tense, the form is computed */
  function conjRound(n) {
    var verbs = Object.keys(CONJ);
    var out = [], used = {}, guard = 0;
    while (out.length < n && guard++ < 400) {
      var v = verbs[Math.floor(Math.random() * verbs.length)];
      var t = ['présent', 'imparfait', 'futur'][Math.floor(Math.random() * 3)];
      var p = Math.floor(Math.random() * 6);
      var c = CONJ[v];
      var form = t === 'présent' ? c.pr[p] : t === 'futur' ? c.fu + FUT_END[p] : c.im + IMP_END[p];
      var prompt = PERSONS[p] + ' · ' + v + ' · ' + t;
      if (used[prompt] || used[form]) continue;
      used[prompt] = 1; used[form] = 1;
      out.push([prompt, form]);
    }
    return out;
  }

  /* term board: a definition from the Lang deck; tap the term it defines */
  function termRound(n) {
    var d = S.getDeck('lang');
    var out = [], used = {};
    if (!d) return out;
    shuffle(d.cards.slice()).forEach(function (c) {
      if (out.length >= n || c.v !== 'DEFINE') return;
      var m = /^Define (?:the |an? )?([^.(]{2,26}?)\.?$/i.exec(clean(c.q));
      if (!m) return;
      var term = m[1].trim(), def = clean(c.a);
      if (def.length > 130) def = def.slice(0, 127).replace(/\s+\S*$/, '') + '…';
      var kt = term.toLowerCase();
      if (used[kt] || used[def]) return;
      used[kt] = 1; used[def] = 1;
      out.push([def, term]);
    });
    return out;
  }

  function dealBoard(facts) {
    st.facts = shuffle(facts.slice());
    st.tiles = shuffle(facts.map(function (f) { return { t: f[1], done: false }; }));
    st.i = 0; st.total = facts.length; st.firstTry = true; st.flash = -1; st.anim = true;
  }
  function startBoard(id) {
    st = { id: id, kind: 'board', score: 0, played: 0, stage: id === 'identities' ? 0 : null };
    dealBoard(id === 'frconj' ? conjRound(10)
            : id === 'langboard' ? termRound(9)
            : boardRound(12, 0));
    renderBoard();
  }
  function renderBoard(still) {
    if (st.i >= st.total) {
      // Identities runs three stages, easy families first — the score rides through
      if (st.stage != null && st.stage < STAGES.length - 1) {
        st.played += st.total;
        st.stage++;
        dealBoard(boardRound(12, st.stage));
      } else {
        var grand = st.played + st.total;
        return gameDone(st.id, st.score, grand, st.score + ' of ' + grand);
      }
    }
    var f = st.facts[st.i];
    var scope = st.stage != null
      ? STAGES[st.stage][0] + ' · ' + st.score + ' first try'
      : st.score + ' first try';
    ctx.mount(
      ctx.backbar(GAMES[st.id].name) +
      gameTop(scope, (st.played + st.i + 1) + ' of ' + (st.stage != null ? 48 : st.total)) +
      '<div class="gcur bcur' + (still ? '' : ' swap') + '">' +
        '<div class="gname num' + (flat(f[0]).length > 44 ? ' gsm' : '') + '">' + fx(f[0]) + '</div></div>' +
      '<div class="board' + (st.anim ? ' deal' : '') + '">' + st.tiles.map(function (tl, i) {
        var cls = 'tile' + (tl.done ? ' done' : '') + (i === st.flash ? ' flash' : '');
        return '<button class="' + cls + '" data-tile="' + i + '"' + (tl.done ? ' disabled' : '') + '>' + fx(tl.t) + '</button>';
      }).join('') + '</div>',
      { session: true, keepScroll: st.i > 0 }
    );
    st.anim = false;
  }
  function tapTile(i) {
    if (!st || st.kind !== 'board') return;
    var tl = st.tiles[i], f = st.facts[st.i];
    if (!tl || tl.done) return;
    if (tl.t === f[1]) {
      tl.done = true;
      if (st.firstTry) st.score++;
      st.i++; st.firstTry = true; st.flash = -1;
      renderBoard();
    } else {
      st.firstTry = false; st.flash = i;
      renderBoard(true);
      clearTimeout(timer);
      timer = setTimeout(function () {
        if (!st || st.kind !== 'board') return;
        st.flash = -1; renderBoard(true);
      }, 450);
    }
  }

  function gameTop(scopeText, posText) {
    return '<div class="sess-top"><span class="scope">' + esc(scopeText) + '</span>' +
      '<span class="pos num">' + esc(posText) + '</span></div>';
  }
  function gameDone(id, score, total, label) {
    saveBest(id, score / total, label);
    var g = GAMES[id];
    st = null;
    ctx.mount(
      ctx.backbar(GAMES[id].name) +
      '<div class="done-hero"><span class="k">' + esc(g.name) + '</span>' +
      '<div class="v num">' + esc(label) + '</div></div>' +
      '<button class="act" data-gagain="' + id + '">Play again</button>' +
      '<div style="margin-top:var(--s-3)"><button class="textbtn" data-go="#/games">Games</button></div>',
      { session: true }
    );
  }

  /* ==========================================================================
     ORDER — the timeline mechanic: place each item into the sequence.
     Timeline rounds are extracted live from the US History deck; chemistry
     rounds are generated from the periodic-table reference.
     ========================================================================== */
  function clean(s) { return T.plain(s).replace(/\s+/g, ' ').trim(); }

  function timelineRound(n) {
    // real events, well separated in time so the ordering is fair
    var pool = shuffle(TIMELINE.slice()), picked = [], used = {};
    pool.forEach(function (e) {
      if (picked.length >= n) return;
      if (used[e.y]) return;                       // one event per year
      if (picked.some(function (p) { return Math.abs(p.v - e.y) < 6; })) return;
      used[e.y] = 1;
      picked.push({ n: e.t, v: e.y, vl: String(e.y), d: e.d });
    });
    return picked;
  }

  function chemRound() {
    var axes = [
      { title: 'Highest atomic number first', get: function (e) { return e[1]; }, vl: function (e) { return 'Z = ' + e[1]; } },
      { title: 'Heaviest first', get: function (e) { return e[2]; }, vl: function (e) { return e[2].toFixed(1) + ' u'; } },
      { title: 'Most electronegative first', get: function (e) { return e[3]; }, vl: function (e) { return 'EN ' + e[3].toFixed(2); }, gap: 0.25 }
    ];
    var ax = axes[Math.floor(Math.random() * axes.length)];
    var pool = shuffle(ELEMENTS.filter(function (e) { return ax.get(e) > 0; }).slice());
    var picked = [];
    pool.forEach(function (e) {
      if (picked.length >= 6) return;
      var v = ax.get(e);
      var fair = picked.every(function (p) { return Math.abs(ax.get(p) - v) >= (ax.gap || 0.001); });
      if (fair) picked.push(e);
    });
    return { title: ax.title,
      items: picked.map(function (e) { return { n: e[0], v: -ax.get(e), vl: ax.vl(e) }; }) };
  }

  /* presidents, spaced apart so the ordering is fair */
  function presRound(n) {
    var pool = shuffle(PRES.slice()), picked = [];
    pool.forEach(function (p) {
      if (picked.length >= n) return;
      if (picked.some(function (q) { return Math.abs(q.v - p[1]) < 8; })) return;
      picked.push({ n: p[0], v: p[1], vl: String(p[1]) });
    });
    return picked;
  }

  function startOrder(id) {
    var axis, pool;
    if (id === 'timeline') {
      axis = { title: 'Earliest at the top' };
      pool = timelineRound(8);
    } else if (id === 'presorder') {
      axis = { title: 'Earliest at the top' };
      pool = presRound(8);
    } else {
      var ax = chemRound();
      axis = { title: ax.title };
      pool = ax.items;   // values negated so the engine always sorts ascending
    }
    var anchor = pool.shift();
    st = { id: id, kind: 'order', axis: axis, queue: pool, placed: [anchor],
           cur: pool[0], score: 0, done: 0, total: pool.length };
    renderOrder();
  }

  function renderOrder(justIdx) {
    if (!st.cur) {
      var label = st.score + ' of ' + st.total;
      return gameDone(st.id, st.score, st.total, label);
    }
    var rows = '<button class="gap" data-gap="0" aria-label="Place first"></button>';
    st.placed.forEach(function (p, i) {
      rows += '<div class="grow' + (p.miss ? ' miss' : '') + (i === justIdx ? ' reveal' : '') + '">' +
        '<span class="gname">' + esc(p.n) + '</span><span class="gval num">' + esc(p.vl) + '</span></div>' +
        '<button class="gap" data-gap="' + (i + 1) + '" aria-label="Place after ' + esc(p.n) + '"></button>';
    });
    ctx.mount(
      ctx.backbar(GAMES[st.id].name) +
      gameTop(st.axis.title, (st.done + 1) + ' of ' + st.total) +
      '<div class="gcur"><div class="gname">' + esc(st.cur.n) + '</div></div>' +
      '<div class="gline">' + rows + '</div>',
      { session: true, keepScroll: st.done > 0 }
    );
  }

  function placeAt(gapIdx) {
    if (!st || st.kind !== 'order' || !st.cur) return;
    var item = st.cur, placed = st.placed;
    var okBefore = gapIdx === 0 || placed[gapIdx - 1].v <= item.v;
    var okAfter = gapIdx === placed.length || item.v <= placed[gapIdx].v;
    var idx;
    if (okBefore && okAfter) {
      st.score++;
      idx = gapIdx;
    } else {
      item.miss = true;
      idx = 0;
      while (idx < placed.length && placed[idx].v < item.v) idx++;
      ctx.toast(item.n + ', ' + item.vl);
    }
    placed.splice(idx, 0, item);
    st.done++;
    st.queue.shift();
    st.cur = st.queue[0] || null;
    renderOrder(idx);
  }

  /* ==========================================================================
     MATCH — two columns of text; pair them up. Boards come from the decks
     themselves or from symbolic generators — a fresh board every round.
     ========================================================================== */
  function deckPairs(deckId) {
    var d = S.getDeck(deckId);
    var tiers = [[40, 60], [60, 90], [80, 120]];
    var cands = [], seenQ = {}, seenA = {};
    if (d) {
      for (var t = 0; t < tiers.length && cands.length < 24; t++) {
        shuffle(d.cards.slice()).forEach(function (c) {
          if (cands.length >= 60) return;
          var q = clean(c.q), a = clean(c.a);
          if (q.length < 3 || a.length < 2 || q.length > tiers[t][0] || a.length > tiers[t][1]) return;
          var kq = q.toLowerCase(), ka = a.toLowerCase();
          if (seenQ[kq] || seenA[ka]) return;
          seenQ[kq] = seenA[ka] = 1;
          cands.push([q, a]);
        });
      }
    }
    return sample(cands, Math.min(6, cands.length));
  }

  function sup(n) {
    return String(n).split('').map(function (c) { return '⁰¹²³⁴⁵⁶⁷⁸⁹'.charAt(+c); }).join('');
  }
  function genDerivPairs(n) {
    var out = [], seenL = {}, seenR = {}, guard = 0;
    while (out.length < n && guard++ < 200) {
      var a = 2 + Math.floor(Math.random() * 4);           // 2..5
      var p = 2 + Math.floor(Math.random() * 4);           // 2..5
      var ax = (Math.random() < 0.4 ? '' : a) + 'x';
      var A = ax === 'x' ? 1 : a;
      var pre = A > 1 ? A + ' ' : '';
      var pair;
      switch (Math.floor(Math.random() * 8)) {
        case 0: pair = ['x' + sup(p), p + 'x' + (p - 1 > 1 ? sup(p - 1) : '')]; break;
        case 1: pair = [a + 'x' + sup(p), (a * p) + 'x' + (p - 1 > 1 ? sup(p - 1) : '')]; break;
        case 2: pair = ['sin ' + ax, pre + 'cos ' + ax]; break;
        case 3: pair = ['cos ' + ax, '−' + pre + 'sin ' + ax]; break;
        case 4: pair = ['tan ' + ax, pre + 'sec² ' + ax]; break;
        case 5: pair = [A > 1 ? 'e' + sup(A) + 'ˣ' : 'eˣ', A > 1 ? A + ' e' + sup(A) + 'ˣ' : 'eˣ']; break;
        case 6: pair = ['ln ' + ax, '1⁄x']; break;
        case 7: var m = 1 + Math.floor(Math.random() * 3);
          pair = ['1⁄' + (m > 1 ? '{x' + sup(m) + '}' : 'x'), '{−' + m + '}⁄{x' + sup(m + 1) + '}']; break;
      }
      if (seenL[pair[0]] || seenR[pair[1]]) continue;
      seenL[pair[0]] = seenR[pair[1]] = 1;
      out.push(pair);
    }
    return out;
  }
  function genValuePairs(n, seenR) {
    var out = [], seenL = {}, guard = 0;
    while (out.length < n && guard++ < 100) {
      var i = Math.floor(Math.random() * 16);
      var fn = ['sin', 'cos', 'tan'][Math.floor(Math.random() * 3)];
      var val = fn === 'sin' ? ANGLES[i][2] : fn === 'cos' ? ANGLES[i][1] : ANGLES[i][3];
      var left = fn + ' ' + ANGLES[i][0];
      if (seenL[left] || seenR[val]) continue;
      seenL[left] = 1; seenR[val] = 1;
      out.push([left, val]);
    }
    return out;
  }
  /* antiderivatives, generated the same way the derivatives are */
  function genIntPairs(n) {
    var out = [], seenL = {}, seenR = {}, guard = 0;
    while (out.length < n && guard++ < 200) {
      var p = 2 + Math.floor(Math.random() * 5);           // 2..6
      var pair;
      switch (Math.floor(Math.random() * 8)) {
        case 0: pair = ['x' + sup(p), '{x' + sup(p + 1) + '}⁄' + (p + 1) + ' + C']; break;
        case 1: var a = (p + 1) * (1 + Math.floor(Math.random() * 3)), c0 = a / (p + 1);
          pair = [a + 'x' + sup(p), (c0 > 1 ? c0 : '') + 'x' + sup(p + 1) + ' + C']; break;
        case 2: pair = ['cos x', 'sin x + C']; break;
        case 3: pair = ['sin x', '−cos x + C']; break;
        case 4: pair = ['sec²x', 'tan x + C']; break;
        case 5: pair = ['1⁄x', 'ln|x| + C']; break;
        case 6: pair = ['eˣ', 'eˣ + C']; break;
        case 7: pair = ['1⁄{1 + x²}', 'arctan x + C']; break;
      }
      if (seenL[pair[0]] || seenR[pair[1]]) continue;
      seenL[pair[0]] = seenR[pair[1]] = 1;
      out.push(pair);
    }
    return out;
  }

  /* the same angle in both notations, coterminal spins included */
  function genRadPairs(n) {
    var out = [], seenL = {}, seenR = {}, guard = 0;
    while (out.length < n && guard++ < 200) {
      var i = Math.floor(Math.random() * 16);
      var k = [0, 0, -1, 1][Math.floor(Math.random() * 4)];
      var L = radLabel(i, k), R = degLabel(i, k);
      if (L === '0') R = '0°';
      if (seenL[L] || seenR[R]) continue;
      seenL[L] = 1; seenR[R] = 1;
      out.push([L, R]);
    }
    return out;
  }

  function refPairs(table) { return sample(table, 6).map(function (r) { return [r[0], r[1]]; }); }
  function elemPairs() {
    return sample(ELEMENTS.map(function (e, i) { return [ELEM_NAMES[i], e[0]]; }), 6);
  }

  /* ionic formulas assembled by charge balance — cross, reduce, parenthesize */
  function subNum(n) {
    return n === 1 ? '' : String(n).split('').map(function (c) { return '₀₁₂₃₄₅₆₇₈₉'.charAt(+c); }).join('');
  }
  function formulaOf(cat, an) {
    var g = gcd(cat[2], an[2]);
    var nCat = an[2] / g, nAn = cat[2] / g;
    var cpart = (cat[3] && nCat > 1 ? '(' + cat[1] + ')' : cat[1]) + subNum(nCat);
    var apart = (an[3] && nAn > 1 ? '(' + an[1] + ')' : an[1]) + subNum(nAn);
    return cpart + apart;
  }
  function genFormulaPairs(n) {
    var out = [], seenL = {}, seenR = {}, guard = 0;
    while (out.length < n && guard++ < 200) {
      var cat = CATS[Math.floor(Math.random() * CATS.length)];
      var an = ANIONS[Math.floor(Math.random() * ANIONS.length)];
      var name = cat[0] + ' ' + an[0], f = formulaOf(cat, an);
      if (seenL[name] || seenR[f]) continue;
      seenL[name] = 1; seenR[f] = 1;
      out.push([name, f]);
    }
    return out;
  }

  function startMatch(id) {
    var pairs =
      id === 'derivmatch' ? genDerivPairs(6) :
      id === 'antideriv' ? genIntPairs(6) :
      id === 'radmatch' ? genRadPairs(6) :
      id === 'chemformula' ? genFormulaPairs(6) :
      id === 'seriesmatch' ? refPairs(SERIES) :
      id === 'ionmatch' ? refPairs(IONS) :
      id === 'elemmatch' ? elemPairs() :
      id === 'frmatch' ? (FRVOCAB && FRVOCAB.length ? sample(FRVOCAB, 6) : deckPairs('french')) :
      deckPairs('lang');
    if (!pairs.length) pairs = genValuePairs(6, {});   // never render an empty board
    var left = [], right = [];
    pairs.forEach(function (p, i) { left.push({ t: p[0], k: i }); right.push({ t: p[1], k: i }); });
    shuffle(left); shuffle(right);
    st = { id: id, kind: 'match', left: left, right: right, selL: -1, selR: -1,
           tries: 0, hits: 0, total: pairs.length, anim: true };
    renderMatch();
  }

  function renderMatch() {
    if (st.hits === st.total) {
      var label = st.total + ' in ' + st.tries;
      return gameDone(st.id, st.total / Math.max(st.tries, st.total), label);
    }
    var head = {
      derivmatch: ['f(x)', 'f′(x)'],
      antideriv: ['f(x)', '∫ f(x) dx'],
      radmatch: ['Radians', 'Degrees'],
      seriesmatch: ['f(x)', 'Maclaurin series'],
      ionmatch: ['Ion', 'Formula'],
      elemmatch: ['Element', 'Symbol'],
      chemformula: ['Compound', 'Formula'],
      frmatch: ['French', 'English']
    }[st.id] || ['Device', 'What it is'];
    function col(items, side, sel) {
      return items.map(function (it, i) {
        var cls = 'mrow' + (it.done ? ' done' : i === sel ? ' sel' : '');
        return '<button class="' + cls + '" data-m' + side + '="' + i + '"' + (it.done ? ' disabled' : '') + '>' +
          fx(it.t) + '</button>';
      }).join('');
    }
    ctx.mount(
      ctx.backbar(GAMES[st.id].name) +
      gameTop(st.hits + ' of ' + st.total, st.tries + (st.tries === 1 ? ' try' : ' tries')) +
      '<div class="mcols' + (st.anim ? ' deal' : '') + '">' +
        '<div><div class="k mhead">' + esc(head[0]) + '</div>' + col(st.left, 'l', st.selL) + '</div>' +
        '<div><div class="k mhead">' + esc(head[1]) + '</div>' + col(st.right, 'r', st.selR) + '</div>' +
      '</div>',
      { session: true, keepScroll: true }
    );
    st.anim = false;
  }

  function pickMatch(side, i) {
    if (!st || st.kind !== 'match') return;
    if (side === 'l') st.selL = (st.selL === i ? -1 : i); else st.selR = (st.selR === i ? -1 : i);
    if (st.selL > -1 && st.selR > -1) {
      st.tries++;
      var L = st.left[st.selL], R = st.right[st.selR];
      if (L.k === R.k) { L.done = R.done = true; st.hits++; }
      st.selL = st.selR = -1;
    }
    renderMatch();
  }

  /* ==========================================================================
     CIRCLE — the unit circle: tap angles, tap coordinates, name exact values
     ========================================================================== */
  function startCircle(id) {
    var deg = id === 'degcircle';
    var qs = [];
    var idxs = shuffle(ANGLES.map(function (_, i) { return i; }));
    for (var i = 0; i < 12; i++) {
      var a = idxs[i % idxs.length];
      // radians rotate tap-angle / tap-coordinates / name-a-value;
      // degrees alternate tap-a-degree / name-the-marked-angle
      var type = deg ? (i % 2 ? 3 : 0) : i % 3;
      qs.push({ type: type, a: a });
    }
    st = { id: id, kind: 'circle', deg: deg, qs: shuffle(qs), i: 0, score: 0, total: 12,
           lock: false, wrong: -1 };
    renderCircle();
  }

  function circleSVG(q) {
    var s = '<svg viewBox="0 0 300 300" class="uc" aria-label="Unit circle">';
    s += '<line class="uc-axis" x1="20" y1="150" x2="280" y2="150"/>';
    s += '<line class="uc-axis" x1="150" y1="20" x2="150" y2="280"/>';
    s += '<circle class="uc-ring" cx="150" cy="150" r="110" fill="none"/>';
    var marked = q.type === 2 || q.type === 3;   // a highlighted point, answered via choices
    ANGLES.forEach(function (a, i) {
      var x = 150 + 110 * a[4], y = 150 - 110 * a[5];
      var cls = 'uc-dot';
      if (st.lock && i === st.qs[st.i].a) cls += ' on';        // the right answer, revealed
      if (st.lock && i === st.wrong) cls += ' off';            // the tap that missed
      if (!st.lock && marked && i === q.a) cls += ' on';       // the highlighted point
      s += '<g' + (!marked ? ' data-dot="' + i + '"' : '') + '>' +
        '<circle class="uc-hit" cx="' + x + '" cy="' + y + '" r="17"/>' +
        '<circle class="' + cls + '" cx="' + x + '" cy="' + y + '" r="5"/></g>';
    });
    s += '</svg>';
    return s;
  }

  function circlePrompt(q) {
    var a = ANGLES[q.a];
    if (q.type === 0) {
      // half the time the label is a generated coterminal form (17π/6, −210°…)
      if (q.k == null) q.k = Math.random() < 0.5 ? 0 : [-1, 1, 2][Math.floor(Math.random() * 3)];
      return st.deg ? degLabel(q.a, q.k) : radLabel(q.a, q.k);
    }
    if (q.type === 1) {
      // half coordinate-pair phrasing (the classic unit-circle test), half cos/sin
      if (q.coord == null) q.coord = Math.random() < 0.5;
      return q.coord ? '(' + a[1] + ', ' + a[2] + ')'
                     : 'cos θ = ' + a[1] + ' · sin θ = ' + a[2];
    }
    if (q.type === 3) return 'θ = ?';
    var fn = ['cos', 'sin', 'tan'][q.a % 3];
    q.fn = fn;
    return fn + ' θ = ?';
  }

  function circleChoices(q) {
    if (q.type !== 2 && q.type !== 3) return '';
    if (!q.choices) {
      if (q.type === 3) {
        q.right = DEG[q.a];
        q.choices = shuffle([q.right].concat(sample(DEG.filter(function (v) { return v !== q.right; }), 3)));
      } else {
        var a = ANGLES[q.a];
        var right = q.fn === 'cos' ? a[1] : q.fn === 'sin' ? a[2] : a[3];
        var pool = { cos: ['1', '√3⁄2', '√2⁄2', '1⁄2', '0', '−1⁄2', '−√2⁄2', '−√3⁄2', '−1'],
                     sin: ['1', '√3⁄2', '√2⁄2', '1⁄2', '0', '−1⁄2', '−√2⁄2', '−√3⁄2', '−1'],
                     tan: ['0', '√3⁄3', '1', '√3', 'undefined', '−√3', '−1', '−√3⁄3'] }[q.fn];
        q.choices = shuffle([right].concat(sample(pool.filter(function (v) { return v !== right; }), 3)));
        q.right = right;
      }
    }
    return '<div class="choices">' + q.choices.map(function (c, i) {
      var state = '';
      if (st.lock) state = c === q.right ? 'right' : (i === st.wrongChoice ? 'wrong' : 'mute');
      return '<button class="choice num" data-gc="' + i + '"' +
        (state ? ' data-state="' + state + '"' : '') + (st.lock ? ' disabled' : '') + '>' +
        fx(c) + '</button>';
    }).join('') + '</div>';
  }

  function renderCircle() {
    if (st.i >= st.total) {
      var label = st.score + ' of ' + st.total;
      return gameDone(st.id, st.score, st.total, label);
    }
    var q = st.qs[st.i];
    var prompt = circlePrompt(q);
    ctx.mount(
      ctx.backbar(GAMES[st.id].name) +
      gameTop(st.score + ' right', (st.i + 1) + ' of ' + st.total) +
      '<div class="gcur"><div class="gname" data-plain="' + esc(flat(prompt)) + '">' + fx(prompt) + '</div></div>' +
      '<div class="ucwrap">' + circleSVG(q) + '</div>' +
      circleChoices(q),
      { session: true, keepScroll: st.i > 0 }
    );
  }

  function nextCircle() {
    // the advance timer can outlive the game — never render over another view
    if (!st || st.kind !== 'circle') return;
    if (location.hash.indexOf('#/game/' + st.id) !== 0) { st = null; return; }
    st.i++; st.lock = false; st.wrong = -1; st.wrongChoice = -1;
    renderCircle();
  }

  function tapDot(i) {
    if (!st || st.kind !== 'circle' || st.lock) return;
    var q = st.qs[st.i];
    if (q.type === 2 || q.type === 3) return;
    st.lock = true;
    if (i === q.a) { st.score++; }
    else { st.wrong = i; ctx.toast((st.deg ? DEG[q.a] : ANGLES[q.a][0]) + ' is here'); }
    renderCircle();
    timer = setTimeout(nextCircle, i === q.a ? 550 : 1400);
  }

  function tapChoice(i) {
    if (!st || st.kind !== 'circle' || st.lock) return;
    var q = st.qs[st.i];
    if (q.type !== 2 && q.type !== 3) return;
    st.lock = true;
    if (q.choices[i] === q.right) { st.score++; }
    else { st.wrongChoice = i; }
    renderCircle();
    timer = setTimeout(nextCircle, q.choices[i] === q.right ? 550 : 1400);
  }

  /* ==========================================================================
     QUIZ — one generated prompt, choices as text rows. Same feedback grammar
     as the circle: the right answer settles to ink, the miss recedes.
     ========================================================================== */
  function fracLabel(a, b) {
    var g = gcd(a, b); a /= g; b /= g;
    return b === 1 ? String(a) : a + '⁄' + b;
  }
  function pick3(pool, right) {
    var seen = {}; seen[right] = 1;
    var out = [];
    shuffle(pool.slice()).forEach(function (v) {
      if (out.length >= 3 || seen[v]) return;
      seen[v] = 1; out.push(v);
    });
    return out;
  }

  function limitsRound(n) {
    var qs = [], seen = {}, guard = 0;
    while (qs.length < n && guard++ < 200) {
      var t = Math.floor(Math.random() * 6), p, r, pool;
      if (t === 4) {                              // continuity: plug in, fully generated
        var pa = 1 + Math.floor(Math.random() * 4), pb = 1 + Math.floor(Math.random() * 6);
        var pc = 1 + Math.floor(Math.random() * 9), pk = 1 + Math.floor(Math.random() * 4);
        p = 'lim x→' + pk + '  (' + pa + 'x² + ' + pb + 'x + ' + pc + ')';
        r = String(pa * pk * pk + pb * pk + pc);
        pool = [String(pa * pk * pk - pb * pk + pc), String(pb * pk + pc),
                String(pa * pk * pk + pb * pk), String(pa * pk + pb + pc), '∞'];
      } else if (t === 5) {                       // tan takes sine's place, still generated
        var ta = 2 + Math.floor(Math.random() * 6), tb = 2 + Math.floor(Math.random() * 6);
        if (Math.random() < 0.5) {
          p = 'lim x→0  {tan ' + ta + 'x}⁄x';
          r = String(ta);
        } else {
          p = 'lim x→0  {sin ' + ta + 'x}⁄{tan ' + tb + 'x}';
          r = fracLabel(ta, tb);
        }
        pool = ['0', '1', String(ta), String(tb), fracLabel(ta, tb), fracLabel(tb, ta), '∞'];
      } else if (t === 0) {                       // rational function at infinity
        var dp = 1 + Math.floor(Math.random() * 3), dq = 1 + Math.floor(Math.random() * 3);
        var a = 2 + Math.floor(Math.random() * 8), b = 2 + Math.floor(Math.random() * 8);
        p = 'lim x→∞  {' + a + (dp > 1 ? 'x' + sup(dp) : 'x') + ' + 1}⁄{' +
            b + (dq > 1 ? 'x' + sup(dq) : 'x') + ' − 2}';
        r = dp < dq ? '0' : dp > dq ? '∞' : fracLabel(a, b);
        pool = ['0', '∞', '−∞', fracLabel(a, b), fracLabel(b, a), '1'];
      } else if (t === 1) {                       // sin over x families
        var c1 = 2 + Math.floor(Math.random() * 6), c2 = 2 + Math.floor(Math.random() * 6);
        if (Math.random() < 0.5) {
          p = 'lim x→0  {sin ' + c1 + 'x}⁄x';
          r = String(c1);
        } else {
          p = 'lim x→0  {sin ' + c1 + 'x}⁄{sin ' + c2 + 'x}';
          r = fracLabel(c1, c2);
        }
        pool = ['0', '1', String(c1), String(c2), fracLabel(c1, c2), fracLabel(c2, c1), '∞'];
      } else if (t === 2) {                       // removable factor
        var k = 2 + Math.floor(Math.random() * 5);
        p = 'lim x→' + k + '  {x² − ' + (k * k) + '}⁄{x − ' + k + '}';
        r = String(2 * k);
        pool = [String(k), String(k * k), '0', String(2 * k), 'does not exist'];
      } else {                                    // the classics
        var pickQ = [
          ['lim x→0  {1 − cos x}⁄x', '0', ['1', '1⁄2', '∞']],
          ['lim x→0⁺  ln x', '−∞', ['0', '∞', '1']],
          ['lim x→∞  (1 + 1⁄x)ˣ', 'e', ['1', '∞', '0']],
          ['lim x→0  {eˣ − 1}⁄x', '1', ['0', 'e', '∞']],
          ['lim x→∞  {ln x}⁄x', '0', ['1', '∞', 'e']]
        ][Math.floor(Math.random() * 5)];
        p = pickQ[0]; r = pickQ[1]; pool = pickQ[2].concat([r]);
      }
      if (seen[p]) continue;
      seen[p] = 1;
      qs.push({ p: p, c: shuffle([r].concat(pick3(pool, r))), r: r });
    }
    return qs;
  }

  /* significant figures: the number is generated, the count is computed */
  function countSig(s) {
    s = s.replace(/\s*×\s*10.*$/, '');
    if (s.indexOf('.') > -1) return s.replace(/\./g, '').replace(/^0+/, '').length;
    return s.replace(/0+$/, '').replace(/^0+/, '').length;
  }
  function sigfigRound(n) {
    var qs = [], seen = {}, guard = 0;
    while (qs.length < n && guard++ < 200) {
      var style = Math.floor(Math.random() * 5), num = '';
      var d = function () { return 1 + Math.floor(Math.random() * 9); };
      if (style === 0) num = '0.00' + d() + [0, d(), '0', d() + '0'][Math.floor(Math.random() * 4)];
      else if (style === 1) num = '' + d() + '0'.repeat(1 + Math.floor(Math.random() * 3));
      else if (style === 2) num = '' + d() + d() + '0.' + [0, '0', d()][Math.floor(Math.random() * 3)];
      else if (style === 3) num = d() + '.0' + d();
      else num = d() + '.' + d() + '0 × 10' + sup(2 + Math.floor(Math.random() * 4));
      num = String(num);
      if (seen[num]) continue;
      seen[num] = 1;
      var r = String(countSig(num));
      var opts = [r];
      [-2, -1, 1, 2, 3].forEach(function (o) {
        var v = countSig(num) + o;
        if (v >= 1 && opts.length < 4 && opts.indexOf(String(v)) < 0) opts.push(String(v));
      });
      opts.sort(function (a, b) { return a - b; });
      qs.push({ p: num, c: opts, r: r });
    }
    return qs;
  }

  /* period quiz: real events, only where exactly one period can claim the year */
  function plabel(pd) { return pd[0] + ' · ' + pd[1] + '–' + (pd[2] > 2020 ? 'now' : pd[2]); }
  function periodRound(n) {
    var qs = [];
    shuffle(TIMELINE.slice()).forEach(function (e) {
      if (qs.length >= n) return;
      var fits = PERIODS.filter(function (pd) { return e.y >= pd[1] && e.y <= pd[2]; });
      if (fits.length !== 1) return;
      var r = plabel(fits[0]);
      var others = sample(PERIODS.filter(function (pd) { return pd !== fits[0]; }), 3).map(plabel);
      qs.push({ p: e.t, c: shuffle([r].concat(others)), r: r });
    });
    return qs;
  }

  /* French numbers, spelled by rule — the whole 0–999 line is generated */
  var FR_ONES = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit',
    'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize'];
  function frBelow100(n) {
    if (n < 17) return FR_ONES[n];
    if (n < 20) return 'dix-' + FR_ONES[n - 10];
    if (n < 70) {
      var t = Math.floor(n / 10), u = n % 10;
      var tens = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'][t];
      if (!u) return tens;
      if (u === 1) return tens + ' et un';
      return tens + '-' + FR_ONES[u];
    }
    if (n === 71) return 'soixante et onze';
    if (n < 80) return 'soixante-' + frBelow100(n - 60);
    if (n === 80) return 'quatre-vingts';
    return 'quatre-vingt-' + frBelow100(n - 80);
  }
  function frNum(n) {
    if (n < 100) return frBelow100(n);
    var h = Math.floor(n / 100), r = n % 100;
    var hpart = h === 1 ? 'cent' : FR_ONES[h] + ' cent' + (r ? '' : 's');
    return r ? hpart + ' ' + frBelow100(r) : hpart;
  }
  function numbersRound(n) {
    var qs = [], seen = {}, guard = 0;
    while (qs.length < n && guard++ < 200) {
      // half the rounds live where French numbers bite: 60–99
      var v = Math.random() < 0.5 ? 60 + Math.floor(Math.random() * 40)
                                  : Math.floor(Math.random() * 1000);
      if (seen[v]) continue;
      seen[v] = 1;
      var r = frNum(v);
      var opts = [r], used = {}; used[r] = 1;
      var tries = 0;
      while (opts.length < 4 && tries++ < 60) {
        var d = [v + 1, v - 1, v + 10, v - 10, v + 20, v - 20, v + 2, v - 2][Math.floor(Math.random() * 8)];
        if (d < 0 || d > 999) continue;
        var w = frNum(d);
        if (used[w]) continue;
        used[w] = 1; opts.push(w);
      }
      if (opts.length < 4) continue;
      qs.push({ p: String(v), c: shuffle(opts), r: r });
    }
    return qs;
  }

  /* year quiz: real events, distractor years pulled close enough to test */
  function yearRound(n) {
    var qs = [];
    shuffle(TIMELINE.slice()).forEach(function (e) {
      if (qs.length >= n) return;
      var opts = [String(e.y)], used = {}; used[e.y] = 1;
      var tries = 0;
      while (opts.length < 4 && tries++ < 60) {
        var off = [2, -2, 3, -3, 5, -5, 8, -8, 10, -10][Math.floor(Math.random() * 10)];
        var y = e.y + off;
        if (used[y] || y > 2026) continue;
        used[y] = 1; opts.push(String(y));
      }
      if (opts.length < 4) return;
      opts.sort();
      qs.push({ p: e.t, c: opts, r: String(e.y) });
    });
    return qs;
  }

  /* electron configurations built by aufbau — Cr and Cu sit out (exceptions) */
  var ORBS = [['1s', 2], ['2s', 2], ['2p', 6], ['3s', 2], ['3p', 6], ['4s', 2], ['3d', 10], ['4p', 6]];
  function configOf(z) {
    var parts = [];
    for (var i = 0; i < ORBS.length && z > 0; i++) {
      var take = Math.min(z, ORBS[i][1]);
      parts.push(ORBS[i][0] + sup(take));
      z -= take;
    }
    return parts.join(' ');
  }
  function econfigRound(n) {
    var pool = ELEMENTS.filter(function (e) { return e[1] <= 36 && e[1] !== 24 && e[1] !== 29; });
    var qs = [];
    sample(pool, Math.min(n, pool.length)).forEach(function (e) {
      var z = e[1], r = configOf(z);
      var opts = [r], used = {}; used[r] = 1;
      var tries = 0;
      while (opts.length < 4 && tries++ < 40) {
        var dz = z + [-2, -1, 1, 2][Math.floor(Math.random() * 4)];
        if (dz < 1 || dz > 36) continue;
        var w = configOf(dz);
        if (used[w]) continue;
        used[w] = 1; opts.push(w);
      }
      if (opts.length < 4) return;
      var name = ELEM_NAMES[ELEMENTS.indexOf(e)];
      qs.push({ p: name + ' (' + e[0] + ')', c: shuffle(opts), r: r });
    });
    return qs;
  }

  /* the clock in conversational French — et quart, et demie, moins le quart */
  function frTime(h, m) {
    var base = m > 30 ? (h + 1) % 24 : h;
    var hr12 = base % 12;
    var hw = base === 0 ? 'minuit' : base === 12 ? 'midi'
           : (hr12 === 1 ? 'une heure' : frBelow100(hr12 === 0 ? 12 : hr12) + ' heures');
    var special = base === 0 || base === 12;   // midi/minuit take "demi", no e
    if (m === 0) return hw;
    if (m <= 30) {
      if (m === 15) return hw + ' et quart';
      if (m === 30) return hw + (special ? ' et demi' : ' et demie');
      return hw + ' ' + frBelow100(m);
    }
    if (m === 45) return hw + ' moins le quart';
    return hw + ' moins ' + frBelow100(60 - m);
  }
  function timeRound(n) {
    var qs = [], seen = {}, guard = 0;
    while (qs.length < n && guard++ < 200) {
      var h = Math.floor(Math.random() * 24);
      var m = 5 * Math.floor(Math.random() * 12);
      var key = h + ':' + m;
      if (seen[key]) continue;
      seen[key] = 1;
      var r = frTime(h, m);
      var opts = [r], used = {}; used[r] = 1;
      var tries = 0;
      while (opts.length < 4 && tries++ < 60) {
        var dh = (h + [0, 0, 1, 23][Math.floor(Math.random() * 4)]) % 24;
        var dm = (m + [5, 55, 15, 45, 30][Math.floor(Math.random() * 5)]) % 60;
        var w = frTime(dh, dm);
        if (used[w]) continue;
        used[w] = 1; opts.push(w);
      }
      if (opts.length < 4) continue;
      var disp = (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
      qs.push({ p: disp, c: shuffle(opts), r: r });
    }
    return qs;
  }

  /* le or la, straight from the vocabulary’s own articles */
  function genderRound(n) {
    var qs = [];
    shuffle(FRVOCAB.slice()).forEach(function (v) {
      if (qs.length >= n) return;
      var m = /^(le|la) ([a-zàâçéèêëîïôöûùüÿœæ’' -]+)$/i.exec(v[0]);
      if (!m) return;
      qs.push({ p: m[2], c: ['le', 'la'], r: m[1].toLowerCase() });
    });
    return qs;
  }

  /* Quizzes never end: questions arrive in generated batches for as long as
     you keep answering. The hub remembers your best streak. */
  function quizBatch(id) {
    return id === 'limitsquiz' ? limitsRound(10) :
      id === 'sigfigs' ? sigfigRound(10) :
      id === 'periodquiz' ? periodRound(10) :
      id === 'yearquiz' ? yearRound(10) :
      id === 'frnumbers' ? numbersRound(10) :
      id === 'frtime' ? timeRound(10) :
      id === 'econfig' ? econfigRound(10) :
      genderRound(12);
  }
  function refillQuiz() {
    var batch = quizBatch(st.id);
    var fresh = batch.filter(function (q) { return !st.recent[q.p]; });
    if (!fresh.length) fresh = batch;        // small pools may recycle, never back to back
    fresh.forEach(function (q) {
      st.qs.push(q);
      st.recent[q.p] = 1; st.recentQ.push(q.p);
    });
    while (st.recentQ.length > 40) delete st.recent[st.recentQ.shift()];
  }
  function startQuiz(id) {
    st = { id: id, kind: 'quiz', qs: [], i: 0, score: 0, streak: 0, bestRun: 0,
           recent: {}, recentQ: [], lock: false, wrongChoice: -1 };
    refillQuiz();
    renderQuiz();
  }

  function renderQuiz() {
    if (st.qs.length - st.i < 3) refillQuiz();
    var q = st.qs[st.i];
    ctx.mount(
      ctx.backbar(GAMES[st.id].name) +
      gameTop(st.score + ' right' + (st.streak > 2 ? ' · ' + st.streak + ' straight' : ''), String(st.i + 1)) +
      '<div class="gcur' + (st.lock ? '' : ' swap') + '">' +
        '<div class="gname num' + (flat(q.p).length > 44 ? ' gsm' : '') + '" data-plain="' + esc(flat(q.p)) + '">' + fx(q.p) + '</div></div>' +
      '<div class="choices' + (st.lock ? '' : ' deal') + '">' + q.c.map(function (cl, i) {
        var state = '';
        if (st.lock) state = cl === q.r ? 'right' : (i === st.wrongChoice ? 'wrong' : 'mute');
        return '<button class="choice num" data-gc="' + i + '"' +
          (state ? ' data-state="' + state + '"' : '') + (st.lock ? ' disabled' : '') + '>' +
          fx(cl) + '</button>';
      }).join('') + '</div>',
      { session: true, keepScroll: st.i > 0 }
    );
  }

  function nextQuizQ() {
    if (!st || st.kind !== 'quiz') return;
    if (location.hash.indexOf('#/game/' + st.id) !== 0) { st = null; return; }
    st.i++; st.lock = false; st.wrongChoice = -1;
    renderQuiz();
  }

  function tapQuizGame(i) {
    if (!st || st.kind !== 'quiz' || st.lock) return;
    var q = st.qs[st.i];
    st.lock = true;
    var right = q.c[i] === q.r;
    if (right) {
      st.score++; st.streak++;
      if (st.streak > st.bestRun) {
        st.bestRun = st.streak;
        saveBest(st.id, st.streak, st.streak + ' straight');
      }
    } else { st.wrongChoice = i; st.streak = 0; }
    renderQuiz();
    timer = setTimeout(nextQuizQ, right ? 550 : 1400);
  }

  /* ==========================================================================
     GRAPH — which trig function is this?
     ========================================================================== */
  function graphLabel(g) {
    return (g.s < 0 ? '−' : '') + (g.A > 1 ? g.A + ' ' : '') + GFNS[g.f][0] + ' ' + (g.B > 1 ? g.B + 'x' : 'x');
  }
  function genGraph() {
    var f = Math.floor(Math.random() * 6);
    var g = { f: f, A: 1, B: 1, s: Math.random() < 0.3 ? -1 : 1 };
    if (f < 2) { g.A = [1, 1, 2, 3][Math.floor(Math.random() * 4)]; g.B = [1, 1, 2, 3][Math.floor(Math.random() * 4)]; }
    else if (f === 2) { g.B = [1, 1, 2][Math.floor(Math.random() * 3)]; }
    return g;
  }
  function graphChoicesFor(g) {
    var right = graphLabel(g), seen = {}, out = [right], guard = 0;
    seen[right] = 1;
    while (out.length < 4 && guard++ < 80) {
      var m = { f: g.f, A: g.A, B: g.B, s: g.s };
      var r = Math.floor(Math.random() * 4);
      if (r === 0) m.s = -m.s;
      else if (r === 1) m.A = m.A === 1 ? 2 : m.A === 2 ? 3 : 1;
      else if (r === 2) m.B = m.B === 1 ? 2 : 1;
      else m.f = (m.f + 1 + Math.floor(Math.random() * 5)) % 6;
      if (m.f >= 2) m.A = 1;          // only sin/cos show an amplitude
      if (m.f >= 3) m.B = 1;
      var lb = graphLabel(m);
      if (!seen[lb]) { seen[lb] = 1; out.push(lb); }
    }
    return shuffle(out);
  }

  function startGraph(id) {
    var qs = [], seen = {}, guard = 0;
    while (qs.length < 10 && guard++ < 120) {
      var g = genGraph();
      var lb = graphLabel(g);
      if (seen[lb]) continue;
      seen[lb] = 1;
      qs.push(g);
    }
    st = { id: id, kind: 'graph', qs: qs, i: 0, score: 0, total: qs.length,
           lock: false, wrongChoice: -1 };
    renderGraph();
  }

  function graphSVG(g) {
    var f = function (x) { return g.s * g.A * GFNS[g.f][1](g.B * x); };
    var s = '<svg viewBox="0 0 320 190" class="tg" aria-label="Graph of a trig function">';
    s += '<line class="tg-axis" x1="10" y1="95" x2="310" y2="95"/>';
    s += '<line class="tg-axis" x1="160" y1="10" x2="160" y2="180"/>';
    [-2, -1, 1, 2].forEach(function (k) {   // ticks at multiples of pi
      var px = 160 + k * 75;
      s += '<line class="tg-axis" x1="' + px + '" y1="91" x2="' + px + '" y2="99"/>';
    });
    var segs = [], cur = [];
    for (var px = 0; px <= 300; px++) {
      var x = (px / 300) * 4 * Math.PI - 2 * Math.PI;
      var y = f(x);
      if (!isFinite(y) || Math.abs(y) > 3.4) { if (cur.length > 1) segs.push(cur); cur = []; continue; }
      var X = 10 + px, Y = 95 - y * 28;
      if (cur.length && Math.abs(Y - cur[cur.length - 1][1]) > 80) {   // asymptote jump
        if (cur.length > 1) segs.push(cur); cur = [];
      }
      cur.push([X, Y]);
    }
    if (cur.length > 1) segs.push(cur);
    segs.forEach(function (seg) {
      s += '<polyline class="tg-curve" points="' +
        seg.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') + '"/>';
    });
    return s + '</svg>';
  }

  function renderGraph() {
    if (st.i >= st.total) {
      return gameDone(st.id, st.score, st.total, st.score + ' of ' + st.total);
    }
    var g = st.qs[st.i];
    if (!g.choices) {
      g.right = graphLabel(g);
      g.choices = graphChoicesFor(g);
    }
    var ch = '<div class="choices">' + g.choices.map(function (cl, i) {
      var state = '';
      if (st.lock) state = cl === g.right ? 'right' : (i === st.wrongChoice ? 'wrong' : 'mute');
      return '<button class="choice" data-gc="' + i + '"' +
        (state ? ' data-state="' + state + '"' : '') + (st.lock ? ' disabled' : '') +
        '>' + esc(cl) + '</button>';
    }).join('') + '</div>';
    ctx.mount(
      ctx.backbar(GAMES[st.id].name) +
      gameTop(st.score + ' right', (st.i + 1) + ' of ' + st.total) +
      '<div class="gcur"><div class="gname num">y = ?</div></div>' +
      '<div class="tgwrap">' + graphSVG(g) + '</div>' + ch,
      { session: true, keepScroll: st.i > 0 }
    );
  }

  function nextGraph() {
    if (!st || st.kind !== 'graph') return;
    if (location.hash.indexOf('#/game/' + st.id) !== 0) { st = null; return; }
    st.i++; st.lock = false; st.wrongChoice = -1;
    renderGraph();
  }

  function tapGraphChoice(i) {
    if (!st || st.kind !== 'graph' || st.lock) return;
    var g = st.qs[st.i];
    st.lock = true;
    var right = g.choices[i] === g.right;
    if (right) { st.score++; } else { st.wrongChoice = i; }
    renderGraph();
    timer = setTimeout(nextGraph, right ? 550 : 1400);
  }

  /* ---------------- delegation ------------------------------------------- */
  function onClick(e) {
    var t = e.target;
    var el;
    if ((el = t.closest('[data-gagain]'))) { play(el.getAttribute('data-gagain')); return; }
    if (!st) return;
    if ((el = t.closest('[data-gap]'))) { placeAt(parseInt(el.getAttribute('data-gap'), 10)); return; }
    if ((el = t.closest('[data-ml]'))) { pickMatch('l', parseInt(el.getAttribute('data-ml'), 10)); return; }
    if ((el = t.closest('[data-mr]'))) { pickMatch('r', parseInt(el.getAttribute('data-mr'), 10)); return; }
    if ((el = t.closest('[data-tile]'))) { tapTile(parseInt(el.getAttribute('data-tile'), 10)); return; }
    if ((el = t.closest('[data-dot]'))) { tapDot(parseInt(el.getAttribute('data-dot'), 10)); return; }
    if ((el = t.closest('[data-gc]'))) {
      var ci = parseInt(el.getAttribute('data-gc'), 10);
      if (st.kind === 'graph') tapGraphChoice(ci);
      else if (st.kind === 'quiz') tapQuizGame(ci);
      else tapChoice(ci);
      return;
    }
  }

  /* ---------------- public ------------------------------------------------ */
  window.Games = {
    init: function (c) {
      ctx = c; S = window.Store; T = window.Tex;
      document.addEventListener('click', onClick);
    },
    hub: hub,
    play: play,
    onRoute: function (root) {
      // leaving the games clears live state and any pending advance timer
      if (root !== 'game') { clearTimeout(timer); st = null; }
    },
    linksFor: function (deckId) {
      var out = [];
      Object.keys(GAMES).forEach(function (id) {
        if (GAMES[id].deck === deckId) out.push([GAMES[id].name, id]);
      });
      return out;
    }
  };
})();
