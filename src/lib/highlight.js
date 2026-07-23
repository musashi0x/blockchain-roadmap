/* Syntax highlighter + escaping helpers, ported verbatim from the old app.js.
   Returns HTML strings, injected via dangerouslySetInnerHTML in CodeBlock. */

export function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
export function attr(s) { return esc(s).replace(/"/g, '&quot;') }

const KW = [
  'pragma', 'solidity', 'contract', 'interface', 'library', 'abstract', 'is', 'using',
  'import', 'from', 'as', 'function', 'constructor', 'receive', 'fallback', 'modifier',
  'event', 'emit', 'error', 'revert', 'require', 'assert', 'returns', 'return',
  'public', 'private', 'internal', 'external', 'view', 'pure', 'payable',
  'memory', 'storage', 'calldata', 'immutable', 'constant', 'override', 'virtual',
  'indexed', 'unchecked', 'assembly', 'new', 'delete', 'if', 'else', 'for', 'while',
  'do', 'break', 'continue', 'try', 'catch', 'throw', 'switch', 'case', 'default',
  'mapping', 'struct', 'enum', 'type', 'let', 'const', 'var', 'async', 'await',
  'class', 'extends', 'export', 'this', 'super', 'null', 'undefined', 'true', 'false',
  'typeof', 'instanceof', 'in', 'of', 'template', 'signal', 'component', 'echo', 'set',
  'module', 'fun', 'entry', 'has', 'copy', 'drop', 'store', 'key', 'mut', 'acquires'
].join('|')

const TY = [
  'u?int\\d*', 'u8', 'u16', 'u32', 'u64', 'u128', 'u256', 'address', 'bool', 'bytes\\d*', 'string', 'byte', 'vector', 'void', 'any',
  'number', 'boolean', 'bigint', 'Promise', 'Uint8Array', 'BigInt', 'Math', 'JSON',
  'console', 'msg', 'block', 'tx', 'abi', 'vm', 'wei', 'gwei', 'ether'
].join('|')

const HASH_LANGS = /^(bash|sh|shell|zsh|toml|yaml|yml|ini|conf|python|env)$/i

export function highlight(src, lang) {
  let s = esc(src)
  const comment = '\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/' +
    (HASH_LANGS.test(lang || '') ? '|#[^\\n]*' : '')
  const str = '"(?:[^"\\\\\\n]|\\\\.)*"|\'(?:[^\'\\\\\\n]|\\\\.)*\''
  const nums = '\\b0x[0-9a-fA-F]+\\b|\\b\\d[\\d_]*(?:\\.\\d+)?(?:e[+-]?\\d+)?\\b'

  const rx = new RegExp(
    '(' + comment + ')|(' + str + ')|(' + nums + ')|' +
    '\\b(' + KW + ')\\b|\\b(' + TY + ')\\b|' +
    '\\b([A-Za-z_$][\\w$]*)(?=\\s*\\()', 'g')

  return s.replace(rx, function (m, c, q, n, k, t, f) {
    if (c) return '<span class="tk-com">' + c + '</span>'
    if (q) return '<span class="tk-str">' + q + '</span>'
    if (n) return '<span class="tk-num">' + n + '</span>'
    if (k) return '<span class="tk-kw">' + k + '</span>'
    if (t) return '<span class="tk-typ">' + t + '</span>'
    if (f) return '<span class="tk-fn">' + f + '</span>'
    return m
  })
}
