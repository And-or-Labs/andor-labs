import {choice,noul,score} from '@typesafe-ai/sdk';
export function questions(){return {
  action:choice('Which single media action should MegaFly take next?',{hold:null,shift_budget:null,explore_new_channel:null}),
  destination:choice('Which channel should receive additional budget if shifting budget?',{display:null,video:null,native:null,none:null}),
  confidence:score('How clear is the best action for this market state?',['uncertain','tentative','clear','very clear']),
  fatigue_present:noul('Is display inventory showing meaningful fatigue in the current state?'),
};}
export function allocation(action:string,destination:string){return action==='shift_budget'?(destination==='video'?12:destination==='native'?8:0):0;}
