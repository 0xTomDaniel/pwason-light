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
| Channel Coupling | Moves a fixed total Arrival rate between private Channel events and events shared by all eight Channels. |
| Output level | Controls the complete post-compression browser output. |
| Reference profile | Selects the cleaner Redwood leaves-and-ground field recording or the scientific Amazon forest recording for both playback and visual analysis. |
| Source Mix | Crossfades between generated rain and the selected recording. Generated is 0%, the equal-power blend is 50%, and Reference-only is 100%. |
| Audio response | Enables or mutes both generated audio and Reference Playback. |
| New weather seed | Starts a new reproducible realization without changing the controls. |

The separate **Acoustic Factors** panel exposes every audible parameter in the
generated model with both an on/off switch and a continuous amount slider. Its
18 controls cover impact shape, statistical Response Family diversity,
independently evolving low/mid/high textures, a restrained Diffuse Response,
delayed Micro-splashes, field depth and propagation, high-rate density
compensation, and compression. **Reset all factors** restores the Redwood-target
defaults. These controls never alter Reference Playback.

At 100% Reference, the simulator continues producing light Arrivals but skips
construction of muted procedural audio nodes.

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

Each Arrival selects one of 128 seeded Rain Impact Waveforms. A waveform is a
600 ms signed response: it may contain an early Direct Contact, but independently
timed low/mid/high regions and a quiet Diffuse Response continue underneath it.
Statistical Response Families vary whether early, soft, or diffuse energy is
prominent. They are morphology categories, not claims that the recording reveals
a particular contact material. Delayed Micro-splashes add within-response
structure while remaining part of their parent Arrival, preserving the one
steady Poisson clock.

Waveforms retain their seeded amplitude differences; they are not individually
peak-normalized. Overlap therefore creates a continuous texture with occasional
near contacts instead of making every Arrival an equally loud transient. One
Generated Rain Renderer owns waveform selection, event level, distance filtering,
and stereo placement for both live playback and offline analysis. Poisson timing
stays outside that Module.

The model is seeded, nonperiodic, oscillator-free, and identical across light
Channels. The Redwood recording supplies a target rather than samples. In the
measured 20-second segment its crest factor is approximately 17.9×, envelope CV
0.44, background-floor ratio 76%, and cross-band envelope correlation 0.48. The
current generated profile is approximately 12.0×, 0.69, 47%, and 0.47. Its
2.97 kHz centroid and 11.2% energy above 8 kHz are intentionally darker than
the reference after listening showed that the former diffuse default produced
too much static. These measurements constrain the model without overruling
perceptual evidence or claiming identity.

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

The Rain Reference lab shows the first 120 ms of one complete 600 ms generated
response beside the strongest 120 ms contact found during the first ten seconds
of the selected recording. For the steady texture it displays normalized spectra,
spectral centroid, high-frequency energy, spectral flatness, crest factor,
envelope variation, background-floor ratio, and cross-band envelope correlation.

The selected recording can also loop as Reference Playback through Source Mix.
Its calibrated onset density follows Speed using pitch-preserving media time
stretch: Redwood is calibrated at 23.1 onsets/s and Amazon at 15.8 onsets/s.
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

The tests cover seeded Poisson behavior, total-rate coupling, spatial
propagation, Acoustic Factor normalization and bypass behavior, LED envelopes,
generated waveform behavior, the shared live/offline Generated Rain Renderer,
aggregate temporal texture, both reference-file
manifests and preparation, pitch-preserving time-stretch policy, the bounded
Render Loop, signal analysis, and Source Mix invariants.

## Repository map

```text
assets/reference/  Bundled Rain Reference Library and attribution
docs/specs/        Interactive canonical HTML specification
src/               Poisson, light, audio, analysis, and rendering Modules
test/              Public-Interface behavior tests
tools/             Local review server
CONTEXT.md          Canonical project vocabulary
```
