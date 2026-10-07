import {action,isWild,sequence,teamOf,value,type Card,type Game,type Meld} from './game.ts';

type Choice={ids:string[];meldId?:string;wildRank?:number;game:Game;score:number};

function meldChoices(g:Game,p:number):Choice[]{
 const hand=g.players[p].hand,team=teamOf(g,p),choices:Choice[]=[];
 function consider(cards:Card[],meld?:Meld,wildRank?:number){
  if(!cards.length||new Set(cards.map(c=>c.id)).size!==cards.length)return;
  const declared={...(meld?.wilds??{})};
  const addedWild=cards.find(isWild),wild=meld?.cards.find(c=>meld.wilds?.[c.id]!==undefined)??addedWild;
  if(wild&&wildRank!==undefined)declared[wild.id]=wildRank;
  if(!sequence([...(meld?.cards??[]),...cards],declared))return;
  try{
   const next=action(g,p,'meld',{ids:cards.map(c=>c.id),meldId:meld?.id,wildRank});
   const before=meld?.cards.length??0,after=before+cards.length;
   const score=cards.reduce((sum,c)=>sum+value(c),0)+cards.length*12+
    (before<7&&after>=7?250:0)+(next.taken[team]&&!g.taken[team]?180:0)+
    (next.winner!==null?500:0)-(addedWild?20:0);
   choices.push({ids:cards.map(c=>c.id),meldId:meld?.id,wildRank,game:next,score});
  }catch{/* A legal sequence can still be disallowed by the going-out rule. */}
 }
 for(const meld of g.melds.filter(m=>m.team===team))for(const card of hand){
  if(isWild(card))for(let rank=1;rank<=14;rank++)consider([card],meld,rank);
  else if(meld.cards.some(isWild))for(let rank=1;rank<=14;rank++)consider([card],meld,rank);
  else consider([card],meld);
 }
 const wilds=hand.filter(isWild).sort((a,b)=>value(a)-value(b));
 for(const suit of ['♠','♥','♣','♦'])for(let start=1;start<=12;start++)for(let end=start+2;end<=14;end++){
  const run:Card[]=[],missing:number[]=[];
  for(let rank=start;rank<=end;rank++){
   const natural=hand.find(c=>!isWild(c)&&c.s===suit&&c.r===(rank===14?1:rank)&&!run.includes(c));
   if(natural)run.push(natural);else missing.push(rank);
   if(missing.length>1)break;
  }
  if(!missing.length)consider(run);
  else if(missing.length===1&&wilds.length)consider([...run,wilds[0]],undefined,missing[0]);
 }
 return choices;
}

function usefulDiscard(g:Game,p:number){
 const top=g.discard.at(-1);if(!top||g.discard.length>8)return false;
 const team=teamOf(g,p),hand=g.players[p].hand;
 for(const meld of g.melds.filter(m=>m.team===team)){
  if(isWild(top)){
   const tableWild=meld.cards.find(c=>meld.wilds?.[c.id]!==undefined);
   for(let rank=1;rank<=14;rank++)if(sequence([...meld.cards,top],{...(meld.wilds??{}),[(tableWild??top).id]:rank}))return true;
  }else if(meld.cards.some(c=>meld.wilds?.[c.id]!==undefined)){
   const wild=meld.cards.find(c=>meld.wilds?.[c.id]!==undefined)!;
   for(let rank=1;rank<=14;rank++)if(sequence([...meld.cards,top],{...(meld.wilds??{}),[wild.id]:rank}))return true;
  }else if(sequence([...meld.cards,top],meld.wilds??{}))return true;
 }
 // Only pick up the pile when its top card can already make a new game.
 const cards=[...hand,top];
 for(const suit of ['♠','♥','♣','♦'])for(let start=1;start<=12;start++)for(let end=start+2;end<=14;end++){
  const run:Card[]=[],missing:number[]=[];
  for(let rank=start;rank<=end;rank++){
   const natural=cards.find(c=>!isWild(c)&&c.s===suit&&c.r===(rank===14?1:rank)&&!run.includes(c));
   if(natural)run.push(natural);else missing.push(rank);
   if(missing.length>1)break;
  }
  if(!missing.length&&run.includes(top)&&sequence(run))return true;
  if(missing.length===1){
   for(const wild of cards.filter(isWild))if((wild.id===top.id||run.includes(top))&&sequence([...run,wild],{[wild.id]:missing[0]}))return true;
  }
 }
 return false;
}

function discardValue(hand:Card[],card:Card){
 if(isWild(card))return -150+value(card);
 const neighbors=hand.filter(other=>other.id!==card.id&&!isWild(other)&&other.s===card.s&&
  Math.abs((other.r===1?14:other.r)-(card.r===1?14:card.r))<=2).length;
 return value(card)-neighbors*18;
}

export function playBotTurn(original:Game):Game{
 const p=original.turn;
 if(original.status!=='playing'||original.winner!==null||!original.players[p]?.bot)throw Error('Não é a vez do computador.');
 if(!original.drawn&&!original.stock.length&&!original.discard.length)
  throw Error('Monte e descarte vazios. Encerre a rodada para contar os pontos.');
 let g=original;
 if(!g.drawn)g=action(g,p,!g.stock.length||g.discard.length&&usefulDiscard(g,p)?'pickup':'draw');
 for(let i=0;i<108&&g.winner===null;i++){
  const choices=meldChoices(g,p);
  if(!choices.length)break;
  choices.sort((a,b)=>b.score-a.score||b.ids.length-a.ids.length||a.ids.join().localeCompare(b.ids.join()));
  g=choices[0].game;
 }
 if(g.winner!==null)return g;
 const discards=g.players[p].hand.map(card=>{
  try{return {game:action(g,p,'discard',{ids:[card.id]}),card,score:discardValue(g.players[p].hand,card)};}
  catch{return null;}
 }).filter((v):v is {game:Game;card:Card;score:number}=>v!==null);
 if(!discards.length)throw Error('O computador não encontrou um descarte válido. Encerre a rodada para continuar.');
 discards.sort((a,b)=>b.score-a.score||a.card.id.localeCompare(b.card.id));
 g=discards[0].game;
 if(g.winner===null)g.message=`${g.players[p].name} jogou e descartou uma carta.`;
 return g;
}
