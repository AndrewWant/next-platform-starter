/**
 * Session constants and URL parameter handling.
 * PATTERN_LENGTH and BALL_TO_SLIDE_FOOT are set at runtime via initSession().
 */

export const CONSTANTS = {
  PATTERN_LENGTH:       null,
  RULE_DISCOUNT:        31,
  BREAKPOINT_BASE:      null,   // patternLength - 31
  BREAKPOINT_INFLUENCE: 2,
  BALL_TO_SLIDE_FOOT:   null,
  POCKET_BOARD:         17,
  BOARD_MIN:            1,
  BOARD_MAX:            39,
  HANDEDNESS:           'right',
  BREAKPOINT_LEEWAY:    3,      // tolerance for user-reported breakpoint (±boards)
  ANCHOR_SLOPE:         0.9,
  ANCHOR_INTERCEPT:     49,
  ANCHOR_FINISH:        null,   // default predictedBoardsCrossed before any shots
};

/**
 * Initialise session constants from provided values, then derive dependents.
 * ANCHOR_FINISH formula calibrated to:
 *   34ft → ~17 boards, 42ft → ~11 boards, 46ft → ~7 boards
 */
export function initSession(patternLength, ballToSlideFoot, handedness) {
  CONSTANTS.PATTERN_LENGTH     = patternLength;
  CONSTANTS.BALL_TO_SLIDE_FOOT = ballToSlideFoot;
  CONSTANTS.HANDEDNESS         = handedness || 'right';
  CONSTANTS.BREAKPOINT_BASE    = patternLength - CONSTANTS.RULE_DISCOUNT;
  const raw = Math.round(CONSTANTS.ANCHOR_INTERCEPT - (CONSTANTS.ANCHOR_SLOPE * patternLength));
  CONSTANTS.ANCHOR_FINISH = Math.max(1, Math.min(25, raw));
}

export function encodeSessionURL(patternLength, ballToSlideFoot, handedness) {
  const url = new URL(window.location.href);
  url.searchParams.set('pl',   patternLength);
  url.searchParams.set('bsf',  ballToSlideFoot);
  url.searchParams.set('hand', handedness || 'right');
  return url.toString();
}

/**
 * Returns null if params are missing or invalid.
 * Handles both R/L and left/right hand formats; always returns 'R' or 'L'.
 */
export function decodeSessionURL() {
  const params = new URLSearchParams(window.location.search);
  const pl   = parseInt(params.get('pl'),  10);
  const bsf  = parseInt(params.get('bsf'), 10);
  if (isNaN(pl) || isNaN(bsf)) return null;
  const rawHand  = params.get('hand') ?? '';
  const handedness = (rawHand === 'L' || rawHand === 'left') ? 'L' : 'R';
  const origin = params.get('origin') ?? null;
  return { patternLength: pl, ballToSlideFoot: bsf, handedness, origin };
}
