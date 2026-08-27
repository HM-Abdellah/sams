import { API } from './api.js';
import { state } from './state.js';
import { ui } from './ui.js';

export function isSignatureDataUrl(value) {
  return typeof value === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value);
}

export function setupSignature({canvas, clearButton, saveButton}) {
  if (!(canvas instanceof HTMLCanvasElement)) return;
  const ctx = canvas.getContext('2d');
  const resize = () => { ctx.setTransform(canvas.width / canvas.clientWidth, 0, 0, canvas.height / canvas.clientHeight, 0, 0); };
  let drawing = false;
  const point = event => {
    const rect = canvas.getBoundingClientRect();
    const source = event.touches?.[0] || event;
    return {x:(source.clientX-rect.left)/rect.width*canvas.width, y:(source.clientY-rect.top)/rect.height*canvas.height};
  };
  const start = e => { drawing=true; const p=point(e); ctx.beginPath(); ctx.moveTo(p.x,p.y); e.preventDefault(); };
  const draw = e => { if(!drawing)return; const p=point(e); ctx.lineTo(p.x,p.y); ctx.stroke(); e.preventDefault(); };
  const stop = () => { drawing=false; };
  ctx.lineWidth=3; ctx.lineCap='round'; ctx.lineJoin='round'; ctx.strokeStyle='#1f6feb';
  canvas.addEventListener('pointerdown', start); canvas.addEventListener('pointermove', draw); window.addEventListener('pointerup', stop);
  window.addEventListener('resize', resize); resize();
  clearButton?.addEventListener('click',()=>ctx.clearRect(0,0,canvas.width,canvas.height));
  saveButton?.addEventListener('click',async()=>{
    if(!state.classId)return ui.toast('Sélectionnez une classe.',true);
    try{await API.saveSignature(state.classId,canvas.toDataURL('image/png'));ui.toast('Signature enregistrée.');}
    catch(e){ui.toast(e.message,true);}
  });
  window.addEventListener('sams:signature-load',e=>{
    if(!isSignatureDataUrl(e.detail))return;
    const img=new Image(); img.onload=()=>{ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);}; img.src=e.detail;
  });
}
