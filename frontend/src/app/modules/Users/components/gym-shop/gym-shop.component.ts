import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { trigger, transition, style, animate } from '@angular/animations';
import { ShopService } from '../../services/shop.service';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthenticationService } from '../../../Authentication/services/authentication.service';
import { environment } from '../../../../Environments/environments.develompent';

interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  image: string;
  description: string;
  stockQuantity: number;
}

interface CartItem {
  cartId: number;
  id: number;
  name: string;
  price: number;
  image: string;
  quantity: number;
  itemTotal: number;
}

@Component({
  selector: 'app-gym-shop',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './gym-shop.component.html',
  styleUrls: ['./gym-shop.component.scss'],
  animations: [
    trigger('slideIn', [
      transition(':enter', [
        style({ transform: 'translateX(100%)' }),
        animate('300ms ease-out', style({ transform: 'translateX(0)' }))
      ]),
      transition(':leave', [
        animate('300ms ease-in', style({ transform: 'translateX(100%)' }))
      ])
    ]),
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('200ms ease-out', style({ opacity: 1 }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ opacity: 0 }))
      ])
    ]),
    trigger('popIn', [
      transition(':enter', [
        style({ transform: 'scale(0.9) translateY(20px)', opacity: 0 }),
        animate('300ms cubic-bezier(0.34, 1.56, 0.64, 1)', style({ transform: 'scale(1) translateY(0)', opacity: 1 }))
      ])
    ])
  ]
})
export class GymShopComponent implements OnInit, OnDestroy {
  userName = '';
  profileImageUrl: string = 'https://ui-avatars.com/api/?name=User&background=ff8a00&color=fff&size=90';

  get hasPlan(): boolean {
    return localStorage.getItem('hasPlan') === 'true';
  }
  // Navigation / Tabs
  activeTab: 'store' | 'history' = 'store';

  // Products
  products: Product[] = [];
  filteredProducts: Product[] = [];
  searchQuery: string = '';
  selectedCategory: string = 'All';
  categories: string[] = ['All', 'Supplements', 'Gear'];

  // Cart
  cart: CartItem[] = [];
  showCart: boolean = false;
  cartTotal: number = 0;
  cartCount: number = 0;

  // Toast notifications
  showToast: boolean = false;
  toastMessage: string = '';
  private toastTimeout: any;
  private productsPollInterval: any;

  // Checkout & Card modals
  showCheckoutModal: boolean = false;
  showAddCardModal: boolean = false;
  paymentMethods: any[] = [];
  selectedCardId: number | null = null;
  newCard = {
    cardType: 'Visa',
    cardHolder: '',
    cardNumber: '',
    cardExpiry: '',
    cardCvv: ''
  };
  isCheckoutProcessing: boolean = false;

  // Purchase History
  purchaseHistory: any = {
    totalOrders: 0,
    totalSpent: 0,
    items: []
  };

  constructor(
    private shopService: ShopService,
    public authService: AuthenticationService
  ) { }

