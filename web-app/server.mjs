import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, realpath } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('./public/', import.meta.url));
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.json':'application/json', '.glb':'model/gltf-binary', '.wasm':'application/wasm', '.task':'application/octet-stream', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.txt':'text/plain; charset=utf-8' };

export function createAppServer() {
  return createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options','nosniff');
    response.setHeader('Referrer-Policy','no-referrer');
    response.setHeader('Permissions-Policy','camera=(self), microphone=()');
    response.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' blob:; worker-src 'self' blob:; media-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'");
    try {
      if (!['GET','HEAD'].includes(request.method)) { response.writeHead(405,{Allow:'GET, HEAD'});response.end();return; }
      const pathname = decodeURIComponent(new URL(request.url,'http://localhost').pathname);
      if(pathname==='/health'){
        response.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
        response.end(request.method==='HEAD'?'':JSON.stringify({app:'innova-movement-atlas',version:'0.1.0',pid:process.pid,instance:process.env.MSK_INSTANCE||null}));return;
      }
      if (pathname.includes('\0') || pathname.includes('\\')) throw new Error('Invalid path');
      const path = resolve(root,'.'+(pathname === '/' ? '/index.html' : pathname));
      if (!path.startsWith(resolve(root)+sep)) throw new Error('Invalid path');
      const actual = await realpath(path);
      if (!actual.startsWith(resolve(root)+sep)) throw new Error('Invalid path');
      const info = await stat(actual);
      if (!info.isFile()) throw new Error('Not found');
      const headers = { 'Content-Type': types[extname(actual)] || 'application/octet-stream', 'Cache-Control': /\.(html|css|js|mjs|json)$/.test(actual) ? 'no-cache' : 'public, max-age=86400', 'Accept-Ranges':'bytes' };
      let start=0,end=info.size-1,status=200;
      if (request.headers.range) {
        const match=/^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
        if (!match || (!match[1]&&!match[2])) {response.writeHead(416,{'Content-Range':`bytes */${info.size}`});response.end();return;}
        if (!match[1]) start=Math.max(0,info.size-Number(match[2]));
        else {start=Number(match[1]);if(match[2])end=Math.min(Number(match[2]),end);}
        if(start>end || start>=info.size){response.writeHead(416,{'Content-Range':`bytes */${info.size}`});response.end();return;}
        status=206;headers['Content-Range']=`bytes ${start}-${end}/${info.size}`;
      }
      headers['Content-Length']=end-start+1;response.writeHead(status,headers);
      if(request.method==='HEAD'){response.end();return;}
      const stream=createReadStream(actual,{start,end});stream.on('error',()=>response.destroy());stream.pipe(response);
    } catch {response.writeHead(404,{'Content-Type':'text/plain'});response.end('Not found');}
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server=createAppServer();const port=Number(process.env.MSK_PORT || 4185);
  server.on('error',error=>{console.error(`Cannot start Movement Atlas: ${error.message}`);process.exitCode=1;});
  server.listen(port,'127.0.0.1',()=>console.log(`INNOVA Movement Atlas: http://127.0.0.1:${server.address().port}/`));
}
