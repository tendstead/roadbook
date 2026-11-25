import {readFileSync,readdirSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';

// Include complete runtime dependency notices in distributed browser assets.
const web=resolve(import.meta.dirname,'../web');
const lock=JSON.parse(readFileSync(resolve(web,'package-lock.json'),'utf8'));
const sections=[];
for(const [name,pkg] of Object.entries(lock.packages)){
 if(!name||pkg.dev)continue;
 const dir=resolve(web,name);
 const notices=readdirSync(dir).filter(n=>/^(licen[cs]e|copying|notice)(\..*)?$/i.test(n));
 if(!notices.length){
  // These upstream packages declare MIT but publish only README attribution.
  // Preserve that declaration and metadata rather than inventing a copyright.
  if(!['node_modules/is-reference','node_modules/locate-character'].includes(name)||pkg.license!=='MIT')throw new Error('Runtime dependency is missing license notices: '+name);
  const metadata=JSON.parse(readFileSync(resolve(dir,'package.json'),'utf8'));
  sections.push(`${name} ${pkg.version}\nDeclared license: MIT\nAuthor: ${metadata.author}\nUpstream: ${metadata.repository.url}\n${readFileSync(resolve(dir,'README.md'),'utf8')}`);
  continue;
 }
 sections.push(`${name} ${pkg.version}\n${notices.map(n=>readFileSync(resolve(dir,n),'utf8')).join('\n')}`);
}
mkdirSync(resolve(web,'static'),{recursive:true});
writeFileSync(resolve(web,'static/license.txt'),readFileSync(resolve(web,'../LICENSE')));
writeFileSync(resolve(web,'static/third-party-notices.txt'),sections.join('\n\n--------------------\n\n'));
