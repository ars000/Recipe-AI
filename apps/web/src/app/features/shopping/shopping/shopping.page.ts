import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../core/api.service';
import type { ShoppingList } from '../../../core/models';
import { PageHeroComponent } from '../../../shared/ui/page-hero/page-hero.component';
import { formatShoppingListItemQuantity } from '../../../shared/recipe-ui.utils';
import * as QRCode from 'qrcode';

@Component({
  standalone: true,
  imports: [PageHeroComponent, RouterLink],
  templateUrl: './shopping.page.html',
  styleUrl: './shopping.page.scss',
})
export class ShoppingPage implements OnInit {
  private readonly api = inject(ApiService);
  readonly list = signal<ShoppingList | null>(null);
  readonly qrDataUrl = signal<string | null>(null);
  readonly shareUrl = signal<string | null>(null);
  readonly shareLoading = signal(false);
  readonly clearConfirmOpen = signal(false);

  readonly hasAnyItems = computed(() => (this.list()?.items.length ?? 0) > 0);
  readonly loadError = signal(false);

  ngOnInit() {
    this.reload();
  }

  private applyList(l: ShoppingList) {
    this.list.set({
      ...l,
      items: (l.items ?? []).map((item) => ({
        ...item,
        sources: item.sources ?? [],
      })),
    });
  }

  reload() {
    this.loadError.set(false);
    this.api.getShoppingList().subscribe({
      next: (l) => this.applyList(l),
      error: () => this.loadError.set(true),
    });
  }

  itemQuantity(item: ShoppingList['items'][number]): string {
    return formatShoppingListItemQuantity({
      amount: item.amount,
      unit: item.unit,
      sources: (item.sources ?? []).map((s) => ({
        amount: s.amount,
        unit: s.unit,
      })),
    });
  }

  removeItem(id: string) {
    this.api.deleteShoppingItem(id).subscribe({
      next: (l) => this.applyList(l),
      error: () => this.loadError.set(true),
    });
  }

  openClearConfirm() {
    this.clearConfirmOpen.set(true);
  }

  closeClearConfirm() {
    this.clearConfirmOpen.set(false);
  }

  confirmClearAll() {
    this.api.clearShoppingList().subscribe({
      next: (l) => {
        this.applyList(l);
        this.clearConfirmOpen.set(false);
      },
      error: () => this.loadError.set(true),
    });
  }

  printList() {
    document.body.classList.add('print-shopping-list');
    const cleanup = () => {
      document.body.classList.remove('print-shopping-list');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
  }

  shareQr() {
    this.shareLoading.set(true);
    this.api.createShoppingShare().subscribe({
      next: async (share) => {
        const url = `${window.location.origin}/s/${share.token}`;
        this.shareUrl.set(url);
        this.qrDataUrl.set(await QRCode.toDataURL(url, { width: 240, margin: 1 }));
        this.shareLoading.set(false);
      },
      error: () => this.shareLoading.set(false),
    });
  }

  closeQr() {
    this.qrDataUrl.set(null);
    this.shareUrl.set(null);
  }
}
