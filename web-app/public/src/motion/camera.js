import {t} from '../i18n/i18n.js';
export class CameraInput extends EventTarget {
  constructor(video){super();this.video=video;this.stream=null;this.generation=0;}
  async devices(){
    if(!navigator.mediaDevices?.enumerateDevices)return [];
    return (await navigator.mediaDevices.enumerateDevices()).filter(device=>device.kind==='videoinput');
  }
  async start(deviceId){
    if(!navigator.mediaDevices?.getUserMedia)throw Object.assign(new Error('Camera access needs localhost or HTTPS in a supported browser. Use Start Movement Atlas.cmd.'),{name:'InsecureContextError'});
    this.stop();const generation=++this.generation;
    const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{...(deviceId?{deviceId:{exact:deviceId}}:{}),width:{ideal:1280},height:{ideal:720},frameRate:{ideal:24,max:30}}});
    if(generation!==this.generation){stream.getTracks().forEach(track=>track.stop());return;}
    this.stream=stream;this.video.srcObject=stream;
    try {await this.video.play();}catch(error){this.stop();throw error;}
    stream.getVideoTracks()[0].addEventListener('ended',()=>{if(this.stream===stream)this.stop();});
    this.dispatchEvent(new CustomEvent('started',{detail:stream.getVideoTracks()[0].getSettings()}));
  }
  stop(){
    ++this.generation;const hadStream=Boolean(this.stream);
    this.stream?.getTracks().forEach(track=>track.stop());this.stream=null;this.video.srcObject=null;
    if(hadStream)this.dispatchEvent(new Event('stopped'));
  }
  get active(){return Boolean(this.stream?.active);}
}
const ERROR_KEYS={NotAllowedError:'camera.error.notAllowed',NotFoundError:'camera.error.notFound',NotReadableError:'camera.error.notReadable',OverconstrainedError:'camera.error.overconstrained',InsecureContextError:'camera.error.insecure'};
export function cameraErrorKey(error){return ERROR_KEYS[error?.name]||'camera.error.generic';}
export function cameraError(error){return t(cameraErrorKey(error));}
