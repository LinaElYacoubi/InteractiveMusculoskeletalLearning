// Live feedback for "Try it yourself": the visitor's estimated joint bend, their best bend so far,
// and a form tip when the limb that should stay still moves too far (for example the upper arm
// swinging forward during elbow flexion). DOM-free so it can be tested in Node.
//
// Everything here is an estimate from camera landmarks, shown to help the visitor practise.
// It is not a clinical range-of-motion measurement. Thresholds live in each lesson's `feedback`
// block and are part of the Kinesiology review.
import {landmark,jointAngle,direction} from '../motion/pose-math.js';

const SMOOTHING=.35;   // share of each new reading in the displayed angle
const TIP_AFTER_MS=400; // a form problem must last this long before the tip appears…
const CLEAR_AFTER_MS=400; // …and be fixed this long before it disappears
const CLEAR_MARGIN=8;   // degrees below the limit needed to clear the tip (avoids flicker)

const angleBetween=(a,b)=>Math.acos(Math.max(-1,Math.min(1,a.reduce((sum,v,i)=>sum+v*b[i],0))))*180/Math.PI;

export class MovementFeedback {
  /** spec: {joint:[a,b,c], form:{segment:[a,b], reference:[a,b], maxDeg}} with MediaPipe landmark indices. */
  constructor(spec,now=()=>performance.now()){this.spec=spec;this.now=now;this.reset();}
  reset(){this.flexion=null;this.best=null;this.tip=false;this.formDeg=null;this.badSince=null;this.goodSince=null;}
  get state(){return {flexion:this.flexion===null?null:Math.round(this.flexion),best:this.best===null?null:Math.round(this.best),tip:this.tip};}

  /** Reads one tracker frame. Returns true when anything the visitor sees has changed. */
  update(points,mirror=false){
    const before=this.state,get=i=>landmark(points,i,mirror),[a,b,c]=this.spec.joint;
    const inner=jointAngle(get(a),get(b),get(c));
    if(inner!==null){
      const flexion=Math.max(0,Math.min(180,180-inner));
      this.flexion=this.flexion===null?flexion:this.flexion+(flexion-this.flexion)*SMOOTHING;
      this.best=Math.max(this.best??0,this.flexion);
    }
    this.updateForm(get);
    const after=this.state;
    return after.flexion!==before.flexion||after.best!==before.best||after.tip!==before.tip;
  }
  updateForm(get){
    const form=this.spec.form;if(!form)return;
    const segment=direction(get(form.segment[0]),get(form.segment[1])),reference=direction(get(form.reference[0]),get(form.reference[1]));
    if(!segment||!reference){this.formDeg=null;return;} // cannot judge: keep the current tip state
    const deg=this.formDeg=angleBetween(segment,reference),now=this.now();
    if(deg>form.maxDeg){
      this.goodSince=null;this.badSince??=now;
      if(!this.tip&&now-this.badSince>=TIP_AFTER_MS)this.tip=true;
    }else if(deg<form.maxDeg-CLEAR_MARGIN){
      this.badSince=null;this.goodSince??=now;
      if(this.tip&&now-this.goodSince>=CLEAR_AFTER_MS)this.tip=false;
    }else{this.badSince=null;this.goodSince=null;}
  }
}
