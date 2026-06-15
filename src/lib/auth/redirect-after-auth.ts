/** Full navigation after login/signup so the session cookie is picked up reliably. */
export function redirectAfterAuth(path: string) {
  window.location.assign(path);
}
