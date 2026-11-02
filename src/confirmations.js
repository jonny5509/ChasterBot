export function consumeConfirmation(pending,id,user,kind,action,confirmAction,cancelAction,now=Date.now(),ttl=120000){
  const entry=pending.get(id);
  if(!entry||entry.user!==user||entry.kind!==kind)return {status:"invalid"};
  if(action!==confirmAction&&action!==cancelAction)return {status:"invalid"};
  pending.delete(id);
  if(!Number.isFinite(entry.created)||now-entry.created>ttl||now<entry.created)return {status:"expired"};
  return {status:action===cancelAction?"cancelled":"confirmed",entry};
}
