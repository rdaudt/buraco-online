import {action,isWild,meldOptions,sequence,teamOf,value,type Card,type Game,type Meld} from './game';

type Move={type:'draw'|'pickup'|'meld'|'discard';ids?:string[];meldId?:string;wildRank?:number};
export type AdviceCandidate={id:string;label:string;move:Move;priority:number};

const rank=(n:number)=>({0:'★',1:'A',11:'J',12:'Q',13:'K',14:'A'}[n]??String(n));
const cardName=(c:Card)=>c.r===0?'coringa':`${rank(c.r)}${c.s}`;
const shownMeld=(m:Meld)=>{
 const played=sequence(m.cards,m.wilds);
 return {
  team:m.team,
  cards:m.cards.map(c=>m.wilds?.[c.id]===undefined?cardName(c):`${cardName(c)} como ${rank(m.wilds[c.id])}${played?.suit??''}`),
  canastra:m.cards.length>=7?(played?.clean?'limpa':'suja'):null,
 };
};

export function adviceSnapshot(g:Game,p:number){
 return {
  round:g.round,phase:g.drawn?'depois de comprar':'antes de comprar',player:g.players[p].name,team:teamOf(g,p),
  hand:g.players[p].hand.map(cardName),
  players:g.players.map((player,i)=>({name:player.name,team:teamOf(g,i),cardsInHand:player.hand.length})),
  melds:g.melds.map(shownMeld),discardBottomToTop:g.discard.map(cardName),
  stockCount:g.stock.length,mortosRemaining:g.mortos.map(m=>m.length),teamsWithMorto:g.taken,
  scores:g.totals,
 };
}

// Candidate generation is bounded for a responsive, low-cost request. The game action is
// the final arbiter for every candidate, including wildcard and going-out rules.
export function legalAdviceCandidates(g:Game,p:number):AdviceCandidate[]{
 if(g.status!=='playing'||g.turn!==p||g.winner!==null||!g.players[p]?.joined||g.players[p].bot)return [];
 const candidates:AdviceCandidate[]=[];
 const hand=g.players[p].hand;
 if(!g.drawn){
  if(g.stock.length)candidates.push({id:'draw',label:'Comprar uma carta do monte',move:{type:'draw'},priority:0});
  if(g.discard.length)candidates.push({id:'pickup',label:`Pegar todo o descarte (${g.discard.length} cartas; topo ${cardName(g.discard.at(-1)!)})`,move:{type:'pickup'},priority:0});
  return candidates;
 }
 const seen=new Set<string>();
 const melds:AdviceCandidate[]=[],discards:AdviceCandidate[]=[];
 function addMeld(cards:Card[],existing?:Meld,wildRank?:number){
  const ids=cards.map(c=>c.id),key=`${existing?.id??'new'}:${[...ids].sort().join(',')}:${wildRank??'-'}`;
  if(seen.has(key))return;
  seen.add(key);
  try{
   const next=action(g,p,'meld',{ids,meldId:existing?.id,wildRank});
   const result=existing?next.melds.find(m=>m.id===existing.id)!:next.melds.at(-1)!;
   const before=existing?.cards.length??0;
   const clean=sequence(result.cards,result.wilds)?.clean;
   const added=cards.map(c=>result.wilds?.[c.id]===undefined?cardName(c):`${cardName(c)} como ${rank(result.wilds[c.id])}${sequence(result.cards,result.wilds)?.suit??''}`).join(' · ');
   const suffix=before<7&&result.cards.length>=7?` (forma canastra ${clean?'limpa':'suja'})`:'';
   const label=existing?`Adicionar ${added} ao jogo ${existing.cards.map(cardName).join(' · ')}${suffix}`:`Baixar ${added}${suffix}`;
   const priority=cards.length*15+cards.reduce((sum,c)=>sum+value(c),0)+(before<7&&result.cards.length>=7?150:0)+
    (next.winner!==null?350:0)+(next.taken[teamOf(g,p)]&&!g.taken[teamOf(g,p)]?100:0)-(cards.some(isWild)?12:0);
   melds.push({id:`m${melds.length}`,label,move:{type:'meld',ids, ...(existing?{meldId:existing.id}:{}),...(wildRank===undefined?{}:{wildRank})},priority});
  }catch{/* Legal looking runs may still violate the game's going-out rule. */}
 }
 for(const existing of g.melds.filter(m=>m.team===teamOf(g,p))){
  for(const card of hand){
   for(const option of meldOptions([card],existing))addMeld([card],existing,option.rank);
  }
 }
 const wilds=hand.filter(isWild);
 // Try every run with natural cards. When precisely one rank is missing, try a
 // 2 and a joker separately; both have different strategic and point values.
 for(const suit of ['♠','♥','♣','♦'])for(let start=1;start<=12;start++)for(let end=start+2;end<=14;end++){
  const run:Card[]=[],missing:number[]=[];
  for(let r=start;r<=end;r++){
   const natural=hand.find(c=>c.s===suit&&c.r===(r===14?1:r)&&
    (c.r!==2||r===2)&&!run.includes(c));
   if(natural)run.push(natural);else missing.push(r);
   if(missing.length>1)break;
  }
  if(!missing.length)addMeld(run);
  else if(missing.length===1){
   for(const wildRank of [2,0]){
    const wild=wilds.find(c=>c.r===wildRank&&!run.includes(c));
    if(wild)addMeld([...run,wild],undefined,missing[0]);
   }
  }
 }
 for(const card of hand){
  try{
   const next=action(g,p,'discard',{ids:[card.id]});
   discards.push({id:`d${discards.length}`,label:`Descartar ${cardName(card)}${next.winner!==null?' e bater':''}`,move:{type:'discard',ids:[card.id]},priority:0});
  }catch{/* Discarding the last card can be forbidden before the team has a canastra. */}
 }
 melds.sort((a,b)=>b.priority-a.priority||a.label.localeCompare(b.label));
 return [...melds.filter(m=>m.move.meldId).slice(0,24),...melds.filter(m=>!m.move.meldId).slice(0,24),...discards];
}

export const ADVICE_RULES=`Regras desta mesa de buraco aberto: 2 baralhos (108 cartas), 11 cartas por jogador e 2 mortos de 11. Em 4 jogadores, assentos 1 e 3 são parceiros, assim como 2 e 4. Na vez, compre uma carta do monte OU pegue todo o descarte; depois pode baixar ou ampliar sequências da equipe e descartar para passar. Sequências do mesmo naipe têm 3 a 14 cartas; ás pode ser baixo ou alto. Um único coringa ou 2 pode representar outra posição; o 2 do mesmo naipe na posição 2 é natural. É possível substituir a posição ocupada por um curinga e reposicionar o curinga na mesma sequência. Canastra: 7+ cartas, limpa se nenhum curinga estiver em uso, suja caso contrário. Ao esvaziar a mão pela primeira vez, pegue o morto; depois, para bater, a equipe deve ter pego o morto e ter uma canastra de qualquer tipo. Canastra limpa vale 200, suja 100; batida +100; morto não pego -100; cartas remanescentes na mão descontam pontos. Cartas 3-7 valem 5, 8-K valem 10, ás 15, 2 vale 20, coringa 50. O monte e as mãos adversárias são desconhecidos. Escolha somente o identificador de uma jogada da lista, considerando chance de canastra, uso de curingas, descarte e risco dos adversários. Recomende uma única jogada imediata, não um plano de turno inteiro. Dê uma justificativa breve em português, sem afirmar certeza sobre cartas ocultas.`;
