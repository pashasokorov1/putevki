const defaultState = {
  vehicles: [
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
      normHistory: []
    }
  ],
  drivers: [
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
    }
  ],
  fuelSheets: []
};

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return { url, serviceRoleKey };
}

async function supabaseRequest(path, init = {}) {
  const config = getSupabaseConfig();
  if (!config) {
    return null;
  }

  const response = await fetch(`${config.url}${path}`, {
    ...init,
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {})
    }
  });

  return response;
}

async function seedState() {
  const response = await supabaseRequest("/rest/v1/app_state", {
    method: "POST",
    headers: {
      Prefer: "return=representation,resolution=merge-duplicates"
    },
    body: JSON.stringify([
      {
        id: "primary",
        payload: defaultState
      }
    ])
  });

  if (!response?.ok) {
    throw new Error("Failed to seed app state");
  }

  const [row] = await response.json();
  return row?.payload ?? defaultState;
}

export async function loadState() {
  const config = getSupabaseConfig();
  if (!config) {
    return {
      payload: defaultState,
      mode: "fallback"
    };
  }

  const response = await supabaseRequest("/rest/v1/app_state?id=eq.primary&select=payload");
  if (!response?.ok) {
    const text = response ? await response.text() : "Supabase is not configured";
    throw new Error(text);
  }

  const rows = await response.json();
  if (!rows.length) {
    return {
      payload: await seedState(),
      mode: "remote"
    };
  }

  return {
    payload: rows[0].payload ?? defaultState,
    mode: "remote"
  };
}

export async function saveState(payload) {
  const config = getSupabaseConfig();
  if (!config) {
    return {
      payload,
      mode: "fallback"
    };
  }

  const response = await supabaseRequest("/rest/v1/app_state", {
    method: "POST",
    headers: {
      Prefer: "return=representation,resolution=merge-duplicates"
    },
    body: JSON.stringify([
      {
        id: "primary",
        payload
      }
    ])
  });

  if (!response?.ok) {
    const text = await response.text();
    throw new Error(text);
  }

  const [row] = await response.json();
  return {
    payload: row?.payload ?? payload,
    mode: "remote"
  };
}
