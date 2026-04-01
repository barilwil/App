import { API_URL } from '../../app/constants'

let _ttsSourceNode = null  // track current AudioContext source so we can stop it

export async function speak(text, onStart, onEnd) {
  if (!text) { onEnd?.(); return }
  try {
    const resp = await fetch(`${API_URL}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (!resp.ok) throw new Error(`TTS API ${resp.status}`)
    const { audio } = await resp.json()

    const binary = atob(audio)
    const bytes  = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

    const ctx    = new (window.AudioContext || window.webkitAudioContext)()
    const buffer = await ctx.decodeAudioData(bytes.buffer)
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    _ttsSourceNode = source
    onStart?.()
    source.onended = () => { onEnd?.(); _ttsSourceNode = null; ctx.close() }
    source.start(0)
  } catch (err) {
    console.warn('TTS API failed, falling back to Web Speech API:', err)
    if (!window.speechSynthesis) { onEnd?.(); return }
    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(text)
    utt.rate = window._ttsRate || 1.05; utt.pitch = window._ttsPitch || 1.0; utt.volume = 1.0
    utt.onstart = () => onStart?.()
    utt.onend   = () => onEnd?.()
    utt.onerror = () => onEnd?.()
    window.speechSynthesis.speak(utt)
  }
}

export function stopSpeaking() {
  if (_ttsSourceNode) { try { _ttsSourceNode.stop() } catch {} ; _ttsSourceNode = null }
  if (window.speechSynthesis) window.speechSynthesis.cancel()
}
