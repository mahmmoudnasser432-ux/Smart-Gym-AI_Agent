import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { GuestNavbarComponent } from '../../Shared/Components/guest-navbar/guest-navbar.component';

@Component({
  selector: 'app-auth-layout',
  imports: [RouterOutlet],
  templateUrl: './auth-layout.component.html',
  styleUrl: './auth-layout.component.scss'
})
export class AuthLayoutComponent {

}
