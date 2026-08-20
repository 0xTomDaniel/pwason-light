import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const specificationUrl = new URL(
  "../docs/specs/poisson-led-lab.spec.html",
  import.meta.url,
);
const applicationUrl = new URL("../src/led-lab-app.js", import.meta.url);

test("the standalone LED lab exposes parallel nine-LED Poisson and PWM banks", async () => {
  const html = await readFile(specificationUrl, "utf8");

  assert.equal((html.match(/\sdata-current-led(?:\s|>)/g) ?? []).length, 18);
  assert.equal((html.match(/<div class="condition-bank" data-condition-bank="poisson">/g) ?? []).length, 1);
  assert.equal((html.match(/<div class="condition-bank" data-condition-bank="pwm"[^>]*>/g) ?? []).length, 1);
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

test("the Poisson LED display preserves complete report means and separate diagnostics", async () => {
  const html = await readFile(specificationUrl, "utf8");

  assert.match(html, /arithmetic mean of every current sample/i);
  assert.match(html, /PWM bank does not reuse those arbitrary report-window means/i);
  assert.match(html, /id="mean-current"/);
  assert.match(html, /id="rms-modulation"/);
  assert.match(html, /id="peak-current"/);
  assert.match(html, /id="limit-proximity"/);
  assert.match(html, /id="poisson-current-scope"/);
  assert.match(html, /id="pwm-current-scope"/);
});

test("the PWM LED bank declares its refresh-aware presentation mode", async () => {
  const [html, application] = await Promise.all([
    readFile(specificationUrl, "utf8"),
    readFile(applicationUrl, "utf8"),
  ]);

  assert.match(html, /id="pwm-led-presentation-output"/);
  assert.match(html, /Resolved below the four-frame quality limit/i);
  assert.match(html, /Transition through its final 30%/i);
  assert.match(html, /Integrated at ≥15 Hz per Channel/i);
  assert.doesNotMatch(html, /transition:\s*background 32ms/i);
  assert.match(application, /createPwmLedPresentation/);
  assert.match(application, /presentation\.mode/);
  assert.match(application, /presentation\.displayRefreshRateHz/);
  assert.match(application, /currentToDisplayLevel/);
});

test("the lab exposes PWM as a matched scientific control condition", async () => {
  const html = await readFile(specificationUrl, "utf8");

  assert.match(html, /name="monitor-source"[^>]+value="poisson"[^>]+checked/);
  assert.match(html, /name="monitor-source"[^>]+value="pwm"/);
  assert.match(html, /id="pwm-frequency-output"/);
  assert.match(html, /PWM frequency = total event rate ÷ eight/i);
  assert.match(html, /duty is derived as Target Mean Current ÷ PWM On Current/i);
  assert.match(html, /data-condition-target="pwm"/i);
  assert.match(html, /commanded mean/i);
  assert.match(html, /frame mean/i);
  assert.match(html, /data-poisson-only/);
  assert.match(html, /Both conditions run continuously/i);
});

test("PWM exposes On Current separately while deriving duty from the shared mean", async () => {
  const html = await readFile(specificationUrl, "utf8");

  assert.match(html, /id="pwm-on-current"[^>]+min="50"[^>]+max="100"[^>]+step="0\.1"[^>]+value="100"/);
  assert.match(html, /id="pwm-on-current-output">100%<\/output>/);
  assert.match(html, /id="pwm-duty-output">50% duty<\/output>/);
  assert.match(html, /duty = Target Mean Current ÷ PWM On Current/i);
  assert.match(html, /On Current minimum follows Target Mean Current/i);
});

test("PWM exposes derived on-time and silence as read-only timing evidence", async () => {
  const html = await readFile(specificationUrl, "utf8");

  assert.match(html, /<span>PWM on time<\/span><output id="pwm-on-time-output">4\.00 ms<\/output>/i);
  assert.match(html, /<span>PWM silence<\/span><output id="pwm-silence-output">4\.00 ms<\/output>/i);
  assert.match(html, /on-time and silence are derived readouts, not independent controls/i);
});

test("the specification distinguishes matched current from optical and perceptual equivalence", async () => {
  const html = await readFile(specificationUrl, "utf8");

  assert.match(html, /PWM On Current is a waveform-morphology control, not a brightness control/i);
  assert.match(html, /Imean = Ion × D/i);
  assert.match(html, /IRMS = √\(Imean × Ion\)/i);
  assert.match(html, /equal mean current does not guarantee equal optical emission/i);
  assert.match(html, /48 kHz total event budget is not a 48 kHz PWM carrier/i);
  assert.match(html, /6 kHz per Channel/i);
  assert.match(html, /no universal imperceptibility frequency/i);
  assert.match(html, /20 kHz/i);
  assert.match(html, /photodiode/i);
});

test("the lab exposes simultaneous fixed-scale condition scopes and one selected audio scope", async () => {
  const html = await readFile(specificationUrl, "utf8");

  assert.match(html, /id="poisson-current-scope"/);
  assert.match(html, /id="pwm-current-scope"/);
  assert.match(html, /id="audio-scope"/);
  assert.match(html, /Simultaneous aggregate currents/i);
  assert.match(html, /both current scopes remain visible and retain history when Monitor Source changes/i);
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
  assert.match(html, /id="output-level"[^>]+min="-2"[^>]+max="0\.3010299956639812"/);
  assert.match(html, /id="output-level"[^>]+step="any"[^>]+value="0\.3010299956639812"/);
  assert.match(html, /id="output-level-output">2× effective<\/output>/i);
  assert.match(html, /id="monitor-gain-maximum">2× base safe max<\/output>/i);
  assert.match(html, /Gsafe = 1 ÷ max\(Ī, 1 − Ī\)/);
  assert.match(html, /clamps immediately when Target Mean Current changes/i);
  assert.match(html, /PWM monitoring applies a fixed ¼× source attenuation/i);
  assert.match(html, /no automatic gain, limiter, or compressor/i);
});
