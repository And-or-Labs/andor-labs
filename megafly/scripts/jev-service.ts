import {readFile} from 'node:fs/promises';
import {TypeSafeClient} from '@typesafe-ai/sdk';
import {simulateCircuit,decisionState,type Circuit} from '../src/neural.js';
import {questions,allocation} from '../src/jev.js';
import {fallbackTrace,type MegaFlyTrace} from '../src/trace.js';

export async function runJev(apiKey:string):Promise<MegaFlyTrace>{
  if(!apiKey.trim())throw new Error('TYPESAFE_API_KEY is not configured on the server.');
  const circuit:Circuit=JSON.parse(await readFile(new URL('../public/data/locomotor-circuit.json',import.meta.url),'utf8'));
  const frames=simulateCircuit(circuit);
  const request={model:'jev-latest',state:decisionState(circuit,frames[250]),questions:questions()};
  const started=performance.now();
  const client=new TypeSafeClient({apiKey});
  const result=await client.systemOne(request).withResponse();
  const response=result.data;
  const action=response.answers.action,destination=response.answers.destination;
  if(!Number.isFinite(action.confidence))throw new Error('Jev returned an invalid confidence.');
  return {model:response.model,generatedAt:new Date().toISOString(),request,response,latencyMs:Math.round(performance.now()-started),usage:response.usage,neuralModel:'megafly-lif-v1',transport:{status:result.response.status,requestId:result.response.headers.get('x-request-id')??result.response.headers.get('request-id')},decision:{action:action.choice,from:'display',to:destination.choice,percentage:allocation(action.choice,destination.choice),confidence:action.confidence},steps:fallbackTrace.steps};
}
