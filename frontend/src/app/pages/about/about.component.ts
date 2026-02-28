import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule],
  template: `
    <main class="page-main">
      <div class="container">
        <div class="content-card card fade-in">
          <h1>About Thirukkural Daily</h1>
          <p>
            Thirukkural Daily is a digital initiative designed to deliver the timeless wisdom of Saint Thiruvalluvar through a robust and modern platform. 
            Our mission is to make the profound insights of the Thirukkural accessible to a global audience, every single day.
          </p>
          
          <h2>The Thirukkural</h2>
          <p>
            The Thirukkural is a classic Tamil language text consisting of 1,330 short couplets of seven words each, or Kurals. 
            Structured into three distinct books covering virtue (aram), wealth (porul), and love (inbam), it serves as a universal philosophical framework.
            Considered one of the greatest works on ethics and morality, its teachings remain highly relevant for contemporary personal and professional growth.
          </p>

          <h2>Service Delivery & Compliance</h2>
          <p>
            We leverage modern cloud infrastructure to deliver daily insights efficiently. However, as an evolving digital service, we operate under standard provisions.
            <strong>Disclaimer:</strong> This service is provided "as is" without any Service Level Agreements (SLAs). Services may be interrupted, suspended, or terminated at any time. We cannot guarantee continuous or error-free operation.
          </p>
          <p>
            We are committed to data privacy and regulatory compliance as per applicable laws. All content and services are subject to "All rights reserved" under intellectual property statutes.
          </p>
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
    
    h2 { 
      font-size: 1.5rem; 
      margin: 2rem 0 1rem; 
      color: var(--text-primary); 
    }
    
    p { 
      margin-bottom: 1rem; 
      font-size: 1.1rem; 
      line-height: 1.8; 
    }
    
    @media (max-width: 768px) {
      .page-main {
        padding: 2rem 0;
      }
      
      h1 {
        font-size: 2rem;
      }
      
      h2 {
        font-size: 1.375rem;
      }
      
      p {
        font-size: 1rem;
      }
    }
    
    @media (max-width: 480px) {
      h1 {
        font-size: 1.75rem;
      }
      
      .content-card {
        padding: 1.5rem 1rem;
      }
    }
  `]
})
export class AboutComponent { }
