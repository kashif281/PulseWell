import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.module';
import { GeocodingService } from './geocoding.service';
import { CommuteService } from './commute.service';

@Injectable()
export class LocationService {
  constructor(
    private prisma: PrismaService,
    private geocoding: GeocodingService,
    private commute: CommuteService,
  ) {}

  async updateEmployeeFromCoordinates(employeeId: string, latitude: number, longitude: number) {
    const geo = await this.geocoding.reverseGeocode(latitude, longitude);

    const employee = await this.prisma.employee.update({
      where: { id: employeeId },
      data: {
        latitude,
        longitude,
        address: geo?.displayName ?? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
        city: geo?.city ?? undefined,
        homeCountry: geo?.country ?? undefined,
      },
      include: { company: true },
    });

    await this.refreshEmployeeCommute(employee.id);
    return employee;
  }

  async updateCompanyOfficeFromCoordinates(companyId: string, latitude: number, longitude: number) {
    const geo = await this.geocoding.reverseGeocode(latitude, longitude);

    const company = await this.prisma.company.update({
      where: { id: companyId },
      data: {
        officeLatitude: latitude,
        officeLongitude: longitude,
        officeAddress: geo?.displayName ?? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
        officeCity: geo?.city ?? undefined,
      },
    });

    await this.refreshCompanyCommutes(companyId);
    return company;
  }

  async geocodeAndUpdateEmployee(
    employeeId: string,
    address?: string | null,
    city?: string | null,
    homeCountry?: string | null,
  ) {
    if (!address?.trim()) return null;

    const geo = await this.geocoding.geocodeAddress(address, city ?? undefined, homeCountry ?? undefined);
    if (!geo) return null;

    const employee = await this.prisma.employee.update({
      where: { id: employeeId },
      data: {
        address,
        city: city ?? geo.city,
        homeCountry: homeCountry ?? geo.country,
        latitude: geo.latitude,
        longitude: geo.longitude,
      },
      include: { company: true },
    });

    await this.refreshEmployeeCommute(employee.id);
    return employee;
  }

  async geocodeAndUpdateCompanyOffice(
    companyId: string,
    officeAddress?: string | null,
    officeCity?: string | null,
    country?: string | null,
  ) {
    if (!officeAddress?.trim()) return null;

    const geo = await this.geocoding.geocodeAddress(
      officeAddress,
      officeCity ?? undefined,
      country ?? undefined,
    );
    if (!geo) return null;

    const company = await this.prisma.company.update({
      where: { id: companyId },
      data: {
        officeAddress,
        officeCity: officeCity ?? geo.city,
        officeLatitude: geo.latitude,
        officeLongitude: geo.longitude,
      },
    });

    await this.refreshCompanyCommutes(companyId);
    return company;
  }

  async refreshEmployeeCommute(employeeId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: { company: { select: { officeLatitude: true, officeLongitude: true } } },
    });
    if (!employee?.latitude || !employee.longitude) return null;
    if (!employee.company.officeLatitude || !employee.company.officeLongitude) return null;

    const result = await this.commute.calculateCommute(
      employee.latitude,
      employee.longitude,
      employee.company.officeLatitude,
      employee.company.officeLongitude,
    );
    if (!result) return null;

    return this.prisma.employee.update({
      where: { id: employeeId },
      data: {
        commuteDistanceKm: result.distanceKm,
        commuteDurationMin: result.durationMin,
      },
    });
  }

  async refreshCompanyCommutes(companyId: string) {
    const employees = await this.prisma.employee.findMany({
      where: { companyId, latitude: { not: null }, longitude: { not: null } },
      select: { id: true },
    });

    for (const emp of employees) {
      await this.refreshEmployeeCommute(emp.id);
    }
  }
}
