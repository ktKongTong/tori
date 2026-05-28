const API_PATH_PREFIXES = ["/admin", "/oauth", "/proxy"] as const;

export function isApiRequestPath(pathname: string) {
  return (
    pathname === "/account" ||
    pathname === "/health" ||
    API_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}
