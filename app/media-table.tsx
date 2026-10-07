'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Camera,CameraOff,Mic,MicOff,Phone,PhoneOff,Volume2} from 'lucide-react';

type Kind='camera'|'microphone';
type Publication={sessionId:string;seat:number;kind:Kind};
type Local={sessionId:string;pc:RTCPeerConnection;stream:MediaStream};
type Remote={sessionId:string;pc:RTCPeerConnection;stream:MediaStream;seat:number;kind:Kind};
type RoomState={configured:boolean;iceServers:RTCIceServer[];publications:Publication[]};
const fallbackIce:RTCIceServer[]=[{urls:'stun:stun.cloudflare.com:3478'}];

function Media({stream,muted=false,audio=false,onBlocked}:{stream?:MediaStream;muted?:boolean;audio?:boolean;onBlocked?:()=>void}){
 const ref=useRef<HTMLMediaElement>(null);
 const blocked=useRef(onBlocked);blocked.current=onBlocked;
 useEffect(()=>{const element=ref.current;if(!element)return;element.srcObject=stream??null;if(stream)void element.play().catch(()=>blocked.current?.());return()=>{element.srcObject=null;};},[stream]);
 return audio?<audio ref={ref as React.RefObject<HTMLAudioElement>} autoPlay playsInline/>:<video ref={ref as React.RefObject<HTMLVideoElement>} autoPlay playsInline muted={muted}/>;
}
function gather(pc:RTCPeerConnection){
 if(pc.iceGatheringState==='complete')return Promise.resolve();
 return new Promise<void>((resolve,reject)=>{
  const timeout=setTimeout(()=>finish(new Error('A conexão de rede demorou demais.')),12000);
  function finish(error?:Error){clearTimeout(timeout);pc.removeEventListener('icegatheringstatechange',check);error?reject(error):resolve();}
  function check(){if(pc.iceGatheringState==='complete')finish();}
  pc.addEventListener('icegatheringstatechange',check);check();
 });
}
function description(pc:RTCPeerConnection){const value=pc.localDescription;if(!value?.sdp)throw Error('A conexão não gerou uma descrição.');return {type:value.type,sdp:value.sdp};}

