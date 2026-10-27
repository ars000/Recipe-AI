import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../../core/api.service';
import type { ShoppingShareSnapshot } from '../../../core/models';
import { formatAmount, formatUnit } from '../../../shared/recipe-ui.utils';

@Component({
  standalone: true,
  templateUrl: './shopping-share.page.html',
  styleUrl: './shopping-share.page.scss',
})
export class ShoppingSharePage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);

  readonly snapshot = signal<ShoppingShareSnapshot | null>(null);
  readonly error = signal(false);

  formatAmount = formatAmount;
  formatUnit = formatUnit;

  ngOnInit() {
    const token = this.route.snapshot.paramMap.get('token');
    if (!token) {
      this.error.set(true);
      return;
    }
    this.api.getShoppingShare(token).subscribe({
      next: (s) => this.snapshot.set(s),
      error: () => this.error.set(true),
    });
  }
}
