import assert from "node:assert/strict";
import test from "node:test";

import { createDefaultAcousticFactors } from "../src/acoustic-factors.js";
import { createPoissonEngine } from "../src/poisson-engine.js";
import { createGeneratedRainRenderer } from "../src/rain-texture.js";
import { analyzeRainField } from "../src/rain-diagnostics.js";
import { analyzeSignal, detectProminentOnsets } from "../src/signal-analysis.js";

function rms(samples) {
  const energy = samples.reduce((sum, sample) => sum + sample * sample, 0);
  return Math.sqrt(energy / samples.length);
}

const REDWOOD_BROAD_BAND_EDGES_HZ = Object.freeze([
  80, 160, 315, 630, 1_250, 2_500, 5_000, 10_000, 16_000, 20_000,
]);

// Measured from the first ten seconds of the cited Redwood Reference and
// normalized to its strongest broad band. The recording remains evaluation
// evidence only; no samples or response shapes enter generated audio.
const REDWOOD_BROAD_BAND_PROFILE_DB = Object.freeze([
  -4.8, -2.8, 0, -1, -5.7, -8.2, -4.2, -4.8, -2.6,
]);

const REDWOOD_FINE_BAND_EDGES_HZ = Object.freeze([
  80, 375, 750, 1_125, 1_688, 2_438, 3_375,
  4_500, 6_000, 7_875, 10_125, 12_750, 15_750, 19_500,
]);

const REDWOOD_FINE_BAND_PROFILE_DB = Object.freeze([
  -1.6, 0, -4.1, -7.4, -10.3, -12, -13.9,
  -12.1, -11.1, -7.3, -10.8, -8.1, -3.3,
]);

const REDWOOD_PERCEPTUAL_CENTERS_HZ = Object.freeze([
  100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1_000, 1_250,
  1_600, 2_000, 2_500, 3_150, 4_000, 5_000, 6_300, 8_000, 10_000,
  12_500, 16_000,
]);

// One-third-octave Gaussian smoothing of the first ten seconds of Redwood's
// reliable 80 Hz–18 kHz MP3 passband, normalized to its strongest center.
const REDWOOD_PERCEPTUAL_PROFILE_DB = Object.freeze([
  -0.85, 0, -1.52, -2.94, -2.89, -2.52, -0.58, -1.37, -2.54, -4.11,
  -8.72, -11.43, -11.9, -14.56, -15.72, -18.37, -20.46, -20.05,
  -18.28, -20.03, -17.5, -20.27, -16.69,
]);

function normalizedBandProfileDb(analysis, edges) {
  const energies = edges.slice(0, -1).map(
    (lowerFrequency, bandIndex) => {
      const upperFrequency = edges[bandIndex + 1];
      let energy = 0;
      for (let bin = 0; bin < analysis.spectrum.length; bin += 1) {
        const frequency = bin * analysis.sampleRate / analysis.fftSize;
        if (frequency >= lowerFrequency && frequency < upperFrequency) {
          energy += analysis.spectrum[bin];
        }
      }
      return energy;
    },
  );
  const peakEnergy = Math.max(...energies, 1e-20);
  return energies.map(energy => 10 * Math.log10(Math.max(energy / peakEnergy, 1e-10)));
}

function profileDistanceDb(actual, target) {
  const squaredError = actual.reduce(
    (sum, value, index) => sum + (value - target[index]) ** 2,
    0,
  );
  return Math.sqrt(squaredError / actual.length);
}

function perceptualProfileDb(distribution) {
  const sigmaOctaves = (1 / 3) / (2 * Math.sqrt(2 * Math.log(2)));
  const relativePowers = [...distribution.profileDecibels].map(
    decibels => 10 ** (decibels / 10),
  );
  const smoothedPowers = REDWOOD_PERCEPTUAL_CENTERS_HZ.map(center => {
    let weightedPower = 0;
    let weightTotal = 0;
    for (let index = 0; index < distribution.frequenciesHz.length; index += 1) {
      const octaveDistance = Math.log2(
        distribution.frequenciesHz[index] / center,
      );
      const weight = Math.exp(-0.5 * (octaveDistance / sigmaOctaves) ** 2);
      weightedPower += weight * relativePowers[index];
      weightTotal += weight;
    }
    return weightedPower / weightTotal;
  });
  const peak = Math.max(...smoothedPowers, 1e-20);
  return smoothedPowers.map(
    power => 10 * Math.log10(Math.max(power / peak, 1e-20)),
  );
}

function renderDefaultProfile(factors) {
  const renderer = createGeneratedRainRenderer({
    sampleRate: 24_000,
    factors,
  });
  const engine = createPoissonEngine({
    seed: "diffuse-balance-profile",
    rateHz: 23.1,
    fieldRadiusMeters: 20,
  });
  return renderer.renderProfile({
    durationSeconds: 4,
    nextArrival: () => engine.next(),
  });
}

