import { useEffect, useMemo, useState } from "react";
import { loadRemoteAppState, saveRemoteAppState } from "./appStateApi";
import {
  calculateFuelSheet,
  dashboardStats,
  drivers as initialDrivers,
  formatHours,
  formatKm,
  formatLiters,
  fuelSheets as initialFuelSheets,
  vehicles as initialVehicles
} from "../../../packages/domain/src";
import type {
  Driver,
  FuelNorms,
  FuelSheetInput,
  FuelSheetRecord,
  SeasonType,
  UserRole,
  Vehicle
} from "../../../packages/domain/src";

type ViewId = "dashboard" | "vehicles" | "drivers" | "new-sheet" | "journal";

type Session = {
  fullName: string;
  role: UserRole;
  email: string;
};

type MockAccount = {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
};

type SearchFilters = {
  search: string;
  periodFrom: string;
  periodTo: string;
  vehicleId: string;
};

const navigation: Array<{ id: ViewId; label: string; hint: string }> = [
  { id: "dashboard", label: "Главная", hint: "Короткая сводка" },
  { id: "new-sheet", label: "Новая путевка", hint: "Основная ежедневная работа" },
  { id: "journal", label: "Журнал", hint: "Список по машинам и водителям" },
  { id: "vehicles", label: "Машины", hint: "Нормы и история" },
  { id: "drivers", label: "Водители", hint: "Список сотрудников" }
];

function getNavigationByRole(role: UserRole) {
  if (role === "driver") {
    return navigation.filter((item) => item.id !== "drivers");
  }

  return navigation;
}

const mockAccounts: MockAccount[] = [
  {
    email: "dispatcher@fleet.local",
    password: "123456",
    fullName: "Марина Лебедева",
    role: "dispatcher"
  },
  {
    email: "pasasokorov@mail.ru",
    password: "123456",
    fullName: "Pasa Sokorov",
    role: "driver"
  }
];

const routePresets = [
  {
    id: "korsakov-yuzhny-round",
    label: "Корсаков - Южный - Город - Корсаков",
    route:
      "Гараж - Корсаков - Корсаков - Южный - Южный (город) - Город - Корсаков - Корсаков - Гараж"
  },
  {
    id: "korsakov-yuzhny-short",
    label: "Корсаков - Южный - Корсаков",
    route: "Гараж - Корсаков - Южный - Южный - Корсаков - Гараж"
  }
];

const STORAGE_KEYS = {
  session: "fleet.session",
  drivers: "fleet.drivers",
  vehicles: "fleet.vehicles",
  fuelSheets: "fleet.fuelSheets",
  sheetInput: "fleet.sheetInput"
} as const;

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

const initialInput: FuelSheetInput = {
  vehicleId: initialVehicles[0].id,
  date: "2026-03-23",
  driverId: initialDrivers[0].id,
  routeDescription: routePresets[0].route,
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
  odometerStart: 0,
  odometerEnd: 0
};

function normalizeFuelSheetInput(input: FuelSheetInput, odometerStart: number): FuelSheetInput {
  const routeDistance =
    input.seasonMode === "mixed"
      ? input.winterDistrictKm +
        input.summerDistrictKm +
        input.winterHighwayKm +
        input.summerHighwayKm +
        input.winterCityKm +
        input.summerCityKm
      : input.districtKm + input.highwayKm + input.cityKm;

  return {
    ...input,
    districtKm:
      input.seasonMode === "mixed" ? input.winterDistrictKm + input.summerDistrictKm : input.districtKm,
    highwayKm:
      input.seasonMode === "mixed" ? input.winterHighwayKm + input.summerHighwayKm : input.highwayKm,
    cityKm:
      input.seasonMode === "mixed" ? input.winterCityKm + input.summerCityKm : input.cityKm,
    idleHours:
      input.seasonMode === "mixed" ? input.winterIdleHours + input.summerIdleHours : input.idleHours,
    odometerStart,
    odometerEnd: odometerStart + routeDistance
  };
}

function compareSheetsAsc(left: FuelSheetRecord, right: FuelSheetRecord): number {
  return `${left.date}-${left.createdAt}`.localeCompare(`${right.date}-${right.createdAt}`);
}

function compareSheetsDesc(left: FuelSheetRecord, right: FuelSheetRecord): number {
  return compareSheetsAsc(right, left);
}

