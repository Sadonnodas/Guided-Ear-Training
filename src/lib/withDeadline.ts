/**
 * Reject if a promise has not settled in time.
 *
 * iOS has promises that simply never settle. AudioContext.resume() on a
 * context it has wedged after an audio route change, and HTMLMediaElement
 * .play() when the audio session is in the same state, both hang rather than
 * fail — so a plain `await` waits for a result that is never coming, and a
 * try/catch around it never runs. Anything on the path to starting sound
 * needs a deadline, or the app sits on "Initializing..." until it is killed.
 */
export function withDeadline<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}
