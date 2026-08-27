export function isSignatureDataUrl(value) {
    return typeof value === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value);
}
