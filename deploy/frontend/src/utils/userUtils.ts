export const getUserId = (): string | null => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
        try {
            const user = JSON.parse(userStr);
            return user.id;
        } catch (e) {
            console.error("Failed to parse user", e);
        }
    }
    return null;
};
