# Pwason Light

Pwason Light turns a steady stochastic event process into eight coordinated light-channel signals, one normalized white aggregate, and one combined rain-like audio signal.

## Language

**Arrival**:
A distinct event produced by the Steady Poisson Process. Speed counts Arrivals for the whole lamp, regardless of how many Channels share an Arrival.
_Avoid_: Drop, pulse, spectral event

**Channel**:
One of eight separately observable light signals. A Channel's LED wavelength identifies its physical output but does not alter the primary process or sound.
_Avoid_: Color process, audio voice, spectral band

**Poisson LED Lab Engine**:
The standalone current-first comparison Module that owns simultaneous Steady Poisson Process and PWM Control condition engines, their shared controls, two eight-Channel current banks, two Aggregate White signals, and the monitor selection. Its Interface advances both deterministic sample blocks together; Monitor Source exposes either already-running condition to diagnostics and the direct AC Current Monitor without resetting either or calling the Generated Rain Renderer.
_Avoid_: Rain renderer, audio-to-light adapter, mixed acoustic source

**PWM Control**:
The deterministic scientific control condition that runs continuously beside Poisson in the LED lab. Below full DC, every Channel receives the same phase-aligned binary current at frequency `Λ/8`, so eight rising-edge counts sum to the selected total event budget `Λ`. Target Mean Current becomes duty cycle and Current Fall Time is ignored. At exactly 100%, current remains continuously on while PWM phase and cycle accounting continue. A separate nine-LED bank always displays it; Monitor Source only chooses whether its Aggregate White feeds diagnostics, commanded-mean subtraction, Monitor Gain, and both oscilloscopes.
_Avoid_: Poisson approximation, audio oscillator, staggered aggregate smoothing

**Current Response**:
The positive exponential current injected into one Channel by one Arrival in the standalone LED lab. Its selectable fall time controls overlap. Its charge varies inversely with total Arrival rate and response duration so high-density comparisons approach the selected Target Mean Current without using automatic signal normalization or a hard clipping plateau.
_Avoid_: Rain Impact Waveform, audio envelope, LED flash animation

**Target Mean Current**:
The continuously selectable 1–100% high-overlap mean-current target used to scale Current Response charge as Speed changes in the Poisson condition and the exact duty cycle in the PWM Control. Sparse bounded Poisson responses may not physically attain an intermediate target and must report their actual mean. Exactly 100% is the shared full-DC limit: all Channels output unit current while both underlying clocks continue and the AC Current Monitor is immediately silent. It is not feedback or automatic gain applied to observed samples.
_Avoid_: Brightness normalization, current measurement, limiter threshold

**AC Current Monitor**:
The mono audible signal obtained by subtracting commanded Target Mean Current directly from every Aggregate White sample, then applying explicit Monitor Gain. The subtraction only translates the current waveform's vertical origin; it has no filter state, decay, or frequency shaping. Sparse bounded Poisson current can retain a small residual offset when its actual mean differs from its target. A fixed-scale Audio Oscilloscope displays the exact target-centered samples before Monitor Gain.
_Avoid_: Audio synthesizer, acoustic response, loudness matching

**Monitor Gain**:
The explicit fixed scalar applied after DC conversion solely for listening. Its logarithmic 0.01×–32× control defaults to 2× and cannot affect either current engine, either LED bank, or the pre-gain Audio Oscilloscope. It performs no normalization, compression, limiting, or feedback, so high settings may clip the browser audio output.
_Avoid_: Automatic gain, loudness matching, optical gain

**Frame-Mean Current**:
The single virtual-LED display rule in the standalone LED lab: the arithmetic mean of every worklet-rate current sample in one display interval. Other reported statistics are diagnostics rather than selectable drive modes. Separate fixed-scale Current and Audio Oscilloscopes retain within-frame excursions without visual normalization.
_Avoid_: Downsampled event, peak brightness mode, physical flicker proof

**Scope Timebase**:
The shared diagnostic window for the standalone LED lab's Current and Audio Oscilloscopes, selectable as 1 s, 100 ms, 10 ms, or 1 ms and defaulting to 10 ms. It changes only retained and displayed history. Connected per-pixel minimum and maximum envelopes preserve sustained same-sign plateaus as visible horizontal traces and preserve unresolved excursions as a bounded band without modifying, normalizing, or feeding back into either condition.
_Avoid_: Signal rate, PWM duty, waveform resampling, display gain

