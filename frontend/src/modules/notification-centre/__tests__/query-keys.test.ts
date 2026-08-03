import { notificationKeys } from "../query-keys";

describe("notificationKeys", () => {
  it("namespaces under 'notifications'", () => {
    expect(notificationKeys.all).toEqual(["notifications"]);
  });
  it("builds inbox + preferences keys", () => {
    expect(notificationKeys.inbox()).toEqual(["notifications", "inbox"]);
    expect(notificationKeys.preferences()).toEqual(["notifications", "preferences"]);
  });
});
