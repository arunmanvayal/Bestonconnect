/** Token refresh and repeated sign-in notifications are not identity changes. */
export function sessionIdentityChanged(previous: string | null | undefined, next: string | null) {
  return previous !== undefined && previous !== next;
}
export const ENTRY_QUERY_DEFAULTS = {
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;