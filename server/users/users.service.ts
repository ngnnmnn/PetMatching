import { Injectable } from '@nestjs/common';

export interface User {
  id: number;
  username: string;
  password: string;
  role: string;
  displayName: string;
}

@Injectable()
export class UsersService {
  private users: User[] = [
    {
      id: 1,
      username: 'admin',
      password: '123',
      role: 'admin',
      displayName: 'Administrator',
    },
    {
      id: 2,
      username: 'manager',
      password: '123',
      role: 'manager',
      displayName: 'Manager',
    },
    {
      id: 3,
      username: 'user1',
      password: '123',
      role: 'user',
      displayName: 'User One',
    },
  ];

  async findOne(username: string): Promise<User | undefined> {
    return this.users.find(user => user.username === username);
  }

  async validateUser(username: string, password: string): Promise<User | null> {
    const user = await this.findOne(username);
    if (user && user.password === password) {
      const { password, ...result } = user;
      return result as User;
    }
    return null;
  }

  async createUser(username: string, password: string, displayName?: string): Promise<User> {
    const newUser: User = {
      id: this.users.length + 1,
      username,
      password,
      role: 'user',
      displayName: displayName || username,
    };
    this.users.push(newUser);
    const { password: _, ...result } = newUser;
    return result as User;
  }

  async findByUsername(username: string): Promise<User | undefined> {
    return this.users.find(user => user.username === username);
  }
}