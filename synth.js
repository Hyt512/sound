// Local Web Audio timbres: no audio download is required.
const synthesizer = {
 createSource(context,sound){
  const waves={synth_sine:'sine',synth_saw:'sawtooth',synth_square:'square',synth_triangle:'triangle'};
  if(waves[sound.id]){
   const oscillator=context.createOscillator();oscillator.type=waves[sound.id];
   oscillator.frequency.value=[110,220,440][sound.variant]||110;
   return oscillator;
  }
  const rate=context.sampleRate,frames=Math.round(rate*6),buffer=context.createBuffer(2,frames,rate);
  for(let c=0;c<2;c++){
   const data=buffer.getChannelData(c);let brown=0;
   for(let i=0;i<frames;i++){
    const white=Math.random()*2-1;brown=(brown+.025*white)/1.025;
    data[i]=sound.id==='synth_wind'?brown*4*(.65+.25*Math.sin(i/rate*2*Math.PI/3)):white*.45;
   }
   // Blend the boundary while retaining a continuous noise texture.
   const n=Math.min(Math.round(rate*.1),Math.floor(frames/4));
   for(let i=0;i<n;i++){const t=i/(n-1);data[frames-n+i]=data[frames-n+i]*(1-t)+data[i]*t}
  }
  const source=context.createBufferSource();source.buffer=buffer;source.loop=true;
  source.loopStart=.1;source.loopEnd=buffer.duration;
  return source;
 }
};
