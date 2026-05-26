import { describe, it, expect } from "vitest"
import { cosineSimilarity, vecToArray, arrayToVec } from "../embeddings"

describe("cosineSimilarity", () => {
  it("is 1 for identical normalised vectors", () => {
    const v = new Float32Array([1, 0, 0])
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 6)
  })
  it("is 0 for orthogonal vectors", () => {
    expect(cosineSimilarity(new Float32Array([1, 0]), new Float32Array([0, 1]))).toBeCloseTo(0, 6)
  })
})

describe("vec serialization round-trip", () => {
  it("survives vecToArray → arrayToVec", () => {
    const v = new Float32Array([0.1, -0.2, 0.3])
    const back = arrayToVec(vecToArray(v))
    expect(Array.from(back)).toEqual(Array.from(v))
    expect(back).toBeInstanceOf(Float32Array)
  })
})
