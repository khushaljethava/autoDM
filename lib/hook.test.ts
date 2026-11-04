import { test } from "node:test";
import assert from "node:assert/strict";
import { resolvePost, shortcode } from "./hook.ts";

const media = [
  { id: "111", permalink: "https://www.instagram.com/reel/AbC-12_x/", caption: "My reel" },
  { id: "222", permalink: "https://www.instagram.com/p/XyZ9/", caption: undefined },
];

test("shortcode from post, reel, reels and profile-prefixed links", () => {
  assert.equal(shortcode("https://www.instagram.com/reel/AbC-12_x/?igsh=abc"), "AbC-12_x");
  assert.equal(shortcode("instagram.com/p/XyZ9"), "XyZ9");
  assert.equal(shortcode("https://www.instagram.com/reels/AbC-12_x/"), "AbC-12_x");
  assert.equal(shortcode("https://www.instagram.com/solo.preneurshub/reel/AbC-12_x/"), "AbC-12_x");
  assert.equal(shortcode("https://example.com/reel/AbC"), null);
});

test("resolvePost: id, link, unknown numeric id, unknown link", () => {
  assert.deepEqual(resolvePost("111", media), { id: "111", caption: "My reel" });
  assert.deepEqual(resolvePost("https://www.instagram.com/p/XyZ9/?utm=x", media), { id: "222", caption: null });
  assert.deepEqual(resolvePost(" 999 ", media), { id: "999", caption: null }); // older post, not in the list
  assert.deepEqual(resolvePost("AbC-12_x", media), { id: "111", caption: "My reel" }); // bare shortcode
  assert.equal(resolvePost("Nope12", media), null); // shortcode not on the account
  assert.equal(resolvePost("https://www.instagram.com/reel/Nope/", media), null);
  assert.equal(resolvePost("not a post", media), null);
});
