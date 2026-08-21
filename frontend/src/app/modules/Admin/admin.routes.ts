import { Routes } from "@angular/router";

export const ADMIN_ROUTES: Routes = [

  {
    path: 'dashboard',
    loadComponent: () =>
      import('./components/admin-dashboard/admin-dashboard.component')
        .then((C) => C.AdminDashboardComponent)
  },

  {
    path: 'add-coach',
    loadComponent: () =>
      import('./components/add-coach/add-coach.component')
        .then((C) => C.AddCoachComponent)
  },

  {
    path: 'customers',
    loadComponent: () =>
      import('./components/customer-tracking/customer-tracking.component')
        .then((C) => C.CustomerTrackingComponent)
  },

  {
    path: 'token-analytics',
    loadComponent: () =>
      import('./components/token-analytics/token-analytics.component')
        .then((C) => C.TokenAnalyticsComponent)
  },

  {
    path: 'shop',
    loadComponent: () =>
      import('./components/admin-shop/admin-shop.component')
        .then((C) => C.AdminShopComponent)
  },

  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  }

];