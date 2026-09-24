function beepRaw(freq: number, dur: number, vol: number, tipo: OscillatorType = 'square') {
  try {
    const ctx  = new AudioContext()
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = tipo
    osc.frequency.value = freq
    gain.gain.setValueAtTime(vol, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + dur)
  } catch { /* sin permiso de audio */ }
}

export function sonarEscaneoExitoso() {
  // Sonido tipo pistola lectora de barras: dos tonos cortos agudos
  beepRaw(1800, 0.06, 0.6, 'square')
  setTimeout(() => beepRaw(2200, 0.08, 0.5, 'square'), 70)
}

export function sonarEscaneoError() {
  beepRaw(300, 0.25, 0.2, 'square')
  setTimeout(() => beepRaw(250, 0.2, 0.15, 'square'), 220)
}