export function App() {
  const [session, setSession] = useState<Session | null>(() => readStorage(STORAGE_KEYS.session, null));
  const [activeView, setActiveView] = useState<ViewId>("new-sheet");
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => readStorage(STORAGE_KEYS.vehicles, initialVehicles));
  const [drivers, setDrivers] = useState<Driver[]>(() => readStorage(STORAGE_KEYS.drivers, initialDrivers));
  const [fuelSheets, setFuelSheets] = useState<FuelSheetRecord[]>(() =>
    readStorage(STORAGE_KEYS.fuelSheets, initialFuelSheets)
  );
  const [sheetInput, setSheetInput] = useState<FuelSheetInput>(() => readStorage(STORAGE_KEYS.sheetInput, initialInput));
  const [filters, setFilters] = useState<SearchFilters>({
    search: "",
    periodFrom: "2026-03-01",
    periodTo: "2026-03-31",
    vehicleId: ""
  });
  const [selectedSheetId, setSelectedSheetId] = useState<string>(initialFuelSheets[0]?.id ?? "");
  const [savedVehicleId, setSavedVehicleId] = useState<string | null>(null);
  const [editingSheetId, setEditingSheetId] = useState<string | null>(null);
  const [editingSheetInput, setEditingSheetInput] = useState<FuelSheetInput | null>(null);
  const [cloudStatus, setCloudStatus] = useState<"loading" | "synced" | "local" | "error">("loading");
  const [isCloudHydrated, setIsCloudHydrated] = useState(false);

  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === sheetInput.vehicleId) ?? vehicles[0] ?? initialVehicles[0];
  const selectedDriver = drivers.find((driver) => driver.id === sheetInput.driverId) ?? drivers[0] ?? initialDrivers[0];
  const odometerStart = selectedVehicle.currentOdometer ?? 0;
  const preparedInput = useMemo(() => normalizeFuelSheetInput(sheetInput, odometerStart), [sheetInput, odometerStart]);
  const calculation = calculateFuelSheet(preparedInput, selectedVehicle);
  const validationMessages = validateFuelSheet(preparedInput, calculation);
  const visibleFuelSheets = fuelSheets;
  const selectedJournalSheet =
    visibleFuelSheets.find((sheet) => sheet.id === selectedSheetId) ?? visibleFuelSheets[0];
  const editingVehicle =
    vehicles.find((vehicle) => vehicle.id === editingSheetInput?.vehicleId) ?? selectedJournalSheet?.vehicle;
  const editingDriver =
    drivers.find((driver) => driver.id === editingSheetInput?.driverId) ?? selectedJournalSheet?.driver;
  const editingPreparedInput =
    editingSheetInput && editingVehicle
      ? normalizeFuelSheetInput(editingSheetInput, editingSheetInput.odometerStart)
      : null;
  const editingCalculation =
    editingPreparedInput && editingVehicle ? calculateFuelSheet(editingPreparedInput, editingVehicle) : null;
  const editingVehicleSheets =
    editingSheetInput
      ? fuelSheets.filter((sheet) => sheet.vehicleId === editingSheetInput.vehicleId).sort(compareSheetsAsc)
      : [];
  const canEditOpeningFuel =
    !!editingSheetId &&
    editingVehicleSheets.findIndex((sheet) => sheet.id === editingSheetId) <= 0;
  const selectedVehicleHistory = fuelSheets
    .filter((sheet) => sheet.vehicleId === selectedVehicle.id)
    .filter((sheet) => (session?.role === "dispatcher" ? true : sheet.createdBy === session?.email))
    .sort(compareSheetsDesc)
    .slice(0, 5);

  const filteredSheets = visibleFuelSheets
    .filter((sheet) => {
      const haystack = [
        sheet.driver.fullName,
        sheet.vehicle.brand,
        sheet.vehicle.model,
        sheet.vehicle.plateNumber,
        sheet.date
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = haystack.includes(filters.search.toLowerCase());
      const matchesFrom = !filters.periodFrom || sheet.date >= filters.periodFrom;
      const matchesTo = !filters.periodTo || sheet.date <= filters.periodTo;
      const matchesVehicle = !filters.vehicleId || sheet.vehicleId === filters.vehicleId;

      return matchesSearch && matchesFrom && matchesTo && matchesVehicle;
    })
    .sort(compareSheetsDesc);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session));
    }
  }, [session]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEYS.drivers, JSON.stringify(drivers));
    }
  }, [drivers]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEYS.vehicles, JSON.stringify(vehicles));
    }
  }, [vehicles]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEYS.fuelSheets, JSON.stringify(fuelSheets));
    }
  }, [fuelSheets]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEYS.sheetInput, JSON.stringify(sheetInput));
    }
  }, [sheetInput]);

  useEffect(() => {
    let isActive = true;

    async function hydrateCloudState() {
      try {
        const result = await loadRemoteAppState();
        if (!isActive) {
          return;
        }

        if (result?.payload) {
          setVehicles(result.payload.vehicles.length > 0 ? result.payload.vehicles : initialVehicles);
          setDrivers(result.payload.drivers.length > 0 ? result.payload.drivers : initialDrivers);
          setFuelSheets(result.payload.fuelSheets ?? []);
          setCloudStatus(result.mode === "remote" ? "synced" : "local");
        } else {
          setCloudStatus("local");
        }
      } catch {
        if (isActive) {
          setCloudStatus("local");
        }
      } finally {
        if (isActive) {
          setIsCloudHydrated(true);
        }
      }
    }

    void hydrateCloudState();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!vehicles.some((vehicle) => vehicle.id === sheetInput.vehicleId) && vehicles[0]) {
      setSheetInput((current) => ({ ...current, vehicleId: vehicles[0].id }));
    }
  }, [vehicles, sheetInput.vehicleId]);

  useEffect(() => {
    if (!drivers.some((driver) => driver.id === sheetInput.driverId) && drivers[0]) {
      setSheetInput((current) => ({ ...current, driverId: drivers[0].id }));
    }
  }, [drivers, sheetInput.driverId]);

  useEffect(() => {
    if (!fuelSheets.some((sheet) => sheet.id === selectedSheetId)) {
      setSelectedSheetId(fuelSheets[0]?.id ?? "");
    }
  }, [fuelSheets, selectedSheetId]);

  useEffect(() => {
    if (!isCloudHydrated || typeof window === "undefined") {
      return;
    }

    const timer = window.setTimeout(() => {
      void saveRemoteAppState({ vehicles, drivers, fuelSheets })
        .then((result) => {
          setCloudStatus(result?.mode === "remote" ? "synced" : "local");
        })
        .catch(() => {
          setCloudStatus("error");
        });
    }, 450);

    return () => window.clearTimeout(timer);
  }, [drivers, fuelSheets, isCloudHydrated, vehicles]);

  function updateInput<K extends keyof FuelSheetInput>(key: K, value: FuelSheetInput[K]) {
    setSheetInput((current) => ({ ...current, [key]: value }));
  }

  function handleVehicleChange(vehicleId: string) {
    setSheetInput((current) => ({ ...current, vehicleId }));
  }

  function startEditingSheet(sheet: FuelSheetRecord) {
    if (session?.role !== "dispatcher" && sheet.createdBy !== session?.email) {
      return;
    }

    setEditingSheetId(sheet.id);
    setEditingSheetInput({
      vehicleId: sheet.vehicleId,
      date: sheet.date,
      driverId: sheet.driverId,
      routeDescription: sheet.routeDescription,
      openingFuelLiters: sheet.openingFuelLiters,
      refuelLiters: sheet.refuelLiters,
      districtKm: sheet.districtKm,
      highwayKm: sheet.highwayKm,
      cityKm: sheet.cityKm,
      idleHours: sheet.idleHours,
      seasonMode: sheet.seasonMode,
      winterDistrictKm: sheet.winterDistrictKm,
      winterHighwayKm: sheet.winterHighwayKm,
      winterCityKm: sheet.winterCityKm,
      winterIdleHours: sheet.winterIdleHours,
      summerDistrictKm: sheet.summerDistrictKm,
      summerHighwayKm: sheet.summerHighwayKm,
      summerCityKm: sheet.summerCityKm,
      summerIdleHours: sheet.summerIdleHours,
      odometerStart: sheet.odometerStart,
      odometerEnd: sheet.odometerEnd
    });
  }

  function cancelEditingSheet() {
    setEditingSheetId(null);
    setEditingSheetInput(null);
  }

  function saveEditedSheet() {
    if (!editingSheetId || !editingSheetInput || !editingVehicle || !editingDriver) {
      return;
    }

    const vehicleSheets = fuelSheets
      .filter((sheet) => sheet.vehicleId === editingSheetInput.vehicleId)
      .sort(compareSheetsAsc);

    const targetIndex = vehicleSheets.findIndex((sheet) => sheet.id === editingSheetId);
    if (targetIndex === -1) {
      return;
    }

    const previousSheet = vehicleSheets[targetIndex - 1];
    let previousClosingFuel = previousSheet?.calculations.closingFuel ?? editingSheetInput.openingFuelLiters;
    let previousOdometerEnd = previousSheet?.odometerEnd ?? editingSheetInput.odometerStart;
    const updatedRecords = new Map<string, FuelSheetRecord>();

    for (let index = targetIndex; index < vehicleSheets.length; index += 1) {
      const sourceSheet = vehicleSheets[index];
      const sourceInput = index === targetIndex ? editingSheetInput : sourceSheet;
      const normalizedInput = normalizeFuelSheetInput(
        {
          ...sourceInput,
          openingFuelLiters: previousClosingFuel,
          odometerStart: previousOdometerEnd
        },
        previousOdometerEnd
      );
      const vehicle = vehicles.find((item) => item.id === sourceSheet.vehicleId) ?? sourceSheet.vehicle;
      const driver = drivers.find((item) => item.id === normalizedInput.driverId) ?? sourceSheet.driver;

      const updatedRecord: FuelSheetRecord = {
        ...sourceSheet,
        ...normalizedInput,
        date: normalizedInput.date,
        driverId: normalizedInput.driverId,
        driver,
        vehicle,
        calculations: calculateFuelSheet(normalizedInput, vehicle),
        updatedAt: new Date().toISOString()
      };

      updatedRecords.set(sourceSheet.id, updatedRecord);
      previousClosingFuel = updatedRecord.calculations.closingFuel;
      previousOdometerEnd = updatedRecord.odometerEnd;
    }

    const nextSheets = fuelSheets.map((sheet) => updatedRecords.get(sheet.id) ?? sheet);
    setFuelSheets(nextSheets);
    const lastVehicleSheet = nextSheets
      .filter((sheet) => sheet.vehicleId === editingSheetInput.vehicleId)
      .sort(compareSheetsAsc)
      .slice(-1)[0];

    setVehicles((current) =>
      current.map((vehicle) =>
        vehicle.id === editingSheetInput.vehicleId && lastVehicleSheet
          ? {
              ...vehicle,
              currentOdometer: lastVehicleSheet.odometerEnd
            }
          : vehicle
      )
    );

    setEditingSheetId(null);
    setEditingSheetInput(null);
  }

  function saveFuelSheet() {
    if (validationMessages.length > 0) {
      return;
    }

    const record: FuelSheetRecord = {
      ...preparedInput,
      id: `sheet-${Date.now()}`,
      vehicle: selectedVehicle,
      driver: selectedDriver,
      calculations: calculation,
      createdBy: session?.email ?? "dispatcher@fleet.local",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "approved"
    };

    setFuelSheets((current) => [record, ...current]);
    setVehicles((current) =>
      current.map((vehicle) =>
        vehicle.id === selectedVehicle.id
          ? {
              ...vehicle,
              currentOdometer: preparedInput.odometerEnd
            }
          : vehicle
      )
    );
    setSelectedSheetId(record.id);
    setActiveView("journal");
  }

  function updateVehicleNorm(
    vehicleId: string,
    season: SeasonType,
    field: keyof FuelNorms,
    value: number
  ) {
    setVehicles((current) =>
      current.map((vehicle) =>
        vehicle.id === vehicleId
          ? {
              ...vehicle,
              seasonalNorms: {
                ...vehicle.seasonalNorms,
                [season]: {
                  ...vehicle.seasonalNorms[season],
                  [field]: value
                }
              }
            }
          : vehicle
      )
    );
  }

  function updateVehicleCard(
    vehicleId: string,
    patch: Partial<Pick<Vehicle, "brand" | "model" | "plateNumber" | "fuelType" | "currentOdometer">>
  ) {
    setVehicles((current) =>
      current.map((vehicle) =>
        vehicle.id === vehicleId
          ? {
              ...vehicle,
              ...patch
            }
          : vehicle
      )
    );
    setSavedVehicleId(vehicleId);
  }

  function addVehicle(vehicle: Omit<Vehicle, "id" | "normHistory">) {
    const nextVehicle: Vehicle = {
      ...vehicle,
      id: `vehicle-${Date.now()}`,
      normHistory: []
    };

    setVehicles((current) => [...current, nextVehicle]);
    setSheetInput((current) => ({ ...current, vehicleId: nextVehicle.id }));
    setActiveView("vehicles");
  }

  function deleteVehicle(vehicleId: string) {
    setVehicles((current) => {
      if (current.length <= 1) {
        return current;
      }

      const nextVehicles = current.filter((vehicle) => vehicle.id !== vehicleId);
      const fallbackVehicleId = nextVehicles[0]?.id ?? "";

      setSheetInput((currentInput) =>
        currentInput.vehicleId === vehicleId
          ? {
              ...currentInput,
              vehicleId: fallbackVehicleId
            }
          : currentInput
      );

      return nextVehicles;
    });
  }

  function printCurrentSheet() {
    window.print();
  }

  function exportCurrentSheet() {
    const lines = [
      ["Дата", preparedInput.date],
      ["Водитель", selectedDriver.fullName],
      ["Автомобиль", `${selectedVehicle.brand} ${selectedVehicle.model}`],
      ["Госномер", selectedVehicle.plateNumber],
      ["Маршрут", preparedInput.routeDescription],
      ["Спидометр на начало", String(preparedInput.odometerStart)],
      ["Спидометр на конец", String(preparedInput.odometerEnd)],
      ["Режим норм", preparedInput.seasonMode],
      ["Зимний район, км", String(preparedInput.winterDistrictKm)],
      ["Зимняя трасса, км", String(preparedInput.winterHighwayKm)],
      ["Зимний город, км", String(preparedInput.winterCityKm)],
      ["Зимний простой, ч", String(preparedInput.winterIdleHours)],
      ["Общий пробег", String(preparedInput.odometerEnd - preparedInput.odometerStart)],
      ["Район, км", String(preparedInput.districtKm)],
      ["Трасса, км", String(preparedInput.highwayKm)],
      ["Город, км", String(preparedInput.cityKm)],
      ["Простой, часы", String(preparedInput.idleHours)],
      ["Топливо на начало, л", String(preparedInput.openingFuelLiters)],
      ["Заправка, л", String(preparedInput.refuelLiters)],
      ["Расход всего, л", String(calculation.totalFuelConsumption)],
      ["Топливо на конец дня, л", String(calculation.closingFuel)]
    ];

    const content = lines.map((line) => line.join(";")).join("\n");
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fuel-sheet-${preparedInput.date}-${selectedVehicle.plateNumber}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!session) {
    return <LoginScreen onLogin={setSession} />;
  }

  const roleNavigation = getNavigationByRole(session.role);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-badge">FF</div>
          <div>
            <p className="eyebrow">Fleet Fuel Platform</p>
            <h1>Путевые листы</h1>
          </div>
        </div>

        <nav className="nav-list" aria-label="Основная навигация">
          {roleNavigation.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === activeView ? "nav-item active" : "nav-item"}
              onClick={() => setActiveView(item.id)}
            >
              <span>{item.label}</span>
              <small>{item.hint}</small>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <p className="eyebrow">Пользователь</p>
          <strong>{session.fullName}</strong>
          <span>
            {session.role === "dispatcher" ? "Диспетчер" : session.role === "driver" ? "Водитель" : session.role}
          </span>
          <button
            type="button"
            className="ghost-button"
            onClick={() => {
              setSession(null);
              if (typeof window !== "undefined") {
                window.localStorage.removeItem(STORAGE_KEYS.session);
              }
            }}
          >
            Сменить вход
          </button>
        </div>
      </aside>

      <main className="content">
        <header className="page-topbar">
          <div>
            <p className="eyebrow">Главный приоритет</p>
            <h2>Быстрый и понятный расчет путевки</h2>
          </div>
          <div className="topbar-actions">
            <span className={`cloud-pill ${cloudStatus}`}>
              {cloudStatus === "loading"
                ? "Подключаем облако"
                : cloudStatus === "synced"
                  ? "Общее облако подключено"
                  : cloudStatus === "error"
                    ? "Ошибка синхронизации"
                    : "Локальный режим"}
            </span>
            <button type="button" className="secondary-button" onClick={() => setActiveView("journal")}>
              Смотреть журнал
            </button>
            <button type="button" className="primary-button" onClick={() => setActiveView("new-sheet")}>
              Открыть форму
            </button>
          </div>
        </header>

        {activeView === "dashboard" && (
          <DashboardView
            role={session.role}
            vehicles={vehicles}
            selectedVehicleId={sheetInput.vehicleId}
            onCreateSheet={() => setActiveView("new-sheet")}
            onOpenJournal={() => setActiveView("journal")}
            onOpenVehicles={() => setActiveView("vehicles")}
            onSelectVehicle={handleVehicleChange}
          />
        )}

        {activeView === "vehicles" && (
          <VehiclesView
            vehicles={vehicles}
            onUpdateNorm={updateVehicleNorm}
            onUpdateVehicleCard={updateVehicleCard}
            onAddVehicle={addVehicle}
            onDeleteVehicle={deleteVehicle}
            savedVehicleId={savedVehicleId}
            onSavedVehicleShown={() => setSavedVehicleId(null)}
          />
        )}

        {activeView === "drivers" && session.role !== "driver" && <DriversView drivers={drivers} />}

        {activeView === "new-sheet" && (
          <FuelSheetView
            vehicles={vehicles}
            drivers={drivers}
            input={preparedInput}
            calculation={calculation}
            validationMessages={validationMessages}
            selectedVehicle={selectedVehicle}
            vehicleHistory={selectedVehicleHistory}
            onInputChange={updateInput}
            onVehicleChange={handleVehicleChange}
            onSave={saveFuelSheet}
            onPrint={printCurrentSheet}
            onExport={exportCurrentSheet}
          />
        )}

        {activeView === "journal" && (
          <JournalView
            filters={filters}
            fuelSheets={filteredSheets}
            vehicles={vehicles}
            drivers={drivers}
            selectedSheet={selectedJournalSheet}
            editingSheetId={editingSheetId}
            editingSheetInput={editingSheetInput}
            editingCalculation={editingCalculation}
            canEditOpeningFuel={canEditOpeningFuel}
            canViewSelectedSheet={
              session.role === "dispatcher" ||
              (selectedJournalSheet ? selectedJournalSheet.createdBy === session.email : false)
            }
            canEditSelectedSheet={
              session.role === "dispatcher" ||
              (selectedJournalSheet ? selectedJournalSheet.createdBy === session.email : false)
            }
            onFilterChange={setFilters}
            onSelectSheet={setSelectedSheetId}
            onStartEdit={startEditingSheet}
            onCancelEdit={cancelEditingSheet}
            onSaveEdit={saveEditedSheet}
            onEditInputChange={(key, value) =>
              setEditingSheetInput((current) => (current ? { ...current, [key]: value } : current))
            }
          />
        )}
      </main>
    </div>
  );
}

