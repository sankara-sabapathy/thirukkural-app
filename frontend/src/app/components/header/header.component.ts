import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Observable } from 'rxjs';

@Component({
    selector: 'app-header',
    standalone: true,
    imports: [CommonModule, MatButtonModule, RouterModule],
    templateUrl: './header.component.html',
    styleUrls: ['./header.component.scss']
})
export class HeaderComponent {
    user$: Observable<any>;

    constructor(private authService: AuthService) {
        this.user$ = this.authService.user$;
    }

    login() {
        this.authService.login();
    }

    logout() {
        this.authService.logout();
    }
}