test("Generated Rain Renderer prepares one deterministic live Arrival plan", () => {
  const factors = createDefaultAcousticFactors();
  factors.distanceLoss.enabled = false;
  factors.stereoSpread.amount = 0.5;
  factors.airDamping.enabled = false;
  factors.densityCompensation.enabled = false;
  factors.eventVariation.enabled = false;
  const renderer = createGeneratedRainRenderer({
    sampleRate: 48_000,
    factors,
    dropPopulation: 0.4,
  });
  const arrival = {
    id: 17,
    rateHz: 100,
    amplitude: 1,
    position: {
      radialDistanceMeters: 4,
      azimuthRadians: Math.PI / 4,
    },
  };

  const first = renderer.prepareArrival(arrival);
  const second = renderer.prepareArrival(arrival);

  factors.distanceLoss.enabled = true;
  factors.stereoSpread.amount = 1;
  factors.eventVariation.enabled = true;
  const afterCallerMutation = renderer.prepareArrival(arrival);

  assert.equal(first.response, second.response);
  assert.equal(first.response, afterCallerMutation.response);
  assert.ok(first.response.length >= 1_200);
  assert.ok(first.response.length <= 6_720);
  assert.deepEqual(first.mark, second.mark);
  assert.ok(Math.abs(first.gain - 3.2) < 0.000001);
  assert.equal(afterCallerMutation.gain, first.gain);
  assert.ok(Math.abs(first.stereoPan - 0.25) < 0.000001);
  assert.equal(afterCallerMutation.stereoPan, first.stereoPan);
  assert.equal(first.filter.cutoffHz, 20_000);
  assert.equal(first.filter.q, 0.38);
  assert.equal(renderer.exportResponseBank()[first.variantIndex], first.response);
  assert.equal(renderer.exportResponseBank().length, 192);
});

test("Generated Rain Renderer requires caller-owned Arrivals for an offline profile", () => {
  const renderer = createGeneratedRainRenderer({ sampleRate: 8_000 });

  assert.throws(
    () => renderer.renderProfile({ durationSeconds: 1 }),
    /nextArrival/,
  );
});

test("Generated Rain Renderer never turns one Arrival into a weighted super-drop", () => {
  const factors = createDefaultAcousticFactors();
  factors.distanceLoss.enabled = false;
  factors.densityCompensation.enabled = false;
  factors.eventVariation.enabled = false;
  const renderer = createGeneratedRainRenderer({ factors });
  const arrival = {
    id: 3,
    rateHz: 100_000,
    amplitude: 0.5,
    position: { radialDistanceMeters: 0, azimuthRadians: 0 },
  };

  const exact = renderer.prepareArrival(arrival);
  const accidentallyWeighted = renderer.prepareArrival({
    ...arrival,
    renderWeight: 50,
  });

  assert.equal(accidentallyWeighted.gain, exact.gain);
});

test("offline rendering is invariant to continuous block partition size", () => {
  const render = blockSize => {
    const renderer = createGeneratedRainRenderer({
      sampleRate: 12_000,
      dropPopulation: 0.6,
    });
    const engine = createPoissonEngine({
      seed: "block-partition",
      rateHz: 61,
      fieldRadiusMeters: 20,
    });
    return renderer.renderProfile({
      durationSeconds: 2,
      blockSize,
      nextArrival: () => engine.next(),
    });
  };

  const sixtyFour = render(64);
  const fiveEleven = render(511);
  assert.deepEqual(sixtyFour, fiveEleven);
});

test("Drop Population changes generated marks but not caller-owned Arrivals", () => {
  const arrival = Object.freeze({
    id: 9,
    at: 0.25,
    rateHz: 23.1,
    amplitude: 0.6,
    position: Object.freeze({ radialDistanceMeters: 3, azimuthRadians: 0.2 }),
  });
  const fine = createGeneratedRainRenderer({ dropPopulation: 0 }).prepareArrival(arrival);
  const large = createGeneratedRainRenderer({ dropPopulation: 1 }).prepareArrival(arrival);

  assert.notDeepEqual(fine.mark, large.mark);
  assert.equal(arrival.at, 0.25);
  assert.equal(arrival.rateHz, 23.1);
  assert.equal(fine.mark.population, 0);
  assert.equal(large.mark.population, 1);
});

test("Band Independence materially decorrelates frequency-region envelopes", () => {
  const render = enabled => {
    const factors = createDefaultAcousticFactors();
    factors.bandIndependence = { enabled, amount: 1 };
    const renderer = createGeneratedRainRenderer({
      sampleRate: 24_000,
      factors,
      dropPopulation: 0.693,
    });
    const engine = createPoissonEngine({
      seed: "band-independence-profile",
      rateHz: 120,
      fieldRadiusMeters: 20,
    });
    return analyzeSignal(renderer.renderProfile({
      durationSeconds: 4,
      nextArrival: () => engine.next(),
    }), 24_000, { includeSpectrogram: false });
  };

  const locked = render(false);
  const independent = render(true);

  // Use a relative guardrail because spectral calibration can move both
  // absolute correlation values while the factor still separates them.
  assert.ok(
    independent.bandEnvelopeCorrelation
      < locked.bandEnvelopeCorrelation * 0.94,
  );
});

