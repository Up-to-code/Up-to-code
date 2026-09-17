import test from 'node:test';
import assert from 'node:assert/strict';
import { isRateLimitError, readCachedProfile } from './generate-profile-assets.mjs';

const fixturePath = new URL('../generated/languages.json', import.meta.url);

test('detects GitHub rate-limit responses', () => {
  const error = new Error('GitHub API 403 for /users/Up-to-code/repos: {"message":"API rate limit exceeded"}');
  assert.equal(isRateLimitError(error), true);
  assert.equal(isRateLimitError(new Error('something else')), false);
});

test('reads the cached profile from generated/languages.json', async () => {
  const profile = await readCachedProfile(fixturePath.pathname);
  assert.ok(profile);
  assert.equal(profile.owner, 'Up-to-code');
  assert.ok(Array.isArray(profile.languages));
});
