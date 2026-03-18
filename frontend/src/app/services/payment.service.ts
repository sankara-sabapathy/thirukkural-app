import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { firstValueFrom } from 'rxjs';

type RazorpayConstructor = new (options: any) => { open(): void };

declare global {
    interface Window {
        Razorpay?: RazorpayConstructor;
    }
}

export interface OrderRequest {
    amount: number; // Smallest currency unit (paise/cents)
    currency: 'INR' | 'USD';
    receipt?: string;
}

export interface SubscriptionRequest {
    planId: string;
    planType: 'monthly' | 'yearly';
    totalCount: number;
}

@Injectable({
    providedIn: 'root'
})
export class PaymentService {
    private apiUrl = environment.api.baseUrl + '/payment';
    private razorpaySdkPromise: Promise<RazorpayConstructor> | null = null;

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

    async createSubscription(planId: string, planType: 'monthly' | 'yearly', totalCount: number): Promise<any> {
        const body: SubscriptionRequest = { planId, planType, totalCount };
        return firstValueFrom(this.http.post(`${this.apiUrl}/subscription`, body));
    }

    async verifyPayment(response: any): Promise<any> {
        return firstValueFrom(this.http.post(`${this.apiUrl}/verify`, response));
    }

    async cancelSubscription(): Promise<any> {
        return firstValueFrom(this.http.post(`${this.apiUrl}/cancel`, {}));
    }

    async openCheckout(options: any): Promise<void> {
        const Razorpay = await this.loadCheckoutSdk();
        const rzp = new Razorpay(options);
        rzp.open();
    }

    private loadCheckoutSdk(): Promise<RazorpayConstructor> {
        if (typeof window === 'undefined' || typeof document === 'undefined') {
            return Promise.reject(new Error('Razorpay checkout is only available in the browser.'));
        }

        if (window.Razorpay) {
            return Promise.resolve(window.Razorpay);
        }

        if (!this.razorpaySdkPromise) {
            this.razorpaySdkPromise = new Promise<RazorpayConstructor>((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://checkout.razorpay.com/v1/checkout.js';
                script.async = true;
                script.dataset['razorpaySdk'] = 'true';

                script.onload = () => {
                    if (window.Razorpay) {
                        resolve(window.Razorpay);
                        return;
                    }

                    this.razorpaySdkPromise = null;
                    reject(new Error('Razorpay SDK loaded without exposing the checkout constructor.'));
                };

                script.onerror = () => {
                    this.razorpaySdkPromise = null;
                    reject(new Error('Failed to load Razorpay checkout SDK.'));
                };

                document.body.appendChild(script);
            });
        }

        return this.razorpaySdkPromise;
    }
}
