import ts from 'typescript';
import {readFile,writeFile,unlink} from 'node:fs/promises';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const component=new URL('../app/pet-avatar.tsx',import.meta.url);
const temporary=new URL('../app/pet-avatar.export.mjs',import.meta.url);
const output=new URL('../public/pet-avatar.svg',import.meta.url);
const source=await readFile(component,'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
await writeFile(temporary,compiled);
try {
 const {default:PetAvatar}=await import(temporary.href);
 const svg=renderToStaticMarkup(createElement(PetAvatar,{target:'idle'}));
 await writeFile(output,`<?xml version="1.0" encoding="UTF-8"?>\n${svg}\n`);
} finally {await unlink(temporary);}
