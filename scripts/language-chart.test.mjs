import test from 'node:test';
import assert from 'node:assert/strict';
import {languageShares} from './language-chart.mjs';
test('all measured bytes are retained when small languages are grouped',()=>{
 const input={languages:Array.from({length:9},(_,i)=>({name:'Language '+i,bytes:i+1,color:'#3178c6'}))};
 const result=languageShares(input);
 assert.equal(result[0].name,'Language 8');assert.equal(result.length,7);assert.equal(result.at(-1).bytes,6);
 assert.equal(result.reduce((sum,row)=>sum+row.bytes,0),45);
 assert.ok(Math.abs(result.reduce((sum,row)=>sum+row.percentage,0)-100)<1e-10);
});
test('missing measurements are not replaced with invented shares',()=>assert.throws(()=>languageShares({languages:[]})));
