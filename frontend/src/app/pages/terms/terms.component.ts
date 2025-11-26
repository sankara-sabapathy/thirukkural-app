import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../components/header/header.component';
import { FooterComponent } from '../../components/footer/footer.component';

@Component({
    selector: 'app-terms',
    standalone: true,
    imports: [CommonModule, HeaderComponent, FooterComponent],
    template: `
    <app-header></app-header>
    <main class="page-main">
      <div class="container">
        <div class="content-card card fade-in">
          <h1>Terms of Service</h1>
          <p class="last-updated">Last updated: November 2025</p>
          
          <p>
            By accessing and using Thirukkural Daily, you accept and agree to be bound by the terms and provision of this agreement.
          </p>

          <h2>1. Service Description</h2>
          <p>
            Thirukkural Daily provides a subscription service that sends daily emails containing couplets from the Thirukkural.
          </p>

          <h2>2. User Conduct</h2>
          <p>
            You agree to use the service only for lawful purposes. You are responsible for maintaining the confidentiality of your account information.
          </p>

          <h2>3. Intellectual Property</h2>
          <p>
            The content provided in the emails (Thirukkural couplets) is in the public domain. However, the design, branding, and curation of the service are protected by copyright.
          </p>

          <h2>4. Termination</h2>
          <p>
            We reserve the right to terminate or suspend access to our service immediately, without prior notice or liability, for any reason whatsoever.
          </p>

          <h2>5. Changes to Terms</h2>
          <p>
            We reserve the right to modify these terms at any time. We will notify users of any significant changes.
          </p>
        </div>
      </div>
    </main>
    <app-footer></app-footer>
  `,
    styles: [`
    .page-main { padding: 4rem 0; min-height: 80vh; }
    .content-card { max-width: 800px; margin: 0 auto; }
    h1 { font-size: 2.5rem; margin-bottom: 0.5rem; color: var(--accent-primary); }
    .last-updated { color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 2rem; }
    h2 { font-size: 1.5rem; margin: 2rem 0 1rem; color: var(--text-primary); }
    p { margin-bottom: 1rem; font-size: 1.1rem; line-height: 1.8; }
  `]
})
export class TermsComponent { }
