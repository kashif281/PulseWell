import { Global, Module } from '@nestjs/common';
import { GeocodingService } from './geocoding.service';
import { CommuteService } from './commute.service';
import { LocationService } from './location.service';

@Global()
@Module({
  providers: [GeocodingService, CommuteService, LocationService],
  exports: [GeocodingService, CommuteService, LocationService],
})
export class LocationModule {}
