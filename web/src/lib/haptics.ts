/** The phone vibrates on some taps; browsers don't, so these do nothing. */
export const selectionAsync = async () => {};
export const notificationAsync = async (_type?: unknown) => {};
export const NotificationFeedbackType = { Success: 'success', Warning: 'warning', Error: 'error' } as const;
