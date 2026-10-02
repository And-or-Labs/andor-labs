import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createFly} from './fly';
import {createWorkstation} from './workstation';
import {simulateCircuit,decisionState,type Circuit,type NeuralFrame} from './neural';
import {questions,allocation} from './jev';
import {fallbackTrace,type MegaFlyTrace} from './trace';
import './style.css';
const $=<T extends HTMLElement>(s:string)=>document.querySelector<T>(s)!;
let trace:MegaFlyTrace=fallbackTrace;
let hasDecision=false;let requesting=false;let decisionError="";let liveResponse=false;
const canvas=$<HTMLCanvasElement>('#scene');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
const scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(39,1,.1,80);camera.position.set(4.4,3.6,-4.6);
const controls=new OrbitControls(camera,canvas);controls.target.set(0,.45,.65);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=4;controls.maxDistance=12;controls.maxPolarAngle=Math.PI*.47;
scene.add(new THREE.HemisphereLight(0xffffff,0xb9bdc5,2.3));const sun=new THREE.DirectionalLight(0xffffff,2.7);sun.position.set(-3,7,-4);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-4;sun.shadow.camera.right=4;sun.shadow.camera.top=4;sun.shadow.camera.bottom=-4;sun.shadow.normalBias=.03;scene.add(sun);
const fly=createFly();scene.add(fly.group);const desk=createWorkstation();scene.add(desk.group);
const reduced=matchMedia('(prefers-reduced-motion: reduce)');let paused=reduced.matches,elapsed=0,previous=performance.now(),lastUI=-1,lastStage=-1;
let circuit:Circuit|null=null,frames:NeuralFrame[]=[],request:unknown=null;let loadError='';
const scrubber=$<HTMLInputElement>('#scrubber');
const blank:NeuralFrame={ms:0,voltage:new Float32Array(),rates:new Float32Array(),spikes:[],totalSpikes:0,active:0};
const frame=()=>frames[Math.min(600,Math.floor(elapsed*10))]??blank;
const isFixture=()=>trace.generatedAt==='replay-fixture';
const stage=()=>elapsed>=53?6:elapsed>=43?5:elapsed>=34?4:elapsed>=25?3:elapsed>=15?2:elapsed>=7?1:0;
const labels=['SENSE','ENCODE','MEMORY','JEV INPUT','JEV OUTPUT','EXECUTE','FEEDBACK'];
function decisionText(){const d=trace.decision;return d.action==='shift_budget'&&allocation(d.action,d.to)>0?`${d.percentage}% ${d.from} → ${d.to}`:d.action.replaceAll('_',' ');}
function budgets(){const b:Record<string,number>={display:4000,video:3500,native:2500};const d=trace.decision;if(hasDecision&&elapsed>=43&&d.action==='shift_budget'&&d.from in b&&d.to in b&&d.to!==d.from){const amount=b[d.from]*Math.max(0,Math.min(100,d.percentage))/100;b[d.from]-=amount;b[d.to]+=amount;}return b;}
function neuralDisplay(f:NeuralFrame){
 const c=$<HTMLCanvasElement>('#neuralCanvas'),ctx=c.getContext('2d')!;ctx.clearRect(0,0,c.width,c.height);
 if(!circuit)return;
 const located=circuit.neurons.map(n=>n.annotations.somaLocation);const projected=located.map(p=>p?[(p[0]-49000)/33000*c.width+c.width/2,(p[2]-14000)/118000*(c.height-35)+15]:null);
 ctx.strokeStyle='#1b4dff15';ctx.lineWidth=.7;
 // A bounded edge sample keeps measured topology readable; all edges participate in computation.
 circuit.edges.forEach(([a,b],i)=>{if(i%37)return;const p=projected[a],q=projected[b];if(!p||!q)return;ctx.beginPath();ctx.moveTo(p[0],p[1]);ctx.lineTo(q[0],q[1]);ctx.stroke();});
 projected.forEach((p,i)=>{if(!p)return;const active=f.rates[i]>1;ctx.fillStyle=active?'#1b4dff':'#b9bdc5';ctx.beginPath();ctx.arc(p[0],p[1],active?2.8:1.5,0,Math.PI*2);ctx.fill();});
 const state=$<HTMLCanvasElement>('#stateCanvas'),sc=state.getContext('2d')!;sc.clearRect(0,0,state.width,state.height);
 f.voltage.forEach((v,i)=>{const alpha=Math.max(.06,Math.min(1,v));sc.fillStyle=`rgba(27,77,255,${alpha})`;sc.fillRect((i%95)*6.5,Math.floor(i/95)*10,5,8);});
 const rows:string[]=[];const fi=Math.min(600,Math.floor(elapsed*10));for(let j=fi;j>=Math.max(0,fi-20)&&rows.length<6;j--)for(const i of frames[j]?.spikes??[]){if(rows.length===6)break;rows.push(`${String(frames[j].ms).padStart(5,'0')}ms  ${circuit.neurons[i].id.padEnd(7)} ${circuit.neurons[i].type.slice(0,12)}`);}
 $('#spikeStream').textContent=rows.length?rows.join('\n'):'No spikes in the last 400 ms.';
}
function updateUI(){const s=stage(),f=frame(),d=trace.decision;$('#simClock').textContent=`${f.ms.toLocaleString()} MS`;$('#sceneClock').textContent=`00:${String(Math.floor(elapsed)).padStart(2,'0')}`;$('#spikeCount').textContent=f.totalSpikes.toLocaleString();$('#activeCount').textContent=String(f.active);$('#phase').textContent=labels[s];scrubber.value=String(elapsed);
 const narratives=['Market inputs enter an engineered stimulus adapter.','Spikes propagate across measured MaleCNS connections.','Computed population rates become a compact memory summary.','Market state + neural summary + four questions are ready for Jev.',hasDecision?`Jev ${liveResponse?'response':'recording'}: ${decisionText()}.`:'No Jev response yet. Request a real decision.',hasDecision?'Code applies the allocation policy. Total budget stays $10,000.':'Execution blocked: no real Jev response.','Execution is logged. No reward is claimed without an observed outcome.'];$('#narrative').textContent=narratives[s];$('#behavior').textContent=s>=4&&hasDecision?'Decision received. Still typing.':'Four hands on deck.';$('#deskTask').textContent=s>=4&&!hasDecision?'WAITING FOR A REAL JEV RESPONSE':['ENCODING MARKET INPUT','PROPAGATING NEURAL SIGNALS','PACKING MEMORY STATE','JEV / REQUEST PREPARED','JEV / TYPED ANSWER RECEIVED','PAPER ALLOCATION APPLIED','EXECUTION LOG UPDATED'][s];
 const b=budgets();for(const name of ['display','video','native'])$('#'+name+'Budget').textContent=`$${b[name].toLocaleString('en-US',{maximumFractionDigits:0})}`;
 $('#budgetNote').textContent=s>=5&&hasDecision?'Code policy applied · $10,000 conserved.':'Scenario inputs. No orders sent.';
 if(s!==lastStage){lastStage=s;
  $('#responseStatus').textContent=requesting?'CALLING JEV':!hasDecision?'NOT CONNECTED':s<4?'READY':liveResponse?'LIVE RESPONSE':'RECORDED';
  $('#responseStream').textContent=!hasDecision?(decisionError||'No Jev response. Click “Call Jev” to send the displayed input through the server.') : s<4?'Waiting for the decision step.\n\nJev returns one batch of typed answers.':JSON.stringify(trace.response??{provenance:isFixture()?'demo fixture; not an API response':'legacy recording; raw response unavailable',model:trace.model,decision:d},null,2);
  $('#receiptLabel').textContent=!hasDecision?'NO API RESPONSE / NO TRADE':s<4?'READY WHEN THE FLY IS.':liveResponse?'LIVE JEV API RESPONSE':'RECORDED JEV DECISION';$('#receiptAction').textContent=!hasDecision?'Awaiting Jev.':s<4?'Context first. Decision next.':decisionText();$('#receiptMeta').textContent=!hasDecision?'No fixture is substituted for a real decision.':s<4?'A single structured request to Jev.':`Action confidence ${d.confidence.toFixed(2)} / allocation calculated in code`;
  $('#latency').textContent=trace.latencyMs!==undefined?`CALL DURATION / ${trace.latencyMs} MS`:'LATENCY / NOT MEASURED';$('#usage').textContent=trace.usage?`TOKENS / ${trace.usage.input_tokens} IN · ${trace.usage.output_tokens} OUT`:'TOKENS / NOT RECORDED';
 }
 const times=[0,15,25,34,43];document.querySelectorAll<HTMLButtonElement>('[data-time]').forEach((button,i)=>button.setAttribute('aria-current',elapsed>=times[i]&&(i===4||elapsed<times[i+1])?'step':'false'));
 const logs=[`00:00  market.load     display=2.40 / video=8.70 / native=4.10 CPM`,`00:07  neural.compute  ${circuit?.neurons.length??0} cells / ${circuit?.edges.length??0} directed connections`,`00:15  memory.read     population-rate state available`,`00:25  jev.request     state + 4 typed questions / ${hasDecision?'submitted payload':'preview only'}`,`00:34  jev.response    ${hasDecision?decisionText():'NOT RECEIVED / execution blocked'}`,`00:43  market.apply    display=${b.display} video=${b.video} native=${b.native}`,`00:53  outcome.log     reward=null / no measured return`];$('#eventStream').textContent=logs.slice(0,s+1).slice(-3).join('\n');neuralDisplay(f);
}
function syncPause(){$('#playPause').textContent=paused?'▶':'Ⅱ';$('#playPause').setAttribute('aria-label',paused?'Play replay':'Pause replay');}
function seek(t:number){elapsed=t;previous=performance.now();updateUI();}
function resize(){const r=canvas.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.fov=r.width<420?48:39;camera.updateProjectionMatrix();}window.addEventListener('resize',resize);resize();
function animate(now:number){requestAnimationFrame(animate);const dt=Math.max(0,Math.min((now-previous)/1000,.1));previous=now;if(!paused&&!document.hidden&&frames.length)elapsed=(elapsed+dt)%60;fly.update(reduced.matches?0:elapsed,false,true);desk.update(reduced.matches?0:elapsed,frame().totalSpikes,elapsed>=34&&hasDecision?trace.decision.action:'pending');controls.update();if(now-lastUI>100){updateUI();lastUI=now;}renderer.render(scene,camera);}requestAnimationFrame(animate);
$('#playPause').addEventListener('click',()=>{paused=!paused;syncPause();});$('#restart').addEventListener('click',()=>{seek(0);paused=reduced.matches;syncPause();});$('#decision').addEventListener('click',async()=>{
 if(requesting)return;requesting=true;decisionError='Calling Jev. Awaiting the actual API response…';hasDecision=false;lastStage=-1;paused=true;syncPause();seek(25);const button=$<HTMLButtonElement>('#decision');button.disabled=true;button.textContent='Calling Jev…';$('#jevSource').textContent='JEV: REQUEST IN FLIGHT';
 try{const response=await fetch('/api/jev/decision',{method:'POST',headers:{'Content-Type':'application/json'}});const text=await response.text();let data;try{data=JSON.parse(text);}catch{throw Error('Jev server endpoint is unavailable. The live call needs the Jev function on the server.');}if(!response.ok)throw Error(data.error||`Request failed: HTTP ${response.status}`);if(!data.response||data.transport?.status!==200)throw Error('Server did not provide a verified Jev response.');trace=data;request=trace.request;hasDecision=true;liveResponse=true;decisionError='';$('#requestStream').textContent=JSON.stringify(request,null,2);$('#jevSource').textContent='JEV: LIVE API RESPONSE';seek(34);paused=reduced.matches;syncPause();toast(`Jev responded / HTTP ${trace.transport?.status} / ${trace.latencyMs} ms`);}
 catch(error){decisionError=error instanceof Error?error.message:'Jev request failed.';$('#jevSource').textContent='JEV: NOT CONNECTED';toast(decisionError);}
 finally{requesting=false;lastStage=-1;button.disabled=false;button.textContent='Call Jev ↗';updateUI();}
});scrubber.addEventListener('input',()=>seek(Number(scrubber.value)));document.querySelectorAll<HTMLButtonElement>('[data-time]').forEach(b=>b.addEventListener('click',()=>seek(Number(b.dataset.time))));reduced.addEventListener('change',()=>{if(reduced.matches){paused=true;syncPause();}});
let toastTimer:ReturnType<typeof setTimeout>;function toast(message:string){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3000);}
$('#copyRequest').addEventListener('click',async()=>{try{if(!request){toast('The circuit is still loading.');return;}await navigator.clipboard.writeText(JSON.stringify(request,null,2));toast('Exact displayed request copied.');}catch{toast('Select the request text to copy it.');}});
$('#share').addEventListener('click',async()=>{const url=new URL(location.href);url.searchParams.set('t',Math.floor(elapsed).toString());try{if(navigator.share)await navigator.share({title:'MegaFly / Jev × Fly connectome',text:'A very busy fly. By and/or labs.',url:url.href});else{await navigator.clipboard.writeText(url.href);toast('Link copied.');}}catch(e){if(!(e instanceof DOMException&&e.name==='AbortError'))toast('Copy the page address to share.');}});
$('#saveMoment').addEventListener('click',()=>{renderer.render(scene,camera);const card=document.createElement('canvas');card.width=1200;card.height=1200;const ctx=card.getContext('2d')!;ctx.fillStyle='#ffffff';ctx.fillRect(0,0,1200,1200);ctx.fillStyle='#1b4dff';ctx.font='28px "Departure Mono"';ctx.fillText('JEV × FLY CONNECTOME',64,100);ctx.fillStyle='#14151a';ctx.font='88px "Instrument Serif"';ctx.fillText('Small fly. Serious business.',64,210);const scale=Math.min(1200/canvas.width,690/canvas.height);ctx.drawImage(canvas,(1200-canvas.width*scale)/2,265,canvas.width*scale,canvas.height*scale);ctx.font='23px "Departure Mono"';ctx.fillStyle='#1b4dff';ctx.fillText(elapsed>=34&&hasDecision?decisionText():'1,045 neurons. Four hands on deck.',64,1020);ctx.font='17px "Departure Mono"';ctx.fillStyle='#6d717b';ctx.fillText(`${hasDecision?(liveResponse?'JEV RESPONSE':'JEV RECORDING'):'JEV NOT CONNECTED'} / MODELED ACTIVITY / SIMULATED MARKET`,64,1080);ctx.fillStyle='#14151a';ctx.fillText('by and/or labs',64,1140);card.toBlob(blob=>{if(!blob){toast('Snapshot unavailable.');return;}const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='megafly-and-or-labs.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Snapshot saved.');});});
const requested=Number(new URLSearchParams(location.search).get('t'));if(Number.isFinite(requested))elapsed=Math.max(0,Math.min(59.9,requested));syncPause();updateUI();
async function boot(){const results=await Promise.allSettled([fetch(`${import.meta.env.BASE_URL}data/locomotor-circuit.json`).then(r=>{if(!r.ok)throw Error('Circuit unavailable');return r.json();}),fetch(`${import.meta.env.BASE_URL}jev-trace.json`).then(r=>r.ok&&r.headers.get('content-type')?.includes('json')?r.json():null)]);
 if(results[0].status==='fulfilled'){circuit=results[0].value as Circuit;frames=simulateCircuit(circuit);$('#neuronCount').textContent=circuit.neurons.length.toLocaleString();$('#connectionCount').textContent=circuit.edges.length.toLocaleString();$('#neuralStatus').textContent='NEURAL: COMPUTED LOCALLY';request={model:'jev-latest',state:decisionState(circuit,frames[250]),questions:questions()};}
 else{loadError='Circuit failed to load. Reload to retry.';$('#neuralStatus').textContent='NEURAL: UNAVAILABLE';$('#spikeStream').textContent=loadError;}
 if(results[1].status==='fulfilled'){const loaded=results[1].value;if(loaded?.transport?.status===200&&loaded.response&&loaded.request&&loaded?.steps?.length===7&&loaded.decision&&Number.isFinite(loaded.decision.percentage)&&Number.isFinite(loaded.decision.confidence)){trace=loaded;hasDecision=true;request=trace.request??request;$('#jevSource').textContent=isFixture()?'JEV: DEMO FIXTURE':'JEV: RECORDED RESPONSE';}}
 $('#requestStream').textContent=request?JSON.stringify(request,null,2):'Request unavailable without neural context.';lastStage=-1;previous=performance.now();updateUI();}
void boot();

const provenanceDialog=$<HTMLDialogElement>('#provenanceDialog');
$('#about').addEventListener('click',()=>provenanceDialog.showModal());
$('#closeAbout').addEventListener('click',()=>provenanceDialog.close());
const panelTabs=Array.from(document.querySelectorAll<HTMLButtonElement>('[data-panel]'));
function selectPanel(button:HTMLButtonElement){$('.workbench').dataset.active=button.dataset.panel;panelTabs.forEach(tab=>{const selected=tab===button;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;});requestAnimationFrame(resize);}
panelTabs.forEach((button,i)=>{button.tabIndex=i===0?0:-1;button.addEventListener('click',()=>selectPanel(button));button.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const index=e.key==='Home'?0:e.key==='End'?panelTabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+panelTabs.length)%panelTabs.length;selectPanel(panelTabs[index]);panelTabs[index].focus();});});
new ResizeObserver(()=>{if(canvas.clientWidth>0&&canvas.clientHeight>0)resize();}).observe(canvas);
