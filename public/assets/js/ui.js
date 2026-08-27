export function renderMessage(container, message) {
    if (!(container instanceof HTMLElement)) {
        throw new TypeError('renderMessage requires a valid HTMLElement.');
    }
    container.textContent = String(message ?? '');
}
