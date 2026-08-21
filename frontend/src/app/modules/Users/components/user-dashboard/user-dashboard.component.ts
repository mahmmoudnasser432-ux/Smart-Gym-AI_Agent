import { Component, ViewChild, ElementRef, AfterViewChecked, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { AuthenticationService } from '../../../Authentication/services/authentication.service';
import { environment } from '../../../../Environments/environments.develompent';
import { TokenService } from '../../services/token.service';
import { ChatService, ChatMessage } from '../../../../services/chat.service';

interface Message {
  role: 'user' | 'assistant' | 'coach';
  content: string;
}

@Component({
  selector: 'app-user-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    ReactiveFormsModule,
    CommonModule
  ],
  templateUrl: './user-dashboard.component.html',
  styleUrls: ['./user-dashboard.component.scss']
})
export class UserDashboardComponent implements AfterViewChecked, OnInit, OnDestroy {

  @ViewChild('chatMessages') private chatMessagesRef!: ElementRef;

  userName = '';
  userEmail = '';
  userPhone = '';
  userTokens: number = 0;
  userRole: string = 'user'; // إضافة role للتحقق من صلاحيات المستخدم

  showCoachChat = false;
  showAIChat = false;
  showInboxChat = false;
  showProfileModal = false;
  userMessage = '';
  aiMessage = '';
  inboxMessageInput = '';
  isLoading = false;
  aiLoading = false;
  inboxLoading = false;
  historyLoading = false;
  unreadInboxCount = 0;
  messages: Message[] = [];
  aiMessages: Message[] = [];
  inboxMessages: Message[] = [];
  aiSessionId: string | null = null;

  profileImageUrl: string = '';
  canChangeProfilePicture = false; // للتحقق من الصلاحية

  passwordForm!: FormGroup;
  passwordLoading = false;
  passwordSuccess = '';
  passwordError = '';
  showNewPassword = false;
  showConfirmPassword = false;

  private shouldScroll = false;
  private inboxPollInterval: any;

  constructor(
    public authService: AuthenticationService,
    private router: Router,
    private fb: FormBuilder,
    private tokenService: TokenService,
    private chatService: ChatService
  ) { }

  // ✅ رجعنا hasPlan
  get hasPlan(): boolean {
    return localStorage.getItem('hasPlan') === 'true';
  }

