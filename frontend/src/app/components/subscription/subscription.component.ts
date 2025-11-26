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
        if (!environment.api.subscribeUrl || environment.api.subscribeUrl.includes('xxxxxxxx')) {
            this.snack.open('API not configured. Please deploy backend first.', 'Close', { duration: 3000 });
            return;
        }

        this.http.post(environment.api.subscribeUrl, { email: this.email }).subscribe({
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
        if (!environment.api.unsubscribeUrl || environment.api.unsubscribeUrl.includes('xxxxxxxx')) {
            this.snack.open('API not configured. Please deploy backend first.', 'Close', { duration: 3000 });
            return;
        }

        this.http.post(environment.api.unsubscribeUrl, { email: this.email }).subscribe({
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
