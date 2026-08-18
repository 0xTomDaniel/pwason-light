# Pwason Light

Pwason Light turns a steady stochastic event process into eight coordinated light-channel signals and one combined rain-like audio signal.

## Language

**Arrival**:
A distinct event produced by the Steady Poisson Process. Speed counts Arrivals for the whole lamp, regardless of how many Channels share an Arrival.
_Avoid_: Drop, pulse, spectral event

**Channel**:
One of eight separately observable light signals. A Channel's LED wavelength identifies its physical output but does not alter the primary process or sound.
_Avoid_: Color process, audio voice, spectral band

**Channel Coupling**:
The fraction of Arrivals shared across all Channels. Remaining Arrivals are assigned privately and uniformly across the eight Channels.
_Avoid_: Spectral Coupling

**Steady Poisson Process**:
A homogeneous Poisson arrival process with one constant total lamp rate selected by Speed.
_Avoid_: Living rate, Cox process, weather modulation

**Rain Impact Waveform**:
A generated, band-limited, signed pressure-like response used identically for Arrivals from every Channel. It has no pitch or relationship to LED wavelength.
_Avoid_: Note, tone, spectral voice

**Rain Reference**:
A measured rain recording used to evaluate the generated Rain Impact Waveform. Pwason has a documented scientific forest-rain default; a designer may temporarily replace the visual comparison with a local recording. A Rain Reference never participates in Arrival generation.
_Avoid_: Sample bank, recorded waveform generator

**Reference Playback**:
Audible looping playback of the bundled scientific Rain Reference. It is a comparison source alongside generated Arrivals, not a source for generating them. A local Rain Reference is never Reference Playback.
_Avoid_: Sample synthesis, recorded Arrival

**Source Mix**:
The continuous listening balance between generated Arrivals and Reference Playback. Its midpoint audibly blends both sources.
_Avoid_: Spectral Coupling, Channel Coupling

**Impact Position**:
The continuous location assigned to an Arrival within the Listening Field. It is independent of Channel routing.
_Avoid_: Distance Channel, audio Channel

**Listening Field**:
The finite physical area around the listener over which Arrivals are positioned for sound reproduction.
_Avoid_: Spectral field, Channel bank

**Acoustic Propagation**:
The distance loss and left-right direction applied between an Impact Position and the listener.
_Avoid_: Distance voice, rain layer

**Spectral Mapping**:
The assignment from Channel identity to LED wavelength at the light-output stage. It is not part of Arrival generation or rain-audio generation.
_Avoid_: Spectral event generation