  ngOnInit() {
    this.loadProducts();
    this.loadCart();
    this.loadPaymentMethods();
    this.loadPurchaseHistory();

    const savedUser = localStorage.getItem('userData');
    let email = '';
    if (savedUser) {
      const user = JSON.parse(savedUser);
      this.userName = user.name || user.username || user.email || 'User';
      email = user.email || '';
    } else {
      const user = this.authService.getUserData();
      this.userName = user?.name || user?.username || user?.email || 'User';
      email = user?.email || '';
    }

    // ✅ قراءة الصورة من userData فقط (بدون per-email localStorage)
    const savedUserStr = localStorage.getItem('userData') || localStorage.getItem('user');
    let userImgUrl = '';
    if (savedUserStr) {
      const userObj = JSON.parse(savedUserStr);
      userImgUrl = userObj.profile_picture_url || userObj.photo || '';
    }
    
    if (userImgUrl) {
      this.profileImageUrl = userImgUrl;
    } else {
      this.profileImageUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(this.userName)}&background=ff8a00&color=fff&size=90`;
    }

    // Poll products every 5 seconds to fetch updated stock quantities in the background
    this.productsPollInterval = setInterval(() => {
      this.loadProducts();
    }, 5000);
  }

  ngOnDestroy() {
    if (this.productsPollInterval) {
      clearInterval(this.productsPollInterval);
    }
  }

  // Helper to resolve product image
  getProductImage(name: string): string {
    const lower = name.toLowerCase();
    if (lower.includes('water bottle') || (lower.includes('bottle') && !lower.includes('shaker'))) {
      return '/Images/water_bottle.jpeg';
    } else if (lower.includes('shaker')) {
      return '/Images/shaker_bottle.jpeg';
    } else if (lower.includes('towel')) {
      return '/Images/cotton_towel.jpeg';
    } else if (lower.includes('bag') || lower.includes('duffel')) {
      return '/Images/gym_bag.jpeg';
    } else if (lower.includes('glove')) {
      return '/Images/workout_gloves.jpeg';
    } else if (lower.includes('rope')) {
      return '/Images/jump_ropes.jpeg';
    } else if (lower.includes('whey protein')) {
      return '/Images/whey_protein.jpeg';
    } else if (lower.includes('creatine')) {
      return '/Images/creatine.jpeg';
    } else if (lower.includes('bundle')) {
      return '/Images/supplements_bundle.jpeg';
    } else if (lower.includes('bar')) {
      return '/Images/protein_bars.jpeg';
    } else if (lower.includes('pre-workout') || lower.includes('supplement') || lower.includes('protein')) {
      return 'https://images.unsplash.com/photo-1709976142774-ce1ef41a8378?auto=format&fit=crop&w=900&q=80';
    }
    return 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=900&q=80';
  }

  resolveProductImage(rawImageUrl: string | null, productName: string): string {
    const useDefaultImage =
      rawImageUrl?.includes('whey_protein') ||
      rawImageUrl?.includes('creatine') ||
      rawImageUrl?.includes('protein_bars') ||
      rawImageUrl?.includes('water_bottle') ||
      rawImageUrl?.includes('gym_bag') ||
      rawImageUrl?.includes('jump_rope') ||
      rawImageUrl?.includes('workout_gloves') ||
      rawImageUrl?.includes('cotton_towel') ||
      rawImageUrl?.includes('shaker_bottle') ||
      rawImageUrl?.includes('meal_prep');

    let finalImage = this.getProductImage(productName);

    if (!useDefaultImage && rawImageUrl) {
      const cleanUrl = rawImageUrl.replace(/\\/g, '/');
      finalImage = cleanUrl.startsWith('http')
        ? cleanUrl
        : `${environment.apiUrl?.replace('/api', '')}/${cleanUrl.startsWith('/') ? cleanUrl.substring(1) : cleanUrl}`;
    }

    return finalImage;
  }

  getProductCategory(name: string): string {
    const lower = name.toLowerCase();
    if (lower.includes('protein') || lower.includes('creatine') || lower.includes('pre-workout') || lower.includes('supplement') || lower.includes('bar')) {
      return 'Supplements';
    }
    return 'Gear';
  }

  // Load Products from API
  loadProducts() {
    this.shopService.getProducts().subscribe({
      next: (res) => {
        if (res.status === 'success' && res.data) {
          this.products = res.data.map((p: any) => ({
            id: p.product_id,
            name: p.name,
            category: this.getProductCategory(p.name),
            price: p.price,
            image: this.resolveProductImage(p.image_url || p.image, p.name),
            description: p.description || `${p.name} - high quality gym essential.`,
            stockQuantity: p.stock_quantity ?? p.stock ?? p.quantity ?? p.stockQuantity ?? 0
          }));
          this.filterProducts();
        }
      },
      error: (err) => console.error('Failed to load products', err)
    });
  }

  filterProducts() {
    this.filteredProducts = this.products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(this.searchQuery.toLowerCase());
      const matchesCategory = this.selectedCategory === 'All' || p.category === this.selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }

  // Load Cart from API
  loadCart() {
    this.shopService.getCart().subscribe({
      next: (res) => {
        if (res.status === 'success' && res.data) {
          const items = res.data.items || [];
          this.cart = items.map((i: any) => ({
            cartId: i.cart_id,
            id: i.product_id,
            name: i.name,
            price: i.price,
            image: this.resolveProductImage(i.image_url || i.image, i.name),
            quantity: i.quantity,
            itemTotal: i.item_total
          }));
          this.cartTotal = res.data.total || 0;
          this.cartCount = res.data.count || 0;
        } else {
          this.cart = [];
          this.cartTotal = 0;
          this.cartCount = 0;
        }
      },
      error: (err) => {
        console.error('Failed to load cart', err);
        this.cart = [];
        this.cartTotal = 0;
        this.cartCount = 0;
      }
    });
  }

  triggerToast(message: string) {
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
    this.toastMessage = message;
    this.showToast = true;
    this.toastTimeout = setTimeout(() => {
      this.showToast = false;
    }, 3000);
  }

  addToCart(product: any) {
    const productId = product.id || product.product_id;
    const dbProduct = this.products.find(p => p.id === productId);
    const maxStock = dbProduct ? dbProduct.stockQuantity : 999;

    const existing = this.cart.find(item => item.id === productId);
    if (existing) {
      if (existing.quantity >= maxStock) {
        this.triggerToast(`Cannot add more than ${maxStock} items. Out of stock! ⚠️`);
        return;
      }
      this.shopService.updateCartItem(existing.cartId, existing.quantity + 1).subscribe({
        next: () => {
          this.loadCart();
          this.triggerToast(`Increased ${product.name} quantity in cart! 🛍️`);
        },
        error: (err) => console.error('Failed to update cart', err)
      });
    } else {
      if (maxStock <= 0) {
        this.triggerToast(`Sorry, ${product.name} is out of stock! ⚠️`);
        return;
      }
      this.shopService.addToCart(productId, 1).subscribe({
        next: () => {
          this.loadCart();
          this.triggerToast(`${product.name} added to cart! 🛍️`);
        },
        error: (err) => console.error('Failed to add to cart', err)
      });
    }
  }

  removeFromCart(productId: number) {
    const item = this.cart.find(i => i.id === productId);
    if (!item) return;

    if (item.quantity > 1) {
      this.shopService.updateCartItem(item.cartId, item.quantity - 1).subscribe({
        next: () => this.loadCart(),
        error: (err) => console.error('Failed to update cart item', err)
      });
    } else {
      this.shopService.removeFromCart(item.cartId).subscribe({
        next: () => this.loadCart(),
        error: (err) => console.error('Failed to remove item', err)
      });
    }
  }

  toggleCart() {
    this.showCart = !this.showCart;
  }

  // Load Payment Methods from API
  loadPaymentMethods() {
    this.shopService.getPaymentMethods().subscribe({
      next: (res) => {
        if (res.status === 'success' && res.data) {
          this.paymentMethods = res.data || [];
          if (this.paymentMethods.length > 0 && !this.selectedCardId) {
            this.selectedCardId = this.paymentMethods[0].pm_id || this.paymentMethods[0].id;
          }
        }
      },
      error: (err) => console.error('Failed to load payment methods', err)
    });
  }

  // Add dummy card
  addCard() {
    if (!this.newCard.cardHolder || !this.newCard.cardNumber) {
      alert('Please fill card details');
      return;
    }
    const last4 = this.newCard.cardNumber.slice(-4) || '4242';
    this.shopService.addPaymentMethod(this.newCard.cardType, last4, this.newCard.cardHolder).subscribe({
      next: () => {
        this.loadPaymentMethods();
        this.showAddCardModal = false;
        this.newCard = {
          cardType: 'Visa',
          cardHolder: '',
          cardNumber: '',
          cardExpiry: '',
          cardCvv: ''
        };
      },
      error: (err) => {
        console.error('Failed to add card', err);
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
        error: (err) => console.error('Failed to delete card', err)
      });
    }
  }

  // Load Purchase History from API
  loadPurchaseHistory() {
    this.shopService.getPurchaseHistory().subscribe({
      next: (res) => {
        if (res.status === 'success' && res.data) {
          const items = res.data.items || [];
          this.purchaseHistory = {
            totalOrders: res.data.totalOrders || 0,
            totalSpent: res.data.totalSpent || 0,
            items: items.map((i: any) => ({
              id: i.sh_id,
              quantity: i.quantity,
              totalPrice: i.total_price,
              purchasedAt: i.purchased_at,
              productId: i.product_id,
              name: i.name,
              unitPrice: i.unit_price,
              currency: i.currency,
              image: this.resolveProductImage(i.image_url || i.image, i.name),
              status: i.status || 'Completed'
            }))
          };
        }
      },
      error: (err) => console.error('Failed to load history', err)
    });
  }

  // Checkout process
  proceedToCheckout() {
    this.showCart = false;
    this.showCheckoutModal = true;
    this.loadPaymentMethods();
  }

  closeCheckoutModal() {
    this.showCheckoutModal = false;
  }

  executeCheckout() {
    if (this.paymentMethods.length === 0) {
      alert('Please add a payment card first.');
      return;
    }

    this.isCheckoutProcessing = true;
    this.shopService.checkout('card').subscribe({
      next: (res) => {
        this.isCheckoutProcessing = false;
        if (res.status === 'success') {
          alert('🎉 Purchase Completed Successfully!');
          this.showCheckoutModal = false;
          this.loadCart();
          this.loadPurchaseHistory();
          this.activeTab = 'history'; // automatically switch to history to view purchase
        }
      },
      error: (err) => {
        this.isCheckoutProcessing = false;
        console.error('Checkout failed', err);
        alert(err.error?.message || 'Checkout failed. Please try again.');
      }
    });
  }
}
