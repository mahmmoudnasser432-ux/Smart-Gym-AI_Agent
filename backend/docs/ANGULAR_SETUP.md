# Angular Remote Connection Guide

## Current Backend Address

This backend machine can be reached on the local network at:

`http://192.168.100.70:5000`

This IP was detected from the backend machine Wi-Fi adapter.

If the backend machine changes network or restarts on a different IP, check the new IP and update Angular.

## What Was Changed On Backend

1. Removed Angular starter files from this backend machine because this machine is backend-only.
2. Updated backend CORS to:

`CORS_ORIGIN=*`

This allows Angular from another device to call the backend during development.

## Backend Start

Run on the backend machine:

```powershell
npm.cmd start
```

The backend will be available at:

`http://192.168.100.70:5000`

Health check:

`http://192.168.100.70:5000/health`

Swagger:

`http://192.168.100.70:5000/api/docs`

## Angular Machine Changes

On the Angular machine, use this API base URL:

`http://192.168.100.70:5000/api`

## Angular Login Example

Use:

`POST http://192.168.100.70:5000/api/auth/login`

Request body:

```json
{
  "email": "user@example.com",
  "password": "Pass123!",
  "role": "user"
}
```

Expected response:

```json
{
  "status": "success",
  "data": {
    "user": {
      "id": 1,
      "username": "Mostafa",
      "email": "user@example.com",
      "phone": "01000000000",
      "role": "user",
      "status": "active",
      "createdAt": "2026-03-12T10:00:00.000Z"
    },
    "token": "JWT_TOKEN_HERE"
  }
}
```

## Angular Auth Service Example

```ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private apiUrl = 'http://192.168.100.70:5000/api';

  login(payload: { email: string; password: string; role: 'user' | 'coach' | 'admin' }) {
    return this.http.post<any>(`${this.apiUrl}/auth/login`, payload).pipe(
      tap((response) => {
        localStorage.setItem('smartgym_token', response.data.token);
        localStorage.setItem('smartgym_user', JSON.stringify(response.data.user));
      })
    );
  }
}
```

## Angular HTTP Interceptor Example

```ts
import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('smartgym_token');

  if (token) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(req);
};
```

## Angular Protected Profile Test

After login, call:

`GET http://192.168.100.70:5000/api/auth/profile`

Header:

`Authorization: Bearer <token>`

## If Angular Cannot Reach Backend

Check these in order:

1. Backend machine and Angular machine must be on the same network.
2. Open this in Angular machine browser:
   - `http://192.168.100.70:5000/health`
3. If it does not open, Windows Firewall is probably blocking port `5000`.
4. Keep backend running while testing.

## Recommended Test Order

1. Start backend on backend machine.
2. From Angular machine browser open:
   - `http://192.168.100.70:5000/health`
3. Open:
   - `http://192.168.100.70:5000/api/docs`
4. Test login from Postman or Angular.
5. Save token.
6. Test protected endpoint:
   - `GET /api/auth/profile`
