import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './landing-page.component.html',
  styleUrls: ['./landing-page.component.scss']
})
export class LandingPageComponent implements OnInit, OnDestroy {

  currentSlide = 0;
  private sliderInterval: any;

  slides = [
    {
      image: 'Images/ChatGPT Image Apr 20, 2026, 06_04_14 PM.png',
      title: 'Train Smarter',
      subtitle: 'AI-powered movement analysis in real-time'
    },
    {
      image: 'Images/ChatGPT Image Jun 20, 2026, 10_05_18 PM.png',
      title: 'Push Your Limits',
      subtitle: 'Personalized guidance for every rep'
    },
    {
      image: 'Images/ChatGPT Image Jun 20, 2026, 10_07_49 PM.png',
      title: 'Train Safer',
      subtitle: 'Real-time correction to prevent injuries'
    }
  ];

  ngOnInit(): void {
    this.startSlider();
  }

  ngOnDestroy(): void {
    clearInterval(this.sliderInterval);
  }

  startSlider() {
    this.sliderInterval = setInterval(() => {
      this.currentSlide = (this.currentSlide + 1) % this.slides.length;
    }, 4000);
  }

  goToSlide(index: number) {
    this.currentSlide = index;
    clearInterval(this.sliderInterval);
    this.startSlider();
  }
}