import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export type AttendanceStreamEvent = {
  type: 'attendance' | 'activity';
  companyId: string;
  payload: unknown;
};

@Injectable()
export class AttendanceEventsService {
  private streams = new Map<string, Subject<AttendanceStreamEvent>>();

  subscribe(companyId: string): Observable<{ data: AttendanceStreamEvent }> {
    if (!this.streams.has(companyId)) {
      this.streams.set(companyId, new Subject<AttendanceStreamEvent>());
    }
    return this.streams.get(companyId)!.asObservable().pipe(
      map((payload) => ({ data: payload })),
    );
  }

  publish(companyId: string, event: AttendanceStreamEvent) {
    const subject = this.streams.get(companyId);
    if (subject) {
      subject.next(event);
    }
  }
}
