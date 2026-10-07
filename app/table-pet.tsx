'use client';
import {useEffect,useRef,useState} from 'react';
import type {Card,Game,Meld} from '../lib/game';
import PetAvatar,{type PetTarget} from './pet-avatar';

type TableState={id:string;revision:number;round:number;status:Game['status'];stock:number;mortos:number[];discard:Card[];melds:Meld[]};

export default function TablePet({game,dragCard,dragOverMeld}:{game:TableState;dragCard:string|null;dragOverMeld:string|null}){
 const [target,setTarget]=useState<PetTarget>('idle');
 const previous=useRef<TableState|null>(null);
 const reset=useRef<ReturnType<typeof setTimeout>|null>(null);

 useEffect(()=>{
  if(dragCard){
   if(reset.current)clearTimeout(reset.current);
   reset.current=null;
   setTarget(dragOverMeld?'meld':'hand');
  }else if(!reset.current)setTarget('idle');
 },[dragCard,dragOverMeld]);

 useEffect(()=>{
  const before=previous.current;
  previous.current=game;
  if(!before||before.id!==game.id||before.round!==game.round||before.revision>=game.revision||game.status!=='playing')return;
  let next:PetTarget|null=null;
  if(game.mortos.length<before.mortos.length)next='morto';
  else if(game.melds.reduce((n,m)=>n+m.cards.length,0)>before.melds.reduce((n,m)=>n+m.cards.length,0))next='meld';
  else if(game.discard.at(-1)?.id!==before.discard.at(-1)?.id||game.discard.length<before.discard.length)next='discard';
  else if(game.stock<before.stock)next='monte';
  if(!next)return;
  if(reset.current)clearTimeout(reset.current);
  setTarget(next);
  reset.current=setTimeout(()=>{setTarget('idle');reset.current=null;},1400);
 },[game]);

 useEffect(()=>()=>{if(reset.current)clearTimeout(reset.current);},[]);

 return <div className="table-pet"><PetAvatar target={target}/></div>;
}
