/** Web Vibration API wrapper — gracefully no-ops on unsupported devices */

function vibrate(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try { navigator.vibrate(pattern); } catch { /* no-op on unsupported */ }
  }
}

export const haptics = {
  /** Very short tap — button press, toggle */
  tap: () => vibrate(10),

  /** Light success — action completed */
  success: () => vibrate([10, 30, 60]),

  /** Error — something went wrong */
  error: () => vibrate([40, 30, 40, 30, 80]),

  /** Warning — caution */
  warning: () => vibrate([30, 20, 30]),

  /** Info — neutral notification */
  info: () => vibrate(20),

  /** Long press feedback */
  heavy: () => vibrate(80),

  /** Swipe / confirm */
  confirm: () => vibrate([15, 20, 15]),
};
