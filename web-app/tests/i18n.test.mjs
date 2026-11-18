import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {STRINGS} from '../public/src/i18n/strings.js';
import {t,setLanguage,getLanguage,onLanguageChange,LANGUAGES,format} from '../public/src/i18n/i18n.js';
import {describe,displayName,KNOWLEDGE_RECORDS} from '../public/src/data/knowledge.js';
import {cameraError,cameraErrorKey} from '../public/src/motion/camera.js';

const read=path=>readFile(new URL(path,import.meta.url),'utf8');

test('every interface string has non-empty English and French text with matching placeholders',()=>{
  for(const [key,entry] of Object.entries(STRINGS)){
    for(const lang of LANGUAGES)assert.ok(typeof entry[lang]==='string'&&entry[lang].trim(),`${key}: missing ${lang}`);
    const vars=lang=>[...entry[lang].matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort();
    assert.deepEqual(vars('fr'),vars('en'),`${key}: placeholders differ`);
    if(!key.endsWith('Html'))assert.ok(!/<[a-z]/i.test(entry.en+entry.fr),`${key}: markup only allowed in *Html keys`);
  }
});
test('every key referenced by the page and the app exists in the dictionary',async()=>{
  const html=await read('../public/index.html'),app=await read('../public/src/app.js');
  const keys=new Set();
  for(const [,key] of html.matchAll(/data-i18n(?:-html)?="([^"]+)"/g))keys.add(key);
  for(const [,pairs] of html.matchAll(/data-i18n-attr="([^"]+)"/g))for(const pair of pairs.split(';'))keys.add(pair.split(':')[1]);
  for(const [,key] of app.matchAll(/\bt\('([^']+)'/g))keys.add(key);
  for(const [,keyA,keyB] of app.matchAll(/t\([^)]*\?'([^']+)':'([^']+)'\)/g)){keys.add(keyA);keys.add(keyB);}
  const missing=[...keys].filter(key=>!(key in STRINGS));
  assert.deepEqual(missing,[]);
  assert.ok(keys.size>100,`only ${keys.size} keys found; the scan may be broken`);
  for(const name of ['Movement_Demo','Elbow_Flexion_R','Knee_Flexion_R','Shoulder_Elevation_R'])assert.ok(`clip.${name}` in STRINGS);
  for(const layer of ['combined','muscles','bones'])assert.ok(`layer.${layer}` in STRINGS);
  for(const state of ['prepare','preparing','ready','retry'])assert.ok(`tracking.${state}` in STRINGS);
});
test('the page has an English button and a French button, and no leftover lesson-only switch',async()=>{
  const html=await read('../public/index.html');
  assert.match(html,/data-language="en"[^>]*>.*English/);
  assert.match(html,/data-language="fr"[^>]*>.*Français/);
  assert.doesNotMatch(html,/data-action="lang:/);
});
test('switching language changes translations, notifies listeners and ignores unknown languages',()=>{
  const seen=[];onLanguageChange(lang=>seen.push(lang));
  setLanguage('fr',{persist:false});
  assert.equal(getLanguage(),'fr');assert.equal(t('tab.explore'),'Explorer l’anatomie');assert.equal(t('metrics.visible',{n:50}),'50 % visible');
  assert.equal(setLanguage('de',{persist:false}),false);assert.equal(getLanguage(),'fr');
  setLanguage('en',{persist:false});assert.equal(t('tab.explore'),'Explore anatomy');
  assert.deepEqual(seen,['fr','en']);
  assert.equal(t('no.such.key'),'no.such.key','a missing key is visible rather than blank');
  assert.equal(format('{a} and {b}',{a:1}),'1 and {b}');
});
test('camera errors are translated in both languages',()=>{
  assert.equal(cameraErrorKey({name:'NotAllowedError'}),'camera.error.notAllowed');
  assert.equal(cameraErrorKey({name:'Weird'}),'camera.error.generic');
  setLanguage('fr',{persist:false});assert.match(cameraError({name:'NotFoundError'}),/Aucune caméra/);
  setLanguage('en',{persist:false});assert.match(cameraError({name:'NotFoundError'}),/No camera was found/);
});
test('the information bank has complete French entries and translated side labels',()=>{
  for(const [regex,entry] of KNOWLEDGE_RECORDS){
    for(const lang of LANGUAGES){assert.equal(entry[lang].length,4,`${regex}: ${lang} needs 4 fields`);for(const field of entry[lang])assert.ok(field.trim(),`${regex}: empty ${lang} field`);}
    assert.notDeepEqual(entry.fr,entry.en,`${regex}: French identical to English`);
  }
  const biceps={userData:{anatomy_name:'Long head of biceps brachii.r',anatomical_side:'R',tissue:'muscles',source_glb:'upper-limb.glb'}};
  assert.equal(displayName(biceps,'en'),'Long head of biceps brachii · Right');
  assert.equal(displayName(biceps,'fr'),'Long head of biceps brachii · droit');
  assert.equal(describe(biceps,'fr').group,'Biceps brachial');
  assert.equal(describe(biceps,'en').group,'Biceps brachii');
  const unknown={userData:{anatomy_name:'Something new.l',anatomical_side:'L',tissue:'bones',source_glb:'hand.glb'}};
  assert.equal(describe(unknown,'fr').region,'Main');assert.equal(describe(unknown,'fr').tissue,'Os');
  assert.equal(describe(unknown,'en').region,'Hand');
});
