const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".mp3": "audio/mpeg",
  ".txt": "text/plain; charset=utf-8",
};
const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(
    new URL(req.url, "http://localhost").pathname,
  );
  const file = path.resolve(
    root,
    "." + urlPath + (urlPath.endsWith("/") ? "index.html" : ""),
  );
  if (
    !file.startsWith(root + path.sep) ||
    !fs.existsSync(file) ||
    !fs.statSync(file).isFile()
  ) {
    res.writeHead(404);
    res.end();
    return;
  }
  const size = fs.statSync(file).size;
  const range = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
  const start = range ? Number(range[1]) : 0;
  const end =
    range && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
  if (start >= size) {
    res.writeHead(416);
    res.end();
    return;
  }
  const headers = {
    "Content-Type": mime[path.extname(file)] || "application/octet-stream",
    "Content-Length": end - start + 1,
    "Accept-Ranges": "bytes",
  };
  if (range) headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
  res.writeHead(range ? 206 : 200, headers);
  fs.createReadStream(file, { start, end }).pipe(res);
});
(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    const errors = [];
    const failed = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => {
      if (r.url().startsWith(base) && r.status() >= 400) failed.push(r.url());
    });
    await page.route("**/*googletagmanager*", (r) => r.abort());
    await page.goto(base + "/", { waitUntil: "networkidle" });
    await page.waitForFunction(
      () => document.querySelectorAll(".scene-image.visible").length === 1,
    );
    assert.equal(await page.locator("h1").innerText(), "ОБОЛОЧКА.");
    assert.equal(await page.locator(".tracklist li").count(), 4);
    assert.equal(await page.locator(".lyric-panel:visible").count(), 1);
    await page.screenshot({
      path: path.join(root, "docs/preview/desktop.jpg"),
      type: "jpeg",
      quality: 82,
    });
    await page.locator("#hero-play").click();
    await page.waitForFunction(
      () =>
        !document.querySelector("#audio").paused &&
        document.querySelector("#audio").currentTime > 0.1,
    );
    for (let i = 1; i < 4; i++) {
      await page.locator(`[data-select="${i}"]`).click();
      await page.waitForFunction(
        (i) =>
          document.querySelector("#audio").currentTime > 0.1 &&
          document.querySelector("#player-title").textContent ===
            window.ALBUM.tracks[i].title,
        i,
      );
      await page.waitForFunction(
        (i) =>
          document.querySelector(".scene-image.visible").getAttribute("src") ===
          window.ALBUM.tracks[i].art,
        i,
      );
      assert.equal(
        await page
          .locator(".selected [data-select]")
          .getAttribute("data-select"),
        String(i),
      );
    }
    // Lyrics browsing must not change the playing song or interrupt it.
    await page.locator('[data-lyrics="0"]').click();
    assert.equal(
      await page.locator(".lyric-panel:visible").getAttribute("id"),
      "text-new-oil",
    );
    assert.equal(await page.locator("#player-title").innerText(), "До завтра");
    assert.equal(await page.locator("#audio").evaluate((a) => a.paused), false);
    await page.locator("#read-current").click();
    assert.equal(
      await page.locator(".lyric-panel:visible").getAttribute("id"),
      "text-tomorrow",
    );
    await page.locator("#play").click();
    assert.equal(await page.locator("#audio").evaluate((a) => a.paused), true);
    await page.locator("#seek").evaluate((el) => {
      el.value = "35";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    assert.equal(
      Math.floor(await page.locator("#audio").evaluate((a) => a.currentTime)),
      35,
    );
    await page.locator("#volume").evaluate((el) => {
      el.value = "0";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.locator("#mute").click();
    assert.equal(
      await page.locator("#audio").evaluate((a) => !a.muted && a.volume > 0),
      true,
    );
    await page.locator("#mute").click();
    assert.equal(await page.locator("#audio").evaluate((a) => a.muted), true);
    await page.locator("#mute").click();
    assert.equal(await page.locator("#audio").evaluate((a) => a.muted), false);
    // Use the real audio decoder/ended event, not a synthetic event.
    await page.locator("#play").click();
    await page.locator("#audio").evaluate((a) => {
      a.currentTime = a.duration - 0.15;
    });
    await page.waitForFunction(() => document.querySelector("#audio").ended);
    assert.equal(await page.locator("#player-title").innerText(), "До завтра");
    assert.match(
      await page.locator("#player-status").innerText(),
      /Альбом закончился/,
    );
    await page.locator("#hero-play").click();
    await page.waitForFunction(
      () =>
        document.querySelector("#player-title").textContent === "Новая нефть" &&
        !document.querySelector("#audio").paused &&
        document.querySelector("#audio").currentTime > 0.1,
    );
    await page.locator("#repeat").click();
    await page.locator('[data-select="3"]').click();
    await page.waitForFunction(
      () => document.querySelector("#audio").currentTime > 0.1,
    );
    await page.locator("#audio").evaluate((a) => {
      a.currentTime = a.duration - 0.15;
    });
    await page.waitForFunction(
      () =>
        document.querySelector("#player-title").textContent === "Новая нефть" &&
        document.querySelector("#audio").currentTime > 0.1,
    );
    await page.locator("#repeat").click();
    await page.locator("#audio").evaluate((a) => {
      a.currentTime = a.duration - 0.15;
    });
    await page.waitForFunction(
      () =>
        document.querySelector("#player-title").textContent ===
          "Награда за верность" &&
        document.querySelector("#audio").currentTime > 0.1,
    );
    await page.locator("#previous").click();
    await page.waitForFunction(
      () =>
        document.querySelector("#player-title").textContent === "Новая нефть" &&
        document.querySelector("#audio").currentTime > 0.1,
    );
    // Fast switching cancels obsolete play promises without stale errors.
    await page.locator('[data-select="1"]').dispatchEvent("click");
    await page.locator('[data-select="2"]').dispatchEvent("click");
    await page.locator('[data-select="3"]').dispatchEvent("click");
    await page.waitForFunction(
      () =>
        document.querySelector("#player-title").textContent === "До завтра" &&
        document.querySelector("#audio").currentTime > 0.1,
    );
    assert.equal(await page.locator("#player-status").innerText(), "");
    await page.locator("#lyrics").scrollIntoViewIfNeeded();
    await page.waitForFunction(
      () => !document.querySelector("#mini-player").hidden,
    );
    await page.locator("#mini-play").click();
    assert.equal(await page.locator("#audio").evaluate((a) => a.paused), true);
    await page.goto(base + "/?track=twenty-two", { waitUntil: "networkidle" });
    assert.equal(
      await page.locator("#player-title").innerText(),
      "Я умер в двадцать втором",
    );
    assert.equal(await page.locator("#audio").evaluate((a) => a.paused), true);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        `horizontal overflow at ${width}px`,
      );
      if (width === 390)
        await page.screenshot({
          path: path.join(root, "docs/preview/mobile.jpg"),
          type: "jpeg",
          quality: 82,
        });
    }
    for (let i = 0; i < 4; i++) {
      const id = ["new-oil", "loyalty", "twenty-two", "tomorrow"][i];
      await page.goto(base + "/?track=" + id, { waitUntil: "networkidle" });
      for (const platform of ["youtube", "instagram", "tiktok"]) {
        const expected = await page.evaluate(({ platform, id }) => window.ALBUM_LINKS[platform + "Tracks"][id], { platform, id });
        assert.equal(await page.locator("#track-" + platform).getAttribute("href"), expected);
        assert.equal(await page.locator("#track-" + platform).isVisible(), true);
      }
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 844 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, id + " overflow at " + width);
        if (width === 390 || width === 1440) {
          await page.goto(base + "/?track=" + id, { waitUntil: "networkidle" });
          await page.waitForFunction((id) => document.querySelector(".scene-image.visible").getAttribute("src").includes(id + ".webp"), id);
          await page.screenshot({ path: path.join(root, "docs/preview/" + id + "-" + width + ".jpg"), type: "jpeg", quality: 85 });
        }
      }
    }
    // Both entry points share the approved album and the same resources.
    assert.equal(fs.readFileSync(path.join(root, "index.html"), "utf8"), fs.readFileSync(path.join(root, "obolochka/index.html"), "utf8"));
    for (const entry of ["/", "/obolochka/"]) {
      await page.goto(base + entry + "?track=loyalty", { waitUntil: "networkidle" });
      assert.equal(await page.locator("h1").innerText(), "ОБОЛОЧКА.");
      assert.equal(await page.locator(".tracklist li").count(), 4);
      assert.equal(await page.locator(".album-line").innerText(), "Все что осталось");
      assert.equal(await page.locator("#about-title").innerText(), "Найти\nсебя.");
      assert.equal(await page.locator("link[rel=canonical]").getAttribute("href"), "https://damuraiz.com/");
      assert.equal(await page.locator("script[src*=googletagmanager]").getAttribute("src"), "https://www.googletagmanager.com/gtag/js?id=G-4GMCCWMFBV");
      assert.equal(await page.locator("#player-title").innerText(), "Награда за верность");
      assert.equal(await page.locator(".archive-link").getAttribute("href"), "/new-oil/");
      await page.locator("#hero-play").click();
      await page.waitForFunction(() => document.querySelector("#audio").currentTime > 0.1);
      await page.locator("#play").click();
    }
    await page.goto(base + "/new-oil/", { waitUntil: "networkidle" });
    assert.equal(await page.locator("h1").innerText(), "НОВАЯ\nНЕФТЬ.");
    await page.locator("#hero-play").click();
    await page.waitForFunction(
      () => document.querySelector("#audio").currentTime > 0.1,
    );
    assert.deepEqual(errors, [], "browser errors");
    assert.deepEqual(failed, [], "missing local assets");
    await page.close();
    const noJS = await browser.newPage({
      javaScriptEnabled: false,
      viewport: { width: 390, height: 844 },
    });
    await noJS.route("**/*googletagmanager*", (r) => r.abort());
    await noJS.goto(base + "/");
    assert.equal(await noJS.locator(".lyric-panel:visible").count(), 4);
    assert.equal(await noJS.locator("noscript audio").count(), 4);
    assert.equal(
      await noJS.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    console.log(
      "PASS: real playback of 4 MP3s, seeking, pause, previous/next, sequential ending, repeat, restart, rapid switching, independent lyrics, mini player, deep links, 4 screen widths, album homepage and previous URL, analytics, archive, track platform links and no-JS fallback.",
    );
  } finally {
    await browser.close();
  }
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => server.close());
