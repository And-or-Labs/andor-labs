/** Measured wiring; deliberately simple, uncalibrated physiology and stimulus mapping. */
export interface Circuit {
  neurons: { id:string; type:string; role:string; side:string; annotations:{somaLocation:number[]|null} }[];
  edges:[number,number,number][];
  rawSynapseCounts:number[];
  summary:{neurons:number;edges:number;contacts:number};
}
export interface NeuralFrame { ms:number; voltage:Float32Array; rates:Float32Array; spikes:number[]; totalSpikes:number; active:number; }
export const NEURAL_MODEL = { dt_ms:1, tau_ms:20, threshold:1, reset:0, refractory_ms:3, current_decay:0.82, weight_gain:0.006, wall_to_sim_ratio:0.2, seed:17 } as const;
export const MARKET = {
  campaign:{objective:'maximize qualified conversions',remaining_budget_usd:10000,hours_remaining:8},
  channels:{display:{cpm:2.4,ctr:0.008,conversion_rate:0.012,fatigue:'rising'},video:{cpm:8.7,ctr:0.021,conversion_rate:0.034,fatigue:'low'},native:{cpm:4.1,ctr:0.013,conversion_rate:0.025,fatigue:'stable'}},
};
export function simulateCircuit(circuit:Circuit):NeuralFrame[] {
  const n=circuit.neurons.length,voltage=new Float32Array(n),current=new Float32Array(n),rates=new Float32Array(n),refractory=new Uint8Array(n);
  const outgoing:{to:number;weight:number}[][]=Array.from({length:n},()=>[]);
  circuit.edges.forEach(([from,to,weight])=>outgoing[from].push({to,weight:weight*NEURAL_MODEL.weight_gain}));
  let seed:number=NEURAL_MODEL.seed,totalSpikes=0;const frames:NeuralFrame[]=[];let windowSpikes:number[]=[];
  const random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
  frames.push({ms:0,voltage:voltage.slice(),rates:rates.slice(),spikes:[],totalSpikes:0,active:0});
  for(let ms=1;ms<=12000;ms++){
    const fired:number[]=[];
    for(let i=0;i<n;i++){
      current[i]*=NEURAL_MODEL.current_decay;rates[i]*=Math.exp(-1/200);
      if(refractory[i]>0){refractory[i]--;continue;}
      const role=circuit.neurons[i].role;
      // An engineered input adapter, not a biological claim about advertising perception.
      const channel=i%3;const drive=[.72,.9,.5][channel];
      const envelope=.7+.3*Math.sin(ms*.003+channel);
      const input=role==='sensory'?drive*envelope:role==='descending'?.6:0;
      const noise=random()<.012?.45:0;
      voltage[i]+=(-voltage[i]+input+noise+Math.max(-3,Math.min(4,current[i])))/NEURAL_MODEL.tau_ms;
      if(voltage[i]>=NEURAL_MODEL.threshold){voltage[i]=NEURAL_MODEL.reset;refractory[i]=NEURAL_MODEL.refractory_ms;fired.push(i);rates[i]+=5;}
    }
    // Discrete one-tick propagation makes traversal order irrelevant.
    for(const i of fired)for(const edge of outgoing[i])current[edge.to]+=edge.weight;
    // The fixed pulse train is the declared source of externally elicited activity.
    if(ms%23===0){for(let i=0;i<n;i++)if(circuit.neurons[i].role==='sensory'&&random()<.22)current[i]+=2.5;}
    windowSpikes.push(...fired);totalSpikes+=fired.length;
    if(ms%20===0){frames.push({ms,voltage:voltage.slice(),rates:rates.slice(),spikes:windowSpikes,totalSpikes,active:rates.reduce((count,r)=>count+(r>1?1:0),0)});windowSpikes=[];}
  }
  return frames;
}
export function memorySummary(circuit:Circuit,frame:NeuralFrame){
  const roles:Record<string,{neurons:number;mean_rate_hz:number}>={};
  circuit.neurons.forEach((neuron,i)=>{const entry=roles[neuron.role]??={neurons:0,mean_rate_hz:0};entry.neurons++;entry.mean_rate_hz+=frame.rates[i];});
  Object.values(roles).forEach(r=>r.mean_rate_hz=Number((r.mean_rate_hz/r.neurons).toFixed(3)));
  return {dataset:'MaleCNS v1.0 locomotor subgraph',neurons:circuit.neurons.length,connections:circuit.edges.length,simulated_ms:frame.ms,total_spikes:frame.totalSpikes,active_neurons:frame.active,populations:roles,model:NEURAL_MODEL,interpretation:'Engineered market stimulus; uncalibrated LIF simulation. Activity is not evidence of biological trading ability.'};
}
export function decisionState(circuit:Circuit,frame:NeuralFrame){return {...MARKET,fly:{memory:'Display fatigue is rising in the supplied market scenario.',neural_summary:memorySummary(circuit,frame)}};}
