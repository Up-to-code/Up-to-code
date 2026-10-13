const escape = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export function languageShares(profile) {
 const languages=profile.languages.filter(language=>Number.isFinite(language.bytes)&&language.bytes>0).sort((a,b)=>b.bytes-a.bytes);
 const total=languages.reduce((sum,language)=>sum+language.bytes,0);
 if(!total)throw new Error('No language byte measurements available.');
 const rows=languages.slice(0,6).map(language=>({name:language.name,bytes:language.bytes,color:language.color,percentage:language.bytes/total*100}));
 const remaining=languages.slice(6);
 if(remaining.length){const bytes=remaining.reduce((sum,language)=>sum+language.bytes,0);rows.push({name:'Other',bytes,color:'#8b949e',percentage:bytes/total*100});}
 return rows;
}
export function languageBarSvg(profile,theme='light') {
 const rows=languageShares(profile);let x=0;
 const bars=rows.map(row=>{const width=row.percentage*8;const markup='<rect x="'+x.toFixed(4)+'" y="2" width="'+width.toFixed(4)+'" height="10" fill="'+escape(row.name==='Other'?(theme==='dark'?'#8b949e':'#8c959f'):row.color)+'"/>';x+=width;return markup;}).join('');
 return '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="14" viewBox="0 0 800 14" role="img" aria-labelledby="title desc"><title id="title">Languages by source bytes</title><desc id="desc">'+escape(rows.map(row=>row.name+' '+row.percentage.toFixed(2)+'%').join(', '))+'</desc><defs><clipPath id="bar"><rect y="2" width="800" height="10" rx="5"/></clipPath></defs><g clip-path="url(#bar)">'+bars+'</g></svg>\n';
}
export function languageProfileMarkdown(profile) {
 const rows=languageShares(profile);
 return ['<picture>','  <source media="(prefers-color-scheme: dark)" srcset="./generated/languages-dark.svg" />','  <source media="(prefers-color-scheme: light)" srcset="./generated/languages-light.svg" />','  <img width="800" height="14" alt="Language distribution by source bytes; percentages are listed below" src="./generated/languages-light.svg" />','</picture>','','| Language | Share of source bytes |','| --- | ---: |',...rows.map(row=>'| '+row.name.replaceAll('|','\\|')+' | '+row.percentage.toFixed(2)+'% |'),'','<sub>'+profile.languageRepositoryCount+' repositories · '+profile.updatedLabel+' · <a href="./generated/languages.json">Full data</a></sub>'].join('\n');
}
