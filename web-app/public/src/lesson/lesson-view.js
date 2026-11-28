// Renders LessonController state into the lesson panel. One delegated click listener is bound
// once; re-renders replace buttons without adding listeners.
import {t,format} from './lesson-content.js';

const CAMERA_STATES=['requesting','preparing','position','tracking'];

function h(tag,props={},...children){
  const element=document.createElement(tag);
  for(const [key,value] of Object.entries(props)){
    if(value===undefined||value===null||value===false)continue;
    if(key==='className')element.className=value;
    else if(key==='text')element.textContent=value;
    else if(key==='dataset')Object.assign(element.dataset,value);
    else element.setAttribute(key,value===true?'':value);
  }
  for(const child of children.flat())if(child!==null&&child!==undefined&&child!==false)element.append(child);
  return element;
}

export class LessonView {
  // Content always comes from the controller, so switching lessons re-renders with the new lesson.
  constructor({controller,lessons=controller.lessons,panel,sourcesDialog,cameraPreview,tabLabel}){
    Object.assign(this,{controller,lessons,panel,sourcesDialog,cameraPreview,tabLabel});
    this.el={
      progress:panel.querySelector('#lessonProgress'),notice:panel.querySelector('#lessonNotice'),steps:panel.querySelector('#lessonSteps'),
      content:panel.querySelector('#lessonContent'),camera:panel.querySelector('#lessonCamera'),actions:panel.querySelector('#lessonActions'),nav:panel.querySelector('#lessonNav'),
    };
    this.home={parent:cameraPreview.parentNode,next:cameraPreview.nextSibling};
    this.lastStep=null;
    panel.addEventListener('click',event=>{const button=event.target.closest('[data-action]');if(button&&!button.disabled)this.act(button.dataset.action);});
    sourcesDialog.addEventListener('click',event=>{
      if(event.target===sourcesDialog||event.target.closest('[data-action="closeSources"]'))sourcesDialog.close();
    });
    controller.addEventListener('change',({detail})=>this.render(detail));
    controller.addEventListener('feedback',({detail})=>this.updateFeedback(detail));
    this.render(controller.state);
  }
  get content(){return this.controller.content;}
  tx(value){return t(value,this.controller.lang);}
  ui(key){return this.tx(this.content.ui[key]);}

  act(action){
    const c=this.controller,[name,arg]=action.split(':');
    const handlers={
      start:()=>c.next(),next:()=>c.next(),back:()=>c.back(),restart:()=>c.restart(),exit:()=>c.exit(),
      replay:()=>c.replay(),startCamera:()=>c.startCamera(),useDemo:()=>c.useDemonstration(),capture:()=>c.captureStart(),ready:()=>c.readyToContinue(),
      group:()=>c.showGroup(arg),lesson:()=>c.setLesson(arg),answer:()=>c.choose(arg),tryAnother:()=>c.retryQuestion(),lang:()=>c.setLanguage(arg),sources:()=>this.openSources(arg),
    };
    handlers[name]?.();
  }

  // ---- building blocks ---------------------------------------------------------------------
  refs(ids){
    return h('span',{className:'lesson-refs'},ids.map(id=>{
      const n=this.content.sources.findIndex(source=>source.id===id)+1;
      return h('button',{type:'button',className:'lesson-ref',dataset:{action:`sources:${id}`},'aria-label':format(this.ui('sourceRef'),{n}),text:`[${n}]`});
    }));
  }
  claim(id,className='lesson-claim'){
    const claim=this.content.claims[id];
    return h('p',{className},this.tx(claim),' ',this.refs(claim.sources));
  }
  button(action,label,kind='primary',extra={}){
    return h('button',{type:'button',className:kind==='primary'?'primary-button':kind==='text'?'text-button':'outline-button',dataset:{action},...extra,text:label});
  }
  chip(text,live=false){return h('span',{className:'lesson-chip'+(live?' live':'')},text);}

