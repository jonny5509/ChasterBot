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
