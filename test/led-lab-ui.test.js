import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const specificationUrl = new URL(
  "../docs/specs/poisson-led-lab.spec.html",
  import.meta.url,
);

test("the standalone LED lab exposes parallel nine-LED Poisson and PWM banks", async () => {
  const html = await readFile(specificationUrl, "utf8");

  assert.equal((html.match(/\sdata-current-led(?:\s|>)/g) ?? []).length, 18);
  assert.equal((html.match(/<div class="condition-bank" data-condition-bank="poisson">/g) ?? []).length, 1);
  assert.equal((html.match(/<div class="condition-bank" data-condition-bank="pwm">/g) ?? []).length, 1);
  assert.equal((html.match(/<strong>White Σ<\/strong>/g) ?? []).length, 2);
  assert.match(html, /normalized mean of eight Channels/i);
});

test("the standalone controls describe one total rate through 48 kHz", async () => {
  const html = await readFile(specificationUrl, "utf8");

  assert.match(html, /id="led-rate"[^>]+max="4\.681241237375588"/);
  assert.match(html, /id="led-rate"[^>]+step="any"/);
  assert.match(html, /48,000 Arrivals\/s total/i);
  assert.match(html, /6,000 Arrivals\/s per Channel/i);
});

test("current owns the signal path and audio is only its mean-centered monitor", async () => {
  const html = await readFile(specificationUrl, "utf8");

  assert.match(html, /Poisson \+ PWM → two independent virtual LED banks/i);
  assert.match(html, /selected Aggregate White − Target Mean Current → Monitor Gain → mono speakers/i);
  assert.match(html, /id="sound-enabled"[^>]+checked/);
  assert.doesNotMatch(html, /equalizer|rain mark|surface response/i);
  assert.doesNotMatch(html, /id="(?:compression|compressor|limiter|equalizer)"/i);
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

test("the lab exposes PWM as a matched scientific control condition", async () => {
  const html = await readFile(specificationUrl, "utf8");

  assert.match(html, /name="monitor-source"[^>]+value="poisson"[^>]+checked/);
  assert.match(html, /name="monitor-source"[^>]+value="pwm"/);
  assert.match(html, /id="pwm-frequency-output"/);
  assert.match(html, /PWM frequency = total event rate ÷ eight/i);
  assert.match(html, /Target Mean Current becomes PWM duty cycle/i);
  assert.match(html, /data-poisson-only/);
  assert.match(html, /Both conditions run continuously/i);
});

test("the lab exposes separate fixed-scale current and audio oscilloscopes", async () => {
  const html = await readFile(specificationUrl, "utf8");

  assert.match(html, /id="current-scope"/);
  assert.match(html, /id="audio-scope"/);
  assert.match(html, /target-centered waveform/i);
  assert.match(html, /fixed −1 to \+1 current units/i);
  assert.match(html, /no visual normalization/i);
});

test("the scopes expose a shared morphology timebase", async () => {
  const html = await readFile(specificationUrl, "utf8");

  assert.match(html, /name="scope-timebase"[^>]+value="1"/);
  assert.match(html, /name="scope-timebase"[^>]+value="0\.1"/);
  assert.match(html, /name="scope-timebase"[^>]+value="0\.01"[^>]+checked/);
  assert.match(html, /name="scope-timebase"[^>]+value="0\.001"/);
  assert.match(html, /connected min\/max envelopes/i);
});

test("Target Mean Current travels continuously to a declared 100% full-DC endpoint", async () => {
  const html = await readFile(specificationUrl, "utf8");

  assert.match(html, /id="target-current"[^>]+max="100"[^>]+step="0\.1"/);
  assert.match(html, /<span>100%<\/span>/);
  assert.match(html, /100% is full DC/i);
});

test("the AC Current Monitor exposes manual logarithmic gain without automatic processing", async () => {
  const html = await readFile(specificationUrl, "utf8");

  assert.match(html, /<span>Monitor gain<\/span>/i);
  assert.match(html, /id="output-level"[^>]+min="-2"[^>]+max="1\.505149978319906"/);
  assert.match(html, /id="output-level"[^>]+step="any"[^>]+value="0\.3010299956639812"/);
  assert.match(html, /<span>0\.01×<\/span><span>32×<\/span>/);
  assert.match(html, /no automatic gain, limiter, or compressor/i);
});
