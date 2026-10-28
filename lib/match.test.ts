import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { isHttpUrl, matchKeyword, parseKeywords, render, verifySignature } from "./match.ts";

test("exact mode", () => {
  assert.equal(matchKeyword("  Guide! ", ["GUIDE", "PDF"], "exact"), "GUIDE");
  assert.equal(matchKeyword("pdf 🙏", ["GUIDE", "PDF"], "exact"), "PDF");
  assert.equal(matchKeyword("send the guide", ["GUIDE"], "exact"), null);
});

test("contains mode is whole-word", () => {
  assert.equal(matchKeyword("pls send the Guide 🙏", ["guide"], "contains"), "guide");
  assert.equal(matchKeyword("guidelines?", ["guide"], "contains"), null);
  assert.equal(matchKeyword("मुझे गाइड चाहिए", ["गाइड"], "contains"), "गाइड");
  assert.equal(matchKeyword("nice reel", ["guide", "ebook"], "contains"), null);
});

test("any mode matches non-empty text only", () => {
  assert.equal(matchKeyword("hello", [], "any"), "*");
  assert.equal(matchKeyword("   ", [], "any"), null);
});

test("parseKeywords trims and dedupes", () => {
  assert.deepEqual(parseKeywords(" GUIDE, ebook\nPDF,, GUIDE "), ["GUIDE", "ebook", "PDF"]);
});

test("render personalizes or drops {username}", () => {
  assert.equal(render("Hey {username}!", "@sam"), "Hey @sam!");
  assert.equal(render("Hey {username}!", null), "Hey!");
});

test("isHttpUrl rejects script schemes", () => {
  assert.ok(isHttpUrl("https://example.com/guide"));
  assert.ok(!isHttpUrl("javascript:alert(1)"));
  assert.ok(!isHttpUrl("not a url"));
});

test("verifySignature", () => {
  const body = '{"entry":[]}';
  const sig = "sha256=" + createHmac("sha256", "s3cret").update(body).digest("hex");
  assert.ok(verifySignature(body, sig, ["other", "s3cret"]));
  assert.ok(!verifySignature(body, sig, ["wrong"]));
  assert.ok(!verifySignature(body, null, ["s3cret"]));
  assert.ok(!verifySignature(body, "sha256=abc", ["s3cret"]));
});
