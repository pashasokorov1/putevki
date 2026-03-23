import { buildFuelSheetRecord } from "./fuelSheet";
import type { DashboardStat, Driver, FuelReportCard, FuelSheetInput, Vehicle } from "./types";

export const vehicles: Vehicle[] = [
  {
    id: "vehicle-uaz-patriot",
    brand: "УАЗ",
    model: "Патриот",
    plateNumber: "Н350АУ",
    garageNumber: "A-12",
    fuelType: "АИ-92",
    currentOdometer: 400,
    seasonalNorms: {
      winter: {
        districtLitersPer100Km: 17.0,
        highwayLitersPer100Km: 16.3,
        cityLitersPer100Km: 17.7,
        idleLitersPerHour: 1.39
      },
      summer: {
        districtLitersPer100Km: 15.8,
        highwayLitersPer100Km: 15.1,
        cityLitersPer100Km: 16.4,
        idleLitersPerHour: 1.12
      }
    },
    normHistory: [
      {
        id: "norm-001",
        changedAt: "2026-02-01T09:00:00.000Z",
        changedBy: "Главный механик",
        reason: "Плановое обновление зимних норм",
        season: "winter",
        previous: {
          districtLitersPer100Km: 16.6,
          highwayLitersPer100Km: 15.8,
          cityLitersPer100Km: 17.1,
          idleLitersPerHour: 1.31
        },
        next: {
          districtLitersPer100Km: 17.0,
          highwayLitersPer100Km: 16.3,
          cityLitersPer100Km: 17.7,
          idleLitersPerHour: 1.39
        }
      }
    ]
  }
];

export const drivers: Driver[] = [
  {
    id: "driver-1",
    fullName: "Иванов Сергей Петрович",
    tabNumber: "0142",
    phone: "+7 924 000-11-22",
    shift: "Дневная смена 08:00-20:00",
    status: "active"
  },
  {
    id: "driver-2",
    fullName: "Петров Андрей Викторович",
    tabNumber: "0173",
    phone: "+7 924 000-22-33",
    shift: "Сутки через двое",
    status: "active"
  },
  {
    id: "driver-3",
    fullName: "Смирнов Алексей Олегович",
    tabNumber: "0211",
    phone: "+7 924 000-44-55",
    shift: "Ночная смена 20:00-08:00",
    status: "vacation"
  }
];

const initialSheet: FuelSheetInput = {
  vehicleId: "vehicle-uaz-patriot",
  date: "2026-03-23",
  driverId: "driver-1",
  routeDescription: "Гараж - Корсаков - Корсаков - Южный - Южный (город) - Город - Корсаков - Корсаков - Гараж",
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
};

export const fuelSheets = [
  buildFuelSheetRecord({
    input: initialSheet,
    vehicle: vehicles[0],
    driver: drivers[0],
    id: "sheet-001",
    createdBy: "dispatcher@fleet.local",
    createdAt: "2026-03-23T08:10:00.000Z"
  })
];

export const dashboardStats: DashboardStat[] = [
  {
    id: "fleet",
    label: "Активный парк",
    value: "1 машина",
    helper: "Стартовые данные очищены под Н350АУ"
  },
  {
    id: "sheets",
    label: "Путевые листы сегодня",
    value: "1",
    helper: "Одна стартовая тестовая путевка"
  },
  {
    id: "fuel",
    label: "Расход за сутки",
    value: "52.39 л",
    helper: "По стартовому примеру для Н350АУ"
  },
  {
    id: "warnings",
    label: "Проверка пробега",
    value: "0 расхождений",
    helper: "Стартовые данные сходятся"
  }
];

export const reportCards: FuelReportCard[] = [
  {
    id: "period-fuel",
    title: "Расход топлива за период",
    value: "3 284.65 л",
    delta: "-3.8%",
    trend: "down"
  },
  {
    id: "period-mileage",
    title: "Пробег за период",
    value: "18 240 км",
    delta: "+6.2%",
    trend: "up"
  },
  {
    id: "period-refuel",
    title: "Заправки за период",
    value: "3 514.00 л",
    delta: "+1.3%",
    trend: "up"
  },
  {
    id: "closing-balance",
    title: "Средний остаток на конец дня",
    value: "89.42 л",
    delta: "Стабильно",
    trend: "neutral"
  }
];
