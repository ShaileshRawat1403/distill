import { describe, it, expect } from "vitest"
import type { Page } from "../../App"
import {
  parseWikilinks, normaliseTitle, buildTitleIndex, resolveTitle, computeLinks, buildEdges,
} from "../knowledgeGraph"

function page(id: string, title: string, content = "", tags: string[] = []): Page {
  return { id, title, content, type: "note", createdAt: 0, updatedAt: 0, tags }
}

describe("parseWikilinks", () => {
  it("extracts unique targets", () => {
    expect(parseWikilinks("see [[Alpha]] and [[Beta]] and [[Alpha]]")).toEqual(["Alpha", "Beta"])
  })
  it("ignores empty/newline-spanning brackets", () => {
    expect(parseWikilinks("[[ ]] plain [[Good]]")).toEqual(["Good"])
  })
  it("returns [] when none", () => {
    expect(parseWikilinks("no links here")).toEqual([])
  })
})

describe("title resolution", () => {
  it("normalises case/whitespace", () => {
    expect(normaliseTitle("  Project Atlas ")).toBe("project atlas")
  })
  it("resolves titles case-insensitively, last writer wins", () => {
    const pages = [page("1", "Project Atlas"), page("2", "project atlas")]
    const idx = buildTitleIndex(pages)
    expect(resolveTitle("PROJECT ATLAS", idx)).toBe("2")
    expect(resolveTitle("missing", idx)).toBeNull()
  })
})

describe("computeLinks", () => {
  it("computes outgoing, backlinks, and unresolved", () => {
    const pages = [
      page("a", "A", "links to [[B]] and [[Ghost]]"),
      page("b", "B", "links back to [[A]]"),
    ]
    const { outgoing, backlinks, unresolved } = computeLinks(pages)
    expect(outgoing.get("a")).toEqual(["b"])
    expect(backlinks.get("b")).toEqual(["a"])
    expect(backlinks.get("a")).toEqual(["b"])
    expect(unresolved.get("a")).toEqual(["Ghost"])
  })
  it("does not self-link", () => {
    const { outgoing } = computeLinks([page("a", "A", "I reference [[A]]")])
    expect(outgoing.get("a")).toBeUndefined()
  })
})

describe("buildEdges", () => {
  it("creates link edges with highest precedence", () => {
    const pages = [page("a", "A", "[[B]]", ["x"]), page("b", "B", "", ["x"])]
    const edges = buildEdges(pages, { includeTagEdges: true })
    const e = edges.find((x) => (x.source === "a" && x.target === "b") || (x.source === "b" && x.target === "a"))
    expect(e).toBeDefined()
    // shares a tag AND is linked → kind resolves to the stronger "link"
    expect(e!.kind).toBe("link")
  })

  it("creates tag edges when only tags are shared", () => {
    const pages = [page("a", "A", "", ["design"]), page("b", "B", "", ["design"])]
    const edges = buildEdges(pages, { includeTagEdges: true })
    expect(edges).toHaveLength(1)
    expect(edges[0].kind).toBe("tag")
  })

  it("creates semantic edges from vectors above threshold, capped per node", () => {
    const pages = [page("a", "A"), page("b", "B"), page("c", "C")]
    const vectors = new Map<string, number[]>([
      ["a", [1, 0]],
      ["b", [1, 0]],      // identical to a → cosine 1
      ["c", [0, 1]],      // orthogonal → cosine 0
    ])
    const edges = buildEdges(pages, { vectors, semanticThreshold: 0.5, includeTagEdges: false })
    expect(edges).toHaveLength(1)
    expect(edges[0].kind).toBe("semantic")
    const pair = [edges[0].source, edges[0].target].sort()
    expect(pair).toEqual(["a", "b"])
  })

  it("respects maxSemanticPerNode", () => {
    const pages = [page("a", "A"), page("b", "B"), page("c", "C")]
    const v = [1, 0]
    const vectors = new Map<string, number[]>([["a", v], ["b", v], ["c", v]])
    const edges = buildEdges(pages, { vectors, semanticThreshold: 0.5, maxSemanticPerNode: 1, includeTagEdges: false })
    // each node keeps at most 1 semantic neighbour; undirected dedup → ≤ 2 edges
    expect(edges.length).toBeLessThanOrEqual(2)
  })
})
