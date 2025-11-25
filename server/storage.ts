import { type User, type InsertUser, type Channel, type InsertChannel, type TicketSetting, type InsertTicketSetting } from "@shared/schema";
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

  // Ticket settings methods
  getTicketSettings(guildId: string): Promise<TicketSetting | undefined>;
  setTicketSettings(setting: InsertTicketSetting): Promise<TicketSetting>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private channels: Map<string, Channel>;
  private ticketSettings: Map<string, TicketSetting>;
  private channelId: number = 1;
  private settingsId: number = 1;

  constructor() {
    this.users = new Map();
    this.channels = new Map();
    this.ticketSettings = new Map();
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

  async getTicketSettings(guildId: string): Promise<TicketSetting | undefined> {
    return this.ticketSettings.get(guildId);
  }

  async setTicketSettings(setting: InsertTicketSetting): Promise<TicketSetting> {
    const existing = this.ticketSettings.get(setting.guildId);
    if (existing) {
      const updated: TicketSetting = { ...existing, ...setting };
      this.ticketSettings.set(setting.guildId, updated);
      return updated;
    }
    const ticketSetting: TicketSetting = {
      id: this.settingsId++,
      ...setting,
    };
    this.ticketSettings.set(ticketSetting.guildId, ticketSetting);
    return ticketSetting;
  }
}

export const storage = new MemStorage();
