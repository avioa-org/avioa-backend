'use strict';
// Compatibility adapter for the existing, tested persistence contract.
function sql(text){let n=0;let value=text.replace(/\b(workspace_state|audit_history|workspace_roles)\b/g,'offers_$1');const ignore=/INSERT OR IGNORE INTO/.test(value);value=value.replace(/INSERT OR IGNORE INTO/g,'INSERT INTO').replace(/\?/g,()=>'$'+(++n));if(ignore)value+=' ON CONFLICT DO NOTHING';return value;}
class Statement {
 constructor(db,text,values=[]){this.db=db;this.text=text;this.values=values;}
 bind(...values){return new Statement(this.db,this.text,values);}
 async first(){if(/^SELECT role FROM workspace_roles WHERE user_id=\?$/.test(this.text))return{role:this.db.role};const rows=await this.db.client.$queryRawUnsafe(sql(this.text),...this.values);return rows[0]||null;}
 async all(){return{results:await this.db.client.$queryRawUnsafe(sql(this.text),...this.values)};}
 async run(){return{meta:{changes:await this.db.client.$executeRawUnsafe(sql(this.text),...this.values)}};}
}
class PostgresAdapter {
 constructor(client,role){this.client=client;this.role=role;}
 prepare(text){return new Statement(this,text);}
 async batch(statements){return this.client.$transaction(async transaction=>{await transaction.$queryRawUnsafe('SELECT pg_advisory_xact_lock(894612)');const db=new PostgresAdapter(transaction,this.role);const results=[];for(const s of statements)results.push(await new Statement(db,s.text,s.values).run());return results;});}
}
module.exports={PostgresAdapter,sql};
