# Pwason Light

Pwason Light is an interactive HTML specification for an eight-Channel light
instrument driven by a steady Poisson process. The same Arrivals produce a
procedurally generated, spatial rain texture and eight virtual LED responses.

LED wavelength is output metadata only: it does not influence Arrival timing,
audio pitch, or timbre. The eight Channels matter because they are separately
observable light outputs, not because they represent eight audio frequencies.

## Run the interactive specification

From the repository root:

```sh
python3 tools/review-serve.py . 7160
```

Open:

<http://127.0.0.1:7160/docs/specs/pwason-light.spec.html>

Press **Start process** to enable audio and begin generating Arrivals. Audio
never begins automatically.

## Controls

| Control | Behavior |
| --- | --- |
| Speed | Continuously selects the total lamp Arrival rate from 1 to 1,000 events/s on a logarithmic scale. |
| Drop Population | Moves the audio Rain Mark distribution from fine-dominant through mixed to large-drop-rich without changing the Arrival rate. |
| Link Speed + Drop Population | Bidirectionally aligns both normalized slider positions; switching it off preserves their current values. |
| Channel Coupling | Moves a fixed total Arrival rate between private Channel events and events shared by all eight Channels. |
| Output level | Controls the complete post-output-stage browser signal. |
| Reference profile | Selects the cleaner Redwood leaves-and-ground field recording or the scientific Amazon forest recording for both playback and visual analysis. |
| Source Mix | Crossfades between generated rain and the selected recording. Generated is 0%, the equal-power blend is 50%, and Reference-only is 100%. |
| Audio response | Enables or mutes both generated audio and Reference Playback. |
| New weather seed | Starts a new reproducible realization without changing the controls. |

The separate **Acoustic Factors** panel exposes every audible parameter in the
generated model with both an on/off switch and a continuous amount slider. Its
23 controls cover Direct Contact shape, individually switchable leaf, litter,
and wood prevalence, analytic surface excitation and sustain, Wet Microtexture,
low/mid/high texture, Spectral Sparsity, delayed secondary contacts, field depth
and propagation, high-rate density compensation, and optional compression.
**Reset all factors** restores the current listening baseline: 70% Distance
Loss, 20% Mid Texture, 35% Wet Microtexture, 60% Distance Air Damping, Micro-splashes off, Wood
Surface off, and Compression off. These controls never alter Reference Playback.

At 100% Reference, the simulator continues producing light Arrivals but skips
generated-audio scheduling.

## Rain model

Speed is the total distinct Arrival rate `Λ` for the whole lamp. It is not a
per-Channel rate. With Channel Coupling `C`:

```text
shared rate        = CΛ
private rate       = (1 − C)Λ / 8 per Channel
total Arrival rate = Λ
```

Each Arrival receives an independent position within a circular Listening
Field. Field Depth sets its radius, Distance Loss controls relative pressure,
Distance Air Damping softens remote high frequencies, and Stereo Spread controls
continuous left-right placement. No additional timing or distance Channels are
created.

Each Arrival receives an audio-only Rain Mark. Drop Population changes the
probability distribution over drop diameter; the same mark coherently derives a
velocity proxy, impact level, contact duration, surface damping, target surface,
broad spectral focus, and secondary-contact probability. Initial surfaces are
leaf, litter/soil, and wood. Liquid impacts and bubbles are deliberately
excluded.

The renderer creates a restrained sub-millisecond signed Direct Contact plus a
brief analytic Surface Response. Eight overlapping ERB-derived regions from
roughly 100 Hz–18.5 kHz are candidates, but a default Rain Mark selects only
about three. A compact parabolic/quartic leaf window or Gaussian-like litter
window drives those regions with analytically generated noise; once the window
closes, their filters receive zero input and only their short residual state
decays. Spectral Sparsity controls the selected-region count. Leaf remains
broadly papery and bright rather than becoming high-only; litter remains darker
while retaining upper detail. Band Independence controls how strongly selected
regions diverge without turning them into notes. Low, Mid, and High Texture
scale groups without forcing one shared envelope. Wood and Micro-splashes are
disabled in the default single-drop baseline.

Wet Microtexture adds restrained spray and occasional high-frequency cusps while the
same compact surface window is open. Correlated analytic noise is thresholded,
rectified, quadratically shaped, high-pass filtered, and sent through a short,
seed-varied band-pass wavelet. It ends with its parent response and has no
independent event clock. It is not a bubble model, recorded grain, sustained
hiss, or stationary noise bed. The switch and amount slider make its
contribution directly comparable at identical Arrivals.

Across the complete default response bank, 90% of impacts peak within their
first 25 ms, the median response delivers 90% of its energy within 35 ms, and
the 90th percentile does so within 55 ms. Median temporal-energy skew stays
below 1.5, guarding against the old fast-attack/exponential-noise shape.
Zero-valued endpoints prevent buffer seams without delaying the onset through a
multi-millisecond fade. No hidden resonator remains when the explicit texture
controls are off. No recording, grain, impulse response, extracted waveform,
stable note, long shared envelope, or stationary noise bed contributes to
synthesis.

