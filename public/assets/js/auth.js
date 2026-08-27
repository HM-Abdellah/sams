export function isAuthenticated(user) {
    return Boolean(user && Number.isInteger(user.id) && user.is_active === true);
}
