import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ShopService } from '../../../Users/services/shop.service';
import { environment } from '../../../../Environments/environments.develompent';

interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  image: string;
  description: string;
  stock: number;
  stock_status?: string;
}

interface InventoryItem {
  id: number;
  name: string;
  image: string;
  quantity: number;
  price: number;
}

interface InventoryOrder {
  orderId: number;
  customerName: string;
  totalPrice: number;
  orderTime: string;
  items: InventoryItem[];
}

@Component({
  selector: 'app-admin-shop',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-shop.component.html',
  styleUrls: ['./admin-shop.component.scss']
})
export class AdminShopComponent implements OnInit {
  products: Product[] = [];
  filteredProducts: Product[] = [];
  searchQuery: string = '';
  selectedCategory: string = 'All';
  categories: string[] = ['All', 'Supplements', 'Gear'];
  activeView: 'products' | 'low-stock' | 'inventory-history' = 'products';
  lowStockProducts: Product[] = [];
  inventoryHistory: InventoryOrder[] = this.getDummyInventoryHistory();

  // Edit modal state
  showEditModal = false;
  editProduct: Product | null = null;
  editForm = {
    name: '',
    price: 0,
    description: '',
    stock: 0,
    category: ''
  };

  // Add modal state
  showAddModal = false;
  addForm = {
    name: '',
    price: 0,
    description: '',
    stock: 0,
    category: 'Gear'
  };

  selectedFile: File | null = null;
  imagePreview: string | null = null;
  isLoading = false;

  // Delete modal state
  showDeleteConfirm = false;
  productToDelete: Product | null = null;

  // Success message
  successMessage = '';

  constructor(private shopService: ShopService) {}

  ngOnInit() {
    this.loadProducts();
  }

  loadProducts() {
    this.isLoading = true;
    this.shopService.getProducts().subscribe({
      next: (res) => {
        if (res.status === 'success' && res.data) {
          this.products = res.data.map((p: any) => {
            const rawImageUrl = p.image_url || p.image;

const useDefaultImage =
  rawImageUrl?.includes('whey_protein') ||
  rawImageUrl?.includes('creatine') ||
  rawImageUrl?.includes('protein_bars') ||
  rawImageUrl?.includes('water_bottle') ||
  rawImageUrl?.includes('gym_bag') ||
  rawImageUrl?.includes('jump_ropes') ||
  rawImageUrl?.includes('workout_gloves') ||
  rawImageUrl?.includes('cotton_towel') ||
  rawImageUrl?.includes('shaker_bottle');

let finalImage = this.getProductImage(p.name);

if (!useDefaultImage && rawImageUrl) {
  const cleanUrl = rawImageUrl.replace(/\\/g, '/');

  finalImage = cleanUrl.startsWith('http')
    ? cleanUrl
    : `${environment.apiUrl?.replace('/api', '')}/${cleanUrl.startsWith('/') ? cleanUrl.substring(1) : cleanUrl}`;
}

            return {
              id: p.product_id || p.id,
              name: p.name,
              category: this.getProductCategory(p.name),
              price: p.price,
              image: finalImage,
              description: p.description || '',
              stock: p.stock_quantity ?? p.stock ?? p.quantity ?? p.stockQuantity ?? 0,
              stock_status: p.stock_status || 'IN_STOCK'
            };
          });
          this.filterProducts();
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Failed to load products', err);
        this.isLoading = false;
      }
    });
  }

  getProductCategory(name: string): string {
    const lower = name.toLowerCase();
    if (lower.includes('protein') || lower.includes('creatine') || lower.includes('pre-workout') || lower.includes('supplement') || lower.includes('bar')) {
      return 'Supplements';
    }
    return 'Gear';
  }

getProductImage(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('meal prep') || lower.includes('meal container') || lower.includes('food container') || lower.includes('container')) {
    return '/Images/supplements_bundle.jpeg';
  } else if (lower.includes('water bottle') || (lower.includes('bottle') && !lower.includes('shaker') && !lower.includes('meal'))) {
    return '/Images/water_bottle.jpeg';
  } else if (lower.includes('shaker')) {
    return '/Images/shaker_bottle.jpeg';
  } else if (lower.includes('towel')) {
    return '/Images/cotton_towel.jpeg';
  } else if (lower.includes('bag') || lower.includes('duffel')) {
    return '/Images/gym_bag.jpeg';
  } else if (lower.includes('glove')) {
    return '/Images/workout_gloves.jpeg';
  } else if (lower.includes('jump rope') || lower.includes('rope') || lower.includes('skipping')) {
    return '/Images/jump_ropes.jpeg';
  } else if (lower.includes('whey protein')) {
    return '/Images/whey_protein.jpeg';
  } else if (lower.includes('creatine')) {
    return '/Images/creatine.jpeg';
  } else if (lower.includes('protein bar') || lower.includes('bar')) {
    return '/Images/protein_bars.jpeg';
  } else if (lower.includes('bundle')) {
    return '/Images/supplements_bundle.jpeg';
  } else if (
    lower.includes('protein') ||
    lower.includes('pre-workout') ||
    lower.includes('supplement')
  ) {
    return 'https://images.unsplash.com/photo-1709976142774-ce1ef41a8378?auto=format&fit=crop&w=900&q=80';
  }
  return 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=900&q=80';
}

onImgError(event: Event, productName: string) {
  const img = event.target as HTMLImageElement;
  const fallback = this.getProductImage(productName);
  if (img.src !== fallback && !img.src.endsWith(fallback)) {
    img.src = fallback;
  }
}

