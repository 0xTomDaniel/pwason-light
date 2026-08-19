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
| Reference profile | Selects the Redwood or Amazon field recording, or Andy Farnell’s procedural rain example, for playback and selected-reference analysis. |
| Source Mix | Crossfades between generated rain and the selected Rain Reference. Generated is 0%, the equal-power blend is 50%, and Reference-only is 100%. |
| Audio response | Enables or mutes both generated audio and Reference Playback. |
| New weather seed | Starts a new reproducible realization without changing the controls. |

The separate **Acoustic Factors** panel exposes every meaningful audible
parameter in the generated model with both an on/off switch and a continuous
amount slider. Its 19 controls cover Direct Contact shape, individually
switchable leaf, litter, and wood prevalence, analytic surface excitation, Wet
Microtexture, low/mid/high texture, Spectral Sparsity, field depth and
propagation, high-rate density compensation, and optional compression. Tail,
surface-sustain, and secondary-contact controls were removed after diagnostics
showed that they did not materially affect the field. Surface duration remains
an internal property of each Rain Mark and surface response. **Reset all
factors** restores the Redwood-first listening baseline: 8% Impact Body, 90%
Low Texture, 20% Mid Texture, 98% Band Independence, 92% Spectral Sparsity,
45% Wet Microtexture, 70% Distance Loss, 45% Distance Air Damping, Wood Surface
on at 20%, and Compression off. These controls never alter Reference Playback.

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
continuous left-right placement. The default field extends to about 44.6 m.
At the accepted 70% setting, its distance curve is the ordinary free-field h/d
pressure law, leaving many remote Arrivals at a very low but nonzero propagated
level while rare near Arrivals retain contrast. This is one exact Poisson
population, not an added background-noise clock or statistical field substitute.

Each Arrival receives an audio-only Rain Mark. Drop Population changes the
probability distribution over drop diameter; the same mark coherently derives a
velocity proxy, impact level, contact duration, surface damping, target surface,
and broad spectral focus. Initial surfaces are
leaf, litter/soil, and wood. Liquid impacts and bubbles are deliberately
excluded. Every default response retains a low/mid Surface Body. Optional
upper-frequency Surface Detail may occur on any Rain Mark; it is not assigned
to a drop-size class. Its balance is calculated in expected stochastic output
energy, including filter bandwidth, and its allowance tightens only when a
source response becomes foreground-prominent. This keeps one loud contact from
inheriting the complete field's high-frequency compensation while the Poisson
population retains diffuse detail. That foreground allowance follows the
receiving material: litter keeps a somewhat broader noisy contact than leaf or
wood without adding another layer or changing the aggregate Redwood target.

The renderer creates a restrained sub-millisecond signed Direct Contact plus a
brief analytic Surface Response. Eight overlapping nominal ERB-derived regions
from roughly 100 Hz–18.5 kHz are candidates, but a default Rain Mark selects only
two: at least one body region and one optional detail region when that group is
enabled. Each Rain Mark applies modest seeded center-frequency and bandwidth
variation, smoothing the complete field without making one impact broadband or
adding another control. A compact parabolic/quartic leaf window or Gaussian-like litter
window drives those regions with analytically generated noise; once the window
closes, their filters receive zero input and only their short residual state
decays. Spectral Sparsity controls the selected-region count. Leaf remains
broadly papery and bright rather than becoming high-only; litter remains darker
while retaining upper detail. Band Independence controls how strongly selected
regions diverge through independent noise and finite within-contact envelope
motion without turning them into notes. Low, Mid, and High Texture
scale groups without forcing one shared envelope. Wood is enabled at a
restrained 20% in the default Redwood-first baseline.

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
as a preview in the interface rather than being represented as lossless. Its
encoder cutoff makes 18 kHz the upper edge of Redwood's scored Reference
Evaluation Passband; the 18–20 kHz tail remains visible but is not treated as
natural-rain evidence.

The selector also retains the exact light-rainfall recording from Xavier et
al., “Measuring Amazon Rainfall Intensity With Sound Recorders.” The study
recorded rainfall in Central Amazon forest using a recorder fixed to a tree.

The third profile is Andy Farnell’s pure-synthesis rain example from
*Designing Sound*. Its complete WAV is bundled for traceable comparison, but
the Reference lab analyzes only 14–24 seconds, the portion selected for its wet
noise-band texture. The source
page does not state separate license terms for the example file, so the project
does not represent it as permissively licensed.

- Cleaner recording: <https://freesound.org/s/464334/>
- Cleaner recording license: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)
- Dataset: <https://doi.org/10.23708/I0QYNM>
- Research paper: <https://doi.org/10.1029/2024GL108210>
- Amazon recording license: [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/)
- Farnell source and Pure Data patches: <https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/8375/designing_sound.zip/practical15.html>
- Local provenance and checksum: [`assets/reference/README.md`](assets/reference/README.md)

