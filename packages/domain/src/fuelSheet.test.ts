import test from "node:test";
import assert from "node:assert/strict";
import { calculateFuelSheet } from "./fuelSheet";
import { vehicles } from "./mocks";

test("calculateFuelSheet returns expected rounded values for UAZ Patriot example", () => {
  const result = calculateFuelSheet(
    {
      vehicleId: vehicles[0].id,
      date: "2026-03-23",
      driverId: "driver-1",
      routeDescription: "Тестовый маршрут",
      openingFuelLiters: 100,
      refuelLiters: 50,
      districtKm: 100,
      highwayKm: 100,
      cityKm: 100,
      idleHours: 1,
      seasonMode: "winter",
      winterDistrictKm: 100,
      winterHighwayKm: 100,
      winterCityKm: 100,
      winterIdleHours: 1,
      summerDistrictKm: 0,
      summerHighwayKm: 0,
      summerCityKm: 0,
      summerIdleHours: 0,
      odometerStart: 100,
      odometerEnd: 400
    },
    vehicles[0]
  );

  assert.equal(result.districtFuel, 17);
  assert.equal(result.highwayFuel, 16.3);
  assert.equal(result.cityFuel, 17.7);
  assert.equal(result.idleFuel, 1.39);
  assert.equal(result.totalFuelConsumption, 52.39);
  assert.equal(result.availableFuel, 150);
  assert.equal(result.closingFuel, 97.61);
  assert.equal(result.odometerDistance, 300);
  assert.equal(result.routeDistance, 300);
  assert.equal(result.isDistanceMatched, true);
});

test("calculateFuelSheet marks mismatch when route distance differs from odometer", () => {
  const result = calculateFuelSheet(
    {
      vehicleId: vehicles[0].id,
      date: "2026-03-23",
      driverId: "driver-1",
      routeDescription: "Тестовый маршрут",
      openingFuelLiters: 40,
      refuelLiters: 0,
      districtKm: 25,
      highwayKm: 30,
      cityKm: 10,
      idleHours: 0.5,
      seasonMode: "winter",
      winterDistrictKm: 25,
      winterHighwayKm: 30,
      winterCityKm: 10,
      winterIdleHours: 0.5,
      summerDistrictKm: 0,
      summerHighwayKm: 0,
      summerCityKm: 0,
      summerIdleHours: 0,
      odometerStart: 1000,
      odometerEnd: 1080
    },
    vehicles[0]
  );

  assert.equal(result.routeDistance, 65);
  assert.equal(result.odometerDistance, 80);
  assert.equal(result.distanceDifference, 15);
  assert.equal(result.isDistanceMatched, false);
});

test("calculateFuelSheet supports mixed transition season", () => {
  const result = calculateFuelSheet(
    {
      vehicleId: vehicles[0].id,
      date: "2026-04-05",
      driverId: "driver-1",
      routeDescription: "Переходный маршрут",
      openingFuelLiters: 100,
      refuelLiters: 0,
      districtKm: 100,
      highwayKm: 0,
      cityKm: 0,
      idleHours: 0,
      seasonMode: "mixed",
      winterDistrictKm: 50,
      winterHighwayKm: 0,
      winterCityKm: 0,
      winterIdleHours: 0,
      summerDistrictKm: 50,
      summerHighwayKm: 0,
      summerCityKm: 0,
      summerIdleHours: 0,
      odometerStart: 0,
      odometerEnd: 100
    },
    vehicles[0]
  );

  assert.equal(result.appliedNorms.districtLitersPer100Km, 16.4);
  assert.equal(result.districtFuel, 16.4);
});
