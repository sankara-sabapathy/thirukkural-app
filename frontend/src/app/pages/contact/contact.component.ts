import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule],
  template: `
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
  `,
  styles: [`
    .page-main { 
      padding: 4rem 0; 
      min-height: 80vh; 
      overflow-x: hidden;
    }
    
    .content-card { 
      max-width: 800px; 
      margin: 0 auto; 
      text-align: center;
      padding: 3rem 2rem;
    }
    
    h1 { 
      font-size: 2.5rem; 
      margin-bottom: 1.5rem; 
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    
    p { 
      margin-bottom: 2rem; 
      font-size: 1.1rem; 
      line-height: 1.8; 
    }
    
    .contact-info {
      margin-top: 3rem;
      padding: 2.5rem;
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(139, 92, 246, 0.05));
      border-radius: 16px;
      border: 1px solid rgba(99, 102, 241, 0.2);
      width: 100%;
      box-sizing: border-box;
    }

    .info-item { 
      width: 100%;
      box-sizing: border-box;
    }
    
    .info-item h3 { 
      font-size: 1.25rem; 
      margin-bottom: 1.5rem;
      color: var(--text-primary);
    }
    
    .email-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      font-size: 1.5rem;
      color: white;
      text-decoration: none;
      padding: 1rem 2rem;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      border-radius: 12px;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
      max-width: 100%;
      word-break: break-all;
      box-sizing: border-box;
      flex-wrap: wrap;
      font-weight: 600;
      
      &:hover { 
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
      }
      
      &:active {
        transform: translateY(0);
      }
      
      .icon {
        flex-shrink: 0;
      }
    }

    .sub-text { 
      margin-top: 1rem; 
      font-size: 0.9rem; 
      color: var(--text-secondary); 
    }
    
    @media (max-width: 768px) {
      .page-main {
        padding: 2rem 0;
      }
      
      .content-card {
        padding: 2rem 1.5rem;
      }
      
      h1 {
        font-size: 2rem;
      }
      
      p {
        font-size: 1rem;
      }
      
      .contact-info {
        padding: 2rem 1.5rem;
        margin-top: 2rem;
      }
      
      .info-item h3 {
        font-size: 1.125rem;
        margin-bottom: 1.25rem;
      }
      
      .email-link {
        font-size: 1.125rem;
        padding: 0.875rem 1.5rem;
        width: 100%;
        display: flex;
        word-break: break-word;
        text-align: center;
      }
    }
    
    @media (max-width: 480px) {
      h1 {
        font-size: 1.75rem;
      }
      
      .content-card {
        padding: 1.5rem 1rem;
      }
      
      .contact-info {
        padding: 1.75rem 1rem;
      }
      
      .info-item h3 {
        margin-bottom: 1rem;
      }
      
      .email-link {
        font-size: 1rem;
        padding: 0.75rem 1rem;
        gap: 0.5rem;
        flex-direction: column;
        text-align: center;
      }
      
      .sub-text {
        font-size: 0.875rem;
      }
    }
  `]
})
export class ContactComponent { }
