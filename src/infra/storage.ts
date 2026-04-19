// GM_setValue / GM_getValue 统一封装,所有 key 加 ccs: 前缀
// 详见 docs/design/08-packaging-persistence.md

const PREFIX = 'ccs:'

export const storage = {
  async get<T>(key: string): Promise<T | null> {
    const raw = await GM.getValue<string | null>(PREFIX + key, null)
    if (raw === null)
      return null
    try {
      return JSON.parse(raw) as T
    }
    catch (err) {
      console.error(`[ccs] storage.get("${key}") JSON parse failed`, err)
      return null
    }
  },

  async set<T>(key: string, value: T): Promise<void> {
    await GM.setValue(PREFIX + key, JSON.stringify(value))
  },

  async delete(key: string): Promise<void> {
    await GM.deleteValue(PREFIX + key)
  },

  async listKeys(subPrefix = ''): Promise<string[]> {
    const all = await GM.listValues()
    const fullPrefix = PREFIX + subPrefix
    return all
      .filter(k => k.startsWith(fullPrefix))
      .map(k => k.slice(PREFIX.length))
  },
}
