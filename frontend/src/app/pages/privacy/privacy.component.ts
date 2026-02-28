import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [CommonModule],
  template: `
    <main class="page-main">
      <div class="container">
        <div class="content-card card fade-in">
          <h1>Privacy Policy</h1>
          <p class="last-updated">Last Updated: February 2026</p>

          <section>
            <h2>1. Information We Collect</h2>
            <p>When you register for our service using Google Authentication, we collect basic profile information including your name, email address, and profile picture provided by Google.</p>
          </section>

          <section>
            <h2>2. How We Use Your Information</h2>
            <p>We use your email address exclusively for:</p>
            <ul>
              <li>Delivering the daily Thirukkural emails and related notifications.</li>
              <li>Managing your account status and subscription.</li>
              <li>Communicating essential service updates.</li>
            </ul>
            <p>We do not sell, rent, or trade your personal information to third parties.</p>
          </section>

          <section>
            <h2>3. Payment Processing</h2>
            <p>Our payment operations are securely handled by Razorpay. We do not store or process your credit card numbers or sensitive financial data on our servers.</p>
          </section>

          <section>
            <h2>4. Strictly Necessary Cookies</h2>
            <p>We use standard local storage and cookies strictly necessary to provide the service. This includes maintaining your logged-in session via AWS Cognito and processing secure checkouts. We do not use third-party tracking or marketing cookies without your explicit consent.</p>
          </section>

          <section>
            <h2>5. Data Deletion</h2>
            <p>You can request the deletion of your account and associated data at any time by contacting support. Upon account deletion, your active subscriptions will be terminated immediately.</p>
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
    p, li { 
      margin-bottom: 1rem; 
      font-size: 1.1rem; 
      line-height: 1.7; 
      color: var(--text-secondary);
    }
    ul {
      margin-bottom: 1.5rem;
      padding-left: 1.5rem;
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
export class PrivacyComponent { }
