// Server-rendering smoke coverage for the shared route/component graph.
// This checks rendering failures, not browser layout or keyboard behaviour.
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const repo = dirname(dirname(fileURLToPath(import.meta.url)));
const temporary = mkdtempSync(join(tmpdir(), 'studybg-render-'));
const output = join(temporary, 'smoke.cjs');
try {
  await build({
    stdin: { contents: `
      import React from 'react';
      import {renderToString} from 'react-dom/server';
      import App from './src/App';
      import {QuickFitModal} from './src/components/QuickFitModal';
      const storage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};
      globalThis.localStorage=storage;globalThis.sessionStorage=storage;
      for(const hash of ['', '#/apply','#/account','#/calendar','#/review','#/privacy','#/terms','#/gdpr','#/accessibility']){
        globalThis.window={location:{hash,search:'',href:'https://example.test/'+hash},matchMedia:()=>({matches:false})};
        const html=renderToString(React.createElement(App));
        if(!html.includes('main-content'))throw new Error('Missing page '+hash);
        console.log('Rendered route: '+(hash||'home'));
      }
      const quick=renderToString(React.createElement(QuickFitModal,{isOpen:true,onClose:()=>{},onStartApplication:()=>{}}));
      if(!quick.includes('Country issuing your school qualification')||!quick.includes('disabled'))throw new Error('Quick Fit initial state invalid');
      console.log('Quick Fit starts empty and continuation is disabled');
    `, resolveDir: repo, loader: 'tsx' },
    bundle: true, platform: 'node', format: 'cjs',
    define: { 'import.meta.env': '{}' }, outfile: output, logLevel: 'silent',
  });
  const result = spawnSync(process.execPath, [output], { stdio: 'inherit' });
  process.exitCode = result.status ?? 1;
} finally { rmSync(temporary, {recursive:true,force:true}); }
