// Resolves proposed highlight rules against the loaded model's mesh metadata.
// Matching is exact on userData.anatomy_name (unique in the GLB). Side and provenance are checked
// so a mirrored left counterpart can never stand in for a missing right-sided structure.

const SIDE_SUFFIX={R:'.r',L:'.l'};

export function resolveHighlightGroup(parts,group,side){
  const byName=new Map();
  for(const part of parts){const name=part.userData?.anatomy_name;if(name)byName.set(name,part);}
  const found=[],missing=[];
  for(const name of group.anatomyNames){
    const part=byName.get(name);
    const sideMatches=!side||(part?.userData.anatomical_side===side&&name.toLowerCase().endsWith(SIDE_SUFFIX[side]));
    if(part&&sideMatches)found.push(part);else missing.push(name);
  }
  return {id:group.id,found,missing};
}

export function resolveHighlights(parts,groups,side){
  const resolved=new Map();
  for(const group of groups)resolved.set(group.id,resolveHighlightGroup(parts,group,side));
  return resolved;
}
