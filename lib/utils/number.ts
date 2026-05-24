/** PostgreSQL INT4 범위(0 ~ 2,147,483,647)에 맞게 정수를 클램핑 */
export function clampInt(n: number): number {
  return Math.min(Math.max(0, Math.round(n)), 2_147_483_647)
}
