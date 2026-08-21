import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../Environments/environments.develompent';

@Injectable({
  providedIn: 'root'
})
export class TokenService {

  constructor(private http: HttpClient) { }

  private getHeaders() {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }

  buyTokens(amount: number, method: string = 'card'): Observable<any> {
    return this.http.post(`${environment.apiUrl}/tokens/buy`, { amount, method }, { headers: this.getHeaders() });
  }

  getBalance(): Observable<any> {
    return this.http.get(`${environment.apiUrl}/tokens/balance`, { headers: this.getHeaders() });
  }

  getHistory(): Observable<any> {
    return this.http.get(`${environment.apiUrl}/tokens/history`, { headers: this.getHeaders() });
  }
}
