import { test } from "node:test";
import assert from "node:assert/strict";
import { toZernio, type AutomationFields } from "./zernio.ts";

const base: AutomationFields = {
  name: "Guide", trigger_type: "comment", media_id: "123", media_caption: "My post", match_mode: "exact",
  initial_message: "Tap below 👇", button_label: "Send me the link", comment_replies: "Check your DMs\nSent!\n",
  require_follow: 1, content_message: "Here it is", content_url: "https://example.com", link_button_label: "Open link",
  not_following_message: "Follow first", is_active: 1,
};

test("follow-gated comment automation on one post", () => {
  const b = toZernio(base, ["guide"]);
  assert.equal(b.trigger, "comment");
  assert.equal(b.platformPostId, "123");
  assert.deepEqual(b.keywords, ["guide"]);
  assert.equal(b.matchMode, "exact");
  assert.deepEqual(b.buttons, [{ type: "url", title: "Open link", url: "https://example.com" }]);
  assert.equal(b.commentReply, "Check your DMs");
  assert.deepEqual(b.commentReplyVariations, ["Sent!"]);
  assert.deepEqual(b.audience, { followerStatus: "follower", whenUnknown: "verify" });
  assert.equal(b.followGate.notFollowingMessage, "Follow first");
  assert.equal(b.isActive, true);
});

test("no gate, any post, any comment, no link", () => {
  const b = toZernio({ ...base, require_follow: 0, media_id: null, match_mode: "any", content_url: null, comment_replies: "", is_active: 0 }, ["x"]);
  assert.equal("platformPostId" in b, false);
  assert.deepEqual(b.keywords, []);
  assert.deepEqual(b.buttons, []);
  assert.equal("commentReply" in b, false);
  assert.deepEqual(b.audience, { tapToUnlock: true });
  assert.equal("notFollowingMessage" in b.followGate, false);
  assert.equal(b.isActive, false);
});

test("story reply ignores the post id", () => {
  const b = toZernio({ ...base, trigger_type: "story_reply" }, ["x"]);
  assert.equal(b.trigger, "story_reply");
  assert.equal("platformPostId" in b, false);
});
