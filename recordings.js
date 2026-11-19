// Decoded PCM is shared by realtime playback and offline WAV rendering.
// Each WAV contains a 1-second equal-power tail/head crossfade.
const recordingAudio = (() => {
  const assets = {
    'music_piano_sonata10:0': { name: "c大调第十钢琴奏鸣曲", url: 'assets/audio/music-piano-sonata10-loop.wav' },
    'music_piano_k545:0': { name: "莫扎特k545", url: 'assets/audio/music-piano-k545-loop.wav' },
    'music_piano_nocturne:0': { name: "降E大调夜曲 Op.9 No.2", url: 'assets/audio/music-piano-nocturne-loop.wav' },
    'music_piano_k330:0': { name: "莫扎特奏鸣曲k330第一乐章", url: 'assets/audio/music-piano-k330-loop.wav' },
    'music_piano_moonlight:0': { name: "月光", url: 'assets/audio/music-piano-moonlight-loop.wav' },
    'music_violin_air:0': { name: "g弦上的咏叹调", url: 'assets/audio/music-violin-air-loop.wav' },
    'music_violin_spring:0': { name: "春", url: 'assets/audio/music-violin-spring-loop.wav' },
    'music_flow:0': { name: '流水清音', url: 'assets/audio/music-flow-loop.wav' },
    'music_underwater:0': { name: '水底微光', url: 'assets/audio/music-underwater-loop.wav' },
    'music_guqin:0': { name: '古琴幽韵', url: 'assets/audio/music-guqin-loop.wav' },
    'motorcycle:0': { name: '街巷引擎', url: 'assets/audio/street-motorcycle-loop.wav' },
    'keyboard:0': { name: '指尖轻语', url: 'assets/audio/gentle-keys-loop.wav' },
    'keyboard:1': { name: '键上疾雨', url: 'assets/audio/resonant-keys-loop.wav' },
    'book:0': { name: '轻翻书页', url: 'assets/audio/gentle-pages-loop.wav' },
    'book:1': { name: '纸间回响', url: 'assets/audio/resonant-pages-loop.wav' },
    'train:0': { name: '空站回响', url: 'assets/audio/empty-station-loop.wav' },
    'train:1': { name: '人间站台', url: 'assets/audio/lively-platform-loop.wav' },
    'cricket:0': { name: '月下独吟', url: 'assets/audio/solo-cricket-loop.wav' },
    'cricket:1': { name: '草间疏鸣', url: 'assets/audio/sparse-crickets-loop.wav' },
    'frog:0': { name: '荷塘独鸣', url: 'assets/audio/solo-frog-loop.wav' },
    'frog:1': { name: '夏夜蛙歌', url: 'assets/audio/frog-chorus-loop.wav' },
    'rain:0': { name: '小雨', url: 'assets/audio/light-rain-loop.wav' },
    'wind:0': { name: '微风', url: 'assets/audio/gentle-wind-loop.wav' },
    'bird:0': { name: '清晨鸟鸣', url: 'assets/audio/morning-bird-loop.wav' },
    'bird:1': { name: '林间群鸟', url: 'assets/audio/forest-birds-loop.wav' },
    'cicada:0': { name: '夏日轻鸣', url: 'assets/audio/light-cicada-loop.wav' },
    'water:1': { name: '山间瀑布', url: 'assets/audio/mountain-waterfall-loop.wav' },
    'water:0': { name: '潺潺溪流', url: 'assets/audio/gentle-stream-loop.wav' },
    'cicada:1': { name: '盛夏蝉声', url: 'assets/audio/summer-cicadas-loop.wav' }
  };
  for(const card of soundCards)assets[card.id+':0']={name:card.name,url:card.url};
  const buffers = new Map(), loading = new Map();
  const keyFor = s => s.id + ':' + s.variant;
  const assetFor = s => Object.hasOwn(assets, keyFor(s)) ? assets[keyFor(s)] : null;
  // Store only audio the visitor actually requests; hashed URLs prevent stale playback.
  async function fetchAudio(url,signal){
    let cache=null;
    try{if(typeof caches!=='undefined'){cache=await caches.open('soundloom-audio-mobile-v1');const hit=await cache.match(url);if(hit)return hit}}catch{}
    const response=await fetch(url,{signal});
    if(!response.ok)throw new Error('HTTP '+response.status);
    if(cache){try{cache.put(url,response.clone()).catch(()=>{})}catch{}}
    return response;
  }
  function trimEncoderPadding(context,buffer,meta){
    // Modern decoders remove MP3 padding. Trim it only when a decoder leaves extra samples.
    if(!meta||!buffer.sampleRate||typeof buffer.getChannelData!=='function')return buffer;
    const target=Math.round(meta.duration*buffer.sampleRate),extra=buffer.length-target;
    if(extra<=2||extra>buffer.sampleRate*.15)return buffer;
    const priming=Math.round(meta.delay*buffer.sampleRate),offset=extra>=priming?priming:0;
    const trimmed=context.createBuffer(buffer.numberOfChannels,target,buffer.sampleRate);
    for(let c=0;c<buffer.numberOfChannels;c++)trimmed.getChannelData(c).set(buffer.getChannelData(c).subarray(offset,offset+target));
    return trimmed;
  }
  async function load(context,id){
    if(buffers.has(id))return;
    if(!loading.has(id)){
      const asset=assets[id];
      const task=(async()=>{
        const controller=new AbortController();
        const timeout=setTimeout(()=>controller.abort(),30000);
        try{
          const meta=typeof optimizedAudio!=='undefined'?optimizedAudio[asset.url]:null;
          const response=await fetchAudio(meta?meta.url:asset.url,controller.signal);
          let buffer;
          try{buffer=await context.decodeAudioData(await response.arrayBuffer());buffer=trimEncoderPadding(context,buffer,meta)}
          catch(error){
            if(!meta)throw error;
            const fallback=await fetchAudio(asset.url,controller.signal);
            buffer=await context.decodeAudioData(await fallback.arrayBuffer());
          }
          if(!buffer.length||!buffer.duration)throw new Error('Invalid audio');
          buffers.set(id,buffer);
        }catch(error){throw new Error(asset.name+'音频加载失败，请检查网络后重试')}
        finally{clearTimeout(timeout)}
      })();
      loading.set(id,task);task.then(()=>loading.delete(id),()=>loading.delete(id));
    }
    await loading.get(id);
  }
  return {
    async prepare(context,selected,onProgress){
      const ids=[...new Set(selected.filter(assetFor).map(keyFor))];let done=0;
      if(onProgress)onProgress(0,ids.length);
      await Promise.all(ids.map(async id=>{await load(context,id);if(onProgress)onProgress(++done,ids.length)}));
    },
    get(s) {
      const asset = assetFor(s);
      if (!asset) return null;
      if (!buffers.has(keyFor(s))) throw new Error(asset.name + '音频尚未加载');
      return buffers.get(keyFor(s));
    }
  };
})();
