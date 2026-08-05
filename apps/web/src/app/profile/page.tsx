'use client';

import { useEffect, useState } from 'react';
import { ProtectedLayout } from '@/components/layout/protected-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { useGeolocation } from '@/hooks/use-geolocation';
import { MapPin, Star } from 'lucide-react';
import Link from 'next/link';

interface EmployeeSkill {
  id: string;
  rating: number;
  skill: { name: string; category: string };
}

interface EmployeeProfile {
  position?: string;
  address?: string;
  city?: string;
  homeCountry?: string;
  commuteDistanceKm?: number;
  commuteDurationMin?: number;
  latitude?: number;
  longitude?: number;
  emergencyContact?: string;
  emergencyPhone?: string;
  user?: { firstName?: string; lastName?: string; email?: string };
  department?: { name: string };
}

const EMPTY_PROFILE_FORM = {
  firstName: '',
  lastName: '',
  position: '',
  emergencyContact: '',
  emergencyPhone: '',
  address: '',
  city: '',
  homeCountry: '',
};

export default function ProfilePage() {
  const { token } = useAuth();
  const { locate, loading: locating } = useGeolocation();
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [skills, setSkills] = useState<EmployeeSkill[]>([]);
  const [form, setForm] = useState(EMPTY_PROFILE_FORM);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const loadProfile = async () => {
    if (!token) return;
    const [res, skillsRes] = await Promise.all([
      api<EmployeeProfile>('/employees/me', { token }),
      api<EmployeeSkill[]>('/learning/skills/me', { token }),
    ]);
    const p = res.data;
    if (p) {
      setProfile(p);
      setForm({
        firstName: p.user?.firstName ?? '',
        lastName: p.user?.lastName ?? '',
        position: p.position ?? '',
        emergencyContact: p.emergencyContact ?? '',
        emergencyPhone: p.emergencyPhone ?? '',
        address: p.address ?? '',
        city: p.city ?? '',
        homeCountry: p.homeCountry ?? '',
      });
    }
    setSkills(skillsRes.data ?? []);
  };

  useEffect(() => {
    loadProfile().catch(console.error);
  }, [token]);

  const handleUseMyLocation = async () => {
    if (!token) return;
    setMessage('');
    try {
      const { latitude, longitude } = await locate();
      const res = await api<EmployeeProfile>('/employees/me/location', {
        method: 'POST',
        token,
        body: JSON.stringify({ latitude, longitude }),
      });
      const p = res.data;
      if (p) {
        setProfile(p);
        setForm((prev) => ({
          ...prev,
          address: p.address ?? prev.address,
          city: p.city ?? prev.city,
          homeCountry: p.homeCountry ?? prev.homeCountry,
        }));
      }
      setMessage('Location updated from GPS');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not get location');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setMessage('');
    try {
      await api('/employees/me', {
        method: 'PUT',
        token,
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          position: form.position || undefined,
          emergencyContact: form.emergencyContact || undefined,
          emergencyPhone: form.emergencyPhone || undefined,
          address: form.address || undefined,
          city: form.city || undefined,
          homeCountry: form.homeCountry || undefined,
        }),
      });
      setMessage('Profile updated successfully');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedLayout>
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
          <p className="text-slate-500">Manage your work profile and personal information</p>
        </div>

        <Card title="Skills & Learning">
          {skills.length === 0 ? (
            <p className="text-sm text-slate-500">
              No skills rated yet.{' '}
              <Link href="/learning/skills" className="text-indigo-600 hover:underline">
                Rate your skills
              </Link>{' '}
              to get personalized tutoring.
            </p>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {skills.slice(0, 8).map((es) => (
                  <span
                    key={es.id}
                    className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-xs text-indigo-800"
                  >
                    {es.skill.name}
                    <span className="flex text-amber-400">
                      {Array.from({ length: es.rating }).map((_, i) => (
                        <Star key={i} className="h-3 w-3 fill-current" />
                      ))}
                    </span>
                  </span>
                ))}
              </div>
              <Link href="/learning/skills" className="text-xs text-indigo-600 hover:underline">
                View full skills matrix →
              </Link>
            </div>
          )}
        </Card>

        <form onSubmit={handleSave}>
          <Card title="Personal Information">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input id="firstName" label="First name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                <Input id="lastName" label="Last name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              </div>
              <Input id="email" label="Email" value={profile?.user?.email ?? ''} disabled />
              <Input id="position" label="Position" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
              {profile?.department && (
                <Input id="department" label="Department" value={profile.department.name} disabled />
              )}
            </div>
          </Card>

          <Card title="Home address" className="mt-6">
            <p className="mb-4 text-sm text-slate-500">Used for weather-based WFH commute calculations</p>
            <div className="space-y-4">
              <Button type="button" variant="outline" isLoading={locating} onClick={handleUseMyLocation}>
                <MapPin className="mr-2 h-4 w-4" />
                Use my current location
              </Button>
              <Input id="address" label="Street address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              <div className="grid grid-cols-2 gap-4">
                <Input id="city" label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                <Input id="homeCountry" label="Country" value={form.homeCountry} onChange={(e) => setForm({ ...form, homeCountry: e.target.value })} />
              </div>
              {(profile?.commuteDistanceKm != null || profile?.commuteDurationMin != null) && (
                <p className="text-sm text-slate-600">
                  Commute: {profile.commuteDistanceKm?.toFixed(1) ?? '—'} km · ~{profile.commuteDurationMin ?? '—'} min
                </p>
              )}
              {profile?.latitude != null && profile?.longitude != null && (
                <p className="text-xs text-slate-500">
                  GPS: {profile.latitude.toFixed(5)}, {profile.longitude.toFixed(5)}
                </p>
              )}
            </div>
          </Card>

          <Card title="Emergency Contact" className="mt-6">
            <div className="space-y-4">
              <Input id="emergencyContact" label="Contact name" value={form.emergencyContact} onChange={(e) => setForm({ ...form, emergencyContact: e.target.value })} />
              <Input id="emergencyPhone" label="Phone" value={form.emergencyPhone} onChange={(e) => setForm({ ...form, emergencyPhone: e.target.value })} />
            </div>
          </Card>

          {message && (
            <div className={`mt-4 rounded-lg px-4 py-3 text-sm ${message.includes('success') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
              {message}
            </div>
          )}

          <Button type="submit" className="mt-6" isLoading={saving}>
            Save Profile
          </Button>
        </form>
      </div>
    </ProtectedLayout>
  );
}
