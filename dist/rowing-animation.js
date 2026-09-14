const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Presentation only: several arcade taps become one readable sculling cycle.
// Use race time so pause, restart and authoritative multiplayer snapshots work.
export function advanceStroke(previous, r, time) {
  const reset = !previous || time < previous.time || r.strokes < previous.strokes;
  const state = reset ? { time, strokes: r.strokes, phase: 0 } : { ...previous };
  const dt = Math.max(0, time - state.time);
  const active = r.speed > .4 && r.cadence > 0 && r.crabRemaining <= 0 && r.finishTime == null;
  const rate = clamp(r.cadence / 6, .65, 1.35);
  if (active) state.phase = (state.phase + dt * rate) % 1;
  else if (r.crabRemaining <= 0 && state.phase > 0) {
    // Finish the current recovery before resting, even while the hull coasts.
    const next = state.phase + dt;
    state.phase = next >= 1 ? 0 : next;
  }
  state.time = time;
  state.strokes = r.strokes;
  return state;
}

// Catch -> legs -> body/arms -> hands away -> slide forward.
const poses = [
  [0,   -3, -5, -10],
  [.23,  8, -4,   0],
  [.43,  8,  3,   8],
  [.62,  8, -5,  -2],
  [1,   -3, -5, -10],
];
export function rowingPose(phase) {
  phase = clamp(phase, 0, 1);
  const i = Math.min(poses.length - 2, poses.findIndex((p, j) => j < poses.length - 1 && phase <= poses[j + 1][0]));
  const a = poses[i], b = poses[i + 1];
  const t = (phase - a[0]) / (b[0] - a[0]);
  const ease = t * t * (3 - 2 * t);
  const mix = n => a[n] + (b[n] - a[n]) * ease;
  const hip = [mix(1), -3];
  const shoulder = [hip[0] + mix(2), -12];
  const foot = [-14, -2];
  // Two equal leg segments, with feet fixed on the stretcher.
  const dx = hip[0] - foot[0], dy = hip[1] - foot[1];
  const distance = Math.hypot(dx, dy);
  const bend = Math.sqrt(Math.max(0, 11.5 ** 2 - (distance / 2) ** 2));
  const knee = [(hip[0] + foot[0]) / 2 + dy / distance * bend,
    (hip[1] + foot[1]) / 2 - dx / distance * bend];
  return { hip, shoulder, foot, knee, handleX: mix(3), drive: phase < .43 };
}
