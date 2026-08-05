'use client';

import { useCallback, useEffect, useState } from 'react';
import { ProtectedLayout } from '@/components/layout/protected-layout';
import { Card, StatCard } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CompanyFilter } from '@/components/admin/company-filter';
import { useAdminCompanyScope } from '@/hooks/use-admin-company-scope';
import { useGeolocation } from '@/hooks/use-geolocation';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/contexts/toast-context';
import { CloudRain, RefreshCw, Settings, Thermometer, Wind, Droplets, MapPin, Check, X } from 'lucide-react';

interface WeatherSettings {
  enabled: boolean;
  checkHour: number;
  minDistanceKm: number;
  heatThresholdC: number;
  coldThresholdC: number;
  rainEnabled: boolean;
  windThresholdKmh: number;
  floodAlertsEnabled: boolean;
  govAdvisoryOverride: boolean;
  autoApproveWfh: boolean;
  requireManagerApproval: boolean;
}

interface CurrentWeather {
  available: boolean;
  dataSource?: 'live' | 'cached' | 'unavailable';
  reason?: string | null;
  office?: {
    address?: string | null;
    city?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  };
  weather?: {
    temperatureC: number;
    feelsLikeC?: number;
    humidity?: number;
    windSpeedKmh: number;
    description: string;
    main: string;
    icon?: string;
    rain1hMm?: number;
    conditions: string[];
    fetchedAt?: string;
  } | null;
  stats?: {
    employeesWithCommuteData: number;
    employeesAboveMinDistance: number;
    minDistanceKm: number;
  };
}

interface DashboardData {
  date: string;
  currentWeather?: CurrentWeather;
  eligible: number;
  notEligible?: number;
  evaluated?: number;
  accepted: number;
  ignored: number;
  pending: number;
  recommendation: string | null;
  alerts: Array<AlertRow>;
  allAlerts?: Array<AlertRow>;
}

interface AlertRow {
  id: string;
  eligible: boolean;
  reason: string;
  response: string;
  distanceKm?: number;
  employee: {
    user: { firstName: string; lastName: string; email: string };
    department?: { name: string } | null;
  };
}

