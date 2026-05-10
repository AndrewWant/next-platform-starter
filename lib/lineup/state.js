/**
 * Session state for LineUp.
 * Single source of truth for the multi-ball session. No DOM or React.
 *
 * Shot model (v2): each shot stores both planned and actual values.
 *   planned: { foot, target, brk, finish }  — what the bowler intended
 *   actual:  { foot, target, brk, finish }  — what actually happened
 * LaneRead math uses actual values only. Planned values travel with the
 * Line object as line.planned for history display and accuracy analysis.
 */

import { CONSTANTS, initSession } from './constants.js'
import { Line, LaneRead } from './models.js'

function _uid() {
  return Math.random().toString(36).slice(2, 10);
}

// ─── State ───────────────────────────────────────────────────────────────────

export const State = {
  session:      null,
  editingIndex: null,
  suggestion:   null,

  get laneRead() {
    const ball = this.activeBall();
    return ball ? ball.laneRead : null;
  },

  get shotCount() {
    const ball = this.activeBall();
    return ball ? ball.shotCount : 0;
  },

  activeBall() {
    if (!this.session) return null;
    return this.session.balls.find(b => b.ballId === this.session.activeBallId) || null;
  },
};

// ─── Session ──────────────────────────────────────────────────────────────────

function _newBall(name, notes) {
  const lr = new LaneRead();
  lr.init();
  return {
    ballId:    _uid(),
    name:      name  || 'Default Ball Name',
    notes:     notes || '',
    laneRead:  lr,
    shotCount: 0,
  };
}

/** Must be called after initSession(). */
export function startSession(ballName, ballNotes) {
  const firstBall = _newBall(ballName, ballNotes);
  State.session = {
    sessionId:        _uid(),
    createdAt:        new Date().toISOString(),
    patternLength:    CONSTANTS.PATTERN_LENGTH,
    ballToSlideFoot:  CONSTANTS.BALL_TO_SLIDE_FOOT,
    handedness:       CONSTANTS.HANDEDNESS,
    breakpointLeeway: CONSTANTS.BREAKPOINT_LEEWAY,
    activeBallId:     firstBall.ballId,
    balls:            [firstBall],
  };
  State.editingIndex = null;
  _updateSuggestion();
}

// ─── Ball management ──────────────────────────────────────────────────────────

export function addBall(name, notes) {
  const ball = _newBall(name, notes);
  State.session.balls.push(ball);
  switchBall(ball.ballId);
}

export function switchBall(ballId) {
  State.session.activeBallId = ballId;
  State.editingIndex = null;
  _updateSuggestion();
}

export function getBalls() {
  if (!State.session) return [];
  return State.session.balls.map(b => ({
    ballId:    b.ballId,
    name:      b.name,
    notes:     b.notes,
    shotCount: b.shotCount,
    active:    b.ballId === State.session.activeBallId,
  }));
}

// ─── Shot recording ───────────────────────────────────────────────────────────

/**
 * Record a shot with both the intended plan and what actually happened.
 * @param {{ foot, target, brk, finish }} planned  — bowler's intention
 * @param {{ foot, slide, target, brk, finish }} actual — foot=start, slide=foul-line position
 */
export function recordShot(planned, actual) {
  const ball      = State.activeBall();
  const ballStart = LaneRead.ballStartFromFoot(actual.slide);  // slide foot drives ball release
  const line      = new Line(actual.slide, ballStart, actual.target, actual.brk, actual.finish);
  line.originalShotNumber = ball.shotCount + 1;
  line.planned   = { ...planned };
  line.footStart = actual.foot;  // start/setup foot stored as metadata
  ball.laneRead.addShot(line);
  ball.shotCount++;
  _updateSuggestion();
}

/**
 * Overwrite an existing shot (edit mode).
 * @param {number} index
 * @param {{ foot, target, brk, finish }} planned
 * @param {{ foot, slide, target, brk, finish }} actual
 */
export function updateShot(index, planned, actual) {
  const ball      = State.activeBall();
  const ballStart = LaneRead.ballStartFromFoot(actual.slide);
  const line      = new Line(actual.slide, ballStart, actual.target, actual.brk, actual.finish);
  line.planned   = { ...planned };
  line.footStart = actual.foot;
  ball.laneRead.updateShot(index, line);
  _updateSuggestion();
}

export function removeShot(index) {
  const ball = State.activeBall();
  ball.laneRead.shots.splice(index, 1);
  ball.laneRead._recalculate();
  _updateSuggestion();
}

export function setEditingIndex(index) {
  State.editingIndex = index;
}

