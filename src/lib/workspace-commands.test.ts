import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { COMMANDS, DEFAULT_SHORTCUTS, commandDestination, mergeShortcuts } from "./workspace-commands";

describe("all current admin shortcut options", () => {
  const routes = ["/admin", "/admin/sales", "/admin/purchase", "/admin/customers", "/admin/accounts", "/admin/payments", "/admin/returns", "/admin/ledger", "/admin/stock", "/admin/products", "/admin/masters", "/admin/online-products", "/admin/online-orders", "/admin/online-shop", "/admin/reports", "/admin/tools", "/admin/profile", "/admin/setup"];
  for (const to of routes) it(`allows a shortcut for ${to}`, () => {
    assert.ok(COMMANDS.some(command => commandDestination(command.id)?.to === to));
  });
  for (const kind of ["category", "manufacturer", "customer", "supplier", "account_group", "ledger", "area", "employee", "cost_centre", "store_location", "agent"]) {
    it(`opens the specific ${kind} master`, () => {
      assert.ok(COMMANDS.some(command => {
        const destination = commandDestination(command.id);
        return command.group === "Masters" && destination && "search" in destination && destination.search.kind === kind;
      }));
    });
  }
  it("preserves existing assignments and adds new unassigned options", () => {
    const merged = mergeShortcuts({ save: "F9", navSales: "", navOnlineOrders: "Ctrl+Shift+O" });
    assert.equal(merged.save, "F9");
    assert.equal(merged.navSales, "");
    assert.equal(merged.navOnlineOrders, "Ctrl+Shift+O");
    assert.equal(merged.masterAgent, "");
    assert.equal(merged.navPurchase, "Alt+3");
    assert.equal(Object.keys(merged).length, COMMANDS.length);
  });
  it("retains F12 save and assigns no conflicting defaults", () => {
    assert.equal(DEFAULT_SHORTCUTS.save, "F12");
    const assigned = Object.values(DEFAULT_SHORTCUTS).filter(Boolean);
    assert.equal(new Set(assigned).size, assigned.length);
  });
  it("page actions use the shared event rather than navigation", () => {
    assert.equal(commandDestination("save"), undefined);
    assert.equal(commandDestination("print"), undefined);
  });
});