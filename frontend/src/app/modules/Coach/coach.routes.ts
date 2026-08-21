import { Routes } from "@angular/router";

export const COACH_ROUTES: Routes = [

  {
    path: 'dashboard',
    loadComponent: () =>
      import('./components/coach-dashboard/coach-dashboard.component')
        .then((C) => C.CoachDashboardComponent)
  },

  {
    path: 'customers',
    loadComponent: () =>
      import('../Admin/components/customer-tracking/customer-tracking.component')
        .then((C) => C.CustomerTrackingComponent)
  },

  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  }

];
