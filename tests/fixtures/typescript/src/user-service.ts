import { useState, useEffect } from 'react';

export interface User {
  id: string;
  name: string;
  email: string;
}

export type UserRole = 'ADMIN' | 'DEVELOPER' | 'GUEST';

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export abstract class BaseService {
  abstract validate(): boolean;
}

export class UserService extends BaseService implements EventTarget {
  private users: User[] = [];

  constructor() {
    super();
  }

  override validate(): boolean {
    return true;
  }

  public async fetchUser(id: string): Promise<User> {
    const res = await fetch(`/api/users/${id}`);
    const data = await res.json();
    return data as User;
  }

  public addEventListener(type: string, callback: EventListenerOrEventListenerObject | null): void {}
  public dispatchEvent(event: Event): boolean { return true; }
  public removeEventListener(type: string, callback: EventListenerOrEventListenerObject | null): void {}
}

export const createGuestUser = (): User => {
  return { id: '0', name: 'Guest', email: 'guest@example.com' };
};
