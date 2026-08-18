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
A complete generated, band-limited, signed pressure-like response used identically for Arrivals from every Channel. It may contain a Direct Contact, independently evolving frequency regions, a Diffuse Response, and delayed Micro-splashes, but has no pitch or relationship to LED wavelength.
_Avoid_: Note, tone, spectral voice

**Response Family**:
A seeded statistical morphology assigned to a Rain Impact Waveform. Response Families vary the balance and timing of early, soft, and diffuse energy without claiming that an unlabeled recording event came from a known material.
_Avoid_: Named surface, extra Arrival, audio Channel

**Direct Contact**:
The bounded early pressure response that can make one Arrival individually perceptible. A Response Family may make it prominent, quiet, or delayed.
_Avoid_: Mandatory onset peak, snare transient

**Diffuse Response**:
The quieter sustained part of a Rain Impact Waveform whose overlap with other Arrivals forms continuous far-field texture. It remains part of its parent Arrival and has no separate clock.
_Avoid_: Background recording, ambient loop, second Poisson process

**Acoustic Factor**:
One independently switchable, continuously adjustable contribution or modifier in generated rain audio. Acoustic Factors change response shape, spatial presentation, or output behavior; they never change Channel routing, Source Mix, or the steady Poisson clock.
_Avoid_: Hidden tuning constant, spectral Channel, weather process

**Acoustic Factor Preset**:
A complete set of Acoustic Factor switch states and amounts. The default Redwood-target preset is a starting model, not an automatically fitted truth claim.
_Avoid_: Recording profile, sample preset

**Micro-splash**:
A quieter delayed secondary contact generated inside one Rain Impact Waveform. It belongs to its parent Arrival and never counts as an additional Arrival.
_Avoid_: Secondary Poisson event, extra drop stream

**Acoustic Target Profile**:
A measured aggregate spectral and temporal shape used to constrain generated rain texture. Pwason's current Acoustic Target Profile comes from the default Redwood Rain Reference but contains no recording samples.
_Avoid_: Sample synthesis, spectral note, selected playback profile

**Generated Rain Renderer**:
The Module that maps caller-owned Arrivals to complete audible render plans and uses the same path to produce an offline generated profile. It owns Rain Impact Waveform selection, Acoustic Propagation, and event level, but never owns Poisson timing.
_Avoid_: Poisson engine, recorded-rain player

**Rain Reference**:
A measured rain recording used to evaluate the generated Rain Impact Waveform. A designer may temporarily replace the visual comparison with a local recording. A Rain Reference never participates in Arrival generation.
_Avoid_: Sample bank, recorded waveform generator

**Reference Library**:
The two bundled Rain References available for traceable analysis and playback: the default CC0 Redwood leaves-and-ground recording and the retained scientific Amazon recording.
_Avoid_: Sample bank, synthesis corpus

**Reference Profile**:
One Reference Library entry: its recording, provenance, surface, format, checksum, and calibrated natural onset density. Selecting a profile controls both visual analysis and Reference Playback.
_Avoid_: Audio Channel, spectral profile

**Reference Playback**:
Audible looping playback of the selected Reference Profile. It is a comparison source alongside generated Arrivals, not a source for generating them. A local Rain Reference is never Reference Playback.
_Avoid_: Sample synthesis, recorded Arrival

**Reference Time Stretch**:
Pitch-preserving transport-speed change applied to Reference Playback relative to its calibrated onset density. A steady recording can mask the perceived change, so Reference Time Stretch is not proof of event-level density matching. The clean range is 0.75×–4×; a capped value is explicitly marked as limited.
_Avoid_: Pitch shift, spectral matching, resampling synthesis

**Source Mix**:
The continuous listening balance between generated Arrivals and Reference Playback. Its midpoint audibly blends both sources.
_Avoid_: Spectral Coupling, Channel Coupling

**Impact Position**:
The continuous location assigned to an Arrival within the Listening Field. It is independent of Channel routing.
_Avoid_: Distance Channel, audio Channel

**Listening Field**:
The finite physical area around the listener over which Arrivals are positioned for sound reproduction. Its radius is controlled by the Field Depth Acoustic Factor.
_Avoid_: Spectral field, Channel bank

**Acoustic Propagation**:
The distance loss, high-frequency air damping, and left-right direction applied between an Impact Position and the listener.
_Avoid_: Distance voice, rain layer

**Spectral Mapping**:
The assignment from Channel identity to LED wavelength at the light-output stage. It is not part of Arrival generation or rain-audio generation.
_Avoid_: Spectral event generation
