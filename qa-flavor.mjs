export default async function run(page, ui) {
  const out = {};

  // 1. Hero buttons exist and open the access modal on the right tab
  const heroBtns = await page.locator(".hero-actions button").allInnerTexts();
  out.heroButtons = heroBtns;
  await page.locator(".hero-action.primary").click();
  await page.waitForTimeout(150);
  out.loginModalOpens = await page.locator("#modal-access").isVisible();
  out.loginTabActive = await page
    .locator("#tabLogin")
    .getAttribute("aria-selected");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  out.modalClosedOnEscape = !(await page.locator("#modal-access").isVisible());

  await page.locator(".hero-action.secondary").click();
  await page.waitForTimeout(150);
  out.signupTabActive = await page
    .locator("#tabSignup")
    .getAttribute("aria-selected");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);

  // 2. Signup flow — create a fresh account
  await page.evaluate(() => localStorage.clear());
  await page.locator(".hero-action.secondary").click();
  await page.waitForTimeout(100);
  await page.fill("#signupName", "Amina Otieno");
  await page.fill("#signupUsername", "amina");
  await page.fill("#signupPhone", "0712345678");
  await page.fill("#signupEmail", "amina@example.com");
  await page.fill("#signupPassword", "passw0rd123");
  await page.fill("#signupConfirmPassword", "passw0rd123");
  await page.selectOption("#signupRole", "admin");
  out.strengthMeterVisible = await page.locator("#strengthMeter").isVisible();
  await page.click("#signupSubmit");
  await page.waitForTimeout(1400);
  out.redirectedAfterSignup = page.url().endsWith("index.html");
  out.sessionSet = await page.evaluate(() =>
    sessionStorage.getItem("tajiri-session-user"),
  );

  // 3. Back to welcome — login flow with the created account
  await page.goto("FILE_PLACEHOLDER");
  await page.evaluate(() => sessionStorage.clear());
  await page.locator(".hero-action.primary").click();
  await page.waitForTimeout(100);
  await page.fill("#loginIdentity", "amina");
  await page.fill("#loginPassword", "passw0rd123");
  await page.click("#loginSubmit");
  await page.waitForTimeout(1400);
  out.redirectedAfterLogin = page.url().endsWith("index.html");

  // 4. Wrong password shows an inline error
  await page.goto("FILE_PLACEHOLDER");
  await page.locator(".hero-action.primary").click();
  await page.waitForTimeout(100);
  await page.fill("#loginIdentity", "amina");
  await page.fill("#loginPassword", "wrongpass");
  await page.click("#loginSubmit");
  await page.waitForTimeout(300);
  out.loginErrorShown = await page.locator("#loginError").isVisible();
  out.loginErrorText = await page.locator("#loginError").innerText();

  // 5. More dropdown opens on click, closes on Escape, modals open from it
  const btn = page.locator("#navMoreBtn");
  await btn.click();
  await page.waitForTimeout(100);
  out.menuOpensOnClick = await page.locator("#navMoreMenu").isVisible();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(100);
  out.menuClosesOnEscape = !(await page.locator("#navMoreMenu").isVisible());
  await btn.click();
  await page
    .locator('#navMoreMenu button[data-modal-open="modal-about"]')
    .click();
  await page.waitForTimeout(150);
  out.aboutModalFromMenu = await page.locator("#modal-about").isVisible();
  out.menuClosedAfterPick = !(await page.locator("#navMoreMenu").isVisible());
  await page.keyboard.press("Escape");

  // 6. Downloads modal + missing-file toast
  await page.locator("#navMoreBtn").click();
  await page
    .locator('#navMoreMenu button[data-modal-open="modal-downloads"]')
    .click();
  await page.waitForTimeout(200);
  out.downloadsModal = await page.locator("#modal-downloads").isVisible();
  out.dlCards = await page.locator(".dl-card").count();
  await page.locator(".dl-card").first().click();
  await page.waitForTimeout(400);
  out.dlToastShown = await page.evaluate(() =>
    document.getElementById("toast").className.includes("show"),
  );

  return out;
}
