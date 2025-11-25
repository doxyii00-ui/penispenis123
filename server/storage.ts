import { type User, type InsertUser, type Channel, type InsertChannel } from "@shared/schema";
import { randomUUID } from "crypto";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Channel methods
  getAllChannels(): Promise<Channel[]>;
  getChannelByDiscordId(discordChannelId: string): Promise<Channel | undefined>;
  createChannel(channel: InsertChannel): Promise<Channel>;
  deleteChannel(discordChannelId: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private channels: Map<string, Channel>;
  private channelId: number = 1;

  constructor() {
    this.users = new Map();
    this.channels = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getAllChannels(): Promise<Channel[]> {
    return Array.from(this.channels.values());
  }

  async getChannelByDiscordId(discordChannelId: string): Promise<Channel | undefined> {
    return this.channels.get(discordChannelId);
  }

  async createChannel(insertChannel: InsertChannel): Promise<Channel> {
    const channel: Channel = {
      id: this.channelId++,
      readOnly: true,
      ...insertChannel,
    };
    this.channels.set(channel.discordChannelId, channel);
    return channel;
  }

  async deleteChannel(discordChannelId: string): Promise<boolean> {
    return this.channels.delete(discordChannelId);
  }
}

export const storage = new MemStorage();