**Optical Drive Signal**:
One of eight positive current-like signals obtained from its matching signed, pre-stereo generated-audio Channel bus by full-wave rectification, one manually selected fixed Current Sensitivity, a smooth current limiter, and the selected Optical Current Mode. Both pressure polarities contribute current without becoming new Arrivals. The signal has no light-specific rate compensation, smoothing, envelope, or automatic normalization and does not change the blessed generated rain audio, Poisson timing, or Channel routing.
_Avoid_: Audio output, PWM, spectral timbre

**Optical Current Mode**:
The explicit choice between Additive current `Iadd = G|x| / (1 + G|x|)`, where running silence is dark, and its exact Subtractive complement `Isub = 1 − Iadd = 1 / (1 + G|x|)`, where running silence is peak-bright. Stop forces darkness in both modes. Switching modes changes only the optical transformation and never restarts or modifies the Steady Poisson Process or blessed audio.
_Avoid_: Second optical source, polarity event, inverted Poisson process

**Current Sensitivity**:
The fixed multiplier `G` applied to the magnitude of every Optical Drive Signal before its smooth current limiter. The prototype exposes one logarithmic 1×–256× manual control, defaulting to 32×. Once selected, it is identical across Channels and independent of Speed, time, signal statistics, and Rain References.
_Avoid_: Automatic gain, brightness normalization, rate compensation

**Aggregate White**:
The ninth virtual LED signal equal to the arithmetic mean of the eight Optical Drive Signals. It is a monitor of their combined current, not a ninth Channel and not a source of independent Arrivals.
_Avoid_: Ninth Channel, white Arrival stream, eightfold sum

**Channel Coupling**:
The fraction of Arrivals shared across all Channels. Remaining Arrivals are assigned privately and uniformly across the eight Channels.
_Avoid_: Spectral Coupling

**Steady Poisson Process**:
A homogeneous Poisson arrival process with one constant total lamp rate selected by Speed.
_Avoid_: Living rate, Cox process, weather modulation

**Rain Mark**:
The audio-only physical interpretation assigned to an Arrival by the Generated Rain Renderer. It coherently relates a synthesized impact's drop-size class, velocity, surface response, level, duration, broad spectral focus, and modest response-region center and bandwidth variation without changing the light event. Every default mark retains a low/mid Surface Body. Upper-frequency Surface Detail may occur on any mark, but its energy allowance tightens when a source response becomes foreground-prominent so one contact cannot carry the complete field's high-frequency compensation.
_Avoid_: Arrival, LED mark, recorded grain

**Surface Detail**:
The optional finite upper-frequency component of one Rain Impact Waveform. Its candidate-region balance is calibrated in expected stochastic output energy, including filter bandwidth, and remains nonzero on foreground-prominent marks. Foreground allowance is material-specific: litter retains a broader noisy contact than leaf or wood while the complete field remains constrained by the Redwood Acoustic Target Profile. It is part of the parent Arrival rather than a second event, stationary bed, drop-size class, or LED spectrum.
_Avoid_: Fine-drop layer, background hiss, spectral Channel

**Drop Population**:
A continuously adjustable probability distribution from fine-dominant rain through mixed rain to large-drop-rich rain. It changes Rain Marks without changing the steady Poisson rate unless explicitly linked to Speed.
_Avoid_: Drop size, drop statistics, audio rate

**Speed–Population Link**:
The optional bidirectional relationship that keeps the normalized Speed and Drop Population slider positions aligned. It does not alter Channel Coupling or introduce time-varying weather.
_Avoid_: Channel Coupling, Spectral Coupling, Cox modulation

**Rain Impact Waveform**:
A complete pure-synthesis, band-limited, signed pressure-like response derived from one Rain Mark and used identically for Arrivals from every Channel. It contains a restrained sub-millisecond Direct Contact followed by a compact rounded leaf/ground Surface Response and may contain finite Wet Microtexture, but has no secondary-contact layer, bubble contribution, stable note, stationary background, or relationship to LED wavelength.
_Avoid_: Note, tone, spectral voice

