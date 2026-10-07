import {playBotTurn} from '../../../../../lib/bot';
import {publicGame,type Game} from '../../../../../lib/game';
import {database,json} from '../../../../../lib/rooms';

export async function POST(req:Request,{params}:any){
 try{
  const {id}=await params,{revision}=await req.json() as {revision:number};
  const row=await database().prepare('SELECT state,revision FROM rooms WHERE id=?').bind(id).first<{state:string;revision:number}>();
  if(!row)return json({error:'Mesa não encontrada.'},404);
  if(row.revision!==revision)return json({error:'A mesa mudou. Atualize a partida.'},409);
  const next=playBotTurn(JSON.parse(row.state) as Game);next.revision=row.revision+1;
  const result=await database().prepare('UPDATE rooms SET state=?,revision=? WHERE id=? AND revision=?').bind(JSON.stringify(next),next.revision,id,row.revision).run();
  if(!result.meta.changes)return json({error:'Outra jogada aconteceu. Atualize a partida.'},409);
  return json(publicGame(next,0));
 }catch(e){return json({error:e instanceof Error?e.message:'Não foi possível jogar.'},400);}
}
