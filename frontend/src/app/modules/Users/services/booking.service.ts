  import { Injectable } from '@angular/core';
  import { HttpClient } from '@angular/common/http';
  import { Observable } from 'rxjs';
  import { environment } from '../../../Environments/environments.develompent';

  @Injectable({
    providedIn: 'root'
  })
  export class BookingService {

    constructor(private http: HttpClient) { }

    // الحصول على الأوقات المحجوزة لجهاز معين في يوم معين
    getBookedTimes(machineId: number, date: string): Observable<any> {
      return this.http.get(`${environment.apiUrl}/machine/${machineId}/booked-times?date=${date}`);
    }

    // تنفيذ عملية الحجز
    bookMachine(data: { machineId: number, bookingDate: string, startTime: string, durationMinutes: number }): Observable<any> {
      return this.http.post(`${environment.apiUrl}/machine/book`, data);
    }

    getMachines(): Observable<any> {
      return this.http.get(`${environment.apiUrl}/machine`);
    }

    getMyBookings(): Observable<any> {
      return this.http.get(`${environment.apiUrl}/machine/bookings`);
    }

    cancelBooking(bookingId: number): Observable<any> {
      const token = localStorage.getItem('token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : undefined;
      return this.http.delete(`${environment.apiUrl}/machine/cancel`, {
        headers,
        body: { bookingId }
      });
    }
  }
