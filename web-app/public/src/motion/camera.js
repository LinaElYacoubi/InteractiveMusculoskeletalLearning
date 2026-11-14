export class CameraInput extends EventTarget {
  constructor(video){super();this.video=video;this.stream=null;this.generation=0;}
  async devices(){
    if(!navigator.mediaDevices?.enumerateDevices)return [];
    return (await navigator.mediaDevices.enumerateDevices()).filter(device=>device.kind==='videoinput');
  }
  async start(deviceId){
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera access needs localhost or HTTPS in a supported browser. Use Start Movement Atlas.cmd.');
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
export function cameraError(error){
  const messages={NotAllowedError:'Camera permission was not granted. Allow camera access in the browser, then try again.',NotFoundError:'No camera was found. Connect the Bose VB1 or another webcam and try again.',NotReadableError:'The camera is unavailable or being used by another app. Close other camera apps and retry.',OverconstrainedError:'The selected camera is no longer available. Choose another device.'};
  return messages[error.name]||error.message||'The camera could not be opened.';
}