export default function AdminWeatherPage() {
  const { token } = useAuth();
  const toast = useToast();
  const { companyId, companyQuery, companies, setCompanyId } = useAdminCompanyScope();
  const { locate, loading: locatingOffice } = useGeolocation();
  const [settings, setSettings] = useState<WeatherSettings | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showOffice, setShowOffice] = useState(false);
  const [savingOffice, setSavingOffice] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [officeForm, setOfficeForm] = useState({
    officeAddress: 'Matti Spaces, Nawab Town, Lahore',
    officeCity: 'Lahore',
    country: 'Pakistan',
  });

  const load = useCallback(async () => {
    if (!token || !companyId) return;
    const q = companyQuery;
    const [sRes, dRes] = await Promise.all([
      api<WeatherSettings>(`/weather/settings${q}`, { token }),
      api<DashboardData>(`/weather/dashboard${q}`, { token }),
    ]);
    setSettings(sRes.data ?? null);
    setDashboard(dRes.data ?? null);
    const office = dRes.data?.currentWeather?.office;
    if (office?.address || office?.city) {
      setOfficeForm((prev) => ({
        officeAddress: office.address ?? prev.officeAddress,
        officeCity: office.city ?? prev.officeCity,
        country: prev.country,
      }));
    }
  }, [token, companyId, companyQuery]);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  const saveSettings = async () => {
    if (!token || !settings) return;
    setSaving(true);
    try {
      await api(`/weather/settings${companyQuery}`, {
        method: 'PUT',
        token,
        body: JSON.stringify(settings),
      });
      toast.success('Weather settings saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const saveOffice = async () => {
    if (!token) return;
    setSavingOffice(true);
    try {
      await api(`/company/settings${companyQuery}`, {
        method: 'PUT',
        token,
        body: JSON.stringify({
          officeAddress: officeForm.officeAddress,
          officeCity: officeForm.officeCity,
          country: officeForm.country,
          timezone: 'Asia/Karachi',
        }),
      });
      toast.success('Office location updated — weather will use new coordinates');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update office');
    } finally {
      setSavingOffice(false);
    }
  };

  const useOfficeGps = async () => {
    if (!token) return;
    try {
      const { latitude, longitude } = await locate();
      await api(`/company/settings${companyQuery}`, {
        method: 'PUT',
        token,
        body: JSON.stringify({
          officeLatitude: latitude,
          officeLongitude: longitude,
          country: 'Pakistan',
          timezone: 'Asia/Karachi',
        }),
      });
      toast.success('Office set from your current GPS location');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not get location');
    }
  };

  const runCheck = async () => {
    if (!token) return;
    setRunning(true);
    try {
      const res = await api<{
        processed: number;
        eligible: number;
        notEligible: number;
        weather?: { description: string; temperatureC: number };
        skipped?: boolean;
        reason?: string;
      }>(`/weather/run-check${companyQuery}`, { method: 'POST', token });
      const d = res.data;
      if (d?.skipped) {
        toast.error(d.reason ?? 'Weather check skipped');
      } else if (d) {
        const w = d.weather;
        toast.success(
          `Live check: ${d.eligible} eligible, ${d.notEligible} not eligible` +
            (w ? ` — ${w.description}, ${w.temperatureC}°C` : ''),
        );
      } else {
        toast.success('Weather check completed');
      }
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Check failed');
    } finally {
      setRunning(false);
    }
  };

  const allowWfh = async (alertId: string) => {
    if (!token) return;
    setApprovingId(alertId);
    try {
      await api(`/weather/alerts/${alertId}/approve${companyQuery}`, { method: 'POST', token });
      toast.success('Work from home allowed for employee');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setApprovingId(null);
    }
  };

  const denyWfh = async (alertId: string) => {
    if (!token) return;
    setApprovingId(alertId);
    try {
      await api(`/weather/alerts/${alertId}/revoke${companyQuery}`, { method: 'POST', token });
      toast.success('Employee marked to come to office');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setApprovingId(null);
    }
  };

  const tableAlerts = dashboard?.allAlerts?.length ? dashboard.allAlerts : dashboard?.alerts ?? [];

  const hrDecisionLabel = (response: string) => {
    if (response === 'ACCEPTED') return 'Allowed WFH';
    if (response === 'IGNORED') return 'Not allowed';
    return 'Awaiting HR';
  };

  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Weather WFH</h1>
            <p className="text-[var(--muted)]">Smart work-from-home decisions based on weather & commute</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <CompanyFilter companies={companies} companyId={companyId} onChange={setCompanyId} />
            <Button variant="outline" onClick={() => setShowOffice((v) => !v)}>
              <MapPin className="mr-2 h-4 w-4" />
              Office location
            </Button>
            <Button variant="outline" onClick={() => setShowSettings((v) => !v)}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
            <Button variant="outline" isLoading={running} onClick={runCheck}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Run check now
            </Button>
          </div>
        </div>

        {showOffice && (
          <Card>
            <h2 className="mb-1 font-semibold">Office location</h2>
            <p className="mb-4 text-sm text-[var(--muted)]">
              Weather is fetched for this address. Commute distances are recalculated when you save.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Office address"
                value={officeForm.officeAddress}
                onChange={(e) => setOfficeForm({ ...officeForm, officeAddress: e.target.value })}
              />
              <Input
                label="City"
                value={officeForm.officeCity}
                onChange={(e) => setOfficeForm({ ...officeForm, officeCity: e.target.value })}
              />
            </div>
            {dashboard?.currentWeather?.office?.latitude != null && (
              <p className="mt-2 text-xs text-[var(--muted)]">
                Coordinates: {dashboard.currentWeather.office.latitude?.toFixed(4)},{' '}
                {dashboard.currentWeather.office.longitude?.toFixed(4)}
              </p>
            )}
            <Button className="mt-4" isLoading={savingOffice} onClick={saveOffice}>
              Save office location
            </Button>
            <Button
              type="button"
              variant="outline"
              className="mt-4 ml-2"
              isLoading={locatingOffice}
              onClick={useOfficeGps}
            >
              <MapPin className="mr-2 h-4 w-4" />
              Use my current location
            </Button>
          </Card>
        )}

        {dashboard?.currentWeather && (
          <Card>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4">
                {dashboard.currentWeather.weather?.icon ? (
                  <img
                    src={`https://openweathermap.org/img/wn/${dashboard.currentWeather.weather.icon}@2x.png`}
                    alt=""
                    className="h-16 w-16"
                  />
                ) : (
                  <CloudRain className="h-12 w-12 text-sky-500" />
                )}
                <div>
                  <p className="text-sm font-medium text-[var(--muted)]">Office location — live weather</p>
                  <h2 className="text-2xl font-bold capitalize text-[var(--foreground)]">
                    {dashboard.currentWeather.weather?.description ?? 'Unavailable'}
                  </h2>
                  <p className="mt-1 flex items-center gap-1 text-sm text-[var(--muted)]">
                    <MapPin className="h-4 w-4" />
                    {dashboard.currentWeather.office?.address ?? dashboard.currentWeather.office?.city ?? 'Office'}
                  </p>
                  {dashboard.currentWeather.weather?.fetchedAt && (
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {dashboard.currentWeather.dataSource === 'cached' ? 'Cached · ' : 'Live · '}
                      Updated {new Date(dashboard.currentWeather.weather.fetchedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>

              {dashboard.currentWeather.available && dashboard.currentWeather.weather ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="rounded-lg bg-slate-50 px-4 py-3 dark:bg-slate-800">
                    <p className="flex items-center gap-1 text-xs text-[var(--muted)]">
                      <Thermometer className="h-3 w-3" /> Temp
                    </p>
                    <p className="text-xl font-semibold">{dashboard.currentWeather.weather.temperatureC}°C</p>
                    {dashboard.currentWeather.weather.feelsLikeC != null && (
                      <p className="text-xs text-[var(--muted)]">Feels {dashboard.currentWeather.weather.feelsLikeC}°C</p>
                    )}
                  </div>
                  <div className="rounded-lg bg-slate-50 px-4 py-3 dark:bg-slate-800">
                    <p className="flex items-center gap-1 text-xs text-[var(--muted)]">
                      <Wind className="h-3 w-3" /> Wind
                    </p>
                    <p className="text-xl font-semibold">{dashboard.currentWeather.weather.windSpeedKmh} km/h</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-4 py-3 dark:bg-slate-800">
                    <p className="flex items-center gap-1 text-xs text-[var(--muted)]">
                      <Droplets className="h-3 w-3" /> Humidity
                    </p>
                    <p className="text-xl font-semibold">{dashboard.currentWeather.weather.humidity ?? '—'}%</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-4 py-3 dark:bg-slate-800">
                    <p className="text-xs text-[var(--muted)]">Long commuters</p>
                    <p className="text-xl font-semibold">
                      {dashboard.currentWeather.stats?.employeesAboveMinDistance ?? 0}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      ≥ {dashboard.currentWeather.stats?.minDistanceKm ?? 20} km
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-amber-600">{dashboard.currentWeather.reason}</p>
              )}
            </div>

            {dashboard.currentWeather.weather?.conditions?.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {dashboard.currentWeather.weather.conditions.map((c) => (
                  <span
                    key={c}
                    className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                  >
                    {c.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            ) : dashboard.currentWeather.available ? (
              <p className="mt-4 text-sm text-[var(--muted)]">No severe weather conditions detected at the office right now.</p>
            ) : null}
          </Card>
        )}

        {showSettings && settings && (
          <Card>
            <h2 className="mb-4 font-semibold">Weather settings</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={settings.enabled}
                  onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                />
                Enabled
              </label>
              <label className="text-sm">
                Check hour (local)
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={settings.checkHour}
                  onChange={(e) => setSettings({ ...settings, checkHour: +e.target.value })}
                />
              </label>
              <label className="text-sm">
                Min distance (km)
                <Input
                  type="number"
                  value={settings.minDistanceKm}
                  onChange={(e) => setSettings({ ...settings, minDistanceKm: +e.target.value })}
                />
              </label>
              <label className="text-sm">
                Heat threshold (°C)
                <Input
                  type="number"
                  value={settings.heatThresholdC}
                  onChange={(e) => setSettings({ ...settings, heatThresholdC: +e.target.value })}
                />
              </label>
              <label className="text-sm">
                Cold threshold (°C)
                <Input
                  type="number"
                  value={settings.coldThresholdC}
                  onChange={(e) => setSettings({ ...settings, coldThresholdC: +e.target.value })}
                />
              </label>
              <label className="text-sm">
                Wind threshold (km/h)
                <Input
                  type="number"
                  value={settings.windThresholdKmh}
                  onChange={(e) => setSettings({ ...settings, windThresholdKmh: +e.target.value })}
                />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              {(
                [
                  ['rainEnabled', 'Rain alerts'],
                  ['floodAlertsEnabled', 'Flood alerts'],
                  ['govAdvisoryOverride', 'Gov advisory override'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings[key]}
                    onChange={(e) => setSettings({ ...settings, [key]: e.target.checked })}
                  />
                  {label}
                </label>
              ))}
            </div>
            <p className="mt-3 text-xs text-[var(--muted)]">
              WFH is always decided manually by HR per employee — no auto-approve or auto check-in.
            </p>
            <Button className="mt-4" isLoading={saving} onClick={saveSettings}>
              Save settings
            </Button>
          </Card>
        )}

        {dashboard?.recommendation && (
          <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/30">
            <div className="flex gap-3 p-4">
              <CloudRain className="h-5 w-5 text-emerald-600" />
              <div>
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">AI recommendation</p>
                <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">{dashboard.recommendation}</p>
              </div>
            </div>
          </Card>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard title="Weather eligible" value={dashboard?.eligible ?? 0} icon={<CloudRain className="h-5 w-5" />} />
          <StatCard title="Not weather eligible" value={dashboard?.notEligible ?? 0} />
          <StatCard title="Allowed WFH" value={dashboard?.accepted ?? 0} />
          <StatCard title="Not allowed" value={dashboard?.ignored ?? 0} />
          <StatCard title="Awaiting HR" value={dashboard?.pending ?? 0} />
        </div>

        <Card>
          <div className="mb-4">
            <h2 className="font-semibold">Today&apos;s employee list</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Weather suggests who could work from home — you decide per person. Allow WFH for those who should
              stay home; Not allow for those with important on-site work. You can also allow WFH for others who
              are not weather-eligible but need to stay home.
            </p>
          </div>
          <p className="mb-4 text-sm text-[var(--muted)]">
            Run check uses live OpenWeather data. Employees only qualify when severe weather matches your rules
            (rain, heat, cold, wind, etc.) and commute is above the minimum distance.
          </p>
          {tableAlerts.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-[var(--muted)]">
                    <th className="pb-2">Employee</th>
                    <th className="pb-2">Department</th>
                    <th className="pb-2">Distance</th>
                    <th className="pb-2">Eligible</th>
                    <th className="pb-2">Reason</th>
                    <th className="pb-2">HR decision</th>
                    <th className="pb-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tableAlerts.map((a) => (
                    <tr key={a.id} className="border-b border-[var(--card-border)]">
                      <td className="py-2">
                        {a.employee.user.firstName} {a.employee.user.lastName}
                      </td>
                      <td className="py-2">{a.employee.department?.name ?? '—'}</td>
                      <td className="py-2">{a.distanceKm?.toFixed(1) ?? '—'} km</td>
                      <td className="py-2">
                        <span
                          className={
                            a.eligible
                              ? 'rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800'
                              : 'rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600'
                          }
                        >
                          {a.eligible ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="py-2">{a.reason}</td>
                      <td className="py-2">
                        <span
                          className={
                            a.response === 'ACCEPTED'
                              ? 'text-xs font-medium text-emerald-700'
                              : a.response === 'IGNORED'
                                ? 'text-xs font-medium text-slate-600'
                                : 'text-xs text-amber-700'
                          }
                        >
                          {hrDecisionLabel(a.response)}
                        </span>
                      </td>
                      <td className="py-2">
                        {a.response === 'PENDING' ? (
                          <div className="flex flex-wrap gap-1">
                            <Button
                              size="sm"
                              isLoading={approvingId === a.id}
                              onClick={() => allowWfh(a.id)}
                            >
                              <Check className="mr-1 h-3 w-3" />
                              Allow work from home
                            </Button>
                            {a.eligible && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={approvingId === a.id}
                                onClick={() => denyWfh(a.id)}
                              >
                                <X className="mr-1 h-3 w-3" />
                                Not allow
                              </Button>
                            )}
                          </div>
                        ) : a.response === 'ACCEPTED' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={approvingId === a.id}
                            onClick={() => denyWfh(a.id)}
                          >
                            Change to not allow
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={approvingId === a.id}
                            onClick={() => allowWfh(a.id)}
                          >
                            Change to allow WFH
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              No evaluations yet. Click Run check now to evaluate employees against live weather.
            </p>
          )}
        </Card>
      </div>
    </ProtectedLayout>
  );
}
