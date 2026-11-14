export class Narration {
  constructor(voiceSelect,speedSelect,state,onEnd){
    this.voiceSelect=voiceSelect;this.speedSelect=speedSelect;this.state=state;this.onEnd=onEnd;
    this.synth=window.speechSynthesis;this.voices=[];this.speaking=false;
    if(!this.synth){state.textContent='Unavailable';return;}
    this.refresh();this.synth.addEventListener('voiceschanged',()=>this.refresh());
  }
  refresh(){
    const previous=this.voiceSelect.value;
    this.voices=this.synth.getVoices().filter(v=>v.localService);
    this.voices.sort((a,b)=>Number(b.lang.startsWith('en'))-Number(a.lang.startsWith('en'))||a.name.localeCompare(b.name));
    this.voiceSelect.replaceChildren();
    for(const [index,voice] of this.voices.entries())this.voiceSelect.add(new Option(`${voice.name} (${voice.lang})`,String(index)));
    if(!this.voices.length)this.voiceSelect.add(new Option('No local voice installed',''));
    else if([...this.voiceSelect.options].some(o=>o.value===previous))this.voiceSelect.value=previous;
    this.state.textContent=this.voices.length?'Device voice':'No local voice';
  }
  speak(text){
    if(!this.synth || !this.voices.length)return false;
    this.stop();const utterance=new SpeechSynthesisUtterance(text);
    utterance.voice=this.voices[Number(this.voiceSelect.value)||0];utterance.lang=utterance.voice.lang;utterance.rate=Number(this.speedSelect.value);
    utterance.onend=utterance.onerror=()=>{this.speaking=false;this.state.textContent='Ready';this.onEnd?.();};
    this.speaking=true;this.state.textContent='Speaking';this.synth.speak(utterance);return true;
  }
  stop(){this.synth?.cancel();this.speaking=false;if(this.state)this.state.textContent=this.voices.length?'Ready':'No local voice';this.onEnd?.();}
}
