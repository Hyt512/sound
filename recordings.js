// Decoded PCM is shared by realtime playback and offline WAV rendering.
// The WAV already contains a 1-second equal-power tail/head crossfade.
const recordingAudio = (() => {
  let buffer = null, loading = null;
  const isRecording = s => s.id === 'rain' && s.variant === 0;
  async function prepare(context, selected) {
    if (!selected.some(isRecording) || buffer) return;
    if (!loading) {
      loading = (async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);
        try {
          const response = await fetch('assets/audio/light-rain-loop.wav', { signal: controller.signal });
          if (!response.ok) throw new Error('小雨音频加载失败，请检查网络后重试');
          buffer = await context.decodeAudioData(await response.arrayBuffer());
          if (!buffer.length || !buffer.duration) { buffer = null; throw new Error('小雨音频无法解码，请重试'); }
        } catch (error) {
          buffer = null;
          throw new Error('小雨音频加载失败，请检查网络后重试');
        } finally { clearTimeout(timeout); loading = null; }
      })();
    }
    await loading;
  }
  return {
    prepare,
    get(s) { if (!isRecording(s)) return null; if (!buffer) throw new Error('小雨音频尚未加载'); return buffer; }
  };
})();