  filterProducts() {
    this.filteredProducts = this.products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(this.searchQuery.toLowerCase());
      const matchesCategory = this.selectedCategory === 'All' || p.category === this.selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }

  getLowStockCount(): number {
    return this.products.filter(p => p.stock_status === 'LOW_STOCK' || p.stock_status === 'OUT_OF_STOCK').length;
  }

  switchView(view: 'products' | 'low-stock' | 'inventory-history') {
    this.activeView = view;
    if (view === 'products') {
      this.loadProducts();
    }
    if (view === 'low-stock') {
      this.loadLowStock();
    }
    if (view === 'inventory-history') {
      this.loadInventoryHistory();
    }
  }

  loadLowStock() {
    this.isLoading = true;
    this.shopService.getAdminLowStock().subscribe({
      next: (res) => {
        if (res.status === 'success' && res.data) {
          this.lowStockProducts = res.data.map((p: any) => ({
            id: p.product_id || p.id,
            name: p.name,
            category: this.getProductCategory(p.name),
            price: p.price,
            image: p.image_url || p.image || this.getProductImage(p.name),
            description: p.description || '',
            stock: p.stock_quantity ?? p.stock ?? p.quantity ?? p.stockQuantity ?? 0,
            stock_status: p.stock_status || 'LOW_STOCK'
          }));
        }
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Failed to load low stock products', err);
      }
    });
  }

  loadInventoryHistory() {
    this.isLoading = true;
    this.shopService.getAdminInventoryHistory().subscribe({
      next: (res) => {
        if (res.status === 'success' && res.data && res.data.length > 0) {
          this.inventoryHistory = res.data.map((order: any) => ({
            orderId: order.order_id || order.id || 0,
            customerName: order.customer_name || order.customerName || 'Unknown',
            totalPrice: order.total_price || order.totalPrice || 0,
            orderTime: order.created_at || order.order_time || order.time || '',
            items: (order.items || order.products || []).map((item: any) => ({
              id: item.product_id || item.id || 0,
              name: item.name || item.productName || 'Product',
              image: item.image_url || item.image || this.getProductImage(item.name || ''),
              quantity: item.quantity || item.qty || item.amount || 0,
              price: item.price || item.unit_price || item.total_price || 0,
            }))
          }));
        } else {
          this.inventoryHistory = this.getDummyInventoryHistory();
        }
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Failed to load inventory history', err);
        this.inventoryHistory = this.getDummyInventoryHistory();
      }
    });
  }

  private getDummyInventoryHistory(): InventoryOrder[] {
    return [
      {
        orderId: 1832,
        customerName: 'Mohamed Ali',
        totalPrice: 1840,
        orderTime: '2026-06-13T18:24:00',
        items: [
          {
            id: 1,
            name: 'Whey Protein Isolate',
            image: '/Images/whey_protein.jpeg',
            quantity: 2,
            price: 750
          },
          {
            id: 6,
            name: 'Gym Bag',
            image: '/Images/gym_bag.jpeg',
            quantity: 1,
            price: 340
          }
        ]
      },
      {
        orderId: 1833,
        customerName: 'Sara Hassan',
        totalPrice: 1260,
        orderTime: '2026-06-14T10:12:00',
        items: [
          {
            id: 3,
            name: 'Creatine Monohydrate',
            image: '/Images/creatine.jpeg',
            quantity: 1,
            price: 420
          },
          {
            id: 2,
            name: 'Protein Bars Pack',
            image: '/Images/protein_bars.jpeg',
            quantity: 2,
            price: 420
          },
          {
            id: 5,
            name: 'Shaker Bottle',
            image: '/Images/shaker_bottle.jpeg',
            quantity: 1,
            price: 120
          }
        ]
      },
      {
        orderId: 1834,
        customerName: 'Omar Youssef',
        totalPrice: 2250,
        orderTime: '2026-06-15T15:40:00',
        items: [
          {
            id: 4,
            name: 'Pre-Workout Formula',
            image: 'https://images.unsplash.com/photo-1709976142774-ce1ef41a8378?auto=format&fit=crop&w=900&q=80',
            quantity: 3,
            price: 550
          }
        ]
      }
    ];
  }

