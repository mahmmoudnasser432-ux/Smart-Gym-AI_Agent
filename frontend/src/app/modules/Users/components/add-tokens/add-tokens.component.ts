import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TokenService } from '../../services/token.service';
import { ShopService } from '../../services/shop.service';

interface TokenPackage {
  amount: number;
  price: number;
  popular?: boolean;
}

@Component({
  selector: 'app-add-tokens',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './add-tokens.component.html',
  styleUrls: ['./add-tokens.component.scss']
})
export class AddTokensComponent implements OnInit {
  userTokens: number = 0;
  showSuccess = false;
  purchasedAmount = 0;
  isProcessing = false;
  history: any[] = [];

  packages: TokenPackage[] = [
    { amount: 50, price: 25 },
    { amount: 120, price: 60, popular: true },
    { amount: 300, price: 150 },
    { amount: 1000, price: 500 }
  ];

  // Checkout & Card Modals State
  showCheckoutModal = false;
  showAddCardModal = false;
  paymentMethods: any[] = [];
  selectedCardId: number | null = null;
  selectedPackageForPurchase: TokenPackage | null = null;
  newCard = {
    cardType: 'Visa',
    cardHolder: '',
    cardNumber: '',
    cardExpiry: '',
    cardCvv: ''
  };

  constructor(
    private router: Router,
    private tokenService: TokenService,
    private shopService: ShopService,
    private location: Location
  ) {
    const saved = localStorage.getItem('userTokens');
    this.userTokens = saved !== null ? +saved : 0;
  }

  ngOnInit() {
    this.fetchBalance();
    this.fetchHistory();
  }

  fetchHistory() {
    this.tokenService.getHistory().subscribe({
      next: (res: any) => {
        this.history = res.data || res.history || res;
        if (!Array.isArray(this.history)) {
          this.history = []; // fallback if format is unexpected
        }
      },
      error: (err) => console.error('Error fetching history:', err)
    });
  }

  fetchBalance() {
    this.tokenService.getBalance().subscribe({
      next: (res: any) => {
        this.userTokens = res.balance ?? res.data?.balance;
        localStorage.setItem('userTokens', String(this.userTokens));
      },
      error: (err) => console.error('Error fetching balance:', err)
    });
  }

  goBack() {
    this.location.back();
  }

  buyTokens(pkg: TokenPackage) {
    this.selectedPackageForPurchase = pkg;
    this.showCheckoutModal = true;
    this.loadPaymentMethods();
  }

  loadPaymentMethods() {
    this.shopService.getPaymentMethods().subscribe({
      next: (res: any) => {
        this.paymentMethods = res.data || [];
        if (this.paymentMethods.length > 0 && !this.selectedCardId) {
          this.selectedCardId = this.paymentMethods[0].pm_id || this.paymentMethods[0].id;
        }
      },
      error: (err) => console.error('Failed to load payment methods:', err)
    });
  }

  executeTokenPurchase(pkg: TokenPackage) {
    if (this.paymentMethods.length === 0) {
      alert('Please add a payment card first.');
      return;
    }

    this.isProcessing = true;
    this.tokenService.buyTokens(pkg.amount).subscribe({
      next: (res: any) => {
        this.userTokens = res.data?.balance ?? res.balance;
        localStorage.setItem('userTokens', String(this.userTokens));

        this.purchasedAmount = pkg.amount;
        this.showSuccess = true;
        this.isProcessing = false;
        this.showCheckoutModal = false;

        // Refresh history
        this.fetchHistory();

        setTimeout(() => {
          this.showSuccess = false;
        }, 3000);
      },
      error: (err) => {
        console.error('Error buying tokens:', err);
        this.isProcessing = false;
        alert(err.error?.message || 'Failed to complete token purchase.');
      }
    });
  }

  addCard() {
    if (!this.newCard.cardHolder || !this.newCard.cardNumber) {
      alert('Please fill card details');
      return;
    }
    
    const last4 = this.newCard.cardNumber.slice(-4) || '4242';
    this.shopService.addPaymentMethod(this.newCard.cardType, last4, this.newCard.cardHolder).subscribe({
      next: () => {
        this.showAddCardModal = false;
        this.loadPaymentMethods();
        // Reset card details
        this.newCard = {
          cardType: 'Visa',
          cardHolder: '',
          cardNumber: '',
          cardExpiry: '',
          cardCvv: ''
        };
      },
      error: (err) => {
        console.error('Failed to add card:', err);
        const detail = err.error?.message || err.error?.error || err.message || 'Unknown error';
        alert(`Failed to save payment card. Reason: ${detail}`);
      }
    });
  }

  deleteCard(pmId: number) {
    if (confirm('Are you sure you want to delete this card?')) {
      this.shopService.deletePaymentMethod(pmId).subscribe({
        next: () => {
          this.loadPaymentMethods();
          if (this.selectedCardId === pmId) {
            this.selectedCardId = null;
          }
        },
        error: (err) => console.error('Failed to delete card:', err)
      });
    }
  }
}
