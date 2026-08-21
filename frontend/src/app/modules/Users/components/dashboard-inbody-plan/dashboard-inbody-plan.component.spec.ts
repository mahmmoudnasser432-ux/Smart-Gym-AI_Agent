import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashboardInbodyPlanComponent } from './dashboard-inbody-plan.component';

describe('DashboardInbodyPlanComponent', () => {
  let component: DashboardInbodyPlanComponent;
  let fixture: ComponentFixture<DashboardInbodyPlanComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardInbodyPlanComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DashboardInbodyPlanComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
