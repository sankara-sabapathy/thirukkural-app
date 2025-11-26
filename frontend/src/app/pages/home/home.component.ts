import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../components/header/header.component';
import { FooterComponent } from '../../components/footer/footer.component';
import { SubscriptionComponent } from '../../components/subscription/subscription.component';
import { AuthService } from '../../services/auth.service';
import { Observable } from 'rxjs';

@Component({
    selector: 'app-home',
    standalone: true,
    imports: [CommonModule, HeaderComponent, FooterComponent, SubscriptionComponent],
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.scss']
})
export class HomeComponent {
    user$: Observable<any>;

    constructor(private authService: AuthService) {
        this.user$ = this.authService.user$;
    }

    scrollToSubscribe() {
        document.getElementById('subscribe')?.scrollIntoView({ behavior: 'smooth' });
    }
}
