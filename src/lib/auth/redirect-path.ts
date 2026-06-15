/** Safe in-app redirect target from ?redirect= (blocks open redirects). */
export function getPostLoginPath(): string {
  if (typeof window === "undefined") return "/dashboard";

  const value = new URLSearchParams(window.location.search).get("redirect");
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }

  return value;
}
