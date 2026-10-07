'use client';
import {useState,useEffect,useRef,type DragEvent} from 'react';
import {Club,Users,Link as LinkIcon,Check,Copy,ArrowUpRight,Plus, X, BookOpen, Trophy, Layers, RotateCcw, LogOut, ChevronDown, ChevronLeft, ChevronRight, Volume2, VolumeX, Eye, EyeOff, Sparkles} from 'lucide-react';
import {sequence,isWild,meldOptions,type Card as C,type Game} from '../lib/game';
import MediaTable from './media-table';
import TablePet from './table-pet';
type View=Omit<Game,'stock'|'mortos'|'players'>&{stock:number;mortos:number[];players:{name:string;joined:boolean;bot?:boolean;hand:C[];count:number}[]};
type WildChoice={meldId?:string;ids:string[];card:C;fromTable:boolean;options:{rank:number;suit:string;cards:C[];wilds:Record<string,number>}[]};
const rank=(n:number)=>({0:'★',1:'A',11:'J',12:'Q',13:'K',14:'A'}[n]||n);
const FUNNY_NAMES=['Buraco Master','King of Cards','Curinga Cósmico','Rei do Descarte','Rainha da Canastra','Ás das Mesas','Barão do Buraco','Canastra Ninja'];
const PET_BACKS=Array.from({length:12},(_,i)=>`/pet-backs/pet-${String(i+1).padStart(2,'0')}.jpg`);
const TURN_SOUNDS=['/turn-bark.mp3',...Array.from({length:4},(_,i)=>`/turn-sounds/bark-${String(i+2).padStart(2,'0')}.mp3`),...Array.from({length:3},(_,i)=>`/turn-sounds/meow-${String(i+1).padStart(2,'0')}.mp3`)];
function petBack(game:View,pile:0|1){
 const seed=Array.from(game.id).reduce((hash,char)=>(Math.imul(hash,31)+char.charCodeAt(0))>>>0,game.round);
 // Only a draw changes the monte count; only taking a morto changes the morto count.
 const remaining=pile===0?game.stock:game.mortos.length;
 return PET_BACKS[(seed+remaining*7+pile)%PET_BACKS.length];
}
function Card({card,back=false,backImage,selected=false,onClick,small=false,mini=false,newlyDrawn=false,actionLabel}:{card?:C;back?:boolean;backImage?:string;selected?:boolean;onClick?:()=>void;small?:boolean;mini?:boolean;newlyDrawn?:boolean;actionLabel?:string}){
 const label=card?(card.r===0?'Coringa':`${rank(card.r)} de ${suitName[card.s]}`):'';
 if(mini&&card){
  const miniClass=`hand-mini ${['♥','♦'].includes(card.s)?'red':''} ${card.r===0?'joker':''} ${selected?'selected':''} ${newlyDrawn?'newly-drawn':''}`;
  return <button className={miniClass} onClick={onClick} aria-pressed={selected} aria-label={actionLabel||`${label}${newlyDrawn?', carta comprada neste turno':''}`} title={label}><strong>{rank(card.r)}</strong>{card.r!==0&&<span aria-hidden="true">{card.s}</span>}</button>;
 }
 const cls=`card ${back?'back':''} ${backImage?'photo-back':''} ${small?'small':''} ${selected?'selected':''} ${newlyDrawn?'newly-drawn':''} ${card?.r===0?'joker':''} ${card&&['♥','♦'].includes(card.s)?'red':''}`;
 const inside=back?backImage?<img className="card-back-image" src={backImage} alt="" draggable={false}/>:<span>♣</span>:<>{card!.r===0?<><span className="joker-title">CORINGA</span><span className="joker-symbol">★</span><span className="joker-points">50</span></>:<><span className="corner">{rank(card!.r)}<i>{card!.s}</i></span><span className="pip">{card!.s}</span><span className="corner bottom">{rank(card!.r)}<i>{card!.s}</i></span></>}{newlyDrawn&&<span className="drawn-badge" aria-hidden="true">NOVA</span>}</>;
 return onClick?<button className={cls} onClick={onClick} aria-pressed={selected} aria-label={actionLabel||`${label}${newlyDrawn?', carta comprada neste turno':''}`}>{inside}</button>:<div className={cls}>{inside}</div>;
}
const suitName:Record<string,string>={'♥':'copas','♦':'ouros','♠':'espadas','♣':'paus'};
const hasMoveButton=(card:C)=>isWild(card)||card.r===1;
function DiscardPile({cards}:{cards:C[]}){
 return <div className="discard-stack"><div className="discard-title">Descarte <span>{cards.length} {cards.length===1?'carta':'cartas'}</span></div><div className="discard-cards" role="list" aria-label="Cartas descartadas, da mais antiga à mais recente">{cards.length?cards.map((card,i)=><span role="listitem" key={card.id} className={`discard-token ${['♥','♦'].includes(card.s)?'red':''} ${i===cards.length-1?'latest':''}`} aria-label={`${card.r===0?'Coringa':`${rank(card.r)} de ${suitName[card.s]}`}${i===cards.length-1?', carta do topo':''}`} title={card.r===0?'Coringa':`${rank(card.r)} de ${suitName[card.s]}`}><strong>{rank(card.r)}</strong>{card.r!==0&&<span aria-hidden="true">{card.s}</span>}</span>):<div className="empty-card" aria-label="Descarte vazio">♧</div>}</div><span className="discard-hint">{cards.length?'Última carta em destaque':'Sem cartas'}</span></div>;
}
function wildDescription(m:Game['melds'][number]){
 const used=sequence(m.cards,m.wilds),card=used?.cards.find(c=>used.wilds[c.id]!==undefined);if(!used||!card)return '';
 const name=card.r===0?'Coringa':`2${card.s}`;
 return `${name} como ${rank(used.wilds[card.id])}${used.suit}`;
}
export default function Home(){
 const [count,setCount]=useState(4),[vsComputer,setVsComputer]=useState(false),[names,setNames]=useState(['','','','']),[game,setGame]=useState<View|null>(null),[room,setRoom]=useState(''),[seat,setSeat]=useState(-1),[selected,setSelected]=useState<string[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[rules,setRules]=useState(false),[finish,setFinish]=useState(false),[stopConfirm,setStopConfirm]=useState(false),[copied,setCopied]=useState(false),[loading,setLoading]=useState(true),[sort,setSort]=useState('suit'),[drawnCard,setDrawnCard]=useState<string|null>(null),[wildChoice,setWildChoice]=useState<WildChoice|null>(null);
 const [turnSound,setTurnSound]=useState(true),[soundReady,setSoundReady]=useState(false);
 const [showPet,setShowPet]=useState(true);
 const [batidaPulse,setBatidaPulse]=useState(false);
 const [adviceOpen,setAdviceOpen]=useState(false),[adviceBusy,setAdviceBusy]=useState(false),[adviceError,setAdviceError]=useState('');
 const [apiKey,setApiKey]=useState(''),[advice,setAdvice]=useState<{revision:number;move:string;reason:string}|null>(null);
 const [handFormat,setHandFormat]=useState<'full'|'mini'>('full'),[scoreCollapsed,setScoreCollapsed]=useState(false);
 const [handWidth,setHandWidth]=useState(960);
 const [manualHand,setManualHand]=useState<{key:string;ids:string[]}|null>(null),[movingCard,setMovingCard]=useState<string|null>(null),[dragCard,setDragCard]=useState<string|null>(null),[dropPosition,setDropPosition]=useState<{id:string;after:boolean}|null>(null),[dragOverMeld,setDragOverMeld]=useState<string|null>(null);
 const handRef=useRef<HTMLDivElement>(null);
 const lastDragRef=useRef(0);
 const handPanelRef=useRef<HTMLDivElement>(null);
 const botRunRef=useRef<{revision:number;at:number;running:boolean}|null>(null);
 const audioRef=useRef<AudioContext|null>(null),lastTurnRef=useRef('');
 const soundBuffersRef=useRef(new Map<string,AudioBuffer>()),soundLoadingRef=useRef(new Map<string,Promise<AudioBuffer|null>>()),lastSoundRef=useRef<string|null>(null);
 const turnSoundRef=useRef(turnSound);turnSoundRef.current=turnSound;
 const observedBatidaRef=useRef<{roundKey:string;winner:number|null}|null>(null);
 const current=useRef({game,seat});current.current={game,seat};
 function loadTurnSound(context:AudioContext,path:string){
  const cached=soundBuffersRef.current.get(path);if(cached)return Promise.resolve(cached);
  const pending=soundLoadingRef.current.get(path);if(pending)return pending;
  const loading=fetch(path)
   .then(response=>{if(!response.ok)throw Error('Som indisponível.');return response.arrayBuffer();})
   .then(bytes=>context.decodeAudioData(bytes))
   .then(buffer=>{soundBuffersRef.current.set(path,buffer);soundLoadingRef.current.delete(path);return buffer;})
   .catch(()=>{soundLoadingRef.current.delete(path);return null;});
  soundLoadingRef.current.set(path,loading);return loading;
 }
 async function unlockTurnSound(force=false){
  if(!force&&!turnSound)return;
  try{const context=audioRef.current??new AudioContext();audioRef.current=context;await context.resume();setSoundReady(context.state==='running');TURN_SOUNDS.forEach(path=>{void loadTurnSound(context,path);});}catch{setSoundReady(false);}
 }
 async function playTurnAnimal(key:string){
  const context=audioRef.current;if(!turnSound||context?.state!=='running')return;
  const choices=TURN_SOUNDS.filter(path=>path!==lastSoundRef.current);
  const path=choices[Math.floor(Math.random()*choices.length)];lastSoundRef.current=path;
  const buffer=await loadTurnSound(context,path)??(path!==TURN_SOUNDS[0]?await loadTurnSound(context,TURN_SOUNDS[0]):null);
  if(!buffer||!turnSoundRef.current||context.state!=='running'||lastTurnRef.current!==key||current.current.game?.status!=='playing'||current.current.game.winner!==null)return;
  try{const source=context.createBufferSource(),volume=context.createGain();source.buffer=buffer;volume.gain.value=0.27;source.connect(volume).connect(context.destination);source.start();}catch{}
 }
 function playBatidaChime(){
  const context=audioRef.current;if(!turnSound||context?.state!=='running')return;
  try{const at=context.currentTime;[523.25,659.25,783.99].forEach((frequency,i)=>{
   const oscillator=context.createOscillator(),volume=context.createGain(),start=at+i*0.13;
   oscillator.type='sine';oscillator.frequency.value=frequency;
   volume.gain.setValueAtTime(0.0001,start);volume.gain.exponentialRampToValueAtTime(0.085,start+0.018);volume.gain.exponentialRampToValueAtTime(0.0001,start+0.21);
   oscillator.connect(volume).connect(context.destination);oscillator.start(start);oscillator.stop(start+0.22);
  });}catch{}
 }
 function toggleTurnSound(){
  if(turnSound&&soundReady){setTurnSound(false);localStorage.setItem('buraco-turn-sound','off');return;}
  setTurnSound(true);localStorage.setItem('buraco-turn-sound','on');void unlockTurnSound(true);
 }
 function togglePet(){const next=!showPet;setShowPet(next);localStorage.setItem('buraco-show-pet',next?'on':'off');}
 useEffect(()=>{const id=new URLSearchParams(location.search).get('room')||'';setRoom(id);if(id){const stored=localStorage.getItem('buraco-seat-'+id);setSeat(stored===null?-1:Number(stored));}else setLoading(false);},[]);
 useEffect(()=>{if(!room||seat<0)return;setHandFormat(localStorage.getItem(`buraco-hand-format-${room}-${seat}`)==='mini'?'mini':'full');setScoreCollapsed(localStorage.getItem(`buraco-score-collapsed-${room}-${seat}`)==='yes');},[room,seat]);
 useEffect(()=>{setApiKey('');setAdvice(null);setAdviceOpen(false);setAdviceError('');},[room,seat]);
 useEffect(()=>{setAdvice(null);},[game?.revision]);
 useEffect(()=>{const panel=handPanelRef.current;if(!panel)return;const update=()=>setHandWidth(panel.clientWidth);update();const observer=new ResizeObserver(update);observer.observe(panel);return()=>observer.disconnect();},[room,seat,game?.status]);
 function changeHandFormat(format:'full'|'mini'){setHandFormat(format);if(room&&seat>=0)localStorage.setItem(`buraco-hand-format-${room}-${seat}`,format);}
 function toggleScore(){setScoreCollapsed(value=>{const next=!value;if(room&&seat>=0)localStorage.setItem(`buraco-score-collapsed-${room}-${seat}`,next?'yes':'no');return next;});}
 useEffect(()=>{setTurnSound(localStorage.getItem('buraco-turn-sound')!=='off');setShowPet(localStorage.getItem('buraco-show-pet')!=='off');return()=>{const context=audioRef.current;audioRef.current=null;if(context)void context.close();};},[]);
 useEffect(()=>{if(!room)return;let alive=true;
 const advanceBot=async(data:View)=>{
  const pending=botRunRef.current;
  if(pending?.running||pending?.revision===data.revision&&Date.now()-pending.at<3500)return;
  botRunRef.current={revision:data.revision,at:Date.now(),running:true};
  try{
   const r=await fetch(`/api/rooms/${room}/bot`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:data.revision})});
   const next=await r.json() as View & {error?:string};
   if(!r.ok){if(r.status!==409)throw Error(next.error||'Não foi possível jogar.');return;}
   if(alive){setGame(old=>!old||next.revision>=old.revision?next:old);setError('');}
  }catch(e){if(alive)setError((e as Error).message);}
  finally{botRunRef.current={revision:data.revision,at:Date.now(),running:false};}
 };
 const poll=async()=>{try{const r=await fetch(`/api/rooms/${room}?seat=${seat}`);const data=await r.json() as View & {error?:string};if(!r.ok)throw Error(data.error||"Não foi possível carregar a mesa.");if(alive){setGame(old=>!old||data.revision>=old.revision?data:old);setLoading(false);setError(e=>e.startsWith('Conexão')?'':e);if(seat===0&&data.status==='playing'&&data.winner===null&&data.players[data.turn]?.bot)void advanceBot(data);}}catch(e){if(alive){setError(`Conexão: ${(e as Error).message}`);setLoading(false);}}};poll();const timer=setInterval(poll,1500);return()=>{alive=false;clearInterval(timer);};},[room,seat]);
 useEffect(()=>{if(!game||game.status!=='playing'||game.winner!==null||seat<0)return;const key=`${game.id}:${game.round}:${game.turn}:${seat}`;if(lastTurnRef.current===key)return;lastTurnRef.current=key;void playTurnAnimal(key);},[game?.id,game?.round,game?.turn,game?.status,game?.winner,seat,turnSound]);
 useEffect(()=>{
  if(!game||seat<0)return;
  const roundKey=`${game.id}:${game.round}`,previous=observedBatidaRef.current;
  observedBatidaRef.current={roundKey,winner:game.winner};
  if(game.winner===null){setBatidaPulse(false);return;}
  if(previous?.roundKey!==roundKey||previous.winner!==null)return;
  setBatidaPulse(true);playBatidaChime();
  const timer=setTimeout(()=>setBatidaPulse(false),1600);
  return()=>clearTimeout(timer);
 },[game?.id,game?.round,game?.winner,seat]);
 useEffect(()=>{setManualHand(null);setMovingCard(null);setDragCard(null);setDropPosition(null);setDragOverMeld(null);},[room,seat,game?.round]);
 async function create(){void unlockTurnSound();setBusy(true);setError('');try{const r=await fetch('/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({names:names.slice(0,vsComputer?1:count),vsComputer})});const data=await r.json() as View & {error?:string};if(!r.ok)throw Error(data.error||"Não foi possível carregar a mesa.");localStorage.setItem('buraco-seat-'+data.id,'0');history.replaceState(null,'','?room='+data.id);setRoom(data.id);setSeat(0);setGame(data);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function act(type:string,extra:any={},asSeat=seat){if(!game)return;void unlockTurnSound();setBusy(true);setError('');try{const r=await fetch('/api/rooms/'+game.id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type,seat:asSeat,revision:game.revision,...extra})});const data=await r.json() as View & {error?:string};if(!r.ok)throw Error(data.error||"Não foi possível carregar a mesa.");if(type==='draw'){const previous=new Set(game.players[asSeat]?.hand.map(c=>c.id));setDrawnCard(data.players[asSeat]?.hand.find(c=>!previous.has(c.id))?.id||null);}else if(type!=='meld')setDrawnCard(null);setGame(old=>!old||data.revision>=old.revision?data:old);setSelected([]);setMovingCard(null);if(type==='join'){setSeat(asSeat);localStorage.setItem('buraco-seat-'+game.id,String(asSeat));}setFinish(false);setStopConfirm(false);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 useEffect(()=>{const context=(document as any).modelContext;if(!context)return;const lifecycle=new AbortController();context.registerTool({name:'read_buraco_table',description:'Read the current round, scores and your visible hand.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>({seat:current.current.seat,game:current.current.game})},{signal:lifecycle.signal});return()=>lifecycle.abort();},[]);
 async function copy(){try{await navigator.clipboard.writeText(location.href);setCopied(true);setTimeout(()=>setCopied(false),2200);}catch{setError('Copie o link da barra de endereço para convidar seus amigos.');}}
 async function askAdvice(fromDialog:boolean){
  const at=current.current.game,askSeat=current.current.seat;
  if(!at||askSeat<0||!apiKey.trim()||adviceBusy)return;
  setAdviceBusy(true);setAdviceError('');
  try{
   const response=await fetch(`/api/rooms/${at.id}/advice`,{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({seat:askSeat,revision:at.revision,apiKey:apiKey.trim()})});
   const data=await response.json() as {revision?:number;move?:string;reason?:string;error?:string;code?:string};
   if(data.code==='invalid_key'){
    setApiKey('');setAdviceOpen(true);setAdviceError(data.error||'Confira sua chave da API OpenAI.');return;
   }
   if(!response.ok)throw Error(data.error||'Não foi possível consultar a sugestão.');
   if(current.current.game?.id!==at.id||current.current.game.revision!==at.revision||current.current.seat!==askSeat)
    throw Error('A mesa mudou. Peça uma nova sugestão.');
   if(data.revision!==at.revision||!data.move)throw Error('A sugestão não corresponde à mesa atual.');
   setAdvice({revision:at.revision,move:data.move,reason:data.reason||''});setAdviceOpen(false);
  }catch(e){if(fromDialog)setAdviceError((e as Error).message);else setError((e as Error).message);}finally{setAdviceBusy(false);}
 }
 const mine=game&&seat>=0?game.players[seat]:null,myTeam=game?(game.players.length===4?seat%2:seat):-1,myTurn=!!game&&game.turn===seat&&!game.players[seat]?.bot&&game.status==='playing'&&game.winner===null;
 const canPlay=myTurn&&game!.drawn&&!busy;
 useEffect(()=>{if(!drawnCard||handFormat==='mini')return;const hand=handRef.current,card=hand?.querySelector<HTMLElement>('.newly-drawn');if(!hand||!card)return;const box=hand.getBoundingClientRect(),item=card.getBoundingClientRect();hand.scrollTo({left:hand.scrollLeft+item.left-box.left-(hand.clientWidth-item.width)/2,behavior:'smooth'});},[drawnCard,handFormat]);
 const sortedHand=[...(mine?.hand||[])].sort((a,b)=>sort==='suit'?a.s.localeCompare(b.s)||a.r-b.r:a.r-b.r||a.s.localeCompare(b.s));
 const orderKey=`${room}:${game?.round}:${seat}`;
 const byId=new Map(sortedHand.map(c=>[c.id,c]));
 const retained=manualHand?.key===orderKey?manualHand.ids.map(id=>byId.get(id)).filter((c):c is C=>!!c):[];
 const retainedIds=new Set(retained.map(c=>c.id));
 const hand=manualHand?.key===orderKey?[...retained,...sortedHand.filter(c=>!retainedIds.has(c.id))]:sortedHand;
 const activeMove=hand.some(c=>c.id===movingCard)?movingCard:null;
 const miniItems=hand.length+(activeMove||dragCard?1:0),usableWidth=Math.max(40,handWidth-14);
 const regularColumns=Math.max(1,Math.floor((usableWidth+5)/53)),tightColumns=Math.max(1,Math.floor((usableWidth+5)/39));
 const miniColumns=Math.min(Math.max(1,miniItems),Math.min(tightColumns,Math.max(regularColumns,Math.ceil(miniItems/2))));
 const teamName=(t:number)=>game?game.players.filter((_,i)=>(game.players.length===4?i%2:i)===t).map(p=>p.name).join(' & '):'';
 function moveCard(id:string,targetId:string|null,after=false){
  if(!hand.some(c=>c.id===id))return;
  const ids=hand.map(c=>c.id).filter(cardId=>cardId!==id);
  if(targetId===id){setMovingCard(null);return;}
  const targetIndex=targetId===null?ids.length:ids.indexOf(targetId);
  if(targetIndex<0)return;
  const at=targetIndex+(targetId!==null&&after?1:0);
  ids.splice(at,0,id);setManualHand({key:orderKey,ids});setMovingCard(null);setDragCard(null);setDropPosition(null);setDragOverMeld(null);
 }
 function playMeld(meldId?:string,ids=selected){
  const cards=hand.filter(c=>ids.includes(c.id));
  const existing=game?.melds.find(m=>m.id===meldId);
  const tableWild=existing?.cards.find(c=>existing.wilds?.[c.id]!==undefined),wild=tableWild??cards.find(isWild);
  const options=meldOptions(cards,existing);
  if(!options.length){setError('Essas cartas não formam uma sequência com no máximo um curinga em uso. Um 2 do próprio naipe pode ser o 2 natural ao lado de outro curinga.');return;}
  if(!wild){void act('meld',{ids,meldId});return;}
  if(options.length===1){void act('meld',{ids,meldId,wildRank:options[0].rank});return;}
  setWildChoice({meldId,ids:[...ids],card:wild,fromTable:!!tableWild,options:options.map(o=>({...o,rank:o.rank!}))});
 }
 function dropOnMeld(event:DragEvent<HTMLDivElement>,meld:Game['melds'][number]){
  event.preventDefault();event.stopPropagation();
  const id=event.dataTransfer.getData('text/plain')||dragCard;
  setDragCard(null);setDragOverMeld(null);setDropPosition(null);
  const card=hand.find(c=>c.id===id);if(!card)return;
  if(meld.team!==myTeam){setError('Você só pode adicionar cartas aos jogos da sua equipe.');return;}
  if(!canPlay){setError(busy?'Aguarde a jogada em andamento.':myTurn?'Compre uma carta ou pegue o descarte antes de baixar.':'Aguarde sua vez para baixar cartas.');return;}
  if(!meldOptions([card],meld).length){setError('Essa carta não completa uma sequência válida neste jogo.');return;}
  playMeld(meld.id,[card.id]);
 }
 return <div className="app"><header className="topbar"><a className="brand" href="/"><span className="brand-icon"><Club size={25} fill="currentColor"/></span><span>buraco<span className="brand-light">clube</span></span><span className="beta">ONLINE</span></a><div className="header-right"><span className="header-note">Boa companhia. Boas cartas.</span><button className="text-btn" onClick={()=>setRules(true)}><BookOpen size={17}/> Como jogar</button></div></header>
 {error&&<div className="toast" role="alert">{error}<button aria-label="Fechar aviso" onClick={()=>setError('')}><X size={17}/></button></div>}
 {loading?<main className="loading"><Club size={40}/><h2>Preparando a mesa…</h2></main>:!room?<main className="setup-layout"><section className="intro"><div className="eyebrow"><span/> A MESA É DE VOCÊS</div><h1>Mais uma<br/>rodada?</h1><p>Junte os amigos, distribua as cartas.<br/>O resto é história pra contar.</p><div className="showcase" aria-label="Sequência de cartas de copas"><div className="showcase-caption">O melhor jogo tem boa companhia.</div><div className="fan">{[10,11,12,13,1].map((r,i)=><div key={r} style={{transform:`translateY(${Math.abs(i-2)*13}px) rotate(${(i-2)*11}deg)`}}><Card card={{id:String(i),r,s:'♥'}}/></div>)}</div><div className="table-mark">BURACO <span>♣</span> CLUBE</div></div><div className="intro-footer"><span><Users size={16}/> 2 ou 4 jogadores</span><span><LinkIcon size={16}/> Um link, uma mesa</span><span><RotateCcw size={16}/> Sem última rodada</span></div></section>
 <section className="setup-card"><div className="section-number">01 <span>/ PREPARE A MESA</span></div><h2>Quem vai jogar?</h2><p className="muted">{vsComputer?'Comece agora uma partida contra o computador.':'Escolha os lugares e chame a turma.'}</p>
 <div className="mode-grid play-type"><button type="button" className={`mode ${!vsComputer?'active':''}`} onClick={()=>setVsComputer(false)}><div><Users size={22}/>{!vsComputer&&<span className="check"><Check size={12}/></span>}</div><strong>Com amigos</strong><span>Convide a turma</span></button><button type="button" className={`mode ${vsComputer?'active':''}`} onClick={()=>{setVsComputer(true);setNames(current=>current[0].trim()?current:[FUNNY_NAMES[Math.floor(Math.random()*FUNNY_NAMES.length)],...current.slice(1)]);}}><div><Club size={22}/>{vsComputer&&<span className="check"><Check size={12}/></span>}</div><strong>Contra o computador</strong><span>Jogue sozinho</span></button></div>
 {!vsComputer&&<><label className="field-title">Número de jogadores</label><div className="mode-grid">{[2,4].map(n=><button key={n} type="button" className={`mode ${count===n?'active':''}`} onClick={()=>setCount(n)}><div><Users size={22}/>{count===n&&<span className="check"><Check size={12}/></span>}</div><strong>{n} jogadores</strong><span>{n===2?'Um contra um':'Em duplas'}</span></button>)}</div></>}
 <div className="field-heading"><label className="field-title">{vsComputer?'Seu nome':'Nomes dos jogadores'}</label><span>Você é o anfitrião</span></div><form onSubmit={e=>{e.preventDefault();create();}}><div className="names">{names.slice(0,vsComputer?1:count).map((name,i)=><label key={i} className="name-field"><span className={`avatar tone-${i%2}`}>{String(i+1).padStart(2,'0')}</span><input aria-label={`Nome do jogador ${i+1}`} maxLength={24} required placeholder={i===0?'Seu nome':`Nome do jogador ${i+1}`} value={name} onChange={e=>setNames(names.map((v,j)=>j===i?e.target.value:v))}/><span>{i===0?'VOCÊ':count===4?`DUPLA ${i%2+1}`:''}</span></label>)}</div>{!vsComputer&&count===4&&<p className="team-hint">Jogadores 1 + 3 e 2 + 4 formam as duplas.</p>}<button className="primary create" disabled={busy} type="submit">{busy?'Criando mesa…':vsComputer?'Jogar agora':'Criar mesa'}<Plus size={19}/></button></form><div className="setup-bottom">{vsComputer?<Club size={16}/>:<LinkIcon size={16}/>}<span>{vsComputer?'A rodada começa imediatamente. Você pode jogar quantas quiser.':<>Compartilhe o convite. A partida começa<br/>quando todos estiverem na mesa.</>}</span></div></section><footer className="page-footer"><span>Feito para jogar junto.</span><span>BURACO ABERTO · SEM CADASTRO</span></footer></main>:!game?<main className="loading"><h2>Não conseguimos abrir esta mesa.</h2><a href="/">Criar uma nova mesa</a></main>:<main className="room-layout"><div className="room-heading table-heading"><div><div className="eyebrow">SUA MESA • {game.players.length} JOGADORES</div><h1>{game.status==='waiting'?'A turma está chegando.':`Rodada ${game.round}`}</h1></div><div className="players-row" style={{gridTemplateColumns:`repeat(${game.players.length},minmax(0,1fr))`}}>{game.players.map((p,i)=><div key={i} className={`player ${game.status==='playing'&&game.turn===i?'current':''}`}><span className={`avatar tone-${i%2}`}>{p.name.slice(0,1).toUpperCase()}</span><div><strong>{p.name}{p.bot?' (computador)':seat===i?' (você)':''}</strong><span>{game.status==='waiting'?(p.joined?'Na mesa':'Aguardando…'):game.roundStopped?'Rodada descartada':`${p.count} cartas${game.status==='playing'&&game.winner===null&&game.turn===i?(p.bot?' · Jogando…':' · Sua vez'):''}`}</span></div>{i===0&&<span className="host">♔</span>}</div>)}</div><div className="room-tools"><button className="secondary pet-toggle" type="button" onClick={togglePet} aria-pressed={showPet} aria-label={showPet?"Ocultar mascote":"Mostrar mascote"} title={showPet?"Ocultar mascote":"Mostrar mascote"}>{showPet?<Eye size={17}/>:<EyeOff size={17}/>}<span>{showPet?"Mascote visível":"Mascote oculto"}</span></button><button className="secondary sound-toggle" onClick={toggleTurnSound} aria-pressed={turnSound&&soundReady} aria-label={turnSound&&soundReady?'Desligar som':'Ativar som'} title="Latido ou miado a cada troca de vez">{turnSound&&soundReady?<Volume2 size={17}/>:<VolumeX size={17}/>}<span>{turnSound?(soundReady?'Som ligado':'Ativar som'):'Som desligado'}</span></button><button className="secondary" onClick={copy} aria-label={copied?'Link copiado':'Convidar amigos'}>{copied?<Check size={17}/>:<Copy size={17}/>}<span>{copied?'Link copiado':'Convidar amigos'}</span></button></div></div>
 {seat===-1&&<section className="join-panel"><h2>Qual é o seu lugar?</h2><p>Escolha seu nome para entrar. Se voltou à mesa, retome seu lugar.</p><div className="join-options">{game.players.map((p,i)=>p.bot?null:<button className="secondary" disabled={busy} key={i} onClick={()=>{void unlockTurnSound();if(p.joined){setSeat(i);localStorage.setItem('buraco-seat-'+room,String(i));}else act('join',{},i);}}>{p.name}<span>{p.joined?'Retomar lugar':'Entrar'}</span></button>)}</div></section>}
 {seat>=0&&!game.players.some(p=>p.bot)&&<MediaTable room={room} seat={seat} players={game.players}/>}
 <div className={`game-columns ${scoreCollapsed?'score-collapsed':''} ${showPet?'':'pet-hidden'}`}><section className="play-area">
 <div className={`felt ${batidaPulse?'batida-pulse':''}`}>{showPet&&<TablePet game={game} dragCard={dragCard} dragOverMeld={dragOverMeld}/>}{game.status==='waiting'?<div className="waiting"><div className="waiting-emblem"><Club size={50}/></div><div className="eyebrow">{game.players.filter(p=>p.joined).length} DE {game.players.length} NA MESA</div><h2>Tem lugar para todo mundo.</h2><p>Envie o convite aos seus amigos.<br/>Vamos distribuir as cartas assim que todos chegarem.</p><button className="gold-button" onClick={copy}><LinkIcon size={17}/>{copied?'Convite copiado':'Copiar convite'}</button><div className="waiting-seats">{game.players.map((p,i)=><span key={i} className={p.joined?'arrived':''}>{p.joined?<Check size={16}/>:<Users size={16}/>}</span>)}</div></div>:game.roundStopped?<div className="waiting stopped-round" role="status"><div className="waiting-emblem"><RotateCcw size={43}/></div><div className="eyebrow">RODADA {game.round} DESCARTADA</div><h2>Rodada interrompida.</h2><p>Nenhum ponto foi contado. O anfitrião pode distribuir uma nova rodada.</p></div>:<><div className="table-top"><span>BURACO ABERTO</span><span>{game.status==='finished'?'RODADA ENCERRADA':game.winner!==null?'BATIDA!':`${game.players[game.turn].name.toUpperCase()} JOGA`}</span></div>{game.winner!==null&&<div className={`batida-banner ${batidaPulse?'announce':''}`} role="status" aria-live="polite" aria-atomic="true"><Trophy size={23} aria-hidden="true"/><div><strong>{game.batterSeat!=null?`${game.players[game.batterSeat]?.name} bateu!`:`${game.players.length===4?'Dupla':'Jogador'} ${game.winner+1} bateu!`}</strong><span>{game.players.length===4&&`Dupla ${game.winner+1} · ${teamName(game.winner)} · `}{game.status==='finished'?'Pontos contabilizados':'Aguardando o anfitrião contar os pontos'}</span></div></div>}<div className="piles"><div className="pile"><button className="deck-btn" aria-label="Comprar uma carta" disabled={!myTurn||game.drawn||busy||!game.stock} onClick={()=>act('draw')}><Card back backImage={petBack(game,0)}/></button><span>Monte · {game.stock}</span><small>{myTurn&&!game.drawn?'Toque para comprar':'Compra'}</small></div><div className="discard-pile"><DiscardPile cards={game.discard}/><button className="felt-btn" disabled={!myTurn||game.drawn||!game.discard.length||busy} onClick={()=>act('pickup')}>Pegar descarte · {game.discard.length}</button></div><div className="pile morto"><div className="morto-cards">{game.mortos.length?<Card back backImage={petBack(game,1)}/>:<div className="empty-card">✓</div>}</div><span>Morto · {game.mortos.length}</span><small>11 cartas cada</small></div></div><div className="meld-zones" onDragOver={e=>{if(dragCard&&!(e.target as Element).closest('.meld'))setDragOverMeld(null);}}>{[0,1].map(t=><div key={t} className="meld-zone"><div className="zone-heading"><span className={`team-dot tone-${t}`}/><strong>{teamName(t)}</strong><span>{game.taken[t]?'Morto na mão':'Morto a pegar'}</span></div><div className="meld-list">{game.melds.filter(m=>m.team===t).map(m=>{
 const dragged=dragCard?hand.find(c=>c.id===dragCard):null;
 const options=dragged&&canPlay&&m.team===myTeam?meldOptions([dragged],m):[];
 const active=dragOverMeld===m.id&&!!dragCard;
 const preview=active&&options.length===1?options[0]:null;
 const displayMeld=preview?{...m,cards:preview.cards,wilds:preview.wilds}:m;
 const wildcardLabel=wildDescription(displayMeld);
 return <div className={`meld ${dragCard&&options.length?'drop-possible':''} ${active?(options.length?'drop-active':'drop-invalid'):''}`} key={m.id}
  onDragOver={e=>{if(!dragCard)return;e.preventDefault();e.dataTransfer.dropEffect='move';setDragOverMeld(old=>old===m.id?old:m.id);}}
  onDrop={e=>dropOnMeld(e,m)}>
  <div className="meld-cards">{displayMeld.cards.map(c=><Card small key={c.id} card={c}/>)}</div>
  {wildcardLabel&&<span className="meld-wild">{wildcardLabel}</span>}
  {displayMeld.cards.length>=7&&<span className="canasta">{sequence(displayMeld.cards,displayMeld.wilds)?.clean?'Limpa +200':'Suja +100'}</span>}
  {active&&<span className="meld-drop-hint">{m.team!==myTeam?'Só jogos da sua equipe':!canPlay?'Compre antes de baixar':!options.length?'Carta incompatível':options.length>1?`${options.length} posições; escolha ao soltar`:'Solte para adicionar'}</span>}
  {t===myTeam&&<button className="add-meld" disabled={!canPlay||!selected.length} onClick={()=>playMeld(m.id)}>Adicionar cartas</button>}
 </div>;
})}{!game.melds.some(m=>m.team===t)&&<div className="empty-meld">Os jogos desta {game.players.length===4?'dupla':'pessoa'} aparecem aqui.</div>}</div></div>)}</div></> }</div>
 {game.status!=='waiting'&&!game.roundStopped&&seat>=0&&<div className="hand-panel" ref={handPanelRef}><div className="hand-heading"><div><strong>Sua mão</strong><span>{hand.length} cartas</span></div><div className="hand-toolbar"><div className="hand-format" role="group" aria-label="Formato das cartas na mão"><button type="button" aria-pressed={handFormat==='full'} onClick={()=>changeHandFormat('full')}>Carta inteira</button><button type="button" aria-pressed={handFormat==='mini'} onClick={()=>changeHandFormat('mini')}>Minicartas</button></div><label>Ordenar <select aria-label="Ordenar cartas" value={manualHand?.key===orderKey?'manual':sort} onChange={e=>{setSort(e.target.value);setManualHand(null);setMovingCard(null);}}><option value="suit">por naipe</option><option value="rank">por valor</option><option value="manual" disabled>ordem livre</option></select></label><button type="button" className="secondary hand-move-action" disabled={selected.length!==1} aria-pressed={!!activeMove&&activeMove===selected[0]} onClick={()=>setMovingCard(activeMove===selected[0]?null:selected[0])}>Mover carta</button><div className="hand-play-actions"><button className="secondary" disabled={!canPlay||selected.length<3} onClick={()=>playMeld()}><Plus size={16}/> Baixar jogo</button><button className="primary" disabled={!canPlay||selected.length!==1} onClick={()=>act('discard',{ids:selected})}>Descartar</button></div><button type="button" className="secondary advice-trigger" disabled={!myTurn||busy||adviceBusy} onClick={()=>{setAdviceError('');if(apiKey.trim())void askAdvice(false);else setAdviceOpen(true);}}><Sparkles size={15}/> {adviceBusy?'Consultando…':'Pedir sugestão'}</button>{apiKey&&<button type="button" className="text-btn advice-change-key" disabled={adviceBusy} onClick={()=>{setAdviceError('');setAdviceOpen(true);}}>Trocar chave</button>}</div></div>
 {advice?.revision===game.revision&&myTurn&&<div className="advice-result" role="status"><Sparkles size={18} aria-hidden="true"/><p><strong>{advice.move}</strong>{advice.reason&&<span>{advice.reason}</span>}</p><button className="advice-dismiss" aria-label="Dispensar sugestão" onClick={()=>setAdvice(null)}><X size={16}/></button></div>}
 {!!hand.length&&<p className="hand-reorder-hint" aria-live="polite">{activeMove?'Toque numa carta para colocar antes dela ou escolha o fim da mão.':'Arraste qualquer carta para ordenar a mão ou solte em uma sequência da sua equipe. O botão Mover carta também ordena a mão.'}</p>}
 <div className={`hand ${handFormat==='mini'?'mini':''}`} ref={handRef}
  style={handFormat==='mini'?{gridTemplateColumns:`repeat(${miniColumns}, minmax(34px,1fr))`,maxWidth:`min(100%, ${miniColumns*48}px)`}:undefined}
  onDragOver={e=>{if(!dragCard||!handRef.current)return;const box=handRef.current.getBoundingClientRect();if(e.clientX<box.left+40)handRef.current.scrollLeft-=14;else if(e.clientX>box.right-40)handRef.current.scrollLeft+=14;}}>
  {hand.map(c=><div key={c.id} className={`hand-card-shell ${dragCard===c.id?'dragging':''} ${dropPosition?.id===c.id?(dropPosition.after?'drop-after':'drop-before'):''}`}
   onDoubleClick={e=>{if(!canPlay||activeMove||dragCard||Date.now()-lastDragRef.current<500||(e.target as HTMLElement).closest('.card-move'))return;e.preventDefault();void act('discard',{ids:[c.id]});}}
   title={canPlay?'Duplo clique na carta para descartar':undefined} draggable
   onDragStart={e=>{lastDragRef.current=Date.now();e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',c.id);setDragCard(c.id);setMovingCard(null);}}
   onDragOver={e=>{if(!dragCard||dragCard===c.id)return;e.preventDefault();const rect=e.currentTarget.getBoundingClientRect(),after=e.clientX>rect.left+rect.width/2;setDropPosition(old=>old?.id===c.id&&old.after===after?old:{id:c.id,after});setDragOverMeld(null);}}
   onDrop={e=>{const id=e.dataTransfer.getData('text/plain')||dragCard;if(!id||!hand.some(card=>card.id===id))return;e.preventDefault();const rect=e.currentTarget.getBoundingClientRect();moveCard(id,c.id,e.clientX>rect.left+rect.width/2);}}
   onDragEnd={()=>{lastDragRef.current=Date.now();setDragCard(null);setDropPosition(null);setDragOverMeld(null);}}>
   <Card card={c} mini={handFormat==='mini'} newlyDrawn={drawnCard===c.id&&myTurn&&game.drawn} selected={selected.includes(c.id)} actionLabel={activeMove?`Colocar antes de ${c.r===0?'coringa':`${rank(c.r)} de ${suitName[c.s]}`}`:undefined} onClick={()=>activeMove?moveCard(activeMove,c.id):setSelected(selected.includes(c.id)?selected.filter(id=>id!==c.id):[...selected,c.id])}/>
   {hasMoveButton(c)&&<button className={`card-move ${activeMove===c.id?'active':''}`} aria-pressed={activeMove===c.id} aria-label={`${activeMove===c.id?'Cancelar movimento de':'Mover'} ${c.r===0?'coringa':`${rank(c.r)} de ${suitName[c.s]}`}`} onClick={()=>setMovingCard(activeMove===c.id?null:c.id)}>{activeMove===c.id?'Cancelar':'Mover'}</button>}
  </div>)}
  {(activeMove||dragCard)&&<button className="hand-end" onClick={()=>activeMove&&moveCard(activeMove,null)} onDragOver={e=>{if(dragCard)e.preventDefault();}} onDrop={e=>{const id=e.dataTransfer.getData('text/plain')||dragCard;if(id&&hand.some(c=>c.id===id)){e.preventDefault();moveCard(id,null);}}}>Fim da mão</button>}
  {!hand.length&&<p>Você não tem cartas na mão.</p>}
 </div><p className="hand-status">{game.status==='finished'?'Rodada encerrada.':game.winner!==null?'Aguardando o anfitrião encerrar.':myTurn?(game.drawn?'Selecione cartas para baixar ou descarte com duplo clique.':'Sua vez! Compre do monte ou pegue o descarte.'):`Aguarde ${game.players[game.turn].name} jogar.`}</p></div>}
 </section><aside className={`scoreboard ${scoreCollapsed?'collapsed':''}`} aria-label="Placar da mesa">{scoreCollapsed&&<button className="score-rail" onClick={toggleScore} aria-label="Expandir placar" aria-expanded={false} aria-controls="scoreboard-details" title="Expandir placar"><Trophy size={19}/><span>Placar</span><ChevronLeft size={18}/></button>}<div id="scoreboard-details" hidden={scoreCollapsed}><div className="score-title"><Trophy size={20}/><h2>Placar da mesa</h2><button className="score-toggle" onClick={toggleScore} aria-label="Recolher placar" aria-expanded={true} aria-controls="scoreboard-details" title="Recolher placar"><ChevronRight size={19}/></button></div><p className="muted">A boa disputa continua.</p>{[0,1].map(t=><div className={`score-team tone-border-${t}`} key={t}><div><span>{game.players.length===4?`DUPLA ${t+1}`:`JOGADOR ${t+1}`}</span><strong>{teamName(t)}</strong></div><b>{game.totals[t].toLocaleString('pt-BR')}<small>pontos</small></b></div>)}<div className="score-history"><div className="field-heading"><h3>Rodadas</h3><span>{game.history.length} concluídas</span></div>{game.history.length?<table><thead><tr><th>Rodada</th><th>01</th><th>02</th></tr></thead><tbody>{game.history.map(h=><tr key={h.round}><td>{String(h.round).padStart(2,'0')}</td>{h.scores.map((s,i)=><td key={i}>{s.total>0?'+':''}{s.total}</td>)}</tr>)}</tbody></table>:<div className="no-rounds"><Layers size={25}/><p>Cada rodada,<br/>uma nova história.</p><span>Os pontos aparecerão aqui.</span></div>}</div>{game.status==='finished'&&!game.roundStopped&&<details className="breakdown"><summary>Contagem da última rodada</summary>{game.history.at(-1)?.scores.map((s,t)=><div key={t}><strong>{teamName(t)}</strong><p>Cartas na mesa: +{s.cards}<br/>Canastras: +{s.canastas}<br/>Batida: +{s.out}<br/>Cartas na mão: −{s.hand}<br/>Morto não pego: −{s.morto}</p></div>)}</details>}<div className="host-controls">{seat===0&&game.status==='playing'&&<button className="secondary" onClick={()=>setFinish(true)}>Contar pontos</button>}{seat===0&&game.status==='playing'&&<button className="secondary" disabled={busy} onClick={()=>setStopConfirm(true)}>Parar rodada</button>}{seat===0&&game.status==='finished'&&<button className="primary" disabled={busy} onClick={()=>act('next')}><RotateCcw size={16}/> Mais uma rodada</button>}{game.status==='finished'&&seat!==0&&<p>O anfitrião pode começar a próxima.</p>}<span>Sem limite de rodadas.<br/>Vocês decidem quando parar.</span></div><button className="text-btn rules-link" onClick={()=>setRules(true)}><BookOpen size={16}/> Regras e pontuação</button></div></aside></div><footer className="page-footer"><span>{game.message}</span><button className="text-btn" onClick={()=>{setSeat(-1);localStorage.removeItem('buraco-seat-'+room);}}>Trocar de lugar</button></footer></main>}
 {adviceOpen&&<div className="modal-backdrop" onClick={()=>setAdviceOpen(false)}><section className="modal compact advice-modal" role="dialog" aria-modal="true" aria-labelledby="advice-title" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setAdviceOpen(false)} aria-label="Fechar sugestão"><X/></button><div className="eyebrow">EXPERIMENTO · IA</div><h2 id="advice-title">Uma ideia para a sua jogada</h2><p>A IA sugere uma jogada legal para esta posição. Você decide se quer fazê-la; a mesa não joga por você.</p><form onSubmit={e=>{e.preventDefault();void askAdvice(true);}}><label className="advice-key-label" htmlFor="advice-key">Sua chave da API OpenAI</label><input id="advice-key" className="advice-key-input" type="password" autoComplete="off" spellCheck={false} value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder="sk-..." required/><p className="advice-key-note">A chave fica na memória desta aba e passa pelo servidor somente para a consulta. Use uma chave de projeto com limite de gastos.</p>{adviceError&&<p className="advice-error" role="alert">{adviceError}</p>}<div className="modal-actions"><button type="button" className="secondary" disabled={!apiKey||adviceBusy} onClick={()=>{setApiKey('');setAdviceError('');}}>Apagar chave</button><button type="submit" className="primary" disabled={!apiKey.trim()||adviceBusy||!myTurn}>{adviceBusy?'Pensando…':'Consultar jogada'}</button></div></form></section></div>}
 {wildChoice&&<div className="modal-backdrop" onClick={()=>setWildChoice(null)}><section className="modal compact" role="dialog" aria-modal="true" aria-labelledby="wild-title" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setWildChoice(null)} aria-label="Cancelar escolha"><X/></button><div className="eyebrow">MONTAR SEQUÊNCIA</div><h2 id="wild-title">Qual carta ele representa?</h2><p>{wildChoice.card.r===0?'O coringa':`O 2 de ${suitName[wildChoice.card.s]}`} pode ocupar uma das posições abaixo. Escolha a sequência que quer formar.</p>{wildChoice.fromTable&&<p className="notice">A carta da sua mão substitui o coringa na posição atual. Ele permanece nesta sequência, na posição que você escolher.</p>}<div className="wild-options">{wildChoice.options.map(option=><button key={`${option.suit}-${option.rank}`} className="wild-option" disabled={busy} onClick={()=>{setWildChoice(null);act('meld',{ids:wildChoice.ids,meldId:wildChoice.meldId,wildRank:option.rank});}}><strong>{option.rank===1?'Ás baixo':option.rank===14?'Ás alto':rank(option.rank)} de {suitName[option.suit]}</strong><span>{option.cards.map(c=>option.wilds[c.id]!==undefined?`${rank(option.wilds[c.id])}${option.suit}`:`${rank(c.r)}${c.s}`).join(' · ')}</span></button>)}</div><button className="secondary wild-cancel" onClick={()=>setWildChoice(null)}>Voltar às cartas</button></section></div>}
 {rules&&<div className="modal-backdrop" onClick={()=>setRules(false)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="rules-title" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setRules(false)} aria-label="Fechar regras"><X/></button><div className="eyebrow">REGRAS DA CASA</div><h2 id="rules-title">Buraco aberto, entre amigos.</h2><p>2 baralhos com 2 coringas cada (108 cartas). Cada jogador recebe 11 cartas; dois mortos de 11 ficam separados. Em duplas, os lugares 1 + 3 jogam contra 2 + 4.</p><ol><li>Compre uma carta do monte ou pegue todo o descarte.</li><li>Baixe sequências do mesmo naipe com 3 ou mais cartas. Cada sequência pode ter um coringa ou um 2, que representa a carta que você escolher. Todo 2 pode funcionar como coringa. Quando o 2 do mesmo naipe ocupa a posição natural de 2, ele é uma carta natural; uma canastra antes suja fica limpa se não houver outro curinga em uso. A sequência é suja quando contém um coringa ou um 2 usado como curinga. O ás pode iniciar ou terminar uma sequência.</li><li>Adicione cartas aos seus jogos ou aos da sua dupla. Se uma carta natural ocupar a posição de um coringa ou 2, mova-o para outra posição válida da mesma sequência. Descarte uma carta para passar a vez.</li><li>Ao esvaziar a mão pela primeira vez, pegue o morto. Sem descarte, continue jogando; com descarte, aguarde sua próxima vez.</li><li>Para bater, sua equipe precisa ter pego o morto e ter uma canastra limpa ou suja. O anfitrião pode contar os pontos ou parar a rodada a qualquer momento. Ao parar, todas as cartas da rodada são descartadas e nenhum ponto é registrado.</li></ol><table><tbody><tr><td>3 a 7</td><td>5 pontos</td></tr><tr><td>8 a K / Ás</td><td>10 / 15 pontos</td></tr><tr><td>2 (coringuinha) / coringa</td><td>20 / 50 pontos</td></tr><tr><td>Canastra limpa / suja (7+)</td><td>+200 / +100</td></tr><tr><td>Batida / morto não pego</td><td>+100 / −100</td></tr><tr><td>Cartas restantes na mão</td><td>Valor negativo</td></tr></tbody></table><p className="muted">Nesta mesa, não há bônus especiais de 500/1.000 nem meta de pontos. O placar soma cartas, canastras e batida, descontando a mão e o morto. Em duplas, ambos compartilham a pontuação.</p><a className="text-btn" href="/turn-sounds/CREDITS.txt" target="_blank" rel="noopener noreferrer">Créditos dos sons de animais</a></section></div>}
 {stopConfirm&&<div className="modal-backdrop"><section className="modal compact" role="dialog" aria-modal="true" aria-labelledby="stop-title"><div className="eyebrow">PARAR A RODADA</div><h2 id="stop-title">Descartar a rodada {game?.round}?</h2><p>Todas as cartas desta rodada serão descartadas. O placar e o histórico de pontos permanecerão como estão. Depois, o anfitrião poderá iniciar outra rodada.</p><div className="modal-actions"><button className="secondary" disabled={busy} onClick={()=>setStopConfirm(false)}>Continuar jogando</button><button className="primary" disabled={busy} onClick={()=>act('stop')}>Parar sem contar pontos</button></div></section></div>}
 {finish&&<div className="modal-backdrop"><section className="modal compact" role="dialog" aria-modal="true" aria-labelledby="finish-title"><div className="eyebrow">FECHAR A CONTA</div><h2 id="finish-title">{game?.winner!==null?'Contar os pontos da batida?':'Contar os pontos desta rodada?'}</h2><p>Vamos somar as cartas e canastras da mesa e descontar as cartas nas mãos e os mortos não pegos. Depois, vocês podem jogar outra rodada.</p>{game?.winner===null&&<p className="notice">Ninguém bateu: não haverá bônus de batida.</p>}<div className="modal-actions"><button className="secondary" disabled={busy} onClick={()=>setFinish(false)}>Continuar jogando</button><button className="primary" disabled={busy} onClick={()=>act('finish')}>Contar os pontos</button></div></section></div>}
 </div>;
}
