import assert from "node:assert/strict";
import test from "node:test";

import { createPoissonEngine } from "../src/poisson-engine.js";

test("a seed reproduces the same observable event stream", () => {
  const settings = { seed: "steady-rain", rateHz: 3.5, coupling: 0.42 };
  const first = createPoissonEngine(settings);
  const second = createPoissonEngine(settings);

  assert.deepEqual(
    Array.from({ length: 4 }, () => first.next()),
    Array.from({ length: 4 }, () => second.next()),
  );
});

test("steady mode keeps the requested rate while producing valid Poisson gaps", () => {
  const engine = createPoissonEngine({ seed: "calm", rateHz: 4 });
  const events = Array.from({ length: 2000 }, () => engine.next());
  const meanGap = events.reduce((sum, event) => sum + event.gap, 0) / events.length;

  assert.ok(events.every((event) => event.gap > 0));
  assert.ok(events.every((event) => event.rateHz === 4));
  assert.ok(Math.abs(meanGap - 0.25) < 0.02);
});

test("steady mode supports the full 1 to 1000 events-per-second control range", () => {
  const minimum = createPoissonEngine({ seed: "minimum", rateHz: 1 }).next();
  const maximum = createPoissonEngine({ seed: "maximum", rateHz: 1000 }).next();

  assert.equal(minimum.rateHz, 1);
  assert.equal(maximum.rateHz, 1000);
});

test("channel coupling endpoints route arrivals privately or share them with unit energy", () => {
  const privateEvent = createPoissonEngine({ seed: "channels", coupling: 0 }).next();
  const sharedEvent = createPoissonEngine({ seed: "channels", coupling: 1 }).next();

  assert.equal(privateEvent.route, "private");
  assert.equal(privateEvent.channelWeights.filter((weight) => weight > 0).length, 1);
  assert.equal(sharedEvent.route, "shared");
  assert.deepEqual(sharedEvent.channelWeights, Array(8).fill(0.125));
});

test("Channel Coupling changes only light routing for an identical Arrival seed", () => {
  const privateEngine = createPoissonEngine({
    seed: "light-routing-only",
    rateHz: 120,
    coupling: 0,
    fieldRadiusMeters: 50,
  });
  const sharedEngine = createPoissonEngine({
    seed: "light-routing-only",
    rateHz: 120,
    coupling: 1,
    fieldRadiusMeters: 50,
  });

  for (let index = 0; index < 32; index += 1) {
    const privateArrival = privateEngine.next();
    const sharedArrival = sharedEngine.next();
    const withoutLightRoute = ({ route, channelWeights, ...arrival }) => arrival;

    assert.deepEqual(
      withoutLightRoute(privateArrival),
      withoutLightRoute(sharedArrival),
    );
  }
});

test("channel coupling divides one total arrival rate into shared and private routes", () => {
  const coupling = 0.25;
  const engine = createPoissonEngine({ seed: "routing", rateHz: 80, coupling });
  const arrivals = Array.from({ length: 20_000 }, () => engine.next());
  const shared = arrivals.filter((arrival) => arrival.route === "shared");
  const privateArrivals = arrivals.filter((arrival) => arrival.route === "private");
  const privateCounts = Array(8).fill(0);

  for (const arrival of privateArrivals) {
    const channel = arrival.channelWeights.indexOf(1);
    privateCounts[channel] += 1;
  }

  assert.ok(Math.abs(shared.length / arrivals.length - coupling) < 0.015);
  assert.ok(privateCounts.every((count) => Math.abs(count / arrivals.length - 0.09375) < 0.01));
  assert.ok(arrivals.every((arrival) => {
    const energy = arrival.channelWeights.reduce((sum, weight) => sum + weight, 0);
    return Math.abs(energy - 1) < 0.000001;
  }));
});

test("Arrivals are positioned uniformly across the configured Listening Field", () => {
  const fieldRadiusMeters = 20;
  const engine = createPoissonEngine({
    seed: "spatial-rain",
    rateHz: 80,
    coupling: 0.5,
    fieldRadiusMeters,
  });
  const arrivals = Array.from({ length: 20_000 }, () => engine.next());
  const meanAreaFraction = arrivals.reduce(
    (sum, arrival) => sum + (arrival.position.radialDistanceMeters / fieldRadiusMeters) ** 2,
    0,
  ) / arrivals.length;

  assert.ok(arrivals.every((arrival) => (
    arrival.position.radialDistanceMeters >= 0 &&
    arrival.position.radialDistanceMeters <= fieldRadiusMeters
  )));
  assert.ok(arrivals.every((arrival) => (
    arrival.position.azimuthRadians >= -Math.PI &&
    arrival.position.azimuthRadians < Math.PI
  )));
  assert.ok(Math.abs(meanAreaFraction - 0.5) < 0.01);
});

test("a disabled Field Depth collapses Impact Positions without changing Arrivals", () => {
  const engine = createPoissonEngine({
    seed: "no-field-depth",
    rateHz: 12,
    fieldRadiusMeters: 0,
  });
  const arrivals = Array.from({ length: 20 }, () => engine.next());

  assert.ok(arrivals.every(arrival => arrival.position.radialDistanceMeters === 0));
  assert.ok(arrivals.every(arrival => arrival.rateHz === 12));
});
