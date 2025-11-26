import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../components/header/header.component';
import { FooterComponent } from '../../components/footer/footer.component';

@Component({
    selector: 'app-contact',
    standalone: true,
    imports: [CommonModule, HeaderComponent, FooterComponent],
    template: `
    <app-header></app-header>
    <main class="page-main">
      <div class="container">
        <div class="content-card card fade-in">
          <h1>Contact Us</h1>
          <p>
            We'd love to hear from you! Whether you have a question about the service, feedback on the content, or just want to say hello.
          </p>
          
          <div class="contact-info">
            <div class="info-item">
              <h3>Email Us</h3>
              <a href="mailto:sabapathy.work@gmail.com" class="email-link">
                <span class="icon">✉️</span>
                sabapathy.work@gmail.com
              </a>
              <p class="sub-text">We usually respond within 24-48 hours.</p>
            </div>
          </div>
        </div>
      </div>
    </main>
    <app-footer></app-footer>
  `,
    styles: [`
    .page-main { padding: 4rem 0; min-height: 80vh; }
    .content-card { max-width: 800px; margin: 0 auto; text-align: center; }
    h1 { font-size: 2.5rem; margin-bottom: 1.5rem; color: var(--accent-primary); }
    p { margin-bottom: 2rem; font-size: 1.1rem; line-height: 1.8; }
    
    .contact-info {
      margin-top: 3rem;
      padding: 2rem;
      background: rgba(255, 255, 255, 0.03);
      border-radius: 16px;
      border: 1px solid var(--border-color);
    }

    .info-item h3 { font-size: 1.25rem; margin-bottom: 1rem; }
    
    .email-link {
      display: inline-flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 1.5rem;
      color: var(--text-primary);
      text-decoration: none;
      padding: 1rem 2rem;
      background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
      border-radius: 12px;
      transition: transform 0.2s;
      
      &:hover { transform: translateY(-2px); }
    }

    .sub-text { margin-top: 1rem; font-size: 0.9rem; color: var(--text-secondary); }
  `]
})
export class ContactComponent { }
