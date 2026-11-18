import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {once} from 'node:events';
import {createAppServer} from '../server.mjs';

test('Netlify publishes the app folder and sends the same security headers as the local server',async()=>{
  const toml=await readFile(new URL('../../netlify.toml',import.meta.url),'utf8');
  const publish=/publish\s*=\s*"([^"]+)"/.exec(toml)?.[1];
  assert.equal(publish,'web-app/public');
  await access(new URL(`../../${publish}/index.html`,import.meta.url));
  const server=createAppServer();server.listen(0,'127.0.0.1');await once(server,'listening');
  try{
    const response=await fetch(`http://127.0.0.1:${server.address().port}/`);
    for(const header of ['Content-Security-Policy','Permissions-Policy','Referrer-Policy','X-Content-Type-Options']){
      const value=new RegExp(`${header}\\s*=\\s*"([^"]+)"`).exec(toml)?.[1];
      assert.equal(value,response.headers.get(header),`${header} differs between netlify.toml and server.mjs`);
    }
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
