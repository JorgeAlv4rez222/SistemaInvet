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
  beepRaw(1800, 0.07, 0.9, 'square')
  setTimeout(() => beepRaw(2400, 0.09, 0.8, 'square'), 75)
}

export function sonarEscaneoError() {
  // Tono grave descendente — alerta de error
  beepRaw(520, 0.18, 0.85, 'square')
  setTimeout(() => beepRaw(320, 0.22, 0.8, 'square'), 190)
}
