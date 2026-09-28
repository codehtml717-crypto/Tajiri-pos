export default async function run(page) {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
  await page.waitForSelector("#signupName", { timeout: 5000 });
  // block the post-signup redirect so the runner can close cleanly
  await page.evaluate(() => {
    const original = window.setTimeout;
    window.setTimeout = (fn, ms, ...rest) => (ms === 900 || ms === 700 ? 0 : original(fn, ms, ...rest));
  });
  await page.fill("#signupName", "Amina Otieno");
  await page.fill("#signupUsername", "amina");
  await page.fill("#signupEmail", "amina@example.com");
  await page.fill("#signupPassword", "secret123");
  await page.fill("#signupConfirmPassword", "secret123");
  await page.click("#signupSubmit");
  await page.waitForFunction(
    () => sessionStorage.getItem("tajiri-session-user") === "amina",
    null,
    { timeout: 5000 },
  );
  const accounts = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("tajiri-pos-accounts") || "[]").map(
      (a) => a.username,
    ),
  );
  return { redirected: page.url(), accounts };
}