  ngOnInit(): void {
    const savedUser = localStorage.getItem('userData');

    if (savedUser) {
      const user = JSON.parse(savedUser);
      this.userName = user.name || user.username || user.email || 'User';
      this.userEmail = user.email || '';
      this.userPhone = user.phone || '';
      this.userRole = user.role || 'user'; // قراءة الـ role من userData
    } else {
      const user = this.authService.getUserData();
      this.userName = user?.name || user?.username || user?.email || 'User';
      this.userEmail = user?.email || '';
      this.userPhone = user?.phone || '';
      this.userRole = user?.role || 'user';
    }

    // التحقق من أن المستخدم يمكنه تغيير صورته (فقط customers يمكنهم)
    this.canChangeProfilePicture = this.userRole === 'user' || this.userRole === 'customer';

    // قراءة الصورة من userData فقط (لا نقرأها من per-email localStorage)
    const savedUserStr = localStorage.getItem('userData') || localStorage.getItem('user');
    if (savedUserStr) {
      const userObj = JSON.parse(savedUserStr);
      const imageUrl = userObj.profile_picture_url || userObj.photo || '';
      if (imageUrl) {
        this.profileImageUrl = imageUrl;
      }
    }

    // لو لم تكن هناك صورة، نستخدم صورة افتراضية محسوبة من الاسم
    if (!this.profileImageUrl) {
      this.profileImageUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(this.userName)}&background=ff8a00&color=fff&size=90`;
    }

    const savedTokens = localStorage.getItem('userTokens');
    this.userTokens = savedTokens !== null ? +savedTokens : 0;
    this.fetchTokens();
    this.fetchUnreadCount();

    this.passwordForm = this.fb.group({
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    }, { validators: this.passwordMatchValidator });

    // Join chat via Socket
    const userDataStr = localStorage.getItem('userData') || localStorage.getItem('user');
    if (userDataStr) {
      const userData = JSON.parse(userDataStr);
      if (userData?.id) {
        this.chatService.joinUserChat(userData.id);
      }
    }

    // Listen for incoming messages from coach or admin (inbox)
    this.chatService.messages$.subscribe((msg: any) => {
      console.log('Socket message received in user dashboard:', msg);
      if (msg.sent_by === 'coach' || msg.sent_by === 'system') {
        this.messages.push({ role: 'coach', content: msg.content });
        this.shouldScroll = true;
      } else if (msg.sender_type === 'admin' || msg.sent_by === 'admin') {
        const exists = this.inboxMessages.some(m => m.content === msg.content);
        if (!exists) {
          this.inboxMessages.push({ role: 'coach', content: msg.content });
          this.shouldScroll = true;
        }
        this.fetchUnreadCount();
      }
    });
  }

  // ========================
  // Coach Chat
  // ========================

  openCoachChat() {
    this.showCoachChat = true;
    this.messages = [];
    this.historyLoading = true;

    // Load chat history
    this.chatService.getUserChatHistory().subscribe({
      next: (res: any[]) => {
        const history = res || [];
        this.messages = history.map((m: any) => ({
          role: (m.sent_by === 'coach' || m.sender_type === 'coach' || m.sent_by === 'system') ? 'coach' : 'user',
          content: m.content
        }));
        this.historyLoading = false;
        this.shouldScroll = true;
      },
      error: (err) => {
        console.error('Error loading chat history', err);
        this.historyLoading = false;
      }
    });
  }

  sendCoachMessage() {
    if (!this.userMessage.trim() || this.isLoading) return;

    const userMsg = this.userMessage.trim();
    this.messages.push({ role: 'user', content: userMsg });
    this.userMessage = '';
    this.isLoading = true;
    this.shouldScroll = true;

    this.chatService.sendUserMessage(userMsg).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.shouldScroll = true;
      },
      error: (err) => {
        this.messages.push({ role: 'coach', content: 'Connection error ⚠️' });
        this.isLoading = false;
        this.shouldScroll = true;
      }
    });
  }

  onCoachChatEnter(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendCoachMessage();
    }
  }

  // ========================
  // AI Chat
  // ========================

  openAIChat() {
    this.showAIChat = true;
    this.historyLoading = true;
    this.aiMessages = [];
    this.chatService.getAIChatHistory(this.aiSessionId || undefined).subscribe({
      next: (res: any) => {
        let history: any[] = [];
        let fetchedSessionId: string | null = null;

        if (res) {
          if (res.data?.sessionId) {
            fetchedSessionId = res.data.sessionId;
          } else if (res.sessionId) {
            fetchedSessionId = res.sessionId;
          }

          if (Array.isArray(res)) {
            history = res;
          } else if (Array.isArray(res.data)) {
            history = res.data;
          } else if (res.data && Array.isArray(res.data.messages)) {
            history = res.data.messages;
          } else if (Array.isArray(res.history)) {
            history = res.history;
          } else if (Array.isArray(res.messages)) {
            history = res.messages;
          } else if (Array.isArray(res.chat)) {
            history = res.chat;
          }
        }

        if (fetchedSessionId) {
          this.aiSessionId = fetchedSessionId;
        }

        if (history.length > 0) {
          this.aiMessages = history.map((m: any) => {
            let role: 'user' | 'assistant' | 'coach' = 'assistant';
            const mRole = m.role || m.sender || m.sent_by || m.sender_type;
            if (mRole === 'user' || mRole === 'customer') {
              role = 'user';
            } else if (mRole === 'assistant' || mRole === 'model' || mRole === 'bot' || mRole === 'ai') {
              role = 'assistant';
            }
            return {
              role: role,
              content: m.content || m.message || ''
            };
          });
        } else {
          this.aiMessages = [
            {
              role: 'assistant',
              content: 'Hello! 💪 I\'m your AI Coach. Ask me anything about workouts, nutrition, or fitness tips!'
            }
          ];
        }
        this.historyLoading = false;
        this.shouldScroll = true;
      },
      error: (err) => {
        console.error('Error loading AI chat history', err);
        this.aiMessages = [
          {
            role: 'assistant',
            content: 'Hello! 💪 I\'m your AI Coach. Ask me anything about workouts, nutrition, or fitness tips!'
          }
        ];
        this.historyLoading = false;
        this.shouldScroll = true;
      }
    });
  }

  sendAIMessage() {
    if (!this.aiMessage.trim() || this.aiLoading) return;

    const userMsg = this.aiMessage.trim();
    this.aiMessages.push({ role: 'user', content: userMsg });
    this.aiMessage = '';
    this.aiLoading = true;
    this.shouldScroll = true;

    this.chatService.sendAIMessage(userMsg, this.aiSessionId || undefined).subscribe({
      next: (res) => {
        const reply = res?.data?.reply || res?.data?.message || res?.reply || res?.message || res?.response || 'No response';
        if (res?.data?.sessionId) {
          this.aiSessionId = res.data.sessionId;
        }
        this.aiMessages.push({ role: 'assistant', content: reply });
        this.aiLoading = false;
        this.shouldScroll = true;
      },
      error: (err) => {
        this.aiMessages.push({ role: 'assistant', content: 'AI is currently unavailable. Please try again later. ⚠️' });
        this.aiLoading = false;
        this.shouldScroll = true;
      }
    });
  }

  onAIChatEnter(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendAIMessage();
    }
  }

  // ========================
  // Tokens & Profile
  // ========================

  fetchTokens() {
    this.tokenService.getBalance().subscribe({
      next: (res: any) => {
        this.userTokens = res.balance ?? res.data?.balance;
        localStorage.setItem('userTokens', String(this.userTokens));
      },
      error: (err) => console.error('Error fetching tokens:', err)
    });
  }


  // ✅ حفظ البيانات بشكل صحيح ودمجها مع البيانات القديمة - فقط في userData
  saveUserData(serverUser?: any) {
    const savedUserStr = localStorage.getItem('userData') || localStorage.getItem('user');
    let user = savedUserStr ? JSON.parse(savedUserStr) : {};

    if (serverUser) {
      // لو السيرفر بعت بيانات، نستخدمها هي الأساس
      user = { ...user, ...serverUser };
    } else {
      // لو هنحفظ اللي في الفورم بس
      user.name = this.userName;
      user.username = this.userName;
      user.email = this.userEmail;
      user.phone = this.userPhone;
    }

    // حفظ البيانات في userData فقط، لا نحتاج لـ per-email localStorage
    localStorage.setItem('userData', JSON.stringify(user));
    localStorage.setItem('user', JSON.stringify(user));

    // تحديث المتغيرات المحلية للتأكد من المزامنة
    this.userName = user.name || user.username || user.email || 'User';
    this.userEmail = user.email || '';
    this.userPhone = user.phone || '';
  }

  onUpdateProfile() {
    const updateData = {
      username: this.userName,
      name: this.userName, // أضفنا name احتياطاً لو الباك إند بيستخدمه
      phone: this.userPhone
    };

    console.log('Attempting to update profile with:', updateData);

    this.authService.updateProfile(updateData).subscribe({
      next: (res: any) => {
        console.log('Profile updated successfully on server:', res);
        const updatedUser = res.data?.user || res.user || res.data || null;
        this.saveUserData(updatedUser);
        this.showProfileModal = false;
      },
      error: (err) => {
        console.error('Error updating profile on server:', err);
        this.saveUserData();
        this.showProfileModal = false;
      }
    });
  }

  toggleNewPassword() {
    this.showNewPassword = !this.showNewPassword;
  }

  toggleConfirmPassword() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  onChangePassword() {
    if (this.passwordForm.invalid) return;
    this.passwordLoading = true;
    setTimeout(() => {
      this.passwordLoading = false;
      this.passwordSuccess = 'Password changed successfully!';
      this.passwordForm.reset();
    }, 1000);
  }

  passwordMatchValidator(control: AbstractControl) {
    const newPass = control.get('newPassword');
    const confirm = control.get('confirmPassword');
    if (newPass && confirm && newPass.value !== confirm.value) {
      confirm.setErrors({ mismatch: true });
    }
    return null;
  }

  onImageChange(event: any) {
    // ✅ التحقق من أن المستخدم يمكنه تغيير صورته
    if (!this.canChangeProfilePicture) {
      alert('Only customers can change their profile picture!');
      event.target.value = '';
      return;
    }

    const file = event.target.files[0];
    if (file) {
      // Show local preview immediately (Base64)
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.profileImageUrl = e.target.result;
      };
      reader.readAsDataURL(file);

      // Upload to server
      const formData = new FormData();
      formData.append('photo', file);

      this.authService.updateProfilePicture(formData).subscribe({
        next: (res: any) => {
          console.log('Profile picture uploaded:', res);
          if (res.data && res.data.profile_picture_url) {
            let relativeUrl = res.data.profile_picture_url;
            if (relativeUrl && !relativeUrl.startsWith('http://') && !relativeUrl.startsWith('https://')) {
              const hostUrl = environment.apiUrl.replace(/\/api\/?$/, '');
              relativeUrl = hostUrl + (relativeUrl.startsWith('/') ? '' : '/') + relativeUrl;
            }
            const newUrl = relativeUrl + '?t=' + Date.now();
            this.profileImageUrl = newUrl;

            // ✅ حفظ الصورة في userData فقط (لا نستخدم per-email localStorage)
            const savedUserStr = localStorage.getItem('userData') || localStorage.getItem('user');
            if (savedUserStr) {
              const userObj = JSON.parse(savedUserStr);
              userObj.profile_picture_url = newUrl;
              localStorage.setItem('userData', JSON.stringify(userObj));
              localStorage.setItem('user', JSON.stringify(userObj));
            }
          }
          event.target.value = '';
        },
        error: (err) => {
          console.error('Error uploading profile picture:', err);
          alert('Failed to upload profile picture. Please try again.');
          event.target.value = '';
        }
      });
    }
  }

  fetchUnreadCount() {
    this.chatService.getUnreadCount().subscribe({
      next: (res: any) => {
        this.unreadInboxCount = res.unread_count ?? res.data?.unread_count ?? 0;
      },
      error: (err) => console.error('Error fetching unread count:', err)
    });
  }

  openInbox() {
    this.showInboxChat = true;
    this.inboxMessages = [];
    this.inboxLoading = true;
    this.shouldScroll = true;

    this.loadInboxMessagesSilently();

    // Start polling every 5 seconds for real-time inbox updates
    this.clearInboxPoll();
    this.inboxPollInterval = setInterval(() => {
      if (this.showInboxChat) {
        this.loadInboxMessagesSilently();
      } else {
        this.clearInboxPoll();
      }
    }, 5000);
  }

  loadInboxMessagesSilently() {
    this.chatService.getInboxMessages().subscribe({
      next: (res: any) => {
        const history = Array.isArray(res) ? res : (res?.data || res || []);
        if (history.length !== this.inboxMessages.length) {
          this.inboxMessages = history.map((m: any) => ({
            role: m.sender_type === 'admin' ? 'coach' : 'user',
            content: m.content
          }));
          this.shouldScroll = true;
        }
        this.inboxLoading = false;
        this.fetchUnreadCount();
      },
      error: (err) => {
        console.error('Error fetching inbox history', err);
        this.inboxLoading = false;
      }
    });
  }

  clearInboxPoll() {
    if (this.inboxPollInterval) {
      clearInterval(this.inboxPollInterval);
      this.inboxPollInterval = null;
    }
  }

  ngOnDestroy() {
    this.clearInboxPoll();
  }

  sendInboxReply() {
    if (!this.inboxMessageInput.trim() || this.inboxLoading) return;

    const content = this.inboxMessageInput.trim();
    this.inboxMessages.push({ role: 'user', content: content });
    this.inboxMessageInput = '';
    this.inboxLoading = true;
    this.shouldScroll = true;

    this.chatService.replyToInbox(content).subscribe({
      next: (res: any) => {
        this.inboxLoading = false;
        this.shouldScroll = true;
      },
      error: (err) => {
        console.error('Error replying to inbox', err);
        this.inboxLoading = false;
        this.shouldScroll = true;
      }
    });
  }

  onInboxEnter(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendInboxReply();
    }
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
    } catch { }
  }
}