import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { firstValueFrom } from 'rxjs';

declare var Razorpay: any;

export interface OrderRequest {
    amount: number; // Smallest currency unit (paise/cents)
    currency: 'INR' | 'USD';
    receipt?: string;
}

export interface SubscriptionRequest {
    planId: string;
    totalCount: number;
}

@Injectable({
    providedIn: 'root'
})
export class PaymentService {
    private apiUrl = environment.api.baseUrl + '/payment';

    constructor(private http: HttpClient) { }

    getSubscriptionCycleCount(planType: string): number {
        return planType === 'monthly' ? 60 : 5;
    }

    async createOrder(amountMain: number, currency: 'INR' | 'USD' = 'INR'): Promise<any> {
        // Convert to smallest currency unit (paise/cents)
        // INR: 1 = 100 paise
        // USD: 1 = 100 cents
        const amount = Math.round(amountMain * 100);
        const body: any = { amount, currency }; // Send 'amount' as per key update
        return firstValueFrom(this.http.post(`${this.apiUrl}/order`, body));
    }

    async createSubscription(planId: string, totalCount: number): Promise<any> {
        const body: SubscriptionRequest = { planId, totalCount };
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