// ─── Wipe operations ──────────────────────────────────────────────────────────

export function wipeBallShots() {
  const ball = State.activeBall();
  if (!ball) return;
  ball.laneRead.shots = [];
  ball.laneRead._recalculate();
  ball.shotCount     = 0;
  State.editingIndex = null;
  _updateSuggestion();
}

export function wipeAllShots() {
  State.session.balls.forEach(ball => {
    ball.laneRead.shots = [];
    ball.laneRead._recalculate();
    ball.shotCount = 0;
  });
  State.editingIndex = null;
  _updateSuggestion();
}

// ─── History ──────────────────────────────────────────────────────────────────

/**
 * Returns shots newest-first with both actual and planned values.
 * actual.boardsCrossed is the computed lane-read metric.
 */
export function getShotHistory() {
  const ball = State.activeBall();
  if (!ball) return [];
  return ball.laneRead.shots.map((line, i) => ({
    shotNumber: line.originalShotNumber || (i + 1),
    actual: {
      foot:          line.footStart ?? line.foot,  // start/setup foot for display
      slide:         line.foot,                    // slide foot (drives ball path)
      ballStart:     line.ballStart,
      target:        line.target,
      brk:           line.breakpoint,
      finish:        line.finishPosition,
      boardsCrossed: line.boardsCrossed,
    },
    planned: line.planned || null,
    index:   i,
  })).reverse();
}

// ─── Export / import ──────────────────────────────────────────────────────────

export function exportSessionJSON() {
  const s = State.session;
  return JSON.stringify({
    sessionId:        s.sessionId,
    createdAt:        s.createdAt,
    exportedAt:       new Date().toISOString(),
    patternLength:    s.patternLength,
    ballToSlideFoot:  s.ballToSlideFoot,
    handedness:       s.handedness,
    breakpointLeeway: s.breakpointLeeway,
    activeBallId:     s.activeBallId,
    balls: s.balls.map(b => ({
      ballId:    b.ballId,
      name:      b.name,
      notes:     b.notes,
      shotCount: b.shotCount,
      shots: b.laneRead.shots.map(line => ({
        originalShotNumber: line.originalShotNumber,
        planned:        line.planned || null,
        foot:           line.foot,
        ballStart:      line.ballStart,
        target:         line.target,
        breakpoint:     line.breakpoint,
        finishPosition: line.finishPosition,
        boardsCrossed:  line.boardsCrossed,
      })),
    })),
  }, null, 2);
}

export function importSessionJSON(json) {
  const data = JSON.parse(json);
  initSession(data.patternLength, data.ballToSlideFoot, data.handedness);
  if (data.breakpointLeeway) CONSTANTS.BREAKPOINT_LEEWAY = data.breakpointLeeway;

  const balls = data.balls.map(b => {
    const lr = new LaneRead();
    lr.init();
    b.shots.forEach(s => {
      const line = new Line(s.foot, s.ballStart, s.target, s.breakpoint, s.finishPosition);
      line.originalShotNumber = s.originalShotNumber;
      line.planned = s.planned || null;
      lr.addShot(line);
    });
    return {
      ballId:    b.ballId,
      name:      b.name,
      notes:     b.notes,
      laneRead:  lr,
      shotCount: b.shotCount,
    };
  });

  State.session = {
    sessionId:        data.sessionId,
    createdAt:        data.createdAt,
    patternLength:    data.patternLength,
    ballToSlideFoot:  data.ballToSlideFoot,
    handedness:       data.handedness,
    breakpointLeeway: data.breakpointLeeway || CONSTANTS.BREAKPOINT_LEEWAY,
    activeBallId:     data.activeBallId,
    balls,
  };
  State.editingIndex = null;
  _updateSuggestion();
}

// ─── Private ──────────────────────────────────────────────────────────────────

function _updateSuggestion() {
  const lr = State.laneRead;
  if (!lr) { State.suggestion = null; return; }

  // First shot that found the pocket at the geometric breakpoint base →
  // explore inside with a parallel shift rather than repeat the same line.
  if (lr.shots.length === 1) {
    const shot            = lr.shots[0];
    const breakpointBase  = CONSTANTS.PATTERN_LENGTH - 31;
    const atBase = Math.abs(shot.breakpoint - breakpointBase) <= CONSTANTS.BREAKPOINT_LEEWAY;
    const atPocket = Math.abs(shot.finishPosition - CONSTANTS.POCKET_BOARD) <= 1;
    if (atBase && atPocket) {
      State.suggestion = lr.getExplorationSuggestion(shot);
      return;
    }
  }

  State.suggestion = lr.getPredictedRow();
}
