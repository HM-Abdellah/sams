export function calculateAttendancePercentage(present, total) {
    if (!Number.isFinite(present) || !Number.isFinite(total) || total <= 0) {
        return 0;
    }
    return Math.max(0, Math.min(100, (present / total) * 100));
}
