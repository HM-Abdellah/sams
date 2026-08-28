export const state = { user:null, csrf:'', classes:[], students:[], attendance:[], classId:null, month:new Date().toISOString().slice(0,7), tab:'attendance', filter:'all', search:'' };
export function setState(patch){Object.assign(state,patch);window.dispatchEvent(new CustomEvent('sams:state',{detail:{...state}}));}
export function resetState(){setState({user:null,csrf:'',classes:[],students:[],attendance:[],classId:null,month:new Date().toISOString().slice(0,7),tab:'attendance',filter:'all',search:''});}
