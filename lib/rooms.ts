import { env } from 'cloudflare:workers';
export function database(){if(!env.DB)throw Error('A mesa está indisponível. Tente novamente.');return env.DB;}
export const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
