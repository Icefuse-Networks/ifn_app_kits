/**
 * Comprehensive Banned Word Patterns
 *
 * This file contains an extensive list of offensive terms with regex patterns
 * designed to catch leetspeak variations and obfuscation attempts common in
 * gaming communities.
 *
 * Used by:
 * - Clans plugin (clan tag validation)
 * - Chat Manager plugin (message filtering)
 * - Player name validation
 * - Any other content moderation
 *
 * Pattern Strategy:
 * - Leetspeak substitutions: a→[a4@], e→[e3], i→[i1!|l], etc.
 * - Separator patterns: [\\s._-]* to catch n.i.g, n-i-g, n_i_g
 * - Case-insensitive matching (handled in service)
 */

import type { ModerationCategory } from '@/services/moderation'

export interface BannedPattern {
  pattern: string
  isRegex: boolean
  category: ModerationCategory
  severity: number // 1=mild, 2=moderate, 3=strong, 4=extreme
  reason: string
}

/**
 * Comprehensive list of banned patterns
 * Organized by category for maintainability
 */
export const BANNED_PATTERNS: BannedPattern[] = [
  // ==========================================================================
  // RACIAL SLURS (Severity 4 - Extreme)
  // ==========================================================================

  // N-word and variants
  { pattern: 'n[i1!|l\\s._-]*[g69]+[g69]*[e3]*[r]*s?', isRegex: true, category: 'racial', severity: 4, reason: 'Racial slur' },
  { pattern: 'n[i1!|l\\s._-]*[g69]+[g69]*[a4@]+s?', isRegex: true, category: 'racial', severity: 4, reason: 'Racial slur' },
  { pattern: 'n[\\s._-]*i[\\s._-]*g[\\s._-]*g[\\s._-]*e[\\s._-]*r', isRegex: true, category: 'racial', severity: 4, reason: 'Racial slur with separators' },
  { pattern: 'n[\\s._-]*i[\\s._-]*g[\\s._-]*g[\\s._-]*a', isRegex: true, category: 'racial', severity: 4, reason: 'Racial slur with separators' },
  { pattern: 'n[i1!|l]+gg?[s5$]?', isRegex: true, category: 'racial', severity: 4, reason: 'Racial slur fragment' },
  { pattern: 'n[e3]+gr[o0]+', isRegex: true, category: 'racial', severity: 4, reason: 'Racial slur' },

  // Other racial slurs
  { pattern: 'ch[i1!|l\\s._-]*n[k|<]+s?', isRegex: true, category: 'racial', severity: 4, reason: 'Racial slur' },
  { pattern: 'sp[i1!|l\\s._-]*[c(<{]+s?', isRegex: true, category: 'racial', severity: 4, reason: 'Racial slur' },
  { pattern: 'g[o0]+[o0]*[k|<]+s?', isRegex: true, category: 'racial', severity: 4, reason: 'Racial slur' },
  { pattern: 'k[i1!|l\\s._-]*k[e3]+s?', isRegex: true, category: 'racial', severity: 4, reason: 'Racial slur' },
  { pattern: 'w[e3]*t[\\s._-]*b[a4@]*[c(<{][k|<]+s?', isRegex: true, category: 'racial', severity: 4, reason: 'Racial slur' },
  { pattern: 'cr[a4@]+[c(<{]+[k|<]+[e3]*r?s?', isRegex: true, category: 'racial', severity: 4, reason: 'Racial slur' },
  { pattern: 't[o0]+w[e3]*l[\\s._-]*h[e3]+[a4@]+d', isRegex: true, category: 'racial', severity: 4, reason: 'Racial slur' },
  { pattern: 'r[a4@]+g[\\s._-]*h[e3]+[a4@]+d', isRegex: true, category: 'racial', severity: 4, reason: 'Racial slur' },
  { pattern: 's[a4@]+nd[\\s._-]*n[i1!|l]+[g69]+', isRegex: true, category: 'racial', severity: 4, reason: 'Racial slur' },
  { pattern: 'c[o0]+[o0]*n[s5$]?', isRegex: true, category: 'racial', severity: 4, reason: 'Racial slur' },
  { pattern: 'j[i1!|l]+g[a4@]+b[o0]+[o0]+', isRegex: true, category: 'racial', severity: 4, reason: 'Racial slur' },
  { pattern: 'd[a4@]+rk[i1!|l]+[e3]+s?', isRegex: true, category: 'racial', severity: 4, reason: 'Racial slur' },
  { pattern: 'p[o0]+r[c(<{]h[\\s._-]*m[o0]+nk[e3]+y?', isRegex: true, category: 'racial', severity: 4, reason: 'Racial slur' },
  { pattern: 'b[e3]+[a4@]+n[e3]*r?s?', isRegex: true, category: 'racial', severity: 3, reason: 'Racial slur (contextual)' },
  { pattern: 'w[o0]+g+s?', isRegex: true, category: 'racial', severity: 4, reason: 'Racial slur' },
  { pattern: 'z[i1!|l]+pp[e3]+r[\\s._-]*h[e3]+[a4@]+d', isRegex: true, category: 'racial', severity: 4, reason: 'Racial slur' },
  { pattern: 'p[a4@]+k[i1!|l]+s?', isRegex: true, category: 'racial', severity: 4, reason: 'Racial slur' },
  { pattern: 'c[a4@]+m[e3]+l[\\s._-]*j[o0]+[c(<{][k|<]+[e3]+y?', isRegex: true, category: 'racial', severity: 4, reason: 'Racial slur' },

  // ==========================================================================
  // LGBTQ+ SLURS (Severity 4 - Extreme)
  // ==========================================================================

  { pattern: 'f[a4@]+[g69]+[g69]*[o0]*[t7+]*s?', isRegex: true, category: 'lgbtq', severity: 4, reason: 'LGBTQ+ slur' },
  { pattern: 'f[a4@]+[g69]+[s5$]?', isRegex: true, category: 'lgbtq', severity: 4, reason: 'LGBTQ+ slur' },
  { pattern: 'f[\\s._-]*a[\\s._-]*g[\\s._-]*g[\\s._-]*o[\\s._-]*t', isRegex: true, category: 'lgbtq', severity: 4, reason: 'LGBTQ+ slur with separators' },
  { pattern: 'tr[a4@]*nn?[yý]+s?', isRegex: true, category: 'lgbtq', severity: 4, reason: 'LGBTQ+ slur' },
  { pattern: 'd[yý]+k[e3]+s?', isRegex: true, category: 'lgbtq', severity: 4, reason: 'LGBTQ+ slur' },
  { pattern: 'h[o0]+m[o0]+s?', isRegex: true, category: 'lgbtq', severity: 3, reason: 'LGBTQ+ slur (contextual)' },
  { pattern: 'qu[e3]+[e3]+r+s?', isRegex: true, category: 'lgbtq', severity: 3, reason: 'LGBTQ+ slur (contextual)' },
  { pattern: 'sh[e3]+m[a4@]+l[e3]+s?', isRegex: true, category: 'lgbtq', severity: 4, reason: 'LGBTQ+ slur' },
  { pattern: 'l[e3]+sb[o0]+s?', isRegex: true, category: 'lgbtq', severity: 3, reason: 'LGBTQ+ slur (contextual)' },
  { pattern: 'b[a4@]+tt[yý]+[\\s._-]*b[o0]+[yý]+', isRegex: true, category: 'lgbtq', severity: 4, reason: 'LGBTQ+ slur' },
  { pattern: 'b[e3]+nd[e3]+r', isRegex: true, category: 'lgbtq', severity: 3, reason: 'LGBTQ+ slur' },
  { pattern: 'l[a4@]+dy[\\s._-]*b[o0]+[yý]+', isRegex: true, category: 'lgbtq', severity: 3, reason: 'LGBTQ+ slur' },
  { pattern: 'h[e3]+[\\s._-]*sh[e3]+', isRegex: true, category: 'lgbtq', severity: 3, reason: 'LGBTQ+ slur' },
  { pattern: 'sh[i1!|l]+m', isRegex: true, category: 'lgbtq', severity: 4, reason: 'LGBTQ+ slur' },

  // ==========================================================================
  // SEXUAL SLURS & CONTENT (Severity 3-4)
  // ==========================================================================

  { pattern: 'wh[o0]+r[e3]+s?', isRegex: true, category: 'sexual', severity: 3, reason: 'Sexual slur' },
  { pattern: 'sl[u]+[t7+]+s?', isRegex: true, category: 'sexual', severity: 3, reason: 'Sexual slur' },
  { pattern: '[c(<{]+[u]+n+[t7+]+s?', isRegex: true, category: 'sexual', severity: 4, reason: 'Sexual slur' },
  { pattern: 'tw[a4@]+[t7+]+s?', isRegex: true, category: 'sexual', severity: 3, reason: 'Sexual slur' },
  { pattern: 'p[u]+[s5$]+[s5$]+[yý]+', isRegex: true, category: 'sexual', severity: 3, reason: 'Sexual slur' },
  { pattern: 'd[i1!|l]+[c(<{]+[k|<]?[s5$]?', isRegex: true, category: 'sexual', severity: 3, reason: 'Sexual content' },
  { pattern: 'c[o0]+[c(<{]+[k|<]+[s5$]?', isRegex: true, category: 'sexual', severity: 3, reason: 'Sexual content' },
  { pattern: 'p[e3]+n[i1!|l]+[s5$]', isRegex: true, category: 'sexual', severity: 3, reason: 'Sexual content' },
  { pattern: 'v[a4@]+g[i1!|l]+n[a4@]+', isRegex: true, category: 'sexual', severity: 3, reason: 'Sexual content' },
  { pattern: 'r[a4@]+p[e3]+[rd]?', isRegex: true, category: 'sexual', severity: 4, reason: 'Sexual violence' },
  { pattern: 'r[a4@]+p[i1!|l]+[s5$]+[t7+]', isRegex: true, category: 'sexual', severity: 4, reason: 'Sexual violence' },
  { pattern: 'c[o0]+[o0]*m[\\s._-]*[s5$]h[o0]+[t7+]', isRegex: true, category: 'sexual', severity: 3, reason: 'Sexual content' },
  { pattern: 'c[u]+m[\\s._-]*?[s5$]l[u]+[t7+]', isRegex: true, category: 'sexual', severity: 3, reason: 'Sexual content' },
  { pattern: 'j[i1!|l]+zz?', isRegex: true, category: 'sexual', severity: 2, reason: 'Sexual content' },
  { pattern: 'b[o0]+n[e3]+r', isRegex: true, category: 'sexual', severity: 2, reason: 'Sexual content' },
  { pattern: '[e3]+r[e3]+[c(<{]+[t7+]+[i1!|l]+[o0]+n', isRegex: true, category: 'sexual', severity: 3, reason: 'Sexual content' },

  // ==========================================================================
  // PROFANITY (Severity 2-3)
  // ==========================================================================

  { pattern: 'f+[\\s._-]*[u]+[\\s._-]*[c(<{]+[\\s._-]*[k|<]+', isRegex: true, category: 'profanity', severity: 3, reason: 'Profanity' },
  { pattern: 'f[u]+[c(<{]+[k|<]+[e3]*r?s?', isRegex: true, category: 'profanity', severity: 3, reason: 'Profanity' },
  { pattern: '[s5$]+h+[i1!|l]+[t7+]+', isRegex: true, category: 'profanity', severity: 2, reason: 'Profanity' },
  { pattern: '[a4@]+[s5$]+[s5$]+h[o0]+l[e3]+s?', isRegex: true, category: 'profanity', severity: 3, reason: 'Profanity' },
  { pattern: 'b[i1!|l]+[t7+]+[c(<{]+h+[e3]*[s5$]?', isRegex: true, category: 'profanity', severity: 3, reason: 'Profanity' },
  { pattern: 'b[a4@]+[s5$]+[t7+]+[a4@]+rd+s?', isRegex: true, category: 'profanity', severity: 3, reason: 'Profanity' },
  { pattern: 'd[a4@]+mn+', isRegex: true, category: 'profanity', severity: 1, reason: 'Mild profanity' },
  { pattern: 'h[e3]+ll', isRegex: true, category: 'profanity', severity: 1, reason: 'Mild profanity' },
  { pattern: 'cr[a4@]+p+', isRegex: true, category: 'profanity', severity: 1, reason: 'Mild profanity' },
  { pattern: 'p[i1!|l]+[s5$]+[s5$]+', isRegex: true, category: 'profanity', severity: 2, reason: 'Profanity' },

  // ==========================================================================
  // HATE SYMBOLS & CODES (Severity 4 - Extreme)
  // ==========================================================================

  { pattern: 'kkk', isRegex: false, category: 'hate_symbol', severity: 4, reason: 'Hate group' },
  { pattern: 'k[\\s._-]*k[\\s._-]*k', isRegex: true, category: 'hate_symbol', severity: 4, reason: 'Hate group with separators' },
  { pattern: '1488', isRegex: false, category: 'hate_symbol', severity: 4, reason: 'White supremacist code' },
  { pattern: '14[\\s._-]*88', isRegex: true, category: 'hate_symbol', severity: 4, reason: 'White supremacist code' },
  { pattern: '^88$', isRegex: true, category: 'hate_symbol', severity: 4, reason: 'Nazi code (exact match)' },
  { pattern: 'h[e3]+[i1!|l]+[\\s._-]*h[i1!|l]+[t7+]+l[e3]+r', isRegex: true, category: 'hate_symbol', severity: 4, reason: 'Nazi reference' },
  { pattern: 'h[i1!|l]+[t7+]+l[e3]+r', isRegex: true, category: 'hate_symbol', severity: 4, reason: 'Nazi reference' },
  { pattern: 'n[a4@]+z[i1!|l]+s?', isRegex: true, category: 'hate_symbol', severity: 4, reason: 'Nazi reference' },
  { pattern: 'sw[a4@]+[s5$]+[t7+]+[i1!|l]+k[a4@]+', isRegex: true, category: 'hate_symbol', severity: 4, reason: 'Nazi symbol' },
  { pattern: '卐', isRegex: false, category: 'hate_symbol', severity: 4, reason: 'Nazi symbol' },
  { pattern: '卍', isRegex: false, category: 'hate_symbol', severity: 4, reason: 'Swastika variant' },
  { pattern: '[s5$]+[s5$]+[\\s._-]*b[o0]+l[t7+]+', isRegex: true, category: 'hate_symbol', severity: 4, reason: 'Nazi symbol' },
  { pattern: 'wh[i1!|l]+[t7+]+[e3]+[\\s._-]*p[o0]+w[e3]+r', isRegex: true, category: 'hate_symbol', severity: 4, reason: 'White supremacist' },
  { pattern: 'wh[i1!|l]+[t7+]+[e3]+[\\s._-]*pr[i1!|l]+d[e3]+', isRegex: true, category: 'hate_symbol', severity: 4, reason: 'White supremacist' },
  { pattern: '[a4@]+r[yý]+[a4@]+n', isRegex: true, category: 'hate_symbol', severity: 4, reason: 'White supremacist' },
  { pattern: 'th[i1!|l]+rd[\\s._-]*r[e3]+[i1!|l]+[c(<{]+h', isRegex: true, category: 'hate_symbol', severity: 4, reason: 'Nazi reference' },
  { pattern: '[s5$]+[i1!|l]+[e3]+g[\\s._-]*h[e3]+[i1!|l]+', isRegex: true, category: 'hate_symbol', severity: 4, reason: 'Nazi salute' },
  { pattern: 'g[a4@]+[s5$]+[\\s._-]*th[e3]+[\\s._-]*j[e3]+w', isRegex: true, category: 'hate_symbol', severity: 4, reason: 'Holocaust reference' },
  { pattern: 'h[o0]+l[o0]+c[a4@]+[u]+[s5$]+[t7+]', isRegex: true, category: 'hate_symbol', severity: 4, reason: 'Holocaust reference' },
  { pattern: '[a4@]+[u]+[s5$]+[c(<{]+hw[i1!|l]+[t7+]+z', isRegex: true, category: 'hate_symbol', severity: 4, reason: 'Holocaust reference' },

  // ==========================================================================
  // RELIGIOUS SLURS (Severity 3-4)
  // ==========================================================================

  { pattern: 'k[a4@]+ff?[i1!|l]+r', isRegex: true, category: 'religious', severity: 4, reason: 'Religious slur' },
  { pattern: 'g[o0]+[yý]+[i1!|l]*m?', isRegex: true, category: 'religious', severity: 3, reason: 'Religious slur' },
  { pattern: '[i1!|l]+nf[i1!|l]+d[e3]+l', isRegex: true, category: 'religious', severity: 3, reason: 'Religious slur' },
  { pattern: 'h[e3]+[a4@]+th[e3]+n', isRegex: true, category: 'religious', severity: 2, reason: 'Religious slur' },
  { pattern: 'j[e3]+w[\\s._-]*b[o0]+[yý]', isRegex: true, category: 'religious', severity: 4, reason: 'Religious slur' },
  { pattern: 'sh[yý]+l[o0]+[c(<{][k|<]', isRegex: true, category: 'religious', severity: 4, reason: 'Religious slur' },

  // ==========================================================================
  // DISABILITY SLURS (Severity 3-4)
  // ==========================================================================

  { pattern: 'r[e3]+[t7+]+[a4@]+rd+[e3]*d?s?', isRegex: true, category: 'disability', severity: 4, reason: 'Disability slur' },
  { pattern: 'sp[a4@]+[s5$]+[t7+]+[i1!|l]+[c(<{]+s?', isRegex: true, category: 'disability', severity: 4, reason: 'Disability slur' },
  { pattern: 'cr[i1!|l]+ppl[e3]+[sd]?', isRegex: true, category: 'disability', severity: 4, reason: 'Disability slur' },
  { pattern: 'm[o0]+ng[o0]+l[o0]+[i1!|l]+d', isRegex: true, category: 'disability', severity: 4, reason: 'Disability slur' },
  { pattern: 't[a4@]+rd', isRegex: true, category: 'disability', severity: 3, reason: 'Disability slur' },
  { pattern: 'm[o0]+ng', isRegex: true, category: 'disability', severity: 3, reason: 'Disability slur' },
  { pattern: 'w[i1!|l]+nd[o0]+w[\\s._-]*l[i1!|l]+[c(<{]+k[e3]+r', isRegex: true, category: 'disability', severity: 4, reason: 'Disability slur' },

  // ==========================================================================
  // VIOLENCE & THREATS (Severity 4)
  // ==========================================================================

  { pattern: 'k[i1!|l]+ll[\\s._-]*y[o0]+[u]+r?[s5$]*[e3]*l?f?', isRegex: true, category: 'violence', severity: 4, reason: 'Violence/threat' },
  { pattern: 'k[yý]+[s5$]', isRegex: true, category: 'violence', severity: 4, reason: 'Suicide reference' },
  { pattern: '[s5$]+[u]+[i1!|l]+[c(<{]+[i1!|l]+d[e3]+', isRegex: true, category: 'violence', severity: 4, reason: 'Suicide reference' },
  { pattern: 'p[e3]+d[o0]+s?', isRegex: true, category: 'violence', severity: 4, reason: 'Child abuse reference' },
  { pattern: 'p[a4@]+[e3]*d[o0]+ph[i1!|l]+l[e3]+', isRegex: true, category: 'violence', severity: 4, reason: 'Child abuse reference' },
  { pattern: 'ch[i1!|l]+ld[\\s._-]*r[a4@]+p', isRegex: true, category: 'violence', severity: 4, reason: 'Child abuse reference' },
  { pattern: 'sch[o0]+[o0]+l[\\s._-]*sh[o0]+[o0]+t', isRegex: true, category: 'violence', severity: 4, reason: 'Violence reference' },
  { pattern: 'm[u]+rd[e3]+r[e3]*r?', isRegex: true, category: 'violence', severity: 3, reason: 'Violence reference' },
  { pattern: 'd[i1!|l]+[e3]+[\\s._-]*[i1!|l]+n[\\s._-]*[a4@]+', isRegex: true, category: 'violence', severity: 4, reason: 'Violence/threat' },

  // ==========================================================================
  // EXACT MATCHES - Common Offensive Tags (Case-insensitive via service)
  // ==========================================================================

  // Short slur fragments
  { pattern: 'NIG', isRegex: false, category: 'racial', severity: 4, reason: 'Racial slur fragment' },
  { pattern: 'FAG', isRegex: false, category: 'lgbtq', severity: 4, reason: 'LGBTQ+ slur' },

  // Sexual content
  { pattern: 'BBC', isRegex: false, category: 'sexual', severity: 3, reason: 'Sexual reference' },
  { pattern: 'BWC', isRegex: false, category: 'sexual', severity: 3, reason: 'Sexual reference' },
  { pattern: 'SEX', isRegex: false, category: 'sexual', severity: 2, reason: 'Sexual content' },
  { pattern: 'XXX', isRegex: false, category: 'sexual', severity: 3, reason: 'Adult content' },
  { pattern: 'PORN', isRegex: false, category: 'sexual', severity: 3, reason: 'Adult content' },
  { pattern: 'ANAL', isRegex: false, category: 'sexual', severity: 3, reason: 'Sexual content' },
  { pattern: 'CUM', isRegex: false, category: 'sexual', severity: 3, reason: 'Sexual content' },
  { pattern: 'MILF', isRegex: false, category: 'sexual', severity: 3, reason: 'Sexual content' },
  { pattern: 'DILF', isRegex: false, category: 'sexual', severity: 3, reason: 'Sexual content' },
  { pattern: 'BDSM', isRegex: false, category: 'sexual', severity: 3, reason: 'Sexual content' },

  // Violence/terrorism
  { pattern: 'ISIS', isRegex: false, category: 'violence', severity: 4, reason: 'Terrorism reference' },
  { pattern: 'RAPE', isRegex: false, category: 'sexual', severity: 4, reason: 'Sexual violence' },
  { pattern: 'PEDO', isRegex: false, category: 'violence', severity: 4, reason: 'Child abuse reference' },
  { pattern: 'KILL', isRegex: false, category: 'violence', severity: 3, reason: 'Violence (contextual)' },

  // Religious targeting
  { pattern: 'JEW', isRegex: false, category: 'religious', severity: 3, reason: 'Religious targeting' },
  { pattern: 'JEWS', isRegex: false, category: 'religious', severity: 3, reason: 'Religious targeting' },

  // Hate groups/symbols
  { pattern: 'SS', isRegex: false, category: 'hate_symbol', severity: 4, reason: 'Nazi reference' },
  { pattern: 'NAZI', isRegex: false, category: 'hate_symbol', severity: 4, reason: 'Nazi reference' },
]

/**
 * Get patterns by category
 */
export function getPatternsByCategory(category: ModerationCategory): BannedPattern[] {
  return BANNED_PATTERNS.filter(p => p.category === category)
}

/**
 * Get patterns by minimum severity
 */
export function getPatternsBySeverity(minSeverity: number): BannedPattern[] {
  return BANNED_PATTERNS.filter(p => p.severity >= minSeverity)
}

/**
 * Get all regex patterns
 */
export function getRegexPatterns(): BannedPattern[] {
  return BANNED_PATTERNS.filter(p => p.isRegex)
}

/**
 * Get all exact match patterns
 */
export function getExactPatterns(): BannedPattern[] {
  return BANNED_PATTERNS.filter(p => !p.isRegex)
}

/**
 * Count patterns by category
 */
export function getPatternStats(): Record<ModerationCategory, number> {
  const stats: Record<string, number> = {}
  for (const p of BANNED_PATTERNS) {
    stats[p.category] = (stats[p.category] || 0) + 1
  }
  return stats as Record<ModerationCategory, number>
}

// Export count for reference
export const PATTERN_COUNT = BANNED_PATTERNS.length
