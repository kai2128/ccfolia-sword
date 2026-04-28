// 整数算术表达式求值。支持 + - * / 和括号。
// HP/MP 编辑器允许 GM 输入 "+1-1/2*2" / "10*2+5" / "(1+2)*3" 之类。
// 内部用浮点算,最终 Math.ceil 到整数(HP/MP 都是整数,小数一律向上取整)。
// 不允许任何字符以外的输入(没函数 / 没变量),tokenize 失败返 null。
// 任何解析 / 求值异常一律捕获并返 null,调用方靠返回值判定即可。

type Token
  = | { type: 'num', value: number }
    | { type: 'op', op: '+' | '-' | '*' | '/' | '(' | ')' }

function tokenize(input: string): Token[] | null {
  const s = input.replace(/\s+/g, '')
  const tokens: Token[] = []
  let i = 0
  while (i < s.length) {
    const c = s[i]
    if (c >= '0' && c <= '9') {
      let j = i
      while (j < s.length && s[j] >= '0' && s[j] <= '9') j++
      tokens.push({ type: 'num', value: Number(s.slice(i, j)) })
      i = j
    }
    else if (c === '+' || c === '-' || c === '*' || c === '/' || c === '(' || c === ')') {
      tokens.push({ type: 'op', op: c })
      i++
    }
    else {
      return null
    }
  }
  return tokens
}

class Parser {
  private idx = 0
  constructor(private readonly tokens: Token[]) {}

  eof(): boolean {
    return this.idx >= this.tokens.length
  }

  private peek(): Token | undefined {
    return this.tokens[this.idx]
  }

  private consume(): Token {
    const t = this.tokens[this.idx]
    if (!t)
      throw new Error('unexpected end of input')
    this.idx++
    return t
  }

  // expr = term ((+ | -) term)*
  parseExpr(): number {
    let val = this.parseTerm()
    while (!this.eof()) {
      const t = this.peek()!
      if (t.type !== 'op' || (t.op !== '+' && t.op !== '-'))
        break
      this.consume()
      const rhs = this.parseTerm()
      val = t.op === '+' ? val + rhs : val - rhs
    }
    return val
  }

  // term = factor ((* | /) factor)*
  private parseTerm(): number {
    let val = this.parseFactor()
    while (!this.eof()) {
      const t = this.peek()!
      if (t.type !== 'op' || (t.op !== '*' && t.op !== '/'))
        break
      this.consume()
      const rhs = this.parseFactor()
      val = t.op === '*' ? val * rhs : val / rhs
    }
    return val
  }

  // factor = number | (+|-) factor | '(' expr ')'
  private parseFactor(): number {
    const t = this.peek()
    if (!t)
      throw new Error('unexpected end of input')
    if (t.type === 'op' && (t.op === '+' || t.op === '-')) {
      this.consume()
      const v = this.parseFactor()
      return t.op === '-' ? -v : v
    }
    if (t.type === 'op' && t.op === '(') {
      this.consume()
      const v = this.parseExpr()
      const close = this.consume()
      if (close.type !== 'op' || close.op !== ')')
        throw new Error('mismatched parens')
      return v
    }
    if (t.type === 'num') {
      this.consume()
      return t.value
    }
    throw new Error('unexpected token')
  }
}

// 解析 GM 在 NumberEdit 里的输入,根据前缀决定如何应用到 current:
//   '=' 前缀          → absolute(允许负)。例:=10、=-5、=10+5
//   + / - 前缀        → delta(增量),按 |delta| 向上取整再加回 current。例:-3/2 当作伤害 1.5 → 进位到 2
//   * / / 前缀        → 在 current 上做算术,对最终值向上取整。例:/2 = HP 减半向上取整
//   其它              → absolute(纯表达式)。例:17、2*5、(1+2)*3
// 失败一律返 null,调用方退出 edit 模式即可。
export function applyAdjustment(input: string, current: number): number | null {
  const s = input.trim()
  if (!s)
    return null
  if (s.startsWith('='))
    return evaluateExpression(s.slice(1))
  if (s.startsWith('+') || s.startsWith('-')) {
    const delta = evaluateRaw(s)
    if (delta === null)
      return null
    // |delta| 向上取整:伤害/治疗都按"放大效果方向"进位(正数 ceil、负数 floor)
    return current + (delta >= 0 ? Math.ceil(delta) : Math.floor(delta))
  }
  if (s.startsWith('*') || s.startsWith('/'))
    return evaluateExpression(`${current}${s}`)
  return evaluateExpression(s)
}

function evaluateRaw(input: string): number | null {
  const tokens = tokenize(input)
  if (!tokens || tokens.length === 0)
    return null
  try {
    const p = new Parser(tokens)
    const v = p.parseExpr()
    if (!p.eof())
      return null
    if (!Number.isFinite(v))
      return null
    return v
  }
  catch {
    return null
  }
}

export function evaluateExpression(input: string): number | null {
  const v = evaluateRaw(input)
  return v === null ? null : Math.ceil(v)
}