test("leaf and litter controls remain broad surfaces rather than compensating extremes", () => {
  const renderSurface = surface => {
    const factors = createDefaultAcousticFactors();
    factors.leafSurface.enabled = surface === "leaf";
    factors.litterSurface.enabled = surface === "litter";
    factors.woodSurface.enabled = false;
    const renderer = createGeneratedRainRenderer({
      sampleRate: 48_000,
      factors,
      dropPopulation: 0.693,
    });
    const engine = createPoissonEngine({
      seed: "surface-breadth-profile",
      rateHz: 120,
      fieldRadiusMeters: 20,
    });
    return analyzeSignal(renderer.renderProfile({
      durationSeconds: 4,
      nextArrival: () => engine.next(),
    }), 48_000, { includeSpectrogram: false });
  };

  const leaf = renderSurface("leaf");
  const litter = renderSurface("litter");

  assert.ok(leaf.spectralCentroidHz > 4_000);
  assert.ok(leaf.spectralCentroidHz < 9_000);
  assert.ok(leaf.highBandEnergyRatio > 0.2);
  assert.ok(leaf.highBandEnergyRatio < 0.6);
  assert.ok(litter.spectralCentroidHz > 1_000);
  assert.ok(litter.spectralCentroidHz < 5_000);
  assert.ok(litter.highBandEnergyRatio > 0.03);
  assert.ok(litter.highBandEnergyRatio < 0.3);
  assert.ok(leaf.spectralCentroidHz > litter.spectralCentroidHz + 1_000);
  assert.ok(leaf.highBandEnergyRatio > litter.highBandEnergyRatio + 0.05);
});

test("the calibrated Redwood profile produces a continuous high-detail rain field", () => {
  const factors = createDefaultAcousticFactors();
  const renderer = createGeneratedRainRenderer({
    sampleRate: 48_000,
    factors,
    dropPopulation: 0.693,
  });
  const engine = createPoissonEngine({
    seed: "redwood-ground-generated-profile",
    rateHz: 1_000,
    coupling: 0,
    fieldRadiusMeters: 44.56,
  });
  const samples = renderer.renderProfile({
    durationSeconds: 8,
    nextArrival: () => engine.next(),
  });
  const analysis = analyzeSignal(samples, 48_000, { includeSpectrogram: false });
  const diagnostics = analyzeRainField(samples, 48_000);
  const strongImpact = diagnostics.impactMicroscopes[0].analysis;
  const onsets = detectProminentOnsets(samples, 48_000);

  assert.ok(analysis.spectralCentroidHz > 3_000);
  assert.ok(analysis.spectralCentroidHz < 6_500);
  assert.ok(analysis.highBandEnergyRatio > 0.12);
  assert.ok(analysis.highBandEnergyRatio < 0.3);
  assert.ok(analysis.spectralFlatness > 0.005);
  assert.ok(analysis.spectralFlatness < 0.16);
  assert.ok(analysis.envelopeCoefficientOfVariation > 0.3);
  assert.ok(analysis.envelopeCoefficientOfVariation < 0.7);
  assert.ok(analysis.envelopeFloorRatio > 0.64);
  assert.ok(analysis.bandEnvelopeCorrelation < 0.8);
  assert.ok(analysis.crestFactor > 8);
  assert.ok(analysis.crestFactor < 18);
  assert.ok(analysis.sampleKurtosis > 5.5);
  assert.ok(analysis.sampleKurtosis < 16);
  assert.ok(analysis.envelopeScales[100].coefficientOfVariation > 0.18);
  assert.ok(analysis.envelopeScales[100].coefficientOfVariation < 0.45);
  assert.ok(onsets.rateHz > 30);
  assert.ok(onsets.rateHz < 50);
  assert.ok(strongImpact.spectralCentroidHz > 2_000);
  assert.ok(strongImpact.spectralCentroidHz < 2_600);
  assert.ok(strongImpact.highBandEnergyRatio > 0.1);
  assert.ok(strongImpact.highBandEnergyRatio < 0.16);
  assert.ok(
    profileDistanceDb(
      normalizedBandProfileDb(analysis, REDWOOD_BROAD_BAND_EDGES_HZ),
      REDWOOD_BROAD_BAND_PROFILE_DB,
    ) < 3,
  );
  assert.ok(
    profileDistanceDb(
      normalizedBandProfileDb(analysis, REDWOOD_FINE_BAND_EDGES_HZ),
      REDWOOD_FINE_BAND_PROFILE_DB,
    ) < 2,
  );
  assert.ok(
    profileDistanceDb(
      perceptualProfileDb(diagnostics.spectralDistribution),
      REDWOOD_PERCEPTUAL_PROFILE_DB,
    ) < 1.8,
  );
});
