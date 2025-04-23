import { ComponentFixture, TestBed } from '@angular/core/testing';

import { JpListComponent } from './jp-list.component';

describe('JpListComponent', () => {
  let component: JpListComponent;
  let fixture: ComponentFixture<JpListComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [JpListComponent],
    });
    fixture = TestBed.createComponent(JpListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