  getStockStatus(product: Product): string {
    if (product.stock === 0) return 'out';
    if (product.stock <= 20) return 'low';
    return 'in-stock';
  }

  getStockLabel(product: Product): string {
    if (product.stock === 0) return 'Out of Stock';
    if (product.stock <= 20) return 'Low Stock';
    return 'High Stock';
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.imagePreview = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  // Add product
  openAdd() {
    this.addForm = {
      name: '',
      price: 0,
      description: '',
      stock: 0,
      category: 'Gear'
    };
    this.selectedFile = null;
    this.imagePreview = null;
    this.showAddModal = true;
  }

  saveAdd() {
    if (!this.addForm.name.trim()) {
      alert('Please enter a product name');
      return;
    }
    if (this.addForm.price < 0) {
      alert('Price cannot be negative');
      return;
    }
    if (this.addForm.stock < 0) {
      alert('Stock cannot be negative');
      return;
    }

    const formData = new FormData();
    formData.append('name', this.addForm.name.trim());
    formData.append('price', this.addForm.price.toString());
    formData.append('stock_quantity', this.addForm.stock.toString());
    formData.append('quantity', this.addForm.stock.toString()); // Fallback
    formData.append('stock', this.addForm.stock.toString()); // Fallback
    formData.append('stockQuantity', this.addForm.stock.toString()); // Fallback
    formData.append('amount', this.addForm.stock.toString()); // Fallback
    formData.append('description', this.addForm.description.trim() || `${this.addForm.name} - high quality gym essential.`);
    formData.append('category', this.addForm.category);
    
    if (this.selectedFile) {
      formData.append('image', this.selectedFile);
      formData.append('photo', this.selectedFile); // Fallback
      formData.append('image_url', this.selectedFile); // Fallback
    }

    this.isLoading = true;
    this.shopService.addAdminProduct(formData).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.showAddModal = false;
        this.showSuccess('Product added successfully!');
        this.loadProducts();
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Failed to add product', err);
        alert('Failed to add product. Please try again.');
      }
    });
  }

  cancelAdd() {
    this.showAddModal = false;
  }

  // Edit product
  openEdit(product: Product, event: Event) {
    event.stopPropagation();
    this.editProduct = product;
    this.editForm = {
      name: product.name,
      price: product.price,
      description: product.description,
      stock: product.stock,
      category: product.category
    };
    this.selectedFile = null;
    this.imagePreview = product.image;
    this.showEditModal = true;
  }

  saveEdit() {
    if (!this.editProduct) return;
    
    const formData = new FormData();
    formData.append('name', this.editForm.name.trim());
    formData.append('price', this.editForm.price.toString());
    formData.append('stock_quantity', this.editForm.stock.toString());
    formData.append('quantity', this.editForm.stock.toString()); // Fallback
    formData.append('stock', this.editForm.stock.toString()); // Fallback
    formData.append('stockQuantity', this.editForm.stock.toString()); // Fallback
    formData.append('amount', this.editForm.stock.toString()); // Fallback
    formData.append('description', this.editForm.description.trim());
    formData.append('category', this.editForm.category);
    
    if (this.selectedFile) {
      formData.append('image', this.selectedFile);
      formData.append('photo', this.selectedFile); // Fallback
      formData.append('image_url', this.selectedFile); // Fallback
    }

    this.isLoading = true;
    this.shopService.updateAdminProduct(this.editProduct.id, formData).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.showEditModal = false;
        this.editProduct = null;
        this.showSuccess('Product updated successfully!');
        this.loadProducts();
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Failed to update product', err);
        alert('Failed to update product. Please try again.');
      }
    });
  }

  cancelEdit() {
    this.showEditModal = false;
    this.editProduct = null;
  }

  // Delete product
  confirmDelete(product: Product, event: Event) {
    event.stopPropagation();
    this.productToDelete = product;
    this.showDeleteConfirm = true;
  }

  deleteProduct() {
    if (!this.productToDelete) return;
    
    this.isLoading = true;
    this.shopService.deleteAdminProduct(this.productToDelete.id).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.showDeleteConfirm = false;
        this.productToDelete = null;
        this.showSuccess('Product deleted successfully!');
        this.loadProducts();
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Failed to delete product', err);
        alert('Failed to delete product. Please try again.');
      }
    });
  }

  cancelDelete() {
    this.showDeleteConfirm = false;
    this.productToDelete = null;
  }

  private showSuccess(message: string) {
    this.successMessage = message;
    setTimeout(() => {
      this.successMessage = '';
    }, 3000);
  }
}