**Direct Contact**:
The quiet, sub-millisecond signed pressure response at the start of one Rain Impact Waveform. Its level and duration follow the parent Rain Mark rather than an unrelated random morphology.
_Avoid_: Mandatory onset peak, snare transient

**Surface Response**:
The generated, event-specific vibration excited when a Rain Mark contacts leaves, leaf litter, soil, or wood. One compact surface-shaped window drives an event-selected sparse subset of eight nominal, partially independent ERB-spaced audio regions with analytically generated noise. Each Rain Mark applies bounded deterministic center and bandwidth variation so the complete population does not preserve a fixed filter comb. Fresh excitation becomes literal zero when the contact window closes; only short filter state remains. Every surface stays broadband as a population rather than making every individual impact broadband. Wet Microtexture may add finite nonlinear microtransients inside that same window. It has no free-running resonator, recording, sustained stochastic tail, or liquid-bubble model.
_Avoid_: Diffuse Response, recorded impulse response, bubble tone

**Wet Microtexture**:
Finite nonlinear surface detail inside one Rain Impact Waveform. Correlated analytic noise is thresholded, rectified, power-shaped, high-pass filtered, and routed through a short seed-varied band-pass wavelet while the parent contact window is open. It never creates an Arrival, secondary contact, independent clock, stationary bed, recorded grain, or bubble response.
_Avoid_: Bubble layer, second event process, generic noise bed

**Spectral Sparsity**:
The Acoustic Factor that controls how many of the eight candidate audio-frequency regions one Rain Impact Waveform excites. It changes per-impact occupancy without changing the eight LED Channels, LED wavelength, or Poisson timing.
_Avoid_: LED spectrum, Channel Coupling, audio Channel

**Poisson Shot Synthesis**:
The linear superposition of generated responses at Steady Poisson Arrival times. Through 10,000 Arrivals/s, every Arrival contributes its complete Rain Impact Waveform. Above that threshold, every Arrival contributes once to the Continuous Rain Response Field. Dense rain becomes noise-like without a generated-noise source, stationary background recording, weighted representative, or second event process.
_Avoid_: Ambient loop, generic noise bed, granular playback

**Continuous Rain Response Field**:
The pure-synthesis realization used above 10,000 Arrivals/s. Every exact Poisson Arrival keeps its generated response-variant identity, gain, continuous pan, and distance damping, then injects its compact eight-region signature into shared linear broad-band filter state. The shared state carries unresolved acoustic tails efficiently; it does not merge, weight, quantize to a control clock, or discard Arrivals, and it contains no generated-noise input, recording, loop, repeated block, or per-block reset.
_Avoid_: High-density mode, statistical noise bed, representative event, digital marker

**Dense Shot Limit**:
The noise-like texture that emerges as sufficiently dense exact Steady Poisson Arrivals drive either complete Rain Impact Waveforms or the Continuous Rain Response Field. Every Arrival remains present; Density Compensation controls total level without replacing Arrivals with generated noise, weighted representatives, a stationary bed, a loop, or a second event process.
_Avoid_: High-density mode, super-drop, stationary noise bed

**Pure Synthesis**:
Generated audio whose samples come only from algorithmic excitation, response, propagation, and summation. Rain References may be analyzed or auditioned as evaluation evidence but never supply samples, grains, impulse responses, or extracted texture waveforms to generated audio.
_Avoid_: Sample synthesis, resynthesis, recording-derived texture

**Acoustic Factor**:
One independently switchable, continuously adjustable contribution or modifier in generated rain audio. Acoustic Factors change response shape, spatial presentation, or output behavior; they never change Channel routing, Source Mix, or the steady Poisson clock.
_Avoid_: Hidden tuning constant, spectral Channel, weather process

**Acoustic Factor Preset**:
A complete set of Acoustic Factor switch states and amounts. The default Redwood-target preset is a starting model, not an automatically fitted truth claim.
_Avoid_: Recording profile, sample preset

**Acoustic Target Profile**:
A measured aggregate spectral and temporal shape used to constrain generated rain texture. Pwason's sole enforceable Acoustic Target Profile is the independently normalized nine-band broad and thirteen-band fine contours from the default Redwood Rain Reference; it contains no recording samples or response waveforms. Farnell remains a secondary diagnostic Procedural Rain Reference because its much brighter, more impulsive profile conflicts with Redwood and must not be silently averaged into the primary target.
_Avoid_: Sample synthesis, spectral note, selected playback profile

