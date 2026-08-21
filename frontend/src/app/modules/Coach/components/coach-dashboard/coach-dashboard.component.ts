import { Component, ViewChild, ElementRef, AfterViewChecked, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthenticationService } from '../../../Authentication/services/authentication.service';

import { ChatService, ChatMessage } from '../../../../services/chat.service';
import { CoachService } from '../../../../services/coach.service';

interface Message {
  role: 'user' | 'assistant' | 'coach';
  content: string;
}

interface Conversation {
  user_id: number;
  username: string;
  last_message: string;
  sent_at: string;
  partner_role: string;
}

@Component({
  selector: 'app-coach-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    FormsModule,
    CommonModule
  ],
  templateUrl: './coach-dashboard.component.html',
  styleUrls: ['./coach-dashboard.component.scss']
})
export class CoachDashboardComponent implements AfterViewChecked, OnInit {

  @ViewChild('chatMessages') private chatMessagesRef!: ElementRef;

  userName = '';
  profileImageUrl: string = 'https://ui-avatars.com/api/?name=Coach&background=ff8a00&color=fff&size=90';

  showMenu = false;
  showChat = false;
  userMessage = '';
  isLoading = false;
  messages: Message[] = [];
  conversations: Conversation[] = [];
  selectedCustomerChat: Conversation | null = null;

  private shouldScroll = false;

  constructor(
    public authService: AuthenticationService,
    private router: Router,
    private chatService: ChatService,
    private coachService: CoachService
  ) {}

  ngOnInit(): void {
    const savedUser = localStorage.getItem('userData') || localStorage.getItem('user');
    let email = '';
    if (savedUser) {
      const user = JSON.parse(savedUser);
      this.userName = user.name || user.username || user.email || 'Coach';
      email = user.email || '';
      
      // Join coach chat using ID
      if (user.id) {
        this.chatService.joinCoachChat(user.id);
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

    // Load conversations and customers merged list
    this.loadConversationsAndCustomers();

    // Listen for incoming messages from users
    this.chatService.messages$.subscribe((msg: any) => {
      // Refresh the conversations list from server on any message to ensure new users appear instantly
      this.loadConversationsAndCustomers();

      // If currently chatting with this customer, append the message
      if (this.selectedCustomerChat) {
        const msgUserId = msg.user_id || msg.from_user_id || msg.to_user_id || msg.partner_id;
        const selectedId = this.selectedCustomerChat.user_id;

        if (msgUserId === selectedId && msg.sent_by === 'user') {
          this.messages.push({
            role: 'user',
            content: msg.content
          });
          this.shouldScroll = true;
        }
      }
    });
  }

  loadConversationsAndCustomers() {
    this.chatService.getConversations().subscribe({
      next: (convRes) => {
        let activeConv: Conversation[] = [];
        if (convRes.status === 'success' && convRes.data) {
          activeConv = convRes.data;
        }

        this.coachService.getCustomersList().subscribe({
          next: (custRes) => {
            if (custRes.status === 'success' && custRes.data) {
              const allCustomers = custRes.data;
              const merged: Conversation[] = [...activeConv];

              allCustomers.forEach((cust: any) => {
                const exists = merged.some(c => c.user_id === cust.user_id);
                if (!exists) {
                  merged.push({
                    user_id: cust.user_id,
                    username: cust.username,
                    last_message: '',
                    sent_at: '',
                    partner_role: 'user'
                  });
                }
              });

              this.conversations = merged;
            } else {
              this.conversations = activeConv;
            }
          },
          error: (err) => {
            console.error('Error fetching customers list in dashboard', err);
            this.conversations = activeConv;
          }
        });
      },
      error: (err) => {
        console.error('Error fetching conversations', err);
        this.coachService.getCustomersList().subscribe({
          next: (custRes) => {
            if (custRes.status === 'success' && custRes.data) {
              this.conversations = custRes.data.map((c: any) => ({
                user_id: c.user_id,
                username: c.username,
                last_message: '',
                sent_at: '',
                partner_role: 'user'
              }));
            }
          }
        });
      }
    });
  }

  openCustomerChat(conversation: Conversation) {
    this.selectedCustomerChat = conversation;
    this.messages = [];
    this.showChat = true;
    this.isLoading = true;

    // Fetch chat history
    this.chatService.getChatHistory(conversation.user_id).subscribe({
      next: (res: any[]) => {
        const history = res || [];
        this.messages = history.map((m: any) => ({
          role: m.sent_by === 'coach' ? 'coach' : 'user',
          content: m.content
        }));
        this.isLoading = false;
        this.shouldScroll = true;
      },
      error: (err) => {
        console.error('Error fetching chat history', err);
        this.isLoading = false;
      }
    });
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

  sendMessage() {
    if (!this.userMessage.trim() || this.isLoading || !this.selectedCustomerChat) return;

    const coachMsg = this.userMessage.trim();
    this.messages.push({ role: 'coach', content: coachMsg });
    this.userMessage = '';
    this.isLoading = true;
    this.shouldScroll = true;

    this.chatService.sendCoachMessage(this.selectedCustomerChat.user_id, coachMsg).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.shouldScroll = true;
      },
      error: (err) => {
        this.messages.push({ role: 'assistant', content: 'Failed to send message.' });
        this.isLoading = false;
        this.shouldScroll = true;
      }
    });
  }

  onEnter(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }
}
