import { Routes } from '@angular/router';
import { AuthLayoutComponent } from './Layouts/auth-layout/auth-layout.component';
import { AUTH_ROUTES } from './modules/Authentication/authentication.routes';
import { UserLayoutComponent } from './Layouts/user-layout/user-layout.component';
import { USER_ROUTES } from './modules/Users/user.routes';
import { AdminLayoutComponent } from './Layouts/admin-layout/admin-layout.component';
import { ADMIN_ROUTES } from './modules/Admin/admin.routes';
import { CoachLayoutComponent } from './Layouts/coach-layout/coach-layout.component';
import { COACH_ROUTES } from './modules/Coach/coach.routes';
import { authGuard } from './guards/auth.guard';
import { guestGuard } from './guards/guest.guard';
import { adminGuard } from './guards/admin.guard';
import { coachGuard } from './guards/coach.guard';

export const routes: Routes = [

    {
        path: '',
        redirectTo: 'auth/landing-page',
        pathMatch: 'full'
    },

    {
        path: 'auth',
        component: AuthLayoutComponent,
        canActivate: [guestGuard],
        children: AUTH_ROUTES
    },

    {
        path: 'user',
        component: UserLayoutComponent,
        canActivate: [authGuard],
        children: USER_ROUTES
    },

    {
        path: 'admin',
        component: AdminLayoutComponent,
        canActivate: [adminGuard],
        children: ADMIN_ROUTES
    },

    {
        path: 'coach',
        component: CoachLayoutComponent,
        canActivate: [coachGuard],
        children: COACH_ROUTES
    }
];
