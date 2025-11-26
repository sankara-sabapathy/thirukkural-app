import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../components/header/header.component';
import { FooterComponent } from '../../components/footer/footer.component';

@Component({
    selector: 'app-privacy',
    standalone: true,
    imports: [CommonModule, HeaderComponent, FooterComponent],
    template: `
    <app-header></app-header>
    <main class="page-main">
      <div class="container">
        <div class="content-card card fade-in">
          <h1>Privacy Policy</h1>
          <p class="last-updated">Last updated: November 2025</p>
          
          <p>
            At Thirukkural Daily, we take your privacy seriously. This Privacy Policy explains how we collect, use, and protect your personal information.
          </p>

          <h2>Information We Collect</h2>
          <p>
            We only collect the information necessary to provide our service:
          </p>
          <ul>
            <li><strong>Email Address:</strong> Collected when you sign in with Google to send you daily emails.</li>
            <li><strong>Basic Profile Info:</strong> Your name and profile picture from Google to personalize your experience.</li>
          </ul>

          <h2>How We Use Your Information</h2>
          <p>
            Your email address is used solely for:
          </p>
          <ul>
            <li>Sending you the daily Thirukkural email.</li>
            <li>Authenticating your account.</li>
            <li>Communicating important service updates.</li>
          </ul>
          <p>We do NOT sell, trade, or rent your personal identification information to others.</p>

          <h2>Data Security</h2>
          <p>
            We use industry-standard security measures, including AWS Cognito for authentication and encrypted database storage, to protect your data.
          </p>

          <h2>Contact Us</h2>
          <p>
            If you have any questions about this Privacy Policy, please contact us at <a href="mailto:sabapathy.work@gmail.com">sabapathy.work@gmail.com</a>.
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
    ul { margin-bottom: 1.5rem; padding-left: 1.5rem; }
    li { margin-bottom: 0.5rem; color: var(--text-secondary); }
    strong { color: var(--text-primary); }
    a { color: var(--accent-primary); text-decoration: none; }
    a:hover { text-decoration: underline; }
  `]
})
export class PrivacyComponent { }