function validateFuelSheet(
  input: FuelSheetInput,
  calculation: ReturnType<typeof calculateFuelSheet>
): string[] {
  const messages: string[] = [];

  if (input.odometerEnd < input.odometerStart) {
    messages.push("Общий пробег не может быть отрицательным.");
  }

  if (input.openingFuelLiters < 0 || input.refuelLiters < 0) {
    messages.push("Топливо на начало и заправка должны быть неотрицательными.");
  }

  if (input.districtKm < 0 || input.highwayKm < 0 || input.cityKm < 0 || input.idleHours < 0) {
    messages.push("Пробеги и простой не могут быть отрицательными.");
  }

  if (calculation.closingFuel < 0) {
    messages.push("На конец дня получилось меньше нуля. Проверьте топливо или пробег.");
  }

  return messages;
}

function LoginScreen(props: { onLogin: (session: Session) => void }) {
  const [email, setEmail] = useState("dispatcher@fleet.local");
  const [password, setPassword] = useState("123456");
  const [error, setError] = useState("");

  return (
    <div className="login-screen">
      <div className="login-hero">
        <p className="eyebrow">Коммерческий MVP</p>
        <h1>Простой учет путевок, топлива и машин</h1>
        <p className="hero-copy">
          Первая версия заточена под ежедневную работу: выбрать машину, быстро ввести пробеги и топливо,
          увидеть итог и сохранить документ.
        </p>

        <div className="hero-grid">
          <StatBadge title="Меньше лишнего" value="Да" />
          <StatBadge title="Телефон + ПК" value="Адаптивно" />
          <StatBadge title="Нормы по машине" value="Отдельно" />
        </div>
      </div>

      <form
        className="login-card"
        onSubmit={(event) => {
          event.preventDefault();
          const account = mockAccounts.find(
            (item) => item.email.toLowerCase() === email.trim().toLowerCase() && item.password === password
          );

          if (!account) {
            setError("Неверный логин или пароль.");
            return;
          }

          setError("");
          props.onLogin({
            fullName: account.fullName,
            role: account.role,
            email: account.email
          });
        }}
      >
        <div>
          <p className="eyebrow">Вход</p>
          <h2>Авторизация</h2>
        </div>

        <label className="field">
          <span>Логин</span>
          <input value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>

        <label className="field">
          <span>Пароль</span>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>

        <button type="submit" className="primary-button full-width">
          Войти
        </button>

        {error ? <p className="muted-copy error-copy">{error}</p> : null}

        <p className="muted-copy">
          Для водителя создан вход: `pasasokorov@mail.ru` / `123456`
        </p>
      </form>
    </div>
  );
}

