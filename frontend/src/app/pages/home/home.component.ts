import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { HeaderComponent } from '../../components/header/header.component';
import { FooterComponent } from '../../components/footer/footer.component';
import { SubscriptionComponent } from '../../components/subscription/subscription.component';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';
import { Observable } from 'rxjs';

@Component({
    selector: 'app-home',
    standalone: true,
    imports: [CommonModule, FormsModule, MatSnackBarModule, HeaderComponent, FooterComponent, SubscriptionComponent],
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.scss']
})
export class HomeComponent {
    user$: Observable<any>;
    sampleEmail: string = '';
    isLoadingSample: boolean = false;

    constructor(
        private authService: AuthService,
        private apiService: ApiService,
        private snackBar: MatSnackBar
    ) {
        this.user$ = this.authService.user$;
    }

    scrollToSubscribe() {
        document.getElementById('subscribe')?.scrollIntoView({ behavior: 'smooth' });
    }

    sendSampleEmail() {
        if (!this.sampleEmail || !this.validateEmail(this.sampleEmail)) {
            this.showSnackBar('Please enter a valid email address', 'error');
            return;
        }

        this.isLoadingSample = true;
        this.apiService.sendSampleEmail(this.sampleEmail).subscribe({
            next: () => {
                this.isLoadingSample = false;
                this.showSnackBar('Sample email sent! Check your inbox.', 'success');
                this.sampleEmail = '';
            },
            error: (err) => {
                this.isLoadingSample = false;
                const msg = err.error?.message || 'Failed to send sample email. Please try again later.';
                this.showSnackBar(msg, 'error');
            }
        });
    }

    private validateEmail(email: string): boolean {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    private showSnackBar(message: string, type: 'success' | 'error') {
        this.snackBar.open(message, 'Close', {
            duration: 5000,
            panelClass: type === 'success' ? ['snackbar-success'] : ['snackbar-error'],
            horizontalPosition: 'center',
            verticalPosition: 'bottom'
        });
    }
}
