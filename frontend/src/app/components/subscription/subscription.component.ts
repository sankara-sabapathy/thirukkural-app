import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { environment } from '../../../environments/environment';

@Component({
    selector: 'app-subscription',
    standalone: true,
    imports: [CommonModule, MatButtonModule, MatSnackBarModule],
    templateUrl: './subscription.component.html',
    styleUrls: ['./subscription.component.scss']
})
export class SubscriptionComponent {
    @Input() email!: string;
    subscribed = false;

    constructor(private http: HttpClient, private snack: MatSnackBar) { }

    subscribe() {
        if (!environment.api.baseUrl || environment.api.baseUrl.includes('xxxxxxxx')) {
            this.snack.open('API not configured. Please deploy backend first.', 'Close', { duration: 3000 });
            return;
        }

        this.http.post(environment.api.baseUrl + environment.api.endpoints.subscribe, { email: this.email }).subscribe({
            next: () => {
                this.subscribed = true;
                this.snack.open('Subscribed successfully!', 'Close', { duration: 3000 });
            },
            error: (err) => {
                console.error(err);
                this.snack.open('Subscription failed. Please try again.', 'Close', { duration: 3000 });
            }
        });
    }

    unsubscribe() {
        if (!environment.api.baseUrl || environment.api.baseUrl.includes('xxxxxxxx')) {
            this.snack.open('API not configured. Please deploy backend first.', 'Close', { duration: 3000 });
            return;
        }

        this.http.post(environment.api.baseUrl + environment.api.endpoints.unsubscribe, { email: this.email }).subscribe({
            next: () => {
                this.subscribed = false;
                this.snack.open('Unsubscribed successfully.', 'Close', { duration: 3000 });
            },
            error: (err) => {
                console.error(err);
                this.snack.open('Unsubscribe failed. Please try again.', 'Close', { duration: 3000 });
            }
        });
    }
}
