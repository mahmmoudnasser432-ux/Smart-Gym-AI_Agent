import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-visit-branch',
  standalone: true,
  templateUrl: './visit-branch.component.html',
  styleUrls: ['./visit-branch.component.scss']
})
export class VisitBranchComponent {

  loading = false;
  errorMsg = '';

  constructor(private router: Router) {}

  goToInBody() {
    this.loading = true;

    setTimeout(() => {
      this.router.navigate(['/user/in-body']);
    }, 1500);
  }

}