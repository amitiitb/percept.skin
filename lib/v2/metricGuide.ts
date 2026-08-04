// Reference knowledge for each of the 22 metrics the analysis produces
// (names are a fixed set, see SKIN/FACE/HAIR_METRIC_NAMES in aiProvider.ts).
//
// This is deliberately NOT AI-generated: the per-user explanation on each
// metric already comes from the model, and it changes every scan. What was
// missing is the stable, factual layer underneath it, what the measurement
// actually means, what genuinely drives it, and what is known to help. That
// is what makes the report worth reading twice instead of once.
//
// Framing rule (same as the rest of the product): cosmetic and wellness
// observations only. Nothing here diagnoses, and anything that belongs to a
// clinician says so.

export interface MetricGuide {
  /** What the measurement is actually looking at. */
  what: string;
  /** Why it is worth tracking. */
  matters: string;
  /** Real drivers, the things that move this number. */
  drivers: string[];
  /** What is generally known to help. Non-prescriptive, non-medical. */
  helps: string[];
}

export const METRIC_GUIDE: Record<string, MetricGuide> = {
  // ── Skin ──────────────────────────────────────────────────────────
  "Skin texture": {
    what: "How even the skin surface looks, roughness, bumpiness, and how uniformly light reflects off it.",
    matters: "Texture is the single biggest driver of whether skin reads as healthy in person and on camera, more than tone.",
    drivers: ["Natural cell turnover, which slows with age", "Dead-cell buildup on the surface", "Dehydration, which exaggerates every irregularity", "Congestion around pores"],
    helps: ["Consistent gentle cleansing, twice daily", "Chemical exfoliation (AHA or BHA) once or twice weekly rather than daily scrubbing", "A moisturiser with humectants such as glycerin or hyaluronic acid", "Time, texture changes are slow and show over weeks, not days"],
  },
  "Fine lines": {
    what: "Shallow surface lines, most visible around the eyes, forehead, and mouth where skin folds repeatedly.",
    matters: "Fine lines are largely a hydration and sun-exposure story early on, which is the part you can still influence.",
    drivers: ["Cumulative UV exposure, the largest single factor", "Surface dehydration, which makes existing lines far more visible", "Repeated facial expression along the same folds", "Collagen decline, which begins in the mid-twenties"],
    helps: ["Daily broad-spectrum SPF, the most evidence-backed step by a wide margin", "Retinoids, the best-studied topical for line appearance", "Keeping the skin barrier well hydrated", "Sleeping on your back if lines are asymmetric"],
  },
  "Pore visibility": {
    what: "How prominent pores appear, concentrated across the nose, inner cheeks, and forehead.",
    matters: "Pore size itself is genetic and fixed. What changes is how visible they are, and that is very much movable.",
    drivers: ["Genetics, which set the baseline size", "Sebum output, oilier skin reads as larger-pored", "Debris and dead cells stretching the opening", "Loss of surrounding firmness with age"],
    helps: ["Salicylic acid (BHA), which works inside the pore lining", "Niacinamide, which has good evidence for appearance over time", "Non-comedogenic products", "Never squeezing, it stretches the opening permanently"],
  },
  "Dark spots & pigmentation": {
    what: "Localised patches darker than your base tone, including sun spots and marks left behind after blemishes.",
    matters: "Pigmentation is one of the strongest visual age signals, often reading older than lines do.",
    drivers: ["UV exposure, which both causes and re-darkens spots", "Post-inflammatory marks after acne or irritation", "Hormonal influence, as in melasma", "Skin picking, which prolongs marks considerably"],
    helps: ["Daily SPF, without it nothing else holds", "Vitamin C in the morning", "Niacinamide, azelaic acid, or tranexamic acid", "Patience, pigment corrects over months, not weeks", "Persistent or spreading patches are worth a dermatologist's opinion"],
  },
  "Uneven skin tone": {
    what: "Overall colour consistency across the face, separate from discrete spots.",
    matters: "Even tone is a large part of why skin looks rested, and it responds well to routine.",
    drivers: ["Sun exposure across the higher planes of the face", "Lingering redness or inflammation", "Uneven surface texture scattering light", "Reduced circulation, often from poor sleep"],
    helps: ["Consistent SPF", "Vitamin C or niacinamide", "Gentle exfoliation to clear uneven buildup", "Sleep, the effect on tone is genuinely visible"],
  },
  "Redness appearance": {
    what: "Visible flushing or persistent colour, typically across the cheeks, nose, and chin.",
    matters: "Redness usually signals a barrier under strain, which is worth reading as a signal rather than a flaw.",
    drivers: ["A compromised skin barrier, very often from over-exfoliating", "Temperature swings, alcohol, or spicy food", "Harsh actives layered too aggressively", "Underlying sensitivity or rosacea"],
    helps: ["Pausing actives for one to two weeks and letting the barrier recover", "Barrier-supporting ingredients: ceramides, panthenol, centella", "Lukewarm water rather than hot", "Fragrance-free formulations", "Persistent redness with visible vessels is worth a clinical opinion"],
  },
  "Dryness indicators": {
    what: "Signs of moisture loss: flaking, tightness, and dull light reflection.",
    matters: "Dry and dehydrated are different problems. Dry skin lacks oil, dehydrated skin lacks water, and oily skin can be dehydrated too.",
    drivers: ["A damaged moisture barrier", "Low humidity, indoor heating, air conditioning", "Over-cleansing or water that is too hot", "Age-related decline in natural oil production"],
    helps: ["Humectants (glycerin, hyaluronic acid) applied to damp skin", "An occlusive layer at night to hold water in", "Cutting cleanser strength or frequency", "A humidifier in dry indoor air"],
  },
  "Under-eye appearance": {
    what: "Darkness, puffiness, and hollowing in the thinnest skin on the face.",
    matters: "Under-eyes drive how tired or rested you read to other people, often more than anything else on this list.",
    drivers: ["Genetics and natural bone structure, which set most of it", "Visible vasculature under very thin skin", "Fluid retention, especially on waking", "Sleep quality, allergies, and dehydration"],
    helps: ["Consistent sleep, the highest-leverage change here", "Cold compress for morning puffiness", "SPF, pigment-driven darkness worsens with sun", "Caffeine-containing eye products for temporary tightening", "Realistic expectations, structural hollowing does not resolve topically"],
  },
  "Facial hydration estimate": {
    what: "How well hydrated the skin surface appears, read from light reflection, plumpness, and fine-line prominence.",
    matters: "Hydration is the fastest-moving metric here. It can visibly improve within days, unlike texture or pigment.",
    drivers: ["Water content held in the outer skin layer", "Barrier integrity, a leaky barrier cannot hold water", "Ambient humidity", "Cleanser strength"],
    helps: ["Applying humectants to slightly damp skin", "Sealing with a moisturiser afterwards", "Avoiding stripping foaming cleansers", "Drinking enough water, helpful but far less decisive than topical steps"],
  },
  "Sun-damage appearance": {
    what: "Cumulative visible UV effect: uneven pigment, texture change, and loss of elasticity.",
    matters: "UV accounts for the large majority of visible skin ageing. This is the metric where prevention beats correction most decisively.",
    drivers: ["Lifetime cumulative exposure, not just recent sunburn", "Daily incidental exposure, walking, driving, sitting near windows", "Inconsistent or insufficient SPF use", "Tanning history"],
    helps: ["Broad-spectrum SPF 30 or higher, every day, including indoors near windows", "Reapplying every two hours in direct sun", "Antioxidants such as vitamin C as a supporting layer", "Any new, changing, or asymmetric mark should be seen by a doctor promptly"],
  },

  // ── Face ──────────────────────────────────────────────────────────
  "Facial symmetry": {
    what: "How closely the left and right sides of your face mirror each other.",
    matters: "Genuinely useful context: every human face is asymmetric. Perfect symmetry is neither achievable nor attractive, and mild asymmetry is universal.",
    drivers: ["Natural bone structure, largely fixed", "Habitual expression and chewing side", "Sleeping position over many years", "Posture, particularly forward head position"],
    helps: ["Perspective, this is a descriptive measure, not a flaw to correct", "Camera angle and lighting affect the reading more than most people expect", "Sudden new asymmetry is different, and should be seen by a doctor promptly"],
  },
  "Jawline definition": {
    what: "How clearly the jaw edge separates from the neck.",
    matters: "One of the most requested aesthetic traits, and one of the most influenced by things that are not skincare at all.",
    drivers: ["Body composition, subcutaneous fat over the jaw", "Bone structure, the fixed baseline", "Posture, forward head position visibly softens the jawline", "Fluid retention, often sodium-driven", "Skin laxity with age"],
    helps: ["Overall body composition, more decisive than any targeted routine", "Posture work, often an immediate visible difference", "Reducing sodium and alcohol for fluid retention", "Skepticism toward jaw exercise devices, evidence is weak"],
  },
  "Cheekbone definition": {
    what: "How prominent the cheekbones (zygomatic bones) read against the surrounding midface.",
    matters: "A structural read, not a flaw list. Cheekbone prominence is one of the more fixed traits on a face, set almost entirely by bone structure rather than anything in a daily routine.",
    drivers: ["Zygomatic bone structure, essentially fixed from adulthood", "Body fat percentage, which affects how much surrounding tissue covers the bone", "Lighting and camera angle, both of which change this reading substantially photo to photo"],
    helps: ["Body composition, the only real lever if surrounding fullness is the factor", "Makeup contouring or hairstyle framing for a temporary visual effect", "Perspective, this is descriptive, not something that needs fixing"],
  },
  "Chin projection": {
    what: "How far the chin extends forward relative to the rest of the facial profile.",
    matters: "Mostly a side-profile read. It interacts with jawline definition, but is its own distinct structural trait.",
    drivers: ["Mandible (jawbone) structure and growth pattern, the dominant factor", "Bite alignment", "Soft tissue and fat distribution over the chin"],
    helps: ["Posture, a forward head position visually reduces chin projection regardless of bone structure", "Perspective, camera angle changes this reading more than almost any other metric", "An orthodontist or maxillofacial specialist is the right resource for anyone with a genuine bite-related concern, this is descriptive only"],
  },
  "Cheek balance": {
    what: "Volume and position of the cheeks, and how evenly they sit relative to each other.",
    matters: "Midface volume drives how rested and healthy a face reads, and it changes with age in predictable ways.",
    drivers: ["Fat pad position, which descends gradually with age", "Bone structure", "Overall body composition", "Hydration and fluid balance day to day"],
    helps: ["Stable body weight, sharp fluctuations show in the midface first", "Sleep position, one-sided sleeping shows over years", "Sun protection, laxity accelerates volume descent", "Perspective, some asymmetry is normal"],
  },
  "Forehead proportion": {
    what: "Forehead height and width relative to the rest of the face.",
    matters: "Purely a proportional observation. It is structural, essentially fixed, and included for completeness rather than as something to act on.",
    drivers: ["Skull structure and hairline position, both genetic", "Hairline changes over time", "Hairstyle, which changes apparent proportion substantially"],
    helps: ["Hairstyle and fringe choices, the only real lever", "Context, classical proportion rules are conventions, not standards"],
  },
  "Overall facial harmony": {
    what: "A composite read of how the individual features relate to each other proportionally.",
    matters: "A summary measure. Useful as a single number, but the individual metrics above carry more actionable information.",
    drivers: ["The combined effect of every structural measure above", "Skin quality, which affects perceived harmony independently of structure", "Grooming, framing, and expression"],
    helps: ["Focusing on the modifiable metrics, skin quality and grooming, rather than structure", "Remembering that composite scores compress a lot of nuance into one number"],
  },

  // ── Hair & Scalp ──────────────────────────────────────────────────
  "Hair density estimate": {
    what: "How densely hair covers the scalp across the visible areas of your photos.",
    matters: "Density change over time matters far more than any single reading. This is a metric worth tracking across scans.",
    drivers: ["Genetics, the dominant factor", "Hormonal factors, including DHT sensitivity", "Nutrition, particularly iron, protein, and vitamin D", "Stress, which can trigger diffuse shedding months after the event", "Age"],
    helps: ["Early action, hair responds far better to early intervention than late", "Addressing nutritional gaps, iron and vitamin D are common and testable", "Gentle handling, avoiding tight styles and high heat", "A dermatologist for genuine density loss, this is one of the clearest cases where professional input beats topical guesswork"],
  },
  "Hairline pattern": {
    what: "The shape and position of your frontal hairline, including recession at the temples.",
    matters: "Hairline change is usually the earliest visible sign of pattern hair loss, and the earliest point at which action works best.",
    drivers: ["Genetic pattern, both parental lines", "Androgen sensitivity at the follicle", "Traction from tight hairstyles over time", "Age"],
    helps: ["Photographing consistently over time, change is easier to see in comparison than in the mirror", "Avoiding sustained tension on the hairline", "Prompt professional advice, treatments for pattern loss work best early and cannot regrow long-dormant follicles"],
  },
  "Scalp visibility": {
    what: "How much scalp shows through the hair, particularly at the crown and part.",
    matters: "Often the first thing people notice themselves, and a useful proxy for density change between scans.",
    drivers: ["Hair density and individual strand thickness", "Hair colour contrast against scalp tone", "Styling, product, and how recently hair was washed", "Lighting, which affects this reading significantly"],
    helps: ["Consistent photo conditions when comparing scans, lighting alone can swing this", "Volumising styling, which changes appearance without changing density", "Scalp-tone products for temporary cosmetic coverage", "A professional opinion if visibility is genuinely increasing"],
  },
  "Hair part width": {
    what: "How wide the natural part line appears, a standard way of tracking density change over time.",
    matters: "Widening at the part is one of the most reliable early signals of diffuse thinning, particularly in women.",
    drivers: ["Density immediately around the part line", "Always parting in the same place, which causes local traction", "Hormonal shifts, including postpartum and menopause", "Nutritional status"],
    helps: ["Changing your part periodically, a genuinely useful habit", "Consistent photography for comparison", "Investigating nutrition if widening is recent", "A dermatologist for progressive widening, it is treatable and responds best early"],
  },
  "Overall hair health": {
    what: "A composite read of shine, breakage, and strand condition.",
    matters: "Unlike density, strand condition is highly modifiable. This metric usually moves fastest of the hair group.",
    drivers: ["Heat styling, the most common single cause of damage", "Chemical processing, colour, bleach, relaxers", "Mechanical stress, aggressive brushing, tight styles", "Sun and chlorine exposure"],
    helps: ["Reducing heat, or using heat protection consistently", "Spacing out chemical processing", "Conditioning through the lengths, not the scalp", "Trimming damaged ends, split ends travel upward and cannot be repaired"],
  },
};

export function guideFor(metricName: string): MetricGuide | null {
  return METRIC_GUIDE[metricName] ?? null;
}
