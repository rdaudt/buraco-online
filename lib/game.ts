export type Card = {id:string;r:number;s:string};
export type Player = {name:string;joined:boolean;hand:Card[];bot?:boolean};
export type Meld = {id:string;team:number;cards:Card[];wilds?:Record<string,number>};
export type Score = {cards:number;canastas:number;hand:number;morto:number;out:number;total:number};
export type Game = {id:string;revision:number;players:Player[];status:'waiting'|'playing'|'finished';round:number;turn:number;drawn:boolean;stock:Card[];discard:Card[];mortos:Card[][];taken:boolean[];melds:Meld[];winner:number|null;batterSeat?:number|null;roundStopped?:boolean;totals:number[];history:{round:number;scores:Score[]}[];message:string};
export const teamOf=(g:Game,p:number)=>g.players.length===4?p%2:p;
export const isWild=(c:Card)=>c.r===0||c.r===2;
export const value=(c:Card)=>c.r===0?50:c.r===2?20:c.r===1?15:c.r>=8?10:5;
const usedWild=(m:Meld)=>m.cards.find(c=>m.wilds?.[c.id]!==undefined);
export function sequence(cards:Card[],declared:Record<string,number>={}):{cards:Card[];clean:boolean;suit:string;wilds:Record<string,number>}|null {
 if(cards.length<3||cards.length>14)return null;
 for(const suit of ['♠','♥','♣','♦'])for(const start of [1,2,3,4,5,6,7,8,9,10,11,12]){
  if(start+cards.length-1>14)continue;
  const remaining=[...cards], ordered:Card[]=[],wilds:Record<string,number>={};
  for(let rank=start;rank<start+cards.length;rank++){
   let i=remaining.findIndex(c=>c.s===suit&&c.r===(rank===14?1:rank)&&
    (!isWild(c)||c.r===2&&rank===2&&(declared[c.id]===undefined||declared[c.id]===2)));
   if(i<0&&!Object.keys(wilds).length){i=remaining.findIndex(c=>isWild(c)&&(declared[c.id]===undefined||declared[c.id]===rank));if(i>=0)wilds[remaining[i].id]=rank;}
   if(i<0)break;
   ordered.push(remaining.splice(i,1)[0]);
  }
  if(!remaining.length&&Object.entries(declared).every(([id,rank])=>
   wilds[id]===rank||rank===2&&ordered.some(c=>c.id===id&&c.r===2&&c.s===suit)))
   return {cards:ordered,clean:!Object.keys(wilds).length,suit,wilds};
 }
 return null;
}
export function meldOptions(added:Card[],existing?:Meld){
 if(!added.length)return [];
 const cards=[...(existing?.cards??[]),...added],wild=(existing&&usedWild(existing))??added.find(isWild);
 if(!wild){const result=sequence(cards,existing?.wilds??{});return result?[{...result,rank:undefined as number|undefined}]:[];}
 return Array.from({length:14},(_,i)=>i+1).flatMap(rank=>{
  const result=sequence(cards,{...(existing?.wilds??{}),[wild.id]:rank});
  return result?[{...result,rank:rank as number|undefined}]:[];
 });
}
export function newGame(id:string,names:string[],computer=false):Game {
 if(![2,4].includes(names.length)||names.some(n=>typeof n!=='string'||!n.trim()||n.length>24))throw Error('Preencha os nomes (até 24 caracteres).');
 if(new Set(names.map(n=>n.trim().toLowerCase())).size!==names.length)throw Error('Use nomes diferentes para cada jogador.');
 if(computer&&names.length!==2)throw Error('O modo contra o computador usa dois jogadores.');
 const g:Game={id,revision:0,players:names.map((name,i)=>({name:name.trim(),joined:i===0||computer&&i===1,bot:computer&&i===1,hand:[]})),status:'waiting',round:0,turn:0,drawn:false,stock:[],discard:[],mortos:[],taken:[false,false],melds:[],winner:null,batterSeat:null,roundStopped:false,totals:[0,0],history:[],message:'Aguardando os jogadores.'};
 if(computer)deal(g);
 return g;
}
export function deal(g:Game){
 const deck:Card[]=[];for(let d=0;d<2;d++){for(const s of ['♠','♥','♣','♦'])for(let r=1;r<=13;r++)deck.push({id:`${d}-${s}-${r}`,s,r});for(let j=0;j<2;j++)deck.push({id:`${d}-joker-${j}`,s:'★',r:0});}
 for(let i=deck.length-1;i>0;i--){const random=new Uint32Array(1);crypto.getRandomValues(random);const j=random[0]%(i+1);[deck[i],deck[j]]=[deck[j],deck[i]];}
 g.players.forEach(p=>p.hand=deck.splice(0,11));g.mortos=[deck.splice(0,11),deck.splice(0,11)];g.discard=deck.splice(0,1);g.stock=deck;g.taken=[false,false];g.melds=[];g.round++;g.turn=(g.round-1)%g.players.length;g.drawn=false;g.winner=null;g.batterSeat=null;g.roundStopped=false;g.status='playing';g.message=`Rodada ${g.round}: ${g.players[g.turn].name} começa.`;
}
function hasCanasta(g:Game,t:number){return g.melds.some(m=>m.team===t&&m.cards.length>=7);}
function canCompleteCanasta(g:Game,t:number,card:Card){
 return g.melds.some(m=>{
  if(m.team!==t||m.cards.length!==6)return false;
  const wild=usedWild(m)??(isWild(card)?card:undefined);
  if(!wild)return !!sequence([...m.cards,card],m.wilds??{});
  return Array.from({length:14},(_,i)=>i+1).some(rank=>
   !!sequence([...m.cards,card],{...(m.wilds??{}),[wild.id]:rank}));
 });
}
function emptyHand(g:Game,p:number){const t=teamOf(g,p);if(g.players[p].hand.length)return;
 if(!g.taken[t]&&g.mortos.length){g.players[p].hand=g.mortos.shift()!;g.taken[t]=true;g.message=`${g.players[p].name} pegou o morto.`;}
 else {if(!g.taken[t]||!hasCanasta(g,t))throw Error('Para bater, pegue o morto e forme uma canastra limpa ou suja.');g.winner=t;g.batterSeat=p;g.message=`${g.players[p].name} bateu! O anfitrião pode encerrar a rodada.`;}
}
export function score(g:Game):Score[]{return [0,1].map(t=>{
 const melds=g.melds.filter(m=>m.team===t);const cards=melds.flatMap(m=>m.cards).reduce((s,c)=>s+value(c),0);
 const canastas=melds.reduce((sum,m)=>sum+(m.cards.length>=7?(sequence(m.cards,m.wilds)?.clean?200:100):0),0);
 const hand=g.players.filter((_,i)=>teamOf(g,i)===t).flatMap(p=>p.hand).reduce((s,c)=>s+value(c),0);
 const morto=g.taken[t]?0:100,out=g.winner===t?100:0;return {cards,canastas,hand,morto,out,total:cards+canastas-hand-morto+out};
 });}