Audio is exact Poisson shot synthesis:

```text
x(t) = Σ h(t − tᵢ; Mᵢ)
```

The same Generated Rain Renderer prepares live and offline plans. A thin
AudioWorklet sums those plans in continuous blocks, preserving response and
distance-filter state across boundaries instead of constructing thousands of
short-lived browser nodes. Tests prove the offline output is identical across
different block partitions. Poisson timing remains outside the renderer.

The model is seeded, nonperiodic, and independent of light-channel wavelength.
Rain recordings provide visible and optional audible evaluation references only;
they never supply generated samples. The comparison now includes kurtosis and
5/20/100/500 ms envelope statistics in addition to spectrum, crest, background
floor, and cross-band envelope correlation. The default renderer is also held
within 3 dB RMS of Redwood's measured nine-band broad contour and within 2 dB
RMS of its thirteen-band 80 Hz–19.5 kHz fine contour.

## Rain Reference Library

The default is a cleaner CC0 stereo field recording by Andron827 of rain on
earthen ground, fallen logs, and large leaves in Redwood Shores. Its source
description lists no stream or flowing water. The bundled asset is Freesound's
high-quality MP3 preview of the original 44.1 kHz, 16-bit WAV, and is labeled
as a preview in the interface rather than being represented as lossless.

The selector also retains the exact light-rainfall recording from Xavier et
al., “Measuring Amazon Rainfall Intensity With Sound Recorders.” The study
recorded rainfall in Central Amazon forest using a recorder fixed to a tree.

- Cleaner recording: <https://freesound.org/s/464334/>
- Cleaner recording license: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)
- Dataset: <https://doi.org/10.23708/I0QYNM>
- Research paper: <https://doi.org/10.1029/2024GL108210>
- Amazon recording license: [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/)
- Local provenance and checksum: [`assets/reference/README.md`](assets/reference/README.md)

The Rain Reference lab shows matched 120 ms Field Windows centered on the
strongest contact in the eight-second generated field and the first ten seconds
of the selected recording. Each window contains every overlapping nearby and
distant contact; neither is presented as an isolated measured drop. A 1,024-point
Hann STFT at 1 ms hops feeds a continuously interpolated, log-frequency,
70 dB spectrogram rather than an enlarged low-resolution heatmap. For the steady texture it displays normalized spectra,
spectral centroid, high-frequency energy, spectral flatness, crest factor,
sample kurtosis, multiscale envelope variation, background-floor ratio,
cross-band envelope correlation, generated total Arrival rate, and prominent
onsets detected from both sources by the same algorithm.

The selected recording can also loop as Reference Playback through Source Mix.
Detected foreground onsets are not treated as the physical drop count: Redwood
stores a 23.1 onsets/s detector baseline and a separate provisional
operator-tempo match of 120 total Arrivals/s. Reference Playback is therefore
1× at Speed 120, and the generated comparison also runs at 120 Arrivals/s.
Amazon stores 15.8 detected onsets/s but remains explicitly uncalibrated rather
than inheriting Redwood's multiplier. Profiles without a total-rate calibration
visibly fall back to their detected-onset rate for comparison.
Because steady rain is statistically stationary, transport-rate changes can
be difficult to hear and are not event-level resynthesis. The clean range is
0.75×–4×; the interface visibly reports when the requested transport lies
beyond that range and playback is capped. The recording
never enters the Poisson process and contributes no samples to generated
Arrivals. A locally selected recording overrides only the visual analysis; it
is neither uploaded nor used for playback.

## Specification review

The HTML specification includes the working prototype, canonical behavior,
user stories, implementation decisions, testing decisions, and scope.

Press bare **C** to enter spec-chat comment mode. Review annotations are written
to `docs/specs/pwason-light.spec.html.review/`; that runtime spool is ignored by
Git.

The spec-chat runtime and ECharts are vendored under `docs/specs/.viz/`, so the
review surface does not depend on a CDN.

## Test

Requires a current Node.js runtime. The project has no package dependencies.

```sh
npm test
```

The tests cover seeded Poisson behavior, total-rate coupling, linked and unlinked
Drop Population controls, coherent Rain Marks, spatial propagation, Acoustic
Factor normalization and bypass behavior, LED envelopes, compact-window peak
and cumulative-energy waveform behavior, rounded temporal-energy shape,
per-impact spectral occupancy, high-passed Wet Microtexture contrast and full
bypass, broad non-extreme leaf/litter signatures, the
nine- and thirteen-band Redwood tonal targets, independent texture-region
decay, response-bank identity, exact block-partition invariance, the shared
live/offline Generated Rain Renderer, multiscale temporal texture, both
reference-file manifests and preparation, pitch-preserving time-stretch policy,
the bounded Render Loop, signal analysis, and Source Mix invariants.

## Repository map

```text
assets/reference/  Bundled Rain Reference Library and attribution
docs/specs/        Interactive canonical HTML specification
src/               Poisson, light, audio, analysis, and rendering Modules
test/              Public-Interface behavior tests
tools/             Local review server
CONTEXT.md          Canonical project vocabulary
```
