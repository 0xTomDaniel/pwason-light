# Bundled Rain Reference Library

## Redwood Shores leaves and ground (default)

`464334_1504845-hq.mp3` is the openly retrievable high-quality preview of
Andron827's Freesound recording “rain rws natural 3-23-2019 151am.wav”:
<https://freesound.org/s/464334/>.

The source describes a high-quality field recording of rainfall and dripping
on earthen ground, fallen logs, and large plant leaves in Redwood Shores,
California. It does not list a stream or flowing-water source. The original is
a 61.354-second, stereo, 44.1 kHz, 16-bit WAV released under CC0 1.0. Freesound
requires authentication for the original download, so this repository
transparently bundles its public high-quality MP3 preview rather than claiming
to contain the lossless original.

- Freesound sound ID: `464334`
- Bundled format: stereo MP3, 44.1 kHz, approximately 198 kb/s
- Bundled size: `1,516,654` bytes
- SHA-256: `ebf3ab59c140a5d44f939f3f871a58ed205377dcccb02fe6d0147d29535fcadb`
- Scored evaluation passband: `80 Hz–18 kHz`
- Preview download: <https://cdn.freesound.org/previews/464/464334_1504845-hq.mp3>
- License: <https://creativecommons.org/publicdomain/zero/1.0/>

The preview's encoder cutoff begins above 18 kHz. Diagnostics retain the
18–20 kHz evidence as a shaded raw trace, but exclude it from Redwood's scored
profile and distribution distances so the synthesizer is not tuned to mimic
MP3 encoding.

## Central Amazon scientific recording

`SMM00894_20230510_224500.wav` is the light-rainfall sample from:

> Xavier, Rodrigo; Fleischmann, Ayan; Gosset, Marielle; Maciel, Tarcísio;
> Do Nascimento, Leandro; Ramalho, Emiliano; Bicudo, Thiago (2023),
> “Measuring Amazon rainfall intensity with sound recorders: data and code,”
> DataSuds, V2. <https://doi.org/10.23708/I0QYNM>

The associated study placed sound recorders on tree trunks in Central Amazon
forest and used the recordings to estimate rainfall occurrence and intensity:
<https://doi.org/10.1029/2024GL108210>.

The dataset labels this exact file “Light rainfall audio recording.” It is a
60-second, mono, 48 kHz, 16-bit PCM WAV and is distributed under the Creative
Commons Attribution 4.0 International license:
<https://creativecommons.org/licenses/by/4.0/>.

- Original filename: `SMM00894_20230510_224500.wav`
- DataSuds file ID: `39504`
- Original size: `5,761,144` bytes
- MD5: `8a2351b76dcb0145f24705596ab32665`
- Original download: <https://dataverse.ird.fr/api/access/datafile/39504>

## Andy Farnell procedural rain example

`designing-sound-rain.wav` is the rendered procedural-audio example from Andy
Farnell’s *Designing Sound* Practical 15: Rain:
<https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/8375/designing_sound.zip/practical15.html>.

The source page publishes the Pure Data patches that generate the moving rain
mixture and describes the render as successive Gaussian-distributed parabolic
pulses, noise-band excitation, bubble droplets, and glass-lamina excitation.
Pwason bundles the complete render for traceable evaluation and optional
playback, but analyzes only 14.000–24.000 seconds. The displayed one-second
Representative Field Window is selected by the same normalized-spectrum scan
used for every source, and a separate 120 ms Impact Microscope aligns a detected
acoustic onset for contact inspection. The file never supplies samples, grains, filters,
or response waveforms to generated audio.

- Original filename: `rain.wav`
- Bundled filename: `designing-sound-rain.wav`
- Format: stereo 44.1 kHz, 16-bit PCM WAV
- Duration: `47.219909` seconds
- Size: `8,329,714` bytes
- SHA-256: `2c0a72cf7561aba40a8af4510d7372cdd605216307e5b28985905bb354fe20a1`
- Original download: <https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/8375/designing_sound.zip/p15/rain.wav>
- Rights note: the source page does not state separate license terms for the WAV

## Playback calibration

Pwason Light analyzes the selected reference and can play it as an optional
looping comparison through Source Mix. None of the three files is used as source material
by the rain synthesizer or participates in Poisson Arrival generation.

To align the recording's audible activity with the generated Speed control,
the profiles store onset-density calibrations of 38.5 onsets/s for Redwood,
15.8 onsets/s for Amazon, and 43.4 onsets/s for Farnell’s 14–24 second interval.
These are comparison estimates, not physical drop counts. All use the same detector:
256-sample RMS windows, 128-sample hops at 48 kHz, positive log-energy flux
above its 85th percentile, local maxima, and a 10 ms refractory interval.
Reference Playback uses `Speed / calibrated onset density` as its playback
factor while browser pitch preservation remains enabled. The applied factor is
capped to 0.75×–4×: slower playback produced audible stretch artifacts in Arc,
and the steady recording does not provide event-separated material for clean
arbitrary-density resynthesis.
