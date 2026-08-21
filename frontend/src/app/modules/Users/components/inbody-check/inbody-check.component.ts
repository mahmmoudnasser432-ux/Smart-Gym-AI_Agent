import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-inbody-check',
  standalone: true,
  templateUrl: './inbody-check.component.html',
  styleUrls: ['./inbody-check.component.scss']
})
export class InbodyCheckComponent {

  constructor(private router: Router) {}

  goToVisitBranch() {
    this.router.navigate(['/user/visitBranch']);
  }

}