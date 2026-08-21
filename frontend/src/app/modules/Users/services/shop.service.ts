import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../Environments/environments.develompent';

@Injectable({
  providedIn: 'root'
})
export class ShopService {
  private baseUrl = `${environment.apiUrl}/shop`;

  constructor(private http: HttpClient) { }

  // 1️⃣ Products
  getProducts(): Observable<any> {
    return this.http.get(`${this.baseUrl}/products`);
  }

  // 2️⃣ Cart
  getCart(): Observable<any> {
    return this.http.get(`${this.baseUrl}/cart`);
  }

  addToCart(productId: number, quantity: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/cart`, { productId, quantity });
  }

  updateCartItem(cartId: number, quantity: number): Observable<any> {
    return this.http.put(`${this.baseUrl}/cart/${cartId}`, { quantity });
  }

  removeFromCart(cartId: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/cart/${cartId}`);
  }

  clearCart(): Observable<any> {
    return this.http.delete(`${this.baseUrl}/cart`);
  }

  // 3️⃣ Checkout
  checkout(paymentMethod: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/checkout`, { paymentMethod });
  }

  // 4️⃣ Purchase History
  getPurchaseHistory(): Observable<any> {
    return this.http.get(`${this.baseUrl}/history`);
  }

  // 5️⃣ Payment Methods
  getPaymentMethods(): Observable<any> {
    return this.http.get(`${this.baseUrl}/payment-methods`);
  }

  addPaymentMethod(cardType: string, cardLast4: string, cardHolder: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/payment-methods`, { cardType, cardLast4, cardHolder });
  }

  deletePaymentMethod(pmId: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/payment-methods/${pmId}`);
  }

  // 6️⃣ Admin Products Management
  addAdminProduct(formData: FormData): Observable<any> {
    return this.http.post(`${this.baseUrl}/admin/products`, formData);
  }

  updateAdminProduct(productId: number, formData: FormData): Observable<any> {
    return this.http.put(`${this.baseUrl}/admin/products/${productId}`, formData);
  }

  deleteAdminProduct(productId: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/admin/products/${productId}`);
  }

  getAdminLowStock(): Observable<any> {
    return this.http.get(`${this.baseUrl}/admin/low-stock`);
  }

  getAdminInventoryHistory(): Observable<any> {
    return this.http.get(`${this.baseUrl}/admin/inventory-history`);
  }
}
