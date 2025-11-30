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
            Thirukkural Daily is a modern digital initiative to bring the timeless wisdom of Saint Thiruvalluvar to the digital age. 
            Our mission is to make the profound insights of the Thirukkural accessible, understandable, and relevant to everyone, every day.
          </p>
          
          <h2>The Thirukkural</h2>
          <p>
            The Thirukkural is a classic Tamil language text consisting of 1,330 short couplets of seven words each, or Kurals. 
            The text is divided into three books, each with aphoristic teachings on virtue (aram), wealth (porul), and love (inbam). 
            Considered one of the greatest works on ethics and morality, it is known for its universality and secular nature.
          </p>

          <h2>Our Vision</h2>
          <p>
            We believe that starting the day with a thought-provoking idea can transform lives. 
            By delivering one Kural every morning, we hope to inspire mindfulness, ethical living, and personal growth in our subscribers.
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