**Generated Rain Renderer**:
The Module that maps caller-owned Arrivals and the selected Drop Population to complete audible render plans and offline generated profiles. It owns Rain Mark sampling and Rain Impact Waveform generation and shares the same Arrival rendering policy and exact block accumulation used by live playback, but never owns or modifies Poisson timing.
_Avoid_: Poisson engine, recorded-rain player

**Rain Reference**:
A traceable audible comparison source used to evaluate generated rain, either a Measured Rain Reference or a Procedural Rain Reference. A designer may temporarily replace the selected visual comparison with a local recording. A Rain Reference never participates in Arrival generation.
_Avoid_: Sample bank, synthesis input, generated waveform source

**Measured Rain Reference**:
A field recording of physical rainfall used only for analysis and optional Reference Playback.
_Avoid_: Procedural example, generated target waveform

**Procedural Rain Reference**:
A published pure-synthesis rain render used only for analysis and optional Reference Playback. Pwason may compare its aggregate behavior with the render but never copies its samples, patches, or extracted waveforms into generated audio.
_Avoid_: Measured rainfall, synthesis input, implementation template

**Reference Library**:
The three bundled Rain References available for traceable analysis and playback: the default CC0 Redwood leaves-and-ground recording, the retained scientific Amazon recording, and Andy Farnell’s MIT-hosted procedural rain example.
_Avoid_: Sample bank, synthesis corpus

**Reference Profile**:
One Reference Library entry: its source asset, provenance, surface or synthesis character, format, checksum, detected prominent-onset rate, optional equivalent total-Arrival calibration, optional fixed analysis interval, and optional Reference Evaluation Passband. Selecting a profile controls both visual analysis and Reference Playback.
_Avoid_: Audio Channel, spectral profile

**Reference Evaluation Passband**:
The frequency range in which a Rain Reference's stored asset is reliable enough to contribute to scored spectral comparisons. Evidence outside it remains visible and explicitly unscored. Redwood ends at 18 kHz because its bundled MP3 preview has an encoder cutoff above that point; generated rain is not required to reproduce the codec.
_Avoid_: Synthesizer bandwidth, hidden low-pass, display crop

**Perceptual Profile Distance**:
The level-independent RMS dB difference between two complete-profile spectra after one-third-octave Gaussian smoothing and independent peak normalization, scored only inside the selected Reference Evaluation Passband. It measures aggregate tonal-shape mismatch, not time-aligned spectrogram similarity or perceptual quality by itself.
_Avoid_: Raw Profile Distance, loudness difference, waveform error

**Prominent Onset Rate**:
The rate of foreground energy increases found by the shared onset detector in generated or recorded audio. It observes only detectable contacts and is not the total physical Arrival rate.
_Avoid_: Speed, physical drop rate, natural rate

**Equivalent Total-Arrival Rate**:
An independently identified total Poisson rate used to compare generated rain and Reference Playback at similar foreground-onset density, background continuity, and perceived density. Redwood's current 1,000 Arrivals/s value is a field-continuity calibration, not a measured physical-drop count; an uncalibrated Reference Profile remains visibly uncalibrated.
_Avoid_: Prominent Onset Rate, exact rainfall intensity

**Reference Playback**:
Audible looping playback of the selected Reference Profile. It is a comparison source alongside generated Arrivals, not a source for generating them. A local Rain Reference is never Reference Playback.
_Avoid_: Sample synthesis, recorded Arrival

**Reference Time Stretch**:
Pitch-preserving transport-speed change applied to Reference Playback relative to its Equivalent Total-Arrival Rate when available, with an explicit detected-onset fallback for an uncalibrated profile. A steady recording can mask the perceived change, so Reference Time Stretch is not proof of event-level density matching. The clean range is 0.75×–4×; a capped value is explicitly marked as limited.
_Avoid_: Pitch shift, spectral matching, resampling synthesis

**Source Mix**:
The continuous listening balance between generated Arrivals and Reference Playback. Its midpoint audibly blends both sources.
_Avoid_: Spectral Coupling, Channel Coupling

