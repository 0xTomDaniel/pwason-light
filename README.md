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
| Source Mix | Crossfades between generated rain and the bundled Amazon recording. Generated is 0%, the equal-power blend is 50%, and Amazon-only is 100%. |
| Audio response | Enables or mutes both generated audio and Amazon Reference Playback. |
| New weather seed | Starts a new reproducible realization without changing the controls. |

At 100% Amazon, the simulator continues producing light Arrivals but skips
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
Field. Distance controls relative pressure and azimuth controls continuous
left-right placement. No additional timing or distance Channels are created.

The Rain Impact Waveform is generated from a signed pressure onset and a
decaying, filtered stochastic surface reaction. It is seeded, nonperiodic,
oscillator-free, and identical across light Channels.

## Scientific Rain Reference

The repository includes the exact light-rainfall recording from Xavier et al.,
“Measuring Amazon Rainfall Intensity With Sound Recorders.” The study recorded
rainfall in Central Amazon forest using a recorder fixed to a tree.

- Dataset: <https://doi.org/10.23708/I0QYNM>
- Research paper: <https://doi.org/10.1029/2024GL108210>
- License: [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/)
- Local provenance and checksum: [`assets/reference/README.md`](assets/reference/README.md)

The Rain Reference lab automatically compares a generated 120 ms impact with
the strongest 120 ms impact found during the first ten seconds of the measured
recording. It displays waveforms, spectrograms, normalized spectra, spectral
centroid, high-frequency energy, and spectral flatness.

The bundled recording can also loop as Reference Playback through Source Mix.
It never enters the Poisson process and contributes no samples to generated
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
propagation, LED envelopes, generated waveform behavior, scientific-reference
integrity and preparation, the bounded Render Loop, signal analysis, and Source
Mix invariants.

## Repository map

```text
assets/reference/  Scientific Rain Reference and attribution
docs/specs/        Interactive canonical HTML specification
src/               Poisson, light, audio, analysis, and rendering Modules
test/              Public-Interface behavior tests
tools/             Local review server
CONTEXT.md          Canonical project vocabulary
```
