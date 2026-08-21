import { Component, ViewChild, ElementRef, AfterViewChecked, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthenticationService } from '../../../Authentication/services/authentication.service';
import { ChatService } from '../../../../services/chat.service';
import { AdminService } from '../../../../services/admin.service';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sent_at?: string;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    FormsModule,
    CommonModule
  ],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements AfterViewChecked, OnInit, OnDestroy {

  @ViewChild('chatMessages') private chatMessagesRef!: ElementRef;

  userName = '';
  userEmail = '';
  userPhone = '';
  profileImageUrl: string = 'https://ui-avatars.com/api/?name=Admin&background=ff8a00&color=fff&size=90';

  showProfileModal = false;
  sidebarOpen = false;
  showChat = false;
  userMessage = '';
  isLoading = false;
  messages: Message[] = [];
  selectedCustomerChat: any = null;
  inboxUsers: any[] = [];

  private shouldScroll = false;
  private conversationPollInterval: any;

  // Real stats
  totalMembers = 0;
  activeToday = 0;
  totalRevenue = 0;
  tokensUsedToday = 0;

  constructor(
    public authService: AuthenticationService,
    private router: Router,
    private chatService: ChatService,
    private adminService: AdminService
  ) {}
  ngOnInit(): void {
    const savedUser = localStorage.getItem('userData');
    let email = '';
    if (savedUser) {
      const user = JSON.parse(savedUser);
      this.userName = user.name || user.username || user.email || 'Admin';
      this.userEmail = user.email || '';
      this.userPhone = user.phone || '';
      email = user.email || '';
      if (user.id) {
        this.chatService.joinUserChat(user.id);
      }
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

    this.loadDashboardStats();
    this.loadInboxUsers();

    this.chatService.messages$.subscribe((msg: any) => {
      console.log('Socket message received in admin dashboard:', msg);
      if (this.selectedCustomerChat) {
        this.loadConversationSilently();
      } else {
        this.loadInboxUsers();
      }
    });
  }

  loadDashboardStats(): void {
    this.adminService.getDashboardSummary().subscribe({
      next: (res: any) => {
        if (res.status === 'success' && res.data) {
          this.totalMembers = res.data.total_users || 0;
          this.activeToday = res.data.checkins_today || 0;
          this.totalRevenue = res.data.total_revenue || 0;
          this.tokensUsedToday = res.data.total_plans_generated || 0;
        }
      },
      error: (err: any) => console.error('Error fetching dashboard stats:', err)
    });
  }

  onUpdateProfile(): void {
    const savedUserStr = localStorage.getItem('userData') || localStorage.getItem('user');
    const currentUser = savedUserStr ? JSON.parse(savedUserStr) : {};
    const updatedUser = {
      ...currentUser,
      name: this.userName,
      email: this.userEmail,
      phone: this.userPhone
    };
    localStorage.setItem('userData', JSON.stringify(updatedUser));
    this.showProfileModal = false;
  }

  loadInboxUsers(): void {
    this.chatService.getInboxUsers().subscribe({
      next: (res: any) => {
        this.inboxUsers = res.data || res || [];
      },
      error: (err) => {
        console.error('Error fetching inbox users:', err);
      }
    });
  }

  openCustomerChat(user: any): void {
    this.selectedCustomerChat = user;
    this.messages = [];
    this.isLoading = true;
    this.showChat = true;
    this.shouldScroll = true;

    // Join user room to get real-time socket events
    this.chatService.joinUserChat(user.user_id);

    this.loadConversationSilently();

    // Start polling every 5 seconds for real-time updates
    this.clearConversationPoll();
    this.conversationPollInterval = setInterval(() => {
      if (this.showChat && this.selectedCustomerChat) {
        this.loadConversationSilently();
      } else {
        this.clearConversationPoll();
      }
    }, 5000);
  }

  loadConversationSilently() {
    if (!this.selectedCustomerChat) return;
    this.chatService.getInboxConversation(this.selectedCustomerChat.user_id).subscribe({
      next: (res: any) => {
        const chatHistory = Array.isArray(res) ? res : (res?.data || res || []);
        if (chatHistory.length !== this.messages.length) {
          this.messages = chatHistory.map((m: any) => ({
            role: m.sender_type === 'admin' ? 'user' : 'assistant',
            content: m.content,
            sent_at: m.sent_at
          }));
          this.shouldScroll = true;
        }
        this.isLoading = false;
        this.loadInboxUsers(); // Refresh unread counts
      },
      error: (err) => {
        console.error('Error fetching conversation:', err);
        this.isLoading = false;
      }
    });
  }

  clearConversationPoll() {
    if (this.conversationPollInterval) {
      clearInterval(this.conversationPollInterval);
      this.conversationPollInterval = null;
    }
  }

  ngOnDestroy() {
    this.clearConversationPoll();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  private scrollToBottom(): void {
    try {
      const el = this.chatMessagesRef?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    } catch {}
  }

  sendMessage(): void {
    if (!this.userMessage.trim() || !this.selectedCustomerChat || this.isLoading) return;

    const content = this.userMessage.trim();
    this.userMessage = '';
    this.isLoading = true;
    this.shouldScroll = true;

    this.chatService.sendInboxMessage(this.selectedCustomerChat.user_id, content).subscribe({
      next: (res: any) => {
        const newMsg = res.data || res;
        this.messages.push({
          role: 'user', // admin
          content: newMsg.content,
          sent_at: newMsg.sent_at
        });
        this.isLoading = false;
        this.shouldScroll = true;
        this.loadInboxUsers();
      },
      error: (err) => {
        console.error('Error sending message:', err);
        this.isLoading = false;
      }
    });
  }

  onEnter(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }
}
