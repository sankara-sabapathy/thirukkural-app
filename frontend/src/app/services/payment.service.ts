import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { firstValueFrom } from 'rxjs';

declare var Razorpay: any;

export interface OrderRequest {
    amountMain: number;
    currency: 'INR' | 'USD';
}

export interface SubscriptionRequest {
    planId: string;
}

@Injectable({
    providedIn: 'root'
})
export class PaymentService {
    private apiUrl = environment.api.baseUrl + '/payment';

    constructor(private http: HttpClient) { }

    async createOrder(amountMain: number, currency: 'INR' | 'USD' = 'INR'): Promise<any> {
        const body: OrderRequest = { amountMain, currency };
        return firstValueFrom(this.http.post(`${this.apiUrl}/order`, body));
    }

    async createSubscription(planId: string): Promise<any> {
        const body: SubscriptionRequest = { planId };
        return firstValueFrom(this.http.post(`${this.apiUrl}/subscription`, body));
    }

    async verifyPayment(response: any): Promise<any> {
        return firstValueFrom(this.http.post(`${this.apiUrl}/verify`, response));
    }

    async cancelSubscription(): Promise<any> {
        return firstValueFrom(this.http.post(`${this.apiUrl}/cancel`, {}));
    }

    openCheckout(options: any): void {
        if (typeof Razorpay === 'undefined') {
            console.error('Razorpay SDK not loaded');
            return;
        }
        const rzp = new Razorpay(options);
        rzp.open();
    }
}
