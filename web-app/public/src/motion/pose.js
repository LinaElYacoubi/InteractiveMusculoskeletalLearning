export class PoseDetection extends EventTarget {
  constructor(video){super();this.video=video;this.worker=null;this.ready=false;this.running=false;this.busy=false;this.previousTime=-1;this.preparing=null;}
  prepare(){
    if(this.ready)return Promise.resolve();if(this.preparing)return this.preparing;
    this.preparing=new Promise((resolve,reject)=>{
      this.worker=new Worker(new URL('./pose-worker.js',import.meta.url),{type:'module'});
      const timeout=setTimeout(()=>{this.dispose();reject(new Error('Tracking preparation timed out. Check that the bundled model and WASM files are available.'));},60000);
      this.worker.onmessage=({data})=>{
        if(data.type==='ready'){clearTimeout(timeout);this.ready=true;this.preparing=null;resolve();this.dispatchEvent(new Event('ready'));}
        if(data.type==='pose'){this.busy=false;this.dispatchEvent(new CustomEvent('pose',{detail:data}));}
        if(data.type==='error'){
          clearTimeout(timeout);this.busy=false;
          if(!this.ready){this.worker?.terminate();this.worker=null;this.preparing=null;reject(new Error(data.message));}
          this.dispatchEvent(new CustomEvent('failure',{detail:data.message}));
        }
      };
      this.worker.onerror=event=>{clearTimeout(timeout);this.dispose();reject(new Error(event.message||'Pose tracking could not start.'));this.dispatchEvent(new CustomEvent('failure',{detail:event.message||'Pose worker failed.'}));};
      this.worker.postMessage({type:'prepare'});
    });
    return this.preparing;
  }
  start(){if(!this.ready||this.running)return;this.running=true;this.previousTime=-1;this.timer=setInterval(()=>this.pump(),80);}
  async pump(){
    if(!this.running||!this.ready||this.busy||this.video.readyState<2||this.video.currentTime===this.previousTime)return;
    this.busy=true;this.previousTime=this.video.currentTime;
    try {
      const bitmap=await createImageBitmap(this.video);
      if(!this.running||!this.worker){bitmap.close();this.busy=false;return;}
      this.worker.postMessage({type:'frame',bitmap,timestamp:performance.now()},[bitmap]);
    }catch(error){this.busy=false;this.dispatchEvent(new CustomEvent('failure',{detail:error.message}));}
  }
  pause(){this.running=false;clearInterval(this.timer);}
  dispose(){this.pause();this.worker?.terminate();this.worker=null;this.ready=false;this.busy=false;this.preparing=null;}
}
