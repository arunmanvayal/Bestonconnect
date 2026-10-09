import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sessionIdentityChanged, ENTRY_QUERY_DEFAULTS } from "./session-refresh";
describe("preserve unsaved entries when returning to the app", () => {
  it("same-user sign-in notifications do not clear the workspace",()=>assert.equal(sessionIdentityChanged("owner-a","owner-a"),false));
  it("initial session discovery does not clear mounted entry state",()=>assert.equal(sessionIdentityChanged(undefined,"owner-a"),false));
  it("actual sign-out still clears private cached data",()=>assert.equal(sessionIdentityChanged("owner-a",null),true));
  it("switching accounts still clears private cached data",()=>assert.equal(sessionIdentityChanged("owner-a","owner-b"),true));
  it("returning focus never triggers an automatic entry refresh",()=>assert.equal(ENTRY_QUERY_DEFAULTS.refetchOnWindowFocus,false));
  it("reconnecting never triggers an automatic entry refresh",()=>assert.equal(ENTRY_QUERY_DEFAULTS.refetchOnReconnect,false));
});