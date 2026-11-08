import { get, writable } from 'svelte/store';
export interface Profile {
  id: string;
  name: string;
}
export interface Settings {
  distance_unit: string;
  fuel_unit: string;
  currency: string;
  timezone: string;
}
export interface Vehicle {
  id: string;
  name: string;
  kind: string;
  fuel_type: string;
  owner_id: string;
  members: string[];
  ownership_start: string;
  ownership_end: string;
  initial_odometer_m: number | null;
}
export interface Entry {
  currency?: string;
  id: string;
  vehicle_id: string;
  payer_id: string;
  kind: string;
  date: string;
  odometer_m: number | null;
  distance_m: number | null;
  volume_ml: number | null;
  amount_minor: number | null;
  tank: string;
  gap: boolean;
  category: string;
  description: string;
  station: string;
  fuel_type: string;
  notes: string;
  schedule_id?: string;
  extra?: Record<string, string>;
}
export interface Schedule {
  id: string;
  template: Entry;
  first: string;
  end: string;
  months: number;
  active: boolean;
}
export interface Attachment {
  id: string;
  entry_id: string;
  purpose: string;
  filename: string;
  media_type: string;
  bytes: number;
  hash: string;
  has_thumbnail: boolean;
}
export interface FuelStats {
  consumption: string;
  fuel_cost_per_km: string;
  total_distance_m: number;
  matched_distance_m: number;
  priced_distance_m: number;
  warnings: string[];
  distances: { date: string; metres: number }[];
}
export interface Summary {
  fuel: FuelStats;
  total_minor: number;
  fuel_minor: number;
  upkeep_minor: number;
  upkeep_monthly: string;
  monthly_fuel: Record<string, number>;
  annual_distance: Record<string, number>;
  annual_mode: string;
  first_distance_date: string;
}
export interface AppData {
  state: {
    settings: Settings;
    profiles: Profile[];
    vehicles: Vehicle[];
    records: Entry[];
    schedules: Schedule[];
    attachments: Attachment[];
  };
  profile_id: string;
  stats: Record<string, Summary>;
}
export const data = writable<AppData | null>(null);
export const selectedVehicle = writable('');
export const appError = writable('');
let profile = '';
export async function request<T>(
  path: string,
  method = 'GET',
  body?: unknown
): Promise<T> {
  const headers: Record<string, string> = { 'X-Roadbook-Request': '1' };
  if (profile) headers['X-Roadbook-Profile'] = profile;
  if (body !== undefined && !(body instanceof FormData))
    headers['Content-Type'] = 'application/json';
  const r = await fetch('/api' + path, {
    method,
    headers,
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body)
  });
  const content = await r.json();
  if (!r.ok) throw new Error(content.error || `Request failed (${r.status})`);
  return content;
}
export async function reload(nextProfile?: string) {
  if (nextProfile !== undefined) profile = nextProfile;
  else if (!profile) profile = localStorage.getItem('roadbook-profile') || '';
  try {
    const result = await request<AppData>('/state');
    profile = result.profile_id;
    localStorage.setItem('roadbook-profile', profile);
    data.set(result);
    const v =
      get(selectedVehicle) || localStorage.getItem('roadbook-vehicle') || '';
    selectedVehicle.set(
      result.state.vehicles.some((x) => x.id === v)
        ? v
        : result.state.vehicles[0]?.id || ''
    );
    appError.set('');
  } catch (e) {
    appError.set(message(e));
    throw e;
  }
}
export function chooseVehicle(id: string) {
  selectedVehicle.set(id);
  localStorage.setItem('roadbook-vehicle', id);
}
export function message(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}
export function blank(kind = 'fuel'): Entry {
  const state = get(data);
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: state?.state.settings.timezone || 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
  return {
    currency: state?.state.settings.currency,
    id: '',
    vehicle_id: get(selectedVehicle) || state?.state.vehicles[0]?.id || '',
    payer_id: state?.profile_id || '',
    kind,
    date,
    odometer_m: null,
    distance_m: null,
    volume_ml: null,
    amount_minor: null,
    tank: 'unknown',
    gap: false,
    category: 'repair',
    description: '',
    station: '',
    fuel_type: '',
    notes: ''
  };
}
