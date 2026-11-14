import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {readFile} from 'node:fs/promises';
import {createAppServer} from '../server.mjs';

test('local server serves offline modules, byte ranges and required security boundaries',async()=>{
  const server=createAppServer();server.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}`;
  try{
    const page=await fetch(base);assert.equal(page.status,200);assert.match(await page.text(),/Movement Atlas/);
    assert.match(page.headers.get('permissions-policy'),/microphone=\(\)/);
    const module=await fetch(base+'/src/app.js');assert.match(module.headers.get('content-type'),/javascript/);
    const model=await fetch(base+'/assets/INNOVA-Musculoskeletal-Rig.glb',{headers:{Range:'bytes=0-11'}});
    assert.equal(model.status,206);const bytes=Buffer.from(await model.arrayBuffer());assert.equal(bytes.length,12);assert.equal(bytes.toString('ascii',0,4),'glTF');
    const invalid=await fetch(base+'/assets/INNOVA-Musculoskeletal-Rig.glb',{headers:{Range:'bytes=999999999-'}});assert.equal(invalid.status,416);
    assert.equal((await fetch(base+'/%2e%2e%5cserver.mjs')).status,404);
    assert.equal((await fetch(base+'/server.mjs')).status,404);
    assert.equal((await fetch(base,{method:'POST'})).status,405);
    const wasm=await fetch(base+'/vendor/mediapipe/wasm/vision_wasm_internal.wasm',{method:'HEAD'});assert.equal(wasm.status,200);assert.equal(wasm.headers.get('content-type'),'application/wasm');
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
test('anatomical asset supplies skin weights, metadata and all four clips expected by the app',async()=>{
  const file=await readFile(new URL('../public/assets/INNOVA-Musculoskeletal-Rig.glb',import.meta.url));
  const data=JSON.parse(file.toString('utf8',20,20+file.readUInt32LE(12)));
  assert.equal(data.skins[0].joints.length,79);assert.equal(data.meshes.length,487);
  assert.deepEqual(data.animations.map(a=>a.name).sort(),['Elbow_Flexion_R','Knee_Flexion_R','Movement_Demo','Shoulder_Elevation_R']);
  assert.ok(data.nodes.some(n=>n.name==='forearm.R'));
  for(const mesh of data.meshes)for(const primitive of mesh.primitives){assert.ok('JOINTS_0' in primitive.attributes);assert.ok('WEIGHTS_0' in primitive.attributes);}
  assert.equal(data.nodes.filter(n=>n.extras?.tissue==='muscles').length,254);
});