function DashboardView(props: {
  role: UserRole;
  vehicles: Vehicle[];
  selectedVehicleId: string;
  onCreateSheet: () => void;
  onOpenJournal: () => void;
  onOpenVehicles: () => void;
  onSelectVehicle: (vehicleId: string) => void;
}) {
  if (props.role === "driver") {
    return (
      <section className="stack-lg">
        <div className="section-head">
          <div>
            <p className="eyebrow">Для водителя</p>
            <h3>Выберите машину и продолжайте работу</h3>
          </div>
          <div className="button-row">
            <button type="button" className="secondary-button" onClick={props.onOpenJournal}>
              Мои путевки
            </button>
            <button type="button" className="primary-button" onClick={props.onCreateSheet}>
              Новая путевка
            </button>
          </div>
        </div>

        <div className="vehicle-grid">
          {props.vehicles.map((vehicle) => (
            <article
              key={vehicle.id}
              className={vehicle.id === props.selectedVehicleId ? "panel vehicle-card selected-card" : "panel vehicle-card"}
            >
              <div className="vehicle-header">
                <div>
                  <h4>
                    {vehicle.brand} {vehicle.model}
                  </h4>
                  <p>
                    {vehicle.plateNumber} • Спидометр {formatKm(vehicle.currentOdometer)}
                  </p>
                </div>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    props.onSelectVehicle(vehicle.id);
                    props.onCreateSheet();
                  }}
                >
                  Выбрать
                </button>
              </div>

              <div className="summary-list">
                <SummaryRow
                  label="Зимние нормы"
                  value={`${formatOneDecimal(vehicle.seasonalNorms.winter.districtLitersPer100Km)} / ${formatOneDecimal(vehicle.seasonalNorms.winter.highwayLitersPer100Km)} / ${formatOneDecimal(vehicle.seasonalNorms.winter.cityLitersPer100Km)}`}
                />
                <SummaryRow
                  label="Летние нормы"
                  value={`${formatOneDecimal(vehicle.seasonalNorms.summer.districtLitersPer100Km)} / ${formatOneDecimal(vehicle.seasonalNorms.summer.highwayLitersPer100Km)} / ${formatOneDecimal(vehicle.seasonalNorms.summer.cityLitersPer100Km)}`}
                />
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="stack-lg">
      <div className="stats-grid">
        {dashboardStats.map((item) => (
          <article key={item.id} className="metric-card">
            <p className="eyebrow">{item.label}</p>
            <strong>{item.value}</strong>
            <span>{item.helper}</span>
          </article>
        ))}
      </div>

      <div className="split-layout">
        <article className="panel feature-panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">Сейчас главное</p>
              <h3>Путевка без лишних полей</h3>
            </div>
            <button type="button" className="primary-button" onClick={props.onCreateSheet}>
              Открыть форму
            </button>
          </div>

          <ul className="check-list">
            <li>Выбрали машину и водителя</li>
            <li>Ввели общий пробег, участки, простой и топливо</li>
            <li>Система сама показала спидометр на начало и конец</li>
            <li>Если километры не сходятся, сразу видно предупреждение</li>
          </ul>
        </article>

        <article className="panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">Дальше можно внедрить</p>
              <h3>Следующие модули</h3>
            </div>
            <button type="button" className="secondary-button" onClick={props.onOpenVehicles}>
              Открыть машины
            </button>
          </div>

          <ul className="check-list">
            <li>ТО и ремонты</li>
            <li>История по каждой машине</li>
            <li>Просмотр последних показаний</li>
            <li>Роли, уведомления и мобильный режим</li>
          </ul>
        </article>
      </div>
    </section>
  );
}

function VehiclesView(props: {
  vehicles: Vehicle[];
  onUpdateNorm: (
    vehicleId: string,
    season: SeasonType,
    field: keyof FuelNorms,
    value: number
  ) => void;
  onUpdateVehicleCard: (
    vehicleId: string,
    patch: Partial<Pick<Vehicle, "brand" | "model" | "plateNumber" | "fuelType" | "currentOdometer">>
  ) => void;
  onAddVehicle: (vehicle: Omit<Vehicle, "id" | "normHistory">) => void;
  onDeleteVehicle: (vehicleId: string) => void;
  savedVehicleId: string | null;
  onSavedVehicleShown: () => void;
}) {
  const [draft, setDraft] = useState({
    brand: "",
    model: "",
    plateNumber: "",
    fuelType: "АИ-92",
    currentOdometer: 0,
    winterDistrict: 0,
    winterHighway: 0,
    winterCity: 0,
    winterIdle: 0,
    summerDistrict: 0,
    summerHighway: 0,
    summerCity: 0,
    summerIdle: 0
  });

  function resetDraft() {
    setDraft({
      brand: "",
      model: "",
      plateNumber: "",
      fuelType: "АИ-92",
      currentOdometer: 0,
      winterDistrict: 0,
      winterHighway: 0,
      winterCity: 0,
      winterIdle: 0,
      summerDistrict: 0,
      summerHighway: 0,
      summerCity: 0,
      summerIdle: 0
    });
  }

  const [cardDrafts, setCardDrafts] = useState<Record<string, Vehicle>>(
    Object.fromEntries(props.vehicles.map((vehicle) => [vehicle.id, vehicle]))
  );

  useEffect(() => {
    setCardDrafts((current) => {
      const nextDrafts: Record<string, Vehicle> = {};

      for (const vehicle of props.vehicles) {
        nextDrafts[vehicle.id] = current[vehicle.id] ?? vehicle;
      }

      return nextDrafts;
    });
  }, [props.vehicles]);

  function submitVehicle() {
    if (!draft.brand.trim() || !draft.model.trim() || !draft.plateNumber.trim()) {
      return;
    }

    props.onAddVehicle({
      brand: draft.brand.trim(),
      model: draft.model.trim(),
      plateNumber: draft.plateNumber.trim(),
      fuelType: draft.fuelType.trim(),
      currentOdometer: draft.currentOdometer,
      seasonalNorms: {
        winter: {
          districtLitersPer100Km: draft.winterDistrict,
          highwayLitersPer100Km: draft.winterHighway,
          cityLitersPer100Km: draft.winterCity,
          idleLitersPerHour: draft.winterIdle
        },
        summer: {
          districtLitersPer100Km: draft.summerDistrict,
          highwayLitersPer100Km: draft.summerHighway,
          cityLitersPer100Km: draft.summerCity,
          idleLitersPerHour: draft.summerIdle
        }
      }
    });
    resetDraft();
  }

  function updateCardDraft(vehicleId: string, patch: Partial<Vehicle>) {
    setCardDrafts((current) => ({
      ...current,
      [vehicleId]: {
        ...current[vehicleId],
        ...patch
      }
    }));
  }

  function updateCardNormDraft(
    vehicleId: string,
    season: SeasonType,
    field: keyof FuelNorms,
    value: number
  ) {
    setCardDrafts((current) => ({
      ...current,
      [vehicleId]: {
        ...current[vehicleId],
        seasonalNorms: {
          ...current[vehicleId].seasonalNorms,
          [season]: {
            ...current[vehicleId].seasonalNorms[season],
            [field]: value
          }
        }
      }
    }));
  }

  function saveVehicleCard(vehicleId: string) {
    const draftVehicle = cardDrafts[vehicleId];
    if (!draftVehicle) {
      return;
    }

    props.onUpdateVehicleCard(vehicleId, {
      brand: draftVehicle.brand,
      model: draftVehicle.model,
      plateNumber: draftVehicle.plateNumber,
      fuelType: draftVehicle.fuelType,
      currentOdometer: draftVehicle.currentOdometer
    });
    props.onUpdateNorm(
      vehicleId,
      "winter",
      "districtLitersPer100Km",
      draftVehicle.seasonalNorms.winter.districtLitersPer100Km
    );
    props.onUpdateNorm(
      vehicleId,
      "winter",
      "highwayLitersPer100Km",
      draftVehicle.seasonalNorms.winter.highwayLitersPer100Km
    );
    props.onUpdateNorm(
      vehicleId,
      "winter",
      "cityLitersPer100Km",
      draftVehicle.seasonalNorms.winter.cityLitersPer100Km
    );
    props.onUpdateNorm(
      vehicleId,
      "winter",
      "idleLitersPerHour",
      draftVehicle.seasonalNorms.winter.idleLitersPerHour
    );
    props.onUpdateNorm(
      vehicleId,
      "summer",
      "districtLitersPer100Km",
      draftVehicle.seasonalNorms.summer.districtLitersPer100Km
    );
    props.onUpdateNorm(
      vehicleId,
      "summer",
      "highwayLitersPer100Km",
      draftVehicle.seasonalNorms.summer.highwayLitersPer100Km
    );
    props.onUpdateNorm(
      vehicleId,
      "summer",
      "cityLitersPer100Km",
      draftVehicle.seasonalNorms.summer.cityLitersPer100Km
    );
    props.onUpdateNorm(
      vehicleId,
      "summer",
      "idleLitersPerHour",
      draftVehicle.seasonalNorms.summer.idleLitersPerHour
    );
    setCardDrafts((current) => ({
      ...current,
      [vehicleId]: draftVehicle
    }));
  }

  useEffect(() => {
    if (!props.savedVehicleId) {
      return;
    }

    const timer = window.setTimeout(() => {
      props.onSavedVehicleShown();
    }, 1800);

    return () => window.clearTimeout(timer);
  }, [props.savedVehicleId, props.onSavedVehicleShown]);

  return (
    <section className="stack-lg">
      <div className="section-head">
        <div>
          <p className="eyebrow">Справочник машин</p>
          <h3>Только нужное: нормы и история</h3>
        </div>
      </div>

      <article className="panel">
        <div className="section-head compact">
          <div>
            <p className="eyebrow">Добавить машину</p>
            <h4>Новая карточка автомобиля</h4>
          </div>
          <button type="button" className="primary-button" onClick={submitVehicle}>
            Добавить машину
          </button>
        </div>

        <div className="form-grid">
          <InputField
            label="Марка"
            value={draft.brand}
            onChange={(value) => setDraft((current) => ({ ...current, brand: value }))}
          />
          <InputField
            label="Модель"
            value={draft.model}
            onChange={(value) => setDraft((current) => ({ ...current, model: value }))}
          />
          <InputField
            label="Госномер"
            value={draft.plateNumber}
            onChange={(value) => setDraft((current) => ({ ...current, plateNumber: value }))}
          />
          <InputField
            label="Тип топлива"
            value={draft.fuelType}
            onChange={(value) => setDraft((current) => ({ ...current, fuelType: value }))}
          />
          <LocalizedNumberField
            label="Стартовый спидометр"
            value={draft.currentOdometer}
            digits={0}
            onChange={(value) => setDraft((current) => ({ ...current, currentOdometer: value }))}
          />
          <LocalizedNumberField
            label="Зима: район"
            value={draft.winterDistrict}
            digits={1}
            onChange={(value) => setDraft((current) => ({ ...current, winterDistrict: value }))}
          />
          <LocalizedNumberField
            label="Зима: трасса"
            value={draft.winterHighway}
            digits={1}
            onChange={(value) => setDraft((current) => ({ ...current, winterHighway: value }))}
          />
          <LocalizedNumberField
            label="Зима: город"
            value={draft.winterCity}
            digits={1}
            onChange={(value) => setDraft((current) => ({ ...current, winterCity: value }))}
          />
          <LocalizedNumberField
            label="Зима: простой"
            value={draft.winterIdle}
            digits={2}
            onChange={(value) => setDraft((current) => ({ ...current, winterIdle: value }))}
          />
          <LocalizedNumberField
            label="Лето: район"
            value={draft.summerDistrict}
            digits={1}
            onChange={(value) => setDraft((current) => ({ ...current, summerDistrict: value }))}
          />
          <LocalizedNumberField
            label="Лето: трасса"
            value={draft.summerHighway}
            digits={1}
            onChange={(value) => setDraft((current) => ({ ...current, summerHighway: value }))}
          />
          <LocalizedNumberField
            label="Лето: город"
            value={draft.summerCity}
            digits={1}
            onChange={(value) => setDraft((current) => ({ ...current, summerCity: value }))}
          />
          <LocalizedNumberField
            label="Лето: простой"
            value={draft.summerIdle}
            digits={2}
            onChange={(value) => setDraft((current) => ({ ...current, summerIdle: value }))}
          />
        </div>
      </article>

      <div className="vehicle-grid">
        {props.vehicles.map((vehicle) => (
          <article key={vehicle.id} className="panel vehicle-card">
            {cardDrafts[vehicle.id] ? (
              <>
                <div className="section-head compact card-save-head">
                  <div>
                    <p className="eyebrow">Карточка машины</p>
                    <h4>
                      {cardDrafts[vehicle.id].brand} {cardDrafts[vehicle.id].model}
                    </h4>
                  </div>
                  <div className="button-row compact-actions">
                    {props.savedVehicleId === vehicle.id ? (
                      <span className="success-chip">Изменения сохранены</span>
                    ) : null}
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => saveVehicleCard(vehicle.id)}
                    >
                      Сохранить изменения
                    </button>
                  </div>
                </div>

            <div className="vehicle-header">
              <div>
                <p>
                  {cardDrafts[vehicle.id].plateNumber} • {cardDrafts[vehicle.id].fuelType}
                </p>
              </div>
              <div className="button-row compact-actions">
                <span className="status-chip">На линии</span>
                <button
                  type="button"
                  className="danger-button"
                  onClick={() => props.onDeleteVehicle(vehicle.id)}
                  disabled={props.vehicles.length <= 1}
                >
                  Удалить
                </button>
              </div>
            </div>

            <div className="form-grid">
              <InputField
                label="Марка"
                value={cardDrafts[vehicle.id].brand}
                onChange={(value) => updateCardDraft(vehicle.id, { brand: value })}
              />
              <InputField
                label="Модель"
                value={cardDrafts[vehicle.id].model}
                onChange={(value) => updateCardDraft(vehicle.id, { model: value })}
              />
              <InputField
                label="Госномер"
                value={cardDrafts[vehicle.id].plateNumber}
                onChange={(value) => updateCardDraft(vehicle.id, { plateNumber: value })}
              />
              <InputField
                label="Тип топлива"
                value={cardDrafts[vehicle.id].fuelType}
                onChange={(value) => updateCardDraft(vehicle.id, { fuelType: value })}
              />
              <LocalizedNumberField
                label="Спидометр на начало"
                value={cardDrafts[vehicle.id].currentOdometer}
                digits={0}
                onChange={(value) => updateCardDraft(vehicle.id, { currentOdometer: value })}
              />
              <InfoField
                label="Текущий статус"
                value={`${cardDrafts[vehicle.id].brand} ${cardDrafts[vehicle.id].model} • ${cardDrafts[vehicle.id].plateNumber}`}
              />
            </div>

            <div className="season-block">
              <div className="section-head compact">
                <h5>Зимние нормы</h5>
              </div>
              <div className="norm-grid">
                <EditableNormField
                  label="Район"
                  value={cardDrafts[vehicle.id].seasonalNorms.winter.districtLitersPer100Km}
                  digits={1}
                  onChange={(value) => updateCardNormDraft(vehicle.id, "winter", "districtLitersPer100Km", value)}
                />
                <EditableNormField
                  label="Трасса"
                  value={cardDrafts[vehicle.id].seasonalNorms.winter.highwayLitersPer100Km}
                  digits={1}
                  onChange={(value) => updateCardNormDraft(vehicle.id, "winter", "highwayLitersPer100Km", value)}
                />
                <EditableNormField
                  label="Город"
                  value={cardDrafts[vehicle.id].seasonalNorms.winter.cityLitersPer100Km}
                  digits={1}
                  onChange={(value) => updateCardNormDraft(vehicle.id, "winter", "cityLitersPer100Km", value)}
                />
                <EditableNormField
                  label="Простой"
                  value={cardDrafts[vehicle.id].seasonalNorms.winter.idleLitersPerHour}
                  digits={2}
                  onChange={(value) => updateCardNormDraft(vehicle.id, "winter", "idleLitersPerHour", value)}
                />
              </div>
            </div>

            <div className="season-block">
              <div className="section-head compact">
                <h5>Летние нормы</h5>
              </div>
              <div className="norm-grid">
                <EditableNormField
                  label="Район"
                  value={cardDrafts[vehicle.id].seasonalNorms.summer.districtLitersPer100Km}
                  digits={1}
                  onChange={(value) => updateCardNormDraft(vehicle.id, "summer", "districtLitersPer100Km", value)}
                />
                <EditableNormField
                  label="Трасса"
                  value={cardDrafts[vehicle.id].seasonalNorms.summer.highwayLitersPer100Km}
                  digits={1}
                  onChange={(value) => updateCardNormDraft(vehicle.id, "summer", "highwayLitersPer100Km", value)}
                />
                <EditableNormField
                  label="Город"
                  value={cardDrafts[vehicle.id].seasonalNorms.summer.cityLitersPer100Km}
                  digits={1}
                  onChange={(value) => updateCardNormDraft(vehicle.id, "summer", "cityLitersPer100Km", value)}
                />
                <EditableNormField
                  label="Простой"
                  value={cardDrafts[vehicle.id].seasonalNorms.summer.idleLitersPerHour}
                  digits={2}
                  onChange={(value) => updateCardNormDraft(vehicle.id, "summer", "idleLitersPerHour", value)}
                />
              </div>
            </div>

            <div className="history-block">
              <div className="section-head compact">
                <h5>История изменений</h5>
              </div>
              {vehicle.normHistory.length === 0 ? (
                <p className="muted-copy">История пока пустая.</p>
              ) : (
                vehicle.normHistory.map((item) => (
                  <div key={item.id} className="history-row">
                    <strong>{new Date(item.changedAt).toLocaleDateString("ru-RU")}</strong>
                    <span>
                      {item.changedBy} • {item.reason}
                    </span>
                  </div>
                ))
              )}
            </div>
              </>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function DriversView(props: { drivers: Driver[] }) {
  return (
    <section className="stack-lg">
      <div className="section-head">
        <div>
          <p className="eyebrow">Водители</p>
          <h3>Кто сегодня работает</h3>
        </div>
      </div>

      <div className="table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>ФИО</th>
              <th>Табельный</th>
              <th>Телефон</th>
              <th>Смена</th>
            </tr>
          </thead>
          <tbody>
            {props.drivers.map((driver) => (
              <tr key={driver.id}>
                <td>{driver.fullName}</td>
                <td>{driver.tabNumber}</td>
                <td>{driver.phone}</td>
                <td>{driver.shift}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FuelSheetView(props: {
  vehicles: Vehicle[];
  drivers: Driver[];
  input: FuelSheetInput;
  calculation: ReturnType<typeof calculateFuelSheet>;
  validationMessages: string[];
  selectedVehicle: Vehicle;
  vehicleHistory: FuelSheetRecord[];
  onInputChange: <K extends keyof FuelSheetInput>(key: K, value: FuelSheetInput[K]) => void;
  onVehicleChange: (vehicleId: string) => void;
  onSave: () => void;
  onPrint: () => void;
  onExport: () => void;
}) {
  const mismatch = !props.calculation.isDistanceMatched;

  return (
    <section className="stack-lg">
      <div className="section-head">
        <div>
          <p className="eyebrow">Новая путевка</p>
          <h3>Главная форма на каждый день</h3>
        </div>
        <div className="button-row">
          <button type="button" className="secondary-button" onClick={props.onPrint}>
            Печать
          </button>
          <button type="button" className="secondary-button" onClick={props.onExport}>
            Excel
          </button>
          <button type="button" className="primary-button" onClick={props.onSave}>
            Сохранить
          </button>
        </div>
      </div>

      <div className="sheet-layout">
        <article className="panel form-panel">
          <div className="form-grid">
            <SelectField
              label="Машина"
              value={props.input.vehicleId}
              options={props.vehicles.map((vehicle) => ({
                value: vehicle.id,
                label: `${vehicle.brand} ${vehicle.model} • ${vehicle.plateNumber}`
              }))}
              onChange={props.onVehicleChange}
            />
            <SelectField
              label="Водитель"
              value={props.input.driverId}
              options={props.drivers.map((driver) => ({
                value: driver.id,
                label: driver.fullName
              }))}
              onChange={(value) => props.onInputChange("driverId", value)}
            />
            <div className="field route-field">
              <span>Маршрут на обороте</span>
              <div className="preset-row">
                {routePresets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className="secondary-button preset-button"
                    onClick={() => props.onInputChange("routeDescription", preset.route)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <textarea
                value={props.input.routeDescription}
                onChange={(event) => props.onInputChange("routeDescription", event.target.value)}
                rows={4}
                placeholder="Например: Гараж - Корсаков - Южный - Город - Корсаков - Гараж"
              />
            </div>
            <InputField
              label="Дата"
              type="date"
              value={props.input.date}
              onChange={(value) => props.onInputChange("date", value)}
            />
            <SelectField
              label="Сезон расчета"
              value={props.input.seasonMode}
              options={[
                { value: "winter", label: "Зимние нормы" },
                { value: "summer", label: "Летние нормы" },
                { value: "mixed", label: "Переходный период" }
              ]}
              onChange={(value) =>
                props.onInputChange("seasonMode", value as FuelSheetInput["seasonMode"])
              }
            />
            <InfoField
              label="Действующие нормы"
              value={`${formatOneDecimal(props.calculation.appliedNorms.districtLitersPer100Km)} / ${formatOneDecimal(props.calculation.appliedNorms.highwayLitersPer100Km)} / ${formatOneDecimal(props.calculation.appliedNorms.cityLitersPer100Km)} / ${formatTwoDecimals(props.calculation.appliedNorms.idleLitersPerHour)}`}
              helper="Район / трасса / город / простой"
            />
            {props.input.seasonMode === "mixed" ? (
              <>
                <InfoField
                  label="Зимние нормы"
                  value={`${formatOneDecimal(props.selectedVehicle.seasonalNorms.winter.districtLitersPer100Km)} / ${formatOneDecimal(props.selectedVehicle.seasonalNorms.winter.highwayLitersPer100Km)} / ${formatOneDecimal(props.selectedVehicle.seasonalNorms.winter.cityLitersPer100Km)} / ${formatTwoDecimals(props.selectedVehicle.seasonalNorms.winter.idleLitersPerHour)}`}
                  helper="Район / трасса / город / простой"
                />
                <InfoField
                  label="Летние нормы"
                  value={`${formatOneDecimal(props.selectedVehicle.seasonalNorms.summer.districtLitersPer100Km)} / ${formatOneDecimal(props.selectedVehicle.seasonalNorms.summer.highwayLitersPer100Km)} / ${formatOneDecimal(props.selectedVehicle.seasonalNorms.summer.cityLitersPer100Km)} / ${formatTwoDecimals(props.selectedVehicle.seasonalNorms.summer.idleLitersPerHour)}`}
                  helper="Район / трасса / город / простой"
                />
              </>
            ) : null}
            {props.input.seasonMode === "mixed" ? (
              <>
                <NumberField
                  label="Зимний район, км"
                  value={props.input.winterDistrictKm}
                  onChange={(value) => props.onInputChange("winterDistrictKm", Math.max(0, value))}
                />
                <NumberField
                  label="Летний район, км"
                  value={props.input.summerDistrictKm}
                  onChange={(value) => props.onInputChange("summerDistrictKm", Math.max(0, value))}
                />
                <NumberField
                  label="Зимняя трасса, км"
                  value={props.input.winterHighwayKm}
                  onChange={(value) => props.onInputChange("winterHighwayKm", Math.max(0, value))}
                />
                <NumberField
                  label="Летняя трасса, км"
                  value={props.input.summerHighwayKm}
                  onChange={(value) => props.onInputChange("summerHighwayKm", Math.max(0, value))}
                />
                <NumberField
                  label="Зимний город, км"
                  value={props.input.winterCityKm}
                  onChange={(value) => props.onInputChange("winterCityKm", Math.max(0, value))}
                />
                <NumberField
                  label="Летний город, км"
                  value={props.input.summerCityKm}
                  onChange={(value) => props.onInputChange("summerCityKm", Math.max(0, value))}
                />
                <NumberField
                  label="Зимний простой, ч"
                  value={props.input.winterIdleHours}
                  digits={2}
                  onChange={(value) => props.onInputChange("winterIdleHours", Math.max(0, value))}
                />
                <NumberField
                  label="Летний простой"
                  value={props.input.summerIdleHours}
                  digits={2}
                  onChange={(value) => props.onInputChange("summerIdleHours", Math.max(0, value))}
                />
              </>
            ) : null}
            <InfoField
              label="Спидометр на начало"
              value={formatKm(props.input.odometerStart)}
              helper="Подставлен из карточки машины"
            />
            <InfoField
              label="Спидометр на конец"
              value={formatKm(props.input.odometerEnd)}
              helper="Считается автоматически"
            />
            <InfoField
              label="Сколько проехали всего, км"
              value={formatKm(props.calculation.routeDistance)}
              helper="Считается как район + трасса + город"
            />
            <NumberField
              label="Пробег по району, км"
              value={props.input.districtKm}
              onChange={(value) => props.onInputChange("districtKm", value)}
            />
            <NumberField
              label="Пробег по трассе, км"
              value={props.input.highwayKm}
              onChange={(value) => props.onInputChange("highwayKm", value)}
            />
            <NumberField
              label="Пробег по городу, км"
              value={props.input.cityKm}
              onChange={(value) => props.onInputChange("cityKm", value)}
            />
            <NumberField
              label="Простой, часы"
              value={props.input.idleHours}
              digits={2}
              onChange={(value) => props.onInputChange("idleHours", value)}
            />
            <NumberField
              label="Топливо на начало, л"
              value={props.input.openingFuelLiters}
              digits={2}
              onChange={(value) => props.onInputChange("openingFuelLiters", value)}
            />
            <NumberField
              label="Заправка за день, л"
              value={props.input.refuelLiters}
              digits={2}
              onChange={(value) => props.onInputChange("refuelLiters", value)}
            />
          </div>
        </article>

        <aside className="stack-lg">
          <article className="panel result-panel">
            <div className="section-head compact">
              <div>
                <p className="eyebrow">Результат</p>
                <h3>
                  {props.selectedVehicle.brand} {props.selectedVehicle.model}
                </h3>
              </div>
              <span className={mismatch ? "warning-chip" : "success-chip"}>
                {mismatch ? "Км не сходятся" : "Все сходится"}
              </span>
            </div>

            <div className="summary-list">
              <SummaryRow label="Спидометр на начало" value={formatKm(props.input.odometerStart)} />
              <SummaryRow label="Спидометр на конец" value={formatKm(props.input.odometerEnd)} />
              <SummaryRow label="Маршрут" value={props.input.routeDescription || "Не заполнен"} />
              <SummaryRow
                label="Режим норм"
                value={
                  props.input.seasonMode === "mixed"
                    ? `Переходный по участкам`
                    : props.input.seasonMode === "winter"
                      ? "Зима"
                      : "Лето"
                }
              />
              <SummaryRow label="Район" value={formatLiters(props.calculation.districtFuel)} />
              <SummaryRow label="Трасса" value={formatLiters(props.calculation.highwayFuel)} />
              <SummaryRow label="Город" value={formatLiters(props.calculation.cityFuel)} />
              <SummaryRow label="Простой" value={formatLiters(props.calculation.idleFuel)} />
              <SummaryRow label="Топливо на начало" value={formatLiters(props.input.openingFuelLiters)} />
              <SummaryRow label="Заправка" value={formatLiters(props.input.refuelLiters)} />
              <SummaryRow label="Топливо на конец" value={formatLiters(props.calculation.closingFuel)} emphasized />
              <SummaryRow label="Общий пробег" value={formatKm(props.calculation.odometerDistance)} />
              <SummaryRow label="Сумма участков" value={formatKm(props.calculation.routeDistance)} />
              <SummaryRow label="Простой, часы" value={formatHours(props.input.idleHours)} />
              {props.input.seasonMode === "mixed" ? (
                <>
                  <SummaryRow
                    label="Зимняя часть"
                    value={`${formatKm(props.calculation.seasonalBreakdown.winterDistrictKm + props.calculation.seasonalBreakdown.winterHighwayKm + props.calculation.seasonalBreakdown.winterCityKm)} / ${formatHours(props.calculation.seasonalBreakdown.winterIdleHours)}`}
                  />
                  <SummaryRow
                    label="Летняя часть"
                    value={`${formatKm(props.calculation.seasonalBreakdown.summerDistrictKm + props.calculation.seasonalBreakdown.summerHighwayKm + props.calculation.seasonalBreakdown.summerCityKm)} / ${formatHours(props.calculation.seasonalBreakdown.summerIdleHours)}`}
                  />
                </>
              ) : null}
            </div>

            {mismatch && (
              <div className="warning-box">
                Общий пробег и сумма район/трасса/город не совпадают на{" "}
                {formatKm(Math.abs(props.calculation.distanceDifference))}.
              </div>
            )}

            {props.validationMessages.length > 0 && (
              <div className="validation-box">
                {props.validationMessages.map((message) => (
                  <p key={message}>{message}</p>
                ))}
              </div>
            )}
          </article>

          <article className="panel">
            <div className="section-head compact">
              <h4>Последние путевки этой машины</h4>
            </div>
            {props.vehicleHistory.length === 0 ? (
              <p className="muted-copy">Пока нет сохраненных документов.</p>
            ) : (
              <div className="mini-list">
                {props.vehicleHistory.map((sheet) => (
                  <div key={sheet.id} className="mini-row">
                    <strong>{sheet.date}</strong>
                    <span>{sheet.driver.fullName}</span>
                    <small>
                      {formatKm(sheet.odometerStart)} {"->"} {formatKm(sheet.odometerEnd)}
                    </small>
                  </div>
                ))}
              </div>
            )}
          </article>
        </aside>
      </div>
    </section>
  );
}

function JournalView(props: {
  filters: SearchFilters;
  fuelSheets: FuelSheetRecord[];
  vehicles: Vehicle[];
  drivers: Driver[];
  selectedSheet?: FuelSheetRecord;
  editingSheetId: string | null;
  editingSheetInput: FuelSheetInput | null;
  editingCalculation: ReturnType<typeof calculateFuelSheet> | null;
  canEditOpeningFuel: boolean;
  canViewSelectedSheet: boolean;
  canEditSelectedSheet: boolean;
  onFilterChange: (filters: SearchFilters) => void;
  onSelectSheet: (id: string) => void;
  onStartEdit: (sheet: FuelSheetRecord) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onEditInputChange: <K extends keyof FuelSheetInput>(key: K, value: FuelSheetInput[K]) => void;
}) {
  return (
    <section className="stack-lg">
      <div className="section-head">
        <div>
          <p className="eyebrow">Журнал</p>
          <h3>Путевки по машинам и водителям</h3>
        </div>
      </div>

      <div className="filter-grid">
        <InputField
          label="Поиск"
          value={props.filters.search}
          onChange={(value) => props.onFilterChange({ ...props.filters, search: value })}
        />
        <SelectField
          label="Машина"
          value={props.filters.vehicleId}
          options={[
            { value: "", label: "Все машины" },
            ...props.vehicles.map((vehicle) => ({
              value: vehicle.id,
              label: `${vehicle.brand} ${vehicle.model} • ${vehicle.plateNumber}`
            }))
          ]}
          onChange={(value) => props.onFilterChange({ ...props.filters, vehicleId: value })}
        />
        <InputField
          label="Период с"
          type="date"
          value={props.filters.periodFrom}
          onChange={(value) => props.onFilterChange({ ...props.filters, periodFrom: value })}
        />
        <InputField
          label="Период по"
          type="date"
          value={props.filters.periodTo}
          onChange={(value) => props.onFilterChange({ ...props.filters, periodTo: value })}
        />
      </div>

      <div className="split-layout">
        <article className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Машина</th>
                <th>Водитель</th>
                <th>Пробег</th>
                <th>Конец топлива</th>
              </tr>
            </thead>
            <tbody>
              {props.fuelSheets.map((sheet) => (
                <tr key={sheet.id} onClick={() => props.onSelectSheet(sheet.id)} className="clickable-row">
                  <td>{sheet.date}</td>
                  <td>
                    {sheet.vehicle.model} • {sheet.vehicle.plateNumber}
                  </td>
                  <td>{sheet.driver.fullName}</td>
                  <td>{formatKm(sheet.calculations.odometerDistance)}</td>
                  <td>{formatLiters(sheet.calculations.closingFuel)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        <article className="panel">
          {!props.selectedSheet ? (
            <p className="muted-copy">Выберите путевку из списка.</p>
          ) : !props.canViewSelectedSheet ? (
            <>
              <div className="section-head compact">
                <div>
                  <p className="eyebrow">Просмотр ограничен</p>
                  <h4>
                    {props.selectedSheet.vehicle.brand} {props.selectedSheet.vehicle.model} •{" "}
                    {props.selectedSheet.vehicle.plateNumber}
                  </h4>
                </div>
                <span className="status-chip light">Недоступно</span>
              </div>

              <div className="summary-list">
                <SummaryRow label="Дата" value={props.selectedSheet.date} />
                <SummaryRow label="Машина" value={`${props.selectedSheet.vehicle.brand} ${props.selectedSheet.vehicle.model}`} />
                <SummaryRow label="Госномер" value={props.selectedSheet.vehicle.plateNumber} />
                <SummaryRow label="Водитель" value={props.selectedSheet.driver.fullName} />
              </div>

              <p className="muted-copy">
                Эту путевку можно видеть в журнале, но открыть подробности и редактировать может
                только тот, кто ее заполнял, или диспетчер.
              </p>
            </>
          ) : (
            <>
              <div className="section-head compact">
                <div>
                  <p className="eyebrow">Детали путевки</p>
                  <h4>
                    {props.selectedSheet.vehicle.brand} {props.selectedSheet.vehicle.model} •{" "}
                    {props.selectedSheet.vehicle.plateNumber}
                  </h4>
                </div>
                <div className="button-row compact-actions">
                  {props.editingSheetId === props.selectedSheet.id ? (
                    <>
                      <button type="button" className="secondary-button" onClick={props.onCancelEdit}>
                        Отмена
                      </button>
                      <button type="button" className="primary-button" onClick={props.onSaveEdit}>
                        Сохранить и пересчитать
                      </button>
                    </>
                  ) : props.canEditSelectedSheet ? (
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => props.onStartEdit(props.selectedSheet!)}
                    >
                      Редактировать
                    </button>
                  ) : (
                    <span className="status-chip light">Только просмотр</span>
                  )}
                </div>
              </div>

              {props.editingSheetId === props.selectedSheet.id && props.editingSheetInput && props.editingCalculation ? (
                <div className="stack-lg">
                  <p className="muted-copy">
                    После сохранения система пересчитает эту и все следующие путевки этой же машины,
                    чтобы топливо и спидометр дальше шли уже без ошибки.
                  </p>

                  <div className="form-grid">
                    <InputField
                      label="Дата"
                      type="date"
                      value={props.editingSheetInput.date}
                      onChange={(value) => props.onEditInputChange("date", value)}
                    />
                    <SelectField
                      label="Водитель"
                      value={props.editingSheetInput.driverId}
                      options={props.drivers.map((driver) => ({
                        value: driver.id,
                        label: driver.fullName
                      }))}
                      onChange={(value) => props.onEditInputChange("driverId", value)}
                    />
                    <div className="field route-field full-span">
                      <span>Маршрут</span>
                      <textarea
                        value={props.editingSheetInput.routeDescription}
                        onChange={(event) => props.onEditInputChange("routeDescription", event.target.value)}
                        rows={4}
                      />
                    </div>
                    <SelectField
                      label="Сезон расчета"
                      value={props.editingSheetInput.seasonMode}
                      options={[
                        { value: "winter", label: "Зимние нормы" },
                        { value: "summer", label: "Летние нормы" },
                        { value: "mixed", label: "Переходный период" }
                      ]}
                      onChange={(value) =>
                        props.onEditInputChange("seasonMode", value as FuelSheetInput["seasonMode"])
                      }
                    />
                    {props.canEditOpeningFuel ? (
                      <NumberField
                        label="Топливо на начало, л"
                        value={props.editingSheetInput.openingFuelLiters}
                        digits={2}
                        onChange={(value) => props.onEditInputChange("openingFuelLiters", value)}
                      />
                    ) : (
                      <InfoField
                        label="Топливо на начало, л"
                        value={formatLiters(props.editingCalculation.availableFuel - props.editingSheetInput.refuelLiters)}
                        helper="Берется автоматически из предыдущей путевки этой машины"
                      />
                    )}
                    <NumberField
                      label="Заправка, л"
                      value={props.editingSheetInput.refuelLiters}
                      digits={2}
                      onChange={(value) => props.onEditInputChange("refuelLiters", value)}
                    />
                    <NumberField
                      label="Пробег по району, км"
                      value={props.editingSheetInput.districtKm}
                      onChange={(value) => props.onEditInputChange("districtKm", value)}
                    />
                    <NumberField
                      label="Пробег по трассе, км"
                      value={props.editingSheetInput.highwayKm}
                      onChange={(value) => props.onEditInputChange("highwayKm", value)}
                    />
                    <NumberField
                      label="Пробег по городу, км"
                      value={props.editingSheetInput.cityKm}
                      onChange={(value) => props.onEditInputChange("cityKm", value)}
                    />
                    <NumberField
                      label="Простой, ч"
                      value={props.editingSheetInput.idleHours}
                      digits={2}
                      onChange={(value) => props.onEditInputChange("idleHours", value)}
                    />
                    {props.editingSheetInput.seasonMode === "mixed" ? (
                      <>
                        <NumberField
                          label="Зимний район, км"
                          value={props.editingSheetInput.winterDistrictKm}
                          onChange={(value) => props.onEditInputChange("winterDistrictKm", value)}
                        />
                        <NumberField
                          label="Летний район, км"
                          value={props.editingSheetInput.summerDistrictKm}
                          onChange={(value) => props.onEditInputChange("summerDistrictKm", value)}
                        />
                        <NumberField
                          label="Зимняя трасса, км"
                          value={props.editingSheetInput.winterHighwayKm}
                          onChange={(value) => props.onEditInputChange("winterHighwayKm", value)}
                        />
                        <NumberField
                          label="Летняя трасса, км"
                          value={props.editingSheetInput.summerHighwayKm}
                          onChange={(value) => props.onEditInputChange("summerHighwayKm", value)}
                        />
                        <NumberField
                          label="Зимний город, км"
                          value={props.editingSheetInput.winterCityKm}
                          onChange={(value) => props.onEditInputChange("winterCityKm", value)}
                        />
                        <NumberField
                          label="Летний город, км"
                          value={props.editingSheetInput.summerCityKm}
                          onChange={(value) => props.onEditInputChange("summerCityKm", value)}
                        />
                        <NumberField
                          label="Зимний простой, ч"
                          value={props.editingSheetInput.winterIdleHours}
                          digits={2}
                          onChange={(value) => props.onEditInputChange("winterIdleHours", value)}
                        />
                        <NumberField
                          label="Летний простой, ч"
                          value={props.editingSheetInput.summerIdleHours}
                          digits={2}
                          onChange={(value) => props.onEditInputChange("summerIdleHours", value)}
                        />
                      </>
                    ) : null}
                  </div>

                  <div className="summary-list">
                    <SummaryRow label="Пересчитанный расход" value={formatLiters(props.editingCalculation.totalFuelConsumption)} />
                    <SummaryRow label="Пересчитанное топливо на конец" value={formatLiters(props.editingCalculation.closingFuel)} emphasized />
                    <SummaryRow label="Пересчитанный пробег" value={formatKm(props.editingCalculation.odometerDistance)} />
                    <SummaryRow label="Маршрут" value={props.editingSheetInput.routeDescription || "Не заполнен"} />
                  </div>
                </div>
              ) : (
                <div className="summary-list">
                  <SummaryRow label="Дата" value={props.selectedSheet.date} />
                  <SummaryRow label="Водитель" value={props.selectedSheet.driver.fullName} />
                  <SummaryRow label="Маршрут" value={props.selectedSheet.routeDescription || "Не заполнен"} />
                  <SummaryRow label="Спидометр на начало" value={formatKm(props.selectedSheet.odometerStart)} />
                  <SummaryRow label="Спидометр на конец" value={formatKm(props.selectedSheet.odometerEnd)} />
                  <SummaryRow label="Топливо на начало" value={formatLiters(props.selectedSheet.openingFuelLiters)} />
                  <SummaryRow label="Заправка" value={formatLiters(props.selectedSheet.refuelLiters)} />
                  <SummaryRow label="Топливо на конец" value={formatLiters(props.selectedSheet.calculations.closingFuel)} />
                  <SummaryRow label="Общий расход" value={formatLiters(props.selectedSheet.calculations.totalFuelConsumption)} />
                </div>
              )}
            </>
          )}
        </article>
      </div>
    </section>
  );
}

function StatBadge(props: { title: string; value: string }) {
  return (
    <div className="stat-badge">
      <span>{props.title}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function EditableNormField(props: {
  label: string;
  value: number;
  digits: number;
  onChange: (value: number) => void;
}) {
  return (
    <LocalizedNumberField
      label={props.label}
      value={props.value}
      digits={props.digits}
      onChange={props.onChange}
    />
  );
}

function InputField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "date";
}) {
  return (
    <label className="field">
      <span>{props.label}</span>
      <input type={props.type ?? "text"} value={props.value} onChange={(event) => props.onChange(event.target.value)} />
    </label>
  );
}

function NumberField(props: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  digits?: number;
}) {
  return (
    <LocalizedNumberField
      label={props.label}
      value={props.value}
      digits={props.digits ?? 0}
      onChange={props.onChange}
    />
  );
}

function LocalizedNumberField(props: {
  label: string;
  value: number;
  digits: number;
  onChange: (value: number) => void;
}) {
  const [text, setText] = useState(formatDecimal(props.value, props.digits));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setText(formatDecimal(props.value, props.digits));
    }
  }, [props.value, props.digits, isFocused]);

  return (
    <label className="field">
      <span>{props.label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={text}
        onFocus={(event) => {
          setIsFocused(true);
          event.target.select();
        }}
        onChange={(event) => {
          const nextText = event.target.value.replace(".", ",");
          setText(nextText);
          const parsed = parseLocalizedNumber(nextText);
          if (parsed !== null) {
            props.onChange(parsed);
          }
        }}
        onBlur={() => {
          setIsFocused(false);
          const parsed = parseLocalizedNumber(text);
          const nextValue = parsed ?? 0;
          props.onChange(nextValue);
          setText(formatDecimal(nextValue, props.digits));
        }}
      />
    </label>
  );
}

function SelectField(props: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{props.label}</span>
      <select value={props.value} onChange={(event) => props.onChange(event.target.value)}>
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function InfoField(props: { label: string; value: string; helper?: string }) {
  return (
    <div className="field readonly-field">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
      {props.helper ? <small>{props.helper}</small> : null}
    </div>
  );
}

function SummaryRow(props: { label: string; value: string; emphasized?: boolean }) {
  return (
    <div className={props.emphasized ? "summary-row emphasized" : "summary-row"}>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function parseLocalizedNumber(value: string): number | null {
  const normalized = value.replace(/\s+/g, "").replace(",", ".");
  if (normalized === "" || normalized === "-" || normalized === ".") {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDecimal(value: number, digits: number): string {
  return value.toFixed(digits).replace(".", ",");
}

function formatOneDecimal(value: number): string {
  return formatDecimal(value, 1);
}

function formatTwoDecimals(value: number): string {
  return formatDecimal(value, 2);
}
