import { describe, it, expect } from "vitest";
import { createDatasetInstanceId, isValidDatasetInstanceId } from "../datasetInstanceIdentity";

describe("W1-INT-09 — createDatasetInstanceId", () => {
  it("produces a non-empty string", () => {
    const id = createDatasetInstanceId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("produces a distinct value on every call", () => {
    const a = createDatasetInstanceId();
    const b = createDatasetInstanceId();
    expect(a).not.toBe(b);
  });

  it("produces values that pass the validator", () => {
    expect(isValidDatasetInstanceId(createDatasetInstanceId())).toBe(true);
  });
});

describe("W1-INT-09 — isValidDatasetInstanceId", () => {
  it("accepts a real generated id", () => {
    expect(isValidDatasetInstanceId(createDatasetInstanceId())).toBe(true);
  });

  it("accepts an arbitrary non-empty string", () => {
    expect(isValidDatasetInstanceId("instance-1")).toBe(true);
  });

  it("rejects undefined", () => {
    expect(isValidDatasetInstanceId(undefined)).toBe(false);
  });

  it("rejects null", () => {
    expect(isValidDatasetInstanceId(null)).toBe(false);
  });

  it('rejects ""', () => {
    expect(isValidDatasetInstanceId("")).toBe(false);
  });

  it("rejects whitespace-only string", () => {
    expect(isValidDatasetInstanceId("   ")).toBe(false);
  });

  it("rejects a number", () => {
    expect(isValidDatasetInstanceId(42)).toBe(false);
  });

  it("rejects an object", () => {
    expect(isValidDatasetInstanceId({ id: "instance-1" })).toBe(false);
  });

  it("rejects an array", () => {
    expect(isValidDatasetInstanceId(["instance-1"])).toBe(false);
  });

  it("rejects an unreasonably long string", () => {
    expect(isValidDatasetInstanceId("x".repeat(500))).toBe(false);
  });
});
