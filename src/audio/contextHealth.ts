/**
 * Whether the audio context is not just "running" but actually running.
 *
 * After a phone call, iOS can hand back a context that reports state
 * 'running' and plays nothing at all. Checking state is therefore not enough
 * — it is what made the app look like it was playing with no sound coming
 * out, and it is why nothing rebuilt itself: every check said the audio was
 * fine.
 *
 * The clock gives it away. A live context advances currentTime; a dead one
 * has stopped. Sampling it either side of a timer — a timer that does not
 * depend on the audio clock — tells the two apart without making a sound.
 */
export async function isContextTicking(ctx: BaseAudioContext, ms = 150): Promise<boolean> {
  if (ctx.state !== 'running') return false;
  const before = ctx.currentTime;
  await new Promise((resolve) => setTimeout(resolve, ms));
  return ctx.currentTime > before;
}
