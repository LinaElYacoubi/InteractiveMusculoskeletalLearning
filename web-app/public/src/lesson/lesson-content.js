// Helpers for bilingual lesson content: lookup, formatting and structural validation.
export const LANGUAGES=['en','fr'];

export function isLocalized(value){return Boolean(value)&&typeof value==='object'&&LANGUAGES.some(lang=>lang in value);}

// Returns the requested language, falling back to English so a gap never blanks the UI.
// validateLessonContent() reports such gaps so they are fixed before release.
export function t(value,lang){
  if(!isLocalized(value))return String(value??'');
  return value[lang]??value.en??'';
}
export function format(text,values){return text.replace(/\{(\w+)\}/g,(match,key)=>key in values?String(values[key]):match);}

// Returns a list of human-readable problems; an empty list means the content is structurally complete.
export function validateLessonContent(content){
  const problems=[],sourceIds=new Set((content.sources||[]).map(source=>source.id));
  const checkText=(value,path)=>{
    if(!isLocalized(value)){problems.push(`${path}: expected an {en, fr} text pair`);return;}
    for(const lang of LANGUAGES)if(typeof value[lang]!=='string'||!value[lang].trim())problems.push(`${path}: missing ${lang} text`);
  };
  const checkSources=(ids,path)=>{
    if(!Array.isArray(ids)||!ids.length){problems.push(`${path}: no supporting source`);return;}
    for(const id of ids)if(!sourceIds.has(id))problems.push(`${path}: unknown source "${id}"`);
  };
  const walk=(value,path)=>{
    if(isLocalized(value)){checkText(value,path);return;}
    if(value&&typeof value==='object')for(const [key,child] of Object.entries(value))walk(child,`${path}.${key}`);
  };
  for(const source of content.sources||[]){
    for(const key of ['id','work','section','url'])if(!source[key])problems.push(`source ${source.id||'?'}: missing ${key}`);
    if(source.url&&!/^https:\/\//.test(source.url))problems.push(`source ${source.id}: URL must use https`);
  }
  if(!content.review?.status)problems.push('lesson: missing review status');
  checkText(content.notice,'notice');
  for(const [id,claim] of Object.entries(content.claims||{})){
    checkText(claim,`claims.${id}`);checkSources(claim.sources,`claims.${id}`);
    if(!claim.status)problems.push(`claims.${id}: missing review status`);
  }
  for(const group of content.highlightGroups||[]){
    const path=`highlightGroups.${group.id}`;
    checkText(group.label,`${path}.label`);group.structures?.forEach((s,i)=>checkText(s,`${path}.structures[${i}]`));
    if(!group.claims?.length)problems.push(`${path}: no linked claim`);
    for(const id of group.claims||[])if(!content.claims?.[id])problems.push(`${path}: claim "${id}" does not exist`);
    if(!group.anatomyNames?.length)problems.push(`${path}: no anatomy names`);
    if(!group.status)problems.push(`${path}: missing review status`);
  }
  const question=content.question;
  if(!question)problems.push('question: missing');
  else{
    checkText(question.prompt,'question.prompt');checkSources(question.sources,'question');
    if(!question.status)problems.push('question: missing review status');
    if((question.options||[]).filter(option=>option.correct).length!==1)problems.push('question: exactly one option must be correct');
    question.options?.forEach(option=>{checkText(option.text,`question.${option.id}.text`);checkText(option.feedback,`question.${option.id}.feedback`);});
  }
  walk(content.ui,'ui');
  return problems;
}
