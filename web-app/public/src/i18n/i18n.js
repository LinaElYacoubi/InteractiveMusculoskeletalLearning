// App-wide language state (English / French). DOM-free except translateDocument().
import {STRINGS} from './strings.js';

export const LANGUAGES=['en','fr'];
const STORAGE_KEY='movement-atlas-language';
const events=new EventTarget();
let current='en';

export function getLanguage(){return current;}
export function format(text,vars={}){return String(text).replace(/\{(\w+)\}/g,(match,key)=>key in vars?String(vars[key]):match);}
export function hasKey(key){return Object.hasOwn(STRINGS,key);}
// Unknown keys return the key itself so a gap is visible rather than blank.
export function t(key,vars={},lang=current){
  const entry=STRINGS[key];if(!entry)return key;
  return format(entry[lang]??entry.en,vars);
}
export function setLanguage(lang,{persist=true}={}){
  if(!LANGUAGES.includes(lang))return false;
  const changed=lang!==current;current=lang;
  if(persist){try{localStorage.setItem(STORAGE_KEY,lang);}catch{}}
  if(changed)events.dispatchEvent(new CustomEvent('change',{detail:lang}));
  return true;
}
export function onLanguageChange(listener){events.addEventListener('change',({detail})=>listener(detail));}
// Last language chosen on this computer, otherwise the browser's preferred language.
export function initialLanguage(){
  try{const saved=localStorage.getItem(STORAGE_KEY);if(LANGUAGES.includes(saved))return saved;}catch{}
  return String(globalThis.navigator?.language||'en').toLowerCase().startsWith('fr')?'fr':'en';
}
// Applies data-i18n (text), data-i18n-html (trusted dictionary markup) and
// data-i18n-attr="attr:key;attr2:key2" to every element under root.
export function translateDocument(root){
  root.querySelectorAll('[data-i18n]').forEach(element=>{element.textContent=t(element.dataset.i18n);});
  root.querySelectorAll('[data-i18n-html]').forEach(element=>{element.innerHTML=t(element.dataset.i18nHtml);});
  root.querySelectorAll('[data-i18n-attr]').forEach(element=>{
    for(const pair of element.dataset.i18nAttr.split(';')){const [attribute,key]=pair.split(':').map(part=>part.trim());if(attribute&&key)element.setAttribute(attribute,t(key));}
  });
}
