import { describe, it, expect } from "vitest"
import { extractKeyphrases, normalizeTags } from "../localTagger"

describe("extractKeyphrases", () => {
  it("pulls salient terms, weighting the title, ignoring stopwords", () => {
    const tags = extractKeyphrases(
      "Knowledge Graph Design",
      "The knowledge graph connects ideas. A knowledge graph uses embeddings and graph traversal."
    )
    expect(tags.length).toBeGreaterThan(0)
    expect(tags.some((t) => t.includes("knowledge") || t.includes("graph"))).toBe(true)
  })

  it("returns [] for empty input", () => {
    expect(extractKeyphrases("", "")).toEqual([])
  })

  it("caps the number of phrases", () => {
    const tags = extractKeyphrases("a", "alpha beta gamma delta epsilon zeta", 3)
    expect(tags.length).toBeLessThanOrEqual(3)
  })
})

describe("normalizeTags", () => {
  it("lowercases, trims, and dedupes", () => {
    expect(normalizeTags(["Design", " design ", "DESIGN"])).toEqual(["design"])
  })

  it("merges singular/plural forms", () => {
    const out = normalizeTags(["system", "systems"])
    expect(out).toEqual(["system"])
  })

  it("drops a tag subsumed word-for-word by a more specific one", () => {
    const out = normalizeTags(["design", "product design"])
    expect(out).toContain("product design")
    expect(out).not.toContain("design")
  })

  it("caps total tags", () => {
    const out = normalizeTags(["a1", "b2", "c3", "d4", "e5", "f6", "g7", "h8"], 5)
    expect(out.length).toBeLessThanOrEqual(5)
  })
})
