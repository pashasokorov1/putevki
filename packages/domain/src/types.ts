export type UserRole = "dispatcher" | "driver" | "admin";

export type FuelNorms = {
  districtLitersPer100Km: number;
  highwayLitersPer100Km: number;
  cityLitersPer100Km: number;
  idleLitersPerHour: number;
};

export type SeasonType = "winter" | "summer";
export type SeasonMode = "winter" | "summer" | "mixed";

export type SeasonalFuelNorms = {
  winter: FuelNorms;
  summer: FuelNorms;
};

export type NormHistoryItem = {
  id: string;
  changedAt: string;
  changedBy: string;
  reason: string;
  season: SeasonType;
  previous: FuelNorms;
  next: FuelNorms;
};

export type Vehicle = {
  id: string;
  brand: string;
  model: string;
  plateNumber: string;
  garageNumber?: string;
  fuelType: string;
  currentOdometer: number;
  seasonalNorms: SeasonalFuelNorms;
  normHistory: NormHistoryItem[];
};

export type Driver = {
  id: string;
  fullName: string;
  tabNumber: string;
  phone: string;
  shift: string;
  status: "active" | "vacation" | "inactive";
};

export type FuelSheetInput = {
  vehicleId: string;
  date: string;
  driverId: string;
  routeDescription: string;
  openingFuelLiters: number;
  refuelLiters: number;
  districtKm: number;
  highwayKm: number;
  cityKm: number;
  idleHours: number;
  seasonMode: SeasonMode;
  winterDistrictKm: number;
  winterHighwayKm: number;
  winterCityKm: number;
  winterIdleHours: number;
  summerDistrictKm: number;
  summerHighwayKm: number;
  summerCityKm: number;
  summerIdleHours: number;
  odometerStart: number;
  odometerEnd: number;
};

export type FuelSheetComputation = {
  appliedNorms: FuelNorms;
  seasonalBreakdown: {
    winterDistrictKm: number;
    summerDistrictKm: number;
    winterHighwayKm: number;
    summerHighwayKm: number;
    winterCityKm: number;
    summerCityKm: number;
    winterIdleHours: number;
    summerIdleHours: number;
  };
  districtFuel: number;
  highwayFuel: number;
  cityFuel: number;
  idleFuel: number;
  totalFuelConsumption: number;
  availableFuel: number;
  closingFuel: number;
  odometerDistance: number;
  routeDistance: number;
  distanceDifference: number;
  isDistanceMatched: boolean;
};

export type FuelSheetRecord = FuelSheetInput & {
  id: string;
  vehicle: Vehicle;
  driver: Driver;
  calculations: FuelSheetComputation;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  status: "draft" | "approved";
};

export type FuelReportCard = {
  id: string;
  title: string;
  value: string;
  delta: string;
  trend: "up" | "down" | "neutral";
};

export type DashboardStat = {
  id: string;
  label: string;
  value: string;
  helper: string;
};
