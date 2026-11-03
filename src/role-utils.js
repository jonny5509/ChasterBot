export function normalizeLockRows(value){
  if(Array.isArray(value))return value;
  if(Array.isArray(value?.locks))return value.locks;
  if(Array.isArray(value?.items))return value.items;
  if(Array.isArray(value?.data))return value.data;
  if(Array.isArray(value?.results))return value.results;
  return [];
}
export function isActiveWearerLock(lock){
  const status=String(lock?.status||"").toLowerCase();
  return status==="locked"||status==="active";
}
export function shouldHaveWearerRole(value){
  return normalizeLockRows(value).some(isActiveWearerLock);
}
export function shouldHaveKeyholderRole(value){
  return normalizeLockRows(value).length>0;
}

export function getLockStatusRoleState(value){
  const locks=normalizeLockRows(value);
  return {
    locked:locks.some(lock=>String(lock?.status||"").toLowerCase()==="locked"),
    active:locks.some(lock=>String(lock?.status||"").toLowerCase()==="active")
  };
}

function lockStartTimestamp(lock){
  for(const key of ["lockedAt","startedAt","startDate","createdAt","created_at"]){
    const value=lock?.[key];
    if(value===undefined||value===null||value==="")continue;
    const numeric=typeof value==="number"||/^\d+(?:\.\d+)?$/.test(String(value))?Number(value):NaN;
    const timestamp=Number.isFinite(numeric)?(numeric<1e12?numeric*1000:numeric):Date.parse(value);
    if(Number.isFinite(timestamp)&&timestamp>0)return timestamp;
  }
  return null;
}
export function hasMinimumLockedDuration(value,minimumHours,now=Date.now()){
  const hours=Number(minimumHours);
  if(!Number.isFinite(hours)||hours<=0)return false;
  const threshold=hours*60*60*1000;
  return normalizeLockRows(value).some(lock=>{
    if(String(lock?.status||"").toLowerCase()!=="locked")return false;
    const started=lockStartTimestamp(lock);
    return started!==null&&now-started>=threshold;
  });
}
