import {env} from 'cloudflare:workers';
import {database,json} from '../../../../../lib/rooms';
import type {Game} from '../../../../../lib/game';

const fresh=Date.now; // A room call remains present while a tab heartbeats.
const aliveMs=35_000;
type Kind='camera'|'microphone';
type Session={session_id:string;room_id:string;seat:number;kind:string;active:number;touched_at:number};
const configured=()=>!!(env.REALTIME_SFU_APP_ID&&env.REALTIME_SFU_APP_SECRET);
async function member(room:string,seat:number){
  const row=await database().prepare('SELECT state FROM rooms WHERE id=?').bind(room).first<{state:string}>();
  if(!row)return false;
  const game=JSON.parse(row.state) as Game;
  return Number.isInteger(seat)&&seat>=0&&seat<game.players.length&&game.players[seat].joined;
}
function kind(value:unknown):value is Kind{return value==='camera'||value==='microphone';}
async function session(room:string,seat:number,id:string){
  return database().prepare('SELECT * FROM media_sessions WHERE session_id=? AND room_id=? AND seat=?').bind(id,room,seat).first<Session>();
}
async function sfu(path:string,method:'POST'|'PUT',body?:unknown){
  if(!configured())throw Error('A chamada ainda precisa ser configurada pelo anfitrião do site.');
  const result=await fetch(`https://rtc.live.cloudflare.com/v1/apps/${env.REALTIME_SFU_APP_ID}${path}`,{
    method,headers:{'Authorization':`Bearer ${env.REALTIME_SFU_APP_SECRET}`,'Content-Type':'application/json'},
    ...(body===undefined?{}:{body:JSON.stringify(body)}),
  });
  const data=await result.json() as {sessionId?:string;sessionDescription?:{type:string;sdp:string};tracks?:Array<{errorCode?:string;errorDescription?:string;mid?:string}>;errors?:Array<{errorDescription?:string}>;errorDescription?:string};
  if(!result.ok||data.errors?.length||data.tracks?.some(t=>t.errorCode)){
    throw Error(data.errorDescription||data.errors?.[0]?.errorDescription||data.tracks?.find(t=>t.errorCode)?.errorDescription||'Não foi possível conectar a chamada.');
  }
  return data;
}
async function listings(room:string){
  const rows=await database().prepare('SELECT session_id, seat, kind FROM media_sessions WHERE room_id=? AND active=1 AND touched_at>?').bind(room,fresh()-aliveMs).all<{session_id:string;seat:number;kind:string}>();
  return rows.results.map(row=>({sessionId:row.session_id,seat:row.seat,kind:row.kind}));
}
export async function GET(req:Request,{params}:any){
  try{
    const {id}=await params;
    const seat=Number(new URL(req.url).searchParams.get('seat'));
    if(!await member(id,seat))return json({error:'Entre na mesa para usar a chamada.'},403);
    let iceServers:RTCIceServer[]=[{urls:'stun:stun.cloudflare.com:3478'}];
    if(new URL(req.url).searchParams.has('ice')&&configured()&&env.REALTIME_TURN_KEY_ID&&env.REALTIME_TURN_API_TOKEN){
      try{
        const turn=await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${env.REALTIME_TURN_KEY_ID}/credentials/generate-ice-servers`,{
          method:'POST',headers:{Authorization:`Bearer ${env.REALTIME_TURN_API_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({ttl:86400}),
        });
        if(turn.ok){const data=await turn.json() as {iceServers:RTCIceServer[]};iceServers=data.iceServers;}
      }catch{}
    }
    return json({configured:configured(),iceServers:new URL(req.url).searchParams.has('ice')?iceServers:[],publications:configured()?await listings(id):[]});
  }catch{return json({error:'Não foi possível carregar a chamada.'},503);}
}
export async function POST(req:Request,{params}:any){
  try{
    const {id}=await params;
    const body=await req.json() as {seat:number;type:string;kind?:string;sessionId?:string;publisherSessionId?:string;description?:{type:string;sdp:string};mid?:string};
    if(!await member(id,body.seat))return json({error:'Entre na mesa para usar a chamada.'},403);
    if(!configured())return json({error:'A chamada ainda precisa ser configurada pelo anfitrião do site.'},503);
    if(body.type==='start'){
      if(!kind(body.kind))return json({error:'Tipo de mídia inválido.'},400);
      const created=await sfu('/sessions/new','POST');
      if(!created.sessionId)throw Error('A chamada não criou uma sessão.');
      // A renewed tab replaces the old publication for that seat and media kind.
      await database().prepare('UPDATE media_sessions SET active=0 WHERE room_id=? AND seat=? AND kind=?').bind(id,body.seat,body.kind).run();
      await database().prepare('INSERT INTO media_sessions (session_id,room_id,seat,kind,active,touched_at) VALUES (?,?,?,?,0,?)').bind(created.sessionId,id,body.seat,body.kind,fresh()).run();
      return json({sessionId:created.sessionId});
    }
    if(body.type==='publish'){
      if(!body.sessionId||!kind(body.kind)||body.description?.type!=='offer'||!body.description.sdp||typeof body.mid!=='string')return json({error:'Oferta de mídia inválida.'},400);
      const own=await session(id,body.seat,body.sessionId);
      if(!own||own.kind!==body.kind)return json({error:'Sessão de mídia desconhecida.'},404);
      const published=await sfu(`/sessions/${body.sessionId}/tracks/new`,'POST',{
        sessionDescription:body.description,
        tracks:[{location:'local',mid:body.mid,trackName:body.kind}],
      });
      if(!published.sessionDescription)throw Error('A chamada não retornou uma resposta.');
      await database().prepare('UPDATE media_sessions SET active=1,touched_at=? WHERE session_id=?').bind(fresh(),body.sessionId).run();
      return json({description:published.sessionDescription});
    }
    if(body.type==='subscribe'){
      if(!body.publisherSessionId)return json({error:'Publicação inválida.'},400);
      const publisher=await database().prepare('SELECT * FROM media_sessions WHERE session_id=? AND room_id=? AND active=1 AND touched_at>?').bind(body.publisherSessionId,id,fresh()-aliveMs).first<Session>();
      if(!publisher||!kind(publisher.kind)||publisher.seat===body.seat)return json({error:'Esta transmissão não está disponível.'},404);
      const created=await sfu('/sessions/new','POST');
      if(!created.sessionId)throw Error('A chamada não criou uma sessão de escuta.');
      const received=await sfu(`/sessions/${created.sessionId}/tracks/new`,'POST',{
        tracks:[{location:'remote',sessionId:publisher.session_id,trackName:publisher.kind}],
      });
      if(!received.sessionDescription||!received.tracks?.[0]?.mid)throw Error('A chamada não retornou a mídia.');
      await database().prepare('INSERT INTO media_sessions (session_id,room_id,seat,kind,active,touched_at) VALUES (?,?,?,?,0,?)').bind(created.sessionId,id,body.seat,'receive',fresh()).run();
      return json({sessionId:created.sessionId,description:received.sessionDescription,mid:received.tracks[0].mid,kind:publisher.kind,seat:publisher.seat});
    }
    if(body.type==='answer'){
      if(!body.sessionId||body.description?.type!=='answer'||!body.description.sdp)return json({error:'Resposta de mídia inválida.'},400);
      const own=await session(id,body.seat,body.sessionId);
      if(!own||own.kind!=='receive')return json({error:'Sessão de escuta desconhecida.'},404);
      await sfu(`/sessions/${body.sessionId}/renegotiate`,'PUT',{sessionDescription:body.description});
      await database().prepare('UPDATE media_sessions SET touched_at=? WHERE session_id=?').bind(fresh(),body.sessionId).run();
      return json({ok:true});
    }
    if(body.type==='heartbeat'){
      if(!Array.isArray((body as any).sessionIds))return json({error:'Sessões inválidas.'},400);
      const ids=((body as any).sessionIds as unknown[]).filter(x=>typeof x==='string').slice(0,10);
      if(ids.length)await database().batch(ids.map(x=>database().prepare('UPDATE media_sessions SET touched_at=? WHERE room_id=? AND seat=? AND session_id=?').bind(fresh(),id,body.seat,x)));
      return json({publications:await listings(id)});
    }
    if(body.type==='leave'){
      if(!body.sessionId)return json({error:'Sessão inválida.'},400);
      await database().prepare('DELETE FROM media_sessions WHERE room_id=? AND seat=? AND session_id=?').bind(id,body.seat,body.sessionId).run();
      return json({ok:true});
    }
    return json({error:'Ação desconhecida.'},400);
  }catch(error){return json({error:error instanceof Error?error.message:'Não foi possível atualizar a chamada.'},502);}
}
