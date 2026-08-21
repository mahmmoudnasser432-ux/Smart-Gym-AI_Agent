import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, of, map } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { io, Socket } from 'socket.io-client';
import { environment } from '../Environments/environments.develompent';

export interface ChatMessage {
  message_id?: number;
  from_coach_id?: number;
  to_user_id?: number;
  content: string;
  sent_at?: string;
  read_flag?: boolean;
  sent_by: 'user' | 'coach' | 'system';
  assigned_coach_id?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private socket!: Socket;

  // Observable for incoming messages
  private messagesSubject = new Subject<ChatMessage>();
  public messages$ = this.messagesSubject.asObservable();

  constructor(private http: HttpClient) {
    this.initSocket();
  }

  private initSocket() {
    const apiUrl = environment.apiUrl;
    const socketUrl = apiUrl.replace(/\/api\/?$/, '');

    this.socket = io(socketUrl, {
      auth: {
        token: localStorage.getItem('token') || ''
      },
      query: {
        token: localStorage.getItem('token') || ''
      }
    });

    this.socket.on('chat:message', (msg: ChatMessage) => {
      this.messagesSubject.next(msg);
    });

    this.socket.on('message:new', (msg: ChatMessage) => {
      this.messagesSubject.next(msg);
    });

    this.socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
    });
  }

  // Socket Events
  joinUserChat(userId: number) {
    if (this.socket) {
      this.socket.emit('chat:join', userId);
      this.socket.emit('join', `user:${userId}`);
    }
  }

  joinCoachChat(coachId: number) {
    if (this.socket) {
      this.socket.emit('coach:join', coachId);
      this.socket.emit('join', `coach:${coachId}`);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  private getHeaders() {
    const token = localStorage.getItem('token') || '';
    return { Authorization: `Bearer ${token}` };
  }
private normalizeHistoryResponse(response: any): any[] {
  if (!response) {
    return [];
  }

  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response.data)) {
    return response.data;
  }

  if (response.data && Array.isArray(response.data.messages)) {
    return response.data.messages;
  }

  if (Array.isArray(response.history)) {
    return response.history;
  }

  if (Array.isArray(response.messages)) {
    return response.messages;
  }

  if (Array.isArray(response.chat)) {
    return response.chat;
  }

  return [];
}

  // ========================
  // USER Chat Endpoints
  // ========================

  /** Send message to real coach (no coachId needed) */
  sendUserMessage(content: string): Observable<any> {
    return this.http.post(`${environment.apiUrl}/chat/user-send`, { content }, { headers: this.getHeaders() });
  }

  /** Chat with AI Coach */
  sendAIMessage(message: string, sessionId?: string): Observable<any> {
    const body: any = { message };
    if (sessionId) {
      body.sessionId = sessionId;
    }
    return this.http.post(`${environment.apiUrl}/chat/ai`, body, { headers: this.getHeaders() }).pipe(
      catchError(() => {
        // Fallback to /api/chat
        return this.http.post(`${environment.apiUrl}/chat`, body, { headers: this.getHeaders() });
      })
    );
  }

  /** Get AI chat history */
  getAIChatHistory(sessionId?: string): Observable<any> {
    let url = `${environment.apiUrl}/ai/chat/history`;
    if (sessionId) {
      url += `?session_id=${sessionId}`;
    }
    return this.http.get(url, { headers: this.getHeaders() });
  }

  /** Get user chat history with coach */
  getUserChatHistory(): Observable<any> {
    return this.http.get(`${environment.apiUrl}/chat/my-history`, { headers: this.getHeaders() }).pipe(
      map(res => this.normalizeHistoryResponse(res)),
      catchError(() => {
        return this.http.get(`${environment.apiUrl}/chat/user-history`, { headers: this.getHeaders() }).pipe(
          map(res => this.normalizeHistoryResponse(res)),
          catchError(() => {
            return this.http.get(`${environment.apiUrl}/chat/history`, { headers: this.getHeaders() }).pipe(
              map(res => this.normalizeHistoryResponse(res)),
              catchError(() => of([]))
            );
          })
        );
      })
    );
  }

  // ========================
  // INBOX Endpoints (User)
  // ========================
  /** Get user inbox messages (from Admin) */
  getInboxMessages(): Observable<any> {
    return this.http.get(`${environment.apiUrl}/inbox/my`, { headers: this.getHeaders() }).pipe(
      map(res => this.normalizeHistoryResponse(res))
    );
  }

  /** Reply to admin inbox message */
  replyToInbox(content: string): Observable<any> {
    return this.http.post(`${environment.apiUrl}/inbox/reply`, { content }, { headers: this.getHeaders() });
  }

  /** Get unread inbox count */
  getUnreadCount(): Observable<any> {
    return this.http.get(`${environment.apiUrl}/inbox/unread`, { headers: this.getHeaders() });
  }

  // ========================
  // INBOX Endpoints (Admin)
  // ========================

  /** Get users list for admin inbox */
  getInboxUsers(): Observable<any> {
    return this.http.get(`${environment.apiUrl}/inbox/users`, { headers: this.getHeaders() });
  }

  /** Get conversation with specific user (Admin) */
  getInboxConversation(userId: number): Observable<any> {
    return this.http.get(`${environment.apiUrl}/inbox/conversation/${userId}`, { headers: this.getHeaders() }).pipe(
      map(res => this.normalizeHistoryResponse(res))
    );
  }
  /** Send inbox message to user (Admin) */
  sendInboxMessage(userId: number, content: string): Observable<any> {
    return this.http.post(`${environment.apiUrl}/inbox/send/${userId}`, { content }, { headers: this.getHeaders() });
  }

  // ========================
  // COACH / Admin Chat Endpoints
  // ========================

  /** Get coaches list */
  getCoaches(): Observable<any> {
    return this.http.get(`${environment.apiUrl}/coaches`, { headers: this.getHeaders() });
  }

  /** Get all conversations (Coach/Admin) */
  getConversations(): Observable<any> {
    return this.http.get(`${environment.apiUrl}/chat/conversations`, { headers: this.getHeaders() });
  }

  /** Get chat history with specific user (Coach view) */
  getChatHistory(userId: number): Observable<any> {
    return this.http.get(`${environment.apiUrl}/chat/history?userId=${userId}`, { headers: this.getHeaders() }).pipe(
      map(res => this.normalizeHistoryResponse(res)),
      catchError(() => of([]))
    );
  }

  /** Send message to user (Coach) */
  sendCoachMessage(toUserId: number, content: string): Observable<any> {
    return this.http.post(`${environment.apiUrl}/chat/send`, {
      toUserId: toUserId,
      content: content
    }, { headers: this.getHeaders() });
  }

  // ========================
  // Utility
  // ========================

  getMyUserId(): number | null {
    const userDataStr = localStorage.getItem('userData') || localStorage.getItem('user');
    if (userDataStr) {
      try {
        const userData = JSON.parse(userDataStr);
        return userData?.id || userData?.user_id || null;
      } catch (e) {
        return null;
      }
    }
    return null;
  }
}