  // ---- render ------------------------------------------------------------------------------
  render(state){
    const lang=state.lang,content=this.content;
    this.panel.lang=lang;
    if(this.tabLabel)this.tabLabel.textContent=t(content.ui.tab,lang);
    this.panel.querySelectorAll('[data-action^="lang:"]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.action===`lang:${lang}`)));
    this.el.notice.textContent=t(content.notice,lang);
    this.syncCamera(state);
    if(!state.active){this.lastStep=null;return;}
    const focusedAction=this.panel.contains(document.activeElement)?document.activeElement.dataset?.action:null;
    const stepName=this.tx(content.ui.stepNames[state.step]);
    this.el.progress.textContent=`${format(this.ui('stepOf'),{n:state.stepIndex+1,total:state.stepCount})} · ${stepName}`;
    this.el.steps.replaceChildren(...Array.from({length:state.stepCount},(_,i)=>h('li',{className:i<state.stepIndex?'done':i===state.stepIndex?'current':'', 'aria-hidden':'true'})));
    const heading=h('h2',{tabindex:'-1',text:state.step==='intro'?this.ui('title'):stepName});
    const {body,actions}=this[`render_${state.step}`](state);
    this.el.content.replaceChildren(heading,...body);
    this.el.actions.replaceChildren(...actions);
    const nav=[];
    if(state.stepIndex>0)nav.push(this.button('back','← '+this.ui('back'),'text'),this.button('restart',this.ui('restart'),'text'));
    nav.push(this.button('sources',this.ui('sources'),'text'),this.button('exit',this.ui('exit'),'text'));
    this.el.nav.replaceChildren(...nav);
    this.el.nav.setAttribute('aria-label',this.ui('lessonNav'));
    if(state.step!==this.lastStep){this.panel.scrollTop=0;if(this.lastStep!==null)heading.focus();}
    else if(focusedAction)this.panel.querySelector(`[data-action="${CSS.escape(focusedAction)}"]`)?.focus();
    this.lastStep=state.step;
    if(this.sourcesDialog.open)this.fillSources();
  }
  // Lesson picker: only shown when there is more than one lesson.
  picker(state){
    if(this.lessons.length<2)return [];
    return [h('div',{className:'lesson-groups lesson-picker',role:'group','aria-label':this.ui('chooseLesson')},this.lessons.map(lesson=>
      h('button',{type:'button',className:'lesson-group',dataset:{action:`lesson:${lesson.id}`},'aria-pressed':String(lesson.id===state.lessonId)},this.tx(lesson.ui.shortName))))];
  }
  render_intro(state){
    return {
      body:[...this.picker(state),h('span',{className:'eyebrow lesson-label',text:this.ui('objectiveLabel')}),this.claim('objective','lesson-claim lesson-lead'),h('p',{text:this.ui('whatYouWillDo')})],
      actions:[this.button('start',this.ui('start')),this.button('exit',this.ui('returnToExplore'),'outline')],
    };
  }
  render_watch(){
    return {body:[this.chip(this.ui('demoLabel')),h('p',{text:this.ui('watchIntro')})],
      actions:[this.button('next',this.ui('continue')),this.button('replay','↺ '+this.ui('replay'),'outline')]};
  }
  render_try(state){
    const s=state.tryState,status=this.content.ui.status;
    const key=s==='position'?(state.notice==='notVisible'||!state.armVisible?'notVisible':'position'):s==='tracking'?(state.trackStatus==='lost'?'lost':'tracking'):s;
    const body=[
      h('p',{className:'lesson-arm',text:this.ui('limbLabel')}),
      h('span',{className:'eyebrow lesson-label',text:this.ui('startPositionLabel')}),this.claim('startPosition'),
      h('span',{className:'eyebrow lesson-label',text:this.ui('movementLabel')}),this.claim('movement'),
    ];
    if(s==='tracking'){body.push(this.chip(this.ui('liveLabel'),true));if(state.feedback)body.push(this.meter(state.feedback));}
    if(s==='demo')body.push(this.chip(this.ui('demoLabel')));
    body.push(h('p',{className:'lesson-status'+(['denied','noCamera','cameraError','trackingError','cameraStopped','lost','notVisible'].includes(key)?' warn':''),role:'status',text:this.tx(status[key])}));
    if(CAMERA_STATES.includes(s))body.push(h('p',{className:'lesson-fine',text:this.ui('previewNote')}));
    const demo=this.button('useDemo',this.ui('useDemo'),'outline');
    const actions={
      idle:[this.button('startCamera',this.ui('startCamera')),demo],
      requesting:[this.button('startCamera',this.ui('startCamera'),'primary',{disabled:true}),demo],
      preparing:[this.button('startCamera',this.ui('startCamera'),'primary',{disabled:true}),demo],
      position:[this.button('capture',this.ui('capture'),'primary',{disabled:!state.armVisible}),demo],
      tracking:[this.button('ready',this.ui('ready')),demo],
      demo:[this.button('ready',this.ui('ready')),this.button('startCamera',this.ui('tryCamera'),'outline'),this.button('replay','↺ '+this.ui('replay'),'text')],
    }[s]||[this.button('useDemo',this.ui('useDemo')),this.button('startCamera',this.ui('retry'),'outline')];
    return {body,actions};
  }
  render_understand(state){
    const groups=this.content.highlightGroups,group=groups.find(item=>item.id===state.group);
    const picker=h('div',{className:'lesson-groups',role:'group','aria-label':this.ui('structuresLabel')},groups.map(item=>
      h('button',{type:'button',className:'lesson-group',dataset:{action:`group:${item.id}`},'aria-pressed':String(item.id===state.group),style:`--group:${item.color}`},h('i',{'aria-hidden':'true'}),this.tx(item.label))));
    const body=[h('p',{text:this.ui('understandIntro')}),picker];
    if(group){
      body.push(h('ul',{className:'lesson-structures',style:`--group:${group.color}`},group.structures.map(item=>h('li',{text:this.tx(item)}))));
      for(const id of group.claims)body.push(this.claim(id));
      body.push(h('p',{className:'lesson-disclaimer'},this.chip(this.ui('draft')),' ',this.ui('highlightDisclaimer')));
      if(state.groupMissing.length)body.push(h('p',{className:'lesson-status warn',role:'status'},this.ui('missingStructures'),' ',state.groupMissing.join(', ')));
    }
    body.push(h('section',{className:'lesson-box'},h('h3',{text:this.ui('positionTitle')}),this.claim('lifting'),this.claim('direction')));
    return {body,actions:[this.button('next',this.ui('continue'))]};
  }
  render_check(state){
    const question=this.content.question,chosen=question.options.find(option=>option.id===state.answer);
    const options=h('div',{className:'lesson-options',role:'group','aria-label':this.tx(question.prompt)},question.options.map((option,index)=>
      h('button',{type:'button',className:'lesson-option'+(chosen===option?(option.correct?' correct':' incorrect'):''),dataset:{action:`answer:${option.id}`},
        'aria-pressed':String(chosen===option),disabled:Boolean(chosen)},h('b',{text:String.fromCharCode(65+index)}),this.tx(option.text))));
    const body=[h('p',{className:'lesson-lead',text:this.tx(question.prompt)}),options];
    let actions=[];
    if(chosen){
      body.push(h('div',{className:'lesson-feedback '+(chosen.correct?'correct':'incorrect'),role:'status'},h('p',{},this.tx(chosen.feedback),' ',this.refs(question.sources))));
      if(chosen.correct){body.push(h('p',{className:'lesson-finished',text:this.ui('finished')}));actions=[this.button('restart',this.ui('tryAgain')),this.button('exit',this.ui('exploreAnatomy'),'outline')];}
      else actions=[this.button('tryAnother',this.ui('tryAnother'))];
    }
    return {body,actions};
  }

  // ---- live feedback (try step) ----------------------------------------------------------------
  // Built once per render, then updated in place by updateFeedback() so the panel is not rebuilt
  // many times a second.
  meter(feedback){
    const box=h('section',{className:'lesson-meter','aria-label':this.ui('angleLabel')},
      h('span',{className:'eyebrow lesson-label',text:this.ui('angleLabel')}),
      h('div',{className:'lesson-meter-row'},h('strong',{dataset:{fb:'now'}}),h('span',{dataset:{fb:'best'}})),
      h('div',{className:'lesson-meter-bar','aria-hidden':'true'},h('i',{dataset:{fb:'fill'}}),h('b',{dataset:{fb:'mark'}})),
      h('p',{className:'lesson-status warn',role:'status',dataset:{fb:'tip'},text:this.ui('formTip')}),
      h('p',{className:'lesson-fine',text:this.ui('angleNote')}));
    this.fillFeedback(box,feedback);
    return box;
  }
  updateFeedback(feedback){const box=this.el.content.querySelector('.lesson-meter');if(box)this.fillFeedback(box,feedback);}
  fillFeedback(box,{flexion,best,tip}){
    const max=this.content.feedback?.displayMax||150,pct=v=>`${Math.min(100,Math.max(0,(v??0)/max*100))}%`,part=name=>box.querySelector(`[data-fb="${name}"]`);
    part('now').textContent=flexion===null?'—':`${flexion}°`;
    part('best').textContent=best===null?'':format(this.ui('bestLabel'),{n:best});
    part('fill').style.width=pct(flexion);part('mark').style.left=pct(best);part('mark').hidden=best===null;
    part('tip').hidden=!tip;
  }

  // ---- camera preview hand-over --------------------------------------------------------------
  syncCamera(state){
    const show=state.active&&state.step==='try'&&CAMERA_STATES.includes(state.tryState);
    if(show&&this.cameraPreview.parentNode!==this.el.camera)this.el.camera.append(this.cameraPreview);
    if(!show&&this.cameraPreview.parentNode!==this.home.parent)this.home.parent.insertBefore(this.cameraPreview,this.home.next);
    this.el.camera.hidden=!show;
  }

  // ---- sources ---------------------------------------------------------------------------------
  openSources(id){
    this.fillSources();
    if(!this.sourcesDialog.open)this.sourcesDialog.showModal();
    const target=id&&this.sourcesDialog.querySelector(`[data-source="${CSS.escape(id)}"]`);
    this.sourcesDialog.querySelectorAll('.lesson-source').forEach(item=>item.classList.toggle('target',item===target));
    target?.scrollIntoView({block:'nearest'});
  }
  fillSources(){
    const lang=this.controller.lang,content=this.content,claims=Object.entries(content.claims);
    this.sourcesDialog.lang=lang;
    const list=h('ol',{className:'lesson-source-list'},content.sources.map(source=>{
      const supported=claims.filter(([,claim])=>claim.sources.includes(source.id)).map(([,claim])=>t(claim,lang));
      if(content.question.sources.includes(source.id))supported.push(t(content.question.prompt,lang));
      return h('li',{className:'lesson-source',dataset:{source:source.id}},
        h('strong',{text:`${source.section}`}),
        h('span',{text:`${source.authors}. ${source.work}. ${source.publisher}, ${source.year}. ${lang==='fr'?'Consulté le':'Accessed'} ${source.accessed}.`}),
        h('a',{href:source.url,target:'_blank',rel:'noopener noreferrer',text:source.url}),
        h('details',{},h('summary',{text:`${t(content.ui.supports,lang)} (${supported.length})`}),h('ul',{},supported.map(text=>h('li',{text})))));
    }));
    this.sourcesDialog.replaceChildren(
      h('div',{className:'dialog-top'},h('span',{className:'eyebrow',text:t(content.notice,lang)}),h('button',{type:'button',className:'quiet-button',dataset:{action:'closeSources'},'aria-label':t(content.ui.close,lang),text:'✕'})),
      h('h2',{text:t(content.ui.sourcesTitle,lang)}),h('p',{text:t(content.ui.sourcesIntro,lang)}),list,
      h('button',{type:'button',className:'primary-button',dataset:{action:'closeSources'},text:t(content.ui.close,lang)}));
  }
}
