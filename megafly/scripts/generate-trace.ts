import {writeFile} from 'node:fs/promises';
import {loadEnvFile} from 'node:process';
import {runJev} from './jev-service.js';
try{loadEnvFile();}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
const trace=await runJev(process.env.TYPESAFE_API_KEY??'');
await writeFile(new URL('../public/jev-trace.json',import.meta.url),JSON.stringify(trace,null,2));
console.log(JSON.stringify({saved:'public/jev-trace.json',model:trace.model,httpStatus:trace.transport?.status,requestId:trace.transport?.requestId,latencyMs:trace.latencyMs,usage:trace.usage,decision:trace.decision},null,2));
