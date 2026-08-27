export const state={user:null,csrf:'',classes:[],students:[],attendance:[],classId:null,weekStart:'',tab:'attendance'};
export function setState(patch){Object.assign(state,patch);window.dispatchEvent(new CustomEvent('sams:state'));}
