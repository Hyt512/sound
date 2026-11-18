// Decoded PCM is shared by realtime playback and offline WAV rendering.
// Each WAV contains a 1-second equal-power tail/head crossfade.
const recordingAudio = (() => {
  const assets = {
    'rain:0': { name: '小雨', url: 'assets/audio/light-rain-loop.wav' },
    'wind:0': { name: '微风', url: 'assets/audio/gentle-wind-loop.wav' },
    'bird:1': { name: '林间群鸟', url: 'assets/audio/forest-birds-loop.wav' },
    'cicada:0': { name: '夏日轻鸣', url: 'assets/audio/light-cicada-loop.wav' },
    'cicada:1': { name: '盛夏蝉声', url: 'assets/audio/summer-cicadas-loop.wav' }
  };
  const buffers = new Map(), loading = new Map();
  const keyFor = s => s.id + ':' + s.variant;
  const assetFor = s => Object.hasOwn(assets, keyFor(s)) ? assets[keyFor(s)] : null;
  async function load(context, id) {
    if (buffers.has(id)) return;
    if (!loading.has(id)) {
      const asset = assets[id];
      const task = (async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);
        try {
          const response = await fetch(asset.url, { signal: controller.signal });
          if (!response.ok) throw new Error('HTTP ' + response.status);
          const buffer = await context.decodeAudioData(await response.arrayBuffer());
          if (!buffer.length || !buffer.duration) throw new Error('Invalid audio');
          buffers.set(id, buffer);
        } catch (error) {
          throw new Error(asset.name + '音频加载失败，请检查网络后重试');
        } finally { clearTimeout(timeout); }
      })();
      loading.set(id, task);
      task.then(() => loading.delete(id), () => loading.delete(id));
    }
    await loading.get(id);
  }
  return {
    async prepare(context, selected) {
      await Promise.all([...new Set(selected.filter(assetFor).map(keyFor))].map(id => load(context, id)));
    },
    get(s) {
      const asset = assetFor(s);
      if (!asset) return null;
      if (!buffers.has(keyFor(s))) throw new Error(asset.name + '音频尚未加载');
      return buffers.get(keyFor(s));
    }
  };
})();
