import type { Driver, FuelNorms, FuelSheetComputation, FuelSheetInput, Vehicle } from "./types";
import { add, multiply, roundToTwo, subtract } from "./math";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function resolveSeasonalBreakdown(input: FuelSheetInput) {
  if (input.seasonMode === "winter") {
    return {
      winterDistrictKm: input.districtKm,
      summerDistrictKm: 0,
      winterHighwayKm: input.highwayKm,
      summerHighwayKm: 0,
      winterCityKm: input.cityKm,
      summerCityKm: 0,
      winterIdleHours: input.idleHours,
      summerIdleHours: 0
    };
  }

  if (input.seasonMode === "summer") {
    return {
      winterDistrictKm: 0,
      summerDistrictKm: input.districtKm,
      winterHighwayKm: 0,
      summerHighwayKm: input.highwayKm,
      winterCityKm: 0,
      summerCityKm: input.cityKm,
      winterIdleHours: 0,
      summerIdleHours: input.idleHours
    };
  }

  return {
    winterDistrictKm: Math.max(0, input.winterDistrictKm),
    summerDistrictKm: Math.max(0, input.summerDistrictKm),
    winterHighwayKm: Math.max(0, input.winterHighwayKm),
    summerHighwayKm: Math.max(0, input.summerHighwayKm),
    winterCityKm: Math.max(0, input.winterCityKm),
    summerCityKm: Math.max(0, input.summerCityKm),
    winterIdleHours: Math.max(0, input.winterIdleHours),
    summerIdleHours: Math.max(0, input.summerIdleHours)
  };
}

export function resolveFuelNorms(input: FuelSheetInput, vehicle: Vehicle): FuelNorms {
  const seasonalBreakdown = resolveSeasonalBreakdown(input);

  if (input.seasonMode === "winter") {
    return vehicle.seasonalNorms.winter;
  }

  if (input.seasonMode === "summer") {
    return vehicle.seasonalNorms.summer;
  }

  const routeDistance = add([
    seasonalBreakdown.winterDistrictKm,
    seasonalBreakdown.summerDistrictKm,
    seasonalBreakdown.winterHighwayKm,
    seasonalBreakdown.summerHighwayKm,
    seasonalBreakdown.winterCityKm,
    seasonalBreakdown.summerCityKm
  ]);
  const winterDistance = add([
    seasonalBreakdown.winterDistrictKm,
    seasonalBreakdown.winterHighwayKm,
    seasonalBreakdown.winterCityKm
  ]);
  const winterPart = routeDistance === 0 ? 0 : winterDistance / routeDistance;
  const summerPart = 1 - winterPart;

  return {
    districtLitersPer100Km: roundToTwo(
      vehicle.seasonalNorms.winter.districtLitersPer100Km * winterPart +
        vehicle.seasonalNorms.summer.districtLitersPer100Km * summerPart
    ),
    highwayLitersPer100Km: roundToTwo(
      vehicle.seasonalNorms.winter.highwayLitersPer100Km * winterPart +
        vehicle.seasonalNorms.summer.highwayLitersPer100Km * summerPart
    ),
    cityLitersPer100Km: roundToTwo(
      vehicle.seasonalNorms.winter.cityLitersPer100Km * winterPart +
        vehicle.seasonalNorms.summer.cityLitersPer100Km * summerPart
    ),
    idleLitersPerHour: roundToTwo(
      vehicle.seasonalNorms.winter.idleLitersPerHour * winterPart +
        vehicle.seasonalNorms.summer.idleLitersPerHour * summerPart
    )
  };
}

export function calculateFuelSheet(
  input: FuelSheetInput,
  vehicle: Vehicle
): FuelSheetComputation {
  // Все промежуточные этапы округляются одинаково, чтобы UI, PDF и отчеты
  // показывали один и тот же итог без расхождений.
  const seasonalBreakdown = resolveSeasonalBreakdown(input);
  const appliedNorms = resolveFuelNorms(input, vehicle);
  const districtFuel = add([
    multiply(
      seasonalBreakdown.winterDistrictKm,
      vehicle.seasonalNorms.winter.districtLitersPer100Km / 100
    ),
    multiply(
      seasonalBreakdown.summerDistrictKm,
      vehicle.seasonalNorms.summer.districtLitersPer100Km / 100
    )
  ]);
  const highwayFuel = add([
    multiply(
      seasonalBreakdown.winterHighwayKm,
      vehicle.seasonalNorms.winter.highwayLitersPer100Km / 100
    ),
    multiply(
      seasonalBreakdown.summerHighwayKm,
      vehicle.seasonalNorms.summer.highwayLitersPer100Km / 100
    )
  ]);
  const cityFuel = add([
    multiply(
      seasonalBreakdown.winterCityKm,
      vehicle.seasonalNorms.winter.cityLitersPer100Km / 100
    ),
    multiply(
      seasonalBreakdown.summerCityKm,
      vehicle.seasonalNorms.summer.cityLitersPer100Km / 100
    )
  ]);
  const idleFuel = add([
    multiply(seasonalBreakdown.winterIdleHours, vehicle.seasonalNorms.winter.idleLitersPerHour),
    multiply(seasonalBreakdown.summerIdleHours, vehicle.seasonalNorms.summer.idleLitersPerHour)
  ]);

  const totalFuelConsumption = add([districtFuel, highwayFuel, cityFuel, idleFuel]);
  const availableFuel = add([input.openingFuelLiters, input.refuelLiters]);
  const closingFuel = subtract(availableFuel, totalFuelConsumption);
  const odometerDistance = roundToTwo(input.odometerEnd - input.odometerStart);
  const routeDistance = add([
    seasonalBreakdown.winterDistrictKm,
    seasonalBreakdown.summerDistrictKm,
    seasonalBreakdown.winterHighwayKm,
    seasonalBreakdown.summerHighwayKm,
    seasonalBreakdown.winterCityKm,
    seasonalBreakdown.summerCityKm
  ]);
  const distanceDifference = roundToTwo(odometerDistance - routeDistance);

  return {
    appliedNorms,
    seasonalBreakdown,
    districtFuel,
    highwayFuel,
    cityFuel,
    idleFuel,
    totalFuelConsumption,
    availableFuel,
    closingFuel,
    odometerDistance,
    routeDistance,
    distanceDifference,
    isDistanceMatched: distanceDifference === 0
  };
}

export function buildFuelSheetRecord(params: {
  input: FuelSheetInput;
  vehicle: Vehicle;
  driver: Driver;
  id: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}): import("./types").FuelSheetRecord {
  return {
    ...params.input,
    id: params.id,
    vehicle: params.vehicle,
    driver: params.driver,
    calculations: calculateFuelSheet(params.input, params.vehicle),
    createdBy: params.createdBy,
    createdAt: params.createdAt,
    updatedAt: params.updatedAt ?? params.createdAt,
    status: "approved"
  };
}
