import { test, expect } from "@playwright/test";

test.describe("Command Center — Layout", () => {
  test("page loads with 3-panel layout", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("agent-panel")).toBeVisible();
    await expect(page.getByTestId("chat-panel")).toBeVisible();
    await expect(page.getByTestId("details-panel")).toBeVisible();
  });

  test("shows page title", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Incident Cortex")).toBeVisible();
    await expect(
      page.getByText("Multi-agent SRE & Security Command Center")
    ).toBeVisible();
  });

  test("shows all 4 agents in left panel", async ({ page }) => {
    await page.goto("/");
    const panel = page.getByTestId("agent-panel");
    await expect(panel.getByText("Triage")).toBeVisible();
    await expect(panel.getByText("Logs")).toBeVisible();
    await expect(panel.getByText("Metrics")).toBeVisible();
    await expect(panel.getByText("Security")).toBeVisible();
  });

  test("shows suggestion chips when no messages", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByText("Investigate payment-service 500 errors")
    ).toBeVisible();
    await expect(
      page.getByText("Check service health for the last hour")
    ).toBeVisible();
    await expect(
      page.getByText("Are there any security threats?")
    ).toBeVisible();
  });

  test("shows details panel with timeline header", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("details-panel")).toBeVisible();
    await expect(
      page.getByTestId("details-panel").getByText("Details")
    ).toBeVisible();
  });

  test("shows footer info in agent panel", async ({ page }) => {
    await page.goto("/");
    const panel = page.getByTestId("agent-panel");
    await expect(panel.getByText("Elastic Agent Builder")).toBeVisible();
    await expect(panel.getByText(/10 ES\|QL tools/)).toBeVisible();
  });
});

test.describe("Command Center — Chat Input", () => {
  test("can type in the message input", async ({ page }) => {
    await page.goto("/");
    const input = page.getByPlaceholder(
      "Describe the incident or ask a question..."
    );
    await expect(input).toBeVisible();
    await input.fill("Test message");
    await expect(input).toHaveValue("Test message");
  });

  test("send button is disabled when input is empty", async ({ page }) => {
    await page.goto("/");
    const sendBtn = page.getByRole("button", { name: "Send" });
    await expect(sendBtn).toBeDisabled();
  });

  test("send button enables when text is typed", async ({ page }) => {
    await page.goto("/");
    const input = page.getByPlaceholder(
      "Describe the incident or ask a question..."
    );
    const sendBtn = page.getByRole("button", { name: "Send" });
    await input.fill("Hello");
    await expect(sendBtn).toBeEnabled();
  });

  test("sending a message shows it in the chat", async ({ page }) => {
    await page.goto("/");
    const input = page.getByPlaceholder(
      "Describe the incident or ask a question..."
    );
    await input.fill("Test user message");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("Test user message")).toBeVisible();
  });

  test("input clears after sending", async ({ page }) => {
    await page.goto("/");
    const input = page.getByPlaceholder(
      "Describe the incident or ask a question..."
    );
    await input.fill("Another message");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(input).toHaveValue("");
  });

  test("Enter key sends message", async ({ page }) => {
    await page.goto("/");
    const input = page.getByPlaceholder(
      "Describe the incident or ask a question..."
    );
    await input.fill("Enter key test");
    await input.press("Enter");
    await expect(page.getByText("Enter key test")).toBeVisible();
    await expect(input).toHaveValue("");
  });
});

test.describe("Command Center — Agent Interaction", () => {
  test("clicking a suggestion chip sends it as a message", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByText("Are there any security threats?").click();
    await expect(
      page.getByText("Are there any security threats?")
    ).toBeVisible();
  });

  test("shows typing indicator after sending a message @slow", async ({ page }) => {
    await page.goto("/");
    const input = page.getByPlaceholder(
      "Describe the incident or ask a question..."
    );
    await input.fill("Investigate errors");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByTestId("typing-indicator")).toBeVisible({
      timeout: 5_000,
    });
  });

  test("input is disabled while agent is responding @slow", async ({ page }) => {
    await page.goto("/");
    const input = page.getByPlaceholder(
      "Describe the incident or ask a question..."
    );
    await input.fill("Quick test");
    await page.getByRole("button", { name: "Send" }).click();
    // Input should be disabled while loading
    await expect(input).toBeDisabled({ timeout: 3_000 });
  });

  test("clicking an agent card shows agent details", async ({ page }) => {
    await page.goto("/");
    const panel = page.getByTestId("agent-panel");
    // Click on Security agent
    await panel.getByText("Security").click();
    // Details panel should show agent info
    const details = page.getByTestId("details-panel");
    await expect(details.getByText("Security Analyst")).toBeVisible();
  });
});

test.describe("Command Center — Full Investigation (slow)", () => {
  test("full investigation returns agent response with tool calls", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.goto("/");
    const input = page.getByPlaceholder(
      "Describe the incident or ask a question..."
    );

    // Send the demo investigation prompt
    await input.fill(
      "ALERT: payment-service returning 500 errors since 2026-02-22T14:30:00Z. " +
        "Time range: 2026-02-22T14:00:00Z to 2026-02-22T15:00:00Z. " +
        "Investigate."
    );
    await page.getByRole("button", { name: "Send" }).click();

    // Should show typing indicator
    await expect(page.getByTestId("typing-indicator")).toBeVisible({
      timeout: 5_000,
    });

    // Wait for agent response (up to 90 seconds)
    await expect(page.getByTestId("typing-indicator")).not.toBeVisible({
      timeout: 90_000,
    });

    // Should have at least one agent message with content
    const agentMessages = page.locator("[class*='bg-\\[\\#2C2D35\\]']");
    await expect(agentMessages.first()).toBeVisible();

    // Agent response should mention errors/payment-service
    const chatPanel = page.getByTestId("chat-panel");
    await expect(chatPanel).toContainText(/error|payment|500|spike/i);

    // Should show tool call badges
    const toolBadges = chatPanel.locator("[data-tool-id]");
    const badgeCount = await toolBadges.count();
    expect(badgeCount).toBeGreaterThan(0);

    // Click a tool badge to view details in the right panel
    const firstBadge = toolBadges.first();
    const firstToolId = await firstBadge.getAttribute("data-tool-id");
    await firstBadge.click();
    const detailsPanel = page.getByTestId("details-panel");
    // Details panel should show the tool ID and a "Back to timeline" link
    await expect(detailsPanel.getByText("Back to timeline")).toBeVisible();
    if (firstToolId) {
      await expect(detailsPanel.getByText(firstToolId)).toBeVisible();
    }
  });
});
