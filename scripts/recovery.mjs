import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
const base=process.env.BASE_URL;
async function api(path,body){const r=await fetch(base+'/api'+path,{method:body?'POST':'GET',headers:body instanceof FormData?{'X-Roadbook-Request':'1'}:{'X-Roadbook-Request':'1','Content-Type':'application/json'},body:body instanceof FormData?body:body?JSON.stringify(body):undefined});assert(r.ok,await r.clone().text());return r.json();}
async function capture(){const snapshot=await api('/state');const images={};for(const a of snapshot.state.attachments){for(const variant of ['original','thumb']){const r=await fetch(`${base}/api/attachments/${a.id}/${variant}`);assert(r.ok);images[a.id+variant]=createHash('sha256').update(Buffer.from(await r.arrayBuffer())).digest('hex');}}return {snapshot,images};}
if(process.argv[2]==='seed'){
 const initial=await api('/state');const vehicle=await api('/vehicles',{name:'Recovery fixture',kind:'car',members:[initial.profile_id],ownership_start:'2025-01-01'});
 const entry=await api('/entries',{vehicle_id:vehicle.id,kind:'fuel',date:'2025-01-01',amount_minor:6000,volume_ml:30000,distance_m:500000,tank:'unknown'});
 const form=new FormData();form.set('entry_id',entry.id);form.set('purpose','receipt');form.set('file',new File([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC','base64')],'synthetic.png',{type:'image/png'}));await api('/attachments',form);
 process.stdout.write(JSON.stringify(await capture()));
}else if(process.argv[2]==='verify'){
 assert.deepEqual(await capture(),JSON.parse(readFileSync(0,'utf8')));console.log('Restored records, statistics, originals and thumbnails match the backup.');
}else throw new Error('seed or verify required');
