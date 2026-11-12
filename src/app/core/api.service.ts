import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import {
  Category,
  DiscordLinkCode,
  DiscordLinkStatus,
  Contribution,
  Goal,
  GoalRequest,
  GoalSummary,
  ImportApproveRequest,
  ImportPreview,
  Insight,
  InsightPeriod,
  Merchant,
  Recurrence,
  RecurrenceRequest,
  RecurrenceSummary,
  Transaction,
  TransactionRequest,
  TransactionType,
} from './models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/api`;

  categories(type?: TransactionType) {
    const params = type ? new HttpParams().set('type', type) : undefined;
    return this.http.get<Category[]>(`${this.base}/categories`, { params });
  }
  createCategory(body: { name: string; type: TransactionType; color: string | null }) {
    return this.http.post<Category>(`${this.base}/categories`, body);
  }
  updateCategory(id: number, body: { name: string; color: string | null }) {
    return this.http.put<Category>(`${this.base}/categories/${id}`, body);
  }
  deleteCategory(id: number) {
    return this.http.delete<void>(`${this.base}/categories/${id}`);
  }

  merchants() {
    return this.http.get<Merchant[]>(`${this.base}/merchants`);
  }
  createMerchant(body: { name: string; categoryId: number }) {
    return this.http.post<Merchant>(`${this.base}/merchants`, body);
  }
  updateMerchant(id: number, body: { name: string; categoryId: number }) {
    return this.http.put<Merchant>(`${this.base}/merchants/${id}`, body);
  }
  deleteMerchant(id: number) {
    return this.http.delete<void>(`${this.base}/merchants/${id}`);
  }

  transactions(filter: { from: string; to: string; categoryId?: number | null; type?: TransactionType | null }) {
    let params = new HttpParams().set('from', filter.from).set('to', filter.to);
    if (filter.categoryId) params = params.set('categoryId', filter.categoryId);
    if (filter.type) params = params.set('type', filter.type);
    return this.http.get<Transaction[]>(`${this.base}/transactions`, { params });
  }
  createTransaction(body: TransactionRequest) {
    return this.http.post<Transaction>(`${this.base}/transactions`, body);
  }
  updateTransaction(id: number, body: TransactionRequest) {
    return this.http.put<Transaction>(`${this.base}/transactions/${id}`, body);
  }
  deleteTransaction(id: number) {
    return this.http.delete<void>(`${this.base}/transactions/${id}`);
  }

  goals(includeArchived = false) {
    return this.http.get<Goal[]>(`${this.base}/goals`, {
      params: new HttpParams().set('includeArchived', includeArchived),
    });
  }
  goalSummary() {
    return this.http.get<GoalSummary>(`${this.base}/goals/summary`);
  }
  createGoal(body: GoalRequest) {
    return this.http.post<Goal>(`${this.base}/goals`, body);
  }
  updateGoal(id: number, body: GoalRequest) {
    return this.http.put<Goal>(`${this.base}/goals/${id}`, body);
  }
  deleteGoal(id: number) {
    return this.http.delete<void>(`${this.base}/goals/${id}`);
  }
  contributions(goalId: number) {
    return this.http.get<Contribution[]>(`${this.base}/goals/${goalId}/contributions`);
  }
  addContribution(goalId: number, body: { amount: number; note: string | null; contributedOn: string | null }) {
    return this.http.post<Contribution>(`${this.base}/goals/${goalId}/contributions`, body);
  }
  deleteContribution(goalId: number, contributionId: number) {
    return this.http.delete<void>(`${this.base}/goals/${goalId}/contributions/${contributionId}`);
  }

  recurrences() {
    return this.http.get<Recurrence[]>(`${this.base}/recurrences`);
  }
  recurrenceSummary() {
    return this.http.get<RecurrenceSummary>(`${this.base}/recurrences/summary`);
  }
  createRecurrence(body: RecurrenceRequest) {
    return this.http.post<Recurrence>(`${this.base}/recurrences`, body);
  }
  updateRecurrence(id: number, body: RecurrenceRequest) {
    return this.http.put<Recurrence>(`${this.base}/recurrences/${id}`, body);
  }
  deleteRecurrence(id: number) {
    return this.http.delete<void>(`${this.base}/recurrences/${id}`);
  }

  discordStatus() {
    return this.http.get<DiscordLinkStatus>(`${this.base}/discord/link`);
  }
  discordLinkCode() {
    return this.http.post<DiscordLinkCode>(`${this.base}/discord/link-code`, {});
  }
  discordUnlink() {
    return this.http.delete<void>(`${this.base}/discord/link`);
  }

  importPreview(file: File) {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<ImportPreview>(`${this.base}/imports/preview`, form);
  }
  importApprove(body: ImportApproveRequest) {
    return this.http.post<Transaction>(`${this.base}/imports/approve`, body);
  }

  insights(period: InsightPeriod, year: number, number: number) {
    const params = new HttpParams().set('period', period).set('year', year).set('number', number);
    return this.http.get<Insight>(`${this.base}/insights`, { params });
  }
}
