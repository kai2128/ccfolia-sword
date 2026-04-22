export function uuid(): string {
  const cryptoValue = (globalThis as { crypto?: Crypto }).crypto
  if (cryptoValue?.randomUUID)
    return cryptoValue.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
