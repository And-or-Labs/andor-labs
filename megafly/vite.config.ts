import {defineConfig,loadEnv,type Plugin} from 'vite';
import {runJev} from './scripts/jev-service';

function jevAPI():Plugin{
  let busy=false;
  const install=(server:{middlewares:{use:Function}})=>{server.middlewares.use('/api/jev/decision',async(req:any,res:any)=>{
    res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
    const send=(status:number,body:unknown)=>{res.statusCode=status;res.end(JSON.stringify(body));};
    if(req.method!=='POST'){send(405,{error:'Use POST to request a decision.'});return;}
    const origin=req.headers.origin;
    if(origin&&new URL(origin).host!==req.headers.host){send(403,{error:'Cross-origin requests are not allowed.'});return;}
    if(busy){send(409,{error:'A Jev request is already running.'});return;}
    const env=loadEnv('development',process.cwd(),'');
    const key=process.env.TYPESAFE_API_KEY||env.TYPESAFE_API_KEY;
    if(!key){send(503,{error:'Jev is not connected. Set TYPESAFE_API_KEY in the server .env file. No request was sent.'});return;}
    busy=true;
    try{send(200,await runJev(key));}
    catch(error){const status=(error as {status?:number}).status;send(502,{error:status?`Jev returned HTTP ${status}. No decision was applied.`:'Jev request failed. No decision was applied.'});}
    finally{busy=false;}
  });
  };
  return {name:'megafly-jev-api',configureServer:install,configurePreviewServer:install};
}
export default defineConfig({plugins:[jevAPI()]});
