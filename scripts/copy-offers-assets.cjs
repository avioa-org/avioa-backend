const {existsSync,mkdirSync,copyFileSync}=require('node:fs');const{join}=require('node:path');
const root=process.cwd(),candidates=[join(root,'dist','src','infrastructure'),join(root,'dist','infrastructure')];let copied=0;
for(const folder of candidates){if(!existsSync(join(folder,'offers-runtime')))continue;
 for(const [name,files]of [['offers-runtime',['runtime.cjs','postgres-adapter.cjs']],['hunter-sync',['hunter-sync.cjs']]]){
  mkdirSync(join(folder,name),{recursive:true});for(const file of files){const src=join(root,'src','infrastructure',name,file);if(!existsSync(src))throw Error('Falta asset de Ofertas: '+name+'/'+file);copyFileSync(src,join(folder,name,file));copied++;}
 }
}
if(!copied)throw Error('No se encontró la infraestructura compilada de Ofertas.');console.log('Ofertas: '+copied+' assets CJS copiados a dist.');
