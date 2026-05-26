/**
 * Local, API-free tagging — so "everything semantically tagged" holds even when
 * no AI provider is connected.
 *
 *   - extractKeyphrases: lightweight extractive tagger (term frequency over
 *     unigrams + bigrams, stopword-filtered). Runs instantly, fully offline.
 *   - normalizeTags: canonicalises a tag set so the vocabulary stops fragmenting
 *     ("Design", "design ", "designs" → "design"; drops substrings subsumed by a
 *     more specific tag).
 *
 * The LLM tagger in autoTag.ts becomes an *enhancement* layered on top of this
 * floor, not a requirement.
 */

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "then", "else", "for", "of", "to",
  "in", "on", "at", "by", "with", "from", "as", "is", "are", "was", "were", "be",
  "been", "being", "this", "that", "these", "those", "it", "its", "i", "you", "he",
  "she", "we", "they", "them", "his", "her", "our", "their", "my", "your", "me",
  "us", "do", "does", "did", "done", "have", "has", "had", "will", "would", "can",
  "could", "should", "may", "might", "must", "shall", "not", "no", "yes", "so",
  "than", "too", "very", "just", "about", "into", "over", "after", "before",
  "more", "most", "some", "any", "all", "each", "what", "which", "who", "when",
  "where", "why", "how", "there", "here", "up", "down", "out", "off", "also",
  "get", "got", "make", "made", "like", "want", "need", "use", "using", "one",
])

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w) && !/^\d+$/.test(w))
}

/** Crude singular form so "designs"/"design" and "systems"/"system" collapse. */
function singularize(word: string): string {
  if (word.length > 4 && word.endsWith("ies")) return word.slice(0, -3) + "y"
  if (word.length > 4 && word.endsWith("ses")) return word.slice(0, -2)
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1)
  return word
}

/**
 * Extract up to `max` keyphrases from title + content. Title terms are weighted
 * higher. Picks the strongest scoring unigrams and adjacent bigrams.
 */
export function extractKeyphrases(title: string, content: string, max = 3): string[] {
  const titleTokens = tokenize(title)
  const bodyTokens = tokenize(content)
  if (titleTokens.length + bodyTokens.length === 0) return []

  const score = new Map<string, number>()
  const bump = (term: string, by: number) =>
    score.set(term, (score.get(term) ?? 0) + by)

  // Unigrams — title terms count 3×.
  titleTokens.forEach((t) => bump(singularize(t), 3))
  bodyTokens.forEach((t) => bump(singularize(t), 1))

  // Bigrams from the body — "knowledge graph", "product design".
  for (let i = 0; i < bodyTokens.length - 1; i++) {
    const bigram = `${singularize(bodyTokens[i])} ${singularize(bodyTokens[i + 1])}`
    bump(bigram, 2)
  }

  return [...score.entries()]
    .sort((a, b) => b[1] - a[1])
    .filter(([, s]) => s >= 2) // ignore terms seen only once in the body
    .map(([term]) => term)
    .slice(0, max)
}

/**
 * Canonicalise a tag set:
 *   - lowercase, trim, collapse internal whitespace
 *   - singularise terms so plurals merge
 *   - drop a tag if a more specific tag already contains it word-for-word
 *   - cap total at `cap`
 */
export function normalizeTags(tags: string[], cap = 6): string[] {
  const cleaned = tags
    .map((t) =>
      t.toLowerCase().trim().replace(/\s+/g, " ").split(" ").map(singularize).join(" ")
    )
    .filter((t) => t.length > 1)

  const unique = [...new Set(cleaned)]

  // Drop tags that are a word-subset of a longer, more specific tag.
  const result = unique.filter((tag) => {
    const words = tag.split(" ")
    return !unique.some((other) => {
      if (other === tag) return false
      const otherWords = other.split(" ")
      if (otherWords.length <= words.length) return false
      return words.every((w) => otherWords.includes(w))
    })
  })

  return result.slice(0, cap)
}
