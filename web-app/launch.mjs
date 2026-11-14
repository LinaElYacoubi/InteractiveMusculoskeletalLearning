import {spawn,execFile} from 'node:child_process';
import {mkdir,open,readFile,writeFile,unlink} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
const directory=fileURLToPath(new URL('./',import.meta.url)),port=Number(process.env.MSK_PORT||4185);
const address=`http://127.0.0.1:${port}/`,lock=new URL('./.logs/server.json',import.meta.url);
async function health(){try{const response=await fetch(address+'health',{signal:AbortSignal.timeout(700)});if(!response.ok)return null;return await response.json();}catch{return null;}}
async function show(){
  console.log(`Movement Atlas is ready: ${address}`);
  if(!process.argv.includes('--no-open'))execFile('cmd.exe',['/d','/c','start','',address],{windowsHide:true},error=>{if(error)console.log('Open this address in your browser: '+address);});
}
try{
  const running=await health();
  if(process.argv.includes('--stop')){
    let saved;try{saved=JSON.parse(await readFile(lock,'utf8'));}catch{}
    if(running?.app==='innova-movement-atlas'&&saved?.pid===running.pid&&saved?.instance===running.instance){process.kill(saved.pid);await unlink(lock);console.log('Movement Atlas server stopped.');}
    else console.log('No matching launcher-owned Movement Atlas server is running.');
  }else if(running?.app==='innova-movement-atlas')await show();
  else{
    await mkdir(new URL('./.logs/',import.meta.url),{recursive:true});
    const logfile=await open(new URL('./.logs/server.log',import.meta.url),'a'),instance=randomUUID();
    const child=spawn(process.execPath,[fileURLToPath(new URL('./server.mjs',import.meta.url))],{cwd:directory,detached:true,windowsHide:true,stdio:['ignore',logfile.fd,logfile.fd],env:{...process.env,MSK_PORT:String(port),MSK_INSTANCE:instance}});
    const spawned=new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});await spawned;child.unref();await logfile.close();
    let ready;
    for(let attempt=0;attempt<30;attempt++){ready=await health();if(ready?.instance===instance)break;await new Promise(resolve=>setTimeout(resolve,150));}
    if(ready?.instance!==instance)throw new Error(`The app could not start on port ${port}. See web-app/.logs/server.log.`);
    await writeFile(lock,JSON.stringify({pid:child.pid,port,instance},null,2));await show();
  }
}catch(error){console.error(error.message);process.exitCode=1;}
