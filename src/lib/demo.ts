/*
 * The demo family lets anyone try HomeFund without signing up. Each visit
 * gets its own short-lived account, so visitors never see each other's
 * changes. Demo accounts are removed after DEMO_LIFETIME_HOURS.
 */

export const DEMO_EMAIL_DOMAIN = "demo.homefund.motionflowstudio.com";
export const DEMO_LIFETIME_HOURS = 24;

export function isDemoEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith(`@${DEMO_EMAIL_DOMAIN}`);
}
