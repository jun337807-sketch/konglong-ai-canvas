import { Group, GroupMember } from '../types/workspace';

const GROUPS_KEY = 'workspace_groups';
const MEMBERS_KEY = 'workspace_group_members';

// A mock local DB wrapper
const db = {
  getGroups: (): Group[] => JSON.parse(localStorage.getItem(GROUPS_KEY) || '[]'),
  saveGroups: (groups: Group[]) => localStorage.setItem(GROUPS_KEY, JSON.stringify(groups)),
  getMembers: (): GroupMember[] => JSON.parse(localStorage.getItem(MEMBERS_KEY) || '[]'),
  saveMembers: (members: GroupMember[]) => localStorage.setItem(MEMBERS_KEY, JSON.stringify(members)),
};

class GroupService {
  async getGroups(): Promise<Group[]> {
    return Promise.resolve(db.getGroups());
  }

  async createGroup(groupData: Partial<Group>): Promise<Group> {
    const groups = db.getGroups();
    const newGroup: Group = {
      group_id: `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      group_name: groupData.group_name || 'New Group',
      description: groupData.description || '',
      created_by: groupData.created_by || 'system',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    groups.push(newGroup);
    db.saveGroups(groups);
    return Promise.resolve(newGroup);
  }

  async getGroupById(groupId: string): Promise<Group | undefined> {
    const groups = db.getGroups();
    return Promise.resolve(groups.find(g => g.group_id === groupId));
  }

  async updateGroup(groupId: string, updates: Partial<Group>): Promise<Group | null> {
    const groups = db.getGroups();
    const index = groups.findIndex(g => g.group_id === groupId);
    if (index === -1) return Promise.resolve(null);

    groups[index] = { ...groups[index], ...updates, updated_at: new Date().toISOString() };
    db.saveGroups(groups);
    return Promise.resolve(groups[index]);
  }

  async deleteGroup(groupId: string): Promise<boolean> {
    let groups = db.getGroups();
    const initialLength = groups.length;
    groups = groups.filter(g => g.group_id !== groupId);
    if (groups.length !== initialLength) {
      db.saveGroups(groups);
      // Optional: clean up members
      const members = db.getMembers();
      db.saveMembers(members.filter(m => m.group_id !== groupId));
      return Promise.resolve(true);
    }
    return Promise.resolve(false);
  }

  // Members
  async getGroupMembers(groupId: string): Promise<GroupMember[]> {
    const members = db.getMembers();
    return Promise.resolve(members.filter(m => m.group_id === groupId));
  }

  async addMemberToGroup(member: Omit<GroupMember, 'joined_at'>): Promise<GroupMember> {
    const members = db.getMembers();
    const newMember: GroupMember = {
      ...member,
      joined_at: new Date().toISOString(),
    };
    members.push(newMember);
    db.saveMembers(members);
    return Promise.resolve(newMember);
  }
}

export const groupService = new GroupService();