export function action(original:Game,p:number,type:string,data:any={}):Game{
 const g:Game=structuredClone(original);if(!Number.isInteger(p)||!g.players[p])throw Error('Escolha seu lugar na mesa.');
 if(type==='join'){if(g.status!=='waiting'||g.players[p].joined||g.players[p].bot)throw Error('Este lugar já foi ocupado.');g.players[p].joined=true;if(g.players.every(p=>p.joined))deal(g);return g;}
 if(!g.players[p].joined)throw Error('Entre na mesa primeiro.');
 if(type==='finish'){if(p!==0||g.status!=='playing')throw Error('Só o anfitrião pode encerrar a rodada.');const scores=score(g);g.history.push({round:g.round,scores});scores.forEach((s,i)=>g.totals[i]+=s.total);g.roundStopped=false;g.status='finished';g.message='Pontos contabilizados. Vamos a mais uma?';return g;}
 if(type==='stop'){
  if(p!==0||g.status!=='playing')throw Error('Só o anfitrião pode parar uma rodada em andamento.');
  g.players.forEach(player=>player.hand=[]);g.stock=[];g.discard=[];g.mortos=[];g.melds=[];g.taken=[false,false];
  g.drawn=false;g.winner=null;g.batterSeat=null;g.roundStopped=true;g.status='finished';
  g.message=`Rodada ${g.round} interrompida pelo anfitrião. Nenhum ponto foi contado.`;return g;
 }
 if(type==='next'){if(p!==0||g.status!=='finished')throw Error('Aguarde o anfitrião começar outra rodada.');deal(g);return g;}
 if(g.status!=='playing'||g.winner!==null)throw Error('A rodada não está em andamento.');
 if(g.turn!==p)throw Error('Aguarde a sua vez.');
 const hand=g.players[p].hand;
 if(type==='draw'||type==='pickup'){
  if(g.drawn)throw Error('Você já comprou nesta vez.');
  if(type==='draw'){if(!g.stock.length)throw Error('O monte acabou. Pegue o descarte ou peça para encerrar a rodada.');hand.push(g.stock.pop()!);}
  else {if(!g.discard.length)throw Error('O descarte está vazio.');hand.push(...g.discard);g.discard=[];}
  g.drawn=true;g.message=`${g.players[p].name} comprou ${type==='draw'?'uma carta':'o descarte'}.`;return g;
 }
 if(!g.drawn)throw Error('Compre uma carta ou pegue o descarte primeiro.');
 const ids=data.ids;if(!Array.isArray(ids)||new Set(ids).size!==ids.length||ids.some(id=>!hand.some(c=>c.id===id)))throw Error('Selecione cartas da sua mão.');
 const selected=hand.filter(c=>ids.includes(c.id));
 if(type==='meld'){
  const existing=data.meldId?g.melds.find(m=>m.id===data.meldId&&m.team===teamOf(g,p)):null;
  if(data.meldId&&!existing)throw Error('Escolha um jogo da sua equipe.');
  if(!selected.length)throw Error('Selecione as cartas para baixar.');
  const addedWild=selected.find(isWild);
  const wild=existing&&usedWild(existing)||addedWild;
  if(data.wildRank!==undefined&&(!wild||!Number.isInteger(data.wildRank)||data.wildRank<1||data.wildRank>14))throw Error('Escolha uma posição válida para o coringa.');
  const declared={...(existing?.wilds??{}),...(wild&&data.wildRank!==undefined?{[wild.id]:data.wildRank}:{})};
  const seq=sequence([...(existing?.cards??[]),...selected],declared);if(!seq)throw Error('Forme uma sequência do mesmo naipe, com 3 ou mais cartas e no máximo um coringa ou 2 usado como curinga.');
  if(addedWild&&seq.wilds[addedWild.id]!==undefined&&data.wildRank===undefined)throw Error('Escolha qual carta o coringa representa nesta sequência.');
  g.players[p].hand=hand.filter(c=>!ids.includes(c.id));if(existing){existing.cards=seq.cards;existing.wilds=seq.wilds;}else g.melds.push({id:crypto.randomUUID(),team:teamOf(g,p),cards:seq.cards,wilds:seq.wilds});
  const t=teamOf(g,p),remaining=g.players[p].hand;
  if(g.taken[t]&&!hasCanasta(g,t)&&remaining.length===1&&!canCompleteCanasta(g,t,remaining[0]))
   throw Error('Essa baixada deixaria uma carta na mão sem canastra para bater. Mantenha duas cartas ou complete uma canastra antes de descartar.');
  emptyHand(g,p);
 }else if(type==='discard'){
  if(selected.length!==1)throw Error('Selecione exatamente uma carta para descartar.');g.discard.push(selected[0]);g.players[p].hand=hand.filter(c=>c.id!==selected[0].id);emptyHand(g,p);g.turn=(p+1)%g.players.length;g.drawn=false;
 }else throw Error('Jogada desconhecida.');
 return g;
}
export function publicGame(g:Game,p:number){return {...g,stock:g.stock.length,mortos:g.mortos.map(m=>m.length),players:g.players.map((x,i)=>({...x,hand:i===p&&!x.bot?x.hand:[],count:x.hand.length}))};}
