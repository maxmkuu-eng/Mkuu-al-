import { geminiService } from './geminiService.js';
import { universalAgent, AgentResult } from './agentEngine.js';

export interface AutonomousRequest {
  userId: string;
  message: string;
  conversationHistory?: any[];
  attachments?: any[];
  isVoice?: boolean;
  people?: any[];
  maxSteps?: number;
}

export interface AutonomousResult {
  success: boolean;
  goal: string;
  plan: string[];
  completedSteps: string[];
  result: AgentResult;
  verification: string;
  autonomous: true;
  latencyMs: number;
}

function buildPlan(message: string, attachments: any[] = []): string[] {
  const { intent } = universalAgent.plan(message, attachments);
  if (intent === 'image') return ['Elewa mabadiliko yanayotakiwa', 'Tekeleza uhariri wa picha', 'Kagua kama picha iliyotolewa ipo na ina output'];
  if (intent === 'document') return ['Elewa aina na lengo la document', 'Tengeneza maudhui yanayohitajika', 'Kagua kuwa document imezalishwa'];
  if (intent === 'spreadsheet') return ['Elewa data na lengo', 'Panga muundo wa spreadsheet', 'Kagua kuwa faili limezalishwa'];
  if (intent === 'analysis') return ['Elewa lengo la uchambuzi', 'Kusanya na kuchanganua taarifa zinazohitajika', 'Toa hitimisho na hatua inayofuata'];
  return ['Elewa lengo la mtumiaji', 'Changanua context na taarifa muhimu', 'Tekeleza jibu/hatua inayohitajika', 'Kagua jibu kabla ya kumaliza'];
}

export async function executeAutonomous(request: AutonomousRequest): Promise<AutonomousResult> {
  const started = Date.now();
  const plan = buildPlan(request.message, request.attachments || []);
  const maxSteps = Math.max(1, Math.min(Number(request.maxSteps) || plan.length, 4));
  const completedSteps: string[] = [];
  let result: AgentResult | null = null;

  // Bounded autonomy: the agent may plan and execute several steps, but never
  // performs destructive/external side effects without an explicit tool action.
  for (let i = 0; i < maxSteps; i++) {
    const step = plan[i];
    const instruction = i === maxSteps - 1
      ? `${step}. Lengo kuu: ${request.message}. Toa matokeo ya mwisho, si mpango wa hatua nyingine.`
      : `${step}. Lengo kuu: ${request.message}. Fanya hatua hii kwa kutumia uwezo uliopo, kisha toa matokeo mafupi.`;
    result = await universalAgent.execute({
      userId: request.userId,
      message: instruction,
      conversationHistory: request.conversationHistory || [],
      attachments: request.attachments || [],
      isVoice: request.isVoice,
      people: request.people,
    });
    completedSteps.push(step);
    // Image/document generation is already an atomic tool action; don't repeat it.
    if (result.intent === 'image' || result.generatedFiles.length > 0) break;
  }

  if (!result) throw new Error('Autonomous execution haikupata matokeo.');

  const verificationPrompt = `Kagua kwa ufupi kama lengo hili limefikiwa kulingana na matokeo haya. Usitengeneze kazi mpya.\nLENGO: ${request.message}\nMATOKEO: ${result.reply}\nJibu kwa sentensi moja ya status.`;
  const verification = (await geminiService.processChat({
    userId: request.userId,
    message: verificationPrompt,
    conversationHistory: request.conversationHistory || [],
    attachments: [],
    isVoice: false,
  })).reply;

  return {
    success: true,
    goal: request.message,
    plan,
    completedSteps,
    result,
    verification,
    autonomous: true,
    latencyMs: Date.now() - started,
  };
}
