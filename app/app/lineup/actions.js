'use server';

import { createClient } from '../../../lib/supabase/server';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function authedClient() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Not authenticated');
  return { supabase, userId: user.id };
}

// ─── User Profile ─────────────────────────────────────────────────────────────

export async function getUserProfile() {
  const { supabase, userId } = await authedClient();
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
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

export async function createBall({ name, manufacturer, serial_number, cover_stock, surface, notes }) {
  const { supabase, userId } = await authedClient();
  const { data, error } = await supabase
    .from('balls')
    .insert({ user_id: userId, name, manufacturer, serial_number, cover_stock, surface, notes })
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
  pattern_name,
  pattern_length,
  hand,
  ball_to_slide_foot,
  drift,
}) {
  const { supabase, userId } = await authedClient();
  const { data, error } = await supabase
    .from('lineup_sessions')
    .insert({
      user_id: userId,
      pattern_name,
      pattern_length,
      hand,
      ball_to_slide_foot,
      drift,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

// ─── Session Balls ────────────────────────────────────────────────────────────

export async function addBallToSession({ session_id, ball_id, surface, notes }) {
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
    .insert({ session_id, ball_id, surface, notes })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

// ─── Shots ────────────────────────────────────────────────────────────────────

export async function saveShot({
  session_id,
  lineup_ball_id,
  shot_number,
  planned_foot,
  planned_target,
  planned_breakpoint,
  actual_foot,
  actual_target,
  actual_breakpoint,
  actual_finish,
  notes,
}) {
  const { supabase } = await authedClient();
  const { data, error } = await supabase
    .from('lineup_shots')
    .insert({
      session_id,
      lineup_ball_id,
      shot_number,
      planned_foot,
      planned_target,
      planned_breakpoint,
      actual_foot,
      actual_target,
      actual_breakpoint,
      actual_finish,
      notes,
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
