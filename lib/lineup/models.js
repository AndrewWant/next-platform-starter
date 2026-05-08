/**
 * Line and LaneRead — pure calculation logic, no DOM or React.
 *
 * Key design decisions:
 *  - Breakpoint weighting uses each shot's actual .breakpoint (not .target)
 *    and actual .finishPosition to determine influence on the lane breakpoint.
 *  - The anchor is removed. Zero-shot state is handled by _recalculate returning
 *    BREAKPOINT_BASE / ANCHOR_FINISH defaults.
 *  - One-shot prediction uses that shot's boardsCrossed directly.
 *  - Pocket-hit one-shot exploration is a parallel shift (same angle, inside).
 */

import { CONSTANTS } from './constants.js'

export class Line {
  /**
   * @param {number}      foot
   * @param {number}      ballStart
   * @param {number}      target
   * @param {number}      breakpoint
   * @param {number|null} finishPosition
   */
  constructor(foot, ballStart, target, breakpoint, finishPosition = null) {
    this.foot           = foot;
    this.ballStart      = ballStart;
    this.target         = target;
    this.breakpoint     = breakpoint;
    this.finishPosition = finishPosition;

    this.breakpointWeight         = null;
    this.adjustedBreakpointValue  = null;   // was adjustedBreakpointTarget
    this.boardsCrossed            = null;
    this.originalShotNumber       = null;
  }

  key() {
    return `${this.foot}-${this.ballStart}-${this.target}`;
  }
}

export class LaneRead {
  constructor() {
    this.shots                  = [];
    this.breakpoint             = null;
    this.predictedBoardsCrossed = null;
    this.moveTable              = [];
  }

  /** Must be called after initSession(). */
  init() {
    this._recalculate();
  }

  /** Derive ball start from foot position. */
  static ballStartFromFoot(foot) {
    return foot - CONSTANTS.BALL_TO_SLIDE_FOOT;
  }

  /**
   * Inverse of the 1.68× move table formula.
   * Given foot and target, returns the breakpoint that the move table geometry implies.
   * Used to pre-populate the breakpoint slider in the result phase.
   */
  static expectedBreakpoint(foot, target) {
    const ballStart = foot - CONSTANTS.BALL_TO_SLIDE_FOOT;
    const raw = (1.68 * target - ballStart) / 0.68;
    return Math.round(Math.max(CONSTANTS.BOARD_MIN, Math.min(CONSTANTS.BOARD_MAX, raw)));
  }

  /**
   * Given target and breakpoint, calculate foot and ball start using the
   * 1.68× ratio (empirical approximation of lane geometry across move sizes).
   */
  static footFromTargetAndBreakpoint(target, breakpoint) {
    const targetMove = target - breakpoint;
    const ballStart  = Math.round(targetMove * 1.68) + breakpoint;
    const foot       = ballStart + CONSTANTS.BALL_TO_SLIDE_FOOT;
    return { foot, ballStart };
  }

  /** Build all 39 move table rows for a given lane breakpoint. */
  static buildMoveTableForBreakpoint(breakpoint) {
    const rows = [];
    for (let target = CONSTANTS.BOARD_MIN; target <= CONSTANTS.BOARD_MAX; target++) {
      const { foot, ballStart } = LaneRead.footFromTargetAndBreakpoint(target, breakpoint);
      rows.push({ target, ballStart, foot, breakpoint });
    }
    return rows;
  }

  addShot(line) {
    this.shots.push(line);
    this._recalculate();
  }

  updateShot(index, line) {
    this.shots[index] = line;
    this._recalculate();
  }

  /**
   * Return the move table row whose boardsCrossed best matches predictedBoardsCrossed.
   */
  getPredictedRow() {
    if (!this.moveTable.length) return null;
    let bestIndex = 0;
    let bestDiff  = Infinity;
    this.moveTable.forEach((line, i) => {
      const diff = Math.abs(line.boardsCrossed - this.predictedBoardsCrossed);
      if (diff < bestDiff) { bestDiff = diff; bestIndex = i; }
    });
    return this.moveTable[bestIndex];
  }

