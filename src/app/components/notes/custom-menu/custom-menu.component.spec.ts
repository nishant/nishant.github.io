import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CustomMenuComponent } from './custom-menu.component';

describe('CustomMenuComponent', () => {
  let component: CustomMenuComponent;
  let fixture: ComponentFixture<CustomMenuComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [CustomMenuComponent]
    });
    fixture = TestBed.createComponent(CustomMenuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
