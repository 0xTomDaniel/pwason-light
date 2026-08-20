import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const specificationUrl = new URL(
  "../docs/specs/pwason-light.spec.html",
  import.meta.url,
);

test("the prototype exposes eight Channel LEDs and one white aggregate", async () => {
  const html = await readFile(specificationUrl, "utf8");

  assert.equal((html.match(/\sdata-led(?:\s|>)/g) ?? []).length, 9);
  assert.equal((html.match(/data-led-modulation/g) ?? []).length, 9);
  assert.match(html, /aria-label="Aggregate white intensity"/);
  assert.match(html, /<strong>White Σ<\/strong><span>8-channel mean<\/span>/);
});

test("the logarithmic Speed control is capped at 48000 Arrivals per second", async () => {
  const html = await readFile(specificationUrl, "utf8");

  assert.match(html, /id="rate"[^>]+max="4\.681241237375588"/);
  assert.match(html, /<span style="--tick:100%">48k<\/span>/);
  assert.doesNotMatch(html, /100k|100,000/);
});

test("the prototype exposes one fixed optical current sensitivity control", async () => {
  const html = await readFile(specificationUrl, "utf8");

  assert.match(html, /id="optical-sensitivity"[^>]+min="0"[^>]+max="8"[^>]+value="5"/);
  assert.match(html, /id="optical-sensitivity-output"[^>]*>32×</);
  assert.match(html, /<div class="range-ends"><span>1×<\/span><span>256×<\/span><\/div>/);
});

test("the prototype exposes an additive and subtractive optical mode switch", async () => {
  const html = await readFile(specificationUrl, "utf8");

  assert.match(html, /id="optical-subtractive"[^>]+type="checkbox"[^>]+role="switch"/);
  assert.match(html, /id="optical-mode-output"[^>]*>Additive · silence dark</);
});
