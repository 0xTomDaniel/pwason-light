import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const specificationUrl = new URL(
  "../docs/specs/poisson-led-lab.spec.html",
  import.meta.url,
);

test("the standalone LED lab exposes eight spectral Channels and one fused white monitor", async () => {
  const html = await readFile(specificationUrl, "utf8");

  assert.equal((html.match(/\sdata-current-led(?:\s|>)/g) ?? []).length, 9);
  assert.match(html, /<strong>White Σ<\/strong>/);
  assert.match(html, /normalized mean of eight Channels/i);
});

test("the standalone controls describe one total rate through 48 kHz", async () => {
  const html = await readFile(specificationUrl, "utf8");

  assert.match(html, /id="led-rate"[^>]+max="4\.681241237375588"/);
  assert.match(html, /id="led-rate"[^>]+step="any"/);
  assert.match(html, /48,000 Arrivals\/s total/i);
  assert.match(html, /6,000 Arrivals\/s per Channel/i);
});

test("current owns the signal path and audio is only its AC-coupled monitor", async () => {
  const html = await readFile(specificationUrl, "utf8");

  assert.match(html, /Poisson Arrivals → positive current → virtual LEDs/i);
  assert.match(html, /current → DC blocker → output level → mono speakers/i);
  assert.match(html, /id="sound-enabled"[^>]+checked/);
  assert.doesNotMatch(html, /compression|equalizer|rain mark|surface response/i);
});

test("the LED display has one fixed frame-mean rule and separate diagnostics", async () => {
  const html = await readFile(specificationUrl, "utf8");

  assert.match(html, /arithmetic mean of every current sample/i);
  assert.match(html, /id="mean-current"/);
  assert.match(html, /id="rms-modulation"/);
  assert.match(html, /id="peak-current"/);
  assert.match(html, /id="limit-proximity"/);
  assert.match(html, /id="current-scope"/);
});
