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
  // Sonido tipo pistola lectora de barras: tono agudo corto con square wave
  beepRaw(1900, 0.09, 0.18, 'square')
}

export function sonarEscaneoError() {
  beepRaw(300, 0.25, 0.2, 'square')
  setTimeout(() => beepRaw(250, 0.2, 0.15, 'square'), 220)
}