**Impact Position**:
The continuous location assigned to an Arrival within the Listening Field. It is independent of Channel routing.
_Avoid_: Distance Channel, audio Channel

**Listening Field**:
The finite physical area around the listener over which Arrivals are positioned for sound reproduction. Its radius is controlled by the Field Depth Acoustic Factor. The field has no separate timing layer: quiet remote contacts and rare near contacts are differently propagated members of the same Arrival population.
_Avoid_: Spectral field, Channel bank

**Field Window**:
A fixed-duration excerpt from an active generated or measured rain field containing every overlapping contact audible during that interval. It is comparison evidence for the rain population, not an isolated Rain Impact Waveform.
_Avoid_: Single drop, Arrival Response, isolated contact

**Representative Field Window**:
A one-second Field Window selected by the same level-independent rule for every source: its normalized spectrum is closest to that source's complete analysis profile. It illustrates typical local texture without claiming event alignment or replacing complete-profile evidence.
_Avoid_: Strongest contact, fixed favorite moment, aligned drop

**Impact Microscope**:
A selectable 120-millisecond excerpt centered around one prominent acoustic onset, with that detected onset placed at the same visible offset for every source. Each source offers non-overlapping Strong, Typical, and Soft choices at the 90th, 50th, and 25th percentiles of post-onset energy when enough distinct contacts exist. Strong deliberately excludes the absolute maximum so a rare contact cannot define normal rain morphology.
_Avoid_: Representative Field Window, physical-drop timestamp, strongest sample

**Microscope Scaling**:
The display-only viewing policy for Impact Microscopes. Shape independently normalizes each excerpt to expose morphology; Profile-matched places every source on one complete-profile level baseline and one shared visual scale so relative Strong, Typical, and Soft behavior remains comparable without treating raw recording gain as calibrated pressure.
_Avoid_: Raw amplitude comparison, audio normalization, synthesis gain

**Impact Audition**:
Explicit, level-matched playback of one Impact Microscope through the current Output Level. It is diagnostic listening only and never supplies samples to generated rain or changes Reference Playback.
_Avoid_: Rain Reference playback, synthesis input, full-field playback

**Onset Population**:
A bounded diagnostic population of prominent acoustic onsets, each represented by a baseline-subtracted, independently normalized 120-millisecond RMS envelope aligned to the shared 20-millisecond onset marker. Its q10–q90 band, q50 line, and median peak and 90%-energy delays describe typical contact morphology without allowing one strongest onset to define the source.
_Avoid_: Average waveform, physical-drop alignment, synthesis layer

**Spectral Profile Residual**:
The signed, level-independent dB difference between two complete-profile spectra. The solid trace is one-third-octave smoothed and supplies the Perceptual Profile Distance; a faint raw 96-point trace retains narrow detail. Positive values mean generated rain has excess normalized energy at that frequency; negative values mean generated rain is missing energy. Evidence beyond the selected Reference Evaluation Passband is shaded and unscored.
_Avoid_: Time-aligned spectrogram subtraction, loudness difference

**Spectral Distribution Residual**:
The signed dB difference between matching quiet-to-loud percentiles of short-time spectral energy from two complete profiles. It discards frame order so independent stochastic rain realizations can be compared without treating different Arrival times as synthesis errors.
_Avoid_: Pixel-aligned spectrogram difference, event correspondence

**Acoustic Propagation**:
The distance loss, high-frequency air damping, and left-right direction applied between an Impact Position and the listener. At the accepted 70% setting, distance pressure follows the free-field h/d law; the factor varies that law's exponent without creating a stationary background or second clock.
_Avoid_: Distance voice, rain layer

**Normalized Waveform Envelope**:
A visual-only Field Window trace that robustly normalizes each source independently and preserves the minimum and maximum sample in every horizontal pixel column. It exposes shape and microtransients without changing, normalizing, or compressing generated or Reference Playback audio.
_Avoid_: Audio normalization, loudness match, sample replacement

**Spectral Mapping**:
The assignment from Channel identity to LED wavelength at the light-output stage. It is not part of Arrival generation or rain-audio generation.
_Avoid_: Spectral event generation
