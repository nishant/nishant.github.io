import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { FooterComponent } from './components/footer/footer.component';
import { RouterOutlet } from '@angular/router';
import { mountThemeToggle } from '@nish/ui/theme';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: true,
  imports: [RouterOutlet, FooterComponent],
})
export class AppComponent implements AfterViewInit, OnDestroy {
  @ViewChild('themeToggle', { static: true }) themeToggle?: ElementRef<HTMLButtonElement>;

  private unmountThemeToggle?: () => void;

  ngAfterViewInit(): void {
    if (this.themeToggle) this.unmountThemeToggle = mountThemeToggle(this.themeToggle.nativeElement);
  }

  ngOnDestroy(): void {
    this.unmountThemeToggle?.();
  }
}
