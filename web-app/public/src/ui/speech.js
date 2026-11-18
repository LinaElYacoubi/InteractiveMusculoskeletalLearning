import {t,getLanguage} from '../i18n/i18n.js';
// Local device voices only. Voices matching the interface language are listed first and
// selected automatically when the language changes.
export class Narration {
  constructor(voiceSelect,speedSelect,state,onEnd){
    this.voiceSelect=voiceSelect;this.speedSelect=speedSelect;this.state=state;this.onEnd=onEnd;
    this.synth=window.speechSynthesis;this.voices=[];this.speaking=false;
    if(!this.synth){this.voiceSelect.replaceChildren(new Option(t('speech.noVoiceOption'),''));this.renderState();return;}
    this.refresh();this.synth.addEventListener('voiceschanged',()=>this.refresh());
  }
  matches(voice,lang=getLanguage()){return Boolean(voice)&&voice.lang.toLowerCase().startsWith(lang);}
  get voice(){return this.voices.find(voice=>voice.voiceURI===this.voiceSelect.value)||this.voices[0];}
  refresh(resetSelection=false){
    if(!this.synth){this.renderState();return;}
    const previous=resetSelection?'':this.voiceSelect.value;
    this.voices=this.synth.getVoices().filter(voice=>voice.localService);
    this.voices.sort((a,b)=>Number(this.matches(b))-Number(this.matches(a))||a.name.localeCompare(b.name));
    this.voiceSelect.replaceChildren();
    for(const voice of this.voices)this.voiceSelect.add(new Option(`${voice.name} (${voice.lang})`,voice.voiceURI));
    if(!this.voices.length)this.voiceSelect.add(new Option(t('speech.noVoiceOption'),''));
    else if(previous&&this.voices.some(voice=>voice.voiceURI===previous))this.voiceSelect.value=previous;
    this.renderState();
  }
  setLanguage(){this.stop();this.refresh(true);}
  renderState(){
    if(!this.state)return;
    this.state.textContent=!this.synth?t('speech.unavailable'):this.speaking?t('speech.speaking'):!this.voices.length?t('speech.noVoice'):this.matches(this.voice)?t('speech.ready'):t('speech.noLanguageVoice');
  }
  speak(text){
    if(!this.synth||!this.voices.length)return false;
    this.stop();const utterance=new SpeechSynthesisUtterance(text),voice=this.voice;
    utterance.voice=voice;utterance.lang=voice.lang;utterance.rate=Number(this.speedSelect.value);
    utterance.onend=utterance.onerror=()=>{this.speaking=false;this.renderState();this.onEnd?.();};
    this.speaking=true;this.renderState();this.synth.speak(utterance);return true;
  }
  stop(){this.synth?.cancel();this.speaking=false;this.renderState();this.onEnd?.();}
}
