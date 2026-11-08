// Notification email is opt-in. Clinical scheduling continues independently.
export function emailNotificationsEnabled(value = process.env.EMAIL_NOTIFICATIONS_ENABLED): boolean {
  return value?.trim().toLowerCase() === 'true';
}
