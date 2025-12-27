/**
 * Play a notification ding sound using the Web Audio API.
 * Creates a pleasant two-tone sound that rises in pitch.
 */
export const playDing = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return

    const ctx = new AudioContext()
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    // Two-tone rising sound: A5 (880Hz) -> higher pitch
    oscillator.frequency.setValueAtTime(880, ctx.currentTime)
    oscillator.frequency.setValueAtTime(1100, ctx.currentTime + 0.1)
    oscillator.type = 'sine'

    // Fade out over 0.5 seconds
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)

    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + 0.5)

    // Clean up after sound finishes
    setTimeout(() => ctx.close(), 600)
  } catch (error) {
    console.warn('Could not play notification sound', error)
  }
}

