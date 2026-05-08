/**
 * Session state for LineUp.
 * Single source of truth for the multi-ball session. No DOM or React.
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

export function recordShot(actualFoot, actualTarget, actualBreakpoint, finishPosition) {
  const ball      = State.activeBall();
  const ballStart = LaneRead.ballStartFromFoot(actualFoot);
  const line      = new Line(actualFoot, ballStart, actualTarget, actualBreakpoint, finishPosition);
  line.originalShotNumber = ball.shotCount + 1;
  ball.laneRead.addShot(line);
  ball.shotCount++;
  _updateSuggestion();
}

export function updateShot(index, actualFoot, actualTarget, actualBreakpoint, finishPosition) {
  const ball      = State.activeBall();
  const ballStart = LaneRead.ballStartFromFoot(actualFoot);
  const line      = new Line(actualFoot, ballStart, actualTarget, actualBreakpoint, finishPosition);
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

export function getShotHistory() {
  const ball = State.activeBall();
  if (!ball) return [];
  return ball.laneRead.shots.map((line, i) => ({
    shotNumber:     line.originalShotNumber || (i + 1),
    foot:           line.foot,
    ballStart:      line.ballStart,
    target:         line.target,
    breakpoint:     line.breakpoint,
    finishPosition: line.finishPosition,
    boardsCrossed:  line.boardsCrossed,
    index:          i,
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
  // initSession is imported directly here — fixed from original (was missing import)
  initSession(data.patternLength, data.ballToSlideFoot, data.handedness);
  if (data.breakpointLeeway) CONSTANTS.BREAKPOINT_LEEWAY = data.breakpointLeeway;

  const balls = data.balls.map(b => {
    const lr = new LaneRead();
    lr.init();
    b.shots.forEach(s => {
      const line = new Line(s.foot, s.ballStart, s.target, s.breakpoint, s.finishPosition);
      line.originalShotNumber = s.originalShotNumber;
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

  // One shot that hit the pocket → parallel shift inside for exploration
  if (lr.shots.length === 1) {
    const shot     = lr.shots[0];
    const atPocket = Math.abs(shot.finishPosition - CONSTANTS.POCKET_BOARD) <= 1;
    if (atPocket) {
      State.suggestion = lr.getExplorationSuggestion(shot);
      return;
    }
  }

  State.suggestion = lr.getPredictedRow();
}