The Rain Reference lab places the normalized complete-profile spectrum and
signed residual diagnostics first, then stacks three full-width one-second
Representative Field Windows: generated rain, the selected Reference Profile,
and Farnell procedural rain. Every source uses the same 10 ms scan and selects
the window whose level-normalized spectrum is closest to its own complete
profile. Each window contains every overlapping nearby and distant contact and
is not event-aligned. A 1,024-point Hann STFT at 4 ms hops feeds a continuously
interpolated, log-frequency,
70 dB spectrogram rather than an enlarged low-resolution heatmap. The waveform
above each spectrogram is a visual-only, robustly normalized min/max envelope:
every horizontal pixel retains its local extrema, so quiet field detail remains
visible without changing playback gain. For the steady texture it displays normalized spectra,
spectral centroid, high-frequency energy, spectral flatness, crest factor,
sample kurtosis, multiscale envelope variation, background-floor ratio,
cross-band envelope correlation, generated total Arrival rate, and prominent
onsets detected from every source by the same algorithm. Separate 120 ms Impact
Microscopes suppress overlapping onset windows and offer three energy-ranked
choices per source: Strong is nearest the 90th percentile, Typical is nearest
the median, and Soft is nearest the 25th percentile. The absolute maximum is
deliberately excluded so a rare contact cannot define normal rain morphology. Every choice places
its detected onset 20 ms into the excerpt and draws the same marker on waveform
and spectrogram. Alignment is limited by the detector's approximately 2.7 ms
hop and is not a claim about unknowable physical impact time in a recording.
One global Microscope Scaling control defaults to **Profile-matched**. It gives
each source one fixed gain from its complete-profile RMS, reuses that gain for
Strong, Typical, and Soft, and renders every available microscope against one
shared robust waveform reference and one shared STFT power reference. This
preserves relative impact strength without pretending raw microphone gain is
calibrated pressure. **Shape** restores independent per-excerpt normalization
when quiet morphology is the question. Both modes are visual only and leave
samples, metrics, synthesis, Reference Playback, and Impact Audition unchanged.
Each microscope has an Impact Audition button that peak-matches its selected excerpt,
adds only four-millisecond edge fades, and plays the complete 120 ms segment
through the current Output Level without entering Source Mix or synthesis.
Three Onset Population panels then align up to 96 evenly sampled detected
onsets per source, subtract each pre-onset baseline, normalize each envelope,
and display a q10–q90 band with a q50 line plus median peak and 90%-energy
timing. This prevents one exceptional strongest contact from defining the
canonical response shape.

Each reference also shows a level-independent Perceptual Profile Distance and
signed Spectral Profile Residual from the current synth. Solid profile traces
use one-third-octave Gaussian smoothing; faint hairlines retain the raw 96-point
comparison. Scores use the selected Reference Evaluation Passband, while any
codec-limited tail remains visibly shaded and unscored. Spectral Distribution
Residual heatmaps compare q10, q25, q50, q75, and q90 energy at each frequency
after discarding frame order, revealing background-floor and foreground-impact
mismatch without pretending independent stochastic spectrogram pixels align.
The displayed Window Δ reports each Representative Field Window's distance from
its complete profile, which remains authoritative.

The two references are intentionally not averaged into one target. Current
native-rate analysis puts Redwood near 4.22 kHz centroid and 23.9% energy above
8 kHz, while Farnell’s 14–24 second interval is near 9.10 kHz and 55.5%. The
Wood-enabled Redwood-first generated baseline is near 3.66 kHz and 19.9%. On the shared
Rain Diagnostics grid, it reports approximately 1.8 dB Perceptual Profile and
2.4 dB Spectral Distribution distance to Redwood inside 80 Hz–18 kHz, versus
5.8 dB and 8.7 dB to Farnell across the complete shared passband. The retained
raw Redwood trace is approximately 6.0 dB across 80 Hz–20 kHz because its final
two points expose the preview codec cutoff rather than rain. Redwood is the sole enforceable target; Farnell is retained only as a
secondary wet-texture and architecture diagnostic.

The selected Rain Reference can also loop as Reference Playback through Source Mix.
Farnell playback is restricted to the same 14–24 second profile interval rather
than looping the complete demonstration render.
Detected foreground onsets are not treated as the physical drop count: Redwood
stores a 38.5 onsets/s detector baseline and a separate provisional
field-continuity match of 1,000 total Arrivals/s. Reference Playback is therefore
1× at Speed 1,000, and the default generated comparison also runs at 1,000
Arrivals/s. The Speed–Population Link starts off so this denser field does not
silently force the independently selected 69% Drop Population to its endpoint.
Amazon stores 15.8 detected onsets/s but remains explicitly uncalibrated rather
than inheriting Redwood's multiplier. Farnell’s 14–24 second interval measures
43.4 detected onsets/s and is likewise uncalibrated. Profiles without a total-rate calibration
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
live/offline Generated Rain Renderer, multiscale temporal texture, all three
reference-file manifests, fixed analysis-interval preparation, normalized
spectral-distance analysis, bounded aligned-onset population summaries,
pitch-preserving time-stretch policy,
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