  /**
   * For a pocket hit on the first shot: suggest a parallel shift inside
   * (same angle, different breakpoint) to gather lane shape information.
   * "Inside" = toward higher boards for right-handed, lower for left-handed.
   */
  getExplorationSuggestion(shot) {
    const direction = CONSTANTS.HANDEDNESS === 'right' ? 1 : -1;
    const move = 3;
    const clamp = v => Math.max(CONSTANTS.BOARD_MIN, Math.min(CONSTANTS.BOARD_MAX, v));
    return new Line(
      clamp(shot.foot      + direction * move),
      clamp(shot.ballStart + direction * move),
      clamp(shot.target    + direction * move),
      this.breakpoint,
      CONSTANTS.POCKET_BOARD,
    );
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  _recalculate() {
    if (this.shots.length === 0) {
      this.breakpoint             = CONSTANTS.BREAKPOINT_BASE;
      this.predictedBoardsCrossed = CONSTANTS.ANCHOR_FINISH;
      this._buildMoveTable();
      return;
    }
    this._calcBoardsCrossed(this.shots);
    this._calcBreakpointWeighting(this.shots);
    this._calcBreakpoint(this.shots);
    this._buildMoveTable();
    this._calcPredictedBoardsCrossed(this.shots);
  }

  /**
   * boardsCrossed = total swing amplitude:
   *   leg from ballStart to breakpoint + leg from breakpoint to finish.
   */
  _calcBoardsCrossed(lines) {
    lines.forEach(line => {
      if (line.finishPosition !== null) {
        line.boardsCrossed =
          (line.ballStart - line.breakpoint) +
          (line.finishPosition - line.breakpoint);
      }
    });
  }

  /**
   * Weight each shot by:
   *   - proximity of its actual breakpoint to the rule-of-31 base (closer = higher)
   *   - proximity of its finish position to the pocket (closer = higher)
   * Both use +1 floor to stay finite and give well-behaved maxima.
   */
  _calcBreakpointWeighting(shots) {
    shots.forEach(line => {
      const distFromBase   = Math.abs(CONSTANTS.BREAKPOINT_BASE - line.breakpoint);
      const distFromPocket = Math.abs(CONSTANTS.POCKET_BOARD    - line.finishPosition);
      line.breakpointWeight =
        CONSTANTS.BREAKPOINT_INFLUENCE / (distFromBase   + 1)
                                       / (distFromPocket + 1);
    });
  }

  /**
   * Lane breakpoint = weighted average of each shot's actual observed breakpoint.
   * Falls back to BREAKPOINT_BASE if total weight is zero (shouldn't happen with +1 floor).
   */
  _calcBreakpoint(shots) {
    const totalWeight = shots.reduce((sum, l) => sum + l.breakpointWeight, 0);
    if (totalWeight === 0) {
      this.breakpoint = CONSTANTS.BREAKPOINT_BASE;
      return;
    }
    const raw = shots.reduce(
      (sum, l) => sum + (l.breakpointWeight / totalWeight) * l.breakpoint, 0
    );
    this.breakpoint = Math.round(raw);
  }

  _buildMoveTable() {
    this.moveTable = LaneRead.buildMoveTableForBreakpoint(this.breakpoint).map(row => {
      const line = new Line(row.foot, row.ballStart, row.target, row.breakpoint, CONSTANTS.POCKET_BOARD);
      this._calcBoardsCrossed([line]);
      return line;
    });
  }

  /**
   * Predict boardsCrossed at the lane breakpoint from the observed shots.
   *
   *  1 shot  → use its boardsCrossed directly (only data point).
   *  2+ shots → linear interpolation between the two shots whose breakpoints
   *              are closest to the lane breakpoint.
   *              If those two shots have the same breakpoint, average their boardsCrossed.
   */
  _calcPredictedBoardsCrossed(shots) {
    if (shots.length === 1) {
      this.predictedBoardsCrossed = shots[0].boardsCrossed;
      return;
    }

    const sorted = [...shots].sort((a, b) =>
      Math.abs(this.breakpoint - a.breakpoint) - Math.abs(this.breakpoint - b.breakpoint)
    );
    const [a, b] = sorted;
    const deltaBreakpoint = Math.abs(a.breakpoint - b.breakpoint);

    if (deltaBreakpoint === 0) {
      this.predictedBoardsCrossed = Math.round((a.boardsCrossed + b.boardsCrossed) / 2);
      return;
    }

    const lo = a.breakpoint <= b.breakpoint ? a : b;
    const hi = a.breakpoint <= b.breakpoint ? b : a;
    const t  = (this.breakpoint - lo.breakpoint) / deltaBreakpoint;
    this.predictedBoardsCrossed = Math.round(
      lo.boardsCrossed + t * (hi.boardsCrossed - lo.boardsCrossed)
    );
  }
}
