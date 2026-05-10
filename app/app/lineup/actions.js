'use server';

import { createClient } from '../../../lib/supabase/server';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function authedClient() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Not authenticated');
  return { supabase, userId: user.id };
}

// DB stores handedness as 'right'/'left'; UI uses 'R'/'L'
const toDbHand  = h => h === 'L' ? 'left' : 'right';
const fromDbHand = h => h === 'left' ? 'L' : 'R';

// ─── User Profile ─────────────────────────────────────────────────────────────

export async function getUserProfile() {
  const { supabase, userId } = await authedClient();
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data; // hand column is 'R'/'L' (hand_type enum)
}

export async function upsertUserProfile({ hand, ball_to_slide_foot, drift }) {
  const { supabase, userId } = await authedClient();
  const { data, error } = await supabase
    .from('user_profiles')
    .upsert(
      { user_id: userId, hand, ball_to_slide_foot, drift },
      { onConflict: 'user_id' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Balls ────────────────────────────────────────────────────────────────────

export async function getBalls() {
  const { supabase, userId } = await authedClient();
  const { data, error } = await supabase
    .from('balls')
    .select('*')
    .eq('user_id', userId)
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function createBall({ name, manufacturer, serial_number, cover_stock_type, surface }) {
  const { supabase, userId } = await authedClient();
  const { data, error } = await supabase
    .from('balls')
    .insert({ user_id: userId, name, manufacturer, serial_number, cover_stock_type, surface })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateBallSurface(ballId, surface) {
  const { supabase, userId } = await authedClient();
  const { data, error } = await supabase
    .from('balls')
    .update({ surface, surface_changed_on: new Date().toISOString().slice(0, 10) })
    .eq('id', ballId)
    .eq('user_id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export async function createSession({
  pattern_label,
  pattern_length,
  hand,             // 'R' | 'L'
  ball_to_slide_foot,
  drift,
}) {
  const { supabase, userId } = await authedClient();
  const { data, error } = await supabase
    .from('lineup_sessions')
    .insert({
      user_id: userId,
      pattern_label,
      pattern_length,
      handedness: toDbHand(hand),   // DB column: handedness; enum: 'right'/'left'
      ball_to_slide_foot,
      drift,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

// ─── Session Balls ────────────────────────────────────────────────────────────

export async function addBallToSession({ session_id, ball_id, surface }) {
  const { supabase, userId } = await authedClient();

  // Surface write-back: if surface differs from catalog, update balls table
  if (surface) {
    const { data: ball } = await supabase
      .from('balls')
      .select('surface')
      .eq('id', ball_id)
      .eq('user_id', userId)
      .maybeSingle();
    if (ball && ball.surface !== surface) {
      await supabase
        .from('balls')
        .update({ surface, surface_changed_on: new Date().toISOString().slice(0, 10) })
        .eq('id', ball_id)
        .eq('user_id', userId);
    }
  }

  const { data, error } = await supabase
    .from('lineup_balls')
    .insert({ session_id, ball_id, surface, user_id: userId })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

// ─── Shots ────────────────────────────────────────────────────────────────────

export async function saveShot({
  session_id,
  ball_id,          // FK to lineup_balls.id
  shot_number,
  planned_foot,
  planned_target,
  planned_brk,      // DB column name
  actual_foot,
  actual_target,
  actual_brk,       // DB column name
  actual_finish,
}) {
  const { supabase, userId } = await authedClient();
  const { data, error } = await supabase
    .from('lineup_shots')
    .insert({
      session_id,
      ball_id,
      shot_number,
      planned_foot,
      planned_target,
      planned_brk,
      actual_foot,
      actual_target,
      actual_brk,
      actual_finish,
      user_id: userId,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function getSessionShots(sessionId) {
  const { supabase } = await authedClient();
  const { data, error } = await supabase
    .from('lineup_shots')
    .select('*')
    .eq('session_id', sessionId)
    .order('shot_number');
  if (error) throw error;
  return data ?? [];
}

// ─── Session history (review) ─────────────────────────────────────────────────

export async function getSessions() {
  const { supabase, userId } = await authedClient();
  const { data: sessions, error } = await supabase
    .from('lineup_sessions')
    .select(`
      id, created_at, pattern_label, pattern_length, handedness, ball_to_slide_foot, drift,
      lineup_balls ( balls ( name ) )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  if (!sessions?.length) return [];

  // Fetch shot counts per session in one query
  const sessionIds = sessions.map(s => s.id);
  const { data: shotRows } = await supabase
    .from('lineup_shots')
    .select('session_id')
    .in('session_id', sessionIds);

  const countMap = {};
  for (const row of (shotRows ?? [])) {
    countMap[row.session_id] = (countMap[row.session_id] ?? 0) + 1;
  }

  return sessions.map(s => ({
    id:               s.id,
    created_at:       s.created_at,
    pattern_label:    s.pattern_label,
    pattern_length:   s.pattern_length,
    hand:             fromDbHand(s.handedness),   // normalise to 'R'/'L' for UI
    ball_to_slide_foot: s.ball_to_slide_foot,
    drift:            s.drift,
    shot_count:       countMap[s.id] ?? 0,
    ball_names:       (s.lineup_balls ?? []).map(lb => lb.balls?.name).filter(Boolean).join(', '),
  }));
}

export async function getSessionDetail(sessionId) {
  const { supabase, userId } = await authedClient();
  const [{ data: session, error: sErr }, { data: shots, error: shErr }] = await Promise.all([
    supabase.from('lineup_sessions').select('*').eq('id', sessionId).eq('user_id', userId).single(),
    supabase.from('lineup_shots').select('*').eq('session_id', sessionId).order('shot_number'),
  ]);
  if (sErr) throw sErr;
  if (shErr) throw shErr;
  // Normalise handedness to 'R'/'L' for UI consistency
  return {
    session: { ...session, hand: fromDbHand(session.handedness) },
    shots:   shots ?? [],
  };
}
