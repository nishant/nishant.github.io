import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-stocks',
  templateUrl: './stocks.component.html',
  styleUrls: ['./stocks.component.scss'],
  standalone: true,
})
export class StocksComponent {
  API_KEY = '';

  constructor(private http: HttpClient) {}

  // getStockData()
}
