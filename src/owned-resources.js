export function collectionRows(raw,...keys){
  if(Array.isArray(raw))return raw;
  for(const key of keys)if(Array.isArray(raw?.[key]))return raw[key];
  return [];
}
export function isOwnedResourceListed(raw,id,collectionKeys,...idKeys){
  if(id===undefined||id===null||String(id)==="")return false;
  const wanted=String(id);
  return collectionRows(raw,...collectionKeys).some(item=>
    item&&typeof item==="object"&&idKeys.some(key=>
      item[key]!==undefined&&item[key]!==null&&String(item[key])===wanted
    )
  );
}
