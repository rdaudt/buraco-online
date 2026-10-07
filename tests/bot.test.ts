import assert from 'node:assert/strict';
import {action,newGame,publicGame,type Card} from '../lib/game.ts';
import {playBotTurn} from '../lib/bot.ts';

const cards=(ranks:number[],s='♥'):Card[]=>ranks.map((r,i)=>({id:`${s}-${r}-${i}`,r,s}));
let solo=newGame('solo',['Ana','Computador'],true);
assert.equal(solo.status,'playing');assert.equal(solo.round,1);
assert.equal(solo.players[1].bot,true);assert.equal(solo.players[1].joined,true);
assert.equal(publicGame(solo,1).players[1].hand.length,0);
assert.equal(publicGame(solo,0).players[0].hand.length,11);
assert.throws(()=>action(solo,1,'join'));
assert.throws(()=>playBotTurn(solo),/Não é a vez/);
solo=action(solo,0,'draw');solo=action(solo,0,'discard',{ids:[solo.players[0].hand[0].id]});
assert.equal(solo.turn,1);
const afterBot=playBotTurn(JSON.parse(JSON.stringify(solo)));
assert.equal(solo.turn,1,'The original revision is never mutated');
assert.equal(afterBot.turn,0);assert.equal(afterBot.drawn,false);
assert.equal(afterBot.players[1].hand.length>0,true);
assert.equal(publicGame(afterBot,1).players[1].hand.length,0);

let botBatida=newGame('bot-batida',['Ana','Computador'],true);
botBatida.turn=1;botBatida.drawn=true;botBatida.taken[1]=true;
botBatida.players[1].hand=[{id:'last-card',r:10,s:'♠'}];
botBatida.melds=[{id:'canasta',team:1,cards:cards([3,4,5,6,7,8,9])}];
botBatida=playBotTurn(botBatida);
assert.equal(botBatida.winner,1);assert.equal(botBatida.batterSeat,1);assert.equal(botBatida.turn,0);

let canasta=newGame('canasta',['Ana','Computador'],true);
canasta.turn=1;canasta.taken[1]=true;
canasta.players[1].hand=[...cards([3,4,5,6,7,8]),{id:'joker',r:0,s:'★'},...cards([10,12],'♠'),...cards([5],'♦'),...cards([7],'♣')];
canasta.stock=[{id:'stock',r:13,s:'♣'}];canasta.discard=[{id:'discard',r:13,s:'♦'}];
canasta=playBotTurn(canasta);
assert.equal(canasta.turn,0);
assert.equal(canasta.melds.some(m=>m.team===1&&m.cards.length>=7),true);
assert.equal(canasta.melds.some(m=>m.cards.some(c=>c.id==='joker')),true);
let littleJoker=newGame('little-joker',['Ana','Computador'],true);
littleJoker.turn=1;littleJoker.taken[1]=true;
littleJoker.players[1].hand=[...cards([3,4,5,6,7,8]),{id:'two',r:2,s:'♠'},...cards([10,12],'♠'),...cards([5],'♦'),...cards([7],'♣')];
littleJoker.stock=[{id:'stock',r:13,s:'♣'}];littleJoker.discard=[{id:'discard',r:13,s:'♦'}];
littleJoker=playBotTurn(littleJoker);
assert.equal(littleJoker.melds.some(m=>m.team===1&&m.cards.length>=7&&m.cards.some(c=>c.id==='two')),true);

let movedWild=newGame('bot-move-wild',['Ana','Computador'],true);
movedWild.turn=1;movedWild.drawn=true;
movedWild.players[1].hand=[{id:'four',r:4,s:'♠'},{id:'spare',r:10,s:'♥'}];
movedWild.melds=[{id:'gap',team:1,cards:[{id:'three',r:3,s:'♠'},{id:'wild',r:0,s:'★'},...cards([5,6,7],'♠')],wilds:{wild:4}}];
movedWild=playBotTurn(movedWild);
assert.equal(movedWild.melds[0].cards.some(c=>c.id==='four'),true);
assert.equal([2,8].includes(movedWild.melds[0].wilds?.wild??0),true);
assert.equal(movedWild.turn,0);

let naturalTwo=newGame('bot-natural-two',['Ana','Computador'],true);
naturalTwo.turn=1;naturalTwo.drawn=true;naturalTwo.taken[1]=true;
naturalTwo.players[1].hand=[{id:'natural-d',r:2,s:'♦'},...cards([8],'♠'),...cards([13],'♣')];
naturalTwo.melds=[{id:'diamonds',team:1,cards:[{id:'three-d',r:3,s:'♦'},{id:'four-d',r:4,s:'♦'},{id:'wild-h',r:2,s:'♥'}],wilds:{'wild-h':5}}];
naturalTwo=playBotTurn(naturalTwo);
assert.equal(naturalTwo.melds[0].cards.some(c=>c.id==='natural-d'),true);
assert.equal(naturalTwo.melds[0].wilds?.['natural-d'],undefined);
assert.equal(naturalTwo.melds[0].wilds?.['wild-h']===1||naturalTwo.melds[0].wilds?.['wild-h']===5,true);

let morto=newGame('morto-bot',['Ana','Computador'],true);
morto.turn=1;morto.players[1].hand=cards([3,4,5]);
morto.stock=[{id:'stock',r:13,s:'♠'}];morto.discard=[{id:'discard',r:12,s:'♦'}];
morto.mortos=[cards([1,3,5,7,9,11,13],'♣').concat(cards([3,5,7,9],'♦'))];
morto=playBotTurn(morto);
assert.equal(morto.taken[1],true);
assert.equal(morto.turn,0);
assert.equal(morto.players[1].hand.length>0,true);

let emptyStock=newGame('empty-stock',['Ana','Computador'],true);
emptyStock.turn=1;emptyStock.stock=[];emptyStock.discard=[{id:'last-discard',r:9,s:'♦'}];
emptyStock=playBotTurn(emptyStock);assert.equal(emptyStock.turn,0);
emptyStock.turn=1;emptyStock.stock=[];emptyStock.discard=[];
assert.throws(()=>playBotTurn(emptyStock),/Monte e descarte vazios/);

let rounds=newGame('rounds',['Ana','Computador'],true);
for(let i=0;i<30&&rounds.winner===null;i++){
 if(rounds.turn===0){
  rounds=action(rounds,0,rounds.stock.length?'draw':'pickup');
  rounds=action(rounds,0,'discard',{ids:[rounds.players[0].hand[0].id]});
 }
 if(rounds.turn===1&&rounds.winner===null)rounds=playBotTurn(rounds);
}
rounds=action(rounds,0,'finish');assert.equal(rounds.history.length,1);
rounds=action(rounds,0,'next');assert.equal(rounds.round,2);
if(rounds.turn===1)rounds=playBotTurn(rounds);
assert.equal(rounds.turn,0);
console.log('PASS: solo setup, hidden bot hand, full turns, wildcard canasta, morto, scores, and next round.');
