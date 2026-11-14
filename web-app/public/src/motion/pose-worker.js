import {FilesetResolver,PoseLandmarker} from '../../vendor/mediapipe/vision_bundle.mjs';
let landmarker;
self.onmessage=async({data})=>{
  if(data.type==='prepare'){
    try {
      // The ESM loader explicitly registers ModuleFactory inside a module worker.
      const files=await FilesetResolver.forVisionTasks(new URL('../../vendor/mediapipe/wasm',import.meta.url).href,true);
      landmarker=await PoseLandmarker.createFromOptions(files,{
        baseOptions:{modelAssetPath:new URL('../../vendor/mediapipe/pose_landmarker_lite.task',import.meta.url).href,delegate:'CPU'},
        runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:.5,minPosePresenceConfidence:.5,minTrackingConfidence:.5,outputSegmentationMasks:false,
      });
      self.postMessage({type:'ready'});
    }catch(error){self.postMessage({type:'error',message:error.message});}
  }
  if(data.type==='frame'){
    try {
      const start=performance.now();const result=landmarker.detectForVideo(data.bitmap,data.timestamp);
      self.postMessage({type:'pose',landmarks:result.landmarks[0]||[],worldLandmarks:result.worldLandmarks[0]||[],elapsed:performance.now()-start,timestamp:data.timestamp});
    }catch(error){self.postMessage({type:'error',message:error.message});}
    finally{data.bitmap.close();}
  }
  if(data.type==='close'){landmarker?.close();self.close();}
};
