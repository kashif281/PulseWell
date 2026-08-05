'use client';

import Link from 'next/link';
import { CloudRain, Home, Building2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export interface WeatherAlert {
  id: string;
  eligible: boolean;
  reason: string;
  distanceKm?: number | null;
  temperatureC?: number | null;
  response: 'PENDING' | 'ACCEPTED' | 'IGNORED';
  conditions: string[];
}

export function WeatherAlertBanner({ alert }: { alert: WeatherAlert | null; onUpdate?: () => void }) {
  if (!alert) return null;

  if (alert.response === 'PENDING' && alert.eligible) {
    return (
      <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40">
        <div className="flex gap-3 p-4">
          <CloudRain className="mt-0.5 h-6 w-6 shrink-0 text-amber-600" />
          <div>
            <h3 className="font-semibold text-amber-900 dark:text-amber-100">Weather Alert</h3>
            <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
              Today&apos;s weather ({alert.reason}) and your {alert.distanceKm?.toFixed(1) ?? '?'} km commute
              may qualify you for work from home. HR is reviewing who should work from home and who should come
              to the office.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (alert.response === 'ACCEPTED') {
    return (
      <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <Home className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
            <div>
              <h3 className="font-semibold text-emerald-900 dark:text-emerald-100">Work From Home Allowed</h3>
              <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-200">
                HR has allowed you to work from home today. Go to Attendance to check in remotely when you start
                work.
              </p>
            </div>
          </div>
          <Link href="/attendance" className="shrink-0">
            <Button size="sm">Attendance</Button>
          </Link>
        </div>
      </Card>
    );
  }

  if (alert.response === 'IGNORED' && alert.eligible) {
    return (
      <Card className="border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40">
        <div className="flex gap-3 p-4">
          <Building2 className="mt-0.5 h-6 w-6 shrink-0 text-slate-600" />
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Please Come to Office</h3>
            <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
              HR requires you to come to the office today. There may be important on-site work that needs your
              presence.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return null;
}
