import { Routes } from "@angular/router";

export const USER_ROUTES: Routes = [

  {
    path: 'dashboard',
    loadComponent: () =>
      import('./components/user-dashboard/user-dashboard.component')
        .then((C) => C.UserDashboardComponent)
  },

  // ✅ أضفنا service-selection هنا
  {
    path: 'service-selection',
    loadComponent: () =>
      import('./components/service-selection/service-selection.component')
        .then((C) => C.ServiceSelectionComponent)
  },

  {
    path: 'inBody-check',
    loadComponent: () =>
      import('./components/inbody-check/inbody-check.component')
        .then((C) => C.InbodyCheckComponent)
  },
  {
    path: 'visitBranch',
    loadComponent: () =>
      import('./components/visit-branch/visit-branch.component')
        .then((C) => C.VisitBranchComponent)
  },
  {
    path: 'in-body',
    loadComponent: () =>
      import('./components/in-body/in-body.component')
        .then((C) => C.InBodyComponent)
  },
  {
    path: 'inbody-history',
    loadComponent: () =>
      import('./components/inbody-history/inbody-history.component')
        .then((C) => C.InbodyHistoryComponent)
  },
  {
    path: 'my-plan',
    loadComponent: () =>
      import('./components/my-plane/my-plane.component')
        .then((C) => C.MyPlaneComponent)
  },

  {
    path: 'booking-machine',
    loadComponent: () =>
      import('./components/booking-machine/booking-machine.component')
        .then((C) => C.BookingMachineComponent)
  },

  {
    path: 'add-tokens',
    loadComponent: () =>
      import('./components/add-tokens/add-tokens.component')
        .then((C) => C.AddTokensComponent)
  },

  {
    path: 'gym-shop',
    loadComponent: () =>
      import('./components/gym-shop/gym-shop.component')
        .then((C) => C.GymShopComponent)
  },

  {
    path: 'rate-coach',
    loadComponent: () =>
      import('./components/rate-coach/rate-coach.component')
        .then((C) => C.RateCoachComponent)
  },

  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  }

];