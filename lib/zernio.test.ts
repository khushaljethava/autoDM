import { test } from "node:test";
import assert from "node:assert/strict";
import { GATE_PREFIX, toZernio, type AutomationFields } from "./zernio.ts";

const base: AutomationFields = {
  id: 7, name: "Guide", trigger_type: "comment", media_id: "123", media_caption: "My post", match_mode: "exact",
  initial_message: "Tap below 👇", button_label: "Send me the link", comment_replies: "Check your DMs\nSent!\n",
  require_follow: 1, content_message: "Here it is", content_url: "https://example.com", link_button_label: "Open link",
  not_following_message: "Follow first", is_active: 1,
};

test("follow gate: opening DM with a postback button that comes back to AutoDM", () => {
  const b = toZernio(base, ["guide"]);
  assert.equal(b.trigger, "comment");
  assert.equal(b.platformPostId, "123");
  assert.deepEqual(b.keywords, ["guide"]);
  assert.equal(b.matchMode, "exact");
  assert.equal(b.dmMessage, "Tap below 👇");
  assert.deepEqual(b.buttons, [{ type: "postback", title: "Send me the link", payload: `${GATE_PREFIX}7` }]);
  assert.deepEqual(b.audience, { followerStatus: "any", whenUnknown: "send" }); // Zernio's cached gate is off
  assert.equal("followGate" in b, false);
  assert.equal(b.commentReply, "Check your DMs");
  assert.deepEqual(b.commentReplyVariations, ["Sent!"]);
  assert.equal(b.isActive, true);
});

test("no gate: Zernio tap-to-unlock delivers the content with its link button", () => {
  const b = toZernio({ ...base, require_follow: 0 }, ["x"]);
  assert.equal(b.dmMessage, "Here it is");
  assert.deepEqual(b.buttons, [{ type: "url", title: "Open link", url: "https://example.com" }]);
  assert.deepEqual(b.audience, { tapToUnlock: true });
  assert.deepEqual((b as { followGate?: unknown }).followGate, { message: "Tap below 👇", buttonLabel: "Send me the link" });
});

test("any post, any comment, no link, no replies, paused", () => {
  const b = toZernio({ ...base, require_follow: 0, media_id: null, match_mode: "any", content_url: null, comment_replies: "", is_active: 0 }, ["x"]);
  assert.equal("platformPostId" in b, false);
  assert.deepEqual(b.keywords, []);
  assert.deepEqual(b.buttons, []);
  assert.equal("commentReply" in b, false);
  assert.equal(b.isActive, false);
});

test("{username} becomes Zernio's {{username}} everywhere", () => {
  const b = toZernio({ ...base, initial_message: "Hi {username}!", comment_replies: "Thanks {username}" }, ["x"]);
  assert.equal(b.dmMessage, "Hi @{{username}}!");
  assert.equal(b.commentReply, "Thanks @{{username}}");
  assert.equal(toZernio({ ...base, require_follow: 0, content_message: "For {username}" }, ["x"]).dmMessage, "For @{{username}}");
  assert.equal(toZernio({ ...base, initial_message: "Hi {{username}}" }, ["x"]).dmMessage, "Hi {{username}}"); // already Zernio syntax
});

test("story reply ignores the post id", () => {
  const b = toZernio({ ...base, trigger_type: "story_reply" }, ["x"]);
  assert.equal(b.trigger, "story_reply");
  assert.equal("platformPostId" in b, false);
});