export default function MediaTable({room,seat,players}:{room:string;seat:number;players:{name:string;joined:boolean}[]}){
 const [enabled,setEnabled]=useState<boolean|null>(null),[joined,setJoined]=useState(false),[streams,setStreams]=useState<Record<string,MediaStream>>({}),[busy,setBusy]=useState<Kind|null>(null),[error,setError]=useState(''),[soundBlocked,setSoundBlocked]=useState(false);
 const ice=useRef<RTCIceServer[]>(fallbackIce),iceReady=useRef(false),local=useRef<Partial<Record<Kind,Local>>>({}),remote=useRef(new Map<string,Remote>()),connecting=useRef(new Set<string>()),synching=useRef(false),joinedRef=useRef(false),mounted=useRef(true);
 const endpoint=`/api/rooms/${room}/media`;
 const key=(seat:number,kind:Kind)=>`${seat}:${kind}`;
 const post=useCallback(async(type:string,extra:Record<string,unknown>={})=>{
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type,seat,...extra})});
  const data=await response.json() as {error?:string;sessionId?:string;description?:RTCSessionDescriptionInit;mid?:string};if(!response.ok)throw Error(data.error||'A chamada não respondeu.');return data;
 },[endpoint,seat]);
 const closeLocal=useCallback((kind:Kind)=>{
  const item=local.current[kind];if(!item)return;
  item.stream.getTracks().forEach(t=>t.stop());item.pc.close();delete local.current[kind];
  if(mounted.current)setStreams(old=>{const next={...old};delete next[key(seat,kind)];return next;});
  void post('leave',{sessionId:item.sessionId}).catch(()=>{});
 },[post,seat]);
 const closeRemote=useCallback((id:string)=>{
  const item=remote.current.get(id);if(!item)return;item.pc.close();remote.current.delete(id);
  if(mounted.current)setStreams(old=>{const next={...old};delete next[key(item.seat,item.kind)];return next;});
  void post('leave',{sessionId:item.sessionId}).catch(()=>{});
 },[post]);
 const subscribe=useCallback(async(pub:Publication)=>{
  if(remote.current.has(pub.sessionId)||connecting.current.has(pub.sessionId))return;
  connecting.current.add(pub.sessionId);let pc:RTCPeerConnection|undefined;
  try{
   const result=await post('subscribe',{publisherSessionId:pub.sessionId});
   if(!result.sessionId||!result.description)throw Error('Resposta de mídia incompleta.');
   if(!joinedRef.current)return;
   pc=new RTCPeerConnection({iceServers:ice.current});
   const stream=new MediaStream();
   pc.addEventListener('track',event=>{stream.addTrack(event.track);if(mounted.current)setStreams(old=>({...old,[key(pub.seat,pub.kind)]:stream}));});
   pc.addEventListener('connectionstatechange',()=>{if(pc?.connectionState==='failed'||pc?.connectionState==='closed')closeRemote(pub.sessionId);});
   remote.current.set(pub.sessionId,{sessionId:result.sessionId,pc,stream,seat:pub.seat,kind:pub.kind});
   await pc.setRemoteDescription(result.description);
   await pc.setLocalDescription(await pc.createAnswer());await gather(pc);
   await post('answer',{sessionId:result.sessionId,description:description(pc)});
  }catch(e){if(pc)pc.close();closeRemote(pub.sessionId);if(mounted.current)setError((e as Error).message);}
  finally{connecting.current.delete(pub.sessionId);}
 },[post,closeRemote]);
 const sync=useCallback(async()=>{
  if(synching.current)return;synching.current=true;
  try{
   const result:RoomState=await (await fetch(`${endpoint}?seat=${seat}${iceReady.current?'':'&ice=1'}`,{cache:'no-store'})).json();
   if(!mounted.current)return;
   setEnabled(result.configured);if(result.iceServers?.length){ice.current=result.iceServers;iceReady.current=true;}
   if(!joinedRef.current)return;
   const pubs=result.publications.filter(p=>p.seat!==seat);
   const active=new Set(pubs.map(p=>p.sessionId));
   for(const id of remote.current.keys())if(!active.has(id))closeRemote(id);
   for(const p of pubs)void subscribe(p);
  }catch{if(mounted.current)setError('Não foi possível atualizar a chamada.');}
  finally{synching.current=false;}
 },[endpoint,seat,closeRemote,subscribe]);
 useEffect(()=>{mounted.current=true;void sync();return()=>{mounted.current=false;joinedRef.current=false;(['camera','microphone'] as Kind[]).forEach(closeLocal);for(const id of remote.current.keys())closeRemote(id);};},[sync,closeLocal,closeRemote]);
 useEffect(()=>{if(!joined)return;const timer=setInterval(()=>{
  const sessionIds=Object.values(local.current).map(item=>item!.sessionId);
  void post('heartbeat',{sessionIds}).catch(()=>{});
  void sync();
 },7000);return()=>clearInterval(timer);},[joined,post,sync]);
 const start=async(kind:Kind)=>{
  if(local.current[kind]){closeLocal(kind);return;}
  setBusy(kind);setError('');let pc:RTCPeerConnection|undefined,stream:MediaStream|undefined,sessionId:string|undefined;
  try{
   stream=await navigator.mediaDevices.getUserMedia(kind==='camera'?{video:{width:{ideal:320},height:{ideal:240},frameRate:{ideal:15,max:20}},audio:false}:{audio:{echoCancellation:true,noiseSuppression:true},video:false});
   const track=stream.getTracks()[0];if(!track)throw Error('Dispositivo indisponível.');
   track.addEventListener('ended',()=>closeLocal(kind),{once:true});
   pc=new RTCPeerConnection({iceServers:ice.current});
   const transceiver=pc.addTransceiver(track,{direction:'sendonly'});
   if(kind==='camera'){const sender=transceiver.sender;const parameters=sender.getParameters();if(parameters.encodings?.length){parameters.encodings[0].maxBitrate=350_000;void sender.setParameters(parameters).catch(()=>{});}}
   await pc.setLocalDescription(await pc.createOffer());await gather(pc);
   const created=await post('start',{kind});sessionId=created.sessionId;
   if(!sessionId)throw Error('A chamada não criou uma sessão.');
   if(transceiver.mid===null)throw Error('A câmera não pôde ser identificada.');
   const response=await post('publish',{kind,sessionId,mid:transceiver.mid,description:description(pc)});
   if(!response.description)throw Error('A chamada não retornou uma resposta.');
   await pc.setRemoteDescription(response.description);
   if(!joinedRef.current){pc.close();stream.getTracks().forEach(t=>t.stop());await post('leave',{sessionId});return;}
   local.current[kind]={pc,stream,sessionId:sessionId!};
   if(kind==='camera')setStreams(old=>({...old,[key(seat,kind)]:stream!}));
   pc.addEventListener('connectionstatechange',()=>{if(pc?.connectionState==='failed')closeLocal(kind);});
   void sync();
  }catch(e){pc?.close();stream?.getTracks().forEach(t=>t.stop());if(sessionId)void post('leave',{sessionId}).catch(()=>{});setError((e as Error).message);}
  finally{setBusy(null);}
 };
 function join(){joinedRef.current=true;setJoined(true);setError('');void sync();}
 function leave(){joinedRef.current=false;setJoined(false);(['camera','microphone'] as Kind[]).forEach(closeLocal);for(const id of remote.current.keys())closeRemote(id);setError('');}
 async function enableSound(){const elements=document.querySelectorAll<HTMLAudioElement>('.video-strip audio');try{await Promise.all([...elements].map(e=>e.play()));setSoundBlocked(false);}catch{setSoundBlocked(true);}}
 return <section className="call-panel" aria-label="Chamada de voz e vídeo"><div className="call-header"><div><strong>Mesa ao vivo</strong><span>Vídeo e voz continuam entre rodadas</span></div>{joined?<div className="call-controls"><button className={`call-control ${local.current.camera?'on':''}`} disabled={!!busy} onClick={()=>void start('camera')} aria-label={local.current.camera?'Desligar câmera':'Ligar câmera'}>{local.current.camera?<Camera size={17}/>:<CameraOff size={17}/>}<span>{local.current.camera?'Câmera ligada':'Câmera'}</span></button><button className={`call-control ${local.current.microphone?'on':''}`} disabled={!!busy} onClick={()=>void start('microphone')} aria-label={local.current.microphone?'Desligar microfone':'Ligar microfone'}>{local.current.microphone?<Mic size={17}/>:<MicOff size={17}/>}<span>{local.current.microphone?'Microfone ligado':'Microfone'}</span></button><button className="call-control leave" onClick={leave} aria-label="Sair da chamada"><PhoneOff size={17}/><span>Sair</span></button></div>:enabled?<button className="call-join" onClick={join}><Phone size={17}/> Entrar na conversa</button>:<span className="call-unavailable">{enabled===false?'Chamada aguardando configuração':'Verificando chamada…'}</span>}</div>
 {joined&&<><div className="video-strip">{players.map((player,i)=>{const video=streams[key(i,'camera')];const audio=i!==seat?streams[key(i,'microphone')]:undefined;return <div className="video-tile" key={i}><div className="video-frame">{video?<Media stream={video} muted={i===seat}/>:<span className="video-avatar">{player.name.slice(0,1).toUpperCase()}</span>}{audio&&<Media stream={audio} audio onBlocked={()=>setSoundBlocked(true)}/>}</div><div className="video-caption"><strong>{player.name}{i===seat?' · você':''}</strong>{i===seat?(local.current.microphone?<Mic size={14}/>:<MicOff size={14}/>):(audio?<Mic size={14}/>:<MicOff size={14}/>)}</div></div>;})}</div>{soundBlocked&&<button className="sound-retry" onClick={()=>void enableSound()}><Volume2 size={16}/> Ativar áudio</button>}</>}
 {error&&<p className="call-error" role="alert">{error}</p>}</section>;
}
