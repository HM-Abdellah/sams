import { API } from './api.js';
import { state } from './state.js';
import { ui } from './ui.js';

export function isSignatureDataUrl(value) {
    return typeof value === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value);
}

export function setupSignature({ canvas, clearButton, saveButton }) {
    if (!(canvas instanceof HTMLCanvasElement)) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let drawing = false;
    let dirty = false;
    let saveTimer = null;

    const point = (event) => {
        const rect = canvas.getBoundingClientRect();
        return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height };
    };

    const persist = async () => {
        if (!dirty || !state.classId) return;
        dirty = false;
        try {
            await API.saveSignature(state.classId, canvas.toDataURL('image/png'));
            ui.toast('Signature enregistrée.');
        } catch (error) {
            dirty = true;
            ui.toast(error.message || 'Impossible d’enregistrer la signature.', true);
        }
    };

    const scheduleSave = () => {
        dirty = true;
        clearTimeout(saveTimer);
        saveTimer = setTimeout(persist, 400);
    };

    canvas.addEventListener('pointerdown', (event) => {
        drawing = true;
        canvas.setPointerCapture?.(event.pointerId);
        const p = point(event);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        event.preventDefault();
    });

    canvas.addEventListener('pointermove', (event) => {
        if (!drawing) return;
        const p = point(event);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        scheduleSave();
        event.preventDefault();
    });

    const stop = () => { drawing = false; };
    canvas.addEventListener('pointerup', stop);
    canvas.addEventListener('pointercancel', stop);
    canvas.addEventListener('pointerleave', stop);

    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1f6feb';

    clearButton?.addEventListener('click', async () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        clearTimeout(saveTimer);
        if (!state.classId) return;
        try {
            await API.deleteSignature(state.classId);
            dirty = false;
            ui.toast('Signature effacée.');
        } catch (error) {
            ui.toast(error.message || 'Impossible d’effacer la signature.', true);
        }
    });

    saveButton?.addEventListener('click', persist);

    window.addEventListener('sams:signature-load', (event) => {
        if (!isSignatureDataUrl(event.detail)) return;
        const image = new Image();
        image.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
            dirty = false;
        };
        image.src = event.detail;
    });
}
