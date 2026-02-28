import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [CommonModule],
  template: `
    <main class="page-main">
      <div class="container">
        <div class="content-card card fade-in">
          <h1>Terms and Conditions</h1>
          <p class="last-updated">Last Updated: February 2026</p>

          <section>
            <h2>1. Introduction</h2>
            <p>Welcome to Thirukkural Daily. By using our website and services, you agree to these Terms and Conditions. Please read them carefully.</p>
          </section>

          <section>
            <h2>2. Service Description and Availability</h2>
            <p>Thirukkural Daily provides digital delivery of Thirukkural verses and associated commentaries. We strive to provide uninterrupted service, but we do not guarantee continuous, uninterrupted, or secure access to the platform.</p>
            <p><strong>Disclaimer of SLA:</strong> This service is provided on an "as is" and "as available" basis without any Service Level Agreements (SLAs). We reserve the right to suspend, withdraw, or discontinue all or part of the service at any time without notice.</p>
          </section>

          <section>
            <h2>3. Subscriptions and Payments</h2>
            <p>Payments for credits and subscriptions are processed securely via third-party providers (e.g., Razorpay). By purchasing a subscription or credit pack, you agree to the payment terms and conditions of the respective provider.</p>
            <p><strong>Refund Policy:</strong> All purchases are final and non-refundable unless required by applicable law.</p>
          </section>

          <section>
            <h2>4. Intellectual Property</h2>
            <p>All content published on this website, including but not limited to the compilation of texts, translations, and software code, is the property of Thirukkural Daily or its content suppliers. All rights reserved.</p>
          </section>

          <section>
            <h2>5. Limitation of Liability</h2>
            <p>In no event shall Thirukkural Daily or its owners be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or related to your use of the service.</p>
          </section>

        </div>
      </div>
    </main>
  `,
  styles: [`
    .page-main { 
      padding: 4rem 0; 
      min-height: 80vh; 
    }
    .content-card { 
      max-width: 800px; 
      margin: 0 auto;
      padding: 3rem 2rem;
    }
    h1 { 
      font-size: 2.5rem; 
      margin-bottom: 0.5rem; 
      color: var(--text-primary);
    }
    .last-updated {
      color: var(--text-tertiary);
      font-size: 0.9rem;
      margin-bottom: 2.5rem;
    }
    section {
      margin-bottom: 2rem;
    }
    h2 { 
      font-size: 1.5rem; 
      margin-bottom: 1rem; 
      color: var(--text-primary); 
    }
    p { 
      margin-bottom: 1rem; 
      font-size: 1.1rem; 
      line-height: 1.7; 
      color: var(--text-secondary);
    }
    
    @media (max-width: 768px) {
      .page-main { padding: 2rem 0; }
      h1 { font-size: 2rem; }
      h2 { font-size: 1.25rem; }
      .content-card { padding: 2rem 1.5rem; }
    }
  `]
})
export class TermsComponent { }
