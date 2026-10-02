export type TraceStep = {
  id: string;
  kicker: string;
  phase: string;
  title: string;
  body: string;
  at: number;
  card: Record<string, string>;
  neural: number;
};

export type MegaFlyTrace = {
  model: string;
  generatedAt: string;
  transport?: { status: number; requestId: string | null };
  request?: unknown;
  response?: unknown;
  latencyMs?: number;
  neuralModel?: string;
  usage?: { input_tokens: number; output_tokens: number };
  decision: { action: string; from: string; to: string; percentage: number; confidence: number };
  steps: TraceStep[];
};

export const fallbackTrace: MegaFlyTrace = {
  model: 'jev-latest',
  generatedAt: 'replay-fixture',
  
  decision: { action: 'shift_budget', from: 'display', to: 'video', percentage: 12, confidence: 0.78 },
  steps: [
    { id: 'input', kicker: '01 / SENSORY INPUT', phase: 'SENSORY INPUT', title: 'A market enters the fly’s world.', body: 'Media opportunities become signals: cost, attention, conversion quality, fatigue, and uncertainty.', at: 0, neural: 0.18, card: { 'DISPLAY CPM': '$2.40', 'VIDEO CPM': '$8.70', 'NATIVE CPM': '$4.10', 'BUDGET LEFT': '$10,000' } },
    { id: 'encode', kicker: '02 / CONNECTOME ENCODING', phase: 'CONNECTOME ENCODING', title: 'The fly encodes the environment.', body: 'Market features route through a connectome-inspired graph as competing neural populations light up.', at: 7, neural: 0.42, card: { 'VISUAL SIGNAL': 'ACTIVE', 'REWARD SIGNAL': 'LOW', 'NOVELTY DRIVE': '0.41', 'FATIGUE SIGNAL': 'RISING' } },
    { id: 'memory', kicker: '03 / NEURAL MEMORY', phase: 'NEURAL MEMORY', title: 'Memory retrieves a prior pattern.', body: 'Recent outcomes are held as activation over the graph. Good patterns brighten; weak ones decay.', at: 15, neural: 0.62, card: { 'RETRIEVED PATTERN': 'DISPLAY FATIGUE', 'MATCH STRENGTH': '0.74', 'REWARD TRACE': '+0.18', 'STATE': 'EXPLORING' } },
    { id: 'context', kicker: '04 / JEV CONTEXT', phase: 'JEV CONTEXT', title: 'The decision context is packed.', body: 'The fly sends Jev the market state, internal state, and connectome-derived memory summary.', at: 25, neural: 0.7, card: { 'QUESTIONS': '4 IN PARALLEL', 'STATE': 'STRUCTURED JSON', 'MODEL': 'JEV-LATEST', 'PARSING': 'NONE' } },
    { id: 'decision', kicker: '05 / SYSTEM-ONE DECISION', phase: 'JEV DECISION', title: 'Jev makes the call.', body: 'A typed choice, probabilities, and confidence come back. No generated prose. No parsing.', at: 34, neural: 0.92, card: { 'ACTION': 'SHIFT BUDGET', 'FROM': 'DISPLAY', 'TO': 'VIDEO', 'CONFIDENCE': '0.78' } },
    { id: 'execute', kicker: '06 / ACTION EXECUTION', phase: 'ACTION EXECUTION', title: 'The fly trades.', body: 'The simulated market applies the decision. MegaFly turns toward the stronger signal.', at: 43, neural: 0.78, card: { 'DISPLAY BUDGET': '-12%', 'VIDEO BUDGET': '+12%', 'EXPECTED VALUE': '+18.4%', 'RISK': 'PAPER ONLY' } },
    { id: 'reward', kicker: '07 / REWARD + MEMORY UPDATE', phase: 'MEMORY UPDATE', title: 'Reward updates the memory.', body: 'The simulated outcome pulses backward through the graph. The replay is ready to run again.', at: 53, neural: 0.48, card: { 'REWARD': '+0.72', 'PREDICTION ERROR': '-0.08', 'MEMORY TRACE': 'UPDATED', 'NEXT LOOP': 'READY' } },
  ],
};
